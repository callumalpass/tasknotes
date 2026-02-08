/* eslint-disable no-console */
import { TFile, App, Events, EventRef } from "obsidian";
import { TaskInfo, NoteInfo } from "../types";
import { FieldMapper } from "../services/FieldMapper";
import { FilterUtils } from "./FilterUtils";
import {
	getTodayString,
	formatDateForStorage,
	isBeforeDateSafe,
} from "./dateUtils";
import { calculateTotalTimeSpent } from "./helpers";
import { TaskNotesSettings } from "../types/settings";

/**
 * Just-in-time task manager that reads task information on-demand from Obsidian's
 * native metadata cache. No internal indexes or caching - always fresh data.
 *
 * Design Philosophy:
 * - Read on-demand: No caching, always query metadataCache directly
 * - Event-driven: Listen to Obsidian events and emit change notifications
 * - Simple: No complex indexes, just iterate when needed
 * - Fast enough: MetadataCache is already optimized, we don't need our own cache
 */
export class TaskManager extends Events {
	private app: App;
	private settings: TaskNotesSettings;
	private taskTag: string;
	private excludedFolders: string[];
	private fieldMapper?: FieldMapper;
	private disableNoteIndexing: boolean;
	private storeTitleInFilename: boolean;

	// Initialization state
	private initialized = false;

	// Event listeners for cleanup
	private eventListeners: EventRef[] = [];

	// Debouncing for file changes to prevent excessive updates during typing
	private debouncedHandlers: Map<string, number> = new Map();
	private readonly DEBOUNCE_DELAY = 300; // 300ms delay after user stops typing

	constructor(app: App, settings: TaskNotesSettings, fieldMapper?: FieldMapper) {
		super();
		this.app = app;
		this.settings = settings;
		this.taskTag = settings.taskTag;
		this.excludedFolders = settings.excludedFolders
			? settings.excludedFolders
					.split(",")
					.map((folder) => folder.trim())
					.filter((folder) => folder.length > 0)
			: [];
		this.fieldMapper = fieldMapper;
		this.disableNoteIndexing = settings.disableNoteIndexing;
		this.storeTitleInFilename = settings.storeTitleInFilename;
	}

	/**
	 * Initialize by setting up native event listeners
	 */
	initialize(): void {
		if (this.initialized) {
			return;
		}

		this.setupNativeEventListeners();
		this.initialized = true;
		this.trigger("cache-initialized", { message: "Task manager ready" });
	}

	/**
	 * Get the Obsidian app instance
	 */
	getApp(): App {
		return this.app;
	}

	/**
	 * Check if a file is a task based on current settings
	 */
	isTaskFile(frontmatter: any): boolean {
		if (!frontmatter) return false;

		if (this.settings.taskIdentificationMethod === "property") {
			const propName = this.settings.taskPropertyName;
			const propValue = this.settings.taskPropertyValue;
			if (!propName || !propValue) return false; // Not configured

			const frontmatterValue = frontmatter[propName];
			if (frontmatterValue === undefined) return false;

			// Handle both single and multi-value properties
			if (Array.isArray(frontmatterValue)) {
				return frontmatterValue.some((val: any) =>
					this.comparePropertyValues(val, propValue)
				);
			}
			return this.comparePropertyValues(frontmatterValue, propValue);
		} else {
			// Fallback to legacy tag-based method with hierarchical support
			if (!Array.isArray(frontmatter.tags)) return false;
			return frontmatter.tags.some((tag: string) =>
				typeof tag === 'string' && FilterUtils.matchesHierarchicalTagExact(tag, this.taskTag)
			);
		}
	}

	/**
	 * Compare frontmatter property values with settings value, with boolean coercion support.
	 */
	private comparePropertyValues(frontmatterValue: any, settingValue: string): boolean {
		// Handle boolean frontmatter values compared to string settings (e.g., true vs "true")
		if (typeof frontmatterValue === "boolean" && typeof settingValue === "string") {
			const lower = settingValue.toLowerCase();
			if (lower === "true" || lower === "false") {
				return frontmatterValue === (lower === "true");
			}
		}

		// Fallback to strict equality for other types (strings, numbers, etc.)
		return frontmatterValue === settingValue;
	}

	/**
	 * Setup listeners for Obsidian's native metadata cache events
	 */
	private setupNativeEventListeners(): void {
		// Listen for metadata changes (frontmatter updates)
		const changedRef = this.app.metadataCache.on("changed", (file, data, cache) => {
			if (file instanceof TFile && file.extension === "md" && this.isValidFile(file.path)) {
				this.handleFileChangedDebounced(file, cache);
			}
		});
		this.eventListeners.push(changedRef);

		// Listen for file deletion
		const deletedRef = this.app.metadataCache.on("deleted", (file, prevCache) => {
			if (file instanceof TFile && file.extension === "md") {
				this.handleFileDeleted(file.path, prevCache);
			}
		});
		this.eventListeners.push(deletedRef);

		// Listen for file rename
		const renameRef = this.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && file.extension === "md") {
				this.handleFileRenamed(file, oldPath);
			}
		});
		this.eventListeners.push(renameRef);
	}

	/**
	 * Handle file changes with debouncing to prevent excessive updates
	 */
	private handleFileChangedDebounced(file: TFile, cache: any): void {
		const path = file.path;

		// Cancel existing debounced handler for this file
		const existingTimeout = this.debouncedHandlers.get(path);
		if (existingTimeout) {
			window.clearTimeout(existingTimeout);
		}

		// Schedule new handler
		const timeoutId = window.setTimeout(() => {
			this.debouncedHandlers.delete(path);
			this.handleFileChanged(file, cache);
		}, this.DEBOUNCE_DELAY);

		this.debouncedHandlers.set(path, timeoutId);
	}

	/**
	 * Handle file change - emit events for listeners
	 */
	private async handleFileChanged(file: TFile, cache: any): Promise<void> {
		// Just emit the event - no cache to update
		this.trigger("file-updated", { path: file.path, file });
		this.trigger("data-changed");
	}

	/**
	 * Handle file deletion
	 */
	private handleFileDeleted(path: string, prevCache: any): void {
		// Cancel any pending debounced handlers
		const timeoutId = this.debouncedHandlers.get(path);
		if (timeoutId) {
			window.clearTimeout(timeoutId);
			this.debouncedHandlers.delete(path);
		}

		this.trigger("file-deleted", { path, prevCache });
		this.trigger("data-changed");
	}

	/**
	 * Handle file rename
	 */
	private handleFileRenamed(file: TFile, oldPath: string): void {
		// Cancel any pending debounced handlers for old path
		const timeoutId = this.debouncedHandlers.get(oldPath);
		if (timeoutId) {
			window.clearTimeout(timeoutId);
			this.debouncedHandlers.delete(oldPath);
		}

		this.trigger("file-renamed", { oldPath, newPath: file.path, file });
		this.trigger("data-changed");
	}

	/**
	 * Check if a file path is valid for inclusion
	 */
	isValidFile(path: string): boolean {
		// Filter out excluded folders
		if (this.excludedFolders.some((folder) => path.startsWith(folder))) {
			return false;
		}
		return true;
	}

	/**
	 * Get task info for a specific file path (just-in-time)
	 */
	async getTaskInfo(path: string): Promise<TaskInfo | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;

		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter) return null;

		if (!this.isTaskFile(metadata.frontmatter)) return null;

		return this.extractTaskInfoFromNative(path, metadata.frontmatter);
	}

	/**
	 * Extract task info from native frontmatter
	 */
	private extractTaskInfoFromNative(path: string, frontmatter: any): TaskInfo | null {
		if (!frontmatter || !this.fieldMapper) return null;

		// Validate that the file is actually a task
		if (!this.isTaskFile(frontmatter)) return null;

		try {
			// Use FieldMapper to properly map all fields from frontmatter
			const mappedTask = this.fieldMapper.mapFromFrontmatter(
				frontmatter,
				path,
				this.storeTitleInFilename
			);

			// Calculate computed fields that aren't stored in frontmatter
			const totalTrackedTime = mappedTask.timeEntries
				? calculateTotalTimeSpent(mappedTask.timeEntries)
				: 0;

			// Get dependency information from DependencyCache
			let isBlocked = false;
			let blockingTasks: string[] = [];
			if (this._dependencyCache) {
				// Use DependencyCache for status-aware blocking check
				isBlocked = this._dependencyCache.isTaskBlocked(path);
				blockingTasks = this._dependencyCache.getBlockedTaskPaths(path);
			} else {
				// Fallback when dependency cache not available: use simple existence check
				isBlocked = Array.isArray(mappedTask.blockedBy) && mappedTask.blockedBy.length > 0;
			}
			const isBlocking = blockingTasks.length > 0;

			// Return all FieldMapper fields plus computed fields
			// This ensures new fields from FieldMapper automatically flow through
			return {
				...mappedTask,
				// Override/add fields with defaults or computed values
				id: path, // Add id field for API consistency
				path, // Ensure path is set (FieldMapper should set this, but be explicit)
				title: mappedTask.title || "Untitled task",
				status: mappedTask.status || this.settings.defaultTaskStatus,
				priority: mappedTask.priority || "normal",
				archived: mappedTask.archived || false,
				tags: Array.isArray(mappedTask.tags) ? mappedTask.tags : [],
				contexts: Array.isArray(mappedTask.contexts) ? mappedTask.contexts : [],
				projects: Array.isArray(mappedTask.projects) ? mappedTask.projects : [],
				// Computed fields
				totalTrackedTime,
				isBlocked,
				isBlocking,
				blocking: blockingTasks.length > 0 ? blockingTasks : undefined,
			};
		} catch (error) {
			console.error(`Error extracting task info from native metadata for ${path}:`, error);
			return null;
		}
	}

	/**
	 * Get all tasks by scanning all markdown files (just-in-time)
	 */
	async getAllTasks(): Promise<TaskInfo[]> {
		const tasks: TaskInfo[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const taskInfo = await this.getTaskInfo(file.path);
			if (taskInfo) {
				tasks.push(taskInfo);
			}
		}

		return tasks;
	}

	/**
	 * Get all task paths (just-in-time scan)
	 */
	getAllTaskPaths(): Set<string> {
		const taskPaths = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
				taskPaths.add(file.path);
			}
		}

		return taskPaths;
	}

	/**
	 * Get tasks for a specific date (just-in-time)
	 */
	getTasksForDate(date: string): string[] {
		const taskPaths: string[] = [];
		const files = this.app.vault.getMarkdownFiles();

		const scheduledField = this.fieldMapper?.toUserField("scheduled") || "scheduled";
		const dueField = this.fieldMapper?.toUserField("due") || "due";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const scheduled = metadata.frontmatter[scheduledField];
			const due = metadata.frontmatter[dueField];

			// Check if task is scheduled or due on this date
			if (scheduled === date || due === date) {
				taskPaths.push(file.path);
			}
		}

		return taskPaths;
	}

	/**
	 * Get tasks by status (just-in-time)
	 */
	getTaskPathsByStatus(status: string): string[] {
		const taskPaths: string[] = [];
		const files = this.app.vault.getMarkdownFiles();

		const statusField = this.fieldMapper?.toUserField("status") || "status";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			if (metadata.frontmatter[statusField] === status) {
				taskPaths.push(file.path);
			}
		}

		return taskPaths;
	}

	/**
	 * Get tasks by priority (just-in-time)
	 */
	getTaskPathsByPriority(priority: string): string[] {
		const taskPaths: string[] = [];
		const files = this.app.vault.getMarkdownFiles();

		const priorityField = this.fieldMapper?.toUserField("priority") || "priority";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			if (metadata.frontmatter[priorityField] === priority) {
				taskPaths.push(file.path);
			}
		}

		return taskPaths;
	}

	/**
	 * Get overdue task paths (just-in-time)
	 */
	getOverdueTaskPaths(): Set<string> {
		const overdue = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();
		const today = getTodayString();

		const dueField = this.fieldMapper?.toUserField("due") || "due";
		const statusField = this.fieldMapper?.toUserField("status") || "status";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const due = metadata.frontmatter[dueField];
			const status = metadata.frontmatter[statusField];

			// Only count as overdue if the status is not marked as completed
			// Check against user-defined completed statuses from settings
			const isCompletedStatus = this.settings.customStatuses?.some(
				s => s.value === status && s.isCompleted
			) || false;

			if (due && !isCompletedStatus && isBeforeDateSafe(due, today)) {
				overdue.add(file.path);
			}
		}

		return overdue;
	}

	/**
	 * Get all unique statuses (just-in-time)
	 */
	getAllStatuses(): string[] {
		const statuses = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		const statusField = this.fieldMapper?.toUserField("status") || "status";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const status = metadata.frontmatter[statusField];
			if (status) statuses.add(status);
		}

		return Array.from(statuses).sort();
	}

	/**
	 * Get all unique priorities (just-in-time)
	 */
	getAllPriorities(): string[] {
		const priorities = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		const priorityField = this.fieldMapper?.toUserField("priority") || "priority";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const priority = metadata.frontmatter[priorityField];
			if (priority) priorities.add(priority);
		}

		return Array.from(priorities).sort();
	}

	/**
	 * Get all unique tags (just-in-time)
	 */
	getAllTags(): string[] {
		const tags = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const taskTags = metadata.frontmatter.tags;
			if (Array.isArray(taskTags)) {
				taskTags.forEach(tag => {
					if (typeof tag === 'string') tags.add(tag);
				});
			}
		}

		return Array.from(tags).sort();
	}

	/**
	 * Get all unique contexts (just-in-time)
	 */
	getAllContexts(): string[] {
		const contexts = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		const contextField = this.fieldMapper?.toUserField("contexts") || "context";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const context = metadata.frontmatter[contextField];
			if (Array.isArray(context)) {
				context.forEach(ctx => {
					if (typeof ctx === 'string') contexts.add(ctx);
				});
			} else if (context) {
				contexts.add(context);
			}
		}

		return Array.from(contexts).sort();
	}

	/**
	 * Get all unique projects (just-in-time)
	 */
	getAllProjects(): string[] {
		const projects = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		const projectField = this.fieldMapper?.toUserField("projects") || "project";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const project = metadata.frontmatter[projectField];
			if (Array.isArray(project)) {
				project.forEach(proj => {
					if (typeof proj === 'string') projects.add(proj);
				});
			} else if (project) {
				projects.add(project);
			}
		}

		return Array.from(projects).sort();
	}

	/**
	 * Get all time estimates (just-in-time)
	 */
	getAllTimeEstimates(): Map<string, number> {
		const estimates = new Map<string, number>();
		const files = this.app.vault.getMarkdownFiles();

		const timeEstimateField = this.fieldMapper?.toUserField("timeEstimate") || "timeEstimate";

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) continue;

			const timeEstimate = metadata.frontmatter[timeEstimateField];
			if (typeof timeEstimate === 'number' && timeEstimate > 0) {
				estimates.set(file.path, timeEstimate);
			}
		}

		return estimates;
	}

	/**
	 * Get notes for a specific date (just-in-time)
	 */
	async getNotesForDate(date: Date): Promise<NoteInfo[]> {
		if (this.disableNoteIndexing) return [];

		const notes: NoteInfo[] = [];
		const dateStr = formatDateForStorage(date);
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!this.isValidFile(file.path)) continue;

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter) continue;

			// Skip task files
			if (this.isTaskFile(metadata.frontmatter)) continue;

			// Check if note is associated with this date
			const noteDate = metadata.frontmatter.date || metadata.frontmatter.scheduled;
			if (noteDate === dateStr) {
				notes.push({
					path: file.path,
					title: this.storeTitleInFilename ? file.basename : (metadata.frontmatter.title || file.basename),
					tags: metadata.frontmatter.tags || [],
				});
			}
		}

		return notes;
	}

	/**
	 * Compatibility method - same as getTaskInfo
	 */
	async getTaskByPath(path: string): Promise<TaskInfo | null> {
		return this.getTaskInfo(path);
	}

	/**
	 * Compatibility method - same as getTaskInfo
	 */
	async getCachedTaskInfo(path: string): Promise<TaskInfo | null> {
		return this.getTaskInfo(path);
	}

	/**
	 * Synchronous task info getter (reads from metadataCache)
	 */
	getCachedTaskInfoSync(path: string): TaskInfo | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;

		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) return null;

		return this.extractTaskInfoFromNative(path, metadata.frontmatter);
	}

	/**
	 * Check if initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		// Clear all debounce timers
		this.debouncedHandlers.forEach((timeoutId) => {
			window.clearTimeout(timeoutId);
		});
		this.debouncedHandlers.clear();

		// Unregister all event listeners
		this.eventListeners.forEach((ref) => {
			this.app.metadataCache.offref(ref);
		});
		this.eventListeners = [];

		this.initialized = false;
	}

	/**
	 * Delegate dependency methods to DependencyCache (will be set by main.ts)
	 */
	private _dependencyCache?: any;

	setDependencyCache(cache: any): void {
		this._dependencyCache = cache;
	}

	getBlockingTaskPaths(taskPath: string): string[] {
		if (!this._dependencyCache) {
			console.warn("DependencyCache not set in TaskManager");
			return [];
		}
		return this._dependencyCache.getBlockingTaskPaths(taskPath);
	}

	getBlockedTaskPaths(taskPath: string): string[] {
		if (!this._dependencyCache) {
			console.warn("DependencyCache not set in TaskManager");
			return [];
		}
		return this._dependencyCache.getBlockedTaskPaths(taskPath);
	}

	isTaskBlocked(taskPath: string): boolean {
		if (!this._dependencyCache) {
			return false;
		}
		return this._dependencyCache.isTaskBlocked(taskPath);
	}

	getTasksReferencingProject(projectPath: string): string[] {
		if (!this._dependencyCache) {
			console.warn("DependencyCache not set in TaskManager");
			return [];
		}
		return this._dependencyCache.getTasksReferencingProject(projectPath);
	}

	isFileUsedAsProject(filePath: string): boolean {
		if (!this._dependencyCache) {
			return false;
		}
		return this._dependencyCache.isFileUsedAsProject(filePath);
	}

	/**
	 * Wait for Obsidian's metadata cache to have fresh data for a file.
	 * This is necessary after creating/modifying files because the metadata cache
	 * updates asynchronously.
	 */
	async waitForFreshTaskData(pathOrFile: string | TFile, maxRetries = 10): Promise<void> {
		const path = pathOrFile instanceof TFile ? pathOrFile.path : pathOrFile;
		const file = pathOrFile instanceof TFile
			? pathOrFile
			: this.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			// File doesn't exist yet, just wait a bit
			await new Promise(resolve => setTimeout(resolve, 100));
			return;
		}

		// Poll the metadata cache until it has the file's frontmatter
		for (let i = 0; i < maxRetries; i++) {
			const metadata = this.app.metadataCache.getFileCache(file);
			if (metadata?.frontmatter) {
				// Metadata cache has the file indexed
				return;
			}
			// Wait before retrying (50ms, 100ms, 150ms, etc.)
			await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
		}

		// If we still don't have metadata after retries, log a warning but continue
		console.warn(`TaskManager: Metadata cache not ready for ${path} after ${maxRetries} retries`);
	}

	updateConfig(settings: any): void {
		// Update settings
		this.settings = settings;
		this.taskTag = settings.taskTag;
		this.excludedFolders = settings.excludedFolders
			? settings.excludedFolders
					.split(",")
					.map((folder: string) => folder.trim())
					.filter((folder: string) => folder.length > 0)
			: [];
		this.disableNoteIndexing = settings.disableNoteIndexing;
		this.storeTitleInFilename = settings.storeTitleInFilename;

		// Emit config changed event
		this.trigger("data-changed");
	}

	subscribe(event: string, callback: (...args: any[]) => void): () => void {
		this.on(event, callback);
		return () => {
			this.off(event, callback);
		};
	}

	async getCalendarData(year: number, month: number): Promise<any> {
		// For now, return a simple calendar data structure
		// This can be optimized later if needed
		const tasks = await this.getAllTasks();
		const calendarData: any = {};

		for (const task of tasks) {
			if (task.scheduled) {
				if (!calendarData[task.scheduled]) {
					calendarData[task.scheduled] = [];
				}
				calendarData[task.scheduled].push(task);
			}
			if (task.due) {
				if (!calendarData[task.due]) {
					calendarData[task.due] = [];
				}
				if (!calendarData[task.due].includes(task)) {
					calendarData[task.due].push(task);
				}
			}
		}

		return calendarData;
	}

	async getTaskInfoForDate(date: Date): Promise<TaskInfo[]> {
		const dateStr = formatDateForStorage(date);
		const taskPaths = this.getTasksForDate(dateStr);
		const tasks: TaskInfo[] = [];

		for (const path of taskPaths) {
			const taskInfo = await this.getTaskInfo(path);
			if (taskInfo) {
				tasks.push(taskInfo);
			}
		}

		return tasks;
	}

	getTaskPathsByDate(dateStr: string): Set<string> {
		return new Set(this.getTasksForDate(dateStr));
	}

	getAllProjectsWithDetails(): Array<{
		path: string;
		title: string;
		taskCount: number;
		completedCount: number;
		projects?: string[];
	}> {
		// For now, return empty array - this can be implemented if needed
		// The method is primarily used by removed native views
		return [];
	}

	getAllProjectFiles(): Array<{
		path: string;
		basename: string;
		projects: string[];
	}> {
		// For now, return empty array - this can be implemented if needed
		// The method is primarily used by removed native views
		return [];
	}

	/**
	 * No-op methods for compatibility with old cache interface
	 */
	async rebuildDailyNotesCache(year: number, month: number): Promise<void> {
		// Not needed - we read on-demand
	}

	async clearAllCaches(): Promise<void> {
		// Not needed - we don't cache
		this.trigger("data-changed");
	}

	clearCacheEntry(path: string): void {
		// Not needed - we don't cache
	}

	updateTaskInfoInCache(path: string, taskInfo: TaskInfo): void {
		// Not needed - we don't cache
		// Just emit an event
		this.trigger("file-updated", { path });
	}
}
