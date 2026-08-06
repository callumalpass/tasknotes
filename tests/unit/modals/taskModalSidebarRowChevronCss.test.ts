import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal sidebar row chevron CSS", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("centers the chevron wrapper in every sidebar row", () => {
		const chevronBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin .tn-task-modal__sidebar-row-chevron"
		);

		expect(chevronBlock).toContain("display: inline-flex");
		expect(chevronBlock).toContain("align-items: center");
		expect(chevronBlock).toContain("justify-content: center");
		expect(chevronBlock).toContain("align-self: center");
	});

	it("sizes chevron icons consistently regardless of Obsidian svg class", () => {
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__sidebar-row-chevron \.icon,\s*\n\.tasknotes-plugin \.tn-task-modal__sidebar-row-chevron \.svg-icon,\s*\n\.tasknotes-plugin \.tn-task-modal__sidebar-row-chevron svg\s*\{[^}]*width:\s*14px/s
		);
	});

	it("sizes row icons consistently regardless of Obsidian svg class", () => {
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__sidebar-row-icon \.icon,\s*\n\.tasknotes-plugin \.tn-task-modal__sidebar-row-icon \.svg-icon,\s*\n\.tasknotes-plugin \.tn-task-modal__sidebar-row-icon svg\s*\{[^}]*width:\s*18px/s
		);
	});
});
