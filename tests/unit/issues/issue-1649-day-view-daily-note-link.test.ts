/**
 * Regression coverage for issue #1649.
 *
 * FullCalendar's single-day time grid header can render as a plain
 * `.fc-col-header-cell-cushion` instead of the navlink anchor used by other
 * views. TaskNotes date-header clicks open the daily note, so the day view needs
 * an explicit daily-note click handler.
 */

import { attachDailyNoteHeaderLink } from "../../../src/bases/calendar-core";

describe("Issue #1649: Daily note link in day view header", () => {
	it("wires the timeGridDay header cushion to open the daily note", () => {
		const headerCell = document.createElement("th");
		headerCell.className = "fc-col-header-cell";
		headerCell.dataset.date = "2026-02-26";

		const cushion = document.createElement("a");
		cushion.className = "fc-col-header-cell-cushion";
		cushion.textContent = "Thursday";
		headerCell.appendChild(cushion);

		const plugin = { app: { workspace: { getLeaf: jest.fn() } } } as never;
		const clickHandler = jest.fn();
		const date = new Date(2026, 1, 26);

		attachDailyNoteHeaderLink(headerCell, date, "timeGridDay", plugin, clickHandler);

		expect(cushion.getAttribute("data-navlink")).toBe("");
		expect(cushion.getAttribute("title")).toMatch(/^Go to /);
		expect(cushion.getAttribute("aria-label")).toBe(cushion.getAttribute("title"));
		expect(cushion.getAttribute("href")).toBe("#");

		const event = new MouseEvent("click", { bubbles: true, cancelable: true });
		const defaultAllowed = cushion.dispatchEvent(event);

		expect(defaultAllowed).toBe(false);
		expect(clickHandler).toHaveBeenCalledWith(date, plugin);
	});

	it("does not override built-in navlink behavior for other views", () => {
		const headerCell = document.createElement("th");
		const cushion = document.createElement("a");
		cushion.className = "fc-col-header-cell-cushion";
		headerCell.appendChild(cushion);

		const clickHandler = jest.fn();

		attachDailyNoteHeaderLink(
			headerCell,
			new Date(2026, 1, 26),
			"timeGridWeek",
			{} as never,
			clickHandler
		);

		expect(cushion.hasAttribute("data-navlink")).toBe(false);
		cushion.click();
		expect(clickHandler).not.toHaveBeenCalled();
	});
});
