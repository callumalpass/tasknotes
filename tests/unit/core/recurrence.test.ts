import {
	addDTSTARTToRecurrenceRule,
	getNextUncompletedOccurrence,
	updateToNextScheduledOccurrence,
} from "../../../src/core/recurrence";
import type { TaskInfo } from "../../../src/types";
import * as dateUtils from "../../../src/utils/dateUtils";

jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getTodayString: jest.fn(() => "2026-03-29"),
	};
});

describe("core/recurrence", () => {
	it("calculates the next scheduled-based occurrence from a narrow task shape", () => {
		const next = getNextUncompletedOccurrence({
			title: "Recurring task",
			recurrence: "DTSTART:20260301;FREQ=WEEKLY;INTERVAL=1",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-01",
			complete_instances: ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"],
		});

		expect(dateUtils.formatDateForStorage(next!)).toBe("2026-03-29");
	});

	it("preserves due offset when advancing to the next occurrence", () => {
		const result = updateToNextScheduledOccurrence({
			title: "Task with due offset",
			recurrence: "DTSTART:20260301;FREQ=WEEKLY;INTERVAL=1",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-22",
			due: "2026-03-24",
			complete_instances: ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"],
		});

		expect(result).toEqual({
			scheduled: "2026-03-29",
			due: "2026-03-31",
		});
	});

	it("preserves due offset for timed recurring tasks", () => {
		const result = updateToNextScheduledOccurrence({
			title: "Timed recurring task with due offset",
			recurrence: "DTSTART:20260328T103000;FREQ=DAILY",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-28T10:30",
			due: "2026-03-29T10:30",
			complete_instances: ["2026-03-28"],
			skipped_instances: [],
		});

		expect(result).toEqual({
			scheduled: "2026-03-29T10:30",
			due: "2026-03-30T10:30",
		});
	});

	it("adds DTSTART without depending on a full TaskInfo object", () => {
		const recurrence = addDTSTARTToRecurrenceRule({
			recurrence: "FREQ=DAILY;INTERVAL=2",
			scheduled: "2026-03-29",
		});

		expect(recurrence).toBe("DTSTART:20260329;FREQ=DAILY;INTERVAL=2");
	});
});
