/**
 * Default .base file templates for TaskNotes views
 * These are created in TaskNotes/Views/ directory when the user first uses the commands
 *
 * ⚠️ IMPORTANT: Changes to these templates should be reflected in the documentation at:
 *    docs/views/default-base-templates.md
 *
 * When updating templates:
 * 1. Update the template generation code below
 * 2. Update the documentation with example output using DEFAULT_SETTINGS from src/settings/defaults.ts
 * 3. Ensure all Bases syntax is valid according to https://help.obsidian.md/Bases/Bases+syntax
 */

import type { TaskNotesSettings } from "../types/settings";
import type TaskNotesPlugin from "../main";
import type { FieldMapping } from "../types";
import { parseExcludedFolders } from "../utils/pathExclusions";
import { isTagsTaskIdentifierProperty } from "../utils/taskIdentificationFrontmatter";

function escapeBasesStringLiteral(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatNotePropertyReference(propertyName: string): string {
	return `note["${escapeBasesStringLiteral(propertyName)}"]`;
}

function formatDependencyEntryFileExpression(entryExpression: string): string {
	return `file(if(${entryExpression}.isType("object"), ${entryExpression}.uid, ${entryExpression}))`;
}

function formatDependencyEntryLinkExpression(entryExpression: string): string {
	return `${formatDependencyEntryFileExpression(entryExpression)}.asLink()`;
}

function formatProjectEntryLinkExpression(entryExpression: string): string {
	return `file(${entryExpression}.replace(/^\\[[^\\]]+\\]\\((.*)\\)$/, "$1").replace(/%20/g, " ")).asLink()`;
}

/**
 * Generate a task filter expression based on the task identification method
 * Returns the filter condition string (not the full YAML structure)
 */
function generateTaskFilterCondition(settings: TaskNotesSettings): string {
	if (settings.taskIdentificationMethod === "tag") {
		// Filter by tag using hasTag method
		const taskTag = settings.taskTag || "task";
		return `file.hasTag("${taskTag}")`;
	} else {
		// Filter by property
		const propertyName = settings.taskPropertyName;
		const propertyValue = settings.taskPropertyValue;

		if (!propertyName) {
			// No property name specified, fall back to tag-based filtering
			const taskTag = settings.taskTag || "task";
			return `file.hasTag("${taskTag}")`;
		}

		if (propertyValue) {
			if (isTagsTaskIdentifierProperty(propertyName)) {
				return `file.hasTag("${escapeBasesStringLiteral(propertyValue)}")`;
			}
			// Check property has specific value
			// Boolean values must not be quoted — Obsidian stores checkbox/boolean
			// frontmatter as actual booleans, so the Bases filter needs e.g.
			// note["prop"] == true rather than note["prop"] == "true" (#1491)
			const propertyRef = formatNotePropertyReference(propertyName);
			const lower = propertyValue.toLowerCase();
			if (lower === "true" || lower === "false") {
				return `${propertyRef} == ${lower}`;
			}
			return `${propertyRef} == "${escapeBasesStringLiteral(propertyValue)}"`;
		} else {
			// Just check property exists (is not empty)
			const propertyRef = formatNotePropertyReference(propertyName);
			return `${propertyRef} && ${propertyRef} != "" && ${propertyRef} != null`;
		}
	}
}

function generateExcludedFolderFilterConditions(settings: TaskNotesSettings): string[] {
	return parseExcludedFolders(settings.excludedFolders).map(
		(folder) => `file.inFolder("${escapeBasesStringLiteral(folder)}") != true`
	);
}

function generateTaskFilterConditions(settings: TaskNotesSettings): string[] {
	return [
		generateTaskFilterCondition(settings),
		...generateExcludedFolderFilterConditions(settings),
	];
}

/**
 * Format filter condition(s) as YAML object notation
 */
function formatFilterAsYAML(conditions: string | string[]): string {
	const conditionArray = Array.isArray(conditions) ? conditions : [conditions];
	const formattedConditions = conditionArray.map(c => `    - ${c}`).join('\n');
	return `filters:
  and:
${formattedConditions}`;
}

/**
 * Extract just the property name from a fully-qualified property path
 * e.g., "note.projects" -> "projects", "file.ctime" -> "ctime"
 */
function getPropertyName(fullPath: string): string {
	return fullPath.replace(/^(note\.|file\.|task\.|formula\.)/, '');
}

function formatBasesDateDayExpression(dateExpression: string): string {
	return `date(${dateExpression}).format("YYYY-MM-DD")`;
}

function getBasesTodayDayExpression(): string {
	return 'today().format("YYYY-MM-DD")';
}

function getBasesWeekEndDayExpression(): string {
	return '(today() + "7 days").format("YYYY-MM-DD")';
}

/**
 * Map internal TaskNotes property names to Bases property names.
 * Uses FieldMapper for type-safe field mapping.
 */
function mapPropertyToBasesProperty(property: string, plugin: TaskNotesPlugin): string {
	const fm = plugin.fieldMapper;

	// Handle user-defined fields (format: "user:field_xxx")
	if (property.startsWith("user:")) {
		const fieldId = property.substring(5); // Remove "user:" prefix
		const userField = plugin.settings.userFields?.find(f => f.id === fieldId);
		if (userField) {
			return userField.key;
		}
		// If field not found, return the ID as-is (shouldn't happen in normal use)
		return property;
	}

	// Handle special Bases-specific properties first
	switch (property) {
		case "tags":
			return "file.tags";
		case "dateCreated":
			return "file.ctime";
		case "dateModified":
			return "file.mtime";
		case "title":
			return "file.name";
		case "blocked":
		case "blocking":
			// Blocking is a computed property, use blockedBy as the source
			return fm.toUserField("blockedBy");
		case "complete_instances":
			return fm.toUserField("completeInstances");
		case "totalTrackedTime":
			// totalTrackedTime is computed from timeEntries, use the timeEntries property
			return fm.toUserField("timeEntries");
		case "checklistProgress":
			// checklistProgress is computed from markdown checklist items.
			// Use file.tasks as the selectable Bases source property.
			return "file.tasks";
	}

	// Try to map using FieldMapper
	const mapping = fm.getMapping();
	if (property in mapping) {
		return fm.toUserField(property as keyof FieldMapping);
	}

	// Unknown property, return as-is
	return property;
}

/**
 * Generate the order array from defaultVisibleProperties
 */
function generateOrderArray(plugin: TaskNotesPlugin): string[] {
	const settings = plugin.settings;
	const visibleProperties = settings.defaultVisibleProperties || [
		"status",
		"priority",
		"due",
		"scheduled",
		"projects",
		"contexts",
		"tags",
	];

	// Map to Bases property names, filtering out null/empty values
	const basesProperties = visibleProperties
		.map(prop => mapPropertyToBasesProperty(prop, plugin))
		.filter((prop): prop is string => !!prop);

	// Add essential properties that should always be in the order
	const essentialProperties = [
		"file.name", // title
		mapPropertyToBasesProperty("recurrence", plugin),
		mapPropertyToBasesProperty("complete_instances", plugin),
		mapPropertyToBasesProperty("checklistProgress", plugin),
	].filter((prop): prop is string => !!prop);

	// Combine, removing duplicates while preserving order
	const allProperties: string[] = [];
	const seen = new Set<string>();

	// Add visible properties first
	for (const prop of basesProperties) {
		if (prop && !seen.has(prop)) {
			allProperties.push(prop);
			seen.add(prop);
		}
	}

	// Add essential properties
	for (const prop of essentialProperties) {
		if (prop && !seen.has(prop)) {
			allProperties.push(prop);
			seen.add(prop);
		}
	}

	return allProperties;
}

/**
 * Format the order array as YAML
 */
function formatOrderArray(orderArray: string[]): string {
	return orderArray.map(prop => `      - ${prop}`).join('\n');
}

function insertOrderPropertyAfterOrAppend(
	orderArray: string[],
	property: string,
	afterProperty: string
): string[] {
	if (!property) {
		return orderArray;
	}

	const updatedOrder = orderArray.filter((entry) => entry !== property);
	const insertAfterIndex = updatedOrder.indexOf(afterProperty);
	if (insertAfterIndex === -1) {
		updatedOrder.push(property);
	} else {
		updatedOrder.splice(insertAfterIndex + 1, 0, property);
	}
	return updatedOrder;
}

/**
 * Generate a priorityWeight formula based on user's custom priorities.
 * Creates nested if() statements that map priority values to their weights.
 * Lower weight = higher priority, so tasks sort correctly in ascending order.
 *
 * Example output: if(priority=="high",0,if(priority=="normal",1,if(priority=="low",2,999)))
 */
function generatePriorityWeightFormula(plugin: TaskNotesPlugin): string {
	const settings = plugin.settings;
	const priorityProperty = getPropertyName(mapPropertyToBasesProperty('priority', plugin));

	// Sort priorities by weight (ascending - lower weight = higher priority)
	const sortedPriorities = [...settings.customPriorities].sort((a, b) => a.weight - b.weight);

	if (sortedPriorities.length === 0) {
		// No priorities configured, return a constant
		return '999';
	}

	// Build nested if statements from the inside out
	// Start with the fallback value (for tasks with no priority or unknown priority)
	let formula = '999';

	// Work backwards through priorities to build nested ifs
	for (let i = sortedPriorities.length - 1; i >= 0; i--) {
		const priority = sortedPriorities[i];
		// Use the index as the weight value (0 = highest priority)
		formula = `if(${priorityProperty}=="${priority.value}",${i},${formula})`;
	}

	return formula;
}

/**
 * Generate a human-readable priority category formula.
 * Maps priority values to their display labels for grouping.
 */
function generatePriorityCategoryFormula(plugin: TaskNotesPlugin): string {
	const priorityProperty = getPropertyName(mapPropertyToBasesProperty('priority', plugin));
	const priorities = plugin.settings.customPriorities;

	if (priorities.length === 0) {
		return '"No priority"';
	}

	// Build nested if statements mapping value -> label
	let formula = '"No priority"';
	for (let i = priorities.length - 1; i >= 0; i--) {
		const p = priorities[i];
		formula = `if(${priorityProperty}=="${p.value}","${p.label}",${formula})`;
	}

	return formula;
}

/**
 * Generate all useful formulas for TaskNotes views.
 * These formulas provide calculated values that can be used in views, filters, and sorting.
 */
function generateAllFormulas(plugin: TaskNotesPlugin): Record<string, string> {
	const dueProperty = getPropertyName(mapPropertyToBasesProperty('due', plugin));
	const statusProperty = getPropertyName(mapPropertyToBasesProperty('status', plugin));
	const timeEstimateProperty = getPropertyName(mapPropertyToBasesProperty('timeEstimate', plugin));
	const timeEntriesProperty = getPropertyName(mapPropertyToBasesProperty('timeEntries', plugin));
	const projectsProperty = getPropertyName(mapPropertyToBasesProperty('projects', plugin));
	const contextsProperty = getPropertyName(mapPropertyToBasesProperty('contexts', plugin));

	// Get all completed status values for isOverdue check
	const completedStatuses = plugin.settings.customStatuses
		.filter(s => s.isCompleted)
		.map(s => s.value);
	const completedStatusCheck = completedStatuses
		.map(status => `${statusProperty} != "${status}"`)
		.join(' && ');

	const scheduledProperty = getPropertyName(mapPropertyToBasesProperty('scheduled', plugin));
	const recurrenceProperty = getPropertyName(mapPropertyToBasesProperty('recurrence', plugin));
	const dueIsEmpty = `${dueProperty}.isEmpty()`;
	const scheduledIsEmpty = `${scheduledProperty}.isEmpty()`;
	const dueHasValue = `(${dueIsEmpty} == false)`;
	const scheduledHasValue = `(${scheduledIsEmpty} == false)`;
	const safeDaysUntilNext = "if(formula.daysUntilNext, formula.daysUntilNext, 0)";
	const todayDay = getBasesTodayDayExpression();
	const weekEndDay = getBasesWeekEndDayExpression();
	const tomorrowDay = '(today() + "1 day").format("YYYY-MM-DD")';
	const yesterdayDay = '(today() - "1 day").format("YYYY-MM-DD")';
	const dueDay = formatBasesDateDayExpression(dueProperty);
	const scheduledDay = formatBasesDateDayExpression(scheduledProperty);
	const timeEntryStartDay = formatBasesDateDayExpression("value.startTime");
	const nextDateStartOfDay = 'date(date(formula.nextDate).format("YYYY-MM-DD"))';

	return {
		// Priority weight for sorting (lower = higher priority)
		priorityWeight: generatePriorityWeightFormula(plugin),

		// Days until due (negative = overdue, positive = days remaining)
		// Convert dates to ms (via number()) before subtracting to get numeric difference
		daysUntilDue: `if(${dueHasValue}, ((number(date(${dueProperty})) - number(today())) / 86400000).floor(), null)`,

		// Compact due date countdown for list/agenda displays
		dueIn: `if(${dueIsEmpty}, "", if(formula.daysUntilDue == 0, "Today", if(formula.daysUntilDue == 1, "1 day", if(formula.daysUntilDue > 1, formula.daysUntilDue + " days", if(formula.daysUntilDue == -1, "1 day overdue", formula.daysUntilDue * -1 + " days overdue")))))`,

		// Days until scheduled (negative = past, positive = days remaining)
		daysUntilScheduled: `if(${scheduledHasValue}, ((number(date(${scheduledProperty})) - number(today())) / 86400000).floor(), null)`,

		// Days since the task was created
		daysSinceCreated: '((number(now()) - number(file.ctime)) / 86400000).floor()',

		// Days since the task was last modified
		daysSinceModified: '((number(now()) - number(file.mtime)) / 86400000).floor()',

		// === BOOLEAN FORMULAS ===

		// Boolean: is this task overdue?
		isOverdue: `${dueHasValue} && date(${dueProperty}) < today() && ${completedStatusCheck}`,

		// Boolean: is this task due today?
		isDueToday: `${dueHasValue} && ${dueDay} == ${todayDay}`,

		// Boolean: is this task due within the next 7 days?
		isDueThisWeek: `${dueHasValue} && ${dueDay} >= ${todayDay} && ${dueDay} <= ${weekEndDay}`,

		// Boolean: is this task scheduled for today?
		isScheduledToday: `${scheduledHasValue} && ${scheduledDay} == ${todayDay}`,

		// Boolean: is this a recurring task?
		isRecurring: `${recurrenceProperty} && !${recurrenceProperty}.isEmpty()`,

		// Boolean: does this task have a time estimate?
		hasTimeEstimate: `${timeEstimateProperty} && ${timeEstimateProperty} > 0`,

		// === TIME TRACKING FORMULAS ===

		// Time remaining (estimate minus tracked) in minutes, null if no estimate
		timeRemaining: `if(${timeEstimateProperty} && ${timeEstimateProperty} > 0, ${timeEstimateProperty} - if(${timeEntriesProperty}, list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0), 0), null)`,

		// Efficiency ratio: actual time vs estimated (as percentage)
		// > 100% means took longer than estimated, < 100% means faster
		efficiencyRatio: `if(${timeEstimateProperty} && ${timeEstimateProperty} > 0 && ${timeEntriesProperty}, (list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / ${timeEstimateProperty} * 100).round(), null)`,

		// Total time tracked this week (in minutes)
		timeTrackedThisWeek: `if(${timeEntriesProperty}, list(${timeEntriesProperty}).filter(value.endTime && date(value.startTime) >= today() - "7d").map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)`,

		// Total time tracked today (in minutes)
		timeTrackedToday: `if(${timeEntriesProperty}, list(${timeEntriesProperty}).filter(value.endTime && ${timeEntryStartDay} == ${todayDay}).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)`,

		// === GROUPING FORMULAS ===

		// Due date formatted as "YYYY-MM" for grouping by month
		dueMonth: `if(${dueHasValue}, date(${dueProperty}).format("YYYY-MM"), "No due date")`,

		// Due date formatted as "YYYY-[W]WW" for grouping by week
		dueWeek: `if(${dueHasValue}, date(${dueProperty}).format("YYYY-[W]WW"), "No due date")`,

		// Scheduled date formatted as "YYYY-MM" for grouping by month
		scheduledMonth: `if(${scheduledHasValue}, date(${scheduledProperty}).format("YYYY-MM"), "Not scheduled")`,

		// Scheduled date formatted as "YYYY-[W]WW" for grouping by week
		scheduledWeek: `if(${scheduledHasValue}, date(${scheduledProperty}).format("YYYY-[W]WW"), "Not scheduled")`,

		// Due date category for grouping: Overdue, Today, Tomorrow, This Week, Later, No Due Date
		dueDateCategory: `if(${dueIsEmpty}, "No due date", if(date(${dueProperty}) < today(), "Overdue", if(${dueDay} == ${todayDay}, "Today", if(${dueDay} == ${tomorrowDay}, "Tomorrow", if(${dueDay} <= ${weekEndDay}, "This week", "Later")))))`,

		// Time estimate category for grouping
		timeEstimateCategory: `if(!${timeEstimateProperty} || ${timeEstimateProperty} == 0 || ${timeEstimateProperty} == null, "No estimate", if(${timeEstimateProperty} < 30, "Quick (<30m)", if(${timeEstimateProperty} <= 120, "Medium (30m-2h)", "Long (>2h)")))`,

		// Age category based on creation date
		ageCategory: 'if(((number(now()) - number(file.ctime)) / 86400000) < 1, "Today", if(((number(now()) - number(file.ctime)) / 86400000) < 7, "This week", if(((number(now()) - number(file.ctime)) / 86400000) < 30, "This month", "Older")))',

		// Created month for grouping
		createdMonth: 'file.ctime.format("YYYY-MM")',

		// Modified month for grouping
		modifiedMonth: 'file.mtime.format("YYYY-MM")',

		// Priority as human-readable category (uses configured priority values)
		priorityCategory: generatePriorityCategoryFormula(plugin),

		// Project count category for grouping
		projectCount: `if(!${projectsProperty} || list(${projectsProperty}).length == 0, "No projects", if(list(${projectsProperty}).length == 1, "Single project", "Multiple projects"))`,

		// Context count category for grouping
		contextCount: `if(!${contextsProperty} || list(${contextsProperty}).length == 0, "No contexts", if(list(${contextsProperty}).length == 1, "Single context", "Multiple contexts"))`,

		// Tracking vs estimate status for grouping
		trackingStatus: `if(!${timeEstimateProperty} || ${timeEstimateProperty} == 0 || ${timeEstimateProperty} == null, "No estimate", if(!${timeEntriesProperty} || list(${timeEntriesProperty}).length == 0, "Not started", if(formula.efficiencyRatio < 100, "Under estimate", "Over estimate")))`,

		// === COMBINED DUE/SCHEDULED FORMULAS ===

		// Next date: the earlier of due or scheduled (useful for "what's coming up")
		nextDate: `if(${dueHasValue} && ${scheduledHasValue}, if(date(${dueProperty}) < date(${scheduledProperty}), ${dueProperty}, ${scheduledProperty}), if(${dueHasValue}, ${dueProperty}, ${scheduledProperty}))`,

		// Days until next date (due or scheduled, whichever is sooner)
		daysUntilNext: `if(${dueHasValue} && ${scheduledHasValue}, min(formula.daysUntilDue, formula.daysUntilScheduled), if(${dueHasValue}, formula.daysUntilDue, formula.daysUntilScheduled))`,

		// Boolean: has any date (due or scheduled)
		hasDate: `${dueHasValue} || ${scheduledHasValue}`,

		// Boolean: is due or scheduled today
		isToday: `(${dueHasValue} && ${dueDay} == ${todayDay}) || (${scheduledHasValue} && ${scheduledDay} == ${todayDay})`,

		// Boolean: is due or scheduled this week
		isThisWeek: `(${dueHasValue} && ${dueDay} >= ${todayDay} && ${dueDay} <= ${weekEndDay}) || (${scheduledHasValue} && ${scheduledDay} >= ${todayDay} && ${scheduledDay} <= ${weekEndDay})`,

		// Next date category for grouping (combines due and scheduled)
		nextDateCategory: `if(${dueIsEmpty} && ${scheduledIsEmpty}, "No date", if((${dueHasValue} && date(${dueProperty}) < today()) || (${scheduledHasValue} && date(${scheduledProperty}) < today()), "Overdue/Past", if((${dueHasValue} && ${dueDay} == ${todayDay}) || (${scheduledHasValue} && ${scheduledDay} == ${todayDay}), "Today", if((${dueHasValue} && ${dueDay} == ${tomorrowDay}) || (${scheduledHasValue} && ${scheduledDay} == ${tomorrowDay}), "Tomorrow", if((${dueHasValue} && ${dueDay} <= ${weekEndDay}) || (${scheduledHasValue} && ${scheduledDay} <= ${weekEndDay}), "This week", "Later")))))`,

		// Next date as month for grouping
		nextDateMonth: `if(${dueHasValue} && ${scheduledHasValue}, if(date(${dueProperty}) < date(${scheduledProperty}), date(${dueProperty}).format("YYYY-MM"), date(${scheduledProperty}).format("YYYY-MM")), if(${dueHasValue}, date(${dueProperty}).format("YYYY-MM"), if(${scheduledHasValue}, date(${scheduledProperty}).format("YYYY-MM"), "No date")))`,

		// Next date as week for grouping
		nextDateWeek: `if(${dueHasValue} && ${scheduledHasValue}, if(date(${dueProperty}) < date(${scheduledProperty}), date(${dueProperty}).format("YYYY-[W]WW"), date(${scheduledProperty}).format("YYYY-[W]WW")), if(${dueHasValue}, date(${dueProperty}).format("YYYY-[W]WW"), if(${scheduledHasValue}, date(${scheduledProperty}).format("YYYY-[W]WW"), "No date")))`,

		// === SORTING/SCORING FORMULAS ===

		// Urgency score: combines priority weight, days until next date (due or scheduled), and time-of-day.
		// Higher = more urgent. The 0..1 time-of-day term ranks earlier-in-day tasks above later same-day
		// tasks at the same priority. Date-only values fall back to midnight.
		urgencyScore: `if(${dueIsEmpty} && ${scheduledIsEmpty}, formula.priorityWeight, formula.priorityWeight + max(0, 10 - ${safeDaysUntilNext}) + (1 - ((number(date(formula.nextDate)) - number(${nextDateStartOfDay})) / 86400000)))`,

		// === DISPLAY FORMULAS ===

		// Time tracked formatted as "Xh Ym"
		timeTrackedFormatted: `if(${timeEntriesProperty}, if(list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) >= 60, (list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / 60).floor() + "h " + (list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) % 60).round() + "m", list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round() + "m"), "0m")`,

		// Due date as human-readable relative text
		dueDateDisplay: `if(${dueIsEmpty}, "", if(${dueDay} == ${todayDay}, "Today", if(${dueDay} == ${tomorrowDay}, "Tomorrow", if(${dueDay} == ${yesterdayDay}, "Yesterday", if(date(${dueProperty}) < today(), formula.daysUntilDue * -1 + "d ago", if(${dueDay} <= ${weekEndDay}, date(${dueProperty}).format("ddd"), date(${dueProperty}).format("MMM D")))))))`,
	};
}

/**
 * Generate the formulas section YAML including all useful formulas
 */
function generateFormulasSection(plugin: TaskNotesPlugin): string {
	const formulas = generateAllFormulas(plugin);

	const formulaLines = Object.entries(formulas)
		.map(([name, formula]) => `  ${name}: '${formula}'`)
		.join('\n');

	return `formulas:\n${formulaLines}`;
}

function insertOrderPropertyAfter(
	properties: string[],
	afterProperty: string | null,
	propertyToInsert: string
): string[] {
	if (properties.includes(propertyToInsert)) {
		return properties;
	}
	if (!afterProperty || !properties.includes(afterProperty)) {
		return properties;
	}

	const nextProperties: string[] = [];
	let inserted = false;

	for (const property of properties) {
		nextProperties.push(property);
		if (!inserted && afterProperty && property === afterProperty) {
			nextProperties.push(propertyToInsert);
			inserted = true;
		}
	}

	return nextProperties;
}

function generatePomodoroStatsTemplate(plugin: TaskNotesPlugin): string {
	const pomodoroProperty = mapPropertyToBasesProperty("pomodoros", plugin);
	const pomodoroRef = formatNotePropertyReference(pomodoroProperty);
	const workSessions = `list(${pomodoroRef}).filter(value.type == "work")`;
	const completedWorkSessions = `list(${pomodoroRef}).filter(value.type == "work" && value.completed == true)`;
	const completedWorkDurations = `${completedWorkSessions}.map(if(value.plannedDuration && value.plannedDuration > 0, value.plannedDuration, if(value.startTime && value.endTime, ((number(date(value.endTime)) - number(date(value.startTime))) / 60000).round(), 0)))`;

	return `# Pomodoro statistics
# Generated with your TaskNotes settings
# Requires Pomodoro data storage to be set to Daily notes.

filters:
  and:
    - file.hasProperty("${escapeBasesStringLiteral(pomodoroProperty)}")
    - list(${pomodoroRef}).filter(value.startTime).isEmpty() == false

formulas:
  pomodoroDate: 'if(${pomodoroRef}, list(${pomodoroRef}).filter(value.startTime).map(date(value.startTime).format("YYYY-MM-DD")).unique().join(", "), file.basename)'
  pomodoroMonth: 'if(${pomodoroRef}, list(${pomodoroRef}).filter(value.startTime).map(date(value.startTime).format("YYYY-MM")).unique().join(", "), "")'
  completedPomos: 'if(${pomodoroRef}, ${completedWorkSessions}.length, 0)'
  attemptedPomos: 'if(${pomodoroRef}, ${workSessions}.length, 0)'
  interruptedPomos: 'if(${pomodoroRef}, list(${pomodoroRef}).filter(value.type == "work" && value.completed == false).length, 0)'
  focusMinutes: 'if(${pomodoroRef}, ${completedWorkDurations}.reduce(acc + value, 0).round(), 0)'
  focusTime: 'if(formula.focusMinutes >= 60, (formula.focusMinutes / 60).floor() + "h " + (formula.focusMinutes % 60).round() + "m", formula.focusMinutes + "m")'
  completionRate: 'if(formula.attemptedPomos > 0, (formula.completedPomos / formula.attemptedPomos * 100).round() + "%", "0%")'
  shortBreaks: 'if(${pomodoroRef}, list(${pomodoroRef}).filter(value.type == "short-break").length, 0)'
  longBreaks: 'if(${pomodoroRef}, list(${pomodoroRef}).filter(value.type == "long-break").length, 0)'

properties:
  formula.pomodoroDate:
    displayName: Date
  formula.pomodoroMonth:
    displayName: Month
  formula.completedPomos:
    displayName: Completed
  formula.attemptedPomos:
    displayName: Attempted
  formula.interruptedPomos:
    displayName: Interrupted
  formula.focusMinutes:
    displayName: Focus minutes
  formula.focusTime:
    displayName: Focus time
  formula.completionRate:
    displayName: Completion
  formula.shortBreaks:
    displayName: Short breaks
  formula.longBreaks:
    displayName: Long breaks

views:
  - type: table
    name: "Daily"
    order:
      - formula.pomodoroDate
      - formula.completedPomos
      - formula.focusTime
      - formula.attemptedPomos
      - formula.completionRate
      - formula.interruptedPomos
      - formula.shortBreaks
      - formula.longBreaks
      - file.name
    sort:
      - column: formula.pomodoroDate
        direction: DESC
  - type: table
    name: "Monthly"
    groupBy:
      property: formula.pomodoroMonth
      direction: DESC
    order:
      - formula.pomodoroDate
      - formula.completedPomos
      - formula.focusMinutes
      - formula.focusTime
      - formula.attemptedPomos
      - formula.completionRate
      - formula.interruptedPomos
      - formula.shortBreaks
      - formula.longBreaks
      - file.name
    summaries:
      formula.completedPomos: Sum
      formula.focusMinutes: Sum
      formula.attemptedPomos: Sum
      formula.interruptedPomos: Sum
      formula.shortBreaks: Sum
      formula.longBreaks: Sum
    sort:
      - column: formula.pomodoroDate
        direction: DESC
`;
}

/**
 * Generate a Bases file template for a specific command with user settings
 */
export function generateBasesFileTemplate(commandId: string, plugin: TaskNotesPlugin): string {
	const settings = plugin.settings;
	const taskFilterConditions = generateTaskFilterConditions(settings);
	const excludedFolderFilterConditions = generateExcludedFolderFilterConditions(settings);
	const orderArray = generateOrderArray(plugin);
	const orderYaml = formatOrderArray(orderArray);
	const formulasSection = generateFormulasSection(plugin);

	switch (commandId) {
		case 'open-calendar-view': {
			const dueProperty = mapPropertyToBasesProperty('due', plugin);
			const scheduledProperty = mapPropertyToBasesProperty('scheduled', plugin);
			return `# Mini Calendar
# Generated with your TaskNotes settings

${formatFilterAsYAML(taskFilterConditions)}

${formulasSection}

views:
  - type: tasknotesMiniCalendar
    name: "Due"
    order:
${orderYaml}
    sort:
      - property: ${dueProperty}
        direction: ASC
    dateProperty: ${dueProperty}
  - type: tasknotesMiniCalendar
    name: "Scheduled"
    order: []
    dateProperty: ${scheduledProperty}
  - type: tasknotesMiniCalendar
    name: "Created"
    dateProperty: file.ctime
  - type: tasknotesMiniCalendar
    name: "Modified"
    dateProperty: file.mtime
`;
		}
		case 'open-kanban-view': {
			const statusProperty = getPropertyName(mapPropertyToBasesProperty('status', plugin));
			const sortOrderProperty = mapPropertyToBasesProperty('sortOrder', plugin);
			return `# Kanban Board

${formatFilterAsYAML(taskFilterConditions)}

${formulasSection}

views:
  - type: tasknotesKanban
    name: "Kanban Board"
    order:
${orderYaml}
    sort:
      - column: ${sortOrderProperty}
        direction: DESC
    groupBy:
      property: ${statusProperty}
      direction: ASC
    options:
      columnWidth: 280
      hideEmptyColumns: false
`;
		}

		case 'open-tasks-view': {
			const statusProperty = mapPropertyToBasesProperty('status', plugin);
			const dueProperty = mapPropertyToBasesProperty('due', plugin);
			const scheduledProperty = mapPropertyToBasesProperty('scheduled', plugin);
			const recurrenceProperty = mapPropertyToBasesProperty('recurrence', plugin);
			const completeInstancesProperty = mapPropertyToBasesProperty('completeInstances', plugin);
			const blockedByProperty = mapPropertyToBasesProperty('blockedBy', plugin);
			const sortOrderProperty = mapPropertyToBasesProperty('sortOrder', plugin);
			const dueHasValue = `${dueProperty}.isEmpty() == false`;
			const scheduledHasValue = `${scheduledProperty}.isEmpty() == false`;
			const todayDay = getBasesTodayDayExpression();
			const weekEndDay = getBasesWeekEndDayExpression();
			const dueDay = formatBasesDateDayExpression(dueProperty);
			const scheduledDay = formatBasesDateDayExpression(scheduledProperty);

			// Get all completed status values
			const completedStatuses = settings.customStatuses
				.filter(s => s.isCompleted)
				.map(s => s.value);

			// Generate filter for non-recurring incomplete tasks
			// Status must not be in any of the completed statuses
			const nonRecurringIncompleteFilter = completedStatuses
				.map(status => `${statusProperty} != "${status}"`)
				.join('\n            - ');

			// Normalize completion dates before comparing so YAML date values and strings both work.
			// `!= true` also avoids unary `!` at the start of a YAML scalar.
			const recurringIncompleteFilter = `${completeInstancesProperty}.map(date(value).format("YYYY-MM-DD")).contains(${todayDay}) != true`;

			// Generate filter condition for checking if a blocking task is incomplete
			// This is used in the "Not Blocked" view to filter out completed blocking tasks
			const blockingTaskIncompleteCondition = completedStatuses
				.map(status => `${formatDependencyEntryFileExpression("value")}.properties.${getPropertyName(statusProperty)} != "${status}"`)
				.join(' && ');

			return `# All Tasks

${formatFilterAsYAML(taskFilterConditions)}

${formulasSection}

views:
  - type: tasknotesTaskList
    name: "Manual Order"
    order:
${orderYaml}
    sort:
      - column: ${sortOrderProperty}
        direction: DESC
    groupBy:
      property: ${statusProperty}
      direction: ASC
  - type: tasknotesTaskList
    name: "All Tasks"
    order:
${orderYaml}
    sort:
      - column: due
        direction: ASC
  - type: tasknotesTaskList
    name: "Not Blocked"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - ${recurrenceProperty}.isEmpty()
            - ${nonRecurringIncompleteFilter}
          # Recurring task where today is not in complete_instances
          - and:
            - ${recurrenceProperty}.isEmpty() == false
            - ${recurringIncompleteFilter}
        # Not blocked by any incomplete tasks
        - or:
          # No blocking dependencies at all
          - ${blockedByProperty}.isEmpty()
          # All blocking tasks are completed (filter returns only incomplete, then check if empty)
          - 'list(${blockedByProperty}).filter(${blockingTaskIncompleteCondition}).isEmpty()'
    order:
${orderYaml}
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "Today"
    filters:
      and:
        # Incomplete tasks (handles both recurring and non-recurring)
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - ${recurrenceProperty}.isEmpty()
            - ${nonRecurringIncompleteFilter}
          # Recurring task where today is not in complete_instances
          - and:
            - ${recurrenceProperty}.isEmpty() == false
            - ${recurringIncompleteFilter}
        # Due or scheduled today
        - or:
          - and:
            - ${dueHasValue}
            - ${dueDay} == ${todayDay}
          - and:
            - ${scheduledHasValue}
            - ${scheduledDay} == ${todayDay}
    order:
${orderYaml}
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "Overdue"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - ${recurrenceProperty}.isEmpty()
            - ${nonRecurringIncompleteFilter}
          # Recurring task where today is not in complete_instances
          - and:
            - ${recurrenceProperty}.isEmpty() == false
            - ${recurringIncompleteFilter}
        # Due or scheduled in the past
        - or:
          - and:
            - ${dueHasValue}
            - date(${dueProperty}) < today()
          - and:
            - ${scheduledHasValue}
            - date(${scheduledProperty}) < today()
    order:
${orderYaml}
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "This Week"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - ${recurrenceProperty}.isEmpty()
            - ${nonRecurringIncompleteFilter}
          # Recurring task where today is not in complete_instances
          - and:
            - ${recurrenceProperty}.isEmpty() == false
            - ${recurringIncompleteFilter}
        # Due or scheduled this week
        - or:
          - and:
            - ${dueHasValue}
            - ${dueDay} >= ${todayDay}
            - ${dueDay} <= ${weekEndDay}
          - and:
            - ${scheduledHasValue}
            - ${scheduledDay} >= ${todayDay}
            - ${scheduledDay} <= ${weekEndDay}
    order:
${orderYaml}
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "Unscheduled"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - ${recurrenceProperty}.isEmpty()
            - ${nonRecurringIncompleteFilter}
          # Recurring task where today is not in complete_instances
          - and:
            - ${recurrenceProperty}.isEmpty() == false
            - ${recurringIncompleteFilter}
        # No due date and no scheduled date
        - date(${dueProperty}).isEmpty()
        - date(${scheduledProperty}).isEmpty()
    order:
${orderYaml}
    sort:
      - column: ${statusProperty}
        direction: ASC
`;
		}

		case 'open-advanced-calendar-view':
			return `# Calendar

${formatFilterAsYAML(taskFilterConditions)}

${formulasSection}

views:
  - type: tasknotesCalendar
    name: "Calendar"
    order:
${orderYaml}
    options:
      showScheduled: true
      showDue: true
      showRecurring: true
      showTimeEntries: true
      showTimeblocks: true
      showPropertyBasedEvents: true
      createDailyNotesFromDateLinks: true
      calendarView: "timeGridWeek"
      customDayCount: 3
      firstDay: 0
      slotDuration: "00:30:00"
`;

		case 'open-agenda-view': {
			const dueProperty = mapPropertyToBasesProperty('due', plugin);
			const agendaOrderArray = insertOrderPropertyAfter(orderArray, dueProperty, "formula.dueIn");
			const agendaOrderYaml = formatOrderArray(agendaOrderArray);
			const agendaPropertiesYaml = agendaOrderArray.includes("formula.dueIn")
				? `
properties:
  formula.dueIn:
    displayName: Due in
`
				: "";

			return `# Agenda

${formatFilterAsYAML(taskFilterConditions)}

${formulasSection}
${agendaPropertiesYaml}

views:
  - type: tasknotesCalendar
    name: "Agenda"
    order:
${agendaOrderYaml}
    options:
      showPropertyBasedEvents: false
      createDailyNotesFromDateLinks: true
    calendarView: "listWeek"
    startDateProperty: file.ctime
    listDayCount: 7
    titleProperty: file.basename
`;
		}

		case 'pomodoro-stats-base':
			return generatePomodoroStatsTemplate(plugin);

			case 'relationships': {
				// Unified relationships widget that shows all relationship types
				// Extract just the property names (without prefixes) since the template controls the context
				const projectsProperty = getPropertyName(mapPropertyToBasesProperty('projects', plugin));
				const blockedByProperty = getPropertyName(mapPropertyToBasesProperty('blockedBy', plugin));
				const recurrenceParentProperty = getPropertyName(mapPropertyToBasesProperty('recurrenceParent', plugin));
				const occurrenceDateProperty = mapPropertyToBasesProperty('occurrenceDate', plugin);
				const scheduledProperty = mapPropertyToBasesProperty('scheduled', plugin);
				const statusProperty = getPropertyName(mapPropertyToBasesProperty('status', plugin));
				const sortOrderProperty = mapPropertyToBasesProperty('sortOrder', plugin);
				const occurrenceOrderYaml = formatOrderArray(
					insertOrderPropertyAfterOrAppend(orderArray, occurrenceDateProperty, scheduledProperty)
				);
				const taskRelationshipFilterYaml = taskFilterConditions
					.map((condition) => `        - ${condition}`)
					.join('\n');
				const projectRelationshipFilterYaml = excludedFolderFilterConditions
					.map((condition) => `        - ${condition}`)
					.join('\n');
				const projectRelationshipFilterPrefix = projectRelationshipFilterYaml
					? `${projectRelationshipFilterYaml}\n`
					: '';

			// Note: No top-level task filter here. Each view applies filters as needed:
			// - Subtasks, Blocked By, Blocking: include task filter (these are tasks)
			// - Projects: no task filter (projects can be any file type, not just tasks)

			return `# Relationships
# This view shows all relationships for the current file
# Dynamically shows/hides tabs based on available data

${formulasSection}

views:
  - type: tasknotesKanban
    name: "Subtasks"
    filters:
      and:
${taskRelationshipFilterYaml}
        - file.hasLink(this.file) && list(note.${projectsProperty}).map(${formatProjectEntryLinkExpression("value")}).contains(this.file.asLink())
    order:
${orderYaml}
    sort:
      - column: ${sortOrderProperty}
        direction: DESC
    groupBy:
      property: ${statusProperty}
      direction: ASC
  - type: tasknotesTaskList
    name: "Occurrences"
    filters:
      and:
${taskRelationshipFilterYaml}
        - file.hasLink(this.file) && note.${recurrenceParentProperty} && ${formatProjectEntryLinkExpression(`note.${recurrenceParentProperty}`)} == this.file.asLink()
    order:
${occurrenceOrderYaml}
    sort:
      - column: ${occurrenceDateProperty}
        direction: ASC
  - type: tasknotesTaskList
    name: "Projects"
    filters:
      and:
${projectRelationshipFilterPrefix}        - list(this.${projectsProperty}).map(${formatProjectEntryLinkExpression("value")}).contains(file.asLink())
    order:
${orderYaml}
  - type: tasknotesTaskList
    name: "Blocked By"
    filters:
      and:
${taskRelationshipFilterYaml}
        - list(this.note.${blockedByProperty}).map(${formatDependencyEntryLinkExpression("value")}).contains(file.asLink())
    order:
${orderYaml}
    sort:
      - column: ${sortOrderProperty}
        direction: DESC
  - type: tasknotesKanban
    name: "Blocking"
    filters:
      and:
${taskRelationshipFilterYaml}
        - list(note.${blockedByProperty}).map(${formatDependencyEntryLinkExpression("value")}).contains(this.file.asLink())
    order:
${orderYaml}
    sort:
      - column: ${sortOrderProperty}
        direction: DESC
    groupBy:
      property: ${statusProperty}
      direction: ASC
`;
		}

		default:
			return '';
	}
}
