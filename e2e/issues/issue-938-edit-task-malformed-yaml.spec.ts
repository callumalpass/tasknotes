/**
 * Issue #938: [Bug] Failed to update task when using Edit task details command
 *
 * Bug: When using "Edit task details" command on a note that does not have proper
 * TaskNotes YAML format, the user gets a "Failed to update task" error.
 *
 * Previous behavior (reported to work "two releases ago"):
 * - The command would add whatever YAML was needed for converting old notes to TaskNotes
 * - This was helpful for converting existing notes into TaskNotes
 *
 * Current behavior (v3.25.3+):
 * - The command fails with "Failed to update task" error
 * - The file is not updated with required TaskNotes frontmatter
 *
 * Root cause analysis:
 * - When updateTask() is called on a file with invalid/incomplete frontmatter,
 *   Obsidian's processFrontMatter may fail if the YAML is malformed
 * - The code expects valid TaskInfo structure but file may have partial/invalid data
 * - The error handling shows "Failed to update task" but doesn't provide recovery
 *
 * Feature request (also mentioned in issue):
 * - Add a command/hotkey that converts any note into a TaskNote
 * - Should add needed YAML, Tag, and move to correct folder in one command
 *
 * @see https://github.com/callumalpass/tasknotes/issues/938
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #938: Failed to update task with malformed YAML', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #938 - Edit task details should handle file with partial frontmatter',
    async () => {
      /**
       * This test verifies that editing a task file with partial/incomplete
       * frontmatter doesn't fail with "Failed to update task" error.
       *
       * Steps:
       * 1. Create a file with partial TaskNotes frontmatter (e.g., only has task tag)
       * 2. Open the file
       * 3. Use Quick Actions > "Edit task details"
       * 4. Make a change and save
       * 5. Verify the task is updated successfully without errors
       */
      const page = app.page;

      // Create a note with partial frontmatter (task tag but missing other required fields)
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content');
      if (await editor.isVisible({ timeout: 2000 })) {
        // Type partial frontmatter - has task tag but minimal/incomplete structure
        const partialFrontmatter = `---
tags:
  - task
---

This is a note with partial TaskNotes frontmatter.
`;
        await page.keyboard.type(partialFrontmatter);
        await page.waitForTimeout(500);
      }

      // Save the file
      await page.keyboard.press('ControlOrMeta+s');
      await page.waitForTimeout(1000);

      // Open Quick Actions for current task
      await runCommand(page, 'TaskNotes: Quick actions for current task');
      await page.waitForTimeout(500);

      // Select "Edit task details" from the action palette
      const actionPalette = page.locator('.task-action-palette-modal');
      if (await actionPalette.isVisible({ timeout: 2000 })) {
        const editAction = actionPalette.locator('.suggestion-item').filter({
          hasText: /edit task details/i,
        });

        if (await editAction.isVisible({ timeout: 1000 })) {
          await editAction.click();
          await page.waitForTimeout(500);
        }
      }

      // Check if task edit modal opened
      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      const modalOpened = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);

      if (modalOpened) {
        // Make a simple change (e.g., set priority)
        const prioritySelector = taskModal.locator('[data-field="priority"], .priority-selector');
        if (await prioritySelector.isVisible({ timeout: 1000 })) {
          await prioritySelector.click();
          await page.waitForTimeout(300);
        }

        // Click save
        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Check for error notice
      const errorNotice = page.locator('.notice').filter({
        hasText: /failed to update task/i,
      });
      const hasError = await errorNotice.isVisible({ timeout: 1000 }).catch(() => false);

      // Check for success notice
      const successNotice = page.locator('.notice').filter({
        hasText: /updated|saved/i,
      });
      const hasSuccess = await successNotice.isVisible({ timeout: 1000 }).catch(() => false);

      // The bug would cause hasError to be true
      // Expected behavior: no error, task updated successfully
      expect(hasError).toBe(false);
      expect(hasSuccess).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #938 - Edit task details should handle file with malformed YAML',
    async () => {
      /**
       * This test verifies that editing a task file with malformed YAML
       * provides graceful error handling or recovery.
       *
       * Steps:
       * 1. Create a file with malformed frontmatter
       * 2. Manually add task tag to make it recognized as a task
       * 3. Try to edit via Quick Actions
       * 4. Verify appropriate error handling
       */
      const page = app.page;

      // Create a note with malformed frontmatter
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content');
      if (await editor.isVisible({ timeout: 2000 })) {
        // Malformed YAML (invalid indentation, missing quotes where needed)
        const malformedFrontmatter = `---
tags:
  - task
status: open
priority: high
due: invalid-date-format
contexts: [unclosed array
---

A note with malformed YAML.
`;
        await page.keyboard.type(malformedFrontmatter);
        await page.waitForTimeout(500);
      }

      // Save the file
      await page.keyboard.press('ControlOrMeta+s');
      await page.waitForTimeout(1000);

      // Try to open Quick Actions
      await runCommand(page, 'TaskNotes: Quick actions for current task');
      await page.waitForTimeout(500);

      // The system should either:
      // 1. Handle the malformed YAML gracefully and allow editing
      // 2. Show a helpful error about the YAML issue
      const actionPalette = page.locator('.task-action-palette-modal');
      const helpfulNotice = page.locator('.notice').filter({
        hasText: /yaml|format|invalid|malformed/i,
      });
      const genericError = page.locator('.notice').filter({
        hasText: /failed to update task/i,
      });

      const actionPaletteOpened = await actionPalette.isVisible({ timeout: 2000 }).catch(() => false);
      const hasHelpfulNotice = await helpfulNotice.isVisible({ timeout: 1000 }).catch(() => false);
      const hasGenericError = await genericError.isVisible({ timeout: 1000 }).catch(() => false);

      // Expected: Either palette opens (graceful handling) OR helpful notice
      // Bug: Generic "Failed to update task" error without helpful context
      const isHandledGracefully = actionPaletteOpened || hasHelpfulNotice;

      // If there's an error, it should be helpful, not generic
      if (hasGenericError && !hasHelpfulNotice) {
        console.log('BUG: Generic error shown instead of helpful YAML error message');
      }

      expect(isHandledGracefully || !hasGenericError).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #938 - Edit task details should add missing required fields',
    async () => {
      /**
       * This test verifies that editing a task with missing required fields
       * automatically adds those fields (the original behavior the user expected).
       *
       * Steps:
       * 1. Create a file with only task tag (minimal recognition)
       * 2. Edit via Quick Actions
       * 3. Save without changing anything
       * 4. Verify required fields like status, priority, dateCreated are added
       */
      const page = app.page;

      // Create a minimal task note (just task tag)
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content');
      if (await editor.isVisible({ timeout: 2000 })) {
        const minimalFrontmatter = `---
tags:
  - task
---

A minimal task note without status, priority, or dates.
`;
        await page.keyboard.type(minimalFrontmatter);
        await page.waitForTimeout(500);
      }

      // Save and get file path
      await page.keyboard.press('ControlOrMeta+s');
      await page.waitForTimeout(1000);

      // Open and save via Edit task details
      await runCommand(page, 'TaskNotes: Quick actions for current task');
      await page.waitForTimeout(500);

      const actionPalette = page.locator('.task-action-palette-modal');
      if (await actionPalette.isVisible({ timeout: 2000 })) {
        const editAction = actionPalette.locator('.suggestion-item').filter({
          hasText: /edit task details/i,
        });

        if (await editAction.isVisible({ timeout: 1000 })) {
          await editAction.click();
          await page.waitForTimeout(500);
        }
      }

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await taskModal.isVisible({ timeout: 2000 })) {
        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Read the file content and check frontmatter
      await page.keyboard.press('ControlOrMeta+e'); // Toggle source mode
      await page.waitForTimeout(500);

      const sourceContent = await editor.textContent().catch(() => '');

      // Verify required fields were added
      const hasStatus = /status:\s*\w+/.test(sourceContent);
      const hasPriority = /priority:\s*\w+/.test(sourceContent);
      const hasDateCreated = /dateCreated:/.test(sourceContent) || /date_created:/.test(sourceContent);

      // Expected behavior (as reported by user):
      // Edit should automatically add missing required fields
      expect(hasStatus).toBe(true);
      expect(hasPriority).toBe(true);
      // dateCreated might be optional depending on settings
    }
  );

  test.fixme(
    'FR from issue #938 - command to convert note to task with full setup',
    async () => {
      /**
       * This test covers the feature request mentioned in issue #938:
       * A command that converts any note into a TaskNote by:
       * - Adding needed YAML frontmatter
       * - Adding the task tag
       * - Moving to correct folder
       *
       * Note: There is already a "Convert current note to task" command.
       * This test verifies it works as expected or identifies gaps.
       */
      const page = app.page;

      // Create a regular note (not a task)
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content');
      if (await editor.isVisible({ timeout: 2000 })) {
        await page.keyboard.type('This is just a regular note that I want to convert to a task.');
        await page.waitForTimeout(300);
      }

      // Save the note
      await page.keyboard.press('ControlOrMeta+s');
      await page.waitForTimeout(1000);

      // Use the convert command
      await runCommand(page, 'TaskNotes: Convert current note to task');
      await page.waitForTimeout(1000);

      // The task edit modal should open with the note's content
      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      const modalOpened = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);

      if (modalOpened) {
        // Fill in a title and save
        const titleInput = taskModal.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 1000 })) {
          await titleInput.fill('Converted task from note');
        }

        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Check for errors
      const errorNotice = page.locator('.notice').filter({
        hasText: /failed|error/i,
      });
      const hasError = await errorNotice.isVisible({ timeout: 1000 }).catch(() => false);

      // Check for success
      const successNotice = page.locator('.notice').filter({
        hasText: /converted|created|success/i,
      });
      const hasSuccess = await successNotice.isVisible({ timeout: 1000 }).catch(() => false);

      // Verify the note now has task properties
      await page.keyboard.press('ControlOrMeta+e'); // Toggle to source mode
      await page.waitForTimeout(500);

      const sourceContent = await editor.textContent().catch(() => '');
      const hasTaskTag = sourceContent.includes('task') && sourceContent.includes('tags');
      const hasStatus = /status:/.test(sourceContent);

      expect(modalOpened).toBe(true);
      expect(hasError).toBe(false);
      expect(hasTaskTag).toBe(true);
      expect(hasStatus).toBe(true);
    }
  );

  test.fixme(
    'FR from issue #938 - convert note should move to tasks folder',
    async () => {
      /**
       * This test verifies the feature request that converting a note
       * should also move it to the configured tasks folder.
       *
       * Current behavior may not move the file.
       * Desired behavior: Move to tasks folder (configurable).
       */
      const page = app.page;

      // Create a note in a random location (not tasks folder)
      await runCommand(page, 'Create new note in folder');
      await page.waitForTimeout(500);

      // Select a non-tasks folder if prompted
      const folderPicker = page.locator('.suggestion-container, .prompt');
      if (await folderPicker.isVisible({ timeout: 1000 })) {
        // Just press enter to use default or escape and create normally
        await page.keyboard.press('Escape');
      }

      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      const editor = page.locator('.cm-editor .cm-content');
      if (await editor.isVisible({ timeout: 2000 })) {
        await page.keyboard.type('Note to be converted and moved');
        await page.waitForTimeout(300);
      }

      // Save and get original path
      await page.keyboard.press('ControlOrMeta+s');
      await page.waitForTimeout(1000);

      // Get the file path from the tab or title
      const fileTab = page.locator('.workspace-tab-header.is-active');
      const originalFileName = await fileTab.textContent().catch(() => 'Unknown');

      // Convert to task
      await runCommand(page, 'TaskNotes: Convert current note to task');
      await page.waitForTimeout(1000);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await taskModal.isVisible({ timeout: 2000 })) {
        const titleInput = taskModal.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 1000 })) {
          await titleInput.fill('Task moved to folder');
        }

        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Check if file was moved to tasks folder
      // This would require checking the file explorer or the active file path
      const newFileTab = page.locator('.workspace-tab-header.is-active');
      const newPath = await newFileTab.getAttribute('aria-label').catch(() => '');

      // If the settings have a tasks folder configured, the file should be moved there
      // For now, we just verify the test framework works
      const fileMoved = newPath !== originalFileName && newPath.toLowerCase().includes('task');

      // This is a feature request - current behavior may not move the file
      console.log(`Original: ${originalFileName}, New path: ${newPath}`);
      console.log(`File moved to tasks folder: ${fileMoved}`);

      // Feature request expects this to be true
      expect(fileMoved).toBe(true);
    }
  );
});
