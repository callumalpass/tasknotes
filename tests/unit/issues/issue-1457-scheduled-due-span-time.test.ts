/**
 * Issue #1457: stretched scheduled-to-due calendar tasks should keep time.
 *
 * Timed spans represent repeated work windows, while date-only spans stay as
 * the existing all-day deadline bar.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1457
 */

import {
	createScheduledToDueSpanEvent,
	createScheduledToDueSpanEvents,
	generateCalendarEvents,
	shiftTaskDatePreservingTime,
	type CalendarEvent,
} from "../../../src/bases/calendar-core";
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

function eventStarts(events: CalendarEvent[]): string[] {
	return events.map((event) => event.start);
}

describe("Issue #1457: scheduled-to-due span times", () => {
	const plugin = createPlugin();

	it("renders timed scheduled-to-due spans as one timed event per day", () => {
		const task = TaskFactory.createTask({
			title: "Daily project work",
			path: "Tasks/daily-project-work.md",
			scheduled: "2026-01-05T10:00",
			due: "2026-01-10",
			timeEstimate: 120,
		});

		const events = createScheduledToDueSpanEvents(task, plugin);
		const firstEvent = createScheduledToDueSpanEvent(task, plugin);

		expect(events).toHaveLength(6);
		expect(firstEvent).toMatchObject({
			start: "2026-01-05T10:00",
			allDay: false,
		});
		expect(eventStarts(events)).toEqual([
			"2026-01-05T10:00",
			"2026-01-06T10:00",
			"2026-01-07T10:00",
			"2026-01-08T10:00",
			"2026-01-09T10:00",
			"2026-01-10T10:00",
		]);
		expect(events.every((event) => event.allDay === false)).toBe(true);
		expect(events[0].end).toBe("2026-01-05T12:00");
	});

	it("keeps date-only scheduled-to-due spans as a single all-day bar", () => {
		const task = TaskFactory.createTask({
			title: "Date-only project",
			path: "Tasks/date-only-project.md",
			scheduled: "2026-01-05",
			due: "2026-01-10",
		});

		const events = createScheduledToDueSpanEvents(task, plugin);
		const legacyEvent = createScheduledToDueSpanEvent(task, plugin);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			id: "span-Tasks/date-only-project.md",
			start: "2026-01-05",
			end: "2026-01-11",
			allDay: true,
		});
		expect(legacyEvent).toMatchObject(events[0]);
	});

	it("uses timed span events instead of separate scheduled and due events during generation", async () => {
		const task = TaskFactory.createTask({
			title: "Generated daily project work",
			path: "Tasks/generated-daily-project-work.md",
			scheduled: "2026-01-05T10:00",
			due: "2026-01-10",
			timeEstimate: 120,
		});

		const events = await generateCalendarEvents([task], plugin, {
			showScheduledToDueSpan: true,
		});

		expect(events).toHaveLength(6);
		expect(new Set(events.map((event) => event.extendedProps.eventType))).toEqual(
			new Set(["scheduledToDueSpan"])
		);
		expect(eventStarts(events)).toContain("2026-01-10T10:00");
	});

	it("preserves the original date value shape when dragged", () => {
		const oneHour = 60 * 60 * 1000;
		const oneDay = 24 * oneHour;

		expect(shiftTaskDatePreservingTime("2026-01-05T10:00", oneHour)).toBe(
			"2026-01-05T11:00"
		);
		expect(shiftTaskDatePreservingTime("2026-01-10", oneDay)).toBe("2026-01-11");
	});
});
