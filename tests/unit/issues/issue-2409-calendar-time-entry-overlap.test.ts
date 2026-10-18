import { generateCalendarEvents } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo, TimeEntry } from "../../../src/types";

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn().mockReturnValue(false),
		},
	} as unknown as TaskNotesPlugin;
}

function createTask(timeEntries: TimeEntry[]): TaskInfo {
	return {
		title: "Overnight session",
		path: "Tasks/overnight-session.md",
		status: "open",
		priority: "normal",
		archived: false,
		timeEntries,
	};
}

async function generateTimeEvents(
	task: TaskInfo,
	visibleStart?: string,
	visibleEnd?: string
) {
	return generateCalendarEvents([task], createPlugin(), {
		showScheduled: false,
		showDue: false,
		showRecurring: false,
		showICSEvents: false,
		showTimeEntries: true,
		visibleStart: visibleStart ? new Date(visibleStart) : undefined,
		visibleEnd: visibleEnd ? new Date(visibleEnd) : undefined,
	});
}

describe("Issue #2409: calendar time entries crossing visible ranges", () => {
	it.each([
		["Sunday-start week", "2026-10-17T22:00", "2026-10-18T01:00", "2026-10-18T00:00", "2026-10-25T00:00"],
		["Monday-start week", "2026-10-18T22:00", "2026-10-19T01:00", "2026-10-19T00:00", "2026-10-26T00:00"],
		["day", "2026-10-19T22:00", "2026-10-20T01:00", "2026-10-20T00:00", "2026-10-21T00:00"],
		["month", "2026-10-31T22:00", "2026-11-01T01:00", "2026-11-01T00:00", "2026-12-01T00:00"],
		["year", "2026-12-31T22:00", "2027-01-01T01:00", "2027-01-01T00:00", "2028-01-01T00:00"],
		["entire visible range", "2026-10-17T22:00", "2026-10-26T01:00", "2026-10-18T00:00", "2026-10-25T00:00"],
		["start of session", "2026-10-17T22:00", "2026-10-18T01:00", "2026-10-11T00:00", "2026-10-18T00:00"],
		["within one week", "2026-10-19T22:00", "2026-10-20T01:00", "2026-10-18T00:00", "2026-10-25T00:00"],
		["spring DST transition", "2026-03-07T22:00:00-05:00", "2026-03-08T04:00:00-04:00", "2026-03-08T00:00:00-05:00", "2026-03-15T00:00:00-04:00"],
		["autumn DST transition", "2026-10-31T22:00:00-04:00", "2026-11-01T03:00:00-05:00", "2026-11-01T00:00:00-04:00", "2026-11-08T00:00:00-05:00"],
	])("includes an entry overlapping the %s without changing its timestamps", async (_label, startTime, endTime, visibleStart, visibleEnd) => {
		const task = createTask([{ startTime, endTime }]);
		const events = await generateTimeEvents(task, visibleStart, visibleEnd);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			id: `timeentry-${task.path}-0`,
			start: startTime,
			end: endTime,
			extendedProps: { eventType: "timeEntry", timeEntryIndex: 0 },
		});
		expect(task.timeEntries).toEqual([{ startTime, endTime }]);
	});

	it.each([
		["ends before the range", "2026-10-17T22:00", "2026-10-17T23:00"],
		["ends exactly at the range start", "2026-10-17T22:00", "2026-10-18T00:00"],
		["starts exactly at the range end", "2026-10-25T00:00", "2026-10-25T01:00"],
		["starts after the range", "2026-10-25T22:00", "2026-10-26T01:00"],
	])("excludes an entry that %s", async (_label, startTime, endTime) => {
		const events = await generateTimeEvents(
			createTask([{ startTime, endTime }]),
			"2026-10-18T00:00",
			"2026-10-25T00:00"
		);

		expect(events).toEqual([]);
	});

	it("keeps original indexes after excluding running and non-overlapping entries", async () => {
		const events = await generateTimeEvents(createTask([
			{ startTime: "2026-10-17T20:00", endTime: "2026-10-17T21:00" },
			{ startTime: "2026-10-17T21:00" },
			{ startTime: "2026-10-17T22:00", endTime: "2026-10-18T01:00" },
		]), "2026-10-18T00:00", "2026-10-25T00:00");

		expect(events).toHaveLength(1);
		expect(events[0].id).toBe("timeentry-Tasks/overnight-session.md-2");
		expect(events[0].extendedProps.timeEntryIndex).toBe(2);
	});

	it("includes finished entries when no visible range is supplied", async () => {
		const events = await generateTimeEvents(createTask([
			{ startTime: "2026-10-17T22:00", endTime: "2026-10-18T01:00" },
			{ startTime: "2026-10-19T22:00" },
		]));

		expect(events).toHaveLength(1);
	});

	it("respects the time-entry visibility toggle", async () => {
		const events = await generateCalendarEvents([
			createTask([{ startTime: "2026-10-17T22:00", endTime: "2026-10-18T01:00" }]),
		], createPlugin(), { showTimeEntries: false });

		expect(events).toEqual([]);
	});
});
