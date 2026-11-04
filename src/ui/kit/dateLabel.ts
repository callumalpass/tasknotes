import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

export type RelativeDay = "today" | "tomorrow" | "yesterday" | null;

/** Near dates read as words. Everything else keeps its calendar format. */
export function relativeDay(dateValue: string, now: Date = new Date()): RelativeDay {
	const date = parseISO(dateValue.slice(0, 10));
	if (!isValid(date)) return null;

	const offset = differenceInCalendarDays(date, now);
	if (offset === 0) return "today";
	if (offset === 1) return "tomorrow";
	if (offset === -1) return "yesterday";
	return null;
}
