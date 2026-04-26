import { PomodoroService } from "../../../src/services/PomodoroService";

function createMockPlugin(pomodoroNotifications: boolean) {
	return {
		settings: {
			pomodoroWorkDuration: 25,
			pomodoroNotifications,
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn().mockResolvedValue({}),
		saveData: jest.fn().mockResolvedValue(undefined),
		emitter: {
			trigger: jest.fn(),
		},
		taskService: {
			startTimeTracking: jest.fn(),
			stopTimeTracking: jest.fn(),
		},
	} as any;
}

function installNotificationMock(permission: NotificationPermission) {
	const notification = jest.fn() as any;
	notification.permission = permission;
	Object.defineProperty(globalThis, "Notification", {
		configurable: true,
		value: notification,
	});
	return notification;
}

describe("PomodoroService notifications", () => {
	const originalNotification = globalThis.Notification;

	afterEach(() => {
		Object.defineProperty(globalThis, "Notification", {
			configurable: true,
			value: originalNotification,
		});
	});

	it("does not show native start notifications when Pomodoro notifications are disabled", async () => {
		const notification = installNotificationMock("granted");
		const service = new PomodoroService(createMockPlugin(false));

		await service.startPomodoro();

		expect(notification).not.toHaveBeenCalled();
	});

	it("does not show native start notifications without notification permission", async () => {
		const notification = installNotificationMock("denied");
		const service = new PomodoroService(createMockPlugin(true));

		await service.startPomodoro();

		expect(notification).not.toHaveBeenCalled();
	});

	it("shows native start notifications when enabled and permission is granted", async () => {
		const notification = installNotificationMock("granted");
		const service = new PomodoroService(createMockPlugin(true));

		await service.startPomodoro();

		expect(notification).toHaveBeenCalledWith("Pomodoro started", undefined);
	});
});
