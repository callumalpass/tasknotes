/**
 * Issue #1512: Minimal-theme split task modals could collapse the details pane
 * until CodeMirror wrapped every character onto its own line.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1512
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

describe("Issue #1512: split task modal details pane width", () => {
	it("keeps a minimum width for the details grid track", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const contentBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin.minimalist-task-modal.split-layout-enabled .modal-split-content"
		);
		const tokens = fs.readFileSync(path.resolve(__dirname, "../../../styles/tokens.css"), "utf-8");

		expect(contentBlock).toContain("minmax(var(--tn-modal-details-min-width), 1fr)");
		expect(tokens).toContain("--tn-modal-details-min-width: 320px");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
