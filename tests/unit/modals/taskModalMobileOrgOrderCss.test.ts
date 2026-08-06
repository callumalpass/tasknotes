/**
 * Mobile sheet rows must follow the desktop edit sidebar order inside one
 * grouped card, not as separate blocks.
 */

import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractOrder(css: string, selector: string): number {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	if (!match) {
		throw new Error(`Could not find CSS block for selector: ${selector}`);
	}
	const orderMatch = match[1].match(/order:\s*(-?\d+)/);
	if (!orderMatch) {
		throw new Error(`Could not find an order declaration for selector: ${selector}`);
	}
	return Number(orderMatch[1]);
}

describe("task modal mobile sheet section CSS ordering", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("uses a single mobile sections block after the description column", () => {
		const descriptionOrder = extractOrder(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal .modal-split-right"
		);
		const sectionsOrder = extractOrder(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal .modal-split-left .tn-task-modal__mobile-sections"
		);

		expect(descriptionOrder).toBeLessThan(sectionsOrder);
		expect(sheetCss).not.toMatch(/tn-task-modal__mobile-org-sections/);
	});
});
