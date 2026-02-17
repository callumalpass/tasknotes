/**
 * Issue #1601: [Bug]: Subtask lists appear twice requiring Obsidian restart
 *
 * Bug Description:
 * The RelationshipsDecorations widget (subtasks/relationships section shown inside
 * a task note in the editor, below the frontmatter) appears duplicated intermittently.
 * The duplicate persists until Obsidian is restarted or "Reload app without saving"
 * command is run.
 *
 * Root cause hypothesis:
 * Race condition in RelationshipsDecorations widget injection. Multiple code paths
 * can trigger widget injection concurrently:
 *
 * 1. Constructor calls injectWidget() immediately (line 149) - NOT debounced
 * 2. EVENT_TASK_CARD_INJECTED triggers debouncedInjectWidget() (line 185)
 * 3. 'settings-changed' event triggers debouncedInjectWidget() (line 191)
 * 4. File change in update() triggers debouncedInjectWidget() (line 160)
 *
 * The orphan cleanup logic at cleanupOrphanedWidgets() (lines 277-296) only
 * removes widgets that are !== this.currentWidget. If a duplicate is created
 * before currentWidget is updated, it won't be cleaned up.
 *
 * The bug persists until restart because:
 * - Orphaned widget DOM elements remain in the editor
 * - Component lifecycle state becomes desynchronized from DOM
 * - cleanupOrphanedWidgets only removes widgets !== currentWidget
 *
 * Related code:
 * - src/editor/RelationshipsDecorations.ts: Main widget injection
 *   - constructor (line 149): Immediate injection, not debounced
 *   - setupEventListeners (lines 181-193): Multiple event triggers
 *   - cleanupOrphanedWidgets (lines 277-296): Orphan detection
 *   - injectWidget (line 298): Async widget injection
 * - src/editor/TaskCardNoteDecorations.ts: Coordinates with relationships
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1601
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1601: Relationships widget appears twice in note editor', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1601 - relationships widget duplicates on rapid file switches', async () => {
    /**
     * This test attempts to reproduce the race condition by rapidly switching
     * between task notes, which could cause multiple injectWidget calls to
     * overlap before cleanup completes.
     *
     * Steps:
     * 1. Open a task note that has subtasks (project note)
     * 2. Verify relationships widget appears once
     * 3. Rapidly switch to another task note and back
     * 4. Check if duplicate widgets appear
     */
    const page = app.page;

    // Open task list view to find tasks
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card that is a project (has subtasks)
    const projectCard = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No project task cards visible - skipping test');
      return;
    }

    // Double-click to open the task note in the editor
    await projectCard.dblclick();
    await page.waitForTimeout(1500);

    // Check for the relationships widget in the editor
    const editor = page.locator('.markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });

    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    // Wait for widget to appear
    const widgetVisible = await relationshipsWidget.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!widgetVisible) {
      console.log('Relationships widget not visible - task may not have subtasks');
      return;
    }

    // Count initial widgets - should be exactly 1
    const initialCount = await relationshipsWidget.count();
    console.log(`Initial relationships widget count: ${initialCount}`);

    // Rapidly switch files to try to trigger the race condition
    // Go back to task list
    await page.keyboard.press('Escape');
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(200);

    // Find another task to open
    const anotherCard = page.locator('.task-card').nth(1);
    if (await anotherCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await anotherCard.dblclick();
      await page.waitForTimeout(100); // Very short - race condition timing

      // Quickly go back to original
      await page.keyboard.press('Escape');
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(100);
      await projectCard.dblclick();
      await page.waitForTimeout(100);
    }

    // Repeat rapid switching
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Tab'); // Switch tabs/panes
      await page.waitForTimeout(50);
      await page.keyboard.press('Control+Shift+Tab');
      await page.waitForTimeout(50);
    }

    // Wait for any pending async operations
    await page.waitForTimeout(1000);

    // Check for duplicates
    const finalCount = await relationshipsWidget.count();
    console.log(`Final relationships widget count: ${finalCount}`);

    if (finalCount > 1) {
      console.log(`BUG REPRODUCED: Found ${finalCount} relationships widgets instead of 1`);
    }

    // Should only ever have one relationships widget per view
    expect(finalCount).toBeLessThanOrEqual(1);
  });

  test.fixme('reproduces issue #1601 - widget duplicates when task card event fires during injection', async () => {
    /**
     * Tests the race condition between constructor injection and
     * EVENT_TASK_CARD_INJECTED event handler.
     *
     * The constructor at line 149 calls injectWidget() immediately (not debounced).
     * The event listener at line 183-185 calls debouncedInjectWidget() when
     * task card is injected. If both fire close together, duplicates can occur.
     */
    const page = app.page;

    // Open a task note directly via quick switcher
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Type to find a task note
      await page.keyboard.type('task', { delay: 30 });
      await page.waitForTimeout(500);

      // Select first result
      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
      }
    }

    // Check for relationships widget
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    await page.waitForTimeout(500);

    const count = await relationshipsWidget.count();
    console.log(`Relationships widget count after opening note: ${count}`);

    if (count > 1) {
      console.log('BUG: Multiple widgets after opening note via quick switcher');
    }

    expect(count).toBeLessThanOrEqual(1);
  });

  test.fixme('reproduces issue #1601 - widget duplicates persist after view mode toggle', async () => {
    /**
     * Toggling between Live Preview and Reading mode may create new widget
     * instances while old ones aren't properly cleaned up.
     *
     * RelationshipsDecorations.ts has separate handling:
     * - Live Preview: RelationshipsDecorationsPlugin class (ViewPlugin)
     * - Reading Mode: injectReadingModeWidget() function (lines 424-527)
     */
    const page = app.page;

    // Open task list and then a task note
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const projectCard = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No project task cards visible - skipping test');
      return;
    }

    await projectCard.dblclick();
    await page.waitForTimeout(1500);

    // Verify in Live Preview mode
    const livePreviewWidget = page.locator('.markdown-source-view .tasknotes-relationships-widget');
    const livePreviewCount = await livePreviewWidget.count();
    console.log(`Widget count in Live Preview: ${livePreviewCount}`);

    // Toggle to Reading mode
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(500);

    // Check widget in reading mode
    const readingWidget = page.locator('.markdown-preview-view .tasknotes-relationships-widget, .markdown-reading-view .tasknotes-relationships-widget');
    const readingCount = await readingWidget.count();
    console.log(`Widget count in Reading mode: ${readingCount}`);

    // Toggle back to Live Preview
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(500);

    // Check for duplicates after toggle
    const afterToggleWidget = page.locator('.tasknotes-relationships-widget');
    const afterToggleCount = await afterToggleWidget.count();
    console.log(`Widget count after toggling back: ${afterToggleCount}`);

    if (afterToggleCount > 1) {
      console.log('BUG: Widget duplicated after view mode toggle');
    }

    // Should have at most 1 widget visible at a time
    expect(afterToggleCount).toBeLessThanOrEqual(1);
  });

  test.fixme('reproduces issue #1601 - orphan cleanup misses duplicates', async () => {
    /**
     * The cleanupOrphanedWidgets() method at lines 277-296 only removes
     * widgets that are !== this.currentWidget. If a duplicate is created
     * before currentWidget is set, or if currentWidget points to wrong
     * instance, orphans won't be cleaned.
     *
     * This test verifies that multiple widgets don't accumulate over time.
     */
    const page = app.page;

    // Open a task note
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const projectCard = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No project task cards visible - skipping test');
      return;
    }

    await projectCard.dblclick();
    await page.waitForTimeout(1500);

    // Record baseline widget count
    let widgetCount = await page.locator('.tasknotes-relationships-widget').count();
    console.log(`Baseline widget count: ${widgetCount}`);

    // Trigger various events that could cause re-injection
    // 1. Settings change event
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    widgetCount = await page.locator('.tasknotes-relationships-widget').count();
    console.log(`Widget count after settings open/close: ${widgetCount}`);

    // 2. Layout change - resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);

    widgetCount = await page.locator('.tasknotes-relationships-widget').count();
    console.log(`Widget count after viewport resize: ${widgetCount}`);

    // 3. Active leaf change - click different panes
    const workspace = page.locator('.workspace');
    await workspace.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(200);

    widgetCount = await page.locator('.tasknotes-relationships-widget').count();
    console.log(`Final widget count: ${widgetCount}`);

    if (widgetCount > 1) {
      console.log(`BUG: ${widgetCount} widgets accumulated instead of 1`);
    }

    expect(widgetCount).toBeLessThanOrEqual(1);
  });

  test.fixme('reproduces issue #1601 - duplicate persists until reload', async () => {
    /**
     * The user reports that duplicates persist until "Reload app without saving"
     * or full restart. This test documents that once a duplicate occurs,
     * normal operations don't clean it up.
     */
    const page = app.page;

    // Open a task note
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const projectCard = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No project task cards visible - skipping test');
      return;
    }

    await projectCard.dblclick();
    await page.waitForTimeout(1500);

    // Check current state
    let widgetCount = await page.locator('.tasknotes-relationships-widget').count();
    const hasMultiple = widgetCount > 1;

    if (hasMultiple) {
      console.log(`Found ${widgetCount} widgets - attempting cleanup operations`);

      // Try various cleanup operations that should work but don't
      // 1. Close and reopen the file
      await page.keyboard.press('Control+w');
      await page.waitForTimeout(500);
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(500);
      await projectCard.dblclick();
      await page.waitForTimeout(1000);

      widgetCount = await page.locator('.tasknotes-relationships-widget').count();
      console.log(`Widget count after close/reopen: ${widgetCount}`);

      // 2. Switch to different view and back
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(500);
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(500);
      await projectCard.dblclick();
      await page.waitForTimeout(1000);

      widgetCount = await page.locator('.tasknotes-relationships-widget').count();
      console.log(`Widget count after view switch: ${widgetCount}`);

      // 3. Refresh cache
      await runCommand(page, 'TaskNotes: Refresh cache');
      await page.waitForTimeout(1000);

      widgetCount = await page.locator('.tasknotes-relationships-widget').count();
      console.log(`Widget count after cache refresh: ${widgetCount}`);

      // If still duplicated, this confirms the bug persists until reload
      if (widgetCount > 1) {
        console.log('CONFIRMED: Duplicate persists through normal cleanup operations');
        console.log('User must use "Reload app without saving" or restart Obsidian');
      }
    }

    // After all cleanup attempts, should have at most 1 widget
    expect(widgetCount).toBeLessThanOrEqual(1);
  });

  test.fixme('reproduces issue #1601 - multiple editor panes cause widget accumulation', async () => {
    /**
     * ViewPlugin instances are created per editor view. If user opens
     * the same note in multiple panes, or splits the editor, multiple
     * plugin instances exist and could interfere with each other's
     * cleanup logic.
     */
    const page = app.page;

    // Open a task note
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const projectCard = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No project task cards visible - skipping test');
      return;
    }

    await projectCard.dblclick();
    await page.waitForTimeout(1500);

    // Split the editor to create multiple panes with same file
    await runCommand(page, 'Split right');
    await page.waitForTimeout(500);

    // Count widgets across all panes
    // Each pane should have its own widget, but no pane should have duplicates
    const allWidgets = await page.locator('.tasknotes-relationships-widget').count();
    const workspaceLeaves = await page.locator('.workspace-leaf').count();

    console.log(`Total widgets: ${allWidgets}, Total leaves: ${workspaceLeaves}`);

    // Check individual panes for duplicates
    const leaves = page.locator('.workspace-leaf');
    const leafCount = await leaves.count();

    for (let i = 0; i < leafCount; i++) {
      const leaf = leaves.nth(i);
      const widgetsInLeaf = await leaf.locator('.tasknotes-relationships-widget').count();

      if (widgetsInLeaf > 1) {
        console.log(`BUG: Leaf ${i} has ${widgetsInLeaf} widgets (should be 0 or 1)`);
      }

      // Each leaf should have at most 1 widget
      expect(widgetsInLeaf).toBeLessThanOrEqual(1);
    }

    // Close the split pane
    await runCommand(page, 'Close this tab group');
    await page.waitForTimeout(500);
  });
});
