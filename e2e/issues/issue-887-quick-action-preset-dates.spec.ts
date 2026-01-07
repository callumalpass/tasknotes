/**
 * Issue #887: [FR]: Add pre-supported scheduled dates to the "Quick actions for current task"
 *
 * Feature request description:
 * When using "TaskNotes: Quick actions for current task" (hotkey-bound), users
 * frequently need to change the scheduled date to a pre-supported value (today,
 * tomorrow, weekend, etc.). Currently, the "Change scheduled date" action opens
 * a popup requiring mouse interaction.
 *
 * The request is to add direct quick action options for common date presets:
 * - Schedule for today
 * - Schedule for tomorrow
 * - Schedule for this weekend
 * - Schedule for next week
 * - Schedule for next month
 * (And potentially similar options for due dates)
 *
 * Current workflow:
 * 1. User opens quick actions palette
 * 2. Selects "Set scheduled date"
 * 3. ScheduledDateModal opens
 * 4. User must use mouse to click preset buttons or enter custom date
 *
 * Requested workflow:
 * 1. User opens quick actions palette
 * 2. User can directly select "Schedule for today", "Schedule for tomorrow", etc.
 * 3. Date is set immediately without opening another modal
 *
 * Related code locations:
 * - src/modals/TaskActionPaletteModal.ts (quick actions implementation)
 * - src/modals/TaskActionPaletteModal.ts:90-142 (current date actions)
 * - src/components/DateContextMenu.ts:130-228 (existing date presets to reuse)
 * - src/modals/ScheduledDateModal.ts (modal that currently handles scheduling)
 *
 * Implementation approach:
 * Add new TaskAction entries in buildActionsList() for each preset date option,
 * similar to how status and priority actions are dynamically generated.
 * These would call updateTaskProperty directly instead of opening a modal.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/887
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #887: Pre-supported scheduled dates in quick actions', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('quick actions palette should include "Schedule for today" option', async () => {
    /**
     * Test that the quick actions palette includes a direct "Schedule for today" option
     * that sets the scheduled date without opening another modal.
     *
     * Expected behavior:
     * 1. Open quick actions for a task
     * 2. "Schedule for today" appears in the dates category
     * 3. Selecting it immediately sets scheduled date to today
     * 4. No additional modal is required
     */
    const page = app.page;

    // First, create a test task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in task title
    const titleInput = modal.locator('input[placeholder*="title"], input[type="text"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test task for quick action dates');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // Close modal if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open quick actions for the current task
    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    // Look for the quick actions palette modal
    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    // Search for "Schedule for today" or similar option
    // Currently this should NOT exist (hence fixme) - this tests the feature request
    const scheduleToday = actionPalette.locator(
      'text=/schedule.*today/i, ' +
      '.task-action-palette__title:has-text("today"), ' +
      '.suggestion-item:has-text("Schedule for today")'
    ).first();

    // This assertion will fail until the feature is implemented
    await expect(scheduleToday).toBeVisible({ timeout: 3000 });

    // If visible, select it and verify scheduled date is set
    if (await scheduleToday.isVisible().catch(() => false)) {
      await scheduleToday.click();
      await page.waitForTimeout(300);

      // Verify the task's scheduled date was updated (check via notice or re-opening task)
      const notice = page.locator('.notice:has-text("scheduled")');
      await expect(notice).toBeVisible({ timeout: 2000 });
    }

    // Cleanup
    await page.keyboard.press('Escape');
  });

  test.fixme('quick actions palette should include "Schedule for tomorrow" option', async () => {
    /**
     * Test that "Schedule for tomorrow" appears as a direct quick action.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    const scheduleTomorrow = actionPalette.locator(
      'text=/schedule.*tomorrow/i, ' +
      '.task-action-palette__title:has-text("tomorrow")'
    ).first();

    // This assertion will fail until the feature is implemented
    await expect(scheduleTomorrow).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  test.fixme('quick actions palette should include "Schedule for this weekend" option', async () => {
    /**
     * Test that "Schedule for this weekend" appears as a direct quick action.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    const scheduleWeekend = actionPalette.locator(
      'text=/schedule.*weekend/i, ' +
      '.task-action-palette__title:has-text("weekend")'
    ).first();

    // This assertion will fail until the feature is implemented
    await expect(scheduleWeekend).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  test.fixme('quick actions palette should include "Schedule for next week" option', async () => {
    /**
     * Test that "Schedule for next week" appears as a direct quick action.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    const scheduleNextWeek = actionPalette.locator(
      'text=/schedule.*next.*week/i, ' +
      '.task-action-palette__title:has-text("next week")'
    ).first();

    // This assertion will fail until the feature is implemented
    await expect(scheduleNextWeek).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  test.fixme('quick actions date presets should be searchable', async () => {
    /**
     * Test that the date preset actions are searchable via the fuzzy search.
     * Users should be able to type "today" and find "Schedule for today".
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    // Type in the search input
    const searchInput = actionPalette.locator('input[type="text"], .prompt-input').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('today');
      await page.waitForTimeout(200);

      // Should show "Schedule for today" in results
      const todayResult = actionPalette.locator(
        'text=/schedule.*today/i, ' +
        '.suggestion-item:has-text("today")'
      ).first();

      // This assertion will fail until the feature is implemented
      await expect(todayResult).toBeVisible({ timeout: 2000 });
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('quick actions should show date presets in the dates category', async () => {
    /**
     * Test that the date preset actions appear in the correct category
     * alongside existing date actions like "Set scheduled date".
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    // Look for the dates category badge on preset actions
    const datesCategoryItems = actionPalette.locator(
      '.task-action-palette__category--dates'
    );

    // Count items in dates category
    const itemCount = await datesCategoryItems.count();

    // Currently there are 4 date actions: set due, set scheduled, clear due, clear scheduled
    // After implementation there should be more (4 + preset options)
    // This test documents that we expect more than 4 items in dates category
    expect(itemCount).toBeGreaterThan(4);

    await page.keyboard.press('Escape');
  });

  test.fixme('selecting "Schedule for today" should immediately update task', async () => {
    /**
     * Test that selecting a date preset directly updates the task
     * without opening any intermediate modals.
     */
    const page = app.page;

    // Get today's date for verification
    const today = new Date().toISOString().split('T')[0];

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    // Find and click "Schedule for today"
    const scheduleToday = actionPalette.locator(
      'text=/schedule.*today/i'
    ).first();

    if (await scheduleToday.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scheduleToday.click();
      await page.waitForTimeout(300);

      // The action palette should close
      await expect(actionPalette).not.toBeVisible({ timeout: 2000 });

      // No additional modal should have opened
      const scheduledDateModal = page.locator('.scheduled-date-modal');
      const modalIsVisible = await scheduledDateModal.isVisible().catch(() => false);
      expect(modalIsVisible).toBe(false);

      // A notice should confirm the change
      const notice = page.locator('.notice');
      await expect(notice).toBeVisible({ timeout: 2000 });
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('due date presets should also be available as quick actions', async () => {
    /**
     * Test that due date presets are also available, as mentioned in the feature request
     * ("This could also be extended for due dates").
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick actions for current task');
    await page.waitForTimeout(500);

    const actionPalette = page.locator('.task-action-palette-modal, .prompt').first();
    await expect(actionPalette).toBeVisible({ timeout: 5000 });

    // Look for due date preset options
    const dueToday = actionPalette.locator('text=/due.*today/i').first();
    const dueTomorrow = actionPalette.locator('text=/due.*tomorrow/i').first();

    // These assertions will fail until the feature is implemented
    await expect(dueToday).toBeVisible({ timeout: 3000 });
    await expect(dueTomorrow).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });
});
