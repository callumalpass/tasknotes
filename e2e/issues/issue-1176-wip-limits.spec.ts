/**
 * Issue #1176: [FR] WIP Limits
 *
 * Feature request for Work In Progress (WIP) limits on Kanban board columns.
 *
 * Requested behavior:
 * 1. Display WIP limit alongside task count: e.g., "1 task shows as (1/5)"
 * 2. When exceeded (e.g., 6/5), highlight in red
 *
 * Implementation notes:
 * - WIP limits would be configured per column in kanban view settings
 * - Column header rendering is in KanbanView.ts:createColumn() (lines 842-845)
 * - Current format: ` (${tasks.length})` would become ` (${tasks.length}/${limit})`
 * - Swimlane headers also need updating in renderSwimLaneTable() (lines 697-723)
 * - CSS class like `kanban-view__column-count--exceeded` for red highlight
 *
 * Affected areas:
 * - src/bases/KanbanView.ts (column header rendering, view options)
 * - styles/kanban-view.css (exceeded state styling)
 * - Potentially: settings UI for configuring WIP limits per column
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1176
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1176: WIP (Work In Progress) Limits', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1176 - column count should display WIP limit format', async () => {
    /**
     * This test verifies that kanban column headers display task count
     * in the WIP limit format (current/limit) when a limit is configured.
     *
     * Expected behavior after implementation:
     * - Without WIP limit: "(3)" (current behavior)
     * - With WIP limit: "(3/5)" (shows current count / limit)
     *
     * Currently: Only shows task count without limit.
     */
    const page = app.page;

    // Open a kanban board view
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    // Locate the kanban board
    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Find column headers with count display
    const columnHeaders = page.locator('.kanban-view__column-header');
    const columnCount = page.locator('.kanban-view__column-count');

    // Verify columns exist
    const headerCount = await columnHeaders.count();
    expect(headerCount).toBeGreaterThan(0);

    // Check the format of the count display
    // Currently shows "(N)" - should show "(N/M)" when WIP limit is set
    const firstCount = columnCount.first();
    if (await firstCount.isVisible({ timeout: 2000 }).catch(() => false)) {
      const countText = await firstCount.textContent();
      console.log(`Current column count format: ${countText}`);

      // This test documents the expected format change
      // After implementation, when WIP limit is configured:
      // expect(countText).toMatch(/\(\d+\/\d+\)/); // e.g., "(3/5)"
    }

    // Currently: No way to configure WIP limits
    // TODO: Add test for WIP limit configuration UI
  });

  test.fixme('reproduces issue #1176 - exceeded WIP limit should highlight in red', async () => {
    /**
     * This test verifies that when a column exceeds its WIP limit,
     * the count is visually highlighted (e.g., in red).
     *
     * Expected behavior after implementation:
     * - Column with 3 tasks and limit 5: "(3/5)" in normal color
     * - Column with 6 tasks and limit 5: "(6/5)" in red/warning color
     *
     * CSS class should be added: .kanban-view__column-count--exceeded
     */
    const page = app.page;

    // Open a kanban board view
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    // Locate the kanban board
    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Find column count elements
    const columnCount = page.locator('.kanban-view__column-count');

    if (await columnCount.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if exceeded class exists (it won't currently)
      const exceededCount = page.locator('.kanban-view__column-count--exceeded');
      const hasExceeded = await exceededCount.isVisible({ timeout: 1000 }).catch(() => false);

      console.log(`Exceeded WIP limit indicator present: ${hasExceeded}`);

      // After implementation, test should verify:
      // 1. The --exceeded class is applied when count > limit
      // 2. The element has red/warning color styling
      // if (hasExceeded) {
      //   const color = await exceededCount.evaluate(el => getComputedStyle(el).color);
      //   // Expect red-ish color (var(--tn-color-error))
      // }
    }

    // Currently: No exceeded state exists because no WIP limits exist
  });

  test.fixme('reproduces issue #1176 - WIP limits should work in swimlane view', async () => {
    /**
     * This test verifies that WIP limits also work in swimlane mode,
     * where column headers are rendered differently.
     *
     * In swimlane mode, headers are rendered in renderSwimLaneTable()
     * rather than createColumn(). Both paths need WIP limit support.
     */
    const page = app.page;

    // Open a kanban board view
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Try to enable swimlane view if not already enabled
    // This typically requires opening the view menu and selecting a swimlane grouping
    const viewMenu = page.locator('.kanban-view__actions-right button').first();
    if (await viewMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Look for swimlane toggle or dropdown
      // Implementation varies - may need to open a menu
      console.log('Found view actions - swimlane configuration would go here');
    }

    // Check for swimlane-specific headers
    const swimlaneHeaders = page.locator('.kanban-view__column-header-cell');
    const swimlaneBoard = page.locator('.kanban-view__board--swimlanes');

    const isSwimLaneMode = await swimlaneBoard.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Swimlane mode active: ${isSwimLaneMode}`);

    // After implementation, if in swimlane mode:
    // - Column header cells should show WIP limit format
    // - Exceeded limits should be highlighted
    // - Both column headers AND swimlane row counts may need WIP limits
  });

  test.fixme('reproduces issue #1176 - should be able to configure WIP limits per column', async () => {
    /**
     * This test verifies that users can configure WIP limits for each column.
     *
     * Expected UX options:
     * 1. Right-click column header -> "Set WIP limit..."
     * 2. View settings/options panel with WIP limit configuration
     * 3. Inline editing by clicking the count display
     *
     * Configuration should be persisted per-view using BasesViewConfig.
     */
    const page = app.page;

    // Open a kanban board view
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Try right-clicking a column header to see context menu
    const columnHeader = page.locator('.kanban-view__column-header').first();
    if (await columnHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await columnHeader.click({ button: 'right' });
      await page.waitForTimeout(500);

      // Look for WIP limit option in context menu
      const contextMenu = page.locator('.menu');
      if (await contextMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
        const wipOption = contextMenu.locator('text=/wip|limit/i');
        const hasWipOption = await wipOption.isVisible({ timeout: 500 }).catch(() => false);
        console.log(`WIP limit option in context menu: ${hasWipOption}`);

        // Close menu
        await page.keyboard.press('Escape');
      }
    }

    // Currently: No UI to configure WIP limits exists
    // After implementation: Should have accessible way to set limits
  });

  test.fixme('reproduces issue #1176 - WIP limit configuration should persist', async () => {
    /**
     * This test verifies that WIP limit settings are persisted across
     * view refreshes and Obsidian restarts.
     *
     * Storage location: BasesViewConfig (same as columnOrder, swimLane, etc.)
     * Format: JSON string like '{"todo": 3, "in-progress": 5, "done": null}'
     */
    const page = app.page;

    // Open a kanban board view
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // After implementation, this test would:
    // 1. Set a WIP limit on a column
    // 2. Reload/refresh the view
    // 3. Verify the WIP limit is still applied

    console.log('WIP limit persistence test - requires implementation first');

    // The configuration should be stored in view config similar to:
    // this.config.set("wipLimits", JSON.stringify({ "todo": 3, "in-progress": 5 }))
  });
});
