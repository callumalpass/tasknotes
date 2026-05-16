import {
	getCalendarSizingOptions,
	normalizeCalendarHeightMode,
} from "../../../src/bases/CalendarView";

describe("Issue #1818: calendar height mode", () => {
	it("defaults unknown height mode values to fill", () => {
		expect(normalizeCalendarHeightMode(undefined)).toBe("fill");
		expect(normalizeCalendarHeightMode("")).toBe("fill");
		expect(normalizeCalendarHeightMode("fill")).toBe("fill");
		expect(normalizeCalendarHeightMode("dashboard")).toBe("fill");
	});

	it("normalizes auto height mode", () => {
		expect(normalizeCalendarHeightMode("auto")).toBe("auto");
		expect(normalizeCalendarHeightMode(" AUTO ")).toBe("auto");
	});

	it("keeps existing full-height calendar sizing by default", () => {
		expect(getCalendarSizingOptions("fill")).toEqual({
			height: "100%",
			expandRows: true,
		});
	});

	it("uses content-sized FullCalendar options for auto height mode", () => {
		expect(getCalendarSizingOptions("auto")).toEqual({
			height: "auto",
			contentHeight: "auto",
			expandRows: false,
		});
	});
});
