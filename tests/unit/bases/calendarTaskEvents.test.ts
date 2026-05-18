import {
	calculateAllDayEndDate,
	createDueTaskEvent,
	createScheduledTaskEvent,
	createScheduledToDueSpanTaskEvents,
	createTimeEntryTaskEvents,
	type CalendarTaskEventContext,
} from "../../../src/bases/calendarTaskEvents";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Draft plan",
		path: "Tasks/draft-plan.md",
		status: "open",
		priority: "high",
		archived: false,
		...overrides,
	};
}

function createContext(
	overrides: Partial<CalendarTaskEventContext> = {}
): CalendarTaskEventContext {
	return {
		getPriorityColor: jest.fn((priority) =>
			priority === "high" ? "#ff0000" : undefined
		),
		isCompletedStatus: jest.fn((status) => status === "done"),
		getThemeTextColor: jest.fn(() => "#202124"),
		...overrides,
	};
}

describe("calendar task event builders", () => {
	it("creates scheduled timed events with estimated duration", () => {
		const task = createTask({
			scheduled: "2026-05-18T09:30",
			timeEstimate: 45,
			status: "done",
		});

		const event = createScheduledTaskEvent(task, createContext());

		expect(event).toMatchObject({
			id: "scheduled-Tasks/draft-plan.md",
			title: "Draft plan",
			start: "2026-05-18T09:30",
			end: "2026-05-18T10:15",
			allDay: false,
			backgroundColor: "transparent",
			borderColor: "#ff0000",
			textColor: "#ff0000",
			editable: true,
			extendedProps: {
				taskInfo: task,
				eventType: "scheduled",
				isCompleted: true,
			},
		});
	});

	it("creates due timed events with the fixed due-event duration", () => {
		const task = createTask({
			due: "2026-05-18T11:00",
		});

		const event = createDueTaskEvent(task, createContext());

		expect(event).toMatchObject({
			id: "due-Tasks/draft-plan.md",
			start: "2026-05-18T11:00",
			end: "2026-05-18T11:30",
			allDay: false,
			backgroundColor: "rgba(255, 0, 0, 0.15)",
			borderColor: "#ff0000",
			extendedProps: {
				eventType: "due",
				isCompleted: false,
			},
		});
	});

	it("uses theme text color for theme-variable priority colors", () => {
		const context = createContext({
			getPriorityColor: () => "accent",
			getThemeTextColor: jest.fn(() => "#f8fafc"),
		});

		const event = createScheduledTaskEvent(
			createTask({ scheduled: "2026-05-18" }),
			context
		);

		expect(event?.borderColor).toBe("var(--color-accent)");
		expect(event?.textColor).toBe("#f8fafc");
		expect(context.getThemeTextColor).toHaveBeenCalledWith(true);
	});

	it("creates all-day scheduled-to-due spans with exclusive end dates", () => {
		const events = createScheduledToDueSpanTaskEvents(
			createTask({
				scheduled: "2026-05-18",
				due: "2026-05-20",
			}),
			createContext()
		);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			id: "span-Tasks/draft-plan.md",
			start: "2026-05-18",
			end: "2026-05-21",
			allDay: true,
			backgroundColor: "rgba(255, 0, 0, 0.2)",
			extendedProps: {
				eventType: "scheduledToDueSpan",
			},
		});
	});

	it("filters timed scheduled-to-due span instances by visible range", () => {
		const events = createScheduledToDueSpanTaskEvents(
			createTask({
				scheduled: "2026-05-18T09:00",
				due: "2026-05-20",
				timeEstimate: 60,
			}),
			createContext(),
			new Date("2026-05-19T00:00:00"),
			new Date("2026-05-20T00:00:00")
		);

		expect(events.map((event) => event.start)).toEqual(["2026-05-19T09:00"]);
		expect(events[0].end).toBe("2026-05-19T10:00");
	});

	it("keeps original time-entry indexes while excluding running entries", () => {
		const events = createTimeEntryTaskEvents(
			createTask({
				timeEntries: [
					{
						startTime: "2026-05-18T09:00",
						endTime: "2026-05-18T09:20",
					},
					{
						startTime: "2026-05-18T10:00",
					},
					{
						startTime: "2026-05-18T11:00",
						endTime: "2026-05-18T11:45",
					},
				],
			}),
			createContext()
		);

		expect(events).toHaveLength(2);
		expect(events.map((event) => event.extendedProps.timeEntryIndex)).toEqual([0, 2]);
		expect(events.map((event) => event.start)).toEqual([
			"2026-05-18T09:00",
			"2026-05-18T11:00",
		]);
	});

	it("calculates all-day end dates from estimates", () => {
		expect(calculateAllDayEndDate("2026-05-18", 24 * 60)).toBe("2026-05-19");
		expect(calculateAllDayEndDate("2026-05-18", 25 * 60)).toBe("2026-05-20");
		expect(calculateAllDayEndDate("2026-05-18")).toBeUndefined();
	});
});
