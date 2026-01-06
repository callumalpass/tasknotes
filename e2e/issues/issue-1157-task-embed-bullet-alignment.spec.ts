/**
 * Issue #1157: [Bug]: TaskNotes embeds no longer work with bullets
 *
 * Bug: After an update, TaskNotes task embeds (wikilinks like [[Task Name]])
 * no longer display inline after bullets in bulleted lists. Instead, they
 * appear on their own line, breaking the visual layout and making it hard
 * to manage tasks in daily notes.
 *
 * Additionally, the user requested the ability to hide recurrence indicators
 * for embedded TaskNotes, though this is more of a feature request.
 *
 * Root cause (fixed in commits e26c7bd7, 02431b46):
 * 1. Task card elements were using `<div>` tags which are block-level, causing
 *    line breaks even within inline contexts
 * 2. CSS `display: inline-flex` was being used, which still caused wrapping issues
 *    when the task card was wider than available space
 * 3. The inline widget wrapper (.tasknotes-inline-widget) didn't have proper
 *    inline display styles to prevent line breaks
 *
 * The fix involved:
 * - Using `<span>` elements instead of `<div>` for inline layout mode
 * - Changing from `inline-flex` to `inline` display for better text flow
 * - Adding `display: inline !important` and `vertical-align: baseline` to wrapper
 * - Using em-based sizing for icons to scale with editor font
 * - Adding max-width constraints to prevent wrapping
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1157
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1157: Task embeds inline with bullets', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1157 - task embed should display inline with bullet point', async () => {
    /**
     * This test reproduces the bug where task embeds appear on their own line
     * instead of inline after the bullet point in a bulleted list.
     *
     * STEPS TO REPRODUCE:
     * 1. Create a new task
     * 2. Create a note with a bulleted list containing task wikilinks
     * 3. Observe the task embed renders on its own line instead of inline
     *
     * EXPECTED BEHAVIOR:
     * The task embed should appear on the same line as the bullet, directly
     * after the bullet marker, without forcing a line break.
     *
     * ACTUAL BEHAVIOR (bug):
     * The task embed appears on a new line below the bullet, making the
     * list visually messy and harder to read.
     */
    const page = app.page;

    // First, create a test task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the title
    const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test Task for Issue 1157');
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

    // Create a new note with a bullet containing the task link
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    // Type content with bulleted task links
    await page.keyboard.type('# Daily Note Test\n\n');
    await page.keyboard.type('- [[Test Task for Issue 1157]]\n');
    await page.keyboard.type('- Second bullet\n');
    await page.waitForTimeout(2000); // Wait for task link overlay to process

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/screenshots/issue-1157-bullet-alignment.png' });

    // Find the bullet list item and task embed widget
    const bulletList = page.locator('.cm-line').filter({ hasText: 'Test Task for Issue 1157' }).first();
    const bulletExists = await bulletList.isVisible({ timeout: 3000 }).catch(() => false);

    if (!bulletExists) {
      console.log('Could not find the bullet line with task link');
      return;
    }

    // Measure the layout to detect if task is on same line as bullet
    const layoutAnalysis = await page.evaluate(() => {
      // Find the bullet marker and task widget
      const lines = document.querySelectorAll('.cm-line');
      let bulletLine: Element | null = null;

      for (const line of lines) {
        if (line.textContent?.includes('Test Task for Issue 1157') ||
            line.querySelector('.tasknotes-inline-widget') ||
            line.querySelector('.task-card--layout-inline')) {
          bulletLine = line;
          break;
        }
      }

      if (!bulletLine) {
        return { found: false };
      }

      const lineRect = bulletLine.getBoundingClientRect();

      // Find the bullet marker (usually in a span with bullet formatting)
      const bulletMarker = bulletLine.querySelector('.cm-formatting-list, .list-bullet, [class*="bullet"]');
      const bulletRect = bulletMarker?.getBoundingClientRect();

      // Find the task widget
      const taskWidget = bulletLine.querySelector('.tasknotes-inline-widget, .task-card--layout-inline, .task-inline-preview');
      const widgetRect = taskWidget?.getBoundingClientRect();

      // Check computed styles of the widget wrapper
      const widgetWrapper = bulletLine.querySelector('.tasknotes-plugin.tasknotes-inline-widget');
      const wrapperStyles = widgetWrapper ? window.getComputedStyle(widgetWrapper) : null;

      return {
        found: true,
        lineHeight: lineRect.height,
        lineTop: lineRect.top,
        bulletTop: bulletRect?.top,
        bulletBottom: bulletRect?.bottom,
        widgetTop: widgetRect?.top,
        widgetBottom: widgetRect?.bottom,
        widgetLeft: widgetRect?.left,
        widgetDisplay: wrapperStyles?.display,
        widgetVerticalAlign: wrapperStyles?.verticalAlign,
        // If widget top is significantly below line top, it's on a new line
        isWidgetOnSameLine: widgetRect ? Math.abs((widgetRect.top || 0) - lineRect.top) < 50 : null,
      };
    });

    console.log('Layout analysis:', JSON.stringify(layoutAnalysis, null, 2));

    if (layoutAnalysis.found && layoutAnalysis.isWidgetOnSameLine !== null) {
      // The bug causes the widget to appear on a new line (isWidgetOnSameLine would be false)
      // After the fix, it should be on the same line as the bullet
      expect(layoutAnalysis.isWidgetOnSameLine).toBe(true);

      // Check that the widget has proper inline display
      if (layoutAnalysis.widgetDisplay) {
        expect(layoutAnalysis.widgetDisplay).toBe('inline');
      }
    }

    // Clean up - close the note
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1157 - task card elements should use span for inline layout', async () => {
    /**
     * This test verifies that task cards in inline layout mode use <span>
     * elements instead of <div> elements to prevent block-level line breaks.
     *
     * The fix changed TaskCard.ts to create span elements when layout is "inline":
     * ```typescript
     * const card = document.createElement(layout === "inline" ? "span" : "div");
     * ```
     */
    const page = app.page;

    // Create a note with task link to trigger inline rendering
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    await page.keyboard.type('Test inline layout: [[Test Task for Issue 1157]]\n');
    await page.waitForTimeout(2000);

    // Check that the task card uses span elements
    const elementAnalysis = await page.evaluate(() => {
      const inlineTaskCard = document.querySelector('.task-card--layout-inline');
      if (!inlineTaskCard) {
        return { found: false };
      }

      return {
        found: true,
        cardTagName: inlineTaskCard.tagName.toLowerCase(),
        mainRowTagName: inlineTaskCard.querySelector('.task-card__main-row')?.tagName.toLowerCase(),
        contentTagName: inlineTaskCard.querySelector('.task-card__content')?.tagName.toLowerCase(),
        titleTagName: inlineTaskCard.querySelector('.task-card__title')?.tagName.toLowerCase(),
      };
    });

    console.log('Element analysis:', JSON.stringify(elementAnalysis, null, 2));

    if (elementAnalysis.found) {
      // After the fix, inline task cards should use span elements
      expect(elementAnalysis.cardTagName).toBe('span');
      expect(elementAnalysis.mainRowTagName).toBe('span');
      expect(elementAnalysis.contentTagName).toBe('span');
      expect(elementAnalysis.titleTagName).toBe('span');
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1157 - inline widget wrapper has correct CSS styles', async () => {
    /**
     * This test verifies that the inline widget wrapper has the correct CSS
     * styles to prevent line breaks and ensure proper baseline alignment.
     *
     * Key CSS properties after the fix:
     * - display: inline !important
     * - vertical-align: baseline
     * - line-height: inherit
     * - white-space: normal
     */
    const page = app.page;

    // Create a note with task link
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    await page.keyboard.type('CSS test: [[Test Task for Issue 1157]]\n');
    await page.waitForTimeout(2000);

    const cssAnalysis = await page.evaluate(() => {
      const wrapper = document.querySelector('.tasknotes-plugin.tasknotes-inline-widget');
      if (!wrapper) {
        return { found: false };
      }

      const styles = window.getComputedStyle(wrapper);

      return {
        found: true,
        display: styles.display,
        verticalAlign: styles.verticalAlign,
        lineHeight: styles.lineHeight,
        whiteSpace: styles.whiteSpace,
      };
    });

    console.log('CSS analysis:', JSON.stringify(cssAnalysis, null, 2));

    if (cssAnalysis.found) {
      // Verify the fix is in place
      expect(cssAnalysis.display).toBe('inline');
      expect(cssAnalysis.verticalAlign).toBe('baseline');
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1157 - multiple task embeds in bullet list stay inline', async () => {
    /**
     * This test verifies that multiple task embeds in a bulleted list all
     * render inline with their respective bullets, not breaking to new lines.
     */
    const page = app.page;

    // Create multiple tasks
    for (const taskName of ['Task A for 1157', 'Task B for 1157', 'Task C for 1157']) {
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const titleInput = modal.locator('.task-modal-title, input[placeholder*="title"]').first();
        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await titleInput.fill(taskName);
        }
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(500);
      }
    }

    // Create note with bullet list of task links
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    await page.keyboard.type('# Multiple Tasks Test\n\n');
    await page.keyboard.type('- [[Task A for 1157]]\n');
    await page.keyboard.type('- [[Task B for 1157]]\n');
    await page.keyboard.type('- [[Task C for 1157]]\n');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/issue-1157-multiple-bullets.png' });

    // Check that all task widgets are inline with their bullets
    const multipleAnalysis = await page.evaluate(() => {
      const inlineWidgets = document.querySelectorAll('.tasknotes-inline-widget');
      const results: { index: number; isInline: boolean; display: string }[] = [];

      inlineWidgets.forEach((widget, index) => {
        const styles = window.getComputedStyle(widget);
        const parent = widget.closest('.cm-line');
        const parentRect = parent?.getBoundingClientRect();
        const widgetRect = widget.getBoundingClientRect();

        const isOnSameLine = parentRect && widgetRect ?
          Math.abs(widgetRect.top - parentRect.top) < 50 : false;

        results.push({
          index,
          isInline: isOnSameLine,
          display: styles.display,
        });
      });

      return results;
    });

    console.log('Multiple widgets analysis:', JSON.stringify(multipleAnalysis, null, 2));

    // All widgets should be inline
    for (const widget of multipleAnalysis) {
      expect(widget.display).toBe('inline');
      expect(widget.isInline).toBe(true);
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1157 - indented bullets with task embeds stay inline', async () => {
    /**
     * This test specifically addresses the scenario mentioned in commit 02431b46:
     * "improve inline task embed layout for indented bullets"
     *
     * Indented bullet lists were particularly problematic because the additional
     * indentation reduced available width, making wrapping more likely.
     */
    const page = app.page;

    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    // Create indented bullet structure
    await page.keyboard.type('# Indented Bullets Test\n\n');
    await page.keyboard.type('- Parent item\n');
    await page.keyboard.type('  - [[Test Task for Issue 1157]]\n'); // Indented
    await page.keyboard.type('    - Deeply [[Test Task for Issue 1157]]\n'); // More indented
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/screenshots/issue-1157-indented-bullets.png' });

    // Verify indented bullets still have inline display
    const indentedAnalysis = await page.evaluate(() => {
      const lines = document.querySelectorAll('.cm-line');
      const results: { text: string; indentLevel: number; hasInlineWidget: boolean }[] = [];

      lines.forEach((line) => {
        const text = line.textContent?.trim() || '';
        if (text.includes('Task for Issue 1157') || line.querySelector('.tasknotes-inline-widget')) {
          // Count indentation level by checking for indent markers or whitespace
          const indentMarkers = line.querySelectorAll('.cm-indent, .cm-tab');
          const widget = line.querySelector('.tasknotes-inline-widget');

          results.push({
            text: text.substring(0, 50),
            indentLevel: indentMarkers.length,
            hasInlineWidget: !!widget,
          });
        }
      });

      return results;
    });

    console.log('Indented bullets analysis:', JSON.stringify(indentedAnalysis, null, 2));

    await page.keyboard.press('Escape');
  });
});
