import { TFile, parseYaml } from "obsidian";
import TaskNotesPlugin from "../main";
import { AggregatedNotificationItem } from "../types/settings";

/**
 * Cache configuration constants.
 */
const CACHE_TTL_MS = 45_000; // 45 seconds
const INVALIDATION_DEBOUNCE_MS = 500; // Batch invalidations within 500ms window

/**
 * Cached result for a single base file's evaluation.
 */
interface CachedBaseResult {
	cachedAt: number;
	items: AggregatedNotificationItem[];
	monitoredFolders: Set<string>; // Extracted from filters for smart invalidation
}

/**
 * NotificationCache - High-performance caching layer for notification items.
 *
 * Solves critical performance issues:
 * 1. **Constant background activity** - Only re-evaluates affected bases on file change
 * 2. **Delayed bell response** - Returns cached data instantly
 * 3. **No caching** - 45-second TTL on aggregated results
 * 4. **Double evaluation** - In-flight promise deduplication
 *
 * Architecture:
 * ```
 * Bell Click / Periodic Check
 *          │
 *          v
 * ┌─────────────────────────────────────────┐
 * │          NotificationCache              │
 * │  ┌─────────────────────────────────┐   │
 * │  │  Cached Results (45s TTL)       │   │
 * │  │  + In-flight promise dedup      │   │
 * │  └─────────────────────────────────┘   │
 * │  ┌─────────────────────────────────┐   │   On file change:
 * │  │  Folder→Bases Index             │◄──┼── Only invalidate
 * │  │  (smart invalidation lookup)    │   │   affected bases
 * │  └─────────────────────────────────┘   │
 * └─────────────────────────────────────────┘
 *          │
 *          v (cache miss only)
 * ┌─────────────────────────────────────────┐
 * │  VaultWideNotificationService           │
 * │  (existing evaluation logic)            │
 * └─────────────────────────────────────────┘
 * ```
 */
export class NotificationCache {
	private plugin: TaskNotesPlugin;

	// Per-base cached results
	private baseResults: Map<string, CachedBaseResult> = new Map();

	// Aggregated cache (what getAggregatedItems returns)
	private aggregatedItems: AggregatedNotificationItem[] | null = null;
	private aggregatedAt = 0;

	// Folder→Bases index for O(1) invalidation lookup
	private folderToBasesIndex: Map<string, Set<string>> = new Map();

	// In-flight promise deduplication
	private inFlightPromise: Promise<AggregatedNotificationItem[]> | null = null;

	// Debounced invalidation
	private pendingInvalidations: Set<string> = new Set();
	private invalidationTimer: ReturnType<typeof setTimeout> | null = null;

	// Track if index is built
	private indexBuilt = false;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get aggregated notification items. Returns cached data if valid,
	 * otherwise fetches fresh data. Uses in-flight deduplication to prevent
	 * concurrent duplicate evaluations.
	 */
	async getAggregatedItems(): Promise<AggregatedNotificationItem[]> {
		const now = Date.now();

		// Fast path: return cached if valid
		if (this.aggregatedItems && (now - this.aggregatedAt) < CACHE_TTL_MS) {
			this.plugin.debugLog.log(
				"NotificationCache",
				`Cache hit - returning ${this.aggregatedItems.length} items (age: ${now - this.aggregatedAt}ms)`
			);
			return this.aggregatedItems;
		}

		// In-flight deduplication: if evaluation is already running, wait for it
		if (this.inFlightPromise) {
			this.plugin.debugLog.log("NotificationCache", "Joining in-flight evaluation");
			return this.inFlightPromise;
		}

		// Cache miss - trigger fresh evaluation
		this.plugin.debugLog.log("NotificationCache", "Cache miss - starting fresh evaluation");
		this.inFlightPromise = this.evaluateAndCache();

		try {
			const result = await this.inFlightPromise;
			return result;
		} finally {
			this.inFlightPromise = null;
		}
	}

	/**
	 * Internal: Fetch fresh data from VaultWideNotificationService and cache it.
	 */
	private async evaluateAndCache(): Promise<AggregatedNotificationItem[]> {
		const startTime = Date.now();

		try {
			// Build folder index if needed (first call only)
			if (!this.indexBuilt) {
				await this.buildFolderIndex();
			}

			// Use the existing service for evaluation
			const items = await this.plugin.vaultWideNotificationService.getAggregatedItems();

			// Update cache
			this.aggregatedItems = items;
			this.aggregatedAt = Date.now();

			this.plugin.debugLog.log(
				"NotificationCache",
				`Evaluation complete: ${items.length} items in ${Date.now() - startTime}ms`
			);

			return items;
		} catch (error) {
			this.plugin.debugLog.error("NotificationCache", "Evaluation failed", error);
			// Return empty on error but don't cache the failure
			return [];
		}
	}

	/**
	 * Smart invalidation: Only invalidate caches for bases that monitor
	 * the folder containing the changed file.
	 *
	 * Called by BasesQueryWatcher on file change events.
	 */
	invalidateForPath(changedPath: string): void {
		// Extract folder from path
		const folder = this.extractFolder(changedPath);

		this.plugin.debugLog.log(
			"NotificationCache",
			`Invalidation requested for path: ${changedPath} (folder: ${folder})`
		);

		// Find bases that monitor this folder
		const affectedBases = this.folderToBasesIndex.get(folder);

		if (!affectedBases || affectedBases.size === 0) {
			this.plugin.debugLog.log(
				"NotificationCache",
				`No bases monitor folder ${folder} - skipping invalidation`
			);
			return;
		}

		// Queue invalidations for debouncing
		for (const basePath of affectedBases) {
			this.pendingInvalidations.add(basePath);
		}

		// Always invalidate aggregated cache when any base is affected
		this.aggregatedItems = null;

		this.plugin.debugLog.log(
			"NotificationCache",
			`Queued ${affectedBases.size} base(s) for invalidation: ${[...affectedBases].join(", ")}`
		);

		// Debounce: process after window closes
		this.scheduleInvalidationProcessing();
	}

	/**
	 * Force full cache invalidation. Use sparingly - e.g., when base file
	 * itself changes or settings change.
	 */
	invalidateAll(): void {
		this.plugin.debugLog.log("NotificationCache", "Full cache invalidation");
		this.baseResults.clear();
		this.aggregatedItems = null;
		this.aggregatedAt = 0;
	}

	/**
	 * Invalidate only the aggregated cache (not per-base caches).
	 * Used when non-base sources change (e.g., upstream reminders fire).
	 */
	invalidateAggregated(): void {
		this.plugin.debugLog.log("NotificationCache", "Aggregated cache invalidated (upstream reminder)");
		this.aggregatedItems = null;
	}

	/**
	 * Invalidate cache for a specific base file.
	 */
	invalidateBase(basePath: string): void {
		this.plugin.debugLog.log("NotificationCache", `Invalidating cache for base: ${basePath}`);
		this.baseResults.delete(basePath);
		this.aggregatedItems = null;
	}

	/**
	 * Rebuild the folder→bases index. Called on startup and when .base files change.
	 */
	async buildFolderIndex(): Promise<void> {
		const startTime = Date.now();
		this.folderToBasesIndex.clear();

		const baseFiles = this.plugin.app.vault.getFiles().filter(f => f.extension === "base");

		for (const file of baseFiles) {
			try {
				const monitoredFolders = await this.extractMonitoredFolders(file);

				for (const folder of monitoredFolders) {
					let basesForFolder = this.folderToBasesIndex.get(folder);
					if (!basesForFolder) {
						basesForFolder = new Set();
						this.folderToBasesIndex.set(folder, basesForFolder);
					}
					basesForFolder.add(file.path);
				}
			} catch (error) {
				this.plugin.debugLog.error(
					"NotificationCache",
					`Failed to extract folders from ${file.path}`,
					error
				);
			}
		}

		this.indexBuilt = true;

		this.plugin.debugLog.log(
			"NotificationCache",
			`Folder index built: ${this.folderToBasesIndex.size} folders → bases mappings in ${Date.now() - startTime}ms`
		);
	}

	/**
	 * Extract monitored folders from a base file's source filter.
	 *
	 * Parses source patterns like:
	 * - `source: '"TaskNotes/Tasks"'` → ["TaskNotes/Tasks"]
	 * - `source: 'path LIKE "Document Library/%"'` → ["Document Library"]
	 * - `source: 'folder = "Projects" OR folder = "Archive"'` → ["Projects", "Archive"]
	 */
	private async extractMonitoredFolders(file: TFile): Promise<Set<string>> {
		const folders = new Set<string>();

		try {
			const content = await this.plugin.app.vault.read(file);
			const parsed = parseYaml(content);

			if (!parsed) return folders;

			// Check if this base has notify: true (only index notification bases)
			const hasNotify = parsed.notify === true ||
				(Array.isArray(parsed.views) && parsed.views.some((v: any) => v?.notify === true));

			if (!hasNotify) {
				return folders; // Don't index non-notification bases
			}

			const source = parsed.source;
			if (!source || typeof source !== "string") {
				return folders;
			}

			// Extract folder paths from various patterns
			// Pattern 1: Direct quoted path "FolderName" or "Folder/SubFolder"
			const directPathMatches = source.matchAll(/"([^"]+)"/g);
			for (const match of directPathMatches) {
				const path = match[1];
				// Check if it looks like a folder path (not a filter value)
				if (path.includes("/") || this.looksLikeFolderPath(path, source)) {
					folders.add(this.normalizeFolder(path));
				}
			}

			// Pattern 2: path LIKE "Folder/%" or path LIKE "%Folder%"
			const likeMatches = source.matchAll(/path\s+LIKE\s+"([^"]+)"/gi);
			for (const match of likeMatches) {
				const pattern = match[1];
				// Extract the folder part before % wildcard
				const folderPart = pattern.replace(/%/g, "").replace(/\/$/, "");
				if (folderPart) {
					folders.add(this.normalizeFolder(folderPart));
				}
			}

			// Pattern 3: folder = "FolderName"
			const folderMatches = source.matchAll(/folder\s*=\s*"([^"]+)"/gi);
			for (const match of folderMatches) {
				folders.add(this.normalizeFolder(match[1]));
			}

		} catch (error) {
			this.plugin.debugLog.error(
				"NotificationCache",
				`Failed to parse ${file.path}`,
				error
			);
		}

		return folders;
	}

	/**
	 * Check if a quoted string likely represents a folder path in the source context.
	 */
	private looksLikeFolderPath(str: string, source: string): boolean {
		// If the source mentions this string right after "source:" or in a path context
		// Check for common folder indicators
		const folderIndicators = [
			`"${str}"`, // Direct source reference
			`folder`,
			`path`,
		];

		return folderIndicators.some(indicator =>
			source.toLowerCase().includes(indicator.toLowerCase())
		);
	}

	/**
	 * Normalize folder path: remove trailing slash, handle wildcards.
	 */
	private normalizeFolder(path: string): string {
		return path.replace(/\/$/, "").replace(/%/g, "");
	}

	/**
	 * Extract the folder portion from a file path.
	 */
	private extractFolder(filePath: string): string {
		const lastSlash = filePath.lastIndexOf("/");
		if (lastSlash === -1) {
			return ""; // Root level
		}
		return filePath.substring(0, lastSlash);
	}

	/**
	 * Schedule debounced invalidation processing.
	 */
	private scheduleInvalidationProcessing(): void {
		if (this.invalidationTimer) {
			clearTimeout(this.invalidationTimer);
		}

		this.invalidationTimer = setTimeout(() => {
			this.processInvalidations();
		}, INVALIDATION_DEBOUNCE_MS);
	}

	/**
	 * Process queued invalidations.
	 */
	private processInvalidations(): void {
		if (this.pendingInvalidations.size === 0) {
			return;
		}

		this.plugin.debugLog.log(
			"NotificationCache",
			`Processing ${this.pendingInvalidations.size} queued invalidations`
		);

		// Invalidate each affected base's cache
		for (const basePath of this.pendingInvalidations) {
			this.baseResults.delete(basePath);
		}

		this.pendingInvalidations.clear();
		this.invalidationTimer = null;
	}

	/**
	 * Called when a .base file is created, modified, or deleted.
	 * Triggers index rebuild for that base.
	 */
	async onBaseFileChanged(basePath: string): Promise<void> {
		this.plugin.debugLog.log("NotificationCache", `Base file changed: ${basePath}`);

		// Remove old index entries for this base
		for (const [folder, bases] of this.folderToBasesIndex) {
			bases.delete(basePath);
			if (bases.size === 0) {
				this.folderToBasesIndex.delete(folder);
			}
		}

		// Re-index this base if it still exists
		const file = this.plugin.app.vault.getAbstractFileByPath(basePath);
		if (file instanceof TFile) {
			const folders = await this.extractMonitoredFolders(file);
			for (const folder of folders) {
				let basesForFolder = this.folderToBasesIndex.get(folder);
				if (!basesForFolder) {
					basesForFolder = new Set();
					this.folderToBasesIndex.set(folder, basesForFolder);
				}
				basesForFolder.add(basePath);
			}
		}

		// Invalidate this base's cache
		this.invalidateBase(basePath);
	}

	/**
	 * Cleanup on plugin unload.
	 */
	cleanup(): void {
		if (this.invalidationTimer) {
			clearTimeout(this.invalidationTimer);
			this.invalidationTimer = null;
		}
		this.baseResults.clear();
		this.aggregatedItems = null;
		this.folderToBasesIndex.clear();
		this.pendingInvalidations.clear();
		this.inFlightPromise = null;
	}

	/**
	 * Get cache statistics for debugging.
	 */
	getStats(): { basesCached: number; foldersIndexed: number; cacheAge: number | null } {
		return {
			basesCached: this.baseResults.size,
			foldersIndexed: this.folderToBasesIndex.size,
			cacheAge: this.aggregatedItems ? Date.now() - this.aggregatedAt : null,
		};
	}
}
