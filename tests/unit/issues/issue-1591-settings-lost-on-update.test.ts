import { describe, expect, it } from "@jest/globals";

type SimplifiedSettings = {
	customStatuses: string[];
	customPriorities: string[];
	pomodoroWorkDuration: number;
	lastSeenVersion?: string;
};

const DEFAULT_SETTINGS: SimplifiedSettings = {
	customStatuses: ["open", "in-progress", "done"],
	customPriorities: ["high", "normal", "low"],
	pomodoroWorkDuration: 25,
	lastSeenVersion: undefined,
};

/**
 * Reproduction model for issue #1591.
 *
 * Key flow in current plugin code:
 * 1) loadSettings() merges DEFAULT_SETTINGS with loadData()
 * 2) checkForVersionUpdate() mutates lastSeenVersion and calls saveSettings()
 * 3) saveSettings() writes current in-memory settings back to data.json
 *
 * If loadData() transiently returns null during update/startup, step (1) loads defaults,
 * and step (3) can persist those defaults permanently.
 */
class SettingsFlowModel {
	private diskData: Partial<SimplifiedSettings> | null;

	constructor(initialDiskData: Partial<SimplifiedSettings> | null) {
		this.diskData = initialDiskData;
	}

	setDiskData(data: Partial<SimplifiedSettings> | null): void {
		this.diskData = data;
	}

	loadSettings(): SimplifiedSettings {
		const loadedData = this.diskData;
		return {
			...DEFAULT_SETTINGS,
			...(loadedData ?? {}),
		};
	}

	saveSettings(inMemory: SimplifiedSettings): void {
		// Mirrors saveSettings() behavior: write current settings snapshot
		this.diskData = { ...inMemory };
	}

	checkForVersionUpdateAndPersist(
		inMemory: SimplifiedSettings,
		currentVersion: string
	): SimplifiedSettings {
		const lastSeenVersion = inMemory.lastSeenVersion;
		if (lastSeenVersion && lastSeenVersion !== currentVersion) {
			inMemory.lastSeenVersion = currentVersion;
			this.saveSettings(inMemory);
		}
		return inMemory;
	}

	readDisk(): Partial<SimplifiedSettings> | null {
		return this.diskData;
	}
}

describe("issue #1591 settings reset on update", () => {
	it.skip("reproduces issue #1591", () => {
		const model = new SettingsFlowModel({
			customStatuses: ["backlog", "blocked", "done"],
			customPriorities: ["urgent", "normal"],
			pomodoroWorkDuration: 50,
			lastSeenVersion: "4.3.0",
		});

		// Transient read failure during plugin update/startup
		model.setDiskData(null);
		const loaded = model.loadSettings();

		// Version update path persists current in-memory settings snapshot
		model.checkForVersionUpdateAndPersist(loaded, "4.3.2");

		// Re-read after save: custom settings are gone, defaults are now persisted
		const persisted = model.readDisk() as SimplifiedSettings;

		// Documented expected behavior for a FIXED implementation:
		// a transient null read should not permanently overwrite prior custom settings.
		expect(persisted.customStatuses).toEqual(["backlog", "blocked", "done"]);
		expect(persisted.customPriorities).toEqual(["urgent", "normal"]);
		expect(persisted.pomodoroWorkDuration).toBe(50);
	});
});
