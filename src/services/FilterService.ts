import {
	FilterQuery,
	TaskInfo,
	TaskSortKey,
	SortDirection,
	FilterCondition,
	FilterGroup,
	FilterOptions,
} from "../types";
import { parseLinktext, TFile, type App } from "obsidian";
import { parseLinkToPath } from "../utils/linkUtils";
import { TaskManager } from "../utils/TaskManager";
import { StatusManager } from "./StatusManager";
import { PriorityManager } from "./PriorityManager";
import { EventEmitter } from "../utils/EventEmitter";
import {
	FilterUtils,
	FilterValidationError,
	FilterEvaluationError,
} from "../utils/FilterUtils";
import { isDueByRRule } from "../utils/helpers";
import { format } from "date-fns";
import {
	isSameDateSafe,
	startOfDayForDateString,
	isToday as isTodayUtil,
	getDatePart,
	formatDateForStorage,
	parseDateToUTC,
	isTodayUTC,
} from "../utils/dateUtils";
import { TranslationKey } from "../i18n";
import { FilterQueryPlanner } from "./filter-service/FilterQueryPlanner";
import {
	findUserFieldByIdOrKey,
	getHierarchicalUserFieldGroupValues,
} from "./filter-service/userFieldValues";
import {
	isTaskForAgendaDate,
	isTaskOverdueForAgenda,
} from "./filter-service/agendaTaskSelection";
import {
	evaluateFilterNode,
	type FilterPredicateEvaluationContext,
} from "./filter-service/filterPredicateEvaluation";
import {
	groupFilterTasks,
	type FilterTaskGroupingContext,
} from "./filter-service/filterTaskGrouping";
import {
	sortFilterTasks,
	type FilterTaskSortingContext,
} from "./filter-service/filterTaskSorting";
import type { TaskNotesSettings } from "../types/settings";

type FilterServiceSettings = Pick<
	TaskNotesSettings,
	"userFields" | "hideCompletedFromOverdue"
>;

interface FilterServiceI18n {
	translate(
		key: TranslationKey,
		vars?: Record<string, string | number>
	): string;
	getCurrentLocale?(): string;
}

interface FilterServiceProjectSubtasks {
	isTaskUsedAsProjectSync(path: string): boolean;
}

export interface FilterServiceRuntime {
	app?: App;
	settings?: Partial<FilterServiceSettings>;
	i18n?: FilterServiceI18n;
	projectSubtasksService?: FilterServiceProjectSubtasks;
}

/**
 * Unified filtering, sorting, and grouping service for all task views.
 * Provides performance-optimized data retrieval using CacheManager indexes.
 */
export class FilterService extends EventEmitter {
	private static lastInstance: FilterService | null = null;
	private cacheManager: TaskManager;
	private statusManager: StatusManager;
	private priorityManager: PriorityManager;

	private readonly queryPlanner: FilterQueryPlanner;

	// Filter options caching for better performance
	private filterOptionsCache: FilterOptions | null = null;
	private filterOptionsCacheTimestamp = 0;
	private filterOptionsCacheTTL = 300000; // 5 minutes fallback TTL (should rarely be needed)
	private filterOptionsComputeCount = 0;
	private filterOptionsCacheHits = 0;

	private currentSortKey?: TaskSortKey;
	private currentSortDirection?: SortDirection;
	constructor(
		cacheManager: TaskManager,
		statusManager: StatusManager,
		priorityManager: PriorityManager,
		private runtime?: FilterServiceRuntime | null
	) {
		super();
		this.cacheManager = cacheManager;
		this.statusManager = statusManager;
		this.priorityManager = priorityManager;
		this.queryPlanner = new FilterQueryPlanner({ cacheManager });
		FilterService.lastInstance = this;
	}

	private translate(
		key: TranslationKey,
		fallback: string,
		vars?: Record<string, string | number>
	): string {
		try {
			if (this.runtime?.i18n) {
				return this.runtime.i18n.translate(key, vars);
			}
		} catch (error) {
			console.error("FilterService translation error:", error);
		}
		return fallback;
	}

	private static translateStatic(key: TranslationKey, fallback: string): string {
		const instance = FilterService.lastInstance;
		if (instance) {
			return instance.translate(key, fallback);
		}
		return fallback;
	}

	private getLocale(): string {
		try {
			const locale = this.runtime?.i18n?.getCurrentLocale?.();
			if (locale) {
				return locale;
			}
		} catch (error) {
			console.error("FilterService locale error:", error);
		}
		return "en";
	}

	private getNoProjectLabel(): string {
		return this.translate("services.filter.groupLabels.noProject", "No project");
	}

	/**
	 * Main method to get filtered, sorted, and grouped tasks
	 * Handles the new advanced FilterQuery structure with nested conditions and groups
	 * Uses query-first approach with index optimization for better performance
	 */
	async getGroupedTasks(query: FilterQuery, targetDate?: Date): Promise<Map<string, TaskInfo[]>> {
		try {
			// Use non-strict validation to allow incomplete filters during building
			FilterUtils.validateFilterNode(query, false);

			// PHASE 1 OPTIMIZATION: Use query-first approach with index-backed filtering
			let candidateTaskPaths = this.queryPlanner.getIndexOptimizedTaskPaths(query);

			// Convert paths to TaskInfo objects (only for candidates)
			const candidateTasks = await this.pathsToTaskInfos(Array.from(candidateTaskPaths));

			// Apply full filter query to the reduced candidate set
			const filteredTasks = candidateTasks.filter((task) =>
				this.evaluateFilterNode(query, task, targetDate)
			);

			// Sort the filtered results (flat sort)
			const sortedTasks = this.sortTasks(
				filteredTasks,
				query.sortKey || "due",
				query.sortDirection || "asc"
			);

			// Expose current sort to group ordering logic (used when groupKey === sortKey)
			this.currentSortKey = query.sortKey || "due";
			this.currentSortDirection = query.sortDirection || "asc";

			// Group the results; group order handled inside sortGroups
			return groupFilterTasks(
				sortedTasks,
				query.groupKey || "none",
				this.createTaskGroupingContext(),
				targetDate
			);
		} catch (error) {
			if (error instanceof FilterValidationError || error instanceof FilterEvaluationError) {
				console.error("Filter error:", error.message, {
					nodeId: error.nodeId,
					field: (error as FilterValidationError).field,
				});
				// Return empty results rather than throwing - let UI handle gracefully
				return new Map<string, TaskInfo[]>();
			}
			throw error;
		}
	}

	/**
	 * Additive API: returns standard groups and optional hierarchicalGroups when subgroupKey is set
	 */
	async getHierarchicalGroupedTasks(
		query: FilterQuery,
		targetDate?: Date
	): Promise<{
		groups: Map<string, TaskInfo[]>;
		hierarchicalGroups?: Map<string, Map<string, TaskInfo[]>>;
	}> {
		try {
			// Allow incomplete filters while building
			FilterUtils.validateFilterNode(query, false);

			// Reuse the same pipeline as getGroupedTasks to avoid behavior drift
			let candidateTaskPaths = this.queryPlanner.getIndexOptimizedTaskPaths(query);
			const candidateTasks = await this.pathsToTaskInfos(Array.from(candidateTaskPaths));
			const filteredTasks = candidateTasks.filter((task) =>
				this.evaluateFilterNode(query, task, targetDate)
			);

			const sortedTasks = this.sortTasks(
				filteredTasks,
				query.sortKey || "due",
				query.sortDirection || "asc"
			);

			// Preserve current sort for group ordering
			this.currentSortKey = query.sortKey || "due";
			this.currentSortDirection = query.sortDirection || "asc";

			const groups = groupFilterTasks(
				sortedTasks,
				query.groupKey || "none",
				this.createTaskGroupingContext(),
				targetDate
			);

			// Compute hierarchical grouping only when both keys are active
			const subgroupKey = query.subgroupKey;
			if (
				subgroupKey &&
				subgroupKey !== "none" &&
				query.groupKey &&
				query.groupKey !== "none"
			) {
				// Lazy import to avoid circular deps at module load
				const { HierarchicalGroupingService } = await import(
					"./HierarchicalGroupingService"
				);

				// Resolver that mirrors user-field extraction logic used elsewhere in this service
				const resolver = (task: TaskInfo, fieldIdOrKey: string): string[] => {
					const userFields = this.runtime?.settings?.userFields || [];
					const field = findUserFieldByIdOrKey(userFields, fieldIdOrKey);
					const missingLabel = `No ${field?.displayName || field?.key || fieldIdOrKey}`;
					const raw = field ? this.getUserFieldRawValue(task, field.key) : undefined;
					return getHierarchicalUserFieldGroupValues(field, raw, missingLabel);
				};

				const svc = new HierarchicalGroupingService(resolver);
				const hierarchicalGroups = svc.group(
					sortedTasks,
					query.groupKey,
					subgroupKey,
					this.currentSortDirection,
					this.runtime?.settings?.userFields || []
				);

				// Ensure primary group order matches the same order used for flat groups
				// (e.g., status order) instead of insertion order influenced by the current task sort.
				const orderedPrimaryKeys = Array.from(groups.keys()); // already sorted via sortGroups()
				const orderedHierarchical = new Map<string, Map<string, TaskInfo[]>>();
				for (const key of orderedPrimaryKeys) {
					const sub = hierarchicalGroups.get(key);
					if (sub) orderedHierarchical.set(key, sub);
				}
				// Safety: include any primaries that might exist only in hierarchicalGroups
				for (const [key, sub] of hierarchicalGroups) {
					if (!orderedHierarchical.has(key)) orderedHierarchical.set(key, sub);
				}

				return { groups, hierarchicalGroups: orderedHierarchical };
			}

			return { groups };
		} catch (error) {
			if (error instanceof FilterValidationError || error instanceof FilterEvaluationError) {
				console.error("Filter error (hierarchical):", error.message, {
					nodeId: error.nodeId,
				});
				return { groups: new Map<string, TaskInfo[]>() };
			}
			throw error;
		}
	}

	getCacheStats(): { entryCount: number; cacheKeys: string[]; timeoutMs: number } {
		return this.queryPlanner.getCacheStats();
	}

	/**
	 * Convert task paths to TaskInfo objects
	 */
	private async pathsToTaskInfos(paths: string[]): Promise<TaskInfo[]> {
		const tasks: TaskInfo[] = [];
		const batchSize = 50;

		for (let i = 0; i < paths.length; i += batchSize) {
			const batch = paths.slice(i, i + batchSize);
			const batchTasks = await Promise.all(
				batch.map((path) => this.cacheManager.getCachedTaskInfo(path))
			);

			for (const task of batchTasks) {
				if (task) {
					tasks.push(task);
				}
			}
		}

		return tasks;
	}

	/**
	 * Recursively evaluate a filter node (group or condition) against a task
	 * Returns true if the task matches the filter criteria
	 */
	private evaluateFilterNode(
		node: FilterGroup | FilterCondition,
		task: TaskInfo,
		targetDate?: Date
	): boolean {
		return evaluateFilterNode(
			node,
			task,
			this.createPredicateEvaluationContext(),
			targetDate
		);
	}

	private createPredicateEvaluationContext(): FilterPredicateEvaluationContext {
		return {
			app: this.runtime?.app,
			userFields: this.runtime?.settings?.userFields || [],
			projectSubtasksService: this.runtime?.projectSubtasksService,
			getUserFieldRawValue: (task, fieldKey) =>
				this.getUserFieldRawValue(task, fieldKey),
			getCompletedStatuses: () => this.statusManager.getCompletedStatuses(),
			isCompletedStatus: (status) => this.statusManager.isCompletedStatus(status),
		};
	}

	/**
	 * Resolve project reference to absolute file path for consistent grouping.
	 * Returns the absolute path if it resolves to a file, otherwise returns the original value.
	 * Supports wikilinks ([[path]]), markdown links ([text](path)), and plain paths.
	 */
	resolveProjectToAbsolutePath(projectValue: string): string {
		if (!projectValue || typeof projectValue !== "string") {
			return projectValue || "";
		}

		if (!this.runtime?.app) {
			return projectValue;
		}

		// Parse link formats (wikilinks and markdown links) to extract path
		// This handles [[path]], [[path|alias]], and [text](path) formats
		const linkPath = this.parseLinkToPath(projectValue);

		// Always try to resolve using Obsidian's API - this handles relative paths correctly
		const resolvedFile = this.runtime.app.metadataCache.getFirstLinkpathDest(linkPath, "");
		if (resolvedFile) {
			// Return the absolute file path (vault-relative) without .md extension
			return resolvedFile.path.replace(/\.md$/, "");
		}

		// If file doesn't exist, return the link path
		return linkPath.replace(/\.md$/, "");
	}

	/**
	 * Parse a link string (wikilink or markdown) to extract the path.
	 * Handles [[wikilink]], [[path|alias]], and [text](path) formats.
	 * For non-link strings, returns the input as-is.
	 */
	private parseLinkToPath(linkText: string): string {
		return parseLinkToPath(linkText);
	}

	/**
	 * Get the preferred project format for writing to task frontmatter.
	 * Converts an absolute path back to a proper wikilink format.
	 */
	getPreferredProjectFormat(absolutePathOrName: string): string {
		const noProjectLabel = this.getNoProjectLabel();
		if (!absolutePathOrName || absolutePathOrName === noProjectLabel) {
			return absolutePathOrName;
		}

		// If it's already an absolute path, return as wikilink
		if (absolutePathOrName.includes("/") || absolutePathOrName.endsWith(".md")) {
			return `[[${absolutePathOrName}]]`;
		}

		// For non-path values (plain text projects), return as simple wikilink
		return `[[${absolutePathOrName}]]`;
	}

	/**
	 * Get task paths within a date range
	 */
	private async getTaskPathsInDateRange(
		startDate: string,
		endDate: string
	): Promise<Set<string>> {
		const pathsInRange = new Set<string>();
		// Use UTC anchors for consistent date range operations
		const start = parseDateToUTC(startDate);
		const end = parseDateToUTC(endDate);

		// Get tasks with due dates in the range (existing logic)
		for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
			const dateStr = format(date, "yyyy-MM-dd"); // CORRECT: Uses local timezone
			const pathsForDate = this.cacheManager.getTaskPathsByDate(dateStr);
			pathsForDate.forEach((path) => pathsInRange.add(path));
		}

		// Also check recurring tasks without due dates to see if they should appear in this range
		const allTaskPaths = this.cacheManager.getAllTaskPaths();

		// Process paths in batches for better performance
		const batchSize = 50;
		const pathArray = Array.from(allTaskPaths);

		for (let i = 0; i < pathArray.length; i += batchSize) {
			const batch = pathArray.slice(i, i + batchSize);
			const batchTasks = await Promise.all(
				batch.map((path) => this.cacheManager.getCachedTaskInfo(path))
			);

			for (const task of batchTasks) {
				if (task && task.recurrence && !task.due) {
					// Check if this recurring task should appear on any date in the range
					for (
						let date = new Date(start);
						date <= end;
						date.setDate(date.getDate() + 1)
					) {
						if (isDueByRRule(task, date)) {
							pathsInRange.add(task.path);
							break; // No need to check more dates once we find a match
						}
					}
				}
			}
		}

		return pathsInRange;
	}

	/**
	 * Get overdue task paths efficiently using the dedicated index
	 */
	getOverdueTaskPaths(): Set<string> {
		return this.cacheManager.getOverdueTaskPaths();
	}

	/**
	 * Combine multiple task path sets (e.g., date range + overdue)
	 */
	private combineTaskPathSets(sets: Set<string>[]): Set<string> {
		const combined = new Set<string>();
		sets.forEach((set) => {
			set.forEach((path) => combined.add(path));
		});
		return combined;
	}

	/**
	 * Check if a date string falls within a date range (inclusive)
	 * Works with both date-only and datetime strings
	 */
	private isDateInRange(
		dateString: string,
		startDateString: string,
		endDateString: string
	): boolean {
		try {
			// Extract date parts for range comparison
			const datePart = getDatePart(dateString);
			const startDatePart = getDatePart(startDateString);
			const endDatePart = getDatePart(endDateString);

			const date = startOfDayForDateString(datePart);
			const startDate = startOfDayForDateString(startDatePart);
			const endDate = startOfDayForDateString(endDatePart);

			return date >= startDate && date <= endDate;
		} catch (error) {
			console.error("Error checking date range:", {
				dateString,
				startDateString,
				endDateString,
				error,
			});
			return false;
		}
	}

	/**
	 * Check if a Date object represents the same day as a date string
	 */
	private isSameDayAs(dateObj: Date, dateString: string): boolean {
		try {
			// Use safe date comparison with UTC anchors
			const dateObjString = format(dateObj, "yyyy-MM-dd");
			return isSameDateSafe(dateObjString, dateString);
		} catch (error) {
			console.error("Error comparing date object with date string:", {
				dateObj,
				dateString,
				error,
			});
			return false;
		}
	}

	/**
	 * Sort tasks by specified criteria
	 */
	private sortTasks(
		tasks: TaskInfo[],
		sortKey: TaskSortKey,
		direction: SortDirection
	): TaskInfo[] {
		return sortFilterTasks(tasks, sortKey, direction, this.createTaskSortingContext());
	}

	private createTaskGroupingContext(): FilterTaskGroupingContext {
		return {
			userFields: this.runtime?.settings?.userFields || [],
			hideCompletedFromOverdue: this.runtime?.settings?.hideCompletedFromOverdue,
			currentSortKey: this.currentSortKey,
			currentSortDirection: this.currentSortDirection,
			isCompletedStatus: (status) => this.statusManager.isCompletedStatus(status),
			getPriorityWeight: (priority) => this.priorityManager.getPriorityWeight(priority),
			getStatusOrder: (status) => this.statusManager.getStatusOrder(status),
			getUserFieldRawValue: (task, fieldKey) =>
				this.getUserFieldRawValue(task, fieldKey),
			resolveProjectToAbsolutePath: (projectValue) =>
				this.resolveProjectToAbsolutePath(projectValue),
			translate: (key, fallback, vars) => this.translate(key, fallback, vars),
			getLocale: () => this.getLocale(),
		};
	}

	private createTaskSortingContext(): FilterTaskSortingContext {
		return {
			userFields: this.runtime?.settings?.userFields || [],
			getPriorityWeight: (priority) => this.priorityManager.getPriorityWeight(priority),
			getStatusOrder: (status) => this.statusManager.getStatusOrder(status),
			getUserFieldRawValue: (task, fieldKey) =>
				this.getUserFieldRawValue(task, fieldKey),
		};
	}

	private getUserFieldRawValue(task: TaskInfo, fieldKey: string): unknown {
		try {
			const app = this.cacheManager.getApp();
			const file = app.vault.getAbstractFileByPath(task.path);
			const frontmatter = file instanceof TFile
				? app.metadataCache.getFileCache(file)?.frontmatter
				: undefined;
			return frontmatter ? frontmatter[fieldKey] : undefined;
		} catch {
			return undefined;
		}
	}

	/**
	 * Get available filter options for building filter UI
	 * Uses event-driven caching - cache is invalidated only when new options are detected
	 */
	async getFilterOptions(): Promise<FilterOptions> {
		const now = Date.now();

		// Return cached options if valid and not expired by fallback TTL
		if (
			this.filterOptionsCache &&
			now - this.filterOptionsCacheTimestamp < this.filterOptionsCacheTTL
		) {
			this.filterOptionsCacheHits++;
			return this.filterOptionsCache;
		}

		// Cache miss - compute fresh options

		const freshOptions = {
			statuses: this.statusManager.getAllStatuses(),
			priorities: this.priorityManager.getAllPriorities(),
			contexts: this.cacheManager.getAllContexts(),
			projects: this.cacheManager.getAllProjects(),
			tags: this.cacheManager.getAllTags(),
			folders: this.extractUniqueFolders(),
			userProperties: this.buildUserPropertyDefinitions(),
		};

		this.filterOptionsComputeCount++;

		// Update cache and timestamp
		this.filterOptionsCache = freshOptions;
		this.filterOptionsCacheTimestamp = now;

		return freshOptions;
	}

	/**
	 * Build dynamic user property definitions from settings.userFields
	 */
	private buildUserPropertyDefinitions(): import("../types").PropertyDefinition[] {
		const fields = this.runtime?.settings?.userFields || [];
		const defs: import("../types").PropertyDefinition[] = [];
		for (const f of fields) {
			if (!f || !f.key || !f.displayName) continue;
			const id = `user:${f.id || f.key}` as import("../types").FilterProperty;
			// Map type to supported operators and value input type
			let supported: import("../types").FilterOperator[];
			let valueInputType: import("../types").PropertyDefinition["valueInputType"];
			switch (f.type) {
				case "number":
					supported = [
						"is",
						"is-not",
						"is-greater-than",
						"is-less-than",
						"is-greater-than-or-equal",
						"is-less-than-or-equal",
						"is-empty",
						"is-not-empty",
					];
					valueInputType = "number";
					break;
				case "date":
					supported = [
						"is",
						"is-not",
						"is-before",
						"is-after",
						"is-on-or-before",
						"is-on-or-after",
						"is-empty",
						"is-not-empty",
					];
					valueInputType = "date";
					break;
				case "boolean":
					supported = ["is-checked", "is-not-checked"];
					valueInputType = "none";
					break;
				case "list":
					supported = ["contains", "does-not-contain", "is-empty", "is-not-empty"];
					valueInputType = "text";
					break;
				case "text":
				default:
					supported = [
						"is",
						"is-not",
						"contains",
						"does-not-contain",
						"is-empty",
						"is-not-empty",
					];
					valueInputType = "text";
					break;
			}
			defs.push({
				id,
				label: f.displayName,
				category:
					f.type === "boolean"
						? "boolean"
						: f.type === "number"
							? "numeric"
							: f.type === "date"
								? "date"
								: "text",
				supportedOperators: supported,
				valueInputType,
			});
		}
		return defs;
	}

	/**
	 * Check if new filter options have been detected and invalidate cache if needed
	 * Uses a time-based throttling approach to balance freshness with performance
	 */
	private checkAndInvalidateFilterOptionsCache(): void {
		if (!this.filterOptionsCache) {
			return; // No cache to invalidate
		}

		const now = Date.now();
		const cacheAge = now - this.filterOptionsCacheTimestamp;

		// Use a smart invalidation strategy:
		// 1. If cache is very fresh (< 30 seconds), keep it (most changes don't affect options)
		// 2. If cache is older, invalidate it to ensure new options are picked up
		// This gives us good performance for rapid file changes while ensuring freshness
		const minCacheAge = 30000; // 30 seconds

		if (cacheAge > minCacheAge) {
			this.invalidateFilterOptionsCache();
		}
	}

	/**
	 * Manually invalidate the filter options cache
	 */
	private invalidateFilterOptionsCache(): void {
		if (this.filterOptionsCache) {
			this.filterOptionsCache = null;
		}
	}

	/**
	 * Force refresh of filter options cache
	 * This can be called by UI components when they detect stale data
	 */
	refreshFilterOptions(): void {
		this.invalidateFilterOptionsCache();
	}

	/**
	 * Get performance statistics for filter options caching
	 */
	getFilterOptionsCacheStats(): {
		cacheHits: number;
		computeCount: number;
		hitRate: string;
		isCurrentlyCached: boolean;
		cacheAge: number;
		ttlRemaining: number;
	} {
		const now = Date.now();
		const cacheAge = this.filterOptionsCache ? now - this.filterOptionsCacheTimestamp : 0;
		const ttlRemaining = this.filterOptionsCache
			? Math.max(0, this.filterOptionsCacheTTL - cacheAge)
			: 0;
		const totalRequests = this.filterOptionsCacheHits + this.filterOptionsComputeCount;
		const hitRate =
			totalRequests > 0
				? ((this.filterOptionsCacheHits / totalRequests) * 100).toFixed(1) + "%"
				: "0%";

		return {
			cacheHits: this.filterOptionsCacheHits,
			computeCount: this.filterOptionsComputeCount,
			hitRate,
			isCurrentlyCached: !!this.filterOptionsCache,
			cacheAge,
			ttlRemaining,
		};
	}

	/**
	 * Create a default filter query with the new structure
	 */
	createDefaultQuery(): FilterQuery {
		return {
			type: "group",
			id: FilterUtils.generateId(),
			conjunction: "and",
			children: [],
			sortKey: "due",
			sortDirection: "asc",
			groupKey: "none",
		};
	}

	/**
	 * Add quick toggle conditions (Show Completed, Show Archived, Hide Recurring)
	 * These are syntactic sugar that programmatically modify the root query
	 */
	addQuickToggleCondition(
		query: FilterQuery,
		toggle: "showCompleted" | "showArchived" | "showRecurrent",
		enabled: boolean
	): FilterQuery {
		const newQuery = JSON.parse(JSON.stringify(query)); // Deep clone

		// Remove existing condition for this toggle if it exists
		this.removeQuickToggleCondition(newQuery, toggle);

		// Add new condition if toggle is disabled (meaning we want to filter out)
		if (!enabled) {
			let condition: FilterCondition;

			switch (toggle) {
				case "showCompleted":
					condition = {
						type: "condition",
						id: FilterUtils.generateId(),
						property: "status.isCompleted",
						operator: "is-not-checked",
						value: null,
					};
					break;
				case "showArchived":
					condition = {
						type: "condition",
						id: FilterUtils.generateId(),
						property: "archived",
						operator: "is-not-checked",
						value: null,
					};
					break;
				case "showRecurrent":
					condition = {
						type: "condition",
						id: FilterUtils.generateId(),
						property: "recurrence",
						operator: "is-empty",
						value: null,
					};
					break;
			}

			newQuery.children.push(condition);
		}

		return newQuery;
	}

	/**
	 * Remove quick toggle condition from query
	 */
	private removeQuickToggleCondition(
		query: FilterQuery,
		toggle: "showCompleted" | "showArchived" | "showRecurrent"
	): void {
		let propertyToRemove: string;

		switch (toggle) {
			case "showCompleted":
				propertyToRemove = "status.isCompleted";
				break;
			case "showArchived":
				propertyToRemove = "archived";
				break;
			case "showRecurrent":
				propertyToRemove = "recurrence";
				break;
		}

		query.children = query.children.filter((child) => {
			if (child.type === "condition") {
				return child.property !== propertyToRemove;
			}
			return true;
		});
	}

	/**
	 * Validate and normalize a filter query
	 */
	normalizeQuery(query: Partial<FilterQuery>): FilterQuery {
		const defaultQuery = this.createDefaultQuery();

		return {
			...defaultQuery,
			...query,
			type: "group",
			id: query.id || defaultQuery.id,
			conjunction: query.conjunction || defaultQuery.conjunction,
			children: query.children || defaultQuery.children,
			sortKey: query.sortKey || defaultQuery.sortKey,
			sortDirection: query.sortDirection || defaultQuery.sortDirection,
			groupKey: query.groupKey || defaultQuery.groupKey,
		};
	}

	/**
	 * Subscribe to cache changes and emit refresh events
	 */
	initialize(): void {
		this.cacheManager.on("file-updated", () => {
			this.queryPlanner.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("file-added", () => {
			this.queryPlanner.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("file-deleted", () => {
			this.queryPlanner.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("file-renamed", () => {
			this.queryPlanner.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("indexes-built", () => {
			this.queryPlanner.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});
	}

	/**
	 * Clean up event subscriptions and clear any caches
	 */
	cleanup(): void {
		// Clear query result cache and timers
		this.queryPlanner.clearIndexQueryCache();

		// Clear filter options cache
		this.invalidateFilterOptionsCache();

		// Remove all event listeners
		this.removeAllListeners();
	}

	// ============================================================================
	// AGENDA-SPECIFIC METHODS
	// ============================================================================

	/**
	 * Generate date range for agenda views from array of dates
	 */
	static createDateRangeFromDates(dates: Date[]): { start: string; end: string } {
		if (dates.length === 0)
			throw new Error(
				FilterService.translateStatic(
					"services.filter.errors.noDatesProvided",
					"No dates provided"
				)
			);
		const startDate = dates[0];
		const endDate = dates[dates.length - 1];

		return {
			start: format(startDate, "yyyy-MM-dd"),
			end: format(endDate, "yyyy-MM-dd"),
		};
	}

	/**
	 * Check if overdue tasks should be included for a date range
	 */
	static shouldIncludeOverdueForRange(dates: Date[], showOverdue: boolean): boolean {
		if (!showOverdue) return false;

		const today = new Date();
		const todayStr = format(today, "yyyy-MM-dd");
		return dates.some((date) => format(date, "yyyy-MM-dd") === todayStr);
	}

	/**
	 * Get tasks for a specific date within an agenda view
	 * Handles recurring tasks, due dates, scheduled dates, and overdue logic
	 */
	async getTasksForDate(
		date: Date,
		baseQuery: FilterQuery,
		includeOverdue = false
	): Promise<TaskInfo[]> {
		// FIXED: Use UTC Anchor principle for consistent date handling
		const dateStr = formatDateForStorage(date);
		const isViewingToday = isTodayUtil(dateStr);

		// Get all tasks and filter using new system
		const allTaskPaths = this.cacheManager.getAllTaskPaths();
		const allTasks = await this.pathsToTaskInfos(Array.from(allTaskPaths));
		const filteredTasks = allTasks.filter((task) => this.evaluateFilterNode(baseQuery, task));
		const hideCompletedFromOverdue = this.runtime?.settings?.hideCompletedFromOverdue ?? true;

		const tasksForDate = filteredTasks.filter((task) =>
			isTaskForAgendaDate(task, {
				dateStr,
				isViewingToday,
				includeOverdue,
				hideCompletedFromOverdue,
				isCompletedStatus: (status) => this.statusManager.isCompletedStatus(status),
			})
		);

		// Apply sorting to the filtered tasks for this date
		return this.sortTasks(
			tasksForDate,
			baseQuery.sortKey || "due",
			baseQuery.sortDirection || "asc"
		);
	}

	/**
	 * Get overdue tasks for the agenda view
	 * These are tasks that have due or scheduled dates before today
	 */
	async getOverdueTasks(baseQuery: FilterQuery): Promise<TaskInfo[]> {
		// Get all tasks and filter using the base query
		const allTaskPaths = this.cacheManager.getAllTaskPaths();
		const allTasks = await this.pathsToTaskInfos(Array.from(allTaskPaths));
		const filteredTasks = allTasks.filter((task) => this.evaluateFilterNode(baseQuery, task));
		const hideCompletedFromOverdue = this.runtime?.settings?.hideCompletedFromOverdue ?? true;

		const overdueTasks = filteredTasks.filter((task) =>
			isTaskOverdueForAgenda(task, {
				hideCompletedFromOverdue,
				isCompletedStatus: (status) => this.statusManager.isCompletedStatus(status),
			})
		);

		// Apply sorting to the overdue tasks
		return this.sortTasks(
			overdueTasks,
			baseQuery.sortKey || "due",
			baseQuery.sortDirection || "asc"
		);
	}

	/**
	 * Get enhanced agenda data with separate overdue section
	 */
	async getAgendaDataWithOverdue(
		dates: Date[],
		baseQuery: FilterQuery,
		showOverdueSection = false
	): Promise<{
		dailyData: Array<{ date: Date; tasks: TaskInfo[] }>;
		overdueTasks: TaskInfo[];
	}> {
		// Get tasks for each specific date (no overdue mixing)
		const dailyData: Array<{ date: Date; tasks: TaskInfo[] }> = [];
		for (const date of dates) {
			const tasksForDate = await this.getTasksForDate(
				date,
				baseQuery,
				false // Never include overdue in daily sections
			);

			dailyData.push({
				date: new Date(date),
				tasks: tasksForDate,
			});
		}

		// Get overdue tasks separately if requested
		const overdueTasks = showOverdueSection ? await this.getOverdueTasks(baseQuery) : [];

		return {
			dailyData,
			overdueTasks,
		};
	}

	/**
	 * Get agenda data grouped by dates for agenda views
	 * Simplified for new filter system
	 */
	async getAgendaData(
		dates: Date[],
		baseQuery: FilterQuery,
		showOverdueOnToday = false
	): Promise<Array<{ date: Date; tasks: TaskInfo[] }>> {
		const agendaData: Array<{ date: Date; tasks: TaskInfo[] }> = [];

		// Get tasks for each date
		for (const date of dates) {
			const tasksForDate = await this.getTasksForDate(
				date,
				baseQuery,
				showOverdueOnToday && isTodayUTC(date)
			);

			agendaData.push({
				date: new Date(date),
				tasks: tasksForDate,
			});
		}

		return agendaData;
	}

	/**
	 * Get flat agenda data (all tasks in one array) with date information attached
	 * Useful for flat agenda view rendering
	 */
	async getFlatAgendaData(
		dates: Date[],
		baseQuery: FilterQuery,
		showOverdueOnToday = false
	): Promise<Array<TaskInfo & { agendaDate: Date }>> {
		const groupedData = await this.getAgendaData(dates, baseQuery, showOverdueOnToday);

		const flatData: Array<TaskInfo & { agendaDate: Date }> = [];

		for (const dayData of groupedData) {
			for (const task of dayData.tasks) {
				flatData.push({
					...task,
					agendaDate: dayData.date,
				});
			}
		}

		return flatData;
	}

	/**
	 * Extract unique folder paths from all task paths
	 * Returns an array of folder paths for dropdown filtering
	 */
	private extractUniqueFolders(): readonly string[] {
		const allTaskPaths = this.cacheManager.getAllTaskPaths();
		const folderSet = new Set<string>();

		for (const taskPath of allTaskPaths) {
			// Extract the folder part of the path (everything before the last slash)
			const lastSlashIndex = taskPath.lastIndexOf("/");
			if (lastSlashIndex > 0) {
				const folderPath = taskPath.substring(0, lastSlashIndex);
				folderSet.add(folderPath);
			}
			// Also add root-level folder (empty string or "." for tasks in vault root)
			else if (lastSlashIndex === -1) {
				folderSet.add(""); // Root folder
			}
		}

		// Convert to sorted array for consistent UI ordering
		const folders = Array.from(folderSet).sort();

		// Replace empty string with a user-friendly label for root folder
		const rootLabel = this.translate("services.filter.folders.root", "(Root)");
		return folders.map((folder) => (folder === "" ? rootLabel : folder));
	}

	/**
	 * Extract project names from a task project value, handling [[link]] format
	 */
	private extractProjectNamesFromTaskValue(projectValue: string, sourcePath: string): string[] {
		if (!projectValue || projectValue.trim() === "" || projectValue === '""') {
			return [];
		}

		// Remove quotes if the value is wrapped in them
		const cleanValue = projectValue.replace(/^"(.*)"$/, "$1");

		// Check if it's a wikilink format
		if (cleanValue.startsWith("[[") && cleanValue.endsWith("]]")) {
			const linkContent = cleanValue.slice(2, -2);
			const parsed = parseLinktext(linkContent);

			// Try to resolve the link using Obsidian's API through cache manager
			const resolvedFile = this.cacheManager
				.getApp()
				.metadataCache.getFirstLinkpathDest(parsed.path, sourcePath);
			if (resolvedFile) {
				// Return the basename of the resolved file
				return [resolvedFile.basename];
			} else {
				// If file doesn't exist, use the display text or path
				const displayName =
					parsed.subpath ||
					(parsed.path.includes("/") ? parsed.path.split("/").pop() : parsed.path);
				return displayName ? [displayName] : [];
			}
		} else {
			// Plain text project (backward compatibility)
			return [cleanValue];
		}
	}
}
