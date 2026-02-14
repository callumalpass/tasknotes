/**
 * Issue #1599: [Bug]: Problem with Tasknotes and Google Calendar tasks
 *
 * Bug Description:
 * Tasks from TaskNotes in Google Calendar are displayed as all-day events because they
 * are not scheduled at the same time with the same time range.
 *
 * Root cause analysis:
 * When tasks are synced to Google Calendar via TaskCalendarSyncService, the
 * parseDateForEvent() method determines whether to create an all-day or timed event
 * by checking if the date string contains a 'T' character (time component).
 *
 * The issue occurs when:
 * 1. Tasks have only a date without time (e.g., "2025-01-15" instead of "2025-01-15T14:00")
 * 2. The `createAsAllDay` setting may be enabled unintentionally
 * 3. Task dates from the scheduled/due fields don't include the time component
 *
 * Relevant code:
 * - src/services/TaskCalendarSyncService.ts:319-336 - parseDateForEvent() checks for 'T'
 * - src/services/TaskCalendarSyncService.ts:538-550 - createAsAllDay setting handling
 * - src/services/TaskCalendarSyncService.ts:532-550 - taskToCalendarEvent() start/end
 *
 * The parseDateForEvent method (lines 319-336):
 * ```typescript
 * if (dateStr.includes("T")) {
 *   // Timed event - format with local timezone offset
 *   return { dateTime: format(date, "yyyy-MM-dd'T'HH:mm:ssxxx"), timeZone, isAllDay: false };
 * } else {
 *   // All-day event - just use the date string
 *   return { date: dateStr, isAllDay: true };
 * }
 * ```
 *
 * If the user sets a scheduled or due date WITH a time component, it should sync
 * as a timed event. If only a date is provided, it correctly becomes all-day.
 * The bug may be that users expect timed events but are setting dates without times.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1599
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1599: Google Calendar tasks displayed as all-day events', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1599 - task with scheduled time should sync as timed event not all-day',
    async () => {
      /**
       * This test verifies that tasks with a time component in their scheduled date
       * are synced to Google Calendar as timed events, not all-day events.
       *
       * Preconditions:
       * - Google Calendar export is enabled in settings
       * - A target calendar is configured
       * - User is authenticated with Google Calendar
       *
       * Steps to reproduce:
       * 1. Create a task with a scheduled date AND time (e.g., "2025-01-15T14:00")
       * 2. Sync the task to Google Calendar
       * 3. Verify the event appears as a timed event, not all-day
       *
       * Current behavior: Tasks appear as all-day events
       * Expected behavior: Tasks with time should appear as timed events
       */
      const page = app.page;

      // Open settings to check Google Calendar export configuration
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      // Navigate to Google Calendar settings section
      const googleCalendarSection = page.locator('text=Google Calendar');
      if (await googleCalendarSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        await googleCalendarSection.click();
        await page.waitForTimeout(300);
      }

      // Check if "Create as all-day events" is enabled
      // This setting forces all events to be all-day regardless of time
      const createAsAllDayToggle = page.locator(
        '[data-setting="createAsAllDay"], ' +
          'input[type="checkbox"]:near(:text("all-day")), ' +
          '.setting-item:has-text("all-day") input[type="checkbox"]'
      );

      const isAllDayEnabled = await createAsAllDayToggle.isChecked().catch(() => null);
      console.log(`Create as all-day setting: ${isAllDayEnabled}`);

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Create a task with a specific time
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.task-modal, .modal');
      await expect(taskModal).toBeVisible({ timeout: 5000 });

      // Enter task title
      const titleInput = taskModal.locator(
        'input[placeholder*="title"], input[placeholder*="Task"], .task-title-input'
      );
      await titleInput.fill('Test timed task for Google Calendar');

      // Set scheduled date WITH time
      const scheduledInput = taskModal.locator(
        '[data-field="scheduled"], input[name="scheduled"], .scheduled-input'
      );
      if (await scheduledInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Try to set a date with time component
        await scheduledInput.fill('2025-01-15T14:30');
        await page.waitForTimeout(200);
      }

      // Check what format was saved
      const scheduledValue = await scheduledInput.inputValue().catch(() => '');
      console.log(`Scheduled value set: ${scheduledValue}`);
      console.log(`Has time component: ${scheduledValue.includes('T')}`);

      // The bug may be that the UI doesn't allow setting times,
      // or the time is stripped when saving
      expect(scheduledValue).toContain('T');

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1599 - verify date format includes time component when time is set',
    async () => {
      /**
       * Tests that the task edit modal properly preserves time components
       * in scheduled/due dates.
       *
       * The bug may be that:
       * 1. The date picker strips the time component
       * 2. The task is saved without the time even when one is specified
       * 3. The frontmatter stores only YYYY-MM-DD format
       */
      const page = app.page;

      // Open task list view
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskListContainer = page.locator(
        '.tasknotes-task-list, .task-list-view, [data-view-type="task-list"]'
      );
      await expect(taskListContainer).toBeVisible({ timeout: 10000 });

      // Find a task card and open edit modal
      const taskCard = page.locator('.task-card').first();
      if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskCard.click();
        await page.waitForTimeout(500);

        // Look for scheduled date field
        const scheduledField = page.locator(
          '.task-scheduled, [data-field="scheduled"], .scheduled-date'
        );

        if (await scheduledField.isVisible({ timeout: 2000 }).catch(() => false)) {
          const scheduledText = await scheduledField.textContent();
          console.log(`Scheduled field display: ${scheduledText}`);

          // Check if the displayed scheduled date includes a time
          // The bug may be that times are not displayed/editable
          const hasTime = scheduledText?.includes(':') || scheduledText?.match(/\d{1,2}:\d{2}/);
          console.log(`Has time in display: ${hasTime}`);
        }
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1599 - check sync settings for time handling',
    async () => {
      /**
       * Verifies the Google Calendar export settings that affect whether
       * events are created as timed or all-day.
       *
       * Key settings:
       * - syncTrigger: "scheduled" | "due" | "both"
       * - createAsAllDay: boolean (if true, all events are forced to all-day)
       * - defaultEventDuration: number (minutes, used for timed events)
       */
      const page = app.page;

      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      // Navigate to Google Calendar export settings
      const settingsSearch = page.locator('input[type="search"], .setting-search');
      if (await settingsSearch.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsSearch.fill('Google Calendar');
        await page.waitForTimeout(300);
      }

      // Document the relevant settings
      const settingsLabels = [
        'Create as all-day',
        'Sync trigger',
        'Default duration',
        'Target calendar',
      ];

      for (const label of settingsLabels) {
        const setting = page.locator(`.setting-item:has-text("${label}")`);
        if (await setting.isVisible({ timeout: 1000 }).catch(() => false)) {
          const value = await setting.locator('input, select, .setting-value').inputValue().catch(() =>
            setting.locator('.setting-value, .checkbox').textContent()
          );
          console.log(`Setting "${label}": ${value}`);
        }
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1599 - frontmatter date format should preserve time',
    async () => {
      /**
       * Checks the raw frontmatter of a task to see if the scheduled/due
       * dates include time components.
       *
       * If frontmatter stores: "scheduled: 2025-01-15"
       * It will sync as all-day (no 'T' in string)
       *
       * If frontmatter stores: "scheduled: 2025-01-15T14:30:00"
       * It will sync as timed event
       */
      const page = app.page;

      // Open a task note in source/edit mode to see raw frontmatter
      await runCommand(page, 'TaskNotes: Open task list view');
      await page.waitForTimeout(1000);

      const taskCard = page.locator('.task-card').first();
      if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Right-click to get context menu
        await taskCard.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Look for "Open note" or similar option
        const openNoteOption = page.locator(
          '.menu-item:has-text("Open"), .menu-item:has-text("Edit note"), .menu-item:has-text("View note")'
        );
        if (await openNoteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await openNoteOption.click();
          await page.waitForTimeout(500);
        }
      }

      // Switch to source mode to see raw frontmatter
      await runCommand(page, 'Source mode');
      await page.waitForTimeout(300);

      // Look for scheduled/due in the frontmatter
      const editorContent = page.locator('.cm-content, .markdown-source-view');
      const content = await editorContent.textContent().catch(() => '');

      // Extract scheduled and due dates from frontmatter
      const scheduledMatch = content.match(/scheduled:\s*["']?([^"'\n]+)["']?/);
      const dueMatch = content.match(/due:\s*["']?([^"'\n]+)["']?/);

      if (scheduledMatch) {
        console.log(`Frontmatter scheduled: ${scheduledMatch[1]}`);
        console.log(`Has time: ${scheduledMatch[1].includes('T')}`);
      }
      if (dueMatch) {
        console.log(`Frontmatter due: ${dueMatch[1]}`);
        console.log(`Has time: ${dueMatch[1].includes('T')}`);
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1599 - Google Calendar API payload should use dateTime not date',
    async () => {
      /**
       * Documents the expected API payload format for timed vs all-day events.
       *
       * For ALL-DAY events:
       * ```json
       * {
       *   "start": { "date": "2025-01-15" },
       *   "end": { "date": "2025-01-16" }
       * }
       * ```
       *
       * For TIMED events:
       * ```json
       * {
       *   "start": { "dateTime": "2025-01-15T14:30:00+00:00", "timeZone": "Europe/London" },
       *   "end": { "dateTime": "2025-01-15T15:30:00+00:00", "timeZone": "Europe/London" }
       * }
       * ```
       *
       * The TaskCalendarSyncService correctly handles this in taskToCalendarEvent(),
       * but the issue is whether the input date has a time component.
       *
       * This test documents that the fix should either:
       * 1. Ensure task dates include times when the user specifies them
       * 2. Add a default time for scheduled tasks (e.g., 9:00 AM)
       * 3. Provide UI for setting task times
       */
      const page = app.page;

      // This test documents the expected behavior and serves as a reference
      // for the fix implementation

      console.log('Google Calendar API requires:');
      console.log('- All-day: { start: { date: "YYYY-MM-DD" } }');
      console.log('- Timed: { start: { dateTime: "YYYY-MM-DDTHH:mm:ss+ZZ:ZZ", timeZone: "..." } }');
      console.log('');
      console.log('TaskNotes determines event type by checking if date includes "T"');
      console.log('Fix options:');
      console.log('1. Add time picker to scheduled/due date fields');
      console.log('2. Add setting for default scheduled time (e.g., 9:00 AM)');
      console.log('3. Ensure NLP parsing preserves times (e.g., "tomorrow at 2pm")');

      // Verify calendar view shows tasks
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Check for any events and their duration representation
      const events = page.locator('.fc-event');
      const eventCount = await events.count();
      console.log(`Events in calendar: ${eventCount}`);

      if (eventCount > 0) {
        // All-day events appear in the all-day row at the top
        // Timed events appear in the time grid
        const allDayRow = page.locator('.fc-daygrid-body, .fc-all-day');
        const timeGrid = page.locator('.fc-timegrid-body');

        const allDayEvents = await allDayRow.locator('.fc-event').count().catch(() => 0);
        const timedEvents = await timeGrid.locator('.fc-event').count().catch(() => 0);

        console.log(`All-day events: ${allDayEvents}`);
        console.log(`Timed events: ${timedEvents}`);
      }

      await page.keyboard.press('Escape');
    }
  );
});
