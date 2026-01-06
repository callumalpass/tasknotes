/**
 * Issue #1053: [FR] Support Calendar View for non-task notes
 *
 * Feature Request Description:
 * User wants to use the TaskNotes Calendar Base view for non-task notes (project notes)
 * that don't have a #task tag. When they try to drag a project note (without #task tag)
 * to a different scheduled time, the scheduled time does not update. However, if they
 * add the #task tag, then drag operations work correctly.
 *
 * Root cause analysis:
 * The Calendar View has two distinct code paths for handling events:
 *
 * 1. **Task events** (eventType: "scheduled" | "due"):
 *    - Built from notes that pass `isTaskFile()` validation (requires #task tag by default)
 *    - Drag updates via `plugin.taskService.updateProperty()` at CalendarView.ts:1318-1329
 *    - These events have `taskInfo` in extendedProps
 *
 * 2. **Property-based events** (eventType: "property-based"):
 *    - Built from non-task items when `showPropertyBasedEvents` is enabled
 *    - Created in `buildPropertyBasedEvents()` at CalendarView.ts:911-977
 *    - Drag updates via direct frontmatter modification at CalendarView.ts:1143-1207
 *    - These events use `startDateProperty` and `endDateProperty` view options
 *
 * The issue is that:
 * - Non-task notes with a `scheduled` property are NOT included in property-based events
 *   unless `startDateProperty` is configured to point to the `scheduled` field
 * - They also don't appear as task events because they fail `isTaskFile()` validation
 * - Result: non-task notes with scheduled dates can appear but cannot be dragged
 *
 * Possible solutions:
 * 1. Enable `showPropertyBasedEvents` and configure `startDateProperty` to "scheduled"
 * 2. Modify task identification to include all notes with task-like frontmatter
 * 3. Allow drag updates for any note with a scheduled property, regardless of task status
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1053
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1053: Calendar View support for non-task notes', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1053 - non-task note with scheduled date cannot be dragged',
    async () => {
      /**
       * This test reproduces the core issue: dragging a non-task note (without #task tag)
       * in the calendar view does not update its scheduled date.
       *
       * Preconditions:
       * - A note exists with `scheduled` property but without #task tag
       * - The note appears in the Calendar Base view (via filter that includes it)
       *
       * Steps to reproduce:
       * 1. Open a Bases Calendar view that shows notes with scheduled dates
       * 2. Find a non-task note (no #task tag) on the calendar
       * 3. Drag the note to a different time slot
       * 4. Verify the scheduled date in the note's frontmatter
       *
       * Current behavior: The scheduled date does not update after drag
       * Expected behavior: The scheduled date should update to the new time
       */
      const page = app.page;

      // Create or ensure a non-task note exists with a scheduled date
      // This would typically be done in test setup with a test vault

      // Open a Bases Calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view for easier time slot selection
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Look for calendar events - we need to find a non-task event
      // Non-task events might have different styling or lack the task status circle
      const calendarEvents = page.locator('.fc-event');
      const eventCount = await calendarEvents.count();

      console.log(`Found ${eventCount} events on calendar`);

      if (eventCount > 0) {
        // Try to find and drag an event
        const firstEvent = calendarEvents.first();
        const eventBox = await firstEvent.boundingBox();

        if (eventBox) {
          // Record initial position
          const initialY = eventBox.y;

          // Attempt to drag the event down (to a later time)
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;
          const endY = startY + 100; // Move down ~2 hours in 30-min slot view

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Check if the event moved
          const newBox = await firstEvent.boundingBox();
          if (newBox) {
            const moved = Math.abs(newBox.y - initialY) > 10;
            console.log(`Event moved: ${moved} (initial Y: ${initialY}, new Y: ${newBox.y})`);

            // For a non-task note, the bug is that the event reverts or doesn't update
            // This assertion documents the expected behavior after fix
            expect(moved).toBe(true);
          }
        }
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1053 - task note with #task tag can be dragged successfully',
    async () => {
      /**
       * This test verifies that notes WITH the #task tag can be dragged successfully.
       * It serves as a comparison to show that drag works for tasks but not non-tasks.
       *
       * This test should pass (it documents current working behavior) while
       * the non-task test above should fail until the feature request is implemented.
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

      // Look for task events (events with task card styling)
      const taskEvents = page.locator('.fc-event .task-card, .fc-event.task-event');
      const taskEventCount = await taskEvents.count();

      console.log(`Found ${taskEventCount} task events on calendar`);

      if (taskEventCount > 0) {
        const firstTaskEvent = taskEvents.first();
        const parentEvent = firstTaskEvent.locator('..').locator('..');
        const eventBox = await parentEvent.boundingBox();

        if (eventBox) {
          const initialY = eventBox.y;

          // Drag the task event
          const startX = eventBox.x + eventBox.width / 2;
          const startY = eventBox.y + eventBox.height / 2;
          const endY = startY + 100;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(100);
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.waitForTimeout(100);
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Verify the event moved (tasks should work)
          const newBox = await parentEvent.boundingBox();
          if (newBox) {
            const moved = Math.abs(newBox.y - initialY) > 10;
            console.log(`Task event moved: ${moved}`);

            // Tasks should successfully drag - this is the working case
            expect(moved).toBe(true);
          }
        }
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1053 - property-based events can be dragged when configured',
    async () => {
      /**
       * This test verifies that property-based events (non-task notes with date properties)
       * CAN be dragged when the Calendar view is properly configured with:
       * - showPropertyBasedEvents: true
       * - startDateProperty: pointing to the scheduled/date property
       *
       * This demonstrates the workaround for the issue: configure the calendar view
       * to treat non-task notes as property-based events.
       */
      const page = app.page;

      // This test requires a Bases Calendar view configured with:
      // - showPropertyBasedEvents enabled
      // - startDateProperty set to "scheduled" or equivalent
      // Such configuration would be done through the Base view settings

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for property-based events
      // These events use accent color styling as defined in buildPropertyBasedEvents()
      const propertyEvents = page.locator('.fc-event');
      const eventCount = await propertyEvents.count();

      console.log(`Found ${eventCount} events (includes property-based if configured)`);

      // The test documents that when properly configured, property-based events
      // can be dragged and their frontmatter updates correctly

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1053 - switching task identification method enables drag for all notes',
    async () => {
      /**
       * This test documents an alternative workaround: switching from tag-based
       * task identification to property-based identification.
       *
       * If the user switches to property-based task identification with a property
       * that matches their project notes (e.g., `type: project`), then those notes
       * would be treated as tasks and drag would work.
       *
       * Settings involved:
       * - taskIdentificationMethod: "property" (instead of "tag")
       * - taskPropertyName: e.g., "type"
       * - taskPropertyValue: e.g., "task" or "project"
       */
      const page = app.page;

      // Open settings to view current task identification configuration
      await runCommand(page, 'TaskNotes: Open Settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      if (await settingsModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look for task identification settings
        const taskIdSection = settingsModal.locator('text=Task Identification, text=task identification').first();
        if (await taskIdSection.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('Found task identification settings section');
        }

        // Document the two available methods:
        // 1. Tag-based (default): Only notes with #task tag are tasks
        // 2. Property-based: Notes matching a property value are tasks

        await page.keyboard.press('Escape');
      }

      // This test serves as documentation that changing task identification
      // method is a workaround for the feature request

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1053 - verify non-task notes appear in calendar but cannot update',
    async () => {
      /**
       * This test verifies the specific symptom: non-task notes CAN appear in the
       * calendar view (when the Bases filter includes them), but dragging them
       * does NOT update their scheduled property.
       *
       * The distinction is:
       * - Notes can appear in the calendar (they match the Base query/filter)
       * - But drag operations only work for notes that pass isTaskFile() validation
       *
       * After drag, we should check the frontmatter to confirm the scheduled
       * date did NOT change (documenting the bug).
       */
      const page = app.page;

      // Open calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find events and attempt to drag
      const events = page.locator('.fc-event');
      const eventCount = await events.count();

      console.log(`Calendar shows ${eventCount} events`);
      console.log('For non-task notes, dragging may appear to work visually');
      console.log('but the underlying frontmatter scheduled date does not update');

      // The fix for this feature request should ensure that:
      // 1. Any note with a scheduled property can be dragged in calendar
      // 2. OR property-based events are automatically enabled for scheduled dates
      // 3. OR the handleEventDrop logic is updated to handle non-task notes

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1053 - handleEventDrop requires taskInfo for scheduled updates',
    async () => {
      /**
       * This test documents the technical root cause in the code.
       *
       * In CalendarView.ts handleEventDrop() (lines 1116-1335):
       *
       * ```typescript
       * // Handle normal task drops (scheduled and due dates)
       * if (taskInfo) {
       *   try {
       *     if (eventType === "scheduled" || eventType === "due") {
       *       const newDateString = ...;
       *       await this.plugin.taskService.updateProperty(taskInfo, property, newDateString);
       *     }
       *   } catch (error) { ... }
       * }
       * ```
       *
       * The `taskInfo` is only populated for notes that pass `isTaskFile()` validation.
       * Non-task notes have `taskInfo: null/undefined` so this code path is skipped.
       *
       * For property-based events (line 1143-1207), there's separate handling that
       * directly modifies frontmatter without requiring taskInfo. This works but
       * requires explicit configuration of startDateProperty.
       *
       * The feature request could be implemented by:
       * 1. Auto-configuring property-based events for scheduled dates
       * 2. Extending handleEventDrop to handle notes without taskInfo
       * 3. Relaxing isTaskFile() validation for calendar operations
       */
      const page = app.page;

      // This test serves as documentation of the code architecture
      // The actual fix would modify CalendarView.ts handleEventDrop()

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(500);

      console.log('Technical root cause documented:');
      console.log('- handleEventDrop() checks for taskInfo before updating');
      console.log('- taskInfo is null for non-task notes (no #task tag)');
      console.log('- property-based events have separate handling path');
      console.log('- Fix: extend handling to support non-task notes');

      await page.keyboard.press('Escape');
    }
  );
});
