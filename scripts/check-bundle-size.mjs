import { statSync } from "node:fs";

// Use decimal MB conservatively, and require headroom below the limit.
const limit = 5_000_000;
const bundle = process.argv[2] ?? "main.js";

try {
	const stats = statSync(bundle);
	if (!stats.isFile() || stats.size === 0) {
		throw new Error("expected a non-empty bundle file");
	}
	console.log(`${bundle}: ${stats.size.toLocaleString("en-US")} bytes; must be below ${limit.toLocaleString("en-US")} bytes.`);
	if (stats.size >= limit) {
		console.error("Bundle exceeds the size budget for Obsidian Sync Standard. Reduce the production bundle before releasing.");
		process.exitCode = 1;
	}
} catch (error) {
	console.error(`Cannot check bundle ${bundle}: ${error.message}`);
	process.exitCode = 1;
}
