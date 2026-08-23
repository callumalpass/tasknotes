/**
 * Issue #2198: Agenda list mode should show overdue due/scheduled tasks on today
 * when showOverdueOnToday is enabled.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2198
 */

import { generateCalendarEvents, type CalendarEvent } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			hideCompletedFromOverdue: true,
		},
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
	} as unknown as TaskNotesPlugin;
}

function taskEventSummaries(events: CalendarEvent[]): Array<{
	id: string;
	start: string;
	eventType?: string;
	isOverdueOnToday?: boolean;
	path?: string;
}> {
	return events
		.filter((event) => event.extendedProps.taskInfo)
		.map((event) => ({
			id: event.id,
			start: event.start,
			eventType: event.extendedProps.eventType,
			isOverdueOnToday: event.extendedProps.isOverdueOnToday,
			path: event.extendedProps.taskInfo?.path,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));
}

describe("Issue #2198: Agenda overdue tasks on today", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-08-05T12:00:00Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("materializes overdue scheduled and due tasks on today's Agenda row", async () => {
		const tasks = [
			TaskFactory.createTask({
				title: "Past scheduled",
				path: "Tasks/past-scheduled.md",
				status: "open",
				scheduled: "2026-08-03",
			}),
			TaskFactory.createTask({
				title: "Past due",
				path: "Tasks/past-due.md",
				status: "open",
				due: "2026-08-02",
			}),
			TaskFactory.createTask({
				title: "Future due",
				path: "Tasks/future-due.md",
				status: "open",
				due: "2026-08-06",
			}),
			TaskFactory.createTask({
				title: "Completed overdue",
				path: "Tasks/completed-overdue.md",
				status: "done",
				due: "2026-08-01",
			}),
		];

		const events = await generateCalendarEvents(tasks, createPlugin(), {
			showScheduled: true,
			showDue: true,
			showRecurring: false,
			showOverdueOnToday: true,
			visibleStart: new Date(2026, 7, 5),
			visibleEnd: new Date(2026, 7, 12),
		});

		expect(taskEventSummaries(events)).toEqual([
			{
				id: "due-Tasks/future-due.md",
				start: "2026-08-06",
				eventType: "due",
				isOverdueOnToday: undefined,
				path: "Tasks/future-due.md",
			},
			{
				id: "due-Tasks/past-due.md-overdue-today",
				start: "2026-08-05",
				eventType: "due",
				isOverdueOnToday: true,
				path: "Tasks/past-due.md",
			},
			{
				id: "scheduled-Tasks/past-scheduled.md-overdue-today",
				start: "2026-08-05",
				eventType: "scheduled",
				isOverdueOnToday: true,
				path: "Tasks/past-scheduled.md",
			},
		]);
	});

	it("does not materialize overdue events when the option is disabled", async () => {
		const events = await generateCalendarEvents(
			[
				TaskFactory.createTask({
					title: "Past due",
					path: "Tasks/past-due.md",
					status: "open",
					due: "2026-08-02",
				}),
			],
			createPlugin(),
			{
				showDue: true,
				showRecurring: false,
				showOverdueOnToday: false,
				visibleStart: new Date(2026, 7, 5),
				visibleEnd: new Date(2026, 7, 12),
			}
		);

		expect(taskEventSummaries(events)).toEqual([]);
	});
});
