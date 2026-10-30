/**
 * Issue #1818: calendar height mode. Embedded calendars (#1034, #1037, #1449)
 * size to their content unless the user chose otherwise.
 */

import { normalizeCalendarHeightMode } from "../../../src/bases/CalendarView";
import { calendarOptionsFor } from "../../helpers/calendarViewHarness";

describe("Issue #1818: calendar height mode", () => {
	afterEach(() => document.body.replaceChildren());

	it("normalizes height mode values, defaulting to fill", () => {
		expect(normalizeCalendarHeightMode(undefined)).toBe("fill");
		expect(normalizeCalendarHeightMode("dashboard")).toBe("fill");
		expect(normalizeCalendarHeightMode(" AUTO ")).toBe("auto");
	});

	it("fills the view by default", () => {
		expect(calendarOptionsFor({})).toMatchObject({ height: "fill", expandRows: true });
	});

	it("sizes to content when height mode is auto", () => {
		expect(calendarOptionsFor({ heightMode: "auto" })).toMatchObject({
			height: "auto",
			expandRows: false,
		});
	});

	it.each(["dayGridMonth", "timeGridWeek", "listWeek", "multiMonthYear"])(
		"sizes embedded %s calendars to content",
		(calendarView) => {
			expect(calendarOptionsFor({ calendarView }, { embedded: true })).toMatchObject({
				height: "auto",
				expandRows: false,
			});
		}
	);
});
