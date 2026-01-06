/**
 * Issue #1076: [Bug]: Cannot create timeblock with end time = 00:00
 *
 * Bug Description:
 * Users cannot create a timeblock that ends at midnight (00:00).
 * The validation logic treats 00:00 as "0 minutes since midnight",
 * which fails the check that end time must be after start time.
 *
 * Root Cause:
 * In `validateTimeBlock()` (helpers.ts:925-933), times are converted to
 * "minutes since midnight" for comparison:
 *   - startMinutes = startHour * 60 + startMin
 *   - endMinutes = endHour * 60 + endMin
 *   - if (endMinutes <= startMinutes) return false;
 *
 * When endTime = "00:00", endMinutes = 0, which will always be <= startMinutes
 * for any reasonable start time, causing validation to fail.
 *
 * The modal attempts to auto-convert 00:00 to 23:59, but this workaround:
 * 1. Doesn't apply to programmatic timeblock creation
 * 2. Changes the user's intended end time semantically (23:59 vs midnight)
 * 3. May not trigger in all UI code paths
 *
 * Expected behavior:
 * - 00:00 end time should be interpreted as "end of day" (24:00 / midnight)
 * - Timeblock from 22:00 to 00:00 should be valid (2-hour block until midnight)
 * - The actual end time should remain 00:00, not be converted to 23:59
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1076
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1076: Timeblock end time 00:00 (midnight)', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1076 - should allow creating timeblock ending at 00:00 via modal',
    async () => {
      /**
       * Test creating a timeblock that ends at midnight via the creation modal.
       *
       * Steps to reproduce:
       * 1. Open calendar view
       * 2. Right-click to create a timeblock
       * 3. Set start time to 22:00
       * 4. Set end time to 00:00
       * 5. Fill in title
       * 6. Click create
       *
       * Expected: Timeblock is created from 22:00 to 00:00 (2 hours)
       * Actual: Create button stays disabled or validation fails
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to day view for easier time slot access
      const dayButton = page.locator('.fc-timeGridDay-button');
      if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(500);
      }

      // Find the time grid and right-click to open context menu
      const timeGrid = page.locator('.fc-timegrid-body');
      await expect(timeGrid).toBeVisible({ timeout: 5000 });

      // Find a late evening time slot (around 22:00)
      const timeSlots = page.locator('.fc-timegrid-slot-lane');
      const eveningSlot = timeSlots.nth(44); // Approximately 22:00 (44 * 30min / 60 = 22)
      const slotBox = await eveningSlot.boundingBox();

      if (!slotBox) {
        console.log('Could not get evening slot bounding box');
        return;
      }

      // Right-click to open context menu
      await page.mouse.click(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, {
        button: 'right',
      });
      await page.waitForTimeout(300);

      // Look for context menu with timeblock option
      const contextMenu = page.locator('.menu, [role="menu"]');
      if (!(await contextMenu.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log('Context menu did not appear');
        return;
      }

      // Click on "Create timeblock" option
      const createTimeblockOption = page.locator(
        'text=Create timeblock, text=New timeblock, [data-action="create-timeblock"]'
      );
      if (await createTimeblockOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await createTimeblockOption.click();
        await page.waitForTimeout(300);
      }

      // Wait for timeblock creation modal
      const modal = page.locator('.modal');
      if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log('Timeblock creation modal did not appear');
        return;
      }

      // Find and fill in the form fields
      const titleInput = modal.locator('input[type="text"]').first();
      const startTimeInput = modal.locator('input[type="time"]').first();
      const endTimeInput = modal.locator('input[type="time"]').last();

      // Enter a title
      await titleInput.fill('Late Night Work');

      // Set start time to 22:00
      await startTimeInput.fill('22:00');

      // Set end time to 00:00 (midnight)
      await endTimeInput.fill('00:00');

      // Wait for validation to run
      await page.waitForTimeout(200);

      // Find the create/submit button
      const createButton = modal.locator(
        'button.timeblock-create-button, ' +
          'button:has-text("Create"), ' +
          'button[type="submit"]:not(:disabled)'
      );

      // The bug: button should be enabled for 22:00-00:00 timeblock
      // but validation treats 00:00 as 0 minutes, failing the endMinutes > startMinutes check
      const isButtonEnabled = await createButton.isEnabled().catch(() => false);
      console.log(`Create button enabled for 22:00-00:00 timeblock: ${isButtonEnabled}`);

      // This assertion documents the expected behavior (should pass after fix)
      expect(isButtonEnabled).toBe(true);

      if (isButtonEnabled) {
        await createButton.click();
        await page.waitForTimeout(500);

        // Verify the timeblock was created
        const newTimeblock = page.locator('.fc-event:has-text("Late Night Work")');
        await expect(newTimeblock).toBeVisible({ timeout: 3000 });
      }

      // Clean up: close modal if still open
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1076 - validateTimeBlock should accept 00:00 as valid end time',
    async () => {
      /**
       * Unit test concept: The validateTimeBlock function in helpers.ts
       * should treat 00:00 end time as valid (meaning "end of day").
       *
       * This is a conceptual test - actual unit tests would be in a separate file.
       * The E2E test verifies the behavior through the UI.
       *
       * The validation logic currently does:
       *   const endMinutes = endHour * 60 + endMin;  // 0 * 60 + 0 = 0
       *   if (endMinutes <= startMinutes) return false;  // 0 <= 1320 (22:00) = true -> fails
       *
       * It should handle 00:00 specially:
       *   if (endMinutes === 0) endMinutes = 24 * 60; // Treat midnight as end of day
       *   OR
       *   if (endMinutes === 0 && startMinutes > 0) endMinutes = 1440; // 24 hours in minutes
       */
      const page = app.page;

      // This test verifies the fix works by creating a timeblock via the command
      // which bypasses some UI workarounds

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to day view
      const dayButton = page.locator('.fc-timeGridDay-button');
      if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(500);
      }

      // Count existing timeblocks
      const existingTimeblocks = page.locator('.fc-event[data-event-type="timeblock"]');
      const initialCount = await existingTimeblocks.count();
      console.log(`Initial timeblock count: ${initialCount}`);

      // Try to create a timeblock ending at midnight via drag selection
      const timeSlots = page.locator('.fc-timegrid-slot-lane');

      // Drag from 23:00 to beyond the visible area (attempting to reach midnight)
      const slot2300 = timeSlots.nth(46); // 23:00
      const slotBox = await slot2300.boundingBox();

      if (slotBox) {
        // Drag down to create selection that would end at midnight
        const startX = slotBox.x + slotBox.width / 2;
        const startY = slotBox.y;

        // Drag past the last visible slot
        const lastSlot = timeSlots.last();
        const lastSlotBox = await lastSlot.boundingBox();
        const endY = lastSlotBox ? lastSlotBox.y + lastSlotBox.height : startY + 100;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(startX, endY, { steps: 10 });
        await page.waitForTimeout(100);
        await page.mouse.up();

        await page.waitForTimeout(500);
      }

      // Check if selection or modal appeared
      const modal = page.locator('.modal');
      const selectionMenu = page.locator('.menu, [role="menu"]');

      const hasUIResponse =
        (await modal.isVisible({ timeout: 1000 }).catch(() => false)) ||
        (await selectionMenu.isVisible({ timeout: 1000 }).catch(() => false));

      if (hasUIResponse) {
        console.log('Selection created a UI response (modal or menu)');

        // If modal, check if we can set 00:00 end time
        if (await modal.isVisible().catch(() => false)) {
          const endTimeInput = modal.locator('input[type="time"]').last();
          if (await endTimeInput.isVisible().catch(() => false)) {
            await endTimeInput.fill('00:00');
            await page.waitForTimeout(200);

            // Check if form is valid
            const submitButton = modal.locator('button[type="submit"], button:has-text("Create")');
            const isValid = await submitButton.isEnabled().catch(() => false);
            console.log(`Form valid with 00:00 end time: ${isValid}`);

            // Expected: form should be valid
            expect(isValid).toBe(true);
          }
        }
      }

      // Clean up
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1076 - timeblock 23:30 to 00:00 should be valid 30-minute block',
    async () => {
      /**
       * Edge case: A short timeblock that spans the midnight boundary.
       *
       * User wants to create a 30-minute timeblock from 23:30 to 00:00.
       * This is a legitimate use case for late-night work ending at midnight.
       *
       * Expected: Timeblock created, shows as 30 minutes
       * Actual: Validation fails because 00:00 (0 minutes) < 23:30 (1410 minutes)
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Navigate to day view
      const dayButton = page.locator('.fc-timeGridDay-button');
      if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(500);
      }

      // Try to open timeblock creation modal via command
      await runCommand(page, 'TaskNotes: Create timeblock');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      if (!(await modal.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('Create timeblock command did not open modal');
        return;
      }

      // Fill in the form
      const titleInput = modal.locator('input[type="text"]').first();
      const startTimeInput = modal.locator('input[type="time"]').first();
      const endTimeInput = modal.locator('input[type="time"]').last();

      await titleInput.fill('Midnight Edge Case');
      await startTimeInput.fill('23:30');
      await endTimeInput.fill('00:00');

      await page.waitForTimeout(200);

      // Check validation state
      const createButton = modal.locator(
        'button.timeblock-create-button, button:has-text("Create")'
      );
      const buttonOpacity = await createButton.evaluate((el) =>
        window.getComputedStyle(el).opacity
      );
      const isButtonEnabled = await createButton.isEnabled().catch(() => false);

      console.log(`Button enabled: ${isButtonEnabled}, opacity: ${buttonOpacity}`);

      // The validation should pass for a 23:30-00:00 timeblock
      expect(isButtonEnabled).toBe(true);
      expect(parseFloat(buttonOpacity)).toBe(1);

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1076 - workaround converting 00:00 to 23:59 loses precision',
    async () => {
      /**
       * The current workaround in TimeblockCreationModal converts 00:00 to 23:59.
       * This is semantically incorrect:
       *
       * - 22:00 to 00:00 = exactly 2 hours (120 minutes)
       * - 22:00 to 23:59 = 119 minutes (1 minute short)
       *
       * For time tracking and Pomodoro-style workflows, this 1-minute
       * discrepancy can accumulate and cause confusion.
       *
       * The fix should preserve 00:00 as the actual end time and handle
       * it correctly in validation (treating it as 24:00 / 1440 minutes).
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      const dayButton = page.locator('.fc-timeGridDay-button');
      if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(500);
      }

      // Open timeblock creation
      await runCommand(page, 'TaskNotes: Create timeblock');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      if (!(await modal.isVisible({ timeout: 3000 }).catch(() => false))) {
        return;
      }

      const endTimeInput = modal.locator('input[type="time"]').last();

      // Enter 00:00 and check what value the input has after the onChange
      await endTimeInput.fill('00:00');
      await page.waitForTimeout(300);

      // The current workaround changes the input value to 23:59
      const actualValue = await endTimeInput.inputValue();
      console.log(`End time input value after entering 00:00: ${actualValue}`);

      // After the fix, the value should remain 00:00 (not converted to 23:59)
      // This documents the expected behavior
      expect(actualValue).toBe('00:00');

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1076 - timeblock stored in frontmatter with 00:00 end time',
    async () => {
      /**
       * Timeblocks are stored in daily note frontmatter. If a user manually
       * edits the frontmatter to have endTime: "00:00", the timeblock should
       * still be recognized and displayed correctly.
       *
       * Example frontmatter:
       * ```yaml
       * timeblocks:
       *   - id: "tb-123"
       *     title: "Late night work"
       *     startTime: "22:00"
       *     endTime: "00:00"
       * ```
       *
       * This tests that the validation/parsing doesn't reject valid
       * timeblocks when loading from files.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // This test would require creating a daily note with a timeblock
      // that has endTime: "00:00" in the frontmatter, then checking
      // if it appears on the calendar.

      // For now, we document the expected behavior
      console.log(
        'Timeblocks with endTime "00:00" in frontmatter should be:\n' +
          '1. Loaded and validated successfully\n' +
          '2. Displayed on the calendar as ending at midnight\n' +
          '3. Not rejected by validateTimeBlock()'
      );

      // After implementation, this test would verify the behavior
      expect(true).toBe(true); // Placeholder
    }
  );
});
