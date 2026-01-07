/**
 * Issue #1072: [FR] Lock Tasks - Prevent task movement on calendar
 *
 * Feature description:
 * User requests the ability to "lock" tasks on the advanced calendar so they
 * cannot be moved via drag-and-drop. This would prevent accidental rescheduling
 * of time-sensitive tasks.
 *
 * Expected behavior:
 * - A locked task should not be draggable on the calendar
 * - Visual indicator (e.g., lock icon, different styling) for locked tasks
 * - User can toggle lock status via context menu or task edit modal
 * - Lock should apply to all calendar event types for the task:
 *   - Scheduled date events
 *   - Due date events
 *   - Time entry events
 *   - Recurring instance events
 *
 * Implementation considerations:
 * - Add a `locked` property to TaskInfo interface
 * - Check locked status in handleEventDrop() and call info.revert() if locked
 * - Set editable: false for locked tasks in handleEventDidMount()
 * - Add visual styling (.fc-event-locked CSS class)
 * - Add context menu option to toggle lock
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1072
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1072: Lock Tasks - Prevent task movement on calendar', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1072 - locked task cannot be dragged on calendar',
    async () => {
      /**
       * Core test: A task with locked: true should not be draggable.
       *
       * Steps to reproduce expected behavior:
       * 1. Create a task with a scheduled date
       * 2. Set the task as locked (via frontmatter: locked: true)
       * 3. Open calendar view
       * 4. Attempt to drag the task to a different date
       * 5. Task should not move - drag should be blocked or reverted
       *
       * Current behavior: No lock feature exists
       * Expected behavior: Locked tasks cannot be moved via drag-and-drop
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view for better drag testing
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Find a task event on the calendar
      // Task events have class fc-event and contain task info in extendedProps
      const taskEvents = page.locator('.fc-event[data-event-type="scheduled"], .fc-event[data-event-type="due"]');
      const eventCount = await taskEvents.count();

      if (eventCount > 0) {
        const firstEvent = taskEvents.first();
        const eventBox = await firstEvent.boundingBox();

        if (eventBox) {
          // Get initial position
          const initialY = eventBox.y;

          // Attempt to drag the event to a different time
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;
          const endY = startY + 100; // Try to move down

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Get new position
          const newEventBox = await firstEvent.boundingBox();

          // For a locked task, the position should not have changed
          // This assertion will pass once the lock feature is implemented
          // and the task being tested has locked: true
          if (newEventBox) {
            expect(newEventBox.y).toBe(initialY);
          }
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1072 - locked task shows visual indicator',
    async () => {
      /**
       * Locked tasks should have a visual indicator to show they are locked.
       * This could be a lock icon overlay, different border style, or CSS class.
       *
       * Expected behavior:
       * - Locked tasks have .fc-event-locked CSS class
       * - Visual differentiation (lock icon, opacity, border style)
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for locked task indicator
      // Once implemented, locked tasks should have a distinguishing class or element
      const lockedEvents = page.locator('.fc-event-locked, .fc-event[data-locked="true"]');
      const lockedCount = await lockedEvents.count();

      // This test documents the expected visual indicator
      // It will pass once locked tasks exist and have proper styling
      console.log(`Found ${lockedCount} locked task events`);

      // If locked events exist, verify they have visual indicator
      if (lockedCount > 0) {
        const lockedEvent = lockedEvents.first();

        // Check for lock icon or visual indicator
        const lockIcon = lockedEvent.locator('.lock-icon, svg[data-icon="lock"], .fa-lock');
        const hasLockIcon = await lockIcon.isVisible({ timeout: 1000 }).catch(() => false);

        // At minimum, the locked class should affect styling
        const computedStyle = await lockedEvent.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            cursor: style.cursor,
            opacity: style.opacity,
          };
        });

        // Locked events should not show grab cursor
        expect(computedStyle.cursor).not.toBe('grab');
        expect(computedStyle.cursor).not.toBe('move');
      }
    }
  );

  test.fixme(
    'reproduces issue #1072 - context menu has lock/unlock option',
    async () => {
      /**
       * Users should be able to toggle lock status via the calendar context menu.
       *
       * Expected behavior:
       * - Right-click on task event shows context menu
       * - Context menu includes "Lock task" or "Unlock task" option
       * - Clicking the option toggles the locked status
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find a task event
      const taskEvents = page.locator('.fc-event');
      const eventCount = await taskEvents.count();

      if (eventCount > 0) {
        const firstEvent = taskEvents.first();

        // Right-click to open context menu
        await firstEvent.click({ button: 'right' });
        await page.waitForTimeout(500);

        // Look for the context menu
        const menu = page.locator('.menu');
        const menuVisible = await menu.isVisible({ timeout: 2000 }).catch(() => false);

        if (menuVisible) {
          // Look for lock/unlock option
          const lockOption = menu.locator('text=Lock task, text=Unlock task, text=Lock, text=Unlock');
          const hasLockOption = await lockOption.isVisible({ timeout: 1000 }).catch(() => false);

          // This assertion documents expected behavior
          expect(hasLockOption).toBe(true);

          // Clean up
          await page.keyboard.press('Escape');
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1072 - lock persists in frontmatter',
    async () => {
      /**
       * The locked status should be persisted in the task's frontmatter.
       *
       * Expected behavior:
       * - When a task is locked, frontmatter includes: locked: true
       * - When unlocked, the property is removed or set to false
       * - Lock status survives plugin reload
       */
      const page = app.page;

      // This test would verify that locking a task updates frontmatter
      // Steps:
      // 1. Create/find a task
      // 2. Lock it via context menu
      // 3. Open the task file
      // 4. Verify frontmatter contains locked: true

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find and lock a task (implementation pending)
      const taskEvents = page.locator('.fc-event');
      const eventCount = await taskEvents.count();

      if (eventCount > 0) {
        // Document the expected workflow
        console.log('Expected: Lock task via context menu, then verify frontmatter has locked: true');
      }
    }
  );

  test.fixme(
    'reproduces issue #1072 - unlocked tasks remain draggable',
    async () => {
      /**
       * Ensure the lock feature doesn't break normal drag-and-drop for unlocked tasks.
       *
       * Expected behavior:
       * - Tasks without locked: true (or locked: false) remain draggable
       * - Dragging updates the scheduled/due date as normal
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

      // Find an unlocked task event (one without .fc-event-locked class)
      const unlockedEvents = page.locator('.fc-event:not(.fc-event-locked)');
      const eventCount = await unlockedEvents.count();

      if (eventCount > 0) {
        const firstEvent = unlockedEvents.first();
        const eventBox = await firstEvent.boundingBox();

        if (eventBox) {
          const initialY = eventBox.y;

          // Drag the event
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;
          const endY = startY + 50;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Position should have changed for unlocked task
          const newEventBox = await firstEvent.boundingBox();
          if (newEventBox) {
            // This verifies unlocked tasks can still be moved
            expect(newEventBox.y).not.toBe(initialY);
          }
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #1072 - lock applies to all event types for same task',
    async () => {
      /**
       * If a task has both scheduled and due dates, locking should apply to both.
       * Similarly for time entries and recurring instances.
       *
       * Expected behavior:
       * - Locking a task locks ALL its calendar representations
       * - Scheduled event: not draggable
       * - Due event: not draggable
       * - Time entry events: not draggable
       * - Recurring instances: not draggable
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // This test documents the comprehensive lock behavior
      // Once implemented, verify that:
      // 1. All events from the same locked task have editable: false
      // 2. All events from the same locked task have .fc-event-locked class

      // Find events that share a task path
      const events = page.locator('.fc-event[data-task-path]');
      const eventCount = await events.count();

      console.log(`Found ${eventCount} events with task path data attribute`);
      console.log('Expected: All events for a locked task should be non-draggable');
    }
  );
});
