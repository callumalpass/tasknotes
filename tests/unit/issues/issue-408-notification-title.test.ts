import { TFile } from "obsidian";
import { NotificationService } from "../../../src/services/NotificationService";
import { Reminder, TaskInfo } from "../../../src/types";

describe("Issue #408: reminder system notification title", () => {
	const originalNotification = window.Notification;

	afterEach(() => {
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: originalNotification,
		});
		jest.restoreAllMocks();
	});

	it("uses the task title as the native notification title", async () => {
		const close = jest.fn();
		const notificationConstructor = jest.fn().mockImplementation(() => ({
			close,
			onclick: null,
		}));
		Object.defineProperty(notificationConstructor, "permission", {
			configurable: true,
			value: "granted",
		});
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: notificationConstructor,
		});

		const task: TaskInfo = {
			path: "Tasks/follow-up.md",
			title: "Follow up with Erin",
			status: "open",
			priority: "normal",
		};
		const reminder: Reminder = {
			id: "rem_issue_408",
			type: "absolute",
			absoluteTime: "2026-05-18T10:00:00",
		};
		const file = new TFile("Tasks/follow-up.md");
		const plugin = {
			settings: {
				notificationType: "system",
				notificationSoundEnabled: false,
			},
			app: {
				vault: {
					getAbstractFileByPath: jest.fn().mockReturnValue(file),
				},
				metadataCache: {
					getFileCache: jest.fn().mockReturnValue({ frontmatter: { title: task.title } }),
				},
				workspace: {
					openLinkText: jest.fn(),
				},
			},
			fieldMapper: {
				mapFromFrontmatter: jest.fn().mockReturnValue(task),
			},
			apiService: undefined,
		};
		const service = new NotificationService(plugin as never);

		await (service as any).triggerNotification({
			taskPath: task.path,
			reminder,
			notifyAt: new Date(reminder.absoluteTime!).getTime(),
		});

		expect(notificationConstructor).toHaveBeenCalledWith(
			"Follow up with Erin",
			expect.objectContaining({
				body: "Reminder: Follow up with Erin",
				tag: "tasknotes-Tasks/follow-up.md-rem_issue_408",
			})
		);
	});
});
