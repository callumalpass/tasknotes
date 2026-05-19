import { extractBasesEntryProperties } from "../../../src/bases/basesEntryProperties";

describe("Bases entry property extraction", () => {
	it("prefers frontmatter over entry properties and adds cheap file metadata", () => {
		const properties = extractBasesEntryProperties({
			frontmatter: {
				status: "open",
				priority: "high",
			},
			properties: {
				status: "done",
			},
			file: {
				name: "Task.md",
				basename: "Task",
				extension: "md",
				path: "TaskNotes/Task.md",
				stat: {
					size: 128,
					ctime: 1000,
					mtime: 2000,
				},
			},
		});

		expect(properties).toEqual({
			status: "open",
			priority: "high",
			"file.name": "Task.md",
			"file.basename": "Task",
			"file.extension": "md",
			"file.path": "TaskNotes/Task.md",
			"file.size": 128,
			"file.ctime": 1000,
			"file.mtime": 2000,
		});
	});

	it("falls back to entry properties and tolerates missing file data", () => {
		expect(
			extractBasesEntryProperties({
				properties: {
					status: "open",
				},
			})
		).toEqual({
			status: "open",
		});
	});
});
