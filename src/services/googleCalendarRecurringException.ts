import { isDueByRRule } from "../core/recurrence";
import type { TaskInfo } from "../types";
import { getDatePart, parseDateToUTC } from "../utils/dateUtils";

export interface GoogleCalendarRecurringExceptionScheduledChange {
	changed: boolean;
	originalScheduled?: string;
}

export function shouldTrackGoogleCalendarRecurringException(
	recurrence?: string,
	recurrenceAnchor?: "scheduled" | "completion"
): boolean {
	return Boolean(recurrence) && (recurrenceAnchor || "scheduled") === "scheduled";
}

export function getGoogleCalendarRecurringExceptionOriginalDate(
	task: TaskInfo
): string | undefined {
	const currentScheduled = getDatePart(task.scheduled || "");
	const storedOriginal = getDatePart(task.googleCalendarExceptionOriginalScheduled || "");

	if (
		storedOriginal &&
		currentScheduled &&
		currentScheduled !== storedOriginal &&
		isRecurrenceDate(task, storedOriginal) &&
		!isRecurrenceDate(task, currentScheduled)
	) {
		return storedOriginal;
	}

	return currentScheduled || getDatePart(task.due || "") || undefined;
}

export function getGoogleCalendarRecurringExceptionForScheduledChange(
	task: TaskInfo,
	newScheduledValue: unknown
): GoogleCalendarRecurringExceptionScheduledChange {
	if (
		!shouldTrackGoogleCalendarRecurringException(task.recurrence, task.recurrence_anchor) ||
		newScheduledValue === task.scheduled
	) {
		return { changed: false };
	}

	const originalScheduled = getGoogleCalendarRecurringExceptionOriginalDate(task);
	if (!originalScheduled) {
		return { changed: false };
	}

	const nextScheduled = getDatePart(
		typeof newScheduledValue === "string" ? newScheduledValue : ""
	);

	return {
		changed: true,
		originalScheduled:
			nextScheduled && nextScheduled !== originalScheduled ? originalScheduled : undefined,
	};
}

function isRecurrenceDate(task: TaskInfo, date: string): boolean {
	if (!task.recurrence) {
		return false;
	}

	try {
		return isDueByRRule(task, parseDateToUTC(date));
	} catch {
		return false;
	}
}
