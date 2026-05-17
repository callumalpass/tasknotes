import { isNoteFileOrFormulaProperty } from "../../../src/bases/propertyFilters";

describe("Issue #1288: Calendar formula properties in start/end date selectors", () => {
	it("accepts formula properties for calendar property-based event date selectors", () => {
		expect(isNoteFileOrFormulaProperty("formula.calculatedDate")).toBe(true);
		expect(isNoteFileOrFormulaProperty("formula.calculatedEndDate")).toBe(true);
		expect(isNoteFileOrFormulaProperty("note.date")).toBe(true);
		expect(isNoteFileOrFormulaProperty("file.mtime")).toBe(true);
	});

	it("does not include task-only properties in note/file/formula selectors", () => {
		expect(isNoteFileOrFormulaProperty("task.due")).toBe(false);
		expect(isNoteFileOrFormulaProperty("task.scheduled")).toBe(false);
	});
});
