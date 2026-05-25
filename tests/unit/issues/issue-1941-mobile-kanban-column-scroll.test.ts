import fs from "fs";
import path from "path";

function readKanbanCss(): string {
	return fs.readFileSync(
		path.resolve(__dirname, "../../../styles/kanban-view.css"),
		"utf8"
	);
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1941: mobile Kanban column scrolling", () => {
	it("keeps flat mobile Kanban columns bounded so each list can scroll independently", () => {
		const css = readKanbanCss();
		const block = extractCssBlock(
			css,
			"body.is-mobile .tasknotes-plugin .kanban-view__column"
		);

		expect(block).toContain("max-height: 100%;");
		expect(block).not.toContain("max-height: none;");
	});
});
