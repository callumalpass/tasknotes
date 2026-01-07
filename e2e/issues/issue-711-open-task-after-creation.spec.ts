/**
 * Issue #711: [FR] Open Task Note in new tab after creating it
 *
 * Feature request:
 * When a user creates a new task via the "TaskNotes: Create new task" command
 * and clicks Save, a notification appears but the user must manually open the
 * task to fill in more details.
 *
 * Proposed solution:
 * Add a setting option that automatically opens the newly created task note
 * in a new tab after creation.
 *
 * Implementation notes:
 * - Add a new setting: "Open task note after creation" (boolean)
 * - When enabled, after TaskCreationModal.handleSave() creates the task,
 *   open the task file using app.workspace.openLinkText(path, "", true)
 * - The third parameter `true` opens in a new tab
 * - Location: src/modals/TaskCreationModal.ts around line 1277-1281
 *
 * @see https://github.com/callumalpass/tasknotes/issues/711
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #711: Open Task Note in new tab after creating it', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #711 - newly created task should optionally open in new tab',
    async () => {
      /**
       * This test verifies the feature request behavior:
       * When a setting is enabled, creating a new task should automatically
       * open the task note in a new tab.
       *
       * Steps:
       * 1. Enable the "Open task note after creation" setting (when implemented)
       * 2. Create a new task via the command palette
       * 3. Verify the task note opens automatically in a new tab
       * 4. Verify the user can immediately edit the task details
       */
      const page = app.page;

      // Step 1: Enable the setting (when implemented)
      // await runCommand(page, 'Open settings');
      // Navigate to TaskNotes settings and enable "Open task note after creation"
      // This step will need to be implemented once the setting exists

      // Step 2: Create a new task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Fill in the task title
      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, .nl-markdown-editor, .cm-content').first();

      // For NLP input (CodeMirror editor)
      const nlpEditor = modal.locator('.nl-markdown-editor .cm-content');
      if (await nlpEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nlpEditor.click();
        await page.keyboard.type('Test Task for Issue 711');
      } else if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await titleInput.fill('Test Task for Issue 711');
      }

      // Save the task
      const saveButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
      } else {
        await page.keyboard.press('Control+Enter');
      }

      // Wait for modal to close
      await page.waitForTimeout(1000);
      await expect(modal).not.toBeVisible({ timeout: 5000 });

      // Step 3: Verify the task note opened automatically
      // Currently this will FAIL because the feature doesn't exist yet
      // The test documents the expected behavior

      // Check if a new tab was opened with the task
      const activeLeaf = page.locator('.workspace-leaf.mod-active');
      await expect(activeLeaf).toBeVisible({ timeout: 3000 });

      // Verify the opened file is the newly created task
      // The view header should show the task title or filename
      const viewHeader = page.locator('.view-header-title');
      const headerText = await viewHeader.textContent();

      // The task file should be open and contain our task title
      expect(headerText).toContain('Test Task for Issue 711');

      // Step 4: Verify we can immediately edit the task
      const editor = page.locator('.cm-editor');
      await expect(editor).toBeVisible({ timeout: 3000 });

      // The task frontmatter should be visible
      const pageContent = await page.evaluate(() => {
        const content = document.querySelector('.cm-content');
        return content?.textContent || '';
      });

      expect(pageContent).toContain('title');
      expect(pageContent).toContain('Test Task for Issue 711');
    }
  );

  test.fixme(
    'reproduces issue #711 - setting disabled should not auto-open task',
    async () => {
      /**
       * This test verifies that when the setting is disabled (default behavior),
       * creating a task does NOT automatically open it.
       *
       * This ensures backwards compatibility with existing user workflows.
       */
      const page = app.page;

      // Ensure the setting is disabled (or use default state)
      // This should be the default behavior

      // Get current tab count before task creation
      const tabsBefore = await page.locator('.workspace-tab-header').count();

      // Create a new task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Fill in the task
      const nlpEditor = modal.locator('.nl-markdown-editor .cm-content');
      if (await nlpEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nlpEditor.click();
        await page.keyboard.type('Task Without Auto-Open 711');
      }

      // Save
      const saveButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
      } else {
        await page.keyboard.press('Control+Enter');
      }

      await page.waitForTimeout(1000);

      // Get tab count after task creation
      const tabsAfter = await page.locator('.workspace-tab-header').count();

      // Verify no new tab was opened (or the same tab is still active)
      // Current behavior: task is created but not opened
      // This test documents the current (pre-feature) behavior
      expect(tabsAfter).toBeLessThanOrEqual(tabsBefore + 1);

      // Verify a success notice was shown
      const notice = page.locator('.notice');
      await expect(notice).toBeVisible({ timeout: 3000 });
    }
  );

  test.fixme(
    'reproduces issue #711 - should open in same tab option',
    async () => {
      /**
       * Extended feature test: Some users might prefer opening in the same tab
       * rather than a new tab. This test documents that potential enhancement.
       *
       * Possible settings:
       * - "Don't open" (default/current behavior)
       * - "Open in same tab"
       * - "Open in new tab"
       */
      const page = app.page;

      // This test is for an extended version of the feature
      // where users can choose between:
      // 1. Don't open (current)
      // 2. Open in current tab
      // 3. Open in new tab

      // The implementation could use a dropdown setting instead of a toggle

      // For now, just verify basic task creation works
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const nlpEditor = modal.locator('.nl-markdown-editor .cm-content');
      if (await nlpEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nlpEditor.click();
        await page.keyboard.type('Task Same Tab Test 711');
      }

      const saveButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
      } else {
        await page.keyboard.press('Control+Enter');
      }

      await page.waitForTimeout(1000);
      await expect(modal).not.toBeVisible({ timeout: 5000 });

      // Test passes if task creation succeeded
      // Actual "open in same tab" behavior depends on implementation
    }
  );
});
