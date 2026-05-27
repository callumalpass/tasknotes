import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { TFile } from "obsidian";

import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	TFile: class MockTFile {
		path: string;

		constructor(path = "") {
			this.path = path;
		}
	},
}));

function createPlugin(pluginData: Record<string, unknown> = {}) {
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
				includeDescription: true,
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
				getName: jest.fn().mockReturnValue("Example Vault"),
			},
			fileManager: {
				processFrontMatter: jest.fn().mockResolvedValue(undefined),
			},
		},
		fieldMapper: {
			toUserField: jest.fn((field: string) => field),
		},
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue(null),
		},
		statusManager: {
			getStatusConfig: jest.fn((status: string) => ({
				label: status === "done" ? "Done" : status,
			})),
			isCompletedStatus: jest.fn((status?: string) => status === "done"),
		},
		i18n: {
			translate: jest.fn((key: string, params?: Record<string, string | number>) => {
				const translations: Record<string, string> = {
					"settings.integrations.googleCalendarExport.eventDescription.untitledTask":
						"Untitled Task",
					"settings.integrations.googleCalendarExport.eventDescription.status":
						"Status: {value}",
					"settings.integrations.googleCalendarExport.eventDescription.scheduled":
						"Scheduled: {value}",
				};
				const translation = translations[key] || key;
				return translation.replace(/\{(\w+)\}/g, (_match, name) =>
					String(params?.[name] ?? "")
				);
			}),
		},
		cacheManager: {
			getTaskInfo: jest.fn().mockResolvedValue(null),
			getAllTasks: jest.fn().mockResolvedValue([]),
		},
		loadData: jest.fn().mockImplementation(async () => pluginData),
		saveData: jest.fn().mockImplementation(async (data: Record<string, unknown>) => {
			for (const key of Object.keys(pluginData)) {
				delete pluginData[key];
			}
			Object.assign(pluginData, data);
		}),
	} as any;
}

describe("Issue #1956: recurring Google Calendar completion title", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		TaskCalendarSyncService.clearSharedGoogleCalendarSyncStateForTests();
	});

	it("adds the completion checkmark when completing a synced recurring task", async () => {
		const plugin = createPlugin();
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
			createEvent: jest.fn(),
			updateEvent: jest.fn().mockResolvedValue({}),
			deleteEvent: jest.fn(),
		};
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		const task = {
			path: "TaskNotes/Tasks/weekly-review.md",
			title: "Weekly review",
			status: "done",
			priority: "normal",
			archived: false,
			scheduled: "2026-05-28",
			recurrence: "DTSTART:20260528;FREQ=WEEKLY;BYDAY=TH",
			recurrence_anchor: "scheduled",
			complete_instances: ["2026-05-28"],
			skipped_instances: [],
			googleCalendarEventId: "master-event-id",
		} as TaskInfo;

		await syncService.completeTaskInCalendar(task);

		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"master-event-id",
			expect.objectContaining({
				summary: "✓ Weekly review",
				description: expect.stringContaining("Status: Done"),
				recurrence: expect.arrayContaining(["EXDATE;VALUE=DATE:20260528"]),
			})
		);
	});
});
