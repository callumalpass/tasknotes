import type { TaskInfo } from "../../types";
import { getDatePart } from "../../utils/dateUtils";

export function shouldTrackGoogleCalendarRecurringException(task: TaskInfo): boolean {
	const hasGoogleCalendarProjection = Boolean(
		task.googleCalendarEventId ||
			task.googleCalendarExceptionEventId ||
			task.googleCalendarExceptionOriginalScheduled ||
			(task.googleCalendarMovedOriginalDates &&
				task.googleCalendarMovedOriginalDates.length > 0)
	);

	return (
		hasGoogleCalendarProjection &&
		Boolean(task.recurrence) &&
		(task.recurrence_anchor || "scheduled") === "scheduled"
	);
}

export function getRecurringExceptionOriginalDate(task: TaskInfo): string | undefined {
	const original = task.googleCalendarExceptionOriginalScheduled || task.scheduled || task.due;
	const normalized = getDatePart(original || "");
	return normalized || undefined;
}

export function applyGoogleCalendarRecurringExceptionForScheduledChange(
	originalTask: TaskInfo,
	nextScheduledValue: unknown,
	updatedTask: TaskInfo
): void {
	if (!shouldTrackGoogleCalendarRecurringException(originalTask)) {
		return;
	}

	if (nextScheduledValue === originalTask.scheduled) {
		return;
	}

	const originalDate = getRecurringExceptionOriginalDate(originalTask);
	if (!originalDate) {
		return;
	}

	const nextScheduled =
		typeof nextScheduledValue === "string" ? getDatePart(nextScheduledValue) : "";

	updatedTask.googleCalendarExceptionOriginalScheduled =
		nextScheduled && nextScheduled !== originalDate ? originalDate : undefined;
}

export function applyGoogleCalendarRecurringExceptionCleanup(
	updatedTask: TaskInfo
): void {
	if (shouldTrackGoogleCalendarRecurringException(updatedTask)) {
		return;
	}

	updatedTask.googleCalendarExceptionOriginalScheduled = undefined;
	updatedTask.googleCalendarMovedOriginalDates = undefined;
}

export function resolveGoogleCalendarRecurringExceptionAfterCurrentInstanceAction(
	originalTask: TaskInfo,
	actionDate: string,
	updatedTask: TaskInfo
): void {
	if (!shouldTrackGoogleCalendarRecurringException(originalTask)) {
		return;
	}

	const originalDate = getDatePart(originalTask.googleCalendarExceptionOriginalScheduled || "");
	if (!originalDate) {
		return;
	}

	const currentScheduled = getDatePart(originalTask.scheduled || "");
	if (!currentScheduled || actionDate !== currentScheduled) {
		return;
	}

	updatedTask.googleCalendarMovedOriginalDates = Array.from(
		new Set([...(originalTask.googleCalendarMovedOriginalDates || []), originalDate])
	).sort();
	updatedTask.googleCalendarExceptionOriginalScheduled = undefined;
}
