import { normalizePath } from "obsidian";
import { DEFAULT_NLP_TRIGGERS, DEFAULT_SETTINGS } from "./defaults";
import { hasMissingMigratedSettings } from "./settingsMigration";
import type {
	PropertyTriggerConfig,
	TaskCreationDefaults,
	TaskNotesSettings,
} from "../types/settings";
import { initializeFieldConfig } from "../utils/fieldConfigDefaults";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import {
	DEFAULT_TASK_LIST_SHORTCUTS,
	findTaskListShortcutOwners,
	normalizeTaskListShortcut,
	normalizeTaskListShortcutMap,
} from "../bases/taskListKeyboardActions";

const tasknotesLogger = createTaskNotesLogger({ tag: "Settings/SettingsPersistence" });

export type LoadedSettingsData = Partial<TaskNotesSettings> &
	Record<string, unknown> & {
		statusSuggestionTrigger?: string;
		enableBases?: unknown;
		useNativeMetadataCache?: unknown;
		keyboardShortcuts?: Record<string, readonly string[]>;
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
	loadData(): Promise<LoadedSettingsData | null | undefined>;
};

export type SettingsDataReadResult = {
	data: LoadedSettingsData | null;
	compromised: boolean;
};

export type SettingsBuildResult = {
	settings: TaskNotesSettings;
	shouldPersistMigratedSettings: boolean;
};

function hasOwnSetting<T extends object>(settings: T, key: PropertyKey): boolean {
	return Object.prototype.hasOwnProperty.call(settings, key);
}

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
		throw error;
	}
}

export async function loadPluginSettingsDataWithRetry(
	host: SettingsDataHost,
	options: { retryCount?: number; retryDelayMs?: number } = {}
): Promise<SettingsDataReadResult> {
	// While Obsidian updates a plugin, the outgoing version can still be writing
	// data.json when the new version reads it (#1591, #2559). Wait up to about two
	// seconds for that write to finish before treating the file as unreadable.
	const retryCount = options.retryCount ?? 20;
	const retryDelayMs = options.retryDelayMs ?? 100;

	const loadedData = (await host.loadData()) ?? null;
	if (loadedData !== null) {
		return { data: loadedData, compromised: false };
	}

	try {
		if (!(await pluginDataFileExists(host))) {
			return { data: null, compromised: false };
		}
	} catch {
		// Unknown is not absent. Abort startup rather than saving defaults over
		// possibly existing settings after an I/O or Sync existence-probe error.
		return { data: null, compromised: true };
	}

	for (let attempt = 0; attempt < retryCount; attempt++) {
		await delay(retryDelayMs);
		const retryData = (await host.loadData()) ?? null;
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

	// Migration from the v3 custom branch. Only actions that still exist in the
	// current semantic action layer are carried forward.
	if (!migratedData.taskListShortcuts && migratedData.keyboardShortcuts) {
		const legacy = migratedData.keyboardShortcuts;
		migratedData.taskListShortcuts = normalizeTaskListShortcutMap({
			"navigate-next": legacy.navigateDown,
			"navigate-previous": legacy.navigateUp,
			"clear-focus-and-selection": legacy.clearFocusAndSelection,
			"toggle-select": legacy.toggleSelect,
			"select-all": legacy.selectAll,
			"copy-task-titles": legacy.copyTaskTitles,
			"toggle-archive": legacy.toggleArchive,
			"create-task": legacy.newTask,
			"focus-search": legacy.focusFilter,
			"edit-task": legacy.openEdit,
			"open-task-notes": legacy.openInNewPane,
			"edit-due": legacy.editDueDates,
			"edit-scheduled": legacy.editScheduleDates,
			"edit-priority": legacy.editPriorities,
			"edit-status": legacy.editStatuses,
			"edit-recurrence": legacy.editRecurrence,
			"add-tags": legacy.editTags,
			"add-context": legacy.editContexts,
			"add-project": legacy.editProjects,
			"delete-tasks": legacy.deleteTasks,
		});
		delete migratedData.keyboardShortcuts;
	}

	// Migration: Remove old useNativeMetadataCache setting if it exists.
	delete migratedData.useNativeMetadataCache;

	// Migration: a completed status's Next status used to be only where reopening
	// a task goes. Existing setups keep their recurring series' status unless the
	// reset is turned on explicitly (#2521).
	if (typeof migratedData.resetRecurringStatusAfterOccurrence === "undefined") {
		migratedData.resetRecurringStatusAfterOccurrence = false;
	}

	// Migration: Pomodoro history now defaults to daily notes. Settings saved
	// without the option predate it and keep their history in plugin data.
	if (typeof migratedData.pomodoroStorageLocation === "undefined") {
		migratedData.pomodoroStorageLocation = "plugin";
	}

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
	// nlpTriggers is now the only status trigger. The saved key is left for 4.x devices.
	delete migratedData.statusSuggestionTrigger;

	// Legacy single custom fields used to migrate only when their settings card opened.
	// Native settings indexing must be read-only, so migrate during settings load instead.
	if (migratedData.userField?.enabled) {
		const legacy = migratedData.userField;
		const fields = [...(migratedData.userFields ?? [])];
		const baseId = (legacy.displayName || legacy.key || "field")
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "-");
		if (!fields.some((field) => field.key === legacy.key)) {
			let id = baseId;
			let suffix = 2;
			while (fields.some((field) => field.id === id)) id = `${baseId}-${suffix++}`;
			fields.push({
				id,
				displayName: legacy.displayName || "",
				key: legacy.key || "",
				type: legacy.type || "text",
			});
		}
		migratedData.userFields = fields;
		migratedData.userField = { ...legacy, enabled: false };
	}

	// Normalize accidental surrounding whitespace in configured frontmatter keys.
	if (Array.isArray(migratedData.userFields)) {
		migratedData.userFields = migratedData.userFields.map((field) => ({
			...field,
			key: typeof field.key === "string" ? field.key.trim() : field.key,
		}));
	}

	// Migration: Initialize modal fields configuration if not present.
	if (!migratedData.modalFieldsConfig) {
		migratedData.modalFieldsConfig = initializeFieldConfig(undefined, migratedData.userFields);
	}

	// Bases integration is always enabled (issue #1187). The saved key is left for 4.x devices.
	delete migratedData.enableBases;

	// mdbase type definitions start on only for new installs. Existing settings keep
	// them off, as earlier versions did, because a device still on 4.x can overwrite
	// the v5 type; turning them on is a step in the TaskNotes App setup.
	if (typeof migratedData.enableMdbaseSpec === "undefined") {
		migratedData.enableMdbaseSpec = false;
	}

	// Migration: Update the unused legacy default custom filename template to the
	// preferred double-brace syntax while preserving active custom templates.
	if (
		migratedData.taskFilenameFormat !== "custom" &&
		migratedData.customFilenameTemplate === "{title}"
	) {
		migratedData.customFilenameTemplate = "{{title}}";
	}

	return migratedData;
}

function shouldMigrateParentNoteTaskCreationDefault(
	loadedData: LoadedSettingsData | null
): boolean {
	const loadedDefaults = loadedData?.taskCreationDefaults;
	return Boolean(
		loadedDefaults &&
			!hasOwnSetting(loadedDefaults, "useParentNoteForTaskCreation") &&
			typeof loadedDefaults.useParentNoteAsProject === "boolean"
	);
}

function buildTaskCreationDefaults(
	loadedDefaults: LoadedSettingsData["taskCreationDefaults"] | undefined
): TaskCreationDefaults {
	const defaults: TaskCreationDefaults = {
		...DEFAULT_SETTINGS.taskCreationDefaults,
		...(loadedDefaults || {}),
	};

	if (
		loadedDefaults &&
		!hasOwnSetting(loadedDefaults, "useParentNoteForTaskCreation") &&
		typeof loadedDefaults.useParentNoteAsProject === "boolean"
	) {
		defaults.useParentNoteForTaskCreation = loadedDefaults.useParentNoteAsProject;
	}

	return defaults;
}

/**
 * Resolves saved NLP triggers the way the settings tab displays them, so the parser uses
 * what the user sees: built-in triggers missing from saved data take their defaults,
 * surrounding whitespace is dropped, and an empty trigger falls back to its default.
 */
function normalizeNLPTriggers(
	saved: PropertyTriggerConfig[] | undefined
): PropertyTriggerConfig[] {
	const defaults = new Map(DEFAULT_NLP_TRIGGERS.triggers.map((trigger) => [trigger.propertyId, trigger]));
	const seen = new Set<string>();
	const triggers: PropertyTriggerConfig[] = [];

	for (const entry of Array.isArray(saved) ? saved : []) {
		const propertyId = typeof entry?.propertyId === "string" ? entry.propertyId : "";
		if (!propertyId || seen.has(propertyId)) continue;
		seen.add(propertyId);
		const trigger = typeof entry.trigger === "string" ? entry.trigger.trim() : "";
		triggers.push({
			propertyId,
			trigger: trigger || defaults.get(propertyId)?.trigger || `${propertyId}:`,
			enabled:
				typeof entry.enabled === "boolean" ? entry.enabled : propertyId !== "priority",
		});
	}

	for (const builtIn of DEFAULT_NLP_TRIGGERS.triggers) {
		if (!seen.has(builtIn.propertyId)) triggers.push({ ...builtIn });
	}

	return triggers;
}

/** Replaces saved old defaults when the new key is free, preserving custom bindings. */
function migrateConflictingTaskShortcutDefaults(settings: TaskNotesSettings): boolean {
	const shortcuts = settings.taskListShortcuts;
	const userFieldKeys = new Set(
		Object.values(settings.taskListUserFieldShortcuts).flat().map(normalizeTaskListShortcut)
	);
	let changed = false;
	for (const [action, oldKey] of [["mark-complete", "e"], ["edit-time-estimate", "t"]] as const) {
		const [newKey] = DEFAULT_TASK_LIST_SHORTCUTS[action];
		// An exact old default is the only saved value we can safely treat as unchanged.
		if (shortcuts[action].length !== 1 || shortcuts[action][0] !== oldKey ||
			userFieldKeys.has(newKey) || findTaskListShortcutOwners(shortcuts, newKey, action).length) continue;
		shortcuts[action] = [newKey];
		changed = true;
	}
	return changed;
}

export function buildSettingsFromLoadedData(data: LoadedSettingsData | null): SettingsBuildResult {
	const normalizedUserFieldPropertyKeys = Boolean(
		data?.userFields?.some(
			(field) => typeof field.key === "string" && field.key !== field.key.trim()
		)
	);
	const migratedLegacyKeyboardShortcuts = Boolean(
		data?.keyboardShortcuts && !data.taskListShortcuts
	);
	const loadedData = migrateLoadedSettingsData(data);
	const migratedLegacyCustomFilenameTemplate =
		data?.taskFilenameFormat !== "custom" &&
		data?.customFilenameTemplate === "{title}" &&
		loadedData?.customFilenameTemplate === "{{title}}";
	const migratedParentNoteTaskCreationDefault =
		shouldMigrateParentNoteTaskCreationDefault(loadedData);

	const settings: TaskNotesSettings = {
		...DEFAULT_SETTINGS,
		...loadedData,
		fieldMapping: {
			...DEFAULT_SETTINGS.fieldMapping,
			...(loadedData?.fieldMapping || {}),
		},
		taskCreationDefaults: buildTaskCreationDefaults(loadedData?.taskCreationDefaults),
		calendarViewSettings: {
			...DEFAULT_SETTINGS.calendarViewSettings,
			...(loadedData?.calendarViewSettings || {}),
		},
		commandFileMapping: {
			...DEFAULT_SETTINGS.commandFileMapping,
			...(loadedData?.commandFileMapping || {}),
		},
		taskListShortcuts: normalizeTaskListShortcutMap(loadedData?.taskListShortcuts),
		taskListUserFieldShortcuts: loadedData?.taskListUserFieldShortcuts ?? {},
		userFieldMru: loadedData?.userFieldMru ?? {},
		icsIntegration: {
			...DEFAULT_SETTINGS.icsIntegration,
			...(loadedData?.icsIntegration || {}),
		},
		googleCalendarExport: {
			...DEFAULT_SETTINGS.googleCalendarExport,
			...(loadedData?.googleCalendarExport || {}),
		},
		nlpTriggers: {
			...DEFAULT_SETTINGS.nlpTriggers,
			...(loadedData?.nlpTriggers || {}),
			triggers: normalizeNLPTriggers(loadedData?.nlpTriggers?.triggers),
		},
		modalFieldsConfig: initializeFieldConfig(
			loadedData?.modalFieldsConfig,
			loadedData?.userFields
		),
		customStatuses: (loadedData?.customStatuses || DEFAULT_SETTINGS.customStatuses).map((status) => ({ ...status })),
		customPriorities: (loadedData?.customPriorities || DEFAULT_SETTINGS.customPriorities).map((priority) => ({ ...priority })),
	};
	const migratedConflictingTaskShortcuts = migrateConflictingTaskShortcutDefaults(settings);

	return {
		settings,
		shouldPersistMigratedSettings:
			hasMissingMigratedSettings(loadedData) ||
			migratedLegacyCustomFilenameTemplate ||
			migratedParentNoteTaskCreationDefault ||
			normalizedUserFieldPropertyKeys ||
			migratedLegacyKeyboardShortcuts ||
			migratedConflictingTaskShortcuts,
	};
}

/**
 * Settings exactly as an earlier version saved them, merged over defaults but
 * without this version's load-time migrations. Used only to recognize metadata
 * that version generated; never use it as the plugin's settings.
 */
export function buildSavedSettingsSnapshot(data: LoadedSettingsData | null): TaskNotesSettings | null {
	if (!data) return null;
	return {
		...DEFAULT_SETTINGS,
		...data,
		fieldMapping: { ...DEFAULT_SETTINGS.fieldMapping, ...(data.fieldMapping || {}) },
		customStatuses: data.customStatuses || DEFAULT_SETTINGS.customStatuses,
		customPriorities: data.customPriorities || DEFAULT_SETTINGS.customPriorities,
		userFields: data.userFields || DEFAULT_SETTINGS.userFields,
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
	if (settings.userFields) {
		data.userFields = settings.userFields.map((field) => ({ ...field, key: field.key.trim() }));
	}
	return data;
}
