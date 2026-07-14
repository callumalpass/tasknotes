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

describe("task modal completions calendar CSS", () => {
	const modalCss = fs.readFileSync(modalCssPath, "utf-8");
	const sheetCss = fs.readFileSync(sheetCssPath, "utf-8");

	it("keeps the completions calendar at the compact desktop width", () => {
		const contentBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin.minimalist-task-modal .completions-calendar-content"
		);
		const calendarBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin.minimalist-task-modal .recurring-calendar"
		);
		const labelBlock = extractCssBlock(
			modalCss,
			".tasknotes-plugin.minimalist-task-modal .completions-calendar-container > .detail-label"
		);

		expect(contentBlock).toContain("width: 200px");
		expect(contentBlock).toContain("max-width: 100%");
		expect(calendarBlock).toContain("width: 200px");
		expect(labelBlock).toContain("text-transform: none");
		expect(labelBlock).toContain("margin: 0 0 var(--size-4-3) 0");
		expect(calendarBlock).toContain("max-width: 100%");
		expect(calendarBlock).toContain("margin-inline: auto");
	});

	it("lays out the month header as a three-column grid so nav buttons keep space", () => {
		const headerBlock = extractCssBlock(modalCss, ".tasknotes-plugin .recurring-calendar__header");
		const monthBlock = extractCssBlock(modalCss, ".tasknotes-plugin .recurring-calendar__month");

		expect(headerBlock).toContain("display: grid");
		expect(headerBlock).toContain("grid-template-columns: minmax(20px, auto) minmax(0, 1fr) minmax(20px, auto)");
		expect(monthBlock).toContain("grid-column: 2");
		expect(monthBlock).toContain("text-align: center");
	});

	it("styles nav icons through an inner wrapper so mobile does not hide button > svg", () => {
		const navBlock = extractCssBlock(modalCss, ".tasknotes-plugin .recurring-calendar__nav");
		const iconBlock = extractCssBlock(modalCss, ".tasknotes-plugin .recurring-calendar__nav-icon");

		expect(navBlock).toContain("flex-shrink: 0");
		expect(iconBlock).toContain("display: inline-flex");
		expect(iconBlock).toContain("line-height: 0");
		expect(modalCss).toMatch(
			/\.tasknotes-plugin \.recurring-calendar__nav-icon svg,\s*\n\.tasknotes-plugin \.recurring-calendar__nav-icon \.svg-icon\s*\{[^}]*stroke:\s*currentColor/s
		);
		expect(modalCss).not.toMatch(/\.tasknotes-plugin \.recurring-calendar__nav svg,/);
	});

	it("keeps the calendar grid from growing wider than its header on mobile sheet", () => {
		const gridBlock = extractCssBlock(modalCss, ".tasknotes-plugin .recurring-calendar__grid");

		expect(gridBlock).toContain("grid-template-columns: repeat(7, minmax(0, 1fr))");
		expect(gridBlock).toContain("width: 100%");
		const sheetCalendarContainerBlock = extractCssBlock(
			sheetCss,
			".tasknotes-plugin.minimalist-task-modal.tn-task-modal--sheet .completions-calendar-container"
		);

		expect(sheetCalendarContainerBlock).toContain("overflow: visible");
		expect(sheetCalendarContainerBlock).not.toMatch(/padding-inline/);
	});
});
