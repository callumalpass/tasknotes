/**
 * Issue #759: [FR] Add an end time feature to a task
 *
 * Feature request: The user wants to add an end time/date property to tasks
 * for events that span multiple hours or days. Currently, users have to
 * calculate duration in minutes and use timeEstimate, which is cumbersome
 * for events like "9am to 5pm" or multi-day events.
 *
 * Current behavior:
 * - Tasks have a `scheduled` property (date or datetime for start)
 * - Tasks have a `timeEstimate` property (duration in minutes)
 * - End time is calculated dynamically from scheduled + timeEstimate
 * - No explicit end_time property exists on TaskInfo or TaskFrontmatter
 *
 * Requested behavior:
 * - Add an explicit end_time property (YAML property "end_time")
 * - Allow users to set end date and time similar to scheduled date/time
 * - Support multi-day events by spanning from scheduled to end_time
 * - Calendar should display events from scheduled to end_time
 *
 * Use cases:
 * - Events with specific start and end times (meetings, appointments)
 * - Multi-day events (conferences, trips, projects)
 * - Events where end time is easier to specify than calculating duration
 *
 * @see https://github.com/callumalpass/tasknotes/issues/759
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #759: Add end time feature to tasks', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('End time UI in task creation/editing', () => {
    test.fixme(
      'reproduces issue #759 - task modal should have end time/date input',
      async () => {
        /**
         * The task creation and edit modals should include an end time/date
         * input field alongside the scheduled date/time input.
         *
         * Expected behavior:
         * - End time input appears in task modal
         * - End date input for multi-day events
         * - Clear relationship between scheduled (start) and end time
         * - End time must be after scheduled time
         */
        const page = app.page;

        // Open task creation modal
        await runCommand(page, 'TaskNotes: Create new task');
        await page.waitForTimeout(500);

        const modal = page.locator('.modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // After implementation, look for end time input elements
        const endTimeInput = modal.locator(
          'input[type="time"][data-property="end-time"], ' +
            '[data-testid="end-time-input"], ' +
            '.end-time-input, ' +
            'input[name="endTime"]'
        );

        const endDateInput = modal.locator(
          'input[type="date"][data-property="end-date"], ' +
            '[data-testid="end-date-input"], ' +
            '.end-date-input, ' +
            'input[name="endDate"]'
        );

        // Look for a section or label indicating end time
        const endTimeSection = modal.locator(
          '[data-testid="end-time-section"], ' +
            '.end-time-section, ' +
            'label:has-text("End time"), ' +
            'label:has-text("End date")'
        );

        const hasEndTimeUI =
          (await endTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) ||
          (await endDateInput.isVisible({ timeout: 2000 }).catch(() => false)) ||
          (await endTimeSection.isVisible({ timeout: 2000 }).catch(() => false));

        // After implementation, end time UI should be present
        expect(hasEndTimeUI).toBe(true);

        // Close modal
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #759 - should be able to set end time for same-day event',
      async () => {
        /**
         * Test setting an end time for an event that starts and ends on the same day.
         *
         * Use case: Meeting from 9:00 AM to 5:00 PM
         * - Scheduled: 2026-01-15 09:00
         * - End time: 2026-01-15 17:00
         *
         * Current workaround: timeEstimate = 480 (8 hours * 60 minutes)
         * Expected: End time input = 17:00
         */
        const page = app.page;

        // Open task creation modal
        await runCommand(page, 'TaskNotes: Create new task');
        await page.waitForTimeout(500);

        const modal = page.locator('.modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Fill in task title
        const titleInput = modal.locator('input[type="text"]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill('Test Event: 9am to 5pm');
        }

        // Set scheduled date and time
        const scheduledDateInput = modal.locator('input[type="date"]').first();
        const scheduledTimeInput = modal.locator('input[type="time"]').first();

        if (await scheduledDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateInput.fill('2026-01-15');
        }

        if (await scheduledTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledTimeInput.fill('09:00');
        }

        // After implementation: Set end time
        const endTimeInput = modal.locator(
          'input[type="time"][data-property="end-time"], ' +
            '[data-testid="end-time-input"], ' +
            '.end-time-input'
        );

        if (await endTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await endTimeInput.fill('17:00');
          await page.waitForTimeout(200);

          // Verify end time was set
          const endTimeValue = await endTimeInput.inputValue();
          expect(endTimeValue).toBe('17:00');
        }

        // Close modal without saving
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #759 - should be able to set end date for multi-day event',
      async () => {
        /**
         * Test setting an end date for a multi-day event.
         *
         * Use case: Conference spanning January 15-17, 2026
         * - Scheduled: 2026-01-15
         * - End date: 2026-01-17
         *
         * Current workaround: Using recurrence to plan across multiple days
         * Expected: End date input = 2026-01-17 (or end_time = 2026-01-17T23:59)
         */
        const page = app.page;

        // Open task creation modal
        await runCommand(page, 'TaskNotes: Create new task');
        await page.waitForTimeout(500);

        const modal = page.locator('.modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Fill in task title
        const titleInput = modal.locator('input[type="text"]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill('Multi-day Conference');
        }

        // Set scheduled date (start date)
        const scheduledDateInput = modal.locator('input[type="date"]').first();
        if (await scheduledDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateInput.fill('2026-01-15');
        }

        // After implementation: Set end date
        const endDateInput = modal.locator(
          'input[type="date"][data-property="end-date"], ' +
            '[data-testid="end-date-input"], ' +
            '.end-date-input'
        );

        if (await endDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await endDateInput.fill('2026-01-17');
          await page.waitForTimeout(200);

          // Verify end date was set
          const endDateValue = await endDateInput.inputValue();
          expect(endDateValue).toBe('2026-01-17');
        }

        // Close modal without saving
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #759 - end time validation should prevent end before start',
      async () => {
        /**
         * End time must be after the scheduled (start) time.
         * The UI should validate this and prevent invalid configurations.
         *
         * Expected behavior:
         * - If end time < start time on same day, show validation error
         * - If end date < start date, show validation error
         * - Auto-adjust or prevent saving invalid combinations
         */
        const page = app.page;

        // Open task creation modal
        await runCommand(page, 'TaskNotes: Create new task');
        await page.waitForTimeout(500);

        const modal = page.locator('.modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Set scheduled date and time
        const scheduledDateInput = modal.locator('input[type="date"]').first();
        const scheduledTimeInput = modal.locator('input[type="time"]').first();

        if (await scheduledDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledDateInput.fill('2026-01-15');
        }

        if (await scheduledTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledTimeInput.fill('17:00'); // 5pm
        }

        // Try to set end time BEFORE start time
        const endTimeInput = modal.locator(
          'input[type="time"][data-property="end-time"], ' +
            '[data-testid="end-time-input"], ' +
            '.end-time-input'
        );

        if (await endTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await endTimeInput.fill('09:00'); // 9am - before 5pm start
          await page.waitForTimeout(200);

          // Look for validation error
          const validationError = modal.locator(
            '.validation-error, ' +
              '.error-message, ' +
              '[data-testid="end-time-error"], ' +
              '.end-time-validation-error'
          );

          const hasValidationError = await validationError.isVisible({ timeout: 1000 }).catch(() => false);

          // After implementation, validation should prevent end before start
          expect(hasValidationError).toBe(true);
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('Calendar display with end time', () => {
    test.fixme(
      'reproduces issue #759 - calendar should display event spanning from scheduled to end time',
      async () => {
        /**
         * When a task has both scheduled (start) and end_time, the calendar
         * should display the event spanning the full duration.
         *
         * For a task with:
         * - scheduled: 2026-01-15 09:00
         * - end_time: 2026-01-15 17:00
         *
         * The calendar event should span from 9am to 5pm visually.
         *
         * Current behavior: Duration is calculated from timeEstimate
         * Expected behavior: Duration determined by scheduled -> end_time
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to week view to see time-based events
        const weekButton = page.locator('.fc-timeGridWeek-button, button:has-text("Week")');
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Navigate to January 2026
        const nextButton = page.locator('.fc-next-button, button[aria-label*="next"]');
        const monthTitle = page.locator('.fc-toolbar-title');

        let attempts = 0;
        while (attempts < 24) {
          const title = await monthTitle.textContent();
          if (title?.includes('January') && title?.includes('2026')) {
            break;
          }
          await nextButton.click();
          await page.waitForTimeout(200);
          attempts++;
        }

        // After implementation: Find an event with end_time
        // The event should visually span from start to end time
        const timedEvent = page.locator('.fc-timegrid-event').first();

        if (await timedEvent.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Get the event's visual height/duration
          const eventBox = await timedEvent.boundingBox();
          if (eventBox) {
            // A properly displayed 8-hour event should have significant height
            // (compared to a 30-minute default event)
            console.log(`Event height: ${eventBox.height}px`);

            // After implementation, events with end_time should be properly sized
            // This is a visual check - the event should span the correct time range
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #759 - multi-day event should span across days in calendar',
      async () => {
        /**
         * A multi-day event should display across multiple days in the calendar,
         * similar to how other calendar apps display multi-day events.
         *
         * For a task with:
         * - scheduled: 2026-01-15
         * - end_time: 2026-01-17
         *
         * The calendar should show this as a spanning event across all three days.
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to month view to see multi-day events
        const monthButton = page.locator('.fc-dayGridMonth-button, button:has-text("Month")');
        if (await monthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await monthButton.click();
          await page.waitForTimeout(500);
        }

        // Navigate to January 2026
        const nextButton = page.locator('.fc-next-button');
        const monthTitle = page.locator('.fc-toolbar-title');

        let attempts = 0;
        while (attempts < 24) {
          const title = await monthTitle.textContent();
          if (title?.includes('January') && title?.includes('2026')) {
            break;
          }
          await nextButton.click();
          await page.waitForTimeout(200);
          attempts++;
        }

        // After implementation: Look for multi-day event spanning element
        const multiDayEvent = page.locator(
          '.fc-daygrid-event.fc-event-end, ' + // Event that has an end
            '.fc-h-event:not(.fc-daygrid-dot-event)' // Horizontal spanning event
        );

        if (await multiDayEvent.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          // Get the visual width of the spanning event
          const eventBox = await multiDayEvent.first().boundingBox();
          if (eventBox) {
            console.log(`Multi-day event width: ${eventBox.width}px`);

            // A 3-day event should span approximately 3 cells worth
            // This documents expected visual behavior
          }
        }
      }
    );
  });

  test.describe('End time data model and persistence', () => {
    test.fixme(
      'reproduces issue #759 - end_time property should persist in frontmatter',
      async () => {
        /**
         * The end_time property should be stored in the task's frontmatter.
         *
         * Expected YAML structure:
         * ---
         * title: Meeting
         * scheduled: 2026-01-15T09:00:00
         * end_time: 2026-01-15T17:00:00
         * ---
         *
         * Or for multi-day events:
         * ---
         * title: Conference
         * scheduled: 2026-01-15
         * end_time: 2026-01-17
         * ---
         *
         * The end_time property should follow the same format conventions
         * as the scheduled property (ISO datetime or date string).
         */
        const page = app.page;

        // This test documents the expected data model behavior
        // After implementation:
        // 1. Create a task with end_time
        // 2. Read the file to verify frontmatter structure
        // 3. Reload and verify the property persists

        console.log(
          'Expected frontmatter property: end_time\n' +
            'Format: ISO datetime (2026-01-15T17:00:00) or date (2026-01-15)\n' +
            'Should follow same conventions as scheduled property'
        );

        // Placeholder - actual implementation would verify file contents
        expect(true).toBe(true);
      }
    );

    test.fixme(
      'reproduces issue #759 - end_time should be customizable via field mapping',
      async () => {
        /**
         * Like other task properties, end_time should be customizable via
         * the field mapping settings.
         *
         * Users should be able to rename "end_time" to their preferred
         * YAML property name (e.g., "endTime", "end", "finish_time").
         *
         * This aligns with existing field mapping support for:
         * - scheduled (customizable)
         * - timeEstimate (customizable)
         * - etc.
         */
        const page = app.page;

        // Open settings
        await runCommand(page, 'TaskNotes: Open settings');
        await page.waitForTimeout(500);

        // Navigate to field mapping section
        const fieldMappingSection = page.locator(
          '[data-testid="field-mapping-settings"], ' +
            '.field-mapping-section, ' +
            'text=Field Mapping'
        );

        if (await fieldMappingSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fieldMappingSection.click();
          await page.waitForTimeout(300);

          // After implementation, look for end_time field mapping option
          const endTimeMapping = page.locator(
            'input[data-field="end_time"], ' +
              'input[name="endTime"], ' +
              '[data-testid="end-time-field-mapping"]'
          );

          const hasEndTimeMapping = await endTimeMapping.isVisible({ timeout: 2000 }).catch(() => false);

          // After implementation, end_time should have field mapping option
          expect(hasEndTimeMapping).toBe(true);
        }

        // Close settings
        await page.keyboard.press('Escape');
      }
    );
  });

  test.describe('End time interaction with existing features', () => {
    test.fixme(
      'reproduces issue #759 - end_time should work alongside timeEstimate',
      async () => {
        /**
         * When both end_time and timeEstimate are present, the behavior should be:
         * 1. end_time takes precedence for display duration
         * 2. timeEstimate can still be used for time tracking purposes
         * 3. Clear UX for which property controls display vs. estimates
         *
         * Or alternatively:
         * - One property is calculated from the other
         * - Setting end_time auto-calculates timeEstimate (and vice versa)
         */
        const page = app.page;

        // Open task creation modal
        await runCommand(page, 'TaskNotes: Create new task');
        await page.waitForTimeout(500);

        const modal = page.locator('.modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Set scheduled time
        const scheduledTimeInput = modal.locator('input[type="time"]').first();
        if (await scheduledTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduledTimeInput.fill('09:00');
        }

        // Set end time
        const endTimeInput = modal.locator(
          'input[type="time"][data-property="end-time"], ' +
            '[data-testid="end-time-input"]'
        );

        if (await endTimeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await endTimeInput.fill('17:00'); // 8 hours later
          await page.waitForTimeout(300);

          // Check if timeEstimate was auto-calculated
          const timeEstimateInput = modal.locator(
            'input[data-property="timeEstimate"], ' +
              '[data-testid="time-estimate-input"], ' +
              '.time-estimate-input'
          );

          if (await timeEstimateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            const estimateValue = await timeEstimateInput.inputValue();
            console.log(`Auto-calculated timeEstimate: ${estimateValue}`);

            // If end_time auto-calculates timeEstimate, it should be 480 (8 hours * 60 minutes)
            // This behavior may vary based on implementation decision
          }
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #759 - dragging event end in calendar should update end_time',
      async () => {
        /**
         * In calendar week view, users should be able to drag the bottom edge
         * of an event to resize it, which should update the end_time property.
         *
         * This is a common calendar interaction pattern (Google Calendar, Outlook, etc.).
         */
        const page = app.page;

        // Open calendar view
        await runCommand(page, 'TaskNotes: Open calendar view');
        await page.waitForTimeout(1000);

        const calendarContainer = page.locator('.fc');
        await expect(calendarContainer).toBeVisible({ timeout: 10000 });

        // Switch to week view for time-based event manipulation
        const weekButton = page.locator('.fc-timeGridWeek-button');
        if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weekButton.click();
          await page.waitForTimeout(500);
        }

        // Find a timed event
        const timedEvent = page.locator('.fc-timegrid-event').first();

        if (await timedEvent.isVisible({ timeout: 2000 }).catch(() => false)) {
          const eventBox = await timedEvent.boundingBox();
          if (eventBox) {
            // Find the resize handle at the bottom of the event
            const resizeHandle = timedEvent.locator(
              '.fc-event-resizer-end, ' + '.fc-event-resizer'
            );

            if (await resizeHandle.isVisible({ timeout: 1000 }).catch(() => false)) {
              const handleBox = await resizeHandle.boundingBox();
              if (handleBox) {
                // Drag the resize handle down to extend the event
                await page.mouse.move(
                  handleBox.x + handleBox.width / 2,
                  handleBox.y + handleBox.height / 2
                );
                await page.mouse.down();
                await page.mouse.move(
                  handleBox.x + handleBox.width / 2,
                  handleBox.y + handleBox.height / 2 + 50 // Drag down 50px
                );
                await page.mouse.up();

                await page.waitForTimeout(500);

                // After implementation, the end_time should be updated
                // The event should have a new, longer duration
                console.log('Event resized - end_time should be updated');
              }
            }
          }
        }
      }
    );

    test.fixme(
      'reproduces issue #759 - end_time should support filtering',
      async () => {
        /**
         * Users should be able to filter tasks by end_time, similar to
         * filtering by scheduled or due date.
         *
         * Filter operations:
         * - end_time is [date]
         * - end_time is before [date]
         * - end_time is after [date]
         * - end_time is on-or-before [date]
         * - end_time is on-or-after [date]
         * - end_time is empty (no end time set)
         * - end_time is not empty (has end time)
         */
        const page = app.page;

        // Open task list view
        await runCommand(page, 'TaskNotes: Open task list view');
        await page.waitForTimeout(1000);

        const taskListContainer = page.locator('.tasknotes-task-list, .task-list-view');
        await expect(taskListContainer).toBeVisible({ timeout: 10000 });

        // Open filter panel
        const filterButton = page.locator(
          '[aria-label*="filter"], ' + 'button:has(.lucide-filter), ' + '.filter-button'
        );

        if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await filterButton.click();
          await page.waitForTimeout(300);

          // After implementation: Look for end_time as a filterable property
          const filterPropertySelect = page.locator(
            'select.filter-property, ' + '[data-testid="filter-property-select"]'
          );

          if (await filterPropertySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
            await filterPropertySelect.click();
            await page.waitForTimeout(200);

            // Look for end_time option
            const endTimeOption = page.locator(
              'option[value="end_time"], ' +
                'option:has-text("End time"), ' +
                '[data-value="end_time"]'
            );

            const hasEndTimeFilter = await endTimeOption
              .isVisible({ timeout: 1000 })
              .catch(() => false);

            // After implementation, end_time should be a filterable property
            expect(hasEndTimeFilter).toBe(true);
          }
        }
      }
    );
  });
});
