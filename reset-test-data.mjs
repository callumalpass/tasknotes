/**
 * Test data reset script for the TaskNotes dev vault.
 *
 * Usage:
 *   node reset-test-data.mjs              # Reset vault to clean state from fixtures
 *   node reset-test-data.mjs --create     # Create fixtures from current vault files (strips task metadata)
 *
 * What it does (reset mode):
 *   1. Copies clean fixture files to Document Library, Knowledge/ (overwrites dirty files)
 *   2. Deletes all .md files in TaskNotes/Tasks/ (generated task files)
 *
 * What it does (create mode):
 *   1. Reads Document Library, Knowledge/ files from the vault
 *   2. Strips task-related frontmatter fields (isTask, priority, dateCreated, dateModified, projects)
 *   3. Writes clean copies to test-fixtures/Document Library, Knowledge/
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = __dirname;
const VAULT_ROOT = resolve(REPO_ROOT, "../../..");
const FIXTURES_DIR = join(REPO_ROOT, "test-fixtures");
const DOC_LIBRARY_FIXTURE = join(FIXTURES_DIR, "Document Library, Knowledge");
const DOC_LIBRARY_VAULT = join(VAULT_ROOT, "Document Library, Knowledge");
const TASKS_DIR = join(VAULT_ROOT, "TaskNotes", "Tasks");

// Fields to strip from frontmatter when creating fixtures
// All fields that bulk-convert or task creation can inject into a non-task note
const TASK_FIELDS = ["isTask", "priority", "dateCreated", "dateModified", "projects",
	"due", "scheduled", "assignee", "assignees", "tnType", "tnId", "completedDate",
	"recurrence", "reminders", "timeEstimate", "timeEntries", "blockedBy", "blocking",
	"subtasks", "parent", "creator", "contexts"];

function log(msg) {
	console.log(`[reset] ${msg}`);
}

/**
 * Strip task-related fields from YAML frontmatter.
 * Handles both single-line values and multi-line arrays (e.g., projects: [...]).
 */
function stripTaskFields(content) {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return content;

	const frontmatter = fmMatch[1];
	const lines = frontmatter.split("\n");
	const cleanedLines = [];
	let skipping = false;

	for (const line of lines) {
		// Check if this line starts a field we want to strip
		const isTaskField = TASK_FIELDS.some((field) => line.match(new RegExp(`^${field}:`)));

		if (isTaskField) {
			skipping = true; // Skip this line and any continuation lines
			continue;
		}

		// If we were skipping, check if this line is a continuation (indented or array item)
		if (skipping) {
			if (line.match(/^\s+/) || line.match(/^\s*-\s/)) {
				continue; // Still part of the multi-line value
			}
			skipping = false; // Back to a new top-level key
		}

		cleanedLines.push(line);
	}

	const cleanedFrontmatter = cleanedLines.join("\n");
	return content.replace(/^---\n[\s\S]*?\n---/, `---\n${cleanedFrontmatter}\n---`);
}

/**
 * Create fixtures by reading vault files and stripping task metadata.
 */
function createFixtures() {
	log("Creating fixtures from current vault files...");

	if (!existsSync(DOC_LIBRARY_VAULT)) {
		log(`ERROR: Document Library, Knowledge not found at ${DOC_LIBRARY_VAULT}`);
		process.exit(1);
	}

	mkdirSync(DOC_LIBRARY_FIXTURE, { recursive: true });

	const files = readdirSync(DOC_LIBRARY_VAULT).filter((f) => f.endsWith(".md"));
	let count = 0;

	for (const file of files) {
		const sourcePath = join(DOC_LIBRARY_VAULT, file);
		const destPath = join(DOC_LIBRARY_FIXTURE, file);
		const content = readFileSync(sourcePath, "utf-8");
		const cleaned = stripTaskFields(content);
		writeFileSync(destPath, cleaned, "utf-8");
		count++;

		const stripped = content !== cleaned;
		log(`  ${stripped ? "Stripped" : "Copied "} ${file}${stripped ? " (removed task fields)" : ""}`);
	}

	log(`Created ${count} fixture file(s) in test-fixtures/Document Library, Knowledge/`);
}

/**
 * Reset vault to clean state from fixtures.
 */
function resetVault() {
	log(`Vault root: ${VAULT_ROOT}`);

	if (!existsSync(VAULT_ROOT)) {
		log(`ERROR: Vault root not found at ${VAULT_ROOT}`);
		process.exit(1);
	}

	if (!existsSync(DOC_LIBRARY_FIXTURE)) {
		log("ERROR: Fixtures not found. Run with --create first:");
		log("  node reset-test-data.mjs --create");
		process.exit(1);
	}

	// Step 1: Restore Document Library, Knowledge from fixtures
	let docsRestored = 0;
	const fixtureFiles = readdirSync(DOC_LIBRARY_FIXTURE).filter((f) => f.endsWith(".md"));

	for (const file of fixtureFiles) {
		const src = join(DOC_LIBRARY_FIXTURE, file);
		const dest = join(DOC_LIBRARY_VAULT, file);
		copyFileSync(src, dest);
		docsRestored++;
	}

	log(`Restored ${docsRestored} document(s) to clean state`);

	// Step 2: Delete generated task files
	let tasksDeleted = 0;
	if (existsSync(TASKS_DIR)) {
		const taskFiles = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".md"));
		for (const file of taskFiles) {
			unlinkSync(join(TASKS_DIR, file));
			tasksDeleted++;
		}
	}

	log(`Deleted ${tasksDeleted} generated task file(s)`);

	// Summary
	log("Done. Reload Obsidian or wait for metadata cache to update.");
}

// Main
const args = process.argv.slice(2);
if (args.includes("--create")) {
	createFixtures();
} else {
	resetVault();
}
