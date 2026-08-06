/**
 * The title (rendered via the detailed title textarea) and the description
 * editor both live inside `.modal-split-right`, which must be ordered before
 * the mobile organization sections and property rows so that title and
 * description always appear first in the modal.
 *
 * A legacy `body.is-mobile` rule in task-modal.css used to set
 * `.details-container { order: 3 }` and `.modal-split-right { order: 4 }`,
 * which has higher specificity than the unconditional rules in
 * task-modal-sheet.css and silently reversed the intended order on real
 * mobile devices, pushing "Add project/subtask/blocked by/blocking" above
 * the title and description fields.
 */

import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");
const modalCssPath = path.resolve(__dirname, "../../../styles/task-modal.css");

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

describe("task modal title/description CSS ordering", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");
	const modalCss = fs.readFileSync(modalCssPath, "utf-8");

	it("orders the description column before organization and property sections", () => {
		const descriptionOrder = extractOrder(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal .modal-split-right"
		);
		const chipRowOrder = extractOrder(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal .modal-split-left .tn-task-modal__chip-row"
		);
		const organizationOrder = extractOrder(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal .modal-split-left .tn-task-modal__mobile-sections"
		);
		const propertyOrder = extractOrder(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal .modal-split-left .tn-task-modal__mobile-sections"
		);

		expect(descriptionOrder).toBeLessThan(chipRowOrder);
		expect(descriptionOrder).toBeLessThan(organizationOrder);
		expect(descriptionOrder).toBeLessThan(propertyOrder);
	});

	it("does not reintroduce a body.is-mobile override that reverses the description/organization order", () => {
		expect(modalCss).not.toMatch(
			/body\.is-mobile[^{]*\.modal-split-left \.details-container\s*\{[^}]*order:/s
		);
		expect(modalCss).not.toMatch(
			/body\.is-mobile[^{]*\.modal-split-right\s*\{[^}]*order:/s
		);
	});
});
