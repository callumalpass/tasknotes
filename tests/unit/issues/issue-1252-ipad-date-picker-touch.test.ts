/**
 * Issue #1252: iPad taps on calendar date picker days should be treated as
 * direct button activations.
 *
 * The calendar-first picker from #1526 handles selection through button clicks.
 * This regression guard keeps the iPad/mobile tap hardening on the day buttons.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1252
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/date-picker.css");

describe("Issue #1252: iPad date picker day taps", () => {
	it("uses the native date input instead of the old custom calendar day buttons", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const dateInputBlock = extractCssBlock(cssContent, ".date-picker-modal input[type=\"date\"]");

		expect(dateInputBlock).toContain("position: relative");
		expect(dateInputBlock).toContain("text-align: left");
		expect(cssContent).not.toContain("date-time-picker-modal__day");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
