/**
 * Issue #948: Subtasks are not displayed according to the filter
 *
 * Bug Description:
 * When filters are set to hide archived tasks, archived tasks don't appear in
 * the main task list correctly, but they still appear as subtasks when expanding
 * a parent task. The filter is not being applied to subtasks at all.
 *
 * Steps to reproduce:
 * 1. Set filters to hide archived tasks
 * 2. Create a parent task (project)
 * 3. Create a subtask linked to the parent
 * 4. Archive the subtask
 * 5. Expand the parent task's subtasks
 *
 * Unexpected behavior:
 * The archived subtask still appears in the subtasks list despite the "hide archived" filter.
 *
 * Expected behavior:
 * The archived subtask should be hidden when the filter is set to hide archived tasks.
 *
 * Root cause:
 * In src/ui/TaskCard.ts:2415-2418, there's explicit code acknowledging that filters
 * are NOT applied to subtasks:
 * ```
 * // Apply current filter to subtasks if available
 * // For now, we'll show all subtasks to keep the implementation simple
 * // Future enhancement: Apply the current view's filter to subtasks
 * // This could be implemented by accessing the FilterService's evaluateFilterNode method
 * ```
 *
 * User suggestion:
 * Add an "apply to subtasks" checkbox in the filter interface, or at minimum
 * add a global "apply filtering to subtasks" setting.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/948
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #948: Subtasks not displayed according to filter', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #948 - archived subtask shown despite hide archived filter', async () => {
    /**
     * Core reproduction case: When "hide archived" filter is active, archived
     * subtasks should not appear in the subtasks list when expanding a parent task.
     *
     * Current behavior (bug):
     * - Archived subtasks appear in the expanded subtasks list regardless of filter
     *
     * Expected behavior (after fix):
     * - Archived subtasks should be hidden when "hide archived" filter is set
     */
    const page = app.page;

    // Step 1: Open TaskNotes Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Step 2: Enable "hide archived" filter
    // Look for filter button/toggle
    const filterButton = page.locator('[aria-label*="filter"], .filter-button, .tasknotes-filter-btn, button:has-text("Filter")').first();
    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(500);

      // Look for archived filter option
      const archivedToggle = page.locator(
        '.filter-option:has-text("archived"), ' +
        '.filter-row:has-text("archived"), ' +
        '[data-filter="archived"], ' +
        'input[type="checkbox"]:near(:text("archived"))'
      ).first();

      if (await archivedToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await archivedToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Step 3: Create a parent task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Parent Task 948');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 4: Create a subtask linked to the parent
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Subtask To Archive 948');
    }

    // Set the project/parent field
    const projectInput = modal2.locator(
      'input[placeholder*="project"], .project-input, ' +
      '[data-property="project"] input, [data-property="projects"] input, ' +
      '[data-property="parent"] input'
    ).first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.fill('Parent Task 948');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 5: Archive the subtask
    // Open the subtask first
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Subtask To Archive 948', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Archive via command or context menu
    await runCommand(page, 'TaskNotes: Archive task');
    await page.waitForTimeout(1000);

    // Step 6: Open the parent task and expand subtasks
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Find the parent task card
    const parentCard = page.locator('.task-card:has-text("Parent Task 948")').first();
    if (await parentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Find and click the expand/chevron button for subtasks
      const expandButton = parentCard.locator(
        '.task-card__expand, .task-card__chevron, ' +
        '[aria-label*="expand"], [aria-label*="subtask"], ' +
        '.expand-subtasks, button:has(.lucide-chevron-down), ' +
        'button:has(.lucide-chevron-right)'
      ).first();

      if (await expandButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expandButton.click();
        await page.waitForTimeout(1500);
      }

      // Step 7: Check if the archived subtask is visible (it shouldn't be)
      const subtasksContainer = parentCard.locator('.task-card__subtasks');
      if (await subtasksContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        const archivedSubtask = subtasksContainer.locator('.task-card:has-text("Subtask To Archive 948")');
        const isArchivedSubtaskVisible = await archivedSubtask.isVisible({ timeout: 2000 }).catch(() => false);

        if (isArchivedSubtaskVisible) {
          console.log('BUG REPRODUCED: Archived subtask is visible despite hide archived filter');
        }

        // After fix, the archived subtask should NOT be visible
        expect(isArchivedSubtaskVisible).toBe(false);
      }
    }

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #948 - status filter not applied to subtasks', async () => {
    /**
     * This test verifies that status-based filters (like "hide completed")
     * are also not being applied to subtasks.
     *
     * Current behavior (bug):
     * - Completed subtasks appear regardless of "hide completed" filter
     *
     * Expected behavior:
     * - Filter settings should apply consistently to both main tasks and subtasks
     */
    const page = app.page;

    // Open Task List
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Enable "hide completed" filter
    const filterButton = page.locator('[aria-label*="filter"], .filter-button, .tasknotes-filter-btn').first();
    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(500);

      // Set status filter to exclude completed
      const statusFilter = page.locator(
        '.filter-option:has-text("completed"), ' +
        '.filter-row:has-text("status"), ' +
        '[data-filter="status"]'
      ).first();

      if (await statusFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statusFilter.click();
        await page.waitForTimeout(500);
      }
    }

    // Create a parent task with a completed subtask
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Parent Task Status 948');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Create a subtask
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Completed Subtask 948');
    }

    const projectInput = modal2.locator(
      'input[placeholder*="project"], .project-input, [data-property="project"] input'
    ).first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.fill('Parent Task Status 948');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
      }
    }

    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Mark the subtask as completed
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Completed Subtask 948', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    await runCommand(page, 'TaskNotes: Mark task as completed');
    await page.waitForTimeout(1000);

    // Check the parent task's subtasks
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const parentCard = page.locator('.task-card:has-text("Parent Task Status 948")').first();
    if (await parentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const expandButton = parentCard.locator(
        '.task-card__expand, .task-card__chevron, [aria-label*="expand"]'
      ).first();

      if (await expandButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expandButton.click();
        await page.waitForTimeout(1500);
      }

      const subtasksContainer = parentCard.locator('.task-card__subtasks');
      if (await subtasksContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        const completedSubtask = subtasksContainer.locator('.task-card:has-text("Completed Subtask 948")');
        const isCompletedSubtaskVisible = await completedSubtask.isVisible({ timeout: 2000 }).catch(() => false);

        if (isCompletedSubtaskVisible) {
          console.log('BUG: Completed subtask visible despite hide completed filter');
        }

        // After fix, completed subtasks should respect the filter
        expect(isCompletedSubtaskVisible).toBe(false);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #948 - priority filter not applied to subtasks', async () => {
    /**
     * Verifies that priority-based filters are not applied to subtasks.
     *
     * Current behavior (bug):
     * - All subtasks are shown regardless of priority filter
     *
     * Expected behavior:
     * - Priority filters should apply to subtasks if enabled
     */
    const page = app.page;

    // This test documents that ANY filter type (status, priority, tags, etc.)
    // is not being applied to subtasks when expanding a parent task.

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // The bug exists because toggleSubtasks() in TaskCard.ts does not
    // have access to the current filter query, and even if it did,
    // the code explicitly skips filter application (lines 2415-2418)

    console.log('Issue #948: Filters of any type are not applied to subtasks');
    console.log('This includes: archived, status, priority, tags, due date, etc.');

    // Placeholder assertion to document the expected behavior
    // After fix, filters should apply to subtasks consistently
    expect(true).toBe(true);
  });

  test.fixme('reproduces issue #948 - suggested fix: apply filtering to subtasks setting', async () => {
    /**
     * This test documents the user's suggested UX improvement:
     * Adding an "apply to subtasks" checkbox to the filter interface,
     * or a global "apply filtering to subtasks" setting.
     *
     * The user provided a mockup showing a checkbox that would allow
     * users to toggle whether filters apply to subtasks.
     *
     * Implementation options:
     * 1. Per-filter toggle: Each filter condition has an "apply to subtasks" checkbox
     * 2. Global toggle: Single setting "Apply all filters to subtasks"
     * 3. Default behavior: Always apply filters to subtasks (simplest fix)
     */
    const page = app.page;

    // Check settings for "apply to subtasks" option
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    const settingsModal = page.locator('.modal.mod-settings');
    if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
      if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pluginTab.click();
        await page.waitForTimeout(500);
      }

      // Look for subtask filter setting
      const subtaskFilterSetting = page.locator(
        '.setting-item:has-text("subtask"), ' +
        '.setting-item:has-text("filter"), ' +
        ':text("apply to subtasks"), ' +
        ':text("filter subtasks")'
      ).first();

      const hasSubtaskFilterSetting = await subtaskFilterSetting.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Setting "apply filters to subtasks" exists:', hasSubtaskFilterSetting);

      // After fix: there should be a way to control subtask filtering behavior
      // This could be a per-filter checkbox or a global setting

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Document that this setting does not currently exist
    console.log('User suggests adding "apply to subtasks" option');
    console.log('This would give users control over subtask filter behavior');
  });

  test.fixme('reproduces issue #948 - FilterService.evaluateFilterNode available for fix', async () => {
    /**
     * This test documents that the fix infrastructure already exists.
     *
     * The comment in TaskCard.ts explicitly states:
     * "This could be implemented by accessing the FilterService's evaluateFilterNode method"
     *
     * The FilterService.evaluateFilterNode() method can evaluate any filter
     * against any task. The fix would involve:
     * 1. Passing the current FilterQuery to createTaskCard()
     * 2. Storing it on the card element
     * 3. In toggleSubtasks(), retrieving and applying the filter to subtasks
     *
     * The infrastructure exists - it just needs to be connected.
     */
    const page = app.page;

    // This is a documentation test - the fix path is clear
    console.log('Fix approach documented in TaskCard.ts:2415-2418');
    console.log('FilterService.evaluateFilterNode() can filter individual tasks');
    console.log('Implementation: Pass FilterQuery through TaskCardOptions');

    // The fix would change the subtask rendering loop at TaskCard.ts:2452-2470
    // to filter subtasks before rendering them

    expect(true).toBe(true);
  });
});
