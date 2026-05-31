/**
 * Issue #1951: recurring Calendar tasks should support scheduled-to-due spans.
 *
 * When the existing "Stretch tasks between scheduled and due dates" Calendar
 * option is enabled, recurring instances should project the whole date range,
 * not just the scheduled anchor date.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1951
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

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day);
}

function spanEvents(events: CalendarEvent[]): CalendarEvent[] {
	return events.filter((event) => event.extendedProps.eventType === "scheduledToDueSpan");
}

describe("Issue #1951: recurring scheduled-to-due Calendar spans", () => {
	const plugin = createPlugin();

	it("renders monthly recurring date-only ranges as all-day spans", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=MONTHLY;INTERVAL=1", {
			title: "Pay taxes",
			path: "Tasks/pay-taxes.md",
			scheduled: "2026-01-01",
			due: "2026-01-05",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showRecurring: true,
			showScheduledToDueSpan: true,
			visibleStart: localDate(2026, 0, 1),
			visibleEnd: localDate(2026, 3, 1),
		});

		expect(events).toHaveLength(3);
		expect(new Set(events.map((event) => event.extendedProps.eventType))).toEqual(
			new Set(["scheduledToDueSpan"])
		);
		expect(events.map((event) => [event.start, event.end, event.allDay])).toEqual([
			["2026-01-01", "2026-01-06", true],
			["2026-02-01", "2026-02-06", true],
			["2026-03-01", "2026-03-06", true],
		]);
		expect(events.map((event) => event.extendedProps.instanceDate)).toEqual([
			"2026-01-01",
			"2026-02-01",
			"2026-03-01",
		]);
		expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
	});

	it("expands timed recurring ranges into one timed event per day", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=MONTHLY;INTERVAL=1", {
			title: "Monthly work window",
			path: "Tasks/monthly-work-window.md",
			scheduled: "2026-01-01T10:00",
			due: "2026-01-03",
			timeEstimate: 90,
		});

		const events = spanEvents(
			await generateCalendarEvents([task], plugin, {
				showRecurring: true,
				showScheduledToDueSpan: true,
				visibleStart: localDate(2026, 1, 1),
				visibleEnd: localDate(2026, 1, 5),
			})
		);

		expect(events.map((event) => [event.start, event.end, event.allDay])).toEqual([
			["2026-02-01T10:00", "2026-02-01T11:30", false],
			["2026-02-02T10:00", "2026-02-02T11:30", false],
			["2026-02-03T10:00", "2026-02-03T11:30", false],
		]);
		expect(events.every((event) => event.extendedProps.instanceDate === "2026-02-01")).toBe(
			true
		);
	});

	it("includes recurring spans that start before the visible range but overlap it", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=MONTHLY;INTERVAL=1", {
			title: "Visible overlap",
			path: "Tasks/visible-overlap.md",
			scheduled: "2026-01-01T09:00",
			due: "2026-01-05",
			timeEstimate: 60,
		});

		const events = spanEvents(
			await generateCalendarEvents([task], plugin, {
				showRecurring: true,
				showScheduledToDueSpan: true,
				visibleStart: localDate(2026, 0, 3),
				visibleEnd: localDate(2026, 0, 4),
			})
		);

		expect(events.map((event) => event.start)).toEqual(["2026-01-03T09:00"]);
		expect(events[0].extendedProps.instanceDate).toBe("2026-01-01");
	});

	it("applies completed and skipped visibility to whole recurring spans", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			title: "Daily range",
			path: "Tasks/daily-range.md",
			scheduled: "2026-01-01",
			due: "2026-01-02",
			complete_instances: ["2026-01-02"],
			skipped_instances: ["2026-01-03"],
		});

		const events = spanEvents(
			await generateCalendarEvents([task], plugin, {
				showRecurring: true,
				showScheduledToDueSpan: true,
				showCompletedRecurringInstances: false,
				showSkippedRecurringInstances: true,
				visibleStart: localDate(2026, 0, 1),
				visibleEnd: localDate(2026, 0, 5),
			})
		);

		const instanceDates = events.map((event) => event.extendedProps.instanceDate);
		expect(instanceDates).toContain("2026-01-01");
		expect(instanceDates).not.toContain("2026-01-02");
		expect(instanceDates).toContain("2026-01-03");
		const skippedEvent = events.find(
			(event) => event.extendedProps.instanceDate === "2026-01-03"
		);
		expect(skippedEvent?.extendedProps.isSkipped).toBe(true);
	});
});
