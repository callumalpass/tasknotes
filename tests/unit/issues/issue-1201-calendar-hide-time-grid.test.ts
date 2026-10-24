/**
 * Regression coverage for issue #1201.
 *
 * Calendar Bases can hide the hourly time-grid section while keeping the
 * all-day slot available for day-based planning.
 */

import { shouldHideCalendarTimeGrid } from "../../../src/bases/CalendarView";
import { calendarOptionsFor } from "../../helpers/calendarViewHarness";

describe("Issue #1201: Calendar Bases hourly breakdown toggle", () => {
	afterEach(() => document.body.replaceChildren());

	it("only hides the time grid for time-grid views", () => {
		expect(shouldHideCalendarTimeGrid(false, "timeGridWeek")).toBe(true);
		expect(shouldHideCalendarTimeGrid(false, "timeGridCustom")).toBe(true);
		expect(shouldHideCalendarTimeGrid(false, "timeGridDay")).toBe(true);
		expect(shouldHideCalendarTimeGrid(false, "dayGridMonth")).toBe(false);
		expect(shouldHideCalendarTimeGrid(false, "listWeek")).toBe(false);
		expect(shouldHideCalendarTimeGrid(true, "timeGridWeek")).toBe(false);
	});

	it("hides the time grid and shows every all-day event by default (#2387)", () => {
		const options = calendarOptionsFor({ calendarView: "timeGridWeek", showTimeGrid: false });

		expect(options.timeGrid).toBe(false);
		expect(options.dayMaxEvents).toBe(false);
	});

	it("keeps an explicit all-day event limit when the time grid is hidden", () => {
		const options = calendarOptionsFor({
			calendarView: "timeGridWeek",
			showTimeGrid: false,
			dayMaxEvents: 5,
		});

		expect(options.dayMaxEvents).toBe(5);
	});

	it("keeps the automatic all-day limit while the time grid is shown", () => {
		const options = calendarOptionsFor({ calendarView: "timeGridWeek" });

		expect(options.timeGrid).toBe(true);
		expect(options.dayMaxEvents).toBe(true);
	});
});
