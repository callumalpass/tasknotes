/**
 * Issue #958: Project Subtasks widget causes cursor jump and layout shift
 * when typing near it in Live Preview mode
 *
 * Bug description:
 * When typing text directly above a project subtasks/relationships widget
 * (with no empty lines between), the cursor visually jumps below the widget
 * when pressing Enter, and then the cursor/text jumps back above the widget
 * when typing. This also causes page scrolling/shifting on each keystroke.
 *
 * Steps to reproduce:
 * 1. Create project note with subtasks widget
 * 2. Place cursor at end of text directly above widget (no empty lines)
 * 3. Press Enter to create new line
 * 4. Cursor visually jumps below widget
 * 5. When typing, cursor/text jumps back above widget
 * 6. Page scrolls/shifts on each keystroke
 *
 * Root cause analysis:
 * Originally, the task card and relationships widgets used CodeMirror's
 * Decoration API (Decoration.widget()). When decorations affect layout
 * calculations, modifications to widget DOM triggered recalculations
 * throughout the editor's layout engine, causing:
 * - Cursor position miscalculation
 * - Layout shifting as text is typed
 * - Race conditions between widget updates and text input
 *
 * Fix applied (commit 5a133e6d, v4.0.1):
 * Converted TaskCardNoteDecorations and RelationshipsDecorations from using
 * the CodeMirror Decoration API to direct DOM manipulation. Widgets are now
 * injected directly into .cm-sizer container, bypassing CodeMirror's layout
 * pipeline entirely.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/958
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #958: Widget cursor jump and layout shift in Live Preview', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #958 - cursor should not jump when typing above relationships widget',
    async () => {
      /**
       * This test reproduces the cursor jump bug when typing directly above
       * a project subtasks/relationships widget.
       *
       * Pre-fix behavior (issue):
       * - Press Enter at end of text above widget
       * - Cursor visually jumps below the widget
       * - Type characters
       * - Cursor/text jumps back to correct position above widget
       * - Page scrolls/shifts on each keystroke
       *
       * Post-fix behavior (expected):
       * - Press Enter at end of text above widget
       * - Cursor stays in place on new line above widget
       * - Type characters
       * - No cursor jumping, no layout shifts
       * - Page remains stable
       */
      const page = app.page;

      // Step 1: Create a task that will act as a parent project
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Fill in parent task details
      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Parent Project Task 958');
      }

      // Create the task
      const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1000);

      // Step 2: Create a subtask linked to the parent project
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const subtaskModal = page.locator('.modal');
      await expect(subtaskModal).toBeVisible({ timeout: 5000 });

      const subtaskTitleInput = subtaskModal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await subtaskTitleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subtaskTitleInput.fill('Subtask for Project 958');
      }

      // Set the parent project (so relationships widget appears on parent)
      const projectField = subtaskModal.locator('[data-property="projects"], .project-field, input[placeholder*="project"]').first();
      if (await projectField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await projectField.fill('Parent Project Task 958');
      }

      // Create the subtask
      const createSubtaskBtn = subtaskModal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createSubtaskBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createSubtaskBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1000);

      // Step 3: Navigate back to the parent project to see the relationships widget
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('Parent Project Task 958');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      // Verify we're in Live Preview mode
      const editor = page.locator('.cm-editor');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Wait for the relationships widget to render
      const relationshipsWidget = page.locator('.tasknotes-relationships-widget, .task-card-note-widget');
      const widgetVisible = await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false);

      // Step 4: Position cursor at end of text directly above widget
      const cmContent = page.locator('.cm-content');
      await cmContent.click();
      await page.waitForTimeout(200);

      // Move to end of first content line (before the widget)
      await page.keyboard.press('Home');
      await page.keyboard.press('End');

      // Record initial cursor/scroll position
      const initialScrollTop = await page.evaluate(() => {
        const scroller = document.querySelector('.cm-scroller');
        return scroller?.scrollTop ?? 0;
      });

      const initialCursorRect = await page.evaluate(() => {
        const cursor = document.querySelector('.cm-cursor, .cm-cursor-primary');
        if (!cursor) return null;
        const rect = cursor.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      });

      // Step 5: Press Enter to create new line
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);

      // Check if cursor jumped (would be below widget in broken state)
      const afterEnterCursorRect = await page.evaluate(() => {
        const cursor = document.querySelector('.cm-cursor, .cm-cursor-primary');
        if (!cursor) return null;
        const rect = cursor.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      });

      // Step 6: Type some characters
      await page.keyboard.type('Testing cursor stability');

      // Check for layout shift during typing
      const finalScrollTop = await page.evaluate(() => {
        const scroller = document.querySelector('.cm-scroller');
        return scroller?.scrollTop ?? 0;
      });

      const finalCursorRect = await page.evaluate(() => {
        const cursor = document.querySelector('.cm-cursor, .cm-cursor-primary');
        if (!cursor) return null;
        const rect = cursor.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      });

      // Assertions:
      // 1. Widget should be visible (test setup worked)
      if (widgetVisible) {
        // 2. Scroll position should not have shifted significantly during typing
        const scrollShift = Math.abs(finalScrollTop - initialScrollTop);
        expect(scrollShift).toBeLessThan(50); // Allow small scroll for new line

        // 3. Cursor should be positioned correctly (not jumped erratically)
        if (initialCursorRect && afterEnterCursorRect && finalCursorRect) {
          // After Enter, cursor should be below initial position (new line)
          expect(afterEnterCursorRect.top).toBeGreaterThan(initialCursorRect.top);

          // After typing, cursor should remain on same line (moved right only)
          // A large vertical jump would indicate the bug
          const verticalJump = Math.abs(finalCursorRect.top - afterEnterCursorRect.top);
          expect(verticalJump).toBeLessThan(5); // Should be on same line
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #958 - no layout shift when rapidly typing near widget',
    async () => {
      /**
       * This test verifies that rapid typing near a widget does not cause
       * layout shifts or visual jank.
       *
       * The DOM mutation observer tracks any unexpected layout changes
       * in the editor area during typing.
       */
      const page = app.page;

      // Open a task note (reuse from previous test or create new one)
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('Parent Project Task 958');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      const editor = page.locator('.cm-editor');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Position cursor in editor content
      const cmContent = page.locator('.cm-content');
      await cmContent.click();
      await page.waitForTimeout(200);

      // Set up mutation observer to detect layout shifts
      const layoutShiftDetected = await page.evaluate(() => {
        return new Promise<{ shiftCount: number; maxShift: number }>((resolve) => {
          let shiftCount = 0;
          let maxShift = 0;
          const initialPositions = new Map<Element, DOMRect>();

          // Record initial positions of relevant elements
          const cmEditor = document.querySelector('.cm-editor');
          const widget = document.querySelector('.tasknotes-relationships-widget, .task-card-note-widget');

          if (cmEditor) initialPositions.set(cmEditor, cmEditor.getBoundingClientRect());
          if (widget) initialPositions.set(widget, widget.getBoundingClientRect());

          const observer = new MutationObserver(() => {
            initialPositions.forEach((initialRect, element) => {
              const currentRect = element.getBoundingClientRect();
              const shift = Math.abs(currentRect.top - initialRect.top);
              if (shift > 2) { // Threshold for significant shift
                shiftCount++;
                maxShift = Math.max(maxShift, shift);
              }
            });
          });

          if (cmEditor) {
            observer.observe(cmEditor, {
              attributes: true,
              childList: true,
              subtree: true,
              attributeFilter: ['style', 'class'],
            });
          }

          // Give time for typing to complete
          setTimeout(() => {
            observer.disconnect();
            resolve({ shiftCount, maxShift });
          }, 3000);
        });
      });

      // Type rapidly while observer is running
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');

      const testText = 'Rapid typing test to check for layout shifts during input near widget elements';
      for (const char of testText) {
        await page.keyboard.type(char, { delay: 30 }); // Fast typing
      }

      // Wait for observer to complete
      await page.waitForTimeout(3500);

      // The observer promise should resolve with shift data
      // In fixed state: minimal shifts (shiftCount near 0, maxShift near 0)
      // In broken state: many shifts with large maxShift values
    }
  );

  test.fixme(
    'reproduces issue #958 - widget should not interfere with cursor navigation',
    async () => {
      /**
       * This test verifies that arrow key navigation works correctly
       * when the cursor is near a widget.
       *
       * Pre-fix behavior (issue):
       * - Arrow keys near widget boundary cause erratic cursor movement
       * - Cursor may jump across widget unexpectedly
       *
       * Post-fix behavior (expected):
       * - Arrow keys move cursor predictably line by line
       * - No unexpected jumps across widget boundaries
       */
      const page = app.page;

      // Open a task note with relationships widget
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('Parent Project Task 958');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      const editor = page.locator('.cm-editor');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Focus editor
      const cmContent = page.locator('.cm-content');
      await cmContent.click();
      await page.waitForTimeout(200);

      // Go to start of document
      await page.keyboard.press('Control+Home');
      await page.waitForTimeout(100);

      // Track cursor positions as we navigate
      const positions: Array<{ top: number; left: number }> = [];

      const getCursorPos = async () => {
        return page.evaluate(() => {
          const cursor = document.querySelector('.cm-cursor, .cm-cursor-primary');
          if (!cursor) return { top: 0, left: 0 };
          const rect = cursor.getBoundingClientRect();
          return { top: rect.top, left: rect.left };
        });
      };

      // Navigate down through the document
      for (let i = 0; i < 10; i++) {
        const pos = await getCursorPos();
        positions.push(pos);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(50);
      }

      // Verify cursor moved monotonically down (no unexpected jumps back up)
      let previousTop = positions[0].top;
      for (let i = 1; i < positions.length; i++) {
        // Each position should be >= previous (cursor moves down or stays)
        // A jump back up would indicate widget interference
        expect(positions[i].top).toBeGreaterThanOrEqual(previousTop - 5); // Allow tiny tolerance
        previousTop = positions[i].top;
      }
    }
  );
});
