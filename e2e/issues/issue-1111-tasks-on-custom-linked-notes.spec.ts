/**
 * Issue #1111: Show tasks on linked notes that are not projects
 *
 * Feature Request: Users have custom user fields for 'organisations', 'people',
 * and 'places'. They want tasks to appear on those notes in the same way as
 * they do for linked projects.
 *
 * Current behavior:
 * - Tasks can be linked to notes via the "projects" field
 * - The Relationships widget shows subtasks on project notes
 * - Custom user fields (organisations, people, places) are NOT indexed for
 *   reverse lookups
 * - Notes referenced by custom fields don't show linked tasks
 *
 * Expected behavior:
 * - Notes referenced by ANY list-type user field (not just "projects") should
 *   be able to show tasks that reference them
 * - The Relationships widget (or similar) should display tasks linked via
 *   organisations, people, places, and other custom fields
 *
 * Technical context:
 * - DependencyCache only indexes the "projects" field for reverse lookups
 * - ProjectSubtasksService is hardcoded for projects only
 * - defaultBasesFiles.ts generates filters only for the projects field
 * - To fix: generalize the system to index ALL list-type user fields with links
 *
 * Related issues:
 * - #1123: Relationship widget only shows on task notes (overlapping concern)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1111
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1111: Tasks on custom linked notes (organisations, people, places)', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1111 - tasks should show on organisation notes', async () => {
    /**
     * This test verifies that tasks linked via a custom "organisations" field
     * should appear on the organisation note, similar to how tasks appear on
     * project notes.
     *
     * Steps:
     * 1. Create a custom user field "organisations" (list type)
     * 2. Create an organisation note (e.g., "Acme Corp")
     * 3. Create a task with organisations field pointing to "Acme Corp"
     * 4. Open the Acme Corp note
     * 5. Expected: See the linked task in a relationships/subtasks view
     * 6. Current: Task is NOT shown (only project links work)
     */
    const page = app.page;

    // First, check if custom user fields can be configured
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    const settingsModal = page.locator('.modal.mod-settings, .setting-item');
    await expect(settingsModal.first()).toBeVisible({ timeout: 5000 });

    // Navigate to TaskNotes settings
    const pluginTab = page.locator('text=TaskNotes').first();
    if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pluginTab.click();
      await page.waitForTimeout(500);
    }

    // Look for custom fields / user fields settings section
    const userFieldsSection = page.locator('text=User fields, text=Custom fields, text=user fields').first();
    const hasUserFieldsConfig = await userFieldsSection.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('User fields configuration available:', hasUserFieldsConfig);

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Create an organisation note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('---\ncategory: organisation\n---\n\n# Acme Corp\n\nThis is an organisation note.\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Now create a task that links to this organisation
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task for Acme Corp Organisation');
    }

    // Try to find a custom "organisations" field in the modal
    // This depends on user field configuration
    const orgInput = modal.locator('input[placeholder*="organisation"], [data-property="organisations"] input, [data-field="organisations"] input').first();
    const hasOrgField = await orgInput.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Organisations field available in task modal:', hasOrgField);

    if (hasOrgField) {
      await orgInput.fill('Acme Corp');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    // Create the task
    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Go back to the organisation note
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Acme Corp', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Check for relationships widget or linked tasks
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Relationships widget on organisation note:', widgetVisible);

    // Look for any indication of linked tasks
    if (widgetVisible) {
      const hasLinkedTasks = await relationshipsWidget.evaluate((widget) => {
        // Look for task items or "Acme Corp" task reference
        const taskItems = widget.querySelectorAll('.task-list-item, .bases-item, .kanban-card');
        const textContent = widget.textContent || '';
        return {
          taskCount: taskItems.length,
          containsTaskTitle: textContent.includes('Task for Acme Corp Organisation'),
        };
      });

      console.log('Linked tasks analysis:', hasLinkedTasks);

      // Current behavior (bug): Tasks linked via custom fields are NOT shown
      // Expected after fix: containsTaskTitle should be true
    }

    // Document the current limitation
    // After the fix, organisation notes should show tasks that reference them
    // just like project notes do

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1111 - tasks should show on people notes', async () => {
    /**
     * This test verifies that tasks linked via a custom "people" field
     * should appear on the person's note.
     *
     * Use case: A user has a "people" field on tasks to track which person
     * is involved with a task. They want to see all tasks involving a person
     * when viewing that person's note.
     */
    const page = app.page;

    // Create a person note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('---\ntype: person\n---\n\n# John Smith\n\nContact note for John Smith.\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Create a task that should be linked to this person
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Meeting with John Smith');
    }

    // Look for a "people" field
    const peopleInput = modal.locator('input[placeholder*="people"], [data-property="people"] input, [data-field="people"] input').first();
    const hasPeopleField = await peopleInput.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('People field available in task modal:', hasPeopleField);

    if (hasPeopleField) {
      await peopleInput.fill('John Smith');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    // Create the task
    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Go back to the person note
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('John Smith', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Check for linked tasks on the person note
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Relationships widget on person note:', widgetVisible);

    // Current: Tasks linked via "people" field are NOT shown on person notes
    // Expected: Person notes should show all tasks where they're referenced in the people field

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);

    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1111 - tasks should show on place/location notes', async () => {
    /**
     * This test verifies that tasks linked via a custom "places" field
     * should appear on the place note.
     *
     * Use case: A user has a "places" field on tasks to track which location
     * is relevant to a task. They want to see all tasks for a place when
     * viewing that place's note.
     */
    const page = app.page;

    // Create a place note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('---\ntype: place\n---\n\n# Office Building A\n\nDetails about Office Building A.\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Create a task linked to this place
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task at Office Building A');
    }

    // Look for a "places" field
    const placesInput = modal.locator('input[placeholder*="place"], [data-property="places"] input, [data-field="places"] input').first();
    const hasPlacesField = await placesInput.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Places field available in task modal:', hasPlacesField);

    if (hasPlacesField) {
      await placesInput.fill('Office Building A');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    // Create the task
    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Go back to the place note
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Office Building A', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Check for linked tasks on the place note
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Relationships widget on place note:', widgetVisible);

    // Current: Tasks linked via "places" field are NOT shown on place notes
    // Expected: Place notes should show all tasks where they're referenced in the places field

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);

    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1111 - projects field works but custom fields do not', async () => {
    /**
     * This test demonstrates the inconsistency between the built-in "projects"
     * field and custom user fields for task linking.
     *
     * The projects field DOES work for showing linked tasks on project notes.
     * Custom fields (organisations, people, places) do NOT work the same way.
     *
     * This test creates both scenarios to highlight the difference.
     */
    const page = app.page;

    // Part 1: Create a project note and link a task via "projects" field
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('# Test Project 1111\n\nThis is a project note.\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Create a task with project link
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task linked via projects field');
    }

    // Set the projects field
    const projectInput = modal.locator('input[placeholder*="project"], [data-property="project"] input, [data-property="projects"] input').first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.fill('Test Project 1111');
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Go to the project note and check for linked tasks
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Test Project 1111', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const projectWidgetVisible = await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false);

    let projectTasksShown = false;
    if (projectWidgetVisible) {
      const content = await relationshipsWidget.evaluate((widget) => {
        return widget.textContent || '';
      });
      projectTasksShown = content.includes('Task linked via projects field');
    }

    console.log('Projects field behavior:', {
      widgetVisible: projectWidgetVisible,
      linkedTasksShown: projectTasksShown,
    });

    // Projects field SHOULD work - this is the expected behavior that custom fields should match
    // Current: projectTasksShown is true for projects field
    // Bug: projectTasksShown is false for custom fields (organisations, people, places)

    // The fix should make custom fields work the same way as the projects field

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1111 - DependencyCache only indexes projects field', async () => {
    /**
     * This test documents the root cause: DependencyCache.ts only maintains
     * a reverse index (projectReferences) for the "projects" field.
     *
     * Technical verification:
     * - projectReferences: Map<string, Set<string>> maps project file -> task files
     * - This allows isFileUsedAsProject() and getTasksLinkedToProject() to work
     * - Custom user fields have no equivalent index
     *
     * The fix requires:
     * 1. Extending DependencyCache to index ALL list-type user fields with links
     * 2. Adding generic methods: getTasksLinkedViaField(notePath, fieldName)
     * 3. Updating the Relationships widget to use these new indexes
     */
    const page = app.page;

    // This test primarily documents the technical limitation
    // Actual verification would require inspecting internal plugin state

    // Create a note that would be referenced by custom fields
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('# Reference Note 1111\n\nThis note is referenced by tasks via custom fields.\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // The current architecture:
    // - DependencyCache.projectReferences: Only indexes projects field
    // - isFileUsedAsProject(): Only checks projectReferences
    // - RelationshipsDecorations: Only shows widget if isTaskNote || isProjectNote
    //
    // After the fix:
    // - DependencyCache should have: fieldReferences: Map<fieldName, Map<targetPath, Set<sourcePaths>>>
    // - New method: isFileLinkedViaField(filePath, fieldName)
    // - RelationshipsDecorations should check all configured link fields

    console.log('Test documents DependencyCache limitation - only projects field is indexed');

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);

    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1111 - Bases filter only works for projects', async () => {
    /**
     * This test documents that the default Bases template for the
     * Relationships widget only generates a filter for the projects field.
     *
     * Current filter (defaultBasesFiles.ts):
     *   note.projects.contains(this.file.asLink())
     *
     * This filter shows tasks whose projects field contains the current file.
     * There's no equivalent filter for custom fields.
     *
     * After the fix, there should be dynamic tabs/filters for each
     * list-type user field that contains links, e.g.:
     *   note.organisations.contains(this.file.asLink())
     *   note.people.contains(this.file.asLink())
     *   note.places.contains(this.file.asLink())
     */
    const page = app.page;

    // Open a task note to see the relationships widget
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task to inspect Bases filters');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Check for the relationships widget and its tabs
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    if (widgetVisible) {
      const tabAnalysis = await relationshipsWidget.evaluate((widget) => {
        // Look for tab names/headers
        const tabs = widget.querySelectorAll('.bases-tab, .tab-header, [role="tab"], .view-tab');
        const tabNames = Array.from(tabs).map((tab) => (tab.textContent || '').trim());

        return {
          tabCount: tabs.length,
          tabNames,
          hasSubtasksTab: tabNames.some((n) => n.toLowerCase().includes('subtask')),
          hasProjectsTab: tabNames.some((n) => n.toLowerCase().includes('project')),
          hasBlockedTab: tabNames.some((n) => n.toLowerCase().includes('block')),
          // Custom fields would need their own tabs after the fix
          hasOrganisationsTab: tabNames.some((n) => n.toLowerCase().includes('organisation')),
          hasPeopleTab: tabNames.some((n) => n.toLowerCase().includes('people')),
          hasPlacesTab: tabNames.some((n) => n.toLowerCase().includes('place')),
        };
      });

      console.log('Relationships widget tabs:', JSON.stringify(tabAnalysis, null, 2));

      // Current: Only Subtasks, Projects, Blocked By, Blocking tabs exist
      // After fix: Should also have tabs for custom link fields (Organisations, People, Places)
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });
});
