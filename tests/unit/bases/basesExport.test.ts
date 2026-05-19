import {
	buildBasesExportFileName,
	buildBasesExportTable,
	formatBasesExportAsCsv,
	formatBasesExportAsTsv,
	formatBasesExportValue,
	type BasesExportDataAdapter,
} from "../../../src/bases/basesExport";

type TestEntry = {
	file?: {
		path?: string;
	};
	values: Record<string, unknown>;
};

function createAdapter(): BasesExportDataAdapter<TestEntry> {
	return {
		getVisiblePropertyIds: () => ["note.status", "note.priority", "note.contexts"],
		getPropertyDisplayName: (propertyId) => {
			if (propertyId === "note.status") return "Status";
			if (propertyId === "note.priority") return "Priority\tRank";
			return "";
		},
		getPropertyValue: (entry, propertyId) => entry.values[propertyId],
	};
}

describe("Bases export helpers", () => {
	it("builds visible columns and formatted row values from a Bases adapter", () => {
		const table = buildBasesExportTable(
			[
				{
					file: { path: "Tasks/A.md" },
					values: {
						"note.status": "open",
						"note.priority": "high\nurgent",
						"note.contexts": ["work", "deep"],
					},
				},
			],
			createAdapter()
		);

		expect(table).toEqual({
			columns: [
				{ id: "file", label: "File" },
				{ id: "note.status", label: "Status" },
				{ id: "note.priority", label: "Priority\tRank" },
				{ id: "note.contexts", label: "note.contexts" },
			],
			rows: [["Tasks/A.md", "open", "high urgent", "work, deep"]],
		});
	});

	it("formats TSV and CSV exports with their respective escaping rules", () => {
		const table = {
			columns: [
				{ id: "file", label: "File" },
				{ id: "note.priority", label: "Priority\tRank" },
			],
			rows: [
				["Tasks/A.md", "high, urgent"],
				["Tasks/B.md", 'blocked "externally"'],
			],
		};

		expect(formatBasesExportAsTsv(table)).toBe(
			'File\tPriority Rank\nTasks/A.md\thigh, urgent\nTasks/B.md\tblocked "externally"'
		);
		expect(formatBasesExportAsCsv(table)).toBe(
			'File,Priority\tRank\nTasks/A.md,"high, urgent"\nTasks/B.md,"blocked ""externally"""'
		);
	});

	it("sanitizes export file names and falls back when names are empty", () => {
		expect(buildBasesExportFileName("Current tasks: today?", "tasknotesList")).toBe(
			"Current-tasks--today.csv"
		);
		expect(buildBasesExportFileName("   ", "tasknotesList")).toBe(
			"tasknotes-bases-export.csv"
		);
		expect(buildBasesExportFileName(null, "tasknotesList")).toBe("tasknotesList.csv");
		expect(buildBasesExportFileName(null, undefined)).toBe("tasknotes-bases-export.csv");
	});

	it("stringifies unknown values without preserving row-breaking newlines", () => {
		expect(formatBasesExportValue({ a: 1 })).toBe('{"a":1}');
		expect(formatBasesExportValue("line one\r\nline two")).toBe("line one line two");
	});
});
