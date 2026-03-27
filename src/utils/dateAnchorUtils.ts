import type TaskNotesPlugin from "../main";
import type { TaskInfo, FieldMapping } from "../types";
import { TFile } from "obsidian";
import { buildSkipKeys, normalizeDateValue, keyToDisplayName, buildPropertyCatalog, getAllTaskFilePaths } from "./propertyDiscoveryUtils";

/**
 * Where a date anchor originates from.
 * - "core": Built-in TaskNotes fields (due, scheduled, dateCreated, etc.)
 * - "settings": User-defined fields configured in Settings → User fields
 * - "discovered": Auto-discovered from task frontmatter (not configured anywhere)
 */
export type DateAnchorOrigin = "core" | "settings" | "discovered";

/**
 * Represents a date property that can serve as a reminder anchor.
 */
export interface DateAnchor {
	/** Internal/FieldMapping key (e.g., "due", "scheduled") or custom field key */
	key: string;
	/** User-configured frontmatter property name, when different from key (core fields only) */
	frontmatterKey?: string;
	/** Human-readable label (e.g., "Due date", "Review date") */
	displayName: string;
	/** Current date value on the task, if available */
	currentValue?: string;
	/** Where this anchor originates from */
	origin: DateAnchorOrigin;
	/** For vault-wide discovered: number of task files with this property */
	vaultFileCount?: number;
}

/**
 * Options for getAvailableDateAnchors().
 */
export interface DateAnchorOptions {
	/** When true and no task is provided, scan the entire vault for date properties */
	includeVaultWideDiscovery?: boolean;
	/** When provided, scan only these specific file paths for discovery (bulk context) */
	itemPaths?: string[];
}

// ── Vault-wide discovery cache ──────────────────────────────────
let vaultWideDateCache: { anchors: DateAnchor[]; timestamp: number } | null = null;
const VAULT_CACHE_TTL = 30_000; // 30 seconds

/** Invalidate the vault-wide date property cache (call after settings changes). */
export function invalidateVaultDateCache(): void {
	vaultWideDateCache = null;
}

function getVaultWideDateAnchors(plugin: TaskNotesPlugin, knownKeys: Set<string>): DateAnchor[] {
	const now = Date.now();
	if (vaultWideDateCache && (now - vaultWideDateCache.timestamp) < VAULT_CACHE_TTL) {
		return vaultWideDateCache.anchors.filter(a => !knownKeys.has(a.key));
	}

	const paths = getAllTaskFilePaths(plugin);
	const catalog = buildPropertyCatalog(plugin, paths);
	const dateEntries = catalog.filter(e => e.dominantType === "date");

	const allAnchors: DateAnchor[] = dateEntries.map(entry => ({
		key: entry.key,
		displayName: keyToDisplayName(entry.key),
		origin: "discovered" as DateAnchorOrigin,
		vaultFileCount: entry.fileCount,
	}));

	vaultWideDateCache = { anchors: allAnchors, timestamp: now };
	return allAnchors.filter(a => !knownKeys.has(a.key));
}

/**
 * Discover date anchors from a specific set of file paths (bulk context).
 * Similar to getVaultWideDateAnchors but scoped to provided paths and uncached.
 */
function getItemScopedDateAnchors(
	plugin: TaskNotesPlugin,
	itemPaths: string[],
	knownKeys: Set<string>
): DateAnchor[] {
	const catalog = buildPropertyCatalog(plugin, itemPaths);
	const dateEntries = catalog.filter(e => e.dominantType === "date");
	return dateEntries
		.filter(entry => !knownKeys.has(entry.key))
		.map(entry => ({
			key: entry.key,
			displayName: keyToDisplayName(entry.key),
			origin: "discovered" as DateAnchorOrigin,
			vaultFileCount: entry.fileCount,
		}));
}

/**
 * Built-in date fields that exist on TaskInfo and in FieldMapping.
 * The taskInfoKey matches the property name on the TaskInfo interface.
 */
const BUILT_IN_DATE_FIELDS: Array<{
	key: keyof FieldMapping;
	displayName: string;
	taskInfoKey: keyof TaskInfo;
}> = [
	{ key: "due", displayName: "Due date", taskInfoKey: "due" },
	{ key: "scheduled", displayName: "Scheduled date", taskInfoKey: "scheduled" },
	{ key: "dateCreated", displayName: "Date created", taskInfoKey: "dateCreated" },
	{ key: "dateModified", displayName: "Date modified", taskInfoKey: "dateModified" },
	{ key: "completedDate", displayName: "Completed date", taskInfoKey: "completedDate" },
];

/**
 * Get all available date properties that can serve as reminder anchors.
 * Combines built-in date fields with user-defined date fields from settings.
 * When `options.includeVaultWideDiscovery` is true and no task is provided,
 * also scans the vault for date properties found across all task files.
 *
 * @param plugin - The TaskNotes plugin instance
 * @param task - Optional task to populate currentValue for each anchor
 * @param options - Optional settings (e.g., vault-wide discovery)
 * @returns Array of DateAnchor objects
 */
export function getAvailableDateAnchors(
	plugin: TaskNotesPlugin,
	task?: TaskInfo,
	options?: DateAnchorOptions
): DateAnchor[] {
	const anchors: DateAnchor[] = [];

	// Add built-in date fields
	for (const field of BUILT_IN_DATE_FIELDS) {
		const mappedName = plugin.fieldMapper?.toUserField(field.key) ?? (field.key as string);
		const anchor: DateAnchor = {
			key: field.key as string,
			frontmatterKey: mappedName !== (field.key as string) ? mappedName : undefined,
			displayName: field.displayName,
			origin: "core",
		};

		if (task) {
			const value = task[field.taskInfoKey];
			if (typeof value === "string" && value) {
				anchor.currentValue = value;
			}
		}

		anchors.push(anchor);
	}

	// Add user-defined date fields from settings
	// buildSkipKeys includes CORE_PROPERTY_KEYS + FieldMapper-mapped frontmatter names
	const knownKeys = buildSkipKeys(plugin);
	// Also add built-in internal keys (some may differ from mapped names)
	for (const f of BUILT_IN_DATE_FIELDS) knownKeys.add(f.key as string);

	const userFields = plugin.settings?.userFields;
	if (userFields && Array.isArray(userFields)) {
		for (const field of userFields) {
			if (field.type === "date" && !knownKeys.has(field.key)) {
				const anchor: DateAnchor = {
					key: field.key,
					displayName: field.displayName || keyToDisplayName(field.key),
					origin: "settings",
				};

				// Check customProperties on the task for user field values
				if (task?.customProperties && task.customProperties[field.key]) {
					const value = task.customProperties[field.key];
					if (typeof value === "string" && value) {
						anchor.currentValue = value;
					}
				}

				knownKeys.add(field.key);
				anchors.push(anchor);
			}
		}
	}

	// Auto-discover date properties from task frontmatter
	// This catches custom date fields that aren't configured as user fields
	if (task?.path && plugin.app) {
		const file = plugin.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			const cache = plugin.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				for (const [key, value] of Object.entries(cache.frontmatter)) {
					if (knownKeys.has(key)) continue;

					// Check if the value looks like a date (handles both strings and Date objects)
					const dateStr = normalizeDateValue(value);
					if (dateStr) {
						anchors.push({
							key,
							displayName: keyToDisplayName(key),
							currentValue: dateStr,
							origin: "discovered",
						});
						knownKeys.add(key);
					}
				}
			}
		}
	}

	// Also check task.customProperties for date values not yet found
	if (task?.customProperties) {
		for (const [key, value] of Object.entries(task.customProperties)) {
			if (knownKeys.has(key)) continue;
			const dateStr = normalizeDateValue(value);
			if (dateStr) {
				anchors.push({
					key,
					displayName: keyToDisplayName(key),
					currentValue: dateStr,
					origin: "discovered",
				});
				knownKeys.add(key);
			}
		}
	}

	// Item-scoped discovery: scan only the bulk item files for date properties
	if (options?.itemPaths?.length) {
		const itemAnchors = getItemScopedDateAnchors(plugin, options.itemPaths, knownKeys);
		for (const anchor of itemAnchors) {
			anchors.push(anchor);
			knownKeys.add(anchor.key);
		}
	}
	// Vault-wide discovery: scan all task files for date properties not yet known.
	// Runs when no task path is available (settings or bulk context) and explicitly requested.
	else if ((!task || !task.path) && options?.includeVaultWideDiscovery) {
		const vaultAnchors = getVaultWideDateAnchors(plugin, knownKeys);
		for (const anchor of vaultAnchors) {
			anchors.push(anchor);
			knownKeys.add(anchor.key);
		}
	}

	return anchors;
}

/**
 * Resolve a date anchor key to an actual date string from a task.
 * Handles built-in fields (via TaskInfo properties) and custom fields
 * (via customProperties or raw frontmatter lookup).
 *
 * @param task - The task to resolve the date from
 * @param anchorKey - The anchor key (e.g., "due", "scheduled", or custom field key)
 * @param plugin - The TaskNotes plugin instance (for FieldMapper and metadataCache fallback)
 * @returns The date string, or null if not found
 */
export function resolveAnchorDate(
	task: TaskInfo,
	anchorKey: string,
	plugin: TaskNotesPlugin
): string | null {
	if (!anchorKey) return null;

	// 1. Check built-in TaskInfo fields
	const builtIn = BUILT_IN_DATE_FIELDS.find((f) => f.key === anchorKey);
	if (builtIn) {
		const value = task[builtIn.taskInfoKey];
		if (typeof value === "string" && value) {
			return value;
		}
	}

	// 2. Check customProperties (populated by Bases views)
	if (task.customProperties?.[anchorKey]) {
		const value = task.customProperties[anchorKey];
		if (typeof value === "string" && value) {
			return value;
		}
	}

	// 3. Fallback: read raw frontmatter from metadataCache
	// This handles custom user date fields that aren't in customProperties
	if (task.path && plugin.app) {
		const file = plugin.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			const cache = plugin.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				// Try the anchor key directly (for custom fields stored with their key)
				const directValue = cache.frontmatter[anchorKey];
				const normalizedDirect = normalizeDateValue(directValue);
				if (normalizedDirect) {
					return normalizedDirect;
				}

				// Try the user-configured field name via FieldMapper
				// (in case anchorKey is an internal name that maps to a different frontmatter key)
				if (plugin.fieldMapper) {
					try {
						const userFieldName = plugin.fieldMapper.toUserField(
							anchorKey as keyof FieldMapping
						);
						if (userFieldName && userFieldName !== anchorKey) {
							const mappedValue = cache.frontmatter[userFieldName];
							const normalizedMapped = normalizeDateValue(mappedValue);
							if (normalizedMapped) {
								return normalizedMapped;
							}
						}
					} catch {
						// anchorKey is not a valid FieldMapping key, skip
					}
				}
			}
		}
	}

	return null;
}

/**
 * Get a human-readable display name for an anchor key.
 * Checks built-in fields first, then user-defined fields.
 */
export function getAnchorDisplayName(
	anchorKey: string,
	plugin: TaskNotesPlugin
): string {
	// Check built-in fields
	const builtIn = BUILT_IN_DATE_FIELDS.find((f) => f.key === anchorKey);
	if (builtIn) return builtIn.displayName;

	// Check user-defined fields
	const userFields = plugin.settings?.userFields;
	if (userFields && Array.isArray(userFields)) {
		const userField = userFields.find((f) => f.key === anchorKey);
		if (userField) return userField.displayName || userField.key;
	}

	// Fallback: return raw key (honest about what the frontmatter property is called)
	return anchorKey;
}
