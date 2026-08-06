import { generateUniqueFilename } from "../../../src/utils/filenameGenerator";

describe("Issue #2107: title filename uniqueness follows vault create semantics", () => {
	it("deduplicates case-variant title filenames before Vault.create can fail", async () => {
		const existingPaths = new Set(["tasks/time entry.md", "tasks/time entry-2.md"]);
		const vault = {
			getAbstractFileByPath: jest.fn(() => null),
			adapter: {
				exists: jest.fn(async (path: string) => existingPaths.has(path.toLowerCase())),
			},
		};

		await expect(generateUniqueFilename("time entry", "Tasks", vault as any)).resolves.toBe(
			"time entry-3"
		);

		expect(vault.adapter.exists).toHaveBeenCalledWith("Tasks/time entry.md", false);
		expect(vault.adapter.exists).toHaveBeenCalledWith("Tasks/time entry-2.md", false);
		expect(vault.adapter.exists).toHaveBeenCalledWith("Tasks/time entry-3.md", false);
	});
});
