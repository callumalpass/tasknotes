import { TFile } from "obsidian";
import {
	TaskNotesAPI,
	type CompleteTaskOptions,
	type TaskNotesApiEventPayload,
	type TaskNotesMutationContext,
	type TaskNotesTaskPatch,
} from "../../../src/api/TaskNotesAPI";
import type TaskNotesPlugin from "../../../src/main";
import type { FilterQuery, TaskCreationData, TaskInfo, TimeEntry } from "../../../src/types";
import { EVENT_TASK_UPDATED } from "../../../src/types";

type Listener = (payload: unknown) => void;

interface TestEventRef {
	event: string;
	listener: Listener;
}

interface TestEmitter {
	on: jest.Mock<TestEventRef, [string, Listener]>;
	offref: jest.Mock<void, [TestEventRef]>;
	trigger: jest.Mock<void, [string, unknown]>;
}

interface TestPluginContext {
	plugin: TaskNotesPlugin;
	tasks: Map<string, TaskInfo>;
	files: Map<string, TFile>;
	folders: Set<string>;
	emitter: TestEmitter;
	taskService: {
		createTask: jest.Mock<
			Promise<{ file: TFile; taskInfo: TaskInfo }>,
			[TaskCreationData, { applyDefaults?: boolean }?]
		>;
		updateTask: jest.Mock<Promise<TaskInfo>, [TaskInfo, TaskNotesTaskPatch]>;
		updateProperty: jest.Mock<Promise<TaskInfo>, [TaskInfo, keyof TaskInfo, unknown]>;
		toggleArchive: jest.Mock<Promise<TaskInfo>, [TaskInfo]>;
		startTimeTracking: jest.Mock<Promise<TaskInfo>, [TaskInfo]>;
		stopTimeTracking: jest.Mock<Promise<TaskInfo>, [TaskInfo]>;
	};
	filterService: {
		getGroupedTasks: jest.Mock<Promise<Map<string, TaskInfo[]>>, [FilterQuery]>;
	};
	cacheManager: {
		getTaskInfo: jest.Mock<Promise<TaskInfo | null>, [string]>;
		getAllTasks: jest.Mock<Promise<TaskInfo[]>, []>;
		clearCacheEntry: jest.Mock<void, [string]>;
		updateTaskInfoInCache: jest.Mock<void, [string, TaskInfo]>;
	};
	fileManager: {
		renameFile: jest.Mock<Promise<void>, [TFile, string]>;
	};
}

function createEmitter(): TestEmitter {
	const listeners = new Map<string, Set<Listener>>();

	return {
		on: jest.fn((event: string, listener: Listener): TestEventRef => {
			const eventListeners = listeners.get(event) ?? new Set<Listener>();
			eventListeners.add(listener);
			listeners.set(event, eventListeners);
			return { event, listener };
		}),
		offref: jest.fn((ref: TestEventRef) => {
			listeners.get(ref.event)?.delete(ref.listener);
		}),
		trigger: jest.fn((event: string, payload: unknown) => {
			for (const listener of listeners.get(event) ?? []) {
				listener(payload);
			}
		}),
	};
}

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Write plan",
		status: "open",
		priority: "normal",
		path: "Tasks/write-plan.md",
		archived: false,
		...overrides,
	};
}

function createPluginContext(initialTasks: TaskInfo[] = [createTask()]): TestPluginContext {
	const tasks = new Map(initialTasks.map((task) => [task.path, task]));
	const files = new Map(initialTasks.map((task) => [task.path, new TFile(task.path)]));
	const folders = new Set(["", "Tasks"]);
	const emitter = createEmitter();

	const cacheManager: TestPluginContext["cacheManager"] = {
		getTaskInfo: jest.fn(async (path: string) => tasks.get(path) ?? null),
		getAllTasks: jest.fn(async () => Array.from(tasks.values())),
		clearCacheEntry: jest.fn((path: string) => {
			tasks.delete(path);
		}),
		updateTaskInfoInCache: jest.fn((path: string, task: TaskInfo) => {
			tasks.set(path, task);
		}),
	};

	const emitTaskUpdate = (originalTask: TaskInfo | undefined, updatedTask: TaskInfo): void => {
		emitter.trigger(EVENT_TASK_UPDATED, {
			path: updatedTask.path,
			originalTask,
			updatedTask,
		});
	};

	const taskService: TestPluginContext["taskService"] = {
		createTask: jest.fn(
			async (
				taskData: TaskCreationData,
				_options?: { applyDefaults?: boolean }
			): Promise<{ file: TFile; taskInfo: TaskInfo }> => {
				const path = taskData.path ?? `Tasks/${taskData.title ?? "new-task"}.md`;
				const task = createTask({
					...taskData,
					title: taskData.title ?? "New task",
					status: taskData.status ?? "open",
					priority: taskData.priority ?? "normal",
					path,
					archived: taskData.archived ?? false,
				});
				const file = new TFile(path);
				tasks.set(path, task);
				files.set(path, file);
				emitTaskUpdate(undefined, task);
				return { file, taskInfo: task };
			}
		),
		updateTask: jest.fn(async (task: TaskInfo, patch: TaskNotesTaskPatch) => {
			const updatedTask = { ...task, ...patch };
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		updateProperty: jest.fn(
			async (task: TaskInfo, property: keyof TaskInfo, value: unknown) => {
				const updatedTask = { ...task, [property]: value } as TaskInfo;
				tasks.set(updatedTask.path, updatedTask);
				emitTaskUpdate(task, updatedTask);
				return updatedTask;
			}
		),
		toggleArchive: jest.fn(async (task: TaskInfo) => {
			const updatedTask = { ...task, archived: !task.archived };
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		startTimeTracking: jest.fn(async (task: TaskInfo) => {
			const timeEntry: TimeEntry = { startTime: "2026-05-31T10:00:00.000Z" };
			const updatedTask = {
				...task,
				timeEntries: [...(task.timeEntries ?? []), timeEntry],
			};
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		stopTimeTracking: jest.fn(async (task: TaskInfo) => {
			const updatedTask = {
				...task,
				timeEntries: (task.timeEntries ?? []).map((entry) =>
					entry.endTime ? entry : { ...entry, endTime: "2026-05-31T10:30:00.000Z" }
				),
			};
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
	};

	const filterService: TestPluginContext["filterService"] = {
		getGroupedTasks: jest.fn(async () => new Map([["default", Array.from(tasks.values())]])),
	};

	const fileManager: TestPluginContext["fileManager"] = {
		renameFile: jest.fn(async (file: TFile, newPath: string) => {
			files.delete(file.path);
			file.path = newPath;
			files.set(newPath, file);
		}),
	};

	const vault = {
		adapter: {
			exists: jest.fn(async (path: string) => folders.has(path) || files.has(path)),
		},
		createFolder: jest.fn(async (path: string) => {
			folders.add(path);
			return { path };
		}),
		getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null),
	};

	const plugin = {
		app: {
			vault,
			fileManager,
		},
		cacheManager,
		emitter,
		filterService,
		settings: {
			defaultTaskStatus: "open",
			defaultTaskPriority: "normal",
			customStatuses: [
				{ value: "open", isCompleted: false },
				{ value: "done", isCompleted: true },
			],
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		taskService,
	} as unknown as TaskNotesPlugin;

	return {
		plugin,
		tasks,
		files,
		folders,
		emitter,
		taskService,
		filterService,
		cacheManager,
		fileManager,
	};
}

describe("TaskNotesApiV1", () => {
	it("exposes a version and capability discovery for companion plugins", () => {
		const { plugin } = createPluginContext();
		const api = new TaskNotesAPI(plugin);

		expect(api.apiVersion).toBe(1);
		expect(api.capabilities).toContain("tasks.write");
		expect(api.hasCapability("tasks.events")).toBe(true);
		expect(api.hasCapability("missing.capability")).toBe(false);
		expect(typeof api.parseNaturalLanguage).toBe("function");
	});

	it("reads individual tasks and filtered task lists without exposing mutable arrays", async () => {
		const task = createTask({ tags: ["work"] });
		const { plugin, filterService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		const fetched = await api.getTask(task.path);
		expect(fetched).toEqual(task);
		fetched?.tags?.push("mutated");

		const refetched = await api.getTask(task.path);
		expect(refetched?.tags).toEqual(["work"]);

		const query = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [],
		} satisfies FilterQuery;
		filterService.getGroupedTasks.mockResolvedValueOnce(new Map([["work", [task]]]));

		await expect(api.listTasks(query)).resolves.toEqual([task]);
		expect(filterService.getGroupedTasks).toHaveBeenCalledWith(query);
	});

	it("delegates task creation and common task mutations through TaskService", async () => {
		const task = createTask();
		const { plugin, taskService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		const created = await api.createTask({ title: "Created task" });
		expect(created.title).toBe("Created task");
		expect(taskService.createTask).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Created task", creationContext: "api" }),
			{ applyDefaults: true }
		);

		await api.updateTask(task.path, { priority: "high" });
		expect(taskService.updateTask).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			{ priority: "high" }
		);

		await api.completeTask(task.path, { status: "done" } satisfies CompleteTaskOptions);
		expect(taskService.updateProperty).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"status",
			"done"
		);

		await api.rescheduleTask(task.path, "2026-06-01");
		expect(taskService.updateProperty).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"scheduled",
			"2026-06-01"
		);

		await api.archiveTask(task.path, true);
		expect(taskService.toggleArchive).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path })
		);
	});

	it("moves a task note, updates the cache, and emits a task.moved event with context", async () => {
		const task = createTask();
		const { plugin, cacheManager, fileManager, files, folders } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);
		const handler = jest.fn<void, [TaskNotesApiEventPayload]>();

		api.on("task.moved", handler);
		const moved = await api.moveTask(task.path, "Workflow Inbox", {
			source: "tasknotes-workflows",
			correlationId: "run-123",
			reason: "rule matched",
		});

		expect(moved.path).toBe("Workflow Inbox/write-plan.md");
		expect(folders.has("Workflow Inbox")).toBe(true);
		expect(files.has("Workflow Inbox/write-plan.md")).toBe(true);
		expect(fileManager.renameFile).toHaveBeenCalledWith(
			expect.objectContaining({ path: "Workflow Inbox/write-plan.md" }),
			"Workflow Inbox/write-plan.md"
		);
		expect(cacheManager.clearCacheEntry).toHaveBeenCalledWith(task.path);
		expect(cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
			"Workflow Inbox/write-plan.md",
			expect.objectContaining({ path: "Workflow Inbox/write-plan.md" })
		);
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "task.moved",
				taskPath: "Workflow Inbox/write-plan.md",
				source: "tasknotes-workflows",
				correlationId: "run-123",
				reason: "rule matched",
			})
		);
	});

	it("normalizes status and time-tracking events with mutation metadata", async () => {
		const task = createTask();
		const { plugin } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);
		const statusHandler = jest.fn<void, [TaskNotesApiEventPayload]>();
		const timeHandler = jest.fn<void, [TaskNotesApiEventPayload]>();
		const context: TaskNotesMutationContext = {
			source: "tasknotes-workflows",
			correlationId: "run-456",
		};

		api.on("task.status.changed", statusHandler);
		api.on("time.started", timeHandler);

		await api.updateTask(task.path, { status: "active" }, context);
		await api.startTimeEntry(task.path, context);

		expect(statusHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "task.status.changed",
				source: "tasknotes-workflows",
				correlationId: "run-456",
				changes: expect.objectContaining({
					status: { before: "open", after: "active" },
				}),
			})
		);
		expect(timeHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "time.started",
				source: "tasknotes-workflows",
				correlationId: "run-456",
			})
		);
	});

	it("returns active time entries and settings snapshots", async () => {
		const task = createTask({
			timeEntries: [
				{ startTime: "2026-05-31T09:00:00.000Z", endTime: "2026-05-31T09:30:00.000Z" },
				{ startTime: "2026-05-31T10:00:00.000Z" },
			],
		});
		const { plugin } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		await expect(api.getActiveTimeEntries()).resolves.toEqual([
			expect.objectContaining({
				taskPath: task.path,
				index: 1,
				entry: { startTime: "2026-05-31T10:00:00.000Z" },
			}),
		]);

		const snapshot = api.getSettingsSnapshot() as { defaultTaskStatus: string };
		snapshot.defaultTaskStatus = "done";

		expect(plugin.settings.defaultTaskStatus).toBe("open");
	});
});
