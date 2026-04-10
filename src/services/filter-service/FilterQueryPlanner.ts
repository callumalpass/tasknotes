import { TaskManager } from "../../utils/TaskManager";
import { FilterCondition, FilterQuery } from "../../types";

export interface FilterQueryPlannerDependencies {
	cacheManager: TaskManager;
}

export class FilterQueryPlanner {
	private readonly indexQueryCache = new Map<string, Set<string>>();
	private readonly cacheTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly cacheTimeout = 30000;

	constructor(private deps: FilterQueryPlannerDependencies) {}

	getIndexOptimizedTaskPaths(query: FilterQuery): Set<string> {
		const optimizationAnalysis = this.analyzeQueryOptimizationSafety(query);

		if (!optimizationAnalysis.canOptimize) {
			return this.deps.cacheManager.getAllTaskPaths();
		}

		if (optimizationAnalysis.strategy === "intersect") {
			let candidatePaths = this.getPathsForIndexableCondition(optimizationAnalysis.conditions[0]);
			for (let i = 1; i < optimizationAnalysis.conditions.length; i++) {
				const conditionPaths = this.getPathsForIndexableCondition(
					optimizationAnalysis.conditions[i]
				);
				candidatePaths = this.intersectPathSets(candidatePaths, conditionPaths);
			}
			return candidatePaths;
		}

		if (optimizationAnalysis.strategy === "single") {
			return this.getPathsForIndexableCondition(optimizationAnalysis.conditions[0]);
		}

		return this.deps.cacheManager.getAllTaskPaths();
	}

	clearIndexQueryCache(): void {
		for (const timer of this.cacheTimers.values()) {
			clearTimeout(timer);
		}
		this.indexQueryCache.clear();
		this.cacheTimers.clear();
	}

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

	private analyzeQueryOptimizationSafety(query: FilterQuery): {
		canOptimize: boolean;
		strategy?: "intersect" | "single";
		conditions: FilterCondition[];
		reason?: string;
	} {
		const indexableConditions = this.findIndexableConditions(query);

		if (indexableConditions.length === 0) {
			return {
				canOptimize: false,
				conditions: [],
				reason: "No indexable conditions found",
			};
		}

		if (this.isSimpleQuery(query, indexableConditions)) {
			return {
				canOptimize: true,
				strategy: indexableConditions.length === 1 ? "single" : "intersect",
				conditions: indexableConditions,
			};
		}

		return {
			canOptimize: false,
			conditions: indexableConditions,
			reason: "Complex query structure with OR conditions - optimization not safe",
		};
	}

	private isSimpleQuery(query: FilterQuery, indexableConditions: FilterCondition[]): boolean {
		if (indexableConditions.length === 0) {
			return false;
		}

		if (this.hasIndexableConditionInOrGroup(query, indexableConditions)) {
			return false;
		}

		if (indexableConditions.length === 1) {
			return true;
		}

		if (query.type === "group" && query.conjunction === "and") {
			const rootIndexableConditions = query.children.filter(
				(child) => child.type === "condition" && this.isIndexableCondition(child)
			);
			if (rootIndexableConditions.length === indexableConditions.length) {
				return true;
			}
		}

		return false;
	}

	private hasIndexableConditionInOrGroup(
		query: FilterQuery,
		indexableConditions: FilterCondition[]
	): boolean {
		return this.checkNodeForOrWithIndexable(query, indexableConditions);
	}

	private checkNodeForOrWithIndexable(
		node: FilterQuery | FilterCondition,
		indexableConditions: FilterCondition[]
	): boolean {
		if (node.type === "condition") {
			return false;
		}

		if (node.type === "group") {
			if (node.conjunction === "or") {
				const hasIndexableChild = node.children.some(
					(child) => child.type === "condition" && indexableConditions.includes(child)
				);
				if (hasIndexableChild) {
					return true;
				}
			}

			for (const child of node.children) {
				if (this.checkNodeForOrWithIndexable(child, indexableConditions)) {
					return true;
				}
			}
		}

		return false;
	}

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

	private isIndexableCondition(condition: FilterCondition): boolean {
		const { property, operator, value } = condition;

		if (property === "status" && operator === "is" && value) {
			return true;
		}
		if (
			property === "due" &&
			(operator === "is" || operator === "is-before" || operator === "is-after") &&
			value
		) {
			return true;
		}
		if (
			property === "scheduled" &&
			(operator === "is" || operator === "is-before" || operator === "is-after") &&
			value
		) {
			return true;
		}

		return false;
	}

	private getCachedIndexResult(cacheKey: string, computer: () => Set<string>): Set<string> {
		const cached = this.indexQueryCache.get(cacheKey);
		if (cached) {
			return new Set(cached);
		}

		const result = computer();
		this.indexQueryCache.set(cacheKey, new Set(result));

		const existingTimer = this.cacheTimers.get(cacheKey);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			this.indexQueryCache.delete(cacheKey);
			this.cacheTimers.delete(cacheKey);
		}, this.cacheTimeout);

		this.cacheTimers.set(cacheKey, timer);
		return result;
	}

	private getPathsForIndexableCondition(condition: FilterCondition): Set<string> {
		const { property, operator, value } = condition;
		const cacheKey = `${property}:${operator}:${value}`;

		return this.getCachedIndexResult(cacheKey, () => {
			if (property === "status" && operator === "is" && value && typeof value === "string") {
				return new Set(this.deps.cacheManager.getTaskPathsByStatus(value));
			}

			if (
				(property === "due" || property === "scheduled") &&
				operator === "is" &&
				value &&
				typeof value === "string"
			) {
				return new Set(this.deps.cacheManager.getTasksForDate(value));
			}

			if (
				(property === "due" || property === "scheduled") &&
				(operator === "is-before" || operator === "is-after") &&
				value &&
				typeof value === "string"
			) {
				return this.getTaskPathsForDateRange(property, operator, value);
			}

			return this.deps.cacheManager.getAllTaskPaths();
		});
	}

	private getTaskPathsForDateRange(
		_property: string,
		_operator: string,
		_value: string
	): Set<string> {
		return this.deps.cacheManager.getAllTaskPaths();
	}

	private intersectPathSets(set1: Set<string>, set2: Set<string>): Set<string> {
		const intersection = new Set<string>();
		for (const path of set1) {
			if (set2.has(path)) {
				intersection.add(path);
			}
		}
		return intersection;
	}
}
