import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { packFixtures as fixtures, packFormat as format, saveId, compiledCatalogue } from "../helpers/language-pack-fixtures.mjs";
import { linguiMacros } from "../../scripts/lib/lingui-build.mjs";
import { readFileSync } from "node:fs";
const keyMap = JSON.parse(readFileSync(new URL("../../scripts/plugin-key-map.json", import.meta.url), "utf8"));
import {
	createLanguagePackArtifacts,
	exportLanguagePacks,
	loadTranslationResources,
	serialize,
	sha256,
} from "../../scripts/lib/language-packs.mjs";
import { createLanguagePackBuildPlugin } from "../../scripts/lib/language-pack-build.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function compileLoader() {
	const result = await build({
		absWorkingDir: root,
		stdin: {
			contents: 'export { LanguagePackLoader } from "./src/i18n/LanguagePackLoader";',
			resolveDir: root,
			loader: "ts",
		},
		bundle: true,
		format: "esm",
		platform: "node",
		write: false,
		logLevel: "silent",
	});
	return import(
		"data:text/javascript;base64," +
			Buffer.from(result.outputFiles[0].contents).toString("base64")
	);
}

test("catalogue exports are deterministic regardless of insertion order", () => {
	const first = createLanguagePackArtifacts(fixtures, format, 1_000_000);
	const second = createLanguagePackArtifacts(
		Object.fromEntries(Object.entries(fixtures).reverse().map(([locale, messages]) => [locale, Object.fromEntries(Object.entries(messages).reverse())])),
		format,
		1_000_000
	);
	assert.deepEqual(first.manifest, second.manifest);
	assert.deepEqual(first.files, second.files);
	for (const [file, text] of first.files) {
		const descriptor = first.manifest.packs[file.slice(0, -5)];
		assert.equal(descriptor.sha256, sha256(text));
		assert.equal(descriptor.bytes, Buffer.byteLength(text));
	}
});

test("source changes and target corrections produce distinct immutable versions", () => {
	const original = createLanguagePackArtifacts(fixtures, format, 1_000_000);
	const correction = createLanguagePackArtifacts(
		{ ...fixtures, fr: { ...fixtures.fr, ...compiledCatalogue({ [saveId]: "Sauvegarder" }) } },
		format,
		1_000_000
	);
	const sourceChange = createLanguagePackArtifacts(
		{ ...fixtures, en: { ...fixtures.en, ...compiledCatalogue({ [saveId]: "Save changes" }) } },
		format,
		1_000_000
	);
	assert.equal(original.manifest.sourceHash, correction.manifest.sourceHash);
	assert.notEqual(original.manifest.catalogueVersion, correction.manifest.catalogueVersion);
	assert.notEqual(original.manifest.sourceHash, sourceChange.manifest.sourceHash);
	assert.notEqual(original.manifest.catalogueVersion, sourceChange.manifest.catalogueVersion);
});

test("export rejects oversized packs, non-compiled values, partial locale sets and invalid locale paths", () => {
	assert.throws(() => createLanguagePackArtifacts(fixtures, format, 1), /exceeds/);
	const { it: _italian, ...withoutItalian } = fixtures;
	assert.throws(() => createLanguagePackArtifacts(withoutItalian, format, 1_000_000), /all ten/);
	assert.throws(() => createLanguagePackArtifacts({ en: fixtures.en }, format, 1_000_000), /all ten/);
	assert.throws(
		() => createLanguagePackArtifacts({ ...fixtures, en: { [saveId]: 3 } }, format, 1_000_000),
		/Non-compiled/
	);
	assert.throws(
		() => createLanguagePackArtifacts({ ...fixtures, "../fr": fixtures.fr }, format, 1_000_000),
		/all ten/
	);
});

test("real catalogues export idempotently and cannot overwrite a corrupted immutable artifact", async (t) => {
	const outdir = await mkdtemp(resolve(tmpdir(), "tasknotes-pack-export-test-"));
	t.after(() => rm(outdir, { recursive: true, force: true }));
	const first = await exportLanguagePacks({ root, outdir });
	const second = await exportLanguagePacks({ root, outdir });
	assert.equal(first.directory, second.directory);
	assert.deepEqual(
		JSON.parse(await readFile(resolve(first.directory, "manifest.json"), "utf8")),
		first.manifest
	);
	assert.deepEqual(Object.keys(first.manifest.packs).sort(), ["de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]);
	const italian = JSON.parse(await readFile(resolve(first.directory, "it.json"), "utf8"));
	assert.equal(italian.locale, "it");
	assert.equal(italian.sourceHash, first.manifest.sourceHash);
	const english = JSON.parse(await readFile(resolve(first.directory, "en.json"), "utf8"));
	assert.deepEqual(Object.keys(italian.messages).sort(), Object.keys(english.messages).sort());
	assert.equal(first.manifest.packs.it.sha256, sha256(await readFile(resolve(first.directory, "it.json"))));
	await writeFile(resolve(first.directory, "fr.json"), "corrupt");
	await assert.rejects(
		exportLanguagePacks({ root, outdir }),
		/Refusing to overwrite immutable artifact/
	);
});

test("ordinary builds include all resources; opt-in builds include only English and a pinned manifest", async (t) => {
	const outdir = await mkdtemp(resolve(tmpdir(), "tasknotes-pack-build-test-"));
	t.after(() => rm(outdir, { recursive: true, force: true }));
	const options = {
		absWorkingDir: root,
		entryPoints: ["src/i18n/index.ts"],
		bundle: true,
		external: ["obsidian"],
		minify: true,
		format: "cjs",
		write: false,
		metafile: true,
		logLevel: "silent",
	};
	const bundled = await build({ ...options, plugins: [linguiMacros()] });
	const remote = await build({
		...options,
		plugins: [
			linguiMacros(),
			createLanguagePackBuildPlugin({
				root,
				outdir,
				baseUrl: "http://127.0.0.1:19280/tasknotes",
			}),
		],
	});
	const localeInputs = (result) =>
		Object.keys(result.metafile.inputs).filter((path) => /^src\/i18n\/locales\/[^/]+\/messages\.json$/.test(path));
	assert.equal(localeInputs(bundled).length, 10);
	assert.ok(localeInputs(bundled).includes("src/i18n/locales/it/messages.json"));
	assert.deepEqual(localeInputs(remote), ["src/i18n/locales/en/messages.json"]);
	// The old 900 KB delta assumed flat TS resources. Compacted ICU catalogues
	// are checked by exact graph isolation above; production still has the
	// unchanged strict <5,000,000-byte budget in check:language-pack-builds.
	const bundledBytes = bundled.outputFiles[0].contents.length;
	const downloadableBytes = remote.outputFiles[0].contents.length;
	assert.ok(downloadableBytes < bundledBytes, `No catalogue savings: ${downloadableBytes} >= ${bundledBytes}`);
	t.diagnostic(JSON.stringify({ bundledBytes, downloadableBytes, savedBytes: bundledBytes - downloadableBytes }));
	assert.match(remote.outputFiles[0].text, /127\.0\.0\.1:19280/);
	assert.match(remote.outputFiles[0].text, /catalogueVersion/);
});

test("remote builds reject insecure or credential-bearing production URLs", () => {
	for (const baseUrl of [
		"http://example.test",
		"https://user:secret@example.test",
		"https://example.test?secret=1",
	]) {
		assert.throws(() => createLanguagePackBuildPlugin({ baseUrl }), /HTTPS/);
	}
});

test("real packs load over local HTTP, then work offline from cache across loader restarts", async (t) => {
	const { LanguagePackLoader } = await compileLoader();
	const { resources, LANGUAGE_PACK_FORMAT, MAX_LANGUAGE_PACK_BYTES } =
		await loadTranslationResources(root);
	const artifacts = createLanguagePackArtifacts(
		resources,
		LANGUAGE_PACK_FORMAT,
		MAX_LANGUAGE_PACK_BYTES
	);
	let requests = 0;
	const server = createServer((request, response) => {
		requests++;
		const prefix = `/tasknotes/${artifacts.manifest.catalogueVersion}/`;
		const file = request.url?.startsWith(prefix) ? request.url.slice(prefix.length) : "";
		const content = artifacts.files.get(file);
		if (!content) {
			response.writeHead(404);
			response.end();
			return;
		}
		response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
		response.end(content);
	});
	await new Promise((resolve) => server.listen(19280, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const address = server.address();
	const config = {
		baseUrl: `http://127.0.0.1:${address.port}/tasknotes`,
		manifest: artifacts.manifest,
	};
	const cacheFiles = new Map();
	const cache = {
		read: async (key) => cacheFiles.get(key) ?? null,
		write: async (key, text) => {
			cacheFiles.set(key, text);
		},
	};
	const download = async (url) => {
		const response = await fetch(url);
		assert.equal(response.status, 200);
		return new Uint8Array(await response.arrayBuffer());
	};
	const scheduleTimeout = (callback, milliseconds) => {
		const timer = setTimeout(callback, milliseconds);
		return () => clearTimeout(timer);
	};
	const loader = new LanguagePackLoader({
		config,
		english: resources.en,
		cache,
		download,
		scheduleTimeout,
	});
	for (const locale of Object.keys(resources).filter((locale) => locale !== "en")) {
		await t.test(`validates existing ${locale} messages`, async () => {
			assert.deepEqual({ ...(await loader.load(locale)) }, { ...resources[locale] });
		});
	}
	assert.equal(requests, 9);
	const offline = new LanguagePackLoader({
		config,
		english: resources.en,
		cache,
		scheduleTimeout,
		download: async () => {
			throw new Error("offline");
		},
	});
	assert.deepEqual(
		(await offline.load("fr"))[keyMap["common.systemDefault"].id],
		resources.fr[keyMap["common.systemDefault"].id]
	);
	assert.equal(requests, 9);

	const correction = createLanguagePackArtifacts(
		{ ...resources, de: { ...resources.de, ...compiledCatalogue({ [keyMap["common.save"].id]: "Änderungen speichern" }) } },
		LANGUAGE_PACK_FORMAT,
		MAX_LANGUAGE_PACK_BYTES
	);
	assert.notEqual(correction.manifest.catalogueVersion, artifacts.manifest.catalogueVersion);
	const unchangedFrench = new LanguagePackLoader({
		config: { ...config, manifest: correction.manifest },
		english: resources.en,
		cache,
		scheduleTimeout,
		download: async () => {
			throw new Error("offline during unrelated correction");
		},
	});
	assert.deepEqual((await unchangedFrench.load("fr"))[keyMap["common.save"].id], resources.fr[keyMap["common.save"].id]);

	const changed = createLanguagePackArtifacts(
		{ ...resources, en: { ...resources.en, ...compiledCatalogue({ [keyMap["common.save"].id]: "Save changes" }) } },
		LANGUAGE_PACK_FORMAT,
		MAX_LANGUAGE_PACK_BYTES
	);
	const upgraded = new LanguagePackLoader({
		config: { ...config, manifest: changed.manifest },
		english: resources.en,
		cache,
		scheduleTimeout,
		download: async () => {
			throw new Error("offline after upgrade");
		},
	});
	await assert.rejects(upgraded.load("fr"), /offline after upgrade/);
	assert.ok(cacheFiles.has(`${artifacts.manifest.packs.fr.sha256}/fr.json`));
	assert.ok(serialize(changed.manifest).includes(changed.manifest.sourceHash));
});
