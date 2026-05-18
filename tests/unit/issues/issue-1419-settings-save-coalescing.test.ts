import { jest } from "@jest/globals";
import TaskNotesPlugin from "../../../src/main";
import { SettingsLifecycleService } from "../../../src/services/SettingsLifecycleService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { TaskNotesSettings } from "../../../src/types/settings";

function cloneSettings(): TaskNotesSettings {
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as TaskNotesSettings;
}

function deferred<T = void>(): {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
} {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, resolve, reject };
}

function createPluginForDataSave(): TaskNotesPlugin {
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists: jest.fn().mockResolvedValue(false),
			},
		},
	} as any;
	const plugin = new TaskNotesPlugin(app);
	(plugin as any).manifest = {
		id: "tasknotes",
		dir: ".obsidian/plugins/tasknotes",
		version: "4.3.2",
	};
	plugin.settings = cloneSettings();
	return plugin;
}

function createLifecyclePlugin(saveSettingsDataOnly: jest.Mock): any {
	return {
		settings: cloneSettings(),
		saveSettingsDataOnly,
		apiService: { syncWebhookSettings: jest.fn() },
		fieldMapper: {
			updateMapping: jest.fn(),
			updateUserFields: jest.fn(),
			updateConfiguredValues: jest.fn(),
		},
		statusManager: {
			updateStatuses: jest.fn(),
			isCompletedStatus: jest.fn(),
		},
		priorityManager: {
			updatePriorities: jest.fn(),
		},
		cacheManager: { updateConfig: jest.fn() },
		dependencyCache: { updateConfig: jest.fn() },
		injectCustomStyles: jest.fn(),
		statusBarService: { updateVisibility: jest.fn() },
		mdbaseSpecService: { onSettingsChanged: jest.fn() },
		filterService: { refreshFilterOptions: jest.fn() },
		notifyDataChanged: jest.fn(),
		emitter: {
			trigger: jest.fn(),
			on: jest.fn(),
			offref: jest.fn(),
		},
	};
}

describe("settings save coalescing", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("serializes settings data writes and collapses overlapping requests into the latest follow-up write", async () => {
		const firstWrite = deferred();
		const plugin = createPluginForDataSave();
		plugin.loadData = jest.fn().mockResolvedValue({});
		plugin.saveData = jest
			.fn()
			.mockImplementationOnce(() => firstWrite.promise)
			.mockResolvedValue(undefined);

		const firstSave = plugin.saveSettingsDataOnly();
		await Promise.resolve();
		await Promise.resolve();
		expect(plugin.saveData).toHaveBeenCalledTimes(1);

		plugin.settings.taskTag = "tasknotes-latest";
		const secondSave = plugin.saveSettingsDataOnly();
		const thirdSave = plugin.saveSettingsDataOnly();

		expect(plugin.saveData).toHaveBeenCalledTimes(1);

		firstWrite.resolve(undefined);
		await Promise.all([firstSave, secondSave, thirdSave]);

		expect(plugin.saveData).toHaveBeenCalledTimes(2);
		expect(plugin.saveData).toHaveBeenLastCalledWith(
			expect.objectContaining({
				taskTag: "tasknotes-latest",
			})
		);
	});

	it("coalesces overlapping full settings saves and applies lifecycle updates once for the latest state", async () => {
		const firstDataSave = deferred();
		const saveSettingsDataOnly = jest
			.fn()
			.mockImplementationOnce(() => firstDataSave.promise)
			.mockResolvedValue(undefined);
		const plugin = createLifecyclePlugin(saveSettingsDataOnly);
		const service = new SettingsLifecycleService(plugin);

		const firstSave = service.saveSettings();
		expect(saveSettingsDataOnly).toHaveBeenCalledTimes(1);

		plugin.settings.taskTag = "tasknotes-latest";
		const secondSave = service.saveSettings();
		const thirdSave = service.saveSettings();

		expect(saveSettingsDataOnly).toHaveBeenCalledTimes(1);

		firstDataSave.resolve(undefined);
		await Promise.all([firstSave, secondSave, thirdSave]);

		expect(saveSettingsDataOnly).toHaveBeenCalledTimes(2);
		expect(plugin.apiService.syncWebhookSettings).toHaveBeenCalledTimes(1);
		expect(plugin.fieldMapper.updateMapping).toHaveBeenCalledTimes(1);
		expect(plugin.cacheManager.updateConfig).toHaveBeenCalledTimes(1);
		expect(plugin.notifyDataChanged).toHaveBeenCalledTimes(1);
		expect(plugin.emitter.trigger).toHaveBeenCalledTimes(1);
		expect(plugin.emitter.trigger).toHaveBeenCalledWith("settings-changed", plugin.settings);
	});
});
