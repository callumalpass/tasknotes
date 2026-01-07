/**
 * Issue #929: [FR]: Recurring task with subtasks
 *
 * Feature request description:
 * Currently, when a recurring task contains subtasks (either as markdown checkboxes
 * in the details field or linked child tasks), those subtasks are shared across
 * every instance of the recurring task.
 *
 * The user wants to have a recurring task with a list of subtasks that reset to
 * "to-do" state for every new instance of the recurring task. Currently:
 * - Subtasks in the details field (markdown checkbox format) are shared
 * - When a checkbox is marked as complete, it's marked complete for ALL instances
 * - The same applies to linked child tasks
 *
 * Root cause:
 * TaskNotes uses a single-file model for recurring tasks where:
 * - All instances share the same task file
 * - The `details` field (containing markdown checkboxes) is shared across instances
 * - Only the completion status per-date is tracked in `complete_instances` array
 * - There is no mechanism to have per-instance subtask completion state
 *
 * The current implementation tracks:
 * - `complete_instances`: Array of dates when the recurring task instance was completed
 * - `skipped_instances`: Array of dates when the recurring task was skipped
 *
 * But it does NOT track:
 * - Per-instance subtask completion states
 * - Per-instance details/description content
 *
 * Suggested implementation approaches:
 * 1. Store subtask completion per-instance in a new field (e.g., `instance_subtasks`)
 * 2. Template-based approach: Store subtasks as a template and create per-instance copies
 * 3. Virtual subtask rendering: Show subtasks as unchecked based on current instance date
 *
 * @see https://github.com/callumalpass/tasknotes/issues/929
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #929: Recurring task with subtasks', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #929 - subtasks in recurring task details are shared across all instances',
    async () => {
      /**
       * Reproduction steps:
       * 1. Create a recurring task with subtasks in the details field
       * 2. Mark a subtask as complete on today's instance
       * 3. Navigate to a future instance
       * 4. Observe that the subtask is STILL marked as complete (bug)
       *
       * Expected behavior (feature request):
       * - Each recurring task instance should have its own subtask completion state
       * - Checking a subtask on one instance should not affect other instances
       */
      const page = app.page;

      // Open task list view to find a recurring task with details/subtasks
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskListView = page.locator('.tasknotes-task-list, .task-list-view');
      await expect(taskListView).toBeVisible({ timeout: 10000 });

      // Find a recurring task
      const recurringTaskCard = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({ has: page.locator('[data-property="recurrence"], .recurrence-indicator') })
        .first();

      if (!(await recurringTaskCard.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('No recurring tasks found - test requires a recurring task to exist');
        return;
      }

      // Open the task details/editor
      await recurringTaskCard.dblclick();
      await page.waitForTimeout(1000);

      // Look for the details section with checkboxes
      const editor = page.locator('.markdown-source-view, .markdown-preview-view');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Find markdown checkboxes in the task content
      const checkboxes = page.locator(
        '.task-list-item input[type="checkbox"], ' +
          '.cm-formatting-task, ' +
          '[data-task]'
      );

      const checkboxCount = await checkboxes.count();
      console.log(`Found ${checkboxCount} checkboxes in task details`);

      if (checkboxCount > 0) {
        // Get initial state of first checkbox
        const firstCheckbox = checkboxes.first();
        const initialChecked = await firstCheckbox.isChecked().catch(() => false);
        console.log(`First checkbox initial state: ${initialChecked ? 'checked' : 'unchecked'}`);

        // The bug: if this checkbox is checked, it will be checked for ALL instances
        // After the feature is implemented:
        // - Each instance should track its own checkbox states
        // - Checking a box on Monday's instance shouldn't affect Tuesday's instance
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #929 - markdown to-do items in description are shared across instances',
    async () => {
      /**
       * User's exact scenario from the issue:
       * "I tried to add a description to the task with markdown To-Do style,
       * but the description is shared as well, so whenever I mark a To-Do item
       * as completed, it is marked as completed on any instance of the recurring
       * task as well."
       *
       * This test verifies the current (buggy) behavior where markdown checkboxes
       * in the task description are shared.
       */
      const page = app.page;

      // Open calendar view to see recurring task instances on different dates
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for recurring task events (they typically have a recurrence indicator)
      const recurringEvents = page.locator(
        '.fc-event:has([data-recurrence]), ' +
          '.fc-event.recurring, ' +
          '.fc-event:has(.recurrence-icon)'
      );

      const eventCount = await recurringEvents.count();
      console.log(`Found ${eventCount} recurring events on calendar`);

      if (eventCount > 0) {
        // Click on a recurring event to open it
        await recurringEvents.first().click();
        await page.waitForTimeout(500);

        // Look for task details panel or modal
        const detailsPanel = page.locator(
          '.task-details-panel, ' +
            '.side-panel, ' +
            '.modal:has(.task-details)'
        );

        if (await detailsPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check for description/details with checkboxes
          const descriptionSection = detailsPanel.locator('.task-details, .task-description');

          if (await descriptionSection.isVisible().catch(() => false)) {
            const todoItems = descriptionSection.locator(
              '.task-list-item, input[type="checkbox"], [data-task]'
            );
            const todoCount = await todoItems.count();
            console.log(`Found ${todoCount} to-do items in description`);

            // Bug: These to-do items are SHARED across all instances
            // When you check one on today's instance, it's checked on ALL instances
          }
        }

        await page.keyboard.press('Escape');
      }
    }
  );

  test.fixme(
    'reproduces issue #929 - linked subtasks are also shared across recurring instances',
    async () => {
      /**
       * This test verifies that the issue also applies to linked subtasks
       * (child tasks that reference the recurring task as their project/parent).
       *
       * Since the recurring task is a single file, any tasks that reference it
       * as a parent will appear for ALL instances of the recurring task.
       */
      const page = app.page;

      // Open task list view
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      // Find a recurring task that acts as a project (has subtasks)
      const recurringProjectTask = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({
          has: page.locator('[data-property="recurrence"], .recurrence-indicator'),
        })
        .filter({
          has: page.locator('.task-card__chevron, [data-has-subtasks="true"]'),
        })
        .first();

      if (!(await recurringProjectTask.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('No recurring task with subtasks found');
        return;
      }

      // Expand subtasks
      const chevron = recurringProjectTask.locator('.task-card__chevron');
      if (await chevron.isVisible().catch(() => false)) {
        await chevron.click();
        await page.waitForTimeout(500);
      }

      // Look for subtask cards
      const subtaskCards = page.locator('.task-card.subtask, .task-card.child-task');
      const subtaskCount = await subtaskCards.count();
      console.log(`Found ${subtaskCount} subtasks`);

      // Bug: These subtasks are linked to the recurring task file itself,
      // not to a specific instance. So if you complete a subtask,
      // it's completed for ALL instances of the recurring parent.

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #929 - verifies single-file model for recurring tasks',
    async () => {
      /**
       * This test documents the root cause: recurring tasks use a single-file model.
       *
       * Technical details:
       * - Recurring task is stored as ONE markdown file
       * - `recurrence` field contains the RRULE pattern
       * - `complete_instances` array tracks which dates were completed
       * - `details` field is shared across all instances
       * - Child tasks (subtasks) reference the file, not an instance
       *
       * This architecture makes per-instance subtask state challenging to implement.
       */
      const page = app.page;

      // Open task list view
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      // Find a recurring task
      const recurringTask = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({ has: page.locator('[data-property="recurrence"]') })
        .first();

      if (!(await recurringTask.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('No recurring tasks found');
        return;
      }

      // Get task name for file lookup
      const taskTitle = await recurringTask
        .locator('.task-title, .task-card__title')
        .textContent()
        .catch(() => '');
      console.log(`Recurring task: "${taskTitle}"`);

      // Open the file explorer to verify single-file model
      await runCommand(page, 'Show file explorer');
      await page.waitForTimeout(500);

      // The recurring task should have only ONE file
      // NOT separate files for each instance
      // This is the architectural reason why subtasks are shared

      console.log('Architectural constraint:');
      console.log('- Recurring tasks = 1 markdown file');
      console.log('- Details/subtasks are in that 1 file');
      console.log('- No per-instance file copies are created');
      console.log('- Therefore subtask state is shared across instances');

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #929 - expected behavior for per-instance subtasks',
    async () => {
      /**
       * This test documents the EXPECTED behavior after the feature is implemented.
       *
       * User expectation:
       * "I would like to have a recurrent task with a list of subtasks that are
       * in 'to-do' state every day."
       *
       * Implementation requirements:
       * 1. Each instance of a recurring task should have independent subtask states
       * 2. When viewing an instance, subtasks should show their state FOR THAT INSTANCE
       * 3. Checking a subtask on one day should not affect other days
       * 4. When a new instance becomes active, subtasks should reset to unchecked
       *
       * Possible implementation approaches:
       * A) Store per-instance subtask state in a new field:
       *    instance_subtasks: {
       *      "2026-01-07": ["subtask1", "subtask2"],  // completed subtasks for this date
       *      "2026-01-08": [],                         // no subtasks completed yet
       *    }
       *
       * B) Template-based approach:
       *    - Store subtasks as a template in the recurring task
       *    - When viewing an instance, render the template with instance-specific state
       *
       * C) Virtual rendering:
       *    - Keep subtasks in details field
       *    - When rendering, check instance date and show appropriate checked state
       *    - Store checked state per-instance similar to complete_instances
       */
      const page = app.page;

      // This test would verify the feature once implemented:
      // 1. Open a recurring task for today
      // 2. Check a subtask
      // 3. Navigate to tomorrow's instance
      // 4. Verify the subtask is UNCHECKED for tomorrow

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      console.log('Expected behavior after feature implementation:');
      console.log('1. Each recurring instance has independent subtask state');
      console.log('2. Subtasks reset to unchecked for each new instance');
      console.log('3. Checking a subtask only affects the current instance');
      console.log('4. UI clearly shows which instance you are viewing/editing');

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #929 - data model for per-instance subtask tracking',
    async () => {
      /**
       * This test documents the proposed data model extension for tracking
       * per-instance subtask completion.
       *
       * Current TaskInfo fields for recurring:
       * - recurrence: string (RRULE)
       * - recurrence_anchor: 'scheduled' | 'completion'
       * - complete_instances: string[] (YYYY-MM-DD dates)
       * - skipped_instances: string[] (YYYY-MM-DD dates)
       *
       * Proposed addition:
       * - instance_subtask_completion: Record<string, string[]>
       *   Maps instance date to array of completed subtask identifiers
       *
       * Example:
       * {
       *   "2026-01-07": ["checkbox-1", "checkbox-3"],
       *   "2026-01-08": ["checkbox-1"]
       * }
       *
       * Subtask identifiers could be:
       * - Line numbers (fragile if details change)
       * - Hash of subtask text content
       * - UUID added to each subtask checkbox
       */
      const page = app.page;

      console.log('Proposed data model extension:');
      console.log('');
      console.log('New field: instance_subtask_completion');
      console.log('Type: Record<string, string[]>');
      console.log('');
      console.log('Example YAML frontmatter:');
      console.log('---');
      console.log('title: Daily Review');
      console.log('recurrence: "RRULE:FREQ=DAILY"');
      console.log('complete_instances:');
      console.log('  - 2026-01-06');
      console.log('instance_subtask_completion:');
      console.log('  "2026-01-06":');
      console.log('    - "check-email"');
      console.log('    - "review-calendar"');
      console.log('  "2026-01-07":');
      console.log('    - "check-email"');
      console.log('---');
      console.log('');
      console.log('Details with subtasks:');
      console.log('- [ ] Check email <!-- id:check-email -->');
      console.log('- [ ] Review calendar <!-- id:review-calendar -->');
      console.log('- [ ] Plan day <!-- id:plan-day -->');

      // Verify we can read the task data structure
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskListView = page.locator('.tasknotes-task-list');
      await expect(taskListView).toBeVisible({ timeout: 10000 });

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #929 - UI considerations for per-instance subtasks',
    async () => {
      /**
       * This test documents UI considerations for the feature.
       *
       * When viewing a recurring task, the user needs to know:
       * 1. Which instance they are viewing/editing
       * 2. That subtask changes only affect the current instance
       * 3. How to view subtask state for other instances
       *
       * UI elements to consider:
       * - Instance date indicator in task header
       * - Visual distinction between instance-specific and shared content
       * - Option to view/copy subtask state from another instance
       * - Clear reset mechanism for subtasks when instance changes
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      // Find a recurring task
      const recurringTask = page
        .locator('.tasknotes-task-card, .task-card')
        .filter({ has: page.locator('[data-property="recurrence"]') })
        .first();

      if (!(await recurringTask.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('No recurring tasks found');
        return;
      }

      // Check for instance date indicator in task card
      const instanceIndicator = recurringTask.locator(
        '.instance-date, ' +
          '.recurrence-instance, ' +
          '[data-instance-date]'
      );

      const hasInstanceIndicator = await instanceIndicator.isVisible().catch(() => false);
      console.log(`Has instance date indicator: ${hasInstanceIndicator}`);

      // UI improvements needed:
      // 1. Show "Instance: 2026-01-07" or similar
      // 2. Subtask section header: "Subtasks for this instance"
      // 3. Visual indicator that subtasks are instance-specific

      await page.keyboard.press('Escape');
    }
  );
});
