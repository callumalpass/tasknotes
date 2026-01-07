/**
 * Issue #879: [FR] Greater control over Cards (Status) and logic in TaskNotes Kanban base
 *
 * Feature Request Description:
 * The user requests greater control over custom status types in Kanban views, specifically:
 *
 * 1. Ability to create custom status cards beyond the defaults (done, open, in progress, none)
 * 2. Per-card filtering logic - e.g., create an "Overdue" card with its own filter conditions
 * 3. A `-card: [status]` syntax or similar to define custom cards with custom logic
 * 4. Ability to split existing status columns into more specific views
 *    (e.g., "Open (for today)" and "Overdue" with different date-based filters)
 *
 * Example use case from the issue:
 * User wants to see tasks that are:
 * - Due today OR scheduled today (in an "Open" column)
 * - Overdue (due/scheduled before today but not completed) in a separate "Overdue" column
 * - Completed tasks in a "Done" column (where completedDate.isEmpty() filter applies only to this card)
 *
 * Current behavior:
 * - Status cards are based on the `status` property values from settings
 * - Filters apply globally to the entire Kanban view via the `filters` block
 * - Cannot apply different filters to different columns/cards
 * - completedDate.isEmpty() filter hides Done tasks entirely since it applies to all cards
 *
 * Implementation context:
 * - Main Kanban implementation: src/bases/KanbanView.ts
 * - Status management: src/services/StatusManager.ts
 * - Status defaults: src/settings/defaults.ts (statuses array)
 * - View registration: src/bases/registration.ts
 * - Grouping logic: groupTasks() at KanbanView.ts:363-427
 * - Column augmentation: augmentWithEmptyStatusColumns() at KanbanView.ts:497-529
 *
 * Potential implementation approaches:
 * 1. Custom column configuration in .base file with per-column filters
 * 2. Virtual status cards that derive from filter expressions
 * 3. Post-query grouping based on computed properties (e.g., isOverdue formula)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/879
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #879: Custom Kanban status cards with per-card filtering', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Custom status card definitions', () => {
    test.fixme(
      'reproduces issue #879 - should support defining custom status cards beyond defaults',
      async () => {
        /**
         * This test verifies that users can define custom status cards
         * that are not limited to the predefined status values.
         *
         * Expected behavior:
         * - Users can define custom cards in .base file view configuration
         * - Custom cards appear as columns in the Kanban view
         * - Custom cards can have user-defined labels and colors
         *
         * Example .base configuration (proposed):
         * ```yaml
         * views:
         *   - type: tasknotesKanban
         *     name: Today's View
         *     customCards:
         *       - id: overdue
         *         label: "Overdue"
         *         color: "#ff4444"
         *       - id: today
         *         label: "Today"
         *         color: "#0066cc"
         * ```
         *
         * Currently: Only status values from settings are available as columns
         */
        const page = app.page;

        // Open a kanban board view
        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Get all column headers
        const columnHeaders = page.locator('.kanban-view__column-title');
        const headerTexts: string[] = [];
        const count = await columnHeaders.count();

        for (let i = 0; i < count; i++) {
          const text = await columnHeaders.nth(i).textContent();
          if (text) headerTexts.push(text.trim());
        }
        console.log('Current column headers:', headerTexts);

        // Check for custom cards (feature not yet implemented)
        // After implementation, custom cards like "Overdue" should appear
        const hasOverdueColumn = headerTexts.some((h) =>
          h.toLowerCase().includes('overdue')
        );
        console.log('Has Overdue column:', hasOverdueColumn);

        // Currently only default statuses (none, open, in-progress, done) are available
        // After implementation: expect(hasOverdueColumn).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #879 - should allow removing default status cards',
      async () => {
        /**
         * The user mentions removing "none" as it's not useful for them.
         * This test verifies that default status cards can be hidden or removed
         * from a specific Kanban view.
         *
         * Expected behavior:
         * - Configuration option to hide specific status columns
         * - Empty columns can be hidden without affecting task data
         * - hideEmptyColumns option already exists but this is about explicit exclusion
         *
         * Example .base configuration (proposed):
         * ```yaml
         * views:
         *   - type: tasknotesKanban
         *     name: My Board
         *     excludeStatuses:
         *       - none
         * ```
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Get all column headers
        const columnHeaders = page.locator('.kanban-view__column-title');
        const headerTexts: string[] = [];
        const count = await columnHeaders.count();

        for (let i = 0; i < count; i++) {
          const text = await columnHeaders.nth(i).textContent();
          if (text) headerTexts.push(text.trim().toLowerCase());
        }

        console.log('Column headers:', headerTexts);

        // Check if "none" status column can be explicitly excluded
        // (not just hidden when empty via hideEmptyColumns)
        const hasNoneColumn = headerTexts.some((h) => h === 'none');
        console.log('Has None column:', hasNoneColumn);

        // Currently: None column appears if defined in settings
        // After implementation: Users can explicitly exclude statuses per view
      }
    );
  });

  test.describe('Per-card filtering logic', () => {
    test.fixme(
      'reproduces issue #879 - should support per-card filter expressions',
      async () => {
        /**
         * This test verifies the core feature request: per-card filtering.
         * Each card/column in the Kanban should be able to have its own
         * filter expression that determines which tasks appear in it.
         *
         * Expected behavior:
         * - Cards can define their own filter conditions
         * - Filters are evaluated per-task to determine column placement
         * - A task can only appear in one column (first matching or priority-based)
         *
         * Example .base configuration (proposed):
         * ```yaml
         * views:
         *   - type: tasknotesKanban
         *     name: Today
         *     cards:
         *       - id: overdue
         *         label: "Overdue"
         *         filters:
         *           and:
         *             - or:
         *                 - due < today()
         *                 - scheduled < today()
         *             - completedDate.isEmpty()
         *       - id: today
         *         label: "Today"
         *         filters:
         *           and:
         *             - or:
         *                 - due == today()
         *                 - scheduled == today()
         *             - completedDate.isEmpty()
         *       - id: done
         *         label: "Done"
         *         filters:
         *           - completedDate.isNotEmpty()
         * ```
         *
         * Currently: All cards share the same global filter from the view
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // In current implementation, global filters apply to all columns
        // For example, using completedDate.isEmpty() hides ALL completed tasks
        // even from the "Done" column

        // Check if per-card filtering is available in view options
        // Open view settings if available
        const viewSettings = page.locator(
          '.kanban-view__settings, .bases-view-settings, [data-view-settings]'
        );

        const hasViewSettings = await viewSettings.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('View settings available:', hasViewSettings);

        if (hasViewSettings) {
          await viewSettings.click();
          await page.waitForTimeout(500);

          // Look for per-card filter configuration
          const cardFilterConfig = page.locator(
            '[data-config="card-filters"], .card-filter-editor'
          );
          const hasCardFilters = await cardFilterConfig.isVisible({ timeout: 1000 }).catch(() => false);
          console.log('Per-card filter config available:', hasCardFilters);

          await page.keyboard.press('Escape');
        }

        // Feature not yet implemented - this documents the expected behavior
      }
    );

    test.fixme(
      'reproduces issue #879 - overdue tasks should appear in Overdue card not Open',
      async () => {
        /**
         * This test specifically addresses the main use case from the issue:
         * Overdue tasks (past due date, not completed) should appear in a
         * separate "Overdue" column rather than the generic "Open" column.
         *
         * Expected behavior:
         * - Tasks with due date < today and no completedDate -> Overdue column
         * - Tasks with due date == today and no completedDate -> Today/Open column
         * - Tasks with completedDate -> Done column
         *
         * Currently: All incomplete tasks go to their status column regardless of due date
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Look for overdue indicator on task cards
        const overdueCards = page.locator(
          '.task-card--overdue, .task-card[data-overdue="true"], .task-card .overdue-indicator'
        );
        const overdueCount = await overdueCards.count();
        console.log('Cards with overdue indicator:', overdueCount);

        // Check which columns contain overdue tasks
        const columns = page.locator('.kanban-view__column');
        const columnCount = await columns.count();

        for (let i = 0; i < columnCount; i++) {
          const column = columns.nth(i);
          const columnTitle = await column.locator('.kanban-view__column-title').textContent();
          const overdueInColumn = await column.locator('.task-card--overdue, .task-card[data-overdue="true"]').count();

          if (overdueInColumn > 0) {
            console.log(`Column "${columnTitle}" has ${overdueInColumn} overdue tasks`);
          }
        }

        // After implementation:
        // - Overdue tasks should be in a dedicated Overdue column
        // - Or at minimum, be filterable to a custom card with date-based logic
      }
    );

    test.fixme(
      'reproduces issue #879 - completedDate.isEmpty() filter should not hide Done column tasks',
      async () => {
        /**
         * This test addresses a specific pain point from the issue:
         * Using `completedDate.isEmpty()` as a global filter hides completed
         * tasks from the Done column, which defeats the purpose of having
         * a Done column.
         *
         * Expected behavior:
         * - Per-card filters allow different criteria per column
         * - The Done column can have `completedDate.isNotEmpty()` filter
         * - Other columns can have `completedDate.isEmpty()` filter
         * - Both work simultaneously without conflict
         *
         * Currently: Global filter applies to all columns equally
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Find the Done column
        const doneColumn = page.locator(
          '.kanban-view__column[data-column="done"], ' +
          '.kanban-view__column:has(.kanban-view__column-title:text-is("Done"))'
        );

        if (await doneColumn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const doneTaskCount = await doneColumn.locator('.task-card').count();
          console.log('Tasks in Done column:', doneTaskCount);

          // With a global completedDate.isEmpty() filter, this would be 0
          // With per-card filtering, Done column should show completed tasks
          // even when other columns filter to only incomplete tasks
        } else {
          console.log('Done column not visible');
        }

        // After implementation:
        // - Done column should contain completed tasks
        // - Other columns should contain only incomplete tasks
        // - Both states achieved via per-card filtering
      }
    );
  });

  test.describe('Card syntax and configuration', () => {
    test.fixme(
      'reproduces issue #879 - should support -card: [status] syntax in .base files',
      async () => {
        /**
         * This test verifies the proposed `-card: [status]` syntax mentioned
         * in the feature request for defining custom cards.
         *
         * Note: The exact syntax may differ in implementation. This test
         * documents the user's proposed syntax as a starting point.
         *
         * Example .base configuration (proposed):
         * ```yaml
         * views:
         *   - type: tasknotesKanban
         *     name: Today
         *     -card: overdue
         *       label: "Overdue"
         *       filters:
         *         and:
         *           - due < today()
         *           - completedDate.isEmpty()
         *     -card: open
         *       label: "Open (Today)"
         *       filters:
         *         and:
         *           - due == today()
         *           - completedDate.isEmpty()
         * ```
         *
         * Alternative syntax options:
         * - `cards:` array with objects containing `id`, `label`, `filters`
         * - `columns:` array for more explicit Kanban terminology
         * - `customStatuses:` for extending status definitions
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // This test documents the expected syntax capability
        // The actual implementation would need to parse custom card definitions
        // from the .base file YAML configuration

        console.log('Testing custom card syntax support');
        console.log('Feature not yet implemented');

        // After implementation, create a .base file with custom cards
        // and verify they render correctly in the Kanban view
      }
    );

    test.fixme(
      'reproduces issue #879 - custom cards should be configurable in plugin settings',
      async () => {
        /**
         * The user mentions that custom card configuration "could be integrated
         * at the level of the UI in the TaskNotes plugin settings."
         *
         * This test verifies that custom card templates can be defined in
         * settings for reuse across multiple Kanban views.
         *
         * Expected behavior:
         * - Settings page has a section for custom card definitions
         * - Users can define card templates with preset filters
         * - Templates can be selected when creating new Kanban views
         * - Templates can include: label, color, icon, filter expression
         */
        const page = app.page;

        // Open TaskNotes settings
        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(1000);

        const settingsModal = page.locator('.modal, [data-type="tasknotes-settings"]');
        await settingsModal.waitFor({ timeout: 5000 });

        // Look for custom card/column configuration section
        const customCardsSection = page.locator(
          '[data-section="custom-cards"], ' +
          '.setting-item:has-text("Custom Cards"), ' +
          '.setting-item:has-text("Column Templates")'
        );

        const hasCustomCardsSection = await customCardsSection.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Custom cards settings section available:', hasCustomCardsSection);

        // Close settings
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // After implementation:
        // - Settings should have custom card definition section
        // - Users can add/edit/remove custom card templates
      }
    );
  });

  test.describe('Formula-based card grouping', () => {
    test.fixme(
      'reproduces issue #879 - should support formula-based card placement',
      async () => {
        /**
         * An alternative implementation approach: use Bases formulas to
         * compute which card a task belongs to, then group by that computed value.
         *
         * This leverages existing Bases formula functionality.
         *
         * Example .base configuration:
         * ```yaml
         * formulas:
         *   cardGroup: |
         *     if(completedDate.isNotEmpty(), "done",
         *       if(due < today() || scheduled < today(), "overdue",
         *         if(due == today() || scheduled == today(), "today", "later")))
         *
         * views:
         *   - type: tasknotesKanban
         *     name: Smart Board
         *     groupBy:
         *       property: cardGroup
         *       direction: ASC
         * ```
         *
         * This approach:
         * - Uses existing groupBy functionality
         * - Computes card placement dynamically via formula
         * - Doesn't require new syntax for per-card filters
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Check if groupBy supports formula-based properties
        // This would require Bases to expose computed properties for grouping

        const columnHeaders = page.locator('.kanban-view__column-title');
        const count = await columnHeaders.count();
        const headerTexts: string[] = [];

        for (let i = 0; i < count; i++) {
          const text = await columnHeaders.nth(i).textContent();
          if (text) headerTexts.push(text.trim());
        }

        console.log('Current columns:', headerTexts);

        // If formula-based grouping works, columns would be based on
        // the computed cardGroup formula values
        const hasFormulaBasedColumns = headerTexts.some((h) =>
          ['overdue', 'today', 'later'].includes(h.toLowerCase())
        );
        console.log('Has formula-based columns:', hasFormulaBasedColumns);

        // After implementation:
        // - Formulas can define virtual properties for grouping
        // - groupBy can reference these computed properties
      }
    );
  });

  test.describe('Date-based filtering scenarios', () => {
    test.fixme(
      'reproduces issue #879 - tasks due within last week should be shown as overdue',
      async () => {
        /**
         * The user's workaround uses `due > (today() - "1 week")` to capture
         * tasks that are overdue by up to a week. This test documents that
         * use case and verifies it can be achieved with custom cards.
         *
         * Expected behavior:
         * - Overdue card shows tasks where:
         *   - due > (today() - "1 week") AND due <= today()
         *   - OR scheduled > (today() - "1 week") AND scheduled <= today()
         *   - AND completedDate.isEmpty()
         * - Tasks overdue by more than a week could be in a separate "Very Overdue" card
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Count tasks that would match the overdue criteria
        const allCards = page.locator('.task-card');
        const cardCount = await allCards.count();
        console.log('Total task cards:', cardCount);

        // Check for date-based indicators on cards
        const overdueIndicators = page.locator(
          '.task-card__due--overdue, ' +
          '.task-card [data-due-state="overdue"], ' +
          '.task-card .due-date--overdue'
        );
        const overdueCount = await overdueIndicators.count();
        console.log('Cards with overdue due dates:', overdueCount);

        // After implementation:
        // - These overdue tasks should be in a dedicated column
        // - The 1-week cutoff should be configurable
      }
    );

    test.fixme(
      'reproduces issue #879 - should support today() function in card filters',
      async () => {
        /**
         * Card filters need to support date functions like today() for
         * dynamic date-based grouping.
         *
         * Expected behavior:
         * - today() resolves to current date
         * - Comparison operators work: ==, <, >, <=, >=
         * - Date arithmetic works: today() - "1 week"
         * - These expressions work within per-card filter blocks
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // The Bases plugin already supports today() in global filters
        // Per-card filters would need the same support

        console.log('Testing today() function support in card filters');
        console.log('Global filters already support today()');
        console.log('Per-card filters would need equivalent support');

        // After implementation:
        // - Per-card filter expressions support all Bases date functions
        // - today(), yesterday(), tomorrow() work
        // - Date arithmetic expressions work
      }
    );
  });

  test.describe('Integration with existing Bases syntax', () => {
    test.fixme(
      'reproduces issue #879 - custom cards should coexist with global filters',
      async () => {
        /**
         * The user notes that TaskNotes Kanban respects existing Bases syntax
         * like global filters. Custom per-card filters should work alongside
         * global filters, not replace them.
         *
         * Expected behavior:
         * - Global filters apply to all tasks (e.g., file.folder constraint)
         * - Per-card filters further refine which card a task appears in
         * - Both filter levels are AND'd together logically
         *
         * Example .base configuration:
         * ```yaml
         * filters:
         *   and:
         *     - file.folder == "TaskNotes/Tasks"
         *
         * views:
         *   - type: tasknotesKanban
         *     name: Board
         *     cards:
         *       - id: overdue
         *         filters:
         *           - due < today()
         * ```
         *
         * Result: Shows only tasks from TaskNotes/Tasks folder that are overdue
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Verify global filters still work
        const taskCards = page.locator('.task-card');
        const cardCount = await taskCards.count();
        console.log('Tasks displayed (after global filter):', cardCount);

        // After implementation:
        // - Global filter (file.folder) limits total task set
        // - Per-card filters determine column placement within that set
      }
    );

    test.fixme(
      'reproduces issue #879 - custom cards should work with swimlanes',
      async () => {
        /**
         * Custom cards should work in combination with swimlane grouping.
         *
         * Expected behavior:
         * - Custom cards define columns (horizontal axis)
         * - Swimlanes define rows (vertical axis)
         * - Tasks appear at intersection based on both groupings
         *
         * Example: Columns are "Overdue", "Today", "Done"
         *          Swimlanes are by project
         *          Task appears in correct cell based on both criteria
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open task board');
        await page.waitForTimeout(2000);

        const kanbanBoard = page.locator('.kanban-view__board');
        await kanbanBoard.waitFor({ timeout: 10000 });

        // Check if swimlane mode is active
        const swimlaneBoard = page.locator('.kanban-view__board--swimlanes');
        const isSwimLaneMode = await swimlaneBoard.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Swimlane mode active:', isSwimLaneMode);

        if (isSwimLaneMode) {
          const swimlaneCells = page.locator('.kanban-view__swimlane-cell');
          const cellCount = await swimlaneCells.count();
          console.log('Swimlane cells:', cellCount);

          // After implementation:
          // - Custom card columns work with swimlane rows
          // - Each cell correctly filters by both dimensions
        }
      }
    );
  });
});
