import { build } from "esbuild";
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
	const files = (await readdir(resolve(root, "src/i18n/resources")))
		.filter((file) => /^[a-z]{2}(?:-[A-Za-z0-9]+)*\.ts$/.test(file))
		.sort();
	const locales = files.map((file) => file.slice(0, -3));
	if (!locales.includes("en")) throw new Error("English source catalogue is missing");
	const imports = locales.map(
		(locale, index) =>
			`import { ${locale.replaceAll("-", "_")} as locale${index} } from "./src/i18n/resources/${locale}.ts";`
	);
	const contents = [
		...imports,
		'import { flattenTranslations, validateTranslationMessage } from "./src/i18n/catalogue.ts";',
		'import { LANGUAGE_PACK_FORMAT, MAX_LANGUAGE_PACK_BYTES } from "./src/i18n/languagePackTypes.ts";',
		`export const resources = { ${locales.map((locale, index) => `${JSON.stringify(locale)}: flattenTranslations(locale${index})`).join(",")} };`,
		"export { LANGUAGE_PACK_FORMAT, MAX_LANGUAGE_PACK_BYTES, validateTranslationMessage };",
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
	const omittedKeys = {};
	const resources = Object.fromEntries(
		Object.entries(loaded.resources).map(([locale, messages]) => {
			omittedKeys[locale] = Object.keys(messages).filter(
				(key) => !Object.hasOwn(loaded.resources.en, key)
			);
			const current = Object.fromEntries(
				Object.entries(messages).filter(([key]) => Object.hasOwn(loaded.resources.en, key))
			);
			for (const [key, translated] of Object.entries(current)) {
				loaded.validateTranslationMessage(key, loaded.resources.en[key], translated);
			}
			return [locale, current];
		})
	);
	return { ...loaded, resources, omittedKeys };
}

export function createLanguagePackArtifacts(resources, format, maxBytes) {
	if (!resources.en) throw new Error("English source catalogue is missing");
	const sourceHash = sha256(serialize(resources.en));
	const files = new Map();
	const packs = {};
	for (const locale of Object.keys(resources).sort()) {
		if (!/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/.test(locale))
			throw new Error(`Invalid locale: ${locale}`);
		const messages = resources[locale];
		if (!Object.values(messages).every((value) => typeof value === "string")) {
			throw new Error(`Non-string message in ${locale}`);
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
