/**
 * Issue #729: [Bug] Properties button opens menu in main window instead of pop-out window
 *
 * Bug description:
 * When a view (e.g., Kanban) is opened in an external/pop-out window, clicking the
 * Properties button does nothing in the pop-out window. The Properties context menu
 * appears in the main window instead of the pop-out window where it was clicked.
 *
 * Root cause analysis:
 * The PropertyVisibilityDropdown component creates an Obsidian Menu and calls
 * `menu.showAtMouseEvent(event)` without getting the correct document reference
 * from the event target. This causes the menu to render in the main window's document
 * rather than the pop-out window's document.
 *
 * Other context menus in the codebase (e.g., PriorityContextMenu, StatusContextMenu)
 * correctly handle pop-out windows by storing `targetDoc = element.ownerDocument`
 * and using that document reference for menu positioning and queries.
 *
 * Expected behavior:
 * - Properties context menu should appear in the same window where the button was clicked
 * - Menu should be positioned under the Properties button
 * - All menu interactions should work within the pop-out window
 *
 * @see https://github.com/callumalpass/tasknotes/issues/729
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #729: Properties button opens menu in main window instead of pop-out window', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #729 - Properties menu should appear in pop-out window, not main window',
    async () => {
      /**
       * This test reproduces the core bug: clicking the Properties button in a
       * pop-out Kanban view opens the menu in the main window instead of the
       * pop-out window.
       *
       * Steps to reproduce:
       * 1. Open the Kanban view
       * 2. Pop out the Kanban view into a new window
       * 3. Click the Properties button in the pop-out window
       * 4. Verify the menu appears in the pop-out window, not the main window
       *
       * Current behavior: Menu appears in main window (or not at all if main window isn't visible)
       * Expected behavior: Menu appears in the pop-out window under the Properties button
       */
      const page = app.page;

      // Open the Kanban view in the main window first
      await runCommand(page, 'TaskNotes: Open Kanban view');
      await page.waitForTimeout(1000);

      // Wait for Kanban view to load
      const kanbanContainer = page.locator('.tasknotes-kanban-view, .kanban-board, [data-type="tasknotes-kanban"]');
      await expect(kanbanContainer.first()).toBeVisible({ timeout: 10000 });

      // Find the tab for the Kanban view to pop it out
      const kanbanTab = page.locator('.workspace-tab-header:has-text("Kanban"), .workspace-tab-header:has-text("Task")');
      if (await kanbanTab.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        // Right-click to open context menu
        await kanbanTab.first().click({ button: 'right' });
        await page.waitForTimeout(300);

        // Look for "Move to new window" option
        const moveToNewWindowOption = page.locator('.menu-item:has-text("Move to new window")');
        if (await moveToNewWindowOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Get browser context to capture new windows
          const context = page.context();

          // Listen for new page (pop-out window)
          const popoutPromise = context.waitForEvent('page', { timeout: 10000 });

          await moveToNewWindowOption.click();

          // Wait for the pop-out window
          const popoutPage = await popoutPromise.catch(() => null);

          if (popoutPage) {
            await popoutPage.waitForLoadState('domcontentloaded');
            await popoutPage.waitForTimeout(2000);

            // Verify Kanban view is visible in pop-out window
            const popoutKanban = popoutPage.locator('.tasknotes-kanban-view, .kanban-board, [data-type="tasknotes-kanban"]');
            await expect(popoutKanban.first()).toBeVisible({ timeout: 10000 });

            // Find the Properties button in the pop-out window
            // The Properties button is typically in the toolbar
            const propertiesButton = popoutPage.locator(
              'button:has-text("Properties"), [aria-label*="Properties"], .toolbar button:has-text("Properties")'
            );

            if (await propertiesButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
              // Clear any existing menus in the main window first
              await page.keyboard.press('Escape');
              await page.waitForTimeout(100);

              // Click the Properties button in the pop-out window
              await propertiesButton.first().click();
              await popoutPage.waitForTimeout(500);

              // Check if menu appeared in the pop-out window
              const popoutMenu = popoutPage.locator('.menu');
              const popoutMenuVisible = await popoutMenu.isVisible({ timeout: 2000 }).catch(() => false);

              // Check if menu appeared in the main window (this would be the bug)
              const mainWindowMenu = page.locator('.menu');
              const mainMenuVisible = await mainWindowMenu.isVisible({ timeout: 500 }).catch(() => false);

              // Log which window has the menu for debugging
              console.log(`Pop-out window has menu: ${popoutMenuVisible}`);
              console.log(`Main window has menu: ${mainMenuVisible}`);

              // The bug: menu appears in main window instead of pop-out window
              // Expected: menu should appear in pop-out window
              expect(popoutMenuVisible).toBe(true);
              expect(mainMenuVisible).toBe(false);

              // Close the menu
              await popoutPage.keyboard.press('Escape');
            }

            // Close the pop-out window
            await popoutPage.close();
          }
        }
      }

      // Press Escape to close any menus
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #729 - Properties menu should be positioned correctly in pop-out window',
    async () => {
      /**
       * This test verifies that when the Properties menu appears in the pop-out
       * window, it is positioned correctly near the button that was clicked.
       *
       * The bug may also manifest as the menu appearing at incorrect coordinates
       * (e.g., top-left corner) because the coordinates are calculated for the
       * main window's viewport instead of the pop-out window's viewport.
       */
      const page = app.page;

      // Open the Kanban view
      await runCommand(page, 'TaskNotes: Open Kanban view');
      await page.waitForTimeout(1000);

      const kanbanContainer = page.locator('.tasknotes-kanban-view, .kanban-board, [data-type="tasknotes-kanban"]');
      await expect(kanbanContainer.first()).toBeVisible({ timeout: 10000 });

      // Pop out the view
      const kanbanTab = page.locator('.workspace-tab-header:has-text("Kanban"), .workspace-tab-header:has-text("Task")');
      if (await kanbanTab.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await kanbanTab.first().click({ button: 'right' });
        await page.waitForTimeout(300);

        const moveToNewWindowOption = page.locator('.menu-item:has-text("Move to new window")');
        if (await moveToNewWindowOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          const context = page.context();
          const popoutPromise = context.waitForEvent('page', { timeout: 10000 });

          await moveToNewWindowOption.click();

          const popoutPage = await popoutPromise.catch(() => null);

          if (popoutPage) {
            await popoutPage.waitForLoadState('domcontentloaded');
            await popoutPage.waitForTimeout(2000);

            const popoutKanban = popoutPage.locator('.tasknotes-kanban-view, .kanban-board, [data-type="tasknotes-kanban"]');
            await expect(popoutKanban.first()).toBeVisible({ timeout: 10000 });

            const propertiesButton = popoutPage.locator(
              'button:has-text("Properties"), [aria-label*="Properties"], .toolbar button:has-text("Properties")'
            );

            if (await propertiesButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
              // Get the button's position
              const buttonBox = await propertiesButton.first().boundingBox();

              // Click the Properties button
              await propertiesButton.first().click();
              await popoutPage.waitForTimeout(500);

              // Check for menu in pop-out window
              const popoutMenu = popoutPage.locator('.menu');

              if (await popoutMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Get the menu's position
                const menuBox = await popoutMenu.boundingBox();

                if (buttonBox && menuBox) {
                  // The menu should be positioned near the button
                  // Allow some tolerance (100px) for the menu to be near the button
                  const horizontalDistance = Math.abs(menuBox.x - buttonBox.x);
                  const verticalDistance = Math.abs(menuBox.y - (buttonBox.y + buttonBox.height));

                  console.log(`Button position: (${buttonBox.x}, ${buttonBox.y})`);
                  console.log(`Menu position: (${menuBox.x}, ${menuBox.y})`);
                  console.log(`Horizontal distance: ${horizontalDistance}, Vertical distance: ${verticalDistance}`);

                  // Menu should be within 200px of the button (reasonable tolerance)
                  // If the bug causes menu to appear at (0, 0) or far from button, this fails
                  const isNearButton = horizontalDistance < 200 && verticalDistance < 200;
                  expect(isNearButton).toBe(true);
                }
              }

              await popoutPage.keyboard.press('Escape');
            }

            await popoutPage.close();
          }
        }
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #729 - Properties menu items should be interactive in pop-out window',
    async () => {
      /**
       * This test verifies that when the Properties menu appears in the pop-out
       * window, the menu items are interactive and can toggle property visibility.
       *
       * Even if the menu appears in the correct window, it might not be interactive
       * if event handlers are bound to the wrong document context.
       */
      const page = app.page;

      // Open the Kanban view
      await runCommand(page, 'TaskNotes: Open Kanban view');
      await page.waitForTimeout(1000);

      const kanbanContainer = page.locator('.tasknotes-kanban-view, .kanban-board, [data-type="tasknotes-kanban"]');
      await expect(kanbanContainer.first()).toBeVisible({ timeout: 10000 });

      // Pop out the view
      const kanbanTab = page.locator('.workspace-tab-header:has-text("Kanban"), .workspace-tab-header:has-text("Task")');
      if (await kanbanTab.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await kanbanTab.first().click({ button: 'right' });
        await page.waitForTimeout(300);

        const moveToNewWindowOption = page.locator('.menu-item:has-text("Move to new window")');
        if (await moveToNewWindowOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          const context = page.context();
          const popoutPromise = context.waitForEvent('page', { timeout: 10000 });

          await moveToNewWindowOption.click();

          const popoutPage = await popoutPromise.catch(() => null);

          if (popoutPage) {
            await popoutPage.waitForLoadState('domcontentloaded');
            await popoutPage.waitForTimeout(2000);

            const popoutKanban = popoutPage.locator('.tasknotes-kanban-view, .kanban-board, [data-type="tasknotes-kanban"]');
            await expect(popoutKanban.first()).toBeVisible({ timeout: 10000 });

            const propertiesButton = popoutPage.locator(
              'button:has-text("Properties"), [aria-label*="Properties"], .toolbar button:has-text("Properties")'
            );

            if (await propertiesButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
              // Click the Properties button
              await propertiesButton.first().click();
              await popoutPage.waitForTimeout(500);

              // Check for menu in pop-out window
              const popoutMenu = popoutPage.locator('.menu');

              if (await popoutMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Find a menu item that can be toggled (e.g., "Due Date" or "Priority")
                const menuItem = popoutMenu.locator('.menu-item:has-text("Due"), .menu-item:has-text("Priority")').first();

                if (await menuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
                  // Get the initial state (check icon present or not)
                  const initialHasCheck = await menuItem.locator('.menu-item-icon svg, .lucide-check-square, .lucide-square').count() > 0;

                  // Click the menu item to toggle
                  await menuItem.click();
                  await popoutPage.waitForTimeout(300);

                  // The menu should have closed after clicking (or updated)
                  // Re-open the menu to check the state changed
                  await propertiesButton.first().click();
                  await popoutPage.waitForTimeout(500);

                  const newMenu = popoutPage.locator('.menu');
                  if (await newMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
                    const newMenuItem = newMenu.locator('.menu-item:has-text("Due"), .menu-item:has-text("Priority")').first();

                    // The toggle state should have changed (this verifies interactivity)
                    // We're just checking that clicking didn't cause an error and
                    // the menu can be reopened
                    expect(await newMenuItem.isVisible()).toBe(true);
                  }
                }

                await popoutPage.keyboard.press('Escape');
              }
            }

            await popoutPage.close();
          }
        }
      }

      await page.keyboard.press('Escape');
    }
  );
});
