/**
 * Issue #905: [Bug] Project auto-suggest filters are unexpectedly applied to custom field file selection
 *
 * Bug Description:
 * When editing a custom field in the Task Edit modal, the file suggestions are filtered
 * by the plugin's "project auto-suggest" settings. In other words, for all custom fields,
 * the file auto-suggestion shows the same results as the project auto-suggestion.
 *
 * Expected Behavior:
 * - File suggestions in custom fields should NOT be filtered by the project autosuggestion settings
 * - Each custom field should use its own autosuggestFilter (if configured), or show all files
 *
 * Root Cause Analysis:
 * In FileSuggestHelper.ts, the suggest() method always reads display field rows from
 * `plugin.settings.projectAutosuggest.rows` (line 40) to collect additional searchable
 * properties with the |s flag. This means the project auto-suggest display configuration
 * leaks into custom field suggestions, affecting which properties are searched and how
 * files are scored.
 *
 * Additionally, if the custom field does NOT have its own autosuggestFilter configured,
 * the project auto-suggest filters (requiredTags, includeFolders, propertyKey/Value)
 * should NOT be applied - but they may be incorrectly inherited.
 *
 * Originally reported by @bepolimathe in discussion:
 * @see https://github.com/callumalpass/tasknotes/discussions/143
 * @see https://github.com/callumalpass/tasknotes/issues/905
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #905: Custom field file suggestions incorrectly filtered by project auto-suggest', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #905 - custom field file suggestions should not use project auto-suggest filters',
    async () => {
      /**
       * This test verifies that when a custom field does NOT have an autosuggestFilter,
       * file suggestions should show ALL files, not just files matching the project
       * auto-suggest filters.
       *
       * Setup:
       * 1. Configure project auto-suggest with restrictive filters (e.g., only #project tag)
       * 2. Create a custom field WITHOUT autosuggestFilter
       * 3. Create files with and without the #project tag
       *
       * Bug behavior:
       * - Custom field suggestions only show files matching project filters
       *
       * Expected behavior:
       * - Custom field suggestions show ALL files (no filtering applied)
       */
      const page = app.page;

      // Create test files - one with #project tag, one without
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntags: project\n---\n\n# Project Note 905\n\nThis is a project note.\n', { delay: 10 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntags: personal\n---\n\n# Personal Note 905\n\nThis is a personal note without project tag.\n', { delay: 10 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // Open TaskNotes settings to configure project auto-suggest filters
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(1000);

      const settingsModal = page.locator('.modal.mod-settings');
      if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
        if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pluginTab.click();
          await page.waitForTimeout(500);
        }

        // Navigate to project auto-suggest settings and configure filters
        // (This would require finding and configuring the requiredTags setting to only show #project)
        const projectAutosuggestSection = page.locator('text=Project auto-suggest, text=Project suggestions').first();
        if (await projectAutosuggestSection.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Found project auto-suggest settings section');
          // Configure requiredTags to only show files with #project tag
          // This is a simplified version - actual UI navigation may differ
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // Create a task to edit
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const createModal = page.locator('.modal');
      await expect(createModal).toBeVisible({ timeout: 5000 });

      const titleInput = createModal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Test Task Issue 905');
      }

      const createButton = createModal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(1500);

      // Open the task edit modal
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);
      await page.keyboard.type('Test Task Issue 905');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      // Open task edit modal (if there's an edit command)
      await runCommand(page, 'TaskNotes: Edit current task');
      await page.waitForTimeout(500);

      const editModal = page.locator('.modal');
      if (await editModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find a custom field input (not the project field)
        // Custom fields configured without autosuggestFilter should show all files
        const customFieldInput = editModal.locator('input[data-field-type="text"], .user-field-input').first();

        if (await customFieldInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await customFieldInput.click();
          await customFieldInput.fill('[[');  // Trigger wikilink suggestions
          await page.waitForTimeout(500);

          // Check suggestions
          const suggestions = page.locator('.suggestion-container, .suggestion-popup, [class*="suggester"]');
          if (await suggestions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            const suggestionItems = suggestions.locator('.suggestion-item');
            const count = await suggestionItems.count();
            console.log(`Found ${count} file suggestions`);

            // Collect suggestion texts
            const suggestionTexts: string[] = [];
            for (let i = 0; i < Math.min(count, 20); i++) {
              const text = await suggestionItems.nth(i).textContent();
              if (text) {
                suggestionTexts.push(text);
              }
            }

            console.log('Suggestions:', suggestionTexts.slice(0, 5).join(', '));

            // BUG: If project auto-suggest filters are being incorrectly applied,
            // "Personal Note 905" will NOT appear in suggestions (only "Project Note 905" will)
            const hasPersonalNote = suggestionTexts.some(s => s.includes('Personal Note 905'));
            const hasProjectNote = suggestionTexts.some(s => s.includes('Project Note 905'));

            console.log(`Has Personal Note 905: ${hasPersonalNote}`);
            console.log(`Has Project Note 905: ${hasProjectNote}`);

            // Both notes should appear in suggestions for a custom field without filters
            expect(hasPersonalNote).toBe(true);
            expect(hasProjectNote).toBe(true);
          }
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  );

  test.fixme(
    'reproduces issue #905 - custom field should use its own filter, not project filter',
    async () => {
      /**
       * This test verifies that when a custom field HAS its own autosuggestFilter,
       * it uses that filter and NOT the project auto-suggest filters.
       *
       * Setup:
       * 1. Configure project auto-suggest to only show #project tags
       * 2. Configure a custom field with autosuggestFilter for #person tags
       * 3. Create files with #project and #person tags
       *
       * Bug behavior:
       * - Custom field may incorrectly merge or be overridden by project filters
       *
       * Expected behavior:
       * - Custom field suggestions show only files with #person tag (its own filter)
       */
      const page = app.page;

      // Create test files with different tags
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntags: person\n---\n\n# Alice Contact 905\n\nAlice is a person.\n', { delay: 10 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntags: project\n---\n\n# Beta Project 905\n\nBeta is a project.\n', { delay: 10 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // The test would need to:
      // 1. Configure a custom field "assignee" with autosuggestFilter { requiredTags: ['person'] }
      // 2. Configure project auto-suggest with requiredTags: ['project']
      // 3. Open task edit modal
      // 4. Type [[ in the assignee custom field
      // 5. Verify only "Alice Contact 905" appears (not "Beta Project 905")

      // This is a placeholder for the test logic
      // The actual implementation depends on how settings are configured via UI

      console.log('Issue #905: Custom field should use its own filter configuration');
      console.log('Project auto-suggest should not leak into custom field suggestions');

      // Expected: custom field with #person filter shows only person files
      // Bug: custom field may show project files due to filter leakage
      expect(true).toBe(true); // Placeholder assertion
    }
  );

  test.fixme(
    'reproduces issue #905 - project auto-suggest display rows should not affect custom field scoring',
    async () => {
      /**
       * This test verifies that the display row configuration from project auto-suggest
       * (specifically searchable properties with |s flag) does not affect custom field
       * file suggestion scoring.
       *
       * Root cause location: FileSuggestHelper.ts line 40
       * The code reads `plugin.settings.projectAutosuggest.rows` to determine additional
       * searchable properties, even when being called for custom field suggestions.
       *
       * Expected behavior:
       * - Custom fields should only use their own scoring configuration
       * - Or use a neutral/default scoring that doesn't depend on project settings
       */
      const page = app.page;

      // This test would need to:
      // 1. Configure project auto-suggest with custom display rows including |s flag
      //    e.g., "{status|s}" to make status searchable
      // 2. Create files with status property set to specific values
      // 3. Configure a custom field without autosuggestFilter
      // 4. Open task edit modal and trigger file suggestions in custom field
      // 5. Verify that searching by "status" value doesn't incorrectly boost results
      //    (which would indicate project settings are leaking)

      console.log('Issue #905: Project display rows should not affect custom field scoring');

      // The core issue is that FileSuggestHelper.suggest() reads projectAutosuggest.rows
      // even when called for custom fields, causing the |s searchable flag to affect
      // which properties are searched and how files are scored.

      expect(true).toBe(true); // Placeholder assertion
    }
  );
});
