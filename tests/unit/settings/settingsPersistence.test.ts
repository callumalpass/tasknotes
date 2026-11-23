import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import {
	buildSettingsDataForSave,
	buildSettingsFromLoadedData,
	getPluginDataPath,
	loadPluginSettingsDataWithRetry,
	pluginDataFileExists,
} from "../../../src/settings/settingsPersistence";
import type { TaskNotesSettings } from "../../../src/types/settings";

function createHost(options: {
	dir?: string;
	id?: string;
	configDir?: string;
	dataFileExists?: boolean;
	loadResults?: Array<Record<string, unknown> | null | undefined>;
}) {
	const loadResults = [...(options.loadResults ?? [])];
	return {
		app: {
			vault: {
				configDir: options.configDir,
				adapter: {
					exists: jest.fn().mockResolvedValue(options.dataFileExists ?? false),
				},
			},
		},
		manifest: {
			dir: options.dir,
			id: options.id,
		},
		loadData: jest
			.fn()
			.mockImplementation(() =>
				Promise.resolve(loadResults.length > 0 ? loadResults.shift() : null)
			),
	};
}

describe("settings persistence helpers", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("moves saved legacy completion and estimate defaults to the new bindings", () => {
		const data = {
			taskListShortcuts: { ...DEFAULT_SETTINGS.taskListShortcuts, "mark-complete": ["e"], "edit-time-estimate": ["t"] },
		};
		const result = buildSettingsFromLoadedData(data);
		expect(result.settings.taskListShortcuts["mark-complete"]).toEqual(["shift+m"]);
		expect(result.settings.taskListShortcuts["edit-time-estimate"]).toEqual(["shift+t"]);
		expect(result.shouldPersistMigratedSettings).toBe(true);
	});

	it("preserves custom shortcuts, disabled actions, and occupied replacement keys", () => {
		const result = buildSettingsFromLoadedData({
			taskListShortcuts: {
				...DEFAULT_SETTINGS.taskListShortcuts,
				"mark-complete": ["e", "shift+c"],
				"edit-time-estimate": ["t"],
				"edit-recurrence": [],
			},
			taskListUserFieldShortcuts: { example: ["shift+t"] },
		});
		expect(result.settings.taskListShortcuts["mark-complete"]).toEqual(["e", "shift+c"]);
		expect(result.settings.taskListShortcuts["edit-time-estimate"]).toEqual(["t"]);
		expect(result.settings.taskListShortcuts["edit-recurrence"]).toEqual([]);
		expect(result.settings.taskListUserFieldShortcuts.example).toEqual(["shift+t"]);
	});

	it("keeps recurring statuses in saved setups and resets them in new ones (#2521)", () => {
		expect(
			buildSettingsFromLoadedData({ defaultTaskStatus: "inbox" }).settings
				.resetRecurringStatusAfterOccurrence
		).toBe(false);
		expect(buildSettingsFromLoadedData(null).settings.resetRecurringStatusAfterOccurrence).toBe(
			true
		);
	});

	it("stores Pomodoro history in daily notes for new installs and plugin data for saved setups", () => {
		expect(
			buildSettingsFromLoadedData({ defaultTaskStatus: "inbox" }).settings.pomodoroStorageLocation
		).toBe("plugin");
		expect(buildSettingsFromLoadedData(null).settings.pomodoroStorageLocation).toBe("daily-notes");
	});

	it("builds the plugin data path from manifest dir first", () => {
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			configDir: ".config",
			id: "ignored",
		});

		expect(getPluginDataPath(host)).toBe(".obsidian/plugins/tasknotes/data.json");
	});

	it("falls back to vault configDir and manifest id for the plugin data path", () => {
		const host = createHost({
			configDir: ".obsidian",
			id: "tasknotes",
		});

		expect(getPluginDataPath(host)).toBe(".obsidian/plugins/tasknotes/data.json");
	});

	it("treats settings reads as compromised after retrying an existing data file", async () => {
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			dataFileExists: true,
			loadResults: [null, null, null, null],
		});

		await expect(loadPluginSettingsDataWithRetry(host, { retryDelayMs: 0 })).resolves.toEqual({
			data: null,
			compromised: true,
			failure: { reason: "no-settings-data" },
		});
		// The first read plus 20 retries, about two seconds at the default delay.
		expect(host.loadData).toHaveBeenCalledTimes(21);
	});

	it("does not mark a new install as compromised when data.json is absent", async () => {
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			dataFileExists: false,
			loadResults: [null],
		});

		await expect(loadPluginSettingsDataWithRetry(host, { retryDelayMs: 0 })).resolves.toEqual({
			data: null,
			compromised: false,
		});
		expect(host.loadData).toHaveBeenCalledTimes(1);
	});

	it("retries an undefined read without relying on the existence probe", async () => {
		const recoveredData = { tasksFolder: "Projects/Tasks" };
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			dataFileExists: false,
			loadResults: [undefined, recoveredData],
		});

		await expect(loadPluginSettingsDataWithRetry(host, { retryDelayMs: 0 })).resolves.toEqual({
			data: recoveredData,
			compromised: false,
		});
		expect(host.loadData).toHaveBeenCalledTimes(2);
		expect(host.app.vault.adapter.exists).not.toHaveBeenCalled();
	});

	it("keeps startup blocked if an undefined read is followed by a null read", async () => {
		const host = createHost({ dir: ".obsidian/plugins/tasknotes", loadResults: [undefined, null] });

		await expect(loadPluginSettingsDataWithRetry(host, { retryCount: 1, retryDelayMs: 0 })).resolves.toEqual({
			data: null,
			compromised: true,
			failure: { reason: "no-settings-data" },
		});
		expect(host.app.vault.adapter.exists).not.toHaveBeenCalled();
	});

	it.each([0, 1])("retries a rejection after %i null reads", async (nullReads) => {
		const recoveredData = { tasksFolder: "Projects/Tasks" };
		const host = createHost({ dir: ".obsidian/plugins/tasknotes", dataFileExists: true, loadResults: [recoveredData] });
		if (nullReads) host.loadData.mockResolvedValueOnce(null);
		host.loadData.mockRejectedValueOnce(Object.assign(new Error("Timed out"), { code: "ETIMEDOUT" }));

		await expect(loadPluginSettingsDataWithRetry(host, { retryDelayMs: 0 })).resolves.toEqual({
			data: recoveredData,
			compromised: false,
		});
		expect(host.loadData).toHaveBeenCalledTimes(nullReads + 2);
	});

	it("blocks startup after rejected reads and reports the error code without the message", async () => {
		const host = createHost({ dir: ".obsidian/plugins/tasknotes" });
		host.loadData.mockRejectedValue(Object.assign(new Error("Private path"), { code: "ETIMEDOUT" }));

		await expect(loadPluginSettingsDataWithRetry(host, { retryCount: 2, retryDelayMs: 0 })).resolves.toEqual({
			data: null,
			compromised: true,
			failure: { reason: "settings-read-error", errorCode: "ETIMEDOUT" },
		});
		expect(host.loadData).toHaveBeenCalledTimes(3);
		expect(host.app.vault.adapter.exists).not.toHaveBeenCalled();
	});

	it("does not interpret an existence probe error as an absent settings file", async () => {
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			dataFileExists: true,
		});
		host.app.vault.adapter.exists.mockRejectedValueOnce(new Error("adapter failed"));
		jest.spyOn(console, "warn").mockImplementation(() => undefined);

		await expect(pluginDataFileExists(host)).rejects.toThrow("adapter failed");
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining(
				"[TaskNotes][Settings/SettingsPersistence][configuration][check-settings-data-file-existence] [TaskNotes] Could not check settings data file existence:"
			),
			expect.any(Error)
		);
	});

	it("marks settings as compromised when the existence probe fails after a null read", async () => {
		const host = createHost({ dir: ".obsidian/plugins/tasknotes", loadResults: [null] });
		host.app.vault.adapter.exists.mockRejectedValueOnce(new Error("I/O error"));
		jest.spyOn(console, "warn").mockImplementation(() => undefined);
		await expect(loadPluginSettingsDataWithRetry(host, { retryCount: 1, retryDelayMs: 0 })).resolves.toEqual({
			data: null,
			compromised: true,
			failure: { reason: "settings-existence-check-error" },
		});
		expect(host.loadData).toHaveBeenCalledTimes(2);
	});

	it("loads settings that become readable after the existence probe fails", async () => {
		const recoveredData = { tasksFolder: "Projects/Tasks" };
		const host = createHost({ dir: ".obsidian/plugins/tasknotes", loadResults: [null, recoveredData] });
		host.app.vault.adapter.exists.mockRejectedValueOnce(new Error("Timed out"));
		jest.spyOn(console, "warn").mockImplementation(() => undefined);

		await expect(loadPluginSettingsDataWithRetry(host, { retryCount: 1, retryDelayMs: 0 })).resolves.toEqual({
			data: recoveredData,
			compromised: false,
		});
	});

	it("migrates a legacy custom property before indexing without dropping colliding names", () => {
		const original = {
			userField: {
				enabled: true,
				key: "legacy",
				displayName: "Client",
				type: "text" as const,
			},
			userFields: [
				{ id: "client", key: "other", displayName: "Client", type: "text" as const },
			],
		};
		const { settings, shouldPersistMigratedSettings } = buildSettingsFromLoadedData(original);
		expect(settings.userFields).toEqual([
			original.userFields[0],
			{ id: "client-2", key: "legacy", displayName: "Client", type: "text" },
		]);
		expect(settings.userField.enabled).toBe(false);
		expect(original.userField.enabled).toBe(true);
		expect(shouldPersistMigratedSettings).toBe(true);
		expect(buildSettingsFromLoadedData(settings).settings.userFields).toHaveLength(2);
	});

	it("migrates legacy settings and preserves explicit false/null nested defaults", () => {
		const { settings, shouldPersistMigratedSettings } = buildSettingsFromLoadedData({
			statusSuggestionTrigger: "/",
			useNativeMetadataCache: true,
			enableBases: false,
			calendarViewSettings: {
				showWeekends: false,
			},
			googleCalendarExport: {
				defaultReminderMinutes: null,
			},
		});

		expect("enableBases" in settings).toBe(false);
		expect("statusSuggestionTrigger" in settings).toBe(false);
		expect(settings.enableAPI).toBe(false);
		expect(settings.apiPort).toBe(8080);
		expect(settings.apiAuthToken).toBe("");
		expect(settings.enableMCP).toBe(false);
		expect("useNativeMetadataCache" in settings).toBe(false);
		expect(
			settings.nlpTriggers.triggers.find((trigger) => trigger.propertyId === "status")
		).toMatchObject({ trigger: "/" });
		expect(settings.calendarViewSettings.showWeekends).toBe(false);
		expect(settings.googleCalendarExport.defaultReminderMinutes).toBeNull();
		expect(settings.modalFieldsConfig?.fields.map((field) => field.id)).toEqual(
			expect.arrayContaining(["title", "details", "contexts", "tags", "projects"])
		);
		expect(shouldPersistMigratedSettings).toBe(true);
	});

	it("derives the normal task creation parent-note project setting from the legacy shared setting", () => {
		const legacyTaskCreationDefaults: Partial<TaskNotesSettings["taskCreationDefaults"]> = {
			...DEFAULT_SETTINGS.taskCreationDefaults,
			useParentNoteAsProject: true,
		};
		delete legacyTaskCreationDefaults.useParentNoteForTaskCreation;
		const { settings, shouldPersistMigratedSettings } = buildSettingsFromLoadedData({
			fieldMapping: DEFAULT_SETTINGS.fieldMapping,
			calendarViewSettings: DEFAULT_SETTINGS.calendarViewSettings,
			commandFileMapping: DEFAULT_SETTINGS.commandFileMapping,
			taskCreationDefaults:
				legacyTaskCreationDefaults as TaskNotesSettings["taskCreationDefaults"],
		});

		expect(settings.taskCreationDefaults.useParentNoteAsProject).toBe(true);
		expect(settings.taskCreationDefaults.useParentNoteForTaskCreation).toBe(true);
		expect(shouldPersistMigratedSettings).toBe(true);
	});

	it("preserves an explicit normal task creation parent-note project setting", () => {
		const { settings, shouldPersistMigratedSettings } = buildSettingsFromLoadedData({
			fieldMapping: DEFAULT_SETTINGS.fieldMapping,
			calendarViewSettings: DEFAULT_SETTINGS.calendarViewSettings,
			commandFileMapping: DEFAULT_SETTINGS.commandFileMapping,
			taskCreationDefaults: {
				...DEFAULT_SETTINGS.taskCreationDefaults,
				useParentNoteAsProject: true,
				useParentNoteForTaskCreation: false,
			},
		});

		expect(settings.taskCreationDefaults.useParentNoteAsProject).toBe(true);
		expect(settings.taskCreationDefaults.useParentNoteForTaskCreation).toBe(false);
		expect(shouldPersistMigratedSettings).toBe(false);
	});

	it("starts mdbase type definitions on for new installs only", () => {
		expect(buildSettingsFromLoadedData(null).settings.enableMdbaseSpec).toBe(true);
		expect(buildSettingsFromLoadedData({ enableMdbaseSpec: false } as any).settings.enableMdbaseSpec).toBe(false);
		expect(buildSettingsFromLoadedData({ tasksFolder: "Tasks" } as any).settings.enableMdbaseSpec).toBe(false);
	});

	it("merges only known settings keys into saved data while preserving other persisted data", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			tasksFolder: "Projects/Tasks",
			unknownRuntimeKey: "do not write from settings",
		} as TaskNotesSettings & { unknownRuntimeKey: string };

		expect(
			buildSettingsDataForSave(
				{
					pomodoroState: { isRunning: true },
					unknownRuntimeKey: "preserve disk value",
					tasksFolder: "Old/Tasks",
				},
				settings
			)
		).toEqual(
			expect.objectContaining({
				pomodoroState: { isRunning: true },
				unknownRuntimeKey: "preserve disk value",
				tasksFolder: "Projects/Tasks",
			})
		);
	});

	it("keeps settings retired in v5 in data.json for devices still on v4", () => {
		const loaded = {
			viewsButtonAlignment: "left",
			disableNoteIndexing: true,
			savedViews: [{ id: "sv1", name: "My view" }],
			projectAutosuggest: { ...DEFAULT_SETTINGS.projectAutosuggest, enableFuzzy: true },
			calendarViewSettings: {
				...DEFAULT_SETTINGS.calendarViewSettings,
				defaultShowICSEvents: false,
				eventMaxStack: 3,
			},
		};
		const { settings } = buildSettingsFromLoadedData(loaded);
		settings.tasksFolder = "Projects/Tasks";

		expect(buildSettingsDataForSave(loaded, settings)).toEqual(
			expect.objectContaining({
				tasksFolder: "Projects/Tasks",
				viewsButtonAlignment: "left",
				disableNoteIndexing: true,
				savedViews: [{ id: "sv1", name: "My view" }],
				projectAutosuggest: expect.objectContaining({ enableFuzzy: true }),
				calendarViewSettings: expect.objectContaining({
					defaultShowICSEvents: false,
					eventMaxStack: 3,
				}),
			})
		);
	});
});
