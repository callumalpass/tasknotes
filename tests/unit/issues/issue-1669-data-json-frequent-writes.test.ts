import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { hasMissingMigratedSettings } from "../../../src/settings/settingsMigration";
import {
	shouldPersistLastSelectedTask,
	shouldPersistPomodoroState,
} from "../../../src/services/pomodoroPersistence";

describe("Issue #1669: data.json migration write detection", () => {
	it("does not treat stored falsey default values as missing settings", () => {
		const loadedData = {
			fieldMapping: { ...DEFAULT_SETTINGS.fieldMapping },
			calendarViewSettings: {
				...DEFAULT_SETTINGS.calendarViewSettings,
				defaultShowScheduledToDueSpan: false,
				defaultShowTimeEntries: false,
				enableTimeblocking: false,
				weekNumbers: false,
				eventMaxStack: null,
				locale: "",
			},
			commandFileMapping: { ...DEFAULT_SETTINGS.commandFileMapping },
		};

		expect(hasMissingMigratedSettings(loadedData)).toBe(false);
	});

	it("still detects genuinely missing migrated settings", () => {
		const loadedData = {
			fieldMapping: { ...DEFAULT_SETTINGS.fieldMapping },
			calendarViewSettings: { ...DEFAULT_SETTINGS.calendarViewSettings },
			commandFileMapping: { ...DEFAULT_SETTINGS.commandFileMapping },
		};
		delete loadedData.calendarViewSettings.timeblockAttachmentSearchOrder;

		expect(hasMissingMigratedSettings(loadedData)).toBe(true);
	});

	it("does not persist identical idle Pomodoro state during cleanup", () => {
		const state = {
			isRunning: false,
			timeRemaining: 1500,
		};
		const data = {
			pomodoroState: { ...state },
			lastPomodoroDate: "2026-05-16",
		};

		expect(shouldPersistPomodoroState(data, state, "2026-05-16")).toBe(false);
	});

	it("persists Pomodoro state when the timer state or date changes", () => {
		const state = {
			isRunning: true,
			timeRemaining: 1499,
		};
		const data = {
			pomodoroState: {
				isRunning: true,
				timeRemaining: 1500,
			},
			lastPomodoroDate: "2026-05-15",
		};

		expect(shouldPersistPomodoroState(data, state, "2026-05-16")).toBe(true);
	});

	it("does not persist the last selected task when it has not changed", () => {
		expect(
			shouldPersistLastSelectedTask(
				{
					lastSelectedTaskPath: "Tasks/Focus.md",
				},
				"Tasks/Focus.md"
			)
		).toBe(false);
	});
});
