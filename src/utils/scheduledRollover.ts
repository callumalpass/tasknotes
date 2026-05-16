import type { TaskInfo } from "../types";
import { getCurrentDateString, getDatePart, isBeforeDateSafe } from "../core/date";

export interface ScheduledRolloverCandidate {
	task: TaskInfo;
	nextScheduled: string;
}

export function buildRolledOverScheduledDate(
	scheduled: string,
	today = getCurrentDateString()
): string {
	const timeSeparatorIndex = scheduled.indexOf("T");
	if (timeSeparatorIndex === -1) {
		return today;
	}

	return `${today}${scheduled.slice(timeSeparatorIndex)}`;
}

export function getOverdueScheduledRolloverCandidates(
	tasks: TaskInfo[],
	isCompletedStatus: (status: string) => boolean,
	today = getCurrentDateString()
): ScheduledRolloverCandidate[] {
	const candidates: ScheduledRolloverCandidate[] = [];

	for (const task of tasks) {
		if (!task.scheduled || task.archived || isCompletedStatus(task.status)) {
			continue;
		}

		const scheduledDatePart = getDatePart(task.scheduled);
		if (!scheduledDatePart || !isBeforeDateSafe(scheduledDatePart, today)) {
			continue;
		}

		candidates.push({
			task,
			nextScheduled: buildRolledOverScheduledDate(task.scheduled, today),
		});
	}

	return candidates;
}
