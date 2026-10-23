import { build } from "esbuild";
import { locales as supportedLocales } from "@mdbase-dev/i18n/config";
import catalogueGates from "./catalogue-gates.cjs";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export function sha256(contents) {
	return createHash("sha256").update(contents).digest("hex");
}

function canonicalJSON(value) {
	if (Array.isArray(value)) return value.map(canonicalJSON);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonicalJSON(value[key])])
		);
	}
	return value;
}

export function serialize(value) {
	return JSON.stringify(canonicalJSON(value)) + "\n";
}

// Compile trusted repository sources for the build process only. Published packs
// are JSON data; this does not run downloaded code in the plugin.
export async function loadTranslationResources(root = repositoryRoot) {
	const locales = (await readdir(resolve(root, "src/i18n/locales"), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
	if (JSON.stringify(locales) !== JSON.stringify([...supportedLocales].sort())) throw new Error("Language-pack export requires all nine supported catalogues, and no extra locales");
	const resources = Object.fromEntries(await Promise.all(locales.map(async locale => {
		const catalogue = JSON.parse(await readFile(resolve(root, `src/i18n/locales/${locale}/messages.json`), "utf8"));
		return [locale, catalogue.messages];
	})));
	const contents = [
		'import { isCompiledMessages, validateTranslationMessage } from "./src/i18n/catalogue.ts";',
		'import { LANGUAGE_PACK_FORMAT, MAX_LANGUAGE_PACK_BYTES } from "./src/i18n/languagePackTypes.ts";',
		"export { LANGUAGE_PACK_FORMAT, MAX_LANGUAGE_PACK_BYTES, isCompiledMessages, validateTranslationMessage };",
	].join("\n");
	const result = await build({
		absWorkingDir: root,
		stdin: { contents, resolveDir: root, loader: "ts" },
		bundle: true,
		format: "esm",
		platform: "node",
		write: false,
		logLevel: "silent",
	});
	const loaded = await import(
		"data:text/javascript;base64," +
			Buffer.from(result.outputFiles[0].contents).toString("base64")
	);
	for (const [locale, messages] of Object.entries(resources)) {
		if (!loaded.isCompiledMessages(messages)) throw new Error(`Invalid compiled messages in ${locale}`);
		if (JSON.stringify(Object.keys(messages).sort()) !== JSON.stringify(Object.keys(resources.en).sort())) throw new Error(`Message set mismatch: ${locale}`);
		for (const [key, value] of Object.entries(messages)) loaded.validateTranslationMessage(key, resources.en[key], value);
	}
	return { ...loaded, resources, omittedKeys: {} };
}

export function createLanguagePackArtifacts(resources, format, maxBytes) {
	if (!resources.en) throw new Error("English source catalogue is missing");
	if (JSON.stringify(Object.keys(resources).sort()) !== JSON.stringify([...supportedLocales].sort())) throw new Error("Language-pack export requires all nine supported catalogues, and no extra locales");
	const sourceHash = sha256(serialize(resources.en));
	const files = new Map();
	const packs = {};
	for (const locale of Object.keys(resources).sort()) {
		if (!/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/.test(locale))
			throw new Error(`Invalid locale: ${locale}`);
		const messages = resources[locale];
		if (!messages || !Object.values(messages).every((value) => Array.isArray(value))) {
			throw new Error(`Non-compiled message in ${locale}`);
		}
		const contents = serialize({ format, locale, sourceHash, messages });
		const bytes = Buffer.byteLength(contents, "utf8");
		if (bytes > maxBytes) throw new Error(`Language pack ${locale} exceeds ${maxBytes} bytes`);
		const file = `${locale}.json`;
		files.set(file, contents);
		packs[locale] = { file, bytes, sha256: sha256(contents) };
	}
	const identity = { format, product: "tasknotes", sourceHash, packs };
	const manifest = { ...identity, catalogueVersion: sha256(serialize(identity)) };
	return { manifest, files };
}

async function writeImmutable(path, contents) {
	try {
		const existing = await readFile(path, "utf8");
		if (existing !== contents)
			throw new Error(`Refusing to overwrite immutable artifact: ${path}`);
		return;
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	await writeFile(path, contents, { flag: "wx" });
}

export async function exportLanguagePacks({
	root = repositoryRoot,
	outdir = resolve(root, "dist/language-packs"),
} = {}) {
	// Publication and standalone build-plugin callers cannot bypass authored-PO checks.
	// Send diagnostics to stderr so the export CLI retains its JSON stdout contract.
	catalogueGates.prepareStrictCatalogues(root, { diagnosticsToStderr: true });
	const { resources, LANGUAGE_PACK_FORMAT, MAX_LANGUAGE_PACK_BYTES } =
		await loadTranslationResources(root);
	const artifacts = createLanguagePackArtifacts(
		resources,
		LANGUAGE_PACK_FORMAT,
		MAX_LANGUAGE_PACK_BYTES
	);
	const directory = resolve(outdir, artifacts.manifest.catalogueVersion);
	await mkdir(directory, { recursive: true });
	for (const [file, contents] of artifacts.files) {
		await writeImmutable(resolve(directory, file), contents);
	}
	// The manifest is the commit point and is always written after its packs.
	await writeImmutable(resolve(directory, "manifest.json"), serialize(artifacts.manifest));
	return { ...artifacts, directory };
}
