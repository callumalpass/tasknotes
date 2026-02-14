/**
 * Issue #1601: [Bug]: Subtask lists appear twice requiring Obsidian restart
 *
 * Bug Description:
 * Intermittently (every few days), subtask lists appear duplicated in task cards.
 * The duplicates persist until Obsidian is restarted or "Reload app without saving"
 * command is run.
 *
 * Root cause hypothesis:
 * Async race condition in subtask rendering. The `toggleSubtasks()` function in
 * src/ui/TaskCard.ts is called asynchronously (fire-and-forget) from multiple places:
 *
 * 1. `createTaskCard()` at line 1571-1575: Calls toggleSubtasks without awaiting
 * 2. `updateTaskCard()` at line 2083-2087: Also calls toggleSubtasks without awaiting
 * 3. `refreshParentTaskSubtasks()` at line 2612: Awaits toggleSubtasks
 *
 * When `updateTaskCard()` is triggered while a previous `toggleSubtasks()` is still
 * running (async operation fetching subtasks), both calls can end up appending
 * subtask containers to the same card, causing duplicates.
 *
 * The bug persists until restart because:
 * - The ExpandedProjectsService maintains in-memory state
 * - DOM elements with duplicate containers aren't cleaned up properly
 * - Only a full app reload clears the state and rebuilds DOM fresh
 *
 * Contributing factors:
 * - toggleSubtasks() checks for existing container but the check and append
 *   aren't atomic with respect to concurrent calls
 * - Multiple rapid view updates can queue multiple toggleSubtasks calls
 * - The in-memory Set in ExpandedProjectsService doesn't track pending operations
 *
 * Related code:
 * - src/ui/TaskCard.ts: toggleSubtasks(), createTaskCard(), updateTaskCard()
 * - src/services/ExpandedProjectsService.ts: In-memory expansion state
 * - src/utils/DOMReconciler.ts: DOM update handling
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1601
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1601: Subtask lists appear twice requiring Obsidian restart', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1601 - rapid view updates cause duplicate subtask containers', async () => {
    /**
     * This test attempts to reproduce the race condition by rapidly triggering
     * view updates while subtasks are expanded.
     *
     * Steps to reproduce:
     * 1. Open task list view
     * 2. Find a task with subtasks (project task)
     * 3. Expand the subtasks
     * 4. Rapidly trigger view updates (filter changes, sort changes, etc.)
     * 5. Check if duplicate subtask containers appear
     *
     * The intermittent nature of this bug makes it hard to reproduce reliably,
     * but this test documents the expected behavior and race condition scenario.
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card with the chevron indicator (has subtasks)
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    // Click the chevron to expand subtasks
    const chevron = taskCardWithSubtasks.locator('.task-card__chevron').first();
    await chevron.click();
    await page.waitForTimeout(500);

    // Wait for subtasks to load
    const subtasksContainer = taskCardWithSubtasks.locator('.task-card__subtasks');
    await expect(subtasksContainer).toBeVisible({ timeout: 5000 });

    // Count initial subtask containers - should be exactly 1
    const initialContainerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();
    console.log(`Initial subtask container count: ${initialContainerCount}`);

    // Attempt to trigger the race condition by rapidly causing view updates
    // This simulates the conditions that can cause the bug
    for (let i = 0; i < 5; i++) {
      // Trigger a view refresh by toggling something
      // Click elsewhere to potentially trigger card updates
      await page.locator('.tasknotes-plugin').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(50); // Very short delay to cause race

      // Re-click the area near the task to trigger potential re-renders
      const cardBox = await taskCardWithSubtasks.boundingBox();
      if (cardBox) {
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 10);
      }
      await page.waitForTimeout(50);
    }

    // Wait for any pending async operations
    await page.waitForTimeout(500);

    // Check for duplicate subtask containers
    const finalContainerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();
    console.log(`Final subtask container count: ${finalContainerCount}`);

    if (finalContainerCount > 1) {
      console.log('BUG REPRODUCED: Multiple subtask containers detected');
    }

    // There should only ever be one subtasks container per card
    expect(finalContainerCount).toBe(1);
  });

  test.fixme('reproduces issue #1601 - concurrent toggleSubtasks calls cause duplicates', async () => {
    /**
     * This test simulates the scenario where createTaskCard and updateTaskCard
     * both call toggleSubtasks concurrently for the same expanded task.
     *
     * The bug occurs when:
     * 1. User expands subtasks (toggleSubtasks starts async operation)
     * 2. Before async completes, view updates → updateTaskCard called
     * 3. updateTaskCard sees isExpanded=true, calls toggleSubtasks again
     * 4. Both calls try to append subtask containers → duplicates
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find multiple task cards with subtasks to test concurrent updates
    const taskCardsWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    });

    const count = await taskCardsWithSubtasks.count();
    if (count < 1) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    // Expand subtasks on the first card
    const firstCard = taskCardsWithSubtasks.first();
    const chevron = firstCard.locator('.task-card__chevron').first();
    await chevron.click();

    // Immediately trigger operations that could cause updateTaskCard to be called
    // while the initial toggleSubtasks is still pending
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');

    // Very rapid interactions to try to catch the race condition
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 10);
      await page.waitForTimeout(20);
      await page.mouse.wheel(0, -10);
      await page.waitForTimeout(20);
    }

    // Wait for async operations to complete
    await page.waitForTimeout(1000);

    // Check for duplicates
    const subtaskContainers = await firstCard.locator('.task-card__subtasks').count();

    if (subtaskContainers > 1) {
      console.log(`BUG REPRODUCED: Found ${subtaskContainers} subtask containers instead of 1`);

      // Additional diagnostic: count total subtask cards
      const subtaskCards = await firstCard.locator('.task-card__subtasks .task-card').count();
      console.log(`Total subtask cards rendered: ${subtaskCards}`);
    }

    expect(subtaskContainers).toBe(1);
  });

  test.fixme('reproduces issue #1601 - refreshParentTaskSubtasks causes duplicates on subtask edit', async () => {
    /**
     * When a subtask is edited, refreshParentTaskSubtasks() is called which
     * triggers toggleSubtasks() on the parent card. If the parent already has
     * a pending toggleSubtasks operation, this can cause duplicates.
     *
     * Steps:
     * 1. Expand a project task's subtasks
     * 2. Edit one of the subtasks (e.g., change status)
     * 3. This triggers refreshParentTaskSubtasks()
     * 4. Check if duplicate containers appear
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    // Expand subtasks
    const chevron = taskCardWithSubtasks.locator('.task-card__chevron').first();
    await chevron.click();
    await page.waitForTimeout(1000);

    // Find a subtask to edit
    const subtaskCard = taskCardWithSubtasks.locator('.task-card__subtasks .task-card').first();

    if (!await subtaskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('No subtasks visible - skipping test');
      return;
    }

    // Record initial state
    const initialContainerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();

    // Click the checkbox on the subtask to toggle its status
    // This should trigger a cache update and refreshParentTaskSubtasks
    const checkbox = subtaskCard.locator('.task-card__checkbox, input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(100);

      // Quickly click again to toggle back (rapid status changes)
      await checkbox.click();
      await page.waitForTimeout(100);

      await checkbox.click();
    }

    // Wait for refresh operations
    await page.waitForTimeout(1000);

    // Check for duplicates
    const finalContainerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();

    if (finalContainerCount > initialContainerCount) {
      console.log(`BUG REPRODUCED: Container count increased from ${initialContainerCount} to ${finalContainerCount}`);
    }

    expect(finalContainerCount).toBe(1);
  });

  test.fixme('reproduces issue #1601 - expand/collapse rapid toggle causes duplicate containers', async () => {
    /**
     * Rapidly expanding and collapsing subtasks can cause the async operations
     * to interleave incorrectly, potentially leaving duplicate containers.
     *
     * This tests the scenario where:
     * 1. User clicks expand (toggleSubtasks starts with expanded=true)
     * 2. User quickly clicks collapse (toggleSubtasks with expanded=false)
     * 3. User clicks expand again before first operation completes
     * 4. Multiple container appends could occur
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    const chevron = taskCardWithSubtasks.locator('.task-card__chevron').first();

    // Rapidly toggle expand/collapse multiple times
    for (let i = 0; i < 5; i++) {
      await chevron.click(); // Expand
      await page.waitForTimeout(30); // Very short - operations still pending
      await chevron.click(); // Collapse
      await page.waitForTimeout(30);
    }

    // End in expanded state
    await chevron.click();
    await page.waitForTimeout(1000);

    // Check for duplicates
    const containerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();

    if (containerCount > 1) {
      console.log(`BUG REPRODUCED: ${containerCount} subtask containers after rapid toggling`);
    }

    // Should have exactly 0 or 1 containers, never more
    expect(containerCount).toBeLessThanOrEqual(1);
  });

  test.fixme('reproduces issue #1601 - duplicate content within single container', async () => {
    /**
     * The screenshots in the issue show duplicate subtask CONTENT appearing,
     * which could be caused by toggleSubtasks clearing and re-adding content
     * but not the container itself when concurrent calls happen.
     *
     * toggleSubtasks() at line 2367-2369 clears content:
     *   while (subtasksContainer.firstChild) {
     *     subtasksContainer.removeChild(subtasksContainer.firstChild);
     *   }
     *
     * But if two concurrent calls both get past the container check,
     * both could append subtask cards to the same container.
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    // Expand subtasks
    const chevron = taskCardWithSubtasks.locator('.task-card__chevron').first();
    await chevron.click();
    await page.waitForTimeout(1000);

    // Count the actual subtask cards
    const subtasksContainer = taskCardWithSubtasks.locator('.task-card__subtasks').first();
    if (!await subtasksContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Subtasks container not visible');
      return;
    }

    const subtaskCards = subtasksContainer.locator('.task-card--subtask');
    const initialCount = await subtaskCards.count();
    console.log(`Initial subtask card count: ${initialCount}`);

    // Try to trigger a refresh that could cause duplicates
    // Simulate what might happen with cache updates or view refreshes
    await runCommand(page, 'TaskNotes: Refresh cache');
    await page.waitForTimeout(500);

    // Check if subtask count doubled (indicating duplicates)
    const finalCount = await subtaskCards.count();
    console.log(`Final subtask card count: ${finalCount}`);

    if (finalCount > initialCount && finalCount === initialCount * 2) {
      console.log('BUG REPRODUCED: Subtask cards doubled, indicating duplicate rendering');
    }

    // Each subtask should appear exactly once
    // Get unique task paths to verify
    const taskPaths = await subtaskCards.evaluateAll((cards) =>
      cards.map((card) => (card as HTMLElement).dataset.taskPath)
    );

    const uniquePaths = new Set(taskPaths);
    if (uniquePaths.size < taskPaths.length) {
      console.log('BUG: Duplicate task paths found in subtask list');
      console.log('Total cards:', taskPaths.length);
      console.log('Unique paths:', uniquePaths.size);
    }

    // All rendered subtasks should be unique
    expect(taskPaths.length).toBe(uniquePaths.size);
  });

  test.fixme('reproduces issue #1601 - state persists incorrectly after bug occurs', async () => {
    /**
     * The user reports that the duplicate state persists until app restart.
     * This suggests that the ExpandedProjectsService state or DOM state
     * becomes corrupted and isn't properly cleaned up.
     *
     * This test verifies that collapsing and re-expanding cleans up properly.
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    const chevron = taskCardWithSubtasks.locator('.task-card__chevron').first();

    // Expand subtasks
    await chevron.click();
    await page.waitForTimeout(1000);

    // Check initial state
    let containerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();
    console.log(`Container count after expand: ${containerCount}`);

    // Collapse subtasks
    await chevron.click();
    await page.waitForTimeout(500);

    // Containers should be completely removed when collapsed
    containerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();
    console.log(`Container count after collapse: ${containerCount}`);
    expect(containerCount).toBe(0);

    // Re-expand
    await chevron.click();
    await page.waitForTimeout(1000);

    // Should have exactly one container again
    containerCount = await taskCardWithSubtasks.locator('.task-card__subtasks').count();
    console.log(`Container count after re-expand: ${containerCount}`);
    expect(containerCount).toBe(1);

    // Navigate away and back
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find the same card again (it may have been re-rendered)
    const taskCardAfterNav = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron--expanded'),
    }).first();

    if (await taskCardAfterNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      // If still expanded, check for duplicates
      containerCount = await taskCardAfterNav.locator('.task-card__subtasks').count();
      console.log(`Container count after navigation: ${containerCount}`);

      if (containerCount > 1) {
        console.log('BUG: Duplicates persisted through view navigation');
      }

      expect(containerCount).toBeLessThanOrEqual(1);
    }
  });
});
