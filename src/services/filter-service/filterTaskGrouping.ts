import { format, parseISO } from "date-fns";
import { TranslationKey } from "../../i18n";
import { TaskGroupKey, TaskInfo, TaskSortKey, SortDirection } from "../../types";
import type { TaskNotesSettings } from "../../types/settings";
import {
	getDatePart,
	getTodayString,
	isBeforeDateSafe,
	isOverdueTimeAware,
	isSameDateSafe,
} from "../../utils/dateUtils";
import { filterEmptyProjects, isDueByRRule } from "../../utils/helpers";
import {
	findUserFieldById,
	getUserFieldGroupValue as getUserFieldGroupBucket,
	sortUserFieldGroupKeys,
} from "./userFieldValues";

type DueGroupCode =
	| "overdue"
	| "today"
	| "tomorrow"
	| "nextSevenDays"
	| "later"
	| "none"
	| "invalid";

type ScheduledGroupCode =
	| "past"
	| "today"
	| "tomorrow"
	| "nextSevenDays"
	| "later"
	| "none"
	| "invalid";

export type FilterTaskGroupingContext = {
	userFields?: TaskNotesSettings["userFields"];
	hideCompletedFromOverdue?: boolean;
	currentSortKey?: TaskSortKey;
	currentSortDirection?: SortDirection;
	isCompletedStatus(status: string): boolean;
	getPriorityWeight(priority: string): number;
	getStatusOrder(status: string): number;
	getUserFieldRawValue(task: TaskInfo, fieldKey: string): unknown;
	resolveProjectToAbsolutePath(projectValue: string): string;
	translate(
		key: TranslationKey,
		fallback: string,
		vars?: Record<string, string | number>
	): string;
	getLocale(): string;
};

export function groupFilterTasks(
	tasks: TaskInfo[],
	groupKey: TaskGroupKey,
	context: FilterTaskGroupingContext,
	targetDate?: Date
): Map<string, TaskInfo[]> {
	if (groupKey === "none") {
		return new Map([["all", tasks]]);
	}

	const groups = new Map<string, TaskInfo[]>();

	for (const task of tasks) {
		const groupValues = getGroupValuesForTask(task, groupKey, context, targetDate);
		for (const groupValue of groupValues) {
			if (!groups.has(groupValue)) {
				groups.set(groupValue, []);
			}
			groups.get(groupValue)?.push(task);
		}
	}

	return sortFilterTaskGroups(groups, groupKey, context);
}

export function sortFilterTaskGroups(
	groups: Map<string, TaskInfo[]>,
	groupKey: TaskGroupKey,
	context: FilterTaskGroupingContext
): Map<string, TaskInfo[]> {
	const sortedGroups = new Map<string, TaskInfo[]>();
	const sortedKeys = getSortedGroupKeys(groups, groupKey, context);

	for (const key of sortedKeys) {
		const group = groups.get(key);
		if (group) {
			sortedGroups.set(key, group);
		}
	}

	return sortedGroups;
}

export function getDueDateGroupForFilterTask(
	task: TaskInfo,
	context: FilterTaskGroupingContext,
	targetDate?: Date
): string {
	const referenceDate = targetDate || new Date();
	referenceDate.setHours(0, 0, 0, 0);

	const isCompleted = context.isCompletedStatus(task.status);
	const hideCompletedFromOverdue = context.hideCompletedFromOverdue ?? true;

	if (task.recurrence) {
		if (isDueByRRule(task, referenceDate)) {
			const referenceDateStr = format(referenceDate, "yyyy-MM-dd");
			return getDueDateGroupFromDateString(
				referenceDateStr,
				context,
				isCompleted,
				hideCompletedFromOverdue
			);
		}

		if (task.due) {
			return getDueDateGroupFromDateString(
				task.due,
				context,
				isCompleted,
				hideCompletedFromOverdue
			);
		}
		return getDueGroupLabel("none", context);
	}

	if (!task.due) return getDueGroupLabel("none", context);
	return getDueDateGroupFromDateString(
		task.due,
		context,
		isCompleted,
		hideCompletedFromOverdue
	);
}

export function getScheduledDateGroupForFilterTask(
	task: TaskInfo,
	context: FilterTaskGroupingContext
): string {
	if (!task.scheduled) return getScheduledGroupLabel("none", context);

	return getScheduledDateGroupFromDateString(
		task.scheduled,
		context,
		context.isCompletedStatus(task.status),
		context.hideCompletedFromOverdue ?? true
	);
}

function getGroupValuesForTask(
	task: TaskInfo,
	groupKey: TaskGroupKey,
	context: FilterTaskGroupingContext,
	targetDate?: Date
): string[] {
	if (groupKey === "project") {
		const filteredProjects = filterEmptyProjects(task.projects || []);
		if (filteredProjects.length === 0) {
			return [getNoProjectLabel(context)];
		}
		return filteredProjects.map((project) => context.resolveProjectToAbsolutePath(project));
	}

	if (groupKey === "tags") {
		const taskTags = task.tags || [];
		return taskTags.length > 0 ? taskTags : [getNoTagsLabel(context)];
	}

	if (typeof groupKey === "string" && groupKey.startsWith("user:")) {
		return [getUserFieldGroupValue(task, groupKey, context)];
	}

	switch (groupKey) {
		case "status":
			return [task.status || "no-status"];
		case "priority":
			return [task.priority || "unknown"];
		case "context":
			return [task.contexts && task.contexts.length > 0 ? task.contexts[0] : "none"];
		case "due":
			return [getDueDateGroupForFilterTask(task, context, targetDate)];
		case "scheduled":
			return [getScheduledDateGroupForFilterTask(task, context)];
		case "completedDate":
			return [getCompletedDateGroup(task, context)];
		default:
			return ["unknown"];
	}
}

function getSortedGroupKeys(
	groups: Map<string, TaskInfo[]>,
	groupKey: TaskGroupKey,
	context: FilterTaskGroupingContext
): string[] {
	if (typeof groupKey === "string" && groupKey.startsWith("user:")) {
		const sortedKeys = sortUserFieldGroups(Array.from(groups.keys()), groupKey, context);
		if (context.currentSortKey === groupKey && context.currentSortDirection === "desc") {
			sortedKeys.reverse();
		}
		return sortedKeys;
	}

	switch (groupKey) {
		case "priority":
			return Array.from(groups.keys()).sort(
				(a, b) => context.getPriorityWeight(b) - context.getPriorityWeight(a)
			);

		case "status":
			return Array.from(groups.keys()).sort(
				(a, b) => context.getStatusOrder(a) - context.getStatusOrder(b)
			);

		case "due": {
			const dueOrderKeys: Array<Exclude<DueGroupCode, "invalid">> = [
				"overdue",
				"today",
				"tomorrow",
				"nextSevenDays",
				"later",
				"none",
			];
			const dueOrderMap = new Map(
				dueOrderKeys.map((key, index) => [getDueGroupLabel(key, context), index])
			);
			return Array.from(groups.keys()).sort((a, b) => {
				const indexA = dueOrderMap.get(a) ?? dueOrderKeys.length;
				const indexB = dueOrderMap.get(b) ?? dueOrderKeys.length;
				return indexA - indexB;
			});
		}

		case "scheduled": {
			const scheduledOrderKeys: Array<Exclude<ScheduledGroupCode, "invalid">> = [
				"past",
				"today",
				"tomorrow",
				"nextSevenDays",
				"later",
				"none",
			];
			const scheduledOrderMap = new Map(
				scheduledOrderKeys.map((key, index) => [
					getScheduledGroupLabel(key, context),
					index,
				])
			);
			return Array.from(groups.keys()).sort((a, b) => {
				const indexA = scheduledOrderMap.get(a) ?? scheduledOrderKeys.length;
				const indexB = scheduledOrderMap.get(b) ?? scheduledOrderKeys.length;
				return indexA - indexB;
			});
		}

		case "project":
			return Array.from(groups.keys()).sort((a, b) =>
				sortAlphaWithTrailingFallback(a, b, getNoProjectLabel(context), context.getLocale())
			);

		case "tags":
			return Array.from(groups.keys()).sort((a, b) =>
				sortAlphaWithTrailingFallback(a, b, getNoTagsLabel(context), context.getLocale())
			);

		case "completedDate":
			return Array.from(groups.keys()).sort((a, b) => {
				if (a === "Not completed") return 1;
				if (b === "Not completed") return -1;
				if (a === "Invalid date") return 1;
				if (b === "Invalid date") return -1;
				if (a == null || b == null) {
					if (a == null) return 1;
					if (b == null) return -1;
				}
				return b.localeCompare(a);
			});

		default:
			return Array.from(groups.keys()).sort((a, b) =>
				a == null ? 1 : b == null ? -1 : a.localeCompare(b, context.getLocale())
			);
	}
}

function getUserFieldGroupValue(
	task: TaskInfo,
	groupKey: string,
	context: FilterTaskGroupingContext
): string {
	const fieldId = groupKey.slice(5);
	const field = findUserFieldById(context.userFields || [], fieldId);
	const raw = field ? context.getUserFieldRawValue(task, field.key) : undefined;
	return getUserFieldGroupBucket(field, raw);
}

function getDueDateGroupFromDateString(
	dateString: string,
	context: FilterTaskGroupingContext,
	isCompleted: boolean,
	hideCompletedFromOverdue: boolean
): string {
	const todayStr = getTodayString();

	if (isOverdueTimeAware(dateString, isCompleted, hideCompletedFromOverdue)) {
		return getDueGroupLabel("overdue", context);
	}

	const datePart = getDatePart(dateString);
	if (isSameDateSafe(datePart, todayStr)) return getDueGroupLabel("today", context);

	try {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
		if (isSameDateSafe(datePart, tomorrowStr)) {
			return getDueGroupLabel("tomorrow", context);
		}

		const thisWeek = new Date();
		thisWeek.setDate(thisWeek.getDate() + 7);
		const thisWeekStr = format(thisWeek, "yyyy-MM-dd");
		if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr)) {
			return getDueGroupLabel("nextSevenDays", context);
		}

		return getDueGroupLabel("later", context);
	} catch (error) {
		console.error(`Error categorizing date ${dateString}:`, error);
		return getInvalidDateLabel(context);
	}
}

function getScheduledDateGroupFromDateString(
	scheduledDate: string,
	context: FilterTaskGroupingContext,
	isCompleted: boolean,
	hideCompletedFromOverdue: boolean
): string {
	const todayStr = getTodayString();

	if (isOverdueTimeAware(scheduledDate, isCompleted, hideCompletedFromOverdue)) {
		return getScheduledGroupLabel("past", context);
	}

	const datePart = getDatePart(scheduledDate);
	if (isSameDateSafe(datePart, todayStr)) return getScheduledGroupLabel("today", context);

	try {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
		if (isSameDateSafe(datePart, tomorrowStr)) {
			return getScheduledGroupLabel("tomorrow", context);
		}

		const thisWeek = new Date();
		thisWeek.setDate(thisWeek.getDate() + 7);
		const thisWeekStr = format(thisWeek, "yyyy-MM-dd");
		if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr)) {
			return getScheduledGroupLabel("nextSevenDays", context);
		}

		return getScheduledGroupLabel("later", context);
	} catch (error) {
		console.error(`Error categorizing scheduled date ${scheduledDate}:`, error);
		return getInvalidDateLabel(context);
	}
}

function getCompletedDateGroup(task: TaskInfo, context: FilterTaskGroupingContext): string {
	if (!task.completedDate) return "Not completed";

	try {
		return format(parseISO(task.completedDate), "yyyy-MM-dd");
	} catch (error) {
		console.error(`Error formatting completed date ${task.completedDate}:`, error);
		return getInvalidDateLabel(context);
	}
}

function sortUserFieldGroups(
	groupKeys: string[],
	groupKey: string,
	context: FilterTaskGroupingContext
): string[] {
	const fieldId = groupKey.slice(5);
	const field = findUserFieldById(context.userFields || [], fieldId);
	return sortUserFieldGroupKeys(groupKeys, field);
}

function sortAlphaWithTrailingFallback(
	a: string,
	b: string,
	fallbackLabel: string,
	locale: string
): number {
	if (a === fallbackLabel) return 1;
	if (b === fallbackLabel) return -1;
	if (a == null) return 1;
	if (b == null) return -1;
	return a.localeCompare(b, locale);
}

function getDueGroupLabel(code: DueGroupCode, context: FilterTaskGroupingContext): string {
	switch (code) {
		case "overdue":
			return context.translate("services.filter.groupLabels.due.overdue", "Overdue");
		case "today":
			return context.translate("services.filter.groupLabels.due.today", "Today");
		case "tomorrow":
			return context.translate("services.filter.groupLabels.due.tomorrow", "Tomorrow");
		case "nextSevenDays":
			return context.translate(
				"services.filter.groupLabels.due.nextSevenDays",
				"Next seven days"
			);
		case "later":
			return context.translate("services.filter.groupLabels.due.later", "Later");
		case "none":
			return context.translate("services.filter.groupLabels.due.none", "No due date");
		case "invalid":
		default:
			return getInvalidDateLabel(context);
	}
}

function getScheduledGroupLabel(
	code: ScheduledGroupCode,
	context: FilterTaskGroupingContext
): string {
	switch (code) {
		case "past":
			return context.translate("services.filter.groupLabels.scheduled.past", "Past scheduled");
		case "today":
			return context.translate("services.filter.groupLabels.scheduled.today", "Today");
		case "tomorrow":
			return context.translate(
				"services.filter.groupLabels.scheduled.tomorrow",
				"Tomorrow"
			);
		case "nextSevenDays":
			return context.translate(
				"services.filter.groupLabels.scheduled.nextSevenDays",
				"Next seven days"
			);
		case "later":
			return context.translate("services.filter.groupLabels.scheduled.later", "Later");
		case "none":
			return context.translate(
				"services.filter.groupLabels.scheduled.none",
				"No scheduled date"
			);
		case "invalid":
		default:
			return getInvalidDateLabel(context);
	}
}

function getNoProjectLabel(context: FilterTaskGroupingContext): string {
	return context.translate("services.filter.groupLabels.noProject", "No project");
}

function getNoTagsLabel(context: FilterTaskGroupingContext): string {
	return context.translate("services.filter.groupLabels.noTags", "No tags");
}

function getInvalidDateLabel(context: FilterTaskGroupingContext): string {
	return context.translate("services.filter.groupLabels.invalidDate", "Invalid date");
}
