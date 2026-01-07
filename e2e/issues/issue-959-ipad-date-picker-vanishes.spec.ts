/**
 * Issue #959: [Bug]: iPad specific issue with date picker
 *
 * Bug description:
 * When creating a task note and trying to schedule a due date, the user goes to
 * "custom date" and the month view pops up but immediately vanishes before the
 * user can enter a date. This happens consistently after closing and reopening
 * the app. This is on iPad OS with the most recent version of Obsidian and the plugin.
 *
 * This is distinct from issue #1252 (touch events not registering) - in this bug,
 * the calendar popup disappears entirely rather than staying visible with
 * non-responsive touch events.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/959
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #959: iPad date picker immediately vanishes', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #959 - date picker popup vanishes on iPad', async () => {
    /**
     * This test reproduces the iPad date picker vanishing bug.
     *
     * The bug manifests when:
     * 1. User creates a task note on iPad
     * 2. User taps on "custom date" to set a due date
     * 3. The calendar/month view popup appears briefly
     * 4. The popup immediately vanishes before user can select a date
     *
     * Root cause hypothesis:
     * - Touch events may be triggering an immediate close of the popup
     * - Focus management (blur events) may be closing the popup prematurely
     * - The popup may be responding to a touchend event as a "click away" to close
     * - iOS/iPadOS touch event sequence (touchstart -> touchend -> click) may be
     *   interpreted as both opening AND closing the popup
     * - CSS touch-action or pointer-events may affect how touch is handled
     *
     * Related issues:
     * - #1024: iPhone time picker immediately closes (similar symptom)
     * - #1252: iPad calendar date picker touch events don't register (different symptom)
     *
     * Affected code locations (to investigate):
     * - src/components/DateContextMenu.ts (handles date picker menu display)
     * - src/modals/DateTimePickerModal.ts (the modal with date/time inputs)
     * - src/components/ContextMenu.ts (base context menu behavior)
     * - Any blur/focus event handlers that may close popups
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the due date or scheduled date button/icon to open date picker
    // The DateContextMenu is typically triggered by clicking a calendar icon
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], [aria-label*="date"], ' +
      'button:has(.lucide-calendar), button:has(.lucide-calendar-days), ' +
      '.due-date-button, .scheduled-date-button'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get bounding box for touch simulation
      const buttonBox = await dateButton.boundingBox();
      if (buttonBox) {
        // Simulate iPad touch to open the date picker
        await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          if (element) {
            // Simulate complete touch sequence as iPad would
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

            // iOS also fires click after touch sequence
            if (element instanceof HTMLElement) {
              element.click();
            }
          }
        }, { x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2 });

        // Wait briefly for the date picker to appear
        await page.waitForTimeout(300);

        // Check if a date picker menu/popup appeared
        // This could be the DateContextMenu (Obsidian Menu) or DateTimePickerModal
        const datePicker = page.locator(
          '.menu, .context-menu, .date-time-picker-modal, .suggestion-container, ' +
          '[class*="date-picker"], [class*="calendar"]'
        ).first();

        // The bug is that this popup vanishes immediately
        // If the bug is present, this assertion will fail because the popup is gone
        await expect(datePicker).toBeVisible({ timeout: 2000 });

        // If visible, verify it stays visible for a reasonable time
        await page.waitForTimeout(500);
        await expect(datePicker).toBeVisible();
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #959 - custom date option triggers vanishing popup', async () => {
    /**
     * This test specifically targets the "custom date" flow mentioned in the bug report.
     *
     * The user reports: "try to schedule a due date I go to custom date and
     * the month view pops up but immediately vanishes"
     *
     * This suggests:
     * 1. First tap opens a date context menu with options
     * 2. User taps "Custom date" or "Pick date & time" option
     * 3. A modal or picker opens showing the month view
     * 4. That modal/picker immediately vanishes
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find date button and click to open context menu
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // First click to open the DateContextMenu
      await dateButton.click();
      await page.waitForTimeout(300);

      // Look for the context menu with date options
      const contextMenu = page.locator('.menu, .context-menu').first();

      if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Find the "Pick date & time" or "Custom date" option
        // This is the option that opens the DateTimePickerModal
        const customDateOption = contextMenu.locator(
          'text=/pick.*date|custom.*date/i, .menu-item:has-text("Pick")'
        ).first();

        if (await customDateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Get bounding box for touch simulation
          const optionBox = await customDateOption.boundingBox();
          if (optionBox) {
            // Simulate iPad touch on the custom date option
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

            // Wait for the DateTimePickerModal to appear
            await page.waitForTimeout(300);

            // Look for the date picker modal with the month view
            const datePickerModal = page.locator(
              '.date-time-picker-modal, .modal:has(input[type="date"])'
            ).first();

            // The bug is that this modal appears briefly but immediately vanishes
            // This test documents the expected behavior - the modal should stay visible
            await expect(datePickerModal).toBeVisible({ timeout: 2000 });

            // Verify it stays visible
            await page.waitForTimeout(500);
            await expect(datePickerModal).toBeVisible();

            // Look for the date input (the "month view" mentioned in the bug)
            const dateInput = datePickerModal.locator('input[type="date"]');
            await expect(dateInput).toBeVisible();

            // Close the picker modal
            await page.keyboard.press('Escape');
          }
        }
      }
    }

    // Close main modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #959 - blur event may close popup prematurely on iPad', async () => {
    /**
     * This test investigates whether blur events are causing the popup to close.
     *
     * On iPad, touch interactions may trigger blur events on parent elements,
     * which could cause popups to close immediately after opening.
     *
     * The sequence might be:
     * 1. touchstart on button - focus moves to button
     * 2. Popup opens
     * 3. touchend fires
     * 4. Browser focuses the popup or its contents
     * 5. Button blur event fires
     * 6. Blur handler closes the popup
     *
     * Or the popup itself may have blur handlers that close it when focus
     * moves away, and iPad touch behavior triggers unexpected focus changes.
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
      // Add event listeners to track blur/focus events
      await page.evaluate(() => {
        const events: string[] = [];
        (window as any).__datePickerEvents = events;

        document.addEventListener('blur', (e) => {
          events.push(`blur: ${(e.target as Element)?.tagName || 'unknown'}`);
        }, true);

        document.addEventListener('focus', (e) => {
          events.push(`focus: ${(e.target as Element)?.tagName || 'unknown'}`);
        }, true);

        document.addEventListener('focusout', (e) => {
          events.push(`focusout: ${(e.target as Element)?.tagName || 'unknown'}`);
        }, true);
      });

      // Simulate touch to open date picker
      await dateButton.tap();
      await page.waitForTimeout(500);

      // Get the captured events
      const events = await page.evaluate(() => (window as any).__datePickerEvents);
      console.log('Focus/blur events during date picker interaction:', events);

      // Check if any popup is visible
      const popup = page.locator('.menu, .context-menu, .date-time-picker-modal').first();
      const isVisible = await popup.isVisible().catch(() => false);

      // The test documents what happens - if blur events close the popup,
      // the events array will show the sequence that caused it
      if (!isVisible) {
        console.log('Popup not visible - blur events may have closed it');
        console.log('Event sequence:', events.join(' -> '));
      }

      // Clean up
      await page.evaluate(() => {
        delete (window as any).__datePickerEvents;
      });
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #959 - native date input behavior on iPad', async () => {
    /**
     * This test checks how native date inputs behave on iPad.
     *
     * On iPad, input[type="date"] opens a native date picker UI.
     * The bug report mentions "month view" which could refer to either:
     * 1. A custom calendar component in the plugin
     * 2. The native iOS date picker showing the month view
     *
     * If the native date picker is involved, the issue might be:
     * - iOS date picker opens but immediately closes due to focus/blur
     * - Touch events are not properly handled for native inputs
     * - Event listeners on the modal are interfering with native picker
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Try to open the date picker modal first (to access native date input)
    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateButton.click();
      await page.waitForTimeout(300);

      // Click "Pick date & time" if context menu appeared
      const pickDateOption = page.locator('.menu-item:has-text("Pick"), text=/pick.*date/i').first();
      if (await pickDateOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await pickDateOption.click();
        await page.waitForTimeout(300);
      }
    }

    // Look for native date input
    const dateInput = page.locator('input[type="date"]').first();

    if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Simulate iPad touch on the date input
      const box = await dateInput.boundingBox();
      if (box) {
        await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y) as HTMLInputElement;
          if (element) {
            // Full touch sequence
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
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

        await page.waitForTimeout(500);

        // Check if the input is focused (on real iPad, native picker would open)
        const isFocused = await dateInput.evaluate((el) => document.activeElement === el);

        // The input should maintain focus, allowing the native picker to work
        expect(isFocused).toBe(true);

        // Verify the modal containing the input is still visible
        const parentModal = page.locator('.date-time-picker-modal, .modal:has(input[type="date"])').first();
        await expect(parentModal).toBeVisible();
      }
    }

    // Close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #959 - rapid touch sequence simulation', async () => {
    /**
     * This test simulates the rapid touch sequence that might occur on iPad,
     * where touchstart, touchend, and click fire in quick succession.
     *
     * The bug might occur if:
     * - The same touch is interpreted as both opening and closing the popup
     * - Touch event propagation causes the popup to open then immediately close
     * - The popup opens but a secondary event (like mousedown) closes it
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const dateButton = modal.locator(
      '[aria-label*="due"], [aria-label*="schedule"], button:has(.lucide-calendar)'
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await dateButton.boundingBox();
      if (box) {
        // Simulate the full iPad event sequence
        await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          if (!element) return;

          // Track if popup opened
          let popupOpened = false;
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                  if (node instanceof Element &&
                      (node.classList.contains('menu') ||
                       node.classList.contains('context-menu') ||
                       node.classList.contains('date-time-picker-modal'))) {
                    popupOpened = true;
                    console.log('Popup opened at:', Date.now());
                  }
                });
                mutation.removedNodes.forEach((node) => {
                  if (popupOpened && node instanceof Element &&
                      (node.classList.contains('menu') ||
                       node.classList.contains('context-menu') ||
                       node.classList.contains('date-time-picker-modal'))) {
                    console.log('Popup removed at:', Date.now(), '- BUG REPRODUCED');
                  }
                });
              }
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          (window as any).__popupObserver = observer;

          // Simulate the iPad touch event sequence with realistic timing
          const now = Date.now();
          console.log('Touch sequence start:', now);

          // 1. touchstart
          element.dispatchEvent(new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [new Touch({
              identifier: 0,
              target: element,
              clientX: x,
              clientY: y,
            })],
          }));

          // 2. touchend (typical delay ~50-100ms)
          setTimeout(() => {
            console.log('touchend at:', Date.now());
            element.dispatchEvent(new TouchEvent('touchend', {
              bubbles: true,
              cancelable: true,
              touches: [],
              changedTouches: [new Touch({
                identifier: 0,
                target: element,
                clientX: x,
                clientY: y,
              })],
            }));
          }, 50);

          // 3. click (follows touchend by ~0-50ms on iOS)
          setTimeout(() => {
            console.log('click at:', Date.now());
            if (element instanceof HTMLElement) {
              element.click();
            }
          }, 80);

        }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

        // Wait for the sequence to complete
        await page.waitForTimeout(500);

        // Check if popup is visible
        const popup = page.locator('.menu, .context-menu, .date-time-picker-modal').first();
        const isVisible = await popup.isVisible().catch(() => false);

        // The bug is that the popup should be visible but vanishes
        expect(isVisible).toBe(true);

        // Cleanup observer
        await page.evaluate(() => {
          if ((window as any).__popupObserver) {
            (window as any).__popupObserver.disconnect();
            delete (window as any).__popupObserver;
          }
        });
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });
});
