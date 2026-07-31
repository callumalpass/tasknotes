export * from "@tasknotes/model/recurrence";
export type { TaskInfo } from "../types";

import {
	addDTSTARTToRecurrenceRule as addDTSTARTToRecurrenceRuleModel,
	addDTSTARTToRecurrenceRuleWithDraggedTime as addDTSTARTToRecurrenceRuleWithDraggedTimeModel,
	getNextUncompletedOccurrence as getNextUncompletedOccurrenceModel,
	updateToNextScheduledOccurrence as updateToNextScheduledOccurrenceModel,
} from "@tasknotes/model/recurrence";
import { getTodayString } from "../utils/dateUtils";

type AddDTSTARTTaskInput = Parameters<typeof addDTSTARTToRecurrenceRuleModel>[0];
type AddDTSTARTWithDraggedTimeTaskInput = Parameters<
	typeof addDTSTARTToRecurrenceRuleWithDraggedTimeModel
>[0];
type RecurringTaskInput = Parameters<typeof getNextUncompletedOccurrenceModel>[0];
type RecurrenceUpdateTaskInput = Parameters<typeof updateToNextScheduledOccurrenceModel>[0];
type RecurrenceUpdateResult = ReturnType<typeof updateToNextScheduledOccurrenceModel>;

export function addDTSTARTToRecurrenceRule(task: AddDTSTARTTaskInput): string | null {
	return addDTSTARTToRecurrenceRuleModel(normalizeMinutePrecisionDateInputs(task));
}

export function addDTSTARTToRecurrenceRuleWithDraggedTime(
	task: AddDTSTARTWithDraggedTimeTaskInput,
	draggedStart: Date,
	allDay: boolean
): string | null {
	return addDTSTARTToRecurrenceRuleWithDraggedTimeModel(
		normalizeMinutePrecisionDateInputs(task),
		draggedStart,
		allDay
	);
}

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

function normalizeMinutePrecisionDateInputs<T extends { scheduled?: string; dateCreated?: string }>(
	task: T
): T {
	const scheduled = normalizeMinutePrecisionDateTime(task.scheduled);
	const dateCreated = normalizeMinutePrecisionDateTime(task.dateCreated);

	if (scheduled === task.scheduled && dateCreated === task.dateCreated) {
		return task;
	}

	return {
		...task,
		scheduled,
		dateCreated,
	};
}

function normalizeMinutePrecisionDateTime(value: string | undefined): string | undefined {
	if (!value) return value;

	const match = value
		.trim()
		.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/);

	if (!match) {
		return value;
	}

	const [, date, time, zone = ""] = match;
	return `${date}T${time}:00${zone}`;
}
