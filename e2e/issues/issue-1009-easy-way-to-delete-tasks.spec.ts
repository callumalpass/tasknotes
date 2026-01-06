/**
 * Issue #1009: [FR]: Easy way of deleting tasks
 *
 * Feature request for a Delete button in the task modal preview to allow
 * users to easily delete tasks without navigating to the task file.
 *
 * Problem:
 * - Currently, the modal preview only offers an Archive option
 * - Users who want to permanently delete tasks find archived tasks "polluting" the directory
 * - Going to each task's file to delete it manually is tedious, especially for multiple tasks
 * - There's no quick way to remove unwanted tasks from within the modal
 *
 * Requested behavior:
 * - Add a "Delete" button in the task modal preview alongside the existing Archive button
 * - Include a confirmation prompt to prevent accidental deletions
 * - When deleted, the task file should be permanently removed from the vault
 *
 * Implementation considerations:
 * - Add deleteTask() method to TaskService (similar to toggleArchive but removes file)
 * - Add a Delete button in TaskEditModal.createActionButtons()
 * - Use ConfirmationModal for deletion confirmation
 * - Update cache and trigger appropriate events (EVENT_TASK_DELETED)
 * - Handle Google Calendar sync cleanup if applicable
 * - Add appropriate i18n translation strings
 *
 * Affected areas:
 * - src/services/TaskService.ts - new deleteTask() method
 * - src/modals/TaskEditModal.ts - new Delete button and confirmation flow
 * - src/types/events.ts - EVENT_TASK_DELETED constant
 * - src/i18n/resources/*.ts - translation strings
 * - styles/task-modal.css - button styling (optional)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1009
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1009: Easy way of deleting tasks', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1009 - no Delete button in task modal preview', async () => {
    /**
     * This test verifies the core problem: there is no Delete button in the
     * task modal preview - only Archive is available.
     *
     * STEPS TO REPRODUCE:
     * 1. Create a new task
     * 2. Open the task in the modal preview (task edit modal)
     * 3. Look for action buttons at the bottom of the modal
     * 4. Verify that Delete button is missing
     *
     * CURRENT BEHAVIOR:
     * The modal shows: Open Note, Archive, Save, Cancel
     * There is no Delete option.
     *
     * EXPECTED BEHAVIOR (after fix):
     * The modal should show: Open Note, Archive, Delete, Save, Cancel
     * (or similar arrangement with Delete clearly available)
     */
    const page = app.page;

    // Step 1: Create a test task
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(500);

    const createModal = page.locator('.modal');
    await expect(createModal).toBeVisible({ timeout: 5000 });

    const titleInput = createModal.locator('.task-modal-title, input[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test Task for Deletion 1009');
    }

    // Save the task
    const saveButton = createModal.locator('button:has-text("Save"), button:has-text("Create")').first();
    if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(1000);
    }

    // Step 2: Open the task list to find and edit our task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1500);

    // Find and click on the task to open edit modal
    const taskCard = page
      .locator('.task-card, .task-item, .task-row')
      .filter({ hasText: 'Test Task for Deletion 1009' })
      .first();

    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Double-click to open edit modal
      await taskCard.dblclick();
      await page.waitForTimeout(500);
    }

    // Step 3: Look for action buttons in the edit modal
    const editModal = page.locator('.modal');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    // Step 4: Check for buttons - Archive should exist, Delete should not
    const archiveButton = editModal.locator('button:has-text("Archive"), button.archive-button');
    const deleteButton = editModal.locator('button:has-text("Delete"), button.delete-button');

    const hasArchive = await archiveButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hasDelete = await deleteButton.isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`Archive button visible: ${hasArchive}`);
    console.log(`Delete button visible: ${hasDelete}`);

    // Archive should exist (current behavior)
    expect(hasArchive).toBe(true);

    // Delete should exist (expected after fix) - this will FAIL currently
    // This is the core of the feature request
    expect(hasDelete).toBe(true);

    // Close the modal
    await page.keyboard.press('Escape');

    await page.screenshot({
      path: 'test-results/screenshots/issue-1009-no-delete-button.png',
    });
  });

  test.fixme('reproduces issue #1009 - deleting task requires opening the file manually', async () => {
    /**
     * This test demonstrates the tedious workaround users must use currently:
     * opening the task file directly to delete it.
     *
     * STEPS TO REPRODUCE:
     * 1. Have a task that needs to be deleted
     * 2. User must either:
     *    a) Navigate to the tasks folder in the file explorer
     *    b) Use "Open Note" button and then delete from file menu
     *    c) Use Obsidian's file deletion commands
     *
     * This is especially tedious when dealing with multiple unwanted tasks.
     *
     * EXPECTED BEHAVIOR (after fix):
     * User should be able to click Delete in the task modal and confirm
     * to immediately remove the task.
     */
    const page = app.page;

    // Open task list
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task
    const taskCard = page.locator('.task-card, .task-item').first();

    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Open edit modal
      await taskCard.dblclick();
      await page.waitForTimeout(500);

      const editModal = page.locator('.modal');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // Look for "Open Note" button - this is the current workaround
      const openNoteButton = editModal.locator('button:has-text("Open Note"), button:has-text("Open")');
      const hasOpenNote = await openNoteButton.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Open Note button visible: ${hasOpenNote}`);

      // Document the current workaround path
      // User would have to:
      // 1. Click "Open Note" to open the file
      // 2. Then use Obsidian's file deletion (right-click > Delete, or command palette)
      // This is the "tedious" process mentioned in the issue

      // The feature request is to eliminate this multi-step process
      // by adding a Delete button directly in the modal

      await page.keyboard.press('Escape');
    }

    await page.screenshot({
      path: 'test-results/screenshots/issue-1009-tedious-deletion-workaround.png',
    });
  });

  test.fixme('reproduces issue #1009 - archived tasks still exist in directory', async () => {
    /**
     * This test demonstrates why archiving is not sufficient for users
     * who want to completely remove tasks.
     *
     * The user mentions: "I often find tickets unneded, not wanting to archive
     * them and poluting the directory."
     *
     * STEPS TO REPRODUCE:
     * 1. Create a task
     * 2. Archive it using the Archive button
     * 3. Check that the task file still exists (in archive folder or tasks folder)
     *
     * CURRENT BEHAVIOR:
     * Archived tasks remain as files, potentially "polluting" the directory
     * for users who want to remove unwanted tasks entirely.
     *
     * EXPECTED BEHAVIOR (after fix):
     * Users should have the option to Delete (remove file entirely) vs Archive
     * (keep file but mark as archived).
     */
    const page = app.page;

    // Create a task to archive
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(500);

    const createModal = page.locator('.modal');
    if (await createModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const titleInput = createModal.locator('.task-modal-title, input[placeholder*="title"]').first();
      if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await titleInput.fill('Task to Archive 1009');
      }

      const saveBtn = createModal.locator('button:has-text("Save"), button:has-text("Create")').first();
      if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Open task list and find the task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1500);

    const taskCard = page
      .locator('.task-card, .task-item')
      .filter({ hasText: 'Task to Archive 1009' })
      .first();

    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskCard.dblclick();
      await page.waitForTimeout(500);

      const editModal = page.locator('.modal');
      if (await editModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click Archive
        const archiveBtn = editModal.locator('button:has-text("Archive")');
        if (await archiveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await archiveBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // The task file still exists somewhere - either in tasks folder or archive folder
    // This is what the user considers "polluting the directory"
    // The feature request is for a Delete option that removes the file entirely

    console.log('Task archived - file still exists in directory (archive or tasks folder)');
    console.log('User wants Delete option to completely remove unwanted tasks');

    await page.screenshot({
      path: 'test-results/screenshots/issue-1009-archived-but-file-exists.png',
    });
  });

  test.fixme('reproduces issue #1009 - delete button should have confirmation prompt', async () => {
    /**
     * The user suggests: "A simple Delete button in the modal preview would do
     * (could be accompanied by a confirmation prompt)."
     *
     * This test documents the expected behavior for the Delete button:
     * it should show a confirmation dialog before permanently deleting.
     *
     * EXPECTED BEHAVIOR (after fix):
     * 1. User clicks Delete button
     * 2. Confirmation dialog appears: "Are you sure you want to delete [task name]?"
     * 3. User confirms or cancels
     * 4. If confirmed, task file is deleted and modal closes
     * 5. If cancelled, modal stays open
     */
    const page = app.page;

    // Open task list
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCard = page.locator('.task-card, .task-item').first();

    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskCard.dblclick();
      await page.waitForTimeout(500);

      const editModal = page.locator('.modal');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // After implementation, clicking Delete should show confirmation
      const deleteButton = editModal.locator('button:has-text("Delete"), button.delete-button');

      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Confirmation modal should appear
        const confirmModal = page.locator('.modal.confirmation-modal, .confirm-modal');
        const confirmText = page.locator(
          'text=/are you sure|confirm|delete.*permanently/i'
        );

        const hasConfirmation = await confirmText.isVisible({ timeout: 2000 }).catch(() => false);

        console.log(`Confirmation dialog shown: ${hasConfirmation}`);

        // The delete action should require confirmation
        expect(hasConfirmation).toBe(true);

        // Cancel to not actually delete
        await page.keyboard.press('Escape');
      } else {
        console.log('Delete button not yet implemented');
      }

      await page.keyboard.press('Escape');
    }

    await page.screenshot({
      path: 'test-results/screenshots/issue-1009-delete-confirmation.png',
    });
  });

  test.fixme('reproduces issue #1009 - bulk deletion scenario', async () => {
    /**
     * The user mentions: "especially if I have many tickets to delete"
     *
     * This documents the pain point of needing to delete multiple tasks.
     * While the immediate feature request is for a single Delete button,
     * this test highlights the broader use case.
     *
     * CURRENT BEHAVIOR:
     * To delete multiple tasks, user must:
     * 1. Open each task
     * 2. Click "Open Note"
     * 3. Delete the file
     * 4. Repeat for each task
     *
     * EXPECTED BEHAVIOR (after fix):
     * At minimum:
     * 1. Open task modal
     * 2. Click Delete
     * 3. Confirm
     * 4. Repeat with less friction
     *
     * Future enhancement could include bulk selection and deletion.
     */
    const page = app.page;

    // Open task list
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Count visible tasks
    const taskCards = page.locator('.task-card, .task-item');
    const taskCount = await taskCards.count();

    console.log(`Tasks visible in list: ${taskCount}`);
    console.log('Currently, deleting multiple tasks requires tedious file-by-file deletion');
    console.log('The Delete button feature would significantly improve this workflow');

    // Document that there's no bulk delete or quick delete option
    const bulkDeleteBtn = page.locator('button:has-text("Delete Selected"), button:has-text("Bulk Delete")');
    const hasBulkDelete = await bulkDeleteBtn.isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`Bulk delete option available: ${hasBulkDelete}`);

    await page.screenshot({
      path: 'test-results/screenshots/issue-1009-bulk-deletion-pain-point.png',
    });
  });
});
