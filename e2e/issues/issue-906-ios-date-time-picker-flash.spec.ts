/**
 * Issue #906: [Bug]: MOBILE IOS - Cannot Schedule Date/Time for Tasks
 *
 * Bug description:
 * When selecting 'Pick date & time' when creating or editing a task on mobile,
 * the system date window quickly flashes and closes. The only option on mobile
 * is to schedule via one of the preset options (i.e. Today; Tomorrow) which
 * in their own right only renders an all-day event.
 *
 * This is specifically about the native iOS date picker that appears when
 * interacting with <input type="date"> elements. The picker opens briefly
 * but immediately closes, preventing the user from selecting a custom date/time.
 *
 * Root cause hypothesis:
 * - iOS Safari's native date picker requires specific touch event handling
 * - The DateTimePickerModal opens but focus management (setTimeout at line 77-79)
 *   may interfere with iOS native picker behavior
 * - Touch events on the date input may be getting intercepted or cancelled
 * - CSS touch-action property may not be set correctly for native inputs on iOS
 * - Modal blur/focus handling may cause the native picker to close
 *
 * Related issues:
 * - #959: iPad date picker vanishes (similar symptom)
 * - #1024: iPhone time picker immediately closes (same root cause)
 * - #1252: iPad calendar date picker touch events don't register
 *
 * Affected code locations:
 * - src/modals/DateTimePickerModal.ts (the modal with date/time inputs)
 * - src/modals/DateTimePickerModal.ts:77-79 (setTimeout focus that may interfere)
 * - src/components/DateContextMenu.ts:111-117 ("Pick date & time" option)
 * - styles/date-picker.css (CSS styling for date inputs)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/906
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #906: iOS date/time picker flashes and closes', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #906 - date picker flashes and closes on iOS when selecting Pick date & time', async () => {
    /**
     * This test reproduces the core bug: when the user taps "Pick date & time"
     * from the date context menu on iOS, the DateTimePickerModal opens but
     * the native date picker immediately flashes and closes when tapped.
     *
     * Steps to reproduce:
     * 1. Open task creation modal
     * 2. Tap the scheduled date button to open DateContextMenu
     * 3. Select "Pick date & time" option
     * 4. DateTimePickerModal opens with date and time inputs
     * 5. Tap the date input to open native iOS date picker
     * 6. BUG: The native picker flashes briefly and closes
     *
     * Expected behavior:
     * - The native iOS date picker should stay open until user makes a selection
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the scheduled date or due date button to open the date context menu
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], [aria-label*="date"], ' +
      'button:has(.lucide-calendar), button:has(.lucide-calendar-days), ' +
      '.due-date-button, .scheduled-date-button'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to open the DateContextMenu
      await dateButton.click();
      await page.waitForTimeout(300);

      // Look for the context menu
      const contextMenu = page.locator('.menu, .context-menu').first();

      if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Find the "Pick date & time" option
        const pickDateOption = contextMenu.locator(
          'text=/pick.*date.*time/i, .menu-item:has-text("Pick date")'
        ).first();

        if (await pickDateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Simulate iOS touch on the "Pick date & time" option
          const optionBox = await pickDateOption.boundingBox();
          if (optionBox) {
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

                if (element instanceof HTMLElement) {
                  element.click();
                }
              }
            }, { x: optionBox.x + optionBox.width / 2, y: optionBox.y + optionBox.height / 2 });

            // Wait for DateTimePickerModal to open
            await page.waitForTimeout(300);

            // Look for the DateTimePickerModal
            const dateTimeModal = page.locator('.date-time-picker-modal').first();

            if (await dateTimeModal.isVisible({ timeout: 2000 }).catch(() => false)) {
              // Find the date input in the modal
              const dateInput = dateTimeModal.locator('input[type="date"]').first();
              await expect(dateInput).toBeVisible({ timeout: 2000 });

              // Get bounding box for touch simulation
              const inputBox = await dateInput.boundingBox();
              if (inputBox) {
                // Simulate iOS touch on the date input
                // This is where the bug manifests - the native picker opens briefly then closes
                await page.evaluate(({ x, y }) => {
                  const element = document.elementFromPoint(x, y) as HTMLInputElement;
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
                    element.click();
                    element.focus();
                  }
                }, { x: inputBox.x + inputBox.width / 2, y: inputBox.y + inputBox.height / 2 });

                await page.waitForTimeout(300);

                // The input should be focused and ready for the native picker
                const isFocused = await dateInput.evaluate((el) => document.activeElement === el);
                expect(isFocused).toBe(true);

                // Verify the DateTimePickerModal stays visible
                await expect(dateTimeModal).toBeVisible();

                // Close the modal
                await page.keyboard.press('Escape');
              }
            }
          }
        }
      }
    }

    // Close any remaining modals
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #906 - focus management interference on iOS', async () => {
    /**
     * This test investigates whether the setTimeout focus pattern in
     * DateTimePickerModal (lines 77-79) interferes with iOS touch behavior.
     *
     * The modal uses:
     *   setTimeout(() => { this.dateInput.focus(); }, 100);
     *
     * On iOS, this delayed focus may:
     * 1. Conflict with native picker opening when user touches the input
     * 2. Cause focus to shift after user interaction, closing the picker
     * 3. Interfere with iOS's touch-to-focus-to-picker flow
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find date button and open context menu
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateButton.click();
      await page.waitForTimeout(300);

      // Click "Pick date & time" if context menu appeared
      const pickDateOption = page.locator('text=/pick.*date/i, .menu-item:has-text("Pick")').first();
      if (await pickDateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await pickDateOption.click();
        await page.waitForTimeout(50); // Quickly try to interact before setTimeout fires
      }
    }

    // Look for the DateTimePickerModal
    const dateTimeModal = page.locator('.date-time-picker-modal').first();

    if (await dateTimeModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try to tap the time input very quickly (within 100ms of modal opening)
      // This simulates a fast user on iOS who wants to pick time, not date
      const timeInput = dateTimeModal.locator('input[type="time"]').first();

      if (await timeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Rapid tap before the setTimeout focus fires
        await timeInput.tap();
        await page.waitForTimeout(50);

        // Check if time input is focused
        let timeIsFocused = await timeInput.evaluate((el) => document.activeElement === el);

        // Wait for the setTimeout (100ms) to fire
        await page.waitForTimeout(100);

        // Check again - did focus shift away from time input to date input?
        const timeStillFocused = await timeInput.evaluate((el) => document.activeElement === el);
        const dateInput = dateTimeModal.locator('input[type="date"]').first();
        const dateIsFocused = await dateInput.evaluate((el) => document.activeElement === el);

        // If focus shifted from time to date, the setTimeout is interfering
        if (timeIsFocused && !timeStillFocused && dateIsFocused) {
          console.log('BUG: Focus was stolen from time input by setTimeout');
        }

        // The time input should retain focus if user tapped it
        expect(timeStillFocused).toBe(true);
      }
    }

    // Close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #906 - CSS touch-action property on date inputs', async () => {
    /**
     * This test checks if date inputs have the proper CSS touch-action property.
     * Missing touch-action: manipulation can cause issues on iOS where:
     * - Touch events are delayed (300ms delay for double-tap zoom detection)
     * - Native pickers may not respond correctly to touch
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Open the date picker modal
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateButton.click();
      await page.waitForTimeout(300);

      const pickDateOption = page.locator('text=/pick.*date/i, .menu-item:has-text("Pick")').first();
      if (await pickDateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await pickDateOption.click();
        await page.waitForTimeout(300);
      }
    }

    // Find the date and time inputs in the DateTimePickerModal
    const dateTimeModal = page.locator('.date-time-picker-modal').first();

    if (await dateTimeModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const dateInput = dateTimeModal.locator('input[type="date"]').first();
      const timeInput = dateTimeModal.locator('input[type="time"]').first();

      if (await dateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Check touch-action CSS property on date input
        const dateTouchAction = await dateInput.evaluate((el) => {
          return window.getComputedStyle(el).touchAction;
        });

        console.log(`Date input touch-action: ${dateTouchAction}`);

        // For proper iOS touch handling, touch-action should be 'manipulation'
        expect(dateTouchAction).toBe('manipulation');
      }

      if (await timeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Check touch-action CSS property on time input
        const timeTouchAction = await timeInput.evaluate((el) => {
          return window.getComputedStyle(el).touchAction;
        });

        console.log(`Time input touch-action: ${timeTouchAction}`);

        // For proper iOS touch handling, touch-action should be 'manipulation'
        expect(timeTouchAction).toBe('manipulation');
      }
    }

    // Close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #906 - preset options work but custom date does not', async () => {
    /**
     * This test documents the workaround mentioned in the bug report:
     * The preset options (Today, Tomorrow) work on iOS, but "Pick date & time"
     * does not. This confirms the issue is specific to the DateTimePickerModal
     * with native date inputs, not the DateContextMenu itself.
     *
     * Expected:
     * - Selecting "Today" from menu should work (sets all-day event)
     * - Selecting "Tomorrow" from menu should work (sets all-day event)
     * - Selecting "Pick date & time" should allow custom date/time selection (BUG: fails)
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find date button
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Test 1: Verify "Today" preset option works
      await dateButton.click();
      await page.waitForTimeout(300);

      const todayOption = page.locator('.menu-item:has-text("Today"), text=/^Today$/').first();
      if (await todayOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Simulate iOS touch
        await todayOption.tap();
        await page.waitForTimeout(300);

        // Menu should close - preset worked
        const menu = page.locator('.menu, .context-menu').first();
        const menuVisible = await menu.isVisible().catch(() => false);
        expect(menuVisible).toBe(false); // Menu should have closed after selection

        console.log('Preset option "Today" works on iOS');
      }

      // Test 2: Open menu again and try "Pick date & time"
      await dateButton.click();
      await page.waitForTimeout(300);

      const pickDateOption = page.locator('text=/pick.*date.*time/i, .menu-item:has-text("Pick")').first();
      if (await pickDateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pickDateOption.tap();
        await page.waitForTimeout(300);

        // DateTimePickerModal should open
        const dateTimeModal = page.locator('.date-time-picker-modal').first();
        const modalVisible = await dateTimeModal.isVisible({ timeout: 2000 }).catch(() => false);

        if (modalVisible) {
          // Find and try to interact with date input
          const dateInput = dateTimeModal.locator('input[type="date"]').first();

          if (await dateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Simulate iOS touch on date input
            await dateInput.tap();
            await page.waitForTimeout(300);

            // The input should be focused
            const isFocused = await dateInput.evaluate((el) => document.activeElement === el);

            // BUG: On real iOS, the native picker opens briefly but closes immediately
            // This test documents the expected behavior vs actual behavior
            expect(isFocused).toBe(true);

            // Try to set a value (simulating what happens after user picks a date)
            await dateInput.fill('2025-12-25');
            const value = await dateInput.inputValue();
            expect(value).toBe('2025-12-25');

            console.log('Custom date/time picker test completed');
          }

          // Close the DateTimePickerModal
          await page.keyboard.press('Escape');
        }
      }
    }

    // Close any remaining modals
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #906 - modal blur event handling on iOS', async () => {
    /**
     * This test investigates whether blur events on the modal or its elements
     * are causing the native date picker to close on iOS.
     *
     * On iOS, the native date picker may:
     * 1. Trigger blur events when it opens (focus moves to picker)
     * 2. Be closed by modal's focus management responding to blur
     * 3. Be affected by event propagation stopping the native picker
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Open the date picker modal
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateButton.click();
      await page.waitForTimeout(300);

      const pickDateOption = page.locator('text=/pick.*date/i, .menu-item:has-text("Pick")').first();
      if (await pickDateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await pickDateOption.click();
        await page.waitForTimeout(300);
      }
    }

    // Find the DateTimePickerModal
    const dateTimeModal = page.locator('.date-time-picker-modal').first();

    if (await dateTimeModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Add event listeners to track blur/focus events
      await page.evaluate(() => {
        const events: string[] = [];
        (window as any).__issue906Events = events;

        document.addEventListener('blur', (e) => {
          const target = e.target as Element;
          if (target?.tagName) {
            events.push(`blur: ${target.tagName}${target.className ? '.' + target.className : ''}`);
          }
        }, true);

        document.addEventListener('focus', (e) => {
          const target = e.target as Element;
          if (target?.tagName) {
            events.push(`focus: ${target.tagName}${target.className ? '.' + target.className : ''}`);
          }
        }, true);

        document.addEventListener('focusout', (e) => {
          const target = e.target as Element;
          if (target?.tagName) {
            events.push(`focusout: ${target.tagName}${target.className ? '.' + target.className : ''}`);
          }
        }, true);
      });

      // Find and tap the date input
      const dateInput = dateTimeModal.locator('input[type="date"]').first();

      if (await dateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dateInput.tap();
        await page.waitForTimeout(500);

        // Get the captured events
        const events = await page.evaluate(() => (window as any).__issue906Events);
        console.log('Focus/blur events during date input interaction:', events);

        // Check if any problematic event sequence occurred
        // Looking for patterns like: focus input -> blur input (too quickly)
        const hasRapidBlur = events.some((e: string, i: number) => {
          if (e.includes('focus') && events[i + 1]?.includes('blur')) {
            return true;
          }
          return false;
        });

        if (hasRapidBlur) {
          console.log('WARNING: Rapid focus->blur sequence detected - may cause picker to close');
        }
      }

      // Cleanup
      await page.evaluate(() => {
        delete (window as any).__issue906Events;
      });
    }

    // Close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });
});
