/**
 * Reproduction test for issue #1663.
 *
 * Reported behavior:
 * - Japanese tags (e.g. #テスト) do not receive rounded-corner styling on the
 *   Kanban board, while English tags (#test) render correctly with styling.
 *
 * Fix:
 * - The tag renderer preserves CJK characters and emits the same tag element for
 *   Japanese tags as for ASCII tags.
 * - TaskNotes task-card CSS provides a scoped fallback pill style for metadata
 *   tags instead of depending entirely on Obsidian's native tag selector.
 */

import fs from "fs";
import path from "path";
import { normalizeTag, renderTag } from "../../../src/ui/renderers/tagRenderer";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1663: Japanese tag display on Kanban board", () => {
	it("preserves Japanese characters when normalizing tags", () => {
		expect(normalizeTag("テスト")).toBe("#テスト");
		expect(normalizeTag("#テスト")).toBe("#テスト");
		expect(normalizeTag("#test-テスト")).toBe("#test-テスト");
	});

	it("renders Japanese tags with the same tag class and href shape as ASCII tags", () => {
		const container = document.createElement("div");

		renderTag(container, "テスト");

		const tag = container.querySelector("a.tag") as HTMLAnchorElement;
		expect(tag).not.toBeNull();
		expect(tag.textContent).toBe("#テスト");
		expect(tag.getAttribute("href")).toBe("#テスト");
	});

	it("provides a TaskNotes card fallback style for tag pills", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const block = extractCssBlock(css, ".tasknotes-plugin .task-card__metadata-property .tag");

		expect(block).toContain("background-color: var(--tag-background");
		expect(block).toContain("color: var(--tag-color");
		expect(block).toContain("padding: var(--tag-padding-y");
		expect(block).toContain("border: var(--tag-border-width");
		expect(block).toContain("border-radius: var(--tag-radius");
	});
});
