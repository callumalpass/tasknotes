import { jest } from "@jest/globals";
import TaskNotesPlugin from "../../../src/main";
import { TaskCalendarSyncService } from "../../../src/services/TaskCalendarSyncService";

function createPlugin(options: { dataFileExists: boolean }) {
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists: jest.fn().mockResolvedValue(options.dataFileExists),
			},
		},
	} as any;

	const plugin = new TaskNotesPlugin(app);
	(plugin as any).manifest = {
		id: "tasknotes",
		dir: ".obsidian/plugins/tasknotes",
		version: "4.12.1",
	};
	plugin.saveData = jest.fn().mockResolvedValue(undefined);
	return plugin;
}

describe("issue #2213 runtime plugin-data save guard", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("marks plugin-data writes unsafe when an existing data.json reads as null", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => undefined);

		const plugin = createPlugin({ dataFileExists: true });
		plugin.loadData = jest.fn().mockResolvedValue(null);

		await expect(
			plugin.loadPluginDataForSafeWrite("save-google-calendar-event-index")
		).resolves.toBeNull();

		expect(plugin.saveData).not.toHaveBeenCalled();
		expect((plugin as any).settingsLoadCompromised).toBe(true);
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining("Skipping plugin data save"),
			expect.objectContaining({
				settingsSavesBlocked: true,
			})
		);
	});

	it("still allows first writes for a new install with no data.json yet", async () => {
		const plugin = createPlugin({ dataFileExists: false });
		plugin.loadData = jest.fn().mockResolvedValue(null);

		await expect(plugin.loadPluginDataForSafeWrite("save-pomodoro-state")).resolves.toEqual({});
		expect((plugin as any).settingsLoadCompromised).toBe(false);
	});

	it("does not let Google Calendar event-index persistence replace settings after a bad read", async () => {
		const saveData = jest.fn();
		const loadPluginDataForSafeWrite = jest.fn().mockResolvedValue(null);
		const plugin = {
			settings: {
				googleCalendarExport: {
					targetCalendarId: "calendar",
				},
			},
			loadData: jest.fn().mockResolvedValue(null),
			loadPluginDataForSafeWrite,
			saveData,
		};
		const googleCalendarService = {
			getAvailableCalendars: jest.fn().mockReturnValue([]),
		};

		const service = new TaskCalendarSyncService(
			plugin as never,
			googleCalendarService as never
		) as unknown as {
			saveEventIndex(
				index: Array<{
					taskPath: string;
					calendarId: string;
					eventId: string;
					updatedAt: number;
				}>
			): Promise<void>;
		};

		await service.saveEventIndex([
			{
				taskPath: "Tasks/A.md",
				calendarId: "calendar",
				eventId: "event",
				updatedAt: 1786299074665,
			},
		]);

		expect(loadPluginDataForSafeWrite).toHaveBeenCalledWith(
			"save-google-calendar-event-index"
		);
		expect(saveData).not.toHaveBeenCalled();
	});
});
