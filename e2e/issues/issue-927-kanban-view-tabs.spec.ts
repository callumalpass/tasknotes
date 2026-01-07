/**
 * Issue #927: [FR] Kanban tab for each view
 *
 * Feature Request Description:
 * Kanban views can be much more convenient if it is easier to select and switch
 * between different views. The feature request is to create a "tab" button for
 * each saved view, allowing the user to very quickly switch between different
 * views of a potentially very large kanban board.
 *
 * Current behavior:
 * - Views are switched via a dropdown menu in the Bases plugin UI
 * - Deselecting a view doesn't visually remove the highlight from the dropdown
 *
 * Requested behavior:
 * - Tab buttons displayed for each saved view (similar to Anytype's implementation)
 * - Quick visual switching between views without dropdown interaction
 * - Clear visual indication of the currently selected view
 * - Dropdown highlight bug should be fixed when deselecting
 *
 * Implementation context:
 * - The Kanban view is part of TaskNotes Bases integration (src/bases/KanbanView.ts)
 * - Views are registered via the Obsidian Bases public API (src/bases/registration.ts)
 * - The "views" in this context refer to saved configurations in the Obsidian Bases plugin
 *   that include filters, grouping settings, etc.
 * - The tabs would need to be rendered by TaskNotes since the Bases plugin controls
 *   the overall view container
 *
 * @see https://github.com/callumalpass/tasknotes/issues/927
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #927: Kanban view tabs', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'FR #927 - kanban view should display tab buttons for saved views',
    async () => {
      /**
       * This test verifies that when a Kanban view is displayed with multiple
       * saved views configured, tab buttons are shown for quick switching.
       *
       * Expected behavior:
       * - A tab bar/strip is visible at the top of the Kanban view
       * - Each saved view has a corresponding tab button
       * - Tabs are clearly labeled with view names
       * - The currently active view's tab is visually highlighted
       */
      const page = app.page;

      // Open a Bases view that has Kanban configured
      // This would typically be done by opening a .base file or embedded Bases block
      const basesView = page.locator('.bases-container, .bases-view');

      // Look for a kanban view within the bases container
      const kanbanBoard = page.locator('.kanban-view, .kanban-view__board');

      // Feature request: Tab bar should be visible above the kanban board
      const viewTabBar = page.locator(
        '.kanban-view__tabs, .bases-view-tabs, .view-tab-bar'
      );

      // Check if tab bar exists (feature not yet implemented)
      const tabBarVisible = await viewTabBar.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('View tab bar visible:', tabBarVisible);

      if (tabBarVisible) {
        // Check for individual tab buttons
        const tabButtons = viewTabBar.locator('.view-tab, .tab-button, button');
        const tabCount = await tabButtons.count();
        console.log('Number of view tabs:', tabCount);

        expect(tabCount).toBeGreaterThan(0);
      } else {
        // Feature not yet implemented - this test documents the expected behavior
        expect(tabBarVisible).toBe(true);
      }
    }
  );

  test.fixme(
    'FR #927 - clicking a view tab should switch to that view',
    async () => {
      /**
       * This test verifies that clicking a tab switches the Kanban to that view's
       * configuration (filters, grouping, etc.).
       *
       * Expected behavior:
       * - Click on a tab that is not currently active
       * - The Kanban board updates to reflect the selected view's settings
       * - The clicked tab becomes visually highlighted as active
       * - The previously active tab loses its highlight
       */
      const page = app.page;

      // Locate the view tab bar
      const viewTabBar = page.locator(
        '.kanban-view__tabs, .bases-view-tabs, .view-tab-bar'
      );

      // Get all tab buttons
      const tabButtons = viewTabBar.locator('.view-tab, .tab-button, button');
      const tabCount = await tabButtons.count();

      if (tabCount > 1) {
        // Find the currently active tab
        const activeTab = viewTabBar.locator(
          '.view-tab.is-active, .tab-button.active, button.is-active, [data-active="true"]'
        );
        const activeTabText = await activeTab.textContent();
        console.log('Currently active tab:', activeTabText);

        // Click on a different tab
        const inactiveTab = tabButtons.filter({
          has: page.locator(':not(.is-active):not(.active)'),
        }).first();

        if (await inactiveTab.isVisible({ timeout: 1000 })) {
          const inactiveTabText = await inactiveTab.textContent();
          console.log('Clicking on tab:', inactiveTabText);

          await inactiveTab.click();
          await page.waitForTimeout(500);

          // Verify the clicked tab is now active
          const newActiveTab = viewTabBar.locator(
            '.view-tab.is-active, .tab-button.active, button.is-active, [data-active="true"]'
          );
          const newActiveTabText = await newActiveTab.textContent();
          console.log('New active tab:', newActiveTabText);

          expect(newActiveTabText).toBe(inactiveTabText);
        }
      }
    }
  );

  test.fixme(
    'FR #927 - active tab should be visually distinguished from inactive tabs',
    async () => {
      /**
       * This test verifies that the currently active view tab has clear visual
       * distinction from inactive tabs.
       *
       * Expected behavior:
       * - Active tab has different styling (background color, border, etc.)
       * - Active tab state is clearly visible at a glance
       * - Styling follows the current Obsidian theme (light/dark mode compatible)
       */
      const page = app.page;

      // Locate the view tab bar
      const viewTabBar = page.locator(
        '.kanban-view__tabs, .bases-view-tabs, .view-tab-bar'
      );

      const tabButtons = viewTabBar.locator('.view-tab, .tab-button, button');
      const tabCount = await tabButtons.count();

      if (tabCount >= 2) {
        // Get the active tab
        const activeTab = viewTabBar.locator(
          '.view-tab.is-active, .tab-button.active, button.is-active, [data-active="true"]'
        ).first();

        // Get an inactive tab
        const inactiveTab = tabButtons.filter({
          has: page.locator(':not(.is-active):not(.active)'),
        }).first();

        if ((await activeTab.isVisible()) && (await inactiveTab.isVisible())) {
          // Compare visual styles
          const activeStyles = await activeTab.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              backgroundColor: computed.backgroundColor,
              borderColor: computed.borderColor,
              fontWeight: computed.fontWeight,
              opacity: computed.opacity,
            };
          });

          const inactiveStyles = await inactiveTab.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              backgroundColor: computed.backgroundColor,
              borderColor: computed.borderColor,
              fontWeight: computed.fontWeight,
              opacity: computed.opacity,
            };
          });

          console.log('Active tab styles:', activeStyles);
          console.log('Inactive tab styles:', inactiveStyles);

          // Active and inactive tabs should have some visual difference
          const hasDifference =
            activeStyles.backgroundColor !== inactiveStyles.backgroundColor ||
            activeStyles.borderColor !== inactiveStyles.borderColor ||
            activeStyles.fontWeight !== inactiveStyles.fontWeight ||
            activeStyles.opacity !== inactiveStyles.opacity;

          expect(hasDifference).toBe(true);
        }
      }
    }
  );

  test.fixme(
    'FR #927 - dropdown selection highlight should clear when view is deselected',
    async () => {
      /**
       * This test documents the bug mentioned in the feature request where
       * deselecting a view doesn't visually remove the highlight from the dropdown.
       *
       * Expected behavior:
       * - When a view is deselected (or another view is selected)
       * - The dropdown item for the previous view should no longer be highlighted
       * - Only the currently selected view should be highlighted
       */
      const page = app.page;

      // Locate the view dropdown in Bases UI
      const viewDropdown = page.locator(
        '.bases-view-dropdown, .view-selector, [data-view-selector]'
      );

      if (await viewDropdown.isVisible({ timeout: 3000 })) {
        // Open the dropdown
        await viewDropdown.click();
        await page.waitForTimeout(300);

        // Look for dropdown menu items
        const dropdownMenu = page.locator(
          '.menu, .dropdown-menu, .suggestion-container'
        );
        await expect(dropdownMenu).toBeVisible({ timeout: 2000 });

        const menuItems = dropdownMenu.locator('.menu-item, .suggestion-item');
        const itemCount = await menuItems.count();

        if (itemCount > 1) {
          // Check how many items are highlighted
          const highlightedItems = dropdownMenu.locator(
            '.menu-item.is-selected, .menu-item.is-active, .suggestion-item.is-selected'
          );
          const highlightedCount = await highlightedItems.count();

          console.log('Number of highlighted dropdown items:', highlightedCount);

          // Bug: Only one item should be highlighted (the current view)
          // The issue reports that the highlight isn't cleared when deselecting
          expect(highlightedCount).toBeLessThanOrEqual(1);
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  );

  test.fixme(
    'FR #927 - tabs should be keyboard navigable',
    async () => {
      /**
       * This test verifies that view tabs are accessible via keyboard navigation.
       *
       * Expected behavior:
       * - Tab key moves focus between view tabs
       * - Enter/Space key activates the focused tab
       * - Arrow keys navigate between tabs when focused
       * - Accessibility: tabs should have proper ARIA roles
       */
      const page = app.page;

      // Locate the view tab bar
      const viewTabBar = page.locator(
        '.kanban-view__tabs, .bases-view-tabs, .view-tab-bar'
      );

      if (await viewTabBar.isVisible({ timeout: 3000 })) {
        const tabButtons = viewTabBar.locator('.view-tab, .tab-button, button');
        const tabCount = await tabButtons.count();

        if (tabCount > 1) {
          // Focus the first tab
          await tabButtons.first().focus();
          await page.waitForTimeout(100);

          // Verify it's focused
          const focusedElement = await page.evaluate(() => document.activeElement?.className);
          console.log('Focused element class:', focusedElement);

          // Try keyboard navigation with arrow keys
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(100);

          const newFocusedElement = await page.evaluate(() => document.activeElement?.className);
          console.log('After ArrowRight, focused:', newFocusedElement);

          // Check ARIA roles
          const firstTab = tabButtons.first();
          const ariaRole = await firstTab.getAttribute('role');
          const ariaSelected = await firstTab.getAttribute('aria-selected');

          console.log('Tab ARIA role:', ariaRole);
          console.log('Tab aria-selected:', ariaSelected);

          // Tabs should have proper ARIA attributes
          // The role should be 'tab' and the container should have role 'tablist'
          expect(ariaRole).toBe('tab');
        }
      }
    }
  );

  test.fixme(
    'FR #927 - tabs should work with mobile/touch interactions',
    async () => {
      /**
       * This test verifies that view tabs work well on mobile/tablet devices
       * with touch interactions.
       *
       * Expected behavior:
       * - Tabs are large enough for touch targets (min 44x44 pixels)
       * - Tap on a tab switches to that view
       * - Horizontal scrolling if there are many tabs
       * - No hover-dependent interactions
       */
      const page = app.page;

      // Locate the view tab bar
      const viewTabBar = page.locator(
        '.kanban-view__tabs, .bases-view-tabs, .view-tab-bar'
      );

      if (await viewTabBar.isVisible({ timeout: 3000 })) {
        const tabButtons = viewTabBar.locator('.view-tab, .tab-button, button');
        const tabCount = await tabButtons.count();

        if (tabCount > 0) {
          const firstTab = tabButtons.first();
          const boundingBox = await firstTab.boundingBox();

          if (boundingBox) {
            console.log('Tab dimensions:', {
              width: boundingBox.width,
              height: boundingBox.height,
            });

            // Minimum touch target size (WCAG 2.5.5 recommends 44x44px)
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }

          // Check if tab bar is horizontally scrollable when needed
          const tabBarBox = await viewTabBar.boundingBox();
          if (tabBarBox) {
            const overflowX = await viewTabBar.evaluate((el) => {
              const computed = window.getComputedStyle(el);
              return computed.overflowX;
            });

            console.log('Tab bar overflow-x:', overflowX);

            // Should allow horizontal scrolling for many tabs
            // (auto or scroll, not hidden)
            expect(['auto', 'scroll', 'visible']).toContain(overflowX);
          }
        }
      }
    }
  );

  test.fixme(
    'FR #927 - tabs should synchronize with Bases view dropdown',
    async () => {
      /**
       * This test verifies that the tab UI stays synchronized with
       * the existing Bases plugin view dropdown.
       *
       * Expected behavior:
       * - Selecting a view via dropdown also updates the tab highlight
       * - Selecting a view via tab also updates the dropdown selection
       * - Both UIs remain consistent
       */
      const page = app.page;

      // Locate both the tab bar and dropdown
      const viewTabBar = page.locator(
        '.kanban-view__tabs, .bases-view-tabs, .view-tab-bar'
      );
      const viewDropdown = page.locator(
        '.bases-view-dropdown, .view-selector, [data-view-selector]'
      );

      if (
        (await viewTabBar.isVisible({ timeout: 3000 })) &&
        (await viewDropdown.isVisible({ timeout: 1000 }))
      ) {
        const tabButtons = viewTabBar.locator('.view-tab, .tab-button, button');
        const tabCount = await tabButtons.count();

        if (tabCount > 1) {
          // Get current active tab
          const activeTab = viewTabBar.locator(
            '.view-tab.is-active, .tab-button.active, button.is-active'
          ).first();
          const activeTabName = await activeTab.textContent();
          console.log('Current active tab:', activeTabName);

          // Select a different view via dropdown
          await viewDropdown.click();
          await page.waitForTimeout(300);

          const dropdownMenu = page.locator('.menu, .dropdown-menu');
          if (await dropdownMenu.isVisible({ timeout: 1000 })) {
            // Select a different view
            const menuItems = dropdownMenu.locator('.menu-item');
            const differentView = menuItems.filter({
              hasNotText: activeTabName || '',
            }).first();

            if (await differentView.isVisible({ timeout: 500 })) {
              const differentViewName = await differentView.textContent();
              await differentView.click();
              await page.waitForTimeout(500);

              // Verify tab was also updated
              const newActiveTab = viewTabBar.locator(
                '.view-tab.is-active, .tab-button.active, button.is-active'
              ).first();
              const newActiveTabName = await newActiveTab.textContent();

              console.log('After dropdown selection, active tab:', newActiveTabName);

              // Tab and dropdown should be synchronized
              expect(newActiveTabName?.trim()).toBe(differentViewName?.trim());
            }
          }
        }
      }
    }
  );
});
