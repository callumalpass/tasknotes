/**
 * Issue #1609: task edit popups could stop scrolling in the wide split layout.
 *
 * The split layout has a fixed height, so its left pane is the scroll container
 * and oversized fields must scroll there rather than be clipped by the modal.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1609
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

describe("Issue #1609: wide task modal scrolling", () => {
	it("keeps wide split-layout modal content vertically scrollable", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const leftPaneBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin.minimalist-task-modal.split-layout-enabled .modal-split-left"
		);

		expect(leftPaneBlock).toContain("min-height: 0");
		expect(leftPaneBlock).toContain("overflow-y: auto");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
