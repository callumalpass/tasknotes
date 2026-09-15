import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, truncateSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("./check-bundle-size.mjs", import.meta.url));

for (const [name, size, expectedStatus] of [
	["below limit", 4_999_999, 0],
	["at limit", 5_000_000, 1],
	["above limit", 5_000_001, 1],
	["empty file", 0, 1],
	["missing file", null, 1],
]) {
	test(name, () => {
		const directory = mkdtempSync(join(tmpdir(), "tasknotes-bundle-size-"));
		try {
			const bundle = join(directory, "main.js");
			if (size !== null) {
				writeFileSync(bundle, "");
				truncateSync(bundle, size);
			}
			// Check both the default main.js path and an explicit path.
			for (const args of [[], [bundle]]) {
				const result = spawnSync(process.execPath, [script, ...args], {
					cwd: directory,
					encoding: "utf8",
				});
				assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
}
