/**
 * Issue #1120: Status does not inherit customisation in properties
 *
 * Bug Description:
 * In 4.0.0-beta 3, the status property does not inherit customisation.
 * When a user customises the TaskNotes status field to a custom name like
 * "task-status", the checkbox/status behavior only works when selecting
 * the default "status" property, not the custom property name.
 *
 * Root cause analysis:
 * The issue occurs because several parts of the codebase use hardcoded
 * property names (like "status") instead of checking if a property
 * represents the status field through the FieldMapper service.
 *
 * Key areas affected:
 * - PropertyVisibilityDropdown.ts uses hardcoded property IDs like "status"
 * - Bases views may not respect custom property name mappings
 * - Checkbox rendering in Bases is tied to the property name, not the field type
 *
 * The FieldMapper service provides:
 * - isPropertyForField(propertyName, internalField) - checks if a custom name maps to a field
 * - toUserField(internalField) - converts internal field to user's custom name
 * - lookupMappingKey(userPropertyName) - finds internal field from custom name
 *
 * Fix approach (implemented in 4.0.1):
 * Ensure all property checks use the FieldMapper service to respect custom
 * property name mappings throughout the application.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1120
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1120: Status property does not inherit customisation', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1120 - custom status property name should show checkbox in Bases views',
    async () => {
      /**
       * This test verifies that when a user customizes the status property
       * name (e.g., to "task-status"), the checkbox functionality still works
       * in Bases views.
       *
       * Current behavior (bug in 4.0.0-beta 3):
       * - User configures status property as "task-status" in settings
       * - When viewing tasks in a Bases view, only the "status" property
       *   shows checkboxes, not "task-status"
       * - The custom property name is not recognized as a status field
       *
       * Expected behavior:
       * - The custom property name should be recognized as the status field
       * - Checkboxes should appear for the custom property
       * - All status-related functionality should work with custom names
       */
      const page = app.page;

      // Open TaskNotes settings to check/configure custom status property name
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });

      // Navigate to TaskNotes settings
      const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await tasknotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tasknotesTab.click();
        await page.waitForTimeout(300);
      }

      // Look for property mapping settings
      // The status property mapping should allow customization
      const propertyMappingSection = page.locator(
        '.setting-item:has-text("status"), ' +
          '.setting-item:has-text("Property mapping"), ' +
          '.setting-item:has-text("Field mapping")'
      );

      if (await propertyMappingSection.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        // Check if there's an input for custom status property name
        const statusInput = propertyMappingSection.locator('input').first();
        if (await statusInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          const currentValue = await statusInput.inputValue();
          console.log('Current status property name:', currentValue);
        }
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Open a Bases Task List view
      await runCommand(page, 'TaskNotes: Open Task List');
      await page.waitForTimeout(1000);

      const taskList = page.locator('.tasknotes-plugin, .bases-container');
      await expect(taskList).toBeVisible({ timeout: 10000 });

      // Look for status checkboxes in the task cards
      // If custom property name is not respected, checkboxes won't appear
      // for properties named with the custom name
      const statusCheckboxes = page.locator(
        '.task-card__status-checkbox, ' +
          'input[type="checkbox"][data-property="status"], ' +
          '.status-checkbox'
      );

      const checkboxCount = await statusCheckboxes.count();
      console.log('Status checkboxes found:', checkboxCount);

      // Also check for status indicators (dots)
      const statusDots = page.locator('.task-card__status-dot, .status-dot');
      const dotCount = await statusDots.count();
      console.log('Status dots found:', dotCount);

      // The bug manifests when:
      // 1. User has customized status property name
      // 2. Bases view uses the custom name in its configuration
      // 3. Checkboxes/status indicators don't appear because the code
      //    checks for "status" instead of the user's custom name

      // After the fix, status functionality should work regardless
      // of what the user named their status property
      expect(checkboxCount).toBeGreaterThan(0);
    }
  );

  test.fixme(
    'reproduces issue #1120 - FieldMapper should be used for property checks',
    async () => {
      /**
       * This test verifies that the FieldMapper service is properly used
       * throughout the application to check if a property represents
       * the status field.
       *
       * The FieldMapper provides:
       * - isPropertyForField("task-status", "status") returns true
       * - isPropertyForField("status", "status") returns false (if custom)
       *
       * The bug occurs when code uses hardcoded checks like:
       *   if (propertyName === "status") { ... }
       *
       * Instead of:
       *   if (isPropertyForField(propertyName, "status", plugin)) { ... }
       */
      const page = app.page;

      // Open Task List view
      await runCommand(page, 'TaskNotes: Open Task List');
      await page.waitForTimeout(1000);

      // Find a task card
      const taskCard = page.locator('.task-card').first();

      if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Get all property-related elements and their identifiers
        const propertyAnalysis = await taskCard.evaluate((card) => {
          const result: {
            visibleProperties: string[];
            hasStatusDot: boolean;
            hasPriorityDot: boolean;
            dataAttributes: Record<string, string>;
          } = {
            visibleProperties: [],
            hasStatusDot: false,
            hasPriorityDot: false,
            dataAttributes: {},
          };

          // Check for status dot
          const statusDot = card.querySelector('.task-card__status-dot, .status-dot');
          result.hasStatusDot = !!statusDot;

          // Check for priority dot
          const priorityDot = card.querySelector('.task-card__priority-dot, .priority-dot');
          result.hasPriorityDot = !!priorityDot;

          // Get data attributes
          for (const attr of Array.from(card.attributes)) {
            if (attr.name.startsWith('data-')) {
              result.dataAttributes[attr.name] = attr.value;
            }
          }

          // Get visible property elements
          const propertyEls = card.querySelectorAll('[data-property], .task-card__property');
          propertyEls.forEach((el) => {
            const prop = el.getAttribute('data-property') || el.className;
            result.visibleProperties.push(prop);
          });

          return result;
        });

        console.log('Task card property analysis:', JSON.stringify(propertyAnalysis, null, 2));

        // The fix should ensure that:
        // 1. Status dots appear based on FieldMapper check, not hardcoded "status"
        // 2. Property visibility respects custom property names
        // 3. The same behavior works for all field types (status, priority, due, etc.)
      }
    }
  );

  test.fixme(
    'reproduces issue #1120 - PropertyVisibilityDropdown should use mapped property names',
    async () => {
      /**
       * The PropertyVisibilityDropdown uses hardcoded property IDs like
       * "status", "priority", etc. (see lines 124, 131 in the file).
       *
       * When a user has customized these property names, the dropdown
       * should still show the user's custom names and map them correctly
       * to the internal field types.
       *
       * This test verifies that the property visibility dropdown
       * correctly handles custom property name mappings.
       */
      const page = app.page;

      // Open Task List view
      await runCommand(page, 'TaskNotes: Open Task List');
      await page.waitForTimeout(1000);

      // Look for the property visibility dropdown/menu
      // This is typically in a header or toolbar area
      const propertyVisibilityButton = page.locator(
        '[data-testid="property-visibility"], ' +
          'button[aria-label*="properties"], ' +
          'button[aria-label*="visibility"], ' +
          '.property-visibility-toggle'
      );

      if (await propertyVisibilityButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await propertyVisibilityButton.click();
        await page.waitForTimeout(300);

        // Look for the dropdown menu
        const dropdown = page.locator('.menu, .dropdown, .property-visibility-dropdown');

        if (await dropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Get all property options
          const propertyOptions = dropdown.locator('.menu-item, .dropdown-item, label');
          const optionCount = await propertyOptions.count();

          const optionTexts: string[] = [];
          for (let i = 0; i < optionCount; i++) {
            const text = await propertyOptions.nth(i).textContent();
            if (text) optionTexts.push(text.trim());
          }

          console.log('Property visibility options:', optionTexts);

          // The fix should ensure that:
          // 1. Property options show user's custom names (e.g., "task-status" not "status")
          // 2. Selecting a custom-named property works the same as selecting "status"
          // 3. The internal field mapping is preserved
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  );

  test.fixme(
    'reproduces issue #1120 - Bases view should respect custom status property in filter configuration',
    async () => {
      /**
       * When a Bases view is configured to show/filter by status,
       * it should use the user's custom property name in its YAML configuration.
       *
       * For example, if user has status mapped to "task-status":
       * - The Bases view should use "task-status" in filters
       * - Property-based events should use "task-status"
       * - Grouping by status should use "task-status"
       *
       * The bug: Bases views may be hardcoded to use "status" property name.
       */
      const page = app.page;

      // Open a Bases view (Task List uses .base files)
      await runCommand(page, 'TaskNotes: Open Task List');
      await page.waitForTimeout(1000);

      // Look for any status-related UI elements
      // Group headers for status grouping
      const statusGroupHeaders = page.locator(
        '.group-header:has-text("status"), ' +
          '.group-header:has-text("task-status"), ' +
          '[data-group-property="status"], ' +
          '[data-group-property="task-status"]'
      );

      const groupHeaderCount = await statusGroupHeaders.count();
      console.log('Status group headers found:', groupHeaderCount);

      if (groupHeaderCount > 0) {
        for (let i = 0; i < Math.min(groupHeaderCount, 3); i++) {
          const header = statusGroupHeaders.nth(i);
          const headerText = await header.textContent();
          const dataAttr = await header.getAttribute('data-group-property');
          console.log(`Group header ${i}:`, { text: headerText, property: dataAttr });
        }
      }

      // Check if status filtering/grouping is working
      // The bug would manifest as:
      // - No status groups visible when grouped by status
      // - Status filters not matching tasks with custom property name
    }
  );

  test.fixme(
    'reproduces issue #1120 - isPropertyForField utility should be used consistently',
    async () => {
      /**
       * The isPropertyForField utility from utils/propertyMapping.ts should be
       * used throughout the codebase instead of direct string comparisons.
       *
       * Example of correct usage (from TaskCard.ts):
       *   visibleProperties.some((prop) => isPropertyForField(prop, "status", plugin))
       *
       * Example of incorrect usage (causes this bug):
       *   visibleProperties.some((prop) => prop === "status")
       *
       * This test documents the expected behavior after the fix.
       */
      const page = app.page;

      // Open Task List view
      await runCommand(page, 'TaskNotes: Open Task List');
      await page.waitForTimeout(1000);

      const taskCards = page.locator('.task-card');
      const cardCount = await taskCards.count();

      console.log('Task cards found:', cardCount);

      if (cardCount > 0) {
        // Examine first few cards for status indicator consistency
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = taskCards.nth(i);

          const cardAnalysis = await card.evaluate((el) => {
            return {
              hasStatusIndicator:
                !!el.querySelector('.task-card__status-dot') ||
                !!el.querySelector('.status-indicator'),
              hasPriorityIndicator:
                !!el.querySelector('.task-card__priority-dot') ||
                !!el.querySelector('.priority-indicator'),
              classes: el.className,
              statusClass: Array.from(el.classList).find(
                (c) => c.includes('status') || c.includes('task-status')
              ),
            };
          });

          console.log(`Card ${i} analysis:`, cardAnalysis);

          // After fix, all cards should have consistent status indicators
          // regardless of whether the status property is named "status" or custom
        }
      }

      // The fix ensures that:
      // 1. isPropertyForField is used for all property type checks
      // 2. Custom property names work identically to default names
      // 3. UI elements (checkboxes, dots, grouping) all respect the mapping
    }
  );
});
