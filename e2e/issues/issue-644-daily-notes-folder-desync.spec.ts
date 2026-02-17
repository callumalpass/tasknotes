/**
 * Issue #644: [Bug] Daily Notes Folder Desync on Mobile
 *
 * Bug Description:
 * In the advanced calendar view, clicking on a day to open the daily note shows:
 * "Failed to navigate to daily note: Failed to find Daily notes folder"
 *
 * The functionality works once after restarting the app, then fails on subsequent
 * attempts. The daily notes folder is configured as "00-Tasks/" in the Daily Notes
 * plugin settings.
 *
 * Root Cause:
 * The obsidian-daily-notes-interface library's getAllDailyNotes() calls
 * vault.getAbstractFileByPath(folder), which can return null on mobile when the
 * vault's internal file tree becomes stale after the app resumes from background.
 * Additionally, a module-level cache in calendar-core.ts (5s TTL) delays detection
 * of the desync and is never invalidated by notifyDataChanged().
 *
 * @see https://github.com/callumalpass/tasknotes/issues/644
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #644: Daily Notes Folder Desync on Mobile', () => {
	test.beforeAll(async () => {
		app = await launchObsidian();
	});

	test.afterAll(async () => {
		if (app) {
			await closeObsidian(app);
		}
	});

	test.fixme(
		'reproduces issue #644 - clicking calendar date should navigate to daily note without folder error',
		async () => {
			/**
			 * Steps to reproduce:
			 * 1. Configure daily notes folder to a custom path (e.g., "00-Tasks/")
			 * 2. Open the calendar advanced view
			 * 3. Click on a date title to open/create the daily note
			 * 4. Observe: works on first click after app start
			 * 5. Click on another date
			 * 6. Observe: "Failed to navigate to daily note: Failed to find Daily notes folder"
			 *
			 * Note: This issue is primarily reproducible on Android mobile. On desktop,
			 * the vault file tree stays consistent. The test documents the expected
			 * behavior that should work across all platforms.
			 */

			// Open the calendar view
			await runCommand(app, 'TaskNotes: Open Calendar');

			// Wait for calendar to render
			const calendarView = app.page.locator('.tasknotes-calendar-view');
			await expect(calendarView).toBeVisible({ timeout: 10000 });

			// Click on today's date title in the calendar
			const todayCell = app.page.locator('.fc-day-today .fc-daygrid-day-number');
			await todayCell.click();

			// Should navigate to or create the daily note without error
			// The daily note should open in the editor
			const activeLeaf = app.page.locator('.workspace-leaf.mod-active .view-content');
			await expect(activeLeaf).toBeVisible({ timeout: 5000 });

			// No error notice should appear
			const errorNotice = app.page.locator('.notice-container').getByText('Failed to navigate to daily note');
			await expect(errorNotice).not.toBeVisible({ timeout: 2000 });
		}
	);

	test.fixme(
		'reproduces issue #644 - consecutive daily note navigations should all succeed',
		async () => {
			/**
			 * Verifies that clicking on multiple different dates in succession
			 * all successfully navigate to the corresponding daily note.
			 * On mobile, the second and subsequent clicks would fail due to
			 * vault desync.
			 */

			// Open the calendar view
			await runCommand(app, 'TaskNotes: Open Calendar');

			const calendarView = app.page.locator('.tasknotes-calendar-view');
			await expect(calendarView).toBeVisible({ timeout: 10000 });

			// Click on multiple dates in sequence
			const dayNumbers = app.page.locator('.fc-daygrid-day-number');
			const dayCount = await dayNumbers.count();

			for (let i = 0; i < Math.min(3, dayCount); i++) {
				await dayNumbers.nth(i).click();

				// Each click should succeed without error
				const errorNotice = app.page.locator('.notice-container').getByText('Failed to find daily notes folder');
				await expect(errorNotice).not.toBeVisible({ timeout: 2000 });

				// Navigate back to calendar for next iteration
				await runCommand(app, 'TaskNotes: Open Calendar');
				await expect(calendarView).toBeVisible({ timeout: 5000 });
			}
		}
	);
});
