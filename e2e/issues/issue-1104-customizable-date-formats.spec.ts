/**
 * Issue #1104: [FR] Customizable Date Formats for 'dateCreated', 'dateModified' etc.
 *
 * Feature request to allow users to select custom date formats for displaying
 * dates like dateCreated, dateModified, completedDate, due, scheduled, etc.
 *
 * Currently, dates are displayed using hardcoded formats:
 * - dateCreated/dateModified/completedDate: "MMM d" (e.g., "Jan 7")
 * - due/scheduled: Various formats depending on context
 *
 * Users want:
 * - Ability to customize date display formats in settings
 * - Different format options like:
 *   - "MM/DD/YYYY" vs "DD/MM/YYYY" vs "YYYY-MM-DD"
 *   - Include/exclude year
 *   - Include/exclude time
 *   - Localized formats (based on locale)
 * - Consistent formatting across all date properties
 *
 * @see https://github.com/cldellow/tasknotes/issues/1104
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1104: Customizable Date Formats', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Settings for Date Format Customization', () => {
    test.fixme(
      'reproduces issue #1104 - settings should have date format options',
      async () => {
        /**
         * Users should be able to configure how dates are displayed.
         * A new settings section should exist for date format preferences.
         *
         * Expected settings:
         * - Date format pattern (dropdown or text input)
         * - Common presets: "MMM d, yyyy", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"
         * - Option to show/hide year
         * - Option to show/hide time for datetime values
         * - Separate format for inline/card display vs detailed views
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal, [role="dialog"]');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Look for date format settings section
        const dateFormatSection = settingsModal.locator(
          'text=Date format, ' +
            'text=Date Format, ' +
            '[data-section="date-format"], ' +
            '.setting-item:has-text("date format")'
        );

        const hasDateFormatSection = await dateFormatSection
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Date format settings section exists: ${hasDateFormatSection}`);

        // Document expected behavior - should have date format options
        expect(hasDateFormatSection).toBe(true);

        if (hasDateFormatSection) {
          // Check for specific format options
          const formatDropdown = settingsModal.locator(
            'select[data-setting="dateFormat"], ' +
              '[data-testid="date-format-select"], ' +
              '.date-format-dropdown'
          );

          const hasFormatDropdown = await formatDropdown
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          console.log(`Has date format dropdown: ${hasFormatDropdown}`);

          // Check for common format presets
          const presetOptions = [
            'MMM d, yyyy',
            'MM/DD/YYYY',
            'DD/MM/YYYY',
            'YYYY-MM-DD',
            'Custom',
          ];

          for (const preset of presetOptions) {
            const hasPreset = await settingsModal
              .locator(`text="${preset}"`)
              .isVisible({ timeout: 500 })
              .catch(() => false);
            console.log(`Has preset "${preset}": ${hasPreset}`);
          }
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1104 - should allow custom date format pattern',
      async () => {
        /**
         * Users should be able to enter a custom date format pattern
         * using standard format tokens (from date-fns or similar).
         *
         * Format tokens:
         * - yyyy: 4-digit year
         * - yy: 2-digit year
         * - MM: 2-digit month
         * - MMM: Abbreviated month name
         * - MMMM: Full month name
         * - dd: 2-digit day
         * - d: Day without leading zero
         * - HH: 24-hour
         * - hh: 12-hour
         * - mm: Minutes
         * - a: AM/PM
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal, [role="dialog"]');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Look for custom format input
        const customFormatInput = settingsModal.locator(
          'input[data-setting="customDateFormat"], ' +
            '[data-testid="custom-date-format-input"], ' +
            'input[placeholder*="date format"]'
        );

        const hasCustomInput = await customFormatInput
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Has custom format input: ${hasCustomInput}`);

        // Document expected behavior
        expect(hasCustomInput).toBe(true);

        if (hasCustomInput) {
          // Look for format help/documentation link
          const formatHelp = settingsModal.locator(
            'text=format tokens, ' +
              'a[href*="date-fns"], ' +
              '.format-help, ' +
              '[data-testid="format-help"]'
          );

          const hasFormatHelp = await formatHelp.isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`Has format help: ${hasFormatHelp}`);
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1104 - should support separate formats for different contexts',
      async () => {
        /**
         * Users might want different formats for different contexts:
         * - Compact format for task cards (e.g., "Jan 7")
         * - Full format for modals/details (e.g., "January 7, 2026 at 3:30 PM")
         * - ISO format for sorting/filtering (e.g., "2026-01-07")
         *
         * Settings should allow configuring:
         * - Card/inline display format
         * - Modal/detail display format
         * - Whether to show time component
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal, [role="dialog"]');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Look for context-specific format options
        const cardFormatSetting = settingsModal.locator(
          'text=Card date format, ' +
            'text=Compact format, ' +
            '[data-setting="cardDateFormat"]'
        );

        const detailFormatSetting = settingsModal.locator(
          'text=Detail date format, ' +
            'text=Full format, ' +
            '[data-setting="detailDateFormat"]'
        );

        const showTimeSetting = settingsModal.locator(
          'text=Show time, ' +
            '[data-setting="showTimeInDates"], ' +
            'input[type="checkbox"]:near(:text("time"))'
        );

        const hasCardFormat = await cardFormatSetting
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        const hasDetailFormat = await detailFormatSetting
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        const hasShowTime = await showTimeSetting.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Has card format setting: ${hasCardFormat}`);
        console.log(`Has detail format setting: ${hasDetailFormat}`);
        console.log(`Has show time setting: ${hasShowTime}`);

        // Document expected behavior
        expect(hasCardFormat || hasDetailFormat).toBe(true);

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Date Display in Task Cards', () => {
    test.fixme(
      'reproduces issue #1104 - dateCreated should use configured format',
      async () => {
        /**
         * The dateCreated property is currently displayed as "Created: MMM d"
         * (e.g., "Created: Jan 7"). This format is hardcoded in TaskCard.ts.
         *
         * After implementation:
         * - Format should come from user settings
         * - Should respect user's dateFormat preference
         * - Should optionally show year based on settings
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a task card with dateCreated visible
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();

        if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Look for dateCreated display
          const dateCreatedEl = taskCard.locator(
            '[data-property="dateCreated"], ' +
              '.task-card__metadata-pill:has-text("Created")'
          );

          if (await dateCreatedEl.isVisible({ timeout: 2000 }).catch(() => false)) {
            const dateText = await dateCreatedEl.textContent();
            console.log(`Current dateCreated display: "${dateText}"`);

            // Current hardcoded format is "Created: MMM d" like "Created: Jan 7"
            // After implementation, format should be configurable
            // This test documents that format customization is needed
          }
        }

        // Document that date format customization is needed
        expect(true).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #1104 - dateModified should use configured format',
      async () => {
        /**
         * The dateModified property is currently displayed as "Modified: MMM d"
         * (e.g., "Modified: Jan 7"). This format is hardcoded in TaskCard.ts.
         *
         * Same requirements as dateCreated - should respect user format settings.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a task card with dateModified visible
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();

        if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          const dateModifiedEl = taskCard.locator(
            '[data-property="dateModified"], ' +
              '.task-card__metadata-pill:has-text("Modified")'
          );

          if (await dateModifiedEl.isVisible({ timeout: 2000 }).catch(() => false)) {
            const dateText = await dateModifiedEl.textContent();
            console.log(`Current dateModified display: "${dateText}"`);
          }
        }

        expect(true).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #1104 - completedDate should use configured format',
      async () => {
        /**
         * The completedDate property is displayed similarly to dateCreated/dateModified.
         * Should also respect user format settings.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a completed task
        const completedTaskCard = page
          .locator('.tasknotes-task-card, .task-card')
          .filter({ has: page.locator('[data-status="done"], .task-completed') })
          .first();

        if (await completedTaskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          const completedDateEl = completedTaskCard.locator(
            '[data-property="completedDate"], ' +
              '.task-card__metadata-pill:has-text("Completed")'
          );

          if (await completedDateEl.isVisible({ timeout: 2000 }).catch(() => false)) {
            const dateText = await completedDateEl.textContent();
            console.log(`Current completedDate display: "${dateText}"`);
          }
        }

        expect(true).toBe(true);
      }
    );
  });

  test.describe('Date Display in Modals', () => {
    test.fixme(
      'reproduces issue #1104 - task edit modal should show dates in configured format',
      async () => {
        /**
         * When viewing/editing a task in a modal, dates should be displayed
         * using the user's configured format (possibly a "detail" format that
         * shows more information than the compact card format).
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Click on a task to open edit modal
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();

        if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await taskCard.click();
          await page.waitForTimeout(500);

          const taskModal = page.locator('.modal, [role="dialog"]');
          if (await taskModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Check date displays in modal
            const dateFields = taskModal.locator(
              '[data-field="dateCreated"], ' +
                '[data-field="dateModified"], ' +
                '.task-modal__date-field'
            );

            const count = await dateFields.count();
            console.log(`Number of date fields in modal: ${count}`);

            for (let i = 0; i < count; i++) {
              const text = await dateFields.nth(i).textContent();
              console.log(`Date field ${i}: "${text}"`);
            }

            await page.keyboard.press('Escape');
          }
        }

        expect(true).toBe(true);
      }
    );
  });

  test.describe('Locale Support', () => {
    test.fixme(
      'reproduces issue #1104 - dates should respect locale settings',
      async () => {
        /**
         * Date formats should optionally respect the user's locale:
         * - Month names in user's language
         * - Date order appropriate for locale (DD/MM vs MM/DD)
         * - Time format (12h vs 24h) - already partially supported
         *
         * The plugin already has some locale support (nlpLanguage, uiLanguage),
         * but date formatting may not fully leverage these settings.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal, [role="dialog"]');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Look for locale-aware date format option
        const localeAwareOption = settingsModal.locator(
          'text=Use locale, ' +
            'text=Localized, ' +
            '[data-setting="useLocaleDateFormat"], ' +
            'input[name="useLocaleDateFormat"]'
        );

        const hasLocaleOption = await localeAwareOption
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Has locale-aware date option: ${hasLocaleOption}`);

        // Document expected behavior
        expect(hasLocaleOption).toBe(true);

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Implementation Considerations', () => {
    test.fixme(
      'reproduces issue #1104 - affected areas: TaskCard property renderers',
      async () => {
        /**
         * Files that need modification for this feature:
         *
         * 1. src/settings/defaults.ts
         *    - Add new settings for date formats
         *
         * 2. src/types/settings.ts
         *    - Add types for date format settings
         *
         * 3. src/ui/TaskCard.ts (lines 780-795)
         *    - PROPERTY_RENDERERS for dateCreated, dateModified, completedDate
         *    - Currently hardcoded: dateFormat: "MMM d", showTime: false
         *    - Should read format from plugin.settings
         *
         * 4. src/utils/dateUtils.ts
         *    - formatDateTimeForDisplay already accepts dateFormat parameter
         *    - May need new helper for getting format from settings
         *
         * 5. Settings UI (new settings tab section)
         *    - Add date format configuration options
         *
         * The infrastructure for custom formats largely exists; the main work is:
         * - Adding settings UI and storage
         * - Passing settings through to formatDateTimeForDisplay calls
         */
        const page = app.page;

        // This test documents the implementation scope
        console.log(
          'Implementation scope for date format customization:\n' +
            '1. Add dateFormat settings to TaskNotesSettings\n' +
            '2. Create settings UI for format selection\n' +
            '3. Update PROPERTY_RENDERERS in TaskCard.ts to use settings\n' +
            '4. Update other date displays (modals, views) to use settings\n' +
            '5. Consider separate formats for compact vs detailed views'
        );

        expect(true).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #1104 - format preview should show example dates',
      async () => {
        /**
         * When configuring date formats in settings, users should see
         * a live preview of how dates will appear.
         *
         * Example:
         * Format: "MMM d, yyyy" -> Preview: "Jan 7, 2026"
         * Format: "DD/MM/YYYY" -> Preview: "07/01/2026"
         * Format: "YYYY-MM-DD" -> Preview: "2026-01-07"
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal, [role="dialog"]');
        await expect(settingsModal).toBeVisible({ timeout: 5000 });

        // Look for format preview element
        const formatPreview = settingsModal.locator(
          '.date-format-preview, ' +
            '[data-testid="format-preview"], ' +
            '.format-preview, ' +
            ':text("Preview:")'
        );

        const hasPreview = await formatPreview.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Has format preview: ${hasPreview}`);

        // Document expected behavior
        expect(hasPreview).toBe(true);

        await page.keyboard.press('Escape');
      }
    );
  });
});
