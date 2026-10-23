import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";

// Build only: this never publishes packs or contacts their delivery endpoint.
const { publicBaseUrl } = JSON.parse(readFileSync("infra/language-packs.json", "utf8"));
const bundledEnvironment = { ...process.env };
delete bundledEnvironment.TASKNOTES_LANGUAGE_PACK_BASE_URL;
const measurements = {};
function build(mode, env) {
	execFileSync("npm", ["run", "build"], { env, stdio: "inherit" });
	execFileSync(process.execPath, ["scripts/check-bundle-size.mjs"], { stdio: "inherit" });
	measurements[mode] = statSync("main.js").size;
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
console.log(JSON.stringify(measurements));
