import { Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../../../src/main";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import type { TaskInfo } from "../../../src/types";
import { App } from "../../__mocks__/obsidian";

jest.mock("obsidian");

jest.mock("../../../src/modals/TaskActionPaletteModal", () => ({
	TaskActionPaletteModal: jest.fn().mockImplementation(() => ({
		open: jest.fn(),
	})),
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/review.md",
		title: "Review inline task",
		path: "Tasks/review.md",
		status: "open",
		priority: "normal",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function createEditor(line: string, ch: number) {
	return {
		getCursor: jest.fn(() => ({ line: 0, ch })),
		getLine: jest.fn(() => line),
	};
}

describe("Issue #819: quick actions for inline task links", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("registers a hotkeyable editor command for the task link under the cursor", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as TaskNotesPlugin);
		const command = definitions.find(
			(definition) => definition.id === "quick-actions-task-under-cursor"
		);
		const editor = createEditor("Review [[Tasks/review]] today", 10);
		const file = new TFile("Notes/source.md");
		const ctx = {
			openQuickActionsForTaskUnderCursor: jest.fn(),
		};

		expect(command?.nameKey).toBe("commands.quickActionsTaskUnderCursor");

		await command?.editorCallback?.(ctx as never, editor as never, { file } as never);

		expect(ctx.openQuickActionsForTaskUnderCursor).toHaveBeenCalledWith(editor, file);
	});

	it("opens the quick actions palette for a task wikilink under the cursor", async () => {
		const task = createTask();
		const app = new App();
		const plugin = new TaskNotesPlugin(app as never, {} as never);
		const sourceFile = new TFile("Notes/source.md");
		const detectionService = {
			findWikilinks: jest.fn(() => [
				{
					match: "[[Tasks/review]]",
					start: 7,
					end: 23,
					type: "wikilink" as const,
				},
			]),
			detectTaskLink: jest.fn(async () => ({
				isValidTaskLink: true,
				taskPath: task.path,
				taskInfo: task,
			})),
		};
		plugin.taskLinkDetectionService = detectionService as never;

		await plugin.openQuickActionsForTaskUnderCursor(
			createEditor("Review [[Tasks/review]] today", 10) as never,
			sourceFile
		);

		expect(detectionService.findWikilinks).toHaveBeenCalledWith(
			"Review [[Tasks/review]] today"
		);
		expect(detectionService.detectTaskLink).toHaveBeenCalledWith(
			"[[Tasks/review]]",
			sourceFile.path,
			"wikilink"
		);
		expect(TaskActionPaletteModal).toHaveBeenCalledWith(
			plugin.app,
			task,
			plugin,
			expect.any(Date)
		);
		const modal = (TaskActionPaletteModal as jest.Mock).mock.results[0].value;
		expect(modal.open).toHaveBeenCalledTimes(1);
	});

	it("does not open quick actions when the cursor is not on a task link", async () => {
		const app = new App();
		const plugin = new TaskNotesPlugin(app as never, {} as never);
		const detectionService = {
			findWikilinks: jest.fn(() => [
				{
					match: "[[Tasks/review]]",
					start: 7,
					end: 23,
					type: "wikilink" as const,
				},
			]),
			detectTaskLink: jest.fn(),
		};
		plugin.taskLinkDetectionService = detectionService as never;

		await plugin.openQuickActionsForTaskUnderCursor(
			createEditor("Review [[Tasks/review]] today", 2) as never,
			new TFile("Notes/source.md")
		);

		expect(detectionService.detectTaskLink).not.toHaveBeenCalled();
		expect(TaskActionPaletteModal).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("No task link found");
	});
});
