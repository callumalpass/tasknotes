import { describe, expect, it } from "@jest/globals";

type SimplifiedSettings = {
	tasksFolder: string;
	pomodoroWorkDuration: number;
	defaultTaskStatus: string;
};

type SimplifiedPomodoroState = {
	isRunning: boolean;
	timeRemaining: number;
	currentSession?: {
		id: string;
		taskPath?: string;
		startTime: string;
		plannedDuration: number;
		type: "work" | "short-break" | "long-break";
		completed: boolean;
		activePeriods: Array<{ startTime: string; endTime?: string }>;
	};
};

const DEFAULT_SETTINGS: SimplifiedSettings = {
	tasksFolder: "TaskNotes/Tasks",
	pomodoroWorkDuration: 25,
	defaultTaskStatus: "open",
};

/**
 * Reproduction model for issue #1637.
 *
 * Current persistence flow in plugin code:
 * 1) PomodoroService.saveState()/saveLastSelectedTask() writes session fields into data.json
 *    - pomodoroState
 *    - lastPomodoroDate
 *    - lastSelectedTaskPath
 * 2) loadSettings() spreads all loaded data into the in-memory settings object
 * 3) saveSettingsDataOnly() preserves non-settings keys by loading full data.json first
 *
 * Result: data.json is not config-only; it mixes durable config with ephemeral session state.
 */
class DataJsonModel {
	private diskData: Record<string, any> | null;

	constructor(initialDiskData: Record<string, any> | null) {
		this.diskData = initialDiskData;
	}

	private loadData(): Record<string, any> | null {
		return this.diskData ? { ...this.diskData } : null;
	}

	private saveData(data: Record<string, any>): void {
		this.diskData = { ...data };
	}

	savePomodoroSessionState(state: SimplifiedPomodoroState, taskPath?: string): void {
		const data = this.loadData() || {};
		data.pomodoroState = state;
		data.lastPomodoroDate = "2026-02-23";
		data.lastSelectedTaskPath = taskPath;
		this.saveData(data);
	}

	loadSettings(): SimplifiedSettings & Record<string, unknown> {
		const loadedData = this.loadData();
		return {
			...DEFAULT_SETTINGS,
			...(loadedData ?? {}),
		};
	}

	saveSettingsDataOnly(inMemory: SimplifiedSettings): void {
		const data = this.loadData() || {};
		const settingsKeys = Object.keys(DEFAULT_SETTINGS) as (keyof SimplifiedSettings)[];
		for (const key of settingsKeys) {
			data[key] = inMemory[key];
		}
		this.saveData(data);
	}

	readDisk(): Record<string, any> | null {
		return this.diskData;
	}
}

describe("issue #1637 data.json config-only separation", () => {
	it.skip("reproduces issue #1637", () => {
		const model = new DataJsonModel({
			tasksFolder: "Projects/Tasks",
			pomodoroWorkDuration: 40,
			defaultTaskStatus: "in-progress",
		});

		model.savePomodoroSessionState(
			{
				isRunning: true,
				timeRemaining: 1200,
				currentSession: {
					id: "session-1",
					taskPath: "Tasks/Deep Work.md",
					startTime: "2026-02-23T10:00:00.000Z",
					plannedDuration: 25,
					type: "work",
					completed: false,
					activePeriods: [{ startTime: "2026-02-23T10:00:00.000Z" }],
				},
			},
			"Tasks/Deep Work.md"
		);

		// Mirrors current loadSettings() behavior: all keys from data.json are spread into settings.
		const loadedSettings = model.loadSettings();
		expect("pomodoroState" in loadedSettings).toBe(false);
		expect("lastSelectedTaskPath" in loadedSettings).toBe(false);
		expect("lastPomodoroDate" in loadedSettings).toBe(false);

		// Mirrors saveSettingsDataOnly(): preserves non-settings keys already in data.json.
		model.saveSettingsDataOnly(loadedSettings as SimplifiedSettings);

		// Expected behavior for a fixed implementation:
		// data.json should contain config keys only, with ephemeral keys stored elsewhere.
		expect(model.readDisk()).toEqual({
			tasksFolder: "Projects/Tasks",
			pomodoroWorkDuration: 40,
			defaultTaskStatus: "in-progress",
		});
	});
});
