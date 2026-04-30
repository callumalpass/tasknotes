import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { TFile } from "obsidian";

import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { TaskService } from "../../../src/services/TaskService";
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

function createGoogleSyncPlugin(frontmatter: Record<string, any> = {}) {
	let pluginData: Record<string, any> = {};
	return {
		settings: {
			storeTitleInFilename: false,
			taskIdentificationMethod: "property",
			taskPropertyName: "type",
			taskPropertyValue: "task",
			maintainDueDateOffsetInRecurring: false,
			resetCheckboxesOnRecurrence: false,
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
				createAsAllDay: false,
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
				getName: jest.fn().mockReturnValue("Example Vault"),
				read: jest.fn().mockResolvedValue(""),
				modify: jest.fn().mockResolvedValue(undefined),
			},
			fileManager: {
				processFrontMatter: jest
					.fn()
					.mockImplementation(
						async (_file: TFile, fn: (fm: Record<string, any>) => void) => {
							fn(frontmatter);
						}
					),
				renameFile: jest.fn().mockResolvedValue(undefined),
			},
		},
		fieldMapper: {
			toUserField: jest.fn((field: string) => field),
			mapToFrontmatter: jest.fn((taskData: Record<string, any>) => {
				const mapped: Record<string, any> = {};
				for (const [key, value] of Object.entries(taskData)) {
					if (key === "details" || value === undefined) {
						continue;
					}
					mapped[key] = value;
				}
				return mapped;
			}),
		},
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue(null),
		},
		statusManager: {
			getStatusConfig: jest.fn().mockReturnValue(null),
			isCompletedStatus: jest.fn().mockImplementation((status: string) => status === "done"),
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn(async () => pluginData),
		saveData: jest.fn(async (data: Record<string, any>) => {
			pluginData = data;
		}),
		cacheManager: {
			getTaskInfo: jest.fn().mockResolvedValue(null),
			getAllTasks: jest.fn().mockResolvedValue([]),
			updateTaskInfoInCache: jest.fn(),
			waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
			clearCacheEntry: jest.fn(),
		},
		emitter: {
			trigger: jest.fn(),
		},
	} as any;
}

describe("Issue #1696: Google Calendar recurring reschedule sync", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("persists the original series date when a moved occurrence is completed", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createGoogleSyncPlugin(frontmatter);
		const taskService = new TaskService(plugin);
		const task = {
			path: "TaskNotes/Tasks/Water plants.md",
			title: "Water plants",
			status: "ready",
			priority: "normal",
			archived: false,
			scheduled: "2026-04-15",
			recurrence: "DTSTART:20260316;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO",
			recurrence_anchor: "scheduled",
			complete_instances: [],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
			googleCalendarExceptionOriginalScheduled: "2026-04-13",
		} as TaskInfo & { googleCalendarExceptionOriginalScheduled: string };

		plugin.cacheManager.getTaskInfo.mockResolvedValue(task);

		const updatedTask = await taskService.toggleRecurringTaskComplete(task);

		expect(updatedTask.complete_instances).toContain("2026-04-15");
		expect(updatedTask.googleCalendarMovedOriginalDates).toContain("2026-04-13");
		expect(updatedTask.googleCalendarExceptionOriginalScheduled).toBeUndefined();
		expect(frontmatter.googleCalendarMovedOriginalDates).toEqual(["2026-04-13"]);
		expect(frontmatter.googleCalendarExceptionOriginalScheduled).toBeUndefined();
	});

	it("stores the original series date when a scheduled recurring occurrence is moved", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createGoogleSyncPlugin(frontmatter);
		const taskService = new TaskService(plugin);
		const task = {
			path: "TaskNotes/Tasks/Water plants.md",
			title: "Water plants",
			status: "ready",
			priority: "normal",
			archived: false,
			scheduled: "2026-04-13",
			recurrence: "DTSTART:20260316;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO",
			recurrence_anchor: "scheduled",
			complete_instances: [],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
		} as TaskInfo;

		const updatedTask = await taskService.updateTask(task, {
			scheduled: "2026-04-15",
		});

		expect(updatedTask.googleCalendarExceptionOriginalScheduled).toBe("2026-04-13");
		expect(frontmatter.googleCalendarExceptionOriginalScheduled).toBe("2026-04-13");
	});

	it("adds moved original dates to the recurring master's EXDATE list", () => {
		const plugin = createGoogleSyncPlugin();
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest.fn(),
			updateEvent: jest.fn(),
			deleteEvent: jest.fn(),
		};
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		const task = {
			path: "TaskNotes/Tasks/Water plants.md",
			title: "Water plants",
			status: "ready",
			priority: "normal",
			archived: false,
			scheduled: "2026-05-11",
			recurrence: "DTSTART:20260316;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO",
			recurrence_anchor: "scheduled",
			complete_instances: ["2026-04-15"],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
			googleCalendarMovedOriginalDates: ["2026-04-13"],
		} as TaskInfo & { googleCalendarMovedOriginalDates: string[] };

		const event = (syncService as any).taskToCalendarEvent(task);

		expect(event?.recurrence).toContain("EXDATE;VALUE=DATE:20260413");
		expect(event?.recurrence).toContain("EXDATE;VALUE=DATE:20260415");
	});

	it("creates a detached exception event for a pending moved occurrence", async () => {
		const frontmatter: Record<string, any> = {};
		const plugin = createGoogleSyncPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest
				.fn()
				.mockResolvedValue({ id: "google-primary-detached-exception-id" }),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		const task = {
			path: "TaskNotes/Tasks/Water plants.md",
			title: "Water plants",
			status: "ready",
			priority: "normal",
			archived: false,
			scheduled: "2026-04-15",
			recurrence: "DTSTART:20260316;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO",
			recurrence_anchor: "scheduled",
			complete_instances: [],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
			googleCalendarExceptionOriginalScheduled: "2026-04-13",
		} as TaskInfo & { googleCalendarExceptionOriginalScheduled: string };

		await syncService.syncTaskToCalendar(task);

		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"master-event-id",
			expect.objectContaining({
				recurrence: expect.arrayContaining(["EXDATE;VALUE=DATE:20260413"]),
			})
		);
		expect(googleCalendarService.createEvent).toHaveBeenCalledWith(
			"primary",
			expect.objectContaining({
				summary: "Water plants",
				start: { date: "2026-04-15" },
				end: { date: "2026-04-16" },
				isAllDay: true,
			})
		);
		expect(frontmatter.googleCalendarExceptionEventId).toBe("detached-exception-id");
	});

	it("deletes stale detached exception events once the moved occurrence has been resolved", async () => {
		const frontmatter: Record<string, any> = {
			googleCalendarExceptionEventId: "detached-exception-id",
		};
		const plugin = createGoogleSyncPlugin(frontmatter);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest.fn(),
			updateEvent: jest.fn().mockResolvedValue(undefined),
			deleteEvent: jest.fn().mockResolvedValue(undefined),
		};
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		const task = {
			path: "TaskNotes/Tasks/Water plants.md",
			title: "Water plants",
			status: "ready",
			priority: "normal",
			archived: false,
			scheduled: "2026-05-11",
			recurrence: "DTSTART:20260316;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO",
			recurrence_anchor: "scheduled",
			complete_instances: ["2026-04-15"],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
			googleCalendarExceptionEventId: "detached-exception-id",
			googleCalendarMovedOriginalDates: ["2026-04-13"],
		} as TaskInfo & {
			googleCalendarExceptionEventId: string;
			googleCalendarMovedOriginalDates: string[];
		};

		await syncService.syncTaskToCalendar(task);

		expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith(
			"primary",
			"detached-exception-id"
		);
		expect(frontmatter.googleCalendarExceptionEventId).toBeUndefined();
	});
});
