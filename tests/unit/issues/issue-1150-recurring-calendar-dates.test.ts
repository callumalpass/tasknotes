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

function eventsOfType(events: CalendarEvent[], eventType: string): CalendarEvent[] {
	return events.filter((event) => event.extendedProps.eventType === eventType);
}

describe("Issue #1150: recurring task Calendar dates", () => {
	const plugin = createPlugin();
	const visibleStart = new Date("2026-02-01T00:00:00.000Z");
	const visibleEnd = new Date("2026-02-12T00:00:00.000Z");

	it("shows due dates for recurring tasks alongside recurrence instances", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			title: "Submit recurring report",
			path: "tasks/recurring-report.md",
			scheduled: "2026-02-01",
			due: "2026-02-10",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showRecurring: true,
			showScheduled: true,
			showDue: true,
			visibleStart,
			visibleEnd,
		});

		expect(eventsOfType(events, "due")).toEqual([
			expect.objectContaining({
				id: "due-tasks/recurring-report.md",
				start: "2026-02-10",
			}),
		]);
		expect(events.some((event) => event.extendedProps.isPatternInstance)).toBe(true);
		expect(events.filter((event) => event.id === "scheduled-tasks/recurring-report.md")).toEqual(
			[]
		);
	});

	it("shows scheduled and due dates for recurring tasks when recurrence instances are hidden", async () => {
		const task = TaskFactory.createRecurringTask("FREQ=WEEKLY;INTERVAL=1", {
			title: "Delayed recurring review",
			path: "tasks/delayed-review.md",
			scheduled: "2026-02-05",
			due: "2026-02-11",
		});

		const events = await generateCalendarEvents([task], plugin, {
			showRecurring: false,
			showScheduled: true,
			showDue: true,
			visibleStart,
			visibleEnd,
		});

		expect(events.map((event) => [event.extendedProps.eventType, event.start])).toEqual([
			["scheduled", "2026-02-05"],
			["due", "2026-02-11"],
		]);
	});
});
