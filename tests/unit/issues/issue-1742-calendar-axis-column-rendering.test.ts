/**
 * Issue #1742: Calendar view timeline is shifted to the center
 *
 * Bug Description:
 * In timeGrid views (W, 3D, D), the time-axis labels ("06:00", "07:00", ...)
 * intermittently render in the middle of the day grid instead of anchored to
 * the left side. The bug appears after view switches (Y/M/W/3D/D/L) and is
 * not deterministic.
 *
 * Root cause:
 * `applyTodayColumnWidth` and `resetTodayColumnWidths` wrote inline widths to
 * `<col>` elements using positional slice math:
 *
 *   const dayCols = cols.length === dateKeys.length
 *     ? cols
 *     : cols.slice(cols.length - dateKeys.length);
 *
 * This assumes the time-axis col is at index 0 and the dated cols are the last
 * N. The assumption holds in steady state, but during FullCalendar's mid-render
 * DOM transitions the col count and dated-cell count can be temporarily out of
 * sync. When that happens, the slice points at the wrong cols and a width is
 * written to the axis col, pushing its labels into the day grid.
 *
 * Fix:
 * Cross-reference each dated cell to its corresponding `<col>` via the cell's
 * `cellIndex` property and the cell's own table colgroup. The axis cell has no
 * `[data-date]` attribute, so it is never included in the iteration and its col
 * is never touched, regardless of view type or transition state.
 */

import {
	findColForCell,
	getTodayColumnWidths,
	shouldWidenTodayColumn,
} from "../../../src/bases/CalendarView";

/**
 * Build a FullCalendar-shaped timeGrid table for a given set of dated cells.
 * Layout: 1 axis col + N day cols. Axis cell has no [data-date].
 */
function buildTimeGridTable(dateKeys: string[]): {
	table: HTMLTableElement;
	axisCol: HTMLTableColElement;
	dayCols: HTMLTableColElement[];
	axisHeaderCell: HTMLTableCellElement;
	dayHeaderCells: HTMLTableCellElement[];
} {
	const table = document.createElement("table");
	const colgroup = document.createElement("colgroup");
	const axisCol = document.createElement("col");
	axisCol.classList.add("fc-axis-col");
	colgroup.appendChild(axisCol);
	const dayCols: HTMLTableColElement[] = [];
	for (const _ of dateKeys) {
		const col = document.createElement("col");
		colgroup.appendChild(col);
		dayCols.push(col);
	}
	table.appendChild(colgroup);

	const thead = document.createElement("thead");
	const headerRow = document.createElement("tr");
	const axisHeaderCell = document.createElement("th");
	axisHeaderCell.classList.add("fc-timegrid-axis");
	headerRow.appendChild(axisHeaderCell);
	const dayHeaderCells: HTMLTableCellElement[] = [];
	for (const dateKey of dateKeys) {
		const cell = document.createElement("th");
		cell.classList.add("fc-col-header-cell");
		cell.dataset.date = dateKey;
		headerRow.appendChild(cell);
		dayHeaderCells.push(cell);
	}
	thead.appendChild(headerRow);
	table.appendChild(thead);

	return { table, axisCol, dayCols, axisHeaderCell, dayHeaderCells };
}

/**
 * Build a FullCalendar-shaped dayGrid (month) table: no axis col.
 */
function buildDayGridTable(dateKeys: string[]): {
	table: HTMLTableElement;
	dayCols: HTMLTableColElement[];
	dayCells: HTMLTableCellElement[];
} {
	const table = document.createElement("table");
	const colgroup = document.createElement("colgroup");
	const dayCols: HTMLTableColElement[] = [];
	for (const _ of dateKeys) {
		const col = document.createElement("col");
		colgroup.appendChild(col);
		dayCols.push(col);
	}
	table.appendChild(colgroup);

	const tbody = document.createElement("tbody");
	const row = document.createElement("tr");
	const dayCells: HTMLTableCellElement[] = [];
	for (const dateKey of dateKeys) {
		const cell = document.createElement("td");
		cell.classList.add("fc-daygrid-day");
		cell.dataset.date = dateKey;
		row.appendChild(cell);
		dayCells.push(cell);
	}
	tbody.appendChild(row);
	table.appendChild(tbody);

	return { table, dayCols, dayCells };
}

describe("Issue #1742 - Calendar view timeline shifted to center", () => {
	describe("shouldWidenTodayColumn", () => {
		test("returns false when multiplier is 1 or less", () => {
			expect(shouldWidenTodayColumn("timeGridWeek", 1)).toBe(false);
			expect(shouldWidenTodayColumn("timeGridWeek", 0.5)).toBe(false);
			expect(shouldWidenTodayColumn("timeGridWeek", 0)).toBe(false);
		});

		test("returns true only for timeGridWeek and timeGridCustom when multiplier > 1", () => {
			expect(shouldWidenTodayColumn("timeGridWeek", 2)).toBe(true);
			expect(shouldWidenTodayColumn("timeGridCustom", 2)).toBe(true);
			expect(shouldWidenTodayColumn("timeGridDay", 2)).toBe(false);
			expect(shouldWidenTodayColumn("dayGridMonth", 2)).toBe(false);
			expect(shouldWidenTodayColumn("multiMonthYear", 2)).toBe(false);
			expect(shouldWidenTodayColumn("listWeek", 2)).toBe(false);
		});
	});

	describe("getTodayColumnWidths", () => {
		test("returns null when multiplier is 1 or less", () => {
			expect(getTodayColumnWidths(["2026-04-28"], "2026-04-28", 1)).toBeNull();
			expect(getTodayColumnWidths(["2026-04-28"], "2026-04-28", 0.5)).toBeNull();
		});

		test("returns null when only one date is present", () => {
			expect(getTodayColumnWidths(["2026-04-28"], "2026-04-28", 2)).toBeNull();
		});

		test("returns null when today is not in dateKeys", () => {
			expect(getTodayColumnWidths(["2026-04-27", "2026-04-29"], "2026-04-28", 2)).toBeNull();
		});

		test("produces widths summing to ~100% for valid input", () => {
			const dateKeys = ["2026-04-27", "2026-04-28", "2026-04-29"];
			const widths = getTodayColumnWidths(dateKeys, "2026-04-28", 2);
			expect(widths).not.toBeNull();
			const sum = dateKeys.map((d) => parseFloat(widths!.get(d)!)).reduce((a, b) => a + b, 0);
			expect(sum).toBeCloseTo(100, 1);
		});
	});

	describe("findColForCell: defensive col mapping", () => {
		test("maps dated header cell in timeGrid table to its day col, never to axis", () => {
			const dateKeys = ["2026-04-27", "2026-04-28", "2026-04-29"];
			const { axisCol, dayCols, dayHeaderCells } = buildTimeGridTable(dateKeys);

			dayHeaderCells.forEach((cell, index) => {
				const col = findColForCell(cell);
				expect(col).toBe(dayCols[index]);
				expect(col).not.toBe(axisCol);
			});
		});

		test("maps dated cell in dayGrid table (no axis) to its day col", () => {
			const dateKeys = ["2026-04-27", "2026-04-28", "2026-04-29"];
			const { dayCols, dayCells } = buildDayGridTable(dateKeys);

			dayCells.forEach((cell, index) => {
				const col = findColForCell(cell);
				expect(col).toBe(dayCols[index]);
			});
		});

		test("returns null for cell not in a table", () => {
			const orphan = document.createElement("td");
			orphan.dataset.date = "2026-04-28";
			expect(findColForCell(orphan)).toBeNull();
		});

		test("returns null when no col exists at the cell index", () => {
			const table = document.createElement("table");
			const colgroup = document.createElement("colgroup");
			colgroup.appendChild(document.createElement("col"));
			table.appendChild(colgroup);
			const tbody = document.createElement("tbody");
			const row = document.createElement("tr");
			const axisCell = document.createElement("td");
			row.appendChild(axisCell);
			const dayCell = document.createElement("td");
			dayCell.dataset.date = "2026-04-28";
			row.appendChild(dayCell);
			tbody.appendChild(row);
			table.appendChild(tbody);

			expect(findColForCell(dayCell)).toBeNull();
		});
	});

	describe("regression: width application never touches axis col", () => {
		/**
		 * Direct reproduction of the bug. The original slice-based logic could
		 * apply a width to the axis col when col count and dateKeys count drifted
		 * mid-render. The fix routes every width assignment through findColForCell,
		 * which keys off the dated cell's cellIndex, so even adversarial DOM states
		 * can't reach the axis col.
		 */
		test("writing widths via findColForCell leaves axis col untouched", () => {
			const dateKeys = ["2026-04-27", "2026-04-28", "2026-04-29"];
			const { axisCol, dayCols, dayHeaderCells } = buildTimeGridTable(dateKeys);
			const widths = getTodayColumnWidths(dateKeys, "2026-04-28", 2)!;

			dayHeaderCells.forEach((cell) => {
				const dateKey = cell.dataset.date!;
				const width = widths.get(dateKey)!;
				const col = findColForCell(cell);
				if (col) col.style.width = width;
			});

			expect(axisCol.style.width).toBe("");
			expect(axisCol.getAttribute("style")).toBeNull();
			dayCols.forEach((col, index) => {
				expect(col.style.width).toBe(widths.get(dateKeys[index]));
			});
		});

		test("reset clears widths only on dated cols, axis col unaffected", () => {
			const dateKeys = ["2026-04-27", "2026-04-28", "2026-04-29"];
			const { axisCol, dayCols, dayHeaderCells } = buildTimeGridTable(dateKeys);

			axisCol.style.width = "60px";
			dayCols.forEach((col) => (col.style.width = "33%"));

			dayHeaderCells.forEach((cell) => {
				const col = findColForCell(cell);
				if (col) col.style.removeProperty("width");
			});

			expect(axisCol.style.width).toBe("60px");
			dayCols.forEach((col) => expect(col.style.width).toBe(""));
		});

		test("extra colgroup cols (transitional state) do not leak widths to axis", () => {
			const dateKeys = ["2026-04-28"];
			const table = document.createElement("table");
			const colgroup = document.createElement("colgroup");
			const axisCol = document.createElement("col");
			const danglingCol = document.createElement("col");
			const dayCol = document.createElement("col");
			colgroup.append(axisCol, danglingCol, dayCol);
			table.appendChild(colgroup);

			const thead = document.createElement("thead");
			const row = document.createElement("tr");
			const axisHeader = document.createElement("th");
			row.appendChild(axisHeader);
			const danglingHeader = document.createElement("th");
			row.appendChild(danglingHeader);
			const dayHeader = document.createElement("th");
			dayHeader.classList.add("fc-col-header-cell");
			dayHeader.dataset.date = "2026-04-28";
			row.appendChild(dayHeader);
			thead.appendChild(row);
			table.appendChild(thead);

			const col = findColForCell(dayHeader);
			if (col) col.style.width = "50%";

			expect(axisCol.style.width).toBe("");
			expect(danglingCol.style.width).toBe("");
			expect(dayCol.style.width).toBe("50%");
		});
	});
});
