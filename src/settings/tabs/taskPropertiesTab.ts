import { uiData } from "../../i18n/dataText";
import { msg } from "@lingui/core/macro";
import TaskNotesPlugin from "../../main";
import type { MessageDescriptor } from "../../i18n";
import type { DefaultTaskTime } from "../../types/settings";
import {
	createSectionHeader,
	createHelpText,
} from "../components/settingHelpers";
import { createCardInput } from "../components/CardComponent";

// Import property card modules
import {
	renderTitlePropertyCard,
	renderStatusPropertyCard,
	renderPriorityPropertyCard,
	renderProjectsPropertyCard,
	renderTagsPropertyCard,
	renderRemindersPropertyCard,
	renderUserFieldsSection,
	renderSimplePropertyCard,
	renderMetadataPropertyCard,
} from "./taskProperties";

/**
 * Renders the Task Properties tab - unified property cards
 */
export function renderTaskPropertiesTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: MessageDescriptor, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	const createDefaultTimeInput = (
		value: DefaultTaskTime | undefined,
		onChange: (value: DefaultTaskTime) => void
	): HTMLInputElement => {
		const input = createCardInput("time", "", value && value !== "none" ? value : "");
		input.addEventListener("change", () => {
			onChange((input.value || "none") as DefaultTaskTime);
			save();
		});
		return input;
	};

	// ===== CORE PROPERTIES SECTION =====
	createSectionHeader(container, translate(msg({ message: "Core properties", context: "settings.taskProperties.sections.coreProperties" })));
	createHelpText(container, translate(msg({ message: "Status and priority are the core properties that define a task''s state and importance.", context: "settings.taskProperties.sections.corePropertiesDesc" })));

	// Title Property Card (with filename settings)
	renderTitlePropertyCard(container, plugin, save, translate);

	// Status Property Card
	renderStatusPropertyCard(container, plugin, save, translate);

	// Priority Property Card
	renderPriorityPropertyCard(container, plugin, save, translate);

	// ===== DATE PROPERTIES SECTION =====
	createSectionHeader(container, translate(msg({ message: "Date properties", context: "settings.taskProperties.sections.dateProperties" })));
	createHelpText(container, translate(msg({ message: "Configure when tasks are due and scheduled.", context: "settings.taskProperties.sections.datePropertiesDesc" })));

	// Due Date Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: uiData("due", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		displayName: translate(msg({ message: "Due date", context: "settings.taskProperties.properties.due.name" })),
		description: translate(msg({ message: "The deadline by which a task must be completed. Tasks past their due date appear as overdue. Stored as a date in frontmatter.", context: "settings.taskProperties.properties.due.description" })),
		hasDefault: true,
		defaultType: "date-preset",
		defaultOptions: [
			{ value: "none", label: translate(msg({ message: "None", context: "settings.defaults.options.none" })) },
			{ value: "today", label: translate(msg({ message: "Today", context: "settings.defaults.options.today" })) },
			{ value: "tomorrow", label: translate(msg({ message: "Tomorrow", context: "settings.defaults.options.tomorrow" })) },
			{ value: "next-week", label: translate(msg({ message: "Next week", context: "settings.defaults.options.nextWeek" })) },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultDueDate,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultDueDate = value as "none" | "today" | "tomorrow" | "next-week";
			save();
		},
		extraRows: [
			{
				label: translate(msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })),
				input: createDefaultTimeInput(
					plugin.settings.taskCreationDefaults.defaultDueTime,
					(value) => {
						plugin.settings.taskCreationDefaults.defaultDueTime = value;
					}
				),
			},
		],
	});

	// Scheduled Date Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: uiData("scheduled", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		displayName: translate(msg({ message: "Scheduled date", context: "settings.taskProperties.properties.scheduled.name" })),
		description: translate(msg({ message: "When you plan to work on a task. Unlike due date, this represents your intended start time. Tasks appear on the calendar at their scheduled date/time.", context: "settings.taskProperties.properties.scheduled.description" })),
		hasDefault: true,
		defaultType: "date-preset",
		defaultOptions: [
			{ value: "none", label: translate(msg({ message: "None", context: "settings.defaults.options.none" })) },
			{ value: "today", label: translate(msg({ message: "Today", context: "settings.defaults.options.today" })) },
			{ value: "tomorrow", label: translate(msg({ message: "Tomorrow", context: "settings.defaults.options.tomorrow" })) },
			{ value: "next-week", label: translate(msg({ message: "Next week", context: "settings.defaults.options.nextWeek" })) },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultScheduledDate,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultScheduledDate = value as "none" | "today" | "tomorrow" | "next-week";
			save();
		},
		extraRows: [
			{
				label: translate(msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })),
				input: createDefaultTimeInput(
					plugin.settings.taskCreationDefaults.defaultScheduledTime,
					(value) => {
						plugin.settings.taskCreationDefaults.defaultScheduledTime = value;
					}
				),
			},
		],
	});

	// ===== ORGANIZATION PROPERTIES SECTION =====
	createSectionHeader(container, translate(msg({ message: "Organization properties", context: "settings.taskProperties.sections.organizationProperties" })));
	createHelpText(container, translate(msg({ message: "Organize tasks with contexts, projects, and tags.", context: "settings.taskProperties.sections.organizationPropertiesDesc" })));

	// Contexts Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: uiData("contexts", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		displayName: translate(msg({ message: "Contexts", context: "settings.taskProperties.properties.contexts.name" })),
		description: translate(msg({ message: "Locations or conditions where a task can be done (e.g., @home, @office, @phone). Useful for filtering tasks by your current situation. Stored as a list.", context: "settings.taskProperties.properties.contexts.description" })),
		hasDefault: true,
		defaultType: "text",
		defaultPlaceholder: translate(msg({ message: "@home, @work", context: "settings.defaults.basicDefaults.defaultContexts.placeholder" })),
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultContexts,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultContexts = value;
			save();
		},
		hasNLPTrigger: true,
		nlpDefaultTrigger: "@",
	});

	// Projects Property Card
	renderProjectsPropertyCard(container, plugin, save, translate);

	// Tags Property Card (special - no property key, uses native Obsidian tags)
	renderTagsPropertyCard(container, plugin, save, translate);

	// ===== TASK DETAILS SECTION =====
	createSectionHeader(container, translate(msg({ message: "Task details", context: "settings.taskProperties.sections.taskDetails" })));
	createHelpText(container, translate(msg({ message: "Additional details like time estimates, recurrence, and reminders.", context: "settings.taskProperties.sections.taskDetailsDesc" })));

	// Time Estimate Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: uiData("timeEstimate", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		displayName: translate(msg({ message: "Time estimate", context: "settings.taskProperties.properties.timeEstimate.name" })),
		description: translate(msg({ message: "Estimated minutes to complete the task. Used for time-blocking and workload planning. Displayed on task cards and calendar events.", context: "settings.taskProperties.properties.timeEstimate.description" })),
		hasDefault: true,
		defaultType: "number",
		defaultPlaceholder: translate(msg({ message: "60", context: "settings.defaults.basicDefaults.defaultTimeEstimate.placeholder" })),
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultTimeEstimate?.toString() || "",
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultTimeEstimate = parseInt(value) || 0;
			save();
		},
	});

	// Recurrence Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: uiData("recurrence", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		displayName: translate(msg({ message: "Recurrence", context: "settings.taskProperties.properties.recurrence.name" })),
		description: translate(msg({ message: "Pattern for repeating tasks (daily, weekly, monthly, yearly, or custom RRULE). When a recurring task is completed, its scheduled date is automatically updated to the next occurrence.", context: "settings.taskProperties.properties.recurrence.description" })),
		hasDefault: true,
		defaultType: "dropdown",
		defaultOptions: [
			{ value: "none", label: translate(msg({ message: "None", context: "settings.defaults.options.none" })) },
			{ value: "daily", label: translate(msg({ message: "Daily", context: "settings.defaults.options.daily" })) },
			{ value: "weekly", label: translate(msg({ message: "Weekly", context: "settings.defaults.options.weekly" })) },
			{ value: "monthly", label: translate(msg({ message: "Monthly", context: "settings.defaults.options.monthly" })) },
			{ value: "yearly", label: translate(msg({ message: "Yearly", context: "settings.defaults.options.yearly" })) },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultRecurrence,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultRecurrence = value as "none" | "daily" | "weekly" | "monthly" | "yearly";
			save();
		},
	});

	// Recurrence Anchor Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("recurrenceAnchor", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Recurrence anchor", context: "settings.taskProperties.properties.recurrenceAnchor.name" })),
		translate(msg({ message: "Controls how the next occurrence is calculated: ''scheduled'' uses the scheduled date, ''completion'' uses the actual completion date.", context: "settings.taskProperties.properties.recurrenceAnchor.description" })));

	// Reminders Property Card
	renderRemindersPropertyCard(container, plugin, save, translate);

	// ===== METADATA PROPERTIES SECTION =====
	createSectionHeader(container, translate(msg({ message: "Metadata properties", context: "settings.taskProperties.sections.metadataProperties" })));
	createHelpText(container, translate(msg({ message: "System-managed properties for tracking task history.", context: "settings.taskProperties.sections.metadataPropertiesDesc" })));

	// Date Created Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("dateCreated", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Date created", context: "settings.taskProperties.properties.dateCreated.name" })),
		translate(msg({ message: "Timestamp when the task was first created. Automatically set and used for sorting by creation order.", context: "settings.taskProperties.properties.dateCreated.description" })));

	// Date Modified Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("dateModified", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Date modified", context: "settings.taskProperties.properties.dateModified.name" })),
		translate(msg({ message: "Timestamp of the last change to the task. Automatically updated when any task property changes.", context: "settings.taskProperties.properties.dateModified.description" })));

	// Completed Date Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("completedDate", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Completed date", context: "settings.taskProperties.properties.completedDate.name" })),
		translate(msg({ message: "Timestamp when the task was marked complete. Set automatically when status changes to a completed state.", context: "settings.taskProperties.properties.completedDate.description" })));

	// Archive Tag Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("archiveTag", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Archive tag", context: "settings.taskProperties.properties.archiveTag.name" })),
		translate(msg({ message: "Tag added to tasks when archived. Used to identify archived tasks and can trigger file movement to archive folder.", context: "settings.taskProperties.properties.archiveTag.description" })));

	// Time Entries Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("timeEntries", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Time entries", context: "settings.taskProperties.properties.timeEntries.name" })),
		translate(msg({ message: "Records of time tracking sessions for this task. Each entry stores start and end timestamps. Used to calculate total time spent.", context: "settings.taskProperties.properties.timeEntries.description" })));

	// Complete Instances Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("completeInstances", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Complete instances", context: "settings.taskProperties.properties.completeInstances.name" })),
		translate(msg({ message: "Completion history for recurring tasks. Stores dates when each instance was completed to prevent duplicate completions.", context: "settings.taskProperties.properties.completeInstances.description" })));

	// Skipped Instances Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("skippedInstances", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Skipped instances", context: "settings.taskProperties.properties.skippedInstances.name" })),
		translate(msg({ message: "Skipped occurrences for recurring tasks. Stores dates of instances that were skipped rather than completed.", context: "settings.taskProperties.properties.skippedInstances.description" })));

	// Blocked By Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("blockedBy", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Blocked by", context: "settings.taskProperties.properties.blockedBy.name" })),
		translate(msg({ message: "Links to tasks that must be completed before this one. Stored as wikilinks. Blocked tasks display a visual indicator.", context: "settings.taskProperties.properties.blockedBy.description" })));

	// Manual Order Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("sortOrder", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Manual order", context: "settings.taskProperties.properties.sortOrder.name" })),
		translate(msg({ message: "Frontmatter property used for drag-to-reorder manual ordering. A view must be sorted by this property for drag-and-drop reordering to work.", context: "settings.taskProperties.properties.sortOrder.description" })));

	// ===== FEATURE PROPERTIES SECTION =====
	createSectionHeader(container, translate(msg({ message: "Feature properties", context: "settings.taskProperties.sections.featureProperties" })));
	createHelpText(container, translate(msg({ message: "Properties used by specific TaskNotes features like Pomodoro timer and calendar sync.", context: "settings.taskProperties.sections.featurePropertiesDesc" })));

	// Pomodoros Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("pomodoros", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "Pomodoros", context: "settings.taskProperties.properties.pomodoros.name" })),
		translate(msg({ message: "Count of completed Pomodoro sessions. When data storage is set to ''daily notes'', this is written to daily notes instead of task files.", context: "settings.taskProperties.properties.pomodoros.description" })));

	// ICS Event ID Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("icsEventId", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "ICS event ID", context: "settings.taskProperties.properties.icsEventId.name" })),
		translate(msg({ message: "Unique identifier linking a note to an ICS calendar event. Added automatically when creating notes from calendar events.", context: "settings.taskProperties.properties.icsEventId.description" })));

	// ICS Event Tag Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, uiData("icsEventTag", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		translate(msg({ message: "ICS event tag", context: "settings.taskProperties.properties.icsEventTag.name" })),
		translate(msg({ message: "Tag identifying notes created from ICS calendar events. Used to distinguish calendar-generated notes from regular tasks.", context: "settings.taskProperties.properties.icsEventTag.description" })));

	// ===== CUSTOM USER FIELDS SECTION =====
	createSectionHeader(container, translate(msg({ message: "Custom user fields", context: "settings.taskProperties.customUserFields.header" })));
	createHelpText(container, translate(msg({ message: "Define custom frontmatter properties to appear as type-aware filter options across views. Each row: Display name, property name, type.", context: "settings.taskProperties.customUserFields.description" })));

	// Render user fields section (includes list + add button)
	renderUserFieldsSection(container, plugin, save, translate);
}
