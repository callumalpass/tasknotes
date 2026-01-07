/**
 * Issue #918: [FR] Enhancement in Kanban view
 *
 * Feature Request Description:
 * A collection of Kanban view enhancements for improved task management:
 *
 * 1. Enhance sub-tasks display in Kanban view, enabling sub-task check-off
 *    under parent tasks or showing sub-tasks within cards.
 * 2. Tasks can be sorted by expected completion time.
 * 3. Add WIP limit display: e.g., "Task (5)" shows as (0/5).
 * 4. When exceeded (e.g., 6/5), highlight in red.
 * 5. Add a checkbox next to each task.
 * 6. On click, mark task complete and move to "Done" column.
 *
 * Current behavior:
 * - Subtasks can be expanded via chevron but aren't directly checkable in Kanban
 * - No WIP limit display (see also issue #1176)
 * - No sort by expected completion time option
 * - Task completion requires opening task card or context menu
 *
 * Implementation context:
 * - Main Kanban implementation: src/bases/KanbanView.ts
 * - Card rendering: src/ui/TaskCard.ts
 * - Existing subtask chevron handler: handleToggleSubtasks() at KanbanView.ts:2380
 * - Existing completion handler: handleToggleStatus() at KanbanView.ts:2255
 * - Column header rendering: createColumn() at KanbanView.ts:815
 * - Swimlane header rendering: renderSwimLaneTable() at KanbanView.ts:697-723
 *
 * Related issues:
 * - #1176: WIP limits (more detailed WIP limit testing there)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/918
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #918: Kanban view enhancements', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Sub-task display enhancements', () => {
    test.fixme('reproduces issue #918 - subtasks should be visible within kanban cards', async () => {
      /**
       * This test verifies that subtasks can be displayed inline within
       * kanban cards, not just expanded below the parent task.
       *
       * Expected behavior:
       * - Parent task card shows subtask count or list
       * - Subtasks are visible without having to expand
       * - Option to toggle between inline and expanded view
       *
       * Currently: Subtasks only appear when chevron is clicked to expand
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      // Locate the kanban board
      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find task cards that have subtasks
      const taskCards = page.locator('.task-card');
      const cardsCount = await taskCards.count();
      console.log(`Found ${cardsCount} task cards`);

      // Look for subtask indicators in cards
      const subtaskChevron = page.locator('.task-card__subtasks-chevron');
      const subtaskContainer = page.locator('.task-card__subtasks');

      const hasChevrons = await subtaskChevron.first().isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Has subtask chevrons: ${hasChevrons}`);

      // Feature request: Subtasks should be visible inline
      const inlineSubtasks = page.locator('.task-card__subtasks-inline, .task-card__subtask-list');
      const hasInlineSubtasks = await inlineSubtasks.first().isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Has inline subtasks: ${hasInlineSubtasks}`);

      // After implementation:
      // - Cards with subtasks should show them inline
      // - Each subtask should be individually visible
    });

    test.fixme('reproduces issue #918 - subtasks should be checkable within kanban cards', async () => {
      /**
       * This test verifies that subtasks can be checked off directly
       * from within the kanban card without opening the parent task.
       *
       * Expected behavior:
       * - Each subtask in the card has a checkbox
       * - Clicking the checkbox toggles the subtask status
       * - Visual feedback shows subtask completion
       * - Parent task progress updates accordingly
       *
       * Currently: Subtasks require opening the parent task to toggle
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find subtask elements
      const subtaskItems = page.locator('.task-card__subtask-item, .task-card__subtasks .subtask');

      if (await subtaskItems.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look for subtask checkboxes
        const subtaskCheckbox = subtaskItems.first().locator(
          'input[type="checkbox"], .subtask-checkbox, [data-tn-action="toggle-subtask"]'
        );

        const hasCheckbox = await subtaskCheckbox.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Subtask has checkbox: ${hasCheckbox}`);

        if (hasCheckbox) {
          // Get initial state
          const initialState = await subtaskCheckbox.isChecked().catch(() => null);
          console.log(`Initial subtask state: ${initialState}`);

          // Click to toggle
          await subtaskCheckbox.click();
          await page.waitForTimeout(500);

          // Verify state changed
          const newState = await subtaskCheckbox.isChecked().catch(() => null);
          console.log(`New subtask state: ${newState}`);

          expect(newState).not.toBe(initialState);
        } else {
          // Feature not yet implemented
          console.log('Subtask checkbox not found - feature not yet implemented');
        }
      } else {
        console.log('No visible subtask items found');
      }
    });
  });

  test.describe('Sort by completion time', () => {
    test.fixme('reproduces issue #918 - tasks should be sortable by expected completion time', async () => {
      /**
       * This test verifies that tasks in kanban columns can be sorted
       * by their expected completion time (due date).
       *
       * Expected behavior:
       * - Sort option available in view settings or column menu
       * - Tasks ordered by due date ascending (earliest first)
       * - Tasks without due dates appear at end or beginning (configurable)
       *
       * Currently: Tasks are sorted by Bases default (alphabetical or creation order)
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Look for sort options
      // Option 1: In view actions toolbar
      const viewActions = page.locator('.kanban-view__actions, .kanban-view__toolbar');
      if (await viewActions.isVisible({ timeout: 2000 }).catch(() => false)) {
        const sortButton = viewActions.locator('button[data-action="sort"], .sort-button');
        const hasSortButton = await sortButton.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Has sort button in toolbar: ${hasSortButton}`);
      }

      // Option 2: In column header context menu
      const columnHeader = page.locator('.kanban-view__column-header').first();
      if (await columnHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
        await columnHeader.click({ button: 'right' });
        await page.waitForTimeout(500);

        const contextMenu = page.locator('.menu');
        if (await contextMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
          const sortOption = contextMenu.locator('text=/sort|order|completion/i');
          const hasSortOption = await sortOption.isVisible({ timeout: 500 }).catch(() => false);
          console.log(`Has sort option in context menu: ${hasSortOption}`);

          await page.keyboard.press('Escape');
        }
      }

      // After implementation:
      // - Sort by due date option should be available
      // - Tasks should be reordered when sort is applied
      // - Sort preference should persist
    });

    test.fixme('reproduces issue #918 - sort by completion time should work with swimlanes', async () => {
      /**
       * This test verifies that sorting by completion time also works
       * when the kanban board is in swimlane mode.
       *
       * Expected behavior:
       * - Sort applies within each swimlane cell
       * - All cells in a column maintain the same sort order
       * - Sort persists when switching between flat and swimlane views
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Check if swimlane mode is available
      const swimlaneBoard = page.locator('.kanban-view__board--swimlanes');
      const isSwimLaneMode = await swimlaneBoard.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Swimlane mode active: ${isSwimLaneMode}`);

      if (isSwimLaneMode) {
        // Find swimlane cells
        const swimlaneCells = page.locator('.kanban-view__swimlane-cell');
        const cellCount = await swimlaneCells.count();
        console.log(`Found ${cellCount} swimlane cells`);

        // After implementation:
        // - Each cell should have tasks sorted by completion time
        // - Sort should be consistent across the row/column
      }
    });
  });

  test.describe('WIP limit display', () => {
    // Note: More detailed WIP limit tests are in issue-1176-wip-limits.spec.ts
    // These tests cover the specific format requested in issue #918

    test.fixme('reproduces issue #918 - column count should show current/limit format', async () => {
      /**
       * This test verifies that kanban column headers display the task
       * count in the format "(current/limit)" when WIP limits are set.
       *
       * Expected behavior:
       * - Without WIP limit: "(5)" showing just task count
       * - With WIP limit of 5: "(3/5)" showing 3 tasks of 5 allowed
       * - The "(0/5)" format shown in the issue for empty columns
       *
       * Currently: Only shows "(N)" format with task count
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find column count displays
      const columnCount = page.locator('.kanban-view__column-count');
      const firstCount = await columnCount.first().textContent();
      console.log(`Current column count format: ${firstCount}`);

      // Check format - currently just "(N)"
      // After implementation with WIP limit: "(N/M)"
      if (firstCount) {
        const hasWipFormat = /\(\d+\/\d+\)/.test(firstCount);
        console.log(`Has WIP format (N/M): ${hasWipFormat}`);

        // The issue specifically shows "(0/5)" format
        // This test documents that expectation
      }
    });

    test.fixme('reproduces issue #918 - exceeded WIP limit should be highlighted in red', async () => {
      /**
       * This test verifies that when a column exceeds its WIP limit,
       * the count is highlighted in red as specified in the issue.
       *
       * Expected behavior:
       * - When count exceeds limit (e.g., 6/5), the count turns red
       * - CSS class like `kanban-view__column-count--exceeded` is applied
       * - Red color uses theme-appropriate error/warning color
       *
       * Currently: No visual distinction for exceeded limits
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Look for exceeded state class
      const exceededCount = page.locator('.kanban-view__column-count--exceeded');
      const hasExceeded = await exceededCount.isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Has exceeded WIP limit indicator: ${hasExceeded}`);

      if (hasExceeded) {
        // Verify red color styling
        const color = await exceededCount.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return computed.color;
        });
        console.log(`Exceeded count color: ${color}`);

        // Should be a red-ish color (rgb values for red are high)
        // Theme uses var(--tn-color-error) or similar
      }
    });
  });

  test.describe('Quick completion checkbox', () => {
    test.fixme('reproduces issue #918 - task cards should have visible checkbox', async () => {
      /**
       * This test verifies that each task card in the kanban view has
       * a visible checkbox for quick completion.
       *
       * Expected behavior:
       * - Checkbox is visible on each task card
       * - Checkbox reflects current completion status
       * - Checkbox is positioned consistently (left side of card)
       *
       * Currently: Task status is toggled via card click action but
       * there's no dedicated checkbox UI element
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find task cards
      const taskCards = page.locator('.task-card');
      const cardsCount = await taskCards.count();
      console.log(`Found ${cardsCount} task cards`);

      if (cardsCount > 0) {
        const firstCard = taskCards.first();

        // Look for checkbox element
        const checkbox = firstCard.locator(
          'input[type="checkbox"], .task-card__checkbox, [data-tn-action="toggle-status"]'
        );

        const hasCheckbox = await checkbox.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Task card has checkbox: ${hasCheckbox}`);

        // Currently there's a status toggle action but may not be a visible checkbox
        // After implementation: Each card should have a visible checkbox
      }
    });

    test.fixme('reproduces issue #918 - clicking checkbox should complete task', async () => {
      /**
       * This test verifies that clicking the checkbox completes the task.
       *
       * Expected behavior:
       * - Clicking checkbox toggles task completion status
       * - Completed tasks are marked visually (strikethrough, opacity, etc.)
       * - Task moves to "Done" column if configured
       *
       * Currently: handleToggleStatus() exists but requires specific UI trigger
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find an incomplete task card in a non-Done column
      const incompleteCards = page.locator('.task-card:not(.is-complete)');

      if (await incompleteCards.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const card = incompleteCards.first();
        const taskTitle = await card.locator('.task-card__title').textContent();
        console.log(`Testing completion on task: ${taskTitle}`);

        // Find the checkbox
        const checkbox = card.locator(
          'input[type="checkbox"], .task-card__checkbox, [data-tn-action="toggle-status"]'
        );

        if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Click to complete
          await checkbox.click();
          await page.waitForTimeout(1000);

          // Verify task is now complete
          const isComplete = await card.evaluate(el => el.classList.contains('is-complete'));
          console.log(`Task is now complete: ${isComplete}`);

          // After implementation: expect(isComplete).toBe(true);
        } else {
          console.log('Checkbox not visible - feature not yet implemented');
        }
      }
    });

    test.fixme('reproduces issue #918 - completing task should move it to Done column', async () => {
      /**
       * This test verifies that completing a task via checkbox moves
       * it to the "Done" column automatically.
       *
       * Expected behavior:
       * - Task disappears from current column after completion
       * - Task appears in "Done" column
       * - Transition may be animated for visual feedback
       *
       * Currently: Completion changes status but column membership
       * depends on the kanban grouping configuration
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find the Done column (various possible names)
      const doneColumn = page.locator(
        '.kanban-view__column[data-column="done"], ' +
        '.kanban-view__column[data-column="completed"], ' +
        '.kanban-view__column:has(.kanban-view__column-title:text-is("Done"))'
      );

      // Get initial Done column task count
      if (await doneColumn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const initialDoneCount = await doneColumn.locator('.task-card').count();
        console.log(`Initial Done column task count: ${initialDoneCount}`);

        // Find an incomplete task in another column
        const todoColumn = page.locator(
          '.kanban-view__column[data-column="todo"], ' +
          '.kanban-view__column:has(.kanban-view__column-title:text-is("To Do"))'
        );

        if (await todoColumn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const todoCard = todoColumn.locator('.task-card').first();

          if (await todoCard.isVisible({ timeout: 1000 }).catch(() => false)) {
            const taskTitle = await todoCard.locator('.task-card__title').textContent();
            console.log(`Completing task: ${taskTitle}`);

            // Click the completion checkbox
            const checkbox = todoCard.locator(
              'input[type="checkbox"], .task-card__checkbox, [data-tn-action="toggle-status"]'
            );

            if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
              await checkbox.click();
              await page.waitForTimeout(1000);

              // Verify Done column count increased
              const newDoneCount = await doneColumn.locator('.task-card').count();
              console.log(`New Done column task count: ${newDoneCount}`);

              // After implementation: expect(newDoneCount).toBe(initialDoneCount + 1);
            }
          }
        }
      } else {
        console.log('Done column not found - may need specific kanban setup');
      }
    });
  });

  test.describe('Mobile/touch considerations', () => {
    test.fixme('reproduces issue #918 - checkbox should be touch-friendly', async () => {
      /**
       * This test verifies that the completion checkbox meets accessibility
       * standards for touch targets on mobile devices.
       *
       * Expected behavior:
       * - Checkbox touch target is at least 44x44 pixels (WCAG 2.5.5)
       * - Checkbox is easily tappable without accidentally triggering other actions
       * - Visual feedback on touch
       */
      const page = app.page;

      // Open a kanban board view
      await runCommand(page, 'TaskNotes: Open task board');
      await page.waitForTimeout(2000);

      const kanbanBoard = page.locator('.kanban-view__board');
      await kanbanBoard.waitFor({ timeout: 10000 });

      // Find task card checkboxes
      const checkboxes = page.locator(
        '.task-card input[type="checkbox"], .task-card__checkbox'
      );

      if (await checkboxes.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const firstCheckbox = checkboxes.first();
        const boundingBox = await firstCheckbox.boundingBox();

        if (boundingBox) {
          console.log('Checkbox dimensions:', {
            width: boundingBox.width,
            height: boundingBox.height,
          });

          // WCAG 2.5.5 recommends minimum 44x44px touch targets
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      } else {
        console.log('Checkbox not found - feature not yet implemented');
      }
    });
  });
});
