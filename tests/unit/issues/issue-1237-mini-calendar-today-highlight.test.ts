/**
 * Issue #1237: The Mini Calendar should mark today's date clearly even when
 * another day is selected.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1237
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/calendar-view.css");

describe("Issue #1237: Mini Calendar today highlight", () => {
	it("uses a visible ring and tint for today's Mini Calendar day", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const todayBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .mini-calendar-view__day--today"
		);
		const selectedTodayBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .mini-calendar-view__day--today.mini-calendar-view__day--selected"
		);

		expect(todayBlock).toContain("background: color-mix");
		expect(todayBlock).toContain("box-shadow: inset 0 0 0 2px");
		expect(todayBlock).not.toContain("background: none");
		expect(selectedTodayBlock).toContain("box-shadow: inset 0 0 0 2px");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "gs");
	const matches = Array.from(css.matchAll(regex));
	return matches.at(-1)?.[1] ?? "";
}
