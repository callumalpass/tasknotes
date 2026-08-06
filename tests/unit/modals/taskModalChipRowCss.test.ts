import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal chip row CSS", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("wraps create-task chips instead of using a horizontal scroll row", () => {
		const chipRowBlock = extractCssBlock(sheetCss, ".tasknotes-plugin .tn-task-modal__chip-row");

		expect(chipRowBlock).toContain("flex-wrap: wrap");
		expect(chipRowBlock).not.toContain("overflow-x: auto");
		expect(sheetCss).not.toMatch(
			/\.tasknotes-plugin \.tn-task-modal__chip-row::-webkit-scrollbar/
		);
	});

	it("forces property chips onto a new row after the NLP actions", () => {
		const chipBreakBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin .tn-task-modal__chip-break"
		);

		expect(chipBreakBlock).toContain("flex-basis: 100%");
		expect(sheetCss).not.toMatch(/\.tasknotes-plugin \.tn-task-modal__chip-separator/);
	});
});
