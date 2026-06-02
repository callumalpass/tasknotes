import { TFile } from "obsidian";
import {
	TaskNotesAPI,
	type CompleteTaskOptions,
	type TaskNotesApiEventPayload,
	type TaskNotesMutationContext,
	type TaskNotesTaskPatch,
} from "../../../src/api/TaskNotesAPI";
import type TaskNotesPlugin from "../../../src/main";
import type {
	FilterQuery,
	PomodoroHistoryStats,
	PomodoroSessionHistory,
	PomodoroState,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TimeEntry,
} from "../../../src/types";
import { EVENT_POMODORO_START, EVENT_TASK_DELETED, EVENT_TASK_UPDATED } from "../../../src/types";

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
		deleteTask: jest.Mock<Promise<void>, [TaskInfo]>;
		deleteTimeEntry: jest.Mock<Promise<TaskInfo>, [TaskInfo, number]>;
		toggleRecurringTaskComplete: jest.Mock<Promise<TaskInfo>, [TaskInfo, Date?]>;
		toggleRecurringTaskCompleteWithOccurrenceNotes: jest.Mock<
			Promise<TaskInfo>,
			[TaskInfo, Date?]
		>;
		toggleRecurringTaskSkipped: jest.Mock<Promise<TaskInfo>, [TaskInfo, Date?]>;
		materializeOccurrence: jest.Mock<Promise<TaskInfo>, [TaskInfo, string | Date]>;
	};
	filterService: {
		getGroupedTasks: jest.Mock<Promise<Map<string, TaskInfo[]>>, [FilterQuery]>;
		getFilterOptions: jest.Mock<Promise<unknown>, []>;
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
	pomodoroService: {
		getState: jest.Mock<PomodoroState, []>;
		startPomodoro: jest.Mock<Promise<void>, [TaskInfo?, number?]>;
		stopPomodoro: jest.Mock<Promise<void>, []>;
		pausePomodoro: jest.Mock<Promise<void>, []>;
		resumePomodoro: jest.Mock<Promise<void>, []>;
		assignTaskToCurrentSession: jest.Mock<Promise<void>, [TaskInfo?]>;
		getSessionHistory: jest.Mock<Promise<PomodoroSessionHistory[]>, []>;
		getStatsForDate: jest.Mock<Promise<PomodoroHistoryStats>, [Date]>;
		getTodayStats: jest.Mock<Promise<PomodoroHistoryStats>, []>;
	};
	taskStatsService: {
		getStats: jest.Mock;
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
		deleteTask: jest.fn(async (task: TaskInfo) => {
			tasks.delete(task.path);
			files.delete(task.path);
			emitter.trigger(EVENT_TASK_DELETED, {
				path: task.path,
				deletedTask: task,
			});
		}),
		deleteTimeEntry: jest.fn(async (task: TaskInfo, entryIndex: number) => {
			const updatedTask = {
				...task,
				timeEntries: (task.timeEntries ?? []).filter((_, index) => index !== entryIndex),
			};
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		toggleRecurringTaskComplete: jest.fn(async (task: TaskInfo) => {
			const updatedTask = {
				...task,
				complete_instances: [...(task.complete_instances ?? []), "2026-06-01"],
			};
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		toggleRecurringTaskCompleteWithOccurrenceNotes: jest.fn(async (task: TaskInfo) => {
			const updatedTask = {
				...task,
				complete_instances: [...(task.complete_instances ?? []), "2026-06-01"],
			};
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		toggleRecurringTaskSkipped: jest.fn(async (task: TaskInfo) => {
			const updatedTask = {
				...task,
				skipped_instances: [...(task.skipped_instances ?? []), "2026-06-01"],
			};
			tasks.set(updatedTask.path, updatedTask);
			emitTaskUpdate(task, updatedTask);
			return updatedTask;
		}),
		materializeOccurrence: jest.fn(async (task: TaskInfo, date: string | Date) => {
			const occurrenceDate = typeof date === "string" ? date : date.toISOString().slice(0, 10);
			const occurrence = createTask({
				title: task.title,
				path: `Tasks/${task.title}-${occurrenceDate}.md`,
				recurrence_parent: `[[${task.path.replace(/\.md$/i, "")}]]`,
				occurrence_date: occurrenceDate,
			});
			tasks.set(occurrence.path, occurrence);
			files.set(occurrence.path, new TFile(occurrence.path));
			emitTaskUpdate(undefined, occurrence);
			return occurrence;
		}),
	};

	const filterService: TestPluginContext["filterService"] = {
		getGroupedTasks: jest.fn(async () => new Map([["default", Array.from(tasks.values())]])),
		getFilterOptions: jest.fn(async () => ({
			statuses: [],
			priorities: [],
			contexts: [],
			projects: [],
			tags: [],
			folders: [],
		})),
	};

	const fileManager: TestPluginContext["fileManager"] = {
		renameFile: jest.fn(async (file: TFile, newPath: string) => {
			files.delete(file.path);
			file.path = newPath;
			files.set(newPath, file);
		}),
	};

	const pomodoroState: PomodoroState = {
		isRunning: false,
		timeRemaining: 1500,
	};
	const pomodoroService: TestPluginContext["pomodoroService"] = {
		getState: jest.fn(() => pomodoroState),
		startPomodoro: jest.fn(async (task?: TaskInfo, duration?: number) => {
			pomodoroState.isRunning = true;
			pomodoroState.currentSession = {
				id: "pomodoro-1",
				taskPath: task?.path,
				startTime: "2026-05-31T10:00:00.000Z",
				plannedDuration: duration ?? 25,
				type: "work",
				completed: false,
				activePeriods: [{ startTime: "2026-05-31T10:00:00.000Z" }],
			};
			emitter.trigger(EVENT_POMODORO_START, {
				session: pomodoroState.currentSession,
				task,
			});
		}),
		stopPomodoro: jest.fn(async () => {
			pomodoroState.isRunning = false;
			pomodoroState.currentSession = undefined;
		}),
		pausePomodoro: jest.fn(async () => {
			pomodoroState.isRunning = false;
		}),
		resumePomodoro: jest.fn(async () => {
			pomodoroState.isRunning = true;
		}),
		assignTaskToCurrentSession: jest.fn(async (task?: TaskInfo) => {
			if (pomodoroState.currentSession) {
				pomodoroState.currentSession.taskPath = task?.path;
			}
		}),
		getSessionHistory: jest.fn(async () => [
			{
				id: "pomodoro-history-1",
				startTime: "2026-05-31T09:00:00.000Z",
				endTime: "2026-05-31T09:25:00.000Z",
				plannedDuration: 25,
				type: "work",
				completed: true,
				activePeriods: [{ startTime: "2026-05-31T09:00:00.000Z" }],
			},
		]),
		getStatsForDate: jest.fn(async () => ({
			pomodorosCompleted: 1,
			currentStreak: 1,
			totalMinutes: 25,
			averageSessionLength: 25,
			completionRate: 100,
		})),
		getTodayStats: jest.fn(async () => ({
			pomodorosCompleted: 1,
			currentStreak: 1,
			totalMinutes: 25,
			averageSessionLength: 25,
			completionRate: 100,
		})),
	};

	const taskStatsService: TestPluginContext["taskStatsService"] = {
		getStats: jest.fn((statsTasks: TaskInfo[]) => ({
			total: statsTasks.length,
			statusCounts: { open: statsTasks.filter((task) => task.status === "open").length },
			priorityCounts: {
				normal: statsTasks.filter((task) => task.priority === "normal").length,
			},
			completed: statsTasks.filter((task) => task.status === "done").length,
			active: statsTasks.filter((task) => task.status !== "done" && !task.archived).length,
			overdue: 0,
			archived: statsTasks.filter((task) => task.archived).length,
			withTimeEntries: statsTasks.filter((task) => task.timeEntries?.length).length,
			totalTrackedMinutes: statsTasks.reduce(
				(total, task) => total + (task.totalTrackedTime ?? 0),
				0
			),
			totalTrackedHours: 0,
		})),
	};

	const vault = {
		getName: jest.fn(() => "Test Vault"),
		adapter: {
			basePath: "/tmp/test-vault",
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
		taskStatsService,
		settings: {
			defaultTaskStatus: "open",
			defaultTaskPriority: "normal",
			taskTag: "task",
			customStatuses: [
				{
					id: "open",
					value: "open",
					label: "Open",
					color: "#888888",
					isCompleted: false,
					order: 0,
					autoArchive: false,
					autoArchiveDelay: 0,
				},
				{
					id: "done",
					value: "done",
					label: "Done",
					color: "#00aa00",
					isCompleted: true,
					order: 1,
					autoArchive: false,
					autoArchiveDelay: 0,
				},
			],
			customPriorities: [
				{ id: "normal", value: "normal", label: "Normal", color: "#888888", weight: 0 },
				{ id: "high", value: "high", label: "High", color: "#ff0000", weight: 10 },
			],
			userFields: [{ id: "energy", displayName: "Energy", key: "energy", type: "number" }],
			fieldMapping: {
				title: "title",
				status: "status",
				priority: "priority",
				due: "due",
				scheduled: "scheduled",
				contexts: "contexts",
				projects: "projects",
				timeEstimate: "timeEstimate",
				completedDate: "completedDate",
				dateCreated: "dateCreated",
				dateModified: "dateModified",
				recurrence: "recurrence",
				recurrenceAnchor: "recurrence_anchor",
				recurrenceParent: "recurrence_parent",
				occurrenceDate: "occurrence_date",
				occurrenceMaterialization: "occurrence_materialization",
				occurrenceNextTrigger: "occurrence_next_trigger",
				occurrenceTemplate: "occurrence_template",
				occurrencePastHorizon: "occurrence_past_horizon",
				occurrenceFutureHorizon: "occurrence_future_horizon",
				archiveTag: "archived",
				timeEntries: "timeEntries",
				completeInstances: "complete_instances",
				skippedInstances: "skipped_instances",
				blockedBy: "blockedBy",
				pomodoros: "pomodoros",
				icsEventId: "icsEventId",
				icsEventTag: "ics-event",
				googleCalendarEventId: "googleCalendarEventId",
				googleCalendarExceptionEventId: "googleCalendarExceptionEventId",
				googleCalendarExceptionOriginalScheduled:
					"googleCalendarExceptionOriginalScheduled",
				googleCalendarMovedOriginalDates: "googleCalendarMovedOriginalDates",
				reminders: "reminders",
				sortOrder: "sortOrder",
			},
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		taskService,
		pomodoroService,
		onReady: jest.fn(async () => undefined),
		initializationComplete: true,
		getActiveTimeSession: jest.fn(
			(task: TaskInfo) => (task.timeEntries ?? []).find((entry) => !entry.endTime) ?? null
		),
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
		pomodoroService,
		taskStatsService,
	};
}

describe("TaskNotesApiV1", () => {
	it("exposes a version and capability discovery for companion plugins", () => {
		const { plugin } = createPluginContext();
		const api = new TaskNotesAPI(plugin);

		expect(api.apiVersion).toBe(1);
		expect(api.capabilities).toContain("tasks.write");
		expect(api.capabilities).toContain("pomodoro.events");
		expect(api.capabilities).toContain("events.list");
		expect(api.capabilities).toContain("extensions.register");
		expect(api.capabilities).toContain("relationships.read");
		expect(api.capabilities).toContain("recurring.materialize");
		expect(api.capabilities).toContain("model.validate");
		expect(api.capabilities).toContain("query.tasks");
		expect(api.capabilities).toContain("query.validate");
		expect(api.capabilities).toContain("query.explain");
		expect(api.capabilities).toContain("system.health");
		expect(api.capabilities).toContain("lifecycle.events");
		expect(api.capabilities).toContain("errors.typed");
		expect(api.hasCapability("tasks.events")).toBe(true);
		expect(api.hasCapability("missing.capability")).toBe(false);
		expect(typeof api.model.config).toBe("function");
		expect(typeof api.parseNaturalLanguage).toBe("function");
		expect(typeof api.tasks.update).toBe("function");
		expect(typeof api.relationships.subtasks).toBe("function");
		expect(typeof api.time.start).toBe("function");
		expect(typeof api.pomodoro.start).toBe("function");
		expect(typeof api.recurring.materializeOccurrence).toBe("function");
		expect(typeof api.events.on).toBe("function");
		expect(typeof api.events.list).toBe("function");
		expect(typeof api.errors.toResult).toBe("function");
		expect(typeof api.extensions.register).toBe("function");
	});

	it("exposes model metadata, config, and validation backed by @tasknotes/model", () => {
		const { plugin } = createPluginContext();
		const api = new TaskNotesAPI(plugin);

		expect(api.model.info()).toEqual({
			packageName: "@tasknotes/model",
			specVersion: expect.any(String),
			runtimeApiVersion: 1,
		});
		expect(api.model.config()).toEqual(
			expect.objectContaining({
				defaults: expect.objectContaining({ status: "open", priority: "normal" }),
				statuses: expect.arrayContaining([
					expect.objectContaining({ value: "open", isCompleted: false }),
				]),
			})
		);

		expect(api.model.validateTask(createTask()).valid).toBe(true);
		expect(api.model.validatePatch({ timeEntries: "invalid" as never })).toEqual(
			expect.objectContaining({
				valid: false,
				issues: expect.arrayContaining([
					expect.objectContaining({ code: "schema_invalid" }),
				]),
			})
		);
	});

	it("exposes catalog metadata for companion plugin editors", () => {
		const { plugin } = createPluginContext();
		const api = new TaskNotesAPI(plugin);

		expect(api.catalog.statuses()).toEqual([
			expect.objectContaining({ value: "open", label: "Open" }),
			expect.objectContaining({ value: "done", label: "Done" }),
		]);
		expect(api.catalog.priorities()).toEqual([
			expect.objectContaining({ value: "normal", label: "Normal" }),
			expect.objectContaining({ value: "high", label: "High" }),
		]);
		expect(api.catalog.fields()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "status",
					frontmatterKey: "status",
					writable: true,
				}),
				expect.objectContaining({
					id: "user:energy",
					frontmatterKey: "energy",
					valueType: "number",
				}),
			])
		);
		expect(api.catalog.writableFields().some((field) => field.id === "path")).toBe(false);
		expect(api.catalog.filterProperties()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "task.status",
					aliases: expect.arrayContaining(["status"]),
					queryable: true,
					supportedOperators: expect.arrayContaining(["eq", "ne"]),
				}),
				expect.objectContaining({
					id: "user.energy",
					frontmatterKey: "energy",
					sortable: true,
				}),
			])
		);
		expect(api.catalog.filterOperators()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "eq",
					valueRequired: true,
					aliases: expect.arrayContaining(["is"]),
				}),
			])
		);
		expect(api.catalog.relationships()).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: "dependencies" })])
		);
		expect(api.catalog.dependencyRelTypes()).toEqual(
			expect.arrayContaining([expect.objectContaining({ value: "FINISHTOSTART" })])
		);
	});

	it("lists runtime event definitions for companion plugin UIs", () => {
		const { plugin } = createPluginContext();
		const api = new TaskNotesAPI(plugin);

		const events = api.events.list();
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "task.status.changed",
					label: "Task status changed",
					category: "task",
				}),
				expect.objectContaining({
					name: "time.started",
					label: "Time tracking started",
					category: "time",
				}),
				expect.objectContaining({
					name: "pomodoro.started",
					label: "Pomodoro started",
					category: "pomodoro",
				}),
			])
		);

		const first = events[0] as { label: string };
		first.label = "Mutated";

		expect(api.events.list()[0]?.label).not.toBe("Mutated");
	});

	it("lets companion plugins register extension namespaces and capabilities", () => {
		const { plugin } = createPluginContext();
		const api = new TaskNotesAPI(plugin);
		const workflowsApi = {
			run: jest.fn(),
		};

		const handle = api.extensions.register({
			id: "tasknotes-workflows",
			namespace: "tasknotes-workflows",
			displayName: "TaskNotes Workflows",
			version: "0.1.0",
			capabilities: ["tasknotes-workflows.run"],
			api: workflowsApi,
		});

		expect(api.extensions.get<typeof workflowsApi>("tasknotes-workflows")).toBe(workflowsApi);
		expect(api.extensions.require<typeof workflowsApi>("tasknotes-workflows").run).toBe(
			workflowsApi.run
		);
		expect(api.extensions.has("tasknotes-workflows")).toBe(true);
		expect(api.extensions.list()).toEqual([
			{
				id: "tasknotes-workflows",
				namespace: "tasknotes-workflows",
				displayName: "TaskNotes Workflows",
				version: "0.1.0",
				capabilities: ["tasknotes-workflows.run"],
			},
		]);
		expect(api.extensions.capabilities()).toEqual(["tasknotes-workflows.run"]);
		expect(api.capabilities).toContain("tasknotes-workflows.run");
		expect(api.hasCapability("tasknotes-workflows.run")).toBe(true);
		expect(() =>
			api.extensions.register({
				id: "duplicate",
				namespace: "tasknotes-workflows",
				api: {},
			})
		).toThrow(/already registered/);
		expect(() =>
			api.extensions.register({
				id: "reserved",
				namespace: "tasks",
				api: {},
			})
		).toThrow(/Cannot register/);

		handle.unregister();
		expect(api.extensions.get("tasknotes-workflows")).toBeUndefined();
		expect(api.hasCapability("tasknotes-workflows.run")).toBe(false);
		handle.unregister();
	});

	it("exposes lifecycle events for companion plugin coordination", async () => {
		const { plugin, emitter } = createPluginContext();
		const api = new TaskNotesAPI(plugin);
		const readyHandler = jest.fn();
		const settingsHandler = jest.fn();
		const extensionHandler = jest.fn();

		api.lifecycle.on("ready", readyHandler);
		api.lifecycle.on("settings.changed", settingsHandler);
		api.lifecycle.on("extension.registered", extensionHandler);

		await api.lifecycle.ready();
		await Promise.resolve();
		emitter.trigger("settings-changed", { defaultTaskStatus: "open" });
		api.extensions.register({
			id: "lifecycle-test",
			namespace: "lifecycle-test",
			api: {},
		});

		expect(api.lifecycle.isReady()).toBe(true);
		expect(api.lifecycle.list()).toEqual(
			expect.arrayContaining([expect.objectContaining({ name: "settings.changed" })])
		);
		expect(readyHandler).toHaveBeenCalledWith(
			expect.objectContaining({ event: "ready", rawEvent: "tasknotes:runtime.ready" })
		);
		expect(settingsHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "settings.changed",
				rawEvent: "settings-changed",
				settings: expect.objectContaining({ defaultTaskStatus: "open" }),
			})
		);
		expect(extensionHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "extension.registered",
				extension: expect.objectContaining({ namespace: "lifecycle-test" }),
			})
		);
	});

	it("normalizes API failures into typed error payloads", async () => {
		const task = createTask();
		const { plugin } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		const missingTask = await api.errors.toResult(() =>
			api.tasks.update("Tasks/missing.md", { status: "done" })
		);
		const invalidStatus = await api.errors.toResult(() =>
			api.tasks.complete(task.path, { status: "open" })
		);
		const missingExtension = await api.errors.toResult(() =>
			api.extensions.require("missing-extension")
		);
		const genericError = api.errors.normalize(new Error("Unexpected failure"));
		const structuralPayload = {
			name: "TaskNotesApiError" as const,
			code: "task_not_found" as const,
			message: "Missing",
			status: 404,
		};

		expect(missingTask.ok).toBe(false);
		if (!missingTask.ok) {
			expect(missingTask.error).toEqual(
				expect.objectContaining({
					name: "TaskNotesApiError",
					code: "task_not_found",
					status: 404,
					details: { path: "Tasks/missing.md" },
				})
			);
		}

		expect(invalidStatus.ok).toBe(false);
		if (!invalidStatus.ok) {
			expect(invalidStatus.error).toEqual(
				expect.objectContaining({
					code: "invalid_status",
					status: 400,
					details: { status: "open" },
				})
			);
		}

		expect(missingExtension.ok).toBe(false);
		if (!missingExtension.ok) {
			expect(missingExtension.error).toEqual(
				expect.objectContaining({
					code: "extension_not_registered",
					status: 404,
					details: { namespace: "missing-extension" },
				})
			);
		}

		expect(genericError).toEqual(
			expect.objectContaining({
				code: "operation_failed",
				status: 500,
				message: "Unexpected failure",
			})
		);
		expect(api.errors.isApiError(structuralPayload)).toBe(true);
		expect(api.errors.normalize(structuralPayload)).toBe(structuralPayload);
	});

	it("reads individual tasks and queried task lists without exposing mutable arrays", async () => {
		const task = createTask({ tags: ["work"] });
		const { plugin, filterService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		const fetched = await api.getTask(task.path);
		expect(fetched).toEqual(task);
		fetched?.tags?.push("mutated");

		const refetched = await api.getTask(task.path);
		expect(refetched?.tags).toEqual(["work"]);

		const query = { where: { field: "task.tags", op: "contains", value: "work" } };
		filterService.getGroupedTasks.mockResolvedValueOnce(new Map([["work", [task]]]));

		await expect(api.listTasks(query)).resolves.toEqual([task]);
		expect(filterService.getGroupedTasks).toHaveBeenCalledWith(
			expect.objectContaining({
				children: [
					expect.objectContaining({
						property: "tags",
						operator: "contains",
						value: "work",
					}),
				],
			})
		);
	});

	it("exposes query, stats, time summary, task time data, and health helpers", async () => {
		const task = createTask({
			timeEntries: [
				{
					startTime: "2026-05-31T09:00:00.000Z",
					endTime: "2026-05-31T09:30:00.000Z",
				},
			],
			totalTrackedTime: 30,
		});
		const { plugin, filterService, taskStatsService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);
		const query = {
			where: { field: "task.status", op: "eq", value: "open" },
			sort: [{ field: "task.due", direction: "asc" }],
			group: [{ field: "task.status" }],
			limit: 10,
			scope: { includeArchived: false, folders: ["Tasks"] },
		};

		await expect(api.query.tasks(query)).resolves.toEqual(
			expect.objectContaining({
				total: 1,
				matched: 1,
				returned: 1,
				tasks: [expect.objectContaining({ path: task.path })],
				groups: [{ key: "default", label: "default", taskPaths: [task.path] }],
				query: expect.objectContaining({
					where: { field: "task.status", op: "eq", value: "open" },
					sort: [{ field: "task.due", direction: "asc" }],
					group: [{ field: "task.status" }],
					limit: 10,
					offset: 0,
					scope: { includeArchived: false, folders: ["Tasks"] },
				}),
			})
		);
		expect(filterService.getGroupedTasks).toHaveBeenCalledWith(
			expect.objectContaining({
				sortKey: "due",
				groupKey: "status",
				children: [
					expect.objectContaining({
						property: "status",
						operator: "is",
						value: "open",
					}),
				],
			})
		);
		expect(api.query.validate(query)).toEqual(
			expect.objectContaining({
				valid: true,
				normalized: expect.objectContaining({
					where: { field: "task.status", op: "eq", value: "open" },
				}),
			})
		);
		await expect(api.query.explain(query)).resolves.toEqual(
			expect.objectContaining({
				valid: true,
				total: 1,
				matched: 1,
				returned: 1,
				appliedSort: [{ field: "task.due", direction: "asc" }],
			})
		);
		expect(api.query.validate({ where: { field: "missing", op: "eq", value: "x" } })).toEqual(
			expect.objectContaining({
				valid: false,
				issues: [expect.objectContaining({ code: "field_unknown" })],
			})
		);
		await expect(api.query.filterOptions()).resolves.toEqual(
			expect.objectContaining({ statuses: [] })
		);
		await expect(api.stats.tasks()).resolves.toEqual(
			expect.objectContaining({ total: 1, withTimeEntries: 1 })
		);
		await expect(api.time.summary({ period: "all" })).resolves.toEqual(
			expect.objectContaining({
				summary: expect.objectContaining({ totalMinutes: 30 }),
			})
		);
		await expect(api.time.task(task.path)).resolves.toEqual(
			expect.objectContaining({
				task: expect.objectContaining({ id: task.path }),
				summary: expect.objectContaining({ totalMinutes: 30 }),
			})
		);
		await expect(api.system.health()).resolves.toEqual(
			expect.objectContaining({
				status: "ok",
				apiVersion: 1,
				vault: { name: "Test Vault", path: "/tmp/test-vault" },
				tasks: { total: 1 },
			})
		);

		expect(filterService.getFilterOptions).toHaveBeenCalled();
		expect(taskStatsService.getStats).toHaveBeenCalled();
	});

	it("resolves task relationships through projects and dependencies", async () => {
		const parent = createTask({
			title: "Parent",
			path: "Projects/project.md",
		});
		const blocker = createTask({
			title: "Blocker",
			path: "Tasks/blocker.md",
		});
		const child = createTask({
			title: "Child",
			path: "Tasks/child.md",
			projects: ["[[Projects/project]]"],
			blockedBy: [{ uid: "[[Tasks/blocker]]", reltype: "FINISHTOSTART" }],
		});
		const { plugin } = createPluginContext([parent, blocker, child]);
		const api = new TaskNotesAPI(plugin);

		await expect(api.relationships.parents(child.path)).resolves.toEqual([
			expect.objectContaining({ path: parent.path }),
		]);
		await expect(api.relationships.subtasks(parent.path)).resolves.toEqual([
			expect.objectContaining({ path: child.path }),
		]);
		await expect(api.relationships.dependencies(child.path)).resolves.toEqual([
			expect.objectContaining({
				path: blocker.path,
				task: expect.objectContaining({ path: blocker.path }),
				dependency: { uid: "[[Tasks/blocker]]", reltype: "FINISHTOSTART" },
			}),
		]);
		await expect(api.relationships.blocking(blocker.path)).resolves.toEqual([
			expect.objectContaining({ path: child.path }),
		]);

		const relationships = await api.relationships.all(child.path);
		expect(relationships.task.path).toBe(child.path);
		expect(relationships.parents[0]?.path).toBe(parent.path);
		expect(relationships.dependencies[0]?.task?.path).toBe(blocker.path);
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

	it("exposes a namespaced task API for common workflow mutations", async () => {
		const dependency: TaskDependency = { uid: "[[Tasks/blocker]]", reltype: "FINISHTOSTART" };
		const task = createTask({ tags: ["work"], projects: ["Project A"], contexts: ["office"] });
		const { plugin, taskService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		await api.tasks.addTag(task.path, "urgent");
		await api.tasks.removeProject(task.path, "Project A");
		await api.tasks.addContext(task.path, "deep-work");
		await api.tasks.setDue(task.path, "2026-06-02");
		await api.tasks.clearDue(task.path);
		await api.tasks.addDependency(task.path, dependency);
		await api.tasks.addReminder(task.path, {
			id: "reminder-1",
			type: "absolute",
			absoluteTime: "2026-06-01T09:00:00.000Z",
		});
		await api.tasks.delete(task.path);

		expect(taskService.updateTask).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			expect.objectContaining({ tags: ["work", "urgent"] })
		);
		expect(taskService.updateProperty).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"due",
			"2026-06-02"
		);
		expect(taskService.updateProperty).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"due",
			undefined
		);
		expect(taskService.updateTask).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			expect.objectContaining({ blockedBy: [dependency] })
		);
		expect(taskService.deleteTask).toHaveBeenCalledWith(
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

	it("returns updated tasks from the namespaced time API", async () => {
		const task = createTask({
			timeEntries: [{ startTime: "2026-05-31T09:00:00.000Z" }],
		});
		const { plugin, taskService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		const started = await api.time.start(task.path, { description: "Planning" });
		expect(started.timeEntries?.[1]?.description).toBe("Planning");

		await api.time.deleteEntry(task.path, 0);
		expect(taskService.deleteTimeEntry).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			0
		);
	});

	it("normalizes recurring instance and pomodoro events", async () => {
		const task = createTask({ recurrence: "FREQ=DAILY" });
		const { plugin, pomodoroService, taskService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);
		const recurringHandler = jest.fn<void, [TaskNotesApiEventPayload]>();
		const pomodoroHandler = jest.fn<void, [TaskNotesApiEventPayload]>();

		api.events.on("recurring.instance.completed", recurringHandler);
		api.events.on("pomodoro.started", pomodoroHandler);

		await api.recurring.toggleCompleteInstance(task.path, "2026-06-01", {
			source: "tasknotes-workflows",
			correlationId: "run-recurring",
		});
		await api.pomodoro.start(
			{ taskPath: task.path, duration: 10 },
			{ source: "tasknotes-workflows", correlationId: "run-pomodoro" }
		);

		expect(taskService.toggleRecurringTaskCompleteWithOccurrenceNotes).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			new Date("2026-06-01")
		);
		expect(recurringHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "recurring.instance.completed",
				source: "tasknotes-workflows",
				correlationId: "run-recurring",
			})
		);
		expect(pomodoroService.startPomodoro).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			10
		);
		expect(pomodoroHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "pomodoro.started",
				taskPath: task.path,
				source: "tasknotes-workflows",
				correlationId: "run-pomodoro",
			})
		);
	});

	it("materializes recurring occurrences from the runtime API", async () => {
		const task = createTask({
			title: "Weekly review",
			path: "Tasks/weekly-review.md",
			recurrence: "DTSTART:20260601;FREQ=WEEKLY",
		});
		const { plugin, taskService } = createPluginContext([task]);
		const api = new TaskNotesAPI(plugin);

		const occurrence = await api.recurring.materializeOccurrence(
			task.path,
			"2026-06-08",
			{
				source: "tasknotes-workflows",
				correlationId: "run-materialize",
			}
		);

		expect(taskService.materializeOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path }),
			"2026-06-08"
		);
		expect(occurrence).toMatchObject({
			title: "Weekly review",
			recurrence_parent: "[[Tasks/weekly-review]]",
			occurrence_date: "2026-06-08",
		});
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
