import type { TFile } from "obsidian";
import {
	runTaskPropertyChangeSideEffects,
	type TaskPropertyChangeSideEffectsContext,
} from "../../../src/services/task-service/taskPropertyChangeSideEffects";
import { EVENT_TASK_UPDATED, type StatusConfig, type TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Task.md",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function createStatusConfig(overrides: Partial<StatusConfig> = {}): StatusConfig {
	return {
		id: "done",
		value: "done",
		label: "Done",
		color: "#00aa00",
		isCompleted: true,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 5,
		...overrides,
	};
}

function createContext(
	overrides: Partial<TaskPropertyChangeSideEffectsContext> = {}
): TaskPropertyChangeSideEffectsContext {
	const cacheManager = {
		waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
		updateTaskInfoInCache: jest.fn(),
		getBlockedTaskPaths: jest.fn(() => []),
		getTaskInfo: jest.fn().mockResolvedValue(undefined),
	};
	const emitter = {
		trigger: jest.fn(),
	};
	const statusManager = {
		isCompletedStatus: jest.fn((status: string) => status === "done"),
		getStatusConfig: jest.fn(() => undefined),
	};

	return {
		cacheManager,
		emitter,
		statusManager,
		normalizeStatusValue: (value) => String(value),
		...overrides,
	};
}

describe("taskPropertyChangeSideEffects", () => {
	const file = { path: "TaskNotes/Task.md" } as unknown as TFile;

	it("refreshes cache and emits the primary task update event", async () => {
		const originalTask = createTask();
		const updatedTask = createTask({ priority: "high" });
		const context = createContext();

		await runTaskPropertyChangeSideEffects(context, {
			file,
			originalTask,
			updatedTask,
			property: "priority",
			oldValue: "normal",
			newValue: "high",
		});

		expect(context.cacheManager.waitForFreshTaskData).toHaveBeenCalledWith(file);
		expect(context.cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
			originalTask.path,
			updatedTask
		);
		expect(context.emitter.trigger).toHaveBeenCalledWith(EVENT_TASK_UPDATED, {
			path: originalTask.path,
			originalTask,
			updatedTask,
		});
	});

	it("emits dependent task updates when status completion state changes", async () => {
		const originalTask = createTask({ path: "TaskNotes/Blocker.md", status: "open" });
		const updatedTask = createTask({ path: "TaskNotes/Blocker.md", status: "done" });
		const dependentTask = createTask({ path: "TaskNotes/Blocked.md" });
		const context = createContext({
			cacheManager: {
				waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
				updateTaskInfoInCache: jest.fn(),
				getBlockedTaskPaths: jest.fn(() => [dependentTask.path]),
				getTaskInfo: jest.fn().mockResolvedValue(dependentTask),
			},
		});

		await runTaskPropertyChangeSideEffects(context, {
			file,
			originalTask,
			updatedTask,
			property: "status",
			oldValue: "open",
			newValue: "done",
		});

		expect(context.emitter.trigger).toHaveBeenCalledWith(EVENT_TASK_UPDATED, {
			path: dependentTask.path,
			originalTask: dependentTask,
			updatedTask: dependentTask,
		});
	});

	it("uses completion-specific webhook and calendar side effects", async () => {
		const originalTask = createTask({ status: "open" });
		const updatedTask = createTask({ status: "done" });
		const webhookNotifier = {
			triggerWebhook: jest.fn().mockResolvedValue(undefined),
		};
		const calendarSync = {
			isEnabled: jest.fn(() => true),
			completeTaskInCalendar: jest.fn().mockResolvedValue(undefined),
			updateTaskInCalendar: jest.fn().mockResolvedValue(undefined),
		};
		const context = createContext({
			webhookNotifier,
			taskCalendarSyncService: calendarSync,
		});

		await runTaskPropertyChangeSideEffects(context, {
			file,
			originalTask,
			updatedTask,
			property: "status",
			oldValue: "open",
			newValue: "done",
		});

		expect(webhookNotifier.triggerWebhook).toHaveBeenCalledWith("task.completed", {
			task: updatedTask,
		});
		expect(calendarSync.completeTaskInCalendar).toHaveBeenCalledWith(updatedTask);
		expect(calendarSync.updateTaskInCalendar).not.toHaveBeenCalled();
	});

	it("schedules or cancels auto-archive from the updated status config", async () => {
		const originalTask = createTask({ status: "open" });
		const updatedTask = createTask({ status: "done" });
		const doneStatus = createStatusConfig({ autoArchive: true });
		const autoArchiveService = {
			scheduleAutoArchive: jest.fn().mockResolvedValue(undefined),
			cancelAutoArchive: jest.fn().mockResolvedValue(undefined),
		};
		const context = createContext({
			autoArchiveService,
			statusManager: {
				isCompletedStatus: jest.fn((status: string) => status === "done"),
				getStatusConfig: jest.fn(() => doneStatus),
			},
		});

		await runTaskPropertyChangeSideEffects(context, {
			file,
			originalTask,
			updatedTask,
			property: "status",
			oldValue: "open",
			newValue: "done",
		});

		expect(autoArchiveService.scheduleAutoArchive).toHaveBeenCalledWith(
			updatedTask,
			doneStatus
		);
		expect(autoArchiveService.cancelAutoArchive).not.toHaveBeenCalled();
	});
});
