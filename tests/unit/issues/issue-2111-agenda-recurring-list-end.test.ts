/**
 * Issue #2111: Agenda list views should include recurring instances on the
 * final labelled day when FullCalendar range boundaries include a timezone
 * offset.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2111
 */

import { generateCalendarEvents, type CalendarEvent } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#ffaa00" }),
		},
	} as unknown as TaskNotesPlugin;
}

function recurringInstanceDates(events: CalendarEvent[]): string[] {
	return events
		.filter(
			(event) =>
				event.extendedProps.isRecurringInstance ||
				event.extendedProps.isNextScheduledOccurrence ||
				event.extendedProps.isPatternInstance
		)
		.map((event) => event.extendedProps.instanceDate)
		.filter((date): date is string => typeof date === "string")
		.sort();
}

describe("Issue #2111: Agenda recurring list range end", () => {
	it("includes the final labelled day for a daily recurring task in a UTC+3 list range", async () => {
		const task = TaskFactory.createRecurringTask("DTSTART:20260704;FREQ=DAILY", {
			title: "Read a book",
			path: "Tasks/read-a-book.md",
			scheduled: "2026-07-11",
			recurrence_anchor: "scheduled",
			complete_instances: [],
			skipped_instances: [],
		});

		const events = await generateCalendarEvents([task], createPlugin(), {
			showScheduled: true,
			showDue: false,
			showRecurring: true,
			visibleStart: new Date("2026-07-10T00:00:00+03:00"),
			visibleEnd: new Date("2026-07-17T00:00:00+03:00"),
			visibleStartDate: "2026-07-10",
			visibleEndDate: "2026-07-17",
		});

		expect(recurringInstanceDates(events)).toEqual([
			"2026-07-10",
			"2026-07-11",
			"2026-07-12",
			"2026-07-13",
			"2026-07-14",
			"2026-07-15",
			"2026-07-16",
		]);
	});
});
