import * as fs from "fs";
import * as path from "path";

const modalCssPath = path.resolve(__dirname, "../../../styles/task-modal.css");
const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");
const modalBemCssPath = path.resolve(__dirname, "../../../styles/modal-bem.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal icon button bar CSS", () => {
	const modalCss = fs.readFileSync(modalCssPath, "utf-8");
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");
	const modalBemCss = fs.readFileSync(modalBemCssPath, "utf-8");

	it("keeps icon button bars on a single horizontal row", () => {
		const iconButtonBarBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin .modal-button-container.tn-task-modal__icon-button-bar"
		);

		expect(iconButtonBarBlock).toContain("flex-direction: row");
		expect(iconButtonBarBlock).toContain("flex-wrap: nowrap");
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__icon-button-leading,\s*\n\.tasknotes-plugin \.tn-task-modal__icon-button-trailing\s*\{[^}]*flex-direction:\s*row/s
		);
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__icon-button-trailing\s*\{[^}]*margin-left:\s*auto/s
		);
	});

	it("does not apply legacy text-button footer rules to icon button bars", () => {
		expect(modalBemCss).toMatch(
			/\.tasknotes-plugin \.modal-button-container:not\(\.tn-task-modal__icon-button-bar\)/
		);
		expect(
			extractCssBlock(
				modalCss,
				".modal.mod-tasknotes .modal-button-container.tn-task-modal__icon-button-bar"
			)
		).toContain("flex-direction: row");
	});

	it("shows action button labels on desktop while keeping mobile icon-only", () => {
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__icon-button-label\s*\{[^}]*display:\s*none/s
		);
		expect(sheetCss).toMatch(
			/body:not\(\.is-mobile\) \.tasknotes-plugin \.tn-task-modal__icon-button-label\s*\{[^}]*display:\s*inline/s
		);
		expect(sheetCss).toMatch(
			/body:not\(\.is-mobile\) \.tasknotes-plugin \.tn-task-modal__icon-button\s*\{[^}]*width:\s*auto/s
		);
	});

	it("keeps non-save footer buttons outlined and the save button filled on sheet layouts", () => {
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__icon-button:not(.mod-cta)"
			)
		).toContain("background: transparent");
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__icon-button:not(.mod-cta)"
			)
		).toContain("border: 1px solid var(--background-modifier-border)");
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .tn-task-modal__icon-button:not(.mod-cta)"
			)
		).toContain("border-color: var(--background-modifier-border)");
		expect(
			extractCssBlock(
				sheetCss,
				".tasknotes-plugin .tn-task-modal__icon-button.mod-cta"
			)
		).toContain("background: var(--interactive-accent)");
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__icon-button\.mod-cta:hover,\s*\n\.tasknotes-plugin \.tn-task-modal__icon-button\.mod-cta:active\s*\{[^}]*background:\s*var\(--interactive-accent-hover\)/s
		);
	});

	it("removes Obsidian default button shadows from footer icon buttons", () => {
		expect(
			extractCssBlock(sheetCss, ".tasknotes-plugin .tn-task-modal__icon-button")
		).toContain("box-shadow: none");
		expect(sheetCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__icon-button\.mod-cta:hover,\s*\n\.tasknotes-plugin \.tn-task-modal__icon-button\.mod-cta:active\s*\{[^}]*box-shadow:\s*none/s
		);
	});

	it("vertically centers icon button icons with their labels", () => {
		expect(
			extractCssBlock(sheetCss, ".tasknotes-plugin .tn-task-modal__icon-button-icon")
		).toContain("align-items: center");
		expect(sheetCss).toMatch(
			/body:not\(\.is-mobile\) \.tasknotes-plugin \.tn-task-modal__icon-button-label\s*\{[^}]*display:\s*inline-flex/s
		);
		expect(sheetCss).toMatch(
			/body:not\(\.is-mobile\) \.tasknotes-plugin \.tn-task-modal__icon-button-label\s*\{[^}]*align-items:\s*center/s
		);
	});
});
