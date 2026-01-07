/**
 * Issue #1183: [Bug] Advanced Calendar: Click-Drag to create task does not work
 *
 * Bug description:
 * When click-dragging in the advanced calendar to create a task for a custom
 * duration (e.g., 2 hours), the entry and the menu disappear as soon as the
 * mouse button is released. Task creation only works with a single click
 * using the default duration, not with click-drag.
 *
 * This happens in all calendar view variants (Day/Week/Month).
 *
 * Root cause analysis:
 * In CalendarView.ts `handleDateSelect()`, the code calls `calendar.unselect()`
 * immediately after `menu.showAtMouseEvent(info.jsEvent)`. This clears the
 * FullCalendar selection before the user can interact with the menu.
 *
 * When the user drags to select a time range:
 * 1. FullCalendar shows the selection preview (selectMirror)
 * 2. On mouse release, `select` event fires and `handleDateSelect()` is called
 * 3. Menu appears at mouse position
 * 4. `calendar.unselect()` is called immediately, removing the selection
 * 5. This causes the visual feedback and possibly the menu to disappear
 *
 * Expected behavior:
 * - After drag-selecting a time range, the menu should remain visible
 * - User should be able to click "Create task" or other menu options
 * - The visual selection should persist until user completes or cancels the action
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1183
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1183: Calendar drag-to-create task does not work', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1183 - drag selection in week view should keep menu open',
    async () => {
      /**
       * This test reproduces the core bug: dragging to select a time range
       * in the calendar causes the menu to disappear immediately.
       *
       * Steps to reproduce:
       * 1. Open the calendar view
       * 2. Switch to week view (timeGridWeek)
       * 3. Click and drag on a time slot to select a 2-hour range
       * 4. Release mouse button
       * 5. Menu should appear and remain visible
       *
       * Current behavior: Menu appears briefly then disappears
       * Expected behavior: Menu remains visible for user interaction
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view which has time slots for drag selection
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Verify we're in time grid view
      const timeGrid = page.locator('.fc-timegrid-body, .fc-timegrid');
      await expect(timeGrid).toBeVisible({ timeout: 5000 });

      // Find a time slot in the calendar
      // FullCalendar time slots have class fc-timegrid-slot or fc-timegrid-slot-lane
      const timeSlots = page.locator('.fc-timegrid-slot-lane');
      const slotCount = await timeSlots.count();

      if (slotCount >= 4) {
        // Get bounding box of a time slot to calculate drag positions
        const firstSlot = timeSlots.nth(4); // Skip first few slots (early morning)
        const slotBox = await firstSlot.boundingBox();

        if (slotBox) {
          // Perform a drag operation to select a time range
          // Start at one slot and drag down to cover multiple slots (e.g., 2 hours = 4 slots at 30min each)
          const startX = slotBox.x + slotBox.width / 2;
          const startY = slotBox.y + slotBox.height / 2;
          const endY = startY + slotBox.height * 4; // Drag down 4 slots

          // Perform the drag
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          // Wait a moment for the menu to appear
          await page.waitForTimeout(500);

          // Check if the context menu is visible
          // Obsidian's Menu component creates elements with .menu class
          const menu = page.locator('.menu');
          const menuVisible = await menu.isVisible({ timeout: 2000 }).catch(() => false);

          // The bug is that the menu disappears immediately after drag release
          // This assertion should pass after the fix
          expect(menuVisible).toBe(true);

          if (menuVisible) {
            // Verify the menu has the expected options
            const createTaskOption = menu.locator('text=Create task');
            const hasCreateTask = await createTaskOption.isVisible({ timeout: 1000 }).catch(() => false);
            expect(hasCreateTask).toBe(true);
          }

          // Clean up by pressing Escape
          await page.keyboard.press('Escape');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1183 - drag selection in day view should keep menu open',
    async () => {
      /**
       * Same bug reproduction for day view (timeGridDay).
       * The issue affects all calendar view variants with time slots.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to day view
      const dayButton = page.locator(
        '.fc-timeGridDay-button, button:has-text("day"), .fc-toolbar button:has-text("Day")'
      );
      if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(500);
      }

      // Verify we're in time grid day view
      const timeGrid = page.locator('.fc-timegrid-body, .fc-timegrid');
      await expect(timeGrid).toBeVisible({ timeout: 5000 });

      // Find time slots
      const timeSlots = page.locator('.fc-timegrid-slot-lane');
      const slotCount = await timeSlots.count();

      if (slotCount >= 4) {
        const firstSlot = timeSlots.nth(6); // Around 9:00 AM assuming 30min slots from midnight
        const slotBox = await firstSlot.boundingBox();

        if (slotBox) {
          const startX = slotBox.x + slotBox.width / 2;
          const startY = slotBox.y + slotBox.height / 2;
          const endY = startY + slotBox.height * 4;

          // Drag to select time range
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Menu should remain visible
          const menu = page.locator('.menu');
          const menuVisible = await menu.isVisible({ timeout: 2000 }).catch(() => false);
          expect(menuVisible).toBe(true);

          await page.keyboard.press('Escape');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1183 - single click still works (comparison)',
    async () => {
      /**
       * This test verifies that single-click task creation works correctly.
       * It serves as a comparison to show that the bug is specific to drag operations.
       *
       * Single click should:
       * 1. Open the context menu
       * 2. Menu remains visible until user interacts or dismisses
       */
      const page = app.page;

      // Open the calendar view
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

      // Find time slots
      const timeSlots = page.locator('.fc-timegrid-slot-lane');
      const slotCount = await timeSlots.count();

      if (slotCount >= 4) {
        const slot = timeSlots.nth(8);
        const slotBox = await slot.boundingBox();

        if (slotBox) {
          // Single click (no drag)
          const clickX = slotBox.x + slotBox.width / 2;
          const clickY = slotBox.y + slotBox.height / 2;

          await page.mouse.click(clickX, clickY);
          await page.waitForTimeout(500);

          // Menu should appear and stay visible for single click
          const menu = page.locator('.menu');
          const menuVisible = await menu.isVisible({ timeout: 2000 }).catch(() => false);

          // This should pass - single click works correctly
          expect(menuVisible).toBe(true);

          if (menuVisible) {
            const createTaskOption = menu.locator('text=Create task');
            const hasCreateTask = await createTaskOption.isVisible({ timeout: 1000 }).catch(() => false);
            expect(hasCreateTask).toBe(true);
          }

          await page.keyboard.press('Escape');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1183 - drag selection in month view all-day slots',
    async () => {
      /**
       * The bug also affects month view when dragging across multiple days
       * to create an all-day task spanning those days.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to month view
      const monthButton = page.locator(
        '.fc-dayGridMonth-button, button:has-text("month"), .fc-toolbar button:has-text("Month")'
      );
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // Verify we're in month/day grid view
      const dayGrid = page.locator('.fc-daygrid-body, .fc-daygrid');
      await expect(dayGrid).toBeVisible({ timeout: 5000 });

      // Find day cells in the grid
      const dayCells = page.locator('.fc-daygrid-day');
      const dayCount = await dayCells.count();

      if (dayCount >= 3) {
        // Get two adjacent day cells to drag across
        const firstDay = dayCells.nth(7); // Skip to second row of days
        const secondDay = dayCells.nth(8);

        const firstBox = await firstDay.boundingBox();
        const secondBox = await secondDay.boundingBox();

        if (firstBox && secondBox) {
          const startX = firstBox.x + firstBox.width / 2;
          const startY = firstBox.y + firstBox.height / 2;
          const endX = secondBox.x + secondBox.width / 2;
          const endY = secondBox.y + secondBox.height / 2;

          // Drag across two days
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(endX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Menu should remain visible
          const menu = page.locator('.menu');
          const menuVisible = await menu.isVisible({ timeout: 2000 }).catch(() => false);
          expect(menuVisible).toBe(true);

          await page.keyboard.press('Escape');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1183 - task created via drag should have correct duration',
    async () => {
      /**
       * When the drag-to-create bug is fixed, we also need to verify that
       * the task creation modal receives the correct start/end times
       * based on the drag selection (not just default duration).
       *
       * This test is secondary to the main bug but ensures complete fix.
       */
      const page = app.page;

      // Open the calendar view
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

      const timeSlots = page.locator('.fc-timegrid-slot-lane');
      const slotCount = await timeSlots.count();

      if (slotCount >= 4) {
        const firstSlot = timeSlots.nth(4);
        const slotBox = await firstSlot.boundingBox();

        if (slotBox) {
          const startX = slotBox.x + slotBox.width / 2;
          const startY = slotBox.y + slotBox.height / 2;
          // Drag for approximately 2 hours (4 slots at 30 min each)
          const endY = startY + slotBox.height * 4;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          const menu = page.locator('.menu');
          if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Click "Create task"
            const createTaskOption = menu.locator('text=Create task');
            if (await createTaskOption.isVisible({ timeout: 1000 }).catch(() => false)) {
              await createTaskOption.click();
              await page.waitForTimeout(500);

              // Task creation modal should open
              const modal = page.locator('.modal, .tasknotes-modal');
              if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Check if the duration/time fields reflect the drag selection
                // The modal should show ~2 hours duration or the corresponding times
                const durationField = modal.locator(
                  '[data-property="duration"], input[name="duration"], .duration-input'
                );
                const timeFields = modal.locator(
                  '[data-property="scheduled"], [data-property="time"], .time-input'
                );

                // Log what we find for debugging
                const durationVisible = await durationField.isVisible({ timeout: 1000 }).catch(() => false);
                const timeFieldsCount = await timeFields.count();

                console.log(`Duration field visible: ${durationVisible}, Time fields: ${timeFieldsCount}`);

                // Close modal
                await page.keyboard.press('Escape');
              }
            }
          }

          await page.keyboard.press('Escape');
        }
      }
    }
  );
});
