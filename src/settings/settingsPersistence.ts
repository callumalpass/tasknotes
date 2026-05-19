import { normalizePath } from "obsidian";
import { DEFAULT_NLP_TRIGGERS, DEFAULT_SETTINGS } from "./defaults";
import { hasMissingMigratedSettings } from "./settingsMigration";
import type { TaskNotesSettings } from "../types/settings";
import { initializeFieldConfig } from "../utils/fieldConfigDefaults";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Settings/SettingsPersistence" });

export type LoadedSettingsData = Partial<TaskNotesSettings> &
	Record<string, unknown> & {
		statusSuggestionTrigger?: string;
		useNativeMetadataCache?: unknown;
	};

export type SettingsDataHost = {
	app: {
		vault: {
			configDir?: string;
			adapter: {
				exists(path: string): Promise<boolean>;
			};
		};
	};
	manifest: {
		dir?: string;
		id?: string;
	};
	loadData(): Promise<LoadedSettingsData | null>;
};

export type SettingsDataReadResult = {
	data: LoadedSettingsData | null;
	compromised: boolean;
};

export type SettingsBuildResult = {
	settings: TaskNotesSettings;
	shouldPersistMigratedSettings: boolean;
};

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getPluginDataPath(host: SettingsDataHost): string | null {
	const pluginDir =
		host.manifest.dir ??
		(host.app.vault.configDir && host.manifest.id
			? `${host.app.vault.configDir}/plugins/${host.manifest.id}`
			: undefined);

	return pluginDir ? normalizePath(`${pluginDir}/data.json`) : null;
}

export async function pluginDataFileExists(host: SettingsDataHost): Promise<boolean> {
	const dataPath = getPluginDataPath(host);
	if (!dataPath) {
		return false;
	}

	try {
		return await host.app.vault.adapter.exists(dataPath);
	} catch (error) {
		tasknotesLogger.warn("[TaskNotes] Could not check settings data file existence:", {
			category: "configuration",
			operation: "check-settings-data-file-existence",
			error: error,
		});
		return false;
	}
}

export async function loadPluginSettingsDataWithRetry(
	host: SettingsDataHost,
	options: { retryCount?: number; retryDelayMs?: number } = {}
): Promise<SettingsDataReadResult> {
	const retryCount = options.retryCount ?? 3;
	const retryDelayMs = options.retryDelayMs ?? 50;

	const loadedData = await host.loadData();
	if (loadedData !== null) {
		return { data: loadedData, compromised: false };
	}

	if (!(await pluginDataFileExists(host))) {
		return { data: null, compromised: false };
	}

	for (let attempt = 0; attempt < retryCount; attempt++) {
		await delay(retryDelayMs);
		const retryData = await host.loadData();
		if (retryData !== null) {
			return { data: retryData, compromised: false };
		}
	}

	return { data: null, compromised: true };
}

function migrateLoadedSettingsData(data: LoadedSettingsData | null): LoadedSettingsData | null {
	if (!data) {
		return null;
	}

	const migratedData: LoadedSettingsData = { ...data };

	// Migration: Remove old useNativeMetadataCache setting if it exists.
	delete migratedData.useNativeMetadataCache;

	// Migration: Add API settings defaults if they don't exist.
	if (typeof migratedData.enableAPI === "undefined") {
		migratedData.enableAPI = false;
	}
	if (typeof migratedData.apiPort === "undefined") {
		migratedData.apiPort = 8080;
	}
	if (typeof migratedData.apiAuthToken === "undefined") {
		migratedData.apiAuthToken = "";
	}
	if (typeof migratedData.enableMCP === "undefined") {
		migratedData.enableMCP = false;
	}

	// Migration: Migrate statusSuggestionTrigger to nlpTriggers if needed.
	if (!migratedData.nlpTriggers && migratedData.statusSuggestionTrigger !== undefined) {
		migratedData.nlpTriggers = {
			triggers: [...DEFAULT_NLP_TRIGGERS.triggers],
		};

		const statusTriggerIndex = migratedData.nlpTriggers.triggers.findIndex(
			(trigger) => trigger.propertyId === "status"
		);
		if (statusTriggerIndex !== -1 && migratedData.statusSuggestionTrigger) {
			migratedData.nlpTriggers.triggers[statusTriggerIndex].trigger =
				migratedData.statusSuggestionTrigger;
		}
	}

	// Migration: Initialize modal fields configuration if not present.
	if (!migratedData.modalFieldsConfig) {
		migratedData.modalFieldsConfig = initializeFieldConfig(undefined, migratedData.userFields);
	}

	// Migration: Force enableBases to true (issue #1187).
	if (migratedData.enableBases === false) {
		migratedData.enableBases = true;
	}

	return migratedData;
}

export function buildSettingsFromLoadedData(data: LoadedSettingsData | null): SettingsBuildResult {
	const loadedData = migrateLoadedSettingsData(data);

	const settings: TaskNotesSettings = {
		...DEFAULT_SETTINGS,
		...loadedData,
		fieldMapping: {
			...DEFAULT_SETTINGS.fieldMapping,
			...(loadedData?.fieldMapping || {}),
		},
		taskCreationDefaults: {
			...DEFAULT_SETTINGS.taskCreationDefaults,
			...(loadedData?.taskCreationDefaults || {}),
		},
		calendarViewSettings: {
			...DEFAULT_SETTINGS.calendarViewSettings,
			...(loadedData?.calendarViewSettings || {}),
		},
		commandFileMapping: {
			...DEFAULT_SETTINGS.commandFileMapping,
			...(loadedData?.commandFileMapping || {}),
		},
		icsIntegration: {
			...DEFAULT_SETTINGS.icsIntegration,
			...(loadedData?.icsIntegration || {}),
		},
		nlpTriggers: {
			...DEFAULT_SETTINGS.nlpTriggers,
			...(loadedData?.nlpTriggers || {}),
			triggers: loadedData?.nlpTriggers?.triggers || DEFAULT_SETTINGS.nlpTriggers.triggers,
		},
		modalFieldsConfig: initializeFieldConfig(
			loadedData?.modalFieldsConfig,
			loadedData?.userFields
		),
		customStatuses: loadedData?.customStatuses || DEFAULT_SETTINGS.customStatuses,
		customPriorities: loadedData?.customPriorities || DEFAULT_SETTINGS.customPriorities,
		savedViews: loadedData?.savedViews || DEFAULT_SETTINGS.savedViews,
	};

	return {
		settings,
		shouldPersistMigratedSettings: hasMissingMigratedSettings(loadedData),
	};
}

export function buildSettingsDataForSave(
	loadedData: Record<string, unknown> | null | undefined,
	settings: TaskNotesSettings
): Record<string, unknown> {
	const data = loadedData ? { ...loadedData } : {};
	const settingsKeys = Object.keys(DEFAULT_SETTINGS) as (keyof TaskNotesSettings)[];
	for (const key of settingsKeys) {
		data[key] = settings[key];
	}
	return data;
}
