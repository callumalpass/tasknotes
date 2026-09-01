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

	it("materializes one overdue Agenda row for a task with both overdue scheduled and due dates", async () => {
		const task = TaskFactory.createTask({
			title: "Past scheduled and due",
			path: "Tasks/past-scheduled-and-due.md",
			status: "open",
			scheduled: "2026-08-03",
			due: "2026-08-04",
		});

		const events = await generateCalendarEvents([task], createPlugin(), {
			showScheduled: true,
			showDue: true,
			showRecurring: false,
			showOverdueOnToday: true,
			visibleStart: new Date(2026, 7, 5),
			visibleEnd: new Date(2026, 7, 12),
		});

		expect(taskEventSummaries(events)).toEqual([
			{
				id: "scheduled-Tasks/past-scheduled-and-due.md-overdue-today",
				start: "2026-08-05",
				eventType: "scheduled",
				isOverdueOnToday: true,
				path: "Tasks/past-scheduled-and-due.md",
			},
		]);
	});

	it("keeps the overdue due row when scheduled events are hidden", async () => {
		const task = TaskFactory.createTask({
			title: "Past scheduled and due",
			path: "Tasks/past-scheduled-hidden.md",
			status: "open",
			scheduled: "2026-08-03",
			due: "2026-08-04",
		});

		const events = await generateCalendarEvents([task], createPlugin(), {
			showScheduled: false,
			showDue: true,
			showRecurring: false,
			showOverdueOnToday: true,
			visibleStart: new Date(2026, 7, 5),
			visibleEnd: new Date(2026, 7, 12),
		});

		expect(taskEventSummaries(events)).toEqual([
			{
				id: "due-Tasks/past-scheduled-hidden.md-overdue-today",
				start: "2026-08-05",
				eventType: "due",
				isOverdueOnToday: true,
				path: "Tasks/past-scheduled-hidden.md",
			},
		]);
	});

	it("does not add a date-only overdue due row beside a generated recurring row", async () => {
		const task = TaskFactory.createTask({
			title: "Recurring scheduled and due",
			path: "Tasks/recurring-scheduled-and-due.md",
			status: "open",
			scheduled: "2026-08-03",
			due: "2026-08-04",
			recurrence: "DTSTART:20260803;FREQ=DAILY",
		});

		const events = await generateCalendarEvents([task], createPlugin(), {
			showScheduled: true,
			showDue: true,
			showRecurring: true,
			showCompletedRecurringInstances: false,
			showSkippedRecurringInstances: false,
			showOverdueOnToday: true,
			visibleStart: new Date(2026, 7, 5),
			visibleEnd: new Date(2026, 7, 12),
		});

		const todayRows = taskEventSummaries(events).filter(
			(event) => event.start.slice(0, 10) === "2026-08-05"
		);
		expect(todayRows).toHaveLength(1);
		expect(todayRows[0]?.eventType).not.toBe("due");
	});

	it("keeps an overdue due row when the generated recurring row is in the future", async () => {
		const task = TaskFactory.createTask({
			title: "Future recurrence with overdue due date",
			path: "Tasks/future-recurring-overdue-due.md",
			status: "open",
			scheduled: "2026-08-10",
			due: "2026-08-01",
			recurrence: "DTSTART:20260810;FREQ=DAILY",
		});

		const events = await generateCalendarEvents([task], createPlugin(), {
			showScheduled: true,
			showDue: true,
			showRecurring: true,
			showCompletedRecurringInstances: false,
			showSkippedRecurringInstances: false,
			showOverdueOnToday: true,
			visibleStart: new Date(2026, 7, 5),
			visibleEnd: new Date(2026, 7, 12),
		});

		expect(taskEventSummaries(events)).toContainEqual(
			expect.objectContaining({
				id: "due-Tasks/future-recurring-overdue-due.md-overdue-today",
				start: "2026-08-05",
				eventType: "due",
				isOverdueOnToday: true,
			})
		);
	});

	it("keeps a timed overdue due row beside a generated recurring row", async () => {
		const task = TaskFactory.createTask({
			title: "Recurring task with timed deadline",
			path: "Tasks/recurring-timed-due.md",
			status: "open",
			scheduled: "2026-08-03",
			due: "2026-08-04T17:00",
			recurrence: "DTSTART:20260803;FREQ=DAILY",
		});

		const events = await generateCalendarEvents([task], createPlugin(), {
			showScheduled: true,
			showDue: true,
			showRecurring: true,
			showCompletedRecurringInstances: false,
			showSkippedRecurringInstances: false,
			showOverdueOnToday: true,
			visibleStart: new Date(2026, 7, 5),
			visibleEnd: new Date(2026, 7, 12),
		});

		const todayRows = taskEventSummaries(events).filter(
			(event) => event.start.slice(0, 10) === "2026-08-05"
		);
		expect(todayRows).toHaveLength(2);
		expect(todayRows.some((event) => event.eventType === "due")).toBe(true);
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
