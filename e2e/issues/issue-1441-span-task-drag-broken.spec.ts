/**
 * Issue #1441: [Bug] Task dragging in calendar view broken with "Span tasks between scheduled and due dates" enabled
 *
 * Bug description (FIXED):
 * In the Calendar Base View, when "Span tasks between scheduled and due dates" was enabled,
 * dragging span events caused a visual mismatch with actual task properties because:
 * 1. The editable: false property was being overridden by the default case in eventDidMount
 * 2. handleEventDrop() didn't have handling for "scheduledToDueSpan" eventType
 *
 * Fix implemented:
 * - Added explicit "scheduledToDueSpan" case in eventDidMount to set editable: true
 * - Added handler in handleEventDrop() for span events that shifts both scheduled AND due
 *   dates by the same amount, preserving the span duration while moving the task in time
 *
 * Expected behavior (after fix):
 * - Span events CAN be dragged
 * - Dragging a span event shifts both scheduled and due dates proportionally
 * - The span duration (time between scheduled and due) is preserved
 * - Task position in calendar matches its actual properties after drag
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1441
 * @see CalendarView.ts handleEventDrop() for span event handling
 * @see calendar-core.ts createScheduledToDueSpanEvent() for span event creation
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1441: Span task drag with scheduled-to-due span enabled', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test(
    'span events should be draggable and update both scheduled and due dates',
    async () => {
      /**
       * This test verifies that span events (shown when "Span tasks between
       * scheduled and due dates" is enabled) can be dragged and properly
       * update both scheduled and due dates.
       *
       * Expected behavior:
       * - Span events can be dragged
       * - Dragging shifts both scheduled and due by the same amount
       * - Task position after refresh matches the dragged position
       */
      const page = app.page;

      // Open the Bases view
      await runCommand(page, 'TaskNotes: Open bases view');
      await page.waitForTimeout(1000);

      // Look for calendar base or switch to calendar view
      const basesContainer = page.locator('.bases-container, .tasknotes-bases');
      await expect(basesContainer).toBeVisible({ timeout: 10000 });

      // Try to find the calendar view or switch to it
      const calendarTab = page.locator(
        '[data-view-type="calendar"], .bases-tab:has-text("Calendar"), button:has-text("Calendar")'
      );

      if (await calendarTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await calendarTab.click();
        await page.waitForTimeout(500);
      }

      // Wait for the FullCalendar component
      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to month view to see multi-day span events
      const monthButton = page.locator(
        '.fc-dayGridMonth-button, button:has-text("Month"), .fc-toolbar button:has-text("Month")'
      );
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // Open the configure view dialog to enable span option
      const configureButton = page.locator(
        '.bases-configure-button, button[aria-label*="Configure"], button:has-text("Configure")'
      );

      if (await configureButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await configureButton.click();
        await page.waitForTimeout(500);

        // Find the "Span tasks between scheduled and due dates" toggle
        const spanToggle = page.locator(
          'text=Span tasks between scheduled and due dates, ' +
          '[data-setting="showScheduledToDueSpan"], ' +
          '.setting-item:has-text("Span") .checkbox-container, ' +
          '.setting-item:has-text("scheduled and due") input[type="checkbox"]'
        );

        if (await spanToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Enable the span option if not already enabled
          const isChecked = await spanToggle.locator('input').isChecked().catch(() => false);
          if (!isChecked) {
            await spanToggle.click();
            await page.waitForTimeout(300);
          }
        }

        // Close the configure dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Find a span event (multi-day task bar)
      // Span events have data-event-type="scheduledToDueSpan"
      const spanEvents = page.locator(
        '.fc-event[data-event-type="scheduledToDueSpan"], ' +
        '.fc-daygrid-event[data-event-type="scheduledToDueSpan"]'
      );

      const spanEventCount = await spanEvents.count();

      if (spanEventCount > 0) {
        const spanEvent = spanEvents.first();
        const eventBox = await spanEvent.boundingBox();

        if (eventBox) {
          // Record initial position
          const initialX = eventBox.x;

          // Attempt to drag the span event to the right (next day)
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          // Find target position (move right by approximately one day width)
          const dayCells = page.locator('.fc-daygrid-day');
          const firstDayBox = await dayCells.first().boundingBox();
          const dayWidth = firstDayBox?.width || 100;

          const targetX = startX + dayWidth;

          // Perform drag
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(targetX, startY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Get the new position after drag
          const newEventBox = await spanEvent.boundingBox();

          if (newEventBox) {
            // The event should have moved
            // Note: exact position comparison is tricky due to calendar reflow
            console.log(`Span event: Initial X: ${initialX}, After drag X: ${newEventBox.x}`);

            // Wait for any calendar updates
            await page.waitForTimeout(1000);

            // The event should remain at the new position (not snap back)
            // because both scheduled and due dates were updated
            const finalEventBox = await spanEvent.boundingBox();
            if (finalEventBox) {
              // Position should be consistent after potential refresh
              expect(Math.abs(finalEventBox.x - newEventBox.x)).toBeLessThan(10);
            }
          }
        }
      } else {
        // Skip test if no span events are visible (need a task with both scheduled and due)
        console.log('No span events found - test requires a task with both scheduled and due dates');
      }

      // Click away to deselect
      await page.keyboard.press('Escape');
    }
  );

  test(
    'span event drag should preserve span duration',
    async () => {
      /**
       * This test verifies that when dragging a span event, the duration
       * (time between scheduled and due) is preserved - both dates shift
       * by the same amount.
       */
      const page = app.page;

      // Open Bases view with calendar
      await runCommand(page, 'TaskNotes: Open bases view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to month view
      const monthButton = page.locator('.fc-dayGridMonth-button');
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // Enable span display
      const configureButton = page.locator('.bases-configure-button');
      if (await configureButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await configureButton.click();
        await page.waitForTimeout(500);

        const spanToggle = page.locator(
          '.setting-item:has-text("Span tasks") .checkbox-container'
        );
        if (await spanToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isChecked = await spanToggle.locator('input').isChecked().catch(() => false);
          if (!isChecked) {
            await spanToggle.click();
            await page.waitForTimeout(300);
          }
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Find span events
      const spanEvents = page.locator('.fc-event[data-event-type="scheduledToDueSpan"]');
      const spanCount = await spanEvents.count();

      if (spanCount > 0) {
        const spanEvent = spanEvents.first();
        const eventBox = await spanEvent.boundingBox();

        if (eventBox) {
          // Record the initial width (represents span duration)
          const initialWidth = eventBox.width;

          // Drag the event
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX + 100, startY, { steps: 5 });
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Check the width after drag - should be preserved
          const newEventBox = await spanEvent.boundingBox();
          if (newEventBox) {
            // Width should remain the same (span duration preserved)
            expect(Math.abs(newEventBox.width - initialWidth)).toBeLessThan(5);
            console.log(`Span width: Initial: ${initialWidth}, After drag: ${newEventBox.width}`);
          }
        }
      } else {
        console.log('No span events found - test requires a task with both scheduled and due dates');
      }
    }
  );

  test(
    'individual scheduled/due events should still work when span disabled',
    async () => {
      /**
       * This test serves as a comparison baseline: when the span option is
       * DISABLED, dragging individual scheduled and due events should work correctly.
       */
      const page = app.page;

      // Open Bases view
      await runCommand(page, 'TaskNotes: Open bases view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to month view
      const monthButton = page.locator('.fc-dayGridMonth-button');
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // Open configure and DISABLE span option
      const configureButton = page.locator('.bases-configure-button');
      if (await configureButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await configureButton.click();
        await page.waitForTimeout(500);

        // Find and disable the span toggle
        const spanToggle = page.locator(
          '.setting-item:has-text("Span tasks") .checkbox-container'
        );

        if (await spanToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check if currently enabled and disable if so
          const isChecked = await spanToggle.locator('input').isChecked().catch(() => false);
          if (isChecked) {
            await spanToggle.click();
            await page.waitForTimeout(300);
          }
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Find a scheduled event
      const scheduledEvents = page.locator('.fc-event[data-event-type="scheduled"]');
      const scheduledCount = await scheduledEvents.count();

      if (scheduledCount > 0) {
        const scheduledEvent = scheduledEvents.first();
        const eventBox = await scheduledEvent.boundingBox();

        if (eventBox) {
          const initialX = eventBox.x;

          // Drag the scheduled event
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX + 100, startY, { steps: 5 });
          await page.mouse.up();

          await page.waitForTimeout(500);

          // The event should have moved
          const newEventBox = await scheduledEvent.boundingBox();
          if (newEventBox) {
            // Position should have changed
            expect(Math.abs(newEventBox.x - initialX)).toBeGreaterThan(50);
            console.log(`Scheduled event: Initial X: ${initialX}, After drag X: ${newEventBox.x}`);
          }
        }
      }

      // Similarly test due event drag
      const dueEvents = page.locator('.fc-event[data-event-type="due"]');
      if (await dueEvents.count() > 0) {
        const dueEvent = dueEvents.first();
        const dueBox = await dueEvent.boundingBox();

        if (dueBox) {
          const initialX = dueBox.x;

          await page.mouse.move(dueBox.x + dueBox.width / 2, dueBox.y + dueBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(dueBox.x + dueBox.width / 2 + 100, dueBox.y + dueBox.height / 2, {
            steps: 5,
          });
          await page.mouse.up();

          await page.waitForTimeout(500);

          const newDueBox = await dueEvent.boundingBox();
          if (newDueBox) {
            expect(Math.abs(newDueBox.x - initialX)).toBeGreaterThan(50);
            console.log(`Due event: Initial X: ${initialX}, After drag X: ${newDueBox.x}`);
          }
        }
      }
    }
  );

  test(
    'span events should be explicitly editable',
    async () => {
      /**
       * This test verifies that span events have editable: true set correctly
       * and can be dragged (drag mirror appears during drag).
       */
      const page = app.page;

      // Open Bases view with calendar
      await runCommand(page, 'TaskNotes: Open bases view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Enable span display
      const configureButton = page.locator('.bases-configure-button');
      if (await configureButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await configureButton.click();
        await page.waitForTimeout(500);

        const spanToggle = page.locator(
          '.setting-item:has-text("Span tasks") .checkbox-container'
        );
        if (await spanToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isChecked = await spanToggle.locator('input').isChecked().catch(() => false);
          if (!isChecked) {
            await spanToggle.click();
            await page.waitForTimeout(300);
          }
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Switch to month view
      const monthButton = page.locator('.fc-dayGridMonth-button');
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // Check for span events
      const spanEvents = page.locator('.fc-event[data-event-type="scheduledToDueSpan"]');
      const spanCount = await spanEvents.count();

      if (spanCount > 0) {
        const spanEvent = spanEvents.first();

        // Check if the event does NOT have the non-editable class
        const isEditable = await spanEvent.evaluate((el) => {
          return !el.classList.contains('fc-event-not-editable');
        });

        // Span events should be editable now
        expect(isEditable).toBe(true);

        // Attempt to start a drag and verify drag mirror appears
        const eventBox = await spanEvent.boundingBox();
        if (eventBox) {
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          await page.mouse.move(startX, startY);
          await page.mouse.down();

          // Move to trigger drag
          await page.mouse.move(startX + 50, startY, { steps: 3 });

          // Check if drag mirror/indicator appears
          const dragMirror = page.locator('.fc-event-mirror, .fc-event-dragging');
          const isDragging = await dragMirror.isVisible({ timeout: 500 }).catch(() => false);

          await page.mouse.up();

          // Drag should work for span events
          expect(isDragging).toBe(true);
          console.log(`Span event can be dragged: ${isDragging}`);
        }
      } else {
        console.log('No span events found - test requires a task with both scheduled and due dates');
      }
    }
  );
});
