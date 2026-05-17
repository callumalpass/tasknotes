/**
 * Issue #1213: Task List Base embeds in Obsidian popout windows should size to
 * their rendered content instead of reserving an empty viewport-height block.
 *
 * Main-pane embeds intentionally keep their internal scroller to avoid the
 * unbounded growth fixed in #1089. The popout override is limited to embedded
 * notes inside Obsidian's popout window body class.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1213
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/bases-views.css");

describe("Issue #1213: Task List popout embed height", () => {
	it("lets popout note embeds own vertical sizing", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const rootBlock = extractCssBlock(
			cssContent,
			"body.is-popout-window .internal-embed .tn-tasknotesTaskList"
		);
		const itemBlock = extractCssBlock(
			cssContent,
			"body.is-popout-window .internal-embed .tn-tasknotesTaskList .tn-bases-items-container"
		);

		expect(rootBlock).toContain("height: auto");
		expect(itemBlock).toContain("flex: 0 1 auto");
		expect(itemBlock).toContain("max-height: none");
		expect(itemBlock).toContain("overflow-y: visible");
	});

	it("does not disable the main-pane embedded Task List scroller", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");

		expect(cssContent).not.toMatch(
			/(^|\n)\s*\.internal-embed\s+\.tn-tasknotesTaskList\s*\{[^}]*height:\s*auto/s
		);
		expect(cssContent).not.toMatch(
			/(^|\n)\s*\.internal-embed\s+\.tn-tasknotesTaskList\s+\.tn-bases-items-container\s*\{[^}]*overflow-y:\s*visible/s
		);
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}[\\s\\S]*?\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
