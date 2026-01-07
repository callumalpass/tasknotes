/**
 * Issue #1051: Saving task modal removes additional list items from task identification property
 *
 * Bug Description:
 * When using a property-based task identification method (e.g., "class" property with value "task"),
 * and that same property contains additional list values (e.g., "task, habit, chore, expense"),
 * saving the Task Modal removes all additional list items and keeps only the identification value ("task").
 *
 * User's setup:
 * - Uses property "class" with value "task" for task identification (instead of a tag)
 * - Also added "class" property to custom user fields to display/edit it in the modal UI
 * - The "class" property may contain multiple values like ["task", "habit"] for categorization
 *
 * Example:
 * - Before save: class: [task, habit]  OR  class: "task, habit"
 * - After save:  class: task
 *
 * Root cause analysis:
 * The issue is in TaskService.ts at line 1393 where during an update operation:
 * ```typescript
 * if (this.plugin.settings.taskIdentificationMethod === "property") {
 *     const propName = this.plugin.settings.taskPropertyName;
 *     const propValue = this.plugin.settings.taskPropertyValue;
 *     if (propName && propValue) {
 *         frontmatter[propName] = coercedValue as any;  // This overwrites the entire property
 *     }
 * }
 * ```
 *
 * The code unconditionally sets the task identification property to the configured value,
 * overwriting any existing list values. The fix should:
 * 1. Check if the property is a list/array
 * 2. Ensure the identification value is present in the list
 * 3. Preserve other values in the list
 *
 * A similar issue exists in task creation (line 368) where the property is also set
 * without consideration for preserving additional values if they were added via user fields.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1051
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1051: Task identification property list values preserved on save', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1051 - saving task modal should preserve additional list items in identification property', async () => {
    /**
     * This test verifies that when using property-based task identification,
     * saving the Task Modal preserves additional list values in that property.
     *
     * Setup required:
     * - Task identification method: "property"
     * - Task property name: "class"
     * - Task property value: "task"
     * - "class" added as a user field (list type) in settings
     *
     * Steps:
     * 1. Create or find a task with class: [task, habit]
     * 2. Open the task modal
     * 3. Make any change (or none) and save
     * 4. Verify class still contains [task, habit], not just [task]
     *
     * Expected behavior:
     * - The "class" property should retain all values: [task, habit]
     * - Only the "task" value is required for identification, other values are user data
     *
     * Current behavior (bug):
     * - After saving, "class" becomes just "task"
     * - The "habit" value is lost
     */
    const page = app.page;

    // First, open the Task List to find an existing task
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Find a task card to open
    const taskCard = page.locator('.task-card').first();
    if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Note: This test requires a vault with property-based task identification
      // and tasks that have additional values in the identification property

      // Double-click to open the task modal
      await taskCard.dblclick();
      await page.waitForTimeout(500);

      // Check if the task modal opened
      const taskModal = page.locator('.tasknotes-task-modal, .modal');
      if (await taskModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look for the user field that shows the "class" property (or similar)
        const classField = taskModal.locator('[data-field-key="class"], .user-field-class');

        if (await classField.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Get the current value before saving
          const valueBefore = await classField.inputValue().catch(() =>
            classField.textContent()
          );
          console.log(`Class field value before save: ${valueBefore}`);

          // Save the modal
          const saveButton = taskModal.locator('button:has-text("Save"), .mod-cta');
          if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await saveButton.click();
            await page.waitForTimeout(500);
          }

          // Reopen the same task
          await taskCard.dblclick();
          await page.waitForTimeout(500);

          // Check the value after save
          const valueAfter = await classField.inputValue().catch(() =>
            classField.textContent()
          );
          console.log(`Class field value after save: ${valueAfter}`);

          // The bug: valueBefore might be "task, habit" but valueAfter becomes just "task"
          expect(valueAfter).toBe(valueBefore);
        }

        await page.keyboard.press('Escape');
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1051 - list property values should not be converted to single value on save', async () => {
    /**
     * This test verifies that YAML list properties are not converted to
     * single values when saving the task modal.
     *
     * The user's frontmatter might look like:
     * ```yaml
     * class:
     *   - task
     *   - habit
     *   - chore
     * ```
     *
     * After the bug manifests, it becomes:
     * ```yaml
     * class: task
     * ```
     *
     * This is problematic because:
     * 1. User data is lost
     * 2. The property type changes from list to string
     * 3. Other tools/plugins expecting a list will break
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Get a sample task to examine
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    console.log(`Found ${taskCount} tasks to examine`);

    // This test documents the issue for when the fix is implemented
    // A proper test would:
    // 1. Create a task with a list-type identification property
    // 2. Verify the list format is preserved after save
    // 3. Check that multiple values survive round-trip editing

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1051 - user field changes should merge with identification property, not overwrite', async () => {
    /**
     * This test verifies the interaction between:
     * 1. The task identification property (e.g., class: task)
     * 2. The same property exposed as a user field in the modal
     *
     * When the user modifies the user field (adding values like "habit"),
     * and the task is saved, both the identification value AND the user's
     * additional values should be preserved.
     *
     * The fix should ensure that:
     * - If the property is already a list, add the identification value if missing
     * - If the property is a string, check if it already contains the identification value
     * - Never blindly overwrite the entire property value
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Open a task modal
    const taskCard = page.locator('.task-card').first();
    if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskCard.dblclick();
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-task-modal, .modal');
      if (await taskModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look for any list-type user field
        const listField = taskModal.locator('input[type="text"]').first();

        if (await listField.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Try to add a value to the field
          const currentValue = await listField.inputValue();
          console.log(`Current field value: ${currentValue}`);

          // Type an additional value
          await listField.fill(`${currentValue}, test-value`);

          // Save and verify
          const saveButton = taskModal.locator('button:has-text("Save"), .mod-cta');
          if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await saveButton.click();
            await page.waitForTimeout(500);
          }

          // Reopen and check
          await taskCard.dblclick();
          await page.waitForTimeout(500);

          const newValue = await listField.inputValue();
          console.log(`Value after save: ${newValue}`);

          // Verify our test value persisted
          expect(newValue).toContain('test-value');
        }

        await page.keyboard.press('Escape');
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1051 - identification property should allow custom values alongside required value', async () => {
    /**
     * This test documents the user expectation that the task identification property
     * can be used for dual purposes:
     * 1. Identifying the note as a task (required value: "task")
     * 2. Additional categorization (custom values: "habit", "chore", "expense", etc.)
     *
     * This is a valid use case where users want to:
     * - Keep task identification via property (not tag)
     * - Use the same property for additional classification
     * - Display and edit the property in the modal UI
     *
     * The plugin should support this workflow by preserving all list values
     * as long as the required identification value is present.
     */
    const page = app.page;

    // This test serves as documentation of the expected behavior
    // The fix in TaskService.ts should:
    //
    // 1. Read the current property value
    // 2. If it's a list, ensure the identification value is included
    // 3. If it's a string, preserve it if it equals the identification value,
    //    or convert to list if multiple values are needed
    // 4. Never blindly overwrite the property

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    console.log('This test documents the expected behavior for issue #1051');
    console.log('Task identification property should preserve additional list values');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
