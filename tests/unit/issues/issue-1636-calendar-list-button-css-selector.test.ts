/**
 * Issue #1636: CSS issues with list button in calendar view
 *
 * Reported by @vroablec.
 *
 * The calendar toolbar uses a custom button key (`listWeekButton`), which FullCalendar
 * renders with class `.fc-listWeekButton-button`. Current plugin CSS targets the
 * built-in list view button class `.fc-listWeek-button`, so custom button-specific
 * selectors do not match.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1636
 */

import { describe, expect, it } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1636: list button CSS selector mismatch", () => {
	it("uses the built-in listWeek toolbar button so CSS and active state match", () => {
		const calendarViewSource = readRepoFile("src/bases/CalendarView.ts");
		const calendarCssSource = readRepoFile("styles/advanced-calendar-view.css");

		const toolbarRightMatch = calendarViewSource.match(/right:\s*"([^"]+)"/);
		const toolbarButtons = toolbarRightMatch?.[1]
			.split(",")
			.map((button) => button.trim())
			.filter(Boolean) ?? [];

		const toolbarUsesCustomListButton = toolbarButtons.includes("listWeekButton");
		const toolbarUsesBuiltInListButton = toolbarButtons.includes("listWeek");

		const cssTargetsBuiltInListButtonClass = calendarCssSource.includes(".fc-listWeek-button");

		expect(toolbarUsesCustomListButton).toBe(false);
		expect(calendarViewSource).not.toContain("listWeekButton");
		expect(toolbarUsesBuiltInListButton).toBe(true);
		expect(cssTargetsBuiltInListButtonClass).toBe(true);
	});
});
