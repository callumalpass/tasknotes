/**
 * Issue #1119: [FR]: Time Block Handling in Calendar View
 *
 * Feature request for enhanced time block handling in the calendar view:
 *
 * 1. Enable dragging all-day events directly to timed slots in the calendar
 *    view without manual editing.
 *
 * 2. Allow drawing/clicking to create time blocks in day/week views,
 *    bypassing the scheduled date/time picker.
 *
 * 3. Allow a single task to be split and placed into multiple non-contiguous
 *    time blocks (e.g., "Write report" – 30 min morning + 45 min afternoon + 20 min evening).
 *    Some tasks can't be completed in one focused session due to energy levels,
 *    interruptions, or Pomodoro-style work.
 *
 * Current behavior:
 * - All-day events cannot be dragged to timed slots (FullCalendar treats them differently)
 * - Creating time blocks requires context menu → modal workflow
 * - Tasks can only occupy a single contiguous time block
 * - Time blocks are separate entities stored in daily notes
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1119
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1119: Time Block Handling in Calendar View', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Feature 1: Drag all-day events to timed slots', () => {
    test.fixme(
      'reproduces issue #1119 - all-day event should be draggable to specific time slot in week view',
      async () => {
        /**
         * Currently, FullCalendar treats all-day events and timed events as different
         * categories. Dragging an all-day event to a time slot doesn't work - the
         * event snaps back to the all-day section.
         *
         * Expected behavior:
         * 1. User has an all-day task (scheduled without specific time)
         * 2. In week view, user drags the task from all-day row to 10:00 AM slot
         * 3. Task is converted to a timed event at 10:00 AM
         * 4. Task's scheduled property updates to include the time component
         *
         * Current behavior:
         * - Drag is rejected or event snaps back to all-day section
         * - User must manually edit the task to add a time
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to week view which has both all-day section and time slots
        const weekButton = page.locator(
          '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
        );
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Verify we're in time grid week view
        const timeGrid = page.locator('.fc-timegrid-body, .fc-timegrid');
        await expect(timeGrid).toBeVisible({ timeout: 5000 });

        // Look for an all-day event in the all-day section
        // All-day events appear in the fc-daygrid-body (top section of week view)
        const allDaySection = page.locator('.fc-daygrid-body');
        const allDayEvent = allDaySection.locator('.fc-event').first();

        if (!(await allDayEvent.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No all-day events found to test dragging. Test skipped.');
          return;
        }

        // Get the all-day event's bounding box
        const eventBox = await allDayEvent.boundingBox();
        if (!eventBox) {
          console.log('Could not get event bounding box');
          return;
        }

        // Find a time slot in the timed section (e.g., 10:00 AM)
        const timeSlots = page.locator('.fc-timegrid-slot-lane');
        const targetSlot = timeSlots.nth(20); // Approximately 10:00 AM (20 * 30min from midnight)
        const slotBox = await targetSlot.boundingBox();

        if (!slotBox) {
          console.log('Could not get time slot bounding box');
          return;
        }

        // Attempt to drag the all-day event to the time slot
        const startX = eventBox.x + eventBox.width / 2;
        const startY = eventBox.y + eventBox.height / 2;
        const endX = slotBox.x + slotBox.width / 2;
        const endY = slotBox.y + slotBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(endX, endY, { steps: 20 });
        await page.waitForTimeout(100);
        await page.mouse.up();

        await page.waitForTimeout(500);

        // After implementation, the event should now appear in the time grid
        // not in the all-day section
        const timedEvents = page.locator('.fc-timegrid-event');
        const timedEventCount = await timedEvents.count();

        console.log(`Timed events after drag: ${timedEventCount}`);

        // The dragged event should now be a timed event
        // This assertion will fail until the feature is implemented
        expect(timedEventCount).toBeGreaterThan(0);
      }
    );

    test.fixme(
      'reproduces issue #1119 - all-day event dragged to time slot should update task scheduled time',
      async () => {
        /**
         * When an all-day event is dragged to a specific time slot, the
         * underlying task's `scheduled` property should be updated to include
         * the time component.
         *
         * Before: scheduled: "2026-01-15"
         * After:  scheduled: "2026-01-15T10:00"
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to week view
        const weekButton = page.locator('.fc-timeGridWeek-button');
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Find an all-day event
        const allDaySection = page.locator('.fc-daygrid-body');
        const allDayEvent = allDaySection.locator('.fc-event').first();

        if (!(await allDayEvent.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No all-day events found');
          return;
        }

        // Get the task title before drag
        const taskTitle = await allDayEvent.locator('.fc-event-title').textContent();
        console.log(`Testing with task: ${taskTitle}`);

        // Perform the drag to a time slot (similar to previous test)
        const eventBox = await allDayEvent.boundingBox();
        const timeSlots = page.locator('.fc-timegrid-slot-lane');
        const targetSlot = timeSlots.nth(20);
        const slotBox = await targetSlot.boundingBox();

        if (eventBox && slotBox) {
          await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, {
            steps: 20,
          });
          await page.mouse.up();
          await page.waitForTimeout(500);
        }

        // After implementation, verify the task's scheduled property has a time component
        // This would require reading the task file or checking the event's data attributes
        const updatedEvent = page.locator(
          `.fc-event:has-text("${taskTitle}"), .fc-timegrid-event:has-text("${taskTitle}")`
        );

        if (await updatedEvent.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check if the event is now in the timed grid (not all-day)
          const isTimedEvent = await updatedEvent.evaluate((el) =>
            el.closest('.fc-timegrid-body')
          );
          expect(isTimedEvent).toBeTruthy();
        }
      }
    );

    test.fixme(
      'reproduces issue #1119 - drag all-day to time should work in day view',
      async () => {
        /**
         * The same functionality should work in day view (timeGridDay).
         */
        const page = app.page;

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

        // Verify day view is active
        const timeGrid = page.locator('.fc-timegrid');
        await expect(timeGrid).toBeVisible({ timeout: 5000 });

        // Find all-day event
        const allDaySection = page.locator('.fc-daygrid-body');
        const allDayEvent = allDaySection.locator('.fc-event').first();

        if (!(await allDayEvent.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No all-day events in day view');
          return;
        }

        // Drag to time slot
        const eventBox = await allDayEvent.boundingBox();
        const timeSlots = page.locator('.fc-timegrid-slot-lane');
        const targetSlot = timeSlots.nth(18); // ~9:00 AM
        const slotBox = await targetSlot.boundingBox();

        if (eventBox && slotBox) {
          await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, {
            steps: 15,
          });
          await page.mouse.up();
          await page.waitForTimeout(500);
        }

        // Verify event moved to timed section
        const timedEvents = page.locator('.fc-timegrid-event');
        const count = await timedEvents.count();
        console.log(`Timed events in day view: ${count}`);
        expect(count).toBeGreaterThan(0);
      }
    );
  });

  test.describe('Feature 2: Draw/click to create time blocks in day/week views', () => {
    test.fixme(
      'reproduces issue #1119 - drawing time range should directly create timeblock',
      async () => {
        /**
         * Currently, to create a time block:
         * 1. Click/drag on calendar to select time range
         * 2. Context menu appears with options
         * 3. Click "Create timeblock"
         * 4. Modal opens for title/details
         * 5. Save to create the timeblock
         *
         * Requested behavior:
         * - Option to skip context menu step
         * - Direct creation with default title or inline editing
         * - Faster workflow for power users
         *
         * This could be implemented via:
         * - Keyboard modifier (e.g., Shift+drag creates timeblock directly)
         * - Setting to change default action on drag selection
         * - Double-click to create with default title, single click for menu
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to week view
        const weekButton = page.locator('.fc-timeGridWeek-button');
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Find time slots
        const timeSlots = page.locator('.fc-timegrid-slot-lane');
        const slotCount = await timeSlots.count();

        if (slotCount < 4) {
          console.log('Not enough time slots found');
          return;
        }

        const firstSlot = timeSlots.nth(20); // ~10:00 AM
        const slotBox = await firstSlot.boundingBox();

        if (!slotBox) {
          console.log('Could not get slot bounding box');
          return;
        }

        // Test: Shift+drag to create timeblock directly (proposed behavior)
        const startX = slotBox.x + slotBox.width / 2;
        const startY = slotBox.y + slotBox.height / 2;
        const endY = startY + slotBox.height * 4; // 2-hour block

        // Hold Shift while dragging
        await page.keyboard.down('Shift');
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(startX, endY, { steps: 10 });
        await page.waitForTimeout(100);
        await page.mouse.up();
        await page.keyboard.up('Shift');

        await page.waitForTimeout(500);

        // After implementation, a timeblock should be created directly
        // Either:
        // - Timeblock appears on calendar immediately with default title
        // - Inline editing mode for title
        // - Modal opens but pre-filled and focused on title

        // Check if a timeblock was created (look for timeblock-specific elements)
        const timeblockEvent = page.locator(
          '.fc-event[data-event-type="timeblock"], ' +
            '.fc-event.tasknotes-timeblock, ' +
            '.timeblock-event'
        );

        const timeblockVisible = await timeblockEvent.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Timeblock created directly: ${timeblockVisible}`);

        // Or check if modal opened with timeblock creation
        const modal = page.locator('.modal, [role="dialog"]');
        const modalVisible = await modal.isVisible({ timeout: 1000 }).catch(() => false);

        if (modalVisible) {
          // Check if it's specifically a timeblock creation modal
          const modalTitle = await modal.locator('.modal-title, h2').textContent();
          console.log(`Modal title: ${modalTitle}`);
          await page.keyboard.press('Escape');
        }

        // This assertion documents expected behavior
        expect(timeblockVisible || modalVisible).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #1119 - should support quick timeblock creation with default title',
      async () => {
        /**
         * For rapid time blocking, users should be able to create timeblocks
         * with a default title that can be edited later.
         *
         * Expected workflow:
         * 1. Draw time range on calendar
         * 2. Timeblock created immediately with title "Timeblock" or "Untitled"
         * 3. User can click to rename later
         *
         * This bypasses the modal for faster workflow.
         */
        const page = app.page;

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

        // Draw a time range (proposed: double-click creates with default)
        const timeSlots = page.locator('.fc-timegrid-slot-lane');
        const slot = timeSlots.nth(28); // ~2:00 PM
        const slotBox = await slot.boundingBox();

        if (slotBox) {
          // Double-click to create timeblock directly
          await page.mouse.dblclick(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
          await page.waitForTimeout(500);
        }

        // After implementation, check if timeblock was created
        const newCount = await existingTimeblocks.count();
        console.log(`Timeblock count after double-click: ${newCount}`);

        // Document expected behavior: count should increase by 1
        expect(newCount).toBe(initialCount + 1);
      }
    );

    test.fixme(
      'reproduces issue #1119 - inline editing of newly created timeblock title',
      async () => {
        /**
         * After quick timeblock creation, user should be able to edit
         * the title inline without opening a modal.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to week view
        const weekButton = page.locator('.fc-timeGridWeek-button');
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Find an existing timeblock
        const timeblockEvent = page.locator('.fc-event[data-event-type="timeblock"]').first();

        if (!(await timeblockEvent.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No timeblocks found for inline editing test');
          return;
        }

        // After implementation: double-click on timeblock title should enable inline editing
        const titleElement = timeblockEvent.locator('.fc-event-title');
        if (await titleElement.isVisible()) {
          await titleElement.dblclick();
          await page.waitForTimeout(300);
        }

        // Check if inline input appeared
        const inlineInput = page.locator(
          '.fc-event input[type="text"], ' +
            '.timeblock-title-input, ' +
            '.fc-event [contenteditable="true"]'
        );

        const inlineEditingEnabled = await inlineInput.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Inline editing enabled: ${inlineEditingEnabled}`);

        // Document expected behavior
        expect(inlineEditingEnabled).toBe(true);

        // Clean up
        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Feature 3: Split task across multiple non-contiguous time blocks', () => {
    test.fixme(
      'reproduces issue #1119 - task should support multiple scheduled time blocks',
      async () => {
        /**
         * A single task should be able to occupy multiple non-contiguous time blocks.
         *
         * Use case: "Write report" task that takes 95 minutes total:
         * - 30 min in morning (9:00-9:30)
         * - 45 min in afternoon (2:00-2:45)
         * - 20 min in evening (7:00-7:20)
         *
         * Current behavior:
         * - Task has single `scheduled` datetime
         * - Duration from `timeEstimate` creates one contiguous block
         * - Time blocks are separate entities, not linked to tasks
         *
         * Expected behavior:
         * - Task can have multiple scheduled time ranges
         * - Each range appears separately on calendar
         * - All ranges are visually linked (same color, connected UI)
         * - Completing task affects all time blocks
         */
        const page = app.page;

        // Open task list to find a task
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Find a task card
        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('No tasks found');
          return;
        }

        // Get task title
        const taskTitle = await taskCard.locator('.task-card__title, .task-title').textContent();
        console.log(`Testing multi-block scheduling with task: ${taskTitle}`);

        // Open scheduled date/time modal
        const scheduledTrigger = taskCard.locator(
          '[data-property="scheduled"], ' +
            '.task-card__scheduled-date, ' +
            'button[aria-label*="schedule"]'
        );

        if (await scheduledTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledTrigger.click();
          await page.waitForTimeout(300);
        }

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('Could not open scheduling modal');
          return;
        }

        // After implementation: look for multi-timeblock UI
        const addTimeBlockButton = page.locator(
          '[data-testid="add-time-block"], ' +
            'button:has-text("Add time block"), ' +
            'button:has-text("Split time"), ' +
            '.add-timeblock-btn'
        );

        const timeBlockList = page.locator(
          '.time-blocks-list, ' +
            '[data-testid="scheduled-time-blocks"], ' +
            '.multi-timeblock-container'
        );

        const hasMultiBlockSupport =
          (await addTimeBlockButton.isVisible({ timeout: 1000 }).catch(() => false)) ||
          (await timeBlockList.isVisible({ timeout: 1000 }).catch(() => false));

        console.log(`Multi-timeblock support available: ${hasMultiBlockSupport}`);

        // After implementation, should have UI for adding multiple time blocks
        expect(hasMultiBlockSupport).toBe(true);

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #1119 - multi-block task should show on calendar at all scheduled times',
      async () => {
        /**
         * When a task has multiple time blocks scheduled, it should appear
         * on the calendar at each scheduled time.
         *
         * Visual indicators should show these are the same task:
         * - Same background color
         * - Same task title
         * - Visual connector or grouping indicator
         * - Consistent styling across all blocks
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to day view to see time blocks clearly
        const dayButton = page.locator('.fc-timeGridDay-button');
        if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dayButton.click();
          await page.waitForTimeout(500);
        }

        // After implementation: look for a task that appears multiple times
        // These would have the same task ID but different time ranges
        const scheduledEvents = page.locator('.fc-event[data-event-type="scheduled"]');
        const eventCount = await scheduledEvents.count();

        console.log(`Total scheduled events: ${eventCount}`);

        // Group events by task file path to find multi-block tasks
        const taskFilePaths: Record<string, number> = {};
        for (let i = 0; i < eventCount; i++) {
          const event = scheduledEvents.nth(i);
          const filePath = await event.getAttribute('data-file-path');
          if (filePath) {
            taskFilePaths[filePath] = (taskFilePaths[filePath] || 0) + 1;
          }
        }

        // Find tasks with multiple calendar entries
        const multiBlockTasks = Object.entries(taskFilePaths).filter(([_, count]) => count > 1);
        console.log(`Tasks with multiple time blocks: ${multiBlockTasks.length}`);

        // Document expected behavior: should have tasks with multiple entries
        // This assertion will pass once multi-block feature is implemented
        expect(multiBlockTasks.length).toBeGreaterThan(0);
      }
    );

    test.fixme(
      'reproduces issue #1119 - dragging one time block should not move others',
      async () => {
        /**
         * When a task has multiple time blocks, dragging one block should
         * only move that specific block, not all blocks for the task.
         *
         * Each time block is independent for scheduling purposes,
         * but they all belong to the same task.
         */
        const page = app.page;

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

        // Find a multi-block task (would need one to exist after implementation)
        // For this test, we'll look for events with the same file path
        const events = page.locator('.fc-event[data-event-type="scheduled"]');
        const eventCount = await events.count();

        if (eventCount < 2) {
          console.log('Need at least 2 events to test independent dragging');
          return;
        }

        // Get the first event's position
        const firstEvent = events.first();
        const firstBox = await firstEvent.boundingBox();
        const firstFilePath = await firstEvent.getAttribute('data-file-path');

        // Find another event for the same task (same file path)
        let secondEvent = null;
        for (let i = 1; i < eventCount; i++) {
          const event = events.nth(i);
          const filePath = await event.getAttribute('data-file-path');
          if (filePath === firstFilePath) {
            secondEvent = event;
            break;
          }
        }

        if (!secondEvent) {
          console.log('No multi-block task found for independent drag test');
          return;
        }

        const secondBox = await secondEvent.boundingBox();

        // Record the second event's initial position
        const secondInitialY = secondBox?.y;

        // Drag the first event to a new time
        if (firstBox) {
          const timeSlots = page.locator('.fc-timegrid-slot-lane');
          const targetSlot = timeSlots.nth(30); // Move to ~3:00 PM
          const targetBox = await targetSlot.boundingBox();

          if (targetBox) {
            await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(
              targetBox.x + targetBox.width / 2,
              targetBox.y + targetBox.height / 2,
              { steps: 15 }
            );
            await page.mouse.up();
            await page.waitForTimeout(500);
          }
        }

        // Verify the second event didn't move
        const secondNewBox = await secondEvent.boundingBox();
        const secondNewY = secondNewBox?.y;

        console.log(`Second event Y position: before=${secondInitialY}, after=${secondNewY}`);

        // The second event should remain in its original position
        expect(secondNewY).toBe(secondInitialY);
      }
    );

    test.fixme(
      'reproduces issue #1119 - completing multi-block task should mark all blocks complete',
      async () => {
        /**
         * When a task with multiple time blocks is marked as complete,
         * all time blocks should reflect the completed status.
         *
         * Expected behavior:
         * - Complete the task (checkbox, command, or status change)
         * - All calendar entries for that task update to completed style
         * - Visual indicator (strikethrough, dimmed, etc.) on all blocks
         */
        const page = app.page;

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

        // Find a scheduled event
        const event = page.locator('.fc-event[data-event-type="scheduled"]').first();
        if (!(await event.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log('No scheduled events found');
          return;
        }

        // Get the file path to find related time blocks
        const filePath = await event.getAttribute('data-file-path');
        console.log(`Testing completion for task: ${filePath}`);

        // Click event to open details
        await event.click();
        await page.waitForTimeout(300);

        // Look for complete/checkbox action
        const completeButton = page.locator(
          'button[aria-label*="complete"], ' +
            '.task-complete-btn, ' +
            '[data-action="complete"], ' +
            '.status-checkbox'
        );

        if (await completeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await completeButton.click();
          await page.waitForTimeout(500);
        }

        // After completion, all events for this task should have completed styling
        const relatedEvents = page.locator(`.fc-event[data-file-path="${filePath}"]`);
        const relatedCount = await relatedEvents.count();

        for (let i = 0; i < relatedCount; i++) {
          const relEvent = relatedEvents.nth(i);
          const hasCompletedClass = await relEvent.evaluate((el) =>
            el.classList.contains('completed') ||
            el.classList.contains('task-completed') ||
            el.classList.contains('fc-event--completed')
          );
          console.log(`Event ${i} has completed styling: ${hasCompletedClass}`);
          expect(hasCompletedClass).toBe(true);
        }
      }
    );

    test.fixme(
      'reproduces issue #1119 - total time across blocks should match time estimate',
      async () => {
        /**
         * When a task is split across multiple time blocks, the sum of all
         * block durations should match the task's time estimate.
         *
         * Example:
         * - Task timeEstimate: 95 minutes
         * - Block 1: 30 minutes (morning)
         * - Block 2: 45 minutes (afternoon)
         * - Block 3: 20 minutes (evening)
         * - Total: 95 minutes ✓
         *
         * UI should show remaining time to allocate when splitting.
         */
        const page = app.page;

        // Open task list
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskCard = page.locator('.tasknotes-task-card, .task-card').first();
        if (!(await taskCard.isVisible({ timeout: 2000 }).catch(() => false))) {
          console.log('No tasks found');
          return;
        }

        // Get time estimate
        const timeEstimateElement = taskCard.locator(
          '[data-property="timeEstimate"], ' +
            '.task-card__time-estimate, ' +
            '.time-estimate'
        );

        let timeEstimate = 0;
        if (await timeEstimateElement.isVisible({ timeout: 1000 }).catch(() => false)) {
          const text = await timeEstimateElement.textContent();
          // Parse time like "1h 30m" or "90m" or "1.5h"
          const hourMatch = text?.match(/(\d+(?:\.\d+)?)\s*h/);
          const minMatch = text?.match(/(\d+)\s*m/);
          if (hourMatch) timeEstimate += parseFloat(hourMatch[1]) * 60;
          if (minMatch) timeEstimate += parseInt(minMatch[1]);
          console.log(`Task time estimate: ${timeEstimate} minutes`);
        }

        // Open the multi-block scheduling UI
        const scheduledTrigger = taskCard.locator('[data-property="scheduled"]');
        if (await scheduledTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledTrigger.click();
          await page.waitForTimeout(300);
        }

        const modal = page.locator('.modal, [role="dialog"]');
        if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
          return;
        }

        // After implementation: look for remaining time indicator
        const remainingTimeIndicator = page.locator(
          '.remaining-time, ' +
            '[data-testid="remaining-time"], ' +
            '.time-allocation-remaining'
        );

        const hasRemainingIndicator = await remainingTimeIndicator
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        console.log(`Remaining time indicator visible: ${hasRemainingIndicator}`);

        // Document expected behavior
        expect(hasRemainingIndicator).toBe(true);

        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Integration and edge cases', () => {
    test.fixme(
      'reproduces issue #1119 - Pomodoro workflow with multiple time blocks',
      async () => {
        /**
         * Common use case: Pomodoro technique where a task is worked on
         * in 25-minute focused sessions with breaks in between.
         *
         * Scenario:
         * - Task needs ~2 hours of work
         * - User schedules 4x 25-minute Pomodoro sessions:
         *   - 9:00-9:25 (session 1)
         *   - 9:30-9:55 (session 2)
         *   - 10:30-10:55 (session 3)
         *   - 11:00-11:25 (session 4)
         *
         * This tests the ability to create non-contiguous time blocks
         * with gaps between them.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // This test documents the expected Pomodoro workflow
        console.log(
          'Pomodoro workflow: Users should be able to schedule multiple 25-minute ' +
            'sessions for a single task with breaks in between.'
        );

        // After implementation, verify that:
        // 1. A task can have 4 separate 25-minute blocks
        // 2. Blocks can have gaps (5-minute breaks)
        // 3. All blocks are visually connected as the same task
        // 4. Timer/progress tracking works across blocks

        expect(true).toBe(true); // Placeholder until implementation
      }
    );

    test.fixme(
      'reproduces issue #1119 - energy-based scheduling with morning/afternoon/evening blocks',
      async () => {
        /**
         * Use case from the issue: scheduling based on energy levels.
         *
         * Some tasks benefit from being worked on at different times
         * when energy/focus levels vary:
         * - Morning: High focus creative work
         * - Afternoon: Administrative tasks
         * - Evening: Review and wrap-up
         *
         * This tests scheduling the same task across different parts of the day.
         */
        const page = app.page;

        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Document the use case
        console.log(
          'Energy-based scheduling: A task like "Write report" should be splittable into:\n' +
            '- 30 min morning (high energy, drafting)\n' +
            '- 45 min afternoon (medium energy, writing)\n' +
            '- 20 min evening (low energy, review)'
        );

        expect(true).toBe(true); // Placeholder until implementation
      }
    );
  });
});
