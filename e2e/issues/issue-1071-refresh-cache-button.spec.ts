/**
 * Issue #1071: [FR] Make refresh button refresh cache as well
 *
 * Feature description:
 * User requests that the "Refresh" button (visible in calendar view toolbar) also
 * triggers a full TaskNotes cache refresh, rather than just refreshing calendar
 * subscriptions (ICS, Google Calendar, Microsoft Calendar).
 *
 * Current behavior:
 * - The "Refresh" button in the calendar view only refreshes calendar subscriptions
 *   and refetches events
 * - A separate "Refresh TaskNotes cache" command exists but requires using the
 *   command palette (Cmd/Ctrl+P)
 *
 * Expected behavior:
 * - The refresh button should also call the main cache refresh functionality
 * - This provides a single click to refresh all data including:
 *   - Calendar subscriptions (ICS, Google, Microsoft)
 *   - TaskNotes internal cache (via cacheManager.clearAllCaches())
 *   - All views notified to update
 *
 * Implementation considerations:
 * - Modify CalendarView.ts refreshCalendars button click handler
 * - Add call to plugin.refreshCache() in addition to subscription refreshes
 * - Consider adding a "Refresh cache" tooltip or hint
 * - May want to add loading indicator during cache refresh
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1071
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1071: Refresh button should also refresh cache', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1071 - refresh button triggers full cache refresh',
    async () => {
      /**
       * Core test: The refresh button in calendar view should trigger a full
       * TaskNotes cache refresh in addition to refreshing calendar subscriptions.
       *
       * Steps to reproduce expected behavior:
       * 1. Open the calendar view
       * 2. Click the refresh button in the toolbar
       * 3. Verify that both calendar subscriptions AND TaskNotes cache are refreshed
       *
       * Current behavior: Only calendar subscriptions are refreshed
       * Expected behavior: Full cache refresh including TaskNotes internal cache
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find the refresh button in the calendar toolbar
      // The button text is "Refresh" based on i18n key views.basesCalendar.buttonText.refresh
      const refreshButton = page.locator(
        '.fc-toolbar button:has-text("Refresh"), .fc-refreshCalendars-button'
      );

      const isRefreshVisible = await refreshButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (isRefreshVisible) {
        // Click the refresh button
        await refreshButton.click();

        // Wait for refresh to complete
        await page.waitForTimeout(1500);

        // Once implemented, we expect to see the cache refresh notice
        // "TaskNotes cache refreshed successfully" or similar
        // Currently only calendar subscription refresh happens

        // Look for notice that indicates full cache refresh
        const cacheRefreshNotice = page.locator(
          '.notice:has-text("cache refreshed"), .notice:has-text("Cache refreshed")'
        );

        // This assertion documents expected behavior
        // It will pass once the refresh button also triggers cache refresh
        const hasRefreshNotice = await cacheRefreshNotice.isVisible({ timeout: 2000 }).catch(() => false);

        // Currently this will fail because only calendar subscriptions are refreshed
        // Once implemented, the full cache refresh should show a notice
        expect(hasRefreshNotice).toBe(true);
      }
    }
  );

  test.fixme(
    'reproduces issue #1071 - refresh button tooltip indicates cache refresh',
    async () => {
      /**
       * The refresh button should indicate that it also refreshes the cache,
       * not just calendar subscriptions.
       *
       * Expected behavior:
       * - Button hint/tooltip mentions cache refresh
       * - Users understand clicking refresh will refresh all data
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find the refresh button
      const refreshButton = page.locator(
        '.fc-toolbar button:has-text("Refresh"), .fc-refreshCalendars-button'
      );

      const isRefreshVisible = await refreshButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (isRefreshVisible) {
        // Hover over the button to see tooltip
        await refreshButton.hover();
        await page.waitForTimeout(300);

        // Get the title/tooltip attribute
        const tooltip = await refreshButton.getAttribute('title');
        const ariaLabel = await refreshButton.getAttribute('aria-label');

        // Once implemented, the tooltip should mention cache refresh
        // Current hint is "Refresh calendar subscriptions"
        // Expected: Should mention refreshing TaskNotes cache as well
        const tooltipText = tooltip || ariaLabel || '';

        // This will pass once the button hint is updated to mention cache
        expect(tooltipText.toLowerCase()).toContain('cache');
      }
    }
  );

  test.fixme(
    'reproduces issue #1071 - command palette refresh cache still works independently',
    async () => {
      /**
       * The existing "Refresh TaskNotes cache" command should continue to work
       * independently of the calendar refresh button.
       *
       * Expected behavior:
       * - Command palette "Refresh TaskNotes cache" works as before
       * - Shows "Refreshing TaskNotes cache..." notice
       * - Shows "TaskNotes cache refreshed successfully" on completion
       */
      const page = app.page;

      // Run the refresh cache command
      await runCommand(page, 'TaskNotes: Refresh TaskNotes cache');

      // Wait a moment for the command to execute
      await page.waitForTimeout(500);

      // Should see the loading notice
      const loadingNotice = page.locator('.notice:has-text("Refreshing TaskNotes cache")');
      const successNotice = page.locator('.notice:has-text("cache refreshed successfully")');

      // Either loading or success notice should be visible
      const hasNotice = await loadingNotice.isVisible({ timeout: 1000 }).catch(() => false) ||
                        await successNotice.isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasNotice).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #1071 - views update after refresh button click',
    async () => {
      /**
       * All views should update after clicking the refresh button, not just
       * the calendar view.
       *
       * Expected behavior:
       * - After clicking refresh, notifyDataChanged is called
       * - Stats view updates if open
       * - Agenda view updates if open
       * - All views receive fresh data from cache
       */
      const page = app.page;

      // Open both calendar and agenda views
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // Also open agenda view in another pane
      await runCommand(page, 'TaskNotes: Open agenda view');
      await page.waitForTimeout(1000);

      // Go back to calendar view
      const calendarContainer = page.locator('.fc');
      const isCalendarVisible = await calendarContainer.isVisible({ timeout: 2000 }).catch(() => false);

      if (isCalendarVisible) {
        // Find and click refresh button
        const refreshButton = page.locator(
          '.fc-toolbar button:has-text("Refresh"), .fc-refreshCalendars-button'
        );

        const isRefreshVisible = await refreshButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (isRefreshVisible) {
          await refreshButton.click();
          await page.waitForTimeout(1500);

          // Verify agenda view also received update
          // This is difficult to test directly without instrumenting the code
          // but we can verify both views are still functional

          // Check that agenda view container is still present and updated
          const agendaView = page.locator('.tasknotes-agenda-view, [data-type="agenda"]');
          const agendaExists = await agendaView.isVisible({ timeout: 1000 }).catch(() => false);

          console.log(`Agenda view exists after refresh: ${agendaExists}`);
          console.log('Expected: All open views should reflect fresh data after refresh');
        }
      }
    }
  );
});
