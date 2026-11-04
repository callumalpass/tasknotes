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
	it("keeps today's accent mark distinct even when another date is selected", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const todayBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .mini-calendar-view__day--today"
		);
		const selectedTodayBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .mini-calendar-view__day--today.mini-calendar-view__day--selected"
		);

		expect(todayBlock).toContain("background: var(--tn-interactive-accent)");
		expect(todayBlock).toContain("color: var(--text-on-accent)");
		expect(todayBlock).toContain("font-weight: var(--tn-font-weight-semibold)");
		expect(todayBlock).toContain("box-shadow: none");
		expect(selectedTodayBlock).toContain("background: var(--tn-interactive-accent)");
		expect(selectedTodayBlock).toContain("color: var(--text-on-accent)");
		expect(selectedTodayBlock).toContain("box-shadow: none");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "gs");
	const matches = Array.from(css.matchAll(regex));
	return matches.at(-1)?.[1] ?? "";
}
