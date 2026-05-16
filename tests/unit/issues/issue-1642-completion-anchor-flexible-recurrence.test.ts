import { buildCustomRecurrenceRule } from "../../../src/components/RecurrenceContextMenu";
import type { CustomRecurrenceRuleInput } from "../../../src/components/RecurrenceContextMenu";

function buildRule(overrides: Partial<CustomRecurrenceRuleInput>): string {
	return buildCustomRecurrenceRule({
		frequency: "MONTHLY",
		interval: 1,
		dtstart: "2026-02-24",
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

describe("issue #1642 completion-anchored recurrence rules", () => {
	it("does not force a weekday for flexible weekly recurrence", () => {
		const rule = buildRule({
			frequency: "WEEKLY",
			recurrenceAnchor: "completion",
			byDay: ["TU"],
		});

		expect(rule).toBe("DTSTART:20260224;FREQ=WEEKLY");
	});

	it("does not force a month day for flexible monthly recurrence", () => {
		const rule = buildRule({
			frequency: "MONTHLY",
			interval: 3,
			recurrenceAnchor: "completion",
			monthlyType: "bydate",
			byMonthDay: [24],
		});

		expect(rule).toBe("DTSTART:20260224;FREQ=MONTHLY;INTERVAL=3");
	});

	it("does not force a month or month day for flexible yearly recurrence", () => {
		const rule = buildRule({
			frequency: "YEARLY",
			recurrenceAnchor: "completion",
			yearlyType: "bydate",
			byMonth: [2],
			byMonthDay: [24],
		});

		expect(rule).toBe("DTSTART:20260224;FREQ=YEARLY");
	});

	it("keeps fixed month-day rules for scheduled monthly recurrence", () => {
		const rule = buildRule({
			frequency: "MONTHLY",
			recurrenceAnchor: "scheduled",
			monthlyType: "bydate",
			byMonthDay: [24],
		});

		expect(rule).toBe("DTSTART:20260224;FREQ=MONTHLY;BYMONTHDAY=24");
	});
});
