/**
 * Issue #703: [FR] Multiple scheduled datetimes for a single task
 *
 * Feature request to allow tasks to have multiple scheduled datetimes instead of
 * just one. This is explicitly different from recurrence - recurrence uses patterns
 * (RRULE) to generate instances, while this feature allows explicit arbitrary dates.
 *
 * User's use cases:
 * 1. Tasks that span multiple days/time slots and need planning ahead
 * 2. Tasks not completed in a single session - keep previous scheduled dates
 * 3. Follow-up scheduling when tasks are blocked
 *
 * Current behavior:
 * - `scheduled` property in TaskInfo is a single string (YYYY-MM-DD or YYYY-MM-DD HH:mm)
 * - ScheduledDateModal allows selecting only one date
 * - Task appears on calendar on single scheduled date
 *
 * Requested behavior:
 * - Multiple scheduled datetimes per task (array of dates)
 * - UI to manage (add/remove) individual scheduled dates
 * - Task appears on all scheduled dates in calendar
 * - History preserved when rescheduling (don't lose previous dates)
 *
 * Related issues: #1137 (same feature with different perspective)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/703
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #703: Multiple scheduled datetimes for a single task', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Use case 1: Multi-day task planning', () => {
    test.fixme(
      'reproduces issue #703 - should allow scheduling a task across multiple days',
      async () => {
        /**
         * Use case: "Some tasks take multiple days or time slots to be completed,
         * so I would like to plan ahead."
         *
         * Example: A project task that needs 3 work sessions on different days.
         * User wants to see it on their calendar on all 3 days they plan to work on it.
         *
         * Expected behavior:
         * 1. User opens scheduling modal for a task
         * 2. User can add multiple dates (e.g., Monday, Wednesday, Friday)
         * 3. Task appears on all three days in calendar view
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a task to schedule across multiple days
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('No tasks found, skipping test');
          return;
        }

        // Open scheduling modal
        const scheduledDateTrigger = taskCard.locator(
          '[data-property="scheduled"], ' +
            '.task-card__scheduled-date, ' +
            'button[aria-label*="schedule"]'
        );

        if (await scheduledDateTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateTrigger.click();
        } else {
          // Try context menu
          await taskCard.click({ button: 'right' });
          await page.waitForTimeout(200);
          const scheduleMenuItem = page.locator('text=Schedule, text=Scheduled date');
          if (await scheduleMenuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
            await scheduleMenuItem.click();
          }
        }

        await page.waitForTimeout(300);

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('Could not open scheduled date modal');
          return;
        }

        // After implementation: Add three scheduled dates (Mon, Wed, Fri of a week)
        const addDateButton = page.locator(
          '[data-testid="add-scheduled-date"], ' +
            'button:has-text("Add date"), ' +
            '.add-date-btn'
        );

        // Should be able to add multiple dates for planning across the week
        const hasMultiDateSupport = await addDateButton
          .isVisible({ timeout: 1000 })
          .catch(() => false);

        // After implementation, multi-date support should be available
        expect(hasMultiDateSupport).toBe(true);

        // Close modal
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #703 - multi-day scheduled task should appear on all days in calendar',
      async () => {
        /**
         * After scheduling a task for multiple days, it should appear
         * on each of those days in the calendar view, allowing the user
         * to see their planned work sessions at a glance.
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // After implementation: A task with multiple scheduled dates
        // should generate calendar events on each date
        // This test documents expected behavior for multi-day planning

        // Example: task scheduled for 2026-01-13 (Mon), 2026-01-15 (Wed), 2026-01-17 (Fri)
        const jan13Cell = page.locator('[data-date="2026-01-13"]');
        const jan15Cell = page.locator('[data-date="2026-01-15"]');
        const jan17Cell = page.locator('[data-date="2026-01-17"]');

        // After implementation, the same task should appear on all three dates
        // This allows the user to plan their work week with multi-session tasks

        console.log(
          'Multi-day scheduled task should appear on all scheduled dates. ' +
            'This enables planning work across multiple days for large tasks.'
        );
      }
    );
  });

  test.describe('Use case 2: Preserve scheduling history', () => {
    test.fixme(
      'reproduces issue #703 - rescheduling should preserve previous scheduled date',
      async () => {
        /**
         * Use case: "Some tasks aren't completed in a single session, but I still
         * want to keep the previous scheduled date."
         *
         * Example: Task was scheduled for Monday but not completed. User reschedules
         * to Wednesday. Instead of replacing the date, both dates should be preserved
         * so the user can see when they originally planned to work on it.
         *
         * Expected behavior:
         * 1. Task has scheduled date (e.g., 2026-01-13)
         * 2. User reschedules to new date (e.g., 2026-01-15)
         * 3. Both dates are preserved in the task's scheduled dates
         * 4. History of scheduling attempts is visible
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        // Find a task that's already scheduled
        const scheduledTask = page.locator(
          '.tasknotes-task-card:has([data-property="scheduled"]), ' +
            '.task-card:has(.scheduled-date)'
        );

        if (!(await scheduledTask.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('No scheduled tasks found');
          return;
        }

        // Get current scheduled date
        const currentDateEl = scheduledTask.locator(
          '[data-property="scheduled"], .scheduled-date'
        );
        const originalDate = await currentDateEl.textContent();
        console.log(`Original scheduled date: ${originalDate}`);

        // Open scheduling modal
        await currentDateEl.click();
        await page.waitForTimeout(300);

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // After implementation: Adding a new date should NOT replace the existing date
        // Instead, both dates should be preserved

        // Look for option to "Add another date" vs "Replace date"
        const addAnotherDateOption = page.locator(
          '[data-testid="add-another-date"], ' +
            'button:has-text("Add another date"), ' +
            '.add-date-option'
        );

        // After implementation, there should be a way to add additional dates
        // while preserving the original scheduled date(s)

        console.log(
          'Rescheduling workflow should offer option to keep previous date. ' +
            'This preserves history of when the task was originally planned.'
        );

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #703 - should display scheduling history on task card',
      async () => {
        /**
         * When a task has multiple scheduled dates (including historical ones),
         * the task card should display this information meaningfully.
         *
         * Possible displays:
         * - Show all dates: "Jan 13, Jan 15, Jan 17"
         * - Show count: "Jan 17 (+2 more)"
         * - Visual indicator for rescheduled tasks
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        // After implementation: Find a task with multiple scheduled dates
        const multiDateTask = page.locator(
          '.task-card:has([data-scheduled-count]), ' +
            '.task-card:has(.multi-scheduled-indicator)'
        );

        if (await multiDateTask.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Verify the display shows multiple dates or a count
          const scheduledDisplay = multiDateTask.locator(
            '[data-property="scheduled"], .scheduled-dates-display'
          );
          const displayText = await scheduledDisplay.textContent();
          console.log(`Multi-date scheduled display: ${displayText}`);

          // After implementation, should show indication of multiple dates
        }

        console.log(
          'Task card should display multiple scheduled dates in a meaningful way. ' +
            'Options: comma-separated list, first date with count, or expandable.'
        );
      }
    );
  });

  test.describe('Use case 3: Follow-up scheduling for blocked tasks', () => {
    test.fixme(
      'reproduces issue #703 - should allow scheduling follow-up dates for blocked tasks',
      async () => {
        /**
         * Use case: "Sometimes I want to do a follow-up of a task some days after
         * working on it, for example, if the task is blocked."
         *
         * Example: Task is blocked waiting on external input. User schedules
         * follow-up for 3 days later to check status, while keeping the original
         * scheduled date visible.
         *
         * Expected behavior:
         * 1. Task has initial scheduled date
         * 2. Task becomes blocked (waiting on something)
         * 3. User adds a follow-up scheduled date without removing original
         * 4. Both dates show in calendar - original and follow-up
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // Open scheduling modal
        const scheduledTrigger = taskCard.locator('[data-property="scheduled"]');
        if (await scheduledTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledTrigger.click();
          await page.waitForTimeout(300);
        }

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // After implementation: Quick action to add a follow-up date
        // e.g., "Follow up in 3 days" button that adds date without removing existing
        const followUpOptions = page.locator(
          '[data-testid="follow-up-options"], ' +
            '.follow-up-actions, ' +
            'button:has-text("Follow up")'
        );

        // Or the ability to simply add another date to the list
        const scheduledDatesList = page.locator(
          '.scheduled-dates-list, ' +
            '[data-testid="scheduled-dates-container"]'
        );

        console.log(
          'Follow-up scheduling should add dates without removing existing ones. ' +
            'Useful for blocked tasks that need periodic check-ins.'
        );

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Distinction from recurrence', () => {
    test.fixme(
      'reproduces issue #703 - multi-date scheduling is conceptually different from recurrence',
      async () => {
        /**
         * User's clarification: "A recurrent task is a single task template that
         * automatically generates a new instance of itself at a regular, predefined
         * interval. A task with multiple scheduled datetimes is a single, one-off
         * task that simply has more than one date associated with it. These dates
         * are typically not based on a repeating pattern."
         *
         * Key differences:
         * - Recurrence: Pattern-based (RRULE), infinite instances, completion tracking per instance
         * - Multi-date scheduling: Explicit dates, finite list, single task with multiple calendar appearances
         *
         * A task COULD have both:
         * - A recurrence pattern (weekly on Mondays)
         * - AND additional explicit scheduled dates (also this Friday as a one-off)
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        // Find a task to test
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // Open context menu or scheduling modal
        await taskCard.click({ button: 'right' });
        await page.waitForTimeout(200);

        // After implementation: Recurrence and multi-date scheduling should be
        // separate options/features

        const recurrenceOption = page.locator(
          'text=Recurrence, text=Repeat, text=Set recurrence'
        );
        const scheduledDatesOption = page.locator(
          'text=Scheduled dates, text=Schedule for multiple dates'
        );

        // These should be distinct menu items or UI sections
        console.log(
          'Recurrence and multi-date scheduling are separate features:\n' +
            '- Recurrence: Pattern-based (every Monday)\n' +
            '- Multi-date: Explicit dates (Jan 13, Jan 15, Jan 22)\n' +
            'A task could potentially use both features.'
        );

        // Close context menu
        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('UI considerations mentioned in issue', () => {
    test.fixme(
      'reproduces issue #703 - task list display should handle multiple scheduled dates',
      async () => {
        /**
         * Issue mentions: "Modifying the UI can be a bit complicated in some cases.
         * For example, when displaying the tasks list or when right-clicking on a task."
         *
         * Task list considerations:
         * - How to display multiple dates in the compact task card?
         * - Options: first date + count, comma-separated, tooltip with all dates
         * - Sorting/grouping by scheduled date when task has multiple dates
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        // After implementation: Task cards should handle multiple dates gracefully
        const taskCards = page.locator('.tasknotes-task-card, .task-card');
        const cardCount = await taskCards.count();

        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = taskCards.nth(i);
          const scheduledEl = card.locator('[data-property="scheduled"]');

          if (await scheduledEl.isVisible({ timeout: 500 }).catch(() => false)) {
            const displayText = await scheduledEl.textContent();
            console.log(`Task ${i + 1} scheduled display: ${displayText}`);
          }
        }

        console.log(
          'Task list UI should handle multiple scheduled dates:\n' +
            '- Compact display in task card\n' +
            '- Expandable or tooltip for full list\n' +
            '- Handle grouping by date when task appears in multiple groups'
        );
      }
    );

    test.fixme(
      'reproduces issue #703 - context menu should handle multi-date task actions',
      async () => {
        /**
         * Issue mentions: "when right-clicking on a task" UI can be complicated.
         *
         * Context menu considerations:
         * - "Clear scheduled date" becomes "Manage scheduled dates"
         * - Option to clear all dates vs. individual dates
         * - Quick reschedule options should add dates, not replace
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // Open context menu
        await taskCard.click({ button: 'right' });
        await page.waitForTimeout(300);

        // After implementation: Context menu should have multi-date aware options
        const contextMenu = page.locator('.menu, [role="menu"]');
        if (await contextMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Look for multi-date options
          const manageScheduledDates = page.locator(
            'text=Manage scheduled dates, text=Edit scheduled dates'
          );
          const addScheduledDate = page.locator('text=Add scheduled date');
          const clearAllScheduledDates = page.locator('text=Clear all scheduled dates');

          console.log(
            'Context menu should have multi-date options:\n' +
              '- Add scheduled date\n' +
              '- Manage scheduled dates\n' +
              '- Clear all scheduled dates\n' +
              '- Or a submenu with these options'
          );
        }

        // Close context menu
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #703 - calendar view should be compatible with multi-date tasks',
      async () => {
        /**
         * Issue mentions: "For other views, like the calendar, it should be fine."
         *
         * Calendar considerations:
         * - Task appears as event on each scheduled date
         * - Events clearly indicate they're part of a multi-date task
         * - Clicking any event opens the same underlying TaskNote
         * - Drag behavior needs clarification (move one date? all dates?)
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // After implementation: Multi-date tasks create multiple calendar events
        // Each event should be visually linked to show it's the same task

        // Look for events that might be part of a multi-date task
        const scheduledEvents = page.locator(
          '.fc-event[data-event-type="scheduled"], ' +
            '.fc-event.tasknotes-scheduled-event'
        );

        const eventCount = await scheduledEvents.count();
        console.log(`Total scheduled events in calendar: ${eventCount}`);

        console.log(
          'Calendar view should:\n' +
            '- Show task on all scheduled dates\n' +
            '- Visually indicate multi-date tasks (badge, icon, or styling)\n' +
            '- Open the same TaskNote from any event instance\n' +
            '- Handle drag-and-drop semantically (which date to move?)'
        );
      }
    );
  });
});
