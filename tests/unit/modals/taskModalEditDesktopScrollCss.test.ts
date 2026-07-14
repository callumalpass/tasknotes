import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal edit desktop scroll CSS", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("keeps a single scroll container with inset padding before the scrollbar", () => {
		const panesBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--edit-desktop.expanded .tn-task-modal__edit-panes"
		);

		expect(panesBlock).toContain("overflow-y: auto");
		expect(panesBlock).toContain("padding-right: var(--size-4-4)");
	});
});
