/**
 * Issue #1904: long tags in task cards should wrap instead of forcing
 * horizontal scrolling in Bases views and embedded note cards.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1904
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1904: task card long tag wrapping", () => {
	it("allows tag metadata and long tag pills to wrap within card width", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const tagsPropertyBlock = extractCssBlock(
			css,
			".tasknotes-plugin .task-card__metadata-property--tags"
		);
		const tagBlock = extractCssBlock(
			css,
			".tasknotes-plugin .task-card__metadata-property--tags :where(.tag)"
		);

		expect(tagsPropertyBlock).toContain("flex-wrap: wrap");
		expect(tagsPropertyBlock).toContain("align-items: flex-start");
		expect(tagBlock).toContain("flex: 0 1 auto");
		expect(tagBlock).toContain("min-width: 0");
		expect(tagBlock).toContain("max-width: 100%");
		expect(tagBlock).toContain("overflow-wrap: anywhere");
		expect(tagBlock).toContain("word-break: break-word");
		expect(tagBlock).toContain("white-space: normal");
	});
});
