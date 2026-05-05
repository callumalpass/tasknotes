import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

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

const createPlugin = (
	tasks: TaskInfo[],
	pluginData: Record<string, any> = {},
	calendarSettings: Record<string, any> = {}
) => {
	const basePlugin = PluginFactory.createMockPlugin();
	const plugin = PluginFactory.createMockPlugin({
		settings: {
			...basePlugin.settings,
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
				...calendarSettings,
			},
		},
	});

	plugin.cacheManager.getAllTasks = jest.fn().mockResolvedValue(tasks);
	plugin.cacheManager.getTaskInfo = jest.fn().mockImplementation(async (path: string) => {
		return tasks.find((task) => task.path === path) || null;
	});
	plugin.loadData = jest.fn().mockImplementation(async () => pluginData);
	plugin.saveData = jest.fn().mockImplementation(async (data: Record<string, any>) => {
		const nextData = { ...data };
		for (const key of Object.keys(pluginData)) {
			delete pluginData[key];
		}
		Object.assign(pluginData, nextData);
	});
	plugin.statusManager = {
		...plugin.statusManager,
		getStatusConfig: jest.fn().mockReturnValue(null),
	};
	plugin.priorityManager = {
		...plugin.priorityManager,
		getPriorityConfig: jest.fn().mockReturnValue(null),
	};

	return plugin;
};

const createGoogleCalendarService = (overrides: Record<string, any> = {}) => ({
	getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
	createEvent: jest.fn().mockResolvedValue({ id: "google-primary-created-event-id" }),
	updateEvent: jest.fn().mockResolvedValue({}),
	deleteEvent: jest.fn().mockResolvedValue(undefined),
	...overrides,
});

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("Google Calendar external file reconciliation", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("creates an event for an externally created eligible task while Obsidian is running", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/new-external.md",
			title: "New external task",
			scheduled: "2026-05-05T09:00:00",
		});
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin([task], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.handleExternalTaskFileUpdated(task.path);

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);
		expect(pluginData.googleCalendarTaskFingerprints?.[task.path]).toBeDefined();
	});

	it("baselines existing unlinked tasks on startup without creating events", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/existing-unlinked.md",
			title: "Existing unlinked task",
			scheduled: "2026-05-05",
		});
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin([task], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.initializeExternalFileReconciliation();

		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarTaskFingerprints?.[task.path]).toBeDefined();
	});

	it("updates linked tasks that changed while Obsidian was closed", async () => {
		const oldTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/offline-linked.md",
			title: "Offline linked task",
			scheduled: "2026-05-05",
			googleCalendarEventId: "event-1",
		});
		const updatedTask = {
			...oldTask,
			scheduled: "2026-05-06",
		};
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin([updatedTask], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[oldTask.path]: (syncService as any).getCalendarRelevantFingerprint(oldTask),
		};

		await syncService.initializeExternalFileReconciliation();

		expect(googleCalendarService.updateEvent).toHaveBeenCalledTimes(1);
		expect(pluginData.googleCalendarTaskFingerprints?.[updatedTask.path]).toBe(
			(syncService as any).getCalendarRelevantFingerprint(updatedTask)
		);
	});

	it("clears Google recurrence when a linked recurring task was made non-recurring while Obsidian was closed", async () => {
		const oldTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/offline-recurring.md",
			title: "Offline recurring task",
			scheduled: "2026-05-05",
			recurrence: "FREQ=DAILY",
			recurrence_anchor: "scheduled",
			googleCalendarEventId: "event-1",
		});
		const updatedTask = {
			...oldTask,
			recurrence: undefined,
		};
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin([updatedTask], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[oldTask.path]: (syncService as any).getCalendarRelevantFingerprint(oldTask),
		};

		await syncService.initializeExternalFileReconciliation();

		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"event-1",
			expect.objectContaining({ recurrence: [] })
		);
	});

	it("does not call Google for non-calendar-relevant file updates", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/body-only.md",
			title: "Body only",
			scheduled: "2026-05-05",
			googleCalendarEventId: "event-1",
		});
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin([task], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[task.path]: (syncService as any).getCalendarRelevantFingerprint(task),
		};

		await syncService.handleExternalTaskFileUpdated(task.path);

		expect(googleCalendarService.updateEvent).not.toHaveBeenCalled();
		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(googleCalendarService.deleteEvent).not.toHaveBeenCalled();
	});

	it("deletes linked task events when an external edit makes the task ineligible", async () => {
		const oldTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/unscheduled-linked.md",
			title: "Unscheduled linked",
			scheduled: "2026-05-05",
			googleCalendarEventId: "event-1",
		});
		const updatedTask = {
			...oldTask,
			scheduled: undefined,
		};
		const pluginData: Record<string, any> = {
			googleCalendarTaskFingerprints: {},
		};
		const plugin = createPlugin([updatedTask], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints[oldTask.path] =
			(syncService as any).getCalendarRelevantFingerprint(oldTask);

		const update = syncService.handleExternalTaskFileUpdated(updatedTask.path);
		await flushPromises();
		jest.advanceTimersByTime(500);
		await update;
		await flushPromises();

		expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith("primary", "event-1");
		expect(pluginData.googleCalendarTaskFingerprints?.[updatedTask.path]).toBeUndefined();
	});

	it("does not duplicate a native sync already represented by the persisted fingerprint", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/native-sync.md",
			title: "Native sync",
			scheduled: "2026-05-05",
			googleCalendarEventId: "event-1",
		});
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin([task], pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.syncTaskToCalendar(task);
		await syncService.handleExternalTaskFileUpdated(task.path);

		expect(googleCalendarService.updateEvent).toHaveBeenCalledTimes(1);
	});
});
