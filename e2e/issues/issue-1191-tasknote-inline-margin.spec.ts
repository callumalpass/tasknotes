/**
 * Issue #1191: "Inline" task on TaskNote proper doesn't respect left margin
 *
 * Bug: On the TaskNote itself, the "inline" version of the task (the task card
 * widget that appears at the top of the note) is displayed fully left-aligned,
 * while it should respect the view window's left padding to match Obsidian's
 * content layout.
 *
 * Version: v4.0.3
 *
 * Root cause hypothesis:
 * The task card note widget (.task-card-note-widget) is injected into the
 * .cm-sizer (live preview) or .markdown-preview-sizer (reading mode) container.
 * The widget only has vertical margin (via `margin: var(--cs-spacing-md) 0`),
 * but no horizontal margin/padding to match Obsidian's content area padding.
 *
 * Obsidian's content area typically has horizontal padding defined by CSS
 * variables like --file-margins, but the widget doesn't inherit or respect
 * this padding because it's a direct child of the sizer element.
 *
 * Related code locations:
 * - src/editor/TaskCardNoteDecorations.ts:370-383 - Widget injection into DOM
 * - styles/task-card-note-widget.css:3-8 - Widget CSS (no horizontal margin)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1191
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1191: TaskNote inline task left margin', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1191 - task card widget should respect view padding in live preview', async () => {
    /**
     * This test reproduces the bug where the task card widget on a TaskNote
     * doesn't respect the left margin/padding of the editing view.
     *
     * STEPS TO REPRODUCE:
     * 1. Open a TaskNote (a note that is a task file)
     * 2. Observe the task card widget at the top of the note
     * 3. Compare its left alignment with the content below
     *
     * EXPECTED BEHAVIOR:
     * The task card widget should have the same left margin/padding as the
     * rest of the note content, respecting Obsidian's --file-margins setting.
     *
     * ACTUAL BEHAVIOR (bug):
     * The task card widget is fully left-aligned (flush to the edge) while
     * the note content has proper padding.
     */
    const page = app.page;

    // First, create a new task to have a TaskNote to work with
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the title
    const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test Task for Issue 1191');
    }

    // Save the task
    const saveButton = modal.locator('button:has-text("Save"), button:has-text("Create")').first();
    if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    } else {
      // Try using keyboard shortcut to save
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(1000);
    }

    // Now open the TaskNote using quick switcher
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Test Task for Issue 1191');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/screenshots/issue-1191-tasknote-view.png' });

    // Find the task card widget and regular content
    const taskCardWidget = page.locator('.task-card-note-widget, .tasknotes-task-card-note-widget').first();
    const contentArea = page.locator('.cm-contentContainer, .cm-sizer, .markdown-source-view').first();

    // Verify the widget is visible
    const widgetVisible = await taskCardWidget.isVisible({ timeout: 5000 }).catch(() => false);

    if (!widgetVisible) {
      console.log('Task card widget not found - may need to enable setting or check file type');
      // Try to get debug info
      const debugInfo = await page.evaluate(() => {
        const widgets = document.querySelectorAll('[class*="task-card"]');
        return Array.from(widgets).map(w => ({
          className: w.className,
          tagName: w.tagName,
          visible: (w as HTMLElement).offsetWidth > 0,
        }));
      });
      console.log('Task card elements found:', JSON.stringify(debugInfo, null, 2));
      return;
    }

    // Measure the left position/margin of the task card widget vs content
    const layoutMeasurements = await page.evaluate(() => {
      const widget = document.querySelector('.task-card-note-widget, .tasknotes-task-card-note-widget');
      const sizer = document.querySelector('.cm-sizer, .markdown-preview-sizer');
      const contentContainer = document.querySelector('.cm-contentContainer');
      const cmContent = document.querySelector('.cm-content');

      if (!widget) {
        return null;
      }

      const widgetRect = widget.getBoundingClientRect();
      const widgetStyles = window.getComputedStyle(widget);

      // Get computed styles
      const result: Record<string, unknown> = {
        widget: {
          left: widgetRect.left,
          marginLeft: widgetStyles.marginLeft,
          paddingLeft: widgetStyles.paddingLeft,
        },
      };

      if (sizer) {
        const sizerRect = sizer.getBoundingClientRect();
        const sizerStyles = window.getComputedStyle(sizer);
        result.sizer = {
          left: sizerRect.left,
          paddingLeft: sizerStyles.paddingLeft,
        };
      }

      if (contentContainer) {
        const containerRect = contentContainer.getBoundingClientRect();
        result.contentContainer = {
          left: containerRect.left,
        };
      }

      if (cmContent) {
        const contentRect = cmContent.getBoundingClientRect();
        const contentStyles = window.getComputedStyle(cmContent);
        result.cmContent = {
          left: contentRect.left,
          marginLeft: contentStyles.marginLeft,
          paddingLeft: contentStyles.paddingLeft,
        };
      }

      // Get Obsidian's file-margins variable
      const root = document.documentElement;
      const computedRoot = window.getComputedStyle(root);
      result.fileMargins = computedRoot.getPropertyValue('--file-margins').trim();

      return result;
    });

    console.log('Layout measurements:', JSON.stringify(layoutMeasurements, null, 2));

    if (layoutMeasurements) {
      // The bug is that the widget's left position doesn't account for content padding
      // The widget should have the same left offset as the main content

      const widgetLeft = (layoutMeasurements.widget as { left: number }).left;
      const contentLeft = layoutMeasurements.cmContent
        ? (layoutMeasurements.cmContent as { left: number }).left
        : layoutMeasurements.contentContainer
          ? (layoutMeasurements.contentContainer as { left: number }).left
          : null;

      if (contentLeft !== null) {
        const leftDifference = Math.abs(widgetLeft - contentLeft);
        console.log(`Widget left: ${widgetLeft}px, Content left: ${contentLeft}px, Difference: ${leftDifference}px`);

        // The widget and content should have the same left offset (within a small tolerance)
        // If there's a significant difference, it indicates the bug
        const tolerancePx = 10; // Allow small differences due to borders, etc.
        expect(leftDifference).toBeLessThanOrEqual(tolerancePx);
      }
    }
  });

  test.fixme('reproduces issue #1191 - task card widget should respect view padding in reading mode', async () => {
    /**
     * This test checks the same issue in reading mode (preview mode).
     * The widget is injected into .markdown-preview-sizer which has
     * different padding rules than the editor.
     */
    const page = app.page;

    // Switch to reading mode
    await runCommand(page, 'Toggle Live Preview/Source mode').catch(() => {});
    await page.waitForTimeout(500);
    await runCommand(page, 'Toggle reading view').catch(() => {});
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/issue-1191-reading-mode.png' });

    // Check widget alignment in reading mode
    const layoutMeasurements = await page.evaluate(() => {
      const widget = document.querySelector('.task-card-note-widget, .tasknotes-task-card-note-widget');
      const sizer = document.querySelector('.markdown-preview-sizer');
      const markdownSection = document.querySelector('.markdown-preview-section');

      if (!widget || !sizer) {
        return null;
      }

      const widgetRect = widget.getBoundingClientRect();
      const widgetStyles = window.getComputedStyle(widget);
      const sizerRect = sizer.getBoundingClientRect();
      const sizerStyles = window.getComputedStyle(sizer);

      const result: Record<string, unknown> = {
        widget: {
          left: widgetRect.left,
          marginLeft: widgetStyles.marginLeft,
          paddingLeft: widgetStyles.paddingLeft,
        },
        sizer: {
          left: sizerRect.left,
          paddingLeft: sizerStyles.paddingLeft,
          width: sizerRect.width,
        },
      };

      if (markdownSection) {
        const sectionRect = markdownSection.getBoundingClientRect();
        result.markdownSection = {
          left: sectionRect.left,
        };
      }

      // Check for readable line width class which affects content centering
      const readableLineWidth = document.querySelector('.is-readable-line-width');
      result.hasReadableLineWidth = !!readableLineWidth;

      return result;
    });

    console.log('Reading mode layout:', JSON.stringify(layoutMeasurements, null, 2));

    if (layoutMeasurements) {
      // In reading mode with readable line width, content is often centered
      // The widget should match this centering

      const widgetLeft = (layoutMeasurements.widget as { left: number }).left;
      const sectionLeft = layoutMeasurements.markdownSection
        ? (layoutMeasurements.markdownSection as { left: number }).left
        : (layoutMeasurements.sizer as { left: number }).left;

      const leftDifference = Math.abs(widgetLeft - sectionLeft);
      console.log(`Widget left: ${widgetLeft}px, Content left: ${sectionLeft}px, Difference: ${leftDifference}px`);

      // The widget should be aligned with the content
      const tolerancePx = 10;
      expect(leftDifference).toBeLessThanOrEqual(tolerancePx);
    }
  });

  test.fixme('reproduces issue #1191 - widget margins should respect Obsidian file-margins setting', async () => {
    /**
     * This test verifies that when Obsidian's --file-margins CSS variable
     * is set (e.g., through Settings > Editor > File margins), the task card
     * widget respects this setting.
     *
     * The widget should use margin-left/margin-right that matches the
     * file-margins setting, or inherit padding from its container.
     */
    const page = app.page;

    // Check current file-margins value and widget styling
    const marginAnalysis = await page.evaluate(() => {
      const root = document.documentElement;
      const computedRoot = window.getComputedStyle(root);

      // Get relevant CSS variables
      const cssVars = {
        fileMargins: computedRoot.getPropertyValue('--file-margins').trim(),
        fileLineWidth: computedRoot.getPropertyValue('--file-line-width').trim(),
        maxWidth: computedRoot.getPropertyValue('--max-width').trim(),
      };

      const widget = document.querySelector('.task-card-note-widget');
      if (!widget) {
        return { cssVars, widget: null };
      }

      const widgetStyles = window.getComputedStyle(widget);

      return {
        cssVars,
        widget: {
          marginLeft: widgetStyles.marginLeft,
          marginRight: widgetStyles.marginRight,
          paddingLeft: widgetStyles.paddingLeft,
          paddingRight: widgetStyles.paddingRight,
          width: widgetStyles.width,
          maxWidth: widgetStyles.maxWidth,
        },
      };
    });

    console.log('File margins analysis:', JSON.stringify(marginAnalysis, null, 2));

    // If file-margins is set, verify the widget uses it
    if (marginAnalysis.cssVars.fileMargins && marginAnalysis.widget) {
      const fileMargins = marginAnalysis.cssVars.fileMargins;
      const widgetMarginLeft = marginAnalysis.widget.marginLeft;
      const widgetMarginRight = marginAnalysis.widget.marginRight;

      // The bug is that widget margin is '0px' while file-margins may be something like '96px'
      // After fix, widget should have horizontal margin matching file-margins
      console.log(`File margins: ${fileMargins}, Widget marginLeft: ${widgetMarginLeft}, Widget marginRight: ${widgetMarginRight}`);

      // If file-margins is a non-zero value, widget should have matching margins
      // This will fail in the current buggy state
      const fileMarginsNum = parseInt(fileMargins) || 0;
      const widgetMarginLeftNum = parseInt(widgetMarginLeft) || 0;

      if (fileMarginsNum > 0) {
        expect(widgetMarginLeftNum).toBeGreaterThan(0);
      }
    }
  });

  test.fixme('reproduces issue #1191 - visual regression test with screenshot comparison', async () => {
    /**
     * This test captures the visual appearance of the TaskNote with the
     * inline task widget, for visual regression testing.
     *
     * The screenshot shows the misalignment between the widget and content.
     */
    const page = app.page;

    // Ensure we're in editing mode
    await runCommand(page, 'Toggle Live Preview/Source mode').catch(() => {});
    await page.waitForTimeout(500);

    // Find the editor view containing the task
    const editorView = page.locator('.workspace-leaf.mod-active .markdown-source-view').first();

    if (await editorView.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Take a screenshot of just the editor area
      await editorView.screenshot({
        path: 'test-results/screenshots/issue-1191-visual-regression.png',
      });

      // Get element bounding boxes for annotation
      const boundingBoxes = await page.evaluate(() => {
        const widget = document.querySelector('.workspace-leaf.mod-active .task-card-note-widget');
        const content = document.querySelector('.workspace-leaf.mod-active .cm-content');

        return {
          widget: widget?.getBoundingClientRect(),
          content: content?.getBoundingClientRect(),
        };
      });

      console.log('Element bounding boxes for visual comparison:', JSON.stringify(boundingBoxes, null, 2));

      // Visual assertion: widget left edge should align with content left edge
      if (boundingBoxes.widget && boundingBoxes.content) {
        const widgetLeft = boundingBoxes.widget.left;
        const contentLeft = boundingBoxes.content.left;

        // This will fail in the current buggy state
        expect(Math.abs(widgetLeft - contentLeft)).toBeLessThanOrEqual(5);
      }
    }
  });
});
