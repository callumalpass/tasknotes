/**
 * Issue #1603: [FR] Show/hide completed/skipped instances of recurring tasks in calendar view
 *
 * Feature Request Description:
 * User wants the ability to toggle visibility of completed and/or skipped instances
 * of recurring tasks in calendar view, independent of the overall recurring task
 * visibility toggle. Currently, the showRecurring toggle shows/hides ALL recurring
 * task instances, but there's no way to show only pending (outstanding) instances.
 *
 * Use case: User wants to create a view that shows only outstanding tasks, filtering
 * out completed instances. For non-recurring tasks, filtering by "done" status works,
 * but for recurring tasks, there's no equivalent filter for individual instances.
 *
 * Current behavior:
 * - showRecurring toggle shows/hides ALL recurring task instances
 * - Completed/skipped instances are visually distinct (dimmed, strikethrough) but not filterable
 * - complete_instances and skipped_instances arrays track instance status
 * - Instance status is available in extendedProps.isCompleted and extendedProps.isSkipped
 *
 * Requested behavior:
 * - New toggle(s) to filter out completed and/or skipped instances from calendar display
 * - Could be sub-options under the showRecurring toggle
 * - Allow views to show only pending/outstanding recurring task instances
 *
 * Related architecture:
 * - CalendarView.ts viewOptions.showRecurring controls overall recurring visibility
 * - calendar-core.ts generateRecurringTaskInstances() generates all instances
 * - createNextScheduledEvent() and createRecurringEvent() set isCompleted/isSkipped
 * - registration.ts defines the showRecurring toggle in the events group
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1603
 * @see src/bases/CalendarView.ts for view options
 * @see src/bases/calendar-core.ts for instance generation (lines 750-816)
 * @see src/bases/registration.ts for toggle registration
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1603: Recurring Task Instance Visibility Toggle', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1603 - should have option to hide completed recurring task instances',
    async () => {
      /**
       * This test verifies that there should be a setting/toggle to hide
       * completed instances of recurring tasks while still showing pending instances.
       *
       * Current behavior:
       * - showRecurring toggle affects ALL recurring instances (completed, skipped, pending)
       * - No way to filter by instance completion status
       *
       * Expected behavior:
       * - Additional toggle(s) to filter completed/skipped instances
       * - User should be able to show only pending recurring task instances
       */
      const page = app.page;

      // Open calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for recurring task events with completion status indicators
      // Completed instances have specific styling (dimmed, strikethrough)
      const completedRecurringEvents = page.locator(
        '.fc-event.fc-completed-event, ' +
        '.fc-event[style*="opacity: 0.6"], ' +
        '.fc-event[style*="opacity: 0.4"]'
      );

      // Look for pending recurring events (no completion styling)
      const allRecurringEvents = page.locator(
        '.fc-event[id^="recurring-"], ' +
        '.fc-event[id^="next-scheduled-"]'
      );

      const completedCount = await completedRecurringEvents.count();
      const totalRecurringCount = await allRecurringEvents.count();

      console.log(`Total recurring events: ${totalRecurringCount}`);
      console.log(`Completed recurring events: ${completedCount}`);

      // Currently there's no UI to toggle completed instance visibility
      // After implementation, there should be a toggle in the calendar settings

      // Look for a settings button or dropdown in the calendar view
      const settingsButton = page.locator(
        '.calendar-settings-button, ' +
        '.fc-toolbar button[title*="settings"], ' +
        'button[aria-label*="settings"], ' +
        '.bases-toolbar-actions button'
      );

      if (await settingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(300);

        // After implementation, look for the new toggles
        const showCompletedToggle = page.locator(
          '[data-setting="showCompletedRecurringInstances"], ' +
          'input[name*="completed"][name*="recurring"], ' +
          'label:has-text("Show completed recurring")'
        );

        const showSkippedToggle = page.locator(
          '[data-setting="showSkippedRecurringInstances"], ' +
          'input[name*="skipped"][name*="recurring"], ' +
          'label:has-text("Show skipped recurring")'
        );

        // FEATURE REQUEST: These toggles should exist
        // After implementation, these assertions should pass
        console.log('Looking for completed instances toggle...');
        console.log('Looking for skipped instances toggle...');

        // For now, document that these don't exist
        // expect(await showCompletedToggle.isVisible()).toBe(true);
        // expect(await showSkippedToggle.isVisible()).toBe(true);
      }
    }
  );

  test.fixme(
    'reproduces issue #1603 - completed instances should be filterable independently',
    async () => {
      /**
       * Verifies that completed recurring task instances can be hidden
       * while still showing pending instances of the same recurring task.
       *
       * A recurring task with some completed instances and some pending
       * should be able to display only the pending instances.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Count all recurring events
      const allRecurringEvents = page.locator(
        '.fc-event[id^="recurring-"], ' +
        '.fc-event[id^="next-scheduled-"]'
      );
      const totalCount = await allRecurringEvents.count();

      // Count events that appear completed (have completion styling)
      const completedEvents = page.locator('.fc-event.fc-completed-event');
      const completedCount = await completedEvents.count();

      console.log(`Before toggle: ${totalCount} total, ${completedCount} completed`);

      // FEATURE: After hiding completed instances, only pending should remain
      // After implementation:
      // 1. Toggle off "Show completed recurring instances"
      // 2. Count remaining events
      // 3. Verify completed instances are hidden
      // 4. Verify pending instances are still visible

      // const pendingOnlyCount = totalCount - completedCount;
      // Toggle the setting (not yet implemented)
      // const newCount = await allRecurringEvents.count();
      // expect(newCount).toBe(pendingOnlyCount);
    }
  );

  test.fixme(
    'reproduces issue #1603 - skipped instances should be filterable independently',
    async () => {
      /**
       * Verifies that skipped recurring task instances can be hidden
       * while still showing completed and pending instances.
       *
       * Skipped instances are those where the user explicitly marked
       * the instance as skipped (not completed, but won't be rescheduled).
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Skipped instances have a distinct gray styling
      const skippedEvents = page.locator(
        '.fc-event[style*="rgba(128,128,128"], ' +
        '.fc-event.fc-skipped-event'
      );
      const skippedCount = await skippedEvents.count();

      console.log(`Skipped recurring events: ${skippedCount}`);

      // FEATURE: After hiding skipped instances, they should not be visible
      // After implementation:
      // 1. Toggle off "Show skipped recurring instances"
      // 2. Verify skipped instances are hidden
      // 3. Verify completed and pending instances remain visible
    }
  );

  test.fixme(
    'reproduces issue #1603 - instance visibility toggles should be sub-options of showRecurring',
    async () => {
      /**
       * The new instance visibility toggles should be logical sub-options
       * of the main showRecurring toggle. When showRecurring is OFF,
       * the sub-toggles should have no effect (nothing to filter).
       *
       * UI suggestion from issue: These could be nested/indented under
       * the showRecurring toggle in the settings panel.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find the settings/toggles panel
      const togglesContainer = page.locator(
        '.calendar-toggles, ' +
        '.bases-event-toggles, ' +
        '.calendar-settings-panel'
      );

      if (await togglesContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find the main showRecurring toggle
        const showRecurringToggle = page.locator(
          '[data-setting="showRecurring"], ' +
          'input[name*="showRecurring"], ' +
          'label:has-text("Show recurring")'
        );

        // FEATURE: These sub-toggles should exist and be visually nested
        const subToggles = page.locator(
          '.recurring-instance-toggles, ' +
          '.show-recurring-subtoggle'
        );

        // Verify toggle hierarchy:
        // - Show recurring tasks (main toggle)
        //   - Show completed instances (sub-toggle)
        //   - Show skipped instances (sub-toggle)

        console.log('Checking toggle hierarchy structure...');

        // After implementation:
        // 1. When showRecurring is OFF, sub-toggles should be disabled/hidden
        // 2. When showRecurring is ON, sub-toggles should be accessible
        // 3. Sub-toggles should be visually indented to show hierarchy
      }
    }
  );

  test.fixme(
    'reproduces issue #1603 - view configuration should persist instance visibility settings',
    async () => {
      /**
       * The instance visibility settings should be persisted as part of
       * the view configuration, allowing users to create saved views
       * that always show only pending tasks.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Configure view to hide completed instances
      // (Feature not yet implemented)

      // After implementation:
      // 1. Set showCompletedRecurringInstances = false
      // 2. Save the view configuration
      // 3. Reload/reopen the view
      // 4. Verify the setting persists
      // 5. Verify completed instances remain hidden

      console.log('Checking view configuration persistence...');
    }
  );

  test.fixme(
    'reproduces issue #1603 - base view filter should support pending-only recurring tasks',
    async () => {
      /**
       * Users should be able to create a Base view filter that shows
       * only pending instances of recurring tasks. This might be done
       * through the view settings or through a filter expression.
       *
       * Potential filter approaches:
       * 1. View setting: showCompletedRecurringInstances = false
       * 2. Filter expression: isRecurring AND NOT isInstanceCompleted
       * 3. Built-in preset: "Pending recurring tasks"
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for filter options related to recurring task instances
      const filterBar = page.locator(
        '.filter-bar, ' +
        '.bases-filter-bar, ' +
        '.calendar-filter'
      );

      if (await filterBar.isVisible({ timeout: 3000 }).catch(() => false)) {
        // FEATURE: Filter should support recurring instance status
        // Options might include:
        // - "Pending recurring instances"
        // - "Completed recurring instances"
        // - "Skipped recurring instances"

        console.log('Checking filter options for recurring instance status...');
      }
    }
  );
});
