/**
 * Reproduction test for issue #1658.
 *
 * Reported behavior:
 * - Pomodoro sessions near local midnight are bucketed into the wrong day.
 *   A session at 11:50 PM local time may appear under "Today" when it should
 *   be under "Yesterday", or vice versa.
 *
 * Root cause:
 * - getStatsForDate() uses formatDateForStorage() which extracts UTC date
 *   components (getUTCFullYear/getUTCMonth/getUTCDate) from session.startTime.
 *   For non-UTC timezones, a local-midnight-adjacent timestamp may have a
 *   different UTC date than its local date, causing mis-bucketing.
 */

import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #1658: Pomodoro stats timezone bucketing', () => {
	it.skip('reproduces issue #1658 - sessions near midnight should bucket by local date', () => {
		// Simulate a session started at 11:50 PM EST (UTC-5) on March 21
		// In UTC, this is 04:50 AM March 22
		const sessionStartTime = new Date('2026-03-22T04:50:00Z'); // 11:50 PM EST on March 21

		// formatDateForStorage uses UTC methods, so it returns "2026-03-22"
		const dateStr = formatDateForStorage(sessionStartTime);
		expect(dateStr).toBe('2026-03-22');

		// But the user expects this session to be bucketed under March 21 (their local date)
		// The correct local date would be "2026-03-21" for EST timezone
		// This demonstrates the timezone mismatch in session bucketing

		// A correct implementation would extract the local date:
		const localYear = sessionStartTime.getFullYear();
		const localMonth = String(sessionStartTime.getMonth() + 1).padStart(2, '0');
		const localDay = String(sessionStartTime.getDate()).padStart(2, '0');
		const localDateStr = `${localYear}-${localMonth}-${localDay}`;

		// In EST timezone, this would be "2026-03-21", not "2026-03-22"
		// Note: this test result depends on the runner's timezone
	});
});
