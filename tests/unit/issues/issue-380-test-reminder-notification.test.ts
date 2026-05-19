import { Notice } from "obsidian";
import { NotificationService } from "../../../src/ui/NotificationService";

describe("Issue #380: test reminder notification", () => {
	const originalNotification = window.Notification;

	afterEach(() => {
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: originalNotification,
		});
		jest.restoreAllMocks();
	});

	function createService(settings: {
		notificationType: "in-app" | "system";
		notificationSoundEnabled?: boolean;
	}): NotificationService {
		return new NotificationService({
			settings: {
				notificationSoundVolume: 50,
				notificationSoundEnabled: settings.notificationSoundEnabled ?? false,
				notificationType: settings.notificationType,
			},
		} as ConstructorParameters<typeof NotificationService>[0]);
	}

	it("sends a native system notification when permission is granted", async () => {
		const notificationConstructor = jest.fn();
		Object.defineProperty(notificationConstructor, "permission", {
			configurable: true,
			value: "granted",
		});
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: notificationConstructor,
		});

		const service = createService({ notificationType: "system" });

		await service.sendTestReminderNotification();

		expect(notificationConstructor).toHaveBeenCalledWith(
			"TaskNotes Reminder",
			expect.objectContaining({
				body: "This is a test reminder from TaskNotes.",
				tag: "tasknotes-test-reminder",
			})
		);
	});

	it("falls back to an in-app notice when system notifications are unavailable", async () => {
		const noticeSpy = jest.mocked(Notice);
		Object.defineProperty(window, "Notification", {
			configurable: true,
			value: undefined,
		});

		const service = createService({ notificationType: "system" });

		await service.sendTestReminderNotification();

		expect(noticeSpy).toHaveBeenCalledWith("This is a test reminder from TaskNotes.", 5000);
	});
});
