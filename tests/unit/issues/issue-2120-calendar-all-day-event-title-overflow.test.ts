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

function extractCssBlocks(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return [...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g"))]
		.map((match) => match[1])
		.join("\n");
}

describe("Issues #2120 and #2135: calendar all-day event title overflow", () => {
	it("keeps time-grid all-day titles on a single truncated line", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const selectors = [
			".advanced-calendar-view .fc-timegrid-all-day-events .fc-event-title",
			".advanced-calendar-view .fc-timegrid .fc-daygrid-body .fc-event-title",
		];

		for (const selector of selectors) {
			const titleBlock = extractCssBlock(css, selector);

			expect(titleBlock).toContain("overflow: hidden;");
			expect(titleBlock).toContain("text-overflow: ellipsis;");
			expect(titleBlock).toContain("overflow-wrap: normal;");
			expect(titleBlock).toContain("white-space: nowrap;");
		}
	});

	it("targets the real FullCalendar time-grid all-day lane markup", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const eventBlock = extractCssBlock(
			css,
			".advanced-calendar-view .fc-timegrid .fc-daygrid-body .fc-daygrid-event"
		);
		const titleContainerBlock = extractCssBlock(
			css,
			".advanced-calendar-view .fc-timegrid .fc-daygrid-body .fc-event-title-container"
		);
		const titleContainerBlocks = extractCssBlocks(
			css,
			".advanced-calendar-view .fc-timegrid .fc-daygrid-body .fc-event-title-container"
		);

		expect(eventBlock).toContain("white-space: nowrap;");
		expect(titleContainerBlock).toContain("min-width: 0;");
		expect(titleContainerBlocks).toContain("overflow: hidden;");
	});
});
