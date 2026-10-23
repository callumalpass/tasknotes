import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
	createLanguagePackArtifacts,
	exportLanguagePacks,
	loadTranslationResources,
	serialize,
	sha256,
} from "../../scripts/lib/language-packs.mjs";
import { createLanguagePackBuildPlugin } from "../../scripts/lib/language-pack-build.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const format = "tasknotes-ui-v1";
const fixtures = {
	en: { save: "Save", hello: "Hello {name}" },
	fr: { save: "Enregistrer", hello: "Bonjour {name}" },
};

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
		{
			fr: { hello: "Bonjour {name}", save: "Enregistrer" },
			en: { hello: "Hello {name}", save: "Save" },
		},
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
		{ ...fixtures, fr: { ...fixtures.fr, save: "Sauvegarder" } },
		format,
		1_000_000
	);
	const sourceChange = createLanguagePackArtifacts(
		{ ...fixtures, en: { ...fixtures.en, save: "Save changes" } },
		format,
		1_000_000
	);
	assert.equal(original.manifest.sourceHash, correction.manifest.sourceHash);
	assert.notEqual(original.manifest.catalogueVersion, correction.manifest.catalogueVersion);
	assert.notEqual(original.manifest.sourceHash, sourceChange.manifest.sourceHash);
	assert.notEqual(original.manifest.catalogueVersion, sourceChange.manifest.catalogueVersion);
});

test("export rejects oversized packs, non-string values, and invalid locale paths", () => {
	assert.throws(() => createLanguagePackArtifacts(fixtures, format, 1), /exceeds/);
	assert.throws(
		() => createLanguagePackArtifacts({ en: { save: 3 } }, format, 1_000_000),
		/Non-string/
	);
	assert.throws(
		() => createLanguagePackArtifacts({ en: {}, "../fr": {} }, format, 1_000_000),
		/Invalid locale/
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
	assert.equal(Object.keys(first.manifest.packs).length, 9);
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
	const bundled = await build(options);
	const remote = await build({
		...options,
		plugins: [
			createLanguagePackBuildPlugin({
				root,
				outdir,
				baseUrl: "http://127.0.0.1:8123/tasknotes",
			}),
		],
	});
	const localeInputs = (result) =>
		Object.keys(result.metafile.inputs).filter((path) => /^src\/i18n\/resources\//.test(path));
	assert.equal(localeInputs(bundled).length, 9);
	assert.deepEqual(localeInputs(remote), ["src/i18n/resources/en.ts"]);
	assert.ok(
		remote.outputFiles[0].contents.length < bundled.outputFiles[0].contents.length - 900_000
	);
	assert.match(remote.outputFiles[0].text, /127\.0\.0\.1:8123/);
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
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
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
	assert.equal(requests, 8);
	const offline = new LanguagePackLoader({
		config,
		english: resources.en,
		cache,
		scheduleTimeout,
		download: async () => {
			throw new Error("offline");
		},
	});
	assert.equal(
		(await offline.load("fr"))["common.systemDefault"],
		resources.fr["common.systemDefault"]
	);
	assert.equal(requests, 8);

	const correction = createLanguagePackArtifacts(
		{ ...resources, de: { ...resources.de, "common.save": "Änderungen speichern" } },
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
	assert.equal((await unchangedFrench.load("fr"))["common.save"], resources.fr["common.save"]);

	const changed = createLanguagePackArtifacts(
		{ ...resources, en: { ...resources.en, "common.save": "Save changes" } },
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
