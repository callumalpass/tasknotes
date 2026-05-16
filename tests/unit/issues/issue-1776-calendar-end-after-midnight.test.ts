import {
	CALENDAR_END_TIME_MAX_HOUR,
	normalizeCalendarTimeValue,
} from "../../../src/utils/calendarTime";

describe("issue 1776 - calendar end time after midnight", () => {
	it("allows timeline end times into the next day", () => {
		expect(
			normalizeCalendarTimeValue("26:00", "24:00:00", {
				maxHour: CALENDAR_END_TIME_MAX_HOUR,
				allowMaxHourOnlyAtZero: true,
			})
		).toEqual({ value: "26:00:00", isValid: true });

		expect(
			normalizeCalendarTimeValue("26:30:00", "24:00:00", {
				maxHour: CALENDAR_END_TIME_MAX_HOUR,
				allowMaxHourOnlyAtZero: true,
			})
		).toEqual({ value: "26:30:00", isValid: true });
	});

	it("caps extended end times to the next day boundary", () => {
		expect(
			normalizeCalendarTimeValue("48:00", "24:00:00", {
				maxHour: CALENDAR_END_TIME_MAX_HOUR,
				allowMaxHourOnlyAtZero: true,
			})
		).toEqual({ value: "48:00:00", isValid: true });

		expect(
			normalizeCalendarTimeValue("48:30", "24:00:00", {
				maxHour: CALENDAR_END_TIME_MAX_HOUR,
				allowMaxHourOnlyAtZero: true,
			})
		).toEqual({ value: "24:00:00", isValid: false });

		expect(
			normalizeCalendarTimeValue("49:00", "24:00:00", {
				maxHour: CALENDAR_END_TIME_MAX_HOUR,
				allowMaxHourOnlyAtZero: true,
			})
		).toEqual({ value: "24:00:00", isValid: false });
	});

	it("keeps ordinary calendar times inside the same day by default", () => {
		expect(normalizeCalendarTimeValue("23:30", "00:00:00")).toEqual({
			value: "23:30:00",
			isValid: true,
		});
		expect(normalizeCalendarTimeValue("24:00", "00:00:00")).toEqual({
			value: "00:00:00",
			isValid: false,
		});
	});
});
