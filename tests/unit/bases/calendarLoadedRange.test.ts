import { calendarRangeIsLoaded, loadedCalendarRange } from "../../../src/bases/calendarViewLayout";

const view = (type: string, startDay: number, endDay: number, dataRange?: [number, number]) => ({
	type,
	range: { startDay, endDay },
	dataRange: dataRange ? { startDay: dataRange[0], endDay: dataRange[1] } : undefined,
});

describe("calendarRangeIsLoaded (#2716)", () => {
	// An agenda's list covers days 100-114 and its strip had moved on to the week 112-119.
	const loaded = loadedCalendarRange(view("list", 100, 114, [100, 119]));

	it("needs no fetch when the strip moves back to days already loaded", () => {
		expect(calendarRangeIsLoaded(loaded, view("list", 100, 114, [100, 114]))).toBe(true);
		expect(calendarRangeIsLoaded(loaded, view("list", 100, 114, [98, 114]))).toBe(false);
	});

	it("fetches when the list grows past the loaded days", () => {
		expect(calendarRangeIsLoaded(loaded, view("list", 100, 121, [100, 121]))).toBe(false);
	});

	it("fetches for another view type and when nothing is loaded yet", () => {
		expect(calendarRangeIsLoaded(loaded, view("month", 100, 114))).toBe(false);
		expect(calendarRangeIsLoaded(null, view("list", 100, 114))).toBe(false);
	});
});
