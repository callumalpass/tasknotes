import * as fs from "fs";
import * as path from "path";

const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal sheet footer CSS", () => {
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("lifts the whole sheet above bottom obstructions via margin-bottom", () => {
		const modalBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet > .modal"
		);

		expect(modalBlock).toContain("margin-bottom: var(--tn-sheet-bottom-inset, 0px)");
		expect(modalBlock).toContain("transform: translateY(var(--tn-sheet-offset, 0px))");
	});

	it("animates the whole sheet lift when a bottom obstruction is present", () => {
		const modalBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet > .modal.tn-task-modal__sheet--bottom-inset"
		);

		expect(modalBlock).toContain("transition: margin-bottom 0.2s ease, transform 0.2s ease");
		expect(modalBlock).toContain("max-height: var(--tn-sheet-max-height, 60dvh)");
	});

	it("does not add keyboard scroll padding inside sheet content", () => {
		const scrollBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet.is-mobile-keyboard-focused .modal-split-content"
		);

		expect(scrollBlock).toContain("padding-bottom: 0");
		expect(scrollBlock).toContain("scroll-padding-bottom: 0");
	});

	it("caps resting sheet height with a max-height variable instead of translating the footer off-screen", () => {
		const modalBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet > .modal"
		);

		expect(modalBlock).toContain("max-height: min(");
		expect(modalBlock).toContain("var(--tn-sheet-max-height, 60dvh)");
		expect(modalBlock).toContain("calc(100dvh - 16px - env(safe-area-inset-top, 0px))");
	});

	it("pins the footer outside the scrollable content area on all sheet layouts", () => {
		const contentBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .modal-content"
		);
		const containerBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .minimalist-modal-container"
		);
		const scrollBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .modal-split-content"
		);
		const footerBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .tn-task-modal__icon-button-bar"
		);

		expect(contentBlock).toContain("display: flex");
		expect(contentBlock).toContain("overflow: hidden");
		expect(containerBlock).toContain("overflow: hidden");
		expect(scrollBlock).toContain("overflow-y: auto");
		expect(scrollBlock).toContain("margin-inline-end: calc(-1 * var(--size-4-4))");
		expect(scrollBlock).toContain("padding-inline-end: var(--size-4-4)");
		expect(footerBlock).toContain("flex-shrink: 0");
		expect(footerBlock).toContain("background: var(--modal-background)");
		expect(footerBlock).toContain("margin-top: var(--size-4-1)");
		expect(footerBlock).toContain("padding-top: var(--size-4-2)");
	});
});
