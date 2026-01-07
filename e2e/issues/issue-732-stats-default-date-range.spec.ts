/**
 * Issue #732: [FR] (EASY) Save "Filter Date Range" for Task & Project Statistics
 *
 * Feature Request: When opening Task & Project Statistics, the date range filter
 * defaults to "All Time". The user wants a setting to configure a default date range.
 *
 * Problem:
 * - Opening Task & Project Statistics always shows "All Time" as the default filter
 * - Users who prefer a different default (e.g., "Last 30 days") must manually change it each time
 *
 * Proposed solution:
 * 1. Add a "Default Statistics Date Range" setting in Settings > Appearances and UI
 * 2. The setting would have the same options as the filter: All Time, 7 days, 30 days, 90 days
 * 3. Optionally, also add a "Default Min Time" setting for the minimum time spent filter
 *
 * Implementation notes from the user:
 * - Possibly reuse the same code pattern as "Default View" in Calendar View settings
 * - Just change the name & button/dropdown options
 *
 * Related files:
 * - src/views/StatsView.ts - Stats view with dateRange filter (currentFilters.dateRange)
 * - src/settings/tabs/appearanceTab.ts - Appearance & UI settings tab
 * - src/types/settings.ts - Settings interface definitions
 * - src/settings/defaults.ts - Default settings values
 *
 * The StatsView has a StatsFilters interface:
 * ```typescript
 * interface StatsFilters {
 *   dateRange: "all" | "7days" | "30days" | "90days" | "custom";
 *   customStartDate?: string;
 *   customEndDate?: string;
 *   selectedProjects: string[];
 *   minTimeSpent: number; // in minutes
 * }
 * ```
 *
 * @see https://github.com/callumalpass/tasknotes/issues/732
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #732: Save default date range for Task & Project Statistics', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Settings for default statistics filters', () => {
    test.fixme(
      'reproduces issue #732 - should have a default date range setting in Appearance & UI',
      async () => {
        /**
         * After implementation, the Appearance & UI settings should include
         * a "Default Statistics Date Range" dropdown with the same options
         * as the filter in the Statistics view.
         *
         * Expected options:
         * - All Time (current default)
         * - Last 7 Days
         * - Last 30 Days
         * - Last 90 Days
         *
         * This follows the same pattern as "Default View" for Calendar settings.
         */
        const page = app.page;

        // Open TaskNotes settings
        await runCommand(page, 'Settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Navigate to TaskNotes settings
        const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await tasknotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tasknotesTab.click();
          await page.waitForTimeout(300);
        }

        // Navigate to Appearance & UI tab
        const appearanceTab = page.locator(
          '.setting-tab-content button:has-text("Appearance"), ' +
            '[data-tab="appearance"], ' +
            '.settings-tab:has-text("Appearance")'
        );
        if (await appearanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await appearanceTab.click();
          await page.waitForTimeout(300);
        }

        // Look for the new default date range setting
        const dateRangeSetting = page.locator(
          '.setting-item:has-text("Default Statistics Date Range"), ' +
            '.setting-item:has-text("Default Date Range"), ' +
            '.setting-item:has-text("Statistics default"), ' +
            '[data-setting="defaultStatsDateRange"]'
        );

        const hasDateRangeSetting = await dateRangeSetting
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        // After implementation, this setting should exist
        expect(hasDateRangeSetting).toBe(true);

        if (hasDateRangeSetting) {
          // Verify the dropdown has expected options
          const dropdown = dateRangeSetting.locator('select');
          if (await dropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
            await dropdown.click();
            await page.waitForTimeout(200);

            const options = await dropdown.locator('option').allTextContents();
            console.log('Available date range options:', options);

            // Should have options matching the StatsFilters dateRange type
            expect(options.some((opt) => opt.toLowerCase().includes('all'))).toBe(true);
            expect(options.some((opt) => opt.includes('7') || opt.includes('week'))).toBe(true);
            expect(options.some((opt) => opt.includes('30'))).toBe(true);
            expect(options.some((opt) => opt.includes('90'))).toBe(true);
          }
        }

        // Close settings
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    );

    test.fixme(
      'reproduces issue #732 - should optionally have a default min time setting',
      async () => {
        /**
         * The user suggests optionally adding a "default Min time" setting
         * alongside the date range setting.
         *
         * This would set the default value for the minTimeSpent filter
         * (in minutes) that filters out tasks with less than X minutes of time tracked.
         */
        const page = app.page;

        // Open TaskNotes settings
        await runCommand(page, 'Settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Navigate to TaskNotes settings and Appearance tab
        const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await tasknotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tasknotesTab.click();
          await page.waitForTimeout(300);

          const appearanceTab = page.locator(
            '.setting-tab-content button:has-text("Appearance"), ' +
              '[data-tab="appearance"]'
          );
          if (await appearanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await appearanceTab.click();
            await page.waitForTimeout(300);
          }
        }

        // Look for the optional min time setting
        const minTimeSetting = page.locator(
          '.setting-item:has-text("Default Min Time"), ' +
            '.setting-item:has-text("Minimum Time"), ' +
            '.setting-item:has-text("Min time spent"), ' +
            '[data-setting="defaultStatsMinTime"]'
        );

        const hasMinTimeSetting = await minTimeSetting
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        console.log(`Min time setting found: ${hasMinTimeSetting}`);

        // This is optional per the feature request, so just log if present
        if (hasMinTimeSetting) {
          const input = minTimeSetting.locator('input[type="number"]');
          if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
            const value = await input.inputValue();
            console.log(`Current default min time value: ${value} minutes`);
          }
        }

        // Close settings
        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Statistics view uses default settings', () => {
    test.fixme(
      'reproduces issue #732 - opening Statistics view should use configured default date range',
      async () => {
        /**
         * After configuring a default date range in settings, opening the
         * Task & Project Statistics view should pre-select that date range
         * instead of always defaulting to "All Time".
         *
         * Current behavior (issue):
         * - Opening Statistics always shows "All Time"
         *
         * Expected behavior (after fix):
         * - Opening Statistics shows the configured default (e.g., "Last 30 Days")
         */
        const page = app.page;

        // First, configure a non-default setting (e.g., 30 days)
        // This would need the setting to exist first

        // Open Statistics view
        await runCommand(page, 'TaskNotes: Open Statistics');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.stats-view, [data-type="tasknotes-stats"]');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // Find the date range filter dropdown
        const dateRangeFilter = page.locator(
          '.stats-view__filter-select, ' +
            'select[data-filter="dateRange"], ' +
            '.stats-view select'
        ).first();

        if (await dateRangeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
          const currentValue = await dateRangeFilter.inputValue();
          console.log(`Current date range filter value: ${currentValue}`);

          // Document the current behavior: it defaults to "all"
          // After implementation, this should match the configured default
          console.log('Note: Currently defaults to "all" regardless of settings');

          // After implementation, verify the setting is respected
          // For example, if the default is configured to "30days":
          // expect(currentValue).toBe("30days");
        }
      }
    );

    test.fixme(
      'reproduces issue #732 - changing setting should affect next Statistics view open',
      async () => {
        /**
         * When the default date range setting is changed:
         * 1. Existing open Statistics views may continue with their current filter
         * 2. Newly opened Statistics views should use the new default
         *
         * This test verifies the setting takes effect when opening a fresh view.
         */
        const page = app.page;

        // Step 1: Open settings and change the default date range
        await runCommand(page, 'Settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Navigate to TaskNotes and Appearance settings
        const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await tasknotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tasknotesTab.click();
          await page.waitForTimeout(300);

          const appearanceTab = page.locator(
            '.setting-tab-content button:has-text("Appearance")'
          );
          if (await appearanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await appearanceTab.click();
            await page.waitForTimeout(300);
          }
        }

        // Find and change the date range setting (after implementation)
        const dateRangeSetting = page.locator(
          '.setting-item:has-text("Default Statistics Date Range") select, ' +
            '.setting-item:has-text("Default Date Range") select'
        );

        if (await dateRangeSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Change to "30days"
          await dateRangeSetting.selectOption('30days');
          await page.waitForTimeout(300);
          console.log('Changed default date range to 30 days');
        }

        // Close settings
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Step 2: Close any existing Statistics view
        await runCommand(page, 'Close this tab');
        await page.waitForTimeout(300);

        // Step 3: Open a fresh Statistics view
        await runCommand(page, 'TaskNotes: Open Statistics');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.stats-view');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // Step 4: Verify the new default is applied
        const dateRangeFilter = page.locator('.stats-view__filter-select').first();
        if (await dateRangeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
          const currentValue = await dateRangeFilter.inputValue();
          console.log(`Date range filter after setting change: ${currentValue}`);

          // After implementation, this should be "30days"
          expect(currentValue).toBe('30days');
        }
      }
    );
  });

  test.describe('Settings persistence', () => {
    test.fixme(
      'reproduces issue #732 - default date range setting should persist across restarts',
      async () => {
        /**
         * The default date range setting should be saved to the plugin settings
         * and persist when Obsidian is restarted.
         *
         * This is standard behavior for plugin settings, following the same
         * pattern as the Calendar View "Default View" setting.
         */
        const page = app.page;

        // This test documents that the setting should be stored in plugin settings
        // The actual implementation would add a property like:
        // settings.statsViewSettings.defaultDateRange: "all" | "7days" | "30days" | "90days"

        // Open settings to verify the setting exists and can be changed
        await runCommand(page, 'Settings');
        await page.waitForTimeout(500);

        const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await tasknotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tasknotesTab.click();
          await page.waitForTimeout(300);
        }

        // The setting should persist like other TaskNotes settings
        // Verify by checking that a value can be set
        const dateRangeSetting = page.locator(
          '.setting-item:has-text("Default Statistics Date Range")'
        );

        if (await dateRangeSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Default date range setting found - persistence is enabled via standard settings mechanism');
        }

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Implementation consistency', () => {
    test.fixme(
      'reproduces issue #732 - should follow same pattern as Calendar View Default View setting',
      async () => {
        /**
         * The user suggests reusing the same code pattern as "Default View"
         * in Calendar View settings.
         *
         * This test verifies both settings follow the same UI pattern:
         * 1. Both are dropdown selects
         * 2. Both are in the Appearance & UI section
         * 3. Both affect the default state when opening the respective view
         */
        const page = app.page;

        // Open settings
        await runCommand(page, 'Settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await tasknotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tasknotesTab.click();
          await page.waitForTimeout(300);

          const appearanceTab = page.locator(
            '.setting-tab-content button:has-text("Appearance")'
          );
          if (await appearanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await appearanceTab.click();
            await page.waitForTimeout(300);
          }
        }

        // Find the Calendar View Default View setting (existing)
        const calendarDefaultView = page.locator(
          '.setting-item:has-text("Default View"):has(select)'
        ).first();

        const hasCalendarSetting = await calendarDefaultView
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        console.log(`Calendar Default View setting found: ${hasCalendarSetting}`);

        // Find the Statistics Default Date Range setting (to be added)
        const statsDefaultRange = page.locator(
          '.setting-item:has-text("Default Statistics Date Range"):has(select), ' +
            '.setting-item:has-text("Default Date Range"):has(select)'
        );

        const hasStatsSetting = await statsDefaultRange
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        console.log(`Statistics Default Date Range setting found: ${hasStatsSetting}`);

        // Both should follow the same UI pattern
        if (hasCalendarSetting && hasStatsSetting) {
          // Verify both use dropdown selects
          const calendarSelect = calendarDefaultView.locator('select');
          const statsSelect = statsDefaultRange.locator('select');

          expect(await calendarSelect.isVisible()).toBe(true);
          expect(await statsSelect.isVisible()).toBe(true);

          console.log('Both settings use the same dropdown pattern');
        }

        await page.keyboard.press('Escape');
      }
    );
  });
});
