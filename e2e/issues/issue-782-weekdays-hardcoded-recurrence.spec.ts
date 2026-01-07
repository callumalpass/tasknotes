/**
 * Issue #782: [Bug]: week days are hard-coded
 *
 * Problem: The "Weekdays only" recurrence option in the RecurrenceContextMenu
 * uses a hardcoded BYDAY=MO,TU,WE,TH,FR pattern, which assumes the work week
 * is Monday-Friday. However, different countries have different work weeks:
 * - Israel: Sunday-Thursday
 * - UAE: Sunday-Thursday (as of 2022, previously Saturday-Wednesday)
 * - Saudi Arabia: Sunday-Thursday
 *
 * Additionally, the custom recurrence modal's day picker also starts with
 * Monday hardcoded, ignoring the "First day of week" setting.
 *
 * The bug is in RecurrenceContextMenu.ts:
 * - Line 184: BYDAY=MO,TU,WE,TH,FR hardcoded for "Weekdays only"
 * - Lines 454-462: Day checkboxes array hardcoded starting with Monday
 *
 * Expected behavior: Either follow locale conventions automatically,
 * or use the "First day of week" setting to determine weekday order
 * in the UI, though the actual weekdays definition may need a separate
 * setting since "first day of week" and "which days are weekdays"
 * are technically different concepts.
 *
 * Related: Issue #844 (weekday order in date context menu)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/782
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #782: Hardcoded weekdays in recurrence settings', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #782 - custom recurrence day picker should respect first day of week setting',
    async () => {
      /**
       * Steps to reproduce:
       * 1. Set "First Day of Week" to Sunday in TaskNotes settings
       * 2. Open a task or create a new one
       * 3. Open the recurrence menu
       * 4. Select "Custom recurrence..."
       * 5. Observe the day checkboxes order - starts with Monday (BUG)
       *
       * Expected: Day checkboxes should start with Sunday when firstDay = 0
       */
      const page = app.page;

      // First, set the first day of week to Sunday in settings
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      // Navigate to TaskNotes settings
      const taskNotesSettings = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await taskNotesSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesSettings.click();
        await page.waitForTimeout(300);
      }

      // Navigate to Appearance tab where calendar settings are
      const appearanceTab = page.locator('.tasknotes-settings-tab:has-text("Appearance")');
      if (await appearanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await appearanceTab.click();
        await page.waitForTimeout(300);
      }

      // Find the "First Day of Week" setting and set it to Sunday
      const firstDayDropdown = page.locator('.setting-item:has-text("First day of week") select');
      if (await firstDayDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstDayDropdown.selectOption('0'); // 0 = Sunday
        await page.waitForTimeout(300);
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Open calendar view to access tasks
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // Wait for calendar to load
      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find and right-click on a task event to access recurrence menu
      const taskEvent = page.locator('.fc-event').first();

      if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskEvent.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Look for "Recurrence" or "Repeat" option in context menu
        const recurrenceItem = page.locator(
          '.menu-item:has-text("Recurrence"), .menu-item:has-text("Repeat")'
        );
        if (await recurrenceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await recurrenceItem.click();
          await page.waitForTimeout(300);

          // Click on "Custom recurrence..." option
          const customRecurrenceItem = page.locator('.menu-item:has-text("Custom")');
          if (await customRecurrenceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await customRecurrenceItem.click();
            await page.waitForTimeout(500);

            // Find the custom recurrence modal
            const modal = page.locator('.modal');
            await expect(modal).toBeVisible({ timeout: 5000 });

            // Get the day checkboxes in order
            const dayCheckboxes = modal.locator('.day-checkbox, .days-container label');
            const dayLabels: string[] = [];

            const count = await dayCheckboxes.count();
            for (let i = 0; i < count; i++) {
              const text = await dayCheckboxes.nth(i).textContent();
              if (text) {
                dayLabels.push(text.trim());
              }
            }

            console.log('Day checkbox order:', dayLabels);

            // BUG: Currently the first day is always Monday regardless of setting
            // After fix: Sunday should be first when firstDay = 0
            if (dayLabels.length > 0) {
              const firstDay = dayLabels[0];
              // This assertion documents the expected behavior
              // Currently fails because Monday is always first (the bug)
              expect(firstDay.toLowerCase()).toContain('sun');
            }

            // Close the modal
            await page.keyboard.press('Escape');
          }
        } else {
          // Close the context menu
          await page.keyboard.press('Escape');
        }
      } else {
        console.log('No task events found in calendar - test requires existing tasks');
      }
    }
  );

  test.fixme(
    'reproduces issue #782 - weekdays only option should consider locale or setting',
    async () => {
      /**
       * The "Weekdays only" recurrence option generates BYDAY=MO,TU,WE,TH,FR
       * which assumes the Western Monday-Friday work week.
       *
       * For users in countries with Sunday-Thursday work weeks (Israel, UAE, etc.),
       * this option doesn't match their expectation of "weekdays".
       *
       * Note: This is a design decision - the fix could be:
       * 1. Add a separate "work days" setting
       * 2. Derive from locale
       * 3. Use the first day of week setting as a hint
       *
       * This test documents that the current behavior ignores locale/settings.
       */
      const page = app.page;

      // Open calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // Wait for calendar to load
      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find and right-click on a task event
      const taskEvent = page.locator('.fc-event').first();

      if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskEvent.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Look for "Recurrence" or "Repeat" option
        const recurrenceItem = page.locator(
          '.menu-item:has-text("Recurrence"), .menu-item:has-text("Repeat")'
        );
        if (await recurrenceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await recurrenceItem.hover();
          await page.waitForTimeout(300);

          // Look for "Weekdays only" option
          const weekdaysItem = page.locator('.menu-item:has-text("Weekdays")');
          if (await weekdaysItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Check if there's a way to see the generated RRULE
            // The bug is that it always generates MO,TU,WE,TH,FR
            // regardless of locale settings

            // For now, we can only document that this option exists
            // and should respect locale/settings in the future
            console.log('Found "Weekdays only" option - currently hardcoded to MO,TU,WE,TH,FR');

            // Click it to set the recurrence
            await weekdaysItem.click();
            await page.waitForTimeout(300);

            // Now open the custom recurrence modal to see what was generated
            await taskEvent.click({ button: 'right' });
            await page.waitForTimeout(300);

            const recurrenceItemAgain = page.locator(
              '.menu-item:has-text("Recurrence"), .menu-item:has-text("Repeat")'
            );
            if (await recurrenceItemAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
              await recurrenceItemAgain.click();
              await page.waitForTimeout(300);

              const customRecurrenceItem = page.locator('.menu-item:has-text("Custom")');
              if (await customRecurrenceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                await customRecurrenceItem.click();
                await page.waitForTimeout(500);

                // Check which days are selected in the modal
                const modal = page.locator('.modal');
                if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
                  const checkedDays = modal.locator('.day-checkbox input:checked, .days-container input:checked');
                  const checkedCount = await checkedDays.count();

                  console.log(`Number of checked days: ${checkedCount}`);

                  // Should be 5 days (the weekdays)
                  // In the future, which days are checked should depend on locale/settings
                  expect(checkedCount).toBe(5);

                  await page.keyboard.press('Escape');
                }
              }
            }
          }
        }

        await page.keyboard.press('Escape');
      }
    }
  );

  test.fixme(
    'reproduces issue #782 - day order in monthly recurrence should respect first day setting',
    async () => {
      /**
       * The monthly recurrence "by day" dropdown also uses a hardcoded
       * day order starting with Monday.
       *
       * When firstDay = 0 (Sunday), the dropdown should start with Sunday.
       */
      const page = app.page;

      // Open calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      const taskEvent = page.locator('.fc-event').first();

      if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskEvent.click({ button: 'right' });
        await page.waitForTimeout(300);

        const recurrenceItem = page.locator(
          '.menu-item:has-text("Recurrence"), .menu-item:has-text("Repeat")'
        );
        if (await recurrenceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await recurrenceItem.click();
          await page.waitForTimeout(300);

          const customRecurrenceItem = page.locator('.menu-item:has-text("Custom")');
          if (await customRecurrenceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await customRecurrenceItem.click();
            await page.waitForTimeout(500);

            const modal = page.locator('.modal');
            if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
              // Change frequency to Monthly to see the day dropdown
              const frequencyDropdown = modal.locator('.setting-item:has-text("Frequency") select');
              if (await frequencyDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
                await frequencyDropdown.selectOption('MONTHLY');
                await page.waitForTimeout(300);

                // Select "by day" option (e.g., "On the first Monday")
                const byDayRadio = modal.locator('input[type="radio"][value="byday"]');
                if (await byDayRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await byDayRadio.click();
                  await page.waitForTimeout(300);

                  // Find the day dropdown and check its first option
                  const dayDropdowns = modal.locator('.monthly-options select, .radio-option select');
                  const count = await dayDropdowns.count();

                  for (let i = 0; i < count; i++) {
                    const dropdown = dayDropdowns.nth(i);
                    const firstOption = dropdown.locator('option').first();
                    const firstOptionText = await firstOption.textContent();

                    if (firstOptionText?.toLowerCase().includes('monday') ||
                        firstOptionText?.toLowerCase().includes('sunday')) {
                      console.log(`Dropdown ${i} first option: ${firstOptionText}`);

                      // BUG: First option is always Monday regardless of firstDay setting
                      // After fix: Should be Sunday when firstDay = 0
                      // This documents the expected behavior
                    }
                  }
                }
              }

              await page.keyboard.press('Escape');
            }
          }
        }

        await page.keyboard.press('Escape');
      }
    }
  );
});
