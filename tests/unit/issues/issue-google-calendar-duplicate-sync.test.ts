import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import { TFile } from "obsidian";

import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	TFile: class MockTFile {
		path: string;

		constructor(path = "") {
			this.path = path;
		}
	},
}));

const createPlugin = (frontmatter: Record<string, any>) => ({
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
			getAbstractFileByPath: jest.fn().mockImplementation((path: string) => new TFile(path)),
			getName: jest.fn().mockReturnValue("MyVault"),
		},
		fileManager: {
			processFrontMatter: jest
				.fn()
				.mockImplementation(async (_file: TFile, fn: (fm: Record<string, any>) => void) => {
					fn(frontmatter);
				}),
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
	saveData: jest.fn().mockResolvedValue(undefined),
});

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
			})
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

	it("keeps in-flight creates shared if the original sync service is destroyed", async () => {
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
		await Promise.resolve();
		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);

		firstSyncService.destroy();
		const secondSync = secondSyncService.syncTaskToCalendar(task);
		await Promise.resolve();
		expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(1);

		resolveCreate({ id: "google-primary-created-event-id" });
		await Promise.all([firstSync, secondSync]);

		expect(frontmatter.googleCalendarEventId).toBe("created-event-id");
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
});
