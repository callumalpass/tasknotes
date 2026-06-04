export * from "@tasknotes/model/recurrence";
export type { TaskInfo } from "../types";

import {
	getNextUncompletedOccurrence as getNextUncompletedOccurrenceModel,
	updateToNextScheduledOccurrence as updateToNextScheduledOccurrenceModel,
} from "@tasknotes/model/recurrence";
import { getTodayString } from "../utils/dateUtils";

type RecurringTaskInput = Parameters<typeof getNextUncompletedOccurrenceModel>[0];
type RecurrenceUpdateTaskInput = Parameters<typeof updateToNextScheduledOccurrenceModel>[0];
type RecurrenceUpdateResult = ReturnType<typeof updateToNextScheduledOccurrenceModel>;

export function getNextUncompletedOccurrence(task: RecurringTaskInput): Date | null {
	return getNextUncompletedOccurrenceModel(task, { today: getTodayString() });
}

export function updateToNextScheduledOccurrence(
	task: RecurrenceUpdateTaskInput,
	maintainDueOffset = true
): RecurrenceUpdateResult {
	return updateToNextScheduledOccurrenceModel(task, maintainDueOffset, {
		today: getTodayString(),
	});
}
