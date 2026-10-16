import {
	buildCustomRecurrenceRule,
	type CustomRecurrenceRuleInput,
} from "../../../src/components/RecurrenceContextMenu";
import {
	getRecurrenceEndAfterDoneCount,
	isRecurrenceTerminated,
	stripEndAfterDoneFromRecurrence,
} from "../../../src/core/recurrence";

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
		doneCount: undefined,
		...overrides,
	});
}

describe("custom recurrence end-after-done round trip", () => {
	it("emits ENDONDONE for the doneCount end type", () => {
		const rule = buildRule({ endType: "doneCount", doneCount: 5 });

		expect(rule).toBe("DTSTART:20260518;FREQ=DAILY;ENDONDONE=5");
	});

	it("omits ENDONDONE when doneCount is not positive", () => {
		expect(buildRule({ endType: "doneCount", doneCount: 0 })).toBe(
			"DTSTART:20260518;FREQ=DAILY"
		);
		expect(buildRule({ endType: "doneCount", doneCount: undefined })).toBe(
			"DTSTART:20260518;FREQ=DAILY"
		);
	});

	it("ignores doneCount for the other end types", () => {
		expect(buildRule({ endType: "count", count: 3, doneCount: 5 })).toBe(
			"DTSTART:20260518;FREQ=DAILY;COUNT=3"
		);
		expect(buildRule({ endType: "until", until: "2026-12-31", doneCount: 5 })).toBe(
			"DTSTART:20260518;FREQ=DAILY;UNTIL=20261231"
		);
	});

	describe("getRecurrenceEndAfterDoneCount", () => {
		it("extracts the cap wherever it appears in the rule", () => {
			expect(getRecurrenceEndAfterDoneCount("FREQ=DAILY;ENDONDONE=3")).toBe(3);
			expect(getRecurrenceEndAfterDoneCount("ENDONDONE=3;FREQ=DAILY")).toBe(3);
			expect(getRecurrenceEndAfterDoneCount("FREQ=DAILY;INTERVAL=2;ENDONDONE=7")).toBe(
				7
			);
		});

		it("returns null when no valid cap is present", () => {
			expect(getRecurrenceEndAfterDoneCount("FREQ=DAILY")).toBeNull();
			expect(getRecurrenceEndAfterDoneCount(undefined)).toBeNull();
			expect(getRecurrenceEndAfterDoneCount("")).toBeNull();
			expect(getRecurrenceEndAfterDoneCount("FREQ=DAILY;ENDONDONE=0")).toBeNull();
		});
	});

	describe("isRecurrenceTerminated", () => {
		const rule = "FREQ=DAILY;ENDONDONE=3";

		it("is false below the cap and true at or above it", () => {
			expect(isRecurrenceTerminated({ recurrence: rule, complete_instances: [] })).toBe(
				false
			);
			expect(
				isRecurrenceTerminated({
					recurrence: rule,
					complete_instances: ["2026-05-18", "2026-05-19"],
				})
			).toBe(false);
			expect(
				isRecurrenceTerminated({
					recurrence: rule,
					complete_instances: ["2026-05-18", "2026-05-19", "2026-05-20"],
				})
			).toBe(true);
			expect(
				isRecurrenceTerminated({
					recurrence: rule,
					complete_instances: ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21"],
				})
			).toBe(true);
		});

		it("is always false without a cap", () => {
			expect(
				isRecurrenceTerminated({
					recurrence: "FREQ=DAILY",
					complete_instances: ["2026-05-18", "2026-05-19", "2026-05-20"],
				})
			).toBe(false);
		});
	});

	describe("stripEndAfterDoneFromRecurrence", () => {
		it("removes only the ENDONDONE part", () => {
			expect(stripEndAfterDoneFromRecurrence("FREQ=DAILY;ENDONDONE=3")).toBe(
				"FREQ=DAILY"
			);
			expect(
				stripEndAfterDoneFromRecurrence("DTSTART:20260518;FREQ=DAILY;ENDONDONE=3")
			).toBe("DTSTART:20260518;FREQ=DAILY");
		});

		it("returns rules without ENDONDONE unchanged", () => {
			expect(stripEndAfterDoneFromRecurrence("FREQ=DAILY")).toBe("FREQ=DAILY");
			expect(stripEndAfterDoneFromRecurrence(undefined)).toBeUndefined();
		});

		it("returns undefined when stripping empties the rule", () => {
			expect(stripEndAfterDoneFromRecurrence("ENDONDONE=3")).toBeUndefined();
		});
	});
});