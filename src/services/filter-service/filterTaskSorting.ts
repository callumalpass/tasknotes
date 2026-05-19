import { TaskInfo, TaskSortKey, SortDirection } from "../../types";
import type { TaskNotesSettings } from "../../types/settings";
import { isBeforeDateTimeAware } from "../../utils/dateUtils";
import { compareUserFieldValues, findUserFieldById } from "./userFieldValues";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/FilterService/FilterTaskSorting" });

export type FilterTaskSortingContext = {
	userFields?: TaskNotesSettings["userFields"];
	getPriorityWeight(priority: string): number;
	getStatusOrder(status: string): number;
	getUserFieldRawValue(task: TaskInfo, fieldKey: string): unknown;
};

export function sortFilterTasks(
	tasks: TaskInfo[],
	sortKey: TaskSortKey,
	direction: SortDirection,
	context: FilterTaskSortingContext
): TaskInfo[] {
	return tasks.sort((a, b) => {
		const comparison = compareTasksBySortKey(a, b, sortKey, context);

		if (comparison !== 0) {
			return direction === "desc" ? -comparison : comparison;
		}

		return applyFallbackSorting(a, b, sortKey, context);
	});
}

export function compareFilterTaskDates(dateA?: string, dateB?: string): number {
	if (!dateA && !dateB) return 0;
	if (!dateA) return 1;
	if (!dateB) return -1;

	try {
		if (isBeforeDateTimeAware(dateA, dateB)) {
			return -1;
		}
		if (isBeforeDateTimeAware(dateB, dateA)) {
			return 1;
		}
		return 0;
	} catch (error) {
		tasknotesLogger.error("Error comparing dates time-aware:", {
			category: "validation",
			operation: "comparing-dates-time-aware",
			details: { dateA, dateB },
			error: error,
		});
		return dateA.localeCompare(dateB);
	}
}

function compareTasksBySortKey(
	a: TaskInfo,
	b: TaskInfo,
	sortKey: TaskSortKey,
	context: FilterTaskSortingContext
): number {
	if (typeof sortKey === "string" && sortKey.startsWith("user:")) {
		return compareByUserField(a, b, sortKey as `user:${string}`, context);
	}

	switch (sortKey) {
		case "due":
			return compareFilterTaskDates(a.due, b.due);
		case "scheduled":
			return compareFilterTaskDates(a.scheduled, b.scheduled);
		case "priority":
			return comparePriorityWeights(a.priority, b.priority, context);
		case "status":
			return compareStatuses(a.status, b.status, context);
		case "title":
			return a.title.localeCompare(b.title);
		case "dateCreated":
			return compareFilterTaskDates(a.dateCreated, b.dateCreated);
		case "completedDate":
			return compareFilterTaskDates(a.completedDate, b.completedDate);
		case "tags":
			return compareTags(a.tags, b.tags);
		default:
			return 0;
	}
}

function comparePriorities(
	priorityA: string,
	priorityB: string,
	context: FilterTaskSortingContext
): number {
	const weightA = context.getPriorityWeight(priorityA);
	const weightB = context.getPriorityWeight(priorityB);

	return weightB - weightA;
}

function comparePriorityWeights(
	priorityA: string,
	priorityB: string,
	context: FilterTaskSortingContext
): number {
	const weightA = context.getPriorityWeight(priorityA);
	const weightB = context.getPriorityWeight(priorityB);

	return weightA - weightB;
}

function compareStatuses(
	statusA: string,
	statusB: string,
	context: FilterTaskSortingContext
): number {
	return context.getStatusOrder(statusA) - context.getStatusOrder(statusB);
}

function compareTags(tagsA: string[] | undefined, tagsB: string[] | undefined): number {
	const normalizedTagsA = tagsA && tagsA.length > 0 ? tagsA : [];
	const normalizedTagsB = tagsB && tagsB.length > 0 ? tagsB : [];

	if (normalizedTagsA.length === 0 && normalizedTagsB.length === 0) {
		return 0;
	}
	if (normalizedTagsA.length === 0) return 1;
	if (normalizedTagsB.length === 0) return -1;

	return normalizedTagsA[0].toLowerCase().localeCompare(normalizedTagsB[0].toLowerCase());
}

function applyFallbackSorting(
	a: TaskInfo,
	b: TaskInfo,
	primarySortKey: TaskSortKey,
	context: FilterTaskSortingContext
): number {
	const fallbackOrder: TaskSortKey[] = ["due", "scheduled", "priority", "title"];
	const fallbacks = fallbackOrder.filter((key) => key !== primarySortKey);

	for (const fallbackKey of fallbacks) {
		let comparison = 0;

		switch (fallbackKey) {
			case "scheduled":
				comparison = compareFilterTaskDates(a.scheduled, b.scheduled);
				break;
			case "due":
				comparison = compareFilterTaskDates(a.due, b.due);
				break;
			case "priority":
				comparison = comparePriorities(a.priority, b.priority, context);
				break;
			case "title":
				comparison = a.title.localeCompare(b.title);
				break;
		}

		if (comparison !== 0) {
			return comparison;
		}
	}

	return 0;
}

function compareByUserField(
	a: TaskInfo,
	b: TaskInfo,
	sortKey: `user:${string}`,
	context: FilterTaskSortingContext
): number {
	const fieldId = sortKey.slice(5);
	const field = findUserFieldById(context.userFields || [], fieldId);
	if (!field) return 0;

	return compareUserFieldValues(
		field,
		context.getUserFieldRawValue(a, field.key),
		context.getUserFieldRawValue(b, field.key)
	);
}
