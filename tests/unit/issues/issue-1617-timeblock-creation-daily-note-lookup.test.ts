/**
 * Issue #1617: cannot create timeblocks even when Daily Notes is configured.
 *
 * Reported behavior:
 * - Daily Notes core plugin is enabled
 * - Daily note folder/template are configured
 * - Obsidian's "Open daily note" command works
 * - Timeblock creation fails
 *
 * Likely failure chain in current implementation:
 * 1. Timeblock creation looks up the note with getDailyNote(moment(date), getAllDailyNotes())
 * 2. If lookup misses (date normalization/format mismatch), code falls back to createDailyNote()
 * 3. obsidian-daily-notes-interface swallows create errors and may return undefined
 * 4. TaskNotes throws "Failed to create daily note... ensure folder exists"
 *
 * This reproduces the fallback failure path that surfaces as #1617.
 */

describe('Issue #1617: Timeblock creation fails despite Daily Notes setup', () => {
	it.skip('reproduces issue #1617', async () => {
		const appHasDailyNotesPluginLoaded = jest.fn(() => true);
		const getAllDailyNotes = jest.fn(() => ({
			// Existing daily notes map does not include the requested date key.
			// This can happen when lookup keys and date normalization are inconsistent.
			'day-2026-02-16T00:00:00-08:00': { path: 'Daily/2026-02-16.md' },
		}));
		const getDailyNote = jest.fn(() => null);
		const createDailyNote = jest.fn(async () => undefined);

		const date = '2026-02-17';

		const saveTimeblockToDailyNote = async (): Promise<void> => {
			if (!appHasDailyNotesPluginLoaded()) {
				throw new Error('Daily Notes plugin is not enabled');
			}

			const moment = { date };
			const allDailyNotes = getAllDailyNotes();
			let dailyNote = getDailyNote(moment, allDailyNotes);

			if (!dailyNote) {
				dailyNote = await createDailyNote(moment);

				if (!dailyNote) {
					throw new Error(
						'Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.'
					);
				}
			}
		};

		await expect(saveTimeblockToDailyNote()).rejects.toThrow(
			'Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.'
		);
		expect(getDailyNote).toHaveBeenCalled();
		expect(createDailyNote).toHaveBeenCalled();
	});
});
