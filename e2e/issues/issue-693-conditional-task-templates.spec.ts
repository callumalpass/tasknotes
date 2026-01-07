/**
 * Issue #693: [FR] Allow for multiple template types for task notes based on Tag or Property criteria
 *
 * Feature Request Description:
 * Enable auto-template selection during task creation conditioned on certain Tags or Properties.
 * For example: If tag == X then use template yyy.md for its creation.
 *
 * Use Cases:
 * - MRD Task (with relevant template forms and bases)
 * - CS Task (with tickets and dataview queries)
 * - Book chapter Task (with character/scenery/plot framing)
 * - Recipe Task (with ingredients and steps fields)
 *
 * Current Behavior:
 * - Single body template applied to all tasks (configured via useBodyTemplate and bodyTemplate settings)
 * - No conditional template selection based on task metadata
 *
 * Expected Behavior:
 * - Multiple templates can be configured with tag/property conditions
 * - When creating a task, the appropriate template is auto-selected based on matching conditions
 * - Falls back to default template if no conditions match
 *
 * @see https://github.com/callumalpass/tasknotes/issues/693
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #693: Multiple template types based on Tag/Property criteria', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #693 - different tags should trigger different templates',
    async () => {
      /**
       * This test verifies that tasks with different tags can use different templates.
       *
       * Setup needed for this feature:
       * 1. Create multiple template files:
       *    - Templates/MRDTask.md (with MRD-specific content)
       *    - Templates/CSTask.md (with CS-specific content)
       *    - Templates/DefaultTask.md (fallback)
       * 2. Configure template rules in settings:
       *    - If tag contains "mrd" -> use Templates/MRDTask.md
       *    - If tag contains "support" -> use Templates/CSTask.md
       *    - Default -> use Templates/DefaultTask.md
       *
       * Test Flow:
       * 1. Create task with #mrd tag -> should get MRD template content
       * 2. Create task with #support tag -> should get CS template content
       * 3. Create task with no matching tags -> should get default template
       */
      const page = app.page;

      // Create template files for testing
      // MRD template with specific structure
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntype: template\n---\n\n## MRD Task Template\n\n### Market Requirements\n- [ ] Target market defined\n- [ ] Competitive analysis\n\n### Product Specs\n- [ ] Feature list\n- [ ] Priority ranking\n\n{{details}}\n', { delay: 5 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // CS/Support template with different structure
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntype: template\n---\n\n## Support Ticket Template\n\n### Ticket Info\n- Customer: \n- Priority: {{priority}}\n- Status: {{status}}\n\n### Issue Description\n{{details}}\n\n### Resolution Steps\n1. \n\n### Follow-up Required\n- [ ] Customer notified\n', { delay: 5 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // Default template
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(500);
      await page.keyboard.type('---\ntype: template\n---\n\n## Task: {{title}}\n\n### Details\n{{details}}\n\n### Checklist\n- [ ] Item 1\n', { delay: 5 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // Open TaskNotes settings to look for template rules configuration
      // (This feature doesn't exist yet - this test documents expected behavior)
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(1000);

      const settingsModal = page.locator('.modal.mod-settings');
      if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
        if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await pluginTab.click();
          await page.waitForTimeout(500);
        }

        // Look for template rules configuration section (FEATURE NOT YET IMPLEMENTED)
        // Expected: A section to configure multiple templates with conditions
        const templateRulesSection = page.locator(
          'text=Template rules, text=Conditional templates, text=Template conditions, text=Task type templates'
        ).first();

        const hasTemplateRules = await templateRulesSection.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Template rules section found: ${hasTemplateRules}`);

        // Currently this feature doesn't exist - the test documents expected behavior
        // When implemented, there should be UI for:
        // - Adding template rules
        // - Configuring conditions (tag match, property match)
        // - Selecting template file for each rule
        // - Setting rule priority/order

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // Test creating a task with #mrd tag
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const createModal = page.locator('.modal');
      if (await createModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Enter task title with #mrd tag
        const titleInput = createModal.locator(
          'input[placeholder*="title"], input.task-title, .task-title-input, input[type="text"]'
        ).first();

        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await titleInput.fill('Review MRD document #mrd');
          await page.waitForTimeout(300);
        }

        // Create the task
        const createButton = createModal.locator('button:has-text("Create"), button:has-text("Save")').first();
        if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createButton.click();
        } else {
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(1500);

        // Open the created task to check its content
        await runCommand(page, 'Quick switcher: Open quick switcher');
        await page.waitForTimeout(300);
        await page.keyboard.type('Review MRD document');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Check if the task content matches the MRD template
        // EXPECTED: Should contain "## MRD Task Template" and "### Market Requirements"
        // CURRENT: Will contain default template or no template content

        const editorContent = page.locator('.cm-editor .cm-content, .markdown-source-view');
        if (await editorContent.isVisible({ timeout: 2000 }).catch(() => false)) {
          const content = await editorContent.textContent();
          console.log('Task content (first 200 chars):', content?.substring(0, 200));

          // These assertions document expected behavior when feature is implemented
          // Currently will fail because conditional templates don't exist
          const hasMRDTemplate = content?.includes('Market Requirements') ?? false;
          console.log(`Has MRD template content: ${hasMRDTemplate}`);

          // Feature not implemented: expect this to fail currently
          // expect(hasMRDTemplate).toBe(true);
        }
      }

      // Document the gap between current and expected behavior
      console.log('\n=== Issue #693 Feature Gap ===');
      console.log('Current: Single template for all tasks');
      console.log('Expected: Template selection based on tag/property conditions');
      console.log('User would configure rules like: tag:mrd -> MRDTask.md');
    }
  );

  test.fixme(
    'reproduces issue #693 - property values should trigger different templates',
    async () => {
      /**
       * This test verifies that tasks with specific property values use appropriate templates.
       *
       * Example: A "type" property could determine template:
       * - type: "meeting" -> MeetingNotes.md template
       * - type: "research" -> ResearchTask.md template
       * - type: "bug" -> BugReport.md template
       */
      const page = app.page;

      // Create a task using TaskNotes modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const createModal = page.locator('.modal');
      if (await createModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Fill in title
        const titleInput = createModal.locator(
          'input[placeholder*="title"], input.task-title, .task-title-input, input[type="text"]'
        ).first();

        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await titleInput.fill('Weekly sync meeting');
        }

        // Look for custom field / property input to set type
        // If there's a "type" field configured, we'd set it to "meeting"
        const typeField = createModal.locator(
          '[data-field="type"], input[name="type"], .user-field-type'
        ).first();

        if (await typeField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await typeField.fill('meeting');
        }

        // Create the task
        const createButton = createModal.locator('button:has-text("Create"), button:has-text("Save")').first();
        if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createButton.click();
        }
        await page.waitForTimeout(1000);

        // EXPECTED: Task note should be created with MeetingNotes.md template
        // containing meeting-specific fields like attendees, agenda, action items
        // CURRENT: Uses default template regardless of property value
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      console.log('\n=== Issue #693 Property-Based Templates ===');
      console.log('Expected: property value determines template selection');
      console.log('Example: type:meeting -> MeetingNotes.md template');
    }
  );

  test.fixme(
    'reproduces issue #693 - settings UI should support template rules configuration',
    async () => {
      /**
       * This test documents the expected settings UI for configuring template rules.
       *
       * Expected Settings Structure:
       * - "Template Rules" section in Features tab
       * - Ability to add/remove/reorder rules
       * - Each rule has:
       *   - Condition type: "Tag matches" or "Property equals"
       *   - Condition value: tag name or property name + value
       *   - Template file: file picker for template markdown file
       * - Default template fallback
       */
      const page = app.page;

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

        // Look for template-related settings
        const templateSettings = page.locator('.setting-item').filter({
          hasText: /template/i
        });
        const templateSettingsCount = await templateSettings.count();
        console.log(`Found ${templateSettingsCount} template-related settings`);

        // Document current template settings
        for (let i = 0; i < Math.min(templateSettingsCount, 5); i++) {
          const settingName = await templateSettings.nth(i).locator('.setting-item-name').textContent();
          console.log(`Template setting ${i + 1}: ${settingName}`);
        }

        // EXPECTED UI ELEMENTS (feature not yet implemented):
        // - "Template Rules" heading/section
        // - "Add Rule" button
        // - List of configured rules with:
        //   - Condition dropdown (Tag/Property)
        //   - Value input
        //   - Template file picker
        //   - Delete button
        //   - Drag handle for reordering

        const templateRulesHeading = page.locator('text=Template Rules, text=Conditional Templates').first();
        const hasTemplateRulesUI = await templateRulesHeading.isVisible({ timeout: 1000 }).catch(() => false);

        const addRuleButton = page.locator('button:has-text("Add Rule"), button:has-text("Add Template Rule")').first();
        const hasAddRuleButton = await addRuleButton.isVisible({ timeout: 1000 }).catch(() => false);

        console.log('\n=== Issue #693 Settings UI Gap ===');
        console.log(`Template Rules section exists: ${hasTemplateRulesUI}`);
        console.log(`Add Rule button exists: ${hasAddRuleButton}`);
        console.log('Expected: Full UI for managing conditional template rules');

        await page.keyboard.press('Escape');
      }
    }
  );

  test.fixme(
    'reproduces issue #693 - template rules should evaluate in order with first match wins',
    async () => {
      /**
       * This test verifies that when multiple rules could match, the first matching rule wins.
       *
       * Example rules (in order):
       * 1. tag:urgent AND tag:bug -> UrgentBug.md
       * 2. tag:bug -> BugReport.md
       * 3. tag:urgent -> UrgentTask.md
       * 4. default -> DefaultTask.md
       *
       * Task with tags [urgent, bug] should match rule 1, not rules 2 or 3
       */
      const page = app.page;

      // This test documents the expected rule evaluation behavior
      console.log('\n=== Issue #693 Rule Evaluation ===');
      console.log('Expected: Rules evaluated in configured order, first match wins');
      console.log('Example: Task with #urgent #bug matches first rule, not subsequent ones');

      // Create task with multiple tags that could match different rules
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const createModal = page.locator('.modal');
      if (await createModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        const titleInput = createModal.locator(
          'input[placeholder*="title"], input.task-title, .task-title-input, input[type="text"]'
        ).first();

        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Task with multiple tags that could match different rules
          await titleInput.fill('Critical database issue #urgent #bug #backend');
        }

        const createButton = createModal.locator('button:has-text("Create"), button:has-text("Save")').first();
        if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createButton.click();
        }
        await page.waitForTimeout(1000);

        // EXPECTED: Uses UrgentBug.md template (first matching rule)
        // NOT BugReport.md or UrgentTask.md (later rules)
      }

      await page.keyboard.press('Escape');
    }
  );
});
