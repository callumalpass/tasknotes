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
			// Check property has specific value
			return `note.${propertyName} == "${propertyValue}"`;
		} else {
			// Just check property exists (is not empty)
			return `note.${propertyName} && note.${propertyName} != "" && note.${propertyName} != null`;
		}
	}
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

	return {
		// Priority weight for sorting (lower = higher priority)
		priorityWeight: generatePriorityWeightFormula(plugin),

		// Days until due (negative = overdue, positive = days remaining)
		// Convert dates to ms (via number()) before subtracting to get numeric difference
		daysUntilDue: `if(${dueProperty}, ((number(date(${dueProperty})) - number(today())) / 86400000).floor(), null)`,

		// Days until scheduled (negative = past, positive = days remaining)
		daysUntilScheduled: `if(${scheduledProperty}, ((number(date(${scheduledProperty})) - number(today())) / 86400000).floor(), null)`,

		// Days since the task was created
		daysSinceCreated: '((number(now()) - number(file.ctime)) / 86400000).floor()',

		// Days since the task was last modified
		daysSinceModified: '((number(now()) - number(file.mtime)) / 86400000).floor()',

		// === BOOLEAN FORMULAS ===

		// Boolean: is this task overdue?
		isOverdue: `${dueProperty} && date(${dueProperty}) < today() && ${completedStatusCheck}`,

		// Boolean: is this task due today?
		isDueToday: `${dueProperty} && date(${dueProperty}).date() == today()`,

		// Boolean: is this task due within the next 7 days?
		isDueThisWeek: `${dueProperty} && date(${dueProperty}) >= today() && date(${dueProperty}) <= today() + "7d"`,

		// Boolean: is this task scheduled for today?
		isScheduledToday: `${scheduledProperty} && date(${scheduledProperty}).date() == today()`,

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
		timeTrackedToday: `if(${timeEntriesProperty}, list(${timeEntriesProperty}).filter(value.endTime && date(value.startTime).date() == today()).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)`,

		// === GROUPING FORMULAS ===

		// Due date formatted as "YYYY-MM" for grouping by month
		dueMonth: `if(${dueProperty}, date(${dueProperty}).format("YYYY-MM"), "No due date")`,

		// Due date formatted as "YYYY-[W]WW" for grouping by week
		dueWeek: `if(${dueProperty}, date(${dueProperty}).format("YYYY-[W]WW"), "No due date")`,

		// Scheduled date formatted as "YYYY-MM" for grouping by month
		scheduledMonth: `if(${scheduledProperty}, date(${scheduledProperty}).format("YYYY-MM"), "Not scheduled")`,

		// Scheduled date formatted as "YYYY-[W]WW" for grouping by week
		scheduledWeek: `if(${scheduledProperty}, date(${scheduledProperty}).format("YYYY-[W]WW"), "Not scheduled")`,

		// Due date category for grouping: Overdue, Today, Tomorrow, This Week, Later, No Due Date
		dueDateCategory: `if(!${dueProperty}, "No due date", if(date(${dueProperty}) < today(), "Overdue", if(date(${dueProperty}).date() == today(), "Today", if(date(${dueProperty}).date() == today() + "1d", "Tomorrow", if(date(${dueProperty}) <= today() + "7d", "This week", "Later")))))`,

		// Time estimate category for grouping
		timeEstimateCategory: `if(!${timeEstimateProperty} || ${timeEstimateProperty} == 0, "No estimate", if(${timeEstimateProperty} < 30, "Quick (<30m)", if(${timeEstimateProperty} <= 120, "Medium (30m-2h)", "Long (>2h)")))`,

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
		trackingStatus: `if(!${timeEstimateProperty} || ${timeEstimateProperty} == 0, "No estimate", if(!${timeEntriesProperty} || list(${timeEntriesProperty}).length == 0, "Not started", if(formula.efficiencyRatio < 100, "Under estimate", "Over estimate")))`,

		// === COMBINED DUE/SCHEDULED FORMULAS ===

		// Next date: the earlier of due or scheduled (useful for "what's coming up")
		nextDate: `if(${dueProperty} && ${scheduledProperty}, if(date(${dueProperty}) < date(${scheduledProperty}), ${dueProperty}, ${scheduledProperty}), if(${dueProperty}, ${dueProperty}, ${scheduledProperty}))`,

		// Days until next date (due or scheduled, whichever is sooner)
		daysUntilNext: `if(${dueProperty} && ${scheduledProperty}, min(formula.daysUntilDue, formula.daysUntilScheduled), if(${dueProperty}, formula.daysUntilDue, formula.daysUntilScheduled))`,

		// Boolean: has any date (due or scheduled)
		hasDate: `${dueProperty} || ${scheduledProperty}`,

		// Boolean: is due or scheduled today
		isToday: `(${dueProperty} && date(${dueProperty}).date() == today()) || (${scheduledProperty} && date(${scheduledProperty}).date() == today())`,

		// Boolean: is due or scheduled this week
		isThisWeek: `(${dueProperty} && date(${dueProperty}) >= today() && date(${dueProperty}) <= today() + "7d") || (${scheduledProperty} && date(${scheduledProperty}) >= today() && date(${scheduledProperty}) <= today() + "7d")`,

		// Next date category for grouping (combines due and scheduled)
		nextDateCategory: `if(!${dueProperty} && !${scheduledProperty}, "No date", if((${dueProperty} && date(${dueProperty}) < today()) || (${scheduledProperty} && date(${scheduledProperty}) < today()), "Overdue/Past", if((${dueProperty} && date(${dueProperty}).date() == today()) || (${scheduledProperty} && date(${scheduledProperty}).date() == today()), "Today", if((${dueProperty} && date(${dueProperty}).date() == today() + "1d") || (${scheduledProperty} && date(${scheduledProperty}).date() == today() + "1d"), "Tomorrow", if((${dueProperty} && date(${dueProperty}) <= today() + "7d") || (${scheduledProperty} && date(${scheduledProperty}) <= today() + "7d"), "This week", "Later")))))`,

		// Next date as month for grouping
		nextDateMonth: `if(${dueProperty} && ${scheduledProperty}, if(date(${dueProperty}) < date(${scheduledProperty}), date(${dueProperty}).format("YYYY-MM"), date(${scheduledProperty}).format("YYYY-MM")), if(${dueProperty}, date(${dueProperty}).format("YYYY-MM"), if(${scheduledProperty}, date(${scheduledProperty}).format("YYYY-MM"), "No date")))`,

		// Next date as week for grouping
		nextDateWeek: `if(${dueProperty} && ${scheduledProperty}, if(date(${dueProperty}) < date(${scheduledProperty}), date(${dueProperty}).format("YYYY-[W]WW"), date(${scheduledProperty}).format("YYYY-[W]WW")), if(${dueProperty}, date(${dueProperty}).format("YYYY-[W]WW"), if(${scheduledProperty}, date(${scheduledProperty}).format("YYYY-[W]WW"), "No date")))`,

		// === SORTING/SCORING FORMULAS ===

		// Urgency score: combines priority weight and days until next date (due or scheduled)
		// Higher score = more urgent. Overdue tasks get bonus, no date gets just priority
		urgencyScore: `if(!${dueProperty} && !${scheduledProperty}, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilNext))`,

		// === DISPLAY FORMULAS ===

		// Time tracked formatted as "Xh Ym"
		timeTrackedFormatted: `if(${timeEntriesProperty}, if(list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) >= 60, (list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / 60).floor() + "h " + (list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) % 60).round() + "m", list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round() + "m"), "0m")`,

		// Due date as human-readable relative text
		dueDateDisplay: `if(!${dueProperty}, "", if(date(${dueProperty}).date() == today(), "Today", if(date(${dueProperty}).date() == today() + "1d", "Tomorrow", if(date(${dueProperty}).date() == today() - "1d", "Yesterday", if(date(${dueProperty}) < today(), formula.daysUntilDue * -1 + "d ago", if(date(${dueProperty}) <= today() + "7d", date(${dueProperty}).format("ddd"), date(${dueProperty}).format("MMM D")))))))`,
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

/**
 * Generate a Bases file template for a specific command with user settings
 */
export function generateBasesFileTemplate(commandId: string, plugin: TaskNotesPlugin): string {
	const settings = plugin.settings;
	const taskFilterCondition = generateTaskFilterCondition(settings);
	const orderArray = generateOrderArray(plugin);
	const orderYaml = formatOrderArray(orderArray);
	const formulasSection = generateFormulasSection(plugin);

	switch (commandId) {
		case 'open-calendar-view': {
			const dueProperty = mapPropertyToBasesProperty('due', plugin);
			const scheduledProperty = mapPropertyToBasesProperty('scheduled', plugin);
			return `# Mini Calendar
# Generated with your TaskNotes settings

${formatFilterAsYAML([taskFilterCondition])}

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
			return `# Kanban Board

${formatFilterAsYAML([taskFilterCondition])}

${formulasSection}

views:
  - type: tasknotesKanban
    name: "Kanban Board"
    order:
${orderYaml}
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

			// Get all completed status values
			const completedStatuses = settings.customStatuses
				.filter(s => s.isCompleted)
				.map(s => s.value);

			// Generate filter for non-recurring incomplete tasks
			// Status must not be in any of the completed statuses
			const nonRecurringIncompleteFilter = completedStatuses
				.map(status => `${statusProperty} != "${status}"`)
				.join('\n            - ');

			// Generate filter condition for checking if a blocking task is incomplete
			// This is used in the "Not Blocked" view to filter out completed blocking tasks
			const blockingTaskIncompleteCondition = completedStatuses
				.map(status => `file(value.uid).properties.${getPropertyName(statusProperty)} != "${status}"`)
				.join(' && ');

			return `# All Tasks

${formatFilterAsYAML([taskFilterCondition])}

${formulasSection}

views:
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
            - ${recurrenceProperty}
            - "!${completeInstancesProperty}.contains(today().format(\\"yyyy-MM-dd\\"))"
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
            - ${recurrenceProperty}
            - "!${completeInstancesProperty}.contains(today().format(\\"yyyy-MM-dd\\"))"
        # Due or scheduled today
        - or:
          - date(${dueProperty}) == today()
          - date(${scheduledProperty}) == today()
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
            - ${recurrenceProperty}
            - "!${completeInstancesProperty}.contains(today().format(\\"yyyy-MM-dd\\"))"
        # Due in the past
        - date(${dueProperty}) < today()
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
            - ${recurrenceProperty}
            - "!${completeInstancesProperty}.contains(today().format(\\"yyyy-MM-dd\\"))"
        # Due or scheduled this week
        - or:
          - and:
            - date(${dueProperty}) >= today()
            - date(${dueProperty}) <= today() + "7 days"
          - and:
            - date(${scheduledProperty}) >= today()
            - date(${scheduledProperty}) <= today() + "7 days"
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
            - ${recurrenceProperty}
            - "!${completeInstancesProperty}.contains(today().format(\\"yyyy-MM-dd\\"))"
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

${formatFilterAsYAML([taskFilterCondition])}

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
      calendarView: "timeGridWeek"
      customDayCount: 3
      firstDay: 0
      slotMinTime: "06:00:00"
      slotMaxTime: "22:00:00"
      slotDuration: "00:30:00"
`;

		case 'open-agenda-view':
			return `# Agenda

${formatFilterAsYAML([taskFilterCondition])}

${formulasSection}

views:
  - type: tasknotesCalendar
    name: "Agenda"
    order:
${orderYaml}
    calendarView: "listWeek"
    startDateProperty: file.ctime
    listDayCount: 7
    titleProperty: file.basename
`;

		case 'relationships': {
			// Unified relationships widget that shows all relationship types
			// Extract just the property names (without prefixes) since the template controls the context
			const projectsProperty = getPropertyName(mapPropertyToBasesProperty('projects', plugin));
			const blockedByProperty = getPropertyName(mapPropertyToBasesProperty('blockedBy', plugin));
			const statusProperty = getPropertyName(mapPropertyToBasesProperty('status', plugin));

			return `# Relationships
# This view shows all relationships for the current file
# Dynamically shows/hides tabs based on available data

${formatFilterAsYAML([taskFilterCondition])}

${formulasSection}

views:
  - type: tasknotesKanban
    name: "Subtasks"
    filters:
      and:
        - note.${projectsProperty}.contains(this.file.asLink())
    order:
${orderYaml}
    groupBy:
      property: ${statusProperty}
      direction: ASC
  - type: tasknotesTaskList
    name: "Projects"
    filters:
      and:
        - list(this.${projectsProperty}).contains(file.asLink())
    order:
${orderYaml}
  - type: tasknotesTaskList
    name: "Blocked By"
    filters:
      and:
        - list(this.note.${blockedByProperty}).map(value.uid).contains(file.asLink())
    order:
${orderYaml}
  - type: tasknotesKanban
    name: "Blocking"
    filters:
      and:
        - note.${blockedByProperty}.map(value.uid).contains(this.file.asLink())
    order:
${orderYaml}
    groupBy:
      property: ${statusProperty}
      direction: ASC
`;
		}

		default:
			return '';
	}
}
