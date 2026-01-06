/**
 * Issue #1112: [FR] Auto-Updating and Time-Tracking Features for Designated Tasks
 *
 * Feature request for a "Progress Task" type - tasks meant to track ongoing progress
 * rather than being "completed". This includes:
 *
 * 1. Time Tracking Per Recurrence Period:
 *    - Currently, recurring tasks show total time tracked across all instances
 *    - Users want to see time tracked "since last recurrence" (e.g., this week's hours)
 *    - Example: "Write about Data Science" - want to see "3/4 hours this week"
 *      rather than "47 hours total"
 *
 * 2. Auto-Incrementing Scheduled/Due Dates:
 *    - Progress tasks should auto-advance their dates without requiring manual completion
 *    - Current behavior requires clicking "Complete Task for This Date" for each instance
 *    - For progress tasks where the goal isn't completion, this is tedious busywork
 *
 * Problems with current workarounds:
 * - Task Time Tracking: Shows total time, not per-period time
 * - Project Statistics: Can filter by date range but requires manual date picker updates
 * - Recurring Tasks: Require manual completion to advance to next instance
 *
 * Use cases:
 * - Habit tracking (e.g., "Practice guitar" - 30 min/day)
 * - Ongoing projects (e.g., "Write about Politics" - 4 hours/week)
 * - Learning goals (e.g., "Study Japanese" - 1 hour/day)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1112
 * @see https://github.com/callumalpass/tasknotes/issues/1054 (original feature request)
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1112: Progress Task Time Tracking Features', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Feature 1: Time Tracking Per Recurrence Period', () => {
    test.fixme(
      'reproduces issue #1112 - recurring task should show time tracked since last recurrence',
      async () => {
        /**
         * Currently, recurring tasks display total time tracked across all instances.
         * Users want to see "time tracked since the last recurrence date" instead.
         *
         * Example scenario:
         * - Task: "Write about Data Science" (weekly recurring)
         * - Total time tracked: 47 hours (over many weeks)
         * - Time tracked this week: 3 hours
         *
         * Current behavior:
         * - Task card shows "47h tracked"
         *
         * Expected behavior:
         * - Task card shows "3h / 4h this week" (current period progress)
         * - Option to view total time tracked separately
         * - Clear distinction between "this period" and "all time" tracking
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a recurring task with time tracking
        const recurringTaskCard = page
          .locator('.tasknotes-task-card, .task-card')
          .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
          .first();

        if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No recurring tasks found in task list');
          return;
        }

        // Check time tracking display
        const timeDisplay = recurringTaskCard.locator(
          '.time-tracked, ' +
            '[data-property="totalTrackedTime"], ' +
            '.task-card__time-tracked, ' +
            '.tracked-time'
        );

        if (await timeDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
          const timeText = await timeDisplay.textContent();
          console.log(`Current time display: "${timeText}"`);

          // After implementation, should show period-specific time
          // Look for indicators like "this week", "since Monday", etc.
          const showsPeriodTime =
            timeText?.includes('this week') ||
            timeText?.includes('this month') ||
            timeText?.includes('since') ||
            timeText?.match(/\d+[hm]?\s*\/\s*\d+[hm]?\s*(this|since)/i);

          console.log(`Shows period-specific time: ${showsPeriodTime}`);

          // Document expected behavior
          expect(showsPeriodTime).toBe(true);
        }
      }
    );

    test.fixme(
      'reproduces issue #1112 - time entries should be grouped by recurrence period',
      async () => {
        /**
         * Time entries (from timeEntries array) should be groupable by recurrence period.
         *
         * Current data structure:
         * timeEntries: [
         *   { startTime: "2026-01-01T09:00", endTime: "2026-01-01T10:00" },
         *   { startTime: "2026-01-07T14:00", endTime: "2026-01-07T15:30" },
         *   ...
         * ]
         *
         * Expected behavior:
         * - System can identify which entries belong to which recurrence period
         * - For weekly recurrence: group entries by week
         * - For daily recurrence: group entries by day
         * - UI shows breakdown: "This period: 2h 30m | Previous: 4h | Total: 47h"
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a recurring task and open its details
        const recurringTaskCard = page
          .locator('.tasknotes-task-card, .task-card')
          .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
          .first();

        if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No recurring tasks found');
          return;
        }

        // Click to open task details
        await recurringTaskCard.click();
        await page.waitForTimeout(500);

        // Look for time tracking details panel or modal
        const detailsPanel = page.locator('.task-details-panel, .details-panel, [role="dialog"]');

        if (await detailsPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
          // After implementation: look for period-grouped time entries
          const periodGrouping = detailsPanel.locator(
            '.time-entries-by-period, ' +
              '.period-breakdown, ' +
              '[data-testid="time-period-groups"], ' +
              '.recurrence-time-summary'
          );

          const hasPeriodGrouping = await periodGrouping
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          console.log(`Has period-grouped time entries: ${hasPeriodGrouping}`);

          // Document expected behavior
          expect(hasPeriodGrouping).toBe(true);
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1112 - stats view should support "since last recurrence" filter',
      async () => {
        /**
         * The Project and Task Statistics view can filter by date ranges,
         * but requires manually updating "Date -> Custom Range" to see
         * time since start of week/month/etc.
         *
         * Expected behavior:
         * - Quick filter option: "Since last recurrence"
         * - For weekly tasks: shows time tracked since Monday (or configured week start)
         * - For daily tasks: shows time tracked today
         * - For monthly tasks: shows time tracked since 1st of month
         *
         * This would make it easy to answer: "How much have I worked on X this period?"
         */
        const page = app.page;

        // Open stats view
        await runCommand(page, 'TaskNotes: Open statistics view');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // Look for date range filters
        const dateFilter = page.locator(
          '.date-filter, ' +
            '[data-testid="date-range-filter"], ' +
            'button:has-text("Date"), ' +
            '.stats-filter-date'
        );

        if (await dateFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dateFilter.click();
          await page.waitForTimeout(300);

          // After implementation: look for "Since last recurrence" option
          const recurrenceOption = page.locator(
            'text=Since last recurrence, ' +
              'text=This period, ' +
              'text=Current recurrence, ' +
              '[data-filter="since-recurrence"]'
          );

          const hasRecurrenceFilter = await recurrenceOption
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          console.log(`Has "since last recurrence" filter: ${hasRecurrenceFilter}`);

          // Document expected behavior
          expect(hasRecurrenceFilter).toBe(true);
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1112 - time tracking log should show per-recurrence history',
      async () => {
        /**
         * For progress tasks, users want a dedicated log showing time tracked
         * per recurrence period, like:
         *
         * Week of Jan 6: 3h 15m (Target: 4h)
         * Week of Dec 30: 4h 30m (Target: 4h) [over]
         * Week of Dec 23: 2h 45m (Target: 4h) [under]
         * ...
         *
         * This allows tracking progress over time and identifying patterns
         * (e.g., "I consistently fall short on holiday weeks").
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a recurring task and open its details
        const recurringTaskCard = page
          .locator('.tasknotes-task-card, .task-card')
          .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
          .first();

        if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No recurring tasks found');
          return;
        }

        await recurringTaskCard.click();
        await page.waitForTimeout(500);

        // Look for time tracking history/log
        const timeLog = page.locator(
          '.time-tracking-log, ' +
            '.recurrence-history, ' +
            '[data-testid="time-log-by-period"], ' +
            '.time-history-panel'
        );

        if (await timeLog.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check for period-grouped entries
          const periodEntries = timeLog.locator(
            '.period-entry, ' + '.recurrence-period-row, ' + '[data-period]'
          );

          const entryCount = await periodEntries.count();
          console.log(`Period entries in time log: ${entryCount}`);

          // Should have at least one entry showing a recurrence period
          expect(entryCount).toBeGreaterThan(0);
        } else {
          console.log('Time tracking log not visible - feature not implemented');
          expect(false).toBe(true); // Fail to document missing feature
        }

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Feature 2: Auto-Incrementing Dates for Progress Tasks', () => {
    test.fixme(
      'reproduces issue #1112 - progress task type should exist for non-completable tasks',
      async () => {
        /**
         * A new task type "Progress Task" should be available for tasks that are
         * meant to be ongoing and never "completed" in the traditional sense.
         *
         * Characteristics of progress tasks:
         * - Have a recurrence pattern (daily, weekly, monthly)
         * - Are NOT meant to be checked off as "done"
         * - Track time/effort per period instead of completion
         * - Auto-advance their scheduled/due dates without manual intervention
         *
         * Implementation options:
         * - New property: `taskType: "progress"` or `isProgressTask: true`
         * - New status type that represents "ongoing" rather than open/done
         * - Special handling in recurrence logic
         */
        const page = app.page;

        // Open task creation
        await runCommand(page, 'TaskNotes: Create new task');
        await page.waitForTimeout(500);

        const taskModal = page.locator('.modal, [role="dialog"]');
        await expect(taskModal).toBeVisible({ timeout: 5000 });

        // After implementation: look for progress task option
        const progressTaskOption = page.locator(
          '[data-field="taskType"] option[value="progress"], ' +
            'input[name="isProgressTask"], ' +
            'label:has-text("Progress task"), ' +
            '[data-testid="progress-task-toggle"], ' +
            '.task-type-selector:has-text("Progress")'
        );

        const hasProgressOption = await progressTaskOption
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Progress task option available: ${hasProgressOption}`);

        // Document expected behavior
        expect(hasProgressOption).toBe(true);

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1112 - progress tasks should auto-advance dates at recurrence boundary',
      async () => {
        /**
         * For progress tasks, when the recurrence period ends, the task should
         * automatically advance to the next period WITHOUT requiring user action.
         *
         * Current behavior:
         * - User must manually click "Complete Task for This Date" at each recurrence
         * - If forgotten, must navigate back in calendar to mark past dates
         * - Tedious for tasks where "completion" is not the goal
         *
         * Expected behavior for progress tasks:
         * - At recurrence boundary (e.g., Monday for weekly tasks), dates auto-advance
         * - Previous period's time tracking is "closed" and logged
         * - New period begins fresh with 0 time tracked
         * - No manual completion step required
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a progress task (after implementation)
        const progressTaskCard = page.locator(
          '.task-card[data-task-type="progress"], ' +
            '.task-card.progress-task, ' +
            '.task-card:has([data-is-progress-task="true"])'
        );

        if (!(await progressTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No progress tasks found - feature not implemented');
          // This is expected until the feature is built
          expect(false).toBe(true); // Document missing feature
          return;
        }

        // Open task details
        await progressTaskCard.click();
        await page.waitForTimeout(500);

        // Check for auto-advance settings
        const autoAdvanceSetting = page.locator(
          '[data-testid="auto-advance-toggle"], ' +
            'label:has-text("Auto-advance"), ' +
            '.auto-advance-option, ' +
            'input[name="autoAdvance"]'
        );

        const hasAutoAdvance = await autoAdvanceSetting
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Auto-advance option visible: ${hasAutoAdvance}`);

        expect(hasAutoAdvance).toBe(true);

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1112 - progress tasks should not require manual completion clicks',
      async () => {
        /**
         * The core frustration: having to click "Complete Task for This Date"
         * for every recurrence of a progress task.
         *
         * Current workflow (tedious):
         * 1. Weekly task "Write about Data Science" recurs
         * 2. User works on it throughout the week
         * 3. Monday comes, user must manually "complete" the previous week
         * 4. If forgotten, must go back and complete past instances
         * 5. For many recurring tasks, this becomes a chore
         *
         * Expected workflow (progress tasks):
         * 1. Weekly progress task "Write about Data Science"
         * 2. User works on it, time is tracked
         * 3. Monday comes, system automatically rolls over
         * 4. Previous week's time is logged, new week starts at 0
         * 5. No manual intervention needed
         */
        const page = app.page;

        // Open calendar view to see recurrence handling
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Find a recurring task event
        const recurringEvent = page
          .locator('.fc-event')
          .filter({ has: page.locator('[data-is-recurring="true"], .recurring-indicator') })
          .first();

        if (!(await recurringEvent.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No recurring events visible in calendar');
          return;
        }

        // Right-click to see context menu options
        await recurringEvent.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('.context-menu, [role="menu"]');
        if (await contextMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Current behavior: has "Complete for this date" option
          const completeOption = contextMenu.locator('text=Complete for this date, text=Complete');
          const hasCompleteOption = await completeOption
            .isVisible({ timeout: 500 })
            .catch(() => false);

          // After implementation: progress tasks should NOT need this option
          // Instead, they auto-advance
          // This test documents the current tedious behavior

          console.log(`Has manual completion option: ${hasCompleteOption}`);

          // For progress tasks (when implemented), this option should not be prominent
          // or should be replaced with "View period history" or similar
        }

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1112 - completing past recurrence instances should be easy',
      async () => {
        /**
         * Even with auto-advance, users might want to manually close/complete
         * past periods. Currently this requires navigating in the Completions calendar.
         *
         * Current behavior:
         * - Open task, go to Completions section
         * - Navigate calendar to find past week
         * - Click to mark that date as complete
         * - Repeat for each missed date
         *
         * Expected behavior (for non-progress recurring tasks):
         * - Quick "Complete past instances" action
         * - Option to bulk-complete all past instances
         * - Clear visual indicator of which instances are incomplete
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a recurring task
        const recurringTaskCard = page
          .locator('.tasknotes-task-card, .task-card')
          .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
          .first();

        if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No recurring tasks found');
          return;
        }

        // Right-click for context menu
        await recurringTaskCard.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('.context-menu, [role="menu"]');
        if (await contextMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Look for bulk completion options
          const bulkCompleteOption = contextMenu.locator(
            'text=Complete past instances, ' +
              'text=Catch up, ' +
              'text=Mark all past complete, ' +
              '[data-action="complete-past"]'
          );

          const hasBulkComplete = await bulkCompleteOption
            .isVisible({ timeout: 500 })
            .catch(() => false);
          console.log(`Has bulk past-completion option: ${hasBulkComplete}`);

          // Document expected behavior
          expect(hasBulkComplete).toBe(true);
        }

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Data Model and Implementation Considerations', () => {
    test.fixme(
      'reproduces issue #1112 - time entries should include period metadata',
      async () => {
        /**
         * To support per-period time tracking, the TimeEntry interface might need
         * additional metadata to associate entries with recurrence periods.
         *
         * Current TimeEntry:
         * {
         *   startTime: string,
         *   endTime?: string,
         *   description?: string,
         *   duration?: number
         * }
         *
         * Potential enhancement:
         * {
         *   startTime: string,
         *   endTime?: string,
         *   description?: string,
         *   duration?: number,
         *   recurrencePeriod?: string  // e.g., "2026-W01" for week 1 of 2026
         * }
         *
         * Alternative: Calculate period membership from startTime and recurrence rule
         * (more flexible but requires computation)
         */
        const page = app.page;

        // This test documents the data model consideration
        console.log(
          'TimeEntry data model enhancement needed for per-period tracking:\n' +
            '- Option A: Add recurrencePeriod field to TimeEntry\n' +
            '- Option B: Compute period from startTime + recurrence rule\n' +
            '- Option C: Store period boundaries in complete_instances array'
        );

        // Verify current structure by opening a task with time entries
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Test passes to document the consideration
        expect(true).toBe(true);
      }
    );

    test.fixme('reproduces issue #1112 - progress task should have dedicated view/widget', async () => {
      /**
       * Progress tasks might benefit from a dedicated view or widget that shows:
       *
       * 1. Current period progress (e.g., "3h / 4h this week")
       * 2. Trend over recent periods (sparkline or mini chart)
       * 3. Target vs actual comparison
       * 4. Streak information (e.g., "5 weeks meeting target")
       *
       * This is different from the completion-focused regular task view.
       */
      const page = app.page;

      // After implementation: look for progress task view
      await runCommand(page, 'TaskNotes: Open progress tracker');
      await page.waitForTimeout(500);

      // Command might not exist yet
      const progressView = page.locator(
        '.progress-tracker-view, ' +
          '[data-view-type="progress-tracker"], ' +
          '.tasknotes-progress-view'
      );

      const hasProgressView = await progressView.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Progress tracker view available: ${hasProgressView}`);

      // Document expected behavior
      expect(hasProgressView).toBe(true);

      if (hasProgressView) {
        // Check for key progress tracking elements
        const progressBar = progressView.locator('.progress-bar, .period-progress');
        const trendChart = progressView.locator('.trend-chart, .sparkline, .mini-chart');
        const streakIndicator = progressView.locator('.streak-indicator, .streak-count');

        console.log(`Has progress bar: ${await progressBar.isVisible().catch(() => false)}`);
        console.log(`Has trend chart: ${await trendChart.isVisible().catch(() => false)}`);
        console.log(`Has streak indicator: ${await streakIndicator.isVisible().catch(() => false)}`);
      }
    });

    test.fixme(
      'reproduces issue #1112 - settings should allow configuring progress task behavior',
      async () => {
        /**
         * Users should be able to configure how progress tasks behave:
         *
         * - Default time target per period (e.g., 4 hours/week)
         * - Auto-advance timing (e.g., advance at midnight vs. at week boundary)
         * - Period tracking scope (day, week, month, custom)
         * - What happens when target is not met (carry over, reset, alert)
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        const settingsModal = page.locator('.modal, [role="dialog"]');
        if (!(await settingsModal.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('Settings modal not visible');
          return;
        }

        // Look for progress task settings section
        const progressSettings = settingsModal.locator(
          'text=Progress tasks, ' +
            'text=Progress Task, ' +
            '[data-section="progress-tasks"], ' +
            '.progress-task-settings'
        );

        const hasProgressSettings = await progressSettings
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Progress task settings section exists: ${hasProgressSettings}`);

        if (hasProgressSettings) {
          await progressSettings.click();
          await page.waitForTimeout(300);

          // Check for specific settings
          const targetSetting = settingsModal.locator('text=Default target, text=Time target');
          const autoAdvanceSetting = settingsModal.locator(
            'text=Auto-advance, text=Auto advance'
          );
          const carryOverSetting = settingsModal.locator('text=Carry over, text=Rollover');

          console.log(`Has target setting: ${await targetSetting.isVisible().catch(() => false)}`);
          console.log(
            `Has auto-advance setting: ${await autoAdvanceSetting.isVisible().catch(() => false)}`
          );
          console.log(
            `Has carry-over setting: ${await carryOverSetting.isVisible().catch(() => false)}`
          );
        }

        // Document expected behavior
        expect(hasProgressSettings).toBe(true);

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Edge Cases and Integration', () => {
    test.fixme(
      'reproduces issue #1112 - progress tasks should integrate with Project Statistics',
      async () => {
        /**
         * Progress tasks should work well with the existing Project and Task Statistics view.
         *
         * Integration points:
         * - Show progress tasks in project breakdown
         * - Display per-period time for progress tasks (not just total)
         * - Include progress tasks in "today/week/month" stats appropriately
         * - Allow filtering to show only progress tasks or exclude them
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open statistics view');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // After implementation: progress tasks should be distinguishable
        const progressTaskSection = statsView.locator(
          '.progress-tasks-section, ' + '[data-task-type="progress"], ' + '.progress-task-stats'
        );

        const hasProgressSection = await progressTaskSection
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        console.log(`Stats view has progress task section: ${hasProgressSection}`);

        // Check for progress-specific metrics
        const periodProgress = statsView.locator(
          '.period-progress, ' + '[data-metric="period-time"], ' + '.this-period-time'
        );

        const hasPeriodMetrics = await periodProgress.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Has period-specific metrics: ${hasPeriodMetrics}`);
      }
    );

    test.fixme('reproduces issue #1112 - handle timezone changes gracefully', async () => {
      /**
       * Progress tasks with time tracking need to handle timezone changes gracefully.
       *
       * Scenarios:
       * - User travels across timezones
       * - DST transitions
       * - Week/day boundaries differ by timezone
       *
       * The period calculation should be consistent and not double-count or lose time.
       */
      const page = app.page;

      // This test documents the timezone consideration
      console.log(
        'Timezone handling considerations for progress tasks:\n' +
          '- Time entries should use UTC internally\n' +
          '- Period boundaries should respect user locale settings\n' +
          '- DST transitions should not cause data loss or double-counting'
      );

      expect(true).toBe(true); // Document consideration
    });

    test.fixme(
      'reproduces issue #1112 - migration path for existing recurring tasks',
      async () => {
        /**
         * Existing recurring tasks should have a migration path to become progress tasks
         * if desired, without losing existing time tracking data.
         *
         * Migration should:
         * - Preserve all existing timeEntries
         * - Calculate historical period summaries from existing data
         * - Not break existing recurrence rules
         * - Be optional (user chooses to convert)
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a regular recurring task
        const recurringTaskCard = page
          .locator('.tasknotes-task-card, .task-card')
          .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
          .first();

        if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No recurring tasks found');
          return;
        }

        // Right-click for conversion option
        await recurringTaskCard.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('.context-menu, [role="menu"]');
        if (await contextMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Look for conversion option
          const convertOption = contextMenu.locator(
            'text=Convert to progress task, ' +
              'text=Make progress task, ' +
              '[data-action="convert-to-progress"]'
          );

          const hasConvertOption = await convertOption.isVisible({ timeout: 500 }).catch(() => false);
          console.log(`Has "convert to progress task" option: ${hasConvertOption}`);

          // Document expected behavior
          expect(hasConvertOption).toBe(true);
        }

        await page.keyboard.press('Escape');
      }
    );
  });
});
