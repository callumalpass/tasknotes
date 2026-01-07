/**
 * Issue #979: [Bug] Drag and drop broken in advanced calendar view in new window
 *
 * Bug description:
 * Drag and drop doesn't work in the advanced calendar view when opened in a new
 * (pop-out) window. When hovering the mouse over a task, the user can't grab it
 * and move it anywhere. The drag operation is completely non-functional.
 *
 * Root cause analysis:
 * FullCalendar's interaction plugin (responsible for drag and drop) likely uses
 * global `document` and `window` references for event listening. When the calendar
 * view is opened in a pop-out window, these references still point to the main
 * window's document instead of the pop-out window's document, causing drag events
 * to not be captured.
 *
 * The codebase already uses `containerEl.ownerDocument` for some operations to
 * support pop-out windows (see CalendarView.ts:278, 1588, 1862, 1883), but the
 * FullCalendar library itself may not be receiving the correct document context
 * during initialization.
 *
 * Expected behavior:
 * - In pop-out window: Events should be draggable just like in the main window
 * - Hovering over events should show grab cursor
 * - Dragging events should update their start/end times
 *
 * @see https://github.com/callumalpass/tasknotes/issues/979
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #979: Drag and drop broken in advanced calendar view in new window', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #979 - drag and drop should work in calendar view in pop-out window',
    async () => {
      /**
       * This test reproduces the core bug: drag and drop doesn't work when the
       * calendar view is opened in a pop-out (new) window.
       *
       * Steps to reproduce:
       * 1. Open the advanced calendar view
       * 2. Pop out the calendar view into a new window
       * 3. Switch to week view (timeGridWeek) to see events with times
       * 4. Try to drag an existing event to a new time slot
       * 5. Verify the event can be grabbed and moved
       *
       * Current behavior: Events cannot be grabbed/dragged in pop-out window
       * Expected behavior: Events should be draggable just like in main window
       */
      const page = app.page;

      // Open the calendar view in the main window first
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view which shows events in time slots
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Now we need to pop out the calendar view into a new window
      // In Obsidian, you can right-click on a tab and select "Move to new window"
      // Or use the command palette

      // Find the tab for the calendar view
      const calendarTab = page.locator('.workspace-tab-header:has-text("Calendar")');
      if (await calendarTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Right-click to open context menu
        await calendarTab.click({ button: 'right' });
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

            // Verify calendar is visible in pop-out window
            const popoutCalendar = popoutPage.locator('.fc');
            await expect(popoutCalendar).toBeVisible({ timeout: 10000 });

            // Verify we're in time grid view
            const timeGrid = popoutPage.locator('.fc-timegrid-body, .fc-timegrid');
            await expect(timeGrid).toBeVisible({ timeout: 5000 });

            // Find events in the calendar
            const events = popoutPage.locator('.fc-event');
            const eventCount = await events.count();

            if (eventCount > 0) {
              // Try to drag the first event
              const firstEvent = events.first();
              const eventBox = await firstEvent.boundingBox();

              if (eventBox) {
                // Check if cursor changes to grab on hover
                await popoutPage.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2);
                await popoutPage.waitForTimeout(200);

                // Get computed cursor style - should be 'grab' or 'pointer' for draggable elements
                const cursor = await firstEvent.evaluate((el) => window.getComputedStyle(el).cursor);

                // The bug manifests as the cursor not changing to grab/pointer
                // or the drag operation not working
                console.log(`Event cursor style: ${cursor}`);

                // Try to perform a drag operation
                const startX = eventBox.x + eventBox.width / 2;
                const startY = eventBox.y + eventBox.height / 2;
                const endY = startY + 100; // Drag down by 100px

                // Store original event position/time before drag
                const originalTop = eventBox.y;

                await popoutPage.mouse.move(startX, startY);
                await popoutPage.mouse.down();
                await popoutPage.waitForTimeout(100);
                await popoutPage.mouse.move(startX, endY, { steps: 10 });
                await popoutPage.waitForTimeout(100);
                await popoutPage.mouse.up();

                await popoutPage.waitForTimeout(500);

                // Check if the event moved (its position should have changed)
                const newEventBox = await firstEvent.boundingBox();

                // The bug: In pop-out window, the event won't move
                // Expected: Event position should change after drag
                if (newEventBox) {
                  const eventMoved = Math.abs(newEventBox.y - originalTop) > 10;
                  expect(eventMoved).toBe(true);
                }
              }
            } else {
              // If no events exist, test drag-to-create instead
              const timeSlots = popoutPage.locator('.fc-timegrid-slot-lane');
              const slotCount = await timeSlots.count();

              if (slotCount >= 4) {
                const firstSlot = timeSlots.nth(4);
                const slotBox = await firstSlot.boundingBox();

                if (slotBox) {
                  const startX = slotBox.x + slotBox.width / 2;
                  const startY = slotBox.y + slotBox.height / 2;
                  const endY = startY + slotBox.height * 4;

                  // Drag to select time range
                  await popoutPage.mouse.move(startX, startY);
                  await popoutPage.mouse.down();
                  await popoutPage.waitForTimeout(100);
                  await popoutPage.mouse.move(startX, endY, { steps: 10 });
                  await popoutPage.waitForTimeout(100);
                  await popoutPage.mouse.up();

                  await popoutPage.waitForTimeout(500);

                  // Check if selection highlight or menu appears
                  const selectionHighlight = popoutPage.locator('.fc-highlight, .fc-event-mirror');
                  const menu = popoutPage.locator('.menu');

                  const hasHighlight = await selectionHighlight.isVisible({ timeout: 1000 }).catch(() => false);
                  const hasMenu = await menu.isVisible({ timeout: 1000 }).catch(() => false);

                  // The bug: Drag interaction doesn't work in pop-out window
                  expect(hasHighlight || hasMenu).toBe(true);

                  await popoutPage.keyboard.press('Escape');
                }
              }
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
    'reproduces issue #979 - event hover should show grab cursor in pop-out window',
    async () => {
      /**
       * This test specifically checks that the drag cursor appears when
       * hovering over events in a pop-out window.
       *
       * The bug may manifest as:
       * - No cursor change on event hover in pop-out window
       * - Cursor stays as default/pointer instead of grab
       */
      const page = app.page;

      // Open and pop out the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Pop out the view
      const calendarTab = page.locator('.workspace-tab-header:has-text("Calendar")');
      if (await calendarTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await calendarTab.click({ button: 'right' });
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

            const popoutCalendar = popoutPage.locator('.fc');
            await expect(popoutCalendar).toBeVisible({ timeout: 10000 });

            // Find events
            const events = popoutPage.locator('.fc-event');
            const eventCount = await events.count();

            if (eventCount > 0) {
              const firstEvent = events.first();
              const eventBox = await firstEvent.boundingBox();

              if (eventBox) {
                // Hover over the event
                await popoutPage.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2);
                await popoutPage.waitForTimeout(300);

                // Check cursor style
                const cursor = await firstEvent.evaluate((el) => {
                  return window.getComputedStyle(el).cursor;
                });

                // In a working calendar, cursor should be 'grab', 'pointer', or 'move'
                // The bug: cursor may remain 'default' or 'auto' in pop-out window
                const isDraggableCursor = ['grab', 'pointer', 'move', '-webkit-grab'].includes(cursor);
                expect(isDraggableCursor).toBe(true);
              }
            }

            await popoutPage.close();
          }
        }
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #979 - compare drag behavior in main window vs pop-out window',
    async () => {
      /**
       * This test compares drag and drop behavior between the main window
       * and the pop-out window to demonstrate the difference.
       *
       * Expected:
       * - Main window: Drag and drop works correctly
       * - Pop-out window: Drag and drop doesn't work (the bug)
       */
      const page = app.page;

      // Test in main window first
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Test drag-to-select in main window
      const timeSlots = page.locator('.fc-timegrid-slot-lane');
      let mainWindowDragWorks = false;

      if (await timeSlots.count() >= 4) {
        const slot = timeSlots.nth(4);
        const slotBox = await slot.boundingBox();

        if (slotBox) {
          const startX = slotBox.x + slotBox.width / 2;
          const startY = slotBox.y + slotBox.height / 2;
          const endY = startY + slotBox.height * 4;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Check if selection/menu appeared
          const highlight = page.locator('.fc-highlight, .fc-event-mirror');
          const menu = page.locator('.menu');

          mainWindowDragWorks = await highlight.isVisible({ timeout: 1000 }).catch(() => false) ||
                               await menu.isVisible({ timeout: 1000 }).catch(() => false);

          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }

      console.log(`Main window drag works: ${mainWindowDragWorks}`);

      // Now test in pop-out window
      const calendarTab = page.locator('.workspace-tab-header:has-text("Calendar")');
      let popoutWindowDragWorks = false;

      if (await calendarTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await calendarTab.click({ button: 'right' });
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

            const popoutCalendar = popoutPage.locator('.fc');
            await expect(popoutCalendar).toBeVisible({ timeout: 10000 });

            const popoutTimeSlots = popoutPage.locator('.fc-timegrid-slot-lane');

            if (await popoutTimeSlots.count() >= 4) {
              const slot = popoutTimeSlots.nth(4);
              const slotBox = await slot.boundingBox();

              if (slotBox) {
                const startX = slotBox.x + slotBox.width / 2;
                const startY = slotBox.y + slotBox.height / 2;
                const endY = startY + slotBox.height * 4;

                await popoutPage.mouse.move(startX, startY);
                await popoutPage.mouse.down();
                await popoutPage.waitForTimeout(100);
                await popoutPage.mouse.move(startX, endY, { steps: 10 });
                await popoutPage.waitForTimeout(100);
                await popoutPage.mouse.up();

                await popoutPage.waitForTimeout(500);

                const highlight = popoutPage.locator('.fc-highlight, .fc-event-mirror');
                const menu = popoutPage.locator('.menu');

                popoutWindowDragWorks = await highlight.isVisible({ timeout: 1000 }).catch(() => false) ||
                                        await menu.isVisible({ timeout: 1000 }).catch(() => false);

                await popoutPage.keyboard.press('Escape');
              }
            }

            console.log(`Pop-out window drag works: ${popoutWindowDragWorks}`);

            await popoutPage.close();
          }
        }
      }

      // The bug: main window works, pop-out window doesn't
      // When fixed, both should work equally
      expect(mainWindowDragWorks).toBe(true);
      expect(popoutWindowDragWorks).toBe(true); // This assertion fails due to the bug
    }
  );
});
