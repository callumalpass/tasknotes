/**
 * Issue #953: All TaskNotes Views include subtasks that don't match the "Task Identification" settings
 *
 * Bug Description:
 * When TaskNotes Plugin setting maps "Project" to a property named "Parent" and a
 * "Task Identification" -> Task Tag is set to "t/ef", notes that do NOT contain
 * the task tag but DO have a "Parent" property linking to an existing TaskNotes
 * task are incorrectly displayed as subtasks of that task.
 *
 * Steps to reproduce:
 * 1. Set task identification method to use tag (e.g., "t/ef")
 * 2. Set "Project" property to a custom name (e.g., "Parent")
 * 3. Create a task note with the required tag (e.g., "Existing_Task" with #t/ef)
 * 4. Create a regular note ("Random_Note") WITHOUT any tags
 * 5. Set Random_Note's "Parent" property to link to Existing_Task
 * 6. Open Existing_Task and view subtasks in the relationships widget
 *
 * Unexpected behavior:
 * Random_Note is displayed as a subtask of Existing_Task, despite not having
 * the required task tag.
 *
 * Expected behavior:
 * Random_Note should NEVER be displayed as a TaskNote result (task or subtask)
 * because it does not meet the task identification criteria (no task tag).
 *
 * Root cause:
 * The relationships/subtasks view filter only checks if a note's project property
 * contains a link to the current task, but does NOT validate that the note with
 * the parent relationship also has the required task tag.
 *
 * Related fix reference:
 * ProjectSubtasksService.ts (lines 180-183) already implements the correct pattern:
 * It validates that source files are actually tasks before creating relationships.
 *
 * Impact on workflow:
 * In vaults where projects and tasks can be a "Parent" of both task and non-task
 * notes, the non-task notes pollute TaskNotes results. This is especially
 * problematic for large projects with many documents.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/953
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #953: Subtasks not matching task identification settings', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #953 - non-task note with Parent property shown as subtask', async () => {
    /**
     * This test reproduces the core issue: a note WITHOUT the required task tag
     * but WITH a Parent property linking to a task should NOT appear as a subtask.
     *
     * Current behavior (bug):
     * - Notes with Parent property appear as subtasks regardless of task tag
     *
     * Expected behavior:
     * - Only notes that match task identification criteria AND have the Parent
     *   property should appear as subtasks
     */
    const page = app.page;

    // Step 1: Create a task note (will have the required task tag)
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Parent Task 953');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 2: Create a regular note WITHOUT task tag but WITH Parent property
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    // Type frontmatter with Parent property pointing to the task, but no task tag
    await page.keyboard.type('---\nParent: "[[Parent Task 953]]"\n---\n\n# Random Non-Task Note 953\n\nThis note is NOT a task (no task tag), but has a Parent property.\nIt should NOT appear as a subtask of Parent Task 953.\n', { delay: 20 });
    await page.waitForTimeout(500);

    // Save the note
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1000);

    // Step 3: Open the parent task and check subtasks
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Parent Task 953', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Step 4: Look for the relationships widget and subtasks view
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false);

    if (widgetVisible) {
      // Look for subtasks tab/section
      const subtasksTab = page.locator('text=Subtasks, text=subtasks').first();
      if (await subtasksTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subtasksTab.click();
        await page.waitForTimeout(500);
      }

      // Check if the non-task note appears in subtasks
      const subtaskItems = page.locator('.tasknotes-relationships-widget .task-item, .tasknotes-relationships-widget .subtask-item, .tasknotes-relationships-widget [data-task-path]');
      const subtaskCount = await subtaskItems.count();

      console.log(`Found ${subtaskCount} items in subtasks view`);

      // Look for our non-task note in the subtasks list
      let foundNonTaskNote = false;
      for (let i = 0; i < subtaskCount; i++) {
        const item = subtaskItems.nth(i);
        const itemText = await item.textContent();

        if (itemText?.includes('Random Non-Task Note 953')) {
          foundNonTaskNote = true;
          console.log('BUG REPRODUCED: Non-task note appears in subtasks list');
          break;
        }
      }

      // The bug: non-task notes should NOT appear in subtasks
      // Current behavior: they DO appear (foundNonTaskNote === true)
      // Expected behavior: they should NOT appear (foundNonTaskNote === false)
      if (foundNonTaskNote) {
        console.log('Issue #953 reproduced: Note without task tag appears as subtask');
      }

      // After fix, this should pass:
      expect(foundNonTaskNote).toBe(false);
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #953 - task with Parent property correctly shown as subtask', async () => {
    /**
     * This test verifies that notes WITH the task tag AND Parent property
     * are correctly shown as subtasks. This ensures the fix doesn't break
     * the intended functionality.
     *
     * Expected behavior:
     * - Notes matching task identification AND having Parent property
     *   should appear as subtasks
     */
    const page = app.page;

    // Step 1: Create a parent task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Parent Task For Subtask 953');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 2: Create a child task (WITH task tag) that references the parent
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Child Task 953');
    }

    // Set the parent/project field
    const projectInput = modal2.locator('input[placeholder*="project"], .project-input, [data-property="project"] input, [data-property="projects"] input, [data-property="parent"] input').first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.fill('Parent Task For Subtask 953');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 3: Open the parent task and verify the child task appears as subtask
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Parent Task For Subtask 953', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Look for subtasks in the relationships widget
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false);

    if (widgetVisible) {
      const subtasksTab = page.locator('text=Subtasks, text=subtasks').first();
      if (await subtasksTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subtasksTab.click();
        await page.waitForTimeout(500);
      }

      const subtaskItems = page.locator('.tasknotes-relationships-widget .task-item, .tasknotes-relationships-widget .subtask-item, .tasknotes-relationships-widget [data-task-path]');
      const subtaskCount = await subtaskItems.count();

      console.log(`Found ${subtaskCount} subtasks`);

      // Verify the child task (WITH task tag) appears
      let foundChildTask = false;
      for (let i = 0; i < subtaskCount; i++) {
        const item = subtaskItems.nth(i);
        const itemText = await item.textContent();

        if (itemText?.includes('Child Task 953')) {
          foundChildTask = true;
          console.log('Child task correctly appears in subtasks');
          break;
        }
      }

      // After fix, proper tasks should still appear as subtasks
      expect(foundChildTask).toBe(true);
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #953 - Task List view should exclude non-task notes', async () => {
    /**
     * This test verifies that the Task List view does not include notes
     * that don't match task identification criteria, even if they have
     * properties that would normally create relationships.
     *
     * The issue description mentions "All TaskNotes Views" are affected,
     * so this tests the main Task List view.
     */
    const page = app.page;

    // Open the Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Get all task cards
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    console.log(`Found ${taskCount} tasks in Task List`);

    // Check for notes that shouldn't be tasks
    let nonTaskNotesFound = 0;
    for (let i = 0; i < Math.min(taskCount, 20); i++) {
      const card = taskCards.nth(i);
      const cardTitle = await card.locator('.task-card__title').textContent();

      // Notes we created without task tags
      if (cardTitle?.includes('Random Non-Task Note')) {
        nonTaskNotesFound++;
        console.log(`BUG: Non-task note found in Task List: "${cardTitle}"`);
      }
    }

    // After fix: no non-task notes should appear
    expect(nonTaskNotesFound).toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #953 - Kanban view should exclude non-task subtasks', async () => {
    /**
     * This test verifies that Kanban views (used in relationships widget's
     * Subtasks view) do not include non-task notes as subtasks.
     *
     * The relationships widget uses a tasknotesKanban view type with a filter
     * that only checks the project property, not task identification.
     */
    const page = app.page;

    // Open a task that should have subtasks
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Parent Task 953', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Find the relationships widget Kanban view
    const kanbanView = page.locator('.tasknotes-kanban, .bases-kanban, [data-view-type="tasknotesKanban"]');
    const kanbanVisible = await kanbanView.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (kanbanVisible) {
      // Get all items in the Kanban
      const kanbanItems = kanbanView.locator('.kanban-item, .task-card, [data-task-path]');
      const itemCount = await kanbanItems.count();

      console.log(`Found ${itemCount} items in Kanban view`);

      // Check each item - none should be non-task notes
      let nonTaskItems = 0;
      for (let i = 0; i < itemCount; i++) {
        const item = kanbanItems.nth(i);
        const itemText = await item.textContent();

        if (itemText?.includes('Random Non-Task') || itemText?.includes('Non-Task Note')) {
          nonTaskItems++;
          console.log(`BUG: Non-task note in Kanban: "${itemText?.substring(0, 50)}..."`);
        }
      }

      // After fix: no non-task notes should appear in Kanban subtasks
      expect(nonTaskItems).toBe(0);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #953 - custom task tag (hierarchical) should be respected', async () => {
    /**
     * This test verifies the specific scenario from the issue:
     * Task tag is set to "t/ef" (hierarchical tag), and notes without
     * this specific tag should not appear as tasks or subtasks.
     *
     * The user's workflow uses hierarchical tags like t/ef for task
     * identification, making exact matching important.
     */
    const page = app.page;

    // Open settings to verify/check task identification settings
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    const settingsModal = page.locator('.modal.mod-settings');
    if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Navigate to TaskNotes settings
      const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
      if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pluginTab.click();
        await page.waitForTimeout(500);
      }

      // Look for task identification settings
      const taskTagInput = page.locator('.setting-item:has-text("Task tag") input, .setting-item:has-text("task tag") input').first();
      if (await taskTagInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const currentTag = await taskTagInput.inputValue();
        console.log(`Current task tag setting: "${currentTag}"`);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // The test documents that the task tag (e.g., "t/ef") should be
    // strictly matched using FilterUtils.matchesHierarchicalTagExact()
    // for both task identification AND subtask filtering

    console.log('Issue #953 is about respecting the configured task tag');
    console.log('for ALL TaskNotes views, including subtask relationships');
  });

  test.fixme('reproduces issue #953 - project property mapping should not bypass task identification', async () => {
    /**
     * This test verifies that custom project property mapping (e.g.,
     * "Parent" instead of "projects") does not bypass task identification.
     *
     * The issue describes:
     * - Project property is mapped to "Parent"
     * - Notes with Parent property pointing to a task should only appear
     *   as subtasks if they ALSO have the required task tag
     */
    const page = app.page;

    // Open settings to check project property configuration
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    const settingsModal = page.locator('.modal.mod-settings');
    if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
      if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pluginTab.click();
        await page.waitForTimeout(500);
      }

      // Look for project property configuration
      const projectProperty = page.locator('.setting-item:has-text("Project") input, .setting-item:has-text("project") input, .setting-item:has-text("Parent") input').first();
      if (await projectProperty.isVisible({ timeout: 2000 }).catch(() => false)) {
        const currentMapping = await projectProperty.inputValue();
        console.log(`Project property mapped to: "${currentMapping}"`);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // The fix should ensure that regardless of how the project/parent
    // property is named, notes must still match task identification
    // criteria to appear in any TaskNotes view

    console.log('Project property mapping should work in conjunction with');
    console.log('task identification - both conditions must be satisfied');
  });
});
