/**
 * Issue #1593: [Bug]: New tasks created with "New" from Agenda, Task List etc not created in default tasks folder
 *
 * Bug Description:
 * When creating tasks using the "+New" button in Bases views (Agenda, Task List, Kanban, etc.),
 * the tasks are created in the vault root instead of the configured "Default Tasks Folder"
 * (Settings > General > Default Folder for Tasks).
 *
 * Expected behavior:
 * According to documentation: "You can specify a Default Tasks Folder where all new tasks will be created."
 * Tasks should be created in the configured tasksFolder regardless of where they are created from.
 *
 * The "Create new task" command works correctly and creates tasks in the default folder.
 * Only the "+New" button in Bases views exhibits this bug.
 *
 * Root cause hypothesis:
 * The task creation flow from BasesViewBase.ts (line 473-479) creates a TaskCreationModal
 * without issues, and the creationContext defaults to "manual-creation" which should use
 * the tasksFolder setting. The bug may be in:
 * 1. The folder template processing returning empty string
 * 2. Settings not being properly read from the Bases view context
 * 3. A race condition in how settings are accessed
 *
 * Related code:
 * - src/bases/BasesViewBase.ts: createFileForView() method (line 473-479)
 * - src/modals/TaskCreationModal.ts: buildTaskCreationData() and creationContext handling
 * - src/services/TaskService.ts: createTask() folder determination (lines 268-308)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1593
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1593: Tasks from Bases views should use default tasks folder', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1593 - task created from Task List view goes to vault root instead of default folder', async () => {
    /**
     * This test reproduces the bug by:
     * 1. Opening the Task List view
     * 2. Clicking the "+New" button
     * 3. Creating a task with a unique title
     * 4. Checking where the task file was created
     *
     * Expected: Task should be in TaskNotes/Tasks/ folder
     * Actual (bug): Task is created in vault root
     */
    const page = app.page;
    const uniqueTaskTitle = `Test Task ${Date.now()}`;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Wait for the view to load
    await page.waitForSelector('.tasknotes-plugin', { timeout: 10000 });

    // Find and click the "+New" button in the task list view toolbar
    const newButton = page.locator('.tasknotes-plugin .tasknotes-view-header-controls button').filter({
      hasText: 'New',
    }).first();

    // Alternative selectors if the above doesn't work
    const newButtonAlt = page.locator('button[aria-label*="New"], button[aria-label*="Create"]').first();
    const addButton = page.locator('.tasknotes-plugin button').filter({
      has: page.locator('svg.lucide-plus'),
    }).first();

    let buttonFound = false;
    for (const btn of [newButton, newButtonAlt, addButton]) {
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        buttonFound = true;
        break;
      }
    }

    if (!buttonFound) {
      console.log('Could not find +New button in task list view - skipping test');
      return;
    }

    // Wait for task creation modal to appear
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Find the title input and enter the task title
    const titleInput = page.locator('.modal input[type="text"]').first();
    const titleTextarea = page.locator('.modal textarea').first();
    const nlpInput = page.locator('.modal .cm-content').first();

    // Try different input methods based on modal type
    let inputFound = false;
    for (const input of [nlpInput, titleInput, titleTextarea]) {
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        await input.click();
        await input.fill(uniqueTaskTitle);
        inputFound = true;
        break;
      }
    }

    if (!inputFound) {
      console.log('Could not find title input in modal - skipping test');
      await page.keyboard.press('Escape');
      return;
    }

    // Submit the task creation
    const createButton = page.locator('.modal button').filter({ hasText: /create/i }).first();
    const submitButton = page.locator('.modal button[type="submit"]').first();

    for (const btn of [createButton, submitButton]) {
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }

    // Wait for the task to be created
    await page.waitForTimeout(1000);

    // Check if the modal is closed
    const modalStillOpen = await page.locator('.modal').isVisible({ timeout: 500 }).catch(() => false);
    if (modalStillOpen) {
      console.log('Modal still open after submit - task creation may have failed');
      await page.keyboard.press('Escape');
      return;
    }

    // Now check where the task was created using file explorer or API
    // The task should be in TaskNotes/Tasks/ folder, not in vault root

    // Open the file explorer and check for the new task file
    // First, check in the vault root (where the bug creates it)
    const vaultRootTask = page.locator('.nav-file-title').filter({
      hasText: uniqueTaskTitle,
    }).first();

    // Check if task appears in vault root (indicating the bug)
    const inVaultRoot = await vaultRootTask.isVisible({ timeout: 2000 }).catch(() => false);

    if (inVaultRoot) {
      // Get the file path to confirm location
      const filePath = await vaultRootTask.getAttribute('data-path');
      console.log(`BUG REPRODUCED: Task created at: ${filePath}`);
      console.log('Expected location: TaskNotes/Tasks/');

      // The bug is that the task is NOT in TaskNotes/Tasks/
      const isInCorrectFolder = filePath?.startsWith('TaskNotes/Tasks/');
      expect(isInCorrectFolder).toBe(true);
    } else {
      // Check if it's in the correct folder
      // Navigate to TaskNotes/Tasks folder
      const tasksFolder = page.locator('.nav-folder-title').filter({
        hasText: 'Tasks',
      });

      if (await tasksFolder.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Expand the folder if needed
        await tasksFolder.click();
        await page.waitForTimeout(500);

        const taskInCorrectFolder = page.locator('.nav-file-title').filter({
          hasText: uniqueTaskTitle,
        }).first();

        const foundInCorrectFolder = await taskInCorrectFolder.isVisible({ timeout: 2000 }).catch(() => false);

        if (foundInCorrectFolder) {
          console.log('Task created in correct folder (TaskNotes/Tasks/) - test passed');
        } else {
          console.log('Task not found in TaskNotes/Tasks/ - need to search vault');
        }

        expect(foundInCorrectFolder).toBe(true);
      }
    }
  });

  test.fixme('reproduces issue #1593 - task created from Agenda view goes to vault root', async () => {
    /**
     * Same test but for Agenda view (Calendar with list layout)
     */
    const page = app.page;
    const uniqueTaskTitle = `Agenda Task ${Date.now()}`;

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    // Wait for the view to load
    await page.waitForSelector('.tasknotes-plugin', { timeout: 10000 });

    // Find the "+New" button
    const newButton = page.locator('.tasknotes-plugin button').filter({
      has: page.locator('svg.lucide-plus'),
    }).first();

    if (!await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Could not find +New button in agenda view - skipping test');
      return;
    }

    await newButton.click();
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Enter task title
    const nlpInput = page.locator('.modal .cm-content').first();
    if (await nlpInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nlpInput.click();
      await nlpInput.fill(uniqueTaskTitle);
    }

    // Submit
    const createButton = page.locator('.modal button').filter({ hasText: /create/i }).first();
    if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createButton.click();
    }

    await page.waitForTimeout(1000);

    // Verify task location - should be in TaskNotes/Tasks/, not vault root
    // Using the command palette to search for the file
    await page.keyboard.press('Control+o'); // Quick switcher
    await page.waitForSelector('.prompt', { timeout: 3000 });
    await page.keyboard.type(uniqueTaskTitle.substring(0, 20), { delay: 30 });
    await page.waitForTimeout(500);

    const suggestion = page.locator('.suggestion-item').first();
    if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
      const suggestionText = await suggestion.textContent();
      console.log(`Found file suggestion: ${suggestionText}`);

      // Check if the path includes TaskNotes/Tasks
      const pathIncludesCorrectFolder = suggestionText?.includes('TaskNotes/Tasks');

      if (!pathIncludesCorrectFolder) {
        console.log('BUG REPRODUCED: Task not in TaskNotes/Tasks folder');
      }

      expect(pathIncludesCorrectFolder).toBe(true);
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1593 - task created from Kanban view goes to vault root', async () => {
    /**
     * Same test but for Kanban view
     */
    const page = app.page;
    const uniqueTaskTitle = `Kanban Task ${Date.now()}`;

    // Open kanban view
    await runCommand(page, 'TaskNotes: Open kanban view');
    await page.waitForTimeout(1000);

    // Wait for the view to load
    await page.waitForSelector('.tasknotes-plugin', { timeout: 10000 });

    // Find the "+New" button or "Add task" button in kanban columns
    const newButton = page.locator('.tasknotes-plugin button').filter({
      has: page.locator('svg.lucide-plus'),
    }).first();

    if (!await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Could not find +New button in kanban view - skipping test');
      return;
    }

    await newButton.click();
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Enter task title
    const nlpInput = page.locator('.modal .cm-content').first();
    if (await nlpInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nlpInput.click();
      await nlpInput.fill(uniqueTaskTitle);
    }

    // Submit
    const createButton = page.locator('.modal button').filter({ hasText: /create/i }).first();
    if (await createButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createButton.click();
    }

    await page.waitForTimeout(1000);

    // Verify using file explorer
    // The bug would create the file in vault root instead of TaskNotes/Tasks/
    const vaultRootFile = page.locator('.nav-file-title').filter({
      hasText: uniqueTaskTitle,
    }).first();

    // If we can find it directly in file explorer nav without navigating into folders,
    // it's likely in vault root (the bug)
    const isInVaultRoot = await vaultRootFile.isVisible({ timeout: 2000 }).catch(() => false);

    if (isInVaultRoot) {
      const filePath = await vaultRootFile.getAttribute('data-path');
      console.log(`Task file path: ${filePath}`);

      // Should start with TaskNotes/Tasks/
      const isCorrectLocation = filePath?.startsWith('TaskNotes/Tasks/');
      if (!isCorrectLocation) {
        console.log(`BUG REPRODUCED: Task created at ${filePath} instead of TaskNotes/Tasks/`);
      }
      expect(isCorrectLocation).toBe(true);
    }
  });

  test.fixme('reproduces issue #1593 - compares command-based creation vs view-based creation', async () => {
    /**
     * This test compares the behavior of:
     * 1. Creating a task via "Create new task" command (works correctly)
     * 2. Creating a task via "+New" button in views (has the bug)
     *
     * Both should create tasks in the same default folder.
     */
    const page = app.page;
    const commandTaskTitle = `Command Task ${Date.now()}`;
    const viewTaskTitle = `View Task ${Date.now()}`;

    // First, create a task using the command (this works correctly)
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(500);

    const nlpInput1 = page.locator('.modal .cm-content').first();
    if (await nlpInput1.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nlpInput1.click();
      await nlpInput1.fill(commandTaskTitle);
    }

    const createButton1 = page.locator('.modal button').filter({ hasText: /create/i }).first();
    if (await createButton1.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createButton1.click();
    }
    await page.waitForTimeout(1000);

    // Now create a task from the Task List view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const newButton = page.locator('.tasknotes-plugin button').filter({
      has: page.locator('svg.lucide-plus'),
    }).first();

    if (!await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Could not find +New button - skipping comparison');
      return;
    }

    await newButton.click();
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(500);

    const nlpInput2 = page.locator('.modal .cm-content').first();
    if (await nlpInput2.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nlpInput2.click();
      await nlpInput2.fill(viewTaskTitle);
    }

    const createButton2 = page.locator('.modal button').filter({ hasText: /create/i }).first();
    if (await createButton2.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createButton2.click();
    }
    await page.waitForTimeout(1000);

    // Compare the locations using quick switcher
    let commandTaskPath = '';
    let viewTaskPath = '';

    // Find command task
    await page.keyboard.press('Control+o');
    await page.waitForSelector('.prompt', { timeout: 3000 });
    await page.keyboard.type(commandTaskTitle.substring(0, 15), { delay: 30 });
    await page.waitForTimeout(500);

    let suggestion = page.locator('.suggestion-item').first();
    if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
      commandTaskPath = await suggestion.textContent() || '';
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Find view task
    await page.keyboard.press('Control+o');
    await page.waitForSelector('.prompt', { timeout: 3000 });
    await page.keyboard.type(viewTaskTitle.substring(0, 15), { delay: 30 });
    await page.waitForTimeout(500);

    suggestion = page.locator('.suggestion-item').first();
    if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
      viewTaskPath = await suggestion.textContent() || '';
    }
    await page.keyboard.press('Escape');

    console.log(`Command task path: ${commandTaskPath}`);
    console.log(`View task path: ${viewTaskPath}`);

    // Both should be in the same folder (TaskNotes/Tasks/)
    const commandInCorrectFolder = commandTaskPath.includes('TaskNotes/Tasks');
    const viewInCorrectFolder = viewTaskPath.includes('TaskNotes/Tasks');

    console.log(`Command task in correct folder: ${commandInCorrectFolder}`);
    console.log(`View task in correct folder: ${viewInCorrectFolder}`);

    if (commandInCorrectFolder && !viewInCorrectFolder) {
      console.log('BUG REPRODUCED: Command creates in correct folder, but view button does not');
    }

    // Both should be in the correct folder
    expect(commandInCorrectFolder).toBe(true);
    expect(viewInCorrectFolder).toBe(true);
  });

  test.fixme('reproduces issue #1593 - verifies empty tasksFolder setting behavior', async () => {
    /**
     * This test checks what happens when tasksFolder setting might be empty or invalid.
     * The bug might be caused by the setting not being properly read in certain contexts.
     *
     * Note: This test would need to modify settings, which may not be ideal for e2e tests.
     * For now, it documents the scenario.
     */
    const page = app.page;

    // Open plugin settings to verify the default folder setting
    await page.keyboard.press('Control+,'); // Open settings
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Navigate to TaskNotes settings
    const taskNotesSettingsTab = page.locator('.vertical-tab-nav-item').filter({
      hasText: 'TaskNotes',
    });

    if (await taskNotesSettingsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskNotesSettingsTab.click();
      await page.waitForTimeout(500);

      // Look for the Default Tasks Folder setting
      const folderSetting = page.locator('text=Default Folder for Tasks').first();
      if (await folderSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Find the input near this label
        const settingContainer = folderSetting.locator('..').locator('..');
        const folderInput = settingContainer.locator('input').first();

        if (await folderInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          const currentValue = await folderInput.inputValue();
          console.log(`Current Default Tasks Folder setting: "${currentValue}"`);

          if (!currentValue || currentValue.trim() === '') {
            console.log('WARNING: Default Tasks Folder is empty - this may cause tasks to be created in vault root');
          }
        }
      }
    }

    await page.keyboard.press('Escape');
  });
});
