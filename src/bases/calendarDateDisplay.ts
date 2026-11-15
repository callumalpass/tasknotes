import { Formatter, type Calendar, type CalendarOptions } from "@tasknotes/calendar";
import type { DateDisplaySettings } from "../utils/dateUtils";

/** Calendar days are civil-day numbers, not instants in the OS timezone. */
export class ISOCalendarFormatter extends Formatter {
	override fullDate(day: number): string { return this.isoDate(day); }
	override longDate(day: number): string { return this.isoDate(day); }
	override listDay(day: number): string { return this.isoDate(day); }
	override monthYear(day: number): string { return this.isoDate(day).slice(0, 7); }
	override year(day: number): string { return this.isoDate(day).slice(0, 4); }
	override range(start: number, last: number): string {
		return start === last ? this.isoDate(start) : `${this.isoDate(start)} – ${this.isoDate(last)}`;
	}
}

export function getCalendarDateDisplayOptions<D>(
	preference: DateDisplaySettings["dateDisplayFormat"]
): Partial<CalendarOptions<D>> {
	return {
		dayHeaderContent: preference === "iso"
			? ({ dateStr, view }) => view.type === "month" || view.type === "year" ? undefined : dateStr
			: undefined,
	};
}

/** Use the engine's public formatter boundary for titles, popovers and accessible dates. */
export function applyCalendarDateDisplay<D>(
	calendar: Calendar<D>,
	preference: DateDisplaySettings["dateDisplayFormat"]
): void {
	const wantsISO = preference === "iso";
	if ((calendar.fmt instanceof ISOCalendarFormatter) === wantsISO) return;
	const FormatterType = wantsISO ? ISOCalendarFormatter : Formatter;
	calendar.fmt = new FormatterType(calendar.opts.locale, calendar.opts.hour12);
	calendar.rerender();
}
