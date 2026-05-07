import { afterEach, describe, it, expect, jest } from "@jest/globals";
import { TFile } from "obsidian";

import { AutoArchiveService } from "../../../src/services/AutoArchiveService";
import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { TaskInfo } from "../../../src/types";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	TFile: class MockTFile {
		path: string;

		constructor(path = "") {
			this.path = path;
		}
	},
}));

afterEach(() => {
	jest.restoreAllMocks();
});

const createGoogleCleanupEnabledPlugin = () =>
	PluginFactory.createMockPlugin({
		settings: {
			...PluginFactory.createMockPlugin().settings,
			googleCalendarExport: {
				enabled: true,
				syncOnTaskDelete: true,
			},
		},
	});

const createAutoArchivePlugin = (pluginData: Record<string, any> = {}) => {
	const plugin = PluginFactory.createMockPlugin();
	plugin.statusManager.getStatusConfig = jest.fn((status: string) => {
		if (status === "done") {
			return {
				id: "done",
				value: "done",
				label: "Done",
				color: "#22c55e",
				isCompleted: true,
				order: 2,
				autoArchive: true,
				autoArchiveDelay: 1440,
			};
		}

		return {
			id: status,
			value: status,
			label: status,
			color: "#888888",
			isCompleted: false,
			order: 1,
			autoArchive: false,
			autoArchiveDelay: 1440,
		};
	});
	plugin.loadData = jest.fn().mockImplementation(async () => pluginData);
	plugin.saveData = jest.fn().mockImplementation(async (data: Record<string, any>) => {
		const nextData = { ...data };
		for (const key of Object.keys(pluginData)) {
			delete pluginData[key];
		}
		Object.assign(pluginData, nextData);
	});

	return plugin;
};

describe("Google Calendar archive reliability", () => {
	it("queues externally completed tasks using the completion file timestamp", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createAutoArchivePlugin(pluginData);
		const autoArchiveService = new AutoArchiveService(plugin);
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/external-completed-task.md",
			status: "done",
			completedDate: "2026-05-05",
			dateModified: "2026-05-05T10:41:00.000Z",
		});

		await autoArchiveService.reconcileTask(task);

		const statusChangeTimestamp = Date.parse("2026-05-05T10:41:00.000Z");
		expect(pluginData.autoArchiveQueue).toEqual([
			{
				taskPath: task.path,
				statusChangeTimestamp,
				archiveAfterTimestamp: statusChangeTimestamp + 1440 * 60 * 1000,
				statusValue: "done",
			},
		]);
	});

	it("archives due externally completed tasks after live file reconciliation", async () => {
		const now = Date.parse("2026-05-07T12:00:00.000Z");
		jest.spyOn(Date, "now").mockReturnValue(now);

		const pluginData: Record<string, any> = {};
		const plugin = createAutoArchivePlugin(pluginData);
		const autoArchiveService = new AutoArchiveService(plugin);
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/due-external-task.md",
			status: "done",
			completedDate: "2026-05-05",
			dateModified: "2026-05-05T14:15:00.000Z",
			googleCalendarEventId: "event-id",
		});
		const archivedTask = {
			...task,
			path: "TaskNotes/Archive/due-external-task.md",
			archived: true,
			tags: ["task", "archived"],
		};

		plugin.cacheManager.getTaskInfo = jest.fn().mockResolvedValue(task);
		plugin.cacheManager.getTaskByPath = jest.fn().mockResolvedValue(task);
		plugin.taskService.toggleArchive = jest.fn().mockResolvedValue(archivedTask);
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(false),
			deleteTaskFromCalendar: jest.fn(),
		};

		await autoArchiveService.reconcileTaskByPath(task.path);

		expect(plugin.taskService.toggleArchive).toHaveBeenCalledWith(task);
		expect(pluginData.autoArchiveQueue).toEqual([]);
		expect(plugin.taskCalendarSyncService.deleteTaskFromCalendar).not.toHaveBeenCalled();
	});

	it("does not reset an existing auto-archive timer during file reconciliation", async () => {
		const existingItem = {
			taskPath: "TaskNotes/Tasks/complete-me.md",
			statusChangeTimestamp: 1000,
			archiveAfterTimestamp: 2000,
			statusValue: "done",
		};
		const pluginData: Record<string, any> = {
			autoArchiveQueue: [existingItem],
		};
		const plugin = createAutoArchivePlugin(pluginData);
		const autoArchiveService = new AutoArchiveService(plugin);
		const task = TaskFactory.createTask({
			path: existingItem.taskPath,
			status: "done",
			completedDate: "2026-05-07",
			dateModified: "2026-05-07T12:00:00.000Z",
		});

		await autoArchiveService.reconcileTask(task);

		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(pluginData.autoArchiveQueue).toEqual([existingItem]);
	});

	it("cancels queued auto-archive when external edits move the task out of an auto-archive status", async () => {
		const existingItem = {
			taskPath: "TaskNotes/Tasks/reopened.md",
			statusChangeTimestamp: 1000,
			archiveAfterTimestamp: 2000,
			statusValue: "done",
		};
		const pluginData: Record<string, any> = {
			autoArchiveQueue: [existingItem],
		};
		const plugin = createAutoArchivePlugin(pluginData);
		const autoArchiveService = new AutoArchiveService(plugin);
		const task = TaskFactory.createTask({
			path: existingItem.taskPath,
			status: "open",
		});

		await autoArchiveService.reconcileTask(task);

		expect(pluginData.autoArchiveQueue).toEqual([]);
	});

	it("keeps queued archived linked tasks so calendar cleanup can retry after startup reconciliation", async () => {
		const existingItem = {
			taskPath: "TaskNotes/Archive/archive-me.md",
			statusChangeTimestamp: 1000,
			archiveAfterTimestamp: 2000,
			statusValue: "done",
		};
		const pluginData: Record<string, any> = {
			autoArchiveQueue: [existingItem],
		};
		const plugin = createAutoArchivePlugin(pluginData);
		const autoArchiveService = new AutoArchiveService(plugin);
		const task = TaskFactory.createTask({
			path: existingItem.taskPath,
			status: "done",
			archived: true,
			googleCalendarEventId: "event-id",
		});

		await autoArchiveService.reconcileTask(task);

		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(pluginData.autoArchiveQueue).toEqual([existingItem]);
	});

	it("preserves the Google Calendar event ID when deletion fails so cleanup can be retried", async () => {
		const frontmatter: Record<string, any> = {};
		const pluginData: Record<string, any> = {};
		const plugin: any = {
			settings: {
				googleCalendarExport: {
					enabled: true,
					targetCalendarId: "primary",
					syncOnTaskCreate: true,
					syncOnTaskUpdate: true,
					syncOnTaskComplete: true,
					syncOnTaskDelete: true,
					eventTitleTemplate: "{{title}}",
					includeDescription: false,
					eventColorId: null,
					syncTrigger: "scheduled",
					createAsAllDay: true,
					defaultEventDuration: 60,
					includeObsidianLink: false,
					defaultReminderMinutes: null,
				},
			},
			app: {
				vault: {
					getAbstractFileByPath: jest
						.fn()
						.mockImplementation((path: string) => new TFile(path)),
					getName: jest.fn().mockReturnValue("MyVault"),
				},
				fileManager: {
					processFrontMatter: jest
						.fn()
						.mockImplementation(
							async (_file: TFile, fn: (fm: Record<string, any>) => void) => {
								fn(frontmatter);
							}
						),
				},
			},
			fieldMapper: {
				toUserField: jest.fn((field: string) => field),
			},
			priorityManager: {
				getPriorityConfig: jest.fn().mockReturnValue(null),
			},
			statusManager: {
				getStatusConfig: jest.fn().mockReturnValue(null),
			},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
			cacheManager: {
				getTaskInfo: jest.fn().mockResolvedValue(null),
				getAllTasks: jest.fn().mockResolvedValue([]),
			},
			loadData: jest.fn().mockImplementation(async () => pluginData),
			saveData: jest.fn().mockImplementation(async (data: Record<string, any>) => {
				const nextData = { ...data };
				for (const key of Object.keys(pluginData)) {
					delete pluginData[key];
				}
				Object.assign(pluginData, nextData);
			}),
		};
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest.fn(),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockRejectedValue({ status: 500 }),
		};
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/archive-me.md",
			title: "Archive me",
			status: "done",
			priority: "normal",
			archived: true,
			googleCalendarEventId: "master-event-id",
		};
		frontmatter.googleCalendarEventId = "master-event-id";

		const deleted = await syncService.deleteTaskFromCalendar(task);

		expect(deleted).toBe(false);
		expect(frontmatter.googleCalendarEventId).toBe("master-event-id");
		expect(pluginData.googleCalendarDeletionQueue).toEqual([
			expect.objectContaining({
				calendarId: "primary",
				eventId: "master-event-id",
				taskPath: "TaskNotes/Tasks/archive-me.md",
			}),
		]);
	});

	it("keeps an auto-archive queue item pending when Google cleanup is still incomplete after archiving", async () => {
		const plugin = createGoogleCleanupEnabledPlugin();
		plugin.cacheManager.getTaskByPath = jest.fn();
		plugin.taskService.toggleArchive = jest.fn();
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(true),
			deleteTaskFromCalendar: jest.fn().mockResolvedValue(true),
		};

		const autoArchiveService = new AutoArchiveService(plugin);
		const currentTask: TaskInfo = TaskFactory.createTask({
			path: "TaskNotes/Tasks/archive-me.md",
			status: "done",
			archived: false,
			googleCalendarEventId: "master-event-id",
		});
		// Simulate the state returned from TaskService when archive retries were exhausted
		// and the Google Calendar link was intentionally preserved for later cleanup.
		const archivedTask: TaskInfo = {
			...currentTask,
			archived: true,
			tags: [...(currentTask.tags || []), "archived"],
		};

		plugin.cacheManager.getTaskByPath.mockResolvedValue(currentTask);
		plugin.taskService.toggleArchive.mockResolvedValue(archivedTask);

		const processed = await (autoArchiveService as any).processItem({
			taskPath: currentTask.path,
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		});

		expect(processed).toBe(false);
		expect(plugin.taskService.toggleArchive).toHaveBeenCalledWith(currentTask);
		expect(plugin.taskCalendarSyncService.deleteTaskFromCalendar).not.toHaveBeenCalled();
	});

	it("retries Google cleanup for archived tasks that still have calendar links", async () => {
		const plugin = createGoogleCleanupEnabledPlugin();
		plugin.cacheManager.getTaskByPath = jest.fn();
		plugin.taskService.toggleArchive = jest.fn();
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(true),
			deleteTaskFromCalendar: jest.fn().mockResolvedValue(true),
		};

		const autoArchiveService = new AutoArchiveService(plugin);
		const archivedTask: TaskInfo = TaskFactory.createTask({
			path: "TaskNotes/Archive/archive-me.md",
			status: "done",
			archived: true,
			tags: ["task", "archived"],
			googleCalendarEventId: "master-event-id",
		});

		plugin.cacheManager.getTaskByPath.mockResolvedValue(archivedTask);

		const processed = await (autoArchiveService as any).processItem({
			taskPath: archivedTask.path,
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		});

		expect(processed).toBe(true);
		expect(plugin.taskCalendarSyncService.deleteTaskFromCalendar).toHaveBeenCalledWith(
			archivedTask
		);
		expect(plugin.taskService.toggleArchive).not.toHaveBeenCalled();
	});

	it("persists the archived path in the retry queue when cleanup remains pending after an archive-folder move", async () => {
		const plugin = createGoogleCleanupEnabledPlugin();
		const initialItem = {
			taskPath: "TaskNotes/Tasks/archive-me.md",
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		};
		const pluginData = { autoArchiveQueue: [initialItem] };
		plugin.loadData = jest.fn().mockResolvedValue(pluginData);
		plugin.saveData = jest.fn().mockResolvedValue(undefined);
		plugin.cacheManager.getTaskByPath = jest.fn();
		plugin.taskService.toggleArchive = jest.fn();
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(true),
			deleteTaskFromCalendar: jest.fn().mockResolvedValue(true),
		};

		const autoArchiveService = new AutoArchiveService(plugin);
		const currentTask: TaskInfo = TaskFactory.createTask({
			path: "TaskNotes/Tasks/archive-me.md",
			status: "done",
			archived: false,
			googleCalendarEventId: "master-event-id",
		});
		const archivedTask: TaskInfo = {
			...currentTask,
			path: "TaskNotes/Archive/archive-me.md",
			archived: true,
			tags: ["task", "archived"],
		};

		plugin.cacheManager.getTaskByPath.mockResolvedValue(currentTask);
		plugin.taskService.toggleArchive.mockResolvedValue(archivedTask);

		await (autoArchiveService as any).processQueue();

		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [{ ...initialItem, taskPath: archivedTask.path }],
		});
	});

	it("keeps archived tasks in the retry queue until calendar sync is ready", async () => {
		const plugin = createGoogleCleanupEnabledPlugin();
		const archivedItem = {
			taskPath: "TaskNotes/Archive/archive-me.md",
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		};
		const pluginData = { autoArchiveQueue: [archivedItem] };
		plugin.loadData = jest.fn().mockResolvedValue(pluginData);
		plugin.saveData = jest.fn().mockResolvedValue(undefined);
		plugin.cacheManager.getTaskByPath = jest.fn();
		plugin.taskService.toggleArchive = jest.fn();
		plugin.taskCalendarSyncService = undefined;

		const autoArchiveService = new AutoArchiveService(plugin);
		const archivedTask: TaskInfo = TaskFactory.createTask({
			path: archivedItem.taskPath,
			status: "done",
			archived: true,
			tags: ["task", "archived"],
			googleCalendarEventId: "master-event-id",
		});

		plugin.cacheManager.getTaskByPath.mockResolvedValue(archivedTask);

		await (autoArchiveService as any).processQueue();

		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [archivedItem],
		});
		expect(plugin.taskService.toggleArchive).not.toHaveBeenCalled();
	});

	it("drops archived tasks from the retry queue when Google cleanup is intentionally disabled", async () => {
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				...createGoogleCleanupEnabledPlugin().settings,
				googleCalendarExport: {
					enabled: false,
					syncOnTaskDelete: true,
				},
			},
		});
		const archivedItem = {
			taskPath: "TaskNotes/Archive/archive-me.md",
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		};
		const pluginData = { autoArchiveQueue: [archivedItem] };
		plugin.loadData = jest.fn().mockResolvedValue(pluginData);
		plugin.saveData = jest.fn().mockResolvedValue(undefined);
		plugin.cacheManager.getTaskByPath = jest.fn();
		plugin.taskService.toggleArchive = jest.fn();
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(false),
			deleteTaskFromCalendar: jest.fn().mockResolvedValue(true),
		};

		const autoArchiveService = new AutoArchiveService(plugin);
		const archivedTask: TaskInfo = TaskFactory.createTask({
			path: archivedItem.taskPath,
			status: "done",
			archived: true,
			tags: ["task", "archived"],
			googleCalendarEventId: "master-event-id",
		});

		plugin.cacheManager.getTaskByPath.mockResolvedValue(archivedTask);

		await (autoArchiveService as any).processQueue();

		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [],
		});
		expect(plugin.taskCalendarSyncService.deleteTaskFromCalendar).not.toHaveBeenCalled();
		expect(plugin.taskService.toggleArchive).not.toHaveBeenCalled();
	});

	it("drops newly archived tasks from the retry queue when Google cleanup is intentionally disabled", async () => {
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				...createGoogleCleanupEnabledPlugin().settings,
				googleCalendarExport: {
					enabled: false,
					syncOnTaskDelete: true,
				},
			},
		});
		const initialItem = {
			taskPath: "TaskNotes/Tasks/archive-me.md",
			statusChangeTimestamp: 0,
			archiveAfterTimestamp: 0,
			statusValue: "done",
		};
		const pluginData = { autoArchiveQueue: [initialItem] };
		plugin.loadData = jest.fn().mockResolvedValue(pluginData);
		plugin.saveData = jest.fn().mockResolvedValue(undefined);
		plugin.cacheManager.getTaskByPath = jest.fn();
		plugin.taskService.toggleArchive = jest.fn();
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(false),
			deleteTaskFromCalendar: jest.fn().mockResolvedValue(true),
		};

		const autoArchiveService = new AutoArchiveService(plugin);
		const currentTask: TaskInfo = TaskFactory.createTask({
			path: initialItem.taskPath,
			status: "done",
			archived: false,
			googleCalendarEventId: "master-event-id",
		});
		const archivedTask: TaskInfo = {
			...currentTask,
			path: "TaskNotes/Archive/archive-me.md",
			archived: true,
			tags: ["task", "archived"],
		};

		plugin.cacheManager.getTaskByPath.mockResolvedValue(currentTask);
		plugin.taskService.toggleArchive.mockResolvedValue(archivedTask);

		await (autoArchiveService as any).processQueue();

		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [],
		});
		expect(plugin.taskService.toggleArchive).toHaveBeenCalledWith(currentTask);
		expect(plugin.taskCalendarSyncService.deleteTaskFromCalendar).not.toHaveBeenCalled();
	});
});
