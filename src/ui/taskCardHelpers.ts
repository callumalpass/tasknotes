import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { getRecurrenceDisplayText } from "../utils/helpers";
import { extractBasesValue, resolveTaskCardPropertyLabel } from "./taskCardPresentation";

const PROPERTY_EXTRACTORS: Record<string, (task: TaskInfo) => unknown> = {
	due: (task) => task.due,
	scheduled: (task) => task.scheduled,
	projects: (task) => task.projects,
	contexts: (task) => task.contexts,
	tags: (task) => task.tags,
	blocked: (task) => task.isBlocked,
	blocking: (task) => task.isBlocking,
	blockedBy: (task) => task.blockedBy,
	blockingTasks: (task) => task.blocking,
	timeEstimate: (task) => task.timeEstimate,
	timeEntries: (task) => task.timeEntries,
	totalTrackedTime: (task) => task.totalTrackedTime,
	recurrence: (task) => task.recurrence,
	completedDate: (task) => task.completedDate,
	reminders: (task) => task.reminders,
	icsEventId: (task) => task.icsEventId,
	completeInstances: (task) => task.complete_instances,
	skippedInstances: (task) => task.skipped_instances,
	dateCreated: (task) => task.dateCreated,
	dateModified: (task) => task.dateModified,
	googleCalendarSync: (task) => task.path,
	checklistProgress: (task) => task.path,
};

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
		{ propertyLabels },
		fallbackLabels[propertyId]
	);
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

export function getTaskCardPropertyValue(
	task: TaskInfo,
	propertyId: string,
	plugin: TaskNotesPlugin
): unknown {
	try {
		const mappingKey = plugin.fieldMapper.lookupMappingKey(propertyId);
		if (mappingKey && mappingKey in PROPERTY_EXTRACTORS) {
			return PROPERTY_EXTRACTORS[mappingKey](task);
		}

		if (propertyId in PROPERTY_EXTRACTORS) {
			return PROPERTY_EXTRACTORS[propertyId](task);
		}

		if (propertyId.startsWith("user:")) {
			return getUserPropertyValue(task, propertyId, plugin);
		}

		if (task.customProperties && propertyId in task.customProperties) {
			return extractBasesValue(task.customProperties[propertyId]);
		}

		if (task.customProperties) {
			const filePropertyId = `file.${propertyId}`;
			if (filePropertyId in task.customProperties) {
				return extractBasesValue(task.customProperties[filePropertyId]);
			}
		}

		if (
			propertyId.startsWith("file.") &&
			task.basesData &&
			typeof task.basesData.getValue === "function"
		) {
			try {
				const value = task.basesData.getValue(propertyId as never);
				if (value !== null && value !== undefined) {
					return extractBasesValue(value);
				}
			} catch {
				// Bases property missing.
			}
		}

		if (propertyId.startsWith("formula.")) {
			try {
				const basesData = task.basesData;
				if (!basesData || typeof basesData.getValue !== "function") {
					return "";
				}

				const value = basesData.getValue(propertyId as never);
				if (value === null || value === undefined) {
					return "";
				}
				const extracted = extractBasesValue(value);
				return extracted !== "" ? extracted : "";
			} catch (error) {
				console.debug(`[TaskNotes] Error computing formula ${propertyId}:`, error);
				return "[Formula Error]";
			}
		}

		if (task.basesData && typeof task.basesData.getValue === "function") {
			try {
				const notePropertyId = `note.${propertyId}`;
				const value = task.basesData.getValue(notePropertyId as never);
				if (value !== null && value !== undefined) {
					return extractBasesValue(value);
				}
			} catch {
				// Property doesn't exist in Bases.
			}
		}

		if (task.path) {
			const value = getFrontmatterValue(task.path, propertyId, plugin);
			if (value !== undefined) {
				return value;
			}
		}

		return null;
	} catch (error) {
		console.warn(`TaskCard: Error getting property ${propertyId}:`, error);
		return null;
	}
}

function getUserPropertyValue(
	task: TaskInfo,
	propertyId: string,
	plugin: TaskNotesPlugin
): unknown {
	const fieldId = propertyId.slice(5);
	const userField = plugin.settings.userFields?.find((f) => f.id === fieldId);
	if (!userField?.key) {
		return null;
	}

	let value = (task as unknown as Record<string, unknown>)[userField.key];
	if (value === undefined) {
		value = getFrontmatterValue(task.path, userField.key, plugin);
	}

	return value;
}

function getFrontmatterValue(taskPath: string, key: string, plugin: TaskNotesPlugin): unknown {
	try {
		const fileMetadata = plugin.app.metadataCache.getCache(taskPath);
		if (!fileMetadata?.frontmatter) {
			return undefined;
		}
		const frontmatter = fileMetadata.frontmatter as Record<string, unknown>;
		return frontmatter[key];
	} catch (error) {
		console.warn(`TaskCard: Error accessing frontmatter for ${taskPath}:`, error);
		return undefined;
	}
}
