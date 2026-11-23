import {
	planCalendarOccurrenceChoice,
	type CalendarChange,
	type CalendarEntry,
	type CalendarOccurrenceChoice,
} from "@tasknotes/model/calendar";
import type { TaskInfo } from "../types";

export type CalendarPatternGesture =
	/** The drop would change nothing: same day, same time. */
	| { kind: "unchanged" }
	/** Same day, another clock time: the series' DTSTART time moves. */
	| { kind: "series-time" }
	/** Resizing changes the series' duration. */
	| { kind: "series-duration" }
	/** Another day, or between the all-day row and a time: only this occurrence moves. */
	| ({ kind: "occurrence" } & CalendarOccurrenceChoice["occurrence"]);

/**
 * How a gesture on a projected (dashed) occurrence of a recurring task applies.
 * Returns undefined for every other calendar entry.
 *
 * A series edit keeps DTSTART's date, so it cannot move an occurrence to another day,
 * and a projection takes its all-day/timed form from `scheduled`, not DTSTART. Those
 * drops therefore become an occurrence note instead (#2631).
 */
export function planCalendarPatternGesture(
	task: TaskInfo,
	entry: CalendarEntry,
	change: CalendarChange,
	timezone: string
): CalendarPatternGesture | undefined {
	const choice = planCalendarOccurrenceChoice({ task, entry, change, timezone });
	if (!choice) return undefined;
	if (change.kind === "resize") return { kind: "series-duration" };
	const { occurrenceDate, overrides } = choice.occurrence;
	const sameDay = overrides.scheduled?.slice(0, 10) === occurrenceDate;
	if (sameDay && choice.series === undefined) return { kind: "unchanged" };
	if (sameDay && choice.series === "time") return { kind: "series-time" };
	return { kind: "occurrence", occurrenceDate, overrides };
}
