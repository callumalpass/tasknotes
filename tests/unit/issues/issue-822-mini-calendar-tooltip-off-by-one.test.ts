/**
 * Test for GitHub Issue #822: Mini Calendar offset by one day
 *
 * Bug Description:
 * When selecting October 2nd in the mini calendar, the tooltip shows October 1st.
 * This also links over to the Notes view - when October 2nd is selected,
 * the Notes view shows October 1st.
 *
 * Root Cause Analysis:
 * The mini calendar uses UTC-anchored dates (e.g., 2025-10-02T00:00:00.000Z)
 * but formats them using date-fns `format()` function which interprets the date
 * in the user's local timezone. In timezones behind UTC (e.g., UTC-5, UTC-7),
 * this causes the date to appear as the previous day.
 *
 * For example:
 * - UTC date: 2025-10-02T00:00:00.000Z (midnight UTC on Oct 2)
 * - In UTC-7 timezone: This is Oct 1 at 5:00 PM
 * - format(date, "EEEE, MMMM d, yyyy") returns "Wednesday, October 1, 2025"
 *
 * The fix requires using UTC-aware formatting for UTC-anchored dates.
 */

import { format } from 'date-fns';

describe('Issue #822: Mini Calendar Tooltip Off-by-One Bug', () => {
  // Store original timezone
  const originalTZ = process.env.TZ;

  afterEach(() => {
    // Restore original timezone
    if (originalTZ) {
      process.env.TZ = originalTZ;
    } else {
      delete process.env.TZ;
    }
  });

  describe('Bug Reproduction', () => {
    it('should demonstrate the tooltip off-by-one bug in UTC-7 timezone (Pacific)', () => {
      // Simulate Pacific timezone (UTC-7 during PDT)
      process.env.TZ = 'America/Los_Angeles';

      // Create a UTC-anchored date for October 2nd (as used in mini calendar)
      const utcDate = new Date(Date.UTC(2025, 9, 2)); // October 2, 2025 00:00 UTC

      console.log('UTC Date:', utcDate.toISOString());
      console.log('Expected: October 2, 2025');

      // This is what the current buggy code does
      const buggyTooltip = format(utcDate, 'EEEE, MMMM d, yyyy');
      console.log('Buggy tooltip:', buggyTooltip);

      // In Pacific timezone, UTC midnight becomes the previous day
      expect(buggyTooltip).toBe('Wednesday, October 1, 2025'); // BUG!
      expect(buggyTooltip).not.toBe('Thursday, October 2, 2025'); // What it should be
    });

    it('should demonstrate the bug in UTC-5 timezone (Eastern)', () => {
      // Simulate Eastern timezone (UTC-5 during EDT)
      process.env.TZ = 'America/New_York';

      const utcDate = new Date(Date.UTC(2025, 9, 2)); // October 2, 2025 00:00 UTC

      console.log('UTC Date:', utcDate.toISOString());
      console.log('Expected: October 2, 2025');

      const buggyTooltip = format(utcDate, 'EEEE, MMMM d, yyyy');
      console.log('Buggy tooltip:', buggyTooltip);

      // In Eastern timezone, UTC midnight is 8 PM previous day (EDT) or 7 PM (EST)
      expect(buggyTooltip).toBe('Wednesday, October 1, 2025'); // BUG!
    });

    it('should NOT have the bug in UTC timezone', () => {
      // In UTC timezone, the bug doesn't occur
      process.env.TZ = 'UTC';

      const utcDate = new Date(Date.UTC(2025, 9, 2));

      const tooltip = format(utcDate, 'EEEE, MMMM d, yyyy');
      console.log('Tooltip in UTC:', tooltip);

      // Works correctly in UTC
      expect(tooltip).toBe('Thursday, October 2, 2025');
    });
  });

  describe('Bug Impact on Different Calendar Days', () => {
    it('should show off-by-one error for all days in UTC-7', () => {
      process.env.TZ = 'America/Los_Angeles';

      const testDays = [
        { date: new Date(Date.UTC(2025, 9, 1)), expected: 'October 1', buggy: 'September 30' },
        { date: new Date(Date.UTC(2025, 9, 2)), expected: 'October 2', buggy: 'October 1' },
        { date: new Date(Date.UTC(2025, 9, 15)), expected: 'October 15', buggy: 'October 14' },
        { date: new Date(Date.UTC(2025, 9, 31)), expected: 'October 31', buggy: 'October 30' },
      ];

      testDays.forEach(({ date, expected, buggy }) => {
        const buggyFormat = format(date, 'MMMM d');
        console.log(`UTC: ${date.toISOString()} | Expected: ${expected} | Buggy: ${buggyFormat}`);
        expect(buggyFormat).toBe(buggy);
        expect(buggyFormat).not.toBe(expected);
      });
    });
  });

  describe('Solution Approaches', () => {
    it('Solution 1: Convert UTC components to local date for formatting', () => {
      process.env.TZ = 'America/Los_Angeles';

      const utcDate = new Date(Date.UTC(2025, 9, 2));

      // Extract UTC components and create local date for formatting
      const year = utcDate.getUTCFullYear();
      const month = utcDate.getUTCMonth();
      const day = utcDate.getUTCDate();

      // Create a local date with these components for formatting
      const localDate = new Date(year, month, day);
      const correctTooltip = format(localDate, 'EEEE, MMMM d, yyyy');
      console.log('Correct tooltip using local date with UTC components:', correctTooltip);

      expect(correctTooltip).toBe('Thursday, October 2, 2025');
    });

    it('Solution 2: Use helper function convertUTCToLocalCalendarDate', () => {
      process.env.TZ = 'America/Los_Angeles';

      const utcDate = new Date(Date.UTC(2025, 9, 2));

      // This is the recommended approach - use the existing helper from dateUtils
      function convertUTCToLocalCalendarDate(utcDate: Date): Date {
        const year = utcDate.getUTCFullYear();
        const month = utcDate.getUTCMonth();
        const day = utcDate.getUTCDate();
        return new Date(year, month, day);
      }

      const localDate = convertUTCToLocalCalendarDate(utcDate);
      const correctTooltip = format(localDate, 'EEEE, MMMM d, yyyy');
      console.log('Correct tooltip using helper function:', correctTooltip);

      expect(correctTooltip).toBe('Thursday, October 2, 2025');
    });

    it('Solution 3: Format manually using UTC components', () => {
      process.env.TZ = 'America/Los_Angeles';

      const utcDate = new Date(Date.UTC(2025, 9, 2));

      // Manual formatting using UTC methods
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const dayOfWeek = new Date(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate()
      ).getDay();
      const manualTooltip = `${dayNames[dayOfWeek]}, ${monthNames[utcDate.getUTCMonth()]} ${utcDate.getUTCDate()}, ${utcDate.getUTCFullYear()}`;
      console.log('Manual formatting:', manualTooltip);

      expect(manualTooltip).toBe('Thursday, October 2, 2025');
    });
  });

  describe('Recurring Tasks Impact', () => {
    it('should demonstrate how off-by-one affects weekday recurring tasks', () => {
      process.env.TZ = 'America/Los_Angeles';

      // User sets up a weekday recurring task
      // Task is scheduled for Thursday, October 2
      const scheduledDate = new Date(Date.UTC(2025, 9, 2)); // Thursday

      const buggyDisplay = format(scheduledDate, 'EEEE, MMMM d, yyyy');
      console.log('Scheduled for:', scheduledDate.toISOString());
      console.log('But displays as:', buggyDisplay);

      // User sees "Wednesday, October 1" instead of "Thursday, October 2"
      expect(buggyDisplay).toBe('Wednesday, October 1, 2025');

      // This explains the user's report:
      // "when I complete it for the current day it logs the correct completed date,
      // but does not increment the scheduled date to the next day"
      //
      // The completion is logged correctly, but the DISPLAY of the next scheduled
      // date appears to be one day behind, making it seem like it didn't increment
    });
  });

  describe('MiniCalendarView Specific Bug Locations', () => {
    it('should identify aria-label formatting bug at line 604', () => {
      process.env.TZ = 'America/Los_Angeles';

      const dayDate = new Date(Date.UTC(2025, 9, 2));

      // This is what happens at MiniCalendarView.ts:604
      // "aria-label": format(dayDate, "EEEE, MMMM d, yyyy")
      const ariaLabel = format(dayDate, 'EEEE, MMMM d, yyyy');

      console.log('Line 604 aria-label:', ariaLabel);
      expect(ariaLabel).toBe('Wednesday, October 1, 2025'); // BUG!
    });

    it('should identify aria-label formatting bug at line 656', () => {
      process.env.TZ = 'America/Los_Angeles';

      const dayDate = new Date(Date.UTC(2025, 9, 2));

      // This is what happens at MiniCalendarView.ts:656-657
      // "aria-label": format(dayDate, "EEEE, MMMM d, yyyy") + (isToday ? " (Today)" : "")
      const ariaLabel = format(dayDate, 'EEEE, MMMM d, yyyy');

      console.log('Line 656 aria-label:', ariaLabel);
      expect(ariaLabel).toBe('Wednesday, October 1, 2025'); // BUG!
    });

    it('should identify aria-label formatting bug at line 702', () => {
      process.env.TZ = 'America/Los_Angeles';

      const dayDate = new Date(Date.UTC(2025, 9, 2));

      // This is what happens at MiniCalendarView.ts:702
      // "aria-label": format(dayDate, "EEEE, MMMM d, yyyy")
      const ariaLabel = format(dayDate, 'EEEE, MMMM d, yyyy');

      console.log('Line 702 aria-label:', ariaLabel);
      expect(ariaLabel).toBe('Wednesday, October 1, 2025'); // BUG!
    });

    it('should identify updateSelectedDate aria-label bug at line 361', () => {
      process.env.TZ = 'America/Los_Angeles';

      const newDate = new Date(Date.UTC(2025, 9, 2));

      // This is what happens at MiniCalendarView.ts:361
      // Checks if ariaLabel.includes(format(newDate, "EEEE, MMMM d, yyyy"))
      const formattedDate = format(newDate, 'EEEE, MMMM d, yyyy');

      console.log('Line 361 format comparison:', formattedDate);
      expect(formattedDate).toBe('Wednesday, October 1, 2025'); // BUG!

      // This causes the wrong day element to be selected!
    });

    it('should identify month display bug at line 378 and 467', () => {
      process.env.TZ = 'America/Los_Angeles';

      const selectedDate = new Date(Date.UTC(2025, 9, 2));

      // This is what happens at MiniCalendarView.ts:378 and 467
      // format(this.plugin.selectedDate, "MMMM yyyy")
      const monthDisplay = format(selectedDate, 'MMMM yyyy');

      console.log('Month display:', monthDisplay);

      // For dates early in the month in negative UTC offset timezones,
      // this could show the wrong month
      expect(monthDisplay).toBe('September 2025'); // Potential BUG for Oct 1!
    });
  });
});
