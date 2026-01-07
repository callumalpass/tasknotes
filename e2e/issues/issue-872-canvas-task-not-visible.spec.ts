/**
 * Issue #872: [Bug]: When embedding the Markdown file of a task in canvas,
 * unless you click in the file, the task is not visible
 *
 * Bug: When a task markdown file is embedded in an Obsidian canvas,
 * the task card widget is not visible until the user clicks inside
 * the embedded file. This happens because task cards are rendered
 * via a CodeMirror editor extension (TaskCardNoteDecorations) that
 * only activates in live preview mode, but canvas embeds display
 * markdown files in reading mode by default.
 *
 * Root cause analysis:
 * - TaskCardNoteDecorations.ts uses a CodeMirror PluginValue that only
 *   injects the task card widget in live preview mode
 * - The code checks `view.state.field(editorLivePreviewField)` and returns
 *   early if not in live preview mode
 * - Canvas embeds render files in reading mode, not live preview
 * - There is no ReadingModeTaskCardProcessor equivalent to
 *   ReadingModeTaskLinkProcessor for task cards
 *
 * Suggested fix approaches:
 * 1. Create a new ReadingModeTaskCardProcessor that renders task cards
 *    in reading mode (similar pattern to ReadingModeTaskLinkProcessor)
 * 2. Or modify TaskCardNoteDecorations to work in both modes
 *
 * @see https://github.com/callumalpass/tasknotes/issues/872
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #872: Task not visible in canvas embedded markdown', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #872 - task card should be visible in canvas embed without clicking', async () => {
    /**
     * This test reproduces the bug where task cards are not visible
     * when a task markdown file is embedded in a canvas until the
     * user clicks inside the embedded file.
     *
     * STEPS TO REPRODUCE:
     * 1. Create a new task (which creates a markdown file)
     * 2. Create a new canvas
     * 3. Embed the task markdown file in the canvas
     * 4. Observe the task card is NOT visible (bug)
     * 5. Click inside the embedded file
     * 6. Observe the task card becomes visible (after click)
     *
     * EXPECTED BEHAVIOR:
     * The task card should be visible in the canvas embed immediately,
     * without requiring the user to click inside the embedded file.
     *
     * ACTUAL BEHAVIOR (bug):
     * The task card is only visible after clicking inside the embed,
     * which triggers a switch from reading mode to live preview mode.
     */
    const page = app.page;

    // Step 1: Create a test task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the task title
    const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test Task for Canvas Issue 872');
    }

    // Save the task
    const saveButton = modal.locator('button:has-text("Save"), button:has-text("Create")').first();
    if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(1000);
    }

    // Step 2: Create a new canvas
    await runCommand(page, 'Create new canvas');
    await page.waitForTimeout(1000);

    // Step 3: Add the task file to the canvas
    // Right-click to open context menu and add file
    const canvasView = page.locator('.canvas-wrapper, .canvas');
    if (await canvasView.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Right-click in the canvas to open context menu
      await canvasView.click({ button: 'right', position: { x: 200, y: 200 } });
      await page.waitForTimeout(300);

      // Look for "Add file" or similar menu option
      const addFileOption = page.locator('text="Add file from vault"').first();
      if (await addFileOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addFileOption.click();
        await page.waitForTimeout(500);

        // Search for the task file
        const searchInput = page.locator('.prompt-input, input[type="text"]').first();
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchInput.fill('Test Task for Canvas Issue 872');
          await page.waitForTimeout(500);

          // Select the first result
          const firstResult = page.locator('.suggestion-item').first();
          if (await firstResult.isVisible({ timeout: 2000 }).catch(() => false)) {
            await firstResult.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }

    // Take screenshot before clicking in the embed
    await page.screenshot({ path: 'test-results/screenshots/issue-872-before-click.png' });

    // Step 4: Check if task card is visible WITHOUT clicking
    const taskCardBeforeClick = await page.evaluate(() => {
      // Look for task card in canvas embeds
      const canvasNodes = document.querySelectorAll('.canvas-node');
      for (const node of canvasNodes) {
        const taskCard = node.querySelector('.task-card, .tasknotes-task-card, [class*="task-card"]');
        if (taskCard) {
          const styles = window.getComputedStyle(taskCard);
          return {
            found: true,
            visible: styles.display !== 'none' && styles.visibility !== 'hidden',
            opacity: styles.opacity,
          };
        }
      }
      return { found: false, visible: false };
    });

    console.log('Task card before click:', JSON.stringify(taskCardBeforeClick, null, 2));

    // The bug is that the task card is NOT visible before clicking
    // After the fix, this assertion should pass
    expect(taskCardBeforeClick.found).toBe(true);
    expect(taskCardBeforeClick.visible).toBe(true);

    // Step 5: Click inside the embedded file
    const canvasNode = page.locator('.canvas-node').first();
    if (await canvasNode.isVisible({ timeout: 2000 }).catch(() => false)) {
      await canvasNode.click();
      await page.waitForTimeout(500);
    }

    // Take screenshot after clicking
    await page.screenshot({ path: 'test-results/screenshots/issue-872-after-click.png' });

    // Step 6: Check if task card is now visible
    const taskCardAfterClick = await page.evaluate(() => {
      const canvasNodes = document.querySelectorAll('.canvas-node');
      for (const node of canvasNodes) {
        const taskCard = node.querySelector('.task-card, .tasknotes-task-card, [class*="task-card"]');
        if (taskCard) {
          const styles = window.getComputedStyle(taskCard);
          return {
            found: true,
            visible: styles.display !== 'none' && styles.visibility !== 'hidden',
            opacity: styles.opacity,
          };
        }
      }
      return { found: false, visible: false };
    });

    console.log('Task card after click:', JSON.stringify(taskCardAfterClick, null, 2));

    // Clean up
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #872 - verify reading mode vs live preview task card rendering', async () => {
    /**
     * This test verifies the underlying cause: task cards only render
     * in live preview mode, not in reading mode.
     *
     * Canvas embeds use reading mode by default, which is why task
     * cards don't appear until the user clicks to activate live preview.
     */
    const page = app.page;

    // Create a task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Task for Mode Test 872');
      }
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(1000);
    }

    // Open the task file
    await runCommand(page, 'Open file');
    await page.waitForTimeout(500);

    const searchInput = page.locator('.prompt-input').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('Task for Mode Test 872');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Check task card in live preview mode (default editing mode)
    const livePreviewCheck = await page.evaluate(() => {
      const sourceView = document.querySelector('.markdown-source-view');
      if (sourceView) {
        const taskCard = sourceView.querySelector('.task-card, .tasknotes-task-card');
        return {
          mode: 'live-preview',
          hasTaskCard: !!taskCard,
          isLivePreview: sourceView.classList.contains('is-live-preview'),
        };
      }
      return { mode: 'unknown', hasTaskCard: false };
    });

    console.log('Live preview mode check:', JSON.stringify(livePreviewCheck, null, 2));

    // Switch to reading mode
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(500);

    // Check task card in reading mode
    const readingModeCheck = await page.evaluate(() => {
      const readingView = document.querySelector('.markdown-reading-view');
      const previewView = document.querySelector('.markdown-preview-view');
      const view = readingView || previewView;

      if (view) {
        const taskCard = view.querySelector('.task-card, .tasknotes-task-card');
        return {
          mode: 'reading',
          hasTaskCard: !!taskCard,
          viewClass: view.className,
        };
      }
      return { mode: 'reading', hasTaskCard: false };
    });

    console.log('Reading mode check:', JSON.stringify(readingModeCheck, null, 2));

    // The bug is that task cards don't render in reading mode
    // After the fix, both modes should have task cards
    expect(livePreviewCheck.hasTaskCard).toBe(true);
    expect(readingModeCheck.hasTaskCard).toBe(true); // This fails before fix

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #872 - multiple canvas embeds should show task cards', async () => {
    /**
     * This test verifies that multiple task embeds in a canvas
     * all show their task cards without requiring individual clicks.
     */
    const page = app.page;

    // Create multiple tasks
    const taskNames = ['Canvas Task A 872', 'Canvas Task B 872', 'Canvas Task C 872'];

    for (const taskName of taskNames) {
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(400);

      const modal = page.locator('.modal');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await titleInput.fill(taskName);
        }
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(400);
      }
    }

    // Create a new canvas
    await runCommand(page, 'Create new canvas');
    await page.waitForTimeout(1000);

    // Add each task to the canvas at different positions
    const positions = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 250, y: 300 },
    ];

    const canvasView = page.locator('.canvas-wrapper, .canvas');
    for (let i = 0; i < taskNames.length; i++) {
      if (await canvasView.isVisible({ timeout: 2000 }).catch(() => false)) {
        await canvasView.click({ button: 'right', position: positions[i] });
        await page.waitForTimeout(300);

        const addFileOption = page.locator('text="Add file from vault"').first();
        if (await addFileOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await addFileOption.click();
          await page.waitForTimeout(300);

          const searchInput = page.locator('.prompt-input, input[type="text"]').first();
          if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await searchInput.fill(taskNames[i]);
            await page.waitForTimeout(300);

            const firstResult = page.locator('.suggestion-item').first();
            if (await firstResult.isVisible({ timeout: 1000 }).catch(() => false)) {
              await firstResult.click();
              await page.waitForTimeout(500);
            }
          }
        }
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/issue-872-multiple-embeds.png' });

    // Check all canvas nodes for task cards
    const multipleEmbedsCheck = await page.evaluate(() => {
      const canvasNodes = document.querySelectorAll('.canvas-node');
      const results: { index: number; hasTaskCard: boolean; isVisible: boolean }[] = [];

      canvasNodes.forEach((node, index) => {
        const taskCard = node.querySelector('.task-card, .tasknotes-task-card, [class*="task-card"]');
        if (taskCard) {
          const styles = window.getComputedStyle(taskCard);
          results.push({
            index,
            hasTaskCard: true,
            isVisible: styles.display !== 'none' && styles.visibility !== 'hidden',
          });
        } else {
          // Check if it's a markdown embed that should have a task card
          const markdownContent = node.querySelector('.markdown-embed, .markdown-preview-view');
          if (markdownContent) {
            results.push({
              index,
              hasTaskCard: false,
              isVisible: false,
            });
          }
        }
      });

      return results;
    });

    console.log('Multiple embeds check:', JSON.stringify(multipleEmbedsCheck, null, 2));

    // All task embeds should show their task cards
    for (const embed of multipleEmbedsCheck) {
      expect(embed.hasTaskCard).toBe(true);
      expect(embed.isVisible).toBe(true);
    }

    await page.keyboard.press('Escape');
  });
});
