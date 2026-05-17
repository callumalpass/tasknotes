import {
	buildWeekdaysOnlyRecurrenceRule,
	getOrderedRecurrenceWeekdays,
	getWeekdayOnlyRRuleCodes,
} from "../../../src/components/RecurrenceContextMenu";

describe("Issue #782: recurrence weekdays respect locale and first-day settings", () => {
	it("keeps the default weekdays-only rule as Monday through Friday for US-style locales", () => {
		expect(getWeekdayOnlyRRuleCodes("en-US")).toEqual(["MO", "TU", "WE", "TH", "FR"]);
		expect(buildWeekdaysOnlyRecurrenceRule("20260518", "en-US")).toBe(
			"DTSTART:20260518;FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
		);
	});

	it("uses locale weekend data for Sunday-through-Thursday work weeks", () => {
		expect(getWeekdayOnlyRRuleCodes("ar-SA")).toEqual(["SU", "MO", "TU", "WE", "TH"]);
		expect(buildWeekdaysOnlyRecurrenceRule("20260518", "ar-SA")).toBe(
			"DTSTART:20260518;FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH"
		);
	});

	it("orders custom recurrence weekday choices by first day of week", () => {
		expect(getOrderedRecurrenceWeekdays(0).map((day) => day.code)).toEqual([
			"SU",
			"MO",
			"TU",
			"WE",
			"TH",
			"FR",
			"SA",
		]);
		expect(getOrderedRecurrenceWeekdays(1).map((day) => day.code)).toEqual([
			"MO",
			"TU",
			"WE",
			"TH",
			"FR",
			"SA",
			"SU",
		]);
		expect(getOrderedRecurrenceWeekdays(6).map((day) => day.code)).toEqual([
			"SA",
			"SU",
			"MO",
			"TU",
			"WE",
			"TH",
			"FR",
		]);
	});
});
