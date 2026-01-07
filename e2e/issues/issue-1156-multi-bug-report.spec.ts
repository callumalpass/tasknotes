/**
 * Issue #1156: [Bug]: There are many, sorry for putting them in one issue
 *
 * This is a comprehensive multi-bug report from a user after the v4.x update.
 * The report contains 13 distinct issues:
 *
 * 1. Priority sorting - Now alphabetical, requires numeric prefix for ordering
 * 2. Tag filter mismatch - "tags is exactly task" doesn't match YAML array format
 * 3. Missing Overdue in Agenda - No longer the default view
 * 4. Agenda showing completed tasks - Need manual filter for completedDate
 * 5. Task tag deleted on save - When "Identify tasks by" = "Property > tags > task"
 * 6. Title: null displays - Even when title matches filename
 * 7. Kanban empty by default - No default grouping by status
 * 8. Status shows value not label - Kanban headers show raw values
 * 9. Agenda header text wrapping - Takes too much vertical space
 * 10. Notes vs tasks inconsistency - Some tasks render as notes
 * 11. Duplicate subtask widget - Widget shows 2-3 times per note
 * 12. Task card above filename - In reading mode, card appears above title
 * 13. Intermittent task card display - Card doesn't always show in task notes
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1156
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1156: Multi-bug report after v4.x update', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Bug 2: Tag filter "exactly" vs array format', () => {
    test.fixme(
      'reproduces issue #1156 - "tags is exactly task" should match YAML array format',
      async () => {
        /**
         * When frontmatter has tags in YAML array format:
         * ```yaml
         * tags:
         *   - task
         * ```
         *
         * The filter "tags is exactly task" should still match, but currently
         * it doesn't. Users report needing to change to "tags contain task".
         *
         * Expected behavior:
         * - "is exactly" should work for single-element arrays
         * - The filter should normalize array vs string representations
         *
         * Root cause analysis:
         * - Filter comparison may use strict equality on arrays
         * - ["task"] !== "task" in JavaScript
         */
        const page = app.page;

        // Open a task list view with default filter
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListView = page.locator('.task-list-view, .bases-view');
        await expect(taskListView).toBeVisible({ timeout: 10000 });

        // Look for tasks that have tags: [task] in array format
        // These should be visible with "tags is exactly task" filter
        const taskItems = page.locator('.task-card, .bases-row');
        const taskCount = await taskItems.count();

        console.log(`Tasks visible with current filter: ${taskCount}`);

        // If using "is exactly" filter, tasks with array format should still appear
        // Document the current state for debugging
        if (taskCount === 0) {
          console.log(
            'No tasks visible - may be due to "is exactly" not matching array format'
          );
        }
      }
    );
  });

  test.describe('Bug 4: Agenda showing completed tasks', () => {
    test.fixme(
      'reproduces issue #1156 - agenda should not show completed tasks by default',
      async () => {
        /**
         * The agenda view is showing completed tasks by default.
         * Users expect completed tasks to be filtered out automatically
         * or have a clear toggle.
         *
         * Expected behavior:
         * - Agenda should hide completed tasks by default
         * - Or provide an obvious toggle for completed task visibility
         *
         * User workaround:
         * - Added manual filter "completedDate is empty"
         */
        const page = app.page;

        // Open agenda view
        await runCommand(page, 'TaskNotes: Open agenda view');
        await page.waitForTimeout(1000);

        const agendaView = page.locator('.agenda-view, .bases-view');
        await expect(agendaView).toBeVisible({ timeout: 10000 });

        // Look for completed tasks in the agenda
        const completedTasks = page.locator(
          '.task-card--completed, ' +
            '.task-card[data-completed="true"], ' +
            '.bases-row[data-completed="true"]'
        );

        const completedCount = await completedTasks.count();

        console.log(`Completed tasks in agenda: ${completedCount}`);

        // Completed tasks should not appear in agenda by default
        // (unless user has explicitly enabled showing them)
        expect(completedCount).toBe(0);
      }
    );
  });

  test.describe('Bug 5: Task tag deleted on popup save', () => {
    test.fixme(
      'reproduces issue #1156 - task tag should not be deleted when saving from popup',
      async () => {
        /**
         * When "Identify tasks by" is set to "Property > tags > task",
         * editing a task in the popup and hitting save removes the "task"
         * tag from frontmatter entirely.
         *
         * Expected behavior:
         * - The task identification tag should be preserved
         * - Editing other properties should not affect the task tag
         *
         * Root cause analysis:
         * - TaskEditModal may not be preserving the identifying tag
         * - Property serialization may be omitting the tag accidentally
         */
        const page = app.page;

        // First, check if a task note is open and has task card
        // We need to verify the tag before and after editing

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCard = page.locator('.task-card').first();

        if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Click to open the task popup/modal
          await taskCard.click();
          await page.waitForTimeout(500);

          // Look for task edit modal
          const taskModal = page.locator('.modal, .task-edit-modal, .task-creation-modal');

          if (await taskModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Find the save button and click it without making changes
            const saveButton = taskModal.locator(
              'button:has-text("Save"), ' +
                'button:has-text("OK"), ' +
                '.modal-button-container button.mod-cta'
            );

            if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
              await saveButton.click();
              await page.waitForTimeout(500);
            }

            // After saving, the task should still appear in the list
            // (if the tag was deleted, it would disappear)
            const taskStillExists = await taskCard.isVisible({ timeout: 2000 }).catch(() => false);

            if (!taskStillExists) {
              console.log('Task disappeared after save - tag may have been deleted');
            }

            expect(taskStillExists).toBe(true);
          }
        }
      }
    );
  });

  test.describe('Bug 6: Title shows null', () => {
    test.fixme(
      'reproduces issue #1156 - title should show filename when not explicitly set',
      async () => {
        /**
         * Task cards display "Title: null" even when the task has a filename.
         * Editing the task doesn't help if title property wasn't set.
         *
         * Expected behavior:
         * - If no title property, use filename as display title
         * - Never show "null" as a title value
         *
         * User workaround:
         * - Remove title from displayed properties in bases config
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCards = page.locator('.task-card');
        const cardCount = await taskCards.count();

        let nullTitleFound = false;

        for (let i = 0; i < Math.min(cardCount, 20); i++) {
          const card = taskCards.nth(i);
          const cardText = await card.textContent();

          if (cardText && (cardText.includes('null') || cardText.includes('Title: null'))) {
            nullTitleFound = true;
            console.log(`Card ${i} shows null title: ${cardText?.substring(0, 100)}`);
          }
        }

        expect(nullTitleFound).toBe(false);
      }
    );
  });

  test.describe('Bug 7: Kanban empty by default', () => {
    test.fixme(
      'reproduces issue #1156 - kanban should have sensible default grouping',
      async () => {
        /**
         * Opening Kanban view shows an empty board unless user manually
         * sets "group by status".
         *
         * Expected behavior:
         * - Kanban should default to grouping by status
         * - Or provide clear guidance on how to configure grouping
         *
         * User workaround:
         * - Manually configure groupBy: status
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open kanban view');
        await page.waitForTimeout(1000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await expect(kanbanBoard).toBeVisible({ timeout: 10000 });

        // Check if columns are visible
        const columns = page.locator('.kanban-view__column');
        const columnCount = await columns.count();

        console.log(`Kanban columns visible: ${columnCount}`);

        // Should have at least one column with content
        expect(columnCount).toBeGreaterThan(0);

        // Check if any cards are visible
        const cards = page.locator('.kanban-view__board .task-card');
        const cardCount = await cards.count();

        console.log(`Cards in kanban: ${cardCount}`);

        // If there are tasks, they should be visible in the kanban
        // Empty kanban with existing tasks suggests missing groupBy config
      }
    );
  });

  test.describe('Bug 8: Status shows value not label', () => {
    test.fixme(
      'reproduces issue #1156 - kanban column headers should show status labels not values',
      async () => {
        /**
         * Kanban column headers display the raw status value (e.g., "in-progress")
         * instead of the user-defined label (e.g., "In Progress").
         *
         * Expected behavior:
         * - Column headers should use StatusConfig.label
         * - Display labels should be user-friendly
         *
         * Root cause analysis:
         * - KanbanView.ts may be using status.value for column headers
         * - Should look up label from StatusManager
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open kanban view');
        await page.waitForTimeout(1000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await expect(kanbanBoard).toBeVisible({ timeout: 10000 });

        // Find column headers
        const columnHeaders = page.locator(
          '.kanban-view__column-header, ' +
            '.kanban-view__column-title, ' +
            '.kanban-view__column h3'
        );

        const headerCount = await columnHeaders.count();

        for (let i = 0; i < headerCount; i++) {
          const header = columnHeaders.nth(i);
          const headerText = await header.textContent();

          if (headerText) {
            // Check for common value patterns that should be labels
            const looksLikeValue =
              headerText.includes('-') || // kebab-case
              headerText.includes('_') || // snake_case
              headerText === headerText.toLowerCase(); // all lowercase

            const looksLikeLabel =
              headerText.charAt(0) === headerText.charAt(0).toUpperCase() || // Title Case
              headerText.includes(' '); // has spaces

            if (looksLikeValue && !looksLikeLabel) {
              console.log(
                `Column ${i} appears to show value instead of label: "${headerText}"`
              );
            }
          }
        }
      }
    );
  });

  test.describe('Bug 9: Agenda header text wrapping', () => {
    test.fixme(
      'reproduces issue #1156 - agenda date header should not wrap excessively',
      async () => {
        /**
         * The date-range header in agenda view (next to refresh button)
         * wraps text excessively, taking up too much vertical space
         * when the panel is narrow.
         *
         * Expected behavior:
         * - Header should be compact
         * - Use abbreviated formats when space is limited
         * - Or use horizontal scrolling instead of wrapping
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open agenda view');
        await page.waitForTimeout(1000);

        const agendaView = page.locator('.agenda-view, .bases-view');
        await expect(agendaView).toBeVisible({ timeout: 10000 });

        // Find the date header area
        const dateHeader = page.locator(
          '.agenda-view__date-header, ' +
            '.agenda-header, ' +
            '.bases-view-header, ' +
            '.view-header'
        );

        if (await dateHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
          const headerBox = await dateHeader.boundingBox();

          if (headerBox) {
            // Header height should be reasonable (not multiple lines)
            // Typical single-line header is around 30-50px
            const reasonableMaxHeight = 80;

            console.log(`Agenda header height: ${headerBox.height}px`);

            if (headerBox.height > reasonableMaxHeight) {
              console.log(
                `Header is wrapping excessively: ${headerBox.height}px > ${reasonableMaxHeight}px`
              );
            }

            expect(headerBox.height).toBeLessThanOrEqual(reasonableMaxHeight);
          }
        }
      }
    );
  });

  test.describe('Bug 10: Tasks showing as notes', () => {
    test.fixme(
      'reproduces issue #1156 - tasks should render as tasks not as notes',
      async () => {
        /**
         * Many tasks render as "notes" in the agenda - they can't be checked off
         * and don't show colored dots for status/priority.
         *
         * Expected behavior:
         * - All items with task tag should render as tasks
         * - Should have checkbox and status/priority indicators
         *
         * Root cause analysis:
         * - Task identification may fail for certain frontmatter formats
         * - The "identify tasks by" setting may not match all variations
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open agenda view');
        await page.waitForTimeout(1000);

        const agendaView = page.locator('.agenda-view, .bases-view');
        await expect(agendaView).toBeVisible({ timeout: 10000 });

        // Find items in the view
        const allItems = page.locator('.task-card, .bases-row, .agenda-item');
        const itemCount = await allItems.count();

        let noteStyleItems = 0;
        let taskStyleItems = 0;

        for (let i = 0; i < Math.min(itemCount, 20); i++) {
          const item = allItems.nth(i);

          // Check for task indicators
          const hasCheckbox = await item.locator('input[type="checkbox"]').isVisible().catch(() => false);
          const hasStatusDot = await item.locator('.status-dot, .task-card__status-dot').isVisible().catch(() => false);
          const hasPriorityDot = await item.locator('.priority-dot, .task-card__priority').isVisible().catch(() => false);

          if (hasCheckbox || hasStatusDot || hasPriorityDot) {
            taskStyleItems++;
          } else {
            noteStyleItems++;
          }
        }

        console.log(`Task-style items: ${taskStyleItems}, Note-style items: ${noteStyleItems}`);

        // All items should render as tasks (with task indicators)
        // This documents the issue - some render as notes
        if (noteStyleItems > 0) {
          console.log(`${noteStyleItems} items are rendering as notes instead of tasks`);
        }
      }
    );
  });

  test.describe('Bug 11: Duplicate subtask widget', () => {
    test.fixme(
      'reproduces issue #1156 - subtask widget should only appear once per note',
      async () => {
        /**
         * The subtask widget is appearing multiple times on task notes,
         * even when there are zero subtasks. User reports seeing it
         * 2-3 times on single notes.
         *
         * Expected behavior:
         * - Only one subtask widget per note
         * - Widget should only appear when there are subtasks
         *   OR provide clear "add subtask" functionality
         */
        const page = app.page;

        // Open a task note in reading mode
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCard = page.locator('.task-card').first();

        if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Double-click to open the task note
          await taskCard.dblclick();
          await page.waitForTimeout(1000);

          // Look for subtask widgets in the note
          const subtaskWidgets = page.locator(
            '.subtask-widget, ' +
              '.subtasks-container, ' +
              '[data-widget="subtasks"], ' +
              '.task-subtasks'
          );

          const widgetCount = await subtaskWidgets.count();

          console.log(`Subtask widgets found in note: ${widgetCount}`);

          // Should only be one instance
          expect(widgetCount).toBeLessThanOrEqual(1);
        }
      }
    );
  });

  test.describe('Bug 12: Task card position in reading mode', () => {
    test.fixme(
      'reproduces issue #1156 - task card should appear below note title in reading mode',
      async () => {
        /**
         * In reading mode, the task card appears ABOVE the file name/title,
         * which is unusual positioning in Obsidian. In edit mode (without
         * source), it correctly appears below the frontmatter.
         *
         * Expected behavior:
         * - Task card should be at top of note body (after frontmatter)
         * - Should not appear above the note title
         *
         * Root cause analysis:
         * - Reading mode rendering may insert card in wrong position
         * - Markdown post-processor hook may be attaching to wrong element
         */
        const page = app.page;

        // Open a task note
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCardInList = page.locator('.task-card').first();

        if (await taskCardInList.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Double-click to open the task note
          await taskCardInList.dblclick();
          await page.waitForTimeout(1000);

          // Switch to reading mode if not already
          await page.keyboard.press('Control+e'); // Toggle edit/read mode
          await page.waitForTimeout(500);

          // Find the note title and task card in the note
          const noteTitle = page.locator(
            '.inline-title, ' +
              '.view-header-title, ' +
              '.markdown-preview-view h1:first-child'
          );

          const taskCardInNote = page.locator(
            '.markdown-preview-view .task-card, ' +
              '.markdown-reading-view .task-card, ' +
              '.cm-preview-section .task-card'
          );

          if (
            await noteTitle.isVisible({ timeout: 2000 }).catch(() => false) &&
            await taskCardInNote.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            const titleBox = await noteTitle.boundingBox();
            const cardBox = await taskCardInNote.boundingBox();

            if (titleBox && cardBox) {
              // Task card should be BELOW the title
              const cardIsBelowTitle = cardBox.y > titleBox.y;

              console.log(`Title Y: ${titleBox.y}, Card Y: ${cardBox.y}`);

              if (!cardIsBelowTitle) {
                console.log('Task card is above the note title - incorrect position');
              }

              expect(cardIsBelowTitle).toBe(true);
            }
          }
        }
      }
    );
  });

  test.describe('Bug 13: Intermittent task card display', () => {
    test.fixme(
      'reproduces issue #1156 - task card should consistently appear in task notes',
      async () => {
        /**
         * The "show task card in note" feature doesn't consistently show
         * the card in all task notes. User reports:
         * - Sometimes fixed by moving "tags: task" to top of frontmatter
         * - Sometimes card appears then disappears on next open
         * - No consistent pattern
         *
         * Expected behavior:
         * - Task card should appear in all notes identified as tasks
         * - Tag position in frontmatter should not affect display
         */
        const page = app.page;

        // Open several task notes and check for card presence
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCards = page.locator('.task-card');
        const cardCount = await taskCards.count();

        let cardsShown = 0;
        let cardsMissing = 0;

        // Check up to 5 tasks
        for (let i = 0; i < Math.min(cardCount, 5); i++) {
          const taskCard = taskCards.nth(i);

          if (await taskCard.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Open this task note
            await taskCard.dblclick();
            await page.waitForTimeout(1000);

            // Check if task card is visible in the note
            const cardInNote = page.locator(
              '.workspace-leaf-content .task-card, ' +
                '.view-content .task-card, ' +
                '.markdown-reading-view .task-card, ' +
                '.markdown-source-view .task-card'
            );

            const noteHasCard = await cardInNote.isVisible({ timeout: 2000 }).catch(() => false);

            if (noteHasCard) {
              cardsShown++;
            } else {
              cardsMissing++;
              console.log(`Task ${i} note is missing task card`);
            }

            // Go back to task list
            await page.keyboard.press('Control+Shift+t'); // May vary based on hotkeys
            await page.waitForTimeout(500);
          }
        }

        console.log(`Cards shown: ${cardsShown}, Cards missing: ${cardsMissing}`);

        // All task notes should show the card consistently
        expect(cardsMissing).toBe(0);
      }
    );
  });
});
