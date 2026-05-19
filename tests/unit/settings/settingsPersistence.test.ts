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
	loadResults?: Array<Record<string, unknown> | null>;
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
		loadData: jest.fn().mockImplementation(() => Promise.resolve(loadResults.shift() ?? null)),
	};
}

describe("settings persistence helpers", () => {
	afterEach(() => {
		jest.restoreAllMocks();
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

		await expect(
			loadPluginSettingsDataWithRetry(host, { retryDelayMs: 0 })
		).resolves.toEqual({
			data: null,
			compromised: true,
		});
		expect(host.loadData).toHaveBeenCalledTimes(4);
	});

	it("does not mark a new install as compromised when data.json is absent", async () => {
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			dataFileExists: false,
			loadResults: [null],
		});

		await expect(
			loadPluginSettingsDataWithRetry(host, { retryDelayMs: 0 })
		).resolves.toEqual({
			data: null,
			compromised: false,
		});
		expect(host.loadData).toHaveBeenCalledTimes(1);
	});

	it("returns false when checking data file existence fails", async () => {
		const host = createHost({
			dir: ".obsidian/plugins/tasknotes",
			dataFileExists: true,
		});
		host.app.vault.adapter.exists.mockRejectedValueOnce(new Error("adapter failed"));
		jest.spyOn(console, "warn").mockImplementation(() => undefined);

		await expect(pluginDataFileExists(host)).resolves.toBe(false);
		expect(console.warn).toHaveBeenCalledWith(
			"[TaskNotes] Could not check settings data file existence:",
			expect.any(Error)
		);
	});

	it("migrates legacy settings and preserves explicit false/null nested defaults", () => {
		const { settings, shouldPersistMigratedSettings } = buildSettingsFromLoadedData({
			statusSuggestionTrigger: "/",
			useNativeMetadataCache: true,
			enableBases: false,
			calendarViewSettings: {
				defaultShowScheduledToDueSpan: false,
				eventMaxStack: null,
			},
		});

		expect(settings.enableBases).toBe(true);
		expect(settings.enableAPI).toBe(false);
		expect(settings.apiPort).toBe(8080);
		expect(settings.apiAuthToken).toBe("");
		expect(settings.enableMCP).toBe(false);
		expect("useNativeMetadataCache" in settings).toBe(false);
		expect(settings.nlpTriggers.triggers.find((trigger) => trigger.propertyId === "status"))
			.toMatchObject({ trigger: "/" });
		expect(settings.calendarViewSettings.defaultShowScheduledToDueSpan).toBe(false);
		expect(settings.calendarViewSettings.eventMaxStack).toBeNull();
		expect(settings.modalFieldsConfig?.fields.map((field) => field.id)).toEqual(
			expect.arrayContaining(["title", "details", "contexts", "tags", "projects"])
		);
		expect(shouldPersistMigratedSettings).toBe(true);
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
});
