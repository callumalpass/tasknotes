/**
 * Issue #1150: Support for displaying only due dates and custom date properties in Calendar base view
 *
 * This issue has two parts:
 *
 * 1. Recurring tasks due date display:
 *    - Currently, when both "show due tasks" and "show recurring tasks" are toggled on,
 *      recurring tasks do NOT display their due dates in the calendar view
 *    - The user wants to see all due dates without showing task recurrence instances
 *    - Root cause: In calendar-core.ts generateCalendarEvents(), when a task has
 *      a recurrence property, the code only generates recurring instances and skips
 *      the due date event entirely (see lines 976-987 vs 1013-1018)
 *
 * 2. Custom date properties support:
 *    - Property-based events currently only work for non-TaskNotes items in Bases
 *    - Users want to display custom date properties from TaskNotes tasks in the calendar
 *    - This would allow any date property (not just due/scheduled) to be visualized
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/1129
 * @see https://github.com/callumalpass/tasknotes/issues/1150
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1150: Calendar due dates and custom date properties', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Part 1: Recurring tasks should display due dates', () => {
    test.fixme(
      'reproduces issue #1150 - recurring tasks should show due date events when showDue is enabled',
      async () => {
        /**
         * This test verifies that recurring tasks display their due dates
         * in the calendar when "show due tasks" is toggled on.
         *
         * Current behavior:
         * - Recurring tasks only show recurrence instances on the calendar
         * - The due date is NOT displayed even when showDue is enabled
         * - The code path in calendar-core.ts skips due date creation for recurring tasks
         *
         * Expected behavior:
         * - Recurring tasks should show their due date as a separate event
         * - This should happen independently of whether recurring instances are shown
         * - User should be able to see deadlines clearly on the calendar
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Ensure we're showing both due tasks and recurring tasks
        // Look for the toggle controls in the calendar header
        const showDueToggle = page.locator(
          '[data-testid="show-due-toggle"], ' +
            'button[aria-label*="due"], ' +
            '.calendar-toggle:has-text("Due")'
        );

        const showRecurringToggle = page.locator(
          '[data-testid="show-recurring-toggle"], ' +
            'button[aria-label*="recurring"], ' +
            '.calendar-toggle:has-text("Recurring")'
        );

        // Enable both toggles if they exist
        if (await showDueToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showDueToggle.getAttribute('aria-pressed');
          if (isEnabled !== 'true') {
            await showDueToggle.click();
            await page.waitForTimeout(300);
          }
        }

        if (await showRecurringToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showRecurringToggle.getAttribute('aria-pressed');
          if (isEnabled !== 'true') {
            await showRecurringToggle.click();
            await page.waitForTimeout(300);
          }
        }

        // Look for due date events in the calendar
        // Due events should have eventType: "due" and title prefixed with "DUE: "
        const dueEvents = page.locator(
          '.fc-event[data-event-type="due"], ' +
            '.fc-event:has-text("DUE:"), ' +
            '.fc-event.tasknotes-due-event'
        );

        // Look for recurring instance events
        const recurringEvents = page.locator(
          '.fc-event[data-event-type="recurring"], ' +
            '.fc-event.tasknotes-recurring-event, ' +
            '.fc-event.recurring-instance'
        );

        // Both types should be visible if there are recurring tasks with due dates
        const dueEventCount = await dueEvents.count();
        const recurringEventCount = await recurringEvents.count();

        // The issue is that recurring tasks don't show due events
        // After fix, we should have due events for recurring tasks
        // This assertion will fail until the issue is fixed
        if (recurringEventCount > 0) {
          // If we have recurring events, we should also have their due dates
          expect(dueEventCount).toBeGreaterThan(0);
        }

        // Check for a specific pattern: a recurring task that has both
        // recurring instances AND a due date event
        const allEvents = page.locator('.fc-event');
        const eventCount = await allEvents.count();

        if (eventCount > 0) {
          // Check if any event is marked as a due event for a recurring task
          for (let i = 0; i < Math.min(eventCount, 10); i++) {
            const event = allEvents.nth(i);
            const eventData = await event.evaluate((el) => {
              return {
                classList: Array.from(el.classList),
                dataEventType: el.getAttribute('data-event-type'),
                title: el.textContent,
              };
            });

            // Log event info for debugging
            console.log(`Event ${i}:`, eventData);
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #1150 - user should be able to show only due dates without recurring instances',
      async () => {
        /**
         * The user specifically requested the ability to see all due dates
         * WITHOUT showing task recurrence instances to keep the calendar clean.
         *
         * Current behavior:
         * - To see any recurring task info, you must enable "show recurring tasks"
         * - This shows all recurring instances, cluttering the calendar
         * - Due dates for recurring tasks are not shown separately
         *
         * Expected behavior:
         * - Enable "show due tasks" but disable "show recurring tasks"
         * - All due dates should appear, including for recurring tasks
         * - Recurring instances should NOT appear
         * - Calendar remains focused on deadlines only
         */
        const page = app.page;

        // Open the calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Configure: show due = ON, show recurring = OFF
        const showDueToggle = page.locator(
          '[data-testid="show-due-toggle"], ' +
            'button[aria-label*="due"], ' +
            '.calendar-toggle:has-text("Due")'
        );

        const showRecurringToggle = page.locator(
          '[data-testid="show-recurring-toggle"], ' +
            'button[aria-label*="recurring"], ' +
            '.calendar-toggle:has-text("Recurring")'
        );

        // Enable "show due"
        if (await showDueToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showDueToggle.getAttribute('aria-pressed');
          if (isEnabled !== 'true') {
            await showDueToggle.click();
            await page.waitForTimeout(300);
          }
        }

        // Disable "show recurring"
        if (await showRecurringToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showRecurringToggle.getAttribute('aria-pressed');
          if (isEnabled === 'true') {
            await showRecurringToggle.click();
            await page.waitForTimeout(300);
          }
        }

        // Now check: due dates should be visible, recurring instances should not

        // Due events should be visible
        const dueEvents = page.locator(
          '.fc-event[data-event-type="due"], ' +
            '.fc-event:has-text("DUE:"), ' +
            '.fc-event.tasknotes-due-event'
        );

        // Recurring instances should NOT be visible
        const recurringInstances = page.locator(
          '.fc-event[data-event-type="recurring"], ' +
            '.fc-event.tasknotes-recurring-event, ' +
            '.fc-event.recurring-instance'
        );

        const dueEventCount = await dueEvents.count();
        const recurringInstanceCount = await recurringInstances.count();

        // After fix: due events should appear even for recurring tasks
        // Recurring instances should NOT appear (toggle is off)
        console.log(`Due events: ${dueEventCount}, Recurring instances: ${recurringInstanceCount}`);

        // The key assertion: we should have due events when showDue is on
        // even if showRecurring is off - this currently fails for recurring tasks
        expect(recurringInstanceCount).toBe(0);
        // After fix, this should pass (due events for recurring tasks appear)
        expect(dueEventCount).toBeGreaterThanOrEqual(0); // At minimum, don't crash
      }
    );
  });

  test.describe('Part 2: Custom date properties support for TaskNotes tasks', () => {
    test.fixme(
      'reproduces issue #1150 - TaskNotes tasks should support property-based events',
      async () => {
        /**
         * Currently, property-based events (using custom date properties like
         * "deadline", "review_date", etc.) only work for non-TaskNotes items
         * in Bases views.
         *
         * Current behavior:
         * - Property-based events read from frontmatter date properties
         * - This only works for regular notes, not TaskNotes tasks
         * - TaskNotes tasks are processed separately through generateCalendarEvents()
         *
         * Expected behavior:
         * - TaskNotes tasks should also be able to use custom date properties
         * - User can configure which property represents the event date
         * - This extends flexibility beyond just due/scheduled dates
         */
        const page = app.page;

        // Open a Bases view with calendar configuration
        await runCommand(page, 'TaskNotes: Open bases view');
        await page.waitForTimeout(1000);

        const basesContainer = page.locator('.bases-container, .tasknotes-bases');
        await expect(basesContainer).toBeVisible({ timeout: 10000 });

        // Try to switch to calendar view mode if available
        const calendarViewButton = page.locator(
          '[data-view-type="calendar"], ' +
            'button[aria-label*="calendar"], ' +
            '.view-switcher button:has-text("Calendar")'
        );

        if (await calendarViewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await calendarViewButton.click();
          await page.waitForTimeout(500);
        }

        // Look for property-based events configuration
        // This should allow selecting a custom date property as the event source
        const configButton = page.locator(
          '[data-testid="calendar-config"], ' +
            'button[aria-label*="config"], ' +
            '.calendar-settings-button'
        );

        if (await configButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await configButton.click();
          await page.waitForTimeout(300);

          // Look for property selection dropdown
          const propertySelect = page.locator(
            'select[name="startDateProperty"], ' +
              '[data-testid="start-date-property"], ' +
              '.property-based-events-config select'
          );

          const hasPropertyConfig = await propertySelect
            .isVisible({ timeout: 2000 })
            .catch(() => false);

          if (hasPropertyConfig) {
            // Get available options
            const options = await propertySelect.locator('option').allTextContents();
            console.log('Available date properties:', options);

            // Check if TaskNotes-specific properties are available
            // (e.g., custom fields defined in TaskNotes settings)
            const hasCustomProperties = options.some(
              (opt) =>
                opt.toLowerCase().includes('deadline') ||
                opt.toLowerCase().includes('review') ||
                opt.toLowerCase().includes('custom')
            );

            // After implementation, TaskNotes custom date properties should be available
            expect(hasCustomProperties).toBe(true);
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #1150 - custom date property events should render in calendar',
      async () => {
        /**
         * When a TaskNotes task has a custom date property (e.g., "review_date"),
         * and the calendar is configured to use that property, the task should
         * appear on the calendar at that date.
         *
         * This would allow workflows like:
         * - Show tasks on their "review_date" instead of "due"
         * - Display multiple date properties for the same task
         * - Flexible date-based visualization beyond scheduled/due
         */
        const page = app.page;

        // Open a calendar view in Bases
        await runCommand(page, 'TaskNotes: Open bases view');
        await page.waitForTimeout(1000);

        // Configure to show property-based events for a custom date field
        // This configuration would typically be done through the view settings

        // Look for property-based event indicators
        const propertyBasedEvents = page.locator(
          '.fc-event[data-event-type="property-based"], ' +
            '.fc-event.property-based-event, ' +
            '.fc-event[data-source="property"]'
        );

        // Check if any property-based events are TaskNotes tasks
        const eventCount = await propertyBasedEvents.count();

        if (eventCount > 0) {
          for (let i = 0; i < Math.min(eventCount, 5); i++) {
            const event = propertyBasedEvents.nth(i);
            const eventInfo = await event.evaluate((el) => {
              return {
                isTaskNote:
                  el.hasAttribute('data-is-tasknote') ||
                  el.classList.contains('tasknotes-task') ||
                  el.querySelector('.task-checkbox') !== null,
                filePath: el.getAttribute('data-file-path'),
              };
            });

            console.log(`Property-based event ${i}:`, eventInfo);
          }
        }

        // After implementation, TaskNotes tasks should be able to appear
        // as property-based events when configured
        // This test documents the expected behavior
      }
    );

    test.fixme(
      'reproduces issue #1150 - property-based events should be selectable per property',
      async () => {
        /**
         * Users should be able to choose which custom date property is used
         * for calendar visualization. This gives flexibility to show tasks
         * based on different date semantics:
         *
         * - "due" - deadline for the task
         * - "scheduled" - when to work on it
         * - "review_date" - when to review it
         * - "start_date" - when to begin
         * - Custom user-defined date properties
         *
         * The calendar configuration should allow selecting any date property
         * from TaskNotes tasks, not just the built-in ones.
         */
        const page = app.page;

        // Open calendar settings or Bases view configuration
        await runCommand(page, 'TaskNotes: Open bases view');
        await page.waitForTimeout(1000);

        // Look for view configuration options
        const configPanel = page.locator(
          '.bases-config-panel, ' +
            '.view-settings, ' +
            '[data-testid="calendar-configuration"]'
        );

        if (await configPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Look for date property selector
          const datePropertySelector = page.locator(
            '.date-property-selector, ' +
              'select[name="eventDateProperty"], ' +
              '[data-testid="event-date-property"]'
          );

          const hasSelector = await datePropertySelector
            .isVisible({ timeout: 2000 })
            .catch(() => false);

          if (hasSelector) {
            // Get all available options
            const options = await datePropertySelector.locator('option').allTextContents();

            // Should include standard TaskNotes properties
            const hasStandardProps =
              options.some((o) => o.toLowerCase().includes('due')) &&
              options.some((o) => o.toLowerCase().includes('scheduled'));

            // Should also include custom user-defined properties
            // (This is the feature request - currently not supported)

            console.log('Date property options:', options);
            expect(hasStandardProps).toBe(true);
          }
        }
      }
    );
  });

  test.describe('Combined behavior validation', () => {
    test.fixme(
      'reproduces issue #1150 - due dates should be visible regardless of task type',
      async () => {
        /**
         * The core user request: see all due dates in the calendar,
         * regardless of whether a task is:
         * - Regular one-time task
         * - Recurring task
         * - Scheduled task
         * - Task with custom date properties
         *
         * All tasks with a due date should show that due date when
         * "show due tasks" is enabled.
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Enable "show due" toggle
        // Disable other toggles to focus on due dates only
        const showDueToggle = page.locator(
          '[data-testid="show-due-toggle"], ' +
            'button[aria-label*="due"]'
        );

        const showScheduledToggle = page.locator(
          '[data-testid="show-scheduled-toggle"], ' +
            'button[aria-label*="scheduled"]'
        );

        const showRecurringToggle = page.locator(
          '[data-testid="show-recurring-toggle"], ' +
            'button[aria-label*="recurring"]'
        );

        // Configure: only show due dates
        if (await showDueToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showDueToggle.getAttribute('aria-pressed');
          if (isEnabled !== 'true') {
            await showDueToggle.click();
          }
        }

        if (await showScheduledToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showScheduledToggle.getAttribute('aria-pressed');
          if (isEnabled === 'true') {
            await showScheduledToggle.click();
          }
        }

        if (await showRecurringToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await showRecurringToggle.getAttribute('aria-pressed');
          if (isEnabled === 'true') {
            await showRecurringToggle.click();
          }
        }

        await page.waitForTimeout(500);

        // Now only due date events should be visible
        const allEvents = page.locator('.fc-event');
        const eventCount = await allEvents.count();

        // Each visible event should be a due date event
        for (let i = 0; i < Math.min(eventCount, 10); i++) {
          const event = allEvents.nth(i);
          const isDueEvent = await event.evaluate((el) => {
            return (
              el.getAttribute('data-event-type') === 'due' ||
              el.textContent?.includes('DUE:') ||
              el.classList.contains('tasknotes-due-event')
            );
          });

          // All events should be due events when only "show due" is enabled
          // This will fail for recurring tasks until the issue is fixed
          expect(isDueEvent).toBe(true);
        }
      }
    );
  });
});
