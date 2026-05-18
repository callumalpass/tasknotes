import { buildCustomRecurrenceRule } from "../../../src/components/RecurrenceContextMenu";
import type { CustomRecurrenceRuleInput } from "../../../src/components/RecurrenceContextMenu";

function buildRule(overrides: Partial<CustomRecurrenceRuleInput>): string {
	return buildCustomRecurrenceRule({
		frequency: "DAILY",
		interval: 1,
		dtstart: "2026-05-18",
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

describe("Issue #217: daily interval recurrence can be limited to weekdays", () => {
	it("builds a daily interval rule with selected weekdays", () => {
		const rule = buildRule({
			interval: 3,
			byDay: ["MO", "TU", "WE", "TH", "FR"],
		});

		expect(rule).toBe(
			"DTSTART:20260518;FREQ=DAILY;INTERVAL=3;BYDAY=MO,TU,WE,TH,FR"
		);
	});

	it("keeps completion-anchored daily intervals flexible", () => {
		const rule = buildRule({
			interval: 3,
			recurrenceAnchor: "completion",
			byDay: ["MO", "TU", "WE", "TH", "FR"],
		});

		expect(rule).toBe("DTSTART:20260518;FREQ=DAILY;INTERVAL=3");
	});
});
