/**
 * Issue #1939: when the embedded details editor falls back to a textarea on
 * mobile, the fallback should fill the details field instead of rendering as a
 * small native textarea inside it.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1939
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

describe("Issue #1939: mobile details editor fallback width", () => {
	it("sizes the fallback textarea to fill the details editor wrapper", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const fallbackBlock = extractCssBlock(
			cssContent,
			".tn-task-modal__markdown-editor--details .details-editor-fallback"
		);

		expect(fallbackBlock).toContain("display: block");
		expect(fallbackBlock).toContain("width: 100%");
		expect(fallbackBlock).toContain("height: 100%");
		expect(fallbackBlock).toContain("box-sizing: border-box");
		expect(fallbackBlock).toContain("border: none");
		expect(fallbackBlock).toContain("resize: none");
	});

	it("uses the same mobile height cap as the CodeMirror details editor", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");

		expect(cssContent).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.tn-task-modal__markdown-editor--details,[^{]*\.details-editor-fallback\s*\{[^}]*min-height:\s*140px;[^}]*max-height:\s*32vh;/s
		);
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
