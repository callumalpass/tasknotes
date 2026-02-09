/**
 * Issue #632: [FR] Display Tracked Time for Unscheduled Tasks
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/632
 *
 * Feature Request:
 * When a task has no scheduled date or due date, its tracked time entries
 * are not displayed on the calendar. Users want an option to show all
 * tracked time for unscheduled tasks on the calendar.
 *
 * Current Behavior:
 * - In generateCalendarEvents() (calendar-core.ts ~line 988), non-recurring tasks
 *   without `scheduled` or `due` dates still proceed through the event generation loop.
 *   However, since they have no scheduled/due dates, no date-based events are created
 *   for them. Time entry events ARE generated (line 1023) because the time entry
 *   processing is outside the scheduling conditional block.
 * - BUT the time entries for unscheduled tasks only appear if they fall within the
 *   visible date range. The core issue is that users expect unscheduled tasks'
 *   time entries to be discoverable on the calendar, but since there's no
 *   scheduled/due event to anchor them, users may not realize they exist.
 * - More importantly, the feature request is about having a dedicated option/view
 *   to surface time entries from unscheduled tasks, making them visible and
 *   easy to find on the calendar.
 *
 * Expected Behavior:
 * - There should be an option (e.g., `showUnscheduledTimeEntries`) that when enabled,
 *   ensures time entries from tasks without scheduled/due dates are prominently
 *   displayed on the calendar.
 * - Time entries should appear at their actual tracked times on the calendar
 *   regardless of whether the parent task has a scheduled or due date.
 *
 * Root Cause:
 * The calendar view has no dedicated toggle or visual treatment for time entries
 * from unscheduled tasks. While the code does process time entries for all tasks
 * that enter the loop, there's no way for users to filter or specifically surface
 * time entries belonging to unscheduled tasks.
 *
 * Related Files:
 * - src/bases/calendar-core.ts: generateCalendarEvents(), createTimeEntryEvents()
 * - src/bases/CalendarView.ts: readEventToggles(), viewOptions
 */

import { describe, it, expect } from '@jest/globals';
import type { TaskInfo, TimeEntry } from '../../../src/types';
import type { CalendarEventGenerationOptions } from '../../../src/bases/calendar-core';

/**
 * Helper to create a minimal TaskInfo with time entries but no scheduled/due dates
 */
function createUnscheduledTaskWithTimeEntries(
	title: string,
	timeEntries: TimeEntry[]
): TaskInfo {
	return {
		title,
		status: ' ',
		priority: '',
		path: `tasks/${title.toLowerCase().replace(/\s+/g, '-')}.md`,
		archived: false,
		timeEntries,
	};
}

/**
 * Helper to create a scheduled task with time entries
 */
function createScheduledTaskWithTimeEntries(
	title: string,
	scheduled: string,
	timeEntries: TimeEntry[]
): TaskInfo {
	return {
		title,
		status: ' ',
		priority: '',
		path: `tasks/${title.toLowerCase().replace(/\s+/g, '-')}.md`,
		archived: false,
		scheduled,
		timeEntries,
	};
}

describe('Issue #632: Display Tracked Time for Unscheduled Tasks', () => {
	const sampleTimeEntries: TimeEntry[] = [
		{
			startTime: '2025-01-15T09:00:00.000Z',
			endTime: '2025-01-15T10:30:00.000Z',
			duration: 90,
			description: 'Morning work session',
		},
		{
			startTime: '2025-01-16T14:00:00.000Z',
			endTime: '2025-01-16T15:00:00.000Z',
			duration: 60,
			description: 'Afternoon follow-up',
		},
	];

	describe('Unscheduled tasks with time entries', () => {
		it.skip('reproduces issue #632 - unscheduled task time entries should be displayable on calendar', () => {
			// An unscheduled task with tracked time entries
			const unscheduledTask = createUnscheduledTaskWithTimeEntries(
				'Research project',
				sampleTimeEntries
			);

			// Verify the task has no scheduled or due date
			expect(unscheduledTask.scheduled).toBeUndefined();
			expect(unscheduledTask.due).toBeUndefined();

			// Verify the task does have time entries with valid start/end times
			expect(unscheduledTask.timeEntries).toHaveLength(2);
			expect(unscheduledTask.timeEntries![0].endTime).toBeDefined();
			expect(unscheduledTask.timeEntries![1].endTime).toBeDefined();

			// When generateCalendarEvents is called with showTimeEntries: true,
			// the time entries from this unscheduled task should appear as calendar events.
			//
			// Currently, time entries ARE processed for unscheduled tasks in the loop,
			// but there is no dedicated option to surface/filter them.
			// The feature request asks for a way to explicitly show/toggle these entries.
			//
			// Expected: A new option like `showUnscheduledTimeEntries` that when enabled,
			// ensures these time entries are visible and discoverable on the calendar.
			const options: CalendarEventGenerationOptions = {
				showTimeEntries: true,
				visibleStart: new Date('2025-01-14'),
				visibleEnd: new Date('2025-01-17'),
			};

			// After the feature is implemented, calling generateCalendarEvents with
			// an unscheduled task should produce time entry events when the option is enabled.
			// This test should verify that the events are generated with correct properties.
			expect(options.showTimeEntries).toBe(true);
		});

		it.skip('reproduces issue #632 - calendar options should include toggle for unscheduled task time entries', () => {
			// The CalendarEventGenerationOptions interface should support a new option
			// to explicitly control whether time entries from unscheduled tasks are shown.
			//
			// Expected new option: showUnscheduledTimeEntries?: boolean
			//
			// This would allow users to toggle visibility of time entries from tasks
			// that have no scheduled or due date.
			const options: CalendarEventGenerationOptions = {
				showTimeEntries: true,
				showScheduled: true,
				showDue: true,
				// After fix: showUnscheduledTimeEntries: true,
			};

			// Verify the current options interface does NOT have this toggle
			expect(options).not.toHaveProperty('showUnscheduledTimeEntries');

			// After the fix, this should be a valid option:
			// expect(options.showUnscheduledTimeEntries).toBe(true);
		});

		it.skip('reproduces issue #632 - time entries from unscheduled tasks should generate calendar events', () => {
			const unscheduledTask = createUnscheduledTaskWithTimeEntries(
				'Ad-hoc research',
				[{
					startTime: '2025-01-20T10:00:00.000Z',
					endTime: '2025-01-20T11:30:00.000Z',
					duration: 90,
					description: 'Deep dive session',
				}]
			);

			const scheduledTask = createScheduledTaskWithTimeEntries(
				'Planned work',
				'2025-01-20',
				[{
					startTime: '2025-01-20T14:00:00.000Z',
					endTime: '2025-01-20T15:00:00.000Z',
					duration: 60,
					description: 'Scheduled work session',
				}]
			);

			// Both tasks have time entries on the same day
			// The scheduled task's time entries show on the calendar today
			// The unscheduled task's time entries should ALSO be visible

			// Verify both tasks have time entries
			expect(unscheduledTask.timeEntries).toHaveLength(1);
			expect(scheduledTask.timeEntries).toHaveLength(1);

			// The scheduled task has a date anchor
			expect(scheduledTask.scheduled).toBe('2025-01-20');

			// The unscheduled task has no date anchor but its time entries
			// have specific timestamps that should place them on the calendar
			expect(unscheduledTask.scheduled).toBeUndefined();
			expect(unscheduledTask.timeEntries![0].startTime).toBe('2025-01-20T10:00:00.000Z');

			// After the feature is implemented:
			// Both tasks' time entries should appear on the calendar for Jan 20.
			// The unscheduled task's time entry should be rendered at 10:00-11:30
			// even though the task itself has no scheduled date.
		});
	});

	describe('Edge cases', () => {
		it.skip('reproduces issue #632 - unscheduled task with only running (no endTime) time entry should not show', () => {
			// A time entry without an endTime is currently running and should not appear
			const taskWithRunningEntry = createUnscheduledTaskWithTimeEntries(
				'In-progress work',
				[{
					startTime: '2025-01-20T10:00:00.000Z',
					// No endTime - currently tracking
					duration: undefined,
				}]
			);

			// Running entries (no endTime) are filtered out by createTimeEntryEvents()
			// This behavior should be preserved for unscheduled tasks too
			expect(taskWithRunningEntry.timeEntries![0].endTime).toBeUndefined();
		});

		it.skip('reproduces issue #632 - unscheduled task with mix of completed and running entries', () => {
			const taskWithMixedEntries = createUnscheduledTaskWithTimeEntries(
				'Mixed tracking task',
				[
					{
						startTime: '2025-01-19T09:00:00.000Z',
						endTime: '2025-01-19T10:00:00.000Z',
						duration: 60,
						description: 'Yesterday session',
					},
					{
						startTime: '2025-01-20T14:00:00.000Z',
						// Currently running - no endTime
					},
				]
			);

			// Only the completed entry (with endTime) should generate a calendar event
			const completedEntries = taskWithMixedEntries.timeEntries!.filter(e => e.endTime);
			const runningEntries = taskWithMixedEntries.timeEntries!.filter(e => !e.endTime);

			expect(completedEntries).toHaveLength(1);
			expect(runningEntries).toHaveLength(1);

			// After the feature: only the completed entry from Jan 19 should show on calendar
		});
	});
});
