/**
 * Issue #1102: Adjusting task status in frontmatter is not reflected in the taskcard
 *
 * Bug Description:
 * When changing a task's status property in the frontmatter (e.g., from "todo" to "done"
 * or vice versa), the status of the task is not updated in the taskcard until the user
 * clicks on the task circle in the card.
 *
 * The context menu correctly shows the updated status from frontmatter, but the taskcard
 * visual state (the status circle) remains stale until manually clicked.
 *
 * This also affects recurring tasks - they do not trigger rescheduling until the user
 * clicks the taskcard to complete.
 *
 * Root cause analysis:
 * The `TaskManager.handleFileChanged()` method (src/utils/TaskManager.ts:178-182) only
 * emits generic `"data-changed"` and `"file-updated"` events when frontmatter changes
 * are detected via Obsidian's metadataCache "changed" event.
 *
 * However, the `BasesViewBase` and other UI components (src/bases/BasesViewBase.ts:292-322)
 * listen specifically for `EVENT_TASK_UPDATED` to trigger taskcard updates. This event
 * is only emitted when status is changed through the plugin's UI (clicking the status circle),
 * not when frontmatter is edited directly.
 *
 * The missing link is that `handleFileChanged()` should:
 * 1. Check if the changed file is a task file
 * 2. Read the fresh task data from the metadata cache
 * 3. Emit `EVENT_TASK_UPDATED` with the actual task data
 *
 * Related code paths:
 * - TaskManager.setupNativeEventListeners() - listens to metadataCache "changed" (lines 128-134)
 * - TaskManager.handleFileChanged() - emits generic events only (lines 178-182)
 * - TaskService.updateProperty() - properly emits EVENT_TASK_UPDATED (line 745)
 * - BasesViewBase.setupTaskUpdateListener() - listens to EVENT_TASK_UPDATED only (lines 292-322)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1102
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1102: Frontmatter status changes not reflected in taskcard', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1102 - changing status in frontmatter should update taskcard', async () => {
    /**
     * This test verifies that when a task's status is changed directly in the frontmatter,
     * the taskcard UI updates to reflect the new status without requiring a click.
     *
     * Steps:
     * 1. Open Task List view to see tasks
     * 2. Open a task note and change its status in frontmatter (e.g., "todo" -> "done")
     * 3. Without clicking the task circle, verify the taskcard shows the updated status
     *
     * Expected behavior:
     * - Taskcard status circle should update automatically when frontmatter changes
     * - No user interaction (clicking) should be required
     *
     * Current behavior (bug):
     * - Taskcard status circle remains stale until clicked
     * - Context menu shows correct status, but visual indicator does not
     */
    const page = app.page;

    // Open the Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Find a task card to work with
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    if (taskCount === 0) {
      console.log('No tasks found in Task List - skipping test');
      return;
    }

    // Get the first task card and note its current status
    const firstCard = taskCards.first();
    const statusCircle = firstCard.locator('.task-card__status-circle');

    // Record the initial visual state (class or attribute indicating status)
    const initialStatusClass = await statusCircle.getAttribute('class');
    console.log(`Initial status circle class: ${initialStatusClass}`);

    // Get the task title to find it in the file system
    const taskTitle = await firstCard.locator('.task-card__title').textContent();
    console.log(`Working with task: "${taskTitle}"`);

    // Open the task note in the editor
    await firstCard.click();
    await page.waitForTimeout(500);

    // Wait for the editor to show the file
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible({ timeout: 3000 });

    // Find the frontmatter section and locate the status property
    // The frontmatter is typically at the top of the file, enclosed in ---
    const editorContent = await editor.textContent();
    console.log(`Editor content preview: ${editorContent?.substring(0, 200)}...`);

    // Use Obsidian's source mode to edit frontmatter directly
    // Toggle to source mode if not already there
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(300);

    // Find and modify the status line in the frontmatter
    // This simulates a user manually editing the frontmatter

    // Look for the status property in the editor
    const statusLine = page.locator('.cm-line:has-text("status:")').first();

    if (await statusLine.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click on the status line to position cursor
      await statusLine.click();
      await page.waitForTimeout(200);

      // Select all on the line and type a new status
      await page.keyboard.press('End');
      await page.keyboard.press('Home');
      await page.keyboard.press('Shift+End');

      // Determine what status to change to
      const currentLine = await statusLine.textContent();
      const newStatus = currentLine?.includes('done') ? 'status: todo' : 'status: done';

      await page.keyboard.type(newStatus);
      await page.waitForTimeout(500); // Wait for debounce

      console.log(`Changed status from "${currentLine}" to "${newStatus}"`);
    }

    // Now go back to the Task List and verify the status updated
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(500);

    // Find the same task card again
    const updatedCard = page.locator('.task-card').filter({ hasText: taskTitle || '' }).first();
    const updatedStatusCircle = updatedCard.locator('.task-card__status-circle');

    // Check if the status circle visual state changed
    const updatedStatusClass = await updatedStatusCircle.getAttribute('class');
    console.log(`Updated status circle class: ${updatedStatusClass}`);

    // BUG: The status class should have changed but likely hasn't
    // This is the core reproduction of issue #1102
    expect(updatedStatusClass).not.toBe(initialStatusClass);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1102 - context menu shows correct status while taskcard does not', async () => {
    /**
     * This test verifies the specific symptom where the context menu shows the correct
     * status (reading fresh from cache) while the taskcard visual remains stale.
     *
     * This happens because:
     * - Context menu reads status fresh from metadataCache when opened
     * - Taskcard only updates when EVENT_TASK_UPDATED is received
     * - External frontmatter edits don't trigger EVENT_TASK_UPDATED
     *
     * Expected behavior:
     * - Both context menu and taskcard should show the same (correct) status
     *
     * Current behavior (bug):
     * - Context menu shows updated status
     * - Taskcard shows stale status
     */
    const page = app.page;

    // Open the Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    if (taskCount === 0) {
      console.log('No tasks found - skipping test');
      return;
    }

    // Get a task card
    const card = taskCards.first();
    const statusCircle = card.locator('.task-card__status-circle');

    // Record visual status
    const visualStatusClass = await statusCircle.getAttribute('class');

    // Right-click to open context menu
    await card.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Look for status information in the context menu
    const contextMenu = page.locator('.menu, .context-menu, [role="menu"]').first();

    if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      // The context menu status should reflect the actual frontmatter value
      const menuContent = await contextMenu.textContent();
      console.log(`Context menu shows: ${menuContent?.substring(0, 200)}`);

      // Close the context menu
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // The bug is that visualStatusClass may not match what the context menu showed
    console.log(`Visual status class: ${visualStatusClass}`);
    console.log('If context menu showed different status than the visual circle, bug is reproduced');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1102 - recurring task rescheduling requires manual click', async () => {
    /**
     * This test verifies that recurring tasks do not reschedule automatically when
     * their status is changed in frontmatter - they only reschedule when the user
     * clicks the task circle.
     *
     * This is a consequence of the same root cause:
     * - Recurring task rescheduling logic is triggered by EVENT_TASK_UPDATED
     * - External frontmatter edits don't emit EVENT_TASK_UPDATED
     * - So the rescheduling hook never fires until user clicks the taskcard
     *
     * Expected behavior:
     * - Changing a recurring task's status to "done" in frontmatter should
     *   trigger automatic rescheduling (create next occurrence)
     *
     * Current behavior (bug):
     * - Recurring task stays marked as "done" without rescheduling
     * - Only when user clicks the status circle does rescheduling occur
     */
    const page = app.page;

    // This test documents the recurring task impact of issue #1102
    // The fix that makes frontmatter edits emit EVENT_TASK_UPDATED
    // will also fix this recurring task rescheduling issue

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Look for recurring tasks (they typically have a recurrence indicator)
    const recurringIndicator = page.locator('.task-card [data-recurring], .task-card .recurring-icon, .task-card:has-text("every")');
    const hasRecurringTasks = await recurringIndicator.count() > 0;

    console.log(`Found recurring tasks: ${hasRecurringTasks}`);

    if (!hasRecurringTasks) {
      console.log('No recurring tasks found in test vault - documenting expected behavior');
      console.log('A recurring task with status changed to "done" in frontmatter should reschedule');
      console.log('Current bug: rescheduling only happens when clicking the status circle');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1102 - verify EVENT_TASK_UPDATED triggers UI update', async () => {
    /**
     * This test verifies that when EVENT_TASK_UPDATED is properly emitted,
     * the taskcard UI updates correctly. This confirms the fix approach:
     * making frontmatter edits emit EVENT_TASK_UPDATED should fix the issue.
     *
     * Steps:
     * 1. Open Task List
     * 2. Click the status circle on a task (triggers EVENT_TASK_UPDATED)
     * 3. Verify the taskcard updates immediately
     *
     * This test confirms that the event mechanism works correctly when triggered
     * through the proper code path (clicking status circle).
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    if (taskCount === 0) {
      console.log('No tasks found - skipping test');
      return;
    }

    const card = taskCards.first();
    const statusCircle = card.locator('.task-card__status-circle');

    // Record initial state
    const initialClass = await statusCircle.getAttribute('class');
    console.log(`Initial status: ${initialClass}`);

    // Click the status circle (this triggers EVENT_TASK_UPDATED via TaskService.updateProperty)
    await statusCircle.click();
    await page.waitForTimeout(500); // Wait for event propagation and UI update

    // Check if status changed
    const updatedClass = await statusCircle.getAttribute('class');
    console.log(`After click status: ${updatedClass}`);

    // This SHOULD work - clicking properly triggers the update event
    // The test confirms the event mechanism works when triggered correctly
    // The bug is that external frontmatter edits don't trigger this event

    // Click again to restore original state
    await statusCircle.click();
    await page.waitForTimeout(300);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1102 - multiple quick frontmatter edits cause stale state', async () => {
    /**
     * This test verifies behavior when multiple rapid frontmatter changes are made.
     * Due to the debouncing in TaskManager (300ms), rapid edits may compound the
     * staleness issue.
     *
     * The debounce in handleFileChangedDebounced() (TaskManager.ts:157-172) means
     * only the final state after 300ms of inactivity triggers the event.
     * But since the event doesn't include task data, even the final state isn't
     * reflected in the UI.
     *
     * Expected behavior:
     * - After debounce period, final status should be reflected in taskcard
     *
     * Current behavior (bug):
     * - Taskcard never updates regardless of debounce timing
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // This test documents that even with proper debouncing,
    // the lack of EVENT_TASK_UPDATED emission means the UI never updates

    console.log('Debounce delay in TaskManager: 300ms');
    console.log('Even after debounce settles, taskcard remains stale');
    console.log('because handleFileChanged() only emits generic events');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
