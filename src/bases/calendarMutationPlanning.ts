import { format } from "date-fns";
import type { CalendarEventData } from "../services/CalendarProvider";
import { stringifyUnknown } from "../utils/stringUtils";

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

export function getCalendarFrontmatterPropertyName(
	propertyId: string | null | undefined
): string | null {
	if (!propertyId) return null;
	return propertyId.includes(".") ? propertyId.split(".").pop() || null : propertyId;
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
