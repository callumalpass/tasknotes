import type { TaskInfo } from "../../types";
import { generateRecurringInstances, isDueByRRule } from "../../utils/helpers";
import {
	formatDateForStorage,
	getDatePart,
	getTodayString,
	isOverdueTimeAware,
	parseDateToUTC,
} from "../../utils/dateUtils";

export type AgendaDateSelectionOptions = {
	dateStr: string;
	isViewingToday: boolean;
	includeOverdue: boolean;
	isCompletedStatus(status: string): boolean;
	hideCompletedFromOverdue: boolean;
};

export type AgendaOverdueSelectionOptions = {
	isCompletedStatus(status: string): boolean;
	hideCompletedFromOverdue: boolean;
	todayString?: string;
};

function hasOverdueDateDifferentFrom(taskDate: string | undefined, dateStr: string): boolean {
	return !!taskDate && getDatePart(taskDate) !== dateStr;
}

function hasOverdueDate(
	taskDate: string | undefined,
	isCompleted: boolean,
	hideCompletedFromOverdue: boolean
): boolean {
	return !!taskDate && isOverdueTimeAware(taskDate, isCompleted, hideCompletedFromOverdue);
}

export function isTaskForAgendaDate(
	task: TaskInfo,
	options: AgendaDateSelectionOptions
): boolean {
	if (task.recurrence) {
		return isDueByRRule(task, parseDateToUTC(options.dateStr));
	}

	if (task.due && getDatePart(task.due) === options.dateStr) {
		return true;
	}

	if (task.scheduled && getDatePart(task.scheduled) === options.dateStr) {
		return true;
	}

	if (options.includeOverdue && options.isViewingToday) {
		const isCompleted = options.isCompletedStatus(task.status);
		if (
			hasOverdueDateDifferentFrom(task.due, options.dateStr) &&
			hasOverdueDate(task.due, isCompleted, options.hideCompletedFromOverdue)
		) {
			return true;
		}

		if (
			hasOverdueDateDifferentFrom(task.scheduled, options.dateStr) &&
			hasOverdueDate(task.scheduled, isCompleted, options.hideCompletedFromOverdue)
		) {
			return true;
		}
	}

	return false;
}

export function isTaskOverdueForAgenda(
	task: TaskInfo,
	options: AgendaOverdueSelectionOptions
): boolean {
	const isCompleted = options.isCompletedStatus(task.status);

	if (task.recurrence) {
		if (
			!(isCompleted && options.hideCompletedFromOverdue) &&
			hasIncompletePastRecurringInstance(task, options.todayString)
		) {
			return true;
		}

		return (
			hasOverdueDate(task.due, isCompleted, options.hideCompletedFromOverdue) ||
			hasOverdueDate(task.scheduled, isCompleted, options.hideCompletedFromOverdue)
		);
	}

	return (
		hasOverdueDate(task.due, isCompleted, options.hideCompletedFromOverdue) ||
		hasOverdueDate(task.scheduled, isCompleted, options.hideCompletedFromOverdue)
	);
}

export function hasIncompletePastRecurringInstance(
	task: TaskInfo,
	todayString = getTodayString()
): boolean {
	if (!task.recurrence) {
		return false;
	}

	const today = parseDateToUTC(todayString);
	const endDate = new Date(today);
	endDate.setUTCDate(endDate.getUTCDate() - 1);

	const startDate = getRecurringOverdueSearchStart(task, today);
	if (startDate > endDate) {
		return false;
	}

	const completedInstances = new Set(task.complete_instances || []);
	const skippedInstances = new Set(task.skipped_instances || []);
	const instances = generateRecurringInstances(task, startDate, endDate);

	return instances.some((instance) => {
		const instanceDate = formatDateForStorage(instance);
		return (
			instanceDate < todayString &&
			!completedInstances.has(instanceDate) &&
			!skippedInstances.has(instanceDate)
		);
	});
}

export function getRecurringOverdueSearchStart(task: TaskInfo, today: Date): Date {
	const fallback = new Date(today);
	fallback.setUTCFullYear(fallback.getUTCFullYear() - 2);

	const candidates = [task.dateCreated, task.scheduled, task.due]
		.map((value) => (value ? getDatePart(value) : ""))
		.filter((value) => value.length > 0)
		.map((value) => parseDateToUTC(value));

	return candidates.reduce(
		(earliest, candidate) => (candidate < earliest ? candidate : earliest),
		fallback
	);
}
