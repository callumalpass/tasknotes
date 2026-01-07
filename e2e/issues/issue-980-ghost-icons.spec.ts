/**
 * Issue #980: [Bug] Ghost icons
 *
 * User reported that icons for agenda view and list view in the sidebar
 * constantly get replaced with ghost icons. When switching out of a view,
 * its icon gets replaced with a ghost icon.
 *
 * Ghost icons in Obsidian typically indicate:
 * 1. The icon name is not recognized (not registered or misspelled)
 * 2. Custom icon was registered after the view was already rendered
 * 3. Icon registration timing issue during workspace restoration
 *
 * The TaskNotes views (tasknotesTaskList, tasknotesCalendar, etc.) use
 * "tasknotes-simple" as their icon (registered in main.ts:304).
 * The Bases view registration happens in registration.ts with:
 *   icon: "tasknotes-simple"
 *
 * Potential root causes:
 * 1. Race condition: Workspace restoration happens before icon is registered
 * 2. The custom icon isn't being re-applied when view tab is re-rendered
 * 3. Obsidian's Bases plugin doesn't persist custom icons properly for
 *    workspace tabs
 * 4. View type registration may use a different icon lookup than tab rendering
 *
 * @see https://github.com/callumalpass/tasknotes/issues/980
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #980: Ghost icons in sidebar for TaskNotes views', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #980 - task list view icon should not become a ghost after switching views',
    async () => {
      /**
       * This test reproduces the core bug: when switching between views,
       * the sidebar icons get replaced with ghost icons.
       *
       * Steps to reproduce:
       * 1. Open task list view in sidebar
       * 2. Open agenda view in sidebar
       * 3. Switch back to task list view
       * 4. Observe that the task list icon may have become a ghost
       */
      const page = app.page;

      // Open task list view
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(1000);

      // Find the task list tab in the sidebar/workspace
      const taskListTab = page.locator('.workspace-tab-header[data-type*="tasknotesTaskList"]');

      // Get the icon element within the tab
      const tabIcon = taskListTab.locator('.workspace-tab-header-icon, .workspace-tab-header-inner-icon');

      // Check if the icon is NOT a ghost icon
      // Ghost icons in Obsidian typically have a specific class or are empty SVGs
      const isGhostIcon = await tabIcon.evaluate((el) => {
        // Check for ghost icon indicators:
        // 1. The svg might have a specific "ghost" path or be the lucide ghost icon
        // 2. The icon might have a fallback/placeholder class
        // 3. The icon might be empty or have minimal content
        const svg = el.querySelector('svg');
        if (!svg) return true; // No SVG = ghost

        // Check if it's the lucide ghost icon (fallback for unknown icons)
        const pathD = svg.querySelector('path')?.getAttribute('d') || '';
        // Ghost icon typically has a specific path pattern
        const isGhost = pathD.includes('M9 10h.01') || // Part of ghost icon path
                       el.classList.contains('is-unknown') ||
                       el.classList.contains('is-fallback');

        return isGhost;
      });

      // The icon should NOT be a ghost initially
      expect(isGhostIcon).toBe(false);

      // Now open another view (agenda/calendar)
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(1000);

      // Switch back to task list view
      await taskListTab.click();
      await page.waitForTimeout(500);

      // Check if the task list icon is still correct (not a ghost)
      const isGhostAfterSwitch = await tabIcon.evaluate((el) => {
        const svg = el.querySelector('svg');
        if (!svg) return true;

        const pathD = svg.querySelector('path')?.getAttribute('d') || '';
        const isGhost = pathD.includes('M9 10h.01') ||
                       el.classList.contains('is-unknown') ||
                       el.classList.contains('is-fallback');

        return isGhost;
      });

      // BUG: After switching views, the icon should still be the TaskNotes icon,
      // not a ghost icon
      expect(isGhostAfterSwitch).toBe(false);
    }
  );

  test.fixme(
    'reproduces issue #980 - agenda view icon should not become a ghost after switching out',
    async () => {
      /**
       * According to the bug report, when the user switches OUT of agenda view,
       * it gets replaced with a ghost icon.
       */
      const page = app.page;

      // Open agenda/list view first
      await runCommand(page, 'TaskNotes: Open agenda');
      await page.waitForTimeout(1000);

      // Find the agenda tab
      const agendaTab = page.locator('.workspace-tab-header').filter({
        has: page.locator('[data-type*="tasknotes"]'),
      }).first();

      // Store initial icon state
      const initialIconHtml = await agendaTab.locator('.workspace-tab-header-icon').innerHTML();

      // Switch to a different view (e.g., open a markdown file)
      await runCommand(page, 'Open another file');
      await page.waitForTimeout(500);

      // Check if the agenda tab's icon is still correct
      const afterSwitchIconHtml = await agendaTab.locator('.workspace-tab-header-icon').innerHTML();

      // The icon should remain the same after switching away
      // Ghost icon replacement would change the HTML
      const iconChanged = initialIconHtml !== afterSwitchIconHtml;

      // If the icon changed, check if it became a ghost
      if (iconChanged) {
        const isNowGhost = await agendaTab.locator('.workspace-tab-header-icon').evaluate((el) => {
          const svg = el.querySelector('svg');
          if (!svg) return true;

          // Check for ghost icon patterns
          const hasGhostPath = svg.innerHTML.includes('ghost') ||
                              svg.innerHTML.includes('M9 10h.01');
          return hasGhostPath;
        });

        // BUG: The icon should not become a ghost after switching
        expect(isNowGhost).toBe(false);
      }
    }
  );

  test.fixme(
    'reproduces issue #980 - custom tasknotes-simple icon should be registered before workspace restoration',
    async () => {
      /**
       * This test checks if the "tasknotes-simple" icon is properly registered
       * and available for use by Bases views.
       *
       * The issue may be caused by workspace restoration happening before
       * the custom icon is registered, causing Obsidian to fall back to
       * a ghost icon.
       */
      const page = app.page;

      // Check if the tasknotes-simple icon is registered
      const iconExists = await page.evaluate(() => {
        // @ts-expect-error - accessing Obsidian internals
        const iconManager = (window as any).app?.iconManager;
        if (!iconManager) {
          // Alternative: check if the icon SVG was added via addIcon
          // @ts-expect-error - Obsidian global icons
          const obsidian = (window as any).obsidian;
          const iconMap = obsidian?.icons || {};
          return 'tasknotes-simple' in iconMap;
        }
        return iconManager.getIcon?.('tasknotes-simple') !== undefined;
      });

      console.log(`tasknotes-simple icon registered: ${iconExists}`);

      // The icon should be registered
      expect(iconExists).toBe(true);

      // Now open a TaskNotes view and verify it uses this icon
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(1000);

      // Find the tab and check its icon
      const taskListTab = page.locator('.workspace-tab-header[data-type*="tasknotesTaskList"]');

      const usesCustomIcon = await taskListTab.locator('.workspace-tab-header-icon').evaluate((el) => {
        const svg = el.querySelector('svg');
        if (!svg) return false;

        // The tasknotes-simple icon has a distinctive mask and path
        // Check for the mask ID that's used in the icon definition
        const hasMask = svg.innerHTML.includes('tasknotes-mask') ||
                       svg.innerHTML.includes('mask');

        // Or check for the distinctive path patterns from the icon
        const hasDistinctivePath = svg.innerHTML.includes('M 73.6,18.3') ||
                                   svg.innerHTML.includes('5.9,52.4');

        return hasMask || hasDistinctivePath;
      });

      // The view should be using the custom icon, not a fallback
      expect(usesCustomIcon).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #980 - sidebar icons should persist across app reload',
    async () => {
      /**
       * This test checks if icons persist correctly when the app is reloaded.
       * The ghost icon issue might be related to workspace restoration timing.
       */
      const page = app.page;

      // First, open multiple TaskNotes views in sidebar
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(500);
      await runCommand(page, 'TaskNotes: Open calendar');
      await page.waitForTimeout(500);

      // Get the icon states before reload
      const tabsBeforeReload = await page.locator('.workspace-tab-header[data-type*="tasknotes"]').all();
      const iconsBeforeReload = await Promise.all(
        tabsBeforeReload.map(async (tab) => {
          const iconEl = tab.locator('.workspace-tab-header-icon');
          return iconEl.innerHTML();
        })
      );

      // Reload the app (which triggers workspace restoration)
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(5000); // Wait for full reload

      // Get icon states after reload
      const tabsAfterReload = await page.locator('.workspace-tab-header[data-type*="tasknotes"]').all();

      // Check each tab's icon
      for (let i = 0; i < tabsAfterReload.length; i++) {
        const tab = tabsAfterReload[i];
        const iconEl = tab.locator('.workspace-tab-header-icon');

        const isGhost = await iconEl.evaluate((el) => {
          const svg = el.querySelector('svg');
          if (!svg) return true;

          // Check for ghost icon patterns
          const innerHTML = svg.innerHTML;
          return innerHTML.includes('M9 10h.01') || // Ghost icon path
                 innerHTML.includes('ghost') ||
                 !innerHTML.includes('path'); // No path = probably broken
        });

        // After reload, icons should not become ghosts
        expect(isGhost).toBe(false);
      }
    }
  );

  test.fixme(
    'reproduces issue #980 - icon should remain correct when dragging view tab',
    async () => {
      /**
       * The ghost icon might appear when tabs are reorganized (dragged).
       * This tests if the icon remains correct during tab manipulation.
       */
      const page = app.page;

      // Open a TaskNotes view
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(1000);

      const taskListTab = page.locator('.workspace-tab-header[data-type*="tasknotesTaskList"]');
      const iconEl = taskListTab.locator('.workspace-tab-header-icon');

      // Get initial icon
      const initialIcon = await iconEl.innerHTML();

      // Simulate tab interaction (hover, focus events that might trigger re-render)
      await taskListTab.hover();
      await page.waitForTimeout(200);

      await taskListTab.click({ button: 'right' }); // Open context menu
      await page.keyboard.press('Escape'); // Close it
      await page.waitForTimeout(200);

      // Check if icon changed
      const afterInteractionIcon = await iconEl.innerHTML();

      // Icon should remain unchanged after interactions
      if (initialIcon !== afterInteractionIcon) {
        // If it changed, make sure it didn't become a ghost
        const isNowGhost = await iconEl.evaluate((el) => {
          const svg = el.querySelector('svg');
          if (!svg) return true;
          return svg.innerHTML.includes('M9 10h.01') || svg.innerHTML.includes('ghost');
        });

        expect(isNowGhost).toBe(false);
      }
    }
  );

  test.fixme(
    'reproduces issue #980 - verifies icon rendering in view type selector',
    async () => {
      /**
       * When creating a new Bases view and selecting the view type,
       * the icon shown in the selector should also be the correct
       * tasknotes-simple icon, not a ghost.
       */
      const page = app.page;

      // Create a new base file or open the view type selector
      // This might require creating a .base file or using a specific command

      // First check if we can access the Bases view type selector
      await runCommand(page, 'Bases: Create new base');
      await page.waitForTimeout(1000);

      // Look for the view type selector/dropdown
      const viewTypeSelector = page.locator('.bases-view-type-selector, .dropdown-container');

      if (await viewTypeSelector.isVisible({ timeout: 2000 })) {
        // Find TaskNotes options in the selector
        const tasknotesOption = viewTypeSelector.locator('text=/TaskNotes/i');

        if (await tasknotesOption.isVisible({ timeout: 1000 })) {
          // Check the icon next to the option
          const optionIcon = tasknotesOption.locator('svg').first();

          const isGhostIcon = await optionIcon.evaluate((svg) => {
            if (!svg) return true;
            return svg.innerHTML.includes('M9 10h.01') || svg.innerHTML.includes('ghost');
          });

          expect(isGhostIcon).toBe(false);
        }
      }

      // Close any open dialogs
      await page.keyboard.press('Escape');
    }
  );
});
