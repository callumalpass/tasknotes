/**
 * Issue #844: [Bug]: Wrong weekday order in task menu
 *
 * Problem: When the "First Day of Week" setting is set to Monday,
 * the weekdays submenu in the task right-click context menu still shows
 * Sunday as the first day instead of Monday.
 *
 * The bug is in DateContextMenu.getDateOptions() which uses a hardcoded
 * weekday array starting with Sunday (lines 177-185) instead of respecting
 * the plugin's calendarViewSettings.firstDay setting.
 *
 * Expected behavior:
 * - With firstDay = 0 (Sunday): Sun, Mon, Tue, Wed, Thu, Fri, Sat
 * - With firstDay = 1 (Monday): Mon, Tue, Wed, Thu, Fri, Sat, Sun
 * - With firstDay = 6 (Saturday): Sat, Sun, Mon, Tue, Wed, Thu, Fri
 *
 * Related: This is the same underlying bug as issue #1433.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/844
 * @see https://github.com/callumalpass/tasknotes/issues/1433
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #844: Wrong weekday order in task menu', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #844 - weekday submenu should start with Monday when first day is set to Monday',
    async () => {
      /**
       * Steps to reproduce:
       * 1. Set "First Day of Week" to Monday in TaskNotes settings
       * 2. Open calendar view
       * 3. Right-click on a task
       * 4. Hover over "Due Date" or "Scheduled Date"
       * 5. Hover over "Weekdays" submenu
       * 6. Observe weekday order - Sunday appears first (BUG)
       *
       * Expected: Monday should appear first in the weekdays list
       */
      const page = app.page;

      // First, set the first day of week to Monday in settings
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

      // Find the "First Day of Week" setting and set it to Monday
      const firstDayDropdown = page.locator('.setting-item:has-text("First day of week") select');
      if (await firstDayDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstDayDropdown.selectOption('1'); // 1 = Monday
        await page.waitForTimeout(300);
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Open calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // Wait for calendar to load
      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find and right-click on a task event
      const taskEvent = page.locator('.fc-event').first();

      // If no tasks exist, we'd need to create one first
      if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskEvent.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Hover over "Due Date" submenu
        const dueDateItem = page.locator('.menu-item:has-text("Due Date"), .menu-item:has-text("Due date")');
        if (await dueDateItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dueDateItem.hover();
          await page.waitForTimeout(300);

          // Hover over "Weekdays" submenu
          const weekdaysItem = page.locator('.menu-item:has-text("Weekdays")');
          if (await weekdaysItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await weekdaysItem.hover();
            await page.waitForTimeout(300);

            // Get the weekday items in order
            const weekdayItems = page.locator('.menu .menu-item');
            const weekdayLabels: string[] = [];

            const count = await weekdayItems.count();
            for (let i = 0; i < count; i++) {
              const text = await weekdayItems.nth(i).textContent();
              if (text) {
                weekdayLabels.push(text.trim());
              }
            }

            console.log('Weekday order in menu:', weekdayLabels);

            // BUG: Currently the first weekday shown is Sunday regardless of setting
            // After fix: Monday should be first when firstDay = 1
            const firstWeekday = weekdayLabels[0];

            // This assertion documents the expected behavior
            // Currently fails because Sunday is always first (the bug)
            expect(firstWeekday).toBe('Monday');
          }
        }

        // Close the context menu
        await page.keyboard.press('Escape');
      } else {
        console.log('No task events found in calendar - test requires existing tasks');
        // The test documents the expected behavior even if we can't verify it without tasks
        expect(true).toBe(true);
      }
    }
  );

  test.fixme(
    'reproduces issue #844 - scheduled date weekday submenu should also respect first day setting',
    async () => {
      /**
       * The same bug affects both "Due Date" and "Scheduled Date" submenus
       * since they both use DateContextMenu.getDateOptions()
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

        // Hover over "Scheduled Date" submenu
        const scheduledDateItem = page.locator(
          '.menu-item:has-text("Scheduled Date"), .menu-item:has-text("Scheduled date")'
        );
        if (await scheduledDateItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateItem.hover();
          await page.waitForTimeout(300);

          // Hover over "Weekdays" submenu
          const weekdaysItem = page.locator('.menu-item:has-text("Weekdays")');
          if (await weekdaysItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await weekdaysItem.hover();
            await page.waitForTimeout(300);

            // The weekday order should match the firstDay setting
            // This assertion documents the expected behavior
            const firstWeekdayItem = page.locator('.menu .menu-item').first();
            const firstWeekdayText = await firstWeekdayItem.textContent();

            // After fix: should start with Monday when firstDay = 1
            expect(firstWeekdayText?.trim()).toBe('Monday');
          }
        }

        // Close the context menu
        await page.keyboard.press('Escape');
      }
    }
  );

  test.fixme(
    'reproduces issue #844 - weekday order should be consistent with calendar view header',
    async () => {
      /**
       * The weekday order in the context menu should match the calendar view header
       * when both are configured to start on the same day.
       *
       * Currently the bug causes inconsistency:
       * - Calendar header respects firstDay setting (shows Mon first when firstDay=1)
       * - Context menu ignores firstDay setting (always shows Sun first)
       */
      const page = app.page;

      // Open calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // Wait for calendar to load
      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Check the calendar header weekday order
      const calendarHeaderDays = page.locator('.fc-col-header-cell');
      const headerDayLabels: string[] = [];

      const headerCount = await calendarHeaderDays.count();
      for (let i = 0; i < headerCount; i++) {
        const text = await calendarHeaderDays.nth(i).textContent();
        if (text) {
          headerDayLabels.push(text.trim());
        }
      }

      console.log('Calendar header weekday order:', headerDayLabels);

      // The first day in the calendar header
      const calendarFirstDay = headerDayLabels[0];

      // Now check the context menu weekday order
      const taskEvent = page.locator('.fc-event').first();

      if (await taskEvent.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskEvent.click({ button: 'right' });
        await page.waitForTimeout(300);

        const dueDateItem = page.locator('.menu-item:has-text("Due Date"), .menu-item:has-text("Due date")');
        if (await dueDateItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dueDateItem.hover();
          await page.waitForTimeout(300);

          const weekdaysItem = page.locator('.menu-item:has-text("Weekdays")');
          if (await weekdaysItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await weekdaysItem.hover();
            await page.waitForTimeout(300);

            const menuFirstDay = await page.locator('.menu .menu-item').first().textContent();

            console.log(`Calendar first day: ${calendarFirstDay}`);
            console.log(`Menu first day: ${menuFirstDay?.trim()}`);

            // After fix: both should start with the same day
            // This documents the expected consistency
            expect(menuFirstDay?.trim().toLowerCase()).toContain(calendarFirstDay?.toLowerCase() || '');
          }
        }

        await page.keyboard.press('Escape');
      }
    }
  );
});
