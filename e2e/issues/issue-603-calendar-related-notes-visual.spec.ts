/**
 * Issue #603: [FR] Visually identify related notes in Calendar
 *
 * @see https://github.com/callumalpass/tasknotes/issues/603
 *
 * Feature Request:
 * Calendar items (ICS events) should visually indicate whether they have
 * related notes in the vault. This should be done via:
 * 1. A CSS class (always added) for custom styling
 * 2. A configurable icon displayed on the event
 *
 * These E2E tests verify the visual indicators are present on calendar
 * events that have linked notes/tasks.
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #603: Visually identify related notes in Calendar', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #603 - ICS events with related notes should have CSS class in grid view',
    async () => {
      /**
       * In grid views (dayGridMonth, timeGridWeek, timeGridDay), ICS events
       * that have linked notes/tasks should have a 'has-related-note' CSS
       * class on their DOM element.
       *
       * Currently, handleEventDidMount() only sets data-event-type and
       * adds a calendar icon for provider events - it does not check for
       * or indicate related notes.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find ICS events in the calendar
      const icsEvents = page.locator('.fc-event[data-event-type="ics"]');
      const eventCount = await icsEvents.count();

      if (eventCount > 0) {
        // Check if any ICS events have the 'has-related-note' class
        const eventsWithRelatedNotes = page.locator(
          '.fc-event[data-event-type="ics"].has-related-note'
        );
        const relatedNoteCount = await eventsWithRelatedNotes.count();

        // After the feature is implemented, ICS events linked to vault
        // notes should have this class
        console.log(
          `ICS events: ${eventCount}, with related notes indicator: ${relatedNoteCount}`
        );

        // At least some ICS events should have the indicator if there are
        // linked notes in the test vault
        // This assertion will fail until the feature is implemented
        expect(relatedNoteCount).toBeGreaterThan(0);
      }
    }
  );

  test.fixme(
    'reproduces issue #603 - ICS events with related notes should show icon in grid view',
    async () => {
      /**
       * ICS events that have related notes should display a configurable
       * icon (e.g., a note/file icon) to make them visually distinct.
       *
       * This icon should be separate from the existing calendar provider
       * icon added in handleEventDidMount().
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Look for ICS events with related note indicators
      const eventsWithIcon = page.locator(
        '.fc-event[data-event-type="ics"].has-related-note .related-note-icon, ' +
        '.fc-event[data-event-type="ics"].has-related-note [data-icon="file-text"], ' +
        '.fc-event[data-event-type="ics"].has-related-note [data-icon="link"]'
      );

      const iconCount = await eventsWithIcon.count();

      // After the feature is implemented, events with related notes
      // should display an icon
      expect(iconCount).toBeGreaterThan(0);
    }
  );

  test.fixme(
    'reproduces issue #603 - ICS events without related notes should not have indicator',
    async () => {
      /**
       * ICS events that have NO linked notes/tasks should NOT have the
       * 'has-related-note' class or the related note icon.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Find all ICS events
      const allIcsEvents = page.locator('.fc-event[data-event-type="ics"]');
      const totalCount = await allIcsEvents.count();

      // Find ICS events with related note indicator
      const withRelatedNotes = page.locator(
        '.fc-event[data-event-type="ics"].has-related-note'
      );
      const withIndicatorCount = await withRelatedNotes.count();

      // Not all ICS events should have the indicator (assuming test vault
      // has some ICS events without linked notes)
      if (totalCount > 0) {
        expect(withIndicatorCount).toBeLessThan(totalCount);
      }
    }
  );

  test.fixme(
    'reproduces issue #603 - ICSCard in list view should indicate related notes',
    async () => {
      /**
       * In list view (listWeek), ICS events are rendered using ICSCard
       * components. These cards should also show a related note indicator.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to list view
      const listButton = page.locator(
        '.fc-listWeek-button, button:has-text("list"), .fc-toolbar button:has-text("List")'
      );
      if (await listButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await listButton.click();
        await page.waitForTimeout(500);
      }

      // Find ICS cards in list view
      const icsCards = page.locator('.task-card--ics');
      const cardCount = await icsCards.count();

      if (cardCount > 0) {
        // Check if any ICS cards have a related note indicator
        const cardsWithIndicator = page.locator(
          '.task-card--ics.has-related-note, ' +
          '.task-card--ics .related-note-icon'
        );
        const indicatorCount = await cardsWithIndicator.count();

        // After the feature is implemented, cards with linked notes
        // should show the indicator
        console.log(
          `ICS cards: ${cardCount}, with related notes indicator: ${indicatorCount}`
        );
      }
    }
  );
});
