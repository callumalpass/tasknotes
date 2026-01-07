/**
 * Issue #1252: Calendar date picker on iPad doesn't let you select a date
 *
 * Bug description: When trying to add a task on iPad, the calendar picker
 * doesn't let the user select a date. Going to the correct month works,
 * but touching/clicking on a date shows the press animation but doesn't
 * actually select the date.
 *
 * This test verifies that touch events properly register date selections
 * on touch devices like iPad.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1252
 */

import { test, expect, devices } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1252: iPad calendar date picker', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1252 - calendar date picker touch events on iPad', async () => {
    /**
     * This test reproduces the iPad calendar date picker bug.
     *
     * The bug manifests when:
     * 1. User opens task creation/edit modal on iPad
     * 2. User opens the date picker (calendar view)
     * 3. User touches a date - animation shows but date is not selected
     *
     * Root cause hypothesis:
     * - The MiniCalendarView only uses "click" event listeners
     * - iOS may require explicit touch event handling (touchstart/touchend)
     * - CSS touch-action property may be preventing touch events
     * - Event stopPropagation() may interfere with iOS touch handling
     *
     * Potential fixes to verify:
     * 1. Add explicit touch event handlers alongside click handlers
     * 2. Add CSS touch-action: manipulation to calendar day elements
     * 3. Remove unnecessary stopPropagation() calls for touch events
     */
    const page = app.page;

    // Emulate iPad touch behavior
    const iPadContext = {
      hasTouch: true,
      isMobile: true,
      viewport: { width: 1024, height: 768 },
    };

    // Open TaskNotes and navigate to create a new task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the date picker trigger (calendar icon button)
    const dateIcon = modal.locator('[aria-label*="date"], .date-icon, button:has(.lucide-calendar)').first();

    if (await dateIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click to open date picker/calendar
      await dateIcon.click();
      await page.waitForTimeout(500);

      // Look for a calendar day element in the mini calendar or date picker
      const calendarDay = page.locator('.mini-calendar-view__day, .calendar-day, [data-date]').first();

      if (await calendarDay.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Simulate touch event (iPad behavior)
        const box = await calendarDay.boundingBox();
        if (box) {
          // Dispatch touch events to simulate iPad touch
          await page.evaluate(({ x, y }) => {
            const element = document.elementFromPoint(x, y);
            if (element) {
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

          await page.waitForTimeout(300);

          // Verify the date was selected
          // The bug is that the date is NOT selected despite visual feedback
          const selectedDay = page.locator('.mini-calendar-view__day--selected, .calendar-day--selected');
          await expect(selectedDay).toBeVisible({ timeout: 2000 });
        }
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1252 - native date input touch on iPad', async () => {
    /**
     * This test checks if the issue is with native <input type="date"> elements
     * on iPad. The DateTimePickerModal uses native date inputs which may have
     * different touch behavior on iOS.
     *
     * On iOS Safari/WebKit, native date inputs open a special date picker
     * UI that requires specific touch handling.
     */
    const page = app.page;

    // Open TaskNotes and navigate to date picker modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Look for a native date input
    const dateInput = modal.locator('input[type="date"]').first();

    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get the input's bounding box
      const box = await dateInput.boundingBox();
      if (box) {
        // Simulate touch on the date input
        await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y) as HTMLInputElement;
          if (element) {
            // Simulate touch sequence
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

            // Also dispatch click as iOS converts touch to click
            element.click();
          }
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

        await page.waitForTimeout(500);

        // The date input should be focused/active
        const isFocused = await dateInput.evaluate((el) => document.activeElement === el);

        // On a real iPad, the date picker would open here
        // We verify that touch events properly focus the input
        expect(isFocused).toBe(true);
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1252 - MiniCalendarView touch-action CSS', async () => {
    /**
     * This test checks if the MiniCalendarView has proper CSS touch-action
     * properties set. Missing touch-action: manipulation can cause touch
     * events to be delayed or not registered on iOS.
     */
    const page = app.page;

    // Navigate to a view that shows the mini calendar
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    // Find the mini calendar view
    const miniCalendar = page.locator('.mini-calendar-view').first();

    if (await miniCalendar.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check touch-action CSS property on calendar day elements
      const dayElements = page.locator('.mini-calendar-view__day');
      const count = await dayElements.count();

      if (count > 0) {
        const firstDay = dayElements.first();

        // Get the computed touch-action style
        const touchAction = await firstDay.evaluate((el) => {
          return window.getComputedStyle(el).touchAction;
        });

        // For proper touch handling on iOS, touch-action should be 'manipulation'
        // or at minimum 'auto'. If it's 'none', touch events won't work.
        // This test documents the current state - if touch-action is problematic,
        // this is likely the cause of issue #1252.
        console.log(`Calendar day touch-action: ${touchAction}`);

        // The fix would ensure touch-action is set appropriately
        // expect(touchAction).toBe('manipulation');
      }
    }

    // Close any open views
    await page.keyboard.press('Escape');
  });
});
