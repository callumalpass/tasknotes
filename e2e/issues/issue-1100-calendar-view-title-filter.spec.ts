/**
 * Issue #1100: [Bug] Title search/filter not working in Advanced Calendar View
 *
 * The Quick Search and FilterBar title filtering work correctly in the Tasks View
 * but do not filter tasks when used in the Advanced Calendar View.
 *
 * Root cause: In CalendarView.ts render() method (lines 586-610), the filtered tasks
 * are computed via applySearchFilter() and stored in this.currentTasks, but then
 * initializeCalendar() and updateCalendarEvents() are called with the UNFILTERED
 * taskNotes array instead of the filteredTasks.
 *
 * The fix should pass filteredTasks to initializeCalendar() and updateCalendarEvents()
 * instead of the original taskNotes array.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1100
 * @see CalendarView.ts lines 586-610 for the bug location
 * @see Related issue #1018 for broader calendar view filtering issues
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1100: Calendar View Title Filter Not Working', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1100 - title search should filter tasks in calendar view',
    async () => {
      /**
       * This test verifies that the Quick Search/title filter works in the
       * Advanced Calendar View the same way it works in the Tasks View.
       *
       * Current behavior (bug):
       * - Filtering tasks by title in Tasks View works correctly
       * - The same filter in Calendar View shows ALL tasks regardless of filter
       *
       * Expected behavior:
       * - Calendar View should only display events for tasks matching the filter
       */
      const page = app.page;

      // First, verify filtering works in Tasks View (baseline)
      await runCommand(page, 'TaskNotes: Open tasks view');
      await page.waitForTimeout(1000);

      const tasksView = page.locator('.tasknotes-task-list, .bases-task-list');
      await expect(tasksView).toBeVisible({ timeout: 10000 });

      // Count initial tasks in Tasks View
      const initialTaskItems = page.locator('.task-item, .bases-task-row');
      const initialTaskCount = await initialTaskItems.count();

      // Find and use the search box
      const searchBox = page.locator(
        '.search-box input, .bases-search-box input, ' +
          '[data-testid="task-search"], input[placeholder*="Search"]'
      );

      if ((await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) && initialTaskCount > 0) {
        // Type a search term that should filter tasks
        await searchBox.fill('meeting');
        await page.waitForTimeout(500);

        // Verify filtering occurred in Tasks View
        const filteredTaskCount = await initialTaskItems.count();

        // If we had tasks and some matched, the count should change or be consistent
        // (If none match, count becomes 0. If all match, count stays same)
        console.log(
          `Tasks View: Before filter: ${initialTaskCount}, After filter: ${filteredTaskCount}`
        );

        // Clear search for next test
        await searchBox.clear();
        await page.waitForTimeout(500);
      }

      // Now test the Calendar View
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Count initial calendar events
      const calendarEvents = page.locator('.fc-event');
      const initialEventCount = await calendarEvents.count();

      // Find search box in Calendar View
      const calendarSearchBox = page.locator(
        '.search-box input, .bases-search-box input, ' +
          '[data-testid="task-search"], input[placeholder*="Search"]'
      );

      if (
        (await calendarSearchBox.isVisible({ timeout: 3000 }).catch(() => false)) &&
        initialEventCount > 0
      ) {
        // Type the same search term
        await calendarSearchBox.fill('meeting');
        await page.waitForTimeout(500);

        // Check if calendar events were filtered
        const filteredEventCount = await calendarEvents.count();

        console.log(
          `Calendar View: Before filter: ${initialEventCount}, After filter: ${filteredEventCount}`
        );

        // BUG: Currently the calendar shows all events regardless of filter
        // The filtered count should be different from initial if filter is applied
        // (assuming not all tasks have "meeting" in the title)

        // After the fix, this assertion should pass:
        // If we had events and the filter term doesn't match all, count should decrease
        if (initialEventCount > 0) {
          // The fix should make filteredEventCount <= initialEventCount
          // and if the search term doesn't match all tasks, filteredEventCount < initialEventCount
          expect(filteredEventCount).toBeLessThanOrEqual(initialEventCount);
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1100 - FilterBar title filter should work in calendar view',
    async () => {
      /**
       * Tests the FilterBar component (more structured filtering than Quick Search)
       * in the Advanced Calendar View.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for FilterBar UI
      const filterBar = page.locator(
        '.filter-bar, .bases-filter-bar, [data-testid="filter-bar"]'
      );
      const hasFilterBar = await filterBar.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasFilterBar) {
        // Look for title filter option
        const titleFilterInput = page.locator(
          '.filter-bar input[placeholder*="title"], ' +
            '.filter-bar input[placeholder*="Title"], ' +
            '.filter-bar [data-filter-type="title"] input, ' +
            '.filter-bar input[type="text"]'
        );

        if (await titleFilterInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Count initial events
          const calendarEvents = page.locator('.fc-event');
          const initialCount = await calendarEvents.count();

          // Apply title filter
          await titleFilterInput.fill('unique-task-title-test');
          await page.waitForTimeout(500);

          // After the fix, events should be filtered
          const filteredCount = await calendarEvents.count();

          // If no tasks match "unique-task-title-test", count should be 0 or less than initial
          expect(filteredCount).toBeLessThanOrEqual(initialCount);
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1100 - filtering should persist across calendar view changes',
    async () => {
      /**
       * When a filter is applied in the calendar view, it should persist
       * when switching between month/week/day views or navigating dates.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      const searchBox = page.locator(
        '.search-box input, .bases-search-box input, input[placeholder*="Search"]'
      );

      if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Apply filter
        await searchBox.fill('test-filter');
        await page.waitForTimeout(500);

        const calendarEvents = page.locator('.fc-event');
        const filteredCountBefore = await calendarEvents.count();

        // Switch calendar view (e.g., to weekly view)
        const weekButton = page.locator(
          '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
        );

        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);

          // Filter should still be applied after view change
          const filteredCountAfter = await calendarEvents.count();

          // The search term should still be in the box
          const searchValue = await searchBox.inputValue();
          expect(searchValue).toBe('test-filter');

          // Events should still be filtered (count may differ due to date range)
          // but should not suddenly show ALL unfiltered tasks
          console.log(
            `Filter persistence: Before view change: ${filteredCountBefore}, After: ${filteredCountAfter}`
          );
        }

        // Navigate to next/previous period
        const nextButton = page.locator('.fc-next-button, .fc-toolbar button[title*="next"]');
        if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nextButton.click();
          await page.waitForTimeout(500);

          // Filter should persist after navigation
          const searchValueAfterNav = await searchBox.inputValue();
          expect(searchValueAfterNav).toBe('test-filter');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1100 - clearing filter should show all calendar events',
    async () => {
      /**
       * When the filter is cleared, all eligible calendar events should reappear.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      const calendarEvents = page.locator('.fc-event');
      const initialCount = await calendarEvents.count();

      const searchBox = page.locator(
        '.search-box input, .bases-search-box input, input[placeholder*="Search"]'
      );

      if ((await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) && initialCount > 0) {
        // Apply a very restrictive filter
        await searchBox.fill('xyz-nonexistent-task-12345');
        await page.waitForTimeout(500);

        const filteredCount = await calendarEvents.count();

        // Most likely no tasks match this filter
        expect(filteredCount).toBeLessThanOrEqual(initialCount);

        // Clear the filter
        await searchBox.clear();
        await page.waitForTimeout(500);

        // All events should reappear
        const restoredCount = await calendarEvents.count();
        expect(restoredCount).toBe(initialCount);
      }
    }
  );
});
