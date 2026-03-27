import { EventRef, TFile, parseYaml, WorkspaceLeaf } from "obsidian";
import TaskNotesPlugin from "../main";
import { EVENT_TASK_UPDATED } from "../types";
import {
	BasesNotificationModal,
	NotificationItem,
} from "../modals/BasesNotificationModal";

/**
 * Configuration for a monitored .base file.
 */
interface MonitoredBase {
	path: string;
	name: string;
	/** Timestamp when snooze expires (0 = not snoozed) */
	snoozedUntil: number;
	/** Last known result count */
	lastResultCount: number;
	/** Paths of items in results (for relevance checking) */
	cachedPaths: Set<string>;
	/** When to fire notifications: any match, new items only, or count threshold */
	notifyOn: "any" | "count_threshold" | "new_items";
	/** Threshold count for count_threshold mode */
	notifyThreshold: number;
}

/**
 * Parsed configuration from a .base file.
 */
interface BaseFileConfig {
	name?: string;
	notify?: boolean;
	notifyOn?: "any" | "count_threshold" | "new_items";
	notifyThreshold?: number;
	source?: string;
	filters?: {
		and?: string[];
		or?: string[];
	};
}

/**
 * BasesQueryWatcher - Event-driven background monitoring for Bases queries.
 *
 * Architecture:
 * - On startup, scans vault for .base files with `notify: true`
 * - Listens to EVENT_TASK_UPDATED for task changes
 * - Listens to metadataCache for note changes
 * - When a change affects a monitored query, evaluates and shows notification modal
 *
 * Efficiency:
 * - Uses cached path sets for O(1) relevance checking
 * - Only re-evaluates queries when relevant changes occur
 * - Respects snooze settings to avoid notification spam
 */
export class BasesQueryWatcher {
	private plugin: TaskNotesPlugin;
	private monitoredBases: Map<string, MonitoredBase> = new Map();
	private taskUpdateListener: EventRef | null = null;
	private metadataListener: EventRef | null = null;
	private fileDeleteListener: EventRef | null = null;
	private fileRenameListener: EventRef | null = null;
	private scanTimeout: number | null = null;
	private pendingEvaluations: Set<string> = new Set();
	private evaluationDebounceTimer: number | null = null;
	private initialized = false;

	// Configuration
	private readonly EVALUATION_DEBOUNCE_MS = 1000;
	private readonly STARTUP_SCAN_DELAY_MS = 2000; // Reduced from 5s to minimize race condition window
	private readonly PERIODIC_SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
	private readonly SAFETY_SCAN_DELAY_MS = 10000; // Safety scan if first scan found nothing

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Initialize the watcher. Called from main.ts after plugin loads.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		// Delay initial scan to allow vault to settle
		this.scanTimeout = window.setTimeout(async () => {
			await this.scanForMonitoredBases();
			this.setupEventListeners();
			this.startPeriodicScan();
		}, this.STARTUP_SCAN_DELAY_MS);

		// Safety net scan: if first scan found nothing, try again
		// This catches late-loading views and race conditions
		window.setTimeout(async () => {
			if (this.monitoredBases.size === 0) {
				this.plugin.debugLog.log("BasesQueryWatcher", "Safety scan - no bases found in first scan, rescanning...");
				await this.scanForMonitoredBases();
			}
		}, this.SAFETY_SCAN_DELAY_MS);

		this.plugin.debugLog.log("BasesQueryWatcher", "Initialized - will scan in 2s (safety scan at 10s if needed)");
	}

	/**
	 * Clean up the watcher. Called from main.ts on unload.
	 */
	destroy(): void {
		if (this.scanTimeout) {
			clearTimeout(this.scanTimeout);
			this.scanTimeout = null;
		}

		if (this.evaluationDebounceTimer) {
			clearTimeout(this.evaluationDebounceTimer);
			this.evaluationDebounceTimer = null;
		}

		if (this.taskUpdateListener) {
			this.plugin.emitter.offref(this.taskUpdateListener);
			this.taskUpdateListener = null;
		}

		if (this.metadataListener) {
			this.plugin.app.metadataCache.offref(this.metadataListener);
			this.metadataListener = null;
		}

		if (this.fileDeleteListener) {
			this.plugin.app.vault.offref(this.fileDeleteListener);
			this.fileDeleteListener = null;
		}

		if (this.fileRenameListener) {
			this.plugin.app.vault.offref(this.fileRenameListener);
			this.fileRenameListener = null;
		}

		this.monitoredBases.clear();
		this.pendingEvaluations.clear();
		this.initialized = false;

		this.plugin.debugLog.log("BasesQueryWatcher", "Destroyed");
	}

	/**
	 * Scan vault for .base files with notify: true.
	 */
	private async scanForMonitoredBases(): Promise<void> {
		const files = this.plugin.app.vault.getFiles();
		const baseFiles = files.filter((f) => f.extension === "base");

		this.plugin.debugLog.log("BasesQueryWatcher", `Scanning ${baseFiles.length} .base files`);

		for (const file of baseFiles) {
			await this.checkAndRegisterBase(file);
		}

		this.plugin.debugLog.log("BasesQueryWatcher", `Monitoring ${this.monitoredBases.size} bases`);
	}

	/**
	 * Check if a .base file has notify: true and register it.
	 */
	private async checkAndRegisterBase(file: TFile): Promise<void> {
		try {
			const content = await this.plugin.app.vault.read(file);
			const config = this.parseBaseConfig(content, file.path);

			if (config.notify) {
				// Check if already registered
				const existing = this.monitoredBases.get(file.path);

				this.monitoredBases.set(file.path, {
					path: file.path,
					name: config.name || file.basename,
					snoozedUntil: existing?.snoozedUntil || 0,
					lastResultCount: existing?.lastResultCount || 0,
					cachedPaths: existing?.cachedPaths || new Set(),
					notifyOn: config.notifyOn || "any",
					notifyThreshold: config.notifyThreshold ?? 1,
				});

				// Registered base for monitoring
			} else {
				// Remove if notify was disabled
				this.monitoredBases.delete(file.path);
			}
		} catch (error) {
			this.plugin.debugLog.warn("BasesQueryWatcher", `Failed to parse ${file.path}`, error);
		}
	}

	/**
	 * Parse .base file content to extract configuration.
	 * Checks both top-level and per-view `notify: true` since .base files
	 * store notify as a per-view property inside views[n].
	 */
	private parseBaseConfig(content: string, filePath?: string): BaseFileConfig {
		try {
			// .base files are YAML
			const parsed = parseYaml(content);

			if (!parsed) {
				this.plugin.debugLog.warn("BasesQueryWatcher", `parseYaml returned null/undefined for ${filePath || 'unknown file'}`);
				return { notify: false };
			}

			// Check top-level notify (future-proofing)
			let hasNotify = parsed?.notify === true;

			// Also check per-view notify (current .base format)
			if (!hasNotify && Array.isArray(parsed?.views)) {
				hasNotify = parsed.views.some((v: any) => v?.notify === true);
				if (hasNotify) {
					// Found notify:true in views[]
				}
			}

			// Extract source and filters - check both top-level AND per-view
			// Many .base files put filters inside views[] rather than at top level
			let source = parsed?.source;
			let filters = parsed?.filters;

			// If no top-level source/filters but views exist, use the first notify:true view's config
			if (!source && !filters && Array.isArray(parsed?.views)) {
				for (const view of parsed.views) {
					if (view?.notify === true || (hasNotify && view)) {
						// Found a notify view (or any view when notify is set)
						if (view.source) source = view.source;
						if (view.filters) filters = view.filters;
						if (source || filters) {
							// Extracted filters from views[]
							break;
						}
					}
				}
			}

			// Debug: log what we found
			if (filePath) {
				// Base parsed successfully
			}

			// Extract notifyOn/notifyThreshold — check per-view first, then top-level
			let notifyOn: "any" | "count_threshold" | "new_items" = parsed?.notifyOn || "any";
			let notifyThreshold = parsed?.notifyThreshold ?? 1;

			if (Array.isArray(parsed?.views)) {
				for (const view of parsed.views) {
					if (view?.notify === true) {
						if (view.notifyOn) notifyOn = view.notifyOn;
						if (view.notifyThreshold != null) notifyThreshold = view.notifyThreshold;
						break;
					}
				}
			}

			return {
				name: parsed?.name,
				notify: hasNotify,
				notifyOn,
				notifyThreshold,
				source: source,
				filters: filters,
			};
		} catch (error) {
			this.plugin.debugLog.warn("BasesQueryWatcher", `YAML parse error for ${filePath || 'unknown file'}`, error);
			return { notify: false };
		}
	}

	/**
	 * Setup event listeners for changes.
	 */
	private setupEventListeners(): void {
		// Listen for task updates
		this.taskUpdateListener = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			async (eventData: any) => {
				const path = eventData?.path || eventData?.taskInfo?.path;
				if (path) {
					this.handlePathChange(path);
				}
			}
		);

		// Listen for metadata changes (covers non-task notes)
		this.metadataListener = this.plugin.app.metadataCache.on(
			"changed",
			(file: TFile) => {
				if (file.extension === "base") {
					// .base file itself changed - re-check registration
					this.checkAndRegisterBase(file);
				} else if (file.extension === "md") {
					this.handlePathChange(file.path);
				}
			}
		);

		// Listen for file deletions
		this.fileDeleteListener = this.plugin.app.vault.on("delete", (file) => {
			if (file instanceof TFile) {
				if (file.extension === "base") {
					this.monitoredBases.delete(file.path);
				} else {
					this.handlePathChange(file.path);
				}
			}
		});

		// Listen for file renames
		this.fileRenameListener = this.plugin.app.vault.on(
			"rename",
			(file, oldPath) => {
				if (file instanceof TFile) {
					if (file.extension === "base") {
						// Update monitored base path
						const existing = this.monitoredBases.get(oldPath);
						if (existing) {
							this.monitoredBases.delete(oldPath);
							existing.path = file.path;
							this.monitoredBases.set(file.path, existing);
						}
					} else {
						// Note renamed - might affect queries
						this.handlePathChange(file.path);
						this.handlePathChange(oldPath);
					}
				}
			}
		);

		this.plugin.debugLog.log("BasesQueryWatcher", "Event listeners setup");
	}

	/**
	 * Handle a path change - check if it affects any monitored queries.
	 * Uses NotificationCache's smart invalidation to only re-evaluate affected bases.
	 */
	private handlePathChange(changedPath: string): void {
		// Quick check: does this path appear in any cached result set?
		// (This handles items already in results)
		for (const [basePath, monitored] of this.monitoredBases) {
			if (monitored.cachedPaths.has(changedPath)) {
				this.pendingEvaluations.add(basePath);
			}
		}

		// Smart invalidation: let the cache determine which bases monitor this folder.
		// This replaces the O(n) "evaluate ALL bases" approach with O(1) lookup.
		// The cache uses a folder→bases index built from .base source filters.
		this.plugin.notificationCache.invalidateForPath(changedPath);

		// Only schedule evaluation if we found cached path matches above
		// (The cache invalidation handles the "new items" case via its own mechanism)
		if (this.pendingEvaluations.size > 0) {
			this.scheduleEvaluation();
		}
	}

	/**
	 * Schedule debounced evaluation of pending bases.
	 */
	private scheduleEvaluation(): void {
		if (this.evaluationDebounceTimer) {
			clearTimeout(this.evaluationDebounceTimer);
		}

		this.evaluationDebounceTimer = window.setTimeout(async () => {
			this.evaluationDebounceTimer = null;
			await this.evaluatePendingBases();
		}, this.EVALUATION_DEBOUNCE_MS);
	}

	/**
	 * Evaluate all pending bases and show notifications.
	 */
	private async evaluatePendingBases(): Promise<void> {
		if (this.pendingEvaluations.size === 0) return;

		const toEvaluate = Array.from(this.pendingEvaluations);
		this.pendingEvaluations.clear();

		for (const basePath of toEvaluate) {
			const monitored = this.monitoredBases.get(basePath);
			if (!monitored) continue;

			// Check snooze
			if (monitored.snoozedUntil > Date.now()) {
				this.plugin.debugLog.log("BasesQueryWatcher", `${basePath} is snoozed`);
				continue;
			}

			try {
				const results = await this.evaluateBaseQuery(basePath);
				if (!results || results.length === 0) {
					monitored.cachedPaths.clear();
					monitored.lastResultCount = 0;
					continue;
				}

				// Apply notifyOn filtering
				const currentPaths = new Set(results.map((r) => r.path));
				let shouldNotify = false;

				switch (monitored.notifyOn) {
					case "any":
						shouldNotify = true;
						break;
					case "new_items": {
						// Only notify if paths exist that weren't in previous evaluation
						for (const path of currentPaths) {
							if (!monitored.cachedPaths.has(path)) {
								shouldNotify = true;
								break;
							}
						}
						break;
					}
					case "count_threshold":
						shouldNotify = results.length > monitored.notifyThreshold;
						break;
				}

				monitored.cachedPaths = currentPaths;
				monitored.lastResultCount = results.length;

				if (shouldNotify) {
					this.showNotification(monitored, results);
				}
			} catch (error) {
				this.plugin.debugLog.error("BasesQueryWatcher", `Error evaluating ${basePath}`, error);
			}
		}
	}

	/**
	 * Evaluate a .base query and return results.
	 * Uses Obsidian's Bases API to run the query.
	 */
	private async evaluateBaseQuery(basePath: string): Promise<NotificationItem[] | null> {
		// Strategy: Find an open Bases view for this file, or open one temporarily
		const file = this.plugin.app.vault.getAbstractFileByPath(basePath);
		if (!(file instanceof TFile)) return null;

		// Try to find an existing open view
		let basesLeaf: WorkspaceLeaf | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			const viewType = leaf.view?.getViewType?.();
			if (viewType === "bases" || viewType === "obsidian-bases" || viewType === "base") {
				const view = leaf.view as any;
				if (view.file?.path === basePath) {
					basesLeaf = leaf;
				}
			}
		});

		if (basesLeaf) {
			// Extract results from existing view
			return this.extractResultsFromView(basesLeaf);
		}

		// No open view - we need to open one temporarily
		// This is expensive, so we only do it when we know changes occurred
		return await this.evaluateWithTemporaryView(file);
	}

	/**
	 * Extract notification items from an open Bases view.
	 */
	private extractResultsFromView(leaf: WorkspaceLeaf): NotificationItem[] {
		const view = leaf.view as any;
		const items: NotificationItem[] = [];

		try {
			// Access Bases data through the view
			const basesContainer = view.basesContainer || view.container;
			if (!basesContainer?.controller?.results) {
				return items;
			}

			const results = basesContainer.controller.results;
			for (const [key, entry] of results) {
				const file = (entry as any).file;
				if (!file?.path) continue;

				const frontmatter =
					(entry as any).frontmatter ||
					this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

				const isTask = this.plugin.cacheManager.isTaskFile(frontmatter);
				const title =
					frontmatter?.title ||
					frontmatter?.[this.plugin.fieldMapper.toUserField("title")] ||
					file.basename;

				items.push({
					path: file.path,
					title,
					isTask,
					status: isTask ? frontmatter?.status : undefined,
				});
			}
		} catch (error) {
			this.plugin.debugLog.error("BasesQueryWatcher", "Error extracting results", error);
		}

		return items;
	}

	/**
	 * Evaluate a .base query by temporarily opening the file.
	 * This is more expensive but necessary when no view is open.
	 */
	private async evaluateWithTemporaryView(file: TFile): Promise<NotificationItem[] | null> {
		// For now, we use a simpler approach:
		// Parse the .base file and evaluate the source filter manually
		// This avoids opening UI but requires us to implement filter evaluation

		try {
			const content = await this.plugin.app.vault.read(file);
			const config = this.parseBaseConfig(content, file.path);

			// Handle either source (string expression) or filters (structured object)
			if (!config.source && !config.filters) {
				this.plugin.debugLog.log("BasesQueryWatcher", `No source or filters found for ${file.path}`);
				return null;
			}

			// Simple evaluation: check if source/filters mentions "inFolder"
			// and scan that folder for matching notes
			return await this.evaluateSourceFilter(config);
		} catch (error) {
			this.plugin.debugLog.error("BasesQueryWatcher", `Error evaluating ${file.path}`, error);
			return null;
		}
	}

	/**
	 * Simple evaluation of Bases source filter.
	 * This is a basic implementation that handles common patterns.
	 * Supports both `source:` (string expression) and `filters:` (structured object).
	 *
	 * Supported patterns:
	 * - file.inFolder("path") - files in a specific folder
	 * - file.name == "value" - exact file name match (without extension)
	 * - type == "value" - files with specific type property
	 * - file.path.contains("value") - files with path containing substring
	 */
	private async evaluateSourceFilter(config: BaseFileConfig): Promise<NotificationItem[]> {
		const items: NotificationItem[] = [];

		// Evaluate source filter silently - only log results

		// Try to extract filter criteria from source string and filters structure
		let folder: string | null = null;
		let typeFilter: string | null = null;
		let exactFileName: string | null = null;
		let pathContains: string | null = null;

		// Helper to parse filter patterns from a string
		const parseFilterString = (filterStr: string) => {
			// Check for file.inFolder("path") pattern
			const folderMatch = filterStr.match(/file\.inFolder\s*\(\s*["']([^"']+)["']\s*\)/);
			if (folderMatch) {
				folder = folderMatch[1];
				// Folder extracted from filter
			}

			// Check for file.name == "value" pattern
			const nameMatch = filterStr.match(/file\.name\s*==\s*["']([^"']+)["']/);
			if (nameMatch) {
				exactFileName = nameMatch[1];
				// exactFileName extracted
			}

			// Check for type == "value" pattern
			const typeMatch = filterStr.match(/type\s*==\s*["']([^"']+)["']/);
			if (typeMatch) {
				typeFilter = typeMatch[1];
				// typeFilter extracted
			}

			// Check for file.path.contains("value") pattern
			const pathMatch = filterStr.match(/file\.path\.contains\s*\(\s*["']([^"']+)["']\s*\)/);
			if (pathMatch) {
				pathContains = pathMatch[1];
				// pathContains extracted
			}
		};

		// Parse source string if present
		if (config.source) {
			parseFilterString(config.source);
		}

		// Also check filters structure (used by many .base files)
		if (config.filters) {
			const filterArray = config.filters.and || config.filters.or || [];
			// Processing filter array
			for (const filter of filterArray) {
				if (typeof filter === 'string') {
					parseFilterString(filter);
				}
			}
		}

		// Check if we have any valid filter criteria
		const hasValidFilter = folder || exactFileName || pathContains;
		if (!hasValidFilter) {
			this.plugin.debugLog.log("BasesQueryWatcher", "No valid filter criteria found - returning empty");
			return items;
		}

		const files = this.plugin.app.vault.getMarkdownFiles();

		let matchedCriteria = 0;
		let matchedType = 0;

		for (const file of files) {
			// Check if file matches any of our filter criteria
			let matches = false;

			// Check folder filter
			if (folder) {
				const inFolder = file.path.startsWith(folder + "/") || file.parent?.path === folder;
				if (inFolder) matches = true;
			}

			// Check exact file name filter (basename without extension)
			if (exactFileName) {
				// Match against basename (without .md extension)
				if (file.basename === exactFileName) {
					matches = true;
				}
			}

			// Check path contains filter
			if (pathContains) {
				if (file.path.includes(pathContains)) {
					matches = true;
				}
			}

			if (!matches) continue;
			matchedCriteria++;

			const frontmatter =
				this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

			// Apply type filter if present
			if (typeFilter && frontmatter?.type !== typeFilter) {
				continue;
			}
			matchedType++;

			const isTask = this.plugin.cacheManager.isTaskFile(frontmatter);
			const title =
				frontmatter?.title ||
				frontmatter?.[this.plugin.fieldMapper.toUserField("title")] ||
				file.basename;

			items.push({
				path: file.path,
				title,
				isTask,
				status: isTask ? frontmatter?.status : undefined,
			});
		}

		this.plugin.debugLog.log("BasesQueryWatcher", `Criteria match: ${matchedCriteria}, Type match: ${matchedType}, Final items: ${items.length}`);
		return items;
	}

	/**
	 * Show the notification modal for a monitored base.
	 *
	 * DISABLED: Old BasesNotificationModal auto-trigger
	 * Replaced by new Upcoming View + Toast system (see ADR-009)
	 * The watcher still tracks monitored bases and provides data via getQueryResults(),
	 * but the modal trigger is disabled until the new system is complete.
	 */
	private showNotification(monitored: MonitoredBase, items: NotificationItem[]): void {
		// DISABLED: See ADR-009 - Upcoming View replaces modal-based notifications
		this.plugin.debugLog.log("BasesQueryWatcher", `[DISABLED] Would show notification for ${monitored.name}: ${items.length} items (old modal disabled)`);

		// Old modal code - kept for reference:
		// const modal = new BasesNotificationModal(this.plugin.app, this.plugin, {
		// 	baseFilePath: monitored.path,
		// 	baseName: monitored.name,
		// 	items,
		// 	maxDisplayItems: 5,
		// 	onSnooze: (duration) => {
		// 		this.snoozeBase(monitored.path, duration);
		// 	},
		// });
		// modal.open();
	}

	/**
	 * Snooze notifications for a base.
	 */
	snoozeBase(basePath: string, durationMinutes: number): void {
		const monitored = this.monitoredBases.get(basePath);
		if (monitored) {
			monitored.snoozedUntil = Date.now() + durationMinutes * 60 * 1000;
			this.plugin.debugLog.log("BasesQueryWatcher", `Snoozed ${basePath} for ${durationMinutes} minutes`);
		}
	}

	/**
	 * Snooze all monitored bases at once.
	 * Used by the toast notification's snooze-all action.
	 */
	snoozeAllBases(durationMinutes: number): void {
		for (const [, monitored] of this.monitoredBases) {
			monitored.snoozedUntil = Date.now() + durationMinutes * 60 * 1000;
		}
		this.plugin.debugLog.log("BasesQueryWatcher", `Snoozed all bases for ${durationMinutes} minutes`);
	}

	/**
	 * Start periodic scan for changes that might have been missed.
	 */
	private startPeriodicScan(): void {
		setInterval(async () => {
			// Re-scan for new/changed .base files
			await this.scanForMonitoredBases();

			// Trigger evaluation for all non-snoozed bases
			const now = Date.now();
			for (const [basePath, monitored] of this.monitoredBases) {
				if (monitored.snoozedUntil <= now) {
					this.pendingEvaluations.add(basePath);
				}
			}

			if (this.pendingEvaluations.size > 0) {
				await this.evaluatePendingBases();
			}
		}, this.PERIODIC_SCAN_INTERVAL_MS);
	}

	/**
	 * Get list of currently monitored bases (for settings UI).
	 */
	getMonitoredBases(): Array<{ path: string; name: string; snoozed: boolean }> {
		const now = Date.now();
		return Array.from(this.monitoredBases.values()).map((m) => ({
			path: m.path,
			name: m.name,
			snoozed: m.snoozedUntil > now,
		}));
	}

	/**
	 * Manually trigger evaluation for a specific base.
	 */
	async triggerEvaluation(basePath: string): Promise<void> {
		this.pendingEvaluations.add(basePath);
		await this.evaluatePendingBases();
	}

	/**
	 * Public method to evaluate a base query and return results.
	 * Used by VaultWideNotificationService for aggregation.
	 */
	async getQueryResults(basePath: string): Promise<NotificationItem[]> {
		const results = await this.evaluateBaseQuery(basePath);
		return results || [];
	}

	/**
	 * Check whether a base should fire notifications given a result count.
	 * Used by VaultWideNotificationService for aggregation filtering.
	 */
	shouldNotifyForBase(basePath: string, resultCount: number): boolean {
		const monitored = this.monitoredBases.get(basePath);
		if (!monitored) return resultCount > 0;

		switch (monitored.notifyOn) {
			case "any":
				return resultCount > 0;
			case "count_threshold":
				return resultCount > monitored.notifyThreshold;
			case "new_items":
				// New-item detection happens in evaluatePendingBases.
				// For aggregation, return true if there are results.
				return resultCount > 0;
			default:
				return resultCount > 0;
		}
	}

	/**
	 * Called by BasesViewBase when a view with `notify: true` has data.
	 * This is the primary notification path - uses Bases' own query evaluation.
	 */
	showNotificationFromView(
		basePath: string,
		baseName: string,
		items: NotificationItem[]
	): void {
		if (items.length === 0) return;

		// Ensure this base is tracked
		let monitored = this.monitoredBases.get(basePath);
		if (!monitored) {
			monitored = {
				path: basePath,
				name: baseName,
				snoozedUntil: 0,
				lastResultCount: 0,
				cachedPaths: new Set(),
				notifyOn: "any",
				notifyThreshold: 1,
			};
			this.monitoredBases.set(basePath, monitored);
		}

		// Check snooze
		if (monitored.snoozedUntil > Date.now()) {
			this.plugin.debugLog.log("BasesQueryWatcher", `${basePath} is snoozed, skipping notification`);
			return;
		}

		// Update cached paths
		monitored.cachedPaths = new Set(items.map((i) => i.path));
		monitored.lastResultCount = items.length;

		// Show the notification
		this.showNotification(monitored, items);
	}

	/**
	 * Register a view for notifications. Called by BasesViewBase when it loads
	 * and detects `notify: true` in its .base file.
	 *
	 * This bypasses the race condition where the watcher's scan runs before
	 * views have loaded. Views self-register when they have data.
	 */
	registerViewForNotifications(
		filePath: string,
		baseName: string,
		items: NotificationItem[]
	): void {
		if (!filePath) {
			this.plugin.debugLog.warn("BasesQueryWatcher", "registerViewForNotifications called with no filePath");
			return;
		}

		// Add to monitored bases if not already there
		if (!this.monitoredBases.has(filePath)) {
			this.monitoredBases.set(filePath, {
				path: filePath,
				name: baseName,
				snoozedUntil: 0,
				lastResultCount: 0,
				cachedPaths: new Set(),
				notifyOn: "any",
				notifyThreshold: 1,
			});
			this.plugin.debugLog.log("BasesQueryWatcher", `View self-registered: ${filePath} (total monitored: ${this.monitoredBases.size})`);
		}

		// If items are provided, trigger notification check
		if (items && items.length > 0) {
			this.showNotificationFromView(filePath, baseName, items);
		}
	}
}
