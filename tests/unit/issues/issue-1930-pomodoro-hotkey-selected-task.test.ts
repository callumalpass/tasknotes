import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import { PomodoroService } from "../../../src/services/PomodoroService";
import type { TaskInfo } from "../../../src/types";

type PomodoroPlugin = ConstructorParameters<typeof PomodoroService>[0];

function createTask(path: string): TaskInfo {
	return {
		title: "Selected task",
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

function createMockPlugin(task: TaskInfo) {
	let data: Record<string, unknown> = {
		lastSelectedTaskPath: task.path,
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
			getTaskInfo: jest.fn(async (path: string) => (path === task.path ? task : null)),
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
	};
}

describe("Issue #1930: Pomodoro hotkey starts tracking the selected task", () => {
	it("routes the command-palette start action through the last-selected task helper", async () => {
		const definition = createTaskNotesCommandDefinitions({} as never).find(
			(command) => command.id === "start-pomodoro"
		);
		const ctx = {
			pomodoroService: {
				getState: jest.fn(() => ({ isRunning: false })),
				resumePomodoro: jest.fn(),
				startBreak: jest.fn(),
				startPomodoro: jest.fn(),
				startPomodoroWithLastSelectedTask: jest.fn(),
			},
		};

		await definition?.callback?.(ctx as never);

		expect(ctx.pomodoroService.startPomodoroWithLastSelectedTask).toHaveBeenCalledTimes(1);
		expect(ctx.pomodoroService.startPomodoro).not.toHaveBeenCalled();
	});

	it("starts time tracking for the persisted selected Pomodoro task", async () => {
		const task = createTask("TaskNotes/Tasks/focus.md");
		const plugin = createMockPlugin(task);
		const service = new PomodoroService(plugin as unknown as PomodoroPlugin);

		await service.startPomodoroWithLastSelectedTask();

		expect(plugin.cacheManager.getTaskInfo).toHaveBeenCalledWith(task.path);
		expect(plugin.taskService.startTimeTracking).toHaveBeenCalledWith(task);
		expect(service.getState().currentSession?.taskPath).toBe(task.path);
	});
});
