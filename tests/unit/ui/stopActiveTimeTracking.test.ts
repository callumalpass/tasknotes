import { TaskActionCoordinator } from "../../../src/ui/TaskActionCoordinator";
import { openTaskSelector } from "../../../src/modals/TaskSelectorWithCreateModal";
import { Notice } from "obsidian";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/modals/TaskSelectorWithCreateModal", () => ({ openTaskSelector: jest.fn() }));

const task = { path: "Tasks/Work.md", title: "Work", timeEntries: [{ startTime: "2026-10-01T10:00:00Z" }] } as TaskInfo;
const other = { ...task, path: "Tasks/Other.md", title: "Other" };
function createCoordinator(tasks: TaskInfo[] = [task]) {
	const plugin = {
		cacheManager: {
			getAllTasks: jest.fn().mockResolvedValue(tasks),
			getTaskInfo: jest.fn(async (path: string) => tasks.find(t => t.path === path) ?? null),
		},
		getActiveTimeSession: jest.fn((t: TaskInfo) => t.timeEntries?.find(entry => !entry.endTime) ?? null),
		i18n: { translate: jest.fn((key: string) => key) },
		taskService: { stopTimeTracking: jest.fn().mockResolvedValue(task) },
	};
	return { plugin, coordinator: new TaskActionCoordinator(plugin as never) };
}

describe("Stop active time tracking (#2326)", () => {
	beforeEach(() => jest.clearAllMocks());

	it("stops the only active tracker without a selector or current note", async () => {
		const { plugin, coordinator } = createCoordinator();
		await coordinator.stopActiveTimeTracking();
		expect(openTaskSelector).not.toHaveBeenCalled();
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledWith(task);
	});

	it("reports no active tracker without opening a picker", async () => {
		const { plugin, coordinator } = createCoordinator([{ ...task, timeEntries: [] }]);
		await coordinator.stopActiveTimeTracking();
		expect(openTaskSelector).not.toHaveBeenCalled();
		expect(plugin.taskService.stopTimeTracking).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("modals.timeTracking.noActiveTasks");
	});

	it("allows stopping an archived task that still has an active tracker", async () => {
		const archived = { ...task, archived: true };
		const { plugin, coordinator } = createCoordinator([archived]);
		await coordinator.stopActiveTimeTracking();
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledWith(archived);
	});

	it("selects one of several active trackers, never stopping all or allowing creation", async () => {
		const { plugin, coordinator } = createCoordinator([task, other]);
		jest.mocked(openTaskSelector).mockImplementation((_plugin, _tasks, choose) => choose(other));
		await coordinator.stopActiveTimeTracking();
		expect(openTaskSelector).toHaveBeenCalledWith(plugin, [task, other], expect.any(Function), {
			title: "commands.stopActiveTimeTracking", allowCreate: false, includeArchived: true,
		});
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledWith(other);
	});

	it("does not stop anything when selection is cancelled", async () => {
		const { plugin, coordinator } = createCoordinator([task, other]);
		jest.mocked(openTaskSelector).mockImplementation((_plugin, _tasks, choose) => choose(null));
		await coordinator.stopActiveTimeTracking();
		expect(plugin.taskService.stopTimeTracking).not.toHaveBeenCalled();
	});

	it.each([null, { ...task, timeEntries: [] }])("rechecks that the selected task still has an active session", async (fresh) => {
		const { plugin, coordinator } = createCoordinator();
		plugin.cacheManager.getTaskInfo.mockResolvedValue(fresh);
		await coordinator.stopActiveTimeTracking();
		expect(plugin.taskService.stopTimeTracking).not.toHaveBeenCalled();
	});

	it("prevents overlapping stops and permits a later invocation", async () => {
		const { plugin, coordinator } = createCoordinator();
		await Promise.all([coordinator.stopActiveTimeTracking(), coordinator.stopActiveTimeTracking()]);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledTimes(1);
		await coordinator.stopActiveTimeTracking();
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledTimes(2);
	});

	it("reports lookup failures and allows retry", async () => {
		const { plugin, coordinator } = createCoordinator();
		plugin.cacheManager.getAllTasks.mockRejectedValueOnce(new Error("Cannot read tasks"));
		await coordinator.stopActiveTimeTracking();
		expect(Notice).toHaveBeenCalledWith("modals.timeTracking.stopFailed");
		await coordinator.stopActiveTimeTracking();
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledTimes(1);
	});

	it("does not duplicate existing stop failure notifications", async () => {
		const { plugin, coordinator } = createCoordinator();
		plugin.taskService.stopTimeTracking.mockRejectedValue(new Error("No active time tracking session for this task"));
		await coordinator.stopActiveTimeTracking();
		expect(Notice).toHaveBeenCalledTimes(1);
	});
});
