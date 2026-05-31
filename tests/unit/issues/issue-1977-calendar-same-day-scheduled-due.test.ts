/**
 * Issue #1977: Calendar and Agenda should not duplicate date-only tasks when
 * the scheduled and due dates are the same day.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1977
 */

import { generateCalendarEvents, type CalendarEvent } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#6366f1" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn().mockReturnValue(false),
		},
	} as unknown as TaskNotesPlugin;
}

function eventTypes(events: CalendarEvent[]): string[] {
	return events.map((event) => event.extendedProps.eventType).sort();
}

describe("Issue #1977: same-day scheduled and due Calendar duplicates", () => {
	const plugin = createPlugin();

	it("renders one task event when date-only scheduled and due values are the same day", async () => {
		const task = TaskFactory.createTask({
			title: "Same day task",
			path: "Tasks/same-day.md",
			scheduled: "2026-05-31",
			due: "2026-05-31",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: true,
			showDue: true,
			showRecurring: false,
			showTimeEntries: false,
		});

		expect(eventTypes(events)).toEqual(["scheduled"]);
		expect(events[0]).toMatchObject({
			id: "scheduled-Tasks/same-day.md",
			start: "2026-05-31",
			allDay: true,
		});
	});

	it("keeps separate due events when the due value adds a distinct time", async () => {
		const task = TaskFactory.createTask({
			title: "Timed deadline",
			path: "Tasks/timed-deadline.md",
			scheduled: "2026-05-31",
			due: "2026-05-31T17:00",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: true,
			showDue: true,
			showRecurring: false,
			showTimeEntries: false,
		});

		expect(eventTypes(events)).toEqual(["due", "scheduled"]);
	});

	it("keeps the due event when scheduled events are hidden", async () => {
		const task = TaskFactory.createTask({
			title: "Due only display",
			path: "Tasks/due-only-display.md",
			scheduled: "2026-05-31",
			due: "2026-05-31",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: false,
			showDue: true,
			showRecurring: false,
			showTimeEntries: false,
		});

		expect(eventTypes(events)).toEqual(["due"]);
	});

	it("keeps separate due events when scheduled and due dates differ", async () => {
		const task = TaskFactory.createTask({
			title: "Different day task",
			path: "Tasks/different-day.md",
			scheduled: "2026-05-31",
			due: "2026-06-01",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduled: true,
			showDue: true,
			showRecurring: false,
			showTimeEntries: false,
		});

		expect(eventTypes(events)).toEqual(["due", "scheduled"]);
	});
});
