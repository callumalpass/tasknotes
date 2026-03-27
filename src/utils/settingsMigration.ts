/**
 * Reusable migration utilities for settings that control logic by matching
 * frontmatter values. When a user changes such a setting, these functions
 * count affected notes, show a confirmation modal, and optionally migrate
 * all matching frontmatter in bulk.
 */

import { App, Notice, TFile } from "obsidian";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import type TaskNotesPlugin from "../main";

export type MigrationResult = "migrated" | "skipped" | "cancelled";

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Collect files whose frontmatter matches a predicate.
 * Uses metadataCache (no file I/O) so it's fast even on large vaults.
 */
function collectAffectedFiles(
	plugin: TaskNotesPlugin,
	predicate: (frontmatter: Record<string, any>, file: TFile) => boolean,
	fileFilter?: (file: TFile) => boolean,
): TFile[] {
	const results: TFile[] = [];
	for (const file of plugin.app.vault.getMarkdownFiles()) {
		if (fileFilter && !fileFilter(file)) continue;
		const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm && predicate(fm, file)) {
			results.push(file);
		}
	}
	return results;
}

/**
 * Show a 3-button confirmation modal for migration.
 * Returns: true = migrate, false = skip, "cancelled" = revert.
 */
async function showMigrationConfirmation(
	app: App,
	title: string,
	message: string,
): Promise<MigrationResult> {
	let cancelled = false;

	const confirmed = await showConfirmationModal(app, {
		title,
		message,
		confirmText: "Migrate all",
		cancelText: "Change without migrating",
		thirdButtonText: "Cancel change",
		onThirdButton: () => { cancelled = true; },
	});

	if (cancelled) return "cancelled";
	return confirmed ? "migrated" : "skipped";
}

// ── Migration Functions ────────────────────────────────────────────

/**
 * Migrate a frontmatter value change across matching files.
 * Example: changing personTypeValue from "tn-person" to "people"
 * updates `tnType: tn-person` → `tnType: people` in all matching notes.
 */
export async function migratePropertyValue(options: {
	app: App;
	plugin: TaskNotesPlugin;
	/** Frontmatter property name to check (e.g., "tnType") */
	propertyName: string;
	oldValue: string;
	newValue: string;
	/** Optional file filter (e.g., limit to a folder) */
	fileFilter?: (file: TFile) => boolean;
	/** Human-readable description (e.g., "person notes") */
	description: string;
}): Promise<MigrationResult> {
	const { app, plugin, propertyName, oldValue, newValue, fileFilter, description } = options;

	if (oldValue === newValue || !oldValue) return "skipped";

	const affected = collectAffectedFiles(
		plugin,
		(fm) => fm[propertyName] === oldValue,
		fileFilter,
	);

	if (affected.length === 0) return "skipped";

	const result = await showMigrationConfirmation(
		app,
		`Migrate ${description}`,
		`${affected.length} ${description} currently have ${propertyName}: "${oldValue}". Update them to "${newValue}"?`,
	);

	if (result === "migrated") {
		let count = 0;
		for (const file of affected) {
			await app.fileManager.processFrontMatter(file, (fm) => {
				if (fm[propertyName] === oldValue) {
					fm[propertyName] = newValue;
					count++;
				}
			});
		}
		new Notice(`Migrated ${count} ${description}.`);
	}

	return result;
}

/**
 * Migrate a frontmatter property key rename across matching files.
 * Example: changing identityTypePropertyName from "tnType" to "noteType"
 * renames the key in all notes that have it.
 */
export async function migratePropertyName(options: {
	app: App;
	plugin: TaskNotesPlugin;
	oldPropertyName: string;
	newPropertyName: string;
	/** Optional file filter (e.g., limit to task files) */
	fileFilter?: (file: TFile) => boolean;
	/** Human-readable description (e.g., "person and group notes") */
	description: string;
}): Promise<MigrationResult> {
	const { app, plugin, oldPropertyName, newPropertyName, fileFilter, description } = options;

	if (oldPropertyName === newPropertyName || !oldPropertyName) return "skipped";

	const affected = collectAffectedFiles(
		plugin,
		(fm) => fm[oldPropertyName] !== undefined,
		fileFilter,
	);

	if (affected.length === 0) return "skipped";

	const result = await showMigrationConfirmation(
		app,
		`Rename property in ${description}`,
		`${affected.length} ${description} use the property "${oldPropertyName}". Rename it to "${newPropertyName}"?`,
	);

	if (result === "migrated") {
		let count = 0;
		for (const file of affected) {
			await app.fileManager.processFrontMatter(file, (fm) => {
				if (fm[oldPropertyName] !== undefined) {
					fm[newPropertyName] = fm[oldPropertyName];
					delete fm[oldPropertyName];
					count++;
				}
			});
		}
		new Notice(`Renamed property in ${count} ${description}.`);
	}

	return result;
}

/**
 * Migrate a tag rename in frontmatter tags arrays.
 * Example: changing taskTag from "task" to "todo"
 * replaces the tag in all notes that have it.
 */
export async function migrateTag(options: {
	app: App;
	plugin: TaskNotesPlugin;
	oldTag: string;
	newTag: string;
	/** Human-readable description (e.g., "task notes") */
	description: string;
}): Promise<MigrationResult> {
	const { app, plugin, oldTag, newTag, description } = options;

	if (oldTag === newTag || !oldTag) return "skipped";

	const affected = collectAffectedFiles(
		plugin,
		(fm) => {
			if (!Array.isArray(fm.tags)) return false;
			return fm.tags.some((t: string) => t === oldTag || t === `#${oldTag}`);
		},
	);

	if (affected.length === 0) return "skipped";

	const result = await showMigrationConfirmation(
		app,
		`Migrate ${description}`,
		`${affected.length} notes have the tag "${oldTag}". Rename it to "${newTag}"?`,
	);

	if (result === "migrated") {
		let count = 0;
		for (const file of affected) {
			await app.fileManager.processFrontMatter(file, (fm) => {
				if (Array.isArray(fm.tags)) {
					const idx = fm.tags.indexOf(oldTag);
					if (idx !== -1) {
						fm.tags[idx] = newTag;
						count++;
					} else {
						// Try with # prefix
						const hashIdx = fm.tags.indexOf(`#${oldTag}`);
						if (hashIdx !== -1) {
							fm.tags[hashIdx] = `#${newTag}`;
							count++;
						}
					}
				}
			});
		}
		new Notice(`Migrated tag in ${count} ${description}.`);
	}

	return result;
}
