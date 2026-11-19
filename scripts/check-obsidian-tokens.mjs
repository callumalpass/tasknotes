import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

// Fails when plugin CSS reads a custom property, without a fallback, that
// neither Obsidian nor TaskNotes defines. Obsidian's stylesheet is read from
// the local install and never copied into the repository.
const require = createRequire(import.meta.url);
const asar = require("@electron/asar");

function findAppPackage() {
	if (process.env.OBSIDIAN_ASAR) return process.env.OBSIDIAN_ASAR;
	const dir = path.join(os.homedir(), ".config", "obsidian");
	const packages = readdirSync(dir)
		.filter((name) => /^obsidian-\d+\.\d+\.\d+\.asar$/.test(name))
		.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
	if (!packages.length) throw new Error(`no obsidian-<version>.asar in ${dir}; set OBSIDIAN_ASAR`);
	return path.join(dir, packages.at(-1));
}

function walk(dir, ext, out = []) {
	for (const name of readdirSync(dir)) {
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) walk(file, ext, out);
		else if (name.endsWith(ext)) out.push(file);
	}
	return out;
}

const declared = (css) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

let appPackage;
try {
	appPackage = findAppPackage();
} catch (error) {
	console.error(`Cannot find Obsidian's app package: ${error.message}`);
	process.exit(1);
}

const obsidian = declared(asar.extractFile(appPackage, "app.css").toString());
const ours = new Set();
const cssFiles = [...walk("styles", ".css"), "vendor/tasknotes-calendar/calendar.css"];
for (const file of cssFiles) for (const name of declared(readFileSync(file, "utf8"))) ours.add(name);
// Properties set from code (setProperty, setStyle maps, inline style strings).
// The calendar library sets some properties from its own code.
for (const file of [...walk("src", ".ts"), ...walk("node_modules/@tasknotes/calendar/dist/esm", ".js")]) {
	for (const m of readFileSync(file, "utf8").matchAll(/["'`](--[\w-]+)["'`]/g)) ours.add(m[1]);
	for (const m of readFileSync(file, "utf8").matchAll(/["'`]?(--[\w-]+)["'`]?\s*:/g)) ours.add(m[1]);
}

const problems = [];
for (const file of walk("styles", ".css")) {
	const lines = readFileSync(file, "utf8").split("\n");
	lines.forEach((line, i) => {
		for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
			if (!obsidian.has(m[1]) && !ours.has(m[1])) problems.push(`${file}:${i + 1}: ${m[1]}`);
		}
	});
}

console.log(`Checked against ${path.basename(appPackage)} (${obsidian.size} Obsidian properties, ${ours.size} TaskNotes properties).`);
if (problems.length) {
	console.error(`${problems.length} var() references with no fallback name a property nothing defines:\n${problems.join("\n")}`);
	process.exitCode = 1;
}
