import type TaskNotesPlugin from "../main";
import type { FieldMapping } from "../types";
import type { TranslationKey } from "../i18n";

/**
 * Get all available properties for property selection modals.
 * Returns internal property IDs (FieldMapping keys) with labels showing
 * both the display name and user-configured property name.
 *
 * Includes both core properties and user-defined fields.
 */
export function getAvailableProperties(
	plugin: TaskNotesPlugin
): Array<{ id: string; label: string }> {
	// Helper to create label showing user's configured property name
	const makeLabel = (labelKey: TranslationKey, mappingKey: keyof FieldMapping): string => {
		const displayName = plugin.i18n.translate(labelKey);
		const userPropertyName = plugin.fieldMapper.toUserField(mappingKey);
		// Compare identifiers, never localized text. User-defined names stay untouched.
		if (userPropertyName !== mappingKey) {
			return `${displayName} (${userPropertyName})`;
		}
		return displayName;
	};

	// Core properties using FieldMapping keys as IDs
	const coreProperties = [
		{
			id: "status",
			label: makeLabel("settings.taskProperties.fieldMapping.fields.status", "status"),
		},
		{
			id: "priority",
			label: makeLabel("settings.taskProperties.fieldMapping.fields.priority", "priority"),
		},
		{
			id: "blocked",
			label: plugin.i18n.translate("settings.appearance.taskCards.properties.blocked"),
		},
		{
			id: "blocking",
			label: plugin.i18n.translate("settings.appearance.taskCards.properties.blocking"),
		},
		{ id: "due", label: makeLabel("settings.taskProperties.fieldMapping.fields.due", "due") },
		{
			id: "scheduled",
			label: makeLabel("settings.taskProperties.fieldMapping.fields.scheduled", "scheduled"),
		},
		{
			id: "timeEstimate",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.timeEstimate",
				"timeEstimate"
			),
		},
		{
			id: "totalTrackedTime",
			label: plugin.i18n.translate(
				"settings.appearance.taskCards.properties.totalTrackedTime"
			),
		},
		{
			id: "checklistProgress",
			label: plugin.i18n.translate(
				"settings.appearance.taskCards.properties.checklistProgress"
			),
		},
		{
			id: "recurrence",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.recurrence",
				"recurrence"
			),
		},
		{
			id: "completeInstances",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.completeInstances",
				"completeInstances"
			),
		},
		{
			id: "skippedInstances",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.skippedInstances",
				"skippedInstances"
			),
		},
		{
			id: "completedDate",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.completedDate",
				"completedDate"
			),
		},
		{
			id: "dateCreated",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.dateCreated",
				"dateCreated"
			),
		},
		{
			id: "dateModified",
			label: makeLabel(
				"settings.taskProperties.fieldMapping.fields.dateModified",
				"dateModified"
			),
		},
		{
			id: "projects",
			label: makeLabel("settings.taskProperties.fieldMapping.fields.projects", "projects"),
		},
		{
			id: "contexts",
			label: makeLabel("settings.taskProperties.fieldMapping.fields.contexts", "contexts"),
		},
		{
			id: "tags",
			label: plugin.i18n.translate("settings.appearance.taskCards.properties.tags"),
		},
	];

	// Add user-defined fields
	const userProperties =
		plugin.settings.userFields?.map((field) => ({
			id: `user:${field.id}`,
			label: field.displayName,
		})) || [];

	return [...coreProperties, ...userProperties];
}

/**
 * Get labels for a list of property IDs
 * Useful for displaying current selection
 */
export function getPropertyLabels(plugin: TaskNotesPlugin, propertyIds: string[]): string[] {
	const availableProperties = getAvailableProperties(plugin);
	return propertyIds
		.map((id) => availableProperties.find((p) => p.id === id)?.label || id)
		.filter(Boolean);
}
