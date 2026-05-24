import { describe, it, expect, jest, beforeEach } from "@jest/globals";
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

function createPlugin(
	tasks: TaskInfo[],
	frontmatter: Record<string, unknown> = {},
	pluginData: Record<string, unknown> = {}
) {
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
				processFrontMatter: jest
					.fn()
					.mockImplementation(
						async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
							fn(frontmatter);
						}
					),
			},
		},
		fieldMapper: {
			toUserField: jest.fn((field: string) => field),
		},
		priorityManager: {
			getPriorityConfig: jest.fn((priority: string) => ({
				label: priority === "3-medium" ? "Medium" : priority,
			})),
		},
		statusManager: {
			getStatusConfig: jest.fn((status: string) => ({
				label: status === "done" ? "Done" : status === "ready" ? "Ready" : status,
			})),
			isCompletedStatus: jest.fn().mockImplementation((status: string) => status === "done"),
		},
		autoArchiveService: {
			scheduleAutoArchive: jest.fn().mockResolvedValue(undefined),
			cancelAutoArchive: jest.fn().mockResolvedValue(undefined),
		},
		i18n: {
			translate: jest.fn((key: string, params?: Record<string, string | number>) => {
				const translations: Record<string, string> = {
					"settings.integrations.googleCalendarExport.eventDescription.untitledTask":
						"Untitled Task",
					"settings.integrations.googleCalendarExport.eventDescription.priority":
						"Priority: {value}",
					"settings.integrations.googleCalendarExport.eventDescription.status":
						"Status: {value}",
					"settings.integrations.googleCalendarExport.eventDescription.scheduled":
						"Scheduled: {value}",
					"settings.integrations.googleCalendarExport.eventDescription.timeEstimate":
						"Time Estimate: {value}",
					"settings.integrations.googleCalendarExport.eventDescription.openInObsidian":
						"Open in Obsidian",
				};
				const translation = translations[key] || key;
				return translation.replace(/\{(\w+)\}/g, (_match, name) =>
					String(params?.[name] ?? "")
				);
			}),
		},
		cacheManager: {
			getAllTasks: jest.fn().mockResolvedValue(tasks),
			getTaskInfo: jest.fn().mockImplementation(async (path: string) => {
				return tasks.find((task) => task.path === path) || null;
			}),
		},
		emitter: {
			trigger: jest.fn(),
		},
		loadData: jest.fn().mockImplementation(async () => pluginData),
		saveData: jest.fn().mockImplementation(async (data: Record<string, unknown>) => {
			const nextData = { ...data };
			for (const key of Object.keys(pluginData)) {
				delete pluginData[key];
			}
			Object.assign(pluginData, nextData);
		}),
	} as any;
}

function createGoogleCalendarService() {
	return {
		getAvailableCalendars: jest.fn().mockReturnValue([{ id: "primary", name: "Primary" }]),
		createEvent: jest.fn().mockResolvedValue({ id: "google-primary-created-event-id" }),
		updateEvent: jest.fn().mockResolvedValue({}),
		deleteEvent: jest.fn().mockResolvedValue(undefined),
	};
}

describe("Google Calendar external file reconciliation", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("updates a linked event when an external edit marks a one-off task done", async () => {
		const readyTask = {
			path: "TaskNotes/Tasks/prepare-plan.md",
			title: "Prepare plan",
			status: "ready",
			priority: "3-medium",
			archived: false,
			scheduled: "2026-05-14",
			timeEstimate: 180,
			googleCalendarEventId: "event-1",
		} as TaskInfo;
		const doneTask = {
			...readyTask,
			status: "done",
			completedDate: "2026-05-14",
		};
		const pluginData: Record<string, unknown> = {};
		const plugin = createPlugin([doneTask], {}, pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[readyTask.path]: (syncService as any).getCalendarRelevantFingerprint(readyTask),
		};

		await syncService.handleExternalTaskFileUpdated(doneTask.path, doneTask);

		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"event-1",
			expect.objectContaining({
				summary: "✓ Prepare plan",
				description: expect.stringContaining("Status: Done"),
			})
		);
		expect(pluginData.googleCalendarTaskFingerprints).toMatchObject({
			[doneTask.path]: (syncService as any).getCalendarRelevantFingerprint(doneTask),
		});
	});

	it("schedules auto-archive when an external edit enters an auto-archived status", async () => {
		const readyTask = {
			path: "TaskNotes/Tasks/archive-after-done.md",
			title: "Archive after done",
			status: "ready",
			priority: "3-medium",
			archived: false,
			scheduled: "2026-05-14",
			googleCalendarEventId: "event-1",
		} as TaskInfo;
		const doneTask = {
			...readyTask,
			status: "done",
			completedDate: "2026-05-14",
		};
		const pluginData: Record<string, unknown> = {};
		const plugin = createPlugin([doneTask], {}, pluginData);
		const doneStatus = {
			id: "done",
			value: "done",
			label: "Done",
			color: "#00aa00",
			isCompleted: true,
			order: 1,
			autoArchive: true,
			autoArchiveDelay: 5,
		};
		plugin.statusManager.getStatusConfig.mockImplementation((status: string) =>
			status === "done" ? doneStatus : undefined
		);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[readyTask.path]: (syncService as any).getCalendarRelevantFingerprint(readyTask),
		};

		await syncService.handleExternalTaskFileUpdated(doneTask.path, doneTask);

		expect(plugin.autoArchiveService.scheduleAutoArchive).toHaveBeenCalledWith(
			doneTask,
			doneStatus
		);
		expect(plugin.autoArchiveService.cancelAutoArchive).not.toHaveBeenCalled();
	});

	it("cancels auto-archive when an external edit leaves an auto-archived status", async () => {
		const doneTask = {
			path: "TaskNotes/Tasks/reopened.md",
			title: "Reopened",
			status: "done",
			priority: "3-medium",
			archived: false,
			scheduled: "2026-05-14",
			googleCalendarEventId: "event-1",
		} as TaskInfo;
		const readyTask = {
			...doneTask,
			status: "ready",
			completedDate: undefined,
		};
		const pluginData: Record<string, unknown> = {};
		const plugin = createPlugin([readyTask], {}, pluginData);
		const readyStatus = {
			id: "ready",
			value: "ready",
			label: "Ready",
			color: "#999999",
			isCompleted: false,
			order: 1,
			autoArchive: false,
			autoArchiveDelay: 5,
		};
		plugin.statusManager.getStatusConfig.mockImplementation((status: string) =>
			status === "ready" ? readyStatus : undefined
		);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[doneTask.path]: (syncService as any).getCalendarRelevantFingerprint(doneTask),
		};

		await syncService.handleExternalTaskFileUpdated(readyTask.path, readyTask);

		expect(plugin.autoArchiveService.cancelAutoArchive).toHaveBeenCalledWith(readyTask.path);
		expect(plugin.autoArchiveService.scheduleAutoArchive).not.toHaveBeenCalled();
	});

	it("repairs a linked task changed while Obsidian was closed", async () => {
		const readyTask = {
			path: "TaskNotes/Tasks/offline-linked.md",
			title: "Offline linked",
			status: "ready",
			priority: "3-medium",
			archived: false,
			scheduled: "2026-05-14",
			googleCalendarEventId: "event-1",
		} as TaskInfo;
		const doneTask = {
			...readyTask,
			status: "done",
			completedDate: "2026-05-14",
		};
		const pluginData: Record<string, unknown> = {};
		const plugin = createPlugin([doneTask], {}, pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);
		pluginData.googleCalendarTaskFingerprints = {
			[readyTask.path]: (syncService as any).getCalendarRelevantFingerprint(readyTask),
		};

		await syncService.initializeExternalFileReconciliation();

		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
			"primary",
			"event-1",
			expect.objectContaining({
				summary: "✓ Offline linked",
				description: expect.stringContaining("Status: Done"),
			})
		);
	});

	it("baselines missing startup fingerprints for linked tasks without API writes", async () => {
		const task = {
			path: "TaskNotes/Tasks/existing-linked.md",
			title: "Existing linked",
			status: "ready",
			priority: "3-medium",
			archived: false,
			scheduled: "2026-05-14",
			googleCalendarEventId: "event-1",
		} as TaskInfo;
		const pluginData: Record<string, unknown> = {};
		const plugin = createPlugin([task], {}, pluginData);
		const googleCalendarService = createGoogleCalendarService();
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		await syncService.initializeExternalFileReconciliation();

		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(googleCalendarService.updateEvent).not.toHaveBeenCalled();
		expect(pluginData.googleCalendarTaskFingerprints).toMatchObject({
			[task.path]: (syncService as any).getCalendarRelevantFingerprint(task),
		});
	});
});
