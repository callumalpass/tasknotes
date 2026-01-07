/**
 * Issue #702: [FR] Make completedDate include the time as well
 *
 * Feature request to include time in the completedDate property.
 *
 * Current behavior:
 * - completedDate is stored as YYYY-MM-DD format (date only)
 * - The getCurrentDateString() function only extracts year, month, day
 * - Users cannot see what time a task was completed
 *
 * Requested behavior:
 * - Store completedDate with time component (like scheduledDate does)
 * - Format could be YYYY-MM-DDTHH:mm (ISO datetime format)
 * - Display should show both date and time when viewing task details
 *
 * Comparison with scheduledDate:
 * - scheduledDate supports time via YYYY-MM-DDTHH:mm format
 * - completedDate only stores YYYY-MM-DD
 * - The inconsistency makes it harder to track when tasks were actually completed
 *
 * Implementation considerations:
 * 1. Modify getCurrentDateString() or create new getCurrentDateTimeString()
 * 2. Update TaskService.ts where completedDate is set
 * 3. Update UI components to display time when present
 * 4. Consider backwards compatibility with existing date-only values
 *
 * @see https://github.com/callumalpass/tasknotes/issues/702
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #702: completedDate should include time', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #702 - completedDate should store time component',
    async () => {
      /**
       * When a task is marked as completed, the completedDate should include
       * the time, not just the date.
       *
       * Steps to reproduce:
       * 1. Create a new task
       * 2. Mark the task as completed
       * 3. Check the task's frontmatter
       *
       * Expected behavior:
       * - completedDate should be stored as "YYYY-MM-DDTHH:mm" format
       * - Example: "2026-01-07T14:30"
       *
       * Actual behavior (current):
       * - completedDate is stored as "YYYY-MM-DD" format
       * - Example: "2026-01-07"
       */
      const page = app.page;

      // Create a new task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Enter task title
      const titleInput = modal.locator('input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Test task for issue #702');
      }

      // Save the task
      const saveButton = modal.locator('button', { hasText: /save|create/i }).first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }

      // Find and complete the task
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
      await expect(taskListContainer).toBeVisible({ timeout: 10000 });

      // Find the test task and mark it complete
      const taskCard = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({ hasText: 'Test task for issue #702' })
        .first();

      if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click the checkbox to complete the task
        const checkbox = taskCard.locator(
          'input[type="checkbox"], .task-checkbox, .status-checkbox'
        ).first();

        if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          await checkbox.click();
          await page.waitForTimeout(500);
        }

        // Open the task to verify completedDate format
        await taskCard.click();
        await page.waitForTimeout(500);

        const taskModal = page.locator('.modal, [role="dialog"]');
        if (await taskModal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Look for completedDate display
          const completedDateEl = taskModal.locator(
            '[data-property="completedDate"], ' +
              '.task-modal__field:has-text("completed"), ' +
              ':text("Completed:")'
          );

          if (await completedDateEl.isVisible({ timeout: 2000 }).catch(() => false)) {
            const completedDateText = await completedDateEl.textContent();
            console.log(`Current completedDate display: "${completedDateText}"`);

            // After implementation, the completedDate should include time
            // Example: "Completed: Jan 7, 2026 at 2:30 PM" instead of "Completed: Jan 7"
            // For now, document that time is missing
          }

          await page.keyboard.press('Escape');
        }
      }

      // Document the expected behavior
      console.log(
        'Expected: completedDate should be stored as YYYY-MM-DDTHH:mm format\n' +
          'Actual: completedDate is stored as YYYY-MM-DD format (no time)'
      );
    }
  );

  test.fixme(
    'reproduces issue #702 - completedDate should display time in task card',
    async () => {
      /**
       * When displaying completedDate in task cards, the time should be visible
       * if it exists in the stored value.
       *
       * Current behavior in TaskCard.ts (line 771-778):
       * - Uses formatDateTimeForDisplay with showTime: false
       * - Always displays as "Completed: MMM d" format
       *
       * Expected behavior:
       * - If completedDate has time component, display it
       * - Format: "Completed: MMM d at h:mm a" or similar
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
      await expect(taskListContainer).toBeVisible({ timeout: 10000 });

      // Find a completed task
      const completedTaskCard = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({
          has: page.locator(
            '[data-status="done"], .task-completed, input[type="checkbox"]:checked'
          ),
        })
        .first();

      if (await completedTaskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for completedDate display in the card
        const completedDatePill = completedTaskCard.locator(
          '[data-property="completedDate"], ' +
            '.task-card__metadata-pill:has-text("Completed")'
        );

        if (await completedDatePill.isVisible({ timeout: 2000 }).catch(() => false)) {
          const dateText = await completedDatePill.textContent();
          console.log(`Task card completedDate display: "${dateText}"`);

          // After implementation, should show time if available
          // Current: "Completed: Jan 7"
          // Expected: "Completed: Jan 7 at 2:30 PM" (if time is stored)
        }
      }

      // Document expected behavior
      console.log(
        'Expected: completedDate should display time component if available\n' +
          'Current: showTime is hardcoded to false in PROPERTY_RENDERERS'
      );
    }
  );

  test.fixme(
    'reproduces issue #702 - scheduledDate handles time but completedDate does not',
    async () => {
      /**
       * This test demonstrates the inconsistency between scheduledDate and completedDate.
       *
       * scheduledDate:
       * - Can store time via YYYY-MM-DDTHH:mm format
       * - UI allows setting time
       * - hasTimeComponent() checks are used
       *
       * completedDate:
       * - Only stores YYYY-MM-DD format
       * - getCurrentDateString() only extracts date, not time
       * - No time picker or time storage
       *
       * The feature request asks to make completedDate consistent with scheduledDate.
       */
      const page = app.page;

      // Create a task with scheduled time
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Look for scheduled date input with time
      const scheduledDateInput = modal.locator(
        'input[type="datetime-local"], ' +
          '[data-field="scheduled"] input, ' +
          '.scheduled-date-input'
      );

      if (await scheduledDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        // scheduledDate supports datetime-local input
        console.log('scheduledDate: Has datetime-local input (supports time)');
      }

      // Check if there's any time input for completedDate (there won't be)
      const completedDateInput = modal.locator(
        'input[type="datetime-local"][data-field="completedDate"], ' +
          '[data-field="completedDate"] input[type="datetime-local"]'
      );

      const hasCompletedTimeInput = await completedDateInput
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      console.log(`completedDate: Has datetime input: ${hasCompletedTimeInput}`);

      await page.keyboard.press('Escape');

      // Document the inconsistency
      console.log(
        'Inconsistency:\n' +
          '- scheduledDate: Supports YYYY-MM-DDTHH:mm format with time\n' +
          '- completedDate: Only supports YYYY-MM-DD format (date only)'
      );
    }
  );

  test.fixme(
    'reproduces issue #702 - verify getCurrentDateString only returns date',
    async () => {
      /**
       * This test documents the root cause of the issue.
       *
       * In src/utils/dateUtils.ts, getCurrentDateString() (lines 681-689):
       * ```
       * export function getCurrentDateString(): string {
       *   const now = new Date();
       *   const year = now.getFullYear();
       *   const month = String(now.getMonth() + 1).padStart(2, "0");
       *   const day = String(now.getDate()).padStart(2, "0");
       *   return `${year}-${month}-${day}`;
       * }
       * ```
       *
       * This function is called when marking tasks complete in TaskService.ts.
       * It explicitly only returns date (YYYY-MM-DD), not datetime.
       *
       * Fix options:
       * 1. Modify getCurrentDateString() to return datetime
       * 2. Create new getCurrentDateTimeString() function
       * 3. Use getLocalTimestamp() which already returns full ISO datetime
       */
      const page = app.page;

      // Document the technical details
      console.log(
        'Root cause: getCurrentDateString() only extracts date components\n' +
          'Location: src/utils/dateUtils.ts:681-689\n' +
          'Called by: TaskService.ts when marking tasks complete\n' +
          '\n' +
          'Suggested fix:\n' +
          '1. Create getCurrentDateTimeString() or modify getCurrentDateString()\n' +
          '2. Return format: YYYY-MM-DDTHH:mm\n' +
          '3. Update TaskService.ts to use new function for completedDate'
      );

      expect(true).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #702 - backwards compatibility with date-only values',
    async () => {
      /**
       * Implementation should handle backwards compatibility.
       *
       * Existing tasks may have completedDate in YYYY-MM-DD format.
       * New tasks should store YYYY-MM-DDTHH:mm format.
       * Display logic should handle both formats gracefully.
       *
       * hasTimeComponent() from dateUtils.ts can detect if time exists:
       * - "2026-01-07" -> false
       * - "2026-01-07T14:30" -> true
       *
       * Display should:
       * - Show "Completed: Jan 7" for date-only values
       * - Show "Completed: Jan 7 at 2:30 PM" for datetime values
       */
      const page = app.page;

      console.log(
        'Backwards compatibility considerations:\n' +
          '1. Existing YYYY-MM-DD values should continue to work\n' +
          '2. New completions should store YYYY-MM-DDTHH:mm\n' +
          '3. hasTimeComponent() can detect format for display logic\n' +
          '4. formatDateTimeForDisplay() already supports showTime parameter\n' +
          '5. UI should conditionally show time based on hasTimeComponent()'
      );

      expect(true).toBe(true);
    }
  );
});
