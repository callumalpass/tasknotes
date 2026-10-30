import type { PriorityConfig, StatusConfig } from "../../../src/types";
import {
	getDefaultTaskModalPriority,
	getDefaultTaskModalStatus,
	getOrdinal,
	getTaskModalRecurrenceDisplayText,
} from "../../../src/modals/taskModalActionValues";

function status(value: string, order: number): StatusConfig {
	return {
		id: value,
		value,
		label: value,
		color: "",
		order,
		isCompleted: false,
		autoArchive: false,
		autoArchiveDelay: 0,
	};
}

function priority(value: string, weight: number): PriorityConfig {
	return {
		id: value,
		value,
		label: value,
		color: "",
		weight,
	};
}

describe("taskModalActionValues", () => {
	it("derives default status and priority from configured ordering", () => {
		expect(getDefaultTaskModalStatus([status("later", 20), status("open", 0)])).toBe(
			"open"
		);
		expect(getDefaultTaskModalPriority([priority("high", 10), priority("normal", 0)])).toBe(
			"normal"
		);
	});

	it("falls back when status or priority configs are missing", () => {
		expect(getDefaultTaskModalStatus(undefined)).toBe("open");
		expect(getDefaultTaskModalStatus([])).toBe("open");
		expect(getDefaultTaskModalPriority(undefined)).toBe("normal");
		expect(getDefaultTaskModalPriority([])).toBe("normal");
	});

	it("formats common daily and weekly recurrence labels", () => {
		expect(getTaskModalRecurrenceDisplayText("")).toBe("");
		expect(getTaskModalRecurrenceDisplayText("FREQ=DAILY")).toBe("Daily");
		expect(getTaskModalRecurrenceDisplayText("FREQ=WEEKLY")).toBe("Weekly");
		expect(getTaskModalRecurrenceDisplayText("FREQ=WEEKLY;INTERVAL=2")).toBe(
			"Every 2 weeks"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe(
			"Weekdays"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=WEEKLY;BYDAY=TU")).toBe(
			"Weekly on Tuesday"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=WEEKLY;BYDAY=XX")).toBe(
			"Custom recurrence: FREQ=WEEKLY;BYDAY=XX"
		);
	});

	it("formats monthly and yearly recurrence labels", () => {
		expect(getTaskModalRecurrenceDisplayText("FREQ=MONTHLY")).toBe("Monthly");
		expect(getTaskModalRecurrenceDisplayText("FREQ=MONTHLY;INTERVAL=3")).toBe(
			"Every 3 months"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=MONTHLY;BYMONTHDAY=1")).toBe(
			"Monthly on the 1st"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=MONTHLY;BYDAY=MO")).toBe(
			"Monthly on every Monday"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=YEARLY")).toBe("Yearly");
		expect(getTaskModalRecurrenceDisplayText("FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=3")).toBe(
			"Yearly on May 3"
		);
	});

	it("preserves all unsupported rule data in the custom fallback", () => {
		expect(getTaskModalRecurrenceDisplayText("FREQ=HOURLY;COUNT=4")).toBe(
			"Custom recurrence: FREQ=HOURLY;COUNT=4"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=HOURLY;UNTIL=20260519")).toBe(
			"Custom recurrence: FREQ=HOURLY;UNTIL=20260519"
		);
		expect(getTaskModalRecurrenceDisplayText("FREQ=HOURLY")).toBe("Custom recurrence: FREQ=HOURLY");
	});

	it("formats ordinal suffixes", () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21].map(getOrdinal)).toEqual([
			"1st",
			"2nd",
			"3rd",
			"4th",
			"11th",
			"12th",
			"13th",
			"21st",
		]);
	});
});
