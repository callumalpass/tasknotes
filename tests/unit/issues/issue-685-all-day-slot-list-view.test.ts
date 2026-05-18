/**
 * Regression coverage for issue #685.
 *
 * FullCalendar's allDaySlot option hides the all-day lane in time-grid views,
 * but list views render all-day events inline. TaskNotes must filter those
 * events before handing them to list views when the option is disabled.
 */

import {
	filterAllDayEventsForCalendarView,
	shouldFilterAllDayEventsForCalendarView,
} from "../../../src/bases/CalendarView";

describe("Issue #685: all-day slot option in Calendar list view", () => {
	const events = [
		{ id: "task-all-day", title: "All-day task", start: "2026-05-18", allDay: true },
		{
			id: "task-timed",
			title: "Timed task",
			start: "2026-05-18T09:00",
			allDay: false,
		},
		{
			id: "external-all-day",
			title: "All-day external event",
			start: "2026-05-19",
			allDay: true,
		},
	];

	it("filters all-day events in list views when the all-day slot is disabled", () => {
		expect(shouldFilterAllDayEventsForCalendarView("listWeek", false)).toBe(true);

		const visibleEvents = filterAllDayEventsForCalendarView(events, "listWeek", false);

		expect(visibleEvents.map((event) => event.id)).toEqual(["task-timed"]);
	});

	it("keeps all-day events in list views when the all-day slot is enabled", () => {
		expect(filterAllDayEventsForCalendarView(events, "listWeek", true)).toBe(events);
	});

	it("leaves non-list views to FullCalendar's native allDaySlot behavior", () => {
		expect(shouldFilterAllDayEventsForCalendarView("timeGridWeek", false)).toBe(false);
		expect(filterAllDayEventsForCalendarView(events, "timeGridWeek", false)).toBe(events);
	});
});
