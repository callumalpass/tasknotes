/**
 * Issue #385: Mini Calendar controls should fit narrow sidebars.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/385
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

function extractCssBlocks(css: string, selector: string): string[] {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matches = css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g"));
	return Array.from(matches, (match) => match[1]);
}

function hasCssDeclaration(css: string, selector: string, declaration: string): boolean {
	return extractCssBlocks(css, selector).some((block) => block.includes(declaration));
}

describe("Issue #385: mini calendar sidebar controls", () => {
	it("lets the Mini Calendar header controls shrink in narrow panes", () => {
		const css = readRepoFile("styles/calendar-view.css");

		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view",
				"container-type: inline-size;"
			)
		).toBe(true);
		expect(
			hasCssDeclaration(css, ".tasknotes-plugin .mini-calendar-view__header", "min-width: 0;")
		).toBe(true);
		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view__header",
				"flex-wrap: wrap;"
			)
		).toBe(true);
		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view__navigation",
				"min-width: 0;"
			)
		).toBe(true);
		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view__nav-button",
				"min-width: 0;"
			)
		).toBe(true);
		expect(
			hasCssDeclaration(css, ".tasknotes-plugin .mini-calendar-view__nav-button", "padding: 0;")
		).toBe(true);
		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view__month-display",
				"overflow: hidden;"
			)
		).toBe(true);
		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view__month-display",
				"text-overflow: ellipsis;"
			)
		).toBe(true);
		expect(
			hasCssDeclaration(
				css,
				".tasknotes-plugin .mini-calendar-view__today-button",
				"min-width: 0;"
			)
		).toBe(true);
		expect(css).toContain("@container (max-width: 220px)");
		expect(css).toContain(
			".tasknotes-plugin .mini-calendar-view__today-button {\n        margin-left: 0;"
		);
	});
});
