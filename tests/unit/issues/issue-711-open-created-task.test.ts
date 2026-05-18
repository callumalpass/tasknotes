import {
	openCreatedTaskFileAfterSave,
	shouldOpenCreatedTaskAfterSave,
} from "../../../src/modals/TaskCreationModal";
import type { TFile } from "obsidian";

jest.mock("obsidian");

describe("Issue #711: open task note after creation", () => {
	it("opens the created task in the selected leaf mode", async () => {
		const file = { path: "TaskNotes/Tasks/new-task.md" } as TFile;
		const sameTabLeaf = { openFile: jest.fn().mockResolvedValue(undefined) };
		const newTabLeaf = { openFile: jest.fn().mockResolvedValue(undefined) };
		const app = {
			workspace: {
				getLeaf: jest.fn((mode: boolean | string) =>
					mode === "tab" ? newTabLeaf : sameTabLeaf
				),
			},
		} as any;

		await openCreatedTaskFileAfterSave(app, file, "same-tab");
		await openCreatedTaskFileAfterSave(app, file, "new-tab");

		expect(app.workspace.getLeaf).toHaveBeenNthCalledWith(1, false);
		expect(app.workspace.getLeaf).toHaveBeenNthCalledWith(2, "tab");
		expect(sameTabLeaf.openFile).toHaveBeenCalledWith(file);
		expect(newTabLeaf.openFile).toHaveBeenCalledWith(file);
	});

	it("only auto-opens plain task creation saves", () => {
		expect(shouldOpenCreatedTaskAfterSave("new-tab", {}, false)).toBe(true);
		expect(shouldOpenCreatedTaskAfterSave("same-tab", {}, false)).toBe(true);
		expect(shouldOpenCreatedTaskAfterSave("none", {}, false)).toBe(false);
		expect(shouldOpenCreatedTaskAfterSave("new-tab", { createAnother: true }, false)).toBe(
			false
		);
		expect(shouldOpenCreatedTaskAfterSave("new-tab", {}, true)).toBe(false);
	});
});
