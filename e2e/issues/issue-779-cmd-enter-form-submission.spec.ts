/**
 * Issue #779: [FR] Support form submission via `cmd+enter`/`ctrl+enter`
 *
 * Feature Request Description:
 * Often to submit forms, users can use `cmd+enter` (or `ctrl+enter` on Windows)
 * to activate the submit action / submit button.
 *
 * The user describes using the "Create new Task" workflow and wanting to
 * quickly submit after entering title, description, and tags using keyboard
 * shortcuts rather than tabbing to the Save button.
 *
 * Current behavior:
 * - There IS a keyboard handler for Ctrl/Cmd+Enter in TaskModal.ts that triggers save
 * - However, the handler skips events from CodeMirror editors (.cm-editor)
 * - The save button doesn't have a visible focus state
 *
 * Potential issues to verify:
 * 1. Does Cmd/Ctrl+Enter work consistently from all form fields?
 * 2. Does it work when focused on the title input?
 * 3. Does it work when focused on the markdown details editor?
 * 4. Does the NLP editor properly handle the shortcut?
 *
 * Implementation considerations from the issue:
 * - May need to use native `<form>` HTML elements
 * - Save buttons could be `<button type="submit">`
 *
 * @see https://github.com/callumalpass/tasknotes/issues/779
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #779: cmd+enter / ctrl+enter form submission', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'FR #779 - Cmd/Ctrl+Enter should submit task creation modal from title input',
    async () => {
      /**
       * This test verifies that pressing Cmd/Ctrl+Enter while focused on the
       * title input field will submit the task creation form.
       *
       * Steps:
       * 1. Open Create new task modal
       * 2. Enter a title in the title input field
       * 3. Press Cmd/Ctrl+Enter while still focused on title input
       * 4. Verify the modal closes and task is created
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Find and fill the title input
      const titleInput = taskModal.locator('input[type="text"]').first();
      await expect(titleInput).toBeVisible({ timeout: 2000 });

      const testTitle = `Test task cmd+enter title input ${Date.now()}`;
      await titleInput.fill(testTitle);
      await page.waitForTimeout(200);

      // Ensure focus is on title input
      await titleInput.focus();
      await page.waitForTimeout(100);

      // Press Cmd/Ctrl+Enter to submit
      await page.keyboard.press('ControlOrMeta+Enter');
      await page.waitForTimeout(1000);

      // Modal should close after successful submission
      const modalStillVisible = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);
      expect(modalStillVisible).toBe(false);

      // Verify a notice appeared confirming task creation
      const notice = page.locator('.notice').filter({ hasText: /created|saved/i });
      const noticeVisible = await notice.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Task creation notice visible:', noticeVisible);
    }
  );

  test.fixme(
    'FR #779 - Cmd/Ctrl+Enter should submit task creation modal from details editor',
    async () => {
      /**
       * This test verifies that pressing Cmd/Ctrl+Enter while focused on the
       * markdown details editor will submit the task creation form.
       *
       * Note: The current implementation SKIPS events from .cm-editor elements,
       * relying on the editor's own onSubmit handler. This test verifies that
       * the submit action still works when using the details editor.
       *
       * Steps:
       * 1. Open Create new task modal
       * 2. Enter a title
       * 3. Expand the details section and focus on the details editor
       * 4. Type some details content
       * 5. Press Cmd/Ctrl+Enter while in details editor
       * 6. Verify the modal closes and task is created
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Fill the title first
      const titleInput = taskModal.locator('input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 1000 })) {
        const testTitle = `Test task cmd+enter details editor ${Date.now()}`;
        await titleInput.fill(testTitle);
        await page.waitForTimeout(200);
      }

      // Look for details section toggle / expand button
      const expandButton = taskModal.locator('button, .clickable-icon').filter({
        hasText: /details|expand|more/i,
      });
      if (await expandButton.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(300);
      }

      // Find the details editor (CodeMirror-based)
      const detailsEditor = taskModal.locator('.cm-editor');
      const editorExists = await detailsEditor.isVisible({ timeout: 2000 }).catch(() => false);

      if (editorExists) {
        // Click to focus the editor
        await detailsEditor.click();
        await page.waitForTimeout(200);

        // Type some details
        await page.keyboard.type('Test details content');
        await page.waitForTimeout(200);

        // Press Cmd/Ctrl+Enter to submit from within the editor
        await page.keyboard.press('ControlOrMeta+Enter');
        await page.waitForTimeout(1000);

        // Modal should close after successful submission
        const modalStillVisible = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);
        expect(modalStillVisible).toBe(false);
      } else {
        // If no details editor found, the test documents that it should exist
        console.log('Details editor not found - may need to expand details section');
        expect(editorExists).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #779 - Cmd/Ctrl+Enter should submit task creation modal from NLP input',
    async () => {
      /**
       * This test verifies that pressing Cmd/Ctrl+Enter while focused on the
       * Natural Language Processing (NLP) input will submit the task creation form.
       *
       * The NLP input is an alternative mode for task creation where users can
       * type natural language like "Buy groceries tomorrow #shopping @errands"
       *
       * Steps:
       * 1. Open Create new task modal
       * 2. If NLP mode is available, switch to it
       * 3. Enter a natural language task description
       * 4. Press Cmd/Ctrl+Enter while in NLP input
       * 5. Verify the modal closes and task is created
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Look for NLP input - it may be a CodeMirror editor with specific class
      const nlpEditor = taskModal.locator('.nlp-input, .cm-editor').first();
      const nlpExists = await nlpEditor.isVisible({ timeout: 2000 }).catch(() => false);

      if (nlpExists) {
        // Focus the NLP input
        await nlpEditor.click();
        await page.waitForTimeout(200);

        // Type a natural language task
        const testTask = `Test NLP task ${Date.now()} tomorrow #test`;
        await page.keyboard.type(testTask);
        await page.waitForTimeout(200);

        // Press Cmd/Ctrl+Enter to submit
        await page.keyboard.press('ControlOrMeta+Enter');
        await page.waitForTimeout(1000);

        // Modal should close after successful submission
        const modalStillVisible = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);
        expect(modalStillVisible).toBe(false);
      } else {
        // Document that NLP input exists and should support this shortcut
        console.log('NLP input mode not found or not visible');
      }
    }
  );

  test.fixme(
    'FR #779 - Cmd/Ctrl+Enter should submit task edit modal',
    async () => {
      /**
       * This test verifies that Cmd/Ctrl+Enter also works in the task edit modal,
       * not just the creation modal. Users should have a consistent experience
       * across both modals.
       *
       * Steps:
       * 1. Create a task
       * 2. Open the task for editing
       * 3. Make a change to the task
       * 4. Press Cmd/Ctrl+Enter to save
       * 5. Verify changes are saved
       */
      const page = app.page;

      // First, create a task to edit
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const createModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await createModal.isVisible({ timeout: 3000 })) {
        const titleInput = createModal.locator('input[type="text"]').first();
        const testTitle = `Test task for editing ${Date.now()}`;
        await titleInput.fill(testTitle);

        // Save using the button first
        const saveButton = createModal.locator('button.mod-cta').filter({ hasText: /save|create/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Now open the task for editing
      // This could be done by clicking on the task or using a command
      await runCommand(page, 'TaskNotes: Edit current task');
      await page.waitForTimeout(500);

      const editModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await editModal.isVisible({ timeout: 3000 })) {
        // Modify the title
        const titleInput = editModal.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 1000 })) {
          await titleInput.fill('Modified title via cmd+enter');
          await page.waitForTimeout(200);

          // Make sure title input is focused
          await titleInput.focus();
          await page.waitForTimeout(100);

          // Press Cmd/Ctrl+Enter to save
          await page.keyboard.press('ControlOrMeta+Enter');
          await page.waitForTimeout(1000);

          // Modal should close
          const modalStillVisible = await editModal.isVisible({ timeout: 2000 }).catch(() => false);
          expect(modalStillVisible).toBe(false);
        }
      }
    }
  );

  test.fixme(
    'FR #779 - Cmd/Ctrl+Enter should work from tag/context input fields',
    async () => {
      /**
       * This test verifies that Cmd/Ctrl+Enter works when focused on
       * tag or context input fields (text inputs with autocomplete).
       *
       * Steps:
       * 1. Open Create new task modal
       * 2. Enter a title
       * 3. Tab to or click on a tag/context input field
       * 4. Enter a tag
       * 5. Press Cmd/Ctrl+Enter while focused on tag input
       * 6. Verify modal closes and task is created with tag
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Fill the title first
      const titleInput = taskModal.locator('input[type="text"]').first();
      const testTitle = `Test task tags input ${Date.now()}`;
      await titleInput.fill(testTitle);
      await page.waitForTimeout(200);

      // Look for expand/details button to show more fields
      const expandButton = taskModal.locator('button, .clickable-icon').filter({
        hasText: /details|expand|more/i,
      });
      if (await expandButton.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandButton.first().click();
        await page.waitForTimeout(300);
      }

      // Find tag input - might be labeled "Tags", "Labels", etc.
      const tagInput = taskModal.locator('input[placeholder*="tag" i], input[placeholder*="label" i], .tag-input input');
      const tagInputVisible = await tagInput.first().isVisible({ timeout: 1000 }).catch(() => false);

      if (tagInputVisible) {
        // Click and type in tag input
        await tagInput.first().click();
        await page.waitForTimeout(200);
        await page.keyboard.type('test-tag');
        await page.waitForTimeout(200);

        // Press Cmd/Ctrl+Enter to submit
        await page.keyboard.press('ControlOrMeta+Enter');
        await page.waitForTimeout(1000);

        // Modal should close
        const modalStillVisible = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);
        expect(modalStillVisible).toBe(false);
      } else {
        console.log('Tag input field not found in expanded modal');
      }
    }
  );

  test.fixme(
    'FR #779 - Save button should have visible focus state',
    async () => {
      /**
       * The issue mentions that the save button doesn't have an active/focus state,
       * making it impossible to know when focused via keyboard navigation.
       *
       * This test verifies that the Save button has appropriate focus styling.
       *
       * Steps:
       * 1. Open Create new task modal
       * 2. Tab through form fields until Save button is focused
       * 3. Verify Save button has visible focus indicator (outline, ring, etc.)
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Find the save button
      const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save|create/i });
      await expect(saveButton).toBeVisible({ timeout: 2000 });

      // Tab repeatedly to navigate to save button
      // Count of tabs depends on number of form fields
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        // Check if save button is focused
        const isFocused = await page.evaluate((btnSelector) => {
          const btn = document.querySelector(btnSelector);
          return btn === document.activeElement;
        }, 'button.mod-cta');

        if (isFocused) {
          break;
        }
      }

      // Verify the button is focused
      const isButtonFocused = await page.evaluate(() => {
        const btn = document.querySelector('button.mod-cta');
        return btn === document.activeElement;
      });

      if (isButtonFocused) {
        // Check if there's a visible focus indicator
        const focusStyles = await saveButton.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            outline: styles.outline,
            outlineWidth: styles.outlineWidth,
            outlineColor: styles.outlineColor,
            boxShadow: styles.boxShadow,
            border: styles.border,
          };
        });

        console.log('Save button focus styles:', focusStyles);

        // Button should have some visible focus indicator
        // Check for outline or box-shadow that's not "none" or "0px"
        const hasVisibleOutline =
          focusStyles.outline !== 'none' &&
          focusStyles.outlineWidth !== '0px';
        const hasVisibleShadow =
          focusStyles.boxShadow !== 'none' &&
          focusStyles.boxShadow !== '';

        expect(hasVisibleOutline || hasVisibleShadow).toBe(true);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  );

  test.fixme(
    'FR #779 - native form element approach (implementation consideration)',
    async () => {
      /**
       * This test documents the potential implementation approach suggested in the issue:
       * using native HTML `<form>` elements with `<button type="submit">`.
       *
       * Benefits of native form approach:
       * - Native keyboard submission support
       * - Better accessibility (form roles, labels)
       * - Enter key in inputs triggers submit by default
       * - Better integration with browser autofill
       *
       * This test checks if native form elements are currently used.
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Check if there's a native form element
      const formElement = taskModal.locator('form');
      const hasNativeForm = await formElement.isVisible({ timeout: 1000 }).catch(() => false);

      console.log('Has native <form> element:', hasNativeForm);

      // Check if save button has type="submit"
      const saveButton = taskModal.locator('button.mod-cta');
      const buttonType = await saveButton.getAttribute('type').catch(() => null);

      console.log('Save button type attribute:', buttonType);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Document expected behavior (feature request to implement native forms)
      // Currently, the codebase uses custom event handlers instead of native forms
      // The feature request suggests changing to native form elements
      expect(hasNativeForm).toBe(true);
      expect(buttonType).toBe('submit');
    }
  );
});
