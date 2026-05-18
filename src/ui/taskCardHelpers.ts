import TaskNotesPlugin from "../main";
import { getRecurrenceDisplayText } from "../utils/helpers";
import { resolveTaskCardPropertyLabel } from "./taskCardPresentation";

export { getTaskCardPropertyValue } from "./taskCardPropertyAccess";

function tTaskCard(
	plugin: TaskNotesPlugin,
	key: string,
	vars?: Record<string, string | number>
): string {
	return plugin.i18n.translate(`ui.taskCard.${key}`, vars);
}

export function getTaskCardPropertyLabel(
	propertyId: string,
	plugin: TaskNotesPlugin,
	propertyLabels?: Record<string, string>
): string {
	const directOverride = propertyLabels?.[propertyId];
	if (directOverride && directOverride.trim() !== "") {
		return directOverride;
	}

	const mappedOverride = getMappedPropertyLabel(propertyId, plugin, propertyLabels);
	const fallbackLabels: Record<string, string> = {
		due: tTaskCard(plugin, "labels.due"),
		scheduled: tTaskCard(plugin, "labels.scheduled"),
		recurrence: tTaskCard(plugin, "labels.recurrence"),
		completedDate: tTaskCard(plugin, "labels.completed"),
		dateCreated: tTaskCard(plugin, "labels.created"),
		dateModified: tTaskCard(plugin, "labels.modified"),
		blocked: tTaskCard(plugin, "labels.blocked"),
		blocking: tTaskCard(plugin, "labels.blocking"),
	};

	return resolveTaskCardPropertyLabel(
		propertyId,
		{ propertyLabels: mappedOverride ? { [propertyId]: mappedOverride } : propertyLabels },
		fallbackLabels[propertyId]
	);
}

function getMappedPropertyLabel(
	propertyId: string,
	plugin: TaskNotesPlugin,
	propertyLabels?: Record<string, string>
): string | undefined {
	if (!propertyLabels) {
		return undefined;
	}

	for (const [candidatePropertyId, label] of Object.entries(propertyLabels)) {
		if (candidatePropertyId === propertyId || label.trim() === "") {
			continue;
		}

		if (plugin.fieldMapper?.lookupMappingKey?.(candidatePropertyId) === propertyId) {
			return label;
		}
	}

	return undefined;
}

export function getRecurrenceTooltip(
	plugin: TaskNotesPlugin,
	recurrence: string,
	propertyLabels?: Record<string, string>
): string {
	return tTaskCard(plugin, "recurrenceTooltip", {
		label: getTaskCardPropertyLabel("recurrence", plugin, propertyLabels),
		value: getRecurrenceDisplayText(recurrence),
	});
}

export function getReminderTooltip(plugin: TaskNotesPlugin, count: number): string {
	return count === 1
		? tTaskCard(plugin, "reminderTooltipOne")
		: tTaskCard(plugin, "reminderTooltipMany", { count });
}

export function getChevronTooltip(plugin: TaskNotesPlugin, expanded: boolean): string {
	return expanded
		? tTaskCard(plugin, "collapseSubtasks")
		: tTaskCard(plugin, "expandSubtasks");
}
