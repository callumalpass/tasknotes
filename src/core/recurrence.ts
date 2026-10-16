export * from "@tasknotes/model/recurrence";
export type { TaskInfo } from "../types";

import {
	addDTSTARTToRecurrenceRule as addDTSTARTToRecurrenceRuleModel,
	addDTSTARTToRecurrenceRuleWithDraggedTime as addDTSTARTToRecurrenceRuleWithDraggedTimeModel,
	getNextUncompletedOccurrence as getNextUncompletedOccurrenceModel,
updateToNextScheduledOccurrence as updateToNextScheduledOccurrenceModel,
	generateRecurringInstances as generateRecurringInstancesModel,
	isDueByRRule as isDueByRRuleModel,
	shouldShowRecurringTaskOnDate as shouldShowRecurringTaskOnDateModel,
	getFiniteRecurringInstanceCount as getFiniteRecurringInstanceCountModel,
	getRecurrenceDisplayText as getRecurrenceDisplayTextModel,
} from "@tasknotes/model/recurrence";
import { getTodayString } from "../utils/dateUtils";

type AddDTSTARTTaskInput = Parameters<typeof addDTSTARTToRecurrenceRuleModel>[0];
type AddDTSTARTWithDraggedTimeTaskInput = Parameters<
	typeof addDTSTARTToRecurrenceRuleWithDraggedTimeModel
>[0];
type RecurringTaskInput = Parameters<typeof getNextUncompletedOccurrenceModel>[0];
type RecurrenceUpdateTaskInput = Parameters<typeof updateToNextScheduledOccurrenceModel>[0];
type RecurrenceUpdateResult = ReturnType<typeof updateToNextScheduledOccurrenceModel>;
type GenerateInstancesTaskInput = Parameters<typeof generateRecurringInstancesModel>[0];
type FiniteInstanceCountTaskInput = Parameters<typeof getFiniteRecurringInstanceCountModel>[0];
type IsDueTaskInput = Parameters<typeof isDueByRRuleModel>[0];
type ShouldShowTaskInput = Parameters<typeof shouldShowRecurringTaskOnDateModel>[0];

export interface RecurrenceOccurrenceOptions {
	minOccurrenceDate?: string;
}

/**
 * Extract the "end after done N times" cap encoded in a recurrence rule as the
 * non-standard ENDONDONE property, or null when the rule carries no such cap.
 */
export function getRecurrenceEndAfterDoneCount(recurrence?: string | null): number | null {
if (!recurrence || typeof recurrence !== "string") return null;
	const match = recurrence.match(/(?:^|;)ENDONDONE=(\d+)(?:;|$)/);
	if (!match) return null;
	const count = Number.parseInt(match[1], 10);
	return Number.isFinite(count) && count > 0 ? count : null;
}

/**
 * A rule carrying ENDONDONE is "terminated" once the task has been completed at
 * least ENDONDONE times. Termination is derived purely from round-trippable
 * fields (the rule + complete_instances), so un-completing instances that drop
 * the count back below the cap resumes the recurrence automatically.
 */
export function isRecurrenceTerminated(task: {
	recurrence?: string;
	complete_instances?: string[];
}): boolean {
	const cap = getRecurrenceEndAfterDoneCount(task.recurrence);
	if (cap === null) return false;
	return (task.complete_instances?.length ?? 0) >= cap;
}

/**
 * ENDONDONE is not a valid RFC 5545 RRULE part and the underlying rrule parser
 * rejects it, so any rule handed to a parse-based model function must have it
 * removed first. Rules without ENDONDONE are returned unchanged.
 */
export function stripEndAfterDoneFromRecurrence(recurrence?: string): string | undefined {
if (!recurrence || typeof recurrence !== "string") return recurrence;
	const parts = recurrence.split(";").filter((part) => !/^ENDONDONE=\d+$/.test(part));
	const stripped = parts.join(";");
	return stripped === recurrence ? recurrence : stripped || undefined;
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
	if (isRecurrenceTerminated(task)) {
		return null;
	}
	return getNextUncompletedOccurrenceModel(stripForModel(task), {
		today: options?.minOccurrenceDate ?? getTodayString(),
	});
}

export function updateToNextScheduledOccurrence(
	task: RecurrenceUpdateTaskInput,
	maintainDueOffset = true,
	options?: RecurrenceOccurrenceOptions
): RecurrenceUpdateResult {
	if (isRecurrenceTerminated(task)) {
		return { scheduled: null, due: null };
	}
	return updateToNextScheduledOccurrenceModel(
		stripForModel(task),
		maintainDueOffset,
		{
			today: options?.minOccurrenceDate ?? getTodayString(),
		}
	);
}
export function generateRecurringInstances(
	task: GenerateInstancesTaskInput & { complete_instances?: string[] },
	startDate: Date,
	endDate: Date
): Date[] {
	if (isRecurrenceTerminated(task)) {
		return [];
	}
	return generateRecurringInstancesModel(stripForModel(task), startDate, endDate);
}

export function isDueByRRule(
	task: IsDueTaskInput,
	date: Date
): boolean {
	if (isRecurrenceTerminated(task)) {
		return false;
	}
	return isDueByRRuleModel(stripForModel(task), date);
}

export function shouldShowRecurringTaskOnDate(
	task: ShouldShowTaskInput,
	targetDate: Date
): boolean {
	if (isRecurrenceTerminated(task)) {
		return false;
	}
	return shouldShowRecurringTaskOnDateModel(stripForModel(task), targetDate);
}

export function getFiniteRecurringInstanceCount(
	task: FiniteInstanceCountTaskInput & { complete_instances?: string[] }
): number | null {
	const cap = getRecurrenceEndAfterDoneCount(task.recurrence);
	if (cap !== null) {
		return cap;
	}
	return getFiniteRecurringInstanceCountModel(stripForModel(task));
}

export function getRecurrenceDisplayText(recurrence: string): string {
	return getRecurrenceDisplayTextModel(stripEndAfterDoneFromRecurrence(recurrence) ?? "");
}

function stripForModel<T extends { recurrence?: string; complete_instances?: string[] }>(
	task: T
): T {
	const stripped = stripEndAfterDoneFromRecurrence(task.recurrence);
	if (stripped === task.recurrence) {
		return task;
	}
	return { ...task, recurrence: stripped };
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
