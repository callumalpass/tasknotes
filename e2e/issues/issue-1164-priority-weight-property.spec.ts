/**
 * Issue #1164: [FR] Add priority weight back in (if possible)
 *
 * Feature request to add a computed property called `priorityWeight` that
 * exposes the numeric weight from the priority sort order configuration.
 *
 * Requested behavior:
 * - New computed property `priorityWeight` (similar to `totalTrackedTime`)
 * - Pulls weight from the sort order of priorities configured in settings
 * - Enables sorting by `priorityWeight` without needing to rename priorities
 * - Weight values come from PriorityConfig.weight (e.g., none=0, low=1, normal=2, high=3)
 *
 * Implementation notes:
 * - PriorityConfig already has `weight: number` property (src/types.ts:699)
 * - PriorityManager.getPriorityWeight() already returns the weight value
 * - Similar pattern to totalTrackedTime: computed in TaskManager, exposed on TaskInfo
 * - Would need to add `priorityWeight` to TaskInfo interface
 * - Add to propertyHelpers.ts as computed property (like totalTrackedTime)
 * - Enable as a sortable/groupable property in FilterService
 *
 * Benefits:
 * - Users can sort by priority weight without modifying priority labels
 * - Consistent numeric sorting regardless of priority naming conventions
 * - Can be used in Bases formulas for weighted calculations
 *
 * Affected areas:
 * - src/types.ts (add priorityWeight to TaskInfo)
 * - src/utils/TaskManager.ts (compute priorityWeight from priority)
 * - src/utils/propertyHelpers.ts (add as available property)
 * - src/services/FilterService.ts (add as sort/group key)
 * - src/types.ts TaskSortKey type (add "priorityWeight")
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1164
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1164: Priority Weight Computed Property', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1164 - tasks should expose priorityWeight property', async () => {
    /**
     * This test verifies that tasks have a computed `priorityWeight` property
     * that reflects the numeric weight from their priority configuration.
     *
     * Expected behavior after implementation:
     * - Task with priority "high" (weight: 3) → priorityWeight: 3
     * - Task with priority "normal" (weight: 2) → priorityWeight: 2
     * - Task with priority "low" (weight: 1) → priorityWeight: 1
     * - Task with priority "none" (weight: 0) → priorityWeight: 0
     *
     * Currently: priorityWeight property does not exist on TaskInfo.
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(2000);

    // Locate the task list
    const taskList = page.locator('.task-list-view');
    await taskList.waitFor({ timeout: 10000 });

    // Find tasks with different priorities
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    if (taskCount > 0) {
      console.log(`Found ${taskCount} tasks`);

      // Look for priority indicators to verify priorities exist
      const priorityIndicators = page.locator('.task-card__priority-indicator, .priority-indicator');
      const hasPriorityIndicators = await priorityIndicators.first().isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Priority indicators visible: ${hasPriorityIndicators}`);

      // After implementation, tasks should have priorityWeight accessible
      // Could be displayed via property display settings or used for sorting
    }

    // Currently: No priorityWeight property exists
    // After implementation: TaskInfo.priorityWeight should be populated
  });

  test.fixme('reproduces issue #1164 - should be able to sort by priorityWeight', async () => {
    /**
     * This test verifies that users can sort tasks by the priorityWeight
     * property, which provides numeric sorting based on priority weight.
     *
     * Expected behavior after implementation:
     * - Sort ascending: none (0), low (1), normal (2), high (3)
     * - Sort descending: high (3), normal (2), low (1), none (0)
     *
     * This differs from sorting by "priority" which sorts by string name
     * or may already use weight internally but isn't exposed as a property.
     *
     * Currently: "priorityWeight" is not available as a sort key.
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(2000);

    // Locate the task list
    const taskList = page.locator('.task-list-view');
    await taskList.waitFor({ timeout: 10000 });

    // Try to access sort options
    const sortButton = page.locator('[data-testid="sort-button"], .sort-button, button:has-text("Sort")');
    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(500);

      // Look for sort menu/dropdown
      const sortMenu = page.locator('.menu, .dropdown-menu, .sort-menu');
      if (await sortMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Check if priorityWeight is an option
        const priorityWeightOption = sortMenu.locator('text=/priority.*weight/i');
        const hasPriorityWeightSort = await priorityWeightOption.isVisible({ timeout: 500 }).catch(() => false);

        console.log(`Priority weight sort option available: ${hasPriorityWeightSort}`);

        // Close menu
        await page.keyboard.press('Escape');
      }
    }

    // Currently: priorityWeight is not a valid TaskSortKey
    // After implementation: Should be available in sort options
  });

  test.fixme('reproduces issue #1164 - priorityWeight should be available as display property', async () => {
    /**
     * This test verifies that priorityWeight can be selected as a
     * displayable property on task cards/list items.
     *
     * Expected behavior after implementation:
     * - priorityWeight appears in property selection dropdown
     * - When enabled, shows numeric weight (e.g., "3" for high priority)
     * - Similar to how totalTrackedTime is a computed display property
     *
     * Currently: priorityWeight is not in the available properties list.
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(2000);

    // Locate the task list
    const taskList = page.locator('.task-list-view');
    await taskList.waitFor({ timeout: 10000 });

    // Try to open view settings/property display configuration
    const viewSettingsButton = page.locator('.task-list-view__actions button, [aria-label*="settings"], [aria-label*="options"]');
    if (await viewSettingsButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewSettingsButton.first().click();
      await page.waitForTimeout(500);

      // Look for property selection in settings
      const propertyOption = page.locator('text=/priority.*weight/i');
      const hasPriorityWeightProperty = await propertyOption.isVisible({ timeout: 1000 }).catch(() => false);

      console.log(`Priority weight in property options: ${hasPriorityWeightProperty}`);

      // Close settings
      await page.keyboard.press('Escape');
    }

    // Currently: priorityWeight not listed in propertyHelpers.getAvailableProperties()
    // After implementation: Should be listed alongside totalTrackedTime as computed property
  });

  test.fixme('reproduces issue #1164 - priorityWeight should work in Bases formulas', async () => {
    /**
     * This test verifies that priorityWeight can be used in Bases
     * formula calculations for weighted task scoring.
     *
     * Example use case:
     * - Formula: `priorityWeight * 10 + (daysUntilDue < 0 ? 50 : 0)`
     * - Creates a weighted urgency score combining priority and overdue status
     *
     * Currently: priorityWeight is not exposed for formula access.
     */
    const page = app.page;

    // Open a Bases view that uses formulas
    // This would require a pre-configured test vault with Bases
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(2000);

    // Check if Bases functionality is available
    const basesIndicator = page.locator('.bases-view, [data-view-type="bases"]');
    const hasBasesView = await basesIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Bases view available: ${hasBasesView}`);

    // After implementation:
    // - priorityWeight should be accessible in Bases formulas
    // - Formula like `task.priorityWeight` should return the numeric weight
    // - Can be used for custom scoring/sorting calculations
  });

  test.fixme('reproduces issue #1164 - priorityWeight should reflect custom priority weights', async () => {
    /**
     * This test verifies that priorityWeight correctly reflects
     * user-configured custom priority weights from settings.
     *
     * Users can customize priority weights in settings:
     * - Drag-drop reordering changes weight values
     * - Custom priorities may have any weight value
     *
     * Expected behavior:
     * - priorityWeight matches the weight configured in settings
     * - Changes to priority weights are reflected in priorityWeight
     *
     * Currently: priorityWeight property does not exist.
     */
    const page = app.page;

    // Open plugin settings to check priority configuration
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    // Navigate to TaskNotes settings
    const tasknotesSetting = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
    if (await tasknotesSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tasknotesSetting.click();
      await page.waitForTimeout(500);

      // Look for priority configuration section
      const prioritySection = page.locator('text=/priorities/i');
      if (await prioritySection.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Found priority configuration section');

        // The settings show priorities sorted by weight
        // Each priority has a weight value used for sorting
        // priorityWeight should expose this configured weight
      }
    }

    // Close settings
    await page.keyboard.press('Escape');

    // After implementation:
    // - priorityWeight should match PriorityConfig.weight from settings
    // - When user reorders priorities, weights update automatically
    // - priorityWeight on tasks should reflect current weight configuration
  });
});
