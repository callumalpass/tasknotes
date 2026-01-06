/**
 * Issue #1049: [Bug] External calendar events with custom repeating do not display in advanced calendar
 *
 * Bug Description:
 * Calendar events with custom repeating schedules synced from an external calendar
 * do not display at all in the advanced calendar view.
 *
 * Root cause analysis:
 * External calendar events (ICS subscriptions, Google Calendar, Microsoft Calendar) with
 * complex/custom RRULE recurrence patterns may not be properly expanded by the
 * ICSSubscriptionService's parseICS method, or the iterator may fail silently for
 * certain RRULE configurations.
 *
 * Potential causes:
 * 1. **Complex RRULE patterns**: Custom rules like "every 2nd Monday of the month" or
 *    "every 3rd week" may use RRULE features that the ICAL.js library's iterator
 *    doesn't handle correctly
 * 2. **BYDAY with position**: RRULE patterns like `FREQ=MONTHLY;BYDAY=2MO` (2nd Monday)
 *    or `BYDAY=-1FR` (last Friday) may not iterate properly
 * 3. **BYSETPOS usage**: Custom recurrence with BYSETPOS may not be supported
 * 4. **Silent iterator failures**: The iterator may throw or return no results for
 *    complex patterns, causing events to be silently dropped
 * 5. **Google/Microsoft API expansion**: If using OAuth-integrated calendars,
 *    `singleEvents: true` should expand recurring events, but custom patterns
 *    on the server side may have issues
 *
 * The image in the issue shows a calendar popup with a custom repeat pattern, suggesting
 * this is an ICS subscription from an external service (like iCloud, Outlook via ICS, etc.)
 * that uses advanced RRULE features.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1049
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1049: External calendar events with custom repeating schedules', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1049 - external calendar event with custom repeating should display',
    async () => {
      /**
       * This test verifies that external calendar events with custom/complex
       * repeating schedules display correctly in the calendar view.
       *
       * Preconditions:
       * - An ICS subscription is configured with recurring events
       * - At least one event uses a custom repeat pattern (e.g., "every 2nd Monday")
       *
       * Steps to reproduce:
       * 1. Open the Calendar view in Bases
       * 2. Navigate to dates where the recurring event should appear
       * 3. Verify the event instances are displayed
       *
       * Current behavior: Events with custom repeating do not appear
       * Expected behavior: Events should expand and display on their scheduled dates
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for ICS/external calendar events
      // These typically have a distinct style (read-only, different source indicator)
      const externalEvents = page.locator(
        '.fc-event[data-source="ics"], .fc-event.ics-event, .fc-event .external-event-indicator'
      );

      const externalEventCount = await externalEvents.count();
      console.log(`Found ${externalEventCount} external calendar events`);

      // Check sidebar for ICS subscription toggles
      const icsToggle = page.locator(
        '.calendar-sidebar [data-calendar-type="ics"], ' +
          '.fc-sidebar .ics-calendar-toggle, ' +
          '[aria-label*="ICS"], ' +
          '.external-calendar-toggle'
      );

      const hasICSSubscriptions = await icsToggle.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Has ICS subscriptions in sidebar: ${hasICSSubscriptions}`);

      // If there are ICS subscriptions, verify events are displaying
      // This is the core of the bug - recurring events with custom patterns don't show
      if (hasICSSubscriptions) {
        // Navigate through the calendar to find where events should be
        const todayButton = page.locator('.fc-today-button');
        if (await todayButton.isVisible().catch(() => false)) {
          await todayButton.click();
          await page.waitForTimeout(500);
        }

        // Check for any events on the calendar
        const allEvents = page.locator('.fc-event');
        const totalEventCount = await allEvents.count();

        console.log(`Total events visible: ${totalEventCount}`);

        // For a recurring event with custom pattern, there should be multiple instances
        // If zero, this indicates the bug where custom patterns aren't being expanded
        expect(totalEventCount).toBeGreaterThan(0);
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - RRULE with BYDAY position (2nd Monday) should expand',
    async () => {
      /**
       * Tests a specific common custom pattern: "every 2nd Monday of the month"
       * RRULE format: FREQ=MONTHLY;BYDAY=2MO
       *
       * This pattern specifies the 2nd Monday of each month, which requires
       * the ICAL.js iterator to handle BYDAY with position prefix.
       */
      const page = app.page;

      // This test documents that BYDAY with position prefix should work
      // After the bug is fixed, events like "2nd Monday of month" should display

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to month view to see the pattern
      const monthButton = page.locator(
        '.fc-dayGridMonth-button, button:has-text("month"), .fc-toolbar button:has-text("Month")'
      );
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // In month view, look for events on the 2nd Monday cells
      // The 2nd Monday is between day 8-14 of the month
      const monthGrid = page.locator('.fc-daygrid-body');
      await expect(monthGrid).toBeVisible({ timeout: 5000 });

      // Count events in the calendar
      const calendarEvents = page.locator('.fc-event');
      const eventCount = await calendarEvents.count();

      console.log(`Events visible in month view: ${eventCount}`);

      // Document expected behavior:
      // - Events with BYDAY=2MO should appear on the 2nd Monday of each visible month
      // - If eventCount is 0 when ICS subscription exists with this pattern, bug is present

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - RRULE with BYSETPOS should expand',
    async () => {
      /**
       * Tests another common custom pattern using BYSETPOS
       * RRULE format: FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2
       *
       * This is an alternative way to specify "2nd Monday" that uses BYSETPOS
       * to select the 2nd occurrence from the set of all Mondays in the month.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Document that BYSETPOS patterns should work after fix
      console.log('Testing BYSETPOS recurrence pattern support');
      console.log('RRULE: FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2');
      console.log('Expected: Events on 2nd Monday of each month');

      // After fix, events using BYSETPOS should display correctly
      const events = page.locator('.fc-event');
      const eventCount = await events.count();
      console.log(`Events found: ${eventCount}`);

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - RRULE with negative BYDAY (last Friday) should expand',
    async () => {
      /**
       * Tests custom pattern: "last Friday of the month"
       * RRULE format: FREQ=MONTHLY;BYDAY=-1FR
       *
       * The -1 position prefix means "last occurrence" which requires
       * special handling in the iterator.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Document that negative position BYDAY patterns should work
      console.log('Testing negative position BYDAY pattern support');
      console.log('RRULE: FREQ=MONTHLY;BYDAY=-1FR');
      console.log('Expected: Events on last Friday of each month');

      const events = page.locator('.fc-event');
      const eventCount = await events.count();
      console.log(`Events found: ${eventCount}`);

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - RRULE with INTERVAL (every 2 weeks) should expand',
    async () => {
      /**
       * Tests custom pattern with INTERVAL: "every 2 weeks"
       * RRULE format: FREQ=WEEKLY;INTERVAL=2
       *
       * The INTERVAL property should correctly skip occurrences.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view for better visibility
      const weekButton = page.locator(
        '.fc-timeGridWeek-button, button:has-text("week"), .fc-toolbar button:has-text("Week")'
      );
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Document that INTERVAL patterns should work
      console.log('Testing INTERVAL recurrence pattern support');
      console.log('RRULE: FREQ=WEEKLY;INTERVAL=2');
      console.log('Expected: Events every 2 weeks');

      const events = page.locator('.fc-event');
      const eventCount = await events.count();
      console.log(`Events found: ${eventCount}`);

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - ICS iterator should not fail silently on complex RRULE',
    async () => {
      /**
       * This test documents that the ICS parsing should handle iterator failures
       * gracefully rather than silently dropping events.
       *
       * The parseICS method in ICSSubscriptionService.ts uses:
       * ```typescript
       * const iterator = event.iterator(startDate);
       * while ((occurrence = iterator.next()) && instanceCount < maxInstances) {
       *   // Process occurrence
       * }
       * ```
       *
       * If iterator.next() throws or returns undefined for complex patterns,
       * the event is silently not added to the results.
       *
       * Fix should:
       * 1. Add error handling around iterator operations
       * 2. Log warnings when patterns can't be expanded
       * 3. Fall back to showing the base event if expansion fails
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // Open developer console to check for warnings
      // After fix, there should be logged warnings for unsupported patterns

      console.log('Testing iterator error handling');
      console.log('Expected: Warnings logged for unsupported patterns');
      console.log('Expected: Base event shown as fallback');

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - Google Calendar custom recurring should expand via API',
    async () => {
      /**
       * Tests that Google Calendar events with custom recurring patterns
       * are properly expanded when using the OAuth integration.
       *
       * Google Calendar API uses `singleEvents: true` parameter which should
       * expand recurring events server-side. However, there may be edge cases
       * where certain custom patterns don't expand correctly.
       *
       * This is distinct from ICS subscriptions because Google handles
       * the expansion rather than the local ICAL.js library.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Check for Google Calendar in sidebar
      const googleCalendarToggle = page.locator(
        '.calendar-sidebar [data-calendar-type="google"], ' +
          '.google-calendar-toggle, ' +
          '[aria-label*="Google"]'
      );

      const hasGoogleCalendar = await googleCalendarToggle.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Has Google Calendar integration: ${hasGoogleCalendar}`);

      if (hasGoogleCalendar) {
        // Google Calendar events should appear expanded
        const googleEvents = page.locator('.fc-event[data-source="google"], .fc-event.google-event');
        const googleEventCount = await googleEvents.count();
        console.log(`Google Calendar events visible: ${googleEventCount}`);
      }

      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #1049 - verify recurring event instances have correct dates',
    async () => {
      /**
       * When a recurring event DOES display, verify that instances
       * appear on the correct dates according to the RRULE pattern.
       *
       * This ensures that even when events display, they're on the
       * right dates (not just the original date repeated).
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to month view to see multiple instances
      const monthButton = page.locator(
        '.fc-dayGridMonth-button, button:has-text("month"), .fc-toolbar button:has-text("Month")'
      );
      if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthButton.click();
        await page.waitForTimeout(500);
      }

      // Find all events and check their dates
      const events = page.locator('.fc-event');
      const eventCount = await events.count();

      if (eventCount > 0) {
        // Get the dates where events appear
        const eventDates: string[] = [];
        for (let i = 0; i < Math.min(eventCount, 10); i++) {
          const event = events.nth(i);
          // Events in day grid cells inherit the date from their parent cell
          const parentCell = event.locator('xpath=ancestor::td[@data-date]');
          const dateAttr = await parentCell.getAttribute('data-date').catch(() => null);
          if (dateAttr) {
            eventDates.push(dateAttr);
          }
        }

        console.log('Event dates found:', eventDates);

        // For a custom repeating event (e.g., 2nd Monday), verify the pattern
        // The dates should follow the expected pattern
        if (eventDates.length >= 2) {
          // If dates exist, they should be on the correct pattern days
          console.log('Multiple instances found - verify pattern consistency');
        }
      }

      await page.keyboard.press('Escape');
    }
  );
});
