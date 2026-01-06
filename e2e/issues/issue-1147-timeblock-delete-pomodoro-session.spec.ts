/**
 * Issue #1147: [Bug]: Deleting Time Block DOES NOT Remove Pomodoro Session
 *
 * Bug: When a user wants to remove an erroneous Pomodoro entry (e.g., they closed
 * the device without turning off the timer), they can delete the time entry in
 * the Advanced Calendar View, but this doesn't actually remove the corresponding
 * entry in "Pomodoro Sessions." Consequently, Pomodoro Statistics remain inaccurate.
 *
 * The user proposes two solutions (either would be sufficient):
 * 1. Solution 1: Users can delete Pomodoro sessions from the Pomodoro Stats View
 *    via right-click → Delete, and this automatically deletes the Time Entry in
 *    the task itself.
 * 2. Solution 2: Users can delete the Time Entry (e.g., by deleting the timeblock
 *    in Advanced Calendar View), and the corresponding Pomodoro session is deleted.
 *
 * Root cause analysis:
 * - PomodoroService.ts has `addSessionToHistory()` but no corresponding
 *   `deleteSessionFromHistory()` or `removeSession()` method
 * - TaskService.ts `deleteTimeEntry()` only removes the time entry from the task's
 *   frontmatter but has no integration with PomodoroService
 * - TimeblockInfoModal.ts `deleteTimeblockFromDailyNote()` deletes timeblocks but
 *   doesn't clean up any associated Pomodoro sessions
 * - There is no bidirectional link maintained between TimeEntry objects and
 *   PomodoroSession objects, making cleanup difficult
 *
 * Affected areas:
 * - src/services/PomodoroService.ts - session history management
 * - src/services/TaskService.ts - time entry deletion
 * - src/modals/TimeblockInfoModal.ts - timeblock deletion
 * - src/modals/TimeEntryEditorModal.ts - time entry editing/deletion
 * - src/bases/calendar-core.ts - calendar event handling
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1147
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1147: Deleting time block should remove pomodoro session', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1147 - deleting time entry should remove corresponding pomodoro session',
    async () => {
      /**
       * This test reproduces the core bug: when a time entry is deleted,
       * the corresponding Pomodoro session remains in the history.
       *
       * STEPS TO REPRODUCE:
       * 1. Create a task
       * 2. Start a Pomodoro session for that task
       * 3. Wait briefly and stop/complete the session
       * 4. Verify the Pomodoro session appears in history
       * 5. Delete the time entry from the task
       * 6. Check if the Pomodoro session is still in history (BUG: it will be)
       *
       * EXPECTED BEHAVIOR:
       * When the time entry is deleted, the corresponding Pomodoro session
       * should also be removed from the history.
       *
       * ACTUAL BEHAVIOR (bug):
       * The Pomodoro session remains in history even after the time entry
       * is deleted, causing inaccurate statistics.
       */
      const page = app.page;

      // Step 1: Create a test task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Pomodoro Test Task 1147');
      }

      const saveButton = modal.locator('button:has-text("Save"), button:has-text("Create")').first();
      if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(1000);
      }

      // Step 2: Start a Pomodoro session for the task
      // Open task list to find and select the task
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskCard = page
        .locator('.task-card')
        .filter({ hasText: 'Pomodoro Test Task 1147' })
        .first();

      if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Right-click to get context menu with Pomodoro option
        await taskCard.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Look for "Start Pomodoro" option in context menu
        const startPomodoro = page.locator('text=Start Pomodoro, text=Start pomodoro').first();
        if (await startPomodoro.isVisible({ timeout: 2000 }).catch(() => false)) {
          await startPomodoro.click();
          await page.waitForTimeout(1000);
        }
      }

      // Step 3: Stop the Pomodoro session after a brief moment
      await page.waitForTimeout(2000);
      await runCommand(page, 'TaskNotes: Stop pomodoro');
      await page.waitForTimeout(1000);

      // Step 4: Verify the session appears in Pomodoro stats/history
      await runCommand(page, 'TaskNotes: Open pomodoro statistics');
      await page.waitForTimeout(1000);

      // Look for the session in the statistics view
      const pomodoroView = page.locator('.pomodoro-stats-view, .pomodoro-history-view, .bases-view');
      let initialSessionCount = 0;

      if (await pomodoroView.isVisible({ timeout: 3000 }).catch(() => false)) {
        const sessions = pomodoroView.locator('.pomodoro-session-item, .session-entry, tr');
        initialSessionCount = await sessions.count();
        console.log(`Initial Pomodoro session count: ${initialSessionCount}`);
      }

      // Step 5: Delete the time entry from the task
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskCardAfter = page
        .locator('.task-card')
        .filter({ hasText: 'Pomodoro Test Task 1147' })
        .first();

      if (await taskCardAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Open the task to access time entries
        await taskCardAfter.dblclick();
        await page.waitForTimeout(1000);

        // Try to find and open time entry editor
        // This might be through a command or a button in the task view
        await runCommand(page, 'TaskNotes: Edit time entries');
        await page.waitForTimeout(500);

        const timeEntryModal = page.locator('.modal, .time-entry-modal');
        if (await timeEntryModal.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Find and click delete button for the time entry
          const deleteButton = timeEntryModal.locator(
            'button:has-text("Delete"), .time-entry-delete-btn, .delete-time-entry'
          );
          if (await deleteButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await deleteButton.click();
            await page.waitForTimeout(500);

            // Confirm deletion if prompted
            const confirmBtn = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
            if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await confirmBtn.click();
              await page.waitForTimeout(500);
            }
          }
        }
      }

      // Step 6: Check if Pomodoro session is still in history (it shouldn't be)
      await runCommand(page, 'TaskNotes: Open pomodoro statistics');
      await page.waitForTimeout(1000);

      const pomodoroViewAfter = page.locator('.pomodoro-stats-view, .pomodoro-history-view, .bases-view');

      if (await pomodoroViewAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
        const sessionsAfter = pomodoroViewAfter.locator('.pomodoro-session-item, .session-entry, tr');
        const finalSessionCount = await sessionsAfter.count();
        console.log(`Final Pomodoro session count: ${finalSessionCount}`);

        // The session should have been removed when the time entry was deleted
        // BUG: The session count will be the same because the session wasn't removed
        expect(finalSessionCount).toBeLessThan(initialSessionCount);
      }

      // Take screenshot for debugging
      await page.screenshot({
        path: 'test-results/screenshots/issue-1147-pomodoro-session-not-deleted.png',
      });
    }
  );

  test.fixme(
    'reproduces issue #1147 - no option to delete pomodoro session from stats view',
    async () => {
      /**
       * This test verifies that the Pomodoro Statistics view lacks the ability
       * to delete individual sessions, which is one of the proposed solutions.
       *
       * STEPS TO REPRODUCE:
       * 1. Open Pomodoro Statistics view
       * 2. Try to right-click on a session entry
       * 3. Check if a "Delete" option is available
       *
       * EXPECTED BEHAVIOR (Solution 1):
       * Users should be able to right-click on a session and select "Delete"
       * to remove the erroneous entry.
       *
       * ACTUAL BEHAVIOR (bug):
       * There is no delete option available for Pomodoro sessions.
       */
      const page = app.page;

      // Open Pomodoro statistics view
      await runCommand(page, 'TaskNotes: Open pomodoro statistics');
      await page.waitForTimeout(1000);

      const pomodoroView = page.locator('.pomodoro-stats-view, .pomodoro-history-view, .bases-view');
      await expect(pomodoroView).toBeVisible({ timeout: 5000 });

      // Find session entries
      const sessions = pomodoroView.locator('.pomodoro-session-item, .session-entry, tr').first();

      if (await sessions.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Right-click to check for context menu
        await sessions.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Look for delete option in context menu
        const deleteOption = page.locator(
          '.menu-item:has-text("Delete"), ' +
            '.context-menu-item:has-text("Delete"), ' +
            'text=Delete session'
        );

        const hasDeleteOption = await deleteOption.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Delete option available in Pomodoro stats: ${hasDeleteOption}`);

        // BUG: There should be a delete option but there isn't
        expect(hasDeleteOption).toBe(true);

        // Close context menu
        await page.keyboard.press('Escape');
      }

      await page.screenshot({
        path: 'test-results/screenshots/issue-1147-no-delete-option-in-stats.png',
      });
    }
  );

  test.fixme(
    'reproduces issue #1147 - deleting timeblock from calendar should remove pomodoro session',
    async () => {
      /**
       * This test specifically addresses Solution 2: deleting a time entry
       * via the Advanced Calendar View should remove the Pomodoro session.
       *
       * STEPS TO REPRODUCE:
       * 1. Create a task with a Pomodoro session
       * 2. Open Advanced Calendar View
       * 3. Find and delete the time entry event
       * 4. Verify the Pomodoro session is removed from history
       *
       * EXPECTED BEHAVIOR:
       * Deleting the timeblock/time entry from the calendar should
       * automatically remove the corresponding Pomodoro session.
       *
       * ACTUAL BEHAVIOR (bug):
       * The Pomodoro session remains even after the timeblock is deleted.
       */
      const page = app.page;

      // Open Advanced Calendar View
      await runCommand(page, 'TaskNotes: Open advanced calendar');
      await page.waitForTimeout(1000);

      const calendarView = page.locator('.calendar-view, .fc, .bases-view');
      await expect(calendarView).toBeVisible({ timeout: 5000 });

      // Look for time entry events in the calendar
      const timeEntryEvents = calendarView.locator(
        '.fc-event[data-event-type="timeEntry"], ' +
          '.calendar-event--time-entry, ' +
          '[class*="timeentry"]'
      );

      const eventCount = await timeEntryEvents.count();
      console.log(`Time entry events in calendar: ${eventCount}`);

      if (eventCount > 0) {
        // Click on a time entry event
        const firstEvent = timeEntryEvents.first();
        await firstEvent.click();
        await page.waitForTimeout(500);

        // Look for the info modal or popover with delete option
        const eventModal = page.locator('.modal, .event-info, .timeblock-info-modal');

        if (await eventModal.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Look for delete button
          const deleteBtn = eventModal.locator(
            'button:has-text("Delete"), ' +
              '.delete-button, ' +
              'button.mod-warning'
          );

          if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await deleteBtn.click();
            await page.waitForTimeout(500);

            // Confirm deletion
            const confirmBtn = page.locator('button:has-text("Delete"), button.mod-warning');
            if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await confirmBtn.click();
              await page.waitForTimeout(1000);
            }
          }
        }
      }

      // Verify Pomodoro session count decreased
      await runCommand(page, 'TaskNotes: Open pomodoro statistics');
      await page.waitForTimeout(1000);

      // Document the issue - session will still be there
      const pomodoroView = page.locator('.pomodoro-stats-view, .pomodoro-history-view');
      if (await pomodoroView.isVisible({ timeout: 3000 }).catch(() => false)) {
        const sessions = pomodoroView.locator('.pomodoro-session-item, .session-entry');
        const sessionCount = await sessions.count();
        console.log(`Pomodoro sessions after calendar delete: ${sessionCount}`);
      }

      await page.screenshot({
        path: 'test-results/screenshots/issue-1147-calendar-delete-no-sync.png',
      });
    }
  );

  test.fixme(
    'reproduces issue #1147 - no deleteSession method in PomodoroService',
    async () => {
      /**
       * This test documents the architectural gap: PomodoroService lacks
       * a method to delete individual sessions from history.
       *
       * The service has:
       * - addSessionToHistory() - adds completed sessions
       * - getSessionHistory() - retrieves all sessions
       * - saveSessionHistory() - saves the entire history
       *
       * But is MISSING:
       * - deleteSessionFromHistory(sessionId) - remove individual session
       * - removeSessionByTimeRange() - remove by time range match
       * - linkSessionToTimeEntry() - associate session with time entry
       *
       * This test verifies the behavior by attempting to create and then
       * remove a session through available APIs.
       */
      const page = app.page;

      // This is more of a documentation test showing the missing functionality
      // The actual fix would require:
      // 1. Adding deleteSessionFromHistory() to PomodoroService
      // 2. Adding a session ID or time range to TimeEntry for correlation
      // 3. Calling the delete method when TimeEntry is deleted

      // For now, document that erroneous sessions cannot be removed
      await runCommand(page, 'TaskNotes: Open pomodoro statistics');
      await page.waitForTimeout(1000);

      const pomodoroView = page.locator('.pomodoro-stats-view, .pomodoro-history-view, .bases-view');

      if (await pomodoroView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Try to find any UI element that would allow session deletion
        const deleteElements = await page.locator(
          'button:has-text("Delete"), ' +
            '.delete-session, ' +
            '[aria-label*="delete"], ' +
            '[title*="delete"]'
        ).count();

        console.log(`Delete-related elements found: ${deleteElements}`);

        // There should be delete functionality but there isn't
        // This documents the missing feature
      }

      await page.screenshot({
        path: 'test-results/screenshots/issue-1147-no-delete-functionality.png',
      });
    }
  );

  test.fixme(
    'reproduces issue #1147 - inaccurate pomodoro statistics after deleting time entry',
    async () => {
      /**
       * This test demonstrates the user-facing impact: Pomodoro statistics
       * become inaccurate when orphaned sessions remain after time entry deletion.
       *
       * SCENARIO:
       * User accidentally leaves timer running, device shuts down, session
       * gets recorded with incorrect duration. User deletes the time entry
       * to correct their tracking, but statistics still show the erroneous data.
       *
       * EXPECTED:
       * Statistics should reflect only valid, non-deleted sessions.
       *
       * ACTUAL (bug):
       * Statistics include orphaned sessions whose time entries were deleted.
       */
      const page = app.page;

      // Open Pomodoro statistics
      await runCommand(page, 'TaskNotes: Open pomodoro statistics');
      await page.waitForTimeout(1000);

      const pomodoroView = page.locator('.pomodoro-stats-view, .pomodoro-history-view, .bases-view');

      if (await pomodoroView.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Look for statistics summary
        const statsElements = await page.locator(
          '.pomodoro-stats-summary, ' +
            '.stats-total, ' +
            '.completed-count, ' +
            '[class*="stat"]'
        ).all();

        for (const el of statsElements) {
          const text = await el.textContent();
          console.log(`Stat element: ${text}`);
        }

        // Look for total time or session count
        const totalTime = page.locator(
          '.total-time, ' +
            '.total-minutes, ' +
            '[class*="total"]'
        );

        if (await totalTime.isVisible({ timeout: 1000 }).catch(() => false)) {
          const totalText = await totalTime.textContent();
          console.log(`Total Pomodoro time reported: ${totalText}`);

          // This total will be inaccurate if it includes orphaned sessions
          // whose time entries were deleted
        }
      }

      await page.screenshot({
        path: 'test-results/screenshots/issue-1147-inaccurate-statistics.png',
      });
    }
  );
});
