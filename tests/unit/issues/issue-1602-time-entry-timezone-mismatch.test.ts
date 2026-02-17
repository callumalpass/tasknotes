/**
 * Issue #1602: Time entries created with mismatched timezones
 *
 * Bug: When starting and stopping a timer, the startTime may use one timezone
 * format while endTime uses a different format. This causes statistics calculations
 * to fail when comparing dates across different timezone representations.
 *
 * The user reports seeing:
 * - startTime: 2026-02-15T11:02:00.000Z (UTC)
 * - endTime: 2026-02-15T22:04:41.412+11:00 (local timezone)
 *
 * Root cause: Multiple code paths generate timestamps using different methods:
 * - TaskService.startTimeTracking/stopTimeTracking use getCurrentTimestamp() (local TZ with offset)
 * - TimeEntryEditorModal uses toISOString() (UTC with Z suffix)
 * - CalendarView drag/drop/resize uses toISOString() (UTC with Z suffix)
 *
 * Impact: Statistics views (especially "Today") may show 0 hours tracked because
 * the date comparison logic doesn't properly normalize mixed timezone formats.
 *
 * @see https://github.com/TaskNotesApp/tasknotes/issues/1602
 */

import { TimeEntry } from '../../../src/types';
import { getCurrentTimestamp } from '../../../src/utils/dateUtils';
import {
	calculateTotalTimeSpent,
	computeTimeSummary,
} from '../../../src/utils/timeTrackingUtils';
import { TaskFactory } from '../../helpers/mock-factories';

describe('Issue #1602: Time entry timezone mismatch', () => {
	// Helper to create timestamps in different formats
	const createUTCTimestamp = (date: Date): string => date.toISOString();
	const createLocalTimestamp = (): string => getCurrentTimestamp();

	describe('Timezone format consistency', () => {
		it.skip('reproduces issue #1602: time entries with mixed timezone formats cause stats miscalculation', () => {
			// Simulate the user's reported scenario:
			// - startTime in UTC (Z suffix) - e.g., from TimeEntryEditorModal
			// - endTime in local timezone (+offset) - e.g., from TaskService.stopTimeTracking

			const now = new Date();
			const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

			// Create time entry with mixed formats (simulating the bug)
			const mixedFormatEntry: TimeEntry = {
				startTime: createUTCTimestamp(startTime),  // UTC: "2026-02-15T11:02:00.000Z"
				endTime: createLocalTimestamp(),            // Local: "2026-02-15T22:04:41.412+11:00"
				description: 'Work session',
			};

			// Verify the formats are indeed different
			expect(mixedFormatEntry.startTime).toMatch(/Z$/);  // UTC format
			// Note: This test may need adjustment based on local timezone
			// In a proper fix, both should use the same format

			// Calculate duration - this should work correctly despite mixed formats
			const duration = calculateTotalTimeSpent([mixedFormatEntry]);

			// Duration should be approximately 30 minutes
			expect(duration).toBeGreaterThanOrEqual(29);
			expect(duration).toBeLessThanOrEqual(31);
		});

		it.skip('reproduces issue #1602: "Today" statistics show 0 hours with mixed timezone entries', () => {
			// This test reproduces the specific user complaint:
			// The "Task & Project Statistics" view shows 0 hours for "Today"
			// even though time entries exist for the current day

			const now = new Date();
			const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

			// Create a task with time entries that have mixed timezone formats
			const task = TaskFactory.createTask({
				title: 'Task with mixed timezone entries',
				path: '/tasks/mixed-tz.md',
				status: 'in-progress',
				timeEntries: [
					{
						// startTime in UTC (as if created via TimeEntryEditorModal)
						startTime: thirtyMinutesAgo.toISOString(),
						// endTime in local timezone (as if stopped via TaskService)
						endTime: getCurrentTimestamp(),
						description: 'Work session',
					},
				],
			});

			// Compute time summary for "today"
			const result = computeTimeSummary(
				[task],
				{ period: 'today', fromDate: null, toDate: null },
				(status) => status === 'done'
			);

			// The bug causes this to return 0 because the date comparison
			// fails when startTime (UTC) and the local "today" range don't match properly
			// for users in positive UTC offset timezones (like Australia/Sydney +11:00)

			// After fix, this should correctly show ~30 minutes
			expect(result.summary.totalMinutes).toBeGreaterThan(0);
			expect(result.summary.tasksWithTime).toBe(1);
		});

		it.skip('reproduces issue #1602: timezone boundary case causes entry to appear on wrong day', () => {
			// This test specifically checks the boundary case mentioned by the user:
			// In Australia/Sydney (UTC+11), a timestamp at 2026-02-15T11:02:00.000Z (UTC)
			// is actually 2026-02-15T22:02:00+11:00 (local), which is the same day.
			// BUT if the UTC time was earlier, e.g., 2026-02-15T02:00:00.000Z,
			// that would be 2026-02-15T13:00:00+11:00 - still same day.
			//
			// However, if UTC is 2026-02-14T20:00:00.000Z (Feb 14 at 8pm UTC),
			// in Sydney that's 2026-02-15T07:00:00+11:00 (Feb 15 at 7am local).
			//
			// The bug can cause entries to appear on the "wrong" day when filtering.

			// Simulate a time entry that starts near midnight boundary in UTC
			// but is clearly "today" in local time
			const now = new Date();
			const today = new Date(now);
			today.setHours(8, 0, 0, 0); // 8 AM local time today

			const task = TaskFactory.createTask({
				title: 'Boundary case task',
				path: '/tasks/boundary.md',
				status: 'in-progress',
				timeEntries: [
					{
						// Convert to UTC - this might be "yesterday" in UTC
						// but is definitely "today" in local time
						startTime: today.toISOString(),
						endTime: getCurrentTimestamp(),
						description: 'Morning session',
					},
				],
			});

			const result = computeTimeSummary(
				[task],
				{ period: 'today', fromDate: null, toDate: null },
				(status) => status === 'done'
			);

			// After fix, entries created "today" (local) should appear in "today" stats
			expect(result.summary.tasksWithTime).toBe(1);
		});
	});

	describe('Duration calculation with mixed formats', () => {
		it('should correctly calculate duration from mixed timezone entries', () => {
			// Even with mixed timezone formats, the JavaScript Date constructor
			// should correctly parse both UTC and offset-based timestamps
			const utcStart = '2026-02-15T11:00:00.000Z';
			const localEnd = '2026-02-15T22:30:00.000+11:00'; // 30 min after start in real time

			const entry: TimeEntry = {
				startTime: utcStart,
				endTime: localEnd,
				description: 'Test session',
			};

			const duration = calculateTotalTimeSpent([entry]);

			// Both timestamps represent the same moment differently:
			// - UTC: 2026-02-15T11:00:00.000Z
			// - Local: 2026-02-15T22:00:00.000+11:00
			// The end time is 30 minutes later (22:30 vs 22:00 local = 11:30 vs 11:00 UTC)
			expect(duration).toBe(30);
		});

		it('should correctly parse timestamps with various timezone formats', () => {
			// Verify that the Date constructor handles all common formats
			const formats = [
				'2026-02-15T11:00:00.000Z',           // UTC
				'2026-02-15T22:00:00.000+11:00',      // Positive offset (Australia)
				'2026-02-15T03:00:00.000-08:00',      // Negative offset (US Pacific)
				'2026-02-15T11:00:00Z',               // UTC without milliseconds
				'2026-02-15T22:00:00+11:00',          // Offset without milliseconds
			];

			for (const format of formats) {
				const date = new Date(format);
				expect(date.getTime()).not.toBeNaN();
			}
		});
	});

	describe('Timestamp generation consistency', () => {
		it.skip('reproduces issue #1602: verifies getCurrentTimestamp produces local timezone format', () => {
			// getCurrentTimestamp should produce timestamps with local timezone offset
			const timestamp = getCurrentTimestamp();

			// Should NOT end with Z (UTC)
			expect(timestamp).not.toMatch(/Z$/);

			// Should have timezone offset like +11:00 or -08:00
			expect(timestamp).toMatch(/[+-]\d{2}:\d{2}$/);
		});

		it.skip('reproduces issue #1602: demonstrates inconsistency between timestamp methods', () => {
			// This test documents the root cause of the inconsistency
			const now = new Date();

			// Method 1: toISOString() - always returns UTC
			const utcTimestamp = now.toISOString();
			expect(utcTimestamp).toMatch(/Z$/);

			// Method 2: getCurrentTimestamp() - returns local timezone
			const localTimestamp = getCurrentTimestamp();
			expect(localTimestamp).not.toMatch(/Z$/);

			// Both represent the same moment in time
			const utcDate = new Date(utcTimestamp);
			const localDate = new Date(localTimestamp);

			// They should be within a second of each other
			expect(Math.abs(utcDate.getTime() - localDate.getTime())).toBeLessThan(1000);
		});
	});
});
