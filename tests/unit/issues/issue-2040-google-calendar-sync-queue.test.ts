import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types/TaskInfo";

/**
 * Regression test for issue #2040:
 * "[Bug]: googleCalendarSyncQueue fills up without a calendar configured"
 *
 * Expected behavior:
 *   When the user has not enabled Google Calendar export in settings
 *   (settings.googleCalendarExport.enabled === false), creating/updating
 *   tasks must NOT add entries to googleCalendarSyncQueue. The queue is
 *   intended for transient failures (auth expired, rate limited, target
 *   calendar temporarily missing) and should never grow when the user has
 *   opted out of the feature entirely.
 *
 * Previous (buggy) behavior:
 *   TaskCreationService would call syncTaskToCalendar on every eligible
 *   task (any task with a scheduled or due date). syncTaskToCalendar would
 *   reach the `if (!this.isEnabled())` branch, which called queueTaskSync
 *   with "Google Calendar sync is not ready". Every task creation
 *   therefore appended a queue entry that nothing would ever clear,
 *   polluting data.json on every commit.
 *
 * Fix:
 *   Early-return from syncTaskToCalendar when
 *   settings.googleCalendarExport.enabled === false, before any queue
 *   interaction.
 */

function makePlugin(enabled: boolean, syncOnTaskCreate = true): TaskNotesPlugin {
	return {
		settings: {
			googleCalendarExport: {
				enabled,
				syncOnTaskCreate,
				targetCalendarId: enabled ? "cal-1" : "",
				syncTrigger: "scheduled",
			},
		},
		loadData: jest.fn().mockResolvedValue({}),
	} as unknown as TaskNotesPlugin;
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		path: "tasks/foo.md",
		title: "Foo",
		status: "open",
		priority: "normal",
		archived: false,
		scheduled: "2026-07-01",
		tags: [],
		...overrides,
	} as unknown as TaskInfo;
}

describe("Issue #2040: syncTaskToCalendar does not queue when Google Calendar export is disabled", () => {
	it("returns true and does not call queueTaskSync when export is disabled", async () => {
		const plugin = makePlugin(false);

		// Spy on the private queueTaskSync method via prototype.
		const queueSpy = jest
			.spyOn(TaskCalendarSyncService.prototype as any, "queueTaskSync")
			.mockResolvedValue(undefined);

		const service = new TaskCalendarSyncService(
			plugin,
			{} as any, // googleCalendarService
		);

		const result = await (service as any).syncTaskToCalendar(makeTask());

		expect(result).toBe(true);
		expect(queueSpy).not.toHaveBeenCalled();
		queueSpy.mockRestore();
	});

	it("still calls queueTaskSync for transient failures when export IS enabled", async () => {
		// When enabled === true but isEnabled() returns false (e.g. OAuth not
		// connected), the existing queue-on-failure behavior is preserved.
		const plugin = makePlugin(true);

		const queueSpy = jest
			.spyOn(TaskCalendarSyncService.prototype as any, "queueTaskSync")
			.mockResolvedValue(undefined);

		// Force isEnabled() to return false by stubbing it.
		const isEnabledSpy = jest
			.spyOn(TaskCalendarSyncService.prototype as any, "isEnabled")
			.mockReturnValue(false);

		const service = new TaskCalendarSyncService(
			plugin,
			{} as any,
		);

		const result = await (service as any).syncTaskToCalendar(makeTask());

		expect(result).toBe(false);
		expect(queueSpy).toHaveBeenCalledWith(
			"tasks/foo.md",
			expect.objectContaining({ message: "Google Calendar sync is not ready" }),
		);

		queueSpy.mockRestore();
		isEnabledSpy.mockRestore();
	});

	it("returns true for ineligible tasks even when export is disabled (no-op)", async () => {
		// Tasks without scheduled/due dates should not be queued regardless.
		const plugin = makePlugin(false);

		const queueSpy = jest
			.spyOn(TaskCalendarSyncService.prototype as any, "queueTaskSync")
			.mockResolvedValue(undefined);

		const service = new TaskCalendarSyncService(
			plugin,
			{} as any,
		);

		const ineligibleTask = makeTask({ scheduled: undefined, due: undefined });
		// The early-return for !enabled should fire before the eligibility
		// check, but we still expect no queue interaction either way.
		const result = await (service as any).syncTaskToCalendar(ineligibleTask);

		expect(result).toBe(true);
		expect(queueSpy).not.toHaveBeenCalled();
		queueSpy.mockRestore();
	});
});