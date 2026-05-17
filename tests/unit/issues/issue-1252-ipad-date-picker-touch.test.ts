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
	it("uses direct touch manipulation on calendar day buttons", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const dayButtonBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .date-time-picker-modal__day"
		);

		expect(dayButtonBlock).toContain("touch-action: manipulation");
		expect(dayButtonBlock).toContain("-webkit-tap-highlight-color: transparent");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
