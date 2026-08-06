/**
 * Issues #2120 and #2135: long all-day event titles in time-grid views
 * should not expand the all-day lane vertically.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2120
 * @see https://github.com/callumalpass/tasknotes/issues/2135
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issues #2120 and #2135: calendar all-day event title overflow", () => {
	it("keeps time-grid all-day titles on a single truncated line", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const titleBlock = extractCssBlock(
			css,
			".advanced-calendar-view .fc-timegrid-all-day-events .fc-event-title"
		);

		expect(titleBlock).toContain("overflow: hidden;");
		expect(titleBlock).toContain("text-overflow: ellipsis;");
		expect(titleBlock).toContain("overflow-wrap: normal;");
		expect(titleBlock).toContain("white-space: nowrap;");
	});
});
