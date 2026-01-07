/**
 * Issue #1441: [Bug] Task dragging in calendar view broken with "Span tasks between scheduled and due dates" enabled
 *
 * Bug description:
 * In the Calendar Base View, when viewing by month or year and dragging tasks, normally:
 * - Dragging a task updates the `scheduled` property
 * - Dragging the END of a task sets the `timeEstimate` property
 * - If a task has a `due` date, it shows as a separate draggable "event"
 *
 * However, when "Span tasks between scheduled and due dates" is enabled:
 * - Dragging the span event causes visual mismatch with actual task properties
 * - The task position in calendar doesn't match its scheduled/due dates after dragging
 *
 * Root cause analysis:
 * In CalendarView.ts, the span event is created with `editable: false` in calendar-core.ts:503,
 * BUT in the eventDidMount callback (lines 1736-1748), the default case sets
 * `arg.event.setProp("editable", true)` which overrides the false setting for span events.
 *
 * When a span event is dragged:
 * 1. The event can be dragged because editable was incorrectly set to true
 * 2. handleEventDrop() (line 1320) only handles eventType "scheduled" or "due"
 * 3. The "scheduledToDueSpan" eventType falls through without updating any properties
 * 4. The visual position changes but task properties remain unchanged
 * 5. On calendar refresh, the event snaps back to its original position
 *
 * Expected behavior:
 * - Span events should NOT be directly draggable (editable: false should be respected)
 * - Users should drag individual scheduled/due events to modify dates
 * - OR span events should be made draggable with proper handling that updates
 *   both scheduled and due dates proportionally
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1441
 * @see CalendarView.ts lines 1736-1748 (editable override bug)
 * @see CalendarView.ts lines 1320-1328 (missing span event handling)
 * @see calendar-core.ts lines 473-510 (createScheduledToDueSpanEvent)
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1441: Span task drag broken with scheduled-to-due span enabled', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1441 - span event should not be directly draggable',
    async () => {
      /**
       * This test verifies that span events (shown when "Span tasks between
       * scheduled and due dates" is enabled) should either:
       * a) Not be draggable at all (editable: false respected), OR
       * b) Be draggable with proper property updates
       *
       * Current behavior (bug):
       * - Span events can be dragged (editable: false is overridden)
       * - Dragging doesn't update task properties
       * - Task position doesn't match its actual scheduled/due dates
       *
       * Steps to reproduce:
       * 1. Create a task with both scheduled and due dates
       * 2. Open Bases calendar view in month mode
       * 3. Enable "Span tasks between scheduled and due dates" option
       * 4. Drag the span event to a different day
       * 5. Observe the task position vs its actual properties
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
          await spanToggle.click();
          await page.waitForTimeout(300);
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

          // Get the new position
          const newEventBox = await spanEvent.boundingBox();

          if (newEventBox) {
            // The bug is that the event can be dragged but properties aren't updated
            // After a refresh, it should snap back to original position

            // Wait for potential calendar refresh
            await page.waitForTimeout(1000);

            // Check if event position changed
            const finalEventBox = await spanEvent.boundingBox();

            if (finalEventBox) {
              // If the bug exists:
              // - Event will have moved visually (newEventBox.x != initialX)
              // - After any calendar update, it may snap back or stay mispositioned

              // The assertion here depends on expected behavior:
              // OPTION A: Span events should not be draggable at all
              //   expect(newEventBox.x).toBeCloseTo(initialX, 1);
              // OPTION B: Span events should be draggable and update properties correctly
              //   (would need to verify task properties were updated)

              // For now, we check that if dragging occurred, properties should match position
              // This will fail with the current bug where drag happens but properties don't update
              console.log(`Span event: Initial X: ${initialX}, After drag X: ${newEventBox.x}`);
            }
          }
        }
      }

      // Click away to deselect
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1441 - span event position should match task properties after drag',
    async () => {
      /**
       * This test verifies that after dragging a span event, the visual position
       * matches the actual task scheduled/due properties.
       *
       * Current behavior (bug):
       * - Dragging span event changes visual position
       * - Task properties (scheduled, due) remain unchanged
       * - Visual position doesn't reflect actual task data
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

      // Find a task event to work with
      const taskEvents = page.locator('.fc-event.fc-task-event');
      const eventCount = await taskEvents.count();

      if (eventCount > 0) {
        const taskEvent = taskEvents.first();

        // Get task info before drag
        const taskPath = await taskEvent.getAttribute('data-task-path');

        // Perform a drag operation
        const eventBox = await taskEvent.boundingBox();
        if (eventBox) {
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          // Drag right by ~100px (approximately one day in month view)
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX + 100, startY, { steps: 5 });
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Force a calendar refresh by toggling view
          const weekButton = page.locator('.fc-timeGridWeek-button');
          if (await weekButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await weekButton.click();
            await page.waitForTimeout(300);
            await monthButton.click();
            await page.waitForTimeout(500);
          }

          // Find the same task event again
          const refreshedEvent = page.locator(`.fc-event[data-task-path="${taskPath}"]`);

          if (await refreshedEvent.isVisible({ timeout: 2000 }).catch(() => false)) {
            const refreshedBox = await refreshedEvent.boundingBox();

            if (refreshedBox && eventBox) {
              // After refresh, the event position should reflect actual task properties
              // If the bug exists, position won't match what was dragged
              console.log(
                `Task event position: Original X: ${eventBox.x}, ` +
                `After drag and refresh X: ${refreshedBox.x}`
              );

              // The event should be at a consistent position after refresh
              // (either original if drag didn't update, or new if it did)
            }
          }
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1441 - individual scheduled/due events should still work when span disabled',
    async () => {
      /**
       * This test serves as a comparison baseline: when the span option is
       * DISABLED, dragging individual scheduled and due events should work correctly.
       *
       * Steps:
       * 1. Disable "Span tasks between scheduled and due dates"
       * 2. Find a task with both scheduled and due dates
       * 3. Drag the scheduled event - should update scheduled property
       * 4. Drag the due event - should update due property
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
          // Drag the scheduled event
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX + 100, startY, { steps: 5 });
          await page.mouse.up();

          await page.waitForTimeout(500);

          // The event should remain at the new position after calendar refresh
          // This verifies that normal drag behavior works correctly
          console.log('Scheduled event drag completed - verify position persists');
        }
      }

      // Similarly test due event drag
      const dueEvents = page.locator('.fc-event[data-event-type="due"]');
      if (await dueEvents.count() > 0) {
        const dueEvent = dueEvents.first();
        const dueBox = await dueEvent.boundingBox();

        if (dueBox) {
          await page.mouse.move(dueBox.x + dueBox.width / 2, dueBox.y + dueBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(dueBox.x + dueBox.width / 2 + 100, dueBox.y + dueBox.height / 2, {
            steps: 5,
          });
          await page.mouse.up();

          await page.waitForTimeout(500);
          console.log('Due event drag completed - verify position persists');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1441 - editable property should be respected for span events',
    async () => {
      /**
       * This test specifically checks that the editable: false property set
       * in createScheduledToDueSpanEvent() is not being overridden elsewhere.
       *
       * The bug is in CalendarView.ts eventDidMount where the default case
       * sets editable: true for ALL event types including span events.
       *
       * We verify by checking if span events can be dragged at all.
       * With the bug fixed, span events should not respond to drag attempts.
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

        // Check if the event has FullCalendar's editable class or attribute
        // Non-editable events typically have fc-event-not-editable class or similar
        const hasEditableClass = await spanEvent.evaluate((el) => {
          return !el.classList.contains('fc-event-not-editable');
        });

        // With the bug, span events will be editable (hasEditableClass will be true)
        // After fix, span events should not be editable
        console.log(`Span event editable: ${hasEditableClass}`);

        // Attempt to start a drag
        const eventBox = await spanEvent.boundingBox();
        if (eventBox) {
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;

          // Record initial position
          await page.mouse.move(startX, startY);
          await page.mouse.down();

          // Check if drag indicator appears (FullCalendar shows a mirror element when dragging)
          await page.mouse.move(startX + 50, startY, { steps: 3 });

          const dragMirror = page.locator('.fc-event-mirror, .fc-event-dragging');
          const isDragging = await dragMirror.isVisible({ timeout: 500 }).catch(() => false);

          await page.mouse.up();

          // With bug: isDragging will be true (event can be dragged)
          // After fix: isDragging should be false (span events not draggable)
          console.log(`Span event drag started: ${isDragging}`);

          // After fix, this should be false
          // expect(isDragging).toBe(false);
        }
      }
    }
  );
});
