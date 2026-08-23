import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import { TFile } from "obsidian";

import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	stringifyYaml: jest.fn((obj: unknown) => require("yaml").stringify(obj)),
	TFile: class MockTFile {
		path: string;

		constructor(path = "") {
			this.path = path;
		}
	},
}));

const createPlugin = (
	frontmatter: Record<string, any>,
	options: {
		content?: string;
		processFrontMatter?: jest.Mock;
	} = {}
) => {
	let fileContent = options.content ?? "";

	return {
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
				read: jest.fn().mockImplementation(async () => fileContent),
				modify: jest.fn().mockImplementation(async (_file: TFile, content: string) => {
					fileContent = content;
				}),
				process: jest
					.fn()
					.mockImplementation(async (_file: TFile, update: (content: string) => string) => {
						fileContent = update(fileContent);
						return fileContent;
					}),
			},
			fileManager: {
				processFrontMatter:
					options.processFrontMatter ??
					jest
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
			isCompletedStatus: jest.fn((status?: string) => status === "done"),
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		cacheManager: {
			getTaskInfo: jest.fn().mockResolvedValue(null),
			getAllTasks: jest.fn().mockResolvedValue([]),
		},
		loadData: jest.fn().mockResolvedValue({}),
		loadPluginDataForSafeWrite: jest.fn().mockResolvedValue({}),
		saveData: jest.fn().mockResolvedValue(undefined),
	};
};

describe("Google Calendar duplicate sync prevention", () => {
	beforeEach(() => {
		TaskCalendarSyncService.clearSharedGoogleCalendarSyncStateForTests();
	});

	it("does not create duplicate events when two syncs race before the event id reaches task metadata", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValue({ id: "google-primary-created-event-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/race.md",
			title: "Race",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		await Promise.all([
			syncService.syncTaskToCalendar(task),
			syncService.syncTaskToCalendar(task),
		]);

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);
		expect(frontmatter.googleCalendarEventId).toBe("created-event-id");
	});

	it("updates the newly created event when a follow-up sync still has stale task metadata", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValue({ id: "google-primary-created-event-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/stale.md",
			title: "Stale",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		await syncService.syncTaskToCalendar(task);
		await syncService.syncTaskToCalendar({
			...task,
			scheduled: "2026-04-30",
		});

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);
		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"created-event-id",
			expect.objectContaining({
				start: { date: "2026-04-30" },
			}),
			expect.any(Number)
		);
	});

	it("does not create duplicate events when two independent sync services race for the same task", async () => {
		const frontmatter: Record<string, any> = {};
		const firstPlugin = createPlugin(frontmatter);
		const secondPlugin = createPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValueOnce({ id: "google-primary-first-event-id" })
				.mockResolvedValueOnce({ id: "google-primary-second-event-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const firstSyncService = new TaskCalendarSyncService(
			firstPlugin as any,
			googleCalendarService as any
		);
		const secondSyncService = new TaskCalendarSyncService(
			secondPlugin as any,
			googleCalendarService as any
		);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/cross-instance-race.md",
			title: "Cross-instance race",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		await Promise.all([
			firstSyncService.syncTaskToCalendar(task),
			secondSyncService.syncTaskToCalendar(task),
		]);

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);
		expect(frontmatter.googleCalendarEventId).toBe("first-event-id");
	});

	it("does not let an in-flight create from a destroyed service write metadata", async () => {
		const frontmatter: Record<string, any> = {};
		const firstPlugin = createPlugin(frontmatter);
		const secondPlugin = createPlugin(frontmatter);
		let resolveCreate!: (value: { id: string }) => void;
		const createPromise = new Promise<{ id: string }>((resolve) => {
			resolveCreate = resolve;
		});
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockReturnValueOnce(createPromise)
				.mockResolvedValueOnce({ id: "google-primary-duplicate-event-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const firstSyncService = new TaskCalendarSyncService(
			firstPlugin as any,
			googleCalendarService as any
		);
		const secondSyncService = new TaskCalendarSyncService(
			secondPlugin as any,
			googleCalendarService as any
		);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/destroyed-service-race.md",
			title: "Destroyed service race",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		const firstSync = firstSyncService.syncTaskToCalendar(task);
		for (let index = 0; index < 10 && googleCalendarService.createEvent.mock.calls.length === 0; index++) {
			await Promise.resolve();
		}
		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);

		firstSyncService.destroy();
		const secondSync = secondSyncService.syncTaskToCalendar(task);
		await Promise.resolve();
		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);

		resolveCreate({ id: "google-primary-created-event-id" });
		await expect(Promise.all([firstSync, secondSync])).resolves.toEqual([false, false]);

		expect(frontmatter.googleCalendarEventId).toBeUndefined();
		expect(firstPlugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({
				googleCalendarDeletionQueue: [
					expect.objectContaining({ eventId: "created-event-id" }),
				],
			})
		);
	});

	it("queues a created event for deletion when metadata persistence fails", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createPlugin(frontmatter, {
			processFrontMatter: jest.fn().mockRejectedValue(new Error("disk write failed")),
		});
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValue({ id: "google-primary-created-without-metadata" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/metadata-write-failure.md",
			title: "Metadata write failure",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		await expect(syncService.syncTaskToCalendar(task)).resolves.toBe(false);

		expect(frontmatter.googleCalendarEventId).toBeUndefined();
		expect(plugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({
				googleCalendarDeletionQueue: [
					expect.objectContaining({ eventId: "created-without-metadata" }),
				],
			})
		);
	});

	it("does not create duplicate detached recurring exception events across sync services", async () => {
		const frontmatter: Record<string, any> = {};
		const firstPlugin = createPlugin(frontmatter);
		const secondPlugin = createPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValueOnce({ id: "google-primary-detached-exception-id" })
				.mockResolvedValueOnce({ id: "google-primary-duplicate-exception-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const firstSyncService = new TaskCalendarSyncService(
			firstPlugin as any,
			googleCalendarService as any
		);
		const secondSyncService = new TaskCalendarSyncService(
			secondPlugin as any,
			googleCalendarService as any
		);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/detached-race.md",
			title: "Detached race",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-15",
			archived: false,
			recurrence: "DTSTART:20260413;FREQ=WEEKLY;BYDAY=MO",
			recurrence_anchor: "scheduled",
			complete_instances: [],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
			googleCalendarExceptionOriginalScheduled: "2026-04-13",
		};

		await Promise.all([
			firstSyncService.syncTaskToCalendar(task),
			secondSyncService.syncTaskToCalendar(task),
		]);

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);
		expect(frontmatter.googleCalendarExceptionEventId).toBe("detached-exception-id");
	});

	it("preserves concurrent orphan-event deletion queue additions", async () => {
		const frontmatter: Record<string, any> = {};
		const firstPlugin = createPlugin(frontmatter);
		const secondPlugin = createPlugin(frontmatter);
		let pluginData: Record<string, any> = {};
		for (const plugin of [firstPlugin, secondPlugin]) {
			plugin.loadData = jest.fn(async () => pluginData);
			plugin.loadPluginDataForSafeWrite = jest.fn(async () => ({ ...pluginData }));
			plugin.saveData = jest.fn(async (nextData: Record<string, any>) => {
				pluginData = nextData;
			});
		}
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
		};
		const firstService = new TaskCalendarSyncService(
			firstPlugin as any,
			googleCalendarService as any
		) as any;
		const secondService = new TaskCalendarSyncService(
			secondPlugin as any,
			googleCalendarService as any
		) as any;

		await Promise.all([
			firstService.queueCalendarDeletion("Tasks/one.md", "primary", "event-one"),
			secondService.queueCalendarDeletion("Tasks/two.md", "primary", "event-two"),
		]);

		expect(pluginData.googleCalendarDeletionQueue).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ eventId: "event-one" }),
				expect.objectContaining({ eventId: "event-two" }),
			])
		);
		expect(pluginData.googleCalendarDeletionQueue).toHaveLength(2);
	});

	it("does not leave a failed create in flight and allows a later retry", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockRejectedValueOnce(new Error("create failed"))
				.mockResolvedValueOnce({ id: "google-primary-created-event-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/retry.md",
			title: "Retry",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		await syncService.syncTaskToCalendar(task);
		await syncService.syncTaskToCalendar(task);

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(2);
		expect(frontmatter.googleCalendarEventId).toBe("created-event-id");
	});

	it("does not write event metadata after the OAuth connection generation changes", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createPlugin(frontmatter);
		let connectionGeneration = 1;
		let resolveCreate!: (value: { id: string }) => void;
		const createPromise = new Promise<{ id: string }>((resolve) => {
			resolveCreate = resolve;
		});
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			getConnectionGeneration: jest.fn(() => connectionGeneration),
			isConnectionGenerationCurrent: jest.fn(
				async (expected: number) => expected === connectionGeneration
			),
			createEvent: jest.fn().mockReturnValue(createPromise),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/disconnected-create.md",
			title: "Disconnected create",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		const sync = syncService.syncTaskToCalendar(task);
		for (let index = 0; index < 10 && googleCalendarService.createEvent.mock.calls.length === 0; index++) {
			await Promise.resolve();
		}
		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);

		connectionGeneration = 2;
		resolveCreate({ id: "google-primary-created-after-disconnect" });

		await expect(sync).resolves.toBe(false);
		expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
		expect(frontmatter.googleCalendarEventId).toBeUndefined();
		expect(plugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({
				googleCalendarDeletionQueue: [
					expect.objectContaining({
						calendarId: "primary",
						eventId: "created-after-disconnect",
					}),
				],
			})
		);
	});

	it("rolls back metadata when disconnect occurs during the Obsidian write", async () => {
		const frontmatter: Record<string, any> = {};
		let releaseWrite!: () => void;
		let markWriteStarted!: () => void;
		const writeGate = new Promise<void>((resolve) => {
			releaseWrite = resolve;
		});
		const writeStarted = new Promise<void>((resolve) => {
			markWriteStarted = resolve;
		});
		let processCallCount = 0;
		const processFrontMatter = jest.fn(
			async (_file: TFile, update: (fm: Record<string, any>) => void) => {
				processCallCount += 1;
				update(frontmatter);
				if (processCallCount === 1) {
					markWriteStarted();
					await writeGate;
				}
			}
		);
		const plugin = createPlugin(frontmatter, { processFrontMatter });
		let connectionGeneration = 1;
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			getConnectionGeneration: jest.fn(() => connectionGeneration),
			isConnectionGenerationCurrent: jest.fn(
				async (expected: number) => expected === connectionGeneration
			),
			createEvent: jest
				.fn()
				.mockResolvedValue({ id: "google-primary-created-during-disconnect" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/disconnect-during-write.md",
			title: "Disconnect during write",
			status: "open",
			priority: "normal",
			scheduled: "2026-04-29",
			archived: false,
		};

		const sync = syncService.syncTaskToCalendar(task);
		await writeStarted;
		expect(frontmatter.googleCalendarEventId).toBe("created-during-disconnect");

		connectionGeneration = 2;
		releaseWrite();

		await expect(sync).resolves.toBe(false);
		expect(processFrontMatter).toHaveBeenCalledTimes(2);
		expect(frontmatter.googleCalendarEventId).toBeUndefined();
	});

	it("repairs duplicate Google Calendar event ID frontmatter when saving a new event ID", async () => {
		const duplicateKeyError = Object.assign(new Error("Map keys must be unique"), {
			code: "DUPLICATE_KEY",
		});
		const processFrontMatter = jest.fn().mockRejectedValue(duplicateKeyError);
		const plugin = createPlugin(
			{},
			{
				content: [
					"---",
					"status: open",
					"priority: normal",
					"scheduled: 2026-05-29",
					"tags:",
					"  - task",
					"googleCalendarEventId: first-event",
					"googleCalendarEventId: second-event",
					"googleCalendarExceptionOriginalScheduled: 2026-05-28",
					"googleCalendarExceptionOriginalScheduled: 2026-05-29",
					"---",
					"",
					"Duplicate event ID task",
					"",
				].join("\n"),
				processFrontMatter,
			}
		);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValue({ id: "google-primary-created-event-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin as any, googleCalendarService as any);
		const task: TaskInfo = {
			path: "TaskNotes/Tasks/duplicate-yaml.md",
			title: "Duplicate YAML",
			status: "open",
			priority: "normal",
			scheduled: "2026-05-29",
			archived: false,
		};

		await syncService.syncTaskToCalendar(task);

		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);
		expect(plugin.app.vault.process).toHaveBeenCalledTimes(1);
		expect(plugin.app.vault.read).not.toHaveBeenCalled();
		expect(plugin.app.vault.modify).not.toHaveBeenCalled();

		const repairedContent = await plugin.app.vault.read();
		expect(repairedContent.match(/^googleCalendarEventId:/gm)).toHaveLength(1);
		expect(repairedContent).toContain("googleCalendarEventId: created-event-id");
		expect(repairedContent).not.toContain("googleCalendarEventId: first-event");
		expect(repairedContent).not.toContain("googleCalendarEventId: second-event");
		expect(repairedContent.match(/^googleCalendarExceptionOriginalScheduled:/gm)).toHaveLength(1);
		expect(repairedContent).toContain(
			"googleCalendarExceptionOriginalScheduled: 2026-05-29"
		);
		expect(repairedContent).not.toContain(
			"googleCalendarExceptionOriginalScheduled: 2026-05-28"
		);
		expect(repairedContent).toContain("tags:\n  - task");
	});
});
