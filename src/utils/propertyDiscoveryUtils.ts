import type TaskNotesPlugin from "../main";
import { TFile } from "obsidian";
import { TRACKING_PROP_NAMES } from "./fieldOverrideUtils";

/**
 * Supported property types for discovered frontmatter fields.
 */
export type PropertyType = "text" | "number" | "date" | "boolean" | "list";

/**
 * A single property discovered from a task file's frontmatter.
 */
export interface DiscoveredProperty {
	/** Frontmatter key (e.g., "review_date") */
	key: string;
	/** Human-readable label (e.g., "Review date") */
	displayName: string;
	/** Detected type */
	type: PropertyType;
	/** Current value from the specific file */
	value: any;
}

/**
 * Aggregated property info across multiple files.
 * Used by PropertyPicker to show vault-wide property stats.
 */
export interface PropertyCatalogEntry {
	/** Frontmatter key */
	key: string;
	/** Human-readable label */
	displayName: string;
	/** Most common type across files */
	dominantType: PropertyType;
	/** Type breakdown: e.g., { date: 43, text: 2 } */
	typeBreakdown: Record<string, number>;
	/** Total files that have this property */
	fileCount: number;
	/** File paths with non-dominant type (for conversion targeting) */
	mismatchedFiles: string[];
	/** All file paths that have this property (for full conversion) */
	allFiles: string[];
	/** Whether all values are the same type */
	isConsistent: boolean;
	/** First non-null sample value discovered (for pre-filling UI) */
	sampleValue?: any;
}

/**
 * Result of a batch type conversion operation.
 */
export interface ConversionResult {
	converted: number;
	failed: number;
	errors: string[];
}

// ── Shared constants ──────────────────────────────────────────

/**
 * Core/internal property keys that should be excluded from discovery.
 * Union of known task fields (from bases/helpers.ts knownProperties)
 * and non-date field keys (from dateAnchorUtils.ts NON_DATE_FIELD_KEYS).
 */
export const CORE_PROPERTY_KEYS = new Set([
	// Task model fields (bases/helpers.ts knownProperties)
	"title", "status", "priority", "archived", "due", "scheduled",
	"contexts", "projects", "tags", "timeEstimate", "completedDate",
	"recurrence", "dateCreated", "dateModified", "timeEntries",
	"reminders", "icsEventId", "complete_instances", "skipped_instances",
	"blockedBy", "blocking",
	// Additional non-date fields (dateAnchorUtils.ts)
	"type", "assignee", "assignees", "creator", "aliases", "cssclasses",
	"recurrence_anchor", "archiveTag", "completeInstances",
	"skippedInstances", "pomodoros", "icsEventTag", "tnId", "uid",
	"publish", "permalink", "description",
	// Obsidian internal / metadataCache
	"position",
	// Per-task field override tracking properties
	"tnDueDateProp", "tnScheduledDateProp", "tnCompletedDateProp", "tnCreatedDateProp",
]);

/**
 * Build the full set of property keys to skip during discovery.
 * Includes CORE_PROPERTY_KEYS plus FieldMapper-mapped frontmatter names
 * (e.g., internal "due" maps to frontmatter "due_date" — both skipped).
 */
export function buildSkipKeys(plugin: TaskNotesPlugin): Set<string> {
	const skip = new Set(CORE_PROPERTY_KEYS);
	const settings = plugin.settings;
	if (!settings) return skip;

	// Add FieldMapper-mapped frontmatter names
	const mapping = settings.fieldMapping;
	if (mapping) {
		for (const val of Object.values(mapping)) {
			if (typeof val === "string" && val) skip.add(val);
		}
	}

	// Add task identification property (e.g., "isTask", "tnType", or whatever the user configured)
	if (settings.taskIdentificationMethod === "property" && settings.taskPropertyName) {
		skip.add(settings.taskPropertyName);
	}

	// Add identity type property used for person/group detection
	if (settings.identityTypePropertyName) {
		skip.add(settings.identityTypePropertyName);
	}

	return skip;
}

// ── Shared utility functions ──────────────────────────────────

/** Regex to match date-like strings (YYYY-MM-DD with optional time) */
const DATE_LIKE_REGEX = /^\d{4}-\d{2}-\d{2}/;

/**
 * Convert a snake_case or camelCase key to a human-readable display name.
 * e.g., "review_date" -> "Review date", "followUp" -> "Follow up"
 */
export function keyToDisplayName(key: string): string {
	return key
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/^./, (c) => c.toUpperCase());
}

/**
 * Normalize a frontmatter value that may be a Date object or string into a YYYY-MM-DD string.
 * Obsidian's YAML parser converts bare date values (e.g., `due: 2026-02-11`) into JS Date objects.
 * Returns null if the value is not date-like.
 */
export function normalizeDateValue(value: unknown): string | null {
	if (value instanceof Date && !isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === "string" && DATE_LIKE_REGEX.test(value)) {
		return value;
	}
	return null;
}

/**
 * Detect the property type from a JavaScript value.
 * Order matters: Date check before string check (Obsidian YAML parses dates as Date objects).
 */
export function detectPropertyType(value: unknown): PropertyType {
	if (value === null || value === undefined) return "text";
	if (value instanceof Date) return "date";
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "number") return "number";
	if (Array.isArray(value)) return "list";
	if (typeof value === "string") {
		if (DATE_LIKE_REGEX.test(value)) return "date";
		return "text";
	}
	return "text";
}

// ── Single-file discovery ─────────────────────────────────────

/**
 * Discover custom properties from a single file's frontmatter.
 * Fast — suitable for inline use in Edit Task modal.
 *
 * @param plugin - The TaskNotes plugin instance
 * @param filePath - Path to the file to scan
 * @param excludeKeys - Keys to exclude (e.g., already-rendered userFields)
 * @returns Array of discovered properties
 */
export function discoverCustomProperties(
	plugin: TaskNotesPlugin,
	filePath: string,
	excludeKeys?: Set<string>
): DiscoveredProperty[] {
	const results: DiscoveredProperty[] = [];
	if (!plugin.app) return results;

	const file = plugin.app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return results;

	const cache = plugin.app.metadataCache.getFileCache(file);
	if (!cache?.frontmatter) return results;

	const skipKeys = buildSkipKeys(plugin);

	for (const [key, value] of Object.entries(cache.frontmatter)) {
		if (skipKeys.has(key)) continue;
		if (excludeKeys?.has(key)) continue;

		const type = detectPropertyType(value);
		let normalizedValue = value;
		if (type === "date") {
			normalizedValue = normalizeDateValue(value) ?? value;
		}

		results.push({
			key,
			displayName: keyToDisplayName(key),
			type,
			value: normalizedValue,
		});
	}

	return results;
}

// ── Multi-file catalog ────────────────────────────────────────

/**
 * Build a property catalog across multiple files.
 * Shows type consistency, file counts, and mismatched files.
 *
 * @param plugin - The TaskNotes plugin instance
 * @param filePaths - File paths to scan (can be all task files or just view items)
 * @param excludeKeys - Keys to exclude from results
 * @returns Array of catalog entries sorted by fileCount descending
 */
export function buildPropertyCatalog(
	plugin: TaskNotesPlugin,
	filePaths: string[],
	excludeKeys?: Set<string>,
	/** Optional pre-extracted frontmatter to use instead of metadataCache (for SMB resilience). */
	frontmatterOverrides?: Map<string, Record<string, any>>
): PropertyCatalogEntry[] {
	if (!plugin.app) return [];

	const skipKeys = buildSkipKeys(plugin);

	// key -> { typeBreakdown, files by type, sampleValue }
	const catalog = new Map<string, {
		typeBreakdown: Record<string, number>;
		filesByType: Record<string, string[]>;
		fileCount: number;
		sampleValue?: any;
	}>();

	for (const filePath of filePaths) {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;

		// Use pre-extracted frontmatter if available (SMB resilience), fall back to cache
		const frontmatter = frontmatterOverrides?.get(filePath)
			?? plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!frontmatter) continue;

		for (const [key, value] of Object.entries(frontmatter)) {
			if (skipKeys.has(key)) continue;
			if (excludeKeys?.has(key)) continue;

			const type = detectPropertyType(value);

			let entry = catalog.get(key);
			if (!entry) {
				entry = { typeBreakdown: {}, filesByType: {}, fileCount: 0 };
				catalog.set(key, entry);
			}

			entry.typeBreakdown[type] = (entry.typeBreakdown[type] || 0) + 1;
			if (!entry.filesByType[type]) entry.filesByType[type] = [];
			entry.filesByType[type].push(filePath);
			entry.fileCount++;

			// Capture first non-null sample value for UI pre-filling
			if (entry.sampleValue === undefined && value != null && value !== "") {
				entry.sampleValue = value;
			}
		}
	}

	// Convert to catalog entries
	const entries: PropertyCatalogEntry[] = [];
	for (const [key, data] of catalog) {
		// Find dominant type (most common)
		let dominantType: PropertyType = "text";
		let maxCount = 0;
		for (const [type, count] of Object.entries(data.typeBreakdown)) {
			if (count > maxCount) {
				maxCount = count;
				dominantType = type as PropertyType;
			}
		}

		// Collect mismatched files (files with non-dominant type)
		const mismatchedFiles: string[] = [];
		for (const [type, files] of Object.entries(data.filesByType)) {
			if (type !== dominantType) {
				mismatchedFiles.push(...files);
			}
		}

		// Collect all file paths across all types
		const allFiles: string[] = [];
		for (const files of Object.values(data.filesByType)) {
			allFiles.push(...files);
		}

		entries.push({
			key,
			displayName: keyToDisplayName(key),
			dominantType,
			typeBreakdown: data.typeBreakdown,
			fileCount: data.fileCount,
			mismatchedFiles,
			allFiles,
			isConsistent: mismatchedFiles.length === 0,
			sampleValue: data.sampleValue,
		});
	}

	// Sort by file count descending
	entries.sort((a, b) => b.fileCount - a.fileCount);
	return entries;
}

// ── Vault-wide task file collection ───────────────────────────

/**
 * Get all task file paths in the vault using the plugin's task identification method.
 */
export function getAllTaskFilePaths(plugin: TaskNotesPlugin): string[] {
	if (!plugin.app || !plugin.cacheManager) return [];

	const paths: string[] = [];
	for (const file of plugin.app.vault.getMarkdownFiles()) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter && plugin.cacheManager.isTaskFile(cache.frontmatter)) {
			paths.push(file.path);
		}
	}
	return paths;
}

/**
 * Get all markdown file paths in the vault (not just task files).
 * Used when property discovery should include non-task notes,
 * e.g., for base view defaults that query across all file types.
 */
export function getAllMarkdownFilePaths(plugin: TaskNotesPlugin): string[] {
	if (!plugin.app) return [];
	return plugin.app.vault.getMarkdownFiles().map(f => f.path);
}

// ── Type conversion engine ────────────────────────────────────

/**
 * Convert a property's type across multiple files.
 *
 * @param plugin - The TaskNotes plugin instance
 * @param propertyKey - The frontmatter key to convert
 * @param targetType - The desired target type
 * @param filePaths - Files to convert (only files with mismatched types)
 * @param strategy - "convert-in-place" or "create-duplicate"
 * @returns Conversion results with counts and errors
 */
/** Map our PropertyType to Obsidian's internal metadataTypeManager type names. */
const OBSIDIAN_TYPE_NAMES: Record<PropertyType, string> = {
	date: "date",
	text: "text",
	number: "number",
	boolean: "checkbox",
	list: "multitext",
};

export async function convertPropertyType(
	plugin: TaskNotesPlugin,
	propertyKey: string,
	targetType: PropertyType,
	filePaths: string[],
	strategy: "convert-in-place" | "create-duplicate",
	onProgress?: (completed: number, total: number) => void,
): Promise<ConversionResult> {
	const result: ConversionResult = { converted: 0, failed: 0, errors: [] };
	if (!plugin.app) return result;

	const targetKey = strategy === "convert-in-place" ? propertyKey : `${propertyKey}_${targetType}`;
	const total = filePaths.length;

	for (const filePath of filePaths) {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			result.failed++;
			result.errors.push(`File not found: ${filePath}`);
			onProgress?.(result.converted + result.failed, total);
			continue;
		}

		try {
			await plugin.app.fileManager.processFrontMatter(file, (fm) => {
				const currentValue = fm[propertyKey];
				// Skip null, undefined, and empty — nothing meaningful to convert
				if (currentValue === undefined || currentValue === null || currentValue === "") return;

				const converted = coerceValue(currentValue, targetType);

				if (strategy === "convert-in-place") {
					fm[propertyKey] = converted;
				} else {
					// create-duplicate: new key with target type suffix
					fm[targetKey] = converted;
				}
			});
			result.converted++;
		} catch (err) {
			result.failed++;
			result.errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
		}
		onProgress?.(result.converted + result.failed, total);
	}

	// Update Obsidian's property type registry so the UI reflects the new type
	if (result.converted > 0) {
		try {
			const typeManager = (plugin.app as any).metadataTypeManager;
			if (typeManager?.setType) {
				await typeManager.setType(targetKey, OBSIDIAN_TYPE_NAMES[targetType] || targetType);
			}
		} catch {
			// Non-critical: property type registry update failed, values are still converted
		}
	}

	return result;
}

/**
 * Coerce a value to the target type.
 */
function coerceValue(value: unknown, targetType: PropertyType): any {
	// Preserve null/undefined as-is — don't convert to string "null"
	if (value === null || value === undefined) return null;

	switch (targetType) {
		case "date": {
			// Date object -> YYYY-MM-DD
			if (value instanceof Date) return value.toISOString().slice(0, 10);
			// String -> try parsing as date
			if (typeof value === "string") {
				const d = new Date(value);
				if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
				return value; // Return as-is if not parseable
			}
			// Number -> unix timestamp
			if (typeof value === "number") {
				return new Date(value).toISOString().slice(0, 10);
			}
			return String(value);
		}
		case "number": {
			if (typeof value === "number") return value;
			if (typeof value === "boolean") return value ? 1 : 0;
			const n = parseFloat(String(value));
			return isNaN(n) ? 0 : n;
		}
		case "boolean": {
			if (typeof value === "boolean") return value;
			if (typeof value === "number") return value !== 0;
			const s = String(value).toLowerCase().trim();
			return s === "true" || s === "yes" || s === "1";
		}
		case "list": {
			if (Array.isArray(value)) return value;
			if (value === null || value === undefined) return [];
			return [value];
		}
		case "text":
		default: {
			if (value instanceof Date) return value.toISOString().slice(0, 10);
			if (Array.isArray(value)) return value.join(", ");
			return String(value);
		}
	}
}
