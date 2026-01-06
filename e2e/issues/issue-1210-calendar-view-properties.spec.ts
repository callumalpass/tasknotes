/**
 * Issue #1210: [FR] Display properties in Calendar View
 *
 * Feature request: Allow displaying task properties (Status, Projects, etc.)
 * on calendar items in Month mode. Currently, calendar events in month/week/day
 * grid views only show the task title - no additional properties are visible.
 *
 * The list view already supports displaying properties via TaskCard, but grid
 * views (especially month mode) only render the event title.
 *
 * Implementation approaches:
 * 1. Add property display via FullCalendar's eventContent callback
 * 2. Create a compact metadata line similar to TaskCard for grid events
 * 3. Extend event tooltips to show configurable properties
 * 4. Add a settings option to select which properties appear on calendar items
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1210
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1210: Display properties in Calendar View', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1210 - calendar month view should display task properties', async () => {
    /**
     * This test verifies the feature request: displaying task properties
     * on calendar items in month mode.
     *
     * Current behavior:
     * - Calendar events in month view only show the task title
     * - No properties (Status, Projects, Tags, etc.) are visible
     *
     * Requested behavior:
     * - Calendar events should display configurable properties
     * - Properties like Status, Projects should be visible on the event item
     */
    const page = app.page;

    // Open the calendar view
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    // Verify the calendar view is visible and in month mode
    const calendarContainer = page.locator('.fc');
    await expect(calendarContainer).toBeVisible({ timeout: 10000 });

    // Verify we're in month view (dayGridMonth)
    const monthView = page.locator('.fc-dayGridMonth-view, .fc-daygrid');
    await expect(monthView).toBeVisible({ timeout: 5000 });

    // Find calendar events in the month view
    const calendarEvents = page.locator('.fc-daygrid-event, .fc-event');
    const eventCount = await calendarEvents.count();

    if (eventCount > 0) {
      const firstEvent = calendarEvents.first();

      // Currently, events only contain the title
      // The feature request is to also display properties

      // Check for property display elements that would be added by this feature
      const propertyDisplay = firstEvent.locator(
        '.tasknotes-event-properties, .event-metadata, .task-properties'
      );

      // This assertion documents the current lack of property display
      // After implementation, this should pass
      const hasProperties = await propertyDisplay.isVisible({ timeout: 2000 }).catch(() => false);

      // Feature request: properties should be visible on calendar events
      expect(hasProperties).toBe(true);

      // Specifically check for common properties mentioned in the issue
      const statusProperty = firstEvent.locator('[data-property="status"], .property-status');
      const projectsProperty = firstEvent.locator('[data-property="projects"], .property-projects');

      // These should be visible after the feature is implemented
      const hasStatus = await statusProperty.isVisible({ timeout: 1000 }).catch(() => false);
      const hasProjects = await projectsProperty.isVisible({ timeout: 1000 }).catch(() => false);

      // At least one property should be displayed
      expect(hasStatus || hasProjects).toBe(true);
    } else {
      // No events in calendar - test cannot verify the feature
      // This is acceptable for a fixme test
      console.log('No calendar events found to verify property display');
    }
  });

  test.fixme('reproduces issue #1210 - property display should be configurable', async () => {
    /**
     * The feature should allow users to configure which properties
     * are displayed on calendar events, similar to how visible properties
     * can be configured for list views in Bases.
     *
     * This test verifies that a configuration mechanism exists.
     */
    const page = app.page;

    // Open TaskNotes settings
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(500);

    // Navigate to TaskNotes settings section
    const settingsContainer = page.locator('.modal-container, .setting-item');
    await expect(settingsContainer).toBeVisible({ timeout: 5000 });

    // Look for TaskNotes in the settings sidebar
    const taskNotesTab = page.locator(
      '.vertical-tab-nav-item:has-text("TaskNotes"), ' +
      '.setting-item:has-text("TaskNotes")'
    );

    if (await taskNotesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskNotesTab.click();
      await page.waitForTimeout(500);
    }

    // Look for calendar property display settings
    // This setting should exist after the feature is implemented
    const calendarPropertySetting = page.locator(
      '.setting-item:has-text("Calendar properties"), ' +
      '.setting-item:has-text("Calendar view properties"), ' +
      '.setting-item:has-text("Event properties")'
    );

    // After implementation, there should be a setting to configure calendar properties
    const hasCalendarPropertySetting = await calendarPropertySetting
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasCalendarPropertySetting).toBe(true);

    // Close settings
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1210 - properties should display in week and day views too', async () => {
    /**
     * While the issue specifically mentions Month mode, the feature should
     * ideally work across all grid views (month, week, day) for consistency.
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

      // Check for property display in week view events
      const weekEvents = page.locator('.fc-timegrid-event, .fc-event');
      const weekEventCount = await weekEvents.count();

      if (weekEventCount > 0) {
        const firstWeekEvent = weekEvents.first();
        const weekEventProperties = firstWeekEvent.locator(
          '.tasknotes-event-properties, .event-metadata, .task-properties'
        );
        const hasWeekProperties = await weekEventProperties
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        expect(hasWeekProperties).toBe(true);
      }
    }

    // Switch to day view
    const dayButton = page.locator(
      '.fc-timeGridDay-button, button:has-text("day"), .fc-toolbar button:has-text("Day")'
    );
    if (await dayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dayButton.click();
      await page.waitForTimeout(500);

      // Check for property display in day view events
      const dayEvents = page.locator('.fc-timegrid-event, .fc-event');
      const dayEventCount = await dayEvents.count();

      if (dayEventCount > 0) {
        const firstDayEvent = dayEvents.first();
        const dayEventProperties = firstDayEvent.locator(
          '.tasknotes-event-properties, .event-metadata, .task-properties'
        );
        const hasDayProperties = await dayEventProperties
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        expect(hasDayProperties).toBe(true);
      }
    }
  });

  test.fixme('reproduces issue #1210 - property display should not overflow event bounds', async () => {
    /**
     * When displaying properties on calendar events, especially in month view
     * where space is limited, the UI should handle overflow gracefully.
     *
     * Considerations:
     * - Properties should truncate or wrap appropriately
     * - Long project names or multiple tags shouldn't break the layout
     * - The "+ more" behavior should still work when events overflow
     */
    const page = app.page;

    // Open the calendar view in month mode
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    const calendarContainer = page.locator('.fc');
    await expect(calendarContainer).toBeVisible({ timeout: 10000 });

    // Find calendar events
    const calendarEvents = page.locator('.fc-daygrid-event, .fc-event');
    const eventCount = await calendarEvents.count();

    if (eventCount > 0) {
      const firstEvent = calendarEvents.first();

      // Get the bounding box of the event
      const eventBox = await firstEvent.boundingBox();

      if (eventBox) {
        // Get the bounding box of the day cell containing the event
        const dayCell = page.locator('.fc-daygrid-day').first();
        const cellBox = await dayCell.boundingBox();

        if (cellBox) {
          // Event (including properties) should not overflow its container significantly
          // Allow some tolerance for borders/padding
          const overflowTolerance = 10;

          // Check horizontal overflow
          const eventRight = eventBox.x + eventBox.width;
          const cellRight = cellBox.x + cellBox.width;
          expect(eventRight).toBeLessThanOrEqual(cellRight + overflowTolerance);

          // Properties should use text-overflow: ellipsis or similar
          const propertyElements = firstEvent.locator(
            '.tasknotes-event-properties span, .event-metadata span'
          );
          const propCount = await propertyElements.count();

          for (let i = 0; i < Math.min(propCount, 3); i++) {
            const prop = propertyElements.nth(i);
            const overflow = await prop.evaluate((el) => {
              const style = window.getComputedStyle(el);
              return {
                textOverflow: style.textOverflow,
                overflow: style.overflow,
                whiteSpace: style.whiteSpace,
              };
            });

            // Should have ellipsis handling for overflow
            if (overflow.textOverflow !== 'ellipsis' && overflow.overflow !== 'hidden') {
              console.log(`Property element ${i} may not handle overflow properly:`, overflow);
            }
          }
        }
      }
    }
  });

  test.fixme('reproduces issue #1210 - list view already displays properties (comparison)', async () => {
    /**
     * This test documents that the list view already supports property display,
     * serving as a reference for what the month/week/day views should achieve.
     *
     * The list view uses TaskCard which has full property rendering support.
     */
    const page = app.page;

    // Open the calendar view
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    const calendarContainer = page.locator('.fc');
    await expect(calendarContainer).toBeVisible({ timeout: 10000 });

    // Switch to list view
    const listButton = page.locator(
      '.fc-listWeek-button, .fc-listMonth-button, ' +
      'button:has-text("list"), .fc-toolbar button:has-text("List")'
    );

    if (await listButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await listButton.click();
      await page.waitForTimeout(500);

      // In list view, tasks should already display properties via TaskCard
      const listEvents = page.locator('.fc-list-event, .fc-event');
      const listEventCount = await listEvents.count();

      if (listEventCount > 0) {
        // List view events should have TaskCard with metadata
        const taskCard = page.locator('.task-card, .tasknotes-task-card');
        const hasTaskCard = await taskCard.first().isVisible({ timeout: 2000 }).catch(() => false);

        // TaskCard includes property metadata line
        const metadataLine = page.locator(
          '.task-card-metadata, .task-metadata, .property-metadata'
        );
        const hasMetadata = await metadataLine.first().isVisible({ timeout: 2000 }).catch(() => false);

        // List view should already have property display working
        // This serves as reference for what grid views should achieve
        console.log(`List view - TaskCard visible: ${hasTaskCard}, Metadata visible: ${hasMetadata}`);

        // The goal is to bring similar property display to grid views
      }
    }
  });
});
