/**
 * Issue #1123: Relationship Widget displayed only on Task Notes
 *
 * Bug: The new relationship widget is displayed only in task notes (notes that
 * have either task tag or task category depending on settings), but not on
 * regular notes (notes which don't have the corresponding tag or category).
 *
 * Steps to reproduce:
 * 1. Set task identification to use category property (e.g., category: task)
 * 2. Create a task note (with category: task) that links to a regular note
 * 3. Open the regular note (without category: task)
 * 4. Observe: Relationship widget is NOT displayed, even though the note has
 *    incoming links from task notes
 * 5. Add "task" to the category property of the regular note
 * 6. Observe: Relationship widget now appears
 * 7. Change category to something other than "task"
 * 8. Observe: Relationship widget disappears again
 *
 * Root cause: The widget visibility logic in RelationshipsDecorations.ts only
 * shows the widget if:
 * - isTaskNote is true (note matches task identification criteria), OR
 * - isProjectNote is true (note is referenced by tasks via the project property)
 *
 * Regular notes with outgoing/incoming links to tasks but without being
 * explicitly referenced as "projects" are excluded.
 *
 * Expected behavior: The relationship widget should display on any note that
 * has relationships with task notes, regardless of whether the note itself
 * is identified as a task.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1123
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1123: Relationship widget only shows on task notes', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1123 - widget not shown on regular note with link FROM task note', async () => {
    /**
     * This test reproduces the core issue: a regular note that is linked FROM
     * a task note should show the relationship widget (to display the incoming
     * relationship), but currently it does not.
     *
     * Current behavior (bug):
     * - Regular notes without task tag/category don't show the widget
     * - Even when a task note links to them (not via 'project' property, but
     *   via a regular wiki link in the body)
     *
     * Expected behavior:
     * - Any note with relationships to task notes should show the widget
     */
    const page = app.page;

    // Step 1: Create a task note that will link to a regular note
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task With Link 1123');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(1500);

    // Step 2: Add a link to a non-existent regular note (which will create it)
    // Type in the editor to add a wiki link
    await page.keyboard.type('\n\nSee also: [[Regular Note 1123]]\n', { delay: 20 });
    await page.waitForTimeout(500);

    // Step 3: Follow the link to create/open the regular note
    // Use Ctrl+Click or command palette to follow the link
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Regular Note 1123', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Step 4: Check if the regular note shows the relationship widget
    // This note is NOT a task (no tag/category) and is NOT referenced as a project
    // but it IS linked FROM a task note

    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Relationship widget visible on regular note:', widgetVisible);

    // The bug: widget should be visible to show the incoming relationship from
    // "Task With Link 1123", but it's not shown because this note is neither
    // a task nor a project
    if (!widgetVisible) {
      console.log('BUG REPRODUCED: Widget not visible on regular note with incoming task link');
    }

    // After the fix, this assertion should pass:
    // expect(widgetVisible).toBe(true);

    // For now, document the current (buggy) behavior:
    expect(widgetVisible).toBe(false); // Current behavior - widget hidden on regular notes

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1123 - widget appears after adding task category', async () => {
    /**
     * This test verifies that adding the task category to a regular note
     * makes the relationship widget appear - confirming the visibility logic
     * is tied to task identification.
     *
     * As described in the issue screenshots:
     * - Image 3: Regular note without "task" category - NO widget
     * - Image 4: Same note WITH "task" category - widget appears
     * - Image 5: Same note with different category value - NO widget
     */
    const page = app.page;

    // Create a regular note first
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    // Type some content with frontmatter (but NOT task category)
    await page.keyboard.type('---\ncategory: project\n---\n\n# Regular Project Note 1123\n\nThis note has a category, but not "task".\n', { delay: 20 });
    await page.waitForTimeout(500);

    // Check widget visibility - should NOT be visible
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetBefore = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Widget visible with category:project:', widgetBefore);

    // Now change category to "task"
    // Navigate to the frontmatter and change it
    await page.keyboard.press('Control+Home');
    await page.waitForTimeout(200);

    // Select and replace the category value
    await runCommand(page, 'Editor: Go to line');
    await page.waitForTimeout(500);

    const lineModal = page.locator('.prompt');
    if (await lineModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('2', { delay: 30 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    // Select the line and retype with task category
    await page.keyboard.press('Control+Shift+k'); // Delete line
    await page.waitForTimeout(200);
    await page.keyboard.type('category: task\n', { delay: 20 });
    await page.waitForTimeout(1000);

    // Check widget visibility - should NOW be visible
    const widgetAfter = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Widget visible with category:task:', widgetAfter);

    // This confirms the bug behavior:
    // - Widget visibility is tied to task identification, not relationships
    // expect(widgetBefore).toBe(false);
    // expect(widgetAfter).toBe(true);

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(300);

    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1123 - widget shows on project notes referenced via project property', async () => {
    /**
     * This test verifies that the widget DOES show on notes that are referenced
     * as projects by task notes - this is the one exception to the "must be a
     * task note" rule.
     *
     * The current logic uses dependencyCache.isFileUsedAsProject() to check if
     * a note is referenced via the 'project' or 'projects' property.
     *
     * This works but is too narrow - users expect the widget on any note with
     * task relationships, not just those referenced via the project property.
     */
    const page = app.page;

    // Step 1: Create a regular note to be used as a project
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('# Project Note For Tasks 1123\n\nThis is a project note.\n', { delay: 20 });
    await page.waitForTimeout(500);

    // Save the note
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Step 2: Create a task that references this note as its project
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task Referencing Project 1123');
    }

    // Set the project field to reference our project note
    const projectInput = modal.locator('input[placeholder*="project"], .project-input, [data-property="project"] input, [data-property="projects"] input').first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.fill('Project Note For Tasks 1123');
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

    // Step 3: Open the project note and check for widget
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Project Note For Tasks 1123', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Widget SHOULD be visible because this note is referenced as a project
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Widget visible on project-referenced note:', widgetVisible);

    // This should work - project references are handled
    // But regular wiki links are not handled (that's the bug)

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1123 - property-based vs tag-based task identification', async () => {
    /**
     * This test verifies the behavior with property-based task identification
     * as shown in the issue screenshots.
     *
     * The user has configured:
     * - taskIdentificationMethod: "property"
     * - taskPropertyName: "category"
     * - taskPropertyValue: "task"
     *
     * Only notes with `category: task` in frontmatter are considered task notes.
     */
    const page = app.page;

    // Open TaskNotes settings to verify/set task identification method
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    const settingsModal = page.locator('.modal.mod-settings, .setting-item');
    await expect(settingsModal.first()).toBeVisible({ timeout: 5000 });

    // Look for TaskNotes in the sidebar
    const pluginTab = page.locator('text=TaskNotes').first();
    if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pluginTab.click();
      await page.waitForTimeout(500);
    }

    // Look for task identification settings
    const taskIdSetting = page.locator('text=Task identification, text=task identification').first();

    if (await taskIdSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get info about current configuration
      const settingContainer = taskIdSetting.locator('xpath=ancestor::*[contains(@class, "setting-item")]');

      const settingInfo = await settingContainer.evaluate((container) => {
        const dropdown = container.querySelector('select');
        const inputs = container.querySelectorAll('input[type="text"]');

        return {
          hasDropdown: !!dropdown,
          dropdownValue: dropdown?.value || null,
          inputCount: inputs.length,
          inputValues: Array.from(inputs).map((i: HTMLInputElement) => i.value),
        };
      }).catch(() => ({ hasDropdown: false, dropdownValue: null, inputCount: 0, inputValues: [] }));

      console.log('Task identification settings:', settingInfo);
    }

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1123 - widget should show for notes with any task relationships', async () => {
    /**
     * This test documents the expected behavior after the fix.
     *
     * The relationship widget should display on any note that has relationships
     * with task notes, including:
     * 1. Task notes (current: works)
     * 2. Notes referenced as projects (current: works)
     * 3. Notes linked TO by task notes (current: BROKEN)
     * 4. Notes that link TO task notes (current: BROKEN)
     *
     * The fix should extend the visibility check to include notes that have
     * backlinks from task notes or outgoing links to task notes.
     */
    const page = app.page;

    // This test outlines what should work after the fix

    // Scenario 1: Create a task that links to a regular note
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Task Linking To Regular Note 1123');
      }

      const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1500);
    }

    // Add a link to a regular note in the task body
    await page.keyboard.type('\n\nRelated context: [[Context Note 1123]]\n', { delay: 20 });
    await page.waitForTimeout(500);

    // Open the context note (will be created)
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Context Note 1123', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // After the fix, this regular note should show the relationship widget
    // because it has a backlink from a task note
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Widget on note with task backlink:', widgetVisible);

    // Current behavior (bug): false
    // Expected after fix: true
    // expect(widgetVisible).toBe(true);

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });
});
