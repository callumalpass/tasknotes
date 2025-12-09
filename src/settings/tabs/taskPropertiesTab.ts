import TaskNotesPlugin from "../../main";
import type { TranslationKey } from "../../i18n";
import {
	createSectionHeader,
	createHelpText,
} from "../components/settingHelpers";

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

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// ===== CORE PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.coreProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.corePropertiesDesc"));

	// Title Property Card (with filename settings)
	renderTitlePropertyCard(container, plugin, save, translate);

	// Status Property Card
	renderStatusPropertyCard(container, plugin, save, translate);

	// Priority Property Card
	renderPriorityPropertyCard(container, plugin, save, translate);

	// ===== DATE PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.dateProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.datePropertiesDesc"));

	// Due Date Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "due",
		displayName: translate("settings.taskProperties.properties.due.name"),
		description: translate("settings.taskProperties.properties.due.description"),
		hasDefault: true,
		defaultType: "date-preset",
		defaultOptions: [
			{ value: "none", label: translate("settings.defaults.options.none") },
			{ value: "today", label: translate("settings.defaults.options.today") },
			{ value: "tomorrow", label: translate("settings.defaults.options.tomorrow") },
			{ value: "next-week", label: translate("settings.defaults.options.nextWeek") },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultDueDate,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultDueDate = value as "none" | "today" | "tomorrow" | "next-week";
			save();
		},
	});

	// Scheduled Date Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "scheduled",
		displayName: translate("settings.taskProperties.properties.scheduled.name"),
		description: translate("settings.taskProperties.properties.scheduled.description"),
		hasDefault: true,
		defaultType: "date-preset",
		defaultOptions: [
			{ value: "none", label: translate("settings.defaults.options.none") },
			{ value: "today", label: translate("settings.defaults.options.today") },
			{ value: "tomorrow", label: translate("settings.defaults.options.tomorrow") },
			{ value: "next-week", label: translate("settings.defaults.options.nextWeek") },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultScheduledDate,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultScheduledDate = value as "none" | "today" | "tomorrow" | "next-week";
			save();
		},
	});

	// ===== ORGANIZATION PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.organizationProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.organizationPropertiesDesc"));

	// Contexts Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "contexts",
		displayName: translate("settings.taskProperties.properties.contexts.name"),
		description: translate("settings.taskProperties.properties.contexts.description"),
		hasDefault: true,
		defaultType: "text",
		defaultPlaceholder: translate("settings.defaults.basicDefaults.defaultContexts.placeholder"),
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
	createSectionHeader(container, translate("settings.taskProperties.sections.taskDetails"));
	createHelpText(container, translate("settings.taskProperties.sections.taskDetailsDesc"));

	// Time Estimate Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "timeEstimate",
		displayName: translate("settings.taskProperties.properties.timeEstimate.name"),
		description: translate("settings.taskProperties.properties.timeEstimate.description"),
		hasDefault: true,
		defaultType: "number",
		defaultPlaceholder: translate("settings.defaults.basicDefaults.defaultTimeEstimate.placeholder"),
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultTimeEstimate?.toString() || "",
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultTimeEstimate = parseInt(value) || 0;
			save();
		},
	});

	// Recurrence Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "recurrence",
		displayName: translate("settings.taskProperties.properties.recurrence.name"),
		description: translate("settings.taskProperties.properties.recurrence.description"),
		hasDefault: true,
		defaultType: "dropdown",
		defaultOptions: [
			{ value: "none", label: translate("settings.defaults.options.none") },
			{ value: "daily", label: translate("settings.defaults.options.daily") },
			{ value: "weekly", label: translate("settings.defaults.options.weekly") },
			{ value: "monthly", label: translate("settings.defaults.options.monthly") },
			{ value: "yearly", label: translate("settings.defaults.options.yearly") },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultRecurrence,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultRecurrence = value as "none" | "daily" | "weekly" | "monthly" | "yearly";
			save();
		},
	});

	// Recurrence Anchor Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "recurrenceAnchor",
		translate("settings.taskProperties.properties.recurrenceAnchor.name"),
		translate("settings.taskProperties.properties.recurrenceAnchor.description"));

	// Reminders Property Card
	renderRemindersPropertyCard(container, plugin, save, translate);

	// ===== METADATA PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.metadataProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.metadataPropertiesDesc"));

	// Date Created Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "dateCreated",
		translate("settings.taskProperties.properties.dateCreated.name"),
		translate("settings.taskProperties.properties.dateCreated.description"));

	// Date Modified Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "dateModified",
		translate("settings.taskProperties.properties.dateModified.name"),
		translate("settings.taskProperties.properties.dateModified.description"));

	// Completed Date Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "completedDate",
		translate("settings.taskProperties.properties.completedDate.name"),
		translate("settings.taskProperties.properties.completedDate.description"));

	// Archive Tag Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "archiveTag",
		translate("settings.taskProperties.properties.archiveTag.name"),
		translate("settings.taskProperties.properties.archiveTag.description"));

	// Time Entries Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "timeEntries",
		translate("settings.taskProperties.properties.timeEntries.name"),
		translate("settings.taskProperties.properties.timeEntries.description"));

	// Complete Instances Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "completeInstances",
		translate("settings.taskProperties.properties.completeInstances.name"),
		translate("settings.taskProperties.properties.completeInstances.description"));

	// Skipped Instances Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "skippedInstances",
		translate("settings.taskProperties.properties.skippedInstances.name"),
		translate("settings.taskProperties.properties.skippedInstances.description"));

	// Blocked By Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "blockedBy",
		translate("settings.taskProperties.properties.blockedBy.name"),
		translate("settings.taskProperties.properties.blockedBy.description"));

	// ===== FEATURE PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.featureProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.featurePropertiesDesc"));

	// Pomodoros Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "pomodoros",
		translate("settings.taskProperties.properties.pomodoros.name"),
		translate("settings.taskProperties.properties.pomodoros.description"));

	// ICS Event ID Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "icsEventId",
		translate("settings.taskProperties.properties.icsEventId.name"),
		translate("settings.taskProperties.properties.icsEventId.description"));

	// ICS Event Tag Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "icsEventTag",
		translate("settings.taskProperties.properties.icsEventTag.name"),
		translate("settings.taskProperties.properties.icsEventTag.description"));

	// ===== CUSTOM USER FIELDS SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.customUserFields.header"));
	createHelpText(container, translate("settings.taskProperties.customUserFields.description"));

	// Render user fields section (includes list + add button)
	renderUserFieldsSection(container, plugin, save, translate);
}
