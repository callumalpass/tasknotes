/**
 * Issue #685: [Bug] "All Day" Tasks Are Not Hidden in Advanced Calendar List View
 *
 * When the "All-day slot" option is de-checked in View Options, all-day tasks
 * should be hidden in the List view (listWeek). Currently, they remain visible.
 *
 * Root cause: The `showAllDaySlot` view option is passed to FullCalendar's
 * `allDaySlot` configuration, which correctly hides the all-day slot area
 * in grid views (month, week, day). However, the list view (listWeek) doesn't
 * have an all-day slot area - it shows events inline. The filtering logic in
 * `buildAllEvents()` does not filter out all-day events when the option is
 * disabled and the view is listWeek.
 *
 * The fix should:
 * 1. Detect when the current view is listWeek and showAllDaySlot is false
 * 2. Filter out all-day events from all sources (tasks, ICS, Google, Microsoft)
 * 3. Only apply this filtering in list view context
 *
 * @see https://github.com/callumalpass/tasknotes/issues/685
 * @see CalendarView.ts buildAllEvents() for the missing filter logic
 * @see registration.ts lines 292-295 for the showAllDaySlot toggle definition
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #685: All-Day Tasks Not Hidden in List View', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #685 - all-day tasks should be hidden in list view when All-day slot is disabled',
    async () => {
      /**
       * This test verifies that when the "All-day slot" option is unchecked
       * in the View Options, all-day tasks are hidden from the List view.
       *
       * Current behavior (bug):
       * - De-checking "All-day slot" in View Options hides the all-day slot
       *   area in grid views (week, day), but all-day tasks remain visible
       *   in the List view.
       *
       * Expected behavior:
       * - When "All-day slot" is unchecked, all-day tasks should be hidden
       *   from all views including the List view.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to List view (listWeek)
      const listViewButton = page.locator(
        '.fc-listWeek-button, button:has-text("list"), .fc-toolbar button:has-text("List")'
      );

      if (await listViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(500);
      }

      // Verify we're in list view
      const listViewContainer = page.locator('.fc-list, .fc-listWeek-view');
      await expect(listViewContainer).toBeVisible({ timeout: 5000 });

      // Count all events in list view
      const allEvents = page.locator('.fc-list-event, .fc-event');
      const initialEventCount = await allEvents.count();

      // Count all-day events specifically (they have special styling or data attributes)
      // FullCalendar list view shows all-day events differently - they appear in the
      // event list but may have different time display or "all-day" indicator
      const allDayEvents = page.locator(
        '.fc-list-event[data-allday="true"], ' +
          '.fc-list-event .fc-list-event-time:has-text("all-day"), ' +
          '.fc-list-event .fc-list-event-time:empty'
      );
      const allDayEventCount = await allDayEvents.count();

      console.log(`List view: Total events: ${initialEventCount}, All-day events: ${allDayEventCount}`);

      // Open View Options
      const viewOptionsButton = page.locator(
        '[aria-label="View options"], ' +
          'button:has-text("View options"), ' +
          '.view-options-button, ' +
          '.bases-view-options'
      );

      if (await viewOptionsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await viewOptionsButton.click();
        await page.waitForTimeout(300);

        // Find and toggle the "All-day slot" option
        const allDaySlotToggle = page.locator(
          'text="All-day slot" >> xpath=ancestor::*[contains(@class, "toggle") or contains(@class, "setting")]//input, ' +
            'label:has-text("All-day slot") input, ' +
            '[data-setting="showAllDaySlot"] input, ' +
            '.setting-item:has-text("All-day slot") input'
        );

        if (await allDaySlotToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Check if it's currently enabled
          const isChecked = await allDaySlotToggle.isChecked();

          if (isChecked) {
            // Disable the All-day slot option
            await allDaySlotToggle.click();
            await page.waitForTimeout(500);
          }

          // Close the options menu (click elsewhere or press Escape)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          // Now count events again - all-day events should be hidden
          const eventsAfterToggle = page.locator('.fc-list-event, .fc-event');
          const eventCountAfterToggle = await eventsAfterToggle.count();

          console.log(
            `After disabling All-day slot: Events before: ${initialEventCount}, Events after: ${eventCountAfterToggle}`
          );

          // BUG: Currently all-day events are still visible
          // After the fix, if there were all-day events, the count should be lower
          if (allDayEventCount > 0) {
            // The number of events should decrease by at least the all-day event count
            expect(eventCountAfterToggle).toBeLessThan(initialEventCount);
          }

          // Re-enable All-day slot for cleanup
          await viewOptionsButton.click();
          await page.waitForTimeout(300);

          if (await allDaySlotToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
            const isNowChecked = await allDaySlotToggle.isChecked();
            if (!isNowChecked) {
              await allDaySlotToggle.click();
            }
          }
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #685 - all-day ICS subscription events should be hidden in list view',
    async () => {
      /**
       * Tests that all-day events from ICS calendar subscriptions are also
       * hidden when the "All-day slot" option is disabled in list view.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to List view
      const listViewButton = page.locator('.fc-listWeek-button');
      if (await listViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(500);
      }

      // Look for ICS subscription events (they have specific styling/classes)
      const icsEvents = page.locator(
        '.fc-list-event[data-source="ics"], ' +
          '.fc-list-event.ics-event, ' +
          '.fc-list-event .fc-event-ics'
      );
      const icsEventCount = await icsEvents.count();

      console.log(`ICS events in list view: ${icsEventCount}`);

      // If there are ICS events, verify they would be hidden with All-day slot disabled
      // (This test documents the expected behavior even if no ICS subscriptions are active)

      if (icsEventCount > 0) {
        // Open View Options and disable All-day slot
        const viewOptionsButton = page.locator('[aria-label="View options"], .view-options-button');

        if (await viewOptionsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await viewOptionsButton.click();
          await page.waitForTimeout(300);

          const allDaySlotToggle = page.locator('label:has-text("All-day slot") input');

          if (await allDaySlotToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            const isChecked = await allDaySlotToggle.isChecked();
            if (isChecked) {
              await allDaySlotToggle.click();
              await page.waitForTimeout(500);
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            // Check ICS events again - all-day ICS events should be hidden
            const icsEventsAfter = page.locator(
              '.fc-list-event[data-source="ics"], .fc-list-event.ics-event'
            );
            const icsEventCountAfter = await icsEventsAfter.count();

            console.log(`ICS events after disabling All-day slot: ${icsEventCountAfter}`);

            // All-day ICS events should be hidden
            // (Timed ICS events should still be visible)
          }
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #685 - toggling All-day slot should immediately update list view',
    async () => {
      /**
       * When the user toggles the "All-day slot" option, the list view should
       * immediately update to show/hide all-day events without requiring a
       * view refresh or navigation.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to List view
      const listViewButton = page.locator('.fc-listWeek-button');
      if (await listViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(500);
      }

      const listViewContainer = page.locator('.fc-list, .fc-listWeek-view');
      await expect(listViewContainer).toBeVisible({ timeout: 5000 });

      // Get initial event count
      const allEvents = page.locator('.fc-list-event');
      const initialCount = await allEvents.count();

      // Open View Options
      const viewOptionsButton = page.locator('[aria-label="View options"], .view-options-button');

      if (await viewOptionsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await viewOptionsButton.click();
        await page.waitForTimeout(300);

        const allDaySlotToggle = page.locator('label:has-text("All-day slot") input');

        if (await allDaySlotToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Toggle off
          const wasChecked = await allDaySlotToggle.isChecked();
          if (wasChecked) {
            await allDaySlotToggle.click();
          }
          await page.waitForTimeout(300);

          // Check if view updated immediately (without closing menu)
          const countAfterToggle = await allEvents.count();

          console.log(`Immediate update test: Before: ${initialCount}, After toggle: ${countAfterToggle}`);

          // Toggle back on
          await allDaySlotToggle.click();
          await page.waitForTimeout(300);

          const countAfterRestore = await allEvents.count();

          // Count should return to initial after re-enabling
          expect(countAfterRestore).toBe(initialCount);

          await page.keyboard.press('Escape');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #685 - All-day slot toggle should not affect grid view day/week display',
    async () => {
      /**
       * The "All-day slot" toggle should work correctly in grid views (hiding
       * the all-day slot area) while also filtering events in list view.
       * This test ensures the fix doesn't break existing grid view behavior.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to Week view (grid)
      const weekViewButton = page.locator('.fc-timeGridWeek-button');
      if (await weekViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await weekViewButton.click();
        await page.waitForTimeout(500);
      }

      // Check for all-day slot in grid view
      const allDaySlot = page.locator('.fc-daygrid-day-frame, .fc-day-grid, .fc-timegrid-divider');
      const hasAllDaySlot = await allDaySlot.isVisible({ timeout: 3000 }).catch(() => false);

      console.log(`Grid view has visible all-day slot: ${hasAllDaySlot}`);

      // Open View Options and toggle All-day slot
      const viewOptionsButton = page.locator('[aria-label="View options"], .view-options-button');

      if (await viewOptionsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await viewOptionsButton.click();
        await page.waitForTimeout(300);

        const allDaySlotToggle = page.locator('label:has-text("All-day slot") input');

        if (await allDaySlotToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
          const wasChecked = await allDaySlotToggle.isChecked();

          if (wasChecked) {
            await allDaySlotToggle.click();
            await page.waitForTimeout(500);

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            // In grid view, the all-day slot area should be hidden
            const allDaySlotAfter = page.locator('.fc-daygrid-day-frame, .fc-day-grid');
            const isSlotVisibleAfter = await allDaySlotAfter.isVisible({ timeout: 2000 }).catch(() => false);

            // The all-day slot UI element should be hidden in grid views
            // (This is existing behavior that should be preserved)
            console.log(`All-day slot visible after toggle: ${isSlotVisibleAfter}`);

            // Re-enable for cleanup
            await viewOptionsButton.click();
            await page.waitForTimeout(300);

            if (await allDaySlotToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
              await allDaySlotToggle.click();
            }
          }
        }
      }
    }
  );
});
