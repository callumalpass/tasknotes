/**
 * Issue #1024: [Bug]: Can't change scheduled time when creating a task on my iPhone
 *
 * Bug description:
 * When trying to create a task on iPhone and trying to select a time, it immediately
 * exits out so the user can't select a time (other than the default). The time picker
 * opens but closes immediately before the user can make a selection.
 *
 * This appears to be an iOS-specific issue with native <input type="time"> elements
 * and/or touch event handling. Similar to issue #1252 (iPad calendar date picker).
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1024
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1024: iPhone scheduled time picker immediately closes', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1024 - time input immediately closes on iPhone touch', async () => {
    /**
     * This test reproduces the iPhone scheduled time picker bug.
     *
     * The bug manifests when:
     * 1. User opens task creation modal on iPhone
     * 2. User taps the time input field to select a scheduled time
     * 3. The native iOS time picker opens briefly but immediately closes
     * 4. User cannot select any time other than the default
     *
     * Root cause hypothesis:
     * - iOS Safari's native time picker requires specific touch event handling
     * - The modal or surrounding elements may be capturing/preventing touch events
     * - Focus management (setTimeout focus patterns) may conflict with iOS time picker
     * - CSS touch-action property may be interfering with native input behavior
     * - Event propagation (stopPropagation) may prevent iOS from keeping the picker open
     *
     * Related issues:
     * - #1252: iPad calendar date picker doesn't work (similar root cause)
     * - #1035: iPhone title click scroll jump (iOS focus behavior)
     *
     * Potential fixes to investigate:
     * 1. Add touch-action: manipulation to time input elements
     * 2. Remove setTimeout focus patterns that may conflict with iOS
     * 3. Ensure click/touch events aren't being prevented or stopped
     * 4. Consider using a custom time picker for iOS instead of native input
     */
    const page = app.page;

    // Emulate iPhone viewport and touch behavior
    const iPhoneViewport = {
      width: 390,  // iPhone 14 width
      height: 844, // iPhone 14 height
    };

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the time input element (used in ScheduledDateModal, DateTimePickerModal, etc.)
    // The time input has type="time" and class modal-form__input--time
    const timeInput = modal.locator('input[type="time"]').first();

    // If time input isn't directly visible, we may need to open the scheduled date section first
    if (!await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Look for scheduled date/calendar button to open the date picker modal
      const scheduledButton = modal.locator(
        '[aria-label*="schedule"], [aria-label*="calendar"], button:has(.lucide-calendar), .scheduled-date-button'
      ).first();

      if (await scheduledButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await scheduledButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Now try to find the time input again
    const timeInputAfterOpen = page.locator('input[type="time"]').first();

    if (await timeInputAfterOpen.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get the input's current value
      const initialValue = await timeInputAfterOpen.inputValue();

      // Simulate iPhone touch on the time input
      const box = await timeInputAfterOpen.boundingBox();
      if (box) {
        // Dispatch touch events to simulate iPhone touch
        await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y) as HTMLInputElement;
          if (element) {
            // Simulate touch start
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

            // Simulate touch end
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
            element.focus();
          }
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

        await page.waitForTimeout(300);

        // The time input should be focused and ready for input
        const isFocused = await timeInputAfterOpen.evaluate((el) => document.activeElement === el);

        // On a real iPhone, the time picker would be open at this point
        // The bug is that it immediately closes, preventing time selection
        // We verify that the input received focus (the picker should stay open)
        expect(isFocused).toBe(true);

        // Try to change the time value (simulating what should happen after picker selection)
        // On iPhone, this would be done via the native picker UI
        await timeInputAfterOpen.fill('14:30');
        await page.waitForTimeout(200);

        // Verify the value was set (if the picker stayed open, this should work)
        const newValue = await timeInputAfterOpen.inputValue();
        expect(newValue).toBe('14:30');
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1024 - time input touch-action CSS', async () => {
    /**
     * This test checks if time inputs have proper CSS touch-action properties.
     * Missing touch-action: manipulation can cause touch events to be delayed
     * or native pickers to behave incorrectly on iOS.
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for modal
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Try to find time input (may need to open scheduled section first)
    let timeInput = modal.locator('input[type="time"]').first();

    if (!await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const scheduledButton = modal.locator(
        '[aria-label*="schedule"], [aria-label*="calendar"], button:has(.lucide-calendar)'
      ).first();

      if (await scheduledButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await scheduledButton.click();
        await page.waitForTimeout(500);
        timeInput = page.locator('input[type="time"]').first();
      }
    }

    if (await timeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check touch-action CSS property
      const touchAction = await timeInput.evaluate((el) => {
        return window.getComputedStyle(el).touchAction;
      });

      console.log(`Time input touch-action: ${touchAction}`);

      // For proper touch handling on iOS, touch-action should be 'manipulation'
      // to prevent double-tap zoom and allow immediate response to taps.
      // This test documents the expectation - if touch-action is 'auto' or unset,
      // iOS may delay touch events or handle them incorrectly.
      //
      // The fix would add: touch-action: manipulation; to time inputs
      expect(touchAction).toBe('manipulation');
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1024 - ScheduledDateModal time input on iPhone', async () => {
    /**
     * This test specifically targets the ScheduledDateModal which contains
     * the time input that users interact with when setting a scheduled time.
     *
     * The modal uses native <input type="time"> elements (lines 67-75 of
     * ScheduledDateModal.ts) and has a setTimeout focus pattern (line 95)
     * that may interfere with iOS touch behavior.
     *
     * Affected code locations:
     * - src/modals/ScheduledDateModal.ts:67-75 (time input creation)
     * - src/modals/ScheduledDateModal.ts:95 (focus with 100ms delay)
     * - src/modals/DueDateModal.ts (similar pattern)
     * - src/modals/DateTimePickerModal.ts:48-52 (time input)
     */
    const page = app.page;

    // Open task list view first to have tasks available
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task to edit (to open ScheduledDateModal)
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      // No tasks - create one first
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Just check for time input in creation modal
        const timeInput = modal.locator('input[type="time"]').first();

        if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Simulate touch interaction
          await timeInput.tap();
          await page.waitForTimeout(300);

          // Check if input is properly focused
          const isFocused = await timeInput.evaluate((el) => document.activeElement === el);
          expect(isFocused).toBe(true);
        }
      }

      await page.keyboard.press('Escape');
      return;
    }

    // Click on task to open edit modal
    await taskCard.click();
    await page.waitForTimeout(500);

    // Look for scheduled date button in the task modal
    const scheduledBtn = page.locator(
      '.task-modal [aria-label*="scheduled"], .task-modal .scheduled-date-button, .task-modal button:has(.lucide-calendar-clock)'
    ).first();

    if (await scheduledBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scheduledBtn.click();
      await page.waitForTimeout(500);

      // ScheduledDateModal should now be open
      const scheduledModal = page.locator('.modal').last();
      await expect(scheduledModal).toBeVisible({ timeout: 3000 });

      // Find the time input in the scheduled date modal
      const timeInput = scheduledModal.locator('input[type="time"], .modal-form__input--time').first();

      if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Get bounding box for touch simulation
        const box = await timeInput.boundingBox();
        if (box) {
          // Simulate iPhone touch
          await page.evaluate(({ x, y }) => {
            const element = document.elementFromPoint(x, y) as HTMLInputElement;
            if (element) {
              // Touch sequence
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
              element.click();
            }
          }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

          await page.waitForTimeout(500);

          // The time input should be interactable - the bug is that on iPhone
          // the native time picker immediately closes after opening
          const isFocused = await timeInput.evaluate((el) => document.activeElement === el);

          // Document the expected behavior
          // When fixed, user should be able to interact with the time picker
          expect(isFocused).toBe(true);
        }
      }
    }

    // Close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1024 - focus management interferes with iOS time picker', async () => {
    /**
     * This test investigates whether the setTimeout focus patterns used in
     * the codebase interfere with iOS native time picker behavior.
     *
     * The ScheduledDateModal (line 95) uses:
     *   window.setTimeout(() => this.scheduledDateInput.focus(), 100);
     *
     * This delayed focus on the DATE input may cause the TIME picker to close
     * if the user taps on the time input within that 100ms window, or the
     * focus shift may trigger iOS to close any open native pickers.
     *
     * Similar patterns exist in:
     * - TaskModal.ts:1680-1685 (focusTitleInput with 100ms delay)
     * - DueDateModal.ts (same pattern as ScheduledDateModal)
     */
    const page = app.page;

    // Open task creation
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check if there's a scheduled date section or need to open it
    const scheduledButton = modal.locator(
      '[aria-label*="schedule"], [aria-label*="calendar"], button:has(.lucide-calendar)'
    ).first();

    if (await scheduledButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scheduledButton.click();
      await page.waitForTimeout(100); // Immediately try to interact

      // Try to tap time input very quickly (within the 100ms focus delay)
      const timeInput = page.locator('input[type="time"]').first();

      if (await timeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Rapid tap - this simulates a user quickly tapping the time input
        // The bug may occur because the delayed focus steals focus away
        await timeInput.tap();

        // Wait briefly
        await page.waitForTimeout(50);

        // Check if time input is still focused
        const stillFocused = await timeInput.evaluate((el) => document.activeElement === el);

        // After the 100ms focus delay fires, check again
        await page.waitForTimeout(100);
        const focusedAfterDelay = await timeInput.evaluate((el) => document.activeElement === el);

        // The bug is that focus may have been stolen by the delayed focus callback
        // If this test fails, the focus management is interfering with user interaction
        expect(focusedAfterDelay).toBe(true);
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });
});
