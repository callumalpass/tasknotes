import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #2084: relationships widget editor selection autoscroll", () => {
	it("keeps source-mode relationship widgets out of text selection", () => {
		const css = readRepoFile("styles/relationships.css");
		const widgetBlock = extractCssBlock(
			css,
			".markdown-source-view .cm-sizer > .tasknotes-relationships-widget"
		);
		const inputBlock =
			css.match(
				/\.markdown-source-view \.cm-sizer > \.tasknotes-relationships-widget input,\s*\.markdown-source-view \.cm-sizer > \.tasknotes-relationships-widget textarea,\s*\.markdown-source-view \.cm-sizer > \.tasknotes-relationships-widget \[contenteditable="true"\]\s*\{([^}]*)\}/s
			)?.[1] ?? "";

		expect(widgetBlock).toContain("-webkit-user-select: none;");
		expect(widgetBlock).toContain("user-select: none;");
		expect(inputBlock).toContain("-webkit-user-select: text;");
		expect(inputBlock).toContain("user-select: text;");
	});
});
