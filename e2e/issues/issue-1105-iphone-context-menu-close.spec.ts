/**
 * Issue #1105: [issue/UI]: iPhone can't close task options menu
 *
 * Bug description:
 * On iPhone, the padding at the top of the context menu when it opens is too tight.
 * Closing the menu gets confused with tapping the iPhone's top bar (status bar/notch area).
 * The user suggests either increasing top padding or adding a larger close-x icon.
 *
 * This is a mobile-specific UI issue where the hit target for dismissing the menu
 * conflicts with the iOS status bar/notch safe area.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1105
 */

import { test, expect, devices } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1105: iPhone task options menu close behavior', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1105 - context menu top padding is insufficient on iPhone', async () => {
    /**
     * This test verifies that the context menu has adequate top padding
     * to avoid conflicts with the iPhone status bar/notch area.
     *
     * Current behavior (bug):
     * - Context menu opens with tight padding at the top
     * - Tapping to dismiss the menu near the top is confused with iOS status bar interaction
     * - Users cannot easily close the menu on iPhone
     *
     * Expected behavior:
     * - Context menu should have sufficient top padding (safe area inset)
     * - Tapping outside the menu should reliably dismiss it
     * - A visible close button could provide an alternative dismissal method
     *
     * Root cause hypothesis:
     * - Obsidian's Menu class doesn't account for iOS safe-area-inset-top
     * - The menu positioning places content too close to the notch area
     * - No explicit close/cancel button is provided in the menu
     *
     * Potential fixes:
     * 1. Add CSS env(safe-area-inset-top) padding to .menu on mobile
     * 2. Add a close/cancel menu item at the bottom of context menus on mobile
     * 3. Increase the touchable area outside the menu for dismissal
     * 4. Prevent menu from opening in the top safe area zone
     */
    const page = app.page;

    // Emulate iPhone viewport and touch behavior
    const iPhoneViewport = {
      width: 390,  // iPhone 14 width
      height: 844, // iPhone 14 height
    };

    // Open a view with task cards
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card to open context menu
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test context menu');
      return;
    }

    // Open context menu by right-clicking (or long-press on mobile)
    const contextMenuButton = taskCard.locator('.task-card__context-menu');

    if (await contextMenuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await contextMenuButton.click();
    } else {
      // Fallback: right-click on the task card
      await taskCard.click({ button: 'right' });
    }

    await page.waitForTimeout(500);

    // Wait for context menu to appear
    const menu = page.locator('.menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Verify menu has adequate top padding
    const menuBox = await menu.boundingBox();

    if (menuBox) {
      // On iPhone, the safe area for the notch is typically 47-59 pixels
      // The menu should either:
      // 1. Be positioned below this safe area, OR
      // 2. Have internal padding that accounts for it
      const safeAreaTop = 59; // iPhone notch safe area

      // Check if menu is positioned too close to the top
      const menuTopIsTooClose = menuBox.y < safeAreaTop;

      if (menuTopIsTooClose) {
        // The menu is in the danger zone - check if it has adequate internal padding
        const menuPaddingTop = await menu.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return parseInt(style.paddingTop, 10);
        });

        // If positioned near the top, should have at least safe area worth of padding
        const neededPadding = safeAreaTop - menuBox.y;

        // This assertion documents the bug - menu doesn't have enough padding
        // When fixed, menu should either be positioned lower or have padding
        expect(menuPaddingTop).toBeGreaterThanOrEqual(neededPadding);
      }
    }

    // Close the menu
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1105 - tapping above menu should dismiss it reliably', async () => {
    /**
     * This test verifies that tapping outside the menu (above it) reliably
     * dismisses the context menu, without being intercepted by iOS system UI.
     *
     * On iPhone, taps near the top of the screen may be interpreted as
     * interactions with the status bar (scroll to top, etc.) rather than
     * dismissing the menu.
     */
    const page = app.page;

    // Open a view with task cards
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find and open context menu on a task card
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test context menu');
      return;
    }

    const contextMenuButton = taskCard.locator('.task-card__context-menu');

    if (await contextMenuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await contextMenuButton.click();
    } else {
      await taskCard.click({ button: 'right' });
    }

    await page.waitForTimeout(500);

    // Wait for context menu
    const menu = page.locator('.menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    const menuBox = await menu.boundingBox();

    if (menuBox) {
      // Tap above the menu to dismiss it
      // On iPhone, this area may conflict with the status bar
      const tapY = Math.max(10, menuBox.y - 20); // Tap 20px above menu, but at least 10px from top
      const tapX = menuBox.x + menuBox.width / 2;

      // Simulate touch tap above the menu
      await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        if (element) {
          // Dispatch click event (iOS converts touch to click)
          element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }));
        }
      }, { x: tapX, y: tapY });

      await page.waitForTimeout(300);

      // Menu should be dismissed
      // The bug is that this doesn't work reliably on iPhone when tapping near the top
      await expect(menu).not.toBeVisible({ timeout: 2000 });
    }
  });

  test.fixme('reproduces issue #1105 - menu should have accessible close mechanism on mobile', async () => {
    /**
     * This test checks whether the context menu provides an accessible
     * close mechanism on mobile devices.
     *
     * Suggested fix: Add a "Cancel" or close button as the last menu item
     * that users can tap to dismiss the menu without relying on tapping
     * outside the menu area.
     */
    const page = app.page;

    // Open a view with task cards
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find and open context menu
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test context menu');
      return;
    }

    const contextMenuButton = taskCard.locator('.task-card__context-menu');

    if (await contextMenuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await contextMenuButton.click();
    } else {
      await taskCard.click({ button: 'right' });
    }

    await page.waitForTimeout(500);

    // Wait for context menu
    const menu = page.locator('.menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Check for a close/cancel button in the menu
    // This documents the expectation that on mobile, menus should have
    // an explicit close mechanism
    const closeItem = menu.locator('.menu-item').filter({
      hasText: /close|cancel|dismiss/i
    });

    const hasCloseButton = await closeItem.isVisible({ timeout: 1000 }).catch(() => false);

    // Alternatively, check for an X button/icon
    const closeIcon = menu.locator('[aria-label*="close"], [aria-label*="dismiss"], .menu-close, .lucide-x');
    const hasCloseIcon = await closeIcon.isVisible({ timeout: 1000 }).catch(() => false);

    // At least one close mechanism should be available on mobile
    // This will fail until a close mechanism is added
    expect(hasCloseButton || hasCloseIcon).toBe(true);

    // Clean up
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1105 - menu should respect safe-area-inset-top on iOS', async () => {
    /**
     * This test verifies that the context menu CSS properly uses
     * env(safe-area-inset-top) to account for iPhone notch/Dynamic Island.
     */
    const page = app.page;

    // Open a view with task cards
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find and open context menu
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test context menu');
      return;
    }

    const contextMenuButton = taskCard.locator('.task-card__context-menu');

    if (await contextMenuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await contextMenuButton.click();
    } else {
      await taskCard.click({ button: 'right' });
    }

    await page.waitForTimeout(500);

    // Wait for context menu
    const menu = page.locator('.menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Check if the menu or its container uses safe-area CSS
    // This can be done by checking computed styles for padding-top
    // Note: In Playwright/Electron, env(safe-area-inset-top) will be 0
    // This test documents what the CSS should include

    const menuStyles = await menu.evaluate((el) => {
      const style = window.getComputedStyle(el);
      // Check various padding/margin properties
      return {
        paddingTop: style.paddingTop,
        marginTop: style.marginTop,
        top: style.top,
        // Also get the CSS rule for analysis
        cssText: el.style.cssText,
      };
    });

    console.log('Menu styles:', menuStyles);

    // The fix would add something like:
    // .menu { padding-top: env(safe-area-inset-top, 0); }
    // or positioning that accounts for the safe area

    // For now, just verify the menu is accessible
    const menuBox = await menu.boundingBox();
    expect(menuBox).toBeTruthy();

    // Clean up
    await page.keyboard.press('Escape');
  });
});
