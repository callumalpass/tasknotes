import { resolve } from "node:path";
import { exportLanguagePacks } from "./lib/language-packs.mjs";

const json = process.argv.includes("--json");
const args = process.argv.slice(2).filter((arg) => arg !== "--json");
if (args.length > 1 || args.some((arg) => arg.startsWith("-"))) {
	throw new Error("Usage: node scripts/export-language-packs.mjs [output-directory] [--json]");
}
const { manifest, directory } = await exportLanguagePacks(
	args[0] ? { outdir: resolve(args[0]) } : {}
);
if (json) {
	console.log(JSON.stringify({ manifest, directory }));
} else {
	console.log(`Exported ${Object.keys(manifest.packs).length} language packs to ${directory}`);
	for (const [locale, pack] of Object.entries(manifest.packs)) {
		console.log(
			`  ${locale}: ${pack.bytes.toLocaleString("en-US")} bytes, SHA-256 ${pack.sha256}`
		);
	}
}
