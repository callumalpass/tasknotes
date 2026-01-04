import {
	FilterQuery,
	TaskInfo,
	TaskSortKey,
	TaskGroupKey,
	SortDirection,
	FilterCondition,
	FilterGroup,
	FilterOptions,
	FilterProperty,
	FilterOperator,
} from "../types";
import { parseLinktext } from "obsidian";
import { getProjectDisplayName, parseLinkToPath } from "../utils/linkUtils";
import { TaskManager } from "../utils/TaskManager";
import { StatusManager } from "./StatusManager";
import { PriorityManager } from "./PriorityManager";
import { EventEmitter } from "../utils/EventEmitter";
import {
	FilterUtils,
	FilterValidationError,
	FilterEvaluationError,
	TaskPropertyValue,
} from "../utils/FilterUtils";
import { isDueByRRule, filterEmptyProjects, getEffectiveTaskStatus } from "../utils/helpers";
import { format, parseISO } from "date-fns";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";
import {
	getTodayString,
	isBeforeDateSafe,
	isSameDateSafe,
	startOfDayForDateString,
	isToday as isTodayUtil,
	isBeforeDateTimeAware,
	isOverdueTimeAware,
	getDatePart,
	formatDateForStorage,
	parseDateToUTC,
	isTodayUTC,
} from "../utils/dateUtils";
import { TranslationKey } from "../i18n";

/**
 * Unified filtering, sorting, and grouping service for all task views.
 * Provides performance-optimized data retrieval using CacheManager indexes.
 */
export class FilterService extends EventEmitter {
	private static lastInstance: FilterService | null = null;
	private cacheManager: TaskManager;
	private statusManager: StatusManager;
	private priorityManager: PriorityManager;

	// Query result caching for repeated filter operations
	private indexQueryCache = new Map<string, Set<string>>();
	private cacheTimeout = 30000; // 30 seconds
	private cacheTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
		private plugin?: any // Plugin reference for accessing settings
	) {
		super();
		this.cacheManager = cacheManager;
		this.statusManager = statusManager;
		this.priorityManager = priorityManager;
		FilterService.lastInstance = this;
	}

	private translate(
		key: TranslationKey,
		fallback: string,
		vars?: Record<string, string | number>
	): string {
		try {
			if (this.plugin?.i18n) {
				return this.plugin.i18n.translate(key, vars);
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
			const locale = this.plugin?.i18n?.getCurrentLocale?.();
			if (locale) {
				return locale;
			}
		} catch (error) {
			console.error("FilterService locale error:", error);
		}
		return "en";
	}

	private getDueGroupLabel(
		code: "overdue" | "today" | "tomorrow" | "nextSevenDays" | "later" | "none" | "invalid"
	): string {
		switch (code) {
			case "overdue":
				return this.translate("services.filter.groupLabels.due.overdue", "Overdue");
			case "today":
				return this.translate("services.filter.groupLabels.due.today", "Today");
			case "tomorrow":
				return this.translate("services.filter.groupLabels.due.tomorrow", "Tomorrow");
			case "nextSevenDays":
				return this.translate(
					"services.filter.groupLabels.due.nextSevenDays",
					"Next seven days"
				);
			case "later":
				return this.translate("services.filter.groupLabels.due.later", "Later");
			case "none":
				return this.translate("services.filter.groupLabels.due.none", "No due date");
			case "invalid":
			default:
				return this.translate("services.filter.groupLabels.invalidDate", "Invalid date");
		}
	}

	private getScheduledGroupLabel(
		code: "past" | "today" | "tomorrow" | "nextSevenDays" | "later" | "none" | "invalid"
	): string {
		switch (code) {
			case "past":
				return this.translate(
					"services.filter.groupLabels.scheduled.past",
					"Past scheduled"
				);
			case "today":
				return this.translate("services.filter.groupLabels.scheduled.today", "Today");
			case "tomorrow":
				return this.translate("services.filter.groupLabels.scheduled.tomorrow", "Tomorrow");
			case "nextSevenDays":
				return this.translate(
					"services.filter.groupLabels.scheduled.nextSevenDays",
					"Next seven days"
				);
			case "later":
				return this.translate("services.filter.groupLabels.scheduled.later", "Later");
			case "none":
				return this.translate(
					"services.filter.groupLabels.scheduled.none",
					"No scheduled date"
				);
			case "invalid":
			default:
				return this.translate("services.filter.groupLabels.invalidDate", "Invalid date");
		}
	}

	private getNoProjectLabel(): string {
		return this.translate("services.filter.groupLabels.noProject", "No project");
	}

	private getNoTagsLabel(): string {
		return this.translate("services.filter.groupLabels.noTags", "No tags");
	}

	private getInvalidDateLabel(): string {
		return this.translate("services.filter.groupLabels.invalidDate", "Invalid date");
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
			let candidateTaskPaths = this.getIndexOptimizedTaskPaths(query);

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
			return this.groupTasks(sortedTasks, query.groupKey || "none", targetDate);
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
			let candidateTaskPaths = this.getIndexOptimizedTaskPaths(query);
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

			const groups = this.groupTasks(sortedTasks, query.groupKey || "none", targetDate);

			// Compute hierarchical grouping only when both keys are active
			const subgroupKey = (query as any).subgroupKey as TaskGroupKey | undefined;
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
					const userFields = this.plugin?.settings?.userFields || [];
					const field = userFields.find(
						(f: any) => (f.id || f.key) === fieldIdOrKey || f.key === fieldIdOrKey
					);
					const missingLabel = `No ${field?.displayName || field?.key || fieldIdOrKey}`;
					if (!field) return [missingLabel];
					try {
						const app = this.cacheManager.getApp();
						const file = app.vault.getAbstractFileByPath(task.path);
						if (!file) return [missingLabel];
						const fm = app.metadataCache.getFileCache(file as any)?.frontmatter;
						const raw = fm ? fm[field.key] : undefined;
						switch (field.type) {
							case "boolean": {
								if (typeof raw === "boolean") return [raw ? "true" : "false"];
								if (raw == null) return [missingLabel];
								const s = String(raw).trim().toLowerCase();
								if (s === "true" || s === "false") return [s];
								return [missingLabel];
							}
							case "number": {
								if (typeof raw === "number") return [String(raw)];
								if (typeof raw === "string") {
									const match = raw.match(/^(\d+(?:\.\d+)?)/);
									return match ? [match[1]] : [missingLabel];
								}
								return [missingLabel];
							}
							case "date": {
								return raw ? [String(raw)] : [missingLabel];
							}
							case "list": {
								// For grouping: use display tokens only (exclude raw wikilink tokens)
								const tokens = this.normalizeUserListValue(raw).filter(
									(t) => !/^\[\[/.test(t)
								);
								return tokens.length > 0 ? tokens : [missingLabel];
							}
							case "text":
							default: {
								const s = String(raw ?? "").trim();
								return s ? [s] : [missingLabel];
							}
						}
					} catch {
						return [missingLabel];
					}
				};

				const svc = new HierarchicalGroupingService(resolver);
				const hierarchicalGroups = svc.group(
					sortedTasks,
					query.groupKey as TaskGroupKey,
					subgroupKey,
					this.currentSortDirection,
					this.plugin?.settings?.userFields || []
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
					nodeId: (error as any).nodeId,
				});
				return { groups: new Map<string, TaskInfo[]>() };
			}
			throw error;
		}
	}

	/**
	 * Get optimized task paths using index-backed filtering
	 * Analyzes the filter query to find safe optimization opportunities
	 * Returns a reduced set of candidate task paths for further processing
	 * CRITICAL: Only optimizes when it's guaranteed to not exclude valid results
	 */
	private getIndexOptimizedTaskPaths(query: FilterQuery): Set<string> {
		// Analyze if optimization is safe for this query structure
		const optimizationAnalysis = this.analyzeQueryOptimizationSafety(query);

		if (!optimizationAnalysis.canOptimize) {
			// Optimization not safe - return all task paths to ensure correctness
			return this.cacheManager.getAllTaskPaths();
		}

		// Safe to optimize - apply the optimization strategy
		if (optimizationAnalysis.strategy === "intersect") {
			// All indexable conditions are in AND relationship - intersect them
			let candidatePaths = this.getPathsForIndexableCondition(
				optimizationAnalysis.conditions[0]
			);

			for (let i = 1; i < optimizationAnalysis.conditions.length; i++) {
				const conditionPaths = this.getPathsForIndexableCondition(
					optimizationAnalysis.conditions[i]
				);
				candidatePaths = this.intersectPathSets(candidatePaths, conditionPaths);
			}

			return candidatePaths;
		} else if (optimizationAnalysis.strategy === "single") {
			// Single indexable condition that's safe to use
			const candidatePaths = this.getPathsForIndexableCondition(
				optimizationAnalysis.conditions[0]
			);
			return candidatePaths;
		}

		// Fallback to all tasks
		return this.cacheManager.getAllTaskPaths();
	}

	/**
	 * Analyze query structure to determine if optimization is safe and what strategy to use
	 */
	private analyzeQueryOptimizationSafety(query: FilterQuery): {
		canOptimize: boolean;
		strategy?: "intersect" | "single";
		conditions: FilterCondition[];
		reason?: string;
	} {
		// Find all indexable conditions in the query
		const indexableConditions = this.findIndexableConditions(query);

		if (indexableConditions.length === 0) {
			return {
				canOptimize: false,
				conditions: [],
				reason: "No indexable conditions found",
			};
		}

		// For simple queries (single condition or only AND at root level), optimization is safe
		if (this.isSimpleQuery(query, indexableConditions)) {
			return {
				canOptimize: true,
				strategy: indexableConditions.length === 1 ? "single" : "intersect",
				conditions: indexableConditions,
			};
		}

		// For complex queries with OR conditions involving indexable conditions,
		// we need to be very careful. Conservative approach: don't optimize.
		return {
			canOptimize: false,
			conditions: indexableConditions,
			reason: "Complex query structure with OR conditions - optimization not safe",
		};
	}

	/**
	 * Check if query is simple enough for safe optimization
	 * A simple query is one where all indexable conditions are in AND relationship
	 */
	private isSimpleQuery(query: FilterQuery, indexableConditions: FilterCondition[]): boolean {
		// If no indexable conditions, nothing to optimize
		if (indexableConditions.length === 0) {
			return false;
		}

		// CRITICAL: Check if any indexable condition is part of an OR group
		// This would make pre-filtering unsafe as it could exclude valid results
		if (this.hasIndexableConditionInOrGroup(query, indexableConditions)) {
			return false;
		}

		// If only one indexable condition AND it's not in an OR group, safe to optimize
		if (indexableConditions.length === 1) {
			return true;
		}

		// Check if all indexable conditions are at the root level and root is AND
		if (query.type === "group" && query.conjunction === "and") {
			const rootIndexableConditions = query.children.filter(
				(child) => child.type === "condition" && this.isIndexableCondition(child)
			);

			// If all indexable conditions are at root level in an AND group, safe to intersect
			if (rootIndexableConditions.length === indexableConditions.length) {
				return true;
			}
		}

		// Any other structure is potentially unsafe
		return false;
	}

	/**
	 * Check if any indexable condition is part of an OR group
	 * This makes optimization unsafe as it would exclude valid results
	 */
	private hasIndexableConditionInOrGroup(
		query: FilterQuery,
		indexableConditions: FilterCondition[]
	): boolean {
		return this.checkNodeForOrWithIndexable(query, indexableConditions);
	}

	/**
	 * Recursively check if any indexable condition is in an OR group
	 */
	private checkNodeForOrWithIndexable(
		node: FilterQuery | FilterCondition,
		indexableConditions: FilterCondition[]
	): boolean {
		if (node.type === "condition") {
			return false; // Conditions themselves can't contain OR
		}

		if (node.type === "group") {
			// If this group is OR and contains any indexable conditions, optimization is unsafe
			if (node.conjunction === "or") {
				const hasIndexableChild = node.children.some(
					(child) => child.type === "condition" && indexableConditions.includes(child)
				);
				if (hasIndexableChild) {
					return true;
				}
			}

			// Recursively check child groups
			for (const child of node.children) {
				if (this.checkNodeForOrWithIndexable(child, indexableConditions)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Recursively find all indexable conditions in a filter query
	 */
	private findIndexableConditions(node: FilterQuery | FilterCondition): FilterCondition[] {
		const conditions: FilterCondition[] = [];

		if (node.type === "condition") {
			if (this.isIndexableCondition(node)) {
				conditions.push(node);
			}
		} else if (node.type === "group") {
			for (const child of node.children) {
				conditions.push(...this.findIndexableConditions(child));
			}
		}

		return conditions;
	}

	/**
	 * Check if a condition can be optimized using existing indexes
	 */
	private isIndexableCondition(condition: FilterCondition): boolean {
		const { property, operator, value } = condition;

		// Status-based conditions (uses tasksByStatus index)
		if (property === "status" && operator === "is" && value) {
			return true;
		}

		// Due date conditions (uses tasksByDate index)
		if (
			property === "due" &&
			(operator === "is" || operator === "is-before" || operator === "is-after") &&
			value
		) {
			return true;
		}

		// Scheduled date conditions (uses tasksByDate index)
		if (
			property === "scheduled" &&
			(operator === "is" || operator === "is-before" || operator === "is-after") &&
			value
		) {
			return true;
		}

		return false;
	}

	/**
	 * Get cached index query result with automatic expiration
	 * Returns a copy of the cached result to avoid mutation issues
	 */
	private getCachedIndexResult(cacheKey: string, computer: () => Set<string>): Set<string> {
		const cached = this.indexQueryCache.get(cacheKey);
		if (cached) {
			// Cache hit - return copy to avoid mutation of cached data
			return new Set(cached);
		}

		// Cache miss - compute the result
		const result = computer();

		// Cache the result
		this.indexQueryCache.set(cacheKey, new Set(result));

		// Clear any existing timer for this key
		const existingTimer = this.cacheTimers.get(cacheKey);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Auto-expire cache entry after timeout
		const timer = setTimeout(() => {
			this.indexQueryCache.delete(cacheKey);
			this.cacheTimers.delete(cacheKey);
		}, this.cacheTimeout);

		this.cacheTimers.set(cacheKey, timer);

		return result;
	}

	/**
	 * Clear all cached index query results
	 * Called when underlying data changes to ensure cache consistency
	 */
	private clearIndexQueryCache(): void {
		// Clear all timers
		for (const timer of this.cacheTimers.values()) {
			clearTimeout(timer);
		}

		// Clear caches
		this.indexQueryCache.clear();
		this.cacheTimers.clear();
	}

	/**
	 * Get query cache statistics for monitoring performance
	 */
	getCacheStats(): {
		entryCount: number;
		cacheKeys: string[];
		timeoutMs: number;
	} {
		return {
			entryCount: this.indexQueryCache.size,
			cacheKeys: Array.from(this.indexQueryCache.keys()),
			timeoutMs: this.cacheTimeout,
		};
	}

	/**
	 * Get task paths for a specific indexable condition with caching
	 */
	private getPathsForIndexableCondition(condition: FilterCondition): Set<string> {
		const { property, operator, value } = condition;

		// Create cache key from condition properties
		const cacheKey = `${property}:${operator}:${value}`;

		return this.getCachedIndexResult(cacheKey, () => {
			// Original logic for computing paths
			if (property === "status" && operator === "is" && value && typeof value === "string") {
				return new Set(this.cacheManager.getTaskPathsByStatus(value));
			}

			if (
				(property === "due" || property === "scheduled") &&
				operator === "is" &&
				value &&
				typeof value === "string"
			) {
				return new Set(this.cacheManager.getTasksForDate(value));
			}

			// For date range conditions, we'll need to implement range queries
			if (
				(property === "due" || property === "scheduled") &&
				(operator === "is-before" || operator === "is-after") &&
				value &&
				typeof value === "string"
			) {
				return this.getTaskPathsForDateRange(property, operator, value);
			}

			// Fallback - return all paths if we can't optimize
			return this.cacheManager.getAllTaskPaths();
		});
	}

	/**
	 * Get task paths for date range queries (before/after operators)
	 */
	private getTaskPathsForDateRange(
		property: string,
		operator: string,
		value: string
	): Set<string> {
		// For now, return all paths and let the full filter handle the range logic
		// This could be optimized further by implementing date range indexes
		return this.cacheManager.getAllTaskPaths();
	}

	/**
	 * Intersect two sets of task paths
	 */
	private intersectPathSets(set1: Set<string>, set2: Set<string>): Set<string> {
		const intersection = new Set<string>();
		for (const path of set1) {
			if (set2.has(path)) {
				intersection.add(path);
			}
		}
		return intersection;
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
		if (node.type === "condition") {
			return this.evaluateCondition(node, task, targetDate);
		} else if (node.type === "group") {
			return this.evaluateGroup(node, task, targetDate);
		}
		return true; // Default to true if unknown node type
	}

	/**
	 * Evaluate a filter group against a task
	 */
	private evaluateGroup(group: FilterGroup, task: TaskInfo, targetDate?: Date): boolean {
		if (group.children.length === 0) {
			return true; // Empty group matches everything
		}

		// Filter out incomplete conditions - they should be completely ignored
		const completeChildren = group.children.filter((child) => {
			if (child.type === "condition") {
				return FilterUtils.isFilterNodeComplete(child);
			}
			return true; // Groups are always evaluated (they may contain complete conditions)
		});

		// If no complete children, return true (no active filters)
		if (completeChildren.length === 0) {
			return true;
		}

		if (group.conjunction === "and") {
			// All complete children must match
			return completeChildren.every((child) =>
				this.evaluateFilterNode(child, task, targetDate)
			);
		} else if (group.conjunction === "or") {
			// At least one complete child must match
			return completeChildren.some((child) =>
				this.evaluateFilterNode(child, task, targetDate)
			);
		}

		return true; // Default to true if unknown conjunction
	}

	/**
	 * Normalize list-type user field values from frontmatter into comparable tokens
	 * - Splits comma-separated strings: "a, b" -> ["a","b"]
	 * - Extracts display text from wikilinks: [[file|Alias]] -> "Alias"; [[People/Chuck Norris]] -> "Chuck Norris"
	 * - Also includes the raw token (e.g., "[[Chuck Norris]]") for exact-match scenarios
	 */
	private normalizeUserListValue(raw: any): string[] {
		const tokens: string[] = [];
		const pushToken = (s: string) => {
			if (!s) return;
			const trimmed = String(s).trim();
			if (!trimmed) return;
			const m = trimmed.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
			if (m) {
				const target = m[1] || "";
				const alias = m[2];
				const base = alias || target.split("#")[0].split("/").pop() || target;
				if (base) tokens.push(base);
				tokens.push(trimmed); // keep raw as fallback
				return;
			}
			tokens.push(trimmed);
		};

		if (Array.isArray(raw)) {
			for (const v of raw) pushToken(String(v));
		} else if (typeof raw === "string") {
			const parts = splitListPreservingLinksAndQuotes(raw);
			for (const p of parts) pushToken(p);
		} else if (raw != null) {
			pushToken(String(raw));
		}

		// Deduplicate while preserving order
		const seen = new Set<string>();
		const out: string[] = [];
		for (const t of tokens) {
			if (!seen.has(t)) {
				seen.add(t);
				out.push(t);
			}
		}
		return out;
	}

	/**
	 * Evaluate a single filter condition against a task
	 */
	private evaluateCondition(
		condition: FilterCondition,
		task: TaskInfo,
		targetDate?: Date
	): boolean {
		const { property, operator, value } = condition;

		// Dynamic user-mapped properties: user:<id>
		if (typeof property === "string" && property.startsWith("user:")) {
			const fieldId = property.slice(5);
			const userFields = this.plugin?.settings?.userFields || [];
			const field = userFields.find((f: any) => (f.id || f.key) === fieldId);
			let taskValue: TaskPropertyValue = undefined;
			if (field) {
				try {
					const app = this.cacheManager.getApp();
					const file = app.vault.getAbstractFileByPath(task.path);
					if (file) {
						const fm = app.metadataCache.getFileCache(file as any)?.frontmatter;
						const raw = fm ? fm[field.key] : undefined;
						// Normalize based on type
						switch (field.type) {
							case "boolean":
								taskValue =
									typeof raw === "boolean"
										? raw
										: String(raw).toLowerCase() === "true";
								break;
							case "number":
								taskValue =
									typeof raw === "number"
										? raw
										: raw != null
											? parseFloat(String(raw))
											: undefined;
								break;
							case "list":
								taskValue = this.normalizeUserListValue(raw);
								break;
							default:
								taskValue = raw != null ? String(raw) : undefined;
						}
					}
				} catch {
					// Ignore JSON parsing errors for malformed user field values
				}
			}
			// For list user fields, treat 'contains' as substring match across tokens
			if (
				field?.type === "list" &&
				(operator === "contains" || operator === "does-not-contain")
			) {
				const haystack = Array.isArray(taskValue)
					? (taskValue as string[])
					: taskValue != null
						? [String(taskValue)]
						: [];
				const needles = Array.isArray(value) ? (value as string[]) : [String(value ?? "")];
				const match = needles.some(
					(n) =>
						typeof n === "string" &&
						haystack.some(
							(h) =>
								typeof h === "string" && h.toLowerCase().includes(n.toLowerCase())
						)
				);
				return operator === "contains" ? match : !match;
			}

			// For date equality, trick date handling by passing a known date property id
			const propForDate =
				field?.type === "date" ? ("due" as FilterProperty) : (property as FilterProperty);
			return FilterUtils.applyOperator(
				taskValue,
				operator as FilterOperator,
				value,
				condition.id,
				propForDate
			);
		}

		// Get the actual value from the task
		let taskValue: TaskPropertyValue = FilterUtils.getTaskPropertyValue(
			task,
			property as FilterProperty
		);

		// Handle special case for status.isCompleted
		if (property === "status.isCompleted") {
			const effectiveStatus = getEffectiveTaskStatus(task, targetDate || new Date());
			taskValue = this.statusManager.isCompletedStatus(effectiveStatus);
		}

		// Handle special case for projects - resolve wikilinks before comparison
		if (
			property === "projects" &&
			(operator === "contains" || operator === "does-not-contain")
		) {
			const result = this.evaluateProjectsCondition(
				taskValue,
				operator as FilterOperator,
				value
			);
			return result;
		}

		// Apply the operator
		return FilterUtils.applyOperator(
			taskValue,
			operator as FilterOperator,
			value,
			condition.id,
			property as FilterProperty
		);
	}

	/**
	 * Evaluate projects condition with wikilink resolution
	 * Resolves wikilink paths to handle cases where task projects use relative paths
	 * but filter condition uses simple names, or vice versa
	 */
	private evaluateProjectsCondition(
		taskValue: TaskPropertyValue,
		operator: FilterOperator,
		conditionValue: TaskPropertyValue
	): boolean {
		if (!Array.isArray(taskValue)) {
			return false;
		}

		if (typeof conditionValue !== "string") {
			return false;
		}

		// Extract the condition project name (handle both [[Name]] and Name formats)
		const conditionProjectName = this.extractProjectName(conditionValue);
		if (!conditionProjectName) {
			return false;
		}

		// Check if any task project matches the condition project
		const hasMatch = taskValue.some((taskProject) => {
			// Add null check before processing
			if (!taskProject || typeof taskProject !== "string") {
				return false;
			}

			const taskProjectName = this.extractProjectName(taskProject);
			if (!taskProjectName) {
				return false;
			}

			// Direct name comparison
			if (taskProjectName === conditionProjectName) {
				return true;
			}

			// Resolve wikilinks and compare resolved paths
			return this.compareProjectWikilinks(taskProject, conditionValue);
		});

		return operator === "contains" ? hasMatch : !hasMatch;
	}

	/**
	 * Extract clean project name from various formats ([[Name]], Name, [[path/Name]], etc.)
	 */
	private extractProjectName(projectValue: string): string | null {
		if (!projectValue || typeof projectValue !== "string") {
			return null;
		}
		const displayName = getProjectDisplayName(projectValue, this.plugin?.app);
		return displayName ? displayName : null;
	}

	/**
	 * Compare two project wikilinks by resolving them to actual files
	 * Returns true if both links resolve to the same file
	 */
	private compareProjectWikilinks(taskProject: string, conditionProject: string): boolean {
		if (!this.plugin?.app) {
			return false;
		}

		// Extract link paths
		const taskLinkPath = this.extractWikilinkPath(taskProject);
		const conditionLinkPath = this.extractWikilinkPath(conditionProject);

		if (!taskLinkPath || !conditionLinkPath) {
			return false;
		}

		// Resolve both links to actual files
		const taskFile = this.plugin.app.metadataCache.getFirstLinkpathDest(taskLinkPath, "");
		const conditionFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
			conditionLinkPath,
			""
		);

		// Compare resolved file paths
		if (taskFile && conditionFile) {
			return taskFile.path === conditionFile.path;
		}

		return false;
	}

	/**
	 * Extract the link path from a wikilink (handles [[path]] format)
	 */
	private extractWikilinkPath(linkValue: string): string | null {
		if (!linkValue || typeof linkValue !== "string") {
			return null;
		}

		if (linkValue.startsWith("[[") && linkValue.endsWith("]]")) {
			return linkValue.slice(2, -2);
		}

		return linkValue;
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

		if (!this.plugin?.app) {
			return projectValue;
		}

		// Parse link formats (wikilinks and markdown links) to extract path
		// This handles [[path]], [[path|alias]], and [text](path) formats
		const linkPath = this.parseLinkToPath(projectValue);

		// Always try to resolve using Obsidian's API - this handles relative paths correctly
		const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
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
		return tasks.sort((a, b) => {
			let comparison = 0;

			// Primary sort criteria
			if (typeof sortKey === "string" && sortKey.startsWith("user:")) {
				comparison = this.compareByUserField(a, b, sortKey as `user:${string}`);
			} else {
				switch (sortKey) {
					case "due":
						comparison = this.compareDates(a.due, b.due);
						break;
					case "scheduled":
						comparison = this.compareDates(a.scheduled, b.scheduled);
						break;
					case "priority":
						comparison = this.comparePriorities(a.priority, b.priority);
						break;
					case "status":
						comparison = this.compareStatuses(a.status, b.status);
						break;
					case "title":
						comparison = a.title.localeCompare(b.title);
						break;
					case "dateCreated":
						comparison = this.compareDates(a.dateCreated, b.dateCreated);
						break;
					case "completedDate":
						comparison = this.compareDates(a.completedDate, b.completedDate);
						break;
					case "tags":
						comparison = this.compareTags(a.tags, b.tags);
						break;
				}
			}

			// If primary criteria are equal, apply fallback sorting
			if (comparison === 0) {
				comparison = this.applyFallbackSorting(a, b, sortKey);
			}

			return direction === "desc" ? -comparison : comparison;
		});
	}

	/**
	 * Compare due dates with proper null handling using time-aware utilities
	 * Supports both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DDTHH:mm) formats
	 */
	private compareDates(dateA?: string, dateB?: string): number {
		if (!dateA && !dateB) return 0;
		if (!dateA) return 1; // No due date sorts last
		if (!dateB) return -1;

		try {
			// Use time-aware comparison for precise sorting
			if (isBeforeDateTimeAware(dateA, dateB)) {
				return -1;
			} else if (isBeforeDateTimeAware(dateB, dateA)) {
				return 1;
			} else {
				return 0;
			}
		} catch (error) {
			console.error("Error comparing dates time-aware:", { dateA, dateB, error });
			// Fallback to string comparison
			return dateA.localeCompare(dateB);
		}
	}

	/**
	 * Compare priorities using PriorityManager weights
	 */
	private comparePriorities(priorityA: string, priorityB: string): number {
		const weightA = this.priorityManager.getPriorityWeight(priorityA);
		const weightB = this.priorityManager.getPriorityWeight(priorityB);

		// Higher weight = higher priority, so reverse for ascending order
		return weightB - weightA;
	}

	/**
	 * Compare statuses using StatusManager order
	 */
	private compareStatuses(statusA: string, statusB: string): number {
		const orderA = this.statusManager.getStatusOrder(statusA);
		const orderB = this.statusManager.getStatusOrder(statusB);

		// Lower order = higher priority in status sequence
		return orderA - orderB;
	}

	/**
	 * Compare two task tag arrays for sorting purposes
	 * Sort by the first tag alphabetically, tasks with no tags go last
	 */
	private compareTags(tagsA: string[] | undefined, tagsB: string[] | undefined): number {
		const normalizedTagsA = tagsA && tagsA.length > 0 ? tagsA : [];
		const normalizedTagsB = tagsB && tagsB.length > 0 ? tagsB : [];

		// If neither has tags, they're equal
		if (normalizedTagsA.length === 0 && normalizedTagsB.length === 0) {
			return 0;
		}

		// Tasks with no tags sort last
		if (normalizedTagsA.length === 0) return 1;
		if (normalizedTagsB.length === 0) return -1;

		// Sort by the first tag alphabetically (case-insensitive)
		const firstTagA = normalizedTagsA[0].toLowerCase();
		const firstTagB = normalizedTagsB[0].toLowerCase();

		return firstTagA.localeCompare(firstTagB);
	}

	/**
	 * Apply fallback sorting criteria when primary sort yields equal values
	 * Order: scheduled date → due date → priority → title
	 */
	private applyFallbackSorting(a: TaskInfo, b: TaskInfo, primarySortKey: TaskSortKey): number {
		// Define fallback order: scheduled → due → priority → title
		const fallbackOrder: TaskSortKey[] = ["scheduled", "due", "priority", "title"];

		// Remove the primary sort key from fallbacks to avoid redundant comparison
		const fallbacks = fallbackOrder.filter((key) => key !== primarySortKey);

		for (const fallbackKey of fallbacks) {
			let comparison = 0;

			switch (fallbackKey) {
				case "scheduled":
					comparison = this.compareDates(a.scheduled, b.scheduled);
					break;
				case "due":
					comparison = this.compareDates(a.due, b.due);
					break;
				case "priority":
					comparison = this.comparePriorities(a.priority, b.priority);
					break;
				case "title":
					comparison = a.title.localeCompare(b.title);
					break;
			}

			// Return first non-zero comparison
			if (comparison !== 0) {
				return comparison;
			}
		}

		// All criteria equal
		return 0;
	}

	/** Compare by dynamic user field for sorting */
	private compareByUserField(a: TaskInfo, b: TaskInfo, sortKey: `user:${string}`): number {
		const fieldId = sortKey.slice(5);
		const userFields = this.plugin?.settings?.userFields || [];
		const field = userFields.find((f: any) => (f.id || f.key) === fieldId);
		if (!field) return 0;

		const getRaw = (t: TaskInfo) => {
			try {
				const app = this.cacheManager.getApp();
				const file = app.vault.getAbstractFileByPath(t.path);
				const fm = file
					? app.metadataCache.getFileCache(file as any)?.frontmatter
					: undefined;
				return fm ? fm[field.key] : undefined;
			} catch {
				return undefined;
			}
		};

		const rawA = getRaw(a);
		const rawB = getRaw(b);

		switch (field.type) {
			case "number": {
				const numA =
					typeof rawA === "number" ? rawA : rawA != null ? parseFloat(String(rawA)) : NaN;
				const numB =
					typeof rawB === "number" ? rawB : rawB != null ? parseFloat(String(rawB)) : NaN;
				const isNumA = !isNaN(numA);
				const isNumB = !isNaN(numB);
				if (isNumA && isNumB) return numA - numB;
				if (isNumA && !isNumB) return -1;
				if (!isNumA && isNumB) return 1;
				return 0;
			}
			case "boolean": {
				const toBool = (v: any): boolean | undefined => {
					if (typeof v === "boolean") return v;
					if (v == null) return undefined;
					const s = String(v).trim().toLowerCase();
					if (s === "true") return true;
					if (s === "false") return false;
					return undefined;
				};
				const bA = toBool(rawA);
				const bB = toBool(rawB);
				if (bA === bB) return 0;
				if (bA === true) return -1;
				if (bB === true) return 1;
				if (bA === false) return -1;
				if (bB === false) return 1;
				return 0;
			}
			case "date": {
				const tA = rawA ? Date.parse(String(rawA)) : NaN;
				const tB = rawB ? Date.parse(String(rawB)) : NaN;
				const isValidA = !isNaN(tA);
				const isValidB = !isNaN(tB);
				if (isValidA && isValidB) return tA - tB;
				if (isValidA && !isValidB) return -1;
				if (!isValidA && isValidB) return 1;
				return 0;
			}
			case "list": {
				const toFirst = (v: any): string | undefined => {
					if (Array.isArray(v)) {
						const tokens = this.normalizeUserListValue(v);
						return tokens[0];
					}
					if (typeof v === "string") {
						if (v.trim().length === 0) return "";
						const tokens = this.normalizeUserListValue(v);
						return tokens[0];
					}
					return undefined;
				};
				const sA = toFirst(rawA);
				const sB = toFirst(rawB);
				if ((sA == null || sA === "") && (sB == null || sB === "")) return 0;
				if (sA == null || sA === "") return 1; // empty/missing last
				if (sB == null || sB === "") return -1;
				return sA.localeCompare(sB);
			}
			case "text":
			default: {
				const sA = rawA != null ? String(rawA) : "";
				const sB = rawB != null ? String(rawB) : "";
				return sA.localeCompare(sB);
			}
		}
	}

	/**
	 * Group sorted tasks by specified criteria
	 */
	private groupTasks(
		tasks: TaskInfo[],
		groupKey: TaskGroupKey,
		targetDate?: Date
	): Map<string, TaskInfo[]> {
		if (groupKey === "none") {
			return new Map([["all", tasks]]);
		}

		const groups = new Map<string, TaskInfo[]>();

		for (const task of tasks) {
			// For projects and tags, handle multiple groups per task
			if (groupKey === "project") {
				const filteredProjects = filterEmptyProjects(task.projects || []);
				if (filteredProjects.length > 0) {
					// Add task to each project group, using absolute path for consistent grouping
					for (const project of filteredProjects) {
						const absolutePath = this.resolveProjectToAbsolutePath(project);
						if (!groups.has(absolutePath)) {
							groups.set(absolutePath, []);
						}
						groups.get(absolutePath)?.push(task);
					}
				} else {
					// Task has no projects - add to "No Project" group
					const noProjectGroup = this.getNoProjectLabel();
					if (!groups.has(noProjectGroup)) {
						groups.set(noProjectGroup, []);
					}
					groups.get(noProjectGroup)?.push(task);
				}
			} else if (groupKey === "tags") {
				const taskTags = task.tags || [];
				if (taskTags.length > 0) {
					// Add task to each tag group
					for (const tag of taskTags) {
						if (!groups.has(tag)) {
							groups.set(tag, []);
						}
						groups.get(tag)?.push(task);
					}
				} else {
					// Task has no tags - add to "No Tags" group
					const noTagsGroup = this.getNoTagsLabel();
					if (!groups.has(noTagsGroup)) {
						groups.set(noTagsGroup, []);
					}
					groups.get(noTagsGroup)?.push(task);
				}
			} else {
				// For all other grouping types, use single group assignment
				let groupValue: string;

				// Handle dynamic user field grouping
				if (typeof groupKey === "string" && groupKey.startsWith("user:")) {
					groupValue = this.getUserFieldGroupValue(task, groupKey);
				} else {
					switch (groupKey) {
						case "status":
							groupValue = task.status || "no-status";
							break;
						case "priority":
							groupValue = task.priority || "unknown";
							break;
						case "context":
							// For multiple contexts, put task in first context or 'none'
							groupValue =
								task.contexts && task.contexts.length > 0
									? task.contexts[0]
									: "none";
							break;
						case "due":
							groupValue = this.getDueDateGroup(task, targetDate);
							break;
						case "scheduled":
							groupValue = this.getScheduledDateGroup(task, targetDate);
							break;
						case "completedDate":
							groupValue = this.getCompletedDateGroup(task);
							break;
						default:
							groupValue = "unknown";
					}
				}

				if (!groups.has(groupValue)) {
					groups.set(groupValue, []);
				}
				groups.get(groupValue)?.push(task);
			}
		}

		return this.sortGroups(groups, groupKey);
	}

	/**
	 * Extract group value for a dynamic user field group key (user:<id>)
	 */
	private getUserFieldGroupValue(task: TaskInfo, groupKey: string): string {
		const fieldId = groupKey.slice(5);
		const userFields = this.plugin?.settings?.userFields || [];
		const field = userFields.find((f: any) => (f.id || f.key) === fieldId);
		if (!field) return "unknown-field";

		try {
			const app = this.cacheManager.getApp();
			const file = app.vault.getAbstractFileByPath(task.path);
			if (!file) return "no-value";
			const fm = app.metadataCache.getFileCache(file as any)?.frontmatter;
			const raw = fm ? fm[field.key] : undefined;

			switch (field.type) {
				case "boolean": {
					if (typeof raw === "boolean") return raw ? "true" : "false";
					if (raw == null) return "no-value";
					const s = String(raw).trim().toLowerCase();
					if (s === "true") return "true";
					if (s === "false") return "false";
					return "no-value";
				}
				case "number": {
					if (typeof raw === "number") return String(raw);
					if (typeof raw === "string") {
						const match = raw.match(/^(\d+(?:\.\d+)?)/);
						return match ? match[1] : "non-numeric";
					}
					return "no-value";
				}
				case "date":
					return raw ? String(raw) : "no-date";
				case "list": {
					if (Array.isArray(raw)) {
						const tokens = this.normalizeUserListValue(raw);
						return tokens.length > 0 ? tokens[0] : "empty";
					}
					if (typeof raw === "string") {
						if (raw.trim().length === 0) return "empty";
						const tokens = this.normalizeUserListValue(raw);
						return tokens.length > 0 ? tokens[0] : "empty";
					}
					return "no-value";
				}
				case "text":
				default:
					return raw ? String(raw).trim() || "empty" : "no-value";
			}
		} catch (e) {
			console.error("Error extracting user field value for grouping", e);
			return "error";
		}
	}

	/**
	 * Get due date group for task (Today, Tomorrow, Next seven days, etc.)
	 * For recurring tasks, checks if the task is due on the target date
	 */
	private getDueDateGroup(task: TaskInfo, targetDate?: Date): string {
		// Use target date if provided, otherwise use today
		const referenceDate = targetDate || new Date();
		referenceDate.setHours(0, 0, 0, 0);

		const isCompleted = this.statusManager.isCompletedStatus(task.status);
		const hideCompletedFromOverdue = this.plugin?.settings?.hideCompletedFromOverdue ?? true;

		// For recurring tasks, check if due on the target date
		if (task.recurrence) {
			if (isDueByRRule(task, referenceDate)) {
				// If due on target date, determine which group based on target date vs today
				const referenceDateStr = format(referenceDate, "yyyy-MM-dd");
				return this.getDateGroupFromDateStringWithTask(
					referenceDateStr,
					isCompleted,
					hideCompletedFromOverdue
				);
			} else {
				// Recurring task not due on target date
				// If it has an original due date, use that, otherwise no due date
				if (task.due) {
					return this.getDateGroupFromDateStringWithTask(
						task.due,
						isCompleted,
						hideCompletedFromOverdue
					);
				}
				return this.getDueGroupLabel("none");
			}
		}

		// Non-recurring task - use completion-aware logic
		if (!task.due) return this.getDueGroupLabel("none");
		return this.getDateGroupFromDateStringWithTask(
			task.due,
			isCompleted,
			hideCompletedFromOverdue
		);
	}

	/**
	 * Helper method to get date group from a date string (shared logic)
	 * Uses time-aware overdue detection for precise categorization
	 */
	private getDateGroupFromDateString(dateString: string): string {
		const todayStr = getTodayString();

		// Use time-aware overdue detection with completion-aware logic
		// For categorization purposes, we need the task to determine completion status
		// This call is for categorization only, specific task overdue checks happen elsewhere
		if (isOverdueTimeAware(dateString)) return this.getDueGroupLabel("overdue");

		// Extract date part for day-level comparisons
		const datePart = getDatePart(dateString);
		if (isSameDateSafe(datePart, todayStr)) return this.getDueGroupLabel("today");

		try {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
			if (isSameDateSafe(datePart, tomorrowStr)) return this.getDueGroupLabel("tomorrow");

			const thisWeek = new Date();
			thisWeek.setDate(thisWeek.getDate() + 7);
			const thisWeekStr = format(thisWeek, "yyyy-MM-dd");
			if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr))
				return this.getDueGroupLabel("nextSevenDays");

			return this.getDueGroupLabel("later");
		} catch (error) {
			console.error(`Error categorizing date ${dateString}:`, error);
			return this.getInvalidDateLabel();
		}
	}

	/**
	 * Helper method to get due date group from a specific date string
	 */
	private getDueDateGroupFromDate(dueDate: string): string {
		return this.getDateGroupFromDateString(dueDate);
	}

	/**
	 * Helper method to get due date group for a specific task (completion-aware)
	 */
	private getDueDateGroupForTask(task: TaskInfo): string {
		if (!task.due) return "No due date";

		const isCompleted = this.statusManager.isCompletedStatus(task.status);
		const hideCompletedFromOverdue = this.plugin?.settings?.hideCompletedFromOverdue ?? true;

		return this.getDateGroupFromDateStringWithTask(
			task.due,
			isCompleted,
			hideCompletedFromOverdue
		);
	}

	/**
	 * Get date group from date string with task completion awareness
	 */
	private getDateGroupFromDateStringWithTask(
		dateString: string,
		isCompleted: boolean,
		hideCompletedFromOverdue: boolean
	): string {
		const todayStr = getTodayString();

		// Use completion-aware overdue detection
		if (isOverdueTimeAware(dateString, isCompleted, hideCompletedFromOverdue))
			return this.getDueGroupLabel("overdue");

		// Extract date part for day-level comparisons
		const datePart = getDatePart(dateString);
		if (isSameDateSafe(datePart, todayStr)) return this.getDueGroupLabel("today");

		try {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
			if (isSameDateSafe(datePart, tomorrowStr)) return this.getDueGroupLabel("tomorrow");

			const thisWeek = new Date();
			thisWeek.setDate(thisWeek.getDate() + 7);
			const thisWeekStr = format(thisWeek, "yyyy-MM-dd");
			if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr))
				return this.getDueGroupLabel("nextSevenDays");

			return this.getDueGroupLabel("later");
		} catch (error) {
			console.error(`Error categorizing date ${dateString}:`, error);
			return this.getInvalidDateLabel();
		}
	}

	private getScheduledDateGroup(task: TaskInfo, targetDate?: Date): string {
		if (!task.scheduled) return this.getScheduledGroupLabel("none");

		const isCompleted = this.statusManager.isCompletedStatus(task.status);
		const hideCompletedFromOverdue = this.plugin?.settings?.hideCompletedFromOverdue ?? true;

		return this.getScheduledDateGroupForTask(
			task.scheduled,
			isCompleted,
			hideCompletedFromOverdue
		);
	}

	/**
	 * Get scheduled date group with task completion awareness
	 */
	private getScheduledDateGroupForTask(
		scheduledDate: string,
		isCompleted: boolean,
		hideCompletedFromOverdue: boolean
	): string {
		const todayStr = getTodayString();

		// Use completion-aware overdue detection for past scheduled
		if (isOverdueTimeAware(scheduledDate, isCompleted, hideCompletedFromOverdue))
			return this.getScheduledGroupLabel("past");

		// Extract date part for day-level comparisons
		const datePart = getDatePart(scheduledDate);
		if (isSameDateSafe(datePart, todayStr)) return this.getScheduledGroupLabel("today");

		try {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
			if (isSameDateSafe(datePart, tomorrowStr))
				return this.getScheduledGroupLabel("tomorrow");

			const thisWeek = new Date();
			thisWeek.setDate(thisWeek.getDate() + 7);
			const thisWeekStr = format(thisWeek, "yyyy-MM-dd");
			if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr))
				return this.getScheduledGroupLabel("nextSevenDays");

			return this.getScheduledGroupLabel("later");
		} catch (error) {
			console.error(`Error categorizing scheduled date ${scheduledDate}:`, error);
			return this.getInvalidDateLabel();
		}
	}

	/**
	 * Helper method to get scheduled date group from a specific date string
	 * Uses time-aware overdue detection for precise categorization
	 */
	private getScheduledDateGroupFromDate(scheduledDate: string): string {
		const todayStr = getTodayString();

		// Use time-aware overdue detection for past scheduled
		if (isOverdueTimeAware(scheduledDate)) return this.getScheduledGroupLabel("past");

		// Extract date part for day-level comparisons
		const datePart = getDatePart(scheduledDate);
		if (isSameDateSafe(datePart, todayStr)) return this.getScheduledGroupLabel("today");

		try {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
			if (isSameDateSafe(datePart, tomorrowStr))
				return this.getScheduledGroupLabel("tomorrow");

			const thisWeek = new Date();
			thisWeek.setDate(thisWeek.getDate() + 7);
			const thisWeekStr = format(thisWeek, "yyyy-MM-dd");
			if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr))
				return this.getScheduledGroupLabel("nextSevenDays");

			return this.getScheduledGroupLabel("later");
		} catch (error) {
			console.error(`Error categorizing scheduled date ${scheduledDate}:`, error);
			return this.getInvalidDateLabel();
		}
	}

	/**
	 * Get group label for completed date grouping
	 */
	private getCompletedDateGroup(task: TaskInfo): string {
		if (!task.completedDate) return "Not completed";

		try {
			// Format the completed date as a readable string
			const completedDate = parseISO(task.completedDate);
			return format(completedDate, "yyyy-MM-dd");
		} catch (error) {
			console.error(`Error formatting completed date ${task.completedDate}:`, error);
			return "Invalid date";
		}
	}

	/**
	 * Sort groups according to logical order
	 */
	private sortGroups(
		groups: Map<string, TaskInfo[]>,
		groupKey: TaskGroupKey
	): Map<string, TaskInfo[]> {
		const sortedGroups = new Map<string, TaskInfo[]>();

		let sortedKeys: string[];

		// Handle dynamic user field sorting
		if (typeof groupKey === "string" && groupKey.startsWith("user:")) {
			sortedKeys = this.sortUserFieldGroups(Array.from(groups.keys()), groupKey);
			// If the sort key matches the group key, apply sort direction for group headers
			if (this.currentSortKey === groupKey && this.currentSortDirection === "desc") {
				sortedKeys.reverse();
			}
		} else {
			switch (groupKey) {
				case "priority":
					// Sort by priority weight (high to low)
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const weightA = this.priorityManager.getPriorityWeight(a);
						const weightB = this.priorityManager.getPriorityWeight(b);
						return weightB - weightA;
					});
					break;

				case "status":
					// Sort by status order
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const orderA = this.statusManager.getStatusOrder(a);
						const orderB = this.statusManager.getStatusOrder(b);
						return orderA - orderB;
					});
					break;

				case "due": {
					// Sort by logical due date order
					const dueOrderKeys: Array<
						"overdue" | "today" | "tomorrow" | "nextSevenDays" | "later" | "none"
					> = ["overdue", "today", "tomorrow", "nextSevenDays", "later", "none"];
					const dueOrderMap = new Map(
						dueOrderKeys.map((key, index) => [this.getDueGroupLabel(key), index])
					);
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const indexA = dueOrderMap.get(a) ?? dueOrderKeys.length;
						const indexB = dueOrderMap.get(b) ?? dueOrderKeys.length;
						return indexA - indexB;
					});
					break;
				}

				case "scheduled": {
					// Sort by logical scheduled date order
					const scheduledOrderKeys: Array<
						"past" | "today" | "tomorrow" | "nextSevenDays" | "later" | "none"
					> = ["past", "today", "tomorrow", "nextSevenDays", "later", "none"];
					const scheduledOrderMap = new Map(
						scheduledOrderKeys.map((key, index) => [
							this.getScheduledGroupLabel(key),
							index,
						])
					);
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const indexA = scheduledOrderMap.get(a) ?? scheduledOrderKeys.length;
						const indexB = scheduledOrderMap.get(b) ?? scheduledOrderKeys.length;
						return indexA - indexB;
					});
					break;
				}

				case "project":
					// Sort projects alphabetically with "No Project" at the end
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const noProjectLabel = this.getNoProjectLabel();
						if (a === noProjectLabel) return 1;
						if (b === noProjectLabel) return -1;
						// Handle null/undefined values
						if (a == null) return 1;
						if (b == null) return -1;
						return a.localeCompare(b, this.getLocale());
					});
					break;

				case "tags":
					// Sort tags alphabetically with "No Tags" at the end
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const noTagsLabel = this.getNoTagsLabel();
						if (a === noTagsLabel) return 1;
						if (b === noTagsLabel) return -1;
						// Handle null/undefined values
						if (a == null) return 1;
						if (b == null) return -1;
						return a.localeCompare(b, this.getLocale());
					});
					break;

				case "completedDate":
					// Sort completed dates chronologically with "Not completed" at the end
					sortedKeys = Array.from(groups.keys()).sort((a, b) => {
						const notCompletedLabel = "Not completed";
						if (a === notCompletedLabel) return 1;
						if (b === notCompletedLabel) return -1;
						if (a === "Invalid date") return 1;
						if (b === "Invalid date") return -1;
						// YYYY-MM-DD format sorts chronologically in reverse (newest first)
						// Handle null/undefined values
						if (a == null || b == null) {
							if (a == null) return 1;
							if (b == null) return -1;
						}
						return b.localeCompare(a);
					});
					break;

				default:
					// Alphabetical sort for contexts and others
					sortedKeys = Array.from(groups.keys()).sort((a, b) =>
						a == null ? 1 : b == null ? -1 : a.localeCompare(b, this.getLocale())
					);
			}
		}

		// Rebuild map in sorted order
		for (const key of sortedKeys) {
			const group = groups.get(key);
		if (group) {
			sortedGroups.set(key, group);
		}
		}

		return sortedGroups;
	}

	/**
	 * Sort user-field groups based on field type
	 */
	private sortUserFieldGroups(groupKeys: string[], groupKey: string): string[] {
		const fieldId = groupKey.slice(5);
		const userFields = this.plugin?.settings?.userFields || [];
		const field = userFields.find((f: any) => (f.id || f.key) === fieldId);
		if (!field) return groupKeys.sort();

		switch (field.type) {
			case "number":
				return groupKeys.sort((a, b) => {
					const numA = parseFloat(a);
					const numB = parseFloat(b);
					const isNumA = !isNaN(numA);
					const isNumB = !isNaN(numB);
					if (isNumA && isNumB) return numB - numA; // desc
					if (isNumA && !isNumB) return -1;
					if (!isNumA && isNumB) return 1;
					return a == null ? 1 : b == null ? -1 : a.localeCompare(b);
				});
			case "boolean":
				return groupKeys.sort((a, b) => {
					if (a === "true" && b === "false") return -1;
					if (a === "false" && b === "true") return 1;
					return a == null ? 1 : b == null ? -1 : a.localeCompare(b);
				});
			case "date":
				return groupKeys.sort((a, b) => {
					const tA = Date.parse(a);
					const tB = Date.parse(b);
					const isValidA = !isNaN(tA);
					const isValidB = !isNaN(tB);
					if (isValidA && isValidB) return tA - tB; // asc
					if (isValidA && !isValidB) return -1;
					if (!isValidA && isValidB) return 1;
					return a == null ? 1 : b == null ? -1 : a.localeCompare(b);
				});
			case "text":
			case "list":
			default:
				return groupKeys.sort((a, b) => a == null ? 1 : b == null ? -1 : a.localeCompare(b));
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
		const fields = this.plugin?.settings?.userFields || [];
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
			this.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("file-added", () => {
			this.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("file-deleted", () => {
			this.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("file-renamed", () => {
			this.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});

		this.cacheManager.on("indexes-built", () => {
			this.clearIndexQueryCache();
			this.checkAndInvalidateFilterOptionsCache();
			this.emit("data-changed");
		});
	}

	/**
	 * Clean up event subscriptions and clear any caches
	 */
	cleanup(): void {
		// Clear query result cache and timers
		this.clearIndexQueryCache();

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

		const tasksForDate = filteredTasks.filter((task) => {
			// Handle recurring tasks
			if (task.recurrence) {
				// Use UTC Anchor principle: convert date string to UTC date for consistent recurring task evaluation
				const utcDateForRecurrence = parseDateToUTC(dateStr);
				return isDueByRRule(task, utcDateForRecurrence);
			}

			// Handle regular tasks with due dates for this specific date
			// Use robust date comparison to handle timezone edge cases
			if (task.due) {
				const taskDueDatePart = getDatePart(task.due);
				if (taskDueDatePart === dateStr) {
					return true;
				}
			}

			// Handle regular tasks with scheduled dates for this specific date
			// Use robust date comparison to handle timezone edge cases
			if (task.scheduled) {
				const taskScheduledDatePart = getDatePart(task.scheduled);
				if (taskScheduledDatePart === dateStr) {
					return true;
				}
			}

			// If showing overdue tasks and this is today, include overdue tasks on today
			if (includeOverdue && isViewingToday) {
				const isCompleted = this.statusManager.isCompletedStatus(task.status);
				const hideCompletedFromOverdue =
					this.plugin?.settings?.hideCompletedFromOverdue ?? true;

				// Check if due date is overdue (show on today)
				if (task.due && getDatePart(task.due) !== dateStr) {
					if (isOverdueTimeAware(task.due, isCompleted, hideCompletedFromOverdue)) {
						return true;
					}
				}

				// Check if scheduled date is overdue (show on today)
				if (task.scheduled && getDatePart(task.scheduled) !== dateStr) {
					if (isOverdueTimeAware(task.scheduled, isCompleted, hideCompletedFromOverdue)) {
						return true;
					}
				}
			}

			return false;
		});

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

		const overdueTasks = filteredTasks.filter((task) => {
			const isCompleted = this.statusManager.isCompletedStatus(task.status);
			const hideCompletedFromOverdue =
				this.plugin?.settings?.hideCompletedFromOverdue ?? true;

			// For recurring tasks, check if the current scheduled date is overdue
			if (task.recurrence) {
				// For recurring tasks, check scheduled date (current instance)
				// Also check due date if it exists (user may set both)
				if (task.due) {
					if (isOverdueTimeAware(task.due, isCompleted, hideCompletedFromOverdue)) {
						return true;
					}
				}
				if (task.scheduled) {
					if (isOverdueTimeAware(task.scheduled, isCompleted, hideCompletedFromOverdue)) {
						return true;
					}
				}
				return false;
			}

			// For non-recurring tasks, check both due and scheduled dates
			// Check if due date is overdue
			if (task.due) {
				if (isOverdueTimeAware(task.due, isCompleted, hideCompletedFromOverdue)) {
					return true;
				}
			}

			// Check if scheduled date is overdue
			if (task.scheduled) {
				if (isOverdueTimeAware(task.scheduled, isCompleted, hideCompletedFromOverdue)) {
					return true;
				}
			}

			return false;
		});

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
