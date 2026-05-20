import {
	buildRecurrenceOptions,
	formatDateForInput,
	getRecurrenceStartDate,
	type BuildRecurrenceOptionsInput,
} from "../../../src/components/RecurrenceContextMenu";

const translate: BuildRecurrenceOptionsInput["translate"] = (key, vars) => {
	if (vars?.day) return vars.day;
	if (vars?.ordinal) return vars.ordinal;
	if (vars?.month) return vars.month;
	return key;
};

describe("Issue #1911: recurrence menus use the task scheduled date", () => {
	it("builds quick recurrence rules from the prepopulated scheduled date", () => {
		const options = buildRecurrenceOptions({
			scheduledDate: "2026-05-25",
			calendarLocale: "en-US",
			translate,
		});

		expect(options[0].value).toBe("DTSTART:20260525;FREQ=DAILY;INTERVAL=1");
		expect(options[1].value).toBe("DTSTART:20260525;FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
		expect(options[3].value).toBe(
			"DTSTART:20260525;FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=25"
		);
		expect(options[5].value).toBe(
			"DTSTART:20260525;FREQ=YEARLY;INTERVAL=1;BYMONTH=5;BYMONTHDAY=25"
		);
		expect(options[6].value).toBe("DTSTART:20260525;FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
	});

	it("keeps scheduled times and existing recurrence times on the selected date", () => {
		expect(
			buildRecurrenceOptions({
				scheduledDate: "2026-05-25T14:30",
				calendarLocale: "en-US",
				translate,
			})[0].value
		).toBe("DTSTART:20260525T143000Z;FREQ=DAILY;INTERVAL=1");

		expect(
			buildRecurrenceOptions({
				currentValue: "DTSTART:20260401T091500Z;FREQ=DAILY",
				scheduledDate: "2026-05-25T14:30",
				calendarLocale: "en-US",
				translate,
			})[0].value
		).toBe("DTSTART:20260525T091500Z;FREQ=DAILY;INTERVAL=1");
	});

	it("uses the scheduled date as the default custom recurrence start date", () => {
		expect(formatDateForInput(getRecurrenceStartDate("2026-05-25T14:30"))).toBe(
			"2026-05-25"
		);
		expect(
			formatDateForInput(getRecurrenceStartDate("2026-02-31", new Date(2026, 0, 2)))
		).toBe("2026-01-02");
	});
});
