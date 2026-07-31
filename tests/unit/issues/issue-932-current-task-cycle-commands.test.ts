import { Notice } from "obsidian";
import TaskNotesPlugin from "../../../src/main";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type { TaskInfo } from "../../../src/types";
import { App, TFile } from "../../helpers/obsidian-runtime";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/review.md",
		title: "Review keyboard actions",
		path: "Tasks/review.md",
		status: "open",
		priority: "normal",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function createPlugin(
	task: TaskInfo | null,
	activeFile: TFile | null = new TFile(task?.path ?? "Tasks/review.md")
): TaskNotesPlugin {
	const plugin = new TaskNotesPlugin(new App() as never, {} as never);
	plugin.app.workspace.getActiveFile = jest.fn(() => activeFile) as never;
	plugin.cacheManager = {
		getTaskInfo: jest.fn(async () => task),
	} as never;
	plugin.statusManager = {
		getNextStatus: jest.fn(() => "in-progress"),
	} as never;
	plugin.priorityManager = {
		getNextPriority: jest.fn(() => "high"),
	} as never;
	plugin.settings = {
		defaultTaskPriority: "normal",
	} as never;
	plugin.updateTaskProperty = jest.fn(
		async (currentTask: TaskInfo, property: keyof TaskInfo, value: unknown) => ({
			...currentTask,
			[property]: value,
		})
	) as never;
	return plugin;
}

describe("Issue #932: current task status and priority cycle commands", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("registers hotkeyable commands for cycling the current task status and priority", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as TaskNotesPlugin);
		const statusCommand = definitions.find(
			(definition) => definition.id === "cycle-current-task-status"
		);
		const priorityCommand = definitions.find(
			(definition) => definition.id === "cycle-current-task-priority"
		);
		const ctx = {
			cycleCurrentTaskStatus: jest.fn(),
			cycleCurrentTaskPriority: jest.fn(),
		};

		expect(statusCommand?.nameKey).toBe("commands.cycleCurrentTaskStatus");
		expect(priorityCommand?.nameKey).toBe("commands.cycleCurrentTaskPriority");

		await statusCommand?.callback?.(ctx as never);
		await priorityCommand?.callback?.(ctx as never);

		expect(ctx.cycleCurrentTaskStatus).toHaveBeenCalledTimes(1);
		expect(ctx.cycleCurrentTaskPriority).toHaveBeenCalledTimes(1);
	});

	it("cycles the active task status through the existing StatusManager sequence", async () => {
		const task = createTask({ status: "open" });
		const plugin = createPlugin(task);

		await plugin.cycleCurrentTaskStatus();

		expect(plugin.app.workspace.getActiveFile).toHaveBeenCalledTimes(1);
		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(plugin.statusManager.getNextStatus).toHaveBeenCalledWith("open");
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(
			task,
			"status",
			"in-progress"
		);
	});

	it("cycles the active task priority through the existing PriorityManager sequence", async () => {
		const task = createTask({ priority: "normal" });
		const plugin = createPlugin(task);

		await plugin.cycleCurrentTaskPriority();

		expect(plugin.app.workspace.getActiveFile).toHaveBeenCalledTimes(1);
		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(plugin.priorityManager.getNextPriority).toHaveBeenCalledWith("normal");
		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "priority", "high");
	});

	it("does not update a task when no file is active", async () => {
		const plugin = createPlugin(null, null);

		await plugin.cycleCurrentTaskStatus();

		expect(plugin.cacheManager.getTaskInfo).not.toHaveBeenCalled();
		expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("No file is currently open");
	});
});
