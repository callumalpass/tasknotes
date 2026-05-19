import { TFile } from "obsidian";
import { WorkspaceNavigationService } from "../../../src/ui/WorkspaceNavigationService";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("obsidian");

describe("Issue #1060: view commands reuse existing sidebar leaves", () => {
	it("reveals an existing leaf for the configured Base file instead of opening a new main tab", async () => {
		const file = new TFile("TaskNotes/Views/calendar-default.base");
		const existingLeaf = {
			view: { file },
			openFile: jest.fn(),
			setViewState: jest.fn(),
			loadIfDeferred: jest.fn(),
		};
		const workspace = {
			iterateAllLeaves: jest.fn((visitor: (leaf: typeof existingLeaf) => void) => {
				visitor(existingLeaf);
			}),
			getLeaf: jest.fn(),
			setActiveLeaf: jest.fn(),
			revealLeaf: jest.fn().mockResolvedValue(undefined),
		};

		const plugin = {
			settings: {
				commandFileMapping: {
					"open-calendar-view": "TaskNotes/Views/calendar-default.base",
				},
			},
			app: {
				vault: {
					adapter: {
						exists: jest.fn().mockResolvedValue(true),
					},
					getAbstractFileByPath: jest.fn().mockReturnValue(file),
				},
				workspace,
			},
		} as unknown as TaskNotesPlugin;

		await new WorkspaceNavigationService(plugin).openBasesFileForCommand(
			"open-calendar-view"
		);

		expect(workspace.setActiveLeaf).toHaveBeenCalledWith(existingLeaf, { focus: true });
		expect(workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
		expect(existingLeaf.openFile).not.toHaveBeenCalled();
		expect(workspace.getLeaf).not.toHaveBeenCalled();
	});
});
