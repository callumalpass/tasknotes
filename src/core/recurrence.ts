export * from "@tasknotes/model/recurrence";
export type { TaskInfo } from "../types";

import {
	addDTSTARTToRecurrenceRule as addDTSTARTToRecurrenceRuleModel,
	addDTSTARTToRecurrenceRuleWithDraggedTime as addDTSTARTToRecurrenceRuleWithDraggedTimeModel,
	generateRecurringInstances as generateRecurringInstancesModel,
	getFiniteRecurringInstanceCount as getFiniteRecurringInstanceCountModel,
	getNextUncompletedOccurrence as getNextUncompletedOccurrenceModel,
	updateToNextScheduledOccurrence as updateToNextScheduledOccurrenceModel,
} from "@tasknotes/model/recurrence";
import { formatDateForStorage, getTodayString, parseDateToUTC } from "../utils/dateUtils";

type AddDTSTARTTaskInput = Parameters<typeof addDTSTARTToRecurrenceRuleModel>[0];
type AddDTSTARTWithDraggedTimeTaskInput = Parameters<
	typeof addDTSTARTToRecurrenceRuleWithDraggedTimeModel
>[0];
type RecurringTaskInput = Parameters<typeof getNextUncompletedOccurrenceModel>[0];
type RecurrenceUpdateTaskInput = Parameters<typeof updateToNextScheduledOccurrenceModel>[0];
type RecurrenceUpdateResult = ReturnType<typeof updateToNextScheduledOccurrenceModel>;

export interface RecurrenceOccurrenceOptions {
	minOccurrenceDate?: string;
}

type SeriesEndTaskInput = Parameters<typeof getFiniteRecurringInstanceCountModel>[0] & {
	complete_instances?: string[];
	skipped_instances?: string[];
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A bounded series (COUNT or UNTIL) has ended once every occurrence its rule
 * generates is completed or skipped. Open-ended rules never end, and recorded
 * dates that are not occurrences of the rule do not count.
 */
export function hasRecurringSeriesEnded(task: SeriesEndTaskInput): boolean {
	const total = getFiniteRecurringInstanceCountModel(task);
	if (total === null) return false;

	const processed = Array.from(
		new Set(
			[...(task.complete_instances ?? []), ...(task.skipped_instances ?? [])].filter(
				(date): date is string => typeof date === "string" && DATE_ONLY.test(date)
			)
		)
	).sort();
	if (processed.length < total) return false;

	const processedDates = new Set(processed);
	const processedOccurrences = new Set(
		generateRecurringInstancesModel(
			task,
			parseDateToUTC(processed[0]),
			parseDateToUTC(processed[processed.length - 1])
		)
			.map((occurrence) => formatDateForStorage(occurrence))
			.filter((date) => processedDates.has(date))
	);
	return processedOccurrences.size >= total;
}

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

export function getNextUncompletedOccurrence(
	task: RecurringTaskInput,
	options?: RecurrenceOccurrenceOptions
): Date | null {
	return getNextUncompletedOccurrenceModel(task, {
		today: options?.minOccurrenceDate ?? getTodayString(),
	});
}

export function updateToNextScheduledOccurrence(
	task: RecurrenceUpdateTaskInput,
	maintainDueOffset = true,
	options?: RecurrenceOccurrenceOptions
): RecurrenceUpdateResult {
	return updateToNextScheduledOccurrenceModel(task, maintainDueOffset, {
		today: options?.minOccurrenceDate ?? getTodayString(),
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

	const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/);

	if (!match) {
		return value;
	}

	const [, date, time, zone = ""] = match;
	return `${date}T${time}:00${zone}`;
}
