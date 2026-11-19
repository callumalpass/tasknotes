import type { TaskInfo } from "../../types";
import { normalizeRecurrenceOriginalDate } from "../../core/fieldMapping";
import { addDTSTARTToRecurrenceRule, generateRecurringInstances } from "../../core/recurrence";
import { formatDateForStorage, getDatePart, parseDateToUTC } from "../../utils/dateUtils";
import { shouldTrackGoogleCalendarRecurringException } from "./googleCalendarRecurringExceptions";

/** The pending native occurrence's identity, never its moved execution date. */
export function getRecurringMoveOriginalDate(task: TaskInfo): string | undefined {
	return task.recurrence && (task.recurrence_anchor || "scheduled") === "scheduled"
		? normalizeRecurrenceOriginalDate(task.recurrence_original_date)
		: undefined;
}

/**
 * Explicit generated dates are authoritative identities (two occurrences can
 * share a placement). An off-pattern execution date may alias the pending one.
 * To act on the current occurrence without ambiguity, omit the action date.
 */
export function resolveRecurringMoveDate(task: TaskInfo, date: string): string {
	const original = getRecurringMoveOriginalDate(task);
	if (!original || date !== getDatePart(task.scheduled || "")) return date;
	const target = parseDateToUTC(date);
	return generateRecurringInstances(task, target, target).some(
		(occurrence) => formatDateForStorage(occurrence) === date
	)
		? date
		: original;
}

/**
 * Capture identity while the old cursor is still available. Legacy off-pattern
 * notes without a marker are deliberately not assigned a guessed occurrence.
 * Existing Google exceptions keep their historical storage/attribution contract.
 */
export function applyRecurringMoveForScheduledChange(
	originalTask: TaskInfo,
	updatedTask: TaskInfo
): void {
	if (
		!updatedTask.recurrence ||
		(updatedTask.recurrence_anchor || "scheduled") !== "scheduled" ||
		(originalTask.recurrence !== updatedTask.recurrence &&
			addDTSTARTToRecurrenceRule(originalTask) !== updatedTask.recurrence) ||
		(originalTask.recurrence_anchor || "scheduled") !==
			(updatedTask.recurrence_anchor || "scheduled") ||
		!updatedTask.scheduled
	) {
		updatedTask.recurrence_original_date = undefined;
		return;
	}
	const previous = getDatePart(originalTask.scheduled || "");
	const next = getDatePart(updatedTask.scheduled);
	if (previous === next) return;

	let original = getRecurringMoveOriginalDate(originalTask);
	if (!original && !shouldTrackGoogleCalendarRecurringException(originalTask) && previous) {
		const date = parseDateToUTC(previous);
		const occurrences = generateRecurringInstances(originalTask, date, date);
		if (occurrences.some((occurrence) => formatDateForStorage(occurrence) === previous)) {
			original = previous;
		}
	}
	updatedTask.recurrence_original_date = original && next !== original ? original : undefined;
	if (original && originalTask.recurrence && !originalTask.recurrence.includes("DTSTART:")) {
		updatedTask.recurrence = addDTSTARTToRecurrenceRule(originalTask) || updatedTask.recurrence;
	}
}

/** Rule/anchor edits start a new series contract, not another move of the old one. */
export function clearRecurringMoveAfterSeriesChange(original: TaskInfo, updated: TaskInfo): void {
	if (
		original.recurrence !== updated.recurrence ||
		(original.recurrence_anchor || "scheduled") !==
			(updated.recurrence_anchor || "scheduled") ||
		!updated.recurrence ||
		!updated.scheduled
	) {
		updated.recurrence_original_date = undefined;
	}
}

export function resolveRecurringMoveAfterAction(
	original: TaskInfo,
	updated: TaskInfo,
	hasNextOccurrence = original.scheduled !== updated.scheduled
): void {
	if (hasNextOccurrence) {
		updated.recurrence_original_date = undefined;
	}
}
