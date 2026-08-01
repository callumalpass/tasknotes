/**
 * Tests for the "Dynamic Scheduled Dates" bug fix.
 *
 * When a recurring task's scheduled date is manually shifted forward from the
 * actual recurrence date, completing the task previously stored the shifted
 * date in complete_instances and calculated the due-date offset from the shifted
 * date. This caused:
 *   1. The task to jump backward (or to today) instead of advancing to the next cycle.
 *   2. The due-date offset to drift each cycle.
 *   3. Future-dated tasks to jump to the first occurrence after today, not after
 *      their own scheduled date.
 */

import {
	buildRecurringTaskCompletePlan,
	buildRecurringTaskSkippedPlan,
} from "../../../src/services/task-service/taskRecurringPlanning";
import type { TaskInfo } from "../../../src/types";
import { getTodayString } from "../../../src/utils/dateUtils";

jest.mock("../../../src/utils/dateUtils", () => ({
	...jest.requireActual("../../../src/utils/dateUtils"),
	getTodayString: jest.fn(),
}));

const mockGetTodayString = getTodayString as jest.MockedFunction<typeof getTodayString>;

function task(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Recurring task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/test.md",
		archived: false,
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

describe("dynamic scheduled dates — shifted scheduled date on completion", () => {
	beforeEach(() => {
		mockGetTodayString.mockReturnValue("2026-07-01");
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("stores the recurrence date in complete_instances when scheduled is shifted forward", () => {
		// Recurrence: quarterly on the 1st, DTSTART 2026-04-01.
		// User shifted scheduled 2 days to 2026-07-03. Completing should mark 2026-07-01.
		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2026-07-03",
				due: "2026-08-07",
				complete_instances: ["2026-04-01"],
			}),
			targetDate: new Date("2026-07-03T00:00:00.000Z"),
			currentTimestamp: "2026-07-03T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		// Instance key should be the recurrence date, not the shifted scheduled date.
		expect(plan.dateStr).toBe("2026-07-01");
		expect(plan.updatedTask.complete_instances).toContain("2026-07-01");
		expect(plan.updatedTask.complete_instances).not.toContain("2026-07-03");
	});

	it("advances to the next quarterly cycle, not backward, when scheduled is shifted", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2026-07-03",
				due: "2026-08-07",
				complete_instances: ["2026-04-01"],
			}),
			targetDate: new Date("2026-07-03T00:00:00.000Z"),
			currentTimestamp: "2026-07-03T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.updatedTask.scheduled).toBe("2026-10-01");
	});

	it("calculates due-date offset from the recurrence date, not the shifted scheduled date", () => {
		// due (2026-08-07) is 37 days after the recurrence date (2026-07-01), not 35.
		// Next due should be 2026-10-01 + 37 days = 2026-11-07.
		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2026-07-03",
				due: "2026-08-07",
				complete_instances: ["2026-04-01"],
			}),
			targetDate: new Date("2026-07-03T00:00:00.000Z"),
			currentTimestamp: "2026-07-03T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.updatedTask.due).toBe("2026-11-07");
	});

	it("works the same when scheduled date matches the recurrence date (regression guard)", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2026-07-01",
				due: "2026-08-07",
				complete_instances: ["2026-04-01"],
			}),
			targetDate: new Date("2026-07-01T00:00:00.000Z"),
			currentTimestamp: "2026-07-01T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2026-07-01");
		expect(plan.updatedTask.scheduled).toBe("2026-10-01");
		// 37-day offset: 2026-10-01 + 37 = 2026-11-07
		expect(plan.updatedTask.due).toBe("2026-11-07");
	});
});

describe("dynamic scheduled dates — future-dated task completes to correct cycle", () => {
	beforeEach(() => {
		// Today is mid-2026, but the task is scheduled in 2027.
		mockGetTodayString.mockReturnValue("2026-06-22");
	});

	it("advances to the occurrence after the 2027 scheduled date, not to 2026", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2027-04-03",
				due: "2027-05-07",
				complete_instances: [],
			}),
			targetDate: new Date("2027-04-03T00:00:00.000Z"),
			currentTimestamp: "2027-04-03T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		// Should advance to 2027-07-01, not jump back to 2026-07-01.
		expect(plan.updatedTask.scheduled).toBe("2027-07-01");
		expect(plan.updatedTask.complete_instances).toContain("2027-04-01");
	});
});

describe("dynamic scheduled dates — all past occurrences already completed", () => {
	beforeEach(() => {
		mockGetTodayString.mockReturnValue("2026-06-22");
	});

	it("does not toggle off an already-completed recurrence when scheduled is shifted past it", () => {
		// Scenario from bug report:
		// The 2028-01-01 recurrence was already completed.
		// The next cycle (2028-04-01) has not started yet.
		// User shifted scheduled from 2028-04-01 to 2028-03-01 as an early reminder.
		// Clicking "done" should mark 2028-04-01 as complete, NOT toggle 2028-01-01 off.
		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2028-03-01",
				due: "2028-05-07",
				complete_instances: ["2027-04-01", "2027-07-01", "2027-10-01", "2028-01-01"],
			}),
			targetDate: new Date("2028-03-01T00:00:00.000Z"),
			currentTimestamp: "2028-03-01T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.newComplete).toBe(true);
		// All previously-completed instances must still be present.
		expect(plan.updatedTask.complete_instances).toContain("2027-04-01");
		expect(plan.updatedTask.complete_instances).toContain("2027-07-01");
		expect(plan.updatedTask.complete_instances).toContain("2027-10-01");
		expect(plan.updatedTask.complete_instances).toContain("2028-01-01");
		// The next recurrence (2028-04-01) should be the newly completed instance.
		expect(plan.dateStr).toBe("2028-04-01");
		expect(plan.updatedTask.complete_instances).toContain("2028-04-01");
		// And the task should advance past 2028-04-01.
		expect(plan.updatedTask.scheduled).toBe("2028-07-01");
	});
});

describe("dynamic scheduled dates — skipped instance uses recurrence date", () => {
	beforeEach(() => {
		mockGetTodayString.mockReturnValue("2026-07-01");
	});

	it("stores the recurrence date in skipped_instances when scheduled is shifted", () => {
		const plan = buildRecurringTaskSkippedPlan({
			freshTask: task({
				recurrence: "DTSTART:20260401;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2026-07-03",
				due: "2026-08-07",
				complete_instances: ["2026-04-01"],
			}),
			targetDate: new Date("2026-07-03T00:00:00.000Z"),
			currentTimestamp: "2026-07-03T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2026-07-01");
		expect(plan.updatedTask.skipped_instances).toContain("2026-07-01");
		expect(plan.updatedTask.skipped_instances).not.toContain("2026-07-03");
		expect(plan.updatedTask.scheduled).toBe("2026-10-01");
	});

	it("keeps a moved Google Calendar exception keyed to its moved date", () => {
		mockGetTodayString.mockReturnValue("2026-04-15");

		const plan = buildRecurringTaskSkippedPlan({
			freshTask: task({
				recurrence: "DTSTART:20260316;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO",
				scheduled: "2026-04-15",
				googleCalendarEventId: "master-event-id",
				googleCalendarExceptionEventId: "detached-exception-id",
				googleCalendarExceptionOriginalScheduled: "2026-04-13",
			}),
			targetDate: new Date("2026-04-15T00:00:00.000Z"),
			currentTimestamp: "2026-04-15T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2026-04-15");
		expect(plan.updatedTask.skipped_instances).toContain("2026-04-15");
		expect(plan.updatedTask.googleCalendarMovedOriginalDates).toEqual(["2026-04-13"]);
		expect(plan.updatedTask.googleCalendarExceptionOriginalScheduled).toBeUndefined();
	});
});

describe("dynamic scheduled dates — recurrence identity edge cases", () => {
	it("preserves the scheduled time while advancing a shifted timed occurrence", () => {
		mockGetTodayString.mockReturnValue("2026-07-01");

		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20260401T100000Z;FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
				scheduled: "2026-07-03T10:00:00",
				complete_instances: ["2026-04-01"],
			}),
			targetDate: new Date("2026-07-03T00:00:00.000Z"),
			currentTimestamp: "2026-07-03T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.updatedTask.scheduled).toBe("2026-10-01T10:00:00");
	});

	it("finds the owning occurrence beyond the previous fixed search window", () => {
		mockGetTodayString.mockReturnValue("2026-06-01");

		const plan = buildRecurringTaskCompletePlan({
			freshTask: task({
				recurrence: "DTSTART:20250101;FREQ=MONTHLY;INTERVAL=24;BYMONTHDAY=1",
				scheduled: "2026-06-01",
			}),
			targetDate: new Date("2026-06-01T00:00:00.000Z"),
			currentTimestamp: "2026-06-01T00:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2025-01-01");
		expect(plan.updatedTask.complete_instances).toContain("2025-01-01");
		expect(plan.updatedTask.scheduled).toBe("2027-01-01");
	});
});
