import { getNextUncompletedOccurrence } from "../../../src/utils/helpers";
import { TaskInfo } from "../../../src/types";
import * as dateUtils from "../../../src/utils/dateUtils";

// Mock dateUtils to control "today"
jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getTodayString: jest.fn(() => "2026-02-08"),
	};
});

describe("Issue #1556: Recurring task with INTERVAL > 30 should reschedule", () => {
	it("schedules completion-based DAILY task with INTERVAL=60", () => {
		const task: TaskInfo = {
			title: "Every 60 days task",
			status: "open",
			path: "tasks/test.md",
			recurrence: "DTSTART:20260208;FREQ=DAILY;INTERVAL=60",
			recurrence_anchor: "completion",
		};

		const next = getNextUncompletedOccurrence(task);
		expect(next).not.toBeNull();
		const nextStr = dateUtils.formatDateForStorage(next!);
		expect(nextStr).toBe("2026-04-09");
	});

	it("schedules scheduled-based DAILY task with INTERVAL=60", () => {
		const task: TaskInfo = {
			title: "Every 60 days scheduled task",
			status: "open",
			path: "tasks/test.md",
			recurrence: "DTSTART:20260101;FREQ=DAILY;INTERVAL=60",
			recurrence_anchor: "scheduled",
			scheduled: "2026-01-01",
			complete_instances: ["2026-01-01"],
		};

		const next = getNextUncompletedOccurrence(task);
		expect(next).not.toBeNull();
		const nextStr = dateUtils.formatDateForStorage(next!);
		expect(nextStr).toBe("2026-03-02");
	});

	it("schedules completion-based WEEKLY task with INTERVAL=20", () => {
		const task: TaskInfo = {
			title: "Every 20 weeks task",
			status: "open",
			path: "tasks/test.md",
			recurrence: "DTSTART:20260208;FREQ=WEEKLY;INTERVAL=20",
			recurrence_anchor: "completion",
		};

		const next = getNextUncompletedOccurrence(task);
		expect(next).not.toBeNull();
		const nextStr = dateUtils.formatDateForStorage(next!);
		expect(nextStr).toBe("2026-06-28");
	});

	it("still works for DAILY with INTERVAL=1 (no regression)", () => {
		const task: TaskInfo = {
			title: "Daily task",
			status: "open",
			path: "tasks/test.md",
			recurrence: "DTSTART:20260208;FREQ=DAILY;INTERVAL=1",
			recurrence_anchor: "completion",
		};

		const next = getNextUncompletedOccurrence(task);
		expect(next).not.toBeNull();
		const nextStr = dateUtils.formatDateForStorage(next!);
		expect(nextStr).toBe("2026-02-09");
	});
});
