/**
 * Issue #1137: Schedule a task for multiple dates
 *
 * Feature request: The user wants to schedule TaskNotes for multiple dates at a time.
 * Use case: Recurring appointments that don't follow a regular recurrence pattern,
 * but the user wants a single TaskNote instead of creating a new one for each date.
 *
 * Current behavior:
 * - The `scheduled` property is a single string (YYYY-MM-DD or YYYY-MM-DD HH:mm)
 * - The ScheduledDateModal only allows selecting a single date
 * - Tasks appear on the calendar only on their single scheduled date
 *
 * Requested behavior:
 * - Allow scheduling a task for multiple arbitrary dates
 * - One TaskNote appears on multiple calendar dates
 * - User can manage (add/remove) individual scheduled dates
 * - This is distinct from recurrence which follows a pattern (RRULE)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1137
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1137: Schedule a task for multiple dates', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Multi-date scheduling UI', () => {
    test.fixme(
      'reproduces issue #1137 - scheduled date modal should support multiple dates',
      async () => {
        /**
         * The ScheduledDateModal currently only allows selecting a single date.
         * This test verifies that the modal should be enhanced to support
         * selecting multiple dates.
         *
         * Current behavior:
         * - Single date input field
         * - Save stores one date value
         *
         * Expected behavior:
         * - UI to add multiple dates (e.g., multi-select calendar or date list)
         * - Ability to remove individual dates from the list
         * - Save stores an array of dates or multiple date values
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a task card to schedule
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          // If no tasks, skip the test
          console.log('No tasks found in task list, skipping test');
          return;
        }

        // Click on scheduled date area or open scheduling modal
        const scheduledDateTrigger = taskCard.locator(
          '[data-property="scheduled"], ' +
            '.task-card__scheduled-date, ' +
            '.scheduled-date-trigger, ' +
            'button[aria-label*="schedule"]'
        );

        // Try to open the scheduled date modal
        if (await scheduledDateTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateTrigger.click();
        } else {
          // Try right-click context menu
          await taskCard.click({ button: 'right' });
          await page.waitForTimeout(200);
          const scheduleMenuItem = page.locator('text=Schedule, text=Scheduled date');
          if (await scheduleMenuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
            await scheduleMenuItem.click();
          }
        }

        await page.waitForTimeout(300);

        // Check if the modal is open
        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('Could not open scheduled date modal');
          return;
        }

        // After implementation, look for multi-date UI elements
        const multiDateContainer = page.locator(
          '[data-testid="multi-date-picker"], ' +
            '.multi-date-selector, ' +
            '.scheduled-dates-list'
        );

        const addDateButton = page.locator(
          '[data-testid="add-scheduled-date"], ' +
            'button[aria-label*="add date"], ' +
            'button:has-text("Add date")'
        );

        // These elements don't exist yet - this test will fail until implemented
        const hasMultiDateSupport =
          (await multiDateContainer.isVisible({ timeout: 1000 }).catch(() => false)) ||
          (await addDateButton.isVisible({ timeout: 1000 }).catch(() => false));

        // After implementation, multi-date support should be available
        expect(hasMultiDateSupport).toBe(true);

        // Close the modal
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1137 - should be able to add multiple scheduled dates to a task',
      async () => {
        /**
         * Test the workflow of adding multiple dates to a single task.
         *
         * Expected workflow:
         * 1. Open the scheduled date modal for a task
         * 2. Select or add first date
         * 3. Select or add second date
         * 4. Select or add third date
         * 5. Save - all three dates should be stored
         * 6. Task should appear on calendar on all three dates
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('No tasks found');
          return;
        }

        // Get the task title for later verification
        const taskTitle = await taskCard.locator('.task-card__title, .task-title').textContent();
        console.log(`Testing multi-date scheduling for task: ${taskTitle}`);

        // Open the scheduled date modal
        const scheduledDateTrigger = taskCard.locator(
          '[data-property="scheduled"], ' +
            '.task-card__scheduled-date, ' +
            'button[aria-label*="schedule"]'
        );

        if (await scheduledDateTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateTrigger.click();
          await page.waitForTimeout(300);
        }

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('Could not open modal');
          return;
        }

        // After implementation: add multiple dates
        const addDateButton = page.locator(
          '[data-testid="add-scheduled-date"], ' +
            'button:has-text("Add date"), ' +
            '.add-date-btn'
        );

        const dateInput = page.locator('input[type="date"]');

        // Add first date: 2026-01-15
        if (await dateInput.isVisible()) {
          await dateInput.fill('2026-01-15');
        }

        // After implementation, click "Add date" to add another
        if (await addDateButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await addDateButton.click();
          await page.waitForTimeout(200);

          // Add second date: 2026-01-22
          const secondDateInput = page.locator('input[type="date"]').last();
          await secondDateInput.fill('2026-01-22');

          // Add third date
          await addDateButton.click();
          await page.waitForTimeout(200);

          const thirdDateInput = page.locator('input[type="date"]').last();
          await thirdDateInput.fill('2026-01-29');
        }

        // Verify multiple dates are shown in the list
        const dateListItems = page.locator(
          '.scheduled-dates-list .date-item, ' +
            '[data-testid="scheduled-date-item"], ' +
            '.multi-date-list li'
        );

        const dateCount = await dateListItems.count();
        console.log(`Number of scheduled dates: ${dateCount}`);

        // After implementation, should have 3 dates
        expect(dateCount).toBe(3);

        // Close without saving for this test
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1137 - should be able to remove individual scheduled dates',
      async () => {
        /**
         * Users should be able to remove specific dates from the multi-date list
         * without affecting other scheduled dates.
         *
         * Expected behavior:
         * - Each date in the list has a remove/delete button
         * - Clicking remove deletes only that date
         * - Other dates remain unchanged
         * - Save persists the remaining dates
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        // Find a task that already has multiple scheduled dates (after feature implementation)
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // Open the scheduled date modal
        const scheduledDateTrigger = taskCard.locator('[data-property="scheduled"]');
        if (await scheduledDateTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateTrigger.click();
          await page.waitForTimeout(300);
        }

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // After implementation, look for remove buttons on date items
        const dateListItems = page.locator(
          '.scheduled-dates-list .date-item, ' +
            '[data-testid="scheduled-date-item"]'
        );

        const initialCount = await dateListItems.count();
        console.log(`Initial date count: ${initialCount}`);

        if (initialCount > 1) {
          // Find and click the remove button on the first date
          const firstDateRemoveBtn = dateListItems
            .first()
            .locator(
              'button[aria-label*="remove"], ' +
                'button[aria-label*="delete"], ' +
                '.remove-date-btn, ' +
                '.date-item__remove'
            );

          if (await firstDateRemoveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await firstDateRemoveBtn.click();
            await page.waitForTimeout(200);

            // Verify count decreased by 1
            const newCount = await dateListItems.count();
            expect(newCount).toBe(initialCount - 1);
          }
        }

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Multi-date calendar display', () => {
    test.fixme(
      'reproduces issue #1137 - task with multiple scheduled dates should appear on all dates in calendar',
      async () => {
        /**
         * When a task has multiple scheduled dates, it should appear as an event
         * on each of those dates in the calendar view.
         *
         * Current behavior:
         * - Task appears only on single scheduled date
         *
         * Expected behavior:
         * - Task appears on all configured scheduled dates
         * - Each appearance is clearly linked to the same task
         * - Clicking any instance opens the same TaskNote
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Navigate to January 2026 (where our test dates would be)
        const nextButton = page.locator('.fc-next-button, button[aria-label*="next"]');
        const monthTitle = page.locator('.fc-toolbar-title');

        // Navigate until we're in January 2026
        let attempts = 0;
        while (attempts < 24) {
          const title = await monthTitle.textContent();
          if (title?.includes('January') && title?.includes('2026')) {
            break;
          }
          await nextButton.click();
          await page.waitForTimeout(200);
          attempts++;
        }

        // After implementation: look for the same task appearing on multiple dates
        // The task should have events on 2026-01-15, 2026-01-22, and 2026-01-29

        // Get all scheduled events (not due or recurring)
        const scheduledEvents = page.locator(
          '.fc-event[data-event-type="scheduled"], ' +
            '.fc-event.tasknotes-scheduled-event'
        );

        const eventCount = await scheduledEvents.count();
        console.log(`Total scheduled events in view: ${eventCount}`);

        // Check for events on specific dates
        // After implementation, find events by their position in the calendar grid
        const jan15Cell = page.locator('[data-date="2026-01-15"]');
        const jan22Cell = page.locator('[data-date="2026-01-22"]');
        const jan29Cell = page.locator('[data-date="2026-01-29"]');

        if (await jan15Cell.isVisible()) {
          const eventsOn15 = jan15Cell.locator('.fc-event');
          const count15 = await eventsOn15.count();
          console.log(`Events on Jan 15: ${count15}`);
        }

        if (await jan22Cell.isVisible()) {
          const eventsOn22 = jan22Cell.locator('.fc-event');
          const count22 = await eventsOn22.count();
          console.log(`Events on Jan 22: ${count22}`);
        }

        if (await jan29Cell.isVisible()) {
          const eventsOn29 = jan29Cell.locator('.fc-event');
          const count29 = await eventsOn29.count();
          console.log(`Events on Jan 29: ${count29}`);
        }

        // After implementation, verify the same task appears on all three dates
        // This is a placeholder assertion that documents expected behavior
        expect(eventCount).toBeGreaterThanOrEqual(3);
      }
    );

    test.fixme(
      'reproduces issue #1137 - clicking calendar event for multi-date task should open the TaskNote',
      async () => {
        /**
         * When clicking on any instance of a multi-date scheduled task in the calendar,
         * it should open the underlying TaskNote file.
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Find a scheduled event
        const scheduledEvent = page.locator('.fc-event').first();
        if (!(await scheduledEvent.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('No calendar events found');
          return;
        }

        // Get the event's file path (used to verify correct file opens)
        const filePath = await scheduledEvent.getAttribute('data-file-path');
        console.log(`Event file path: ${filePath}`);

        // Click the event
        await scheduledEvent.click();
        await page.waitForTimeout(500);

        // Verify a TaskNote file is opened or details panel shows
        const detailsPanel = page.locator(
          '.tasknotes-details-panel, ' +
            '.task-details, ' +
            '[data-testid="task-details-panel"]'
        );

        const openedFile = page.locator('.workspace-leaf.mod-active .view-header-title');

        const detailsVisible = await detailsPanel.isVisible({ timeout: 2000 }).catch(() => false);
        const fileOpened = await openedFile.isVisible({ timeout: 2000 }).catch(() => false);

        // Either the details panel should show or a file should open
        expect(detailsVisible || fileOpened).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #1137 - dragging multi-date event should offer options',
      async () => {
        /**
         * When dragging a multi-date scheduled task on the calendar, the user
         * should have options for how to handle the drag:
         *
         * Options could include:
         * - Move this specific date only
         * - Move all dates by the same offset
         * - Copy to new date (add a date)
         *
         * This test documents the expected behavior for calendar drag interactions.
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Find a scheduled event
        const scheduledEvent = page.locator('.fc-event').first();
        if (!(await scheduledEvent.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // Get the event's bounding box
        const eventBox = await scheduledEvent.boundingBox();
        if (!eventBox) return;

        // Find a target date cell
        const targetCell = page.locator('.fc-daygrid-day').nth(10);
        const targetBox = await targetCell.boundingBox();
        if (!targetBox) return;

        // Perform drag and drop
        await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);

        // After implementation for multi-date tasks, a dialog/menu should appear
        // asking how to handle the drag
        const dragOptionsMenu = page.locator(
          '[data-testid="multi-date-drag-options"], ' +
            '.multi-date-drag-menu, ' +
            '.drag-options-dialog'
        );

        const hasOptions = await dragOptionsMenu.isVisible({ timeout: 1000 }).catch(() => false);

        // Release the mouse
        await page.mouse.up();

        // After implementation, drag options should be shown for multi-date tasks
        // This documents expected behavior
        console.log(`Drag options shown: ${hasOptions}`);
      }
    );
  });

  test.describe('Data model and persistence', () => {
    test.fixme(
      'reproduces issue #1137 - multiple scheduled dates should persist in frontmatter',
      async () => {
        /**
         * When a task has multiple scheduled dates, they should be properly
         * stored in the TaskNote's frontmatter.
         *
         * Possible implementations:
         * - Single property with array: `scheduled: [2026-01-15, 2026-01-22, 2026-01-29]`
         * - Multiple properties: `scheduled_dates: [...]`
         * - Keeping backward compatibility: `scheduled: 2026-01-15` for primary,
         *   `additional_scheduled: [2026-01-22, 2026-01-29]` for others
         *
         * This test documents that multi-date scheduling data must persist correctly.
         */
        const page = app.page;

        // This test would need to:
        // 1. Create or find a task
        // 2. Add multiple scheduled dates
        // 3. Read the file content to verify frontmatter structure
        // 4. Close and reopen to verify persistence

        // For now, just document the expected data model behavior
        console.log(
          'Multi-date scheduling should persist dates in frontmatter. ' +
            'Implementation decision needed on exact data structure.'
        );

        // Placeholder assertion
        expect(true).toBe(true);
      }
    );
  });

  test.describe('Distinction from recurrence', () => {
    test.fixme(
      'reproduces issue #1137 - multi-date scheduling is distinct from recurrence',
      async () => {
        /**
         * Multi-date scheduling (this feature) is distinct from recurrence:
         *
         * Recurrence (existing feature):
         * - Pattern-based: daily, weekly, monthly, etc. (RRULE)
         * - Generates infinite future instances
         * - Completion tracking per instance
         * - Dates are computed from pattern
         *
         * Multi-date scheduling (this feature request):
         * - Explicit date list
         * - Finite, user-defined dates
         * - No pattern, just specific dates
         * - Ideal for irregular schedules
         *
         * A task could potentially have both:
         * - Recurrence pattern AND additional one-off scheduled dates
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        // Look for a task that has recurrence
        const recurringTask = page.locator(
          '.task-card:has(.recurrence-indicator), ' +
            '.task-card[data-has-recurrence="true"]'
        );

        if (await recurringTask.isVisible({ timeout: 2000 }).catch(() => false)) {
          // This task has recurrence - verify that multi-date scheduling
          // would be a separate feature

          // Open the scheduled date modal
          const scheduledDateTrigger = recurringTask.locator('[data-property="scheduled"]');
          if (await scheduledDateTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
            await scheduledDateTrigger.click();
            await page.waitForTimeout(300);
          }

          const modal = page.locator('.modal, [role="dialog"]');
          if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            // After implementation, the modal should clearly distinguish between:
            // - Recurrence settings (pattern-based)
            // - Additional scheduled dates (explicit dates)

            const recurrenceSection = page.locator(
              '.recurrence-settings, ' +
                '[data-testid="recurrence-section"]'
            );

            const multiDateSection = page.locator(
              '.multi-date-settings, ' +
                '[data-testid="scheduled-dates-section"], ' +
                '.additional-dates-section'
            );

            const hasRecurrenceSection = await recurrenceSection
              .isVisible({ timeout: 1000 })
              .catch(() => false);
            const hasMultiDateSection = await multiDateSection
              .isVisible({ timeout: 1000 })
              .catch(() => false);

            console.log(
              `Recurrence section: ${hasRecurrenceSection}, Multi-date section: ${hasMultiDateSection}`
            );

            // After implementation, both sections should be available
            // for tasks that support both features
          }

          await page.keyboard.press('Escape');
        }

        // Document the expected behavior distinction
        console.log(
          'Multi-date scheduling should be separate from recurrence. ' +
            'Users should be able to use either or both features on a task.'
        );
      }
    );
  });
});
