import {
	FilterQuery,
	FilterGroup,
	FilterCondition,
	FilterNode,
	FilterProperty,
	FilterOperator,
} from "../types";
import { StatusManager } from "./StatusManager";
import { PriorityManager } from "./PriorityManager";
import type TaskNotesPlugin from "../main";
import type { UserMappedField } from "../types/settings";

/**
 * Converts TaskNotes FilterQuery structures to Bases filter expressions
 *
 * Bases uses a functional expression syntax like:
 * - note.property == "value"
 * - note.property.contains("value")
 * - note.property && note.property !== ""
 * - (condition1 && condition2) || condition3
 *
 * TaskNotes FilterQuery uses a tree structure with FilterGroups and FilterConditions
 */
export class BasesFilterConverter {
	private statusManager: StatusManager;
	private priorityManager: PriorityManager;
	private plugin: TaskNotesPlugin;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
		this.statusManager = plugin.statusManager;
		this.priorityManager = plugin.priorityManager;
	}

	/**
	 * Convert a TaskNotes FilterQuery to a Bases filter expression (object notation)
	 */
	convertToBasesFilter(query: FilterQuery): any {
		try {
			// Convert to object notation for YAML
			const filterObject = this.convertNodeToObject(query);

			// If the filter is empty, return empty object
			if (!filterObject) {
				return null;
			}

			return filterObject;
		} catch (error) {
			console.error("Error converting TaskNotes filter to Bases:", error);
			throw new Error(`Failed to convert filter: ${error.message}`);
		}
	}

	/**
	 * Convert a FilterNode to Bases object notation
	 */
	private convertNodeToObject(node: FilterNode): any {
		if (node.type == "group") {
			return this.convertGroupToObject(node as FilterGroup);
		} else if (node.type == "condition") {
			return this.convertConditionToString(node as FilterCondition);
		}
		return null;
	}

	/**
	 * Convert a FilterGroup to Bases object notation
	 */
	private convertGroupToObject(group: FilterGroup): any {
		// Filter out incomplete conditions
		const completeChildren = group.children.filter((child) => {
			if (child.type == "condition") {
				return this.isConditionComplete(child as FilterCondition);
			}
			return true; // Groups are always evaluated
		});

		// If no complete children, return null
		if (completeChildren.length == 0) {
			return null;
		}

		// Convert each child
		const childObjects = completeChildren
			.map((child) => this.convertNodeToObject(child))
			.filter((obj) => obj !== null);

		// If no valid expressions, return null
		if (childObjects.length == 0) {
			return null;
		}

		// If only one expression, return it directly
		if (childObjects.length === 1) {
			return childObjects[0];
		}

		// Return object notation with and/or key
		const key = group.conjunction == "and" ? "and" : "or";
		return { [key]: childObjects };
	}

	/**
	 * Convert a FilterCondition to a string expression
	 */
	private convertConditionToString(condition: FilterCondition): string {
		const { property, operator, value } = condition;

		// Handle special property: status.isCompleted
		if (property == "status.isCompleted") {
			return this.convertCompletedStatusCondition(operator, value);
		}

		// Handle special property: archived (boolean based on tag presence)
		if (property == "archived") {
			return this.convertArchivedCondition(operator);
		}

		// Handle special property: dependencies.isBlocked (boolean expression)
		if (property == "dependencies.isBlocked") {
			return this.convertIsBlockedCondition(operator);
		}

		// Handle user-defined fields (user:<id>)
		if (property.startsWith("user:")) {
			return this.convertUserFieldCondition(property, operator, value);
		}

		// Get the Bases property path (note.property)
		const basesProperty = this.getBasesPropertyPath(property);

		// Convert based on operator
		return this.convertOperator(basesProperty, operator, value, property);
	}


	/**
	 * Check if a condition is complete (has property, operator, and value if needed)
	 */
	private isConditionComplete(condition: FilterCondition): boolean {
		const { property, operator, value } = condition;

		// Must have property and operator
		if (!property || !operator) {
			return false;
		}

		// Some operators don't need a value (is-empty, is-not-empty, is-checked, is-not-checked)
		const noValueOperators = ["is-empty", "is-not-empty", "is-checked", "is-not-checked"];
		if (noValueOperators.includes(operator)) {
			return true;
		}

		// For other operators, value is required
		return value !== null && value !== undefined && value !== "";
	}


	/**
	 * Convert status.isCompleted to Bases expression
	 * This needs to expand to check against all completed statuses and handle recurring tasks
	 */
	private convertCompletedStatusCondition(operator: FilterOperator, value: any): string {
		const completedStatusValues = this.statusManager.getCompletedStatuses();
		const fm = this.plugin.fieldMapper;

		// Build expression checking if status is in completed list
		// Use field-mapped property name to support custom status property names
		const statusProp = fm.toUserField("status");
		const statusConditions = completedStatusValues
			.map((statusValue) => `note.${statusProp} == "${this.escapeString(statusValue)}"`)
			.join(" || ");

		// Build status check expression
		let statusExpression = completedStatusValues.length > 1
			? `(${statusConditions})`
			: statusConditions;

		// For recurring tasks, also check if today's date is in complete_instances array
		// Use list.map() to convert dates to formatted strings, then check with contains()
		const completeInstancesProp = fm.toUserField("completeInstances");
		const completedInstancesCheck = `note.${completeInstancesProp} && note.${completeInstancesProp}.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD"))`;

		// Combine both conditions: status is completed OR today is in complete_instances
		const combinedExpression = `(${statusExpression}) || (${completedInstancesCheck})`;

		// Handle operator - wrap in parentheses when negating to ensure proper precedence
		if (operator == "is-not-checked" || operator == "is-not") {
			return `!(${combinedExpression})`;
		}

		return combinedExpression;
	}

	/**
	 * Convert archived property to Bases expression
	 * Archived is a boolean property based on whether the task has the archive tag
	 */
	private convertArchivedCondition(operator: FilterOperator): string {
		const fm = this.plugin.fieldMapper;
		const archiveTag = fm.toUserField("archiveTag");
		const archivedExpression = `file.tags.contains("${this.escapeString(archiveTag)}")`;

		// Handle operator - is-checked/is means archived, is-not-checked/is-not means not archived
		if (operator == "is-not-checked" || operator == "is-not") {
			return `!${archivedExpression}`;
		}

		return archivedExpression;
	}

	/**
	 * Convert dependencies.isBlocked to Bases expression
	 * A task is blocked if it has any entries in its blockedBy array
	 */
	private convertIsBlockedCondition(operator: FilterOperator): string {
		const fm = this.plugin.fieldMapper;
		const blockedByProp = fm.toUserField("blockedBy");
		const isBlockedExpression = `(note.${blockedByProp} && list(note.${blockedByProp}).length > 0)`;

		// Handle operator - is-checked/is means blocked, is-not-checked/is-not means not blocked
		if (operator == "is-not-checked" || operator == "is-not") {
			return `!(${isBlockedExpression})`;
		}

		return isBlockedExpression;
	}

	/**
	 * Convert user field condition to Bases expression
	 */
	private convertUserFieldCondition(
		property: string,
		operator: FilterOperator,
		value: any
	): string {
		const fieldId = property.slice(5); // Remove "user:" prefix
		const userFields = this.plugin.settings.userFields || [];
		const field = userFields.find((f: UserMappedField) =>
			(f.id || f.key) === fieldId || f.key === fieldId
		);

		if (!field) {
			console.warn(`User field not found: ${fieldId}`);
			return "true"; // Default to always true if field not found
		}

		// Use the frontmatter key for the property path
		const basesProperty = `note.${field.key}`;

		// Convert based on field type
		// Cast to FilterProperty since user fields are valid FilterProperty values (user:${string})
		return this.convertOperator(basesProperty, operator, value, property as FilterProperty, field.type);
	}

	/**
	 * Get the Bases property path for a TaskNotes property
	 */
	private getBasesPropertyPath(property: FilterProperty): string {
		// Get field mapper
		const fm = this.plugin.fieldMapper;

		// Map TaskNotes property to frontmatter key
		let frontmatterKey: string;

		switch (property) {
			case "title":
				return "file.name";
			case "status":
				frontmatterKey = fm.toUserField("status");
				break;
			case "priority":
				frontmatterKey = fm.toUserField("priority");
				break;
			case "due":
				frontmatterKey = fm.toUserField("due");
				break;
			case "scheduled":
				frontmatterKey = fm.toUserField("scheduled");
				break;
			case "contexts":
				frontmatterKey = fm.toUserField("contexts");
				break;
			case "projects":
				frontmatterKey = fm.toUserField("projects");
				break;
			case "tags":
				return "file.tags"; // Use file.tags for Bases
			case "path":
				return "file.path";
			case "dateCreated":
				return "file.ctime";
			case "dateModified":
				return "file.mtime";
			// Note: "archived" is handled specially in convertConditionToString
			case "timeEstimate":
				frontmatterKey = fm.toUserField("timeEstimate");
				break;
			case "completedDate":
				frontmatterKey = fm.toUserField("completedDate");
				break;
			case "recurrence":
				frontmatterKey = fm.toUserField("recurrence");
				break;
			case "blockedBy":
				frontmatterKey = fm.toUserField("blockedBy");
				break;
			case "blocking":
				frontmatterKey = "blocking"; // Computed property, not in field mapping
				break;
			// Note: "dependencies.isBlocked" is handled specially in convertConditionToString
			// Note: "dependencies.isBlocking" returns "true" (unsupported - requires reverse lookup)
			default:
				// Default to the property name (handles user fields and unknown properties)
				frontmatterKey = property as string;
		}

		return `note.${frontmatterKey}`;
	}

	/**
	 * Convert an operator and value to Bases expression
	 */
	private convertOperator(
		basesProperty: string,
		operator: FilterOperator,
		value: any,
		originalProperty: FilterProperty,
		fieldType?: string
	): string {
		switch (operator) {
			case "is":
				return this.convertIsOperator(basesProperty, value, fieldType);

			case "is-not":
				return `!(${this.convertIsOperator(basesProperty, value, fieldType)})`;

			case "contains":
				return this.convertContainsOperator(basesProperty, value, originalProperty);

			case "does-not-contain":
				return `!(${this.convertContainsOperator(basesProperty, value, originalProperty)})`;

			case "is-before":
				return `${basesProperty} < "${this.escapeString(String(value))}"`;

			case "is-after":
				return `${basesProperty} > "${this.escapeString(String(value))}"`;

			case "is-on-or-before":
				return `${basesProperty} <= "${this.escapeString(String(value))}"`;

			case "is-on-or-after":
				return `${basesProperty} >= "${this.escapeString(String(value))}"`;

			case "is-empty":
				return `${basesProperty}.isEmpty()`;

			case "is-not-empty":
				return `!${basesProperty}.isEmpty()`;

			case "is-checked":
				return `${basesProperty} == true`;

			case "is-not-checked":
				return `${basesProperty} != true`;

			case "is-greater-than":
				return `${basesProperty} > ${this.formatNumericValue(value)}`;

			case "is-less-than":
				return `${basesProperty} < ${this.formatNumericValue(value)}`;

			case "is-greater-than-or-equal":
				return `${basesProperty} >= ${this.formatNumericValue(value)}`;

			case "is-less-than-or-equal":
				return `${basesProperty} <= ${this.formatNumericValue(value)}`;

			default:
				console.warn(`Unknown operator: ${operator}`);
				return "true";
		}
	}

	/**
	 * Convert "is" operator to Bases expression
	 */
	private convertIsOperator(basesProperty: string, value: any, fieldType?: string): string {
		// Handle array values (for multi-select properties)
		if (Array.isArray(value)) {
			if (value.length == 0) {
				return `(!${basesProperty} || ${basesProperty}.length == 0)`;
			}

			// Check if property contains any of the values
			const conditions = value.map(
				(v) => `${basesProperty}.contains("${this.escapeString(String(v))}")`
			);
			return conditions.length > 1 ? `(${conditions.join(" || ")})` : conditions[0];
		}

		// Handle list-type user fields
		if (fieldType == "list") {
			return `${basesProperty}.contains("${this.escapeString(String(value))}")`;
		}

		// Handle boolean values
		if (typeof value == "boolean" || fieldType == "boolean") {
			return `${basesProperty} == ${value}`;
		}

		// Handle numeric values
		if (typeof value == "number" || fieldType == "number") {
			return `${basesProperty} == ${value}`;
		}

		// Handle null/empty
		if (value == null || value == "") {
			return `(!${basesProperty} || ${basesProperty} == "" || ${basesProperty} == null)`;
		}

		// Default: string comparison
		return `${basesProperty} == "${this.escapeString(String(value))}"`;
	}

	/**
	 * Convert "contains" operator to Bases expression
	 */
	private convertContainsOperator(
		basesProperty: string,
		value: any,
		originalProperty: FilterProperty
	): string {
		// Handle array properties (tags, contexts, projects)
		const arrayProperties: FilterProperty[] = ["tags", "contexts", "projects"];

		if (arrayProperties.includes(originalProperty)) {
			// For array properties, use .contains() method
			if (Array.isArray(value)) {
				const conditions = value.map(
					(v) => `${basesProperty}.contains("${this.escapeString(String(v))}")`
				);
				return conditions.length > 1 ? `(${conditions.join(" || ")})` : conditions[0];
			}

			// Special handling for projects - match wiki links
			if (originalProperty == "projects") {
				const projectValue = String(value);
				// Try to match both with and without wiki link brackets
				if (projectValue.startsWith("[[") && projectValue.endsWith("]]")) {
					return `${basesProperty}.contains("${this.escapeString(projectValue)}")`;
				} else {
					// Try both formats
					return `(${basesProperty}.contains("[[${this.escapeString(projectValue)}]]") || ${basesProperty}.contains("${this.escapeString(projectValue)}"))`;
				}
			}

			return `${basesProperty}.contains("${this.escapeString(String(value))}")`;
		}

		// For string properties, use substring match with Bases methods
		return `${basesProperty}.lower().contains("${this.escapeString(String(value).toLowerCase())}")`;
	}

	/**
	 * Format numeric value for Bases expression (no quotes)
	 */
	private formatNumericValue(value: any): string {
		if (typeof value == "number") {
			return String(value);
		}
		const num = parseFloat(String(value));
		return isNaN(num) ? "0" : String(num);
	}

	/**
	 * Escape special characters in string values
	 */
	private escapeString(str: string): string {
		return str
			.replace(/\\/g, "\\\\") // Escape backslashes
			.replace(/"/g, '\\"')   // Escape quotes
			.replace(/\n/g, "\\n")  // Escape newlines
			.replace(/\r/g, "\\r")  // Escape carriage returns
			.replace(/\t/g, "\\t"); // Escape tabs
	}

	/**
	 * Convert filter object to YAML string
	 */
	private filterObjectToYAML(filterObj: any, indent = 0): string {
		const indentStr = "  ".repeat(indent);

		if (typeof filterObj == "string") {
			// String expression - wrap in single quotes and escape single quotes
			return `'${filterObj.replace(/'/g, "\\'")}'`;
		}

		if (Array.isArray(filterObj)) {
			// Array of conditions
			return filterObj.map(item => `\n${indentStr}- ${this.filterObjectToYAML(item, indent + 1)}`).join("");
		}

		if (typeof filterObj == "object" && filterObj !== null) {
			// Object with and/or/not keys
			const key = Object.keys(filterObj)[0];
			const value = filterObj[key];

			if (Array.isArray(value)) {
				return `\n${indentStr}${key}:${value.map(item => `\n${indentStr}  - ${this.filterObjectToYAML(item, indent + 2)}`).join("")}`;
			}

			return `\n${indentStr}${key}: ${this.filterObjectToYAML(value, indent + 1)}`;
		}

		return String(filterObj);
	}

	/**
	 * Convert a SavedView to a Bases .base file content
	 */
	convertSavedViewToBasesFile(
		savedView: any,
		viewType: "tasknotesTaskList" | "tasknotesKanban" | "tasknotesCalendar" = "tasknotesTaskList"
	): string {
		const filterObject = this.convertToBasesFilter(savedView.query);

		// Build the Bases file content
		let content = `# ${savedView.name}\n\n`;

		if (filterObject) {
			content += `filters:${this.filterObjectToYAML(filterObject, 1)}\n\n`;
		}

		content += `views:\n`;
		content += `  - type: ${viewType}\n`;
		content += `    name: "${savedView.name}"\n`;

		// Add sorting if present
		if (savedView.query.sortKey && savedView.query.sortKey !== "none") {
			const sortColumn = this.mapSortKeyToBasesColumn(savedView.query.sortKey);
			const sortDirection = (savedView.query.sortDirection || "asc").toUpperCase();
			content += `    sort:\n`;
			content += `      - column: ${sortColumn}\n`;
			content += `        direction: ${sortDirection}\n`;
		}

		// Add grouping if present
		if (savedView.query.groupKey && savedView.query.groupKey !== "none") {
			const groupColumn = this.mapGroupKeyToBasesColumn(savedView.query.groupKey);
			const groupDirection = (savedView.query.sortDirection || "asc").toUpperCase();
			content += `    groupBy:\n`;
			content += `      property: ${groupColumn}\n`;
			content += `      direction: ${groupDirection}\n`;
		}

		// Add view options if present
		if (savedView.viewOptions && Object.keys(savedView.viewOptions).length > 0) {
			content += `    options:\n`;
			Object.entries(savedView.viewOptions).forEach(([key, value]) => {
				// Format value appropriately based on type
				let formattedValue: string;
				if (typeof value == "boolean" || typeof value == "number") {
					formattedValue = String(value);
				} else if (typeof value == "string") {
					formattedValue = `"${this.escapeString(value)}"`;
				} else {
					formattedValue = JSON.stringify(value);
				}
				content += `      ${key}: ${formattedValue}\n`;
			});
		}

		return content;
	}

	/**
	 * Map TaskNotes sort key to Bases column name
	 */
	private mapSortKeyToBasesColumn(sortKey: string): string {
		const fm = this.plugin.fieldMapper;

		// Handle known TaskNotes sort keys
		switch (sortKey) {
			case "due": return fm.toUserField("due");
			case "scheduled": return fm.toUserField("scheduled");
			case "priority": return fm.toUserField("priority");
			case "status": return fm.toUserField("status");
			case "title": return fm.toUserField("title");
			case "dateCreated": return "file.ctime";
			case "dateModified": return "file.mtime";
			case "completedDate": return fm.toUserField("completedDate");
			case "tags": return "file.tags";
			case "path": return "file.path";
			case "timeEstimate": return fm.toUserField("timeEstimate");
			case "recurrence": return fm.toUserField("recurrence");
			default:
				// Handle user fields
				if (sortKey.startsWith("user:")) {
					const fieldId = sortKey.slice(5);
					const userFields = this.plugin.settings.userFields || [];
					const field = userFields.find((f: UserMappedField) =>
						(f.id || f.key) === fieldId || f.key === fieldId
					);
					return field?.key || sortKey;
				}
				// Default: return as-is
				return sortKey;
		}
	}

	/**
	 * Map TaskNotes group key to Bases column name
	 */
	private mapGroupKeyToBasesColumn(groupKey: string): string {
		// Same mapping as sort key
		return this.mapSortKeyToBasesColumn(groupKey);
	}

	/**
	 * Convert all saved views to a single Bases .base file with multiple views
	 */
	convertAllSavedViewsToBasesFile(savedViews: any[]): string {
		if (!savedViews || savedViews.length == 0) {
			return "";
		}

		let content = `# All Saved Views\n`;
		content += `# Converted from TaskNotes saved views\n\n`;

		// Collect all unique filter expressions
		const viewDefinitions: string[] = [];

		for (const savedView of savedViews) {
			// Determine view type based on viewOptions
			const viewType = this.detectViewType(savedView);

			// Convert filter
			const filterObject = this.convertToBasesFilter(savedView.query);

			// Build view definition
			let viewDef = `  - type: ${viewType}\n`;
			viewDef += `    name: "${savedView.name}"\n`;

			// Add filter to this view if present
			if (filterObject) {
				viewDef += `    filters:${this.filterObjectToYAML(filterObject, 3)}\n`;
			}

			// Add sorting if present
			if (savedView.query.sortKey && savedView.query.sortKey !== "none") {
				const sortColumn = this.mapSortKeyToBasesColumn(savedView.query.sortKey);
				const sortDirection = (savedView.query.sortDirection || "asc").toUpperCase();
				viewDef += `    sort:\n`;
				viewDef += `      - column: ${sortColumn}\n`;
				viewDef += `        direction: ${sortDirection}\n`;
			}

			// Add grouping if present
			if (savedView.query.groupKey && savedView.query.groupKey !== "none") {
				const groupColumn = this.mapGroupKeyToBasesColumn(savedView.query.groupKey);
				const groupDirection = (savedView.query.sortDirection || "asc").toUpperCase();
				viewDef += `    groupBy:\n`;
				viewDef += `      property: ${groupColumn}\n`;
				viewDef += `      direction: ${groupDirection}\n`;
			}

			// Add view options if present
			if (savedView.viewOptions && Object.keys(savedView.viewOptions).length > 0) {
				viewDef += `    options:\n`;
				Object.entries(savedView.viewOptions).forEach(([key, value]) => {
					// Format value appropriately based on type
					let formattedValue: string;
					if (typeof value == "boolean" || typeof value == "number") {
						formattedValue = String(value);
					} else if (typeof value == "string") {
						formattedValue = `"${this.escapeString(value)}"`;
					} else {
						formattedValue = JSON.stringify(value);
					}
					viewDef += `      ${key}: ${formattedValue}\n`;
				});
			}

			viewDefinitions.push(viewDef);
		}

		// Add views section
		content += `views:\n`;
		content += viewDefinitions.join("\n");

		return content;
	}

	/**
	 * Detect the view type for a saved view based on its viewOptions
	 */
	private detectViewType(savedView: any): "tasknotesTaskList" | "tasknotesKanban" | "tasknotesCalendar" {
		const viewOptions = savedView.viewOptions || {};

		// Check for calendar/agenda specific options
		const calendarOptions = [
			"showScheduled",
			"showDue",
			"showRecurring",
			"showTimeEntries",
			"showTimeblocks",
			"showPropertyBasedEvents",
			"calendarView",
			"customDayCount",
			"firstDay",
			"slotMinTime",
			"slotMaxTime",
			"slotDuration"
		];

		const hasCalendarOptions = calendarOptions.some(option => option in viewOptions);
		if (hasCalendarOptions) {
			return "tasknotesCalendar";
		}

		// Check for kanban specific options
		const kanbanOptions = ["columnWidth", "hideEmptyColumns"];
		const hasKanbanOptions = kanbanOptions.some(option => option in viewOptions);
		if (hasKanbanOptions) {
			return "tasknotesKanban";
		}

		// Default to task list
		return "tasknotesTaskList";
	}
}
