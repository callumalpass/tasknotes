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
	it.skip("reproduces issue #1636", () => {
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
		const cssTargetsCustomListButtonClass = calendarCssSource.includes(".fc-listWeekButton-button");
		const customButtonSynchronizesActiveClass = /fc-button-active/.test(calendarViewSource);

		expect(toolbarUsesCustomListButton).toBe(true);
		expect(cssTargetsBuiltInListButtonClass).toBe(true);

		// Expected after fix:
		// - either switch toolbar to built-in listWeek button (automatic active-state handling),
		// - or keep custom button and style/sync it explicitly.
		expect(
			toolbarUsesBuiltInListButton ||
				(cssTargetsCustomListButtonClass && customButtonSynchronizesActiveClass)
		).toBe(true);
	});
});
