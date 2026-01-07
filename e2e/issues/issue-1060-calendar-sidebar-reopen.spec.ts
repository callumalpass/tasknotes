/**
 * Issue #1060: [Bug] Calendar view no longer opens in Sidebar
 *
 * User reported that after moving the Calendar view to the sidebar, using the
 * hotkey to open the Calendar view reopens it in the main window instead of
 * the sidebar where it was placed.
 *
 * This is a regression in the 4.0 beta. Previously, if the Calendar view was
 * already open in the sidebar, using the hotkey would activate that existing
 * sidebar leaf instead of creating a new view in the main workspace.
 *
 * Root cause:
 * The `openBasesFileForCommand` method in main.ts (lines 1837-1873) uses
 * `this.app.workspace.getLeaf()` without parameters. According to the Obsidian
 * API, `getLeaf()` without parameters defaults to opening in the active main
 * window leaf, ignoring any existing view in the sidebar.
 *
 * Compare this to `activatePomodoroView` which properly checks for existing
 * leaves and preserves sidebar location using `getLeafOfType()` first.
 *
 * Suggested fix:
 * Modify `openBasesFileForCommand` (or create a new method for Bases views) to:
 * 1. First check if the view already exists using `getLeafOfType()`
 * 2. If it exists (including in a sidebar), activate and reveal that leaf
 * 3. Only create a new leaf if no existing view is found
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1060
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1060: Calendar view should reopen in sidebar', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1060 - Calendar view in sidebar should stay in sidebar when reopened via hotkey',
    async () => {
      /**
       * This test reproduces the bug where:
       * 1. User opens Calendar view in main workspace
       * 2. User drags Calendar view to the sidebar
       * 3. User uses hotkey/command to open Calendar view
       * 4. BUG: Calendar view opens in main workspace instead of activating the sidebar view
       *
       * Expected behavior:
       * - The existing Calendar view in the sidebar should be activated/revealed
       * - No new Calendar view should be created in the main workspace
       *
       * Current behavior (bug):
       * - A new Calendar view opens in the main workspace
       * - The sidebar Calendar view is ignored
       */
      const page = app.page;

      // Step 1: Open the Calendar view via command
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Verify Calendar view opened
      const calendarView = page.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
        '.workspace-leaf .fc, ' +
        '.calendar-view'
      );
      await expect(calendarView.first()).toBeVisible({ timeout: 5000 });

      // Step 2: Move the Calendar view to the right sidebar
      // In Obsidian, this can be done via the "Move to right sidebar" command
      // or by dragging. We'll use the command approach.

      // First, ensure the Calendar view is focused/active
      await calendarView.first().click();
      await page.waitForTimeout(300);

      // Use command to move to right sidebar
      await runCommand(page, 'Move current pane to right sidebar');
      await page.waitForTimeout(1000);

      // Verify the Calendar view is now in the right sidebar
      const rightSidebar = page.locator('.mod-right-split');
      const calendarInSidebar = rightSidebar.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
        '.workspace-leaf .fc'
      );

      const isInSidebar = await calendarInSidebar.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isInSidebar) {
        // Alternative: try left sidebar
        const leftSidebar = page.locator('.mod-left-split');
        const calendarInLeftSidebar = leftSidebar.locator(
          '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
          '.workspace-leaf .fc'
        );
        const isInLeftSidebar = await calendarInLeftSidebar.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isInLeftSidebar) {
          console.log('Note: Could not move Calendar to sidebar - move command may not be available');
        }
      }

      // Step 3: Close any Calendar views in the main workspace
      // (to ensure a clean test state where only the sidebar has the Calendar)
      const mainWorkspace = page.locator('.mod-root');
      const calendarInMain = mainWorkspace.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
        '.workspace-leaf .fc'
      );

      if (await calendarInMain.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Close the main workspace calendar view
        // Click the close button on the tab
        const tab = page.locator('.workspace-tab-header[data-type="tasknotesCalendar"]');
        const closeButton = tab.locator('.workspace-tab-header-inner-close-button');
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(500);
        }
      }

      // Step 4: Use the hotkey/command to open Calendar view again
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Step 5: Verify the result
      // BUG: Currently the Calendar opens in the main workspace
      // EXPECTED: The existing sidebar Calendar should be activated

      // Check if there's now a Calendar in the main workspace (this would be the bug)
      const calendarInMainAfter = mainWorkspace.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
        '.workspace-leaf .fc'
      );
      const bugPresent = await calendarInMainAfter.isVisible({ timeout: 2000 }).catch(() => false);

      if (bugPresent) {
        console.log('CONFIRMED: Bug reproduced - Calendar opened in main workspace instead of using sidebar view');
      }

      // The expected behavior is that there should be NO Calendar in the main workspace
      // because the command should have activated the sidebar view instead
      expect(bugPresent).toBe(false);
    }
  );

  test.fixme(
    'reproduces issue #1060 - Bases views should use getLeafOfType pattern like Pomodoro view',
    async () => {
      /**
       * This test documents the architectural difference between how Bases views
       * and the Pomodoro view handle reopening.
       *
       * The Pomodoro view (activatePomodoroView in main.ts) properly:
       * 1. Calls getLeafOfType(POMODORO_VIEW_TYPE) to find existing views
       * 2. If found, activates that leaf with workspace.setActiveLeaf()
       * 3. Calls workspace.revealLeaf() to ensure visibility
       * 4. Only creates a new leaf if no existing view found
       *
       * The Bases views (openBasesFileForCommand) currently:
       * 1. Always calls workspace.getLeaf() without checking for existing views
       * 2. This creates a new leaf in the main workspace
       * 3. Existing views in sidebars are ignored
       *
       * This test verifies the expected pattern by checking if getLeafOfType
       * is used for Calendar view activation.
       */
      const page = app.page;

      // Set up console message capture to look for debug logs
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('[TaskNotes]') ||
          text.includes('getLeaf') ||
          text.includes('Calendar')
        ) {
          consoleMessages.push(text);
        }
      });

      // Open Calendar view
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Move to sidebar
      await runCommand(page, 'Move current pane to right sidebar');
      await page.waitForTimeout(1000);

      // Open again
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Check console for evidence of proper leaf lookup
      console.log('Console messages related to Calendar/getLeaf:');
      consoleMessages.forEach((msg) => console.log(`  ${msg}`));

      // The fix should show evidence of checking for existing leaves
      // Currently this test documents that this check is NOT happening
    }
  );

  test.fixme(
    'reproduces issue #1060 - multiple Calendar views should not be created',
    async () => {
      /**
       * A consequence of the bug is that multiple Calendar views can be created
       * unintentionally. Each time the user uses the hotkey while a Calendar
       * exists in the sidebar, a new instance is created in the main workspace.
       *
       * This test verifies that using the open command multiple times does not
       * create duplicate views.
       */
      const page = app.page;

      // First, close all existing Calendar views
      // This ensures a clean state
      for (let i = 0; i < 3; i++) {
        const calendarTab = page.locator('.workspace-tab-header').filter({
          has: page.locator('[data-type="tasknotesCalendar"]'),
        });

        if (await calendarTab.first().isVisible({ timeout: 500 }).catch(() => false)) {
          const closeButton = calendarTab.first().locator('.workspace-tab-header-inner-close-button');
          if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
            await closeButton.click();
            await page.waitForTimeout(300);
          }
        }
      }

      // Open Calendar once
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Count Calendar views
      const initialCount = await page.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"]'
      ).count();

      console.log(`Initial Calendar view count: ${initialCount}`);

      // Open Calendar again (should reuse existing, not create new)
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Count again
      const afterSecondOpen = await page.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"]'
      ).count();

      console.log(`Calendar view count after second open: ${afterSecondOpen}`);

      // Move to sidebar
      await runCommand(page, 'Move current pane to right sidebar');
      await page.waitForTimeout(1000);

      // Open Calendar again
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Count final
      const finalCount = await page.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"]'
      ).count();

      console.log(`Final Calendar view count: ${finalCount}`);

      // Expected: Should have exactly 1 Calendar view
      // Bug: May have 2 (one in sidebar, one in main workspace)
      expect(finalCount).toBe(1);
    }
  );

  test.fixme(
    'reproduces issue #1060 - left sidebar Calendar should also be preserved',
    async () => {
      /**
       * The bug affects both left and right sidebars. This test specifically
       * tests the left sidebar case.
       */
      const page = app.page;

      // Open Calendar
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1500);

      // Move to left sidebar
      await runCommand(page, 'Move current pane to left sidebar');
      await page.waitForTimeout(1000);

      // Verify it's in left sidebar
      const leftSidebar = page.locator('.mod-left-split');
      const calendarInLeftSidebar = leftSidebar.locator(
        '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
        '.workspace-leaf .fc'
      );

      const isInLeftSidebar = await calendarInLeftSidebar.isVisible({ timeout: 2000 }).catch(() => false);

      if (isInLeftSidebar) {
        // Open Calendar via command
        await runCommand(page, 'TaskNotes: Open calendar');
        await page.waitForTimeout(1500);

        // Check if main workspace now has a Calendar (bug)
        const mainWorkspace = page.locator('.mod-root');
        const calendarInMain = mainWorkspace.locator(
          '.workspace-leaf-content[data-type="tasknotesCalendar"], ' +
          '.workspace-leaf .fc'
        );

        const bugPresent = await calendarInMain.isVisible({ timeout: 2000 }).catch(() => false);

        if (bugPresent) {
          console.log('CONFIRMED: Bug also affects left sidebar - Calendar opened in main instead of activating left sidebar view');
        }

        expect(bugPresent).toBe(false);
      } else {
        console.log('Could not move Calendar to left sidebar - skipping left sidebar specific test');
      }
    }
  );
});
