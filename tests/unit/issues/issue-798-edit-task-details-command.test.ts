import { Notice } from "obsidian";
import TaskNotesPlugin from "../../../src/main";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type { TaskInfo } from "../../../src/types";
import { App, TFile } from "../../__mocks__/obsidian";

jest.mock("obsidian");

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "tasks/edit-me.md",
		title: "Edit me",
		path: "tasks/edit-me.md",
		status: "open",
		priority: "normal",
		archived: false,
		projects: ["[[Project A]]"],
		contexts: [],
		tags: [],
		...overrides,
	} as TaskInfo;
}

function createPlugin(task: TaskInfo | null, activeFile: TFile | null): TaskNotesPlugin {
	const plugin = new TaskNotesPlugin(new App() as never, {} as never);
	plugin.app.workspace.getActiveFile = jest.fn(() => activeFile) as never;
	plugin.cacheManager = {
		getTaskInfo: jest.fn(async () => task),
	} as never;
	plugin.openTaskEditModal = jest.fn(async () => undefined) as never;
	return plugin;
}

describe("Issue #798: command for Edit task details", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("registers the current-task edit command as a hotkeyable command", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as TaskNotesPlugin);
		const command = definitions.find((definition) => definition.id === "edit-current-task");
		const ctx = {
			openTaskEditModalForCurrentTask: jest.fn(),
		};

		expect(command?.nameKey).toBe("commands.editCurrentTask");

		await command?.callback?.(ctx as never);

		expect(ctx.openTaskEditModalForCurrentTask).toHaveBeenCalledTimes(1);
	});

	it("opens the task edit modal for the active task file", async () => {
		const task = createTask();
		const activeFile = new TFile(task.path);
		const plugin = createPlugin(task, activeFile);

		await plugin.openTaskEditModalForCurrentTask();

		expect(plugin.app.workspace.getActiveFile).toHaveBeenCalledTimes(1);
		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(plugin.openTaskEditModal).toHaveBeenCalledWith(task);
	});

	it("shows a notice when the active file is not a task", async () => {
		const plugin = createPlugin(null, new TFile("notes/reference.md"));

		await plugin.openTaskEditModalForCurrentTask();

		expect(plugin.openTaskEditModal).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("Current file is not a tasknote");
	});
});
