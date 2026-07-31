/**
 * Issue #2034: Desktop split/narrow Calendar panes should not use the mobile
 * high-contrast timed-event fill.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2034
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #2034: narrow desktop calendar contrast", () => {
	it("keeps solid time-grid event fills scoped to Obsidian mobile", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const desktopSolidFillRule =
			/(^|\n)\s*\.advanced-calendar-view \.fc-timegrid-event\.fc-task-event,\s*\n\s*\.advanced-calendar-view \.fc-timegrid-event\.fc-ics-event,\s*\n\s*\.advanced-calendar-view \.fc-timegrid-event\[data-event-type="property-based"\]\s*\{\s*background-color:\s*var\(--fc-event-border-color\);/;
		const mobileSolidFillRule =
			/(^|\n)\s*body\.is-mobile \.advanced-calendar-view \.fc-timegrid-event\.fc-task-event,\s*\n\s*body\.is-mobile \.advanced-calendar-view \.fc-timegrid-event\.fc-ics-event,\s*\n\s*body\.is-mobile \.advanced-calendar-view \.fc-timegrid-event\[data-event-type="property-based"\]\s*\{\s*background-color:\s*var\(--fc-event-border-color\);/;

		expect(css).not.toMatch(desktopSolidFillRule);
		expect(css).toMatch(mobileSolidFillRule);
	});
});
