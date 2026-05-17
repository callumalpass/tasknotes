/**
 * Issue #1261: Task List Base embeds in sidebars should not create nested
 * vertical scrollbars.
 *
 * Main-pane embeds intentionally keep their internal scroller to avoid the
 * unbounded growth fixed in #1089. The sidebar override is narrower: when the
 * containing note is already inside a left/right sidebar split, the note should
 * own vertical scrolling.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1261
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/bases-views.css");

describe("Issue #1261: Task List sidebar embed scrolling", () => {
	it("lets sidebar note embeds own vertical scrolling", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const itemBlock = extractCssBlock(
			cssContent,
			".mod-left-split .internal-embed .tn-tasknotesTaskList .tn-bases-items-container"
		);
		const rootBlock = extractCssBlock(
			cssContent,
			".mod-left-split .internal-embed .tn-tasknotesTaskList"
		);

		expect(itemBlock).toContain("max-height: none");
		expect(itemBlock).toContain("overflow-y: visible");
		expect(itemBlock).toContain("flex: 0 1 auto");
		expect(rootBlock).toContain("height: auto");
	});

	it("does not globally disable the Task List embed scroller", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");

		expect(cssContent).not.toMatch(
			/(^|\n)\s*\.internal-embed\s+\.tn-tasknotesTaskList\s+\.tn-bases-items-container\s*\{[^}]*overflow-y:\s*visible/s
		);
		expect(cssContent).not.toMatch(
			/(^|\n)\s*\.markdown-embed\s+\.tn-tasknotesTaskList\s+\.tn-bases-items-container\s*\{[^}]*overflow-y:\s*visible/s
		);
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}[\\s\\S]*?\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
