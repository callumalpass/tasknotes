/**
 * Issue #790: [Bug] Missing projects not shown in dialog (but properly shown elsewhere)
 *
 * Bug Description:
 * When a project link referred to in the YAML frontmatter does not exist as an actual file:
 *
 * a) In tasks view - the system operates correctly, showing the project both in the task
 *    summary and in group-by-project views. This is expected behavior.
 *
 * b) In the dialog - the project does NOT show up at all. This is the bug. Users expect
 *    to see the non-existent project displayed (possibly with some visual indicator).
 *
 * Root cause:
 * The ProjectSelectModal.getItems() method only returns files that exist in the vault
 * (via app.vault.getAllLoadedFiles()). Non-existent project files cannot appear because
 * they simply don't exist in the vault's file list.
 *
 * Meanwhile, the TaskModal.renderProjectsList() method correctly handles unresolved
 * projects by adding them with `unresolved: true` and showing them with special styling.
 *
 * The issue arises in scenarios like:
 * - Manual YAML entry of a project that doesn't exist yet
 * - Project files moved to a different vault
 * - Spelling errors in project names
 * - Projects added via external tools
 *
 * Expected behavior:
 * - Non-existent projects should still appear in the dialog
 * - They should have a visual indicator (emoji, color, or icon) showing they don't exist
 * - This provides consistency with task view behavior
 *
 * @see https://github.com/callumalpass/tasknotes/issues/790
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #790: Missing projects not shown in dialog', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #790 - task view shows non-existent project but dialog does not', async () => {
    /**
     * This test reproduces the core bug: a non-existent project is visible in
     * task views but not in the task edit dialog.
     *
     * Steps:
     * 1. Create a task with a reference to a project file that doesn't exist
     * 2. Verify the project appears in the task list view
     * 3. Open the task edit dialog
     * 4. Verify the project appears in the dialog (currently fails - the bug)
     */
    const page = app.page;
    const nonExistentProjectName = 'NonExistentProject790';

    // Step 1: Create a new task via the command palette
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.tasknotes-modal, .modal-container').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in task title
    const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="Task"], .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test task referencing non-existent project #790');
    }

    // Set a project that does NOT exist as a file
    const projectField = page.locator('[data-field="projects"], .project-field, input[placeholder*="project"]').first();
    if (await projectField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectField.click();
      await page.keyboard.type(nonExistentProjectName);
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }

    // Save the task
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), .mod-cta').first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }
    await page.waitForTimeout(1000);

    // Step 2: Open task list view and find our task
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1500);

    const taskListView = page.locator('.tasknotes-task-list-view, .task-list-container, .bases-view');
    await expect(taskListView).toBeVisible({ timeout: 5000 });

    // Look for our task in the list
    const taskCard = taskListView.locator('.task-card, .task-item').filter({
      hasText: 'Test task referencing non-existent project #790'
    }).first();

    // Verify the non-existent project is displayed in the task card
    // (This is the part that currently WORKS according to the bug report)
    const projectInTaskView = taskCard.locator('.task-project, .project-link, [data-project]');
    const projectTextInView = await projectInTaskView.textContent().catch(() => '');
    console.log('Project displayed in task view:', projectTextInView);

    // The project should be visible in the task view
    await expect(projectInTaskView).toBeVisible({ timeout: 3000 });
    expect(projectTextInView).toContain(nonExistentProjectName);

    // Step 3: Open the task edit dialog
    await taskCard.click();
    await page.waitForTimeout(500);

    // Or use right-click > Edit if direct click doesn't open dialog
    const editModal = page.locator('.tasknotes-modal, .task-edit-modal, .modal-container').first();
    if (!await editModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskCard.click({ button: 'right' });
      await page.waitForTimeout(300);
      const editOption = page.locator('.menu-item:has-text("Edit"), .menu-item:has-text("edit")').first();
      if (await editOption.isVisible({ timeout: 1000 })) {
        await editOption.click();
      }
    }
    await page.waitForTimeout(500);

    // Step 4: Check if the project is visible in the dialog
    // THIS IS THE BUG - the project should appear but it doesn't
    const dialogProjectsSection = editModal.locator('.projects-section, .task-projects, [data-field="projects"]');
    const projectInDialog = dialogProjectsSection.locator('.task-project-item, .project-link, .selected-project');

    // The non-existent project should be visible in the dialog (with unresolved styling)
    // Currently this FAILS - the project doesn't show up
    await expect(projectInDialog).toBeVisible({ timeout: 3000 });

    const projectTextInDialog = await projectInDialog.textContent().catch(() => '');
    console.log('Project displayed in dialog:', projectTextInDialog);
    expect(projectTextInDialog).toContain(nonExistentProjectName);
  });

  test.fixme('reproduces issue #790 - non-existent project should have visual indicator', async () => {
    /**
     * The bug report suggests that non-existent projects should have some sort
     * of emoji or visual indicator to distinguish them from existing projects.
     *
     * This test verifies that when a non-existent project IS displayed (after fix),
     * it has appropriate visual differentiation.
     */
    const page = app.page;

    // Navigate to a task with a non-existent project reference
    // (assuming one was created in the previous test)
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1500);

    const taskListView = page.locator('.tasknotes-task-list-view, .task-list-container, .bases-view');
    const taskCard = taskListView.locator('.task-card, .task-item').filter({
      hasText: 'non-existent project'
    }).first();

    if (await taskCard.isVisible({ timeout: 3000 })) {
      // Open the task edit dialog
      await taskCard.click();
      await page.waitForTimeout(500);

      const editModal = page.locator('.tasknotes-modal, .task-edit-modal, .modal-container').first();

      // Find the project item in the dialog
      const projectItem = editModal.locator('.task-project-item').filter({
        hasText: 'NonExistentProject'
      }).first();

      if (await projectItem.isVisible({ timeout: 2000 })) {
        // Check for unresolved styling
        const hasUnresolvedClass = await projectItem.evaluate((el) => {
          return el.classList.contains('task-project-item--unresolved') ||
                 el.classList.contains('unresolved') ||
                 el.classList.contains('missing');
        });

        console.log('Has unresolved styling:', hasUnresolvedClass);

        // Should have visual indicator for unresolved/non-existent project
        expect(hasUnresolvedClass).toBe(true);

        // Check for tooltip indicating the project doesn't exist
        const tooltip = await projectItem.getAttribute('title') ||
                       await projectItem.locator('[title], [data-tooltip]').getAttribute('title');
        console.log('Tooltip for unresolved project:', tooltip);

        // Should have informative tooltip
        if (tooltip) {
          expect(tooltip.toLowerCase()).toMatch(/unresolved|missing|not found|does not exist/);
        }
      }
    }
  });

  test.fixme('reproduces issue #790 - grouping by non-existent project should work in both view and dialog', async () => {
    /**
     * The bug report mentions that grouping by project works correctly in task views
     * even for non-existent projects. This test verifies that behavior and checks
     * if the same project can be selected/edited in the dialog.
     *
     * Steps:
     * 1. Open task list with group-by-project enabled
     * 2. Verify non-existent project appears as a group header
     * 3. Click on a task in that group
     * 4. Verify the project is editable in the dialog
     */
    const page = app.page;

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1500);

    const taskListView = page.locator('.tasknotes-task-list-view, .task-list-container, .bases-view');
    await expect(taskListView).toBeVisible({ timeout: 5000 });

    // Try to enable group-by-project if not already enabled
    const groupByButton = taskListView.locator('.group-by-button, [data-action="group-by"], .view-action[aria-label*="group"]').first();
    if (await groupByButton.isVisible({ timeout: 1000 })) {
      await groupByButton.click();
      await page.waitForTimeout(300);

      const projectGroupOption = page.locator('.menu-item:has-text("Project"), .dropdown-item:has-text("Project")').first();
      if (await projectGroupOption.isVisible({ timeout: 1000 })) {
        await projectGroupOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Look for a group header with the non-existent project name
    const groupHeaders = taskListView.locator('.group-header, .task-group-header, [data-group]');
    let foundNonExistentProjectGroup = false;

    const groupCount = await groupHeaders.count();
    for (let i = 0; i < groupCount; i++) {
      const header = groupHeaders.nth(i);
      const headerText = await header.textContent();

      if (headerText?.includes('NonExistentProject790')) {
        console.log('Found group header for non-existent project:', headerText);
        foundNonExistentProjectGroup = true;

        // The non-existent project should appear as a valid group header
        // (this currently WORKS per the bug report)
        expect(headerText).toContain('NonExistentProject790');
        break;
      }
    }

    // Grouping by non-existent project should work
    // (This verifies the "works in task view" part of the bug report)
    expect(foundNonExistentProjectGroup).toBe(true);
  });

  test.fixme('reproduces issue #790 - project selector dropdown should include option to add non-existent projects', async () => {
    /**
     * This test verifies that the project selector dropdown in the task modal
     * allows users to add/keep non-existent projects.
     *
     * The core issue is that ProjectSelectModal.getItems() only returns existing files.
     * A possible fix would be to:
     * 1. Include the currently-selected projects in the dropdown even if files don't exist
     * 2. Allow typing arbitrary project names that don't match existing files
     * 3. Show non-existent projects with a visual indicator in the dropdown
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.tasknotes-modal, .modal-container').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find and click the project selector to open the dropdown
    const projectSelector = modal.locator(
      '.project-input, .project-selector, [data-field="projects"], input[placeholder*="project"]'
    ).first();

    if (await projectSelector.isVisible({ timeout: 2000 })) {
      await projectSelector.click();
      await page.waitForTimeout(300);

      // Type a project name that doesn't exist as a file
      const fakeProjectName = 'CompletelyFakeProject790Test';
      await page.keyboard.type(fakeProjectName);
      await page.waitForTimeout(500);

      // Look for autocomplete suggestions
      const suggestions = page.locator('.suggestion-container, .suggestion-item, .autocomplete-item');
      const suggestionCount = await suggestions.count();

      console.log('Autocomplete suggestions count:', suggestionCount);

      // Check if the typed text can be selected even if no file matches
      // This might show "Create new" option or allow direct selection
      const createOption = page.locator(
        '.suggestion-item:has-text("Create"), .suggestion-item:has-text("new"), .suggestion-item:has-text("Add")'
      ).first();

      const canAddNonExistent = await createOption.isVisible({ timeout: 1000 }).catch(() => false);

      // Or check if pressing Enter accepts the non-existent project
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Check if the project was added to the selection
      const selectedProjects = modal.locator('.selected-project, .task-project-item, .project-chip');
      const selectedProjectTexts = await selectedProjects.allTextContents();

      console.log('Selected projects after typing non-existent name:', selectedProjectTexts);

      // The non-existent project should be selectable
      const wasAdded = selectedProjectTexts.some(text => text.includes(fakeProjectName));
      expect(wasAdded).toBe(true);
    }
  });

  test.fixme('reproduces issue #790 - editing existing task should preserve non-existent project', async () => {
    /**
     * When editing a task that already has a non-existent project assigned,
     * the project should remain visible and editable in the dialog.
     *
     * The TaskModal.initializeProjectsFromStrings() method already handles this
     * by marking unresolved projects with `unresolved: true`, but the display
     * might still be broken.
     */
    const page = app.page;

    // First, manually create a task file with a non-existent project via YAML
    // This simulates the scenario described in the bug report
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    const fileNameInput = page.locator('input[placeholder*="name"], .prompt-input').first();
    if (await fileNameInput.isVisible({ timeout: 2000 })) {
      await fileNameInput.fill('TestTask790WithNonExistentProject');
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);

    // Add YAML frontmatter with a non-existent project
    const editor = page.locator('.cm-content, .markdown-source-view .cm-editor');
    await editor.click();

    const yamlContent = `---
status: todo
title: Task with manually added non-existent project
projects:
  - "[[ManuallyTypedNonExistentProject790]]"
---

This task was created with YAML frontmatter pointing to a project that doesn't exist.
`;

    await page.keyboard.type(yamlContent);
    await page.waitForTimeout(500);

    // Save the file
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1000);

    // Now open the task list and find this task
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1500);

    const taskListView = page.locator('.tasknotes-task-list-view, .task-list-container, .bases-view');
    const taskCard = taskListView.locator('.task-card, .task-item').filter({
      hasText: 'manually added non-existent project'
    }).first();

    if (await taskCard.isVisible({ timeout: 3000 })) {
      // Open the edit dialog
      await taskCard.click();
      await page.waitForTimeout(500);

      const editModal = page.locator('.tasknotes-modal, .task-edit-modal, .modal-container').first();

      if (await editModal.isVisible({ timeout: 3000 })) {
        // Find the projects section in the dialog
        const projectsSection = editModal.locator('.projects-section, .task-projects');
        const projectItems = projectsSection.locator('.task-project-item, .selected-project');

        const projectCount = await projectItems.count();
        console.log('Number of projects shown in edit dialog:', projectCount);

        // The non-existent project from YAML should be visible
        // THIS IS THE BUG - it might not show up
        expect(projectCount).toBeGreaterThanOrEqual(1);

        const projectTexts = await projectItems.allTextContents();
        console.log('Project texts in dialog:', projectTexts);

        const hasNonExistentProject = projectTexts.some(
          text => text.includes('ManuallyTypedNonExistentProject790')
        );
        expect(hasNonExistentProject).toBe(true);
      }
    }
  });
});
