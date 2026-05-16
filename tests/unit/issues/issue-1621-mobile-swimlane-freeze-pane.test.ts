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

describe("Issue #1621: mobile Kanban swimlane label", () => {
	it("disables the frozen swimlane label on mobile", () => {
		const css = readKanbanCss();
		const block = extractCssBlock(
			css,
			"body.is-mobile .tasknotes-plugin .kanban-view__swimlane-label"
		);

		expect(block).toContain("position: static;");
		expect(block).toContain("z-index: auto;");
	});

	it("forces the compact mobile swimlane label width", () => {
		const css = readKanbanCss();
		const boardBlock = extractCssBlock(
			css,
			"body.is-mobile .tasknotes-plugin .kanban-view__board--swimlanes"
		);
		const labelBlock = extractCssBlock(
			css,
			"body.is-mobile .tasknotes-plugin .kanban-view__swimlane-row > .kanban-view__swimlane-label"
		);

		expect(boardBlock).toContain("--kanban-swimlane-label-width: 72px;");
		expect(labelBlock).toContain("width: var(--kanban-swimlane-label-width);");
		expect(labelBlock).toContain("min-width: var(--kanban-swimlane-label-width);");
		expect(labelBlock).toContain("max-width: var(--kanban-swimlane-label-width);");
	});
});
