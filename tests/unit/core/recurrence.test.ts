import {
	addDTSTARTToRecurrenceRule,
	generateRecurringInstances,
	getFiniteRecurringInstanceCount,
	getNextUncompletedOccurrence,
	getRecurrenceEndAfterDoneCount,
	isDueByRRule,
	isRecurrenceTerminated,
	shouldShowRecurringTaskOnDate,
	stripEndAfterDoneFromRecurrence,
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

	it("exposes the configured ENDONDONE completion cap", () => {
		expect(getRecurrenceEndAfterDoneCount("DTSTART:20260301;FREQ=DAILY;ENDONDONE=5")).toBe(5);
		expect(getRecurrenceEndAfterDoneCount("FREQ=DAILY")).toBeNull();
		expect(getRecurrenceEndAfterDoneCount("FREQ=DAILY;ENDONDONE=0")).toBeNull();
		expect(getRecurrenceEndAfterDoneCount(null)).toBeNull();
	});

	it("detects termination from the stored rule and completed instance count", () => {
		expect(
			isRecurrenceTerminated({
				recurrence: "FREQ=DAILY;ENDONDONE=3",
				complete_instances: ["2026-03-01", "2026-03-02", "2026-03-03"],
			})
		).toBe(true);
		expect(
			isRecurrenceTerminated({
				recurrence: "FREQ=DAILY;ENDONDONE=3",
				complete_instances: ["2026-03-01", "2026-03-02"],
			})
		).toBe(false);
		expect(
			isRecurrenceTerminated({
				recurrence: "FREQ=DAILY",
				complete_instances: ["2026-03-01", "2026-03-02", "2026-03-03"],
			})
		).toBe(false);
	});

	it("strips ENDONDONE from the rule before it reaches the recurrence model", () => {
		expect(stripEndAfterDoneFromRecurrence("DTSTART:20260301;FREQ=DAILY;ENDONDONE=3")).toBe(
			"DTSTART:20260301;FREQ=DAILY"
		);
		expect(stripEndAfterDoneFromRecurrence("FREQ=DAILY")).toBe("FREQ=DAILY");
		expect(stripEndAfterDoneFromRecurrence(undefined)).toBeUndefined();
	});

	it("reports the ENDONDONE cap as the finite instance count", () => {
		expect(getFiniteRecurringInstanceCount({ recurrence: "FREQ=DAILY;ENDONDONE=7" })).toBe(7);
	});

	it("stops advancing scheduled/due once the completion cap is reached", () => {
		const result = updateToNextScheduledOccurrence({
			title: "Terminating recurring task",
			recurrence: "DTSTART:20260301;FREQ=WEEKLY;ENDONDONE=2",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-22",
			due: "2026-03-24",
			complete_instances: ["2026-03-01", "2026-03-08"],
		});

		expect(result).toEqual({ scheduled: null, due: null });
	});

	it("still advances scheduled/due while below the completion cap", () => {
		const result = updateToNextScheduledOccurrence({
			title: "Below-cap recurring task",
			recurrence: "DTSTART:20260301;FREQ=WEEKLY;ENDONDONE=5",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-22",
			due: "2026-03-24",
			complete_instances: ["2026-03-01", "2026-03-08"],
		});

		expect(result).toEqual({
			scheduled: "2026-03-29",
			due: "2026-03-31",
		});
	});

	it("returns no next occurrence when the completion cap is reached", () => {
		const next = getNextUncompletedOccurrence({
			title: "Terminating task",
			recurrence: "DTSTART:20260301;FREQ=WEEKLY;ENDONDONE=2",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-22",
			complete_instances: ["2026-03-01", "2026-03-08"],
		});

		expect(next).toBeNull();
	});

	it("reports a terminated recurrence as not-due, not-shown, and with no instances", () => {
		const task = {
			title: "Terminating task",
			recurrence: "DTSTART:20260301;FREQ=DAILY;ENDONDONE=2",
			recurrence_anchor: "scheduled",
			scheduled: "2026-03-29",
			complete_instances: ["2026-03-01", "2026-03-08"],
		};
		const target = new Date("2026-03-29T00:00:00Z");

		expect(isDueByRRule(task, target)).toBe(false);
		expect(shouldShowRecurringTaskOnDate(task, target)).toBe(false);
		expect(generateRecurringInstances(task, target, target)).toEqual([]);
	});
});
