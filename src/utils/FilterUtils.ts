import { FilterOperator, FilterProperty, FilterCondition, FilterGroup, TaskInfo } from "../types";
import {
	isBeforeDateTimeAware,
	getDatePart,
	isSameDateSafe,
	resolveNaturalLanguageDate,
	isNaturalLanguageDate,
} from "./dateUtils";

/**
 * Error types for filter operations
 */
export class FilterValidationError extends Error {
	constructor(
		message: string,
		public readonly field?: string,
		public readonly nodeId?: string
	) {
		super(message);
		this.name = "FilterValidationError";
	}
}

export class FilterEvaluationError extends Error {
	constructor(
		message: string,
		public readonly nodeId?: string
	) {
		super(message);
		this.name = "FilterEvaluationError";
	}
}

/**
 * Type-safe task property value
 */
export type TaskPropertyValue = string | string[] | number | boolean | null | undefined;

/**
 * Utility class for filter operations
 */
export class FilterUtils {
	private static idCounter = 0;

	/**
	 * Generate a unique ID for filter nodes
	 */
	static generateId(): string {
		return `filter_${Date.now()}_${++this.idCounter}`;
	}

	/**
	 * Deep clone a FilterQuery to prevent shared object references
	 * This is essential for saved views to avoid overwriting each other
	 */
	static deepCloneFilterQuery(query: FilterGroup): FilterGroup {
		return JSON.parse(JSON.stringify(query));
	}

	/**
	 * Validate a filter node (group or condition)
	 */
	static validateFilterNode(node: FilterGroup | FilterCondition, strict = true): void {
		if (!node || typeof node !== "object") {
			throw new FilterValidationError("Filter node must be an object");
		}

		if (!("id" in node) || !node.id || typeof node.id !== "string") {
			throw new FilterValidationError(
				"Filter node must have a valid string ID",
				undefined,
				"id" in node ? String(node.id) : "unknown"
			);
		}

		if (node.type === "condition") {
			this.validateCondition(node, strict);
		} else if (node.type === "group") {
			this.validateGroup(node, strict);
		} else {
			throw new FilterValidationError(
				`Unknown filter node type: ${(node as any).type}`,
				undefined,
				(node as any).id
			);
		}
	}

	/**
	 * Validate a filter condition
	 */
	private static validateCondition(condition: FilterCondition, strict = true): void {
		if (typeof condition.property !== "string") {
			throw new FilterValidationError(
				"Condition must have a valid property",
				"property",
				condition.id
			);
		}

		// In strict mode, empty property (placeholder) should be invalid
		if (strict && condition.property === "") {
			throw new FilterValidationError("Property must be selected", "property", condition.id);
		}

		// Non-empty property is required for further validation
		if (condition.property === "") {
			return; // Skip further validation for placeholder
		}

		if (!condition.operator || typeof condition.operator !== "string") {
			throw new FilterValidationError(
				"Condition must have a valid operator",
				"operator",
				condition.id
			);
		}

		// Validate that operator is supported for the property
		const validOperators = this.getValidOperatorsForProperty(
			condition.property as FilterProperty
		);
		if (!validOperators.includes(condition.operator as FilterOperator)) {
			throw new FilterValidationError(
				`Operator '${condition.operator}' is not valid for property '${condition.property}'`,
				"operator",
				condition.id
			);
		}

		// Validate value based on operator requirements
		// In non-strict mode, skip value validation to allow incomplete conditions during filter building
		if (strict) {
			const requiresValue = this.operatorRequiresValue(condition.operator as FilterOperator);
			if (
				requiresValue &&
				(condition.value === null ||
					condition.value === undefined ||
					condition.value === "")
			) {
				throw new FilterValidationError(
					`Operator '${condition.operator}' requires a value`,
					"value",
					condition.id
				);
			}
		}
	}

	/**
	 * Validate a filter group
	 */
	private static validateGroup(group: FilterGroup, strict = true): void {
		if (!group.conjunction || !["and", "or"].includes(group.conjunction)) {
			throw new FilterValidationError(
				"Group must have a valid conjunction (and/or)",
				"conjunction",
				group.id
			);
		}

		if (!Array.isArray(group.children)) {
			throw new FilterValidationError(
				"Group must have a children array",
				"children",
				group.id
			);
		}

		// Recursively validate children
		group.children.forEach((child, index) => {
			try {
				this.validateFilterNode(child, strict);
			} catch (error) {
				if (error instanceof FilterValidationError) {
					throw new FilterValidationError(
						`Child ${index}: ${error.message}`,
						error.field,
						group.id
					);
				}
				throw error;
			}
		});
	}

	/**
	 * Get valid operators for a property
	 */
	private static getValidOperatorsForProperty(property: FilterProperty): FilterOperator[] {
		// Dynamic user-mapped properties: allow full operator set; UI constrains per-field type
		if (typeof property === "string" && property.startsWith("user:")) {
			return [
				"is",
				"is-not",
				"contains",
				"does-not-contain",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
				"is-checked",
				"is-not-checked",
				"is-greater-than",
				"is-less-than",
				"is-greater-than-or-equal",
				"is-less-than-or-equal",
			];
		}

		const operatorMap: Record<FilterProperty, FilterOperator[]> = {
			// Placeholder property (no valid operators)
			"": [],

			// Text properties
			title: ["is", "is-not", "contains", "does-not-contain", "is-empty", "is-not-empty"],
			path: ["contains", "does-not-contain", "is-empty", "is-not-empty"],

			// Select properties
			status: ["is", "is-not", "is-empty", "is-not-empty"],
			priority: ["is", "is-not", "is-empty", "is-not-empty"],
			tags: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
			contexts: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
			projects: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
			blockedBy: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
			blocking: ["contains", "does-not-contain", "is-empty", "is-not-empty"],

			// Date properties
			due: [
				"is",
				"is-not",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
			],
			scheduled: [
				"is",
				"is-not",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
			],
			completedDate: [
				"is",
				"is-not",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
			],
			"file.ctime": [
				"is",
				"is-not",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
			],
			"file.mtime": [
				"is",
				"is-not",
				"is-before",
				"is-after",
				"is-on-or-before",
				"is-on-or-after",
				"is-empty",
				"is-not-empty",
			],

			// Boolean properties
			archived: ["is-checked", "is-not-checked"],
			"dependencies.isBlocked": ["is-checked", "is-not-checked"],
			"dependencies.isBlocking": ["is-checked", "is-not-checked"],

			// Numeric properties
			timeEstimate: [
				"is",
				"is-not",
				"is-greater-than",
				"is-less-than",
				"is-greater-than-or-equal",
				"is-less-than-or-equal",
			],

			// Special properties
			recurrence: ["is-empty", "is-not-empty"],
			"status.isCompleted": ["is-checked", "is-not-checked"],
		};

		return operatorMap[property] || [];
	}

	/**
	 * Check if a filter node is complete (has all required values)
	 */
	static isFilterNodeComplete(node: FilterGroup | FilterCondition): boolean {
		try {
			this.validateFilterNode(node, true); // Use strict validation
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Check if an operator requires a value
	 */
	private static operatorRequiresValue(operator: FilterOperator): boolean {
		const noValueOperators: FilterOperator[] = [
			"is-empty",
			"is-not-empty",
			"is-checked",
			"is-not-checked",
		];
		return !noValueOperators.includes(operator);
	}

	/**
	 * Get the value of a specific property from a task with type safety
	 */
	static getTaskPropertyValue(task: TaskInfo, property: FilterProperty): TaskPropertyValue {
		switch (property) {
			case "title":
				return task.title;
			case "path":
				return task.path;
			case "status":
				return task.status;
			case "priority":
				return task.priority;
			case "tags":
				return task.tags || [];
			case "contexts":
				return task.contexts || [];
			case "projects":
				return task.projects || [];
			case "blockedBy":
				return task.blockedBy?.map((dependency) => dependency.uid) || [];
			case "blocking":
				return task.blocking || [];
			case "due":
				return task.due;
			case "scheduled":
				return task.scheduled;
			case "completedDate":
				return task.completedDate;
			case "file.ctime":
				return task.dateCreated;
			case "file.mtime":
				return task.dateModified;
			case "archived":
				return task.archived;
			case "timeEstimate":
				return task.timeEstimate;
			case "recurrence":
				return task.recurrence as TaskPropertyValue;
			case "status.isCompleted":
				// This requires StatusManager - will be handled by caller
				return undefined;
			case "dependencies.isBlocked":
				return task.isBlocked === true;
			case "dependencies.isBlocking":
				return task.isBlocking === true;
			default:
				throw new FilterEvaluationError(`Unknown property: ${property}`);
		}
	}

	/**
	 * Apply a filter operator to compare task value with condition value
	 */
	static applyOperator(
		taskValue: TaskPropertyValue,
		operator: FilterOperator,
		conditionValue: TaskPropertyValue,
		nodeId?: string,
		property?: FilterProperty
	): boolean {
		try {
			switch (operator) {
				case "is":
					return this.isEqual(taskValue, conditionValue, property);
				case "is-not":
					return !this.isEqual(taskValue, conditionValue, property);
				case "contains":
					return this.contains(taskValue, conditionValue, property);
				case "does-not-contain":
					return !this.contains(taskValue, conditionValue, property);
				case "is-before":
					return this.isBefore(taskValue, conditionValue);
				case "is-after":
					return this.isAfter(taskValue, conditionValue);
				case "is-on-or-before":
					return this.isOnOrBefore(taskValue, conditionValue);
				case "is-on-or-after":
					return this.isOnOrAfter(taskValue, conditionValue);
				case "is-empty":
					return this.isEmpty(taskValue);
				case "is-not-empty":
					return !this.isEmpty(taskValue);
				case "is-checked":
					return taskValue === true;
				case "is-not-checked":
					return taskValue !== true;
				case "is-greater-than":
					return this.isGreaterThan(taskValue, conditionValue);
				case "is-less-than":
					return this.isLessThan(taskValue, conditionValue);
				case "is-greater-than-or-equal":
					return this.isGreaterThanOrEqual(taskValue, conditionValue);
				case "is-less-than-or-equal":
					return this.isLessThanOrEqual(taskValue, conditionValue);
				default:
					throw new FilterEvaluationError(`Unknown operator: ${operator}`, nodeId);
			}
		} catch (error) {
			if (error instanceof FilterEvaluationError) {
				throw error;
			}
			throw new FilterEvaluationError(
				`Error applying operator '${operator}': ${error.message}`,
				nodeId
			);
		}
	}

	/**
	 * Equality comparison that handles arrays and different value types
	 */
	private static isEqual(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue,
		property?: FilterProperty
	): boolean {
		// Handle date properties with natural language date resolution
		if (
			property &&
			this.isDateProperty(property) &&
			typeof taskValue === "string" &&
			typeof conditionValue === "string" &&
			(taskValue || isNaturalLanguageDate(conditionValue))
		) {
			return this.isEqualDate(taskValue, conditionValue);
		}

		if (Array.isArray(taskValue)) {
			if (Array.isArray(conditionValue)) {
				// Both arrays: check if any task value matches any condition value
				return taskValue.some((tv) => conditionValue.includes(tv));
			} else {
				// Task has array, condition is single value
				return taskValue.includes(conditionValue as string);
			}
		} else {
			if (Array.isArray(conditionValue)) {
				// Task has single value, condition is array
				return conditionValue.includes(taskValue as string);
			} else {
				// Both single values
				return taskValue === conditionValue;
			}
		}
	}

	/**
	 * Check if a tag matches another tag using hierarchical matching rules with substring fallback.
	 * Supports Obsidian nested tags where 't/ef' matches 't/ef/project', 't/ef/task', etc.
	 * Also supports substring matching for backward compatibility.
	 * This function only handles positive matching - exclusion logic is handled by callers.
	 *
	 * @param taskTag - The tag from the task (e.g., 't/ef/project')
	 * @param conditionTag - The condition tag without hyphen prefix (e.g., 't/ef')
	 * @returns true if the tag matches according to hierarchical rules or substring matching
	 */
	static matchesHierarchicalTag(taskTag: string, conditionTag: string): boolean {
		if (!taskTag || !conditionTag) return false;

		const taskTagLower = taskTag.toLowerCase();
		const conditionTagLower = conditionTag.toLowerCase();

		// Exact match
		if (taskTagLower === conditionTagLower) {
			return true;
		}

		// Check if taskTag is a child of conditionTag
		// 't/ef/project' should match when searching for 't/ef'
		if (taskTagLower.startsWith(conditionTagLower + '/')) {
			return true; // Hierarchical child match
		}

		// Fallback to substring matching for backward compatibility
		// This allows 'proj' to match 'project/alpha' and 'urgent' to match 'priority/urgent'
		if (taskTagLower.includes(conditionTagLower)) {
			return true; // Substring match
		}

		return false;
	}

	/**
	 * Check if a tag matches another tag using only hierarchical matching rules.
	 * Supports Obsidian nested tags where 't/ef' matches 't/ef/project', 't/ef/task', etc.
	 * Does NOT include substring matching fallback - use this for task identification
	 * to prevent false positives like "pkm-task" matching "task".
	 *
	 * @param taskTag - The tag from the task (e.g., 't/ef/project')
	 * @param conditionTag - The condition tag without hyphen prefix (e.g., 't/ef')
	 * @returns true if the tag matches according to hierarchical rules only
	 */
	static matchesHierarchicalTagExact(taskTag: string, conditionTag: string): boolean {
		if (!taskTag || !conditionTag) return false;

		const taskTagLower = taskTag.toLowerCase();
		const conditionTagLower = conditionTag.toLowerCase();

		// Exact match
		if (taskTagLower === conditionTagLower) {
			return true;
		}

		// Check if taskTag is a child of conditionTag
		// 't/ef/project' should match when searching for 't/ef'
		if (taskTagLower.startsWith(conditionTagLower + '/')) {
			return true; // Hierarchical child match
		}

		return false;
	}

	/**
	 * Enhanced tag matching that supports both inclusion and exclusion patterns.
	 * Handles arrays of tag conditions with proper exclusion semantics.
	 *
	 * @param taskTags - Array of tags from the task
	 * @param conditionTags - Array of condition tags (may include '-' prefix for exclusions)
	 * @returns true if task tags match the conditions (all inclusions met, no exclusions found)
	 */
	static matchesTagConditions(taskTags: string[], conditionTags: string[]): boolean {
		if (!Array.isArray(taskTags) || !Array.isArray(conditionTags)) return false;
		if (conditionTags.length === 0) return true; // No conditions means match

		const inclusions: string[] = [];
		const exclusions: string[] = [];

		// Separate inclusion and exclusion patterns
		for (const condTag of conditionTags) {
			if (typeof condTag === 'string' && condTag.startsWith('-')) {
				const excludePattern = condTag.slice(1);
				if (excludePattern) {
					exclusions.push(excludePattern);
				}
			} else if (typeof condTag === 'string') {
				inclusions.push(condTag);
			}
		}

		// Check exclusions first - if any excluded tag is found, reject
		for (const excludePattern of exclusions) {
			const hasExcludedTag = taskTags.some(taskTag =>
				this.matchesHierarchicalTag(taskTag, excludePattern)
			);
			if (hasExcludedTag) {
				return false; // Excluded tag found
			}
		}

		// If there are inclusion patterns, at least one must match
		if (inclusions.length > 0) {
			return inclusions.some(includePattern =>
				taskTags.some(taskTag =>
					this.matchesHierarchicalTag(taskTag, includePattern)
				)
			);
		}

		// If only exclusions were specified and none matched, include the item
		return true;
	}

	/**
	 * Enhanced contains comparison for text and arrays with hierarchical tag support
	 */
	private static contains(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue,
		property?: FilterProperty
	): boolean {
		if (Array.isArray(taskValue)) {
			// Array contains should be substring-based on each item when condition is string
			if (Array.isArray(conditionValue)) {
				// Any condition token partially matches any haystack token
				if (property === "tags") {
					// Use hierarchical tag matching for tags with proper exclusion handling
					const taskTags = taskValue.filter((tv): tv is string => typeof tv === "string");
					const condTags = conditionValue.filter((cv): cv is string => typeof cv === "string");
					return FilterUtils.matchesTagConditions(taskTags, condTags);
				} else {
					// Use default substring matching for other properties
					return conditionValue.some((cv) =>
						taskValue.some(
							(tv) =>
								typeof tv === "string" &&
								typeof cv === "string" &&
								tv.toLowerCase().includes(cv.toLowerCase())
						)
					);
				}
			} else {
				const cond =
					typeof conditionValue === "string"
						? conditionValue
						: String(conditionValue ?? "");
				if (property === "tags") {
					// Use hierarchical tag matching for tags with proper exclusion handling
					const taskTags = taskValue.filter((tv): tv is string => typeof tv === "string");
					return FilterUtils.matchesTagConditions(taskTags, [cond]);
				} else {
					// Use default substring matching for other properties
					const condLower = cond.toLowerCase();
					return taskValue.some(
						(tv) => typeof tv === "string" && tv.toLowerCase().includes(condLower)
					);
				}
			}
		} else if (typeof taskValue === "string") {
			if (Array.isArray(conditionValue)) {
				// Task has string, condition is array
				if (property === "tags") {
					// Use hierarchical tag matching for tags with proper exclusion handling
					const condTags = conditionValue.filter((cv): cv is string => typeof cv === "string");
					return FilterUtils.matchesTagConditions([taskValue], condTags);
				} else {
					// Use default substring matching for other properties
					return conditionValue.some(
						(cv) =>
							typeof cv === "string" && taskValue.toLowerCase().includes(cv.toLowerCase())
					);
				}
			} else {
				// Both strings
				if (property === "tags" && typeof conditionValue === "string") {
					// Use hierarchical tag matching for tags with proper exclusion handling
					return FilterUtils.matchesTagConditions([taskValue], [conditionValue]);
				} else {
					// Use default substring matching for other properties
					return (
						typeof conditionValue === "string" &&
						taskValue.toLowerCase().includes(conditionValue.toLowerCase())
					);
				}
			}
		}
		return false;
	}

	/**
	 * Date comparison: is task value before condition value
	 */
	private static isBefore(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		if (!taskValue || !conditionValue) return false;
		try {
			const resolvedConditionValue = resolveNaturalLanguageDate(conditionValue as string);
			return isBeforeDateTimeAware(taskValue as string, resolvedConditionValue);
		} catch {
			return false;
		}
	}

	/**
	 * Date comparison: is task value after condition value
	 */
	private static isAfter(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		if (!taskValue || !conditionValue) return false;
		try {
			const resolvedConditionValue = resolveNaturalLanguageDate(conditionValue as string);
			return isBeforeDateTimeAware(resolvedConditionValue, taskValue as string);
		} catch {
			return false;
		}
	}

	/**
	 * Date comparison: is task value on or before condition value
	 */
	private static isOnOrBefore(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		if (!taskValue || !conditionValue) return false;
		try {
			const resolvedConditionValue = resolveNaturalLanguageDate(conditionValue as string);
			return (
				isBeforeDateTimeAware(taskValue as string, resolvedConditionValue) ||
				isSameDateSafe(
					getDatePart(taskValue as string),
					getDatePart(resolvedConditionValue)
				)
			);
		} catch {
			return false;
		}
	}

	/**
	 * Date comparison: is task value on or after condition value
	 */
	private static isOnOrAfter(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		if (!taskValue || !conditionValue) return false;
		try {
			const resolvedConditionValue = resolveNaturalLanguageDate(conditionValue as string);
			return (
				isBeforeDateTimeAware(resolvedConditionValue, taskValue as string) ||
				isSameDateSafe(
					getDatePart(taskValue as string),
					getDatePart(resolvedConditionValue)
				)
			);
		} catch {
			return false;
		}
	}

	/**
	 * Check if a property is a date property
	 */
	private static isDateProperty(property: FilterProperty): boolean {
		const dateProperties: FilterProperty[] = [
			"due",
			"scheduled",
			"completedDate",
			"file.ctime",
			"file.mtime",
		];
		return dateProperties.includes(property);
	}

	/**
	 * Handle date equality comparison with natural language date resolution
	 */
	private static isEqualDate(taskValue: string, conditionValue: string): boolean {
		try {
			const resolvedConditionValue = resolveNaturalLanguageDate(conditionValue);
			// For date equality, we compare the date parts only (not time)
			return isSameDateSafe(getDatePart(taskValue), getDatePart(resolvedConditionValue));
		} catch {
			return false;
		}
	}

	/**
	 * Check if value is empty (null, undefined, empty string, empty array, or array with only empty/whitespace strings)
	 */
	private static isEmpty(value: TaskPropertyValue): boolean {
		if (value === null || value === undefined) return true;
		if (typeof value === "string") return value.trim() === "";
		if (Array.isArray(value)) {
			// Check if array is empty
			if (value.length === 0) return true;

			// Check if array contains only empty/whitespace strings
			return value.every((item) => {
				if (typeof item !== "string") return false;
				const trimmed = item.trim();
				return trimmed.length === 0 || trimmed === '""' || trimmed === "''";
			});
		}
		return false;
	}

	/**
	 * Numeric comparison: is task value greater than condition value
	 */
	private static isGreaterThan(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		const taskNum = typeof taskValue === "number" ? taskValue : parseFloat(taskValue as string);
		const conditionNum =
			typeof conditionValue === "number"
				? conditionValue
				: parseFloat(conditionValue as string);
		if (isNaN(taskNum) || isNaN(conditionNum)) return false;
		return taskNum > conditionNum;
	}

	/**
	 * Numeric comparison: is task value less than condition value
	 */
	private static isLessThan(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		const taskNum = typeof taskValue === "number" ? taskValue : parseFloat(taskValue as string);
		const conditionNum =
			typeof conditionValue === "number"
				? conditionValue
				: parseFloat(conditionValue as string);
		if (isNaN(taskNum) || isNaN(conditionNum)) return false;
		return taskNum < conditionNum;
	}

	/**
	 * Numeric comparison: is task value greater than or equal to condition value
	 */
	private static isGreaterThanOrEqual(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		const taskNum = typeof taskValue === "number" ? taskValue : parseFloat(taskValue as string);
		const conditionNum =
			typeof conditionValue === "number"
				? conditionValue
				: parseFloat(conditionValue as string);
		if (isNaN(taskNum) || isNaN(conditionNum)) return false;
		return taskNum >= conditionNum;
	}

	/**
	 * Numeric comparison: is task value less than or equal to condition value
	 */
	private static isLessThanOrEqual(
		taskValue: TaskPropertyValue,
		conditionValue: TaskPropertyValue
	): boolean {
		const taskNum = typeof taskValue === "number" ? taskValue : parseFloat(taskValue as string);
		const conditionNum =
			typeof conditionValue === "number"
				? conditionValue
				: parseFloat(conditionValue as string);
		if (isNaN(taskNum) || isNaN(conditionNum)) return false;
		return taskNum <= conditionNum;
	}
}
