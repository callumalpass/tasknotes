/**
 * Issue #1582: Recurring Tasks for after Sunday 15:30 do not appear on Calendar View
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1582
 *
 * Bug Description:
 * Daily recurring tasks do not appear on the Calendar view specifically starting on
 * Sunday 15:30 for users in UTC+9 timezone. The same tasks appear fine in task view,
 * agenda view, etc. Only the Calendar view has this issue.
 *
 * The user reports:
 * - All tasks in the screenshot are Daily Recurring tasks
 * - Recurring tasks auto-populate with dim, dotted line tasks but don't appear after Sunday 15:30
 * - They appear fine on task view, agenda view, etc.
 * - User is in UTC+9 timezone
 * - Obsidian Version: 1.11.7, TaskNotes Version: 4.3.2
 * - Happens on both Windows 11 and Android
 *
 * Root Cause Analysis:
 * The bug is in `generateRecurringInstances()` in src/utils/helpers.ts (lines 518-539).
 * The function creates UTC date boundaries using local timezone methods:
 *
 *   const utcStartDate = new Date(Date.UTC(
 *     startDate.getFullYear(),   // <-- Uses local timezone!
 *     startDate.getMonth(),      // <-- Uses local timezone!
 *     startDate.getDate(),       // <-- Uses local timezone!
 *     0, 0, 0, 0
 *   ));
 *
 * For a UTC+9 user:
 * - When FullCalendar passes calendar boundaries (e.g., week ending Sunday)
 * - The Date object's local components reflect the user's local time
 * - But using getFullYear/getMonth/getDate extracts LOCAL date parts
 * - Creating Date.UTC from LOCAL parts causes a 9-hour shift in the boundaries
 * - This shifts the week boundary, causing recurring tasks after a certain time to fall outside
 *
 * Why Sunday 15:30 specifically?
 * - Sunday 15:30 UTC+9 = Sunday 06:30 UTC
 * - The buggy conversion treats local Sunday as UTC Sunday
 * - But that UTC Sunday corresponds to Monday 09:00 in UTC+9
 * - This causes recurring instances after Sunday 15:30 local to be excluded from the range
 *
 * The fix should use getUTCFullYear(), getUTCMonth(), getUTCDate() instead of
 * getFullYear(), getMonth(), getDate() when creating the UTC date boundaries.
 */

import { describe, it, expect } from '@jest/globals';
import { TaskFactory } from '../../helpers/mock-factories';
import { generateRecurringInstances } from '../../../src/utils/helpers';
import { formatDateForStorage, createUTCDateForRRule } from '../../../src/utils/dateUtils';

describe('Issue #1582: Recurring Tasks for after Sunday 15:30 do not appear on Calendar View', () => {
	describe('UTC+9 timezone calendar boundary issue', () => {
		it.skip('reproduces issue #1582 - daily recurring tasks should appear for entire week in UTC+9', () => {
			// Create a daily recurring task
			const dailyTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
				id: 'daily-task-utc-plus-9',
				title: 'Daily Recurring Task',
				scheduled: '2025-01-20', // Monday
			});

			// Simulate the calendar view fetching events for a week
			// In UTC+9, the user sees Sunday ending at their local 23:59:59
			// But FullCalendar may pass boundaries that when processed incorrectly
			// cause the last portion of Sunday to be cut off

			// Week from Monday Jan 20 to Sunday Jan 26, 2025
			// Create dates as they would be received from FullCalendar in a UTC+9 browser
			// The Date objects represent midnight boundaries but may be interpreted differently

			// Simulating a date that represents Sunday Jan 26, 2025 in UTC+9 timezone
			// Sunday 23:59:59 UTC+9 = Sunday 14:59:59 UTC
			// When getDate() is called on this Date object in a UTC+9 environment,
			// it returns 26 (Sunday), but the UTC date is still 26

			// For the test, we'll create dates that expose the bug:
			// A date representing "end of Sunday" in UTC+9 that when incorrectly
			// processed becomes "start of Monday" in the UTC boundary calculation

			const weekStartUTC = new Date('2025-01-20T00:00:00.000Z'); // Monday 00:00 UTC
			const weekEndUTC = new Date('2025-01-26T23:59:59.999Z'); // Sunday 23:59 UTC

			// Generate instances - should include all 7 days of the week
			const instances = generateRecurringInstances(dailyTask, weekStartUTC, weekEndUTC);
			const dateStrings = instances.map(d => formatDateForStorage(d));

			// All 7 days should be present
			const expectedDates = [
				'2025-01-20', // Monday
				'2025-01-21', // Tuesday
				'2025-01-22', // Wednesday
				'2025-01-23', // Thursday
				'2025-01-24', // Friday
				'2025-01-25', // Saturday
				'2025-01-26', // Sunday
			];

			expectedDates.forEach(date => {
				expect(dateStrings).toContain(date);
			});

			expect(instances).toHaveLength(7);
		});

		it.skip('reproduces issue #1582 - calendar boundary shift due to local/UTC mismatch', () => {
			// This test demonstrates the specific bug mechanism
			// When generateRecurringInstances receives Date objects that represent
			// calendar boundaries, using getFullYear/getMonth/getDate extracts
			// LOCAL time components rather than UTC components

			const dailyTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
				id: 'daily-task-boundary',
				title: 'Daily Task Boundary Test',
				scheduled: '2025-01-20',
			});

			// Create a Date object that would represent Sunday 15:30 UTC+9
			// Sunday 15:30 UTC+9 = Sunday 06:30 UTC
			const sundayAfternoonUTCPlus9 = new Date('2025-01-26T06:30:00.000Z');

			// If we're in a UTC+9 environment and call getDate() on this:
			// - Local time is Sunday 15:30
			// - getDate() returns 26 (Sunday)
			// - But Date.UTC(2025, 0, 26, ...) interprets 26 as Sunday in UTC

			// The bug occurs because:
			// 1. FullCalendar might pass endDate representing "end of visible week"
			// 2. The Date object's internal timestamp is correct
			// 3. But getFullYear/getMonth/getDate extract LOCAL components
			// 4. Creating Date.UTC from LOCAL components shifts the boundary

			// For a true reproduction, we need to simulate the timezone offset
			// In a real UTC+9 browser:
			//   const localSunday = new Date('2025-01-26T15:30:00+09:00');
			//   localSunday.getDate() → 26 (local Sunday)
			//   localSunday.getUTCDate() → 26 (UTC Sunday at 06:30)

			// The buggy code does:
			//   Date.UTC(localSunday.getFullYear(), localSunday.getMonth(), localSunday.getDate(), ...)
			// This creates a UTC date for "Sunday 00:00 UTC" when it should be based on the actual UTC date

			// Simulate what happens with the buggy code path
			const testDate = new Date('2025-01-26T15:30:00.000Z'); // This is what a UTC+9 user's "Sunday 15:30" looks like in UTC

			// In UTC+9, getDate() on a Date object representing Sunday 15:30 local time
			// would return 26 (Sunday), but getUTCDate() would return 27 (Monday in UTC)
			// because Sunday 15:30 UTC+9 = Monday 00:30 UTC

			// For the purposes of this test, we verify that the date extraction
			// should use UTC methods, not local methods
			const localDate = testDate.getDate();
			const utcDate = testDate.getUTCDate();

			// In a non-UTC timezone, these would differ
			// For the bug to manifest, we need the actual mismatch

			// This test documents the expected behavior:
			// When generating instances for a calendar view, dates near week boundaries
			// should correctly include all days visible in the user's local timezone

			const weekStart = new Date('2025-01-20T00:00:00.000Z');
			const weekEnd = new Date('2025-01-27T08:59:59.999Z'); // Monday 08:59 UTC = Sunday 17:59 UTC+9

			const instances = generateRecurringInstances(dailyTask, weekStart, weekEnd);
			const dateStrings = instances.map(d => formatDateForStorage(d));

			// Sunday should still be included even though the UTC boundary extends into Monday
			expect(dateStrings).toContain('2025-01-26');
		});

		it.skip('reproduces issue #1582 - timezone offset causes missing instances near week end', () => {
			// The core issue: using local timezone methods on Date objects
			// that should be interpreted as UTC boundaries

			const dailyTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
				id: 'daily-timezone-bug',
				title: 'Daily Timezone Bug Test',
				scheduled: '2025-01-01',
			});

			// Simulate calendar view boundaries for a week as passed by FullCalendar
			// In a browser with UTC+9 offset, a Date object representing the end of Sunday
			// will have its local getDate() return Sunday, but the UTC boundary is different

			// This is the exact scenario from the issue:
			// User in UTC+9 sees calendar week Monday-Sunday
			// FullCalendar passes fetchInfo.start and fetchInfo.end
			// The end date might represent "Sunday 23:59:59 local" which is "Sunday 14:59:59 UTC"

			// When the buggy code calls:
			//   Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)
			// It creates "Sunday 23:59:59 UTC" instead of using the actual UTC components

			// For dates after Sunday 15:30 UTC+9 (= Sunday 06:30 UTC), this shift means:
			// The range ends at Sunday 23:59:59 UTC (which is Monday 08:59:59 UTC+9)
			// But the rrule.between() check uses the shifted boundaries
			// Missing instances occur when the dtstart is compared against wrong boundaries

			// To properly test this, we create dates that simulate the UTC+9 scenario
			const startDate = createUTCDateForRRule('2025-01-20');
			const endDate = createUTCDateForRRule('2025-01-26');

			// When boundaries are correctly handled, all 7 days appear
			const instances = generateRecurringInstances(dailyTask, startDate, endDate);
			const dateStrings = instances.map(d => formatDateForStorage(d));

			// Verify all days of the week are present
			expect(dateStrings.length).toBeGreaterThanOrEqual(7);

			// Specifically check Sunday is included
			expect(dateStrings).toContain('2025-01-26');

			// The bug would manifest as Sunday being missing from the list
			// when the user's timezone causes the local/UTC date mismatch
		});
	});

	describe('getFullYear/getMonth/getDate vs getUTCFullYear/getUTCMonth/getUTCDate', () => {
		it.skip('reproduces issue #1582 - demonstrates local vs UTC date extraction difference', () => {
			// This test documents the exact code pattern that causes the bug
			// and verifies the fix should use UTC methods

			// Simulate a date that in UTC+9 would be "Sunday 15:30"
			// but in UTC is still "Sunday 06:30"
			// The key is: in UTC+9 timezone, dates near the day boundary
			// have getDate() returning different values than getUTCDate()

			// For a date like "Sunday 2025-01-26 20:00 UTC" (which is Monday 05:00 UTC+9):
			const dateNearBoundary = new Date('2025-01-26T20:00:00.000Z');

			// In a UTC+9 environment:
			// dateNearBoundary.getDate() would return 27 (Monday local)
			// dateNearBoundary.getUTCDate() returns 26 (Sunday UTC)

			// Current buggy code (lines 518-539 in helpers.ts) does:
			const buggyUTCEnd = new Date(
				Date.UTC(
					dateNearBoundary.getFullYear(),
					dateNearBoundary.getMonth(),
					dateNearBoundary.getDate(),
					23, 59, 59, 999
				)
			);

			// Correct code should do:
			const correctUTCEnd = new Date(
				Date.UTC(
					dateNearBoundary.getUTCFullYear(),
					dateNearBoundary.getUTCMonth(),
					dateNearBoundary.getUTCDate(),
					23, 59, 59, 999
				)
			);

			// In UTC timezone (Node.js default), these are the same
			// But in UTC+9, they differ because getDate() returns the LOCAL date

			// For this test to truly verify the fix, it would need to run in a
			// simulated UTC+9 environment. The fix is to always use getUTC* methods
			// when the intent is to create UTC date boundaries.

			// Document the expected behavior:
			expect(correctUTCEnd.getUTCDate()).toBe(26); // Should be Sunday
			expect(correctUTCEnd.getUTCMonth()).toBe(0); // January
			expect(correctUTCEnd.getUTCFullYear()).toBe(2025);
		});
	});

	describe('Weekly recurrence also affected', () => {
		it.skip('reproduces issue #1582 - weekly recurring tasks also miss Sunday occurrences', () => {
			// Weekly tasks set for Sunday would also be affected
			const sundayTask = TaskFactory.createRecurringTask('FREQ=WEEKLY;BYDAY=SU', {
				id: 'weekly-sunday-task',
				title: 'Weekly Sunday Task',
				scheduled: '2025-01-19', // Sunday
			});

			// Calendar view for January 2025 (contains 4-5 Sundays)
			const monthStart = createUTCDateForRRule('2025-01-01');
			const monthEnd = createUTCDateForRRule('2025-01-31');

			const instances = generateRecurringInstances(sundayTask, monthStart, monthEnd);
			const dateStrings = instances.map(d => formatDateForStorage(d));

			// Expected Sundays in January 2025: 5th, 12th, 19th, 26th
			const expectedSundays = ['2025-01-05', '2025-01-12', '2025-01-19', '2025-01-26'];

			// All Sundays should be present
			expectedSundays.forEach(sunday => {
				expect(dateStrings).toContain(sunday);
			});

			// Specifically, the last Sunday (26th) should not be missing
			// due to the timezone boundary calculation bug
			expect(dateStrings).toContain('2025-01-26');
		});
	});
});
