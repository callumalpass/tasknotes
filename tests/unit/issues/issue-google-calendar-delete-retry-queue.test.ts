import { describe, it, expect, jest } from "@jest/globals";

import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { EventNotFoundError } from "../../../src/services/errors";
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

const createPlugin = (pluginData: Record<string, any> = {}, calendarSettings = {}) => {
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
	createEvent: jest.fn(),
	updateEvent: jest.fn(),
	deleteEvent: jest.fn().mockResolvedValue(undefined),
	...overrides,
});

describe("Google Calendar deletion retry queue", () => {
	it("persists failed task-file deletion cleanup so it survives plugin restarts", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData);
		const deleteError = Object.assign(new Error("temporary Google failure"), { status: 500 });
		const googleCalendarService = createGoogleCalendarService({
			deleteEvent: jest.fn().mockRejectedValue(deleteError),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const deleted = await syncService.deleteTaskFromCalendarByPath(
			"TaskNotes/Tasks/delete-me.md",
			"primary-event-id"
		);

		expect(deleted).toBe(false);
		expect(pluginData.googleCalendarDeletionQueue).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/delete-me.md",
				calendarId: "primary",
				eventId: "primary-event-id",
				attempts: 1,
				lastError: "temporary Google failure",
			}),
		]);
	});

	it("dedupes queued cleanup by calendar and event id while preserving retry metadata", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData);
		const googleCalendarService = createGoogleCalendarService({
			deleteEvent: jest
				.fn()
				.mockRejectedValueOnce(Object.assign(new Error("first failure"), { status: 500 }))
				.mockRejectedValueOnce(Object.assign(new Error("second failure"), { status: 500 })),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.deleteTaskFromCalendarByPath("TaskNotes/Tasks/a.md", "event-1");
		await syncService.deleteTaskFromCalendarByPath("TaskNotes/Tasks/a.md", "event-1");

		expect(pluginData.googleCalendarDeletionQueue).toHaveLength(1);
		expect(pluginData.googleCalendarDeletionQueue[0]).toEqual(
			expect.objectContaining({
				calendarId: "primary",
				eventId: "event-1",
				attempts: 2,
				lastError: "second failure",
			})
		);
	});

	it("retries persisted cleanup and clears the queue after a later successful deletion", async () => {
		const pluginData = {
			googleCalendarDeletionQueue: [
				{
					taskPath: "TaskNotes/Tasks/delete-me.md",
					calendarId: "primary",
					eventId: "event-1",
					createdAt: 1,
					attempts: 1,
					lastAttemptAt: 1,
					lastError: "temporary Google failure",
				},
			],
		};
		const plugin = createPlugin(pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const result = await syncService.processDeletionQueue();

		expect(result).toEqual({ deleted: 1, failed: 0, remaining: 0 });
		expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith("primary", "event-1");
		expect(pluginData.googleCalendarDeletionQueue).toEqual([]);
	});

	it("treats already-deleted Google events as successful cleanup", async () => {
		const pluginData = {
			googleCalendarDeletionQueue: [
				{
					taskPath: "TaskNotes/Tasks/delete-me.md",
					calendarId: "primary",
					eventId: "missing-event",
					createdAt: 1,
					attempts: 1,
					lastAttemptAt: 1,
				},
			],
		};
		const plugin = createPlugin(pluginData);
		const googleCalendarService = createGoogleCalendarService({
			deleteEvent: jest.fn().mockRejectedValue(new EventNotFoundError("missing-event")),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const result = await syncService.processDeletionQueue();

		expect(result).toEqual({ deleted: 1, failed: 0, remaining: 0 });
		expect(pluginData.googleCalendarDeletionQueue).toEqual([]);
	});

	it("queues deletion from a previous frontmatter event id when sync is not ready", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData);
		const googleCalendarService = createGoogleCalendarService({
			getAvailableCalendars: jest.fn().mockReturnValue([]),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const deleted = await syncService.deleteTaskFromCalendarByPath(
			"TaskNotes/Tasks/external-delete.md",
			"event-from-prev-cache"
		);

		expect(deleted).toBe(false);
		expect(googleCalendarService.deleteEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarDeletionQueue).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/external-delete.md",
				calendarId: "primary",
				eventId: "event-from-prev-cache",
				attempts: 0,
				lastError: "Google Calendar sync is not ready",
			}),
		]);
	});

	it("queues primary and recurring exception event ids together when both are supplied", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData);
		const googleCalendarService = createGoogleCalendarService({
			deleteEvent: jest
				.fn()
				.mockRejectedValue(Object.assign(new Error("temporary Google failure"), { status: 500 })),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const deleted = await syncService.deleteTaskFromCalendarByPath(
			"TaskNotes/Tasks/recurring.md",
			"primary-event-id",
			"exception-event-id"
		);

		expect(deleted).toBe(false);
		expect(pluginData.googleCalendarDeletionQueue).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventId: "primary-event-id", calendarId: "primary" }),
				expect.objectContaining({ eventId: "exception-event-id", calendarId: "primary" }),
			])
		);
	});

	it("recovers cleanup for indexed task events whose files were deleted while Obsidian was closed", async () => {
		const pluginData = {
			googleCalendarEventIndex: [
				{
					taskPath: "TaskNotes/Tasks/deleted-while-closed.md",
					calendarId: "primary",
					eventId: "event-from-index",
					updatedAt: 1,
				},
			],
		};
		const plugin = createPlugin(pluginData);
		plugin.cacheManager.getAllTasks = jest.fn().mockResolvedValue([]);
		plugin.cacheManager.getTaskInfo = jest.fn().mockResolvedValue(null);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.recoverDeletedTaskEventsFromIndex();

		expect(pluginData.googleCalendarDeletionQueue).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/deleted-while-closed.md",
				calendarId: "primary",
				eventId: "event-from-index",
				lastError: "Indexed task file no longer exists",
			}),
		]);

		const result = await syncService.processDeletionQueue();

		expect(result).toEqual({ deleted: 1, failed: 0, remaining: 0 });
		expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith("primary", "event-from-index");
		expect(pluginData.googleCalendarDeletionQueue).toEqual([]);
		expect(pluginData.googleCalendarEventIndex).toEqual([]);
	});

	it("updates the event index instead of deleting events when an indexed task moved while Obsidian was closed", async () => {
		const pluginData = {
			googleCalendarEventIndex: [
				{
					taskPath: "TaskNotes/Tasks/old-path.md",
					calendarId: "primary",
					eventId: "moved-event",
					updatedAt: 1,
				},
			],
		};
		const plugin = createPlugin(pluginData);
		plugin.cacheManager.getAllTasks = jest.fn().mockResolvedValue([
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/new-path.md",
				scheduled: "2026-04-29",
				googleCalendarEventId: "moved-event",
			}),
		]);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.recoverDeletedTaskEventsFromIndex();

		expect(pluginData.googleCalendarDeletionQueue).toBeUndefined();
		expect(pluginData.googleCalendarEventIndex).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/new-path.md",
				calendarId: "primary",
				eventId: "moved-event",
			}),
		]);
		expect(googleCalendarService.deleteEvent).not.toHaveBeenCalled();
	});

	it("drops queued cleanup without deleting Google events when the task still exists and remains calendar-eligible", async () => {
		const pluginData = {
			googleCalendarDeletionQueue: [
				{
					taskPath: "TaskNotes/Tasks/still-active.md",
					calendarId: "primary",
					eventId: "active-event",
					createdAt: 1,
					attempts: 1,
					lastAttemptAt: 1,
					lastError: "previous delete failure",
				},
			],
			googleCalendarEventIndex: [
				{
					taskPath: "TaskNotes/Tasks/still-active.md",
					calendarId: "primary",
					eventId: "active-event",
					updatedAt: 1,
				},
			],
		};
		const plugin = createPlugin(pluginData);
		plugin.cacheManager.getTaskInfo = jest.fn().mockResolvedValue(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/still-active.md",
				scheduled: "2026-04-29",
				googleCalendarEventId: "active-event",
			})
		);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const result = await syncService.processDeletionQueue();

		expect(result).toEqual({ deleted: 0, failed: 0, remaining: 0 });
		expect(googleCalendarService.deleteEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarDeletionQueue).toEqual([]);
		expect(pluginData.googleCalendarEventIndex).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/still-active.md",
				eventId: "active-event",
			}),
		]);
	});

	it("queues scheduled task sync when Google Calendar is not connected", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData);
		const googleCalendarService = createGoogleCalendarService({
			getAvailableCalendars: jest.fn().mockReturnValue([]),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const synced = await syncService.syncTaskToCalendar(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/offline-scheduled.md",
				scheduled: "2026-04-29",
			})
		);

		expect(synced).toBe(false);
		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarSyncQueue).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/offline-scheduled.md",
				attempts: 0,
				lastError: "Google Calendar sync is not ready",
			}),
		]);
	});

	it("queues due-date task sync when the calendar trigger is configured for due dates", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData, { syncTrigger: "due" });
		const googleCalendarService = createGoogleCalendarService({
			getAvailableCalendars: jest.fn().mockReturnValue([]),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const synced = await syncService.syncTaskToCalendar(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/offline-due.md",
				due: "2026-04-30",
			})
		);

		expect(synced).toBe(false);
		expect(pluginData.googleCalendarSyncQueue).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/offline-due.md",
			}),
		]);
	});

	it("queues task sync when the calendar trigger is configured for scheduled or due dates", async () => {
		const pluginData: Record<string, any> = {};
		const plugin = createPlugin(pluginData, { syncTrigger: "both" });
		const googleCalendarService = createGoogleCalendarService({
			getAvailableCalendars: jest.fn().mockReturnValue([]),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const synced = await syncService.syncTaskToCalendar(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/offline-both.md",
				due: "2026-05-01",
			})
		);

		expect(synced).toBe(false);
		expect(pluginData.googleCalendarSyncQueue).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/offline-both.md",
			}),
		]);
	});

	it("replays queued task sync by creating the current task event after reconnect", async () => {
		const pluginData = {
			googleCalendarSyncQueue: [
				{
					taskPath: "TaskNotes/Tasks/replay-create.md",
					requestedAt: 1,
					attempts: 0,
					lastError: "Google Calendar sync is not ready",
				},
			],
		};
		const plugin = createPlugin(pluginData);
		plugin.cacheManager.getTaskInfo = jest.fn().mockResolvedValue(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/replay-create.md",
				scheduled: "2026-04-29",
			})
		);
		const googleCalendarService = createGoogleCalendarService({
			createEvent: jest.fn().mockResolvedValue({ id: "google-primary-created-event-id" }),
		});
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const result = await syncService.processPendingSyncQueue();

		expect(result).toEqual({ synced: 1, failed: 0, deleted: 0, dropped: 0, remaining: 0 });
		expect(googleCalendarService.createEvent).toHaveBeenCalledWith(
			"primary",
			expect.objectContaining({
				start: { date: "2026-04-29" },
			})
		);
		expect(pluginData.googleCalendarSyncQueue).toEqual([]);
		expect(pluginData.googleCalendarEventIndex).toEqual([
			expect.objectContaining({
				taskPath: "TaskNotes/Tasks/replay-create.md",
				calendarId: "primary",
				eventId: "created-event-id",
			}),
		]);
	});

	it("replays queued task sync by updating the current task event after reconnect", async () => {
		const pluginData = {
			googleCalendarSyncQueue: [
				{
					taskPath: "TaskNotes/Tasks/replay-update.md",
					requestedAt: 1,
					attempts: 0,
				},
			],
		};
		const plugin = createPlugin(pluginData);
		plugin.cacheManager.getTaskInfo = jest.fn().mockResolvedValue(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/replay-update.md",
				scheduled: "2026-05-02",
				googleCalendarEventId: "existing-event-id",
			})
		);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const result = await syncService.processPendingSyncQueue();

		expect(result).toEqual({ synced: 1, failed: 0, deleted: 0, dropped: 0, remaining: 0 });
		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"existing-event-id",
			expect.objectContaining({
				start: { date: "2026-05-02" },
			})
		);
		expect(pluginData.googleCalendarSyncQueue).toEqual([]);
	});

	it("replays queued task sync by deleting the event when the task no longer has the configured date", async () => {
		const pluginData = {
			googleCalendarSyncQueue: [
				{
					taskPath: "TaskNotes/Tasks/replay-delete.md",
					requestedAt: 1,
					attempts: 0,
				},
			],
		};
		const plugin = createPlugin(pluginData);
		plugin.cacheManager.getTaskInfo = jest.fn().mockResolvedValue(
			TaskFactory.createTask({
				path: "TaskNotes/Tasks/replay-delete.md",
				scheduled: undefined,
				googleCalendarEventId: "event-to-delete",
			})
		);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const result = await syncService.processPendingSyncQueue();

		expect(result).toEqual({ synced: 0, failed: 0, deleted: 1, dropped: 0, remaining: 0 });
		expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith("primary", "event-to-delete");
		expect(pluginData.googleCalendarSyncQueue).toEqual([]);
	});
});
