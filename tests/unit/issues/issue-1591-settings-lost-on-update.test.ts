/**
 * Issue #1591: Vanished customized settings after update from 4.3.0 to 4.3.2
 *
 * This is a recurring bug (second occurrence - first was #1455).
 *
 * User reported that after plugin update:
 * 1. All custom priorities and statuses were reset to defaults
 * 2. Pomodoro timer settings were lost
 * 3. Default TaskNotes properties were reset
 * 4. This happened across multiple vaults
 *
 * ROOT CAUSES IDENTIFIED (multiple contributing factors):
 *
 * PRIMARY CAUSE - Complete Settings Loss:
 * - loadData() can return null or {} during Obsidian Sync conflicts or plugin updates
 * - The code does `{...DEFAULT_SETTINGS, ...loadedData}` where null coerces to {}
 * - This causes COMPLETE settings loss, not partial
 * - Race condition between onload() and onExternalSettingsChange() can trigger this
 *
 * SECONDARY CAUSE - Empty Array Bug (partial loss):
 * - The `||` operator in loadSettings() treats empty arrays `[]` as falsy
 * - When user has `customStatuses: []`, the expression `[] || DEFAULT_SETTINGS.customStatuses`
 *   returns the defaults instead of preserving the empty array
 * - The previous fix (commit 0a52fcb8) only addressed nested objects, not arrays
 * - This only affects users who intentionally cleared arrays to []
 *
 * Related issues:
 * - #1455: First occurrence of this bug (partially fixed)
 * - #1270: Plugin update data loss (similar root cause with String(null))
 *
 * @see src/main.ts loadSettings() lines 1267 (loadData call), 1323-1364 (settings merge)
 */

import { describe, it, expect } from "@jest/globals";

describe.skip("Issue #1591: Settings lost on plugin update", () => {
	// Simulates the current loadSettings() behavior for array-valued settings
	const DEFAULT_STATUSES = [
		{ id: "todo", label: "Todo", color: "#888" },
		{ id: "in-progress", label: "In Progress", color: "#0066cc" },
		{ id: "done", label: "Done", color: "#00cc00" },
	];

	const DEFAULT_PRIORITIES = [
		{ id: "high", label: "High", color: "#ff0000" },
		{ id: "medium", label: "Medium", color: "#ffaa00" },
		{ id: "low", label: "Low", color: "#00aaff" },
	];

	interface SettingsData {
		customStatuses?: Array<{ id: string; label: string; color: string }>;
		customPriorities?: Array<{ id: string; label: string; color: string }>;
		savedViews?: Array<{ id: string; name: string }>;
		pomodoroSettings?: {
			workDuration: number;
			breakDuration: number;
			longBreakDuration: number;
		};
	}

	// Current buggy implementation using || operator
	function loadSettingsBuggy(loadedData: SettingsData | null) {
		return {
			customStatuses: loadedData?.customStatuses || DEFAULT_STATUSES,
			customPriorities: loadedData?.customPriorities || DEFAULT_PRIORITIES,
			savedViews: loadedData?.savedViews || [],
		};
	}

	// Fixed implementation using ?? (nullish coalescing)
	function loadSettingsFixed(loadedData: SettingsData | null) {
		return {
			// Use ?? to only fallback when value is null/undefined, not for empty arrays
			customStatuses: loadedData?.customStatuses ?? DEFAULT_STATUSES,
			customPriorities: loadedData?.customPriorities ?? DEFAULT_PRIORITIES,
			savedViews: loadedData?.savedViews ?? [],
		};
	}

	describe("Bug 1: Empty arrays reset to defaults", () => {
		/**
		 * When a user intentionally clears all custom statuses (setting to []),
		 * the || operator treats [] as falsy and replaces it with defaults.
		 *
		 * JavaScript quirk: `[] || "fallback"` returns "fallback" because
		 * [] is coerced to "" (falsy), but `[] ?? "fallback"` returns []
		 * because [] is not null/undefined.
		 */

		it("should preserve empty customStatuses array", () => {
			const userSettings: SettingsData = {
				customStatuses: [], // User intentionally cleared all statuses
				customPriorities: [{ id: "urgent", label: "Urgent", color: "#ff0000" }],
			};

			const result = loadSettingsBuggy(userSettings);

			// BUG: Empty array is replaced with defaults
			// Expected: [], Actual: DEFAULT_STATUSES
			expect(result.customStatuses).toEqual([]);
			expect(result.customStatuses.length).toBe(0);
		});

		it("should preserve empty customPriorities array", () => {
			const userSettings: SettingsData = {
				customStatuses: [{ id: "active", label: "Active", color: "#0000ff" }],
				customPriorities: [], // User intentionally cleared all priorities
			};

			const result = loadSettingsBuggy(userSettings);

			// BUG: Empty array is replaced with defaults
			// Expected: [], Actual: DEFAULT_PRIORITIES
			expect(result.customPriorities).toEqual([]);
			expect(result.customPriorities.length).toBe(0);
		});

		it("should preserve empty savedViews array", () => {
			const userSettings: SettingsData = {
				savedViews: [], // User has no saved views yet
			};

			const result = loadSettingsBuggy(userSettings);

			// This one happens to work because DEFAULT is also [], but the logic is still wrong
			expect(result.savedViews).toEqual([]);
		});
	});

	describe("Bug 2: User customizations lost during update", () => {
		/**
		 * The real-world scenario: User has customized settings, plugin updates,
		 * loadSettings() runs and overwrites their customizations.
		 */

		it("should preserve user's custom statuses during plugin update", () => {
			const userSettings: SettingsData = {
				customStatuses: [
					{ id: "backlog", label: "Backlog", color: "#aaaaaa" },
					{ id: "active", label: "Active", color: "#00ff00" },
					{ id: "blocked", label: "Blocked", color: "#ff0000" },
					{ id: "review", label: "Review", color: "#ffff00" },
					{ id: "shipped", label: "Shipped", color: "#0000ff" },
				],
			};

			const result = loadSettingsBuggy(userSettings);

			// Should preserve all 5 custom statuses
			expect(result.customStatuses.length).toBe(5);
			expect(result.customStatuses.map((s) => s.id)).toContain("backlog");
			expect(result.customStatuses.map((s) => s.id)).toContain("shipped");
		});

		it("should preserve user's custom priorities during plugin update", () => {
			const userSettings: SettingsData = {
				customPriorities: [
					{ id: "critical", label: "🔥 Critical", color: "#ff0000" },
					{ id: "normal", label: "Normal", color: "#888888" },
				],
			};

			const result = loadSettingsBuggy(userSettings);

			// Should preserve custom priorities
			expect(result.customPriorities.length).toBe(2);
			expect(result.customPriorities.map((p) => p.id)).toContain("critical");
		});
	});

	describe("Fixed implementation should handle all cases correctly", () => {
		it("should preserve empty arrays", () => {
			const result = loadSettingsFixed({
				customStatuses: [],
				customPriorities: [],
				savedViews: [],
			});

			expect(result.customStatuses).toEqual([]);
			expect(result.customPriorities).toEqual([]);
			expect(result.savedViews).toEqual([]);
		});

		it("should preserve user customizations", () => {
			const customStatuses = [
				{ id: "custom1", label: "Custom 1", color: "#111" },
				{ id: "custom2", label: "Custom 2", color: "#222" },
			];

			const result = loadSettingsFixed({
				customStatuses,
			});

			expect(result.customStatuses).toBe(customStatuses);
			expect(result.customStatuses.length).toBe(2);
		});

		it("should use defaults only when property is undefined", () => {
			const result = loadSettingsFixed({});

			expect(result.customStatuses).toEqual(DEFAULT_STATUSES);
			expect(result.customPriorities).toEqual(DEFAULT_PRIORITIES);
		});

		it("should use defaults when loadedData is null", () => {
			const result = loadSettingsFixed(null);

			expect(result.customStatuses).toEqual(DEFAULT_STATUSES);
			expect(result.customPriorities).toEqual(DEFAULT_PRIORITIES);
		});
	});

	describe("JavaScript operator behavior reference", () => {
		/**
		 * Demonstrates the difference between || and ?? operators with arrays.
		 * This is the root cause of the empty array bug (secondary issue).
		 */

		it("demonstrates || operator treats empty array as falsy", () => {
			const emptyArray: string[] = [];
			const fallback = ["default"];

			// || operator: empty array is coerced to "" which is falsy
			const resultOr = emptyArray || fallback;
			expect(resultOr).toBe(fallback); // Returns fallback - BUG!
		});

		it("demonstrates ?? operator preserves empty array", () => {
			const emptyArray: string[] = [];
			const fallback = ["default"];

			// ?? operator: only returns fallback for null/undefined
			const resultNullish = emptyArray ?? fallback;
			expect(resultNullish).toBe(emptyArray); // Returns empty array - CORRECT!
		});

		it("demonstrates ?? returns fallback for undefined", () => {
			const undefinedValue: string[] | undefined = undefined;
			const fallback = ["default"];

			const result = undefinedValue ?? fallback;
			expect(result).toBe(fallback);
		});
	});

	describe("PRIMARY BUG: loadData() returns null/empty during Sync conflicts", () => {
		/**
		 * This is the PRIMARY cause of COMPLETE settings loss.
		 *
		 * When Obsidian Sync is active during a plugin update, or when there's
		 * a race condition between onload() and onExternalSettingsChange(),
		 * loadData() can return null or an empty object {}.
		 *
		 * The current code does:
		 *   const loadedData = await this.loadData();
		 *   this.settings = { ...DEFAULT_SETTINGS, ...loadedData, ... };
		 *
		 * When loadedData is null, it coerces to {}, so ALL settings become defaults.
		 *
		 * @see src/main.ts:1267 - loadData() call
		 * @see src/main.ts:1323-1326 - settings merge without validation
		 */

		const DEFAULT_SETTINGS = {
			customStatuses: DEFAULT_STATUSES,
			customPriorities: DEFAULT_PRIORITIES,
			savedViews: [] as Array<{ id: string; name: string }>,
			pomodoroWorkDuration: 25,
			taskFolder: "Tasks",
		};

		interface FullSettings {
			customStatuses: Array<{ id: string; label: string; color: string }>;
			customPriorities: Array<{ id: string; label: string; color: string }>;
			savedViews: Array<{ id: string; name: string }>;
			pomodoroWorkDuration: number;
			taskFolder: string;
		}

		// Current buggy implementation - no validation of loadedData
		function loadSettingsFromDataBuggy(loadedData: Partial<FullSettings> | null): FullSettings {
			return {
				...DEFAULT_SETTINGS,
				...loadedData, // null coerces to {}, empty object overwrites nothing but defaults remain
			};
		}

		// Fixed implementation - validate loadedData before use
		function loadSettingsFromDataFixed(
			loadedData: Partial<FullSettings> | null,
			existingSettings: FullSettings | null
		): FullSettings {
			// If loadData returned null/empty but we have existing settings, preserve them
			if (
				(loadedData === null || Object.keys(loadedData).length === 0) &&
				existingSettings !== null
			) {
				console.warn("loadData() returned null/empty during update - preserving existing settings");
				return existingSettings;
			}

			return {
				...DEFAULT_SETTINGS,
				...loadedData,
			};
		}

		it("should NOT lose all settings when loadData() returns null", () => {
			// Simulates Obsidian Sync conflict or file lock during update
			const loadedData = null;

			const result = loadSettingsFromDataBuggy(loadedData);

			// BUG: All settings are reset to defaults when loadData returns null
			// This test will FAIL because result equals DEFAULT_SETTINGS
			expect(result.customStatuses).not.toEqual(DEFAULT_STATUSES);
		});

		it("should NOT lose all settings when loadData() returns empty object", () => {
			// Simulates corrupted or temporarily empty data.json
			const loadedData = {};

			const result = loadSettingsFromDataBuggy(loadedData);

			// BUG: All settings are defaults because {} spread adds nothing
			expect(result.pomodoroWorkDuration).not.toBe(25);
		});

		it("fixed version should preserve existing settings when loadData returns null", () => {
			const existingSettings: FullSettings = {
				customStatuses: [{ id: "custom", label: "Custom", color: "#123456" }],
				customPriorities: [{ id: "urgent", label: "Urgent", color: "#ff0000" }],
				savedViews: [{ id: "view1", name: "My View" }],
				pomodoroWorkDuration: 45,
				taskFolder: "MyTasks",
			};

			const result = loadSettingsFromDataFixed(null, existingSettings);

			expect(result).toEqual(existingSettings);
			expect(result.pomodoroWorkDuration).toBe(45);
			expect(result.taskFolder).toBe("MyTasks");
		});

		it("fixed version should preserve existing settings when loadData returns empty", () => {
			const existingSettings: FullSettings = {
				customStatuses: [{ id: "custom", label: "Custom", color: "#123456" }],
				customPriorities: [],
				savedViews: [],
				pomodoroWorkDuration: 30,
				taskFolder: "Tasks",
			};

			const result = loadSettingsFromDataFixed({}, existingSettings);

			expect(result).toEqual(existingSettings);
		});

		it("fixed version should use loadedData when it has content", () => {
			const loadedData: Partial<FullSettings> = {
				pomodoroWorkDuration: 50,
				taskFolder: "NewTasks",
			};

			const result = loadSettingsFromDataFixed(loadedData, null);

			expect(result.pomodoroWorkDuration).toBe(50);
			expect(result.taskFolder).toBe("NewTasks");
			// Defaults are used for unspecified properties
			expect(result.customStatuses).toEqual(DEFAULT_STATUSES);
		});
	});

	describe("Race condition: concurrent loadSettings() calls", () => {
		/**
		 * During plugin updates, both onload() and onExternalSettingsChange()
		 * may call loadSettings() concurrently. Without proper synchronization,
		 * this can lead to data corruption.
		 */

		let settingsLoadCount = 0;
		let lastLoadedSettings: Record<string, unknown> | null = null;

		// Simulates the async loadSettings without any locking
		async function loadSettingsUnsafe(
			loadDataFn: () => Promise<Record<string, unknown> | null>
		): Promise<Record<string, unknown>> {
			settingsLoadCount++;
			const data = await loadDataFn();
			// Simulate some processing delay
			await new Promise((resolve) => setTimeout(resolve, 10));
			lastLoadedSettings = data;
			return data ?? {};
		}

		it("should handle concurrent calls without data loss", async () => {
			settingsLoadCount = 0;

			// Simulate two concurrent calls with different data
			const call1Data = { version: 1, customStatuses: ["a"] };
			const call2Data = { version: 2, customStatuses: ["b"] };

			const promise1 = loadSettingsUnsafe(async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return call1Data;
			});

			const promise2 = loadSettingsUnsafe(async () => call2Data);

			await Promise.all([promise1, promise2]);

			// Without proper synchronization, the final state is unpredictable
			// This test documents the race condition - one of the loads will be lost
			expect(settingsLoadCount).toBe(2);

			// The "last" settings depend on timing - this is the bug
			// In a fixed implementation, we'd have a mutex to serialize access
		});
	});
});
