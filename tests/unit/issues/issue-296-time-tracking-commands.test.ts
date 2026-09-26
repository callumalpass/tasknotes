import { Notice } from "obsidian";
import TaskNotesPlugin from "../../../src/main";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type { TaskInfo } from "../../../src/types";
import { App, TFile } from "../../helpers/obsidian-runtime";

const task = { path: "Tasks/work.md", title: "Work" } as TaskInfo;

function createPlugin(activeFile: TFile | null = new TFile(task.path), currentTask: TaskInfo | null = task) {
	const plugin = new TaskNotesPlugin(new App() as never, {} as never);
	plugin.app.workspace.getActiveFile = jest.fn(() => activeFile) as never;
	plugin.cacheManager = { getTaskInfo: jest.fn(async () => currentTask) } as never;
	plugin.startTimeTracking = jest.fn(async () => task);
	plugin.stopTimeTracking = jest.fn(async () => task);
	return plugin;
}

describe("Issue #296: direct current-task time tracking commands", () => {
	beforeEach(() => jest.clearAllMocks());

	it.each(["start", "stop"] as const)("registers and executes the %s command without a selector", async (action) => {
		const plugin = createPlugin();
		const command = createTaskNotesCommandDefinitions(plugin).find(
			(definition) => definition.id === `${action}-time-tracking-current-task`
		);
		expect(command?.nameKey).toBe(`commands.${action}TimeTrackingCurrentTask`);
		expect(command?.callback).toBeDefined();
		await command!.callback!(plugin);
		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(plugin.startTimeTracking).toHaveBeenCalledTimes(action === "start" ? 1 : 0);
		expect(plugin.stopTimeTracking).toHaveBeenCalledTimes(action === "stop" ? 1 : 0);
		expect(plugin[`${action}TimeTracking`]).toHaveBeenCalledWith(task);
	});

	it.each(["start", "stop"] as const)("does not %s when no file is open", async (action) => {
		const plugin = createPlugin(null);
		await plugin.setCurrentTaskTimeTracking(action);
		expect(plugin.cacheManager.getTaskInfo).not.toHaveBeenCalled();
		expect(plugin[`${action}TimeTracking`]).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("No file is currently open");
	});

	it.each(["start", "stop"] as const)("does not %s on a non-task note", async (action) => {
		const plugin = createPlugin(new TFile("ordinary.md"), null);
		await plugin.setCurrentTaskTimeTracking(action);
		expect(plugin[`${action}TimeTracking`]).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("Current file is not a task");
	});

	it.each(["start", "stop"] as const)("handles %s failures without duplicating coordinator notices", async (action) => {
		const plugin = createPlugin();
		jest.mocked(plugin[`${action}TimeTracking`]).mockRejectedValue(new Error("Already reported"));
		await expect(plugin.setCurrentTaskTimeTracking(action)).resolves.toBeUndefined();
		expect(Notice).not.toHaveBeenCalled();
	});

	it("ignores overlapping invocations and allows later commands", async () => {
		const plugin = createPlugin();
		await Promise.all([
			plugin.setCurrentTaskTimeTracking("start"),
			plugin.setCurrentTaskTimeTracking("start"),
		]);
		expect(plugin.startTimeTracking).toHaveBeenCalledTimes(1);
		await plugin.setCurrentTaskTimeTracking("stop");
		expect(plugin.stopTimeTracking).toHaveBeenCalledTimes(1);
	});

	it("reports task lookup failures", async () => {
		const plugin = createPlugin();
		jest.mocked(plugin.cacheManager.getTaskInfo).mockRejectedValue(new Error("Lookup failed"));
		await plugin.setCurrentTaskTimeTracking("start");
		expect(plugin.startTimeTracking).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("Failed to load current task");
	});
});
