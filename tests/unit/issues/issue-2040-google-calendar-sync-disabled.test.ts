/**
 * Regression coverage for Issue #2040: the Google Calendar retry queue must
 * stay empty when calendar export is disabled.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2040
 */

import { describe, expect, it, jest } from "@jest/globals";
import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";
import { TaskCreationService } from "../../../src/services/task-service/TaskCreationService";
import { DEFAULT_GOOGLE_CALENDAR_EXPORT } from "../../../src/settings/defaults";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

jest.mock("../../../src/utils/dateUtils", () => ({
	getCurrentTimestamp: jest.fn(() => "2026-08-01T00:00:00+10:00"),
}));

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn(() => "calendar-disabled-task"),
	generateUniqueFilename: jest.fn(() => "calendar-disabled-task"),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

function createTaskCreationService(enabled: boolean) {
	const plugin = PluginFactory.createMockPlugin();
	plugin.settings.googleCalendarExport = {
		...DEFAULT_GOOGLE_CALENDAR_EXPORT,
		enabled,
		syncOnTaskCreate: true,
	};
	plugin.taskCalendarSyncService = {
		syncTaskToCalendar: jest.fn().mockResolvedValue(true),
	} as any;

	const service = new TaskCreationService({
		runtime: plugin,
		applyTaskCreationDefaults: jest.fn(async (taskData) => taskData),
		applyTemplate: jest.fn(async () => ({ frontmatter: {}, body: "" })),
		processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
		sanitizeTitleForFilename: jest.fn((input) => input),
		sanitizeTitleForStorage: jest.fn((input) => input),
	});

	return { plugin, service };
}

describe("Issue #2040: Google Calendar sync disabled", () => {
	it("does not request calendar sync when creating a task", async () => {
		const { plugin, service } = createTaskCreationService(false);

		await service.createTask(
			{ title: "Calendar disabled task", scheduled: "2026-08-02" },
			{ applyDefaults: false }
		);

		expect(plugin.taskCalendarSyncService?.syncTaskToCalendar).not.toHaveBeenCalled();
	});

	it("still requests calendar sync on creation when export is enabled", async () => {
		const { plugin, service } = createTaskCreationService(true);

		await service.createTask(
			{ title: "Calendar enabled task", scheduled: "2026-08-02" },
			{ applyDefaults: false }
		);

		expect(plugin.taskCalendarSyncService?.syncTaskToCalendar).toHaveBeenCalledTimes(1);
	});

	it("does not persist retry work when sync is called defensively", async () => {
		const pluginData: Record<string, unknown> = {};
		const plugin = PluginFactory.createMockPlugin();
		plugin.settings.googleCalendarExport = {
			...DEFAULT_GOOGLE_CALENDAR_EXPORT,
			enabled: false,
			syncOnTaskCreate: true,
			syncTrigger: "scheduled",
		};
		plugin.loadData = jest.fn().mockResolvedValue(pluginData);
		plugin.saveData = jest.fn().mockResolvedValue(undefined);
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([]),
			createEvent: jest.fn(),
		};
		const syncService = new TaskCalendarSyncService(plugin, googleCalendarService as any);

		const synced = await syncService.syncTaskToCalendar(
			TaskFactory.createTask({
				path: "Tasks/calendar-disabled-task.md",
				scheduled: "2026-08-02",
			})
		);

		expect(synced).toBe(false);
		expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(pluginData).not.toHaveProperty("googleCalendarSyncQueue");
	});
});
