import type { TaskInfo } from "../types";
import { formatDateForStorage, getDatePart } from "./dateUtils";

export function getScheduledDateContextValue(
	task: TaskInfo,
	scheduledDateContext?: Date
): string | undefined {
	if (!task.recurrence || !scheduledDateContext) {
		return task.scheduled;
	}

	return formatDateForStorage(scheduledDateContext);
}

export function getTaskWithScheduledDateContext(
	task: TaskInfo,
	scheduledDateContext?: Date
): TaskInfo {
	const contextValue = getScheduledDateContextValue(task, scheduledDateContext);
	if (
		task.recurrence &&
		contextValue &&
		contextValue !== getDatePart(task.scheduled || "")
	) {
		return {
			...task,
			scheduled: contextValue,
		};
	}

	return task;
}
