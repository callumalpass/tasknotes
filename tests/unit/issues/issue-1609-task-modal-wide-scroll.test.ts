/**
 * Issue #1609: task edit popups could stop scrolling in the wide split layout.
 *
 * The base expanded modal makes `.modal-split-content` the scroll container,
 * but the wide split-layout override changed it back to `overflow: visible`,
 * leaving oversized left-column content clipped by the outer modal.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1609
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

describe("Issue #1609: wide task modal scrolling", () => {
	it("keeps wide split-layout modal content vertically scrollable", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const splitContentBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin.minimalist-task-modal.split-layout-enabled.expanded .modal-split-content"
		);

		expect(splitContentBlock).toContain("overflow-y: auto");
		expect(splitContentBlock).toContain("overflow-x: hidden");
		expect(splitContentBlock).not.toContain("overflow: visible");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
