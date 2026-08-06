import * as fs from "fs";
import * as path from "path";

const modalCssPath = path.resolve(__dirname, "../../../styles/task-modal.css");
const sheetCssPath = path.resolve(__dirname, "../../../styles/task-modal-sheet.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}

describe("task modal metadata content CSS", () => {
	const modalCss = fs.readFileSync(modalCssPath, "utf-8");
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("keeps legacy metadata padding for non-edit sections", () => {
		const metadataContentBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin .metadata-container:not(.tn-task-modal__task-info) > .metadata-content"
		);

		expect(metadataContentBlock).toContain("padding: var(--size-4-3)");
		expect(metadataContentBlock).toContain("min-width: 0");
		expect(metadataContentBlock).toContain("box-sizing: border-box");
	});

	it("renders task information as a grouped card with aligned monospace rows", () => {
		const taskInfoCardBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin .tn-task-modal__task-info-card"
		);
		const taskInfoRowBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin .tn-task-modal__task-info-card .tn-task-modal__task-info-row"
		);

		expect(taskInfoCardBlock).toContain("background: var(--background-secondary)");
		expect(taskInfoCardBlock).toContain("border: 1px solid var(--background-modifier-border)");
		expect(taskInfoCardBlock).toContain("border-radius: var(--radius-l)");
		expect(taskInfoRowBlock).toContain("display: grid");
		expect(taskInfoRowBlock).toContain("grid-template-columns: auto minmax(0, 1fr)");
		expect(modalCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__task-info-card \.tn-task-modal__task-info-key,\s*\n\.tasknotes-plugin \.tn-task-modal__task-info-card \.tn-task-modal__task-info-value\s*\{[^}]*font-family:\s*var\(--font-monospace\)/s
		);
		expect(modalCss).toMatch(
			/\.tasknotes-plugin \.tn-task-modal__task-info-card \.tn-task-modal__task-info-value\s*\{[^}]*overflow-wrap:\s*anywhere/s
		);
	});

	it("removes the divider above completions in the redesigned edit modal", () => {
		const sectionContainerBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin.minimalist-task-modal .completions-calendar-container"
		);

		expect(sectionContainerBlock).toContain("border-top: none");
		expect(sectionContainerBlock).toContain("padding-top: 0");
	});

	it("removes the divider above task information in the redesigned edit modal", () => {
		const taskInfoBlock = extractCssBlock(modalCss, ".tasknotes-plugin .tn-task-modal__task-info");

		expect(taskInfoBlock).toContain("border-top: none");
		expect(taskInfoBlock).toContain("padding-top: 0");
		expect(taskInfoBlock).toContain("margin-top: var(--size-4-6)");
	});

	it("adds vertical spacing between completions and task information", () => {
		const completionsBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin.minimalist-task-modal .completions-calendar-container"
		);

		expect(completionsBlock).toContain("margin-top: var(--size-4-6)");
	});

	it("uses section margin instead of editor margin below description on desktop edit", () => {
		const descriptionBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--edit-desktop .modal-split-right .tn-task-modal__markdown-editor--details"
		);

		expect(descriptionBlock).toContain("margin-bottom: 0");
	});

	it("keeps the mobile sheet content area on modal background so the task information card matches desktop", () => {
		const modalContentBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .modal-content,\n.tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .minimalist-modal-container"
		);
		const taskInfoBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .tn-task-modal__task-info"
		);

		expect(modalContentBlock).toContain("background: var(--modal-background)");
		expect(taskInfoBlock).toContain("border-top: none");
		expect(taskInfoBlock).toContain("padding-top: 0");
	});

	it("keeps the task information title flush while padding rows inside the card", () => {
		const labelBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin .tn-task-modal__task-info > .detail-label"
		);
		const taskInfoCardBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin .tn-task-modal__task-info-card"
		);

		expect(labelBlock).toContain("padding: 0");
		expect(labelBlock).toContain("text-transform: none");
		expect(labelBlock).toContain("margin: 0 0 var(--size-4-3) 0");
		expect(taskInfoCardBlock).toContain("padding: var(--size-4-3)");
		expect(taskInfoCardBlock).toContain("border-radius: var(--radius-l)");
	});
});
