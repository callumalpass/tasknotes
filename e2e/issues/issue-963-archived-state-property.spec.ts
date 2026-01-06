/**
 * Issue #963: [FR]: Use property to denote "archived" state
 *
 * Feature request with two distinct enhancements:
 *
 * 1. Context-specific default priorities:
 *    - Allow setting different default priorities per context
 *    - Similar to Templater's "Folder Templates" feature
 *    - Would enable color-coding tasks by context automatically
 *
 * 2. Archive tag customization:
 *    - Option to change the default "archived" tag to something else
 *    - Option to opt out of using tags entirely for archived state
 *    - Currently even with empty task tag and "property" identification method,
 *      the plugin still assigns a "task" tag
 *    - User wants to use tags as temporary indicators, not permanent metadata
 *
 * Current behavior analysis:
 * - archiveTag IS customizable in settings (settings/tabs/taskPropertiesTab.ts)
 * - However, the archive tag is always added to the tags array when archiving
 *   (FieldMapper.ts:301-309)
 * - There's no option to use ONLY the archived boolean property without tags
 * - The taskTag is always preserved in mapToFrontmatter (line 297-299)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/963
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #963: Archived state property options', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Part 1: Context-specific default priorities', () => {
    test.fixme('reproduces issue #963 - should allow per-context default priorities', async () => {
      /**
       * This test verifies that users can configure different default priorities
       * for different contexts, similar to how Templater allows folder-specific templates.
       *
       * Current behavior (limitation):
       * - Only a single global defaultTaskPriority setting exists
       * - All new tasks get the same default priority regardless of context
       *
       * Expected behavior (requested feature):
       * - Settings UI allows mapping contexts to default priorities
       * - When creating a task with a specific context, priority auto-sets
       * - Enables automatic "color coding" of tasks by context
       *
       * Implementation suggestions:
       * 1. Add contextPriorityDefaults: { [context: string]: string } to settings
       * 2. In TaskService.createTask(), check if task has contexts matching any default
       * 3. If matched, use that priority instead of global default
       * 4. Create settings UI similar to status/priority configuration tabs
       */
      const page = app.page;

      // Open settings to check for context-priority mapping
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });

      // Look for TaskNotes settings tab
      const taskNotesTab = settingsModal.locator('.vertical-tab-nav-item').filter({
        hasText: /tasknotes/i
      });

      if (await taskNotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesTab.click();
        await page.waitForTimeout(300);

        // Look for any context-priority mapping setting
        const contextPrioritySection = settingsModal.locator('.setting-item').filter({
          hasText: /context.*priority|priority.*context|default.*priority.*context/i
        });

        // This documents the missing feature - there's no per-context priority setting
        const hasContextPrioritySetting = await contextPrioritySection.isVisible({ timeout: 2000 }).catch(() => false);

        // Currently, this setting doesn't exist - documenting the feature gap
        expect(hasContextPrioritySetting).toBe(true);
      }

      // Close settings
      await page.keyboard.press('Escape');
    });

    test.fixme('reproduces issue #963 - creating task with context should use context default priority', async () => {
      /**
       * Test that when a context has a configured default priority,
       * new tasks with that context automatically get the priority.
       *
       * Test scenario:
       * 1. Configure @work context to default to "high" priority
       * 2. Create new task with @work context
       * 3. Verify task has "high" priority without manual selection
       */
      const page = app.page;

      // Create a task and add a context
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Add context
      const contextsInput = taskModal.locator('input[placeholder*="context"], [data-property="contexts"]');

      if (await contextsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contextsInput.fill('work');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);

        // Check what priority was set
        const prioritySelector = taskModal.locator('[data-property="priority"], .priority-select');

        if (await prioritySelector.isVisible({ timeout: 2000 }).catch(() => false)) {
          const priorityValue = await prioritySelector.inputValue().catch(() => null)
            || await prioritySelector.textContent();

          // Currently, this will be the global default, not a context-specific one
          // After the feature is implemented, this should be the context-specific default
          console.log(`Priority for @work context: ${priorityValue}`);
        }
      }

      // Close modal
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Part 2: Archive tag customization and opt-out', () => {
    test.fixme('reproduces issue #963 - should allow disabling archive tag entirely', async () => {
      /**
       * This test verifies that users can opt out of using tags for archived state,
       * relying solely on the boolean archived property.
       *
       * Current behavior (limitation):
       * - archiveTag is customizable but cannot be disabled
       * - When archiving, tag is always added to the tags array
       * - Even with property-based task identification, tags are still used
       *
       * Expected behavior (requested feature):
       * - Option to disable archive tag entirely
       * - Archive state tracked only via boolean property in frontmatter
       * - Users who use tags as temporary indicators can keep them clean
       *
       * Implementation suggestions:
       * 1. Add useArchiveTag: boolean setting (default true for backward compatibility)
       * 2. In FieldMapper.mapToFrontmatter(), check useArchiveTag before adding tag
       * 3. In TaskService.toggleArchive(), respect the setting
       * 4. Archive state would still work via the archived boolean property
       */
      const page = app.page;

      // Open settings and look for archive tag disable option
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });

      // Navigate to TaskNotes settings
      const taskNotesTab = settingsModal.locator('.vertical-tab-nav-item').filter({
        hasText: /tasknotes/i
      });

      if (await taskNotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesTab.click();
        await page.waitForTimeout(300);

        // Look for a toggle to disable archive tag
        const disableArchiveTagSetting = settingsModal.locator('.setting-item').filter({
          hasText: /disable.*archive.*tag|use.*archive.*tag|archive.*tag.*disable|no.*tag.*archive/i
        });

        const hasDisableOption = await disableArchiveTagSetting.isVisible({ timeout: 2000 }).catch(() => false);

        // Currently, this option doesn't exist - documenting the feature gap
        console.log('Disable archive tag option exists:', hasDisableOption);
        expect(hasDisableOption).toBe(true);
      }

      // Close settings
      await page.keyboard.press('Escape');
    });

    test.fixme('reproduces issue #963 - archiving with tag disabled should not add tags', async () => {
      /**
       * Test that when archive tag is disabled, archiving a task only sets
       * the archived boolean property without adding any tags.
       *
       * Test scenario:
       * 1. Disable archive tag in settings (once feature exists)
       * 2. Create a task
       * 3. Archive the task
       * 4. Verify no "archived" tag was added
       * 5. Verify archived boolean property is true
       */
      const page = app.page;

      // First, create a task
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Fill title
      const titleInput = taskModal.locator('input[placeholder*="title"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Test task for archive tag verification');
      }

      // Save task
      const saveButton = taskModal.locator('button').filter({ hasText: /save|create/i });
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
      }

      // Open task list and find the task
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskCard = page.locator('.task-card').filter({
        hasText: 'Test task for archive tag verification'
      }).first();

      if (await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Right-click to get context menu and archive
        await taskCard.click({ button: 'right' });
        await page.waitForTimeout(300);

        const archiveOption = page.locator('.menu-item').filter({
          hasText: /archive/i
        });

        if (await archiveOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await archiveOption.click();
          await page.waitForTimeout(500);

          // Now verify the task's tags
          // With the feature implemented, archived task should NOT have "archived" tag
          // Currently, it WILL have the tag - this documents the limitation

          // The verification would need to read the task's frontmatter
          // or check the task card's tag display
          const archivedTag = taskCard.locator('.tag').filter({
            hasText: /archived/i
          });

          // Current behavior: archived tag IS added
          // Expected after fix: archived tag should NOT be added when disabled
          const hasArchivedTag = await archivedTag.isVisible({ timeout: 1000 }).catch(() => false);
          console.log('Task has archived tag:', hasArchivedTag);

          // This assertion documents the expected behavior after the fix
          expect(hasArchivedTag).toBe(false);
        }
      }

      // Close view
      await page.keyboard.press('Escape');
    });

    test.fixme('reproduces issue #963 - empty task tag with property identification still adds task tag', async () => {
      /**
       * This test documents the user's reported issue: even when leaving
       * the task tag empty and using property-based identification,
       * the plugin still assigns the "task" tag.
       *
       * Current behavior (bug/limitation):
       * - User sets taskIdentificationMethod to "property"
       * - User leaves taskTag empty
       * - Plugin still writes "task" tag to frontmatter
       *
       * Expected behavior:
       * - With property identification and empty taskTag, no tags should be added
       * - Tags should be purely user-controlled, not plugin-managed
       *
       * Root cause in code:
       * - mapToFrontmatter() lines 296-299: taskTag is always preserved if provided
       * - Need to check if taskTag is empty/null before adding
       */
      const page = app.page;

      // This test would verify that with:
      // 1. taskIdentificationMethod: "property"
      // 2. taskTag: "" (empty)
      // Creating a new task does NOT add any automatic tags

      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });

      const taskNotesTab = settingsModal.locator('.vertical-tab-nav-item').filter({
        hasText: /tasknotes/i
      });

      if (await taskNotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesTab.click();
        await page.waitForTimeout(300);

        // Find task identification method setting
        const identificationSetting = settingsModal.locator('.setting-item').filter({
          hasText: /identification.*method|task.*identification/i
        });

        // Find task tag setting
        const taskTagSetting = settingsModal.locator('.setting-item').filter({
          hasText: /task.*tag/i
        }).first();

        // Log current values for debugging
        if (await identificationSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
          const currentMethod = await identificationSetting.locator('select, .dropdown-selected').textContent();
          console.log('Current identification method:', currentMethod);
        }

        if (await taskTagSetting.isVisible({ timeout: 2000 }).catch(() => false)) {
          const tagInput = taskTagSetting.locator('input');
          const currentTag = await tagInput.inputValue().catch(() => '');
          console.log('Current task tag:', currentTag);
        }
      }

      // Close settings
      await page.keyboard.press('Escape');

      // Create a task and check if tags were added
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.modal');
      if (await taskModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Check tags field
        const tagsField = taskModal.locator('[data-property="tags"], .tags-input, input[placeholder*="tag"]');

        if (await tagsField.isVisible({ timeout: 2000 }).catch(() => false)) {
          // With property identification and empty taskTag, this should be empty
          // Currently, it may contain the default "task" tag
          const tagsValue = await tagsField.inputValue().catch(() => null)
            || await tagsField.textContent();
          console.log('Auto-populated tags:', tagsValue);
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    });
  });
});
