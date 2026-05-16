import {
	buildPropertyEventDateSpans,
	normalizeDateValuesForCalendar,
} from "../../../src/bases/CalendarView";

describe("issue #1641 property-based calendar date lists", () => {
	it("normalizes each date in a list-valued property", () => {
		const values = normalizeDateValuesForCalendar(["2026-02-24", "2026-02-25T10:30"]);

		expect(values).toEqual([
			{
				value: "2026-02-24",
				isAllDay: true,
				sourceIndex: 0,
				fromList: true,
			},
			{
				value: "2026-02-25T10:30",
				isAllDay: false,
				sourceIndex: 1,
				fromList: true,
			},
		]);
	});

	it("pairs list-valued start and end dates by list index", () => {
		const spans = buildPropertyEventDateSpans(
			["2026-02-24T09:00", "2026-02-25T10:00"],
			["2026-02-24T11:00", "2026-02-25T12:00"]
		);

		expect(spans).toEqual([
			{
				start: {
					value: "2026-02-24T09:00",
					isAllDay: false,
					sourceIndex: 0,
					fromList: true,
				},
				end: {
					value: "2026-02-24T11:00",
					isAllDay: false,
					sourceIndex: 0,
					fromList: true,
				},
				index: 0,
				fromList: true,
			},
			{
				start: {
					value: "2026-02-25T10:00",
					isAllDay: false,
					sourceIndex: 1,
					fromList: true,
				},
				end: {
					value: "2026-02-25T12:00",
					isAllDay: false,
					sourceIndex: 1,
					fromList: true,
				},
				index: 1,
				fromList: true,
			},
		]);
	});

	it("does not apply one scalar end date to multiple list-backed starts", () => {
		const spans = buildPropertyEventDateSpans(
			["2026-02-24T09:00", "2026-02-25T10:00"],
			"2026-02-24T11:00"
		);

		expect(spans).toHaveLength(2);
		expect(spans[0].end).toBeUndefined();
		expect(spans[1].end).toBeUndefined();
	});

	it("keeps scalar start and end dates as one editable span", () => {
		const spans = buildPropertyEventDateSpans("2026-02-24", "2026-02-25");

		expect(spans).toEqual([
			{
				start: {
					value: "2026-02-24",
					isAllDay: true,
					sourceIndex: undefined,
					fromList: false,
				},
				end: {
					value: "2026-02-25",
					isAllDay: true,
					sourceIndex: undefined,
					fromList: false,
				},
				index: 0,
				fromList: false,
			},
		]);
	});
});
