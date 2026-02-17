/**
 * Issue #644: [Bug] Daily Notes Folder Desync on Mobile
 *
 * Bug Description:
 * In the advanced calendar view, clicking on a day to open the daily note shows:
 * "Failed to navigate to daily note: Failed to find Daily notes folder"
 *
 * The functionality works exactly once after restarting the app, but fails on
 * subsequent attempts. The user's daily notes folder is configured as "00-Tasks/"
 * in the Daily Notes plugin settings.
 *
 * Root Cause Analysis:
 * The error "Failed to find daily notes folder" is thrown by the
 * obsidian-daily-notes-interface library when `getAllDailyNotes()` is called.
 * Internally, it calls `vault.getAbstractFileByPath(normalizePath(folder))` and
 * throws `DailyNotesFolderMissingError` if the result is null.
 *
 * There are two likely contributing factors:
 *
 * 1. **Stale folder reference on mobile**: On Android, the Obsidian vault filesystem
 *    can become desynced after the app resumes from background. The Vault's internal
 *    file tree may not have been refreshed, causing `getAbstractFileByPath()` to
 *    return null for the daily notes folder even though it exists on disk.
 *
 * 2. **Module-level daily notes cache in calendar-core.ts** (lines 866-868): A
 *    module-level cache (`_dailyNotesCache`) with a 5-second TTL stores the result
 *    of `getAllDailyNotes()`. This cache is never explicitly invalidated when the
 *    vault state changes (e.g., `notifyDataChanged()` does not clear it). If the
 *    cache is populated during a working state and then the vault desyncs, the cache
 *    masks the problem briefly. Once the cache expires and a fresh `getAllDailyNotes()`
 *    is attempted, the desynced vault state causes the error.
 *
 * 3. **No error recovery**: When `getAllDailyNotes()` throws, the error bubbles up
 *    to the outer catch in `handleDateTitleClick()` / `navigateToDailyNote()` /
 *    `openDailyNoteForDate()` — but none of these attempt a retry after triggering
 *    a vault rescan.
 *
 * Multiple code paths are affected:
 * - `handleDateTitleClick()` in calendar-core.ts (line 1329)
 * - `navigateToDailyNote()` in main.ts (line 2153)
 * - `openDailyNoteForDate()` in MiniCalendarView.ts (line 663)
 * - `generateTimeblockEvents()` in calendar-core.ts (line 879, cached)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/644
 */

describe("Issue #644: Daily Notes Folder Desync on Mobile", () => {
	it.skip("reproduces issue #644: getAllDailyNotes throws when vault loses folder reference", () => {
		/**
		 * Simulates the scenario where the vault's internal file tree does not
		 * contain the daily notes folder, causing getAllDailyNotes() to throw.
		 *
		 * On mobile (Android), this happens when:
		 * 1. App starts → vault file tree is populated → daily notes work
		 * 2. App goes to background → OS may reclaim resources
		 * 3. App resumes → vault file tree may be stale
		 * 4. User clicks date → getAllDailyNotes() → vault.getAbstractFileByPath()
		 *    returns null → throws DailyNotesFolderMissingError
		 */

		// Simulate obsidian-daily-notes-interface behavior
		const dailyNotesFolder = "00-Tasks/";

		// Mock vault that simulates desync: folder exists on disk but not in vault cache
		const mockVault = {
			getAbstractFileByPath: (path: string) => {
				// After desync, vault returns null for the folder
				return null;
			},
		};

		// This is what getAllDailyNotes() does internally
		const folder = dailyNotesFolder.trim();
		const dailyNotesRef = mockVault.getAbstractFileByPath(folder);

		// The library throws when folder is not found
		if (!dailyNotesRef) {
			const error = new Error("Failed to find daily notes folder");
			// This error propagates up as:
			// "Failed to navigate to daily note: Failed to find Daily notes folder"
			expect(error.message).toContain("Failed to find daily notes folder");
		}

		// The fix should:
		// 1. Catch DailyNotesFolderMissingError specifically
		// 2. Trigger a vault rescan / folder re-resolution
		// 3. Retry getAllDailyNotes() after rescan
		// 4. Or ensure vault file tree is refreshed when app resumes from background
	});

	it.skip("reproduces issue #644: module-level cache is not invalidated by notifyDataChanged", () => {
		/**
		 * The daily notes cache in calendar-core.ts (lines 866-868) is a module-level
		 * variable that is NOT cleared when notifyDataChanged() is called. This means
		 * that even if the vault state changes, the cache may serve stale data for up
		 * to 5 seconds.
		 *
		 * More critically, the cache has no invalidation path for vault desync events
		 * (e.g., mobile app resume). If the cache was populated when the vault was
		 * valid, it will serve stale data. Once it expires and a fresh call is made
		 * against a desynced vault, the error occurs.
		 */

		// Simulate the module-level cache
		let dailyNotesCache: Record<string, unknown> | null = null;
		let dailyNotesCacheTime = 0;
		const DAILY_NOTES_CACHE_TTL = 5000;

		// Simulate getAllDailyNotes returning valid data on first call
		let vaultIsValid = true;
		const getAllDailyNotes = () => {
			if (!vaultIsValid) {
				throw new Error("Failed to find daily notes folder");
			}
			return {
				"day-2025-01-15T00:00:00+00:00": { path: "00-Tasks/2025-01-15.md" },
			};
		};

		// First call: vault is valid, cache is populated
		const now = Date.now();
		dailyNotesCache = getAllDailyNotes();
		dailyNotesCacheTime = now;
		expect(dailyNotesCache).not.toBeNull();

		// Simulate vault desync (app goes to background and resumes)
		vaultIsValid = false;

		// Within TTL: cache is still served (masks the problem)
		const withinTTL = now + 1000;
		if (!dailyNotesCache || (withinTTL - dailyNotesCacheTime) > DAILY_NOTES_CACHE_TTL) {
			// Would call getAllDailyNotes() but TTL hasn't expired
			dailyNotesCache = getAllDailyNotes();
		}
		// Cache still valid, no error yet
		expect(dailyNotesCache).not.toBeNull();

		// After TTL expires: cache is stale, fresh call hits desynced vault
		const afterTTL = now + 6000;
		expect(() => {
			if (!dailyNotesCache || (afterTTL - dailyNotesCacheTime) > DAILY_NOTES_CACHE_TTL) {
				dailyNotesCache = getAllDailyNotes(); // Throws!
			}
		}).toThrow("Failed to find daily notes folder");

		// notifyDataChanged() does NOT clear the daily notes cache
		// It only clears plugin.cacheManager entries and taskLinkDetectionService cache
		// The _dailyNotesCache in calendar-core.ts is unreachable
	});

	it.skip("reproduces issue #644: multiple code paths lack error handling for DailyNotesFolderMissingError", () => {
		/**
		 * Three separate code paths call getAllDailyNotes() without catching the
		 * DailyNotesFolderMissingError specifically:
		 *
		 * 1. handleDateTitleClick() - calendar-core.ts:1329
		 *    - Caught by outer try/catch, shows "Failed to navigate to daily note: ..."
		 *
		 * 2. navigateToDailyNote() - main.ts:2153
		 *    - Caught by outer try/catch, shows "Failed to navigate to daily note: ..."
		 *
		 * 3. openDailyNoteForDate() - MiniCalendarView.ts:663
		 *    - NOT caught at all! getAllDailyNotes() is called outside any try/catch
		 *      at line 663, so the error propagates uncaught.
		 *
		 * 4. generateTimeblockEvents() - calendar-core.ts:879
		 *    - Caught by outer try/catch, silently returns empty array
		 *
		 * The fix should add consistent error handling across all paths,
		 * ideally with a retry mechanism after vault rescan.
		 */

		// Demonstrate that openDailyNoteForDate has no error handling for getAllDailyNotes
		const callSequence: string[] = [];

		const mockOpenDailyNoteForDate = () => {
			// Simulates MiniCalendarView.ts:640-682
			callSequence.push("appHasDailyNotesPluginLoaded");
			// if (!appHasDailyNotesPluginLoaded()) return; // This check passes

			callSequence.push("getAllDailyNotes");
			// const allDailyNotes = getAllDailyNotes(); // <-- No try/catch here!
			throw new Error("Failed to find daily notes folder");
			// The error propagates uncaught from openDailyNoteForDate
		};

		expect(() => mockOpenDailyNoteForDate()).toThrow("Failed to find daily notes folder");
		expect(callSequence).toEqual(["appHasDailyNotesPluginLoaded", "getAllDailyNotes"]);
	});
});
