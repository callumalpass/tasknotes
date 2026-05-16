import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import type { TaskInfo } from "../../../src/types";

describe("Issue #1622: Google Calendar export default reminder intervals", () => {
	function createSyncService(defaultReminderMinutes: number | number[] | null, createAsAllDay = false) {
		const mockPlugin = {
			settings: {
				googleCalendarExport: {
					eventTitleTemplate: "{{title}}",
					includeDescription: false,
					eventColorId: null,
					syncTrigger: "scheduled",
					createAsAllDay,
					defaultEventDuration: 60,
					includeObsidianLink: true,
					defaultReminderMinutes,
				},
			},
			statusManager: {
				getStatusConfig: jest.fn(),
			},
			priorityManager: {
				getPriorityConfig: jest.fn(),
			},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
		};

		const mockGoogleCalendarService = {};
		return new TaskCalendarSyncService(
			mockPlugin as never,
			mockGoogleCalendarService as never
		) as unknown as {
			taskToCalendarEvent: (task: TaskInfo) => {
				reminders?: {
					useDefault: boolean;
					overrides?: Array<{ method: string; minutes: number }>;
				};
			};
		};
	}

	it("writes multiple default reminder overrides for timed exported events", () => {
		const service = createSyncService([10080, 4320, 1440, 120]);
		const task: TaskInfo = {
			path: "Tasks/prepare-review.md",
			title: "Prepare review",
			scheduled: "2026-05-20T10:00:00",
		};

		const event = service.taskToCalendarEvent(task);

		expect(event.reminders).toEqual({
			useDefault: false,
			overrides: [
				{ method: "popup", minutes: 10080 },
				{ method: "popup", minutes: 4320 },
				{ method: "popup", minutes: 1440 },
				{ method: "popup", minutes: 120 },
			],
		});
	});

	it("keeps legacy single-minute default reminder settings working", () => {
		const service = createSyncService(30);
		const task: TaskInfo = {
			path: "Tasks/prepare-review.md",
			title: "Prepare review",
			scheduled: "2026-05-20T10:00:00",
		};

		const event = service.taskToCalendarEvent(task);

		expect(event.reminders).toEqual({
			useDefault: false,
			overrides: [{ method: "popup", minutes: 30 }],
		});
	});

	it("continues to use Google Calendar defaults for all-day exports", () => {
		const service = createSyncService([10080, 1440], true);
		const task: TaskInfo = {
			path: "Tasks/prepare-review.md",
			title: "Prepare review",
			scheduled: "2026-05-20",
		};

		const event = service.taskToCalendarEvent(task);

		expect(event.reminders).toEqual({ useDefault: true });
	});
});
