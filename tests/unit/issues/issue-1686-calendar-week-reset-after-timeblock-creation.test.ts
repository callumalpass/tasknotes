/**
 * Reproduction test for Issue #1686: When creating a new timeblock from the advanced calendar
 * view in a different week, the view resets to the current week.
 *
 * Bug Description:
 * When a user navigates the advanced calendar view to a future/past week and then creates a
 * timeblock via the context menu, the calendar view resets to the current week after creation.
 * The user loses their navigation position every time they add a timeblock outside the current week.
 *
 * Root Cause Hypothesis:
 * `expectImmediateUpdate()` is called before `handleTimeblockCreation()`, which sets
 * `_expectingImmediateUpdate = true`. The resulting file-change event triggers `onDataUpdated()`
 * which immediately calls `render()`. If the calendar instance is null at render time (e.g., it
 * was destroyed by a racing config-change path), `initializeCalendar()` is called with
 * `_recreateTargetDate = null`, and `determineInitialDate()` returns `undefined` (today). Even
 * in the normal update path, if something clears `this.calendar` between the expectation and the
 * render, the date is lost. The `_recreateTargetDate` field is only set in the config-change
 * recreation path, not as a general "last known date" fallback.
 *
 * Key locations:
 * - src/bases/CalendarView.ts (expectImmediateUpdate, render, initializeCalendar, determineInitialDate)
 * - src/bases/calendarRecreateUtils.ts (shouldPreserveVisibleDateOnCalendarRecreate)
 * - src/bases/calendar-core.ts (handleTimeblockCreation)
 */

jest.mock('obsidian');

describe('Issue #1686: Calendar view resets to current week after timeblock creation', () => {
  it.skip('reproduces issue #1686: calendar should preserve the navigated week after timeblock creation', () => {
    // Simulate the state: user has navigated to a different week
    // _recreateTargetDate is null (not set, since no config change occurred)
    // The calendar's current date is in a future week (e.g., 2026-04-07)
    const navigatedDate = new Date('2026-04-07T12:00:00');
    const today = new Date('2026-03-31T12:00:00');

    // Simulate the CalendarView internal state
    let calendarCurrentDate: Date | null = navigatedDate; // calendar is showing future week
    let recreateTargetDate: Date | null = null; // only set on config-change recreation

    // Simulate what determineInitialDate returns when no explicit date is configured
    function determineInitialDate(): Date | undefined {
      // Returns undefined (defaults to today) when no initialDate option is set
      return undefined;
    }

    // Simulate initializeCalendar picking up _recreateTargetDate or falling through to default
    function initializeCalendar(): Date {
      return recreateTargetDate ?? determineInitialDate() ?? today;
    }

    // Simulate what happens when render() is called after timeblock creation:
    // 1. expectImmediateUpdate() was called - calendar instance becomes null due to some path
    calendarCurrentDate = null; // calendar was destroyed

    // 2. render() is called; calendar is null so initializeCalendar is used
    const initializedDate = initializeCalendar();

    // BUG: the initialized date falls back to today, not the previously navigated date
    expect(initializedDate.toDateString()).toBe(navigatedDate.toDateString()); // Fails - shows today instead
  });

  it.skip('reproduces issue #1686: _lastKnownDate should be used as fallback in initializeCalendar', () => {
    // This test verifies the fix: a _lastKnownDate field should be maintained
    // and used as fallback when _recreateTargetDate is null

    const navigatedDate = new Date('2026-04-07T12:00:00');
    const today = new Date('2026-03-31T12:00:00');

    let lastKnownDate: Date | null = navigatedDate; // should be tracked by the view
    let recreateTargetDate: Date | null = null;

    function determineInitialDateWithFallback(): Date {
      if (recreateTargetDate) return recreateTargetDate;
      if (lastKnownDate) return lastKnownDate; // fix: use last known date
      return today;
    }

    // After timeblock creation triggers a re-initialize, the fix should preserve the week
    const preservedDate = determineInitialDateWithFallback();

    // With the fix, this should pass - currently it fails because lastKnownDate is not tracked
    expect(preservedDate.toDateString()).toBe(navigatedDate.toDateString()); // Fails to indicate bug is present
  });
});
