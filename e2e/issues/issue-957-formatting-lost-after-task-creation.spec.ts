/**
 * Issue #957: [Bug] Formatting going away after creating tasks
 *
 * Bug description:
 * After creating tasks, the TaskNotes formatting/styling disappears.
 * Tasks at the bottom of the document become non-editable.
 *
 * Based on the screenshot, the user sees:
 * - Some tasks display with proper TaskNotes styling/widgets
 * - Other tasks (particularly at the bottom) lose their styling
 * - These unstyled tasks cannot be edited
 *
 * Possible root causes to investigate:
 * 1. CodeMirror decorations not being applied to newly created tasks
 * 2. TaskLinkOverlay failing to process certain task patterns
 * 3. TaskCardNoteDecorations DOM injection failing for some tasks
 * 4. Race condition between task creation and decoration application
 * 5. CSS styling not applied after dynamic content injection
 * 6. contenteditable="false" attribute incorrectly applied to wrong elements
 *
 * @see https://github.com/callumalpass/tasknotes/issues/957
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #957: Formatting disappears after creating tasks', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #957 - formatting should persist after creating multiple tasks',
    async () => {
      /**
       * This test reproduces the core issue: after creating tasks,
       * formatting disappears and tasks become non-editable.
       *
       * Steps:
       * 1. Create a first task
       * 2. Create a second task
       * 3. Create a third task
       * 4. Verify all tasks have consistent styling
       * 5. Verify all tasks are editable
       */
      const page = app.page;

      // Step 1: Create first task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('First Task 957');
      }

      const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1000);

      // Step 2: Create second task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal2 = page.locator('.modal');
      await expect(modal2).toBeVisible({ timeout: 5000 });

      const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput2.fill('Second Task 957');
      }

      const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton2.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1000);

      // Step 3: Create third task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal3 = page.locator('.modal');
      await expect(modal3).toBeVisible({ timeout: 5000 });

      const titleInput3 = modal3.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput3.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput3.fill('Third Task 957');
      }

      const createButton3 = modal3.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton3.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton3.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1500);

      // Step 4: Verify all tasks have consistent styling
      // Check for TaskNotes widgets/styling on all tasks
      const taskCardWidgets = page.locator('.tasknotes-task-card-note-widget, .task-card-note-widget');
      const widgetCount = await taskCardWidgets.count();

      // Also check for task link overlays
      const taskLinkWidgets = page.locator('.tasknotes-task-link-widget');
      const linkWidgetCount = await taskLinkWidgets.count();

      // Log findings for debugging
      console.log(`Task card widgets found: ${widgetCount}`);
      console.log(`Task link widgets found: ${linkWidgetCount}`);

      // At least one type of widget should be present
      expect(widgetCount + linkWidgetCount).toBeGreaterThan(0);

      // Step 5: Verify tasks are editable
      // Check for contenteditable="false" on task content (would indicate non-editable bug)
      const nonEditableElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('[contenteditable="false"]');
        const problematic: string[] = [];
        elements.forEach((el) => {
          // Task widgets are intentionally non-editable, but the task content itself should be editable
          if (!el.classList.contains('task-card-note-widget') &&
              !el.classList.contains('tasknotes-task-card-note-widget') &&
              !el.classList.contains('tasknotes-task-link-widget') &&
              el.closest('.cm-content') &&
              !el.closest('.task-card-note-widget') &&
              !el.closest('.tasknotes-task-card-note-widget')) {
            problematic.push(el.className);
          }
        });
        return problematic;
      });

      // If tasks themselves are non-editable, this would be the bug
      expect(nonEditableElements).toHaveLength(0);
    }
  );

  test.fixme(
    'reproduces issue #957 - task styling should not be lost on document scroll',
    async () => {
      /**
       * This test checks if styling is lost when scrolling through a document
       * with multiple tasks, as this could explain why tasks "at the bottom"
       * lose their formatting.
       *
       * The issue might be related to:
       * - Virtualization in CodeMirror removing decorations
       * - Lazy loading of decorations not re-applying on scroll
       */
      const page = app.page;

      // Open or create a document with multiple tasks
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      // Create content with task links
      const content = `# Test Document for Issue 957

This document tests whether task styling persists after scrolling.

## Tasks Section

Here are some task links:

- [[First Task 957]]
- [[Second Task 957]]
- [[Third Task 957]]

## More content to enable scrolling

${'Lorem ipsum dolor sit amet. '.repeat(100)}

## Tasks at the bottom

These tasks should also have styling:

- [[First Task 957]]
- [[Second Task 957]]
`;

      await page.keyboard.type(content);
      await page.waitForTimeout(1000);

      // Count styled elements before scroll
      const styledBeforeScroll = await page.evaluate(() => {
        return document.querySelectorAll('.tasknotes-task-link-widget, .task-card-note-widget').length;
      });

      console.log(`Styled elements before scroll: ${styledBeforeScroll}`);

      // Scroll to bottom
      await page.evaluate(() => {
        const scroller = document.querySelector('.cm-scroller');
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight;
        }
      });
      await page.waitForTimeout(500);

      // Count styled elements after scroll to bottom
      const styledAfterScrollDown = await page.evaluate(() => {
        return document.querySelectorAll('.tasknotes-task-link-widget, .task-card-note-widget').length;
      });

      console.log(`Styled elements after scroll down: ${styledAfterScrollDown}`);

      // Scroll back to top
      await page.evaluate(() => {
        const scroller = document.querySelector('.cm-scroller');
        if (scroller) {
          scroller.scrollTop = 0;
        }
      });
      await page.waitForTimeout(500);

      // Count styled elements after scroll back up
      const styledAfterScrollUp = await page.evaluate(() => {
        return document.querySelectorAll('.tasknotes-task-link-widget, .task-card-note-widget').length;
      });

      console.log(`Styled elements after scroll up: ${styledAfterScrollUp}`);

      // Styling should persist after scrolling
      // If styling is lost, these assertions will fail
      expect(styledAfterScrollDown).toBeGreaterThanOrEqual(styledBeforeScroll);
      expect(styledAfterScrollUp).toBeGreaterThanOrEqual(styledBeforeScroll);
    }
  );

  test.fixme(
    'reproduces issue #957 - newly created tasks should be immediately editable',
    async () => {
      /**
       * This test verifies that after creating a task, the user can
       * immediately navigate to it and edit its content.
       *
       * The bug report mentions "2 tasks in the bottom aren't editable"
       * which suggests contenteditable or DOM state issues.
       */
      const page = app.page;

      // Create a new task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Editable Test Task 957');
      }

      const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1000);

      // Navigate to the newly created task
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('Editable Test Task 957');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      // Verify we're in the editor
      const editor = page.locator('.cm-editor');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Try to click in the content area and type
      const cmContent = page.locator('.cm-content');
      await cmContent.click();
      await page.waitForTimeout(200);

      // Move to end of document and try to type
      await page.keyboard.press('Control+End');
      await page.waitForTimeout(100);

      // Type some test content
      const testText = '\n\nEditing test: This text should appear.';
      await page.keyboard.type(testText);
      await page.waitForTimeout(500);

      // Verify the text was actually typed
      const pageContent = await page.evaluate(() => {
        const content = document.querySelector('.cm-content');
        return content?.textContent || '';
      });

      // If the task is not editable, this text won't appear
      expect(pageContent).toContain('Editing test: This text should appear.');
    }
  );

  test.fixme(
    'reproduces issue #957 - task card widget CSS should not break editor editability',
    async () => {
      /**
       * This test checks if the task card widget's CSS (particularly
       * contenteditable="false") is incorrectly affecting parent elements.
       *
       * The task card widget itself is non-editable, but it should not
       * prevent editing of the document content.
       */
      const page = app.page;

      // Open a task note
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('First Task 957');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      // Check the DOM structure for contenteditable issues
      const domAnalysis = await page.evaluate(() => {
        const cmContent = document.querySelector('.cm-content');
        const cmEditor = document.querySelector('.cm-editor');
        const taskWidget = document.querySelector('.task-card-note-widget, .tasknotes-task-card-note-widget');

        return {
          cmContentEditable: cmContent?.getAttribute('contenteditable'),
          cmEditorEditable: cmEditor?.getAttribute('contenteditable'),
          taskWidgetEditable: taskWidget?.getAttribute('contenteditable'),
          cmContentContainsNonEditable: cmContent?.querySelector('[contenteditable="false"]') ? true : false,
          widgetIsDescendantOfContent: taskWidget && cmContent?.contains(taskWidget) || false,
        };
      });

      console.log('DOM analysis:', domAnalysis);

      // The cm-content should be editable
      expect(domAnalysis.cmContentEditable).not.toBe('false');

      // The task widget should be non-editable
      if (domAnalysis.taskWidgetEditable !== null) {
        expect(domAnalysis.taskWidgetEditable).toBe('false');
      }

      // If the widget is inside cm-content and non-editable, verify it doesn't break parent
      if (domAnalysis.widgetIsDescendantOfContent) {
        // The widget should have proper isolation (pointer-events, etc.)
        const widgetStyles = await page.evaluate(() => {
          const widget = document.querySelector('.task-card-note-widget, .tasknotes-task-card-note-widget');
          if (!widget) return null;
          const styles = window.getComputedStyle(widget);
          return {
            pointerEvents: styles.pointerEvents,
            userSelect: styles.userSelect,
            position: styles.position,
          };
        });

        console.log('Widget styles:', widgetStyles);
      }
    }
  );
});
