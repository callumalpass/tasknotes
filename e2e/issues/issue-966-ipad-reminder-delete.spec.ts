/**
 * Issue #966: [Bug]: On iPad can't delete reminder in Manage All Reminders
 * (no trash can icon or context menu)
 *
 * Bug description:
 * On iPad, users cannot delete reminders in the "Manage All Reminders" modal.
 * The trash can icon (delete button) is either not visible or not accessible
 * on touch devices. There's also no context menu alternative for deletion.
 *
 * Root cause hypothesis:
 * 1. The delete button (.reminder-modal__action-btn) is only 24x24 pixels -
 *    too small for reliable touch targets (Apple recommends 44x44 minimum)
 * 2. The button styling relies on :hover states which don't work on touch devices
 * 3. The button icon may be styled with opacity/color that makes it invisible
 *    or hard to see on iPad without hover
 * 4. No alternative touch-friendly delete mechanism (swipe, long-press, context menu)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/966
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #966: iPad reminder delete button visibility', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #966 - delete button should be visible and accessible on iPad', async () => {
    /**
     * This test verifies that the reminder delete button is visible and has
     * adequate touch target size for iPad users.
     *
     * Current behavior (bug):
     * - Delete button (trash icon) is not visible or accessible on iPad
     * - Users cannot delete reminders in the "Manage All Reminders" modal
     *
     * Expected behavior:
     * - Delete button should be clearly visible without relying on hover states
     * - Delete button should have minimum 44x44px touch target for iOS
     * - Alternative deletion methods should be available (swipe, context menu)
     *
     * Potential fixes:
     * 1. Increase button size to at least 44x44px on touch devices
     * 2. Make trash icon always visible (not just on hover)
     * 3. Add explicit touch event handlers for iOS
     * 4. Add swipe-to-delete functionality on reminder cards
     * 5. Add long-press context menu with delete option
     */
    const page = app.page;

    // First, create a task with a reminder to test deletion
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const taskModal = page.locator('.modal');
    await expect(taskModal).toBeVisible({ timeout: 5000 });

    // Fill in task title
    const titleInput = taskModal.locator('input[placeholder*="title"], input[type="text"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test task for reminder deletion');
    }

    // Look for reminder button/section to add a reminder
    const reminderButton = taskModal.locator('[aria-label*="reminder"], .reminder-btn, button:has(.lucide-bell)').first();

    if (await reminderButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reminderButton.click();
      await page.waitForTimeout(500);

      // Wait for reminder modal/dropdown
      const reminderModal = page.locator('.tasknotes-reminder-modal');

      if (await reminderModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Add a quick reminder
        const quickBtn = reminderModal.locator('.reminder-modal__quick-btn').first();
        if (await quickBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await quickBtn.click();
          await page.waitForTimeout(500);
        }

        // Now we should have a reminder to delete
        // Check if the delete button is visible
        const deleteButton = reminderModal.locator('.reminder-modal__action-btn, .reminder-modal__remove-btn');

        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Get the button's bounding box to check its size
          const buttonBox = await deleteButton.first().boundingBox();

          if (buttonBox) {
            // Apple's Human Interface Guidelines recommend 44x44pt minimum touch targets
            const MIN_TOUCH_TARGET = 44;

            console.log(`Delete button size: ${buttonBox.width}x${buttonBox.height}`);

            // This assertion documents the bug - button is likely too small
            expect(buttonBox.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
            expect(buttonBox.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
          }

          // Check if the button is actually visible (opacity, display, visibility)
          const buttonStyles = await deleteButton.first().evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
              opacity: style.opacity,
              display: style.display,
              visibility: style.visibility,
              color: style.color,
              pointerEvents: style.pointerEvents,
            };
          });

          console.log('Delete button styles:', buttonStyles);

          // Button should be visible without hover
          expect(buttonStyles.opacity).not.toBe('0');
          expect(buttonStyles.display).not.toBe('none');
          expect(buttonStyles.visibility).not.toBe('hidden');
          expect(buttonStyles.pointerEvents).not.toBe('none');
        } else {
          // No delete button visible at all - this is the bug
          console.log('Delete button not found - this is the reported bug');
          expect(deleteButton).toBeVisible();
        }

        // Close reminder modal
        const cancelBtn = reminderModal.locator('.reminder-modal__cancel-btn');
        if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }

    // Close task modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #966 - delete button touch events on iPad', async () => {
    /**
     * This test simulates iPad touch behavior on the delete button
     * to verify touch events are properly handled.
     */
    const page = app.page;

    // Open a task with reminders via the task list
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test');
      return;
    }

    // Open the reminder context menu
    const reminderIcon = taskCard.locator('.task-card__reminder-icon, [aria-label*="reminder"]').first();

    if (await reminderIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reminderIcon.click();
      await page.waitForTimeout(500);

      // Look for "Manage All Reminders" option
      const manageOption = page.locator('.menu-item').filter({ hasText: /manage.*reminder/i });

      if (await manageOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await manageOption.click();
        await page.waitForTimeout(500);

        // Now in the reminder modal
        const reminderModal = page.locator('.tasknotes-reminder-modal');

        if (await reminderModal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Find a delete button
          const deleteButton = reminderModal.locator('.reminder-modal__action-btn').first();

          if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            const box = await deleteButton.boundingBox();

            if (box) {
              // Simulate touch events (iPad behavior)
              await page.evaluate(({ x, y }) => {
                const element = document.elementFromPoint(x, y);
                if (element) {
                  // Dispatch touch events
                  const touchStart = new TouchEvent('touchstart', {
                    bubbles: true,
                    cancelable: true,
                    touches: [new Touch({
                      identifier: 0,
                      target: element,
                      clientX: x,
                      clientY: y,
                    })],
                  });
                  const touchEnd = new TouchEvent('touchend', {
                    bubbles: true,
                    cancelable: true,
                    touches: [],
                    changedTouches: [new Touch({
                      identifier: 0,
                      target: element,
                      clientX: x,
                      clientY: y,
                    })],
                  });

                  element.dispatchEvent(touchStart);
                  element.dispatchEvent(touchEnd);
                }
              }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

              await page.waitForTimeout(500);

              // The button's click handler should have triggered
              // Verify by checking if the reminder was removed or UI updated
            }
          }

          // Close modal
          await page.keyboard.press('Escape');
        }
      } else {
        // Close menu
        await page.keyboard.press('Escape');
      }
    }

    // Close any open views
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #966 - CSS hover dependency issue', async () => {
    /**
     * This test checks if the delete button relies on :hover styles
     * which don't work on touch devices like iPad.
     *
     * The current CSS shows:
     * - Default state: color: var(--text-muted) - may be barely visible
     * - Hover state: color: var(--text-error), background: var(--background-modifier-hover)
     *
     * On iPad, without hover, users see the muted (barely visible) state only.
     */
    const page = app.page;

    // Navigate to a reminder modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const taskModal = page.locator('.modal');
    await expect(taskModal).toBeVisible({ timeout: 5000 });

    // Look for reminder section
    const reminderButton = taskModal.locator('[aria-label*="reminder"], .reminder-btn').first();

    if (await reminderButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reminderButton.click();
      await page.waitForTimeout(500);

      const reminderModal = page.locator('.tasknotes-reminder-modal');

      if (await reminderModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Add a reminder first
        const quickBtn = reminderModal.locator('.reminder-modal__quick-btn').first();
        if (await quickBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await quickBtn.click();
          await page.waitForTimeout(500);
        }

        // Now check the delete button's non-hover state
        const deleteButton = reminderModal.locator('.reminder-modal__action-btn').first();

        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Get computed styles in non-hover state
          const styles = await deleteButton.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              opacity: computed.opacity,
            };
          });

          console.log('Delete button non-hover styles:', styles);

          // The issue is that on iPad, users only see the non-hover state
          // which uses var(--text-muted) color - potentially hard to see
          // or making the icon invisible against certain backgrounds

          // For the fix, the button should be clearly visible without hover
          // by using a more prominent color or adding a visible background

          // This test documents the current (problematic) styles
          // After fix, the button should have adequate contrast in non-hover state
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    }

    // Close task modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #966 - no context menu alternative for deletion', async () => {
    /**
     * This test checks if there's an alternative deletion method via context menu
     * on reminder cards. On iPad, users often rely on context menus (long-press)
     * when small buttons are inaccessible.
     *
     * Expected: Long-pressing on a reminder card should show a context menu
     * with a delete option as an alternative to the small trash button.
     */
    const page = app.page;

    // Navigate to reminder modal with existing reminders
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const taskModal = page.locator('.modal');
    await expect(taskModal).toBeVisible({ timeout: 5000 });

    const reminderButton = taskModal.locator('[aria-label*="reminder"], .reminder-btn').first();

    if (await reminderButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reminderButton.click();
      await page.waitForTimeout(500);

      const reminderModal = page.locator('.tasknotes-reminder-modal');

      if (await reminderModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Add a reminder first
        const quickBtn = reminderModal.locator('.reminder-modal__quick-btn').first();
        if (await quickBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await quickBtn.click();
          await page.waitForTimeout(500);
        }

        // Find a reminder card
        const reminderCard = reminderModal.locator('.reminder-modal__reminder-card').first();

        if (await reminderCard.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Try right-click (context menu) on the reminder card
          await reminderCard.click({ button: 'right' });
          await page.waitForTimeout(500);

          // Check if a context menu appeared with delete option
          const contextMenu = page.locator('.menu');
          const hasContextMenu = await contextMenu.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasContextMenu) {
            const deleteOption = contextMenu.locator('.menu-item').filter({
              hasText: /delete|remove/i
            });

            const hasDeleteOption = await deleteOption.isVisible({ timeout: 500 }).catch(() => false);

            // Currently, there's no context menu on reminder cards
            // This would be a good fix for the iPad accessibility issue
            expect(hasDeleteOption).toBe(true);

            // Close menu
            await page.keyboard.press('Escape');
          } else {
            // No context menu - this is a potential enhancement for iPad users
            console.log('No context menu on reminder card - consider adding for iPad accessibility');
            expect(hasContextMenu).toBe(true);
          }
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    }

    // Close task modal
    await page.keyboard.press('Escape');
  });
});
