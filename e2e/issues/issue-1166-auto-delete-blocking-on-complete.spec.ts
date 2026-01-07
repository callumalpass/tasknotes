/**
 * Issue #1166: [FR] Setting to automatically delete blocking relationships when the blocking task is marked done
 *
 * Feature request for an option to auto-remove blockedBy entries when the blocking task is completed.
 *
 * Problem:
 * - Users create filters for "available tasks" that include "blockedby isempty"
 * - When a blocking task is completed, the blocked task's blockedBy metadata remains
 * - The task still doesn't pass the "blockedby isempty" filter even though it's no longer actually blocked
 * - Users must manually remove the blockedBy entry to make the task appear in the filter
 *
 * Current behavior:
 * - When a blocking task is completed, isBlocked becomes false (computed dynamically)
 * - The blockedBy frontmatter array retains the reference to the completed task
 * - Filter "blockedby isempty" checks the blockedBy array, not isBlocked
 *
 * Requested behavior:
 * - Add a setting to automatically remove blockedBy entries when their target task is completed
 * - This would make "blockedby isempty" filters work as expected for "available tasks"
 *
 * Implementation considerations:
 * - New setting in TaskNotesSettings: autoRemoveCompletedBlockers (boolean, default false)
 * - In TaskService.updateProperty(), when status changes to completed:
 *   - Get dependent tasks via cacheManager.getBlockedTaskPaths()
 *   - For each dependent task, remove this task's path from blockedBy array
 *   - Update the dependent task's frontmatter
 * - Consider: Should this be reversible if the blocking task is un-completed?
 *
 * Affected areas:
 * - src/services/TaskService.ts (status change handling, lines 750-782)
 * - src/utils/DependencyCache.ts (relationship tracking)
 * - src/types/settings.ts (new setting)
 * - Settings UI for the new option
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1166
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1166: Auto-delete blocking relationships on task completion', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1166 - blocked task should pass "blockedby isempty" filter after blocker completed', async () => {
    /**
     * This test verifies the core problem described in the feature request:
     * A task blocked by another task should appear in "blockedby isempty" filters
     * after the blocking task is marked complete (with the setting enabled).
     *
     * Setup:
     * 1. Create Task A (the blocker)
     * 2. Create Task B with blockedBy: [[Task A]]
     * 3. Create a filter view with "blockedby isempty"
     *
     * Current behavior:
     * - Task B not in filter results (blockedBy not empty)
     * - Complete Task A
     * - Task B still not in filter results (blockedBy still contains [[Task A]])
     *
     * Expected behavior (with setting enabled):
     * - Task B not in filter results initially
     * - Complete Task A
     * - Task B's blockedBy entry is auto-removed
     * - Task B now appears in filter results
     */
    const page = app.page;

    // Create tasks with blocking relationship
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(1000);

    // Fill in the task creation modal for Task A (blocker)
    const titleInput = page.locator('input[placeholder*="title"], input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Blocker Task A');
      // Save the task
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // Create Task B that is blocked by Task A
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(1000);

    const titleInput2 = page.locator('input[placeholder*="title"], input[aria-label*="title"]').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Blocked Task B');
      // Would need to set blockedBy field to [[Blocker Task A]]
      // Save the task
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // Open task board or list view with filter
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    // Configure filter for "blockedby isempty"
    // This would require opening filter configuration UI

    // Complete Task A
    // Task B's blockedBy should still contain the reference (current behavior)

    console.log('Test setup completed - actual assertion requires setting implementation');

    // After implementation with setting enabled:
    // - Complete Task A
    // - Verify Task B's blockedBy is automatically cleared
    // - Verify Task B now appears in "blockedby isempty" filter results
  });

  test.fixme('reproduces issue #1166 - setting should be opt-in (default off)', async () => {
    /**
     * Verify the setting exists and is disabled by default.
     *
     * This ensures backwards compatibility - users who rely on
     * the current behavior (blockedBy persists after completion)
     * won't be affected.
     */
    const page = app.page;

    // Open settings
    await runCommand(page, 'TaskNotes: Open settings');
    await page.waitForTimeout(1500);

    // Look for the setting
    const settingsModal = page.locator('.modal, .tn-settings');
    await settingsModal.waitFor({ timeout: 5000 }).catch(() => {});

    // Search for auto-remove setting
    const settingText = page.locator('text=/auto.*remov.*block|block.*auto.*delet/i');
    const settingExists = await settingText.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Auto-remove blockers setting exists: ${settingExists}`);

    // After implementation:
    // - Setting should exist in the Task Management or Dependencies section
    // - Default value should be false/off
    // - expect(toggle.isChecked()).toBe(false);

    // Close settings
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1166 - should handle multiple blocking tasks correctly', async () => {
    /**
     * When a task is blocked by multiple tasks and one blocker is completed:
     * - Only that blocker's reference should be removed from blockedBy
     * - Other blocking references should remain
     * - Task should still not pass "blockedby isempty" until all blockers are done
     *
     * Setup:
     * - Task A (blocker 1)
     * - Task B (blocker 2)
     * - Task C with blockedBy: [[Task A], [Task B]]
     *
     * Complete Task A:
     * - Task C's blockedBy should become: [[Task B]]
     * - Task C still doesn't pass "blockedby isempty" filter
     *
     * Complete Task B:
     * - Task C's blockedBy should become: []
     * - Task C now passes "blockedby isempty" filter
     */
    const page = app.page;

    // This test documents the expected incremental behavior
    console.log('Multiple blockers test - verifies partial completion handling');

    // After implementation:
    // 1. Create three tasks with the relationships above
    // 2. Complete Task A
    // 3. Verify Task C's blockedBy only contains Task B
    // 4. Verify Task C is not in "blockedby isempty" results
    // 5. Complete Task B
    // 6. Verify Task C's blockedBy is empty
    // 7. Verify Task C is in "blockedby isempty" results
  });

  test.fixme('reproduces issue #1166 - should update cache when blockedBy is auto-removed', async () => {
    /**
     * When blockedBy entries are automatically removed, the DependencyCache
     * should be updated to reflect the change.
     *
     * The relationship mappings:
     * - dependencySources (task -> blocking tasks)
     * - dependencyTargets (task -> tasks it blocks)
     *
     * Should be updated when blockedBy is auto-removed so that:
     * - isTaskBlocked() returns correct value
     * - getBlockingTaskPaths() returns correct list
     * - getBlockedTaskPaths() returns correct list
     */
    const page = app.page;

    // Open task board to trigger cache initialization
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    console.log('Cache consistency test - verifies DependencyCache updates');

    // After implementation:
    // 1. Create tasks with blocking relationship
    // 2. Complete the blocker
    // 3. Verify the blocked task no longer shows as blocked in UI
    // 4. Verify filter "blockedby isempty" correctly includes the task
    // 5. Verify isBlocked indicator (if any) is removed from task display
  });

  test.fixme('reproduces issue #1166 - should not remove blockedBy when setting is disabled', async () => {
    /**
     * Verify that with the setting disabled (default), the current behavior
     * is preserved: blockedBy entries remain after the blocking task is completed.
     *
     * This test ensures backwards compatibility and that the setting
     * actually controls the behavior.
     */
    const page = app.page;

    // Ensure setting is disabled (default)
    await runCommand(page, 'TaskNotes: Open settings');
    await page.waitForTimeout(1000);

    // Make sure auto-remove setting is OFF
    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Create tasks with blocking relationship and complete the blocker
    // Verify blockedBy is NOT auto-removed

    console.log('Backwards compatibility test - setting disabled preserves current behavior');

    // After implementation:
    // 1. Ensure setting is disabled
    // 2. Create Task A and Task B (blocked by A)
    // 3. Complete Task A
    // 4. Verify Task B's blockedBy still contains [[Task A]]
    // 5. Verify Task B does NOT appear in "blockedby isempty" filter
  });

  test.fixme('reproduces issue #1166 - should handle un-completing a blocker gracefully', async () => {
    /**
     * Edge case: What happens if a blocker is marked complete (removing blockedBy)
     * and then un-completed?
     *
     * Options:
     * 1. Don't restore the relationship (simpler, data already modified)
     * 2. Restore the relationship (more complex, requires tracking)
     *
     * Current expectation: Option 1 - once removed, relationships are gone.
     * Users would need to manually re-add if they un-complete a task.
     *
     * This test documents the expected behavior for this edge case.
     */
    const page = app.page;

    console.log('Un-completion edge case test');

    // After implementation:
    // 1. Create Task A blocking Task B
    // 2. Complete Task A (auto-removes blockedBy from Task B)
    // 3. Un-complete Task A
    // 4. Verify Task B's blockedBy is still empty (not restored)
    // 5. User must manually re-add [[Task A]] to Task B's blockedBy if desired
  });
});
