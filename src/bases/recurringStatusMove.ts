import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { formatDateForStorage } from "../utils/dateUtils";

type OccurrenceDate = (task: TaskInfo) => Date;

export type RecurringStatusMove = {
	plugin: Pick<TaskNotesPlugin, "cacheManager" | "statusManager" | "toggleRecurringTaskComplete">;
	path: string;
	status: string | null;
	shownOccurrence: string | undefined;
	getOccurrenceDate: OccurrenceDate;
};

/** The occurrence a rendered card acts on, read when the user acts rather than when the write lands. */
export function getShownOccurrence(
	task: TaskInfo | undefined,
	getOccurrenceDate: OccurrenceDate
): string | undefined {
	return task?.recurrence ? formatDateForStorage(getOccurrenceDate(task)) : undefined;
}

/**
 * A completed status on a recurring task ends the whole series, so moving its
 * card onto one completes the occurrence the card showed instead, as its
 * checkbox does. The series then advances, so a repeated or late move leaves the
 * task alone rather than completing the next occurrence; completeOnly stops one
 * from reopening this occurrence if it finishes after this check. Returns whether
 * the move is settled here, in which case the caller must not write the status.
 */
export async function completeOccurrenceForStatusMove({
	plugin,
	path,
	status,
	shownOccurrence,
	getOccurrenceDate,
}: RecurringStatusMove): Promise<boolean> {
	const { cacheManager, statusManager } = plugin;
	if (status === null || !statusManager.isCompletedStatus(status)) return false;

	const task = await cacheManager.getTaskInfo(path);
	if (!task?.recurrence || statusManager.isCompletedStatus(task.status)) return false;

	if (
		shownOccurrence &&
		getShownOccurrence(task, getOccurrenceDate) === shownOccurrence &&
		!task.complete_instances?.includes(shownOccurrence) &&
		!task.skipped_instances?.includes(shownOccurrence)
	) {
		await plugin.toggleRecurringTaskComplete(task, getOccurrenceDate(task), {
			completeOnly: true,
		});
	}
	return true;
}
