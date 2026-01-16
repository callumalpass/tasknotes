import type TaskNotesPlugin from "../main";
import type { FieldMapping } from "../types";

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
	const makeLabel = (displayName: string, mappingKey: keyof FieldMapping): string => {
		const userPropertyName = plugin.fieldMapper.toUserField(mappingKey);
		// Only show the property name if it differs from the display name (lowercased)
		if (userPropertyName !== displayName.toLowerCase().replace(/\s+/g, "")) {
			return `${displayName} (${userPropertyName})`;
		}
		return displayName;
	};

	// Core properties using FieldMapping keys as IDs
	const coreProperties = [
		{ id: "status", label: makeLabel("Status", "status") },
		{ id: "priority", label: makeLabel("Priority", "priority") },
		{ id: "blocked", label: "Blocked Status" }, // Special property, not in FieldMapping
		{ id: "blocking", label: "Blocking Status" }, // Special property, not in FieldMapping
		{ id: "progress", label: "Progress" }, // Computed property based on top-level checkboxes
		{ id: "due", label: makeLabel("Due Date", "due") },
		{ id: "scheduled", label: makeLabel("Scheduled Date", "scheduled") },
		{ id: "timeEstimate", label: makeLabel("Time Estimate", "timeEstimate") },
		{ id: "totalTrackedTime", label: "Total Tracked Time" }, // Computed property, not in FieldMapping
		{ id: "recurrence", label: makeLabel("Recurrence", "recurrence") },
		{ id: "completeInstances", label: makeLabel("Completed Instances", "completeInstances") },
		{ id: "skippedInstances", label: makeLabel("Skipped Instances", "skippedInstances") },
		{ id: "completedDate", label: makeLabel("Completed Date", "completedDate") },
		{ id: "dateCreated", label: makeLabel("Created Date", "dateCreated") },
		{ id: "dateModified", label: makeLabel("Modified Date", "dateModified") },
		{ id: "projects", label: makeLabel("Projects", "projects") },
		{ id: "contexts", label: makeLabel("Contexts", "contexts") },
		{ id: "tags", label: "Tags" }, // Special property, not in FieldMapping
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
export function getPropertyLabels(
	plugin: TaskNotesPlugin,
	propertyIds: string[]
): string[] {
	const availableProperties = getAvailableProperties(plugin);
	return propertyIds
		.map((id) => availableProperties.find((p) => p.id === id)?.label || id)
		.filter(Boolean);
}
