import {
	openTaskModalTaskSelector,
	type TaskModalTaskSelectorOpener,
} from "../../../src/modals/taskModalTaskSelector";
import type { TaskInfo } from "../../../src/types";

function task(path: string): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function pluginWithTasks(tasks: TaskInfo[]): any {
	return {
		cacheManager: {
			getAllTasks: jest.fn(async () => tasks),
		},
	};
}

describe("openTaskModalTaskSelector", () => {
	it("opens the task selector with filtered candidates and ignores cancellation", async () => {
		const tasks = [task("Tasks/one.md"), task("Tasks/two.md")];
		const plugin = pluginWithTasks(tasks);
		const selectedTask = tasks[1];
		const onSelect = jest.fn();
		const openSelector: TaskModalTaskSelectorOpener = jest.fn(
			(_plugin, candidates, chooseTask) => {
				expect(candidates).toEqual([selectedTask]);
				chooseTask(null);
				chooseTask(selectedTask);
			}
		);

		const result = await openTaskModalTaskSelector({
			plugin,
			getCandidates: (allTasks) =>
				allTasks.filter((candidate) => candidate.path === selectedTask.path),
			onSelect,
			translate: (key) => `translated:${key}`,
			noEligibleTasksMessageKey: "empty",
			openFailedMessageKey: "failed",
			logOperation: "test-selector",
			openSelector,
			showNotice: jest.fn(),
		});

		expect(result).toBe("opened");
		expect(plugin.cacheManager.getAllTasks).toHaveBeenCalledTimes(1);
		expect(openSelector).toHaveBeenCalledWith(plugin, [selectedTask], expect.any(Function));
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(selectedTask);
	});

	it("shows the configured notice when no tasks are eligible", async () => {
		const showNotice = jest.fn();
		const openSelector = jest.fn();

		const result = await openTaskModalTaskSelector({
			plugin: pluginWithTasks([task("Tasks/current.md")]),
			getCandidates: () => [],
			onSelect: jest.fn(),
			translate: (key) => `translated:${key}`,
			noEligibleTasksMessageKey: "empty",
			openFailedMessageKey: "failed",
			logOperation: "test-selector",
			openSelector,
			showNotice,
		});

		expect(result).toBe("empty");
		expect(openSelector).not.toHaveBeenCalled();
		expect(showNotice).toHaveBeenCalledWith("translated:empty");
	});

	it("reports selector setup failures with the configured notice and log operation", async () => {
		const error = new Error("cache unavailable");
		const showNotice = jest.fn();
		const logger = { error: jest.fn() };

		const result = await openTaskModalTaskSelector({
			plugin: pluginWithTasks([]),
			getAllTasks: jest.fn(async () => {
				throw error;
			}),
			getCandidates: jest.fn(),
			onSelect: jest.fn(),
			translate: (key) => `translated:${key}`,
			noEligibleTasksMessageKey: "empty",
			openFailedMessageKey: "failed",
			logOperation: "test-selector",
			showNotice,
			logger,
		});

		expect(result).toBe("error");
		expect(showNotice).toHaveBeenCalledWith("translated:failed");
		expect(logger.error).toHaveBeenCalledWith("Failed to open task selector", {
			category: "stale-data",
			operation: "test-selector",
			error,
		});
	});
});
