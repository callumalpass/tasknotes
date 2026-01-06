/**
 * Issue #1124: Today's scheduled tasks not showing in filter
 *
 * Bug Description:
 * When a task is scheduled for 14:00 today, it is not shown when the filter
 * is `scheduled <= today()`. However, it IS shown when the filter is
 * `scheduled <= today() + "14 hours"`.
 *
 * The user is in AEDT (Australian Eastern Daylight Time, UTC+11).
 *
 * Root cause hypothesis:
 * The `today()` function returns a date-only string (YYYY-MM-DD) in local timezone.
 * When comparing a task with a datetime (e.g., "2024-01-07 14:00") against
 * a date-only value ("2024-01-07"), the comparison logic may not correctly
 * handle the timezone offset, causing tasks with times later in the day
 * to be incorrectly excluded.
 *
 * The UTC anchor principle is designed to handle this, but there may be a bug
 * in how the `isOnOrBefore` logic combines `isBeforeDateTimeAware` and
 * `isSameDateSafe` checks.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1124
 */

import {
	getTodayString,
	isBeforeDateTimeAware,
	getDatePart,
	isSameDateSafe,
	parseDateToUTC,
	resolveNaturalLanguageDate,
} from '../../../src/utils/dateUtils';
// Store original timezone
const originalTZ = process.env.TZ;

describe('Issue #1124: Scheduled tasks with time not showing with today() filter', () => {
	afterEach(() => {
		// Restore original timezone
		if (originalTZ) {
			process.env.TZ = originalTZ;
		} else {
			delete process.env.TZ;
		}
	});

	it.skip('reproduces issue #1124 - task scheduled for 14:00 today should match scheduled <= today()', () => {
		/**
		 * This test reproduces the exact scenario from the bug report:
		 * - User is in AEDT (UTC+11)
		 * - Task is scheduled for 14:00 today
		 * - Filter is `scheduled <= today()`
		 * - Expected: Task should be shown
		 * - Actual: Task is NOT shown
		 */
		process.env.TZ = 'Australia/Sydney'; // AEDT/AEST

		// Simulate "today" being 2024-01-07 in AEDT
		const todayString = getTodayString();
		const taskScheduled = `${todayString} 14:00`;

		// The filter resolves to today's date (no time)
		const filterValue = resolveNaturalLanguageDate('today');
		expect(filterValue).toBe(todayString);

		// The task has time, filter value is date-only
		// Task scheduled at 14:00 today should satisfy "scheduled <= today()"
		const taskDate = getDatePart(taskScheduled);
		expect(taskDate).toBe(todayString);

		// isSameDateSafe should return true (same calendar date)
		const isSameDate = isSameDateSafe(taskDate, filterValue);
		expect(isSameDate).toBe(true);

		// The combined check: isBeforeDateTimeAware OR isSameDateSafe
		// This is the logic in FilterUtils.isOnOrBefore
		const isBefore = isBeforeDateTimeAware(taskScheduled, filterValue);
		const shouldMatch = isBefore || isSameDate;

		// This assertion documents the expected behavior:
		// A task scheduled for 14:00 today SHOULD match "scheduled <= today()"
		expect(shouldMatch).toBe(true);
	});

	it.skip('reproduces issue #1124 - various times throughout the day should match scheduled <= today()', () => {
		/**
		 * Test that tasks scheduled at any time during "today" match the filter.
		 * The bug suggests that tasks later in the day may not match.
		 */
		process.env.TZ = 'Australia/Sydney';

		const todayString = getTodayString();
		const filterValue = resolveNaturalLanguageDate('today');

		const testTimes = [
			'00:00', // Midnight
			'06:00', // Early morning
			'12:00', // Noon
			'14:00', // The reported problematic time
			'18:00', // Evening
			'23:59', // Just before midnight
		];

		for (const time of testTimes) {
			const taskScheduled = `${todayString} ${time}`;
			const taskDate = getDatePart(taskScheduled);

			const isBefore = isBeforeDateTimeAware(taskScheduled, filterValue);
			const isSameDate = isSameDateSafe(taskDate, filterValue);
			const shouldMatch = isBefore || isSameDate;

			expect(
				shouldMatch,
				`Task scheduled at ${time} should match "scheduled <= today()"`
			).toBe(true);
		}
	});

	it.skip('reproduces issue #1124 - timezone edge case with UTC+11', () => {
		/**
		 * AEDT is UTC+11. This means when it's 14:00 in Sydney,
		 * it's 03:00 UTC. When comparing dates across timezone
		 * boundaries, there's potential for off-by-one-day errors.
		 *
		 * The bug may be related to how parseDateToUTC handles
		 * the local time 14:00 when creating UTC anchors.
		 */
		process.env.TZ = 'Australia/Sydney';

		const todayString = getTodayString();

		// Task at 14:00 AEDT (03:00 UTC)
		const taskScheduled = `${todayString} 14:00`;

		// Parse both to UTC for comparison
		const taskUTC = parseDateToUTC(taskScheduled);
		const todayUTC = parseDateToUTC(todayString);

		// The UTC dates should be on the same calendar day in UTC terms
		// (The UTC anchor principle should handle this)
		expect(taskUTC.getUTCFullYear()).toBe(todayUTC.getUTCFullYear());
		expect(taskUTC.getUTCMonth()).toBe(todayUTC.getUTCMonth());
		expect(taskUTC.getUTCDate()).toBe(todayUTC.getUTCDate());
	});

	it.skip('reproduces issue #1124 - filter should work identically across timezones', () => {
		/**
		 * The same logical query "scheduled <= today()" should produce
		 * the same results regardless of the user's timezone.
		 *
		 * A task scheduled for "14:00 on the current local date" should
		 * always match "scheduled <= today()" for that user.
		 */
		const timezones = [
			'Australia/Sydney', // AEDT (UTC+11) - reported issue
			'America/Los_Angeles', // PST (UTC-8)
			'Europe/London', // GMT/BST (UTC+0/+1)
			'Asia/Tokyo', // JST (UTC+9)
			'Pacific/Honolulu', // HST (UTC-10)
		];

		for (const tz of timezones) {
			process.env.TZ = tz;

			const todayString = getTodayString();
			const taskScheduled = `${todayString} 14:00`;
			const filterValue = resolveNaturalLanguageDate('today');

			const taskDate = getDatePart(taskScheduled);
			const isBefore = isBeforeDateTimeAware(taskScheduled, filterValue);
			const isSameDate = isSameDateSafe(taskDate, filterValue);
			const shouldMatch = isBefore || isSameDate;

			expect(
				shouldMatch,
				`Task at 14:00 in ${tz} should match "scheduled <= today()"`
			).toBe(true);
		}
	});

	it.skip('reproduces issue #1124 - workaround with today() + time offset', () => {
		/**
		 * The user reports that `scheduled <= today() + "14 hours"` DOES work.
		 * This suggests the comparison with a datetime value works correctly,
		 * but comparison with date-only "today()" has a bug.
		 *
		 * This test verifies the workaround works and helps isolate the issue.
		 */
		process.env.TZ = 'Australia/Sydney';

		const todayString = getTodayString();
		const taskScheduled = `${todayString} 14:00`;

		// Simulating today() + "14 hours" = today at 14:00
		const filterValueWithTime = `${todayString} 14:00`;

		// With the time included, the comparison should work
		const isBefore = isBeforeDateTimeAware(taskScheduled, filterValueWithTime);
		const isSameDate = isSameDateSafe(
			getDatePart(taskScheduled),
			getDatePart(filterValueWithTime)
		);
		const shouldMatch = isBefore || isSameDate;

		// The workaround should work
		expect(shouldMatch).toBe(true);

		// Now compare with date-only (the broken case)
		const filterValueDateOnly = todayString;
		const isBeforeDateOnly = isBeforeDateTimeAware(taskScheduled, filterValueDateOnly);
		const isSameDateDateOnly = isSameDateSafe(
			getDatePart(taskScheduled),
			getDatePart(filterValueDateOnly)
		);
		const shouldMatchDateOnly = isBeforeDateOnly || isSameDateDateOnly;

		// This is the bug: the date-only filter should also match
		expect(shouldMatchDateOnly).toBe(true);
	});

	it.skip('reproduces issue #1124 - isBeforeDateTimeAware mixed format handling', () => {
		/**
		 * When comparing datetime (task) with date-only (filter),
		 * isBeforeDateTimeAware treats the date-only as end-of-day (23:59:59.999).
		 *
		 * This means:
		 * - Task: 2024-01-07 14:00 (14:00 UTC via UTC anchor)
		 * - Filter: 2024-01-07 -> becomes 2024-01-07 23:59:59.999 UTC
		 * - isBeforeDateTimeAware should return true (14:00 < 23:59)
		 *
		 * If this is failing, the UTC anchor conversion is wrong.
		 */
		process.env.TZ = 'Australia/Sydney';

		const todayString = getTodayString();
		const taskScheduled = `${todayString} 14:00`;
		const filterValue = todayString; // date-only

		const isBefore = isBeforeDateTimeAware(taskScheduled, filterValue);

		// 14:00 should be before end-of-day (23:59:59.999)
		expect(isBefore).toBe(true);
	});

	it.skip('reproduces issue #1124 - edge case just before midnight', () => {
		/**
		 * Task scheduled at 23:59 today should still match "scheduled <= today()".
		 * The end-of-day treatment in isBeforeDateTimeAware uses 23:59:59.999,
		 * so 23:59:00 should still be "before" that.
		 */
		process.env.TZ = 'Australia/Sydney';

		const todayString = getTodayString();
		const taskScheduled = `${todayString} 23:59`;
		const filterValue = todayString;

		const taskDate = getDatePart(taskScheduled);
		const isBefore = isBeforeDateTimeAware(taskScheduled, filterValue);
		const isSameDate = isSameDateSafe(taskDate, filterValue);
		const shouldMatch = isBefore || isSameDate;

		// isSameDateSafe should definitely return true (same date)
		expect(isSameDate).toBe(true);
		// Combined result should match
		expect(shouldMatch).toBe(true);
	});
});
