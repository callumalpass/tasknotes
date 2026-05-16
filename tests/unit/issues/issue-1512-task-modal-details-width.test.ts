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
		const leftBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin.minimalist-task-modal.split-layout-enabled.expanded .modal-split-left"
		);
		const rightBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin.minimalist-task-modal.split-layout-enabled.expanded .modal-split-right"
		);

		expect(leftBlock).toContain("grid-template-columns: 380px minmax(280px, 1fr)");
		expect(rightBlock).toContain("min-width: 280px");
		expect(rightBlock).not.toContain("min-width: 0");
	});

	it("keeps the wider modal from collapsing the details grid track", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const wideMediaBlock = extractMediaBlock(cssContent, "@media (min-width: 1200px)");

		expect(wideMediaBlock).toContain("grid-template-columns: 480px minmax(280px, 1fr)");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

function extractMediaBlock(css: string, mediaQuery: string): string {
	const start = css.indexOf(mediaQuery);
	if (start === -1) {
		return "";
	}

	const openBrace = css.indexOf("{", start);
	if (openBrace === -1) {
		return "";
	}

	let depth = 0;
	for (let i = openBrace; i < css.length; i++) {
		if (css[i] === "{") {
			depth++;
		} else if (css[i] === "}") {
			depth--;
			if (depth === 0) {
				return css.slice(openBrace + 1, i);
			}
		}
	}

	return "";
}
