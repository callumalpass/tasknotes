/**
 * Patch manifest.json in a git worktree to avoid Obsidian plugin ID collisions.
 *
 * When multiple worktrees sit in .obsidian/plugins/, Obsidian sees duplicate
 * plugin IDs and conflicts. This script rewrites the manifest to use a
 * suffixed ID (e.g., "tasknotes-upstream") so each worktree registers as
 * a separate plugin.
 *
 * Usage:
 *   node scripts/patch-worktree-manifest.mjs <worktree-path> <suffix>
 *
 * Example:
 *   node scripts/patch-worktree-manifest.mjs ../../tasknotes-upstream upstream
 *
 * After patching, the script runs `git update-index --assume-unchanged manifest.json`
 * in the worktree so the patched file is never accidentally committed.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

const [, , worktreePath, suffix] = process.argv;

if (!worktreePath || !suffix) {
	console.error("Usage: node scripts/patch-worktree-manifest.mjs <worktree-path> <suffix>");
	console.error("Example: node scripts/patch-worktree-manifest.mjs ../../tasknotes-upstream upstream");
	process.exit(1);
}

const resolvedPath = resolve(worktreePath);
const manifestPath = join(resolvedPath, "manifest.json");

try {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	const originalId = manifest.id;
	const originalName = manifest.name;

	manifest.id = `tasknotes-${suffix}`;
	manifest.name = `TaskNotes (${suffix})`;

	writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`Patched manifest.json:`);
	console.log(`  id:   ${originalId} -> ${manifest.id}`);
	console.log(`  name: ${originalName} -> ${manifest.name}`);

	// Prevent accidental commits of the patched manifest
	try {
		execSync("git update-index --assume-unchanged manifest.json", {
			cwd: resolvedPath,
			encoding: "utf8",
		});
		console.log(`  git:  manifest.json marked as assume-unchanged`);
	} catch (gitError) {
		console.warn(`  Warning: Could not set assume-unchanged (${gitError.message})`);
		console.warn(`  Run manually: cd ${resolvedPath} && git update-index --assume-unchanged manifest.json`);
	}

	console.log(`\nDone. Enable "TaskNotes (${suffix})" in Obsidian Settings -> Community Plugins.`);
	console.log(`WARNING: Only enable ONE TaskNotes variant at a time to avoid data conflicts.`);
} catch (error) {
	console.error(`Error: ${error.message}`);
	console.error(`  Path: ${manifestPath}`);
	process.exit(1);
}
