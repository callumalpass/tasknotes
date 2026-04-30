import { describe, expect, it, jest } from "@jest/globals";
import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import { AutoArchiveService } from "../../../src/services/AutoArchiveService";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { StatusManager } from "../../../src/services/StatusManager";
import { TaskService } from "../../../src/services/TaskService";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { EVENT_TASK_UPDATED, StatusConfig, TaskInfo } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";
import { TFile } from "../../__mocks__/obsidian";

type EventHandler = (payload: unknown) => void | Promise<void>;

function createEmitter() {
	const handlers = new Map<string, EventHandler>();
	return {
		on: jest.fn((event: string, handler: EventHandler) => {
			handlers.set(event, handler);
			return { event, handler };
		}),
		offref: jest.fn(),
		async trigger(event: string, payload: unknown) {
			await handlers.get(event)?.(payload);
		},
	};
}

class TestBasesView extends BasesViewBase {
	type = "tasknotesTest";
	handledTasks: TaskInfo[] = [];

	constructor(plugin: any) {
		super({}, document.createElement("div"), plugin);
	}

	register(fn: () => void): void {
		void fn;
	}

	render(): void {}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		this.handledTasks.push(task);
	}

	startListeningFor(paths: string[]): void {
		(this as any).rootElement = document.createElement("div");
		document.body.appendChild((this as any).rootElement);
		for (const path of paths) {
			(this as any).relevantPathsCache.add(path);
		}
		this.setupTaskUpdateListener();
	}
}

describe("Issue #1836: Bases views receive TaskService update events", () => {
	it("handles the updatedTask payload emitted by TaskService status and archive updates", async () => {
		const emitter = createEmitter();
		const plugin = {
			emitter,
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			settings: {
				fieldMapping: DEFAULT_FIELD_MAPPING,
			},
		};
		const view = new TestBasesView(plugin);
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/issue-1836.md",
			status: "open",
		});
		const updatedTask = TaskFactory.createTask({
			path: originalTask.path,
			status: "done",
			completedDate: "2026-04-30",
		});

		view.startListeningFor([updatedTask.path]);
		await emitter.trigger(EVENT_TASK_UPDATED, {
			path: updatedTask.path,
			originalTask,
			updatedTask,
		});

		expect(view.handledTasks).toEqual([updatedTask]);
	});

	it("still schedules auto-archive when TaskNotes handles the status transition", async () => {
		const doneStatus: StatusConfig = {
			id: "done",
			value: "done",
			label: "Done",
			color: "#00aa00",
			isCompleted: true,
			order: 3,
			autoArchive: true,
			autoArchiveDelay: 1,
		};
		const autoArchiveService = {
			scheduleAutoArchive: jest.fn(),
			cancelAutoArchive: jest.fn(),
		};
		const plugin = {
			cacheManager: {
				waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
				updateTaskInfoInCache: jest.fn(),
				getBlockedTaskPaths: jest.fn(() => []),
			},
			emitter: {
				trigger: jest.fn(),
			},
			statusManager: {
				isCompletedStatus: jest.fn((status: string) => status === "done"),
				getStatusConfig: jest.fn((status: string) =>
					status === "done" ? doneStatus : undefined
				),
			},
		};
		const taskService = new TaskService(plugin as any);
		taskService.setAutoArchiveService(autoArchiveService as any);
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/issue-1836.md",
			status: "open",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			status: "done",
			completedDate: "2026-04-30",
		});

		await taskService.applyPropertyChangeSideEffects(
			new TFile(updatedTask.path) as any,
			originalTask,
			updatedTask,
			"status",
			"open",
			"done"
		);

		expect(autoArchiveService.scheduleAutoArchive).toHaveBeenCalledWith(
			updatedTask,
			doneStatus
		);
	});

	it("schedules auto-archive for checkbox-backed status values", async () => {
		const checkboxStatuses: StatusConfig[] = [
			{
				id: "todo",
				value: "false",
				label: "Todo",
				color: "#808080",
				isCompleted: false,
				order: 0,
				autoArchive: false,
				autoArchiveDelay: 1,
			},
			{
				id: "done",
				value: "true",
				label: "Done",
				color: "#00aa00",
				isCompleted: true,
				order: 1,
				autoArchive: true,
				autoArchiveDelay: 1,
			},
		];
		const autoArchiveService = {
			scheduleAutoArchive: jest.fn(),
			cancelAutoArchive: jest.fn(),
		};
		const plugin = {
			cacheManager: {
				waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
				updateTaskInfoInCache: jest.fn(),
				getBlockedTaskPaths: jest.fn(() => []),
			},
			emitter: {
				trigger: jest.fn(),
			},
			statusManager: new StatusManager(checkboxStatuses, "false"),
		};
		const taskService = new TaskService(plugin as any);
		taskService.setAutoArchiveService(autoArchiveService as any);
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/issue-1836-checkbox.md",
			status: "false",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			status: "true",
			completedDate: "2026-04-30",
		});

		await taskService.applyPropertyChangeSideEffects(
			new TFile(updatedTask.path) as any,
			originalTask,
			updatedTask,
			"status",
			"false",
			true as any
		);

		expect(autoArchiveService.scheduleAutoArchive).toHaveBeenCalledWith(
			updatedTask,
			checkboxStatuses[1]
		);
	});

	it("processes due auto-archive queue items after TaskNotes schedules them", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/issue-1836.md",
			status: "done",
			archived: false,
			tags: ["task"],
		});
		const archivedTask = TaskFactory.createTask({
			...task,
			path: "TaskNotes/Archive/issue-1836.md",
			archived: true,
			tags: ["task", "archived"],
		});
		const dueQueueItem = {
			taskPath: task.path,
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		};
		const plugin = {
			settings: {
				googleCalendarExport: {
					enabled: false,
					syncOnTaskDelete: true,
				},
			},
			loadData: jest.fn().mockResolvedValue({
				autoArchiveQueue: [dueQueueItem],
			}),
			saveData: jest.fn().mockResolvedValue(undefined),
			cacheManager: {
				getTaskByPath: jest.fn().mockResolvedValue(task),
			},
			taskService: {
				toggleArchive: jest.fn().mockResolvedValue(archivedTask),
			},
		};
		const autoArchiveService = new AutoArchiveService(plugin as any);

		await (autoArchiveService as any).processQueue();

		expect(plugin.taskService.toggleArchive).toHaveBeenCalledWith(task);
		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [],
		});
	});

	it("processes due auto-archive queue items for checkbox-backed status values", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/issue-1836-checkbox.md",
			archived: false,
			tags: ["task"],
		});
		(task as any).status = true;
		const archivedTask = TaskFactory.createTask({
			...task,
			status: "true",
			path: "TaskNotes/Archive/issue-1836-checkbox.md",
			archived: true,
			tags: ["task", "archived"],
		});
		const dueQueueItem = {
			taskPath: task.path,
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "true",
		};
		const plugin = {
			settings: {
				googleCalendarExport: {
					enabled: false,
					syncOnTaskDelete: true,
				},
			},
			loadData: jest.fn().mockResolvedValue({
				autoArchiveQueue: [dueQueueItem],
			}),
			saveData: jest.fn().mockResolvedValue(undefined),
			cacheManager: {
				getTaskByPath: jest.fn().mockResolvedValue(task),
			},
			taskService: {
				toggleArchive: jest.fn().mockResolvedValue(archivedTask),
			},
		};
		const autoArchiveService = new AutoArchiveService(plugin as any);

		await (autoArchiveService as any).processQueue();

		expect(plugin.taskService.toggleArchive).toHaveBeenCalledWith(task);
		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [],
		});
	});
});
