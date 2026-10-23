import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { locales } from "@mdbase-dev/i18n/config";

// Build only: this never publishes packs or contacts their delivery endpoint.
const { publicBaseUrl } = JSON.parse(readFileSync("infra/language-packs.json", "utf8"));
const bundledEnvironment = { ...process.env };
delete bundledEnvironment.TASKNOTES_LANGUAGE_PACK_BASE_URL;
const measurements = {};
function build(mode, env) {
	execFileSync("npm", ["run", "build"], { env: { ...env, TASKNOTES_BUNDLE_ANALYSIS: mode }, stdio: "inherit" });
	execFileSync(process.execPath, ["scripts/check-bundle-size.mjs"], { stdio: "inherit" });
	measurements[mode] = statSync("main.js").size;
	const inputs = Object.keys(JSON.parse(readFileSync(`dist/bundle-analysis/${mode}.json`, "utf8")).inputs);
	const catalogues = inputs.filter(input => /^src\/i18n\/locales\/[^/]+\/messages\.json$/.test(input)).map(input => input.split("/")[3]).sort();
	const expected = mode === "bundled" ? [...locales].sort() : ["en"];
	if (JSON.stringify(catalogues) !== JSON.stringify(expected)) throw new Error(`Unexpected ${mode} catalogue graph: ${catalogues}`);
	if (inputs.some(input => input.startsWith("src/i18n/resources/"))) throw new Error("Legacy keyed resources leaked into the production bundle");
	const output = `dist/language-pack-builds/${mode}`;
	mkdirSync(output, { recursive: true });
	for (const file of ["main.js", "styles.css", "manifest.json"]) {
		copyFileSync(file, `${output}/${file}`);
	}
}
try {
	build("downloadable", {
		...bundledEnvironment,
		TASKNOTES_LANGUAGE_PACK_BASE_URL: process.argv[2] || publicBaseUrl,
	});
} finally {
	// Always leave the ordinary, fully bundled artifact, even after a failure.
	build("bundled", bundledEnvironment);
}
writeFileSync("dist/language-pack-builds/measurements.json", JSON.stringify(measurements, null, 2) + "\n");
console.log(JSON.stringify(measurements));
