/**
 * Issue #2239: Mobile markdown embeds should not inherit the full-screen
 * Task List bottom inset.
 *
 * Direct Task List Bases need bottom clearance for Obsidian mobile chrome, but
 * embedded Bases live in the note's document flow. Applying that same inset
 * inside an embed creates a large blank block after the final task card.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2239
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/bases-views.css");

describe("Issue #2239: Mobile embedded Task List bottom gap", () => {
	it("keeps the direct mobile Task List bottom inset", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const directMobileBlock = extractCssBlock(
			cssContent,
			"body.is-mobile .tn-tasknotesTaskList .tn-bases-items-container"
		);

		expect(directMobileBlock).toContain("padding-bottom: calc(128px");
		expect(directMobileBlock).toContain("env(safe-area-inset-bottom");
		expect(directMobileBlock).toContain("scroll-padding-bottom: calc(128px");
	});

	it("removes the full-screen mobile inset from markdown embedded Task List containers", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const internalEmbedItemsBlock = extractCssBlock(
			cssContent,
			"body.is-mobile .internal-embed .tn-tasknotesTaskList .tn-bases-items-container"
		);
		const markdownEmbedItemsBlock = extractCssBlock(
			cssContent,
			"body.is-mobile .markdown-embed .tn-tasknotesTaskList .tn-bases-items-container"
		);

		expect(internalEmbedItemsBlock).toContain("padding-bottom: 0");
		expect(internalEmbedItemsBlock).toContain("scroll-padding-bottom: 0");
		expect(markdownEmbedItemsBlock).toContain("padding-bottom: 0");
		expect(markdownEmbedItemsBlock).toContain("scroll-padding-bottom: 0");
	});

	it("keeps normal embedded list padding without the mobile safe-area reserve", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const internalEmbedListBlock = extractCssBlock(
			cssContent,
			"body.is-mobile .internal-embed .tn-bases-tasknotes-list"
		);
		const markdownEmbedListBlock = extractCssBlock(
			cssContent,
			"body.is-mobile .markdown-embed .tn-bases-tasknotes-list"
		);

		expect(internalEmbedListBlock).toContain("padding-bottom: var(--tn-spacing-sm)");
		expect(internalEmbedListBlock).toContain("scroll-padding-bottom: 0");
		expect(markdownEmbedListBlock).toContain("padding-bottom: var(--tn-spacing-sm)");
		expect(markdownEmbedListBlock).toContain("scroll-padding-bottom: 0");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}[\\s\\S]*?\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
