import { TFile, TFolder, parseYaml, stringifyYaml, normalizePath } from "obsidian";
import TaskNotesPlugin from "../main";
import {
	BaseNotificationSyncSettings,
	BaseNotificationTaskFrontmatter,
	SyncedBaseInfo,
	SyncResult,
	DEFAULT_BASE_NOTIFICATION_SYNC_SETTINGS,
	createWikilink,
	generateNotificationTaskPath,
	sanitizeForFilename,
} from "../types/base-notification";

/**
 * BaseNotificationSyncService - Syncs notification-enabled bases to TaskNote files.
 *
 * This is the DEFAULT mode for base notifications. It creates real markdown files
 * that represent notification-enabled bases, making them fully compatible with
 * Bases filtering (since they're actual files the filter system can match).
 *
 * Architecture:
 * - On plugin load: Performs initial sync of all notification-enabled bases
 * - After base evaluation: Updates notification tasks when counts change
 * - Periodically: Re-syncs to catch any missed changes
 * - On command: Manual sync trigger available
 *
 * The notification tasks have:
 * - isTask: true (so TaskNotes recognizes them)
 * - type: "base-notification" (so we can distinguish them)
 * - sourceBase: wikilink to the .base file
 * - matchCount: current number of matching items
 * - due: calculated from base's notify configuration
 */
export class BaseNotificationSyncService {
	private plugin: TaskNotesPlugin;
	private syncInterval: number | null = null;
	private initialized = false;
	private syncInProgress = false;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get current sync settings, falling back to defaults.
	 */
	private get settings(): BaseNotificationSyncSettings {
		// For now, use defaults. Settings UI will be added later.
		return DEFAULT_BASE_NOTIFICATION_SYNC_SETTINGS;
	}

	/**
	 * Initialize the sync service. Called from main.ts after plugin loads.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		// Only initialize if sync-to-files mode is enabled
		if (this.settings.mode !== 'sync-to-files' || !this.settings.enabled) {
			this.plugin.debugLog.log("BaseNotificationSyncService", "Service disabled or not in sync-to-files mode");
			return;
		}

		// Delay initial sync to allow vault to settle
		window.setTimeout(async () => {
			this.plugin.debugLog.log("BaseNotificationSyncService", "Performing initial sync...");
			await this.syncNotificationTasks();
			this.startPeriodicSync();
		}, 3000);

		this.plugin.debugLog.log("BaseNotificationSyncService", "Initialized");
	}

	/**
	 * Clean up the sync service. Called from main.ts on unload.
	 */
	destroy(): void {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
		}
		this.initialized = false;
		this.plugin.debugLog.log("BaseNotificationSyncService", "Destroyed");
	}

	/**
	 * Start periodic sync based on settings.
	 */
	private startPeriodicSync(): void {
		if (this.settings.syncIntervalMinutes <= 0) return;

		const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000;
		this.syncInterval = window.setInterval(async () => {
			await this.syncNotificationTasks();
		}, intervalMs);

		this.plugin.debugLog.log("BaseNotificationSyncService", `Periodic sync started (every ${this.settings.syncIntervalMinutes} minutes)`);
	}

	/**
	 * Main sync method. Scans all notification-enabled bases and creates/updates/completes
	 * corresponding notification TaskNote files.
	 */
	async syncNotificationTasks(): Promise<SyncResult> {
		if (this.syncInProgress) {
			this.plugin.debugLog.log("BaseNotificationSyncService", "Sync already in progress, skipping");
			return { created: 0, updated: 0, completed: 0, deleted: 0, errors: [] };
		}

		this.syncInProgress = true;
		const result: SyncResult = { created: 0, updated: 0, completed: 0, deleted: 0, errors: [] };

		try {
			this.plugin.debugLog.log("BaseNotificationSyncService", "Starting sync...");

			// Ensure notification folder exists
			await this.ensureFolderExists(this.settings.notificationTaskFolder);

			// Get all notification-enabled bases
			const notifyBases = await this.getNotificationEnabledBases();
			this.plugin.debugLog.log("BaseNotificationSyncService", `Found ${notifyBases.length} notification-enabled bases`);

			// Process each base
			for (const baseInfo of notifyBases) {
				try {
					await this.syncSingleBase(baseInfo, result);
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					result.errors.push({ basePath: baseInfo.basePath, error: errorMsg });
					this.plugin.debugLog.error("BaseNotificationSyncService", `Error syncing ${baseInfo.basePath}:`, error);
				}
			}

			// Clean up orphaned notification tasks (bases that no longer have notify: true)
			await this.cleanupOrphanedTasks(notifyBases, result);

			this.plugin.debugLog.log("BaseNotificationSyncService", `Sync complete: ${result.created} created, ${result.updated} updated, ${result.completed} completed, ${result.deleted} deleted`);

		} finally {
			this.syncInProgress = false;
		}

		return result;
	}

	/**
	 * Sync a single notification-enabled base.
	 */
	private async syncSingleBase(baseInfo: SyncedBaseInfo, result: SyncResult): Promise<void> {
		// Evaluate the base to get current match count
		const matchCount = await this.evaluateBaseCount(baseInfo.basePath);
		baseInfo.matchCount = matchCount;

		this.plugin.debugLog.log("BaseNotificationSyncService", `Base ${baseInfo.baseName}: ${matchCount} items`);

		// Find existing notification task
		const existingTask = await this.findNotificationTask(baseInfo.basePath);

		if (matchCount > 0 && !existingTask) {
			// Create new notification task
			await this.createNotificationTask(baseInfo);
			result.created++;
		} else if (matchCount > 0 && existingTask) {
			// Update existing notification task
			await this.updateNotificationTask(existingTask, baseInfo);
			result.updated++;
		} else if (matchCount === 0 && existingTask) {
			// Handle empty base
			await this.handleEmptyBase(existingTask, result);
		}
		// If matchCount === 0 && !existingTask, nothing to do
	}

	/**
	 * Get all .base files with notify: true.
	 */
	private async getNotificationEnabledBases(): Promise<SyncedBaseInfo[]> {
		const bases: SyncedBaseInfo[] = [];
		const files = this.plugin.app.vault.getFiles().filter(f => f.extension === "base");

		for (const file of files) {
			try {
				const content = await this.plugin.app.vault.read(file);
				const parsed = parseYaml(content);

				if (!parsed) continue;

				// Check for notify: true at top level or in views[]
				let hasNotify = parsed?.notify === true;
				if (!hasNotify && Array.isArray(parsed?.views)) {
					hasNotify = parsed.views.some((v: any) => v?.notify === true);
				}

				if (hasNotify) {
					bases.push({
						basePath: file.path,
						baseName: parsed?.name || file.basename,
						matchCount: 0,
					});
				}
			} catch (error) {
				this.plugin.debugLog.warn("BaseNotificationSyncService", `Failed to parse ${file.path}:`, error);
			}
		}

		return bases;
	}

	/**
	 * Evaluate a base's query and return the match count.
	 */
	private async evaluateBaseCount(basePath: string): Promise<number> {
		try {
			const results = await this.plugin.basesQueryWatcher.getQueryResults(basePath);
			return results?.length ?? 0;
		} catch (error) {
			this.plugin.debugLog.error("BaseNotificationSyncService", `Error evaluating ${basePath}:`, error);
			return 0;
		}
	}

	/**
	 * Find the notification task file for a given base.
	 */
	private async findNotificationTask(basePath: string): Promise<TFile | null> {
		const folder = this.settings.notificationTaskFolder;
		const files = this.plugin.app.vault.getFiles().filter(f =>
			f.path.startsWith(folder + "/") && f.extension === "md"
		);

		for (const file of files) {
			try {
				const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
				if (!frontmatter) continue;

				// Check if this notification task is for our base
				if (frontmatter.type === this.settings.notificationTaskType) {
					const sourceBase = frontmatter.sourceBase;
					// sourceBase is a wikilink like [[path/to/file.base]]
					// Extract path and compare
					const match = sourceBase?.match(/\[\[([^\]]+)\]\]/);
					if (match) {
						const linkedPath = match[1];
						// Handle both with and without .base extension
						if (linkedPath === basePath ||
							linkedPath + '.base' === basePath ||
							linkedPath === basePath.replace(/\.base$/, '')) {
							return file;
						}
					}
				}
			} catch (error) {
				// Continue checking other files
			}
		}

		return null;
	}

	/**
	 * Create a new notification task file for a base.
	 */
	private async createNotificationTask(baseInfo: SyncedBaseInfo): Promise<TFile> {
		const now = new Date();
		const nowISO = now.toISOString();
		const todayDate = now.toISOString().split('T')[0];

		// Calculate due date (default: 7 days after first appearance)
		// TODO: Make this configurable per-base
		const dueDate = new Date(now);
		dueDate.setDate(dueDate.getDate() + 7);
		const dueDateStr = dueDate.toISOString().split('T')[0];

		const frontmatter: BaseNotificationTaskFrontmatter = {
			isTask: true,
			type: 'base-notification',
			title: baseInfo.baseName,
			sourceBase: createWikilink(baseInfo.basePath),
			matchCount: baseInfo.matchCount,
			firstItemAppearedAt: todayDate,
			due: dueDateStr,
			scheduled: todayDate,
			status: 'pending',
			lastSyncedAt: nowISO,
		};

		// Generate file content
		const content = this.generateNotificationTaskContent(frontmatter, baseInfo);

		// Generate file path
		const filePath = generateNotificationTaskPath(
			this.settings.notificationTaskFolder,
			baseInfo.baseName
		);
		const normalizedPath = normalizePath(filePath);

		// Check if file already exists (edge case)
		const existing = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
		if (existing instanceof TFile) {
			this.plugin.debugLog.warn("BaseNotificationSyncService", `File already exists: ${normalizedPath}`);
			return existing;
		}

		// Create the file
		const file = await this.plugin.app.vault.create(normalizedPath, content);
		this.plugin.debugLog.log("BaseNotificationSyncService", `Created notification task: ${normalizedPath}`);

		return file;
	}

	/**
	 * Update an existing notification task file.
	 */
	private async updateNotificationTask(file: TFile, baseInfo: SyncedBaseInfo): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

		if (!frontmatter) {
			this.plugin.debugLog.warn("BaseNotificationSyncService", `No frontmatter in ${file.path}`);
			return;
		}

		// Check if anything changed
		if (frontmatter.matchCount === baseInfo.matchCount) {
			// Only update lastSyncedAt
			const newContent = this.updateFrontmatterField(content, 'lastSyncedAt', new Date().toISOString());
			await this.plugin.app.vault.modify(file, newContent);
			return;
		}

		// Update matchCount and lastSyncedAt
		let newContent = this.updateFrontmatterField(content, 'matchCount', baseInfo.matchCount);
		newContent = this.updateFrontmatterField(newContent, 'lastSyncedAt', new Date().toISOString());

		await this.plugin.app.vault.modify(file, newContent);
		this.plugin.debugLog.log("BaseNotificationSyncService", `Updated notification task: ${file.path} (count: ${baseInfo.matchCount})`);
	}

	/**
	 * Handle a notification task when its base has no matching items.
	 */
	private async handleEmptyBase(file: TFile, result: SyncResult): Promise<void> {
		switch (this.settings.onEmptyBase) {
			case 'complete':
				await this.completeNotificationTask(file);
				result.completed++;
				break;
			case 'delete':
				await this.plugin.app.vault.delete(file);
				result.deleted++;
				this.plugin.debugLog.log("BaseNotificationSyncService", `Deleted notification task: ${file.path}`);
				break;
			case 'keep':
				// Update matchCount to 0 but keep the file
				const content = await this.plugin.app.vault.read(file);
				let newContent = this.updateFrontmatterField(content, 'matchCount', 0);
				newContent = this.updateFrontmatterField(newContent, 'lastSyncedAt', new Date().toISOString());
				await this.plugin.app.vault.modify(file, newContent);
				break;
		}
	}

	/**
	 * Mark a notification task as complete.
	 */
	private async completeNotificationTask(file: TFile): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		let newContent = this.updateFrontmatterField(content, 'status', 'complete');
		newContent = this.updateFrontmatterField(newContent, 'matchCount', 0);
		newContent = this.updateFrontmatterField(newContent, 'lastSyncedAt', new Date().toISOString());

		await this.plugin.app.vault.modify(file, newContent);
		this.plugin.debugLog.log("BaseNotificationSyncService", `Completed notification task: ${file.path}`);
	}

	/**
	 * Clean up notification tasks whose bases no longer have notify: true.
	 */
	private async cleanupOrphanedTasks(activeBases: SyncedBaseInfo[], result: SyncResult): Promise<void> {
		const folder = this.settings.notificationTaskFolder;
		const folderObj = this.plugin.app.vault.getAbstractFileByPath(folder);
		if (!(folderObj instanceof TFolder)) return;

		const activeBasePaths = new Set(activeBases.map(b => b.basePath));

		for (const file of this.plugin.app.vault.getFiles()) {
			if (!file.path.startsWith(folder + "/") || file.extension !== "md") continue;

			const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter || frontmatter.type !== this.settings.notificationTaskType) continue;

			// Extract source base path from wikilink
			const sourceBase = frontmatter.sourceBase;
			const match = sourceBase?.match(/\[\[([^\]]+)\]\]/);
			if (!match) continue;

			let linkedPath = match[1];
			// Normalize path (add .base if missing)
			if (!linkedPath.endsWith('.base')) {
				linkedPath = linkedPath + '.base';
			}

			// Check if this base still has notify: true
			if (!activeBasePaths.has(linkedPath)) {
				// Base no longer has notify: true - handle based on settings
				await this.handleEmptyBase(file, result);
				this.plugin.debugLog.log("BaseNotificationSyncService", `Cleaned up orphaned task: ${file.path}`);
			}
		}
	}

	/**
	 * Generate the full content for a notification task file.
	 */
	private generateNotificationTaskContent(frontmatter: BaseNotificationTaskFrontmatter, baseInfo: SyncedBaseInfo): string {
		const yamlContent = stringifyYaml(frontmatter);

		const body = `# ${baseInfo.baseName}

This base notification tracks items matching the ${frontmatter.sourceBase} query.

**Current items:** ${frontmatter.matchCount}
**First appeared:** ${frontmatter.firstItemAppearedAt}
`;

		return `---\n${yamlContent}---\n\n${body}`;
	}

	/**
	 * Update a single frontmatter field in file content.
	 * Uses simple string replacement to preserve formatting.
	 */
	private updateFrontmatterField(content: string, field: string, value: any): string {
		// Find frontmatter boundaries
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			this.plugin.debugLog.warn("BaseNotificationSyncService", "No frontmatter found in content");
			return content;
		}

		const frontmatterContent = frontmatterMatch[1];
		const restOfContent = content.slice(frontmatterMatch[0].length);

		// Parse, update, and re-stringify
		try {
			const parsed = parseYaml(frontmatterContent);
			if (parsed) {
				parsed[field] = value;
				const newYaml = stringifyYaml(parsed);
				return `---\n${newYaml}---${restOfContent}`;
			}
		} catch (error) {
			this.plugin.debugLog.error("BaseNotificationSyncService", "Error updating frontmatter:", error);
		}

		return content;
	}

	/**
	 * Ensure a folder exists, creating it if necessary.
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);
		const existing = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);

		if (existing instanceof TFolder) {
			return; // Folder exists
		}

		if (existing instanceof TFile) {
			this.plugin.debugLog.error("BaseNotificationSyncService", `Path exists but is a file: ${normalizedPath}`);
			return;
		}

		// Create folder (including parent folders)
		await this.plugin.app.vault.createFolder(normalizedPath);
		this.plugin.debugLog.log("BaseNotificationSyncService", `Created folder: ${normalizedPath}`);
	}

	/**
	 * Manually trigger a sync. Can be called from a command.
	 */
	async manualSync(): Promise<SyncResult> {
		this.plugin.debugLog.log("BaseNotificationSyncService", "Manual sync triggered");
		return await this.syncNotificationTasks();
	}

	/**
	 * Called after BasesQueryWatcher evaluates a base.
	 * Triggers an incremental sync for that specific base.
	 */
	async onBaseEvaluated(basePath: string): Promise<void> {
		if (!this.initialized || this.settings.mode !== 'sync-to-files') return;

		try {
			// Get current info about the base
			const file = this.plugin.app.vault.getAbstractFileByPath(basePath);
			if (!(file instanceof TFile)) return;

			const content = await this.plugin.app.vault.read(file);
			const parsed = parseYaml(content);

			// Check if this base has notify: true
			let hasNotify = parsed?.notify === true;
			if (!hasNotify && Array.isArray(parsed?.views)) {
				hasNotify = parsed.views.some((v: any) => v?.notify === true);
			}

			if (!hasNotify) {
				// Base no longer has notify - check if we have a task to clean up
				const existingTask = await this.findNotificationTask(basePath);
				if (existingTask) {
					const result: SyncResult = { created: 0, updated: 0, completed: 0, deleted: 0, errors: [] };
					await this.handleEmptyBase(existingTask, result);
				}
				return;
			}

			// Sync this specific base
			const baseInfo: SyncedBaseInfo = {
				basePath,
				baseName: parsed?.name || (file as TFile).basename,
				matchCount: 0,
			};

			const result: SyncResult = { created: 0, updated: 0, completed: 0, deleted: 0, errors: [] };
			await this.syncSingleBase(baseInfo, result);

			this.plugin.debugLog.log("BaseNotificationSyncService", `Incremental sync for ${basePath}: created=${result.created}, updated=${result.updated}`);
		} catch (error) {
			this.plugin.debugLog.error("BaseNotificationSyncService", `Error in onBaseEvaluated for ${basePath}:`, error);
		}
	}
}
