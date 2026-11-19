import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyReleaseSource(version, root = process.cwd()) {
	const identifier = "(?:0|[1-9][0-9]*)";
	const releaseVersion = new RegExp(`^${identifier}\\.${identifier}\\.${identifier}(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
	if (typeof version !== "string" || version.trim() !== version || !releaseVersion.test(version) ||
		version.split("-").slice(1).join("-").split(".").some(part => /^0[0-9]+$/.test(part))) {
		throw new Error("Release tag must be an exact version without a v prefix");
	}
	const readJson = path => JSON.parse(readFileSync(join(root, path), "utf8"));
	const manifest = readJson("manifest.json");
	const packageJson = readJson("package.json");
	const lock = readJson("package-lock.json");
	for (const [name, actual] of [
		["manifest.json", manifest.version],
		["package.json", packageJson.version],
		["package-lock.json", lock.version],
		["package-lock.json root package", lock.packages?.[""]?.version],
	]) {
		if (actual !== version) throw new Error(`${name} version does not match release tag ${version}`);
	}
	if (typeof manifest.minAppVersion !== "string" ||
		!new RegExp(`^${identifier}\\.${identifier}\\.${identifier}$`).test(manifest.minAppVersion) ||
		readJson("versions.json")[version] !== manifest.minAppVersion) {
		throw new Error("versions.json must record the release's exact minimum Obsidian version");
	}
	const notesPath = `docs/releases/${version}.md`;
	if (!readFileSync(join(root, notesPath), "utf8").trim()) {
		throw new Error("Release notes must not be empty");
	}
	return { version, notesPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const candidate = verifyReleaseSource(process.argv[2]);
		console.log(`Verified committed release source ${candidate.version}; notes: ${candidate.notesPath}`);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
