import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");

export function compareVersions(left, right) {
	const parse = (version) => {
		if (!/^\d+\.\d+\.\d+$/.test(version)) {
			throw new Error(`Invalid Obsidian version: ${version}`);
		}
		return version.split(".").map(Number);
	};
	const a = parse(left);
	const b = parse(right);
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return 0;
}

export function findLatestAppImage(home) {
	const candidates = [];
	for (const directory of ["Applications", "Downloads"]) {
		const location = path.join(home, directory);
		if (!fs.existsSync(location)) continue;
		for (const name of fs.readdirSync(location)) {
			const match = /^Obsidian-(\d+\.\d+\.\d+)\.AppImage$/.exec(name);
			if (match && fs.statSync(path.join(location, name)).isFile()) {
				candidates.push({ version: match[1], file: path.join(location, name) });
			}
		}
	}
	candidates.sort((a, b) => compareVersions(b.version, a.version));
	if (!candidates.length) {
		throw new Error("No Obsidian AppImage found in ~/Applications or ~/Downloads. Pass its path to npm run e2e:setup -- /path/to/Obsidian.AppImage.");
	}
	return candidates[0].file;
}

export function readAsarVersion(file) {
	return JSON.parse(asar.extractFile(file, "package.json").toString()).version;
}

export function installAppPackage(resources, dataDirectory, minimumVersion, explicitAsar) {
	const destination = path.join(resources, "obsidian.asar");
	let source = destination;
	let version = readAsarVersion(source);
	if (explicitAsar) {
		source = path.resolve(explicitAsar);
		version = readAsarVersion(source);
	} else if (fs.existsSync(dataDirectory)) {
		for (const name of fs.readdirSync(dataDirectory)) {
			if (!/^obsidian-\d+\.\d+\.\d+\.asar$/.test(name)) continue;
			const candidate = path.join(dataDirectory, name);
			const candidateVersion = readAsarVersion(candidate);
			if (compareVersions(candidateVersion, version) > 0) {
				source = candidate;
				version = candidateVersion;
			}
		}
	}
	if (compareVersions(version, minimumVersion) < 0) {
		throw new Error(`Obsidian ${version} is too old; TaskNotes requires ${minimumVersion} or newer. Install a compatible AppImage or set OBSIDIAN_ASAR to a compatible app package.`);
	}
	// The Electron loader reads this archive, not resources/app/.
	if (path.resolve(source) !== path.resolve(destination)) fs.copyFileSync(source, destination);
	return { source, version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		if (process.argv[2] === "appimage") {
			console.log(findLatestAppImage(process.env.HOME));
		} else if (process.argv[2] === "install") {
			const minimumVersion = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).minAppVersion;
			const result = installAppPackage(process.argv[3], process.argv[4], minimumVersion, process.env.OBSIDIAN_ASAR);
			console.log(`Using Obsidian ${result.version} from ${result.source}`);
		} else {
			throw new Error("Usage: node scripts/e2e-runtime.mjs appimage | install <resources> <Obsidian data directory>");
		}
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
