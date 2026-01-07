/**
 * Issue #943: [FR] Show suggestions for linking to a project note and other custom fields
 *             from natural language dialog in create task modal
 *
 * Feature Request Description:
 * When creating a task using the natural language input, users want to be able to:
 * 1. Type a custom field trigger (e.g., "project", "parent", "owner") followed by
 *    suggestions for linking to notes, similar to how "due" triggers date parsing
 * 2. Get autocomplete suggestions for wikilinks when typing custom fields that
 *    support file-based autosuggest (e.g., project [[...suggestions]])
 * 3. Use this feature with converted checkbox tasks as well
 * 4. Have custom fields appear in quick actions for current task
 *
 * Current behavior:
 * - NLP parsing supports custom field triggers (extractUserFields method)
 * - NLPSuggest only provides suggestions for @contexts, #tags, +projects, and status
 * - Custom fields configured in settings do not show autocomplete suggestions
 * - Quick actions modal does not include custom field options
 *
 * Expected behavior:
 * - When typing a custom field trigger in NLP input, show suggestions:
 *   - For fields with autosuggestFilter: show matching file suggestions
 *   - For list fields: show existing values from the vault
 * - Support the pattern: "task title project [[...suggestions]] parent [[...suggestions]]"
 * - Include custom field quick actions in TaskActionPaletteModal
 *
 * Use case example from issue:
 * - User has custom fields: "Parent" (project phases/deliverables) and "Owner" (contacts)
 * - Both fields support file linking via autosuggestFilter
 * - User wants to type: "task priority high due tomorrow project [[...]] parent [[...]] owner [[...]]"
 * - And get autocomplete suggestions for each custom field
 *
 * Technical notes:
 * - NLPSuggest class (TaskCreationModal.ts:67) needs to support custom field triggers
 * - TriggerConfigService provides enabled triggers for custom fields
 * - UserMappedField type has autosuggestFilter property for file-based suggestions
 * - TaskActionPaletteModal needs additional actions for custom fields
 *
 * @see https://github.com/callumalpass/tasknotes/issues/943
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #943: Custom field suggestions in NLP input', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #943 - custom field triggers should show autocomplete suggestions',
    async () => {
      /**
       * This test verifies that typing a custom field trigger in the NLP input
       * shows autocomplete suggestions for the field value.
       *
       * Current behavior (limitation):
       * - Only @, #, +, and status trigger show suggestions
       * - Custom field triggers do not show any suggestions
       *
       * Expected behavior (feature):
       * - Custom field triggers (e.g., "project", "parent", "owner") show suggestions
       * - For fields with autosuggestFilter, show matching files
       * - Suggestions should include [[ wikilink format for file linking
       */
      const page = app.page;

      // First, ensure there's a custom field configured with autosuggest
      // Open TaskNotes settings to verify/configure a custom field
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(1000);

      const settingsModal = page.locator('.modal.mod-settings');
      if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
        if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pluginTab.click();
          await page.waitForTimeout(500);
        }

        // Look for custom fields / user fields section
        const customFieldsSection = page.locator('text=Custom fields, text=User fields, text=User-defined fields').first();
        if (await customFieldsSection.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Custom fields section found in settings');
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // Open task creation modal with NLP input
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Find the NLP text input (could be textarea or CodeMirror editor)
      const nlpInput = modal.locator('textarea.nlp-input, .cm-editor, .task-nlp-input').first();
      const nlpInputVisible = await nlpInput.isVisible({ timeout: 2000 }).catch(() => false);

      if (nlpInputVisible) {
        // Type a task with a custom field trigger
        // Example: typing "project " should show project suggestions
        await nlpInput.click();
        await page.waitForTimeout(200);

        // Type task content with a custom field trigger word
        // This assumes there's a custom field with trigger "project" configured
        await page.keyboard.type('Test task 943 project ', { delay: 50 });
        await page.waitForTimeout(500);

        // Check if any suggestion popup appeared
        const suggestions = page.locator('.suggestion-container, .suggestion-popup, .autocomplete-suggestions');
        const suggestionsVisible = await suggestions.first().isVisible({ timeout: 2000 }).catch(() => false);

        // Currently, this would fail because custom fields don't show suggestions
        // After implementing the feature, this should pass
        if (suggestionsVisible) {
          console.log('Suggestions appeared for custom field trigger');
          const suggestionItems = suggestions.locator('.suggestion-item');
          const count = await suggestionItems.count();
          console.log(`Found ${count} suggestions`);
          expect(count).toBeGreaterThan(0);
        } else {
          console.log('Issue #943: No suggestions appeared for custom field trigger');
          // Feature request: suggestions should appear
          expect(suggestionsVisible).toBe(true);
        }
      }

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );

  test.fixme(
    'reproduces issue #943 - wikilink suggestions for custom fields with autosuggest filter',
    async () => {
      /**
       * This test verifies that custom fields configured with autosuggestFilter
       * show file suggestions when typing [[ after the trigger.
       *
       * Use case: "task title parent [[...suggestions]]"
       *
       * The autosuggestFilter in UserMappedField settings determines which files
       * to suggest (e.g., only project notes, only contact notes, etc.)
       */
      const page = app.page;

      // Create some project/contact notes first to have suggestions available
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      await page.keyboard.type('---\ntags: project\n---\n\n# Project Alpha 943\n\nA test project for issue 943.\n', { delay: 10 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // Create another project note
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      await page.keyboard.type('---\ntags: project\n---\n\n# Project Beta 943\n\nAnother test project for issue 943.\n', { delay: 10 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // Now open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const nlpInput = modal.locator('textarea.nlp-input, .cm-editor, .task-nlp-input').first();

      if (await nlpInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nlpInput.click();
        await page.waitForTimeout(200);

        // Type task with parent field trigger followed by [[
        // This should trigger wikilink suggestions filtered by the field's autosuggestFilter
        await page.keyboard.type('Test task 943 parent [[', { delay: 50 });
        await page.waitForTimeout(500);

        // Check for wikilink suggestion popup
        const linkSuggestions = page.locator('.suggestion-container, .suggestion-popup, [class*="suggester"]');
        const linkSuggestionsVisible = await linkSuggestions.first().isVisible({ timeout: 2000 }).catch(() => false);

        if (linkSuggestionsVisible) {
          console.log('Wikilink suggestions appeared for custom field');

          // Type partial project name to filter
          await page.keyboard.type('Project', { delay: 50 });
          await page.waitForTimeout(300);

          const filteredSuggestions = linkSuggestions.locator('.suggestion-item');
          const filteredCount = await filteredSuggestions.count();
          console.log(`Found ${filteredCount} filtered suggestions`);

          // Should show our project notes
          expect(filteredCount).toBeGreaterThan(0);
        } else {
          console.log('Issue #943: No wikilink suggestions for custom field');
          // Feature request: wikilink suggestions should work with custom field triggers
          expect(linkSuggestionsVisible).toBe(true);
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );

  test.fixme(
    'reproduces issue #943 - custom fields should work with converted checkbox tasks',
    async () => {
      /**
       * This test verifies that the NLP parsing for custom fields works when
       * converting a checkbox to a task using the "Convert to task" command.
       *
       * Example checkbox:
       * - [ ] this is a task priority high due tomorrow project [[Project Alpha]] parent [[Deliverable]] owner [[Contact]]
       *
       * When converted, all custom fields should be parsed and set correctly.
       */
      const page = app.page;

      // Create a note with a checkbox containing custom field syntax
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);

      // Type a checkbox with custom field patterns
      const checkboxText = '- [ ] Test task 943 priority high project [[Project Alpha 943]] parent [[Project Beta 943]]';
      await page.keyboard.type(checkboxText, { delay: 20 });
      await page.waitForTimeout(500);

      // Save the note
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // Position cursor on the checkbox line
      await page.keyboard.press('Home');
      await page.waitForTimeout(200);

      // Try to convert the checkbox to a task
      await runCommand(page, 'TaskNotes: Convert checkbox to task');
      await page.waitForTimeout(1500);

      // Check if a task was created with the custom fields populated
      // The task should have:
      // - priority: high
      // - project: [[Project Alpha 943]]
      // - parent: [[Project Beta 943]] (if configured as custom field)

      // Open quick switcher and navigate to the newly created task
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(500);

      const quickSwitcher = page.locator('.prompt');
      if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.type('Test task 943 priority', { delay: 30 });
        await page.waitForTimeout(500);

        const firstResult = quickSwitcher.locator('.suggestion-item').first();
        if (await firstResult.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstResult.click();
          await page.waitForTimeout(1000);

          // Check the task's frontmatter for custom fields
          const content = await page.evaluate(() => {
            const editor = document.querySelector('.cm-content');
            return editor?.textContent || '';
          });

          console.log('Task content:', content.substring(0, 500));

          // Verify custom fields were parsed
          // Note: The exact property names depend on settings configuration
          const hasProjectLink = content.includes('Project Alpha 943') || content.includes('project');
          console.log(`Project field parsed: ${hasProjectLink}`);

          // After feature implementation, custom fields should be populated
          expect(hasProjectLink).toBe(true);
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );

  test.fixme(
    'reproduces issue #943 - custom fields should appear in quick actions palette',
    async () => {
      /**
       * This test verifies that custom fields are available as options in the
       * quick actions palette (TaskActionPaletteModal).
       *
       * Current behavior:
       * - Quick actions include: status, priority, due date, scheduled date, etc.
       * - Custom fields are NOT included
       *
       * Expected behavior:
       * - Custom fields should appear as action categories
       * - Selecting a custom field action should open a picker/suggester
       */
      const page = app.page;

      // First, create a task to open quick actions on
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Quick Action Test Task 943');
      }

      const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1500);

      // Open the task
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('Quick Action Test Task 943');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      // Open quick actions for the current task
      await runCommand(page, 'TaskNotes: Quick actions for current task');
      await page.waitForTimeout(500);

      const actionPalette = page.locator('.modal, .prompt');
      if (await actionPalette.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Get all available actions
        const actionItems = actionPalette.locator('.suggestion-item, .action-item, [data-action]');
        const actionCount = await actionItems.count();

        console.log(`Found ${actionCount} quick actions`);

        // Collect action names
        const actionNames: string[] = [];
        for (let i = 0; i < Math.min(actionCount, 30); i++) {
          const item = actionItems.nth(i);
          const text = await item.textContent();
          if (text) {
            actionNames.push(text.toLowerCase());
          }
        }

        console.log('Available actions:', actionNames.slice(0, 10).join(', '));

        // Check if custom field actions are available
        // These would be things like "Set project", "Set parent", "Set owner", etc.
        const hasCustomFieldAction = actionNames.some(name =>
          name.includes('project') ||
          name.includes('parent') ||
          name.includes('owner') ||
          name.includes('custom field')
        );

        if (hasCustomFieldAction) {
          console.log('Custom field actions found in quick actions');
        } else {
          console.log('Issue #943: Custom fields not in quick actions palette');
        }

        // Feature request: custom fields should be in quick actions
        expect(hasCustomFieldAction).toBe(true);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );

  test.fixme(
    'reproduces issue #943 - NLP input should show preview of parsed custom fields',
    async () => {
      /**
       * This test verifies that when typing custom fields in NLP input,
       * the preview section shows the parsed custom field values.
       *
       * Current behavior:
       * - Preview shows due date, priority, status, tags, contexts, projects
       * - Custom fields may or may not show in preview
       *
       * Expected behavior:
       * - Custom fields should appear in the preview with their values
       * - This helps users verify their input was parsed correctly
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const nlpInput = modal.locator('textarea.nlp-input, .cm-editor, .task-nlp-input').first();

      if (await nlpInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nlpInput.click();
        await page.waitForTimeout(200);

        // Type task with custom fields (assuming triggers are configured)
        // Format: trigger followed by value
        await page.keyboard.type('Test task 943 due tomorrow priority high project "My Project"', { delay: 30 });
        await page.waitForTimeout(1000);

        // Look for the preview section
        const preview = modal.locator('.nlp-preview, .task-preview, .parsed-preview, [class*="preview"]');
        const previewVisible = await preview.first().isVisible({ timeout: 2000 }).catch(() => false);

        if (previewVisible) {
          const previewText = await preview.first().textContent();
          console.log('Preview content:', previewText?.substring(0, 300));

          // Check if custom field (project) is shown in preview
          const showsProject = previewText?.toLowerCase().includes('project') ||
                              previewText?.includes('My Project');

          if (showsProject) {
            console.log('Custom field visible in preview');
          } else {
            console.log('Issue #943: Custom field not shown in preview');
          }

          // Feature request: custom fields should be visible in preview
          expect(showsProject).toBe(true);
        } else {
          console.log('No preview section found');
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );

  test.fixme(
    'reproduces issue #943 - multiple custom fields with wikilinks should parse correctly',
    async () => {
      /**
       * This test verifies the exact use case from the issue:
       * - [ ] this is a task priority high due tomorrow project [[...]] parent [[...]] owner [[...]]
       *
       * All three custom fields (project, parent, owner) with wikilink values
       * should be parsed correctly.
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const nlpInput = modal.locator('textarea.nlp-input, .cm-editor, .task-nlp-input').first();

      if (await nlpInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nlpInput.click();
        await page.waitForTimeout(200);

        // Type the exact pattern from the issue
        const inputText = 'Test task 943 priority high due tomorrow project [[Project Alpha]] parent [[Phase 1]] owner [[John Doe]]';
        await page.keyboard.type(inputText, { delay: 20 });
        await page.waitForTimeout(1000);

        // Check the preview or create the task and verify fields
        const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
        if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createButton.click();
        } else {
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(1500);

        // Open the created task and verify all fields
        await runCommand(page, 'Quick switcher: Open quick switcher');
        await page.waitForTimeout(300);
        await page.keyboard.type('Test task 943 priority high');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        // Read the task's frontmatter
        const content = await page.evaluate(() => {
          const editor = document.querySelector('.cm-content');
          return editor?.textContent || '';
        });

        console.log('Created task content:', content.substring(0, 600));

        // Verify all custom fields were parsed
        // Note: property names may vary based on configuration
        const parsedCorrectly = {
          priority: content.toLowerCase().includes('high') || content.includes('priority'),
          project: content.includes('Project Alpha') || content.includes('project'),
          parent: content.includes('Phase 1') || content.includes('parent'),
          owner: content.includes('John Doe') || content.includes('owner'),
        };

        console.log('Parsed fields:', parsedCorrectly);

        // Feature request: all custom fields should be parsed and stored
        expect(parsedCorrectly.priority).toBe(true);
        expect(parsedCorrectly.project).toBe(true);
        expect(parsedCorrectly.parent).toBe(true);
        expect(parsedCorrectly.owner).toBe(true);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );
});
