import { describe, it, expect, jest } from "@jest/globals";
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

describe("Google Calendar archive reliability", () => {
	it("preserves the Google Calendar event ID when deletion fails so cleanup can be retried", async () => {
		const frontmatter: Record<string, any> = {};
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
