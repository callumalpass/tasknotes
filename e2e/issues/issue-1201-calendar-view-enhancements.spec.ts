/**
 * Issue #1201: [FR] Calendar View Enhancements
 *
 * Feature request with two distinct parts:
 *
 * 1. Toggle to hide hourly breakdown in weekly view
 *    - Currently there's a toggle for showAllDaySlot (to hide the all-day section)
 *    - User wants the inverse: keep all-day slot but hide the hourly time grid
 *    - Use case: Day-based scheduling without specific time slots
 *
 * 2. Display task properties in calendar views (overlaps with #1210)
 *    - Currently calendar events only show task title
 *    - User wants to see properties like Project for visual distinction
 *    - Possibly also group tasks by property in calendar view
 *
 * The first part (hourly breakdown toggle) is unique to this issue.
 * The second part overlaps with issue #1210 and is tested there.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1201
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1201: Calendar View Enhancements', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Part 1: Toggle hourly breakdown in weekly view', () => {
    test.fixme(
      'reproduces issue #1201 - weekly view should have option to hide hourly time grid',
      async () => {
        /**
         * This test verifies the feature request: ability to hide the hourly
         * breakdown (time grid slots) in the weekly calendar view while keeping
         * the all-day slot visible.
         *
         * Current behavior:
         * - Weekly view (timeGridWeek) shows both all-day slot and hourly breakdown
         * - There's a toggle to hide the all-day slot (showAllDaySlot)
         * - No option to hide just the hourly breakdown
         *
         * Requested behavior:
         * - Add a toggle to hide the hourly time grid
         * - When enabled, only show the all-day slot row
         * - Useful for day-based task planning without time-specific scheduling
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to weekly view
        const weekButton = page.locator(
          '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
        );
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Verify we're in the weekly time grid view
        const timeGridView = page.locator('.fc-timeGridWeek-view, .fc-timegrid');
        await expect(timeGridView).toBeVisible({ timeout: 5000 });

        // Check for the all-day slot (header area)
        const allDaySlot = page.locator('.fc-daygrid-body, .fc-col-header, .fc-timegrid-axis');
        const hasAllDaySlot = await allDaySlot.first().isVisible({ timeout: 2000 }).catch(() => false);

        // Check for the hourly time grid (slot lanes)
        const timeSlots = page.locator('.fc-timegrid-slots, .fc-timegrid-slot');
        const hasTimeSlots = await timeSlots.first().isVisible({ timeout: 2000 }).catch(() => false);

        // Currently both should be visible
        expect(hasAllDaySlot).toBe(true);
        expect(hasTimeSlots).toBe(true);

        // Feature request: There should be a way to hide the time slots
        // while keeping the all-day slot visible

        // Look for a toggle in the calendar header/toolbar
        const hideTimeSlotsToggle = page.locator(
          'button[aria-label*="time"], button[aria-label*="hourly"], ' +
            '.fc-toolbar button:has-text("All Day"), .fc-toolbar button:has-text("Hide Hours"), ' +
            '[data-testid="hide-hourly-toggle"], .calendar-toggle-hourly'
        );

        const hasToggle = await hideTimeSlotsToggle.isVisible({ timeout: 2000 }).catch(() => false);

        // After implementation, there should be a toggle to hide hourly breakdown
        expect(hasToggle).toBe(true);

        // If toggle exists, clicking it should hide the time slots
        if (hasToggle) {
          await hideTimeSlotsToggle.click();
          await page.waitForTimeout(500);

          // Time slots should now be hidden
          const timeSlotsAfterToggle = page.locator('.fc-timegrid-slots');
          const timeSlotsVisible = await timeSlotsAfterToggle
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          expect(timeSlotsVisible).toBe(false);

          // All-day slot should still be visible
          const allDayStillVisible = await allDaySlot.first().isVisible({ timeout: 1000 }).catch(() => false);
          expect(allDayStillVisible).toBe(true);
        }
      }
    );

    test.fixme(
      'reproduces issue #1201 - settings should include option to hide hourly breakdown',
      async () => {
        /**
         * The feature should be configurable via settings, similar to how
         * showAllDaySlot is handled (though that's not currently in the UI either).
         *
         * This would add a new setting like:
         * - "Show hourly time grid" (default: true)
         * - When disabled, weekly/daily views show only all-day section
         */
        const page = app.page;

        // Open TaskNotes settings
        await runCommand(page, 'Open settings');
        await page.waitForTimeout(500);

        const settingsContainer = page.locator('.modal-container');
        await expect(settingsContainer).toBeVisible({ timeout: 5000 });

        // Navigate to TaskNotes settings
        const taskNotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
        if (await taskNotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await taskNotesTab.click();
          await page.waitForTimeout(500);
        }

        // Look for appearance/calendar settings section
        const calendarSettingsHeader = page.locator(
          '.setting-item:has-text("Calendar"), ' + 'h3:has-text("Calendar"), h4:has-text("Calendar")'
        );

        if (await calendarSettingsHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Look for the hourly breakdown toggle setting
          const hourlyToggleSetting = page.locator(
            '.setting-item:has-text("hourly"), ' +
              '.setting-item:has-text("time grid"), ' +
              '.setting-item:has-text("time slots"), ' +
              '.setting-item:has-text("Show time slots")'
          );

          // After implementation, this setting should exist
          const hasHourlySetting = await hourlyToggleSetting
            .isVisible({ timeout: 2000 })
            .catch(() => false);

          expect(hasHourlySetting).toBe(true);
        }

        // Close settings
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1201 - all-day only mode should work with task scheduling',
      async () => {
        /**
         * When hourly time grid is hidden, users should still be able to:
         * - Schedule tasks for a specific day (in the all-day slot)
         * - Drag and drop tasks between days
         * - Create new tasks by clicking on a day
         *
         * This ensures the "all-day only" mode is fully functional for
         * day-based task planning workflows.
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to weekly view
        const weekButton = page.locator(
          '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
        );
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Attempt to enable "all-day only" mode (hide hourly breakdown)
        // This toggle should exist after the feature is implemented
        const hideTimeSlotsToggle = page.locator(
          'button[aria-label*="time"], [data-testid="hide-hourly-toggle"], ' +
            '.calendar-toggle-hourly'
        );

        if (await hideTimeSlotsToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          await hideTimeSlotsToggle.click();
          await page.waitForTimeout(500);
        }

        // In all-day only mode, verify interactions still work

        // 1. Check that all-day slot accepts clicks for task creation
        const allDayRow = page.locator('.fc-daygrid-day, .fc-day');
        const firstDay = allDayRow.first();

        if (await firstDay.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Click should open task creation or show some feedback
          await firstDay.click();
          await page.waitForTimeout(300);

          // Look for task creation modal or input
          const taskCreation = page.locator(
            '.task-creation-modal, .quick-add, [data-testid="new-task-input"]'
          );
          const creationAvailable = await taskCreation.isVisible({ timeout: 1000 }).catch(() => false);

          // Task creation should be available in all-day only mode
          // (This might fail if the feature isn't implemented to support this)
          console.log(`Task creation available in all-day mode: ${creationAvailable}`);
        }

        // 2. Check that existing tasks in all-day slot are draggable
        const allDayEvents = page.locator('.fc-daygrid-event, .fc-event');
        const eventCount = await allDayEvents.count();

        if (eventCount > 0) {
          const firstEvent = allDayEvents.first();
          const isDraggable = await firstEvent.evaluate((el) => {
            return el.classList.contains('fc-event-draggable') || el.getAttribute('draggable') === 'true';
          });

          // Events should remain draggable in all-day only mode
          console.log(`Events draggable in all-day mode: ${isDraggable}`);
        }
      }
    );
  });

  test.describe('Part 2: Property display in calendar views', () => {
    /**
     * Note: Property display tests are primarily covered in issue-1210-calendar-view-properties.spec.ts
     * This section adds tests specific to the #1201 context (project distinction, grouping).
     */

    test.fixme(
      'reproduces issue #1201 - tasks from different projects should be visually distinct',
      async () => {
        /**
         * The user's specific use case mentions confusion when tasks from
         * multiple projects appear in the calendar without visual distinction.
         *
         * Possible solutions:
         * 1. Display project name/tag on each calendar event
         * 2. Color-code events by project
         * 3. Add project icon or indicator
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Find calendar events
        const calendarEvents = page.locator('.fc-event');
        const eventCount = await calendarEvents.count();

        if (eventCount >= 2) {
          // Check if events have any project-related visual distinction
          const firstEvent = calendarEvents.first();
          const secondEvent = calendarEvents.nth(1);

          // Look for project indicators on events
          const projectIndicator = firstEvent.locator(
            '.project-indicator, .event-project, [data-project], ' +
              '.property-projects, .task-project-badge'
          );

          const hasProjectIndicator = await projectIndicator
            .isVisible({ timeout: 1000 })
            .catch(() => false);

          // After implementation, events should show project information
          expect(hasProjectIndicator).toBe(true);

          // Check if different projects have different colors
          const firstEventColor = await firstEvent.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          const secondEventColor = await secondEvent.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // If events are from different projects, they might have different colors
          // (This is one possible implementation approach)
          console.log(`Event colors - First: ${firstEventColor}, Second: ${secondEventColor}`);
        }
      }
    );

    test.fixme(
      'reproduces issue #1201 - calendar view should support grouping by property',
      async () => {
        /**
         * The user suggests being able to "group them by a property such as project"
         * similar to how grouping works in other view types (task list, kanban).
         *
         * This could mean:
         * 1. Visual grouping within each day cell
         * 2. Separate calendar rows/lanes per project
         * 3. Filter/toggle to show only one project at a time
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Look for grouping controls in the calendar toolbar
        const groupByControl = page.locator(
          '.fc-toolbar [data-testid="group-by"], ' +
            '.calendar-group-by, ' +
            'button:has-text("Group"), ' +
            '.fc-toolbar select:has-text("Group")'
        );

        const hasGroupByControl = await groupByControl.isVisible({ timeout: 2000 }).catch(() => false);

        // After implementation, there should be a way to group events
        expect(hasGroupByControl).toBe(true);

        if (hasGroupByControl) {
          // Try to group by project
          await groupByControl.click();
          await page.waitForTimeout(300);

          const projectOption = page.locator(
            'option:has-text("Project"), ' +
              'li:has-text("Project"), ' +
              '[data-value="projects"], ' +
              'button:has-text("Project")'
          );

          if (await projectOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await projectOption.click();
            await page.waitForTimeout(500);

            // After grouping, events should be organized by project
            // This could manifest as:
            // - Separate swim lanes for each project
            // - Visual grouping within day cells
            // - Color-coded sections

            const projectGroups = page.locator(
              '.project-group, .calendar-group, [data-group-type="project"]'
            );

            const groupCount = await projectGroups.count();
            console.log(`Project groups found: ${groupCount}`);

            // Should have at least one group if there are tasks with projects
            expect(groupCount).toBeGreaterThan(0);
          }
        }
      }
    );
  });
});
