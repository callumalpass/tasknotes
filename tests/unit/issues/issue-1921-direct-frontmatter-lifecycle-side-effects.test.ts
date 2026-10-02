import { TFile } from "../../helpers/obsidian-runtime";
import {
	selectReconciledTaskProperty,
	TaskFileLifecycleReconciliationService,
} from "../../../src/services/TaskFileLifecycleReconciliationService";
import { EVENT_TASK_UPDATED, type TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Direct edit task",
		status: "ready",
		priority: "normal",
		path: "TaskNotes/Tasks/direct-edit.md",
		archived: false,
		scheduled: "2026-05-18",
		googleCalendarEventId: "existing-event-id",
		...overrides,
	} as TaskInfo;
}

function createEmitter() {
	let taskUpdatedHandler: ((payload: unknown) => void) | undefined;

	return {
		on: jest.fn((event: string, handler: (payload: unknown) => void) => {
			if (event === EVENT_TASK_UPDATED) {
				taskUpdatedHandler = handler;
			}
			return { event, handler };
		}),
		offref: jest.fn(),
		triggerTaskUpdated(payload: unknown) {
			taskUpdatedHandler?.(payload);
		},
	};
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

function createPlugin(initialTasks: TaskInfo[] = []) {
	const file = new TFile("TaskNotes/Tasks/direct-edit.md");
	const emitter = createEmitter();
	const taskService = {
		applyPropertyChangeSideEffects: jest.fn().mockResolvedValue(undefined),
	};
	const plugin = {
		app: {
			vault: {
				getAbstractFileByPath: jest.fn(() => file),
			},
		},
		cacheManager: {
			getAllTasks: jest.fn().mockResolvedValue(initialTasks),
		},
		emitter,
		taskService,
	};

	return { emitter, file, plugin, taskService };
}

describe("Issue #1921: direct frontmatter edits trigger lifecycle side effects", () => {
	it("selects status before other changed fields so completion uses completion side effects", () => {
		const originalTask = createTask({ status: "ready", title: "Original" });
		const updatedTask = createTask({
			status: "done",
			title: "Updated",
			completedDate: "2026-05-18",
		});

		expect(selectReconciledTaskProperty(originalTask, updatedTask)).toBe("status");
	});

	it("routes direct status completion through the existing TaskService side-effect path", async () => {
		const originalTask = createTask({ status: "ready" });
		const updatedTask = createTask({
			status: "done",
			completedDate: "2026-05-18",
		});
		const { emitter, file, plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		emitter.triggerTaskUpdated({
			path: updatedTask.path,
			updatedTask,
		});
		await flushPromises();

		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledWith(
			file,
			originalTask,
			updatedTask,
			"status",
			"ready",
			"done"
		);

		service.destroy();
	});

	it("routes direct calendar-visible metadata changes through the update side-effect path", async () => {
		const originalTask = createTask({ scheduled: "2026-05-18" });
		const updatedTask = createTask({ scheduled: "2026-05-19" });
		const { file, plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			updatedTask,
		});

		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledWith(
			file,
			originalTask,
			updatedTask,
			"scheduled",
			"2026-05-18",
			"2026-05-19"
		);

		service.destroy();
	});

	it("does not rerun side effects for TaskService-originated update events", async () => {
		const originalTask = createTask({ status: "ready" });
		const updatedTask = createTask({ status: "done" });
		const { plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			originalTask,
			updatedTask,
		});

		expect(taskService.applyPropertyChangeSideEffects).not.toHaveBeenCalled();

		service.destroy();
	});

	it.each([["ready", "done"], ["false", "true"]])("serializes rapid completion and reopening (%s → %s) (#2328)", async (active, complete) => {
		const original = createTask({ status: active, recurrence_parent: "[[Parent]]", occurrence_date: "2026-05-18" });
		const completed = { ...original, status: complete };
		const { plugin, taskService } = createPlugin([original]);
		let release!: () => void;
		taskService.applyPropertyChangeSideEffects.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
		const service = new TaskFileLifecycleReconciliationService(plugin as any);
		await service.initialize();
		const first = service.handleTaskUpdatedEvent({ task: completed });
		await flushPromises();
		const second = service.handleTaskUpdatedEvent({ task: original });
		await flushPromises();
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(1);
		release();
		await Promise.all([first, second]);
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(2);
		expect(taskService.applyPropertyChangeSideEffects.mock.calls[1].slice(1)).toEqual([
			completed, original, "status", complete, active,
		]);
		await service.handleTaskUpdatedEvent({ task: original });
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(2);
		service.destroy();
	});

	it("continues queued reconciliation after a side-effect failure", async () => {
		const original = createTask();
		const completed = { ...original, status: "done" };
		const { plugin, taskService } = createPlugin([original]);
		taskService.applyPropertyChangeSideEffects.mockRejectedValueOnce(new Error("First edit failed"));
		const service = new TaskFileLifecycleReconciliationService(plugin as any);
		await service.initialize();
		await Promise.all([
			service.handleTaskUpdatedEvent({ task: completed }),
			service.handleTaskUpdatedEvent({ task: original }),
		]);
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(2);
		service.destroy();
	});

	it("does not let one task block another task's reconciliation", async () => {
		const original = createTask();
		const other = createTask({ path: "TaskNotes/Tasks/other.md" });
		const { plugin, taskService } = createPlugin([original, other]);
		let release!: () => void;
		taskService.applyPropertyChangeSideEffects.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
		const service = new TaskFileLifecycleReconciliationService(plugin as any);
		await service.initialize();
		const first = service.handleTaskUpdatedEvent({ task: { ...original, status: "done" } });
		await flushPromises();
		await service.handleTaskUpdatedEvent({ task: { ...other, status: "done" } });
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(2);
		release();
		await first;
		service.destroy();
	});

	it("drops queued work when the service is destroyed", async () => {
		const original = createTask();
		const { plugin, taskService } = createPlugin([original]);
		let release!: () => void;
		taskService.applyPropertyChangeSideEffects.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
		const service = new TaskFileLifecycleReconciliationService(plugin as any);
		await service.initialize();
		const first = service.handleTaskUpdatedEvent({ task: { ...original, status: "done" } });
		await flushPromises();
		const second = service.handleTaskUpdatedEvent({ task: original });
		service.destroy();
		release();
		await Promise.all([first, second]);
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(1);
	});

	it("does not replay side-effect-generated events while draining direct edits", async () => {
		const original = createTask();
		const completed = { ...original, status: "done" };
		const { plugin, taskService } = createPlugin([original]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);
		await service.initialize();
		taskService.applyPropertyChangeSideEffects.mockImplementation(async (_file, before, after) => {
			await service.handleTaskUpdatedEvent({ originalTask: before, updatedTask: after });
		});
		await Promise.all([
			service.handleTaskUpdatedEvent({ task: completed }),
			service.handleTaskUpdatedEvent({ task: original }),
		]);
		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledTimes(2);
		service.destroy();
	});

	it("ignores Google Calendar event id bookkeeping changes", async () => {
		const originalTask = createTask({ googleCalendarEventId: undefined });
		const updatedTask = createTask({ googleCalendarEventId: "new-event-id" });
		const { plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			updatedTask,
		});

		expect(taskService.applyPropertyChangeSideEffects).not.toHaveBeenCalled();

		service.destroy();
	});
});
