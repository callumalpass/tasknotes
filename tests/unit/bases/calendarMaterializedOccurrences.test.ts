jest.mock("../../../src/utils/helpers", () => ({
	...jest.requireActual("../../../src/utils/helpers"),
	generateRecurringInstances: jest.fn(),
}));

import {
	generateCalendarEvents,
	getTargetDateForEvent,
	type CalendarEvent,
} from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import { formatDateForStorage } from "../../../src/utils/dateUtils";
import { generateRecurringInstances } from "../../../src/utils/helpers";
import { TaskFactory } from "../../helpers/mock-factories";

const mockedGenerateRecurringInstances =
	generateRecurringInstances as jest.MockedFunction<typeof generateRecurringInstances>;

function createPlugin(): TaskNotesPlugin {
	return {
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
		},
		statusManager: {
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
	} as unknown as TaskNotesPlugin;
}

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day);
}

function localNoonDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12);
}

function virtualOccurrenceDates(events: CalendarEvent[]): string[] {
	return events
		.filter(
			(event) =>
				event.extendedProps.isNextScheduledOccurrence ||
				event.extendedProps.isPatternInstance ||
				event.extendedProps.isRecurringInstance
		)
		.map((event) => event.extendedProps.instanceDate)
		.filter((date): date is string => typeof date === "string")
		.sort();
}

describe("calendar materialized occurrences", () => {
	const plugin = createPlugin();
	const start = localNoonDate(2026, 5, 1);
	const end = localNoonDate(2026, 5, 4);

	beforeEach(() => {
		mockedGenerateRecurringInstances.mockReturnValue([
			localNoonDate(2026, 5, 1),
			localNoonDate(2026, 5, 2),
			localNoonDate(2026, 5, 3),
		]);
	});

	afterEach(() => {
		mockedGenerateRecurringInstances.mockReset();
	});

	it("coalesces virtual recurrence events when a materialized occurrence exists", async () => {
		const parent = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			title: "Daily review",
			path: "Tasks/daily-review.md",
			scheduled: "2026-06-01T09:00",
			timeEstimate: 30,
		});
		const occurrence = TaskFactory.createTask({
			title: "Daily review",
			path: "Tasks/daily-review-2026-06-02.md",
			recurrence_parent: "[[Tasks/daily-review]]",
			occurrence_date: "2026-06-02",
			scheduled: "2026-06-02T11:30",
			timeEstimate: 45,
		});

		const events = await generateCalendarEvents([parent, occurrence], plugin, {
			showRecurring: true,
			visibleStart: start,
			visibleEnd: end,
		});

		expect(virtualOccurrenceDates(events)).toEqual(["2026-06-01", "2026-06-03"]);

		const materializedEvent = events.find(
			(event) =>
				event.extendedProps.eventType === "scheduled" &&
				event.extendedProps.taskInfo?.path === occurrence.path
		);
		expect(materializedEvent?.start).toBe("2026-06-02T11:30");
		expect(materializedEvent?.extendedProps.isMaterializedOccurrence).toBe(true);
		expect(materializedEvent?.extendedProps.instanceDate).toBe("2026-06-02");
		expect(materializedEvent?.extendedProps.occurrenceDate).toBe("2026-06-02");
	});

	it("keeps occurrence identity when a materialized occurrence is scheduled off its recurrence date", async () => {
		const parent = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			title: "Daily review",
			path: "Tasks/daily-review.md",
			scheduled: "2026-06-01T09:00",
			timeEstimate: 30,
		});
		const movedOccurrence = TaskFactory.createTask({
			title: "Daily review",
			path: "Tasks/daily-review-2026-06-02.md",
			recurrence_parent: "[[Tasks/daily-review]]",
			occurrence_date: "2026-06-02",
			scheduled: "2026-06-03T11:30",
			timeEstimate: 45,
		});

		const events = await generateCalendarEvents([parent, movedOccurrence], plugin, {
			showRecurring: true,
			visibleStart: start,
			visibleEnd: end,
		});

		expect(virtualOccurrenceDates(events)).toEqual(["2026-06-01", "2026-06-03"]);

		const materializedEvent = events.find(
			(event) =>
				event.extendedProps.eventType === "scheduled" &&
				event.extendedProps.taskInfo?.path === movedOccurrence.path
		);
		expect(materializedEvent?.start).toBe("2026-06-03T11:30");
		expect(materializedEvent?.extendedProps.instanceDate).toBe("2026-06-02");
	});

	it("suppresses recorded parent history events when a materialized occurrence owns the date", async () => {
		const parent = TaskFactory.createRecurringTask("FREQ=DAILY;INTERVAL=1", {
			title: "Daily review",
			path: "Tasks/daily-review.md",
			scheduled: "2026-06-01T09:00",
			complete_instances: ["2026-06-02"],
		});
		const occurrence = TaskFactory.createCompletedTask({
			title: "Daily review",
			path: "Tasks/daily-review-2026-06-02.md",
			recurrence_parent: "[[Tasks/daily-review]]",
			occurrence_date: "2026-06-02",
			scheduled: "2026-06-02T09:00",
		});

		const events = await generateCalendarEvents([parent, occurrence], plugin, {
			showRecurring: false,
			showCompletedRecurringInstances: true,
			showSkippedRecurringInstances: true,
			visibleStart: start,
			visibleEnd: end,
		});

		expect(
			events.some(
				(event) =>
					event.id.includes("recurring-recorded") &&
					event.extendedProps.instanceDate === "2026-06-02"
			)
		).toBe(false);
		expect(
			events.some(
				(event) =>
					event.extendedProps.isMaterializedOccurrence &&
					event.extendedProps.instanceDate === "2026-06-02"
			)
		).toBe(true);
	});

	it("uses the occurrence date, not the scheduled date, as the context-menu target date", () => {
		const targetDate = getTargetDateForEvent({
			event: {
				start: localDate(2026, 5, 3),
				extendedProps: {
					isMaterializedOccurrence: true,
					instanceDate: "2026-06-02",
				},
			},
		});

		expect(formatDateForStorage(targetDate)).toBe("2026-06-02");
	});
});
