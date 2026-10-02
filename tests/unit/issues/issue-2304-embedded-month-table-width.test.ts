import fs from "fs";
import path from "path";

describe("Issue #2304: embedded month table width", () => {
	it("keeps theme Markdown table width variables from shrinking FullCalendar grids", () => {
		const css = fs.readFileSync(
			path.resolve(__dirname, "../../../styles/advanced-calendar-view.css"),
			"utf8"
		);

		// Minimal's readable-line-width table selector overrides width: 100%
		// using width: var(--table-width). Scope the variable to calendar grids,
		// not ordinary Markdown tables or the surrounding note.
		expect(css).toMatch(
			/\.advanced-calendar-view \.fc-scrollgrid\s*\{[^}]*--table-width:\s*100%;[^}]*\}/s
		);
	});
});
