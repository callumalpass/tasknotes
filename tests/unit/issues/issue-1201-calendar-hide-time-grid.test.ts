/**
 * Regression coverage for issue #1201.
 *
 * Calendar Bases can now hide the hourly time-grid section while keeping the
 * all-day slot available for day-based planning.
 */

import fs from "fs";
import path from "path";

import {
	isTimeGridCalendarView,
	shouldHideCalendarTimeGrid,
} from "../../../src/bases/CalendarView";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1201: Calendar Bases hourly breakdown toggle", () => {
	it("only hides the time grid for FullCalendar timeGrid views", () => {
		expect(shouldHideCalendarTimeGrid(false, "timeGridWeek")).toBe(true);
		expect(shouldHideCalendarTimeGrid(false, "timeGridCustom")).toBe(true);
		expect(shouldHideCalendarTimeGrid(false, "timeGridDay")).toBe(true);
		expect(shouldHideCalendarTimeGrid(false, "dayGridMonth")).toBe(false);
		expect(shouldHideCalendarTimeGrid(false, "listWeek")).toBe(false);
		expect(shouldHideCalendarTimeGrid(true, "timeGridWeek")).toBe(false);
	});

	it("keeps the timeGrid view list explicit", () => {
		expect(isTimeGridCalendarView("timeGridWeek")).toBe(true);
		expect(isTimeGridCalendarView("timeGridCustom")).toBe(true);
		expect(isTimeGridCalendarView("timeGridDay")).toBe(true);
		expect(isTimeGridCalendarView("multiMonthYear")).toBe(false);
	});

	it("registers a per-view Bases option for the hourly breakdown", () => {
		const registrationSource = readRepoFile("src/bases/registration.ts");
		const englishSource = readRepoFile("src/i18n/resources/en.ts");

		expect(registrationSource).toContain('key: "showTimeGrid"');
		expect(registrationSource).toContain('displayName: t("layout.showTimeGrid")');
		expect(registrationSource).toContain("default: true");
		expect(englishSource).toContain('showTimeGrid: "Show hourly breakdown"');
	});

	it("uses a scoped CSS state class for the FullCalendar timed body", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");

		expect(css).toContain("advanced-calendar-view--hide-time-grid");
		expect(css).toContain(".fc-timegrid .fc-timegrid-body");
		expect(css).toContain(".fc-timegrid .fc-timegrid-divider");
	});
});
