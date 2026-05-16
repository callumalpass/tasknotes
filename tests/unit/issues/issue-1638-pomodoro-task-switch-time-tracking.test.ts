/**
 * Regression tests for Issue #1638: switching tasks during a running Pomodoro
 * must close the previous task's active time entry and start one for the new
 * task.
 */

import { describe, expect, it, jest } from "@jest/globals";
import { PomodoroService } from "../../../src/services/PomodoroService";
import { TaskInfo } from "../../../src/types";

type PomodoroPlugin = ConstructorParameters<typeof PomodoroService>[0];

function createTask(path: string, title: string): TaskInfo {
	return {
		title,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function createMockPlugin(tasks: TaskInfo[]) {
	let data: Record<string, unknown> = {};
	const tasksByPath = new Map(tasks.map((task) => [task.path, task]));

	const plugin = {
		settings: {
			pomodoroWorkDuration: 25,
			pomodoroShortBreakDuration: 5,
			pomodoroLongBreakDuration: 15,
			pomodoroLongBreakInterval: 4,
			pomodoroAutoStartBreaks: false,
			pomodoroAutoStartWork: false,
			pomodoroNotifications: false,
			pomodoroSoundEnabled: false,
			pomodoroStorageLocation: "plugin",
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn(async () => data),
		saveData: jest.fn(async (nextData: Record<string, unknown>) => {
			data = { ...nextData };
		}),
		emitter: {
			trigger: jest.fn(),
		},
		taskService: {
			startTimeTracking: jest.fn(async () => undefined),
			stopTimeTracking: jest.fn(async () => undefined),
		},
		cacheManager: {
			getTaskInfo: jest.fn(async (path: string) => tasksByPath.get(path) ?? null),
		},
	};

	return plugin;
}

describe("Issue #1638: Pomodoro task switching updates time tracking", () => {
	it("stops the previous task and starts the new task while a work session is running", async () => {
		const task1 = createTask("Tasks/task-1.md", "Task 1");
		const task2 = createTask("Tasks/task-2.md", "Task 2");
		const plugin = createMockPlugin([task1, task2]);
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.startPomodoro(task1);
		await service.assignTaskToCurrentSession(task2);
		await (service as { completePomodoro: () => Promise<void> }).completePomodoro();

		expect(plugin.taskService.startTimeTracking).toHaveBeenNthCalledWith(1, task1);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenNthCalledWith(1, task1);
		expect(plugin.taskService.startTimeTracking).toHaveBeenNthCalledWith(2, task2);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenNthCalledWith(2, task2);
		expect(service.getState().currentSession).toBeUndefined();
	});

	it("does not restart time tracking when the selected task has not changed", async () => {
		const task = createTask("Tasks/task-1.md", "Task 1");
		const plugin = createMockPlugin([task]);
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.startPomodoro(task);
		await service.assignTaskToCurrentSession(task);

		expect(plugin.taskService.startTimeTracking).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.startTimeTracking).toHaveBeenCalledWith(task);
		expect(plugin.taskService.stopTimeTracking).not.toHaveBeenCalled();
	});

	it("stops active task time tracking when a running Pomodoro is cleared", async () => {
		const task = createTask("Tasks/task-1.md", "Task 1");
		const plugin = createMockPlugin([task]);
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.startPomodoro(task);
		await service.assignTaskToCurrentSession(undefined);

		expect(plugin.taskService.startTimeTracking).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledWith(task);
		expect(service.getState().currentSession?.taskPath).toBeUndefined();
	});

	it("does not start new time tracking while assigning a task to a paused Pomodoro", async () => {
		const task1 = createTask("Tasks/task-1.md", "Task 1");
		const task2 = createTask("Tasks/task-2.md", "Task 2");
		const plugin = createMockPlugin([task1, task2]);
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.startPomodoro(task1);
		await service.pausePomodoro();
		await service.assignTaskToCurrentSession(task2);

		expect(plugin.taskService.startTimeTracking).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.stopTimeTracking).toHaveBeenCalledWith(task1);
		expect(service.getState().currentSession?.taskPath).toBe(task2.path);
	});
});
