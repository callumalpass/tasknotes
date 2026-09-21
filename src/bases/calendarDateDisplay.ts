import type { CalendarOptions } from "@fullcalendar/core";
import type { DateDisplaySettings } from "../utils/dateUtils";

interface CalendarDateParts {
	year: number;
	month: number;
	day: number;
}

// FullCalendar supplies calendar-zone parts. Do not convert them through the OS timezone.
export function formatCalendarISODate(date: CalendarDateParts): string {
	return `${String(date.year).padStart(4, "0")}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function getCalendarDateDisplayOptions(
	preference: DateDisplaySettings["dateDisplayFormat"]
): CalendarOptions {
	if (preference !== "iso") return {};
	return {
		titleFormat: ({ start, end }) => {
			const first = formatCalendarISODate(start);
			const last = end ? formatCalendarISODate(end) : first;
			return first === last ? first : `${first} – ${last}`;
		},
		views: {
			// Month/year weekday headings use placeholder dates, not visible calendar dates.
			timeGrid: { dayHeaderFormat: ({ date }) => formatCalendarISODate(date) },
			dayGridMonth: { titleFormat: ({ date }) => formatCalendarISODate(date).slice(0, 7) },
			multiMonthYear: { titleFormat: ({ date }) => String(date.year) },
		},
		dayPopoverFormat: ({ date }) => formatCalendarISODate(date),
		listDayFormat: ({ date }) => formatCalendarISODate(date),
		listDaySideFormat: false,
	};
}
