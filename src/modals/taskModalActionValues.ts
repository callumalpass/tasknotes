import type { PriorityConfig, StatusConfig } from "../types";

export { recurrenceDisplayText as getTaskModalRecurrenceDisplayText, recurrenceOrdinal as getOrdinal } from "../i18n/recurrence";

export function getDefaultTaskModalStatus(
	statusConfigs: readonly StatusConfig[] | undefined
): string {
	if (!statusConfigs || statusConfigs.length === 0) return "open";
	const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);
	return sortedStatuses[0].value;
}

export function getDefaultTaskModalPriority(
	priorityConfigs: readonly PriorityConfig[] | undefined
): string {
	if (!priorityConfigs || priorityConfigs.length === 0) return "normal";
	const sortedPriorities = [...priorityConfigs].sort((a, b) => a.weight - b.weight);
	return sortedPriorities[0].value;
}
