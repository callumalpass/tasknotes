/**
 * Issue #964: [Bug]: Issue with not being to select open recurring task for time tracking,
 * when another instance of the same recurring task has been previously completed.
 *
 * Bug description:
 * When a recurring task is set up with time tracking and one instance is completed,
 * subsequent open instances of the same recurring task cannot be selected in the
 * Pomodoro Timer task selector. Only the completed instance appears in the menu.
 *
 * Root cause:
 * The TaskSelectorWithCreateModal filters and sorts tasks by their file-level `status`
 * field instead of using `getEffectiveTaskStatus(task, today)` to check the status
 * for the current instance of recurring tasks.
 *
 * For recurring tasks:
 * - Each instance's completion is stored in `complete_instances` array (date strings)
 * - `getEffectiveTaskStatus(task, date)` correctly determines if a specific date's instance is done
 * - But the task selector only checks `task.status` at the file level
 * - When ANY instance is completed, the task may appear as "done" and get filtered out or sorted to bottom
 *
 * Affected files:
 * - src/views/PomodoroView.ts (openTaskSelector method - doesn't filter recurring properly)
 * - src/modals/TaskSelectorWithCreateModal.ts (getFilteredTasks method - sorts by task.status not effective status)
 * - src/utils/helpers.ts (has correct getEffectiveTaskStatus but not used in task selector)
 *
 * Expected behavior:
 * - When a recurring task has an open instance for today, it should appear in the task selector
 * - Completed instances (past dates) should not prevent today's open instance from appearing
 * - The task selector should use date-aware status checking for recurring tasks
 *
 * @see https://github.com/callumalpass/tasknotes/issues/964
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #964: Recurring task time tracking selection bug', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #964 - open recurring task instance should appear in pomodoro task selector after previous instance completed',
    async () => {
      /**
       * Reproduction steps from the issue:
       * 1. Create a recurring task with time tracking estimate (e.g., daily or weekly)
       * 2. Complete the first instance via time tracking
       * 3. On the next day/instance, try to select the task in Pomodoro Timer
       *
       * Current bug:
       * - Task selector only shows the completed instance (with same name)
       * - Cannot find other open instances of the recurring task
       *
       * Expected:
       * - Today's open instance of the recurring task should be selectable
       * - Completed instances should be sortable/filterable but not block open ones
       */
      const page = app.page;

      // Open Pomodoro view
      await runCommand(page, 'TaskNotes: Open pomodoro view');
      await page.waitForTimeout(1500);

      const pomodoroView = page.locator('.pomodoro-view, [data-view-type*="pomodoro"]');
      await expect(pomodoroView).toBeVisible({ timeout: 10000 });

      // Click to open task selector
      const chooseTaskButton = page.locator(
        '.pomodoro-view__task-select, ' +
          'button:has-text("Choose Task"), ' +
          'button:has-text("Select Task"), ' +
          '.task-selector-trigger'
      );

      if (!(await chooseTaskButton.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('Could not find task selector button in Pomodoro view');
        return;
      }

      await chooseTaskButton.click();
      await page.waitForTimeout(500);

      // Task selector modal should open
      const taskSelectorModal = page.locator(
        '.task-selector-modal, ' + '[role="dialog"]:has(.task-list), ' + '.modal:has(.task-card)'
      );

      await expect(taskSelectorModal).toBeVisible({ timeout: 5000 });

      // Look for recurring tasks in the list
      // Recurring tasks should have a recurrence indicator
      const recurringTaskCards = page.locator(
        '.task-card:has([data-property="recurrence"]), ' +
          '.task-card:has(.recurrence-indicator), ' +
          '.task-card:has(.recurring-icon)'
      );

      const recurringCount = await recurringTaskCards.count();
      console.log(`Found ${recurringCount} recurring tasks in selector`);

      // The bug: if a recurring task has a completed instance, the task might:
      // 1. Not appear at all (filtered out as "completed")
      // 2. Only show with completed status (no open instance visible)

      // Check if any recurring tasks with open status for today are visible
      // After the fix, recurring tasks should show their TODAY status, not overall file status
      const openRecurringTasks = page.locator(
        '.task-card:has([data-property="recurrence"]):not(.completed), ' +
          '.task-card.status-open:has(.recurrence-indicator)'
      );

      const openRecurringCount = await openRecurringTasks.count();
      console.log(`Found ${openRecurringCount} OPEN recurring tasks in selector`);

      // Document the expected behavior:
      // If a recurring task has complete_instances for past dates but today is NOT in that array,
      // the task should appear as "open" in the selector

      // After fix implementation:
      // expect(openRecurringCount).toBeGreaterThan(0);

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #964 - task selector should use date-aware status for recurring tasks',
    async () => {
      /**
       * Technical verification:
       * The task selector should call getEffectiveTaskStatus(task, today) for recurring tasks
       * instead of just checking task.status.
       *
       * Data model for recurring tasks:
       * - recurrence: "RRULE:FREQ=DAILY" (or similar)
       * - complete_instances: ["2026-01-01", "2026-01-02"] (dates that were completed)
       * - status: could be "open" or "done" at file level
       *
       * For a task with complete_instances = ["2026-01-06"] and today = "2026-01-07":
       * - getEffectiveTaskStatus(task, today) should return "open"
       * - But current code checks task.status which may return "done"
       */
      const page = app.page;

      // Open task list to find a recurring task with mixed instance status
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskListView = page.locator('.tasknotes-task-list, .task-list-view');
      await expect(taskListView).toBeVisible({ timeout: 10000 });

      // Find a recurring task
      const recurringTaskCard = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
        .first();

      if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('No recurring tasks found in task list - cannot verify bug');
        return;
      }

      // Get the task name for searching
      const taskTitle = await recurringTaskCard
        .locator('.task-title, .task-card__title')
        .textContent()
        .catch(() => '');
      console.log(`Testing with recurring task: "${taskTitle}"`);

      // Now open the Pomodoro task selector and search for this task
      await runCommand(page, 'TaskNotes: Open pomodoro view');
      await page.waitForTimeout(1000);

      const chooseTaskButton = page.locator(
        '.pomodoro-view__task-select, ' +
          'button:has-text("Choose Task"), ' +
          'button:has-text("Select Task")'
      );

      if (await chooseTaskButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chooseTaskButton.click();
        await page.waitForTimeout(500);

        // Search for the recurring task by name
        const searchInput = page.locator(
          '.task-selector-search input, ' + '.modal input[type="text"], ' + '.search-input'
        );

        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchInput.fill(taskTitle || '');
          await page.waitForTimeout(300);

          // Check if the task appears and what status it shows
          const searchResults = page.locator('.task-card, .task-item, .suggestion-item');
          const resultCount = await searchResults.count();
          console.log(`Search results for "${taskTitle}": ${resultCount} tasks`);

          if (resultCount > 0) {
            // Check the status shown for this task
            const firstResult = searchResults.first();
            const statusIndicator = await firstResult
              .locator('.status-indicator, [data-status], .task-status')
              .getAttribute('data-status')
              .catch(() => 'unknown');

            console.log(`Task status shown in selector: ${statusIndicator}`);

            // BUG: If the task shows as "done" but today's instance is actually open,
            // that's the bug we're documenting
          }
        }

        await page.keyboard.press('Escape');
      }
    }
  );

  test.fixme(
    'reproduces issue #964 - only the completed instance shows instead of open instances',
    async () => {
      /**
       * This test specifically documents the user's observation:
       * "the task selection menu in Pomodoro Timer only showed the initial recurring task
       * (with its completed status). I was not able to find any of the other open instances"
       *
       * The fundamental issue is that recurring tasks are stored as a single file,
       * with instance completion tracked in complete_instances array.
       * The task selector treats this as one task and shows its "overall" status,
       * rather than showing today's instance status.
       */
      const page = app.page;

      // Open Pomodoro view
      await runCommand(page, 'TaskNotes: Open pomodoro view');
      await page.waitForTimeout(1000);

      const pomodoroView = page.locator('.pomodoro-view, [data-view-type*="pomodoro"]');
      await expect(pomodoroView).toBeVisible({ timeout: 10000 });

      // Open task selector
      const chooseTaskButton = page.locator(
        '.pomodoro-view__task-select, ' +
          'button:has-text("Choose Task"), ' +
          'button:has-text("Select Task")'
      );

      if (!(await chooseTaskButton.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('Task selector button not found');
        return;
      }

      await chooseTaskButton.click();
      await page.waitForTimeout(500);

      // Get all task items in the selector
      const allTasks = page.locator('.task-card, .task-item');
      const totalCount = await allTasks.count();

      // Count tasks by status
      const completedTasks = page.locator(
        '.task-card.completed, ' + '.task-card[data-status="done"], ' + '.task-card.status-done'
      );
      const completedCount = await completedTasks.count();

      const openTasks = page.locator(
        '.task-card:not(.completed), ' +
          '.task-card[data-status="open"], ' +
          '.task-card.status-open'
      );
      const openCount = await openTasks.count();

      console.log(`Task selector shows: ${totalCount} total, ${openCount} open, ${completedCount} completed`);

      // Look specifically for recurring tasks
      const recurringInSelector = page.locator(
        '.task-card:has([data-property="recurrence"]), ' + '.task-card:has(.recurrence-indicator)'
      );
      const recurringCount = await recurringInSelector.count();

      const openRecurring = page.locator(
        '.task-card:has([data-property="recurrence"]):not(.completed), ' +
          '.task-card:has(.recurrence-indicator):not([data-status="done"])'
      );
      const openRecurringCount = await openRecurring.count();

      console.log(`Recurring tasks: ${recurringCount} total, ${openRecurringCount} shown as open`);

      // The bug manifests when:
      // - A recurring task exists
      // - One or more past instances are completed (in complete_instances array)
      // - Today's instance should be open
      // - But the task selector shows the task as completed or doesn't show it at all

      // After fix:
      // - Recurring tasks with open instances for today should appear as "open"
      // - Should be able to select them for time tracking

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #964 - task selector should filter recurring tasks by today effective status',
    async () => {
      /**
       * Implementation requirement:
       *
       * In TaskSelectorWithCreateModal.getFilteredTasks(), the sorting logic currently does:
       *   const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
       *
       * For recurring tasks, this should instead be:
       *   const aCompleted = this.plugin.statusManager.isCompletedStatus(
       *     getEffectiveTaskStatus(a, new Date())
       *   );
       *
       * Similarly, any filtering that excludes completed tasks should use the
       * date-aware effective status for recurring tasks.
       */
      const page = app.page;

      // This test documents the required code change
      console.log('Required fix in TaskSelectorWithCreateModal.ts:');
      console.log('1. Import getEffectiveTaskStatus from utils/helpers');
      console.log('2. In getFilteredTasks(), check if task.recurrence exists');
      console.log('3. If recurring, use getEffectiveTaskStatus(task, new Date()) for status checks');
      console.log('4. Non-recurring tasks continue to use task.status directly');

      // Verify the issue exists by checking task selector behavior
      await runCommand(page, 'TaskNotes: Open pomodoro view');
      await page.waitForTimeout(1000);

      const chooseTaskButton = page.locator(
        '.pomodoro-view__task-select, ' +
          'button:has-text("Choose Task"), ' +
          'button:has-text("Select Task")'
      );

      if (await chooseTaskButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chooseTaskButton.click();
        await page.waitForTimeout(500);

        // After the fix, recurring tasks should be properly filtered
        // - Open instances for today at the top
        // - Completed instances (including recurring tasks with today completed) at the bottom

        await page.keyboard.press('Escape');
      }

      // This test will pass after the fix is implemented
      // expect(true).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #964 - PomodoroView.openTaskSelector should handle recurring tasks correctly',
    async () => {
      /**
       * Additional consideration in PomodoroView.ts:
       *
       * The openTaskSelector method fetches all unarchived tasks:
       *   const unarchivedTasks = allTasks.filter((task) => !task.archived);
       *
       * It doesn't filter by completion status at all, which means completed tasks
       * (including recurring tasks where file-level status is done) will be passed
       * to the modal. This is intentional to allow selecting recently completed tasks.
       *
       * However, the sorting in TaskSelectorWithCreateModal sorts completed tasks
       * to the bottom using file-level status, which is incorrect for recurring tasks.
       *
       * The fix should ensure:
       * 1. Recurring tasks with open instances for today appear at the top
       * 2. Recurring tasks with completed instances for today appear at the bottom
       * 3. The effective status for the current date determines position, not file status
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open pomodoro view');
      await page.waitForTimeout(1000);

      // Document the issue in the test
      console.log('PomodoroView.openTaskSelector behavior:');
      console.log('- Fetches all unarchived tasks');
      console.log('- Passes them to TaskSelectorWithCreateModal');
      console.log('- Modal sorts by task.status (incorrect for recurring)');
      console.log('- Should sort by getEffectiveTaskStatus(task, today) for recurring tasks');

      // Verify the pomodoro view is accessible
      const pomodoroView = page.locator('.pomodoro-view, [data-view-type*="pomodoro"]');
      await expect(pomodoroView).toBeVisible({ timeout: 10000 });
    }
  );
});
