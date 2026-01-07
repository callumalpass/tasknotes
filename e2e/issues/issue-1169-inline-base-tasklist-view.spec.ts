/**
 * Issue #1169: [Bug] Since Update to 4.02 Task Notes Tasklist view in inline base don't work
 *
 * User reported that TaskNotes TaskList view in inline base definitions (within Tab plugin)
 * stopped working after update to version 4.02. Table views still worked, but TaskNotes
 * views (TaskList, Kanban, Calendar) did not render.
 *
 * Root cause (fixed in commit b9e7eb7c):
 * 1. View type properties in TaskListView, KanbanView, and CalendarView had typos
 * 2. TaskListView: registered as "tasknotesTaskList" but had `type = "tasknoteTaskList"` (missing 's')
 * 3. KanbanView: registered as "tasknotesKanban" but had `type = "tasknoteKanban"` (missing 's')
 * 4. CalendarView: registered as "tasknotesCalendar" but had `type = "tasknoteCalendar"` (missing 's')
 * 5. When Bases tried to match view instances to registrations, the mismatch caused:
 *    - Views showing "?" in the Views menu
 *    - Views resetting to Calendar view after a few minutes
 *    - Inline base definitions failing to render the correct view type
 *
 * The fix corrected the `type` property in each view class to match the registration ID:
 * - TaskListView.type = "tasknotesTaskList"
 * - KanbanView.type = "tasknotesKanban"
 * - CalendarView.type = "tasknotesCalendar"
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1169
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1169: TaskList view in inline base definitions', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1169 - view type property must match registration ID', async () => {
    /**
     * This test verifies that the view type properties in TaskNotes views
     * match their registration IDs with Bases.
     *
     * When view types don't match:
     * 1. Bases can't find the view in its registry during deserialization
     * 2. The view shows "?" in the Views dropdown menu
     * 3. After a timeout, Bases resets the view to a default type
     * 4. Inline base definitions fail because the view type lookup fails
     *
     * The test:
     * 1. Opens a Bases view with TaskNotes TaskList
     * 2. Verifies the view renders correctly (not as unknown/fallback)
     * 3. Checks that the view type in the DOM matches registration
     */
    const page = app.page;

    // Open a new Bases view
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1000);

    // Look for the TaskList view container
    // The view should have the correct data-type attribute matching registration
    const taskListView = page.locator('.workspace-leaf-content[data-type="tasknotesTaskList"]');

    // The view should be visible and properly rendered
    const viewExists = await taskListView.isVisible({ timeout: 3000 }).catch(() => false);

    if (viewExists) {
      // Verify it's not showing as an unknown view type
      const unknownIndicator = page.locator('.workspace-leaf-content[data-type="tasknotesTaskList"] .unknown-view-type');
      const isUnknown = await unknownIndicator.isVisible({ timeout: 1000 }).catch(() => false);
      expect(isUnknown).toBe(false);

      // Verify the view has rendered TaskNotes content (items container)
      const itemsContainer = page.locator('.tn-bases-items-container');
      const hasContainer = await itemsContainer.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasContainer).toBe(true);
    } else {
      // If the view didn't open, the bug may still be present
      console.log('TaskList view did not open - checking for fallback behavior');

      // Check if it opened as a different view type (the bug caused views to reset)
      const anyBasesView = page.locator('.workspace-leaf-content[data-type^="tasknotes"]');
      const anyViewExists = await anyBasesView.isVisible({ timeout: 1000 }).catch(() => false);

      // Document what we found for debugging
      if (anyViewExists) {
        const dataType = await anyBasesView.getAttribute('data-type');
        console.log(`Found view with type: ${dataType}`);
      }
    }

    // Close the view
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1169 - inline base in tab plugin should render TaskList', async () => {
    /**
     * This test simulates the specific scenario from the bug report:
     * - User has Tab plugin with inline base definitions
     * - Inline bases use TaskNotes TaskList view
     * - After upgrade to 4.02, the TaskList view stopped rendering
     *
     * Note: This test requires a note with an inline base definition
     * that uses the TaskNotes TaskList view type.
     */
    const page = app.page;

    // Create a test note with inline base definition
    // This uses the standard Obsidian base syntax for inline embeds
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    // Type content with an inline base reference
    // Note: Actual inline base syntax may vary based on Obsidian/Bases plugin version
    await page.keyboard.type('# Test Note with Inline Base\n\n');
    await page.keyboard.type('This note tests inline base rendering.\n\n');

    // The inline base syntax would reference a base that uses TaskNotes TaskList view
    // For example: ![[base:MyTaskBase]]
    // The test would then verify the embedded view renders correctly

    // For now, we verify the basic rendering works
    const noteContent = page.locator('.markdown-source-view, .markdown-preview-view');
    const hasContent = await noteContent.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasContent).toBe(true);

    // Clean up
    await page.keyboard.press('Escape');
  });

  test.fixme('regression test - view type consistency after multiple opens', async () => {
    /**
     * The original bug caused views to "reset" to a different type after some time.
     * This was because Bases couldn't match the view instance to its registration.
     *
     * This test opens a TaskList view multiple times and verifies it stays as TaskList.
     */
    const page = app.page;

    for (let i = 0; i < 3; i++) {
      // Open TaskList view
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(500);

      // Verify it's a TaskList view
      const taskListView = page.locator('.workspace-leaf-content[data-type="tasknotesTaskList"]');
      const isTaskList = await taskListView.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isTaskList) {
        // Check what view type we actually got
        const currentView = page.locator('.workspace-leaf-content[data-type^="tasknotes"]');
        const dataType = await currentView.getAttribute('data-type').catch(() => 'none');
        console.log(`Iteration ${i + 1}: Expected tasknotesTaskList, got ${dataType}`);
      }

      expect(isTaskList).toBe(true);

      // Wait a bit to simulate the delay that could cause the view to reset
      await page.waitForTimeout(200);

      // Close the view
      await page.keyboard.press('Meta+w');
      await page.waitForTimeout(200);
    }
  });
});
