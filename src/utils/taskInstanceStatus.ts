import { TaskInfo } from "../types";
import { getEffectiveTaskStatus } from "../core/recurrence";
import { formatDateForStorage } from "./dateUtils";

export interface TaskInstanceStatusManager {
	getCompletedStatuses(): string[];
	isCompletedStatus(statusValue: string): boolean;
}

export function isRecurringTaskInstanceCompleted(task: TaskInfo, targetDate: Date): boolean {
	if (!task.recurrence) {
		return false;
	}

	const dateStr = formatDateForStorage(targetDate);
	const completedDates = Array.isArray(task.complete_instances) ? task.complete_instances : [];
	return completedDates.includes(dateStr);
}

export function getTaskInstanceStatus(
	task: TaskInfo,
	targetDate: Date,
	statusManager: TaskInstanceStatusManager,
	defaultStatus = "open"
): string {
	const completedStatus = statusManager.getCompletedStatuses()[0] || "done";
	const effectiveStatus =
		getEffectiveTaskStatus(task, targetDate, completedStatus) || defaultStatus;

	if (!task.recurrence || isRecurringTaskInstanceCompleted(task, targetDate)) {
		return effectiveStatus;
	}

	return statusManager.isCompletedStatus(effectiveStatus) ? defaultStatus : effectiveStatus;
}

export function isTaskInstanceCompleted(
	task: TaskInfo,
	targetDate: Date,
	statusManager: TaskInstanceStatusManager,
	defaultStatus = "open"
): boolean {
	return statusManager.isCompletedStatus(
		getTaskInstanceStatus(task, targetDate, statusManager, defaultStatus)
	);
}

export function getTaskWithInstanceStatus(
	task: TaskInfo,
	targetDate: Date,
	statusManager: TaskInstanceStatusManager,
	defaultStatus = "open"
): TaskInfo {
	const status = getTaskInstanceStatus(task, targetDate, statusManager, defaultStatus);
	return status === task.status ? task : { ...task, status };
}
