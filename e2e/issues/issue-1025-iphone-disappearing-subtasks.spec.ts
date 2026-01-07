/**
 * Issue #1025: [Bug]: Disappearing subtasks in TaskNote
 *
 * Bug description:
 * Sometimes the subtasks section within a TaskNote (in the actual note below properties)
 * disappears on iPhone, and sometimes they show up. It is inconsistent.
 *
 * Root cause hypothesis:
 * The issue is likely related to the RelationshipsDecorations widget
 * (src/editor/RelationshipsDecorations.ts) which uses direct DOM manipulation to inject
 * relationships/subtasks widgets into the CodeMirror editor. On iOS/iPhone, this can
 * be affected by:
 *
 * 1. iOS Safari's scroll restoration and viewport behavior
 * 2. The timing of DOM injection after page load/render cycles
 * 3. Memory pressure on mobile devices causing garbage collection during async operations
 * 4. CodeMirror/Obsidian DOM structure changes during navigation or resize events
 * 5. The debounced injection (100ms delay) combined with rapid user interactions
 * 6. VirtualScroller interactions when the note content exceeds viewport
 * 7. iOS momentum scrolling affecting scroll measurements and container detection
 *
 * Related code:
 * - src/editor/RelationshipsDecorations.ts - Main widget injection logic
 *   - injectWidget() method (line 298) uses direct DOM manipulation
 *   - Relies on finding .cm-sizer and .metadata-container classes
 *   - Uses debounced injection which may cause timing issues on mobile
 * - src/ui/TaskCard.ts - Task card rendering including subtask expansion
 * - src/utils/VirtualScroller.ts - Virtual scrolling that may affect rendering
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1025
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1025: Disappearing subtasks in TaskNote on iPhone', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1025 - relationships widget intermittently disappears on iPhone viewport', async () => {
    /**
     * This test reproduces the intermittent disappearance of the subtasks/relationships
     * widget within a TaskNote on iPhone dimensions.
     *
     * Steps to reproduce:
     * 1. Open a TaskNote that has subtasks (is used as a project)
     * 2. Observe if the relationships widget appears below properties
     * 3. Scroll up and down
     * 4. Navigate away and back
     * 5. Check if the relationships widget is still visible
     *
     * The intermittent nature makes this hard to reproduce deterministically,
     * but this test captures the expected behavior.
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open a task note that serves as a project (has subtasks linked to it)
    // First, let's open the task list view to find a task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card that has the project indicator (chevron for subtasks)
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron, [data-has-subtasks="true"]'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible - skipping test');
      return;
    }

    // Click to open the task note in the editor
    await taskCardWithSubtasks.dblclick();
    await page.waitForTimeout(1000);

    // Wait for the editor to load
    const editor = page.locator('.markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Check if the relationships widget is present
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    // The widget should be visible for a task that has subtasks
    const isWidgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isWidgetVisible) {
      console.log('Relationships widget not visible initially - this is the bug!');
    }

    // Store initial visibility state
    const initiallyVisible = isWidgetVisible;

    // Perform scroll operations that might trigger the bug
    const scrollContainer = page.locator('.cm-scroller, .markdown-preview-view');
    if (await scrollContainer.isVisible().catch(() => false)) {
      // Scroll down
      await scrollContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(300);

      // Scroll back up
      await scrollContainer.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(300);
    }

    // Check visibility after scrolling
    const visibleAfterScroll = await relationshipsWidget.isVisible({ timeout: 1000 }).catch(() => false);

    // The widget should remain visible after scroll operations
    expect(visibleAfterScroll).toBe(initiallyVisible);

    // Navigate away (open command palette and dismiss)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Check visibility after navigation
    const visibleAfterNavigation = await relationshipsWidget.isVisible({ timeout: 1000 }).catch(() => false);

    // Widget should still be visible
    expect(visibleAfterNavigation).toBe(initiallyVisible);
  });

  test.fixme('reproduces issue #1025 - widget disappears after rapid scroll on mobile', async () => {
    /**
     * This test checks if rapid scrolling causes the relationships widget
     * to disappear, which could happen due to the debounced injection
     * combined with DOM updates during scroll.
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible');
      return;
    }

    // Double-click to open
    await taskCardWithSubtasks.dblclick();
    await page.waitForTimeout(1000);

    const editor = page.locator('.markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });

    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const wasVisible = await relationshipsWidget.isVisible({ timeout: 2000 }).catch(() => false);

    // Perform rapid scroll operations to potentially trigger the bug
    const scrollContainer = page.locator('.cm-scroller');
    if (await scrollContainer.isVisible().catch(() => false)) {
      for (let i = 0; i < 5; i++) {
        await scrollContainer.evaluate((el) => {
          el.scrollTop = el.scrollHeight * Math.random();
        });
        await page.waitForTimeout(50); // Rapid, not waiting for debounce
      }

      // Wait for any debounced operations to complete
      await page.waitForTimeout(200);
    }

    // Check if widget is still visible
    const stillVisible = await relationshipsWidget.isVisible({ timeout: 1000 }).catch(() => false);

    // If it was visible before, it should still be visible
    if (wasVisible) {
      expect(stillVisible).toBe(true);
    }
  });

  test.fixme('reproduces issue #1025 - widget visibility after view mode toggle on mobile', async () => {
    /**
     * This test checks if toggling between Live Preview and Reading mode
     * affects the relationships widget visibility on mobile.
     *
     * The RelationshipsDecorations.ts has separate handling for live preview
     * (CodeMirror plugin) and reading mode (DOM injection via workspace events).
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible');
      return;
    }

    // Open the task note
    await taskCardWithSubtasks.dblclick();
    await page.waitForTimeout(1000);

    // Check widget visibility in Live Preview mode
    const livePreviewWidget = page.locator('.markdown-source-view .tasknotes-relationships-widget');
    const visibleInLivePreview = await livePreviewWidget.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Widget visible in Live Preview: ${visibleInLivePreview}`);

    // Toggle to Reading mode
    await runCommand(page, 'Toggle Live Preview/Source mode');
    await page.waitForTimeout(500);

    // Toggle to Reading mode (may need another toggle depending on current state)
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(500);

    // Check widget visibility in Reading mode
    const readingWidget = page.locator('.markdown-preview-view .tasknotes-relationships-widget, .markdown-reading-view .tasknotes-relationships-widget');
    const visibleInReading = await readingWidget.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Widget visible in Reading mode: ${visibleInReading}`);

    // Toggle back to Live Preview
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(500);

    // Check widget visibility again in Live Preview
    const visibleAfterToggle = await livePreviewWidget.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Widget visible after toggle back: ${visibleAfterToggle}`);

    // The widget should be consistently visible across mode toggles
    // This test will fail if the bug causes intermittent visibility
    if (visibleInLivePreview) {
      expect(visibleAfterToggle).toBe(true);
    }
  });

  test.fixme('reproduces issue #1025 - widget affected by touch interactions on mobile', async () => {
    /**
     * This test checks if touch interactions (tap, swipe) affect the
     * relationships widget visibility on mobile.
     *
     * iOS touch events can trigger different behavior than mouse events,
     * potentially causing focus changes or scroll adjustments that affect
     * the DOM-injected widget.
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible');
      return;
    }

    // Get position for touch tap
    const cardBox = await taskCardWithSubtasks.boundingBox();
    if (!cardBox) {
      console.log('Could not get task card bounding box');
      return;
    }

    // Double-tap to open
    await page.touchscreen.tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.waitForTimeout(200);
    await page.touchscreen.tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.waitForTimeout(1000);

    const editor = page.locator('.markdown-source-view');
    if (!await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Editor not visible after tap');
      return;
    }

    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const initiallyVisible = await relationshipsWidget.isVisible({ timeout: 2000 }).catch(() => false);

    // Perform touch scroll (swipe gesture)
    const editorBox = await editor.boundingBox();
    if (editorBox) {
      // Swipe up
      await page.touchscreen.tap(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height * 0.8);
      await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height * 0.2, { steps: 10 });
      await page.waitForTimeout(300);

      // Swipe down
      await page.touchscreen.tap(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height * 0.2);
      await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height * 0.8, { steps: 10 });
      await page.waitForTimeout(300);
    }

    // Check visibility after touch interactions
    const visibleAfterTouch = await relationshipsWidget.isVisible({ timeout: 1000 }).catch(() => false);

    // Widget should maintain visibility through touch interactions
    if (initiallyVisible) {
      expect(visibleAfterTouch).toBe(true);
    }
  });

  test.fixme('reproduces issue #1025 - widget visibility with DOM container detection fallback', async () => {
    /**
     * This test checks the robustness of the DOM container detection
     * used by the RelationshipsDecorations widget.
     *
     * The injectWidget method relies on finding specific DOM elements:
     * - .markdown-source-view
     * - .cm-sizer
     * - .metadata-container
     *
     * On mobile, these elements might not be immediately available or
     * might have different timing for their appearance.
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find any task card (even without subtasks, to test container detection)
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    // Open the task
    await taskCard.dblclick();
    await page.waitForTimeout(500); // Short wait to potentially catch timing issues

    // Check if required DOM containers exist
    const cmSizer = page.locator('.cm-sizer');
    const metadataContainer = page.locator('.metadata-container');
    const sourceView = page.locator('.markdown-source-view');

    const hasCmSizer = await cmSizer.isVisible({ timeout: 2000 }).catch(() => false);
    const hasMetadata = await metadataContainer.isVisible({ timeout: 2000 }).catch(() => false);
    const hasSourceView = await sourceView.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Container detection - cmSizer: ${hasCmSizer}, metadata: ${hasMetadata}, sourceView: ${hasSourceView}`);

    // If the source view is visible but cm-sizer is not, this could cause the bug
    // The RelationshipsDecorations.ts will fail to inject the widget
    if (hasSourceView && !hasCmSizer) {
      console.log('BUG CONDITION: Source view present but cm-sizer not found');
    }

    // Wait for full load and recheck
    await page.waitForTimeout(1000);

    const hasCmSizerAfterWait = await cmSizer.isVisible({ timeout: 1000 }).catch(() => false);

    // cm-sizer should eventually be present for the widget to inject
    expect(hasCmSizerAfterWait).toBe(true);
  });

  test.fixme('reproduces issue #1025 - widget orphan cleanup race condition on mobile', async () => {
    /**
     * This test checks if the orphan widget cleanup in RelationshipsDecorations
     * (cleanupOrphanedWidgets method) could cause issues on mobile.
     *
     * The cleanup removes widgets that don't match the current widget reference,
     * which could potentially remove a valid widget if timing is off.
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task with subtasks
    const taskCardWithSubtasks = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithSubtasks.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks visible');
      return;
    }

    // Open the task
    await taskCardWithSubtasks.dblclick();
    await page.waitForTimeout(1000);

    // Count widgets
    const widgetCount = await page.locator('.tasknotes-relationships-widget').count();
    console.log(`Widget count: ${widgetCount}`);

    // There should be at most one widget (orphan cleanup should work)
    // But on mobile, timing issues could cause either 0 (all cleaned up) or >1 (orphans not cleaned)
    expect(widgetCount).toBeLessThanOrEqual(1);

    // Rapidly switch between files to potentially trigger orphan issues
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Find another task
    const anotherTask = page.locator('.task-card').nth(1);
    if (await anotherTask.isVisible().catch(() => false)) {
      await anotherTask.dblclick();
      await page.waitForTimeout(500);

      // Go back to original
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await taskCardWithSubtasks.dblclick();
      await page.waitForTimeout(500);

      // Check widget count again
      const finalWidgetCount = await page.locator('.tasknotes-relationships-widget').count();
      console.log(`Final widget count after switching: ${finalWidgetCount}`);

      // Should still have at most one widget
      expect(finalWidgetCount).toBeLessThanOrEqual(1);
    }
  });
});
