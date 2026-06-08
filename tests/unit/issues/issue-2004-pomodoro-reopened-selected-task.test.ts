import { PomodoroService } from "../../../src/services/PomodoroService";
import type { TaskInfo } from "../../../src/types";

type PomodoroPlugin = ConstructorParameters<typeof PomodoroService>[0];

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Reopened focus task",
		status: "done",
		priority: "normal",
		path: "TaskNotes/Tasks/reopened-focus.md",
		archived: false,
		completedDate: "2026-06-07",
		...overrides,
	};
}

function createMockPlugin(taskRef: { task: TaskInfo }) {
	let data: Record<string, unknown> = {
		lastSelectedTaskPath: taskRef.task.path,
	};

	return {
		settings: {
			defaultTaskStatus: "open",
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
			getTaskInfo: jest.fn(async (path: string) =>
				path === taskRef.task.path ? taskRef.task : null
			),
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
	};
}

describe("Issue #2004: Pomodoro remembers reopened selected tasks", () => {
	it("does not discard the selected task path just because the task is currently completed", async () => {
		const taskRef = { task: createTask() };
		const plugin = createMockPlugin(taskRef);
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.startPomodoroWithLastSelectedTask(1);

		expect(service.getState().currentSession?.taskPath).toBeUndefined();
		expect(await service.getLastSelectedTaskPath()).toBe(taskRef.task.path);

		await service.stopPomodoro();
		taskRef.task = {
			...taskRef.task,
			status: "in-progress",
			completedDate: undefined,
		};

		await service.startPomodoroWithLastSelectedTask(1);

		expect(service.getState().currentSession?.taskPath).toBe(taskRef.task.path);
		expect(plugin.taskService.startTimeTracking).toHaveBeenLastCalledWith(taskRef.task);
	});
});
