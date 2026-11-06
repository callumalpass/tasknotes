import { TFile } from "obsidian";
import { NotificationService, reminderNotificationTag } from "../../../src/ui/NotificationService";
import { Reminder, TaskInfo } from "../../../src/types";

// Measured on Windows 11 (Obsidian 1.13.7, Electron 43): tags of 45+ characters are dropped silently.
const WINDOWS_MAX_TAG_LENGTH = 44;

describe("Issue #2061: reminder system notifications on Windows", () => {
	const originalNotification = window.Notification;

	afterEach(() => {
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: originalNotification,
		});
	});

	it("gives a reminder in a deep folder a tag Windows will display", async () => {
		const notificationConstructor = jest.fn().mockImplementation(() => ({ close: jest.fn(), onclick: null }));
		Object.defineProperty(notificationConstructor, "permission", { configurable: true, value: "granted" });
		Object.defineProperty(window, "Notification", { configurable: true, value: notificationConstructor });

		const task: TaskInfo = {
			path: "TaskNotes/Tasks/Projects/Quarterly planning review with the team.md",
			title: "Quarterly planning review with the team",
			status: "open",
			priority: "normal",
		};
		const reminder: Reminder = { id: "rem_1782098229741", type: "absolute", absoluteTime: "2026-06-21T23:18:00" };
		const plugin = {
			settings: { notificationType: "system", notificationSoundEnabled: false },
			app: {
				vault: { getAbstractFileByPath: jest.fn().mockReturnValue(new TFile(task.path)) },
				metadataCache: { getFileCache: jest.fn().mockReturnValue({ frontmatter: {} }) },
				workspace: { openLinkText: jest.fn() },
			},
			fieldMapper: { mapFromFrontmatter: jest.fn().mockReturnValue(task) },
			apiService: undefined,
			statusManager: {
				getCompletedStatuses: () => ["done"],
				isCompletedStatus: (status: string) => status === "done",
			},
		};

		await (new NotificationService(plugin as never) as any).triggerNotification({
			taskPath: task.path,
			reminder,
			notifyAt: new Date(reminder.absoluteTime!).getTime(),
		});

		const { tag } = notificationConstructor.mock.calls[0][1];
		expect(tag.length).toBeLessThanOrEqual(WINDOWS_MAX_TAG_LENGTH);
	});

	it("keeps tags stable per reminder and distinct between reminders", () => {
		expect(reminderNotificationTag("Tasks/a.md", "rem_1")).toBe(reminderNotificationTag("Tasks/a.md", "rem_1"));
		expect(reminderNotificationTag("Tasks/a.md", "rem_1")).not.toBe(reminderNotificationTag("Tasks/a.md", "rem_2"));
		expect(reminderNotificationTag("Tasks/a.md", "rem_1")).not.toBe(reminderNotificationTag("Tasks/b.md", "rem_1"));
	});
});
