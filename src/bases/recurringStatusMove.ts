import { msg } from "@lingui/core/macro";
import { Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import { uiText } from "../i18n/runtime";
import type { TaskInfo } from "../types";
import { formatDateForStorage } from "../utils/dateUtils";

type OccurrenceDate = (task: TaskInfo) => Date;

export type ShownOccurrence = {
	date: string;
	scheduled: string | undefined;
};

export type RecurringStatusMove = {
	plugin: Pick<TaskNotesPlugin, "cacheManager" | "statusManager" | "toggleRecurringTaskComplete">;
	path: string;
	status: string | null;
	shownOccurrence: ShownOccurrence | undefined;
	getOccurrenceDate: OccurrenceDate;
};

/** The occurrence a rendered card acts on, read when the user acts rather than when the write lands. */
export function getShownOccurrence(
	task: TaskInfo | undefined,
	getOccurrenceDate: OccurrenceDate
): ShownOccurrence | undefined {
	return task?.recurrence
		? { date: formatDateForStorage(getOccurrenceDate(task)), scheduled: task.scheduled }
		: undefined;
}

/**
 * A status belongs to the whole recurring task, so writing a completed one
 * completes no occurrence and leaves every later occurrence in that status. Moving
 * a card onto one therefore completes the occurrence the card showed, as its
 * checkbox does. A repeated or late move leaves an occurrence that has since been
 * completed, skipped or rescheduled alone, and the operation repeats this check on
 * the read that decides its write. Returns whether the move is settled here, in
 * which case the caller must not write the status.
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

	const isStillOpen = (current: TaskInfo): boolean => {
		const occurrence = getShownOccurrence(current, getOccurrenceDate);
		return (
			!!shownOccurrence &&
			occurrence?.date === shownOccurrence.date &&
			occurrence.scheduled === shownOccurrence.scheduled &&
			!current.complete_instances?.includes(shownOccurrence.date) &&
			!current.skipped_instances?.includes(shownOccurrence.date)
		);
	};
	if (!isStillOpen(task)) {
		new Notice(
			uiText(
				msg({
					message: "That occurrence was already completed, skipped or rescheduled.",
					context: "views.recurringStatusMove.stale",
				})
			)
		);
		return true;
	}
	await plugin.toggleRecurringTaskComplete(task, getOccurrenceDate(task), {
		onlyIf: isStillOpen,
	});
	return true;
}
