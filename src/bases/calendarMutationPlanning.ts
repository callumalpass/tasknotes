import { format } from "date-fns";
import type { CalendarEventData } from "../services/CalendarProvider";
import type { TaskInfo, TimeEntry } from "../types";
import { hasTimeComponent, parseDateToLocal } from "../utils/dateUtils";
import { stringifyUnknown } from "../utils/stringUtils";

export type TaskCalendarDropPlan =
	| {
			kind: "update-date-property";
			property: "scheduled" | "due";
			value: string;
	  }
	| {
			kind: "update-scheduled-due-span";
			scheduled?: string;
			due?: string;
	  }
	| {
			kind: "revert";
			reason: "missing-new-start" | "missing-old-start";
	  }
	| {
			kind: "ignore";
			reason: "unsupported-event-type";
	  };

export type TaskCalendarResizePlan =
	| {
			kind: "update-time-estimate";
			value: number;
	  }
	| {
			kind: "revert";
			reason: "unsupported-event-type";
	  }
	| {
			kind: "ignore";
			reason: "missing-range";
	  };

export type TimeEntryMutationPlan =
	| {
			kind: "update-time-entries";
			timeEntries: TimeEntry[];
	  }
	| {
			kind: "revert";
			reason:
				| "missing-index"
				| "missing-new-range"
				| "missing-old-start"
				| "missing-entry-end"
				| "invalid-date";
	  }
	| {
			kind: "ignore";
			reason: "missing-entry";
	  };

export type ProviderEventUpdatePlan =
	| {
			kind: "update-provider-event";
			updates: Partial<CalendarEventData>;
	  }
	| {
			kind: "revert";
			reason: "missing-start" | "missing-end";
	  };

export type PropertyEventDropPlan =
	| {
			kind: "update-frontmatter";
			updates: Record<string, string>;
	  }
	| {
			kind: "revert";
			reason: "missing-start-property" | "missing-start-date";
	  }
	| {
			kind: "ignore";
			reason: "invalid-start-value" | "no-date-values";
	  };

export type PropertyEventResizePlan =
	| {
			kind: "update-frontmatter";
			updates: Record<string, string>;
	  }
	| {
			kind: "revert";
			reason: "missing-end-property" | "missing-end-date";
	  }
	| {
			kind: "ignore";
			reason: "invalid-end-date";
	  };

export function formatTaskCalendarDate(date: Date, allDay: boolean): string {
	return allDay ? format(date, "yyyy-MM-dd") : format(date, "yyyy-MM-dd'T'HH:mm");
}

export function getCalendarFrontmatterPropertyName(
	propertyId: string | null | undefined
): string | null {
	if (!propertyId) return null;
	return propertyId.includes(".") ? propertyId.split(".").pop() || null : propertyId;
}

export function shiftTaskCalendarDatePreservingTime(dateValue: string, timeDiffMs: number): string {
	const oldDate = parseDateToLocal(dateValue);
	const shiftedDate = new Date(oldDate.getTime() + timeDiffMs);

	return hasTimeComponent(dateValue)
		? format(shiftedDate, "yyyy-MM-dd'T'HH:mm")
		: format(shiftedDate, "yyyy-MM-dd");
}

export function planTaskCalendarDrop(input: {
	eventType: unknown;
	taskInfo: Pick<TaskInfo, "scheduled" | "due">;
	newStart: Date | null | undefined;
	oldStart?: Date | null | undefined;
	allDay: boolean;
}): TaskCalendarDropPlan {
	const { eventType, taskInfo, newStart, oldStart, allDay } = input;

	if (eventType === "scheduled" || eventType === "due") {
		if (!newStart) {
			return { kind: "revert", reason: "missing-new-start" };
		}

		return {
			kind: "update-date-property",
			property: eventType,
			value: formatTaskCalendarDate(newStart, allDay),
		};
	}

	if (eventType === "scheduledToDueSpan") {
		if (!oldStart) {
			return { kind: "revert", reason: "missing-old-start" };
		}
		if (!newStart) {
			return { kind: "revert", reason: "missing-new-start" };
		}

		const timeDiffMs = newStart.getTime() - oldStart.getTime();
		return {
			kind: "update-scheduled-due-span",
			scheduled: taskInfo.scheduled
				? shiftTaskCalendarDatePreservingTime(taskInfo.scheduled, timeDiffMs)
				: undefined,
			due: taskInfo.due
				? shiftTaskCalendarDatePreservingTime(taskInfo.due, timeDiffMs)
				: undefined,
		};
	}

	return { kind: "ignore", reason: "unsupported-event-type" };
}

export function planTaskCalendarResize(input: {
	eventType: unknown;
	start: Date | null | undefined;
	end: Date | null | undefined;
	allDay: boolean;
}): TaskCalendarResizePlan {
	const { eventType, start, end, allDay } = input;

	if (eventType !== "scheduled" && eventType !== "recurring") {
		return { kind: "revert", reason: "unsupported-event-type" };
	}

	if (!start || !end) {
		return { kind: "ignore", reason: "missing-range" };
	}

	const durationMinutes = allDay
		? Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) * 60 * 24
		: Math.round((end.getTime() - start.getTime()) / (1000 * 60));

	return { kind: "update-time-estimate", value: durationMinutes };
}

function cloneSanitizedTimeEntries(entries: readonly TimeEntry[]): TimeEntry[] {
	return entries.map((entry) => {
		const sanitizedEntry = { ...entry };
		delete sanitizedEntry.duration;
		return sanitizedEntry;
	});
}

function isInvalidDate(date: Date): boolean {
	return Number.isNaN(date.getTime());
}

function formatPropertyEventDate(date: Date, allDay: boolean): string {
	return format(date, allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
}

function planShiftedPropertyDateValue(input: {
	value: unknown;
	timeDiffMs: number;
	allDay: boolean;
}): string | null {
	if (!input.value) {
		return null;
	}

	const oldDate = new Date(stringifyUnknown(input.value));
	if (isInvalidDate(oldDate)) {
		return null;
	}

	const shiftedDate = new Date(oldDate.getTime() + input.timeDiffMs);
	if (isInvalidDate(shiftedDate)) {
		return null;
	}

	return formatPropertyEventDate(shiftedDate, input.allDay);
}

export function planPropertyEventDrop(input: {
	frontmatter: Readonly<Record<string, unknown>>;
	startProperty: string | null | undefined;
	endProperty?: string | null | undefined;
	oldStart: Date | null | undefined;
	newStart: Date | null | undefined;
	allDay: boolean;
}): PropertyEventDropPlan {
	const { frontmatter, startProperty, endProperty, oldStart, newStart, allDay } = input;

	if (!startProperty) {
		return { kind: "revert", reason: "missing-start-property" };
	}
	if (!oldStart || !newStart) {
		return { kind: "revert", reason: "missing-start-date" };
	}

	const timeDiffMs = newStart.getTime() - oldStart.getTime();
	const updates: Record<string, string> = {};
	const startValue = frontmatter[startProperty];

	if (startValue) {
		const shiftedStart = planShiftedPropertyDateValue({
			value: startValue,
			timeDiffMs,
			allDay,
		});
		if (!shiftedStart) {
			return { kind: "ignore", reason: "invalid-start-value" };
		}
		updates[startProperty] = shiftedStart;
	}

	if (endProperty) {
		const endValue = frontmatter[endProperty];
		const shiftedEnd = planShiftedPropertyDateValue({
			value: endValue,
			timeDiffMs,
			allDay,
		});
		if (shiftedEnd) {
			updates[endProperty] = shiftedEnd;
		}
	}

	if (Object.keys(updates).length === 0) {
		return { kind: "ignore", reason: "no-date-values" };
	}

	return { kind: "update-frontmatter", updates };
}

export function planPropertyEventResize(input: {
	endProperty: string | null | undefined;
	newEnd: Date | null | undefined;
	allDay: boolean;
}): PropertyEventResizePlan {
	const { endProperty, newEnd, allDay } = input;

	if (!endProperty) {
		return { kind: "revert", reason: "missing-end-property" };
	}
	if (!newEnd) {
		return { kind: "revert", reason: "missing-end-date" };
	}
	if (isInvalidDate(newEnd)) {
		return { kind: "ignore", reason: "invalid-end-date" };
	}

	return {
		kind: "update-frontmatter",
		updates: {
			[endProperty]: formatPropertyEventDate(newEnd, allDay),
		},
	};
}

export function planTimeEntryDrop(input: {
	timeEntries: readonly TimeEntry[] | undefined;
	timeEntryIndex: unknown;
	oldStart: Date | null | undefined;
	newStart: Date | null | undefined;
	newEnd: Date | null | undefined;
}): TimeEntryMutationPlan {
	const { timeEntries, timeEntryIndex, oldStart, newStart, newEnd } = input;

	if (typeof timeEntryIndex !== "number") {
		return { kind: "revert", reason: "missing-index" };
	}
	if (!newStart || !newEnd) {
		return { kind: "revert", reason: "missing-new-range" };
	}
	if (!oldStart) {
		return { kind: "revert", reason: "missing-old-start" };
	}

	const updatedEntries = cloneSanitizedTimeEntries(timeEntries ?? []);
	const entry = updatedEntries[timeEntryIndex];
	if (!entry) {
		return { kind: "ignore", reason: "missing-entry" };
	}
	if (!entry.endTime) {
		return { kind: "revert", reason: "missing-entry-end" };
	}

	const oldEntryStart = new Date(entry.startTime);
	const oldEntryEnd = new Date(entry.endTime);
	if (isInvalidDate(oldEntryStart) || isInvalidDate(oldEntryEnd)) {
		return { kind: "revert", reason: "invalid-date" };
	}

	const timeDiffMs = newStart.getTime() - oldStart.getTime();
	entry.startTime = new Date(oldEntryStart.getTime() + timeDiffMs).toISOString();
	entry.endTime = new Date(oldEntryEnd.getTime() + timeDiffMs).toISOString();

	return { kind: "update-time-entries", timeEntries: updatedEntries };
}

export function planTimeEntryResize(input: {
	timeEntries: readonly TimeEntry[] | undefined;
	timeEntryIndex: unknown;
	newStart: Date | null | undefined;
	newEnd: Date | null | undefined;
}): TimeEntryMutationPlan {
	const { timeEntries, timeEntryIndex, newStart, newEnd } = input;

	if (typeof timeEntryIndex !== "number") {
		return { kind: "revert", reason: "missing-index" };
	}
	if (!newStart || !newEnd) {
		return { kind: "revert", reason: "missing-new-range" };
	}
	if (isInvalidDate(newStart) || isInvalidDate(newEnd)) {
		return { kind: "revert", reason: "invalid-date" };
	}

	const updatedEntries = cloneSanitizedTimeEntries(timeEntries ?? []);
	const entry = updatedEntries[timeEntryIndex];
	if (!entry) {
		return { kind: "ignore", reason: "missing-entry" };
	}

	entry.startTime = newStart.toISOString();
	entry.endTime = newEnd.toISOString();

	return { kind: "update-time-entries", timeEntries: updatedEntries };
}

export function buildProviderEventDateUpdate(input: {
	start: Date | null | undefined;
	end?: Date | null | undefined;
	allDay: boolean;
	timezone: string;
	requireEnd?: boolean;
}): ProviderEventUpdatePlan {
	const { start, allDay, timezone, requireEnd = false } = input;
	let { end } = input;

	if (!start) {
		return { kind: "revert", reason: "missing-start" };
	}
	if (!end) {
		if (requireEnd) {
			return { kind: "revert", reason: "missing-end" };
		}

		end = new Date(start);
		if (allDay) {
			end.setDate(end.getDate() + 1);
		} else {
			end.setHours(end.getHours() + 1);
		}
	}

	if (allDay) {
		return {
			kind: "update-provider-event",
			updates: {
				start: { date: format(start, "yyyy-MM-dd") },
				end: { date: format(end, "yyyy-MM-dd") },
			},
		};
	}

	return {
		kind: "update-provider-event",
		updates: {
			start: {
				dateTime: format(start, "yyyy-MM-dd'T'HH:mm:ss"),
				timeZone: timezone,
			},
			end: {
				dateTime: format(end, "yyyy-MM-dd'T'HH:mm:ss"),
				timeZone: timezone,
			},
		},
	};
}
