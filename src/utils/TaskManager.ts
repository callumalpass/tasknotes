import { TFile, App, Events, EventRef, parseYaml } from "obsidian";
import { TaskInfo, NoteInfo, EVENT_TASK_UPDATED } from "../types";
import { FieldMapper } from "../core/FieldMapper";
import { normalizePriorityConfigValue, normalizeStatusConfigValue } from "../core/fieldMapping";
import { getTodayString, formatDateForStorage, isBeforeDateSafe, getDatePart } from "./dateUtils";
import { TaskNotesSettings } from "../types/settings";
import type { DependencyCache } from "./DependencyCache";
import { isPathInExcludedFolder, parseExcludedFolders } from "./pathExclusions";
import { buildTaskInfoFromMappedTask } from "./taskInfoAssembly";
import { isTaskFrontmatter } from "./taskIdentification";
import { createTaskNotesLogger } from "./tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Utils/TaskManager" });

type DateIndexProperty = "due" | "scheduled";
type DateRangeOperator = "is-before" | "is-after" | "is-on-or-before" | "is-on-or-after";

interface TaskFilterIndexEntry {
	path: string;
	status?: string;
	priority?: string;
	dueDate?: string;
	scheduledDate?: string;
	tags: string[];
	contexts: string[];
	projects: string[];
	timeEstimate?: number;
	isCompleted: boolean;
	signature: string;
}

/**
 * Task manager backed by Obsidian's native metadata cache.
 *
 * Design Philosophy:
 * - Read task details on-demand from metadataCache
 * - Maintain small field indexes for filter/query hot paths
 * - Event-driven: Listen to Obsidian events and emit change notifications
 * - Keep index updates field-aware so ordinary note edits do not invalidate filter work
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

	// Write-through fallback for files TaskNotes just wrote before Obsidian metadata is ready.
	private pendingTaskInfoByPath = new Map<string, TaskInfo>();

	// Filter/query indexes, built lazily and maintained incrementally after first use.
	private filterIndexesBuilt = false;
	private indexedTaskPaths: Set<string> = new Set();
	private taskFilterEntries: Map<string, TaskFilterIndexEntry> = new Map();
	private statusIndex: Map<string, Set<string>> = new Map();
	private priorityIndex: Map<string, Set<string>> = new Map();
	private dueDateIndex: Map<string, Set<string>> = new Map();
	private scheduledDateIndex: Map<string, Set<string>> = new Map();
	private tagCounts: Map<string, number> = new Map();
	private contextCounts: Map<string, number> = new Map();
	private projectCounts: Map<string, number> = new Map();

	constructor(app: App, settings: TaskNotesSettings, fieldMapper?: FieldMapper) {
		super();
		this.app = app;
		this.settings = settings;
		this.taskTag = settings.taskTag;
		this.excludedFolders = parseExcludedFolders(settings.excludedFolders);
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
	isTaskFile(frontmatter: unknown): boolean {
		return isTaskFrontmatter(frontmatter, this.settings);
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
	private handleFileChangedDebounced(file: TFile, cache: unknown): void {
		const path = file.path;

		// Cancel existing debounced handler for this file
		const existingTimeout = this.debouncedHandlers.get(path);
		if (existingTimeout) {
			window.clearTimeout(existingTimeout);
		}

		// Schedule new handler
		const timeoutId = window.setTimeout(() => {
			this.debouncedHandlers.delete(path);
			void this.handleFileChanged(file, cache);
		}, this.DEBOUNCE_DELAY);

		this.debouncedHandlers.set(path, timeoutId);
	}

	/**
	 * Handle file change - emit events for listeners
	 */
	private async handleFileChanged(file: TFile, cache: unknown): Promise<void> {
		let updatedTask: TaskInfo | null = null;
		let filterIndexChanged = false;

		if (cache && typeof cache === "object" && "frontmatter" in cache) {
			const frontmatter = (cache as { frontmatter?: unknown }).frontmatter;
			if (frontmatter && this.isTaskFile(frontmatter)) {
				const metadataTaskInfo = this.extractTaskInfoFromNative(file.path, frontmatter);
				const pendingTaskInfo = this.getPendingTaskInfo(file.path);
				if (
					pendingTaskInfo &&
					this.shouldUsePendingTaskInfo(pendingTaskInfo, metadataTaskInfo)
				) {
					updatedTask = pendingTaskInfo;
				} else {
					this.pendingTaskInfoByPath.delete(file.path);
					updatedTask = metadataTaskInfo;
				}
			} else {
				this.pendingTaskInfoByPath.delete(file.path);
			}
		}
		filterIndexChanged = this.updateFilterIndexesForFile(file.path, cache);

		// Emit both the generic file event and the task-specific event so rendered task cards
		// refresh when users edit task frontmatter directly in Obsidian.
		this.trigger("file-updated", { path: file.path, file, updatedTask, filterIndexChanged });
		if (updatedTask) {
			this.trigger(EVENT_TASK_UPDATED, {
				path: file.path,
				task: updatedTask,
				taskInfo: updatedTask,
				updatedTask,
			});
		}
		this.trigger("data-changed");
	}

	/**
	 * Handle file deletion
	 */
	private handleFileDeleted(path: string, prevCache: unknown): void {
		this.pendingTaskInfoByPath.delete(path);
		this.removeFilterIndexEntry(path);

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
		const pendingTaskInfo = this.pendingTaskInfoByPath.get(oldPath);
		if (pendingTaskInfo) {
			this.pendingTaskInfoByPath.delete(oldPath);
			this.pendingTaskInfoByPath.set(file.path, {
				...pendingTaskInfo,
				id: file.path,
				path: file.path,
			});
		}

		// Cancel any pending debounced handlers for old path
		const timeoutId = this.debouncedHandlers.get(oldPath);
		if (timeoutId) {
			window.clearTimeout(timeoutId);
			this.debouncedHandlers.delete(oldPath);
		}
		this.removeFilterIndexEntry(oldPath);
		this.updateFilterIndexesForFile(file.path, this.app.metadataCache.getFileCache(file));

		this.trigger("file-renamed", { oldPath, newPath: file.path, file });
		this.trigger("data-changed");
	}

	/**
	 * Check if a file path is valid for inclusion
	 */
	isValidFile(path: string): boolean {
		return !isPathInExcludedFolder(path, this.excludedFolders);
	}

	/**
	 * Get task info for a specific file path (just-in-time)
	 */
	async getTaskInfo(path: string): Promise<TaskInfo | null> {
		if (!this.isValidFile(path)) return null;

		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;

		const pendingTaskInfo = this.getPendingTaskInfo(path);
		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter) {
			if (pendingTaskInfo) {
				return pendingTaskInfo;
			}

			const frontmatter = await this.readFrontmatterFromFile(file);
			if (!frontmatter || !this.isTaskFile(frontmatter)) return null;

			return this.extractTaskInfoFromNative(path, frontmatter);
		}

		const metadataTaskInfo = this.isTaskFile(metadata.frontmatter)
			? this.extractTaskInfoFromNative(path, metadata.frontmatter)
			: null;

		if (pendingTaskInfo && this.shouldUsePendingTaskInfo(pendingTaskInfo, metadataTaskInfo)) {
			return pendingTaskInfo;
		}

		this.pendingTaskInfoByPath.delete(path);

		return metadataTaskInfo;
	}

	private getPendingTaskInfo(path: string): TaskInfo | null {
		const taskInfo = this.pendingTaskInfoByPath.get(path);
		if (!taskInfo) return null;

		return {
			...taskInfo,
			id: taskInfo.id ?? path,
			path,
		};
	}

	private shouldUsePendingTaskInfo(
		pendingTaskInfo: TaskInfo,
		metadataTaskInfo: TaskInfo | null
	): boolean {
		if (!metadataTaskInfo) {
			return true;
		}

		if (pendingTaskInfo.dateModified) {
			return metadataTaskInfo.dateModified !== pendingTaskInfo.dateModified;
		}

		return false;
	}

	/**
	 * Extract task info from native frontmatter
	 */
	private extractTaskInfoFromNative(path: string, frontmatter: unknown): TaskInfo | null {
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

			return buildTaskInfoFromMappedTask({
				path,
				mappedTask,
				defaultTaskStatus: this.settings.defaultTaskStatus,
				isBlocked,
				blockingTasks,
			});
		} catch (error) {
			tasknotesLogger.error(`Error extracting task info from native metadata for ${path}:`, {
				category: "persistence",
				operation: "extracting-task-info-native-metadata",
				error: error,
			});
			return null;
		}
	}

	private ensureFilterIndexes(): void {
		if (this.filterIndexesBuilt) {
			return;
		}

		this.clearFilterIndexes();

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!this.isValidFile(file.path)) {
				continue;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
				const entry = this.createFilterIndexEntry(file.path, metadata.frontmatter);
				this.addFilterIndexEntry(entry);
			}
		}

		this.filterIndexesBuilt = true;
	}

	private updateFilterIndexesForFile(path: string, cache: unknown): boolean {
		if (!this.filterIndexesBuilt) {
			return true;
		}

		if (!this.isValidFile(path)) {
			return this.removeFilterIndexEntry(path);
		}

		const frontmatter = this.getFrontmatterFromCache(cache) ?? this.getFrontmatterForPath(path);
		if (!frontmatter || !this.isTaskFile(frontmatter)) {
			return this.removeFilterIndexEntry(path);
		}

		const nextEntry = this.createFilterIndexEntry(path, frontmatter);
		const previousEntry = this.taskFilterEntries.get(path);
		if (previousEntry?.signature === nextEntry.signature) {
			return false;
		}

		if (previousEntry) {
			this.removeFilterIndexEntry(path);
		}
		this.addFilterIndexEntry(nextEntry);
		return true;
	}

	private updateFilterIndexesFromTaskInfo(path: string, taskInfo: TaskInfo): boolean {
		if (!this.filterIndexesBuilt) {
			return true;
		}

		if (!this.isValidFile(path)) {
			return this.removeFilterIndexEntry(path);
		}

		const nextEntry = this.createFilterIndexEntryFromTaskInfo(path, taskInfo);
		const previousEntry = this.taskFilterEntries.get(path);
		if (previousEntry?.signature === nextEntry.signature) {
			return false;
		}

		if (previousEntry) {
			this.removeFilterIndexEntry(path);
		}
		this.addFilterIndexEntry(nextEntry);
		return true;
	}

	private getFrontmatterFromCache(cache: unknown): Record<string, unknown> | null {
		if (!cache || typeof cache !== "object" || !("frontmatter" in cache)) {
			return null;
		}

		const frontmatter = (cache as { frontmatter?: unknown }).frontmatter;
		if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
			return null;
		}

		return frontmatter as Record<string, unknown>;
	}

	private getFrontmatterForPath(path: string): Record<string, unknown> | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return null;
		}

		return this.getFrontmatterFromCache(this.app.metadataCache.getFileCache(file));
	}

	private createFilterIndexEntry(
		path: string,
		frontmatter: Record<string, unknown>
	): TaskFilterIndexEntry {
		const statusField = this.fieldMapper?.toUserField("status") || "status";
		const priorityField = this.fieldMapper?.toUserField("priority") || "priority";
		const scheduledField = this.fieldMapper?.toUserField("scheduled") || "scheduled";
		const dueField = this.fieldMapper?.toUserField("due") || "due";
		const contextField = this.fieldMapper?.toUserField("contexts") || "context";
		const projectField = this.fieldMapper?.toUserField("projects") || "project";
		const timeEstimateField = this.fieldMapper?.toUserField("timeEstimate") || "timeEstimate";

		const status =
			normalizeStatusConfigValue(frontmatter[statusField], this.settings.customStatuses) ??
			undefined;
		const priority =
			normalizePriorityConfigValue(frontmatter[priorityField], this.settings.customPriorities) ??
			undefined;
		const dueDate = this.normalizeDateValue(frontmatter[dueField]);
		const scheduledDate = this.normalizeDateValue(frontmatter[scheduledField]);
		const tags = this.normalizeStringValues(frontmatter.tags, false);
		const contexts = this.normalizeStringValues(frontmatter[contextField], true);
		const projects = this.normalizeStringValues(frontmatter[projectField], true);
		const rawTimeEstimate = frontmatter[timeEstimateField];
		const timeEstimate =
			typeof rawTimeEstimate === "number" && rawTimeEstimate > 0 ? rawTimeEstimate : undefined;

		const isCompleted =
			this.settings.customStatuses?.some((s) => s.value === status && s.isCompleted) || false;

		return this.withFilterIndexSignature({
			path,
			status,
			priority,
			dueDate,
			scheduledDate,
			tags,
			contexts,
			projects,
			timeEstimate,
			isCompleted,
			signature: "",
		});
	}

	private createFilterIndexEntryFromTaskInfo(
		path: string,
		taskInfo: TaskInfo
	): TaskFilterIndexEntry {
		const status =
			normalizeStatusConfigValue(taskInfo.status, this.settings.customStatuses) ?? undefined;
		const priority =
			normalizePriorityConfigValue(taskInfo.priority, this.settings.customPriorities) ??
			undefined;
		const dueDate = this.normalizeDateValue(taskInfo.due);
		const scheduledDate = this.normalizeDateValue(taskInfo.scheduled);
		const tags = this.normalizeStringValues(taskInfo.tags, false);
		const contexts = this.normalizeStringValues(taskInfo.contexts, true);
		const projects = this.normalizeStringValues(taskInfo.projects, true);
		const timeEstimate =
			typeof taskInfo.timeEstimate === "number" && taskInfo.timeEstimate > 0
				? taskInfo.timeEstimate
				: undefined;
		const isCompleted =
			this.settings.customStatuses?.some((s) => s.value === status && s.isCompleted) || false;

		return this.withFilterIndexSignature({
			path,
			status,
			priority,
			dueDate,
			scheduledDate,
			tags,
			contexts,
			projects,
			timeEstimate,
			isCompleted,
			signature: "",
		});
	}

	private withFilterIndexSignature(entry: TaskFilterIndexEntry): TaskFilterIndexEntry {
		return {
			...entry,
			signature: JSON.stringify({
				contexts: entry.contexts,
				dueDate: entry.dueDate,
				isCompleted: entry.isCompleted,
				priority: entry.priority,
				projects: entry.projects,
				scheduledDate: entry.scheduledDate,
				status: entry.status,
				tags: entry.tags,
				timeEstimate: entry.timeEstimate,
			}),
		};
	}

	private normalizeDateValue(value: unknown): string | undefined {
		if (typeof value !== "string" || value.length === 0) {
			return undefined;
		}

		const date = getDatePart(value);
		return date.length > 0 ? date : undefined;
	}

	private normalizeStringValues(value: unknown, includeScalar: boolean): string[] {
		const values = Array.isArray(value) ? value : includeScalar && value ? [value] : [];
		const normalized = new Set<string>();

		for (const item of values) {
			if (typeof item !== "string") {
				continue;
			}

			const trimmed = item.trim();
			if (trimmed) {
				normalized.add(trimmed);
			}
		}

		return Array.from(normalized).sort();
	}

	private addFilterIndexEntry(entry: TaskFilterIndexEntry): void {
		this.taskFilterEntries.set(entry.path, entry);
		this.indexedTaskPaths.add(entry.path);
		this.addPathToIndex(this.statusIndex, entry.status, entry.path);
		this.addPathToIndex(this.priorityIndex, entry.priority, entry.path);
		this.addPathToIndex(this.dueDateIndex, entry.dueDate, entry.path);
		this.addPathToIndex(this.scheduledDateIndex, entry.scheduledDate, entry.path);
		this.incrementValues(this.tagCounts, entry.tags);
		this.incrementValues(this.contextCounts, entry.contexts);
		this.incrementValues(this.projectCounts, entry.projects);
	}

	private removeFilterIndexEntry(path: string): boolean {
		if (!this.filterIndexesBuilt) {
			return false;
		}

		const entry = this.taskFilterEntries.get(path);
		if (!entry) {
			return false;
		}

		this.taskFilterEntries.delete(path);
		this.indexedTaskPaths.delete(path);
		this.removePathFromIndex(this.statusIndex, entry.status, path);
		this.removePathFromIndex(this.priorityIndex, entry.priority, path);
		this.removePathFromIndex(this.dueDateIndex, entry.dueDate, path);
		this.removePathFromIndex(this.scheduledDateIndex, entry.scheduledDate, path);
		this.decrementValues(this.tagCounts, entry.tags);
		this.decrementValues(this.contextCounts, entry.contexts);
		this.decrementValues(this.projectCounts, entry.projects);
		return true;
	}

	private addPathToIndex(
		index: Map<string, Set<string>>,
		value: string | undefined,
		path: string
	): void {
		if (!value) {
			return;
		}

		const existingPaths = index.get(value);
		if (existingPaths) {
			existingPaths.add(path);
			return;
		}

		index.set(value, new Set([path]));
	}

	private removePathFromIndex(
		index: Map<string, Set<string>>,
		value: string | undefined,
		path: string
	): void {
		if (!value) {
			return;
		}

		const paths = index.get(value);
		if (!paths) {
			return;
		}

		paths.delete(path);
		if (paths.size === 0) {
			index.delete(value);
		}
	}

	private incrementValues(counts: Map<string, number>, values: string[]): void {
		for (const value of values) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}

	private decrementValues(counts: Map<string, number>, values: string[]): void {
		for (const value of values) {
			const nextCount = (counts.get(value) ?? 0) - 1;
			if (nextCount > 0) {
				counts.set(value, nextCount);
			} else {
				counts.delete(value);
			}
		}
	}

	private sortedCountKeys(counts: Map<string, number>): string[] {
		return Array.from(counts.keys()).sort();
	}

	private clearFilterIndexes(): void {
		this.indexedTaskPaths.clear();
		this.taskFilterEntries.clear();
		this.statusIndex.clear();
		this.priorityIndex.clear();
		this.dueDateIndex.clear();
		this.scheduledDateIndex.clear();
		this.tagCounts.clear();
		this.contextCounts.clear();
		this.projectCounts.clear();
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
	 * Get all task paths from the filter index.
	 */
	getAllTaskPaths(): Set<string> {
		this.ensureFilterIndexes();
		return new Set(this.indexedTaskPaths);
	}

	/**
	 * Get tasks for a specific date from due and scheduled indexes.
	 */
	getTasksForDate(date: string): string[] {
		const targetDate = getDatePart(date);
		this.ensureFilterIndexes();
		return Array.from(
			new Set([
				...(this.scheduledDateIndex.get(targetDate) ?? []),
				...(this.dueDateIndex.get(targetDate) ?? []),
			])
		);
	}

	getTaskPathsForDateRange(
		property: DateIndexProperty,
		operator: DateRangeOperator,
		date: string
	): Set<string> {
		this.ensureFilterIndexes();

		const targetDate = getDatePart(date);
		const index = property === "due" ? this.dueDateIndex : this.scheduledDateIndex;
		const matchingPaths = new Set<string>();

		for (const [indexedDate, paths] of index) {
			if (!this.matchesDateRange(indexedDate, operator, targetDate)) {
				continue;
			}

			for (const path of paths) {
				matchingPaths.add(path);
			}
		}

		return matchingPaths;
	}

	private matchesDateRange(
		indexedDate: string,
		operator: DateRangeOperator,
		targetDate: string
	): boolean {
		switch (operator) {
			case "is-before":
				return indexedDate < targetDate;
			case "is-after":
				return indexedDate > targetDate;
			case "is-on-or-before":
				return indexedDate <= targetDate;
			case "is-on-or-after":
				return indexedDate >= targetDate;
			default:
				return false;
		}
	}

	/**
	 * Get tasks by status from the filter index.
	 */
	getTaskPathsByStatus(status: string): string[] {
		const expectedStatus =
			normalizeStatusConfigValue(status, this.settings.customStatuses) ?? status;
		this.ensureFilterIndexes();
		return Array.from(this.statusIndex.get(expectedStatus) ?? []);
	}

	/**
	 * Get tasks by priority from the filter index.
	 */
	getTaskPathsByPriority(priority: string): string[] {
		const expectedPriority =
			normalizePriorityConfigValue(priority, this.settings.customPriorities) ?? priority;
		this.ensureFilterIndexes();
		return Array.from(this.priorityIndex.get(expectedPriority) ?? []);
	}

	/**
	 * Get overdue task paths from the due-date index.
	 */
	getOverdueTaskPaths(): Set<string> {
		const overdue = new Set<string>();
		const today = getTodayString();
		this.ensureFilterIndexes();

		for (const [dueDate, paths] of this.dueDateIndex) {
			if (!isBeforeDateSafe(dueDate, today)) {
				continue;
			}
			for (const path of paths) {
				const entry = this.taskFilterEntries.get(path);
				if (entry && !entry.isCompleted) {
					overdue.add(path);
				}
			}
		}

		return overdue;
	}

	/**
	 * Get all unique statuses from the filter index.
	 */
	getAllStatuses(): string[] {
		this.ensureFilterIndexes();
		return Array.from(this.statusIndex.keys()).sort();
	}

	/**
	 * Get all unique priorities from the filter index.
	 */
	getAllPriorities(): string[] {
		this.ensureFilterIndexes();
		return Array.from(this.priorityIndex.keys()).sort();
	}

	/**
	 * Get all unique tags from the filter index.
	 */
	getAllTags(): string[] {
		this.ensureFilterIndexes();
		return this.sortedCountKeys(this.tagCounts);
	}

	/**
	 * Get all unique contexts from the filter index.
	 */
	getAllContexts(): string[] {
		this.ensureFilterIndexes();
		return this.sortedCountKeys(this.contextCounts);
	}

	/**
	 * Get all unique projects from the filter index.
	 */
	getAllProjects(): string[] {
		this.ensureFilterIndexes();
		return this.sortedCountKeys(this.projectCounts);
	}

	/**
	 * Get all time estimates from the filter index.
	 */
	getAllTimeEstimates(): Map<string, number> {
		const estimates = new Map<string, number>();
		this.ensureFilterIndexes();

		for (const [path, entry] of this.taskFilterEntries) {
			if (entry.timeEstimate !== undefined) {
				estimates.set(path, entry.timeEstimate);
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
					title: this.storeTitleInFilename
						? file.basename
						: metadata.frontmatter.title || file.basename,
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
		if (!this.isValidFile(path)) return null;

		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;

		const pendingTaskInfo = this.getPendingTaskInfo(path);
		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter) {
			return pendingTaskInfo;
		}

		const metadataTaskInfo = this.isTaskFile(metadata.frontmatter)
			? this.extractTaskInfoFromNative(path, metadata.frontmatter)
			: null;
		if (pendingTaskInfo && this.shouldUsePendingTaskInfo(pendingTaskInfo, metadataTaskInfo)) {
			return pendingTaskInfo;
		}

		this.pendingTaskInfoByPath.delete(path);
		return metadataTaskInfo;
	}

	private async readFrontmatterFromFile(file: TFile): Promise<Record<string, unknown> | null> {
		try {
			const content = await this.app.vault.read(file);
			return this.parseFrontmatterFromContent(content, file.path);
		} catch (error) {
			tasknotesLogger.warn(
				`TaskManager: Failed to read frontmatter fallback for ${file.path}`,
				{
					category: "validation",
					operation: "taskmanager-read-frontmatter-fallback",
					error: error,
				}
			);
			return null;
		}
	}

	private parseFrontmatterFromContent(
		content: string,
		path?: string
	): Record<string, unknown> | null {
		const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
		if (!match) return null;

		try {
			const parsed = parseYaml(match[1] || "");
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				return null;
			}
			return parsed as Record<string, unknown>;
		} catch (error) {
			const fileContext = path ? ` for ${path}` : "";
			tasknotesLogger.warn(`TaskManager: Failed to parse frontmatter fallback${fileContext}`, {
				category: "validation",
				operation: "taskmanager-parse-frontmatter-fallback",
				details: path ? { path } : undefined,
				error: error,
			});
			return null;
		}
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

		this.clearFilterIndexes();
		this.filterIndexesBuilt = false;
		this.initialized = false;
	}

	/**
	 * Delegate dependency methods to DependencyCache (will be set by main.ts)
	 */
	private _dependencyCache: DependencyCache | undefined = undefined;

	setDependencyCache(cache: DependencyCache): void {
		this._dependencyCache = cache;
	}

	getBlockingTaskPaths(taskPath: string): string[] {
		if (!this._dependencyCache) {
			tasknotesLogger.warn("DependencyCache not set in TaskManager", {
				category: "stale-data",
				operation: "dependencycache-not-set-taskmanager",
			});
			return [];
		}
		return this._dependencyCache.getBlockingTaskPaths(taskPath);
	}

	getBlockedTaskPaths(taskPath: string): string[] {
		if (!this._dependencyCache) {
			tasknotesLogger.warn("DependencyCache not set in TaskManager", {
				category: "stale-data",
				operation: "dependencycache-not-set-taskmanager",
			});
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
			tasknotesLogger.warn("DependencyCache not set in TaskManager", {
				category: "stale-data",
				operation: "dependencycache-not-set-taskmanager",
			});
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
	async waitForFreshTaskData(
		pathOrFile: string | { path: string },
		maxRetries = 10
	): Promise<void> {
		const path = typeof pathOrFile === "string" ? pathOrFile : pathOrFile.path;
		const file =
			typeof pathOrFile === "string"
				? this.app.vault.getAbstractFileByPath(path)
				: pathOrFile;

		if (!(file instanceof TFile)) {
			// File doesn't exist yet, just wait a bit
			await new Promise((resolve) => window.setTimeout(resolve, 100));
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
			await new Promise((resolve) => window.setTimeout(resolve, 50 * (i + 1)));
		}

		// If we still don't have metadata after retries, log a warning but continue
		tasknotesLogger.warn(
			`TaskManager: Metadata cache not ready for ${path} after ${maxRetries} retries`,
			{ category: "stale-data", operation: "taskmanager-metadata-cache-not-ready" }
		);
	}

	updateConfig(settings: TaskNotesSettings): void {
		// Update settings
		this.settings = settings;
		this.taskTag = settings.taskTag;
		this.excludedFolders = parseExcludedFolders(settings.excludedFolders);
		this.disableNoteIndexing = settings.disableNoteIndexing;
		this.storeTitleInFilename = settings.storeTitleInFilename;
		this.clearFilterIndexes();
		this.filterIndexesBuilt = false;
		this.pruneExcludedPendingTaskInfo();

		// Emit config changed event
		this.trigger("data-changed");
	}

	private pruneExcludedPendingTaskInfo(): void {
		for (const path of this.pendingTaskInfoByPath.keys()) {
			if (!this.isValidFile(path)) {
				this.pendingTaskInfoByPath.delete(path);
			}
		}
	}

	subscribe(event: string, callback: (...args: unknown[]) => void): () => void {
		this.on(event, callback);
		return () => {
			this.off(event, callback);
		};
	}

	async getCalendarData(year: number, month: number): Promise<Record<string, TaskInfo[]>> {
		// For now, return a simple calendar data structure
		// This can be optimized later if needed
		const tasks = await this.getAllTasks();
		const calendarData: Record<string, TaskInfo[]> = {};

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
		this.pendingTaskInfoByPath.clear();
		this.clearFilterIndexes();
		this.filterIndexesBuilt = false;
		this.trigger("data-changed");
	}

	clearCacheEntry(path: string): void {
		this.pendingTaskInfoByPath.delete(path);
		this.removeFilterIndexEntry(path);
	}

	updateTaskInfoInCache(path: string, taskInfo: TaskInfo): void {
		let filterIndexChanged = false;
		if (!this.isValidFile(path)) {
			this.pendingTaskInfoByPath.delete(path);
			filterIndexChanged = this.removeFilterIndexEntry(path);
			this.trigger("data-changed");
			return;
		}

		this.pendingTaskInfoByPath.set(path, {
			...taskInfo,
			id: taskInfo.id ?? path,
			path,
		});
		filterIndexChanged = this.updateFilterIndexesFromTaskInfo(path, taskInfo);
		this.trigger("file-updated", { path, updatedTask: taskInfo, filterIndexChanged });
	}
}
