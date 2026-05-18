/**
 * Issue #561: monthly recurrence should be configurable for the last day of
 * each month.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/561
 */

import {
	buildCustomRecurrenceRule,
	getMonthDayOptions,
	type CustomRecurrenceRuleInput,
} from "../../../src/components/RecurrenceContextMenu";
import { generateRecurringInstances } from "../../../src/core/recurrence";

function buildRule(overrides: Partial<CustomRecurrenceRuleInput>): string {
	return buildCustomRecurrenceRule({
		frequency: "MONTHLY",
		interval: 1,
		dtstart: "2026-01-31",
		dtstartTime: "",
		recurrenceAnchor: "scheduled",
		byDay: [],
		byMonthDay: [],
		byMonth: [],
		bySetPos: undefined,
		endType: "never",
		count: undefined,
		until: "",
		...overrides,
	});
}

describe("Issue #561: last-day-of-month recurrence", () => {
	it("offers the last day as a month-day picker option", () => {
		expect(getMonthDayOptions()).toContainEqual({ value: "-1", text: "Last day" });
	});

	it("builds a monthly BYMONTHDAY=-1 rule from the custom recurrence picker", () => {
		expect(
			buildRule({
				monthlyType: "bydate",
				byMonthDay: [-1],
			})
		).toBe("DTSTART:20260131;FREQ=MONTHLY;BYMONTHDAY=-1");
	});

	it("materializes BYMONTHDAY=-1 on each calendar month's last day", () => {
		const instances = generateRecurringInstances(
			{
				title: "Month end",
				recurrence: "DTSTART:20260131;FREQ=MONTHLY;BYMONTHDAY=-1",
				scheduled: "2026-01-31",
			},
			new Date(Date.UTC(2026, 0, 1)),
			new Date(Date.UTC(2026, 2, 31))
		);

		expect(instances.map((date) => date.toISOString().slice(0, 10))).toEqual([
			"2026-01-31",
			"2026-02-28",
			"2026-03-31",
		]);
	});
});
