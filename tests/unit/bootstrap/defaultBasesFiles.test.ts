import { App, TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import {
	ensureDefaultBasesViewFiles,
	ensureFolderHierarchy,
} from "../../../src/bootstrap/defaultBasesFiles";
import type { TaskNotesSettings } from "../../../src/types/settings";

function createSettings(commandPath: string): TaskNotesSettings {
	return {
		...DEFAULT_SETTINGS,
		commandFileMapping: {
			...DEFAULT_SETTINGS.commandFileMapping,
			"open-tasks-view": commandPath,
		},
	};
}

describe("default Bases file writes", () => {
	it("creates parent folders before writing missing generated Base files", async () => {
		const app = new App();
		const settings = createSettings("TaskNotes/Views/generated/tasks.base");

		const result = await ensureDefaultBasesViewFiles({
			app,
			settings,
			generateTemplate: (commandId) =>
				commandId === "open-tasks-view" ? "views:\n  - type: table\n" : undefined,
		});

		expect(result.created).toContain("TaskNotes/Views/generated/tasks.base");
		expect(app.vault.getAbstractFileByPath("TaskNotes")).not.toBeNull();
		expect(app.vault.getAbstractFileByPath("TaskNotes/Views/generated/tasks.base")).toBeInstanceOf(
			TFile
		);
	});

	it("skips existing files unless overwrite is requested", async () => {
		const app = new App();
		const settings = createSettings("TaskNotes/Views/tasks-overwrite.base");
		await app.vault.create("TaskNotes/Views/tasks-overwrite.base", "old");

		const skipped = await ensureDefaultBasesViewFiles({
			app,
			settings,
			generateTemplate: (commandId) => (commandId === "open-tasks-view" ? "new" : undefined),
		});
		expect(skipped.skipped).toContain("TaskNotes/Views/tasks-overwrite.base");
		await expect(
			app.vault.read(
				app.vault.getAbstractFileByPath("TaskNotes/Views/tasks-overwrite.base") as TFile
			)
		).resolves.toBe("old");

		const updated = await ensureDefaultBasesViewFiles(
			{
				app,
				settings,
				generateTemplate: (commandId) =>
					commandId === "open-tasks-view" ? "new" : undefined,
			},
			{ overwriteExisting: true }
		);
		expect(updated.updated).toContain("TaskNotes/Views/tasks-overwrite.base");
		await expect(
			app.vault.read(
				app.vault.getAbstractFileByPath("TaskNotes/Views/tasks-overwrite.base") as TFile
			)
		).resolves.toBe("new");
	});

	it("tolerates folders created by a racing writer", async () => {
		const created = new Set<string>();
		const vault = {
			adapter: {
				exists: jest.fn(async (path: string) => created.has(path)),
			},
			createFolder: jest.fn(async (path: string) => {
				created.add(path);
				throw new Error(`Folder already exists: ${path}`);
			}),
		};

		await expect(ensureFolderHierarchy(vault, "TaskNotes/Views")).resolves.toBeUndefined();
		expect(vault.createFolder).toHaveBeenCalledWith("TaskNotes");
		expect(vault.createFolder).toHaveBeenCalledWith("TaskNotes/Views");
	});
});
