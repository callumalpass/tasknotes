import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal sidebar row divider CSS", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");
	const dividerBlock = extractCssBlock(
		sheetCss,
		".tasknotes-plugin .tn-task-modal__sidebar-row-divider"
	);

	it("insets mobile sheet dividers to match row horizontal padding", () => {
		expect(dividerBlock).toContain("margin: 0 var(--size-4-3)");
		expect(dividerBlock).toContain("height: 1px");
		expect(dividerBlock).toContain("background: var(--background-modifier-border)");
	});

	it("does not draw mobile sheet dividers with row border-top rules", () => {
		expect(sheetCss).not.toMatch(
			/\.tasknotes-plugin \.tn-task-modal__mobile-group \.tn-task-modal__sidebar-row \+ \.tn-task-modal__sidebar-row\s*\{[^}]*border-top:/
		);
		expect(sheetCss).not.toContain(
			".tn-task-modal__mobile-group .tn-task-modal__sidebar-row + .tn-task-modal__sidebar-row::before"
		);
	});

	it("keeps border-top dividers between desktop edit sidebar blocks", () => {
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__sidebar > \* \+ \*\s*\{\s*border-top:\s*1px solid var\(--background-modifier-border\);\s*\}/
		);
	});

	it("removes default organization list margins from empty desktop sidebar sections", () => {
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__sidebar-section .tn-task-modal__org-list"
			)
		).toContain("margin-top: 0");
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__sidebar-section .tn-task-modal__org-list"
			)
		).toContain("margin-bottom: 0");
	});

	it("removes default organization list margins from empty mobile sheet org fields", () => {
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__mobile-group .tn-task-modal__org-list"
			)
		).toContain("margin-top: 0");
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__mobile-group .tn-task-modal__org-list"
			)
		).toContain("margin-bottom: 0");
	});

	it("nests organization lists under their sidebar section row", () => {
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__sidebar-section \.tn-task-modal__org-list:not\(:empty\)/
		);
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__sidebar-section .tn-task-modal__org-list:not(:empty)"
			)
		).toContain("max-height: none");
	});

	it("vertically aligns sidebar organization remove buttons", () => {
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__sidebar-section .tn-task-modal__org-list .task-project-remove"
			)
		).toContain("align-items: center");
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__sidebar-section .tn-task-modal__org-list .task-project-item"
			)
		).toContain("align-items: flex-start");
	});
});
