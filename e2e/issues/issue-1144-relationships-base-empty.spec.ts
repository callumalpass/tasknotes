/**
 * Issue #1144: relationships.base empty after upgrade from v3
 *
 * Bug: After upgrading from TaskNotes 3 to TaskNotes 4.0.1, the relationships.base
 * view shows "No TaskNotes found for this base" even when tasks with Projects,
 * Subtasks, and Blockers exist.
 *
 * Steps to reproduce:
 * 1. Upgrade to TaskNotes 4.0.1 from TaskNotes 3
 * 2. Click on relationships.base
 * 3. Observe "No TaskNotes found for this base" message
 * 4. Create a new task with Projects, Subtasks, and Blockers
 * 5. Click on relationships.base
 * 6. Observe "No TaskNotes found for this base" message (should show relationships)
 *
 * Root cause hypothesis:
 * The filter expressions in relationships.base use Bases syntax that may not match
 * how relationship data is stored/queried. The filters use:
 * - note.projects.contains(this.file.asLink()) for Subtasks
 * - list(this.projects).contains(file.asLink()) for Projects
 * - list(this.note.blockedBy).map(value.uid).contains(file.asLink()) for Blocked By
 * - list(note.blockedBy).map(value.uid).contains(this.file.asLink()) for Blocking
 *
 * These may need adjustment for the data format used after migration.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1144
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1144: relationships.base empty after v3 to v4 upgrade', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1144 - relationships.base shows empty for task with relationships', async () => {
    /**
     * This test creates a task with project relationships and verifies that
     * the relationships.base view correctly displays them.
     *
     * Current behavior (bug):
     * - relationships.base shows "No TaskNotes found for this base" even when
     *   relationships exist
     *
     * Expected behavior:
     * - relationships.base should show the task's subtasks, projects, and blockers
     */
    const page = app.page;

    // Step 1: Create a parent task that will be a "project" for subtasks
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the parent task (project) details
    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Parent Project Task 1144');
    }

    // Create the parent task
    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Wait for the task note to be created
    await page.waitForTimeout(1500);

    // Step 2: Create a subtask that references the parent as its project
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    // Fill in the subtask details
    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Subtask for Project 1144');
    }

    // Try to set the project field to link to parent task
    const projectInput = modal2.locator('input[placeholder*="project"], .project-input, [data-property="project"] input').first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.fill('Parent Project Task 1144');
      await page.waitForTimeout(500);
      // Try to select from suggestions if any
      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    // Create the subtask
    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(1500);

    // Step 3: Open the parent task note to view its relationships widget
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Parent Project Task 1144', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Step 4: Check the relationships widget content
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false);

    if (widgetVisible) {
      // Analyze the widget content
      const widgetContent = await relationshipsWidget.evaluate((widget) => {
        // Look for empty state messages
        const emptyStates = widget.querySelectorAll('.tn-bases-empty');
        const emptyMessages: string[] = [];
        emptyStates.forEach(el => {
          if (el.textContent) emptyMessages.push(el.textContent.trim());
        });

        // Look for task items that should appear
        const taskItems = widget.querySelectorAll('.task-list-item, .kanban-card, .bases-item');

        // Look for tab headers
        const tabs = widget.querySelectorAll('[role="tab"], .bases-tab-header, .tab-header');
        const tabNames: string[] = [];
        tabs.forEach(tab => {
          if (tab.textContent) tabNames.push(tab.textContent.trim());
        });

        return {
          hasEmptyStates: emptyStates.length > 0,
          emptyMessages,
          taskItemCount: taskItems.length,
          tabNames,
          innerHTML: widget.innerHTML.substring(0, 1000), // Debug info
        };
      });

      console.log('Relationships widget content:', JSON.stringify(widgetContent, null, 2));

      // The bug is that the widget shows empty states even with relationships
      // If we created relationships correctly but see empty messages, that's the bug
      if (widgetContent.hasEmptyStates && widgetContent.emptyMessages.some(msg =>
        msg.toLowerCase().includes('no tasknotes') ||
        msg.toLowerCase().includes('no tasks found')
      )) {
        console.log('BUG REPRODUCED: Widget shows empty message despite relationships existing');
      }

      // After fix: subtasks tab should show the subtask we created
      // expect(widgetContent.taskItemCount).toBeGreaterThan(0);
    } else {
      console.log('Relationships widget not found - may not be enabled or task not recognized');
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1144 - relationships.base directly opened shows empty', async () => {
    /**
     * This test opens the relationships.base file directly to verify its
     * content/configuration.
     *
     * The relationships.base file uses filter expressions that may not match
     * the data format after v3 to v4 upgrade.
     */
    const page = app.page;

    // Try to open relationships.base directly
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('relationships.base', { delay: 30 });
      await page.waitForTimeout(500);

      // Check if the file appears in suggestions
      const suggestions = page.locator('.suggestion-item');
      const suggestionCount = await suggestions.count();

      if (suggestionCount > 0) {
        const firstSuggestion = await suggestions.first().textContent();
        console.log('First suggestion:', firstSuggestion);

        if (firstSuggestion?.toLowerCase().includes('relationships')) {
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);

          // Check if we opened a Bases view
          const basesView = page.locator('.bases-view, .tn-bases-container');
          const basesVisible = await basesView.isVisible({ timeout: 3000 }).catch(() => false);

          if (basesVisible) {
            // Check for empty state messages in the view
            const emptyState = page.locator('.tn-bases-empty');
            const hasEmptyState = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

            if (hasEmptyState) {
              const emptyText = await emptyState.textContent();
              console.log('Empty state message:', emptyText);
              // This confirms the bug - the view shows empty even when tasks exist
            }
          }

          // Close the view
          await page.keyboard.press('Control+w');
          await page.waitForTimeout(500);
        } else {
          await page.keyboard.press('Escape');
        }
      } else {
        await page.keyboard.press('Escape');
        console.log('relationships.base file not found - may need to run "Create Default Files" command');
      }
    }
  });

  test.fixme('reproduces issue #1144 - subtasks tab filter expression verification', async () => {
    /**
     * This test verifies the Subtasks tab filter expression works correctly.
     *
     * The filter used is: note.projects.contains(this.file.asLink())
     * This should find tasks where the current file is listed as a project.
     *
     * If this filter doesn't work, subtasks won't appear even when they exist.
     */
    const page = app.page;

    // Create a project note first
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Project Note 1144 Filter Test');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Now create a subtask that references this project
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Subtask 1144 Filter Test');
    }

    // Look for project field and set it
    const projectField = modal2.locator('[data-property="projects"], [data-property="project"], .projects-field').first();
    if (await projectField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectField.click();
      await page.waitForTimeout(300);
      await page.keyboard.type('Project Note 1144 Filter Test', { delay: 30 });
      await page.waitForTimeout(500);
      // Select from suggestions if available
      const suggestion = page.locator('.suggestion-item, .cm-completionLabel').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
      }
    }

    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Now open the project note and check relationships
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Project Note 1144 Filter Test', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Check the relationships widget - specifically the Subtasks tab
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    if (await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try to find and click the Subtasks tab
      const subtasksTab = relationshipsWidget.locator('text=Subtasks, [data-tab="Subtasks"]').first();
      if (await subtasksTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subtasksTab.click();
        await page.waitForTimeout(500);
      }

      // Check if the subtask appears
      const subtaskItem = relationshipsWidget.locator('text=Subtask 1144 Filter Test');
      const subtaskVisible = await subtaskItem.isVisible({ timeout: 3000 }).catch(() => false);

      console.log('Subtask visible in relationships widget:', subtaskVisible);

      if (!subtaskVisible) {
        // This confirms the bug - the subtask should appear but doesn't
        console.log('BUG REPRODUCED: Subtask not visible despite being linked to project');

        // Check for empty state
        const emptyState = await relationshipsWidget.locator('.tn-bases-empty').isVisible({ timeout: 1000 }).catch(() => false);
        if (emptyState) {
          console.log('Empty state shown instead of subtask');
        }
      }
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1144 - blockedBy filter expression verification', async () => {
    /**
     * This test verifies the blocking/blocked by filter expressions work correctly.
     *
     * The filters used are:
     * - Blocked By: list(this.note.blockedBy).map(value.uid).contains(file.asLink())
     * - Blocking: list(note.blockedBy).map(value.uid).contains(this.file.asLink())
     *
     * If these filters don't work, dependency relationships won't appear.
     */
    const page = app.page;

    // Create a blocking task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Blocker Task 1144');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Create a blocked task that references the blocker
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Blocked Task 1144');
    }

    // Look for blockedBy field and set it
    const blockedByField = modal2.locator('[data-property="blockedBy"], .blockedBy-field, [aria-label*="blocked"]').first();
    if (await blockedByField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await blockedByField.click();
      await page.waitForTimeout(300);
      await page.keyboard.type('Blocker Task 1144', { delay: 30 });
      await page.waitForTimeout(500);
      const suggestion = page.locator('.suggestion-item, .cm-completionLabel').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
      }
    }

    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Open the blocker task and check the "Blocking" tab
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Blocker Task 1144', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Check the relationships widget - specifically the Blocking tab
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    if (await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try to find and click the Blocking tab
      const blockingTab = relationshipsWidget.locator('text=Blocking, [data-tab="Blocking"]').first();
      if (await blockingTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await blockingTab.click();
        await page.waitForTimeout(500);
      }

      // Check if the blocked task appears
      const blockedItem = relationshipsWidget.locator('text=Blocked Task 1144');
      const blockedVisible = await blockedItem.isVisible({ timeout: 3000 }).catch(() => false);

      console.log('Blocked task visible in Blocking tab:', blockedVisible);

      if (!blockedVisible) {
        console.log('BUG REPRODUCED: Blocked task not visible in Blocking tab');
      }
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });
});
