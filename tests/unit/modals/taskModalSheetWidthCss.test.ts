import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");
const modalCssPath = path.resolve(__dirname, "../../../styles/task-modal.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal sheet width CSS", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");
	const modalCss = fs.readFileSync(modalCssPath, "utf-8");

	/**
	 * `body.is-mobile .tasknotes-plugin.minimalist-task-modal > .modal` in
	 * task-modal.css has higher CSS specificity than
	 * `.tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet > .modal`
	 * in task-modal-sheet.css (the extra `body` type selector outweighs the
	 * sheet rule's extra class), so it silently overrode the sheet's width
	 * cap regardless of stylesheet order or the sheet's own more-specific-
	 * looking selector. The legacy rule must explicitly exclude the sheet
	 * layout so it no longer forces the sheet back to full viewport width.
	 */
	it("excludes the bottom-sheet layout from the legacy full-viewport-width mobile modal rule", () => {
		expect(modalCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin\.minimalist-task-modal:not\(\.tn-task-modal--sheet\) > \.modal\s*\{[^}]*width:\s*calc\(100vw/s
		);
		expect(modalCss).not.toMatch(
			/body\.is-mobile \.tasknotes-plugin\.minimalist-task-modal > \.modal\s*\{/
		);
	});

	it("lets the bottom sheet grow with its full-width content instead of the desktop dialog cap", () => {
		const contentBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .modal-content"
		);

		expect(contentBlock).toContain("min-width: 0");
		expect(contentBlock).toContain("width: 100%");
		expect(contentBlock).toContain("max-width: 100%");
	});

	it("caps the sheet at the small-screen modal width while filling narrower viewports", () => {
		const modalBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet > .modal"
		);

		expect(modalBlock).toContain("width: min(600px, 100%)");
		expect(modalBlock).toContain(
			"max-width: min(600px, calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))"
		);
		expect(modalBlock).toContain("margin-inline: auto");
	});

	it("centers the sheet horizontally in the modal container", () => {
		const containerBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet"
		);

		expect(containerBlock).toContain("justify-content: center");
	});
});
