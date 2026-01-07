/**
 * Skipped tests for Issue #936: Recurring daily task completed when clicked - overdue handling
 *
 * Bug Description:
 * When a daily recurring task is overdue (e.g., yesterday's instance was never completed),
 * clicking to mark it complete causes it to be faded/struck-out and marked as completed.
 * However, for overdue recurring tasks, this behavior is incorrect.
 *
 * Expected behavior:
 * - If a recurring task is overdue (e.g., 1 day old), clicking "complete" should:
 *   1. Mark the overdue instance as completed
 *   2. Move the scheduled date to TODAY (not the next recurrence from the overdue date)
 *   3. The task should remain visible as a todo for today
 *
 * Current behavior:
 * - The task is marked as completed for today's date
 * - The task gets struck out and faded (appears fully completed)
 * - This fails to account for the "catch-up" nature of overdue recurring tasks
 *
 * Edge case consideration (from the issue):
 * - What if the task is 2+ days overdue?
 * - Should completing move it to yesterday, then today, etc.? (cascading catch-up)
 * - Or should it just jump to today?
 *
 * Related code:
 * - src/services/TaskService.ts (lines 1790-1981) - toggleRecurringTaskComplete()
 * - src/utils/helpers.ts (lines 553-779) - getNextUncompletedOccurrence(), updateToNextScheduledOccurrence()
 * - src/components/TaskContextMenu.ts (lines 56-86) - UI trigger for completion toggle
 *
 * The core issue is in toggleRecurringTaskComplete() which uses "today" as the completion date
 * regardless of whether the task's scheduled date is in the past.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
	formatDateForStorage,
	createUTCDateFromLocalCalendarDate,
	parseDateToUTC,
	getTodayString,
} from '../../../src/utils/dateUtils';
import {
	getNextUncompletedOccurrence,
	updateToNextScheduledOccurrence,
	getEffectiveTaskStatus,
} from '../../../src/utils/helpers';
import { TaskInfo } from '../../../src/types';

describe('Issue #936: Overdue recurring task completion handling', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		// Set system time to January 10, 2025, 12:00 UTC
		jest.setSystemTime(new Date(Date.UTC(2025, 0, 10, 12, 0, 0)));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('Core bug demonstration - 1 day overdue', () => {
		it.skip('reproduces issue #936 - completing 1-day overdue daily task should move to today, not tomorrow', () => {
			// Reproduces issue #936
			// Today is Jan 10, 2025
			// Task was scheduled for Jan 9, 2025 (yesterday) - it's 1 day overdue
			// Clicking complete should complete yesterday's instance AND keep task visible for today

			const today = new Date(Date.UTC(2025, 0, 10));
			const yesterday = new Date(Date.UTC(2025, 0, 9));
			const todayStr = formatDateForStorage(today);
			const yesterdayStr = formatDateForStorage(yesterday);

			const overdueTask: TaskInfo = {
				title: 'Daily standup',
				status: ' ',
				path: 'tasks/daily-standup.md',
				scheduled: yesterdayStr, // Yesterday - overdue!
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [],
				skipped_instances: [],
			};

			// CURRENT BEHAVIOR (BUG):
			// toggleRecurringTaskComplete uses today's date for completion
			// This marks today as complete, but the task was scheduled for yesterday
			// So the next occurrence becomes tomorrow

			// Simulate current behavior: complete for today
			const buggyCompleteInstances = [todayStr];
			const buggyTask = { ...overdueTask, complete_instances: buggyCompleteInstances };
			const buggyNextOccurrence = getNextUncompletedOccurrence(buggyTask);

			// BUG: Next occurrence is tomorrow (Jan 11), skipping today entirely
			expect(formatDateForStorage(buggyNextOccurrence!)).toBe('2025-01-11');

			// EXPECTED BEHAVIOR:
			// Should complete YESTERDAY'S instance (the overdue one)
			// Then the next uncompleted occurrence should be TODAY
			const correctCompleteInstances = [yesterdayStr]; // Complete the overdue instance
			const correctTask = { ...overdueTask, complete_instances: correctCompleteInstances };
			const correctNextOccurrence = getNextUncompletedOccurrence(correctTask);

			// The task should move to today, not skip it
			expect(formatDateForStorage(correctNextOccurrence!)).toBe(todayStr);
		});

		it.skip('reproduces issue #936 - overdue task should not appear as "done" after completing', () => {
			// Reproduces issue #936
			// When completing an overdue recurring task, it should remain visible
			// as a todo for today, not fade out as if fully completed

			const today = new Date(Date.UTC(2025, 0, 10));
			const yesterday = new Date(Date.UTC(2025, 0, 9));
			const todayStr = formatDateForStorage(today);
			const yesterdayStr = formatDateForStorage(yesterday);

			const overdueTask: TaskInfo = {
				title: 'Daily review',
				status: ' ',
				path: 'tasks/daily-review.md',
				scheduled: yesterdayStr,
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [],
				skipped_instances: [],
			};

			// Current buggy behavior: complete for today
			const buggyTask = {
				...overdueTask,
				complete_instances: [todayStr],
				scheduled: '2025-01-11', // Moves to tomorrow
			};

			// The effective status for today would be "done" - WRONG!
			const buggyStatus = getEffectiveTaskStatus(buggyTask, today);
			expect(buggyStatus).toBe('done'); // Shows as completed, which is incorrect

			// Expected behavior: complete yesterday, scheduled stays at today
			const correctTask = {
				...overdueTask,
				complete_instances: [yesterdayStr],
				scheduled: todayStr, // Moves to today
			};

			// The effective status for today should be "open"
			const correctStatus = getEffectiveTaskStatus(correctTask, today);
			expect(correctStatus).toBe('open'); // Shows as open - correct!
		});
	});

	describe('Multi-day overdue scenarios', () => {
		it.skip('reproduces issue #936 - completing 2-day overdue task should cascade to yesterday, then today', () => {
			// Reproduces issue #936
			// This tests the caveat mentioned in the issue:
			// "What to do if the date clicked on was 2 days ago... should the date
			// upon clicking completed be changed to yesterday... and keep happening
			// till we reach today's date?"

			const today = new Date(Date.UTC(2025, 0, 10));
			const yesterday = new Date(Date.UTC(2025, 0, 9));
			const twoDaysAgo = new Date(Date.UTC(2025, 0, 8));
			const todayStr = formatDateForStorage(today);
			const yesterdayStr = formatDateForStorage(yesterday);
			const twoDaysAgoStr = formatDateForStorage(twoDaysAgo);

			const veryOverdueTask: TaskInfo = {
				title: 'Daily exercise',
				status: ' ',
				path: 'tasks/daily-exercise.md',
				scheduled: twoDaysAgoStr, // 2 days overdue!
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [],
				skipped_instances: [],
			};

			// Option A: Cascade approach (each click completes one day, moving forward)
			// First click completes Jan 8, moves to Jan 9
			const afterFirstClick = {
				...veryOverdueTask,
				complete_instances: [twoDaysAgoStr],
				scheduled: yesterdayStr,
			};
			const nextAfterFirst = getNextUncompletedOccurrence(afterFirstClick);
			expect(formatDateForStorage(nextAfterFirst!)).toBe(yesterdayStr);

			// Second click completes Jan 9, moves to Jan 10 (today)
			const afterSecondClick = {
				...afterFirstClick,
				complete_instances: [twoDaysAgoStr, yesterdayStr],
				scheduled: todayStr,
			};
			const nextAfterSecond = getNextUncompletedOccurrence(afterSecondClick);
			expect(formatDateForStorage(nextAfterSecond!)).toBe(todayStr);

			// Option B: Jump to today approach (single click catches up entirely)
			// This would mark all overdue instances as complete and jump to today
			// The choice between A and B should probably be configurable or documented
		});

		it.skip('reproduces issue #936 - completing week-old overdue task', () => {
			// Reproduces issue #936
			// Extreme case: what if the task is a week overdue?

			const today = new Date(Date.UTC(2025, 0, 10));
			const weekAgo = new Date(Date.UTC(2025, 0, 3));
			const todayStr = formatDateForStorage(today);
			const weekAgoStr = formatDateForStorage(weekAgo);

			const veryOverdueTask: TaskInfo = {
				title: 'Daily medication',
				status: ' ',
				path: 'tasks/daily-medication.md',
				scheduled: weekAgoStr, // 7 days overdue!
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [],
				skipped_instances: [],
			};

			// Current behavior: clicking complete marks today, jumps to tomorrow
			// This loses 7 days of history and skips today

			// Better behavior options:
			// 1. Cascade: require 7 clicks to catch up (tedious for user)
			// 2. Jump: single click catches up to today
			// 3. Bulk complete: mark all past instances as complete, stay on today
			// 4. Skip option: let user "skip" overdue instances without marking complete

			// The issue suggests the cascade approach, but for UX, a bulk option might be better
			// At minimum, the task should NOT skip today when catching up
		});
	});

	describe('Weekly recurring task overdue handling', () => {
		it.skip('reproduces issue #936 - weekly task 1 week overdue should move to this week', () => {
			// Reproduces issue #936
			// This issue affects all recurring frequencies, not just daily

			// Today is Friday Jan 10, 2025
			// Task was scheduled for Friday Jan 3, 2025 (last week)
			const today = new Date(Date.UTC(2025, 0, 10)); // Friday
			const lastWeek = new Date(Date.UTC(2025, 0, 3)); // Last Friday
			const nextWeek = new Date(Date.UTC(2025, 0, 17)); // Next Friday
			const todayStr = formatDateForStorage(today);
			const lastWeekStr = formatDateForStorage(lastWeek);
			const nextWeekStr = formatDateForStorage(nextWeek);

			const weeklyTask: TaskInfo = {
				title: 'Weekly review',
				status: ' ',
				path: 'tasks/weekly-review.md',
				scheduled: lastWeekStr, // 1 week overdue
				recurrence: 'DTSTART:20250103;FREQ=WEEKLY;BYDAY=FR',
				complete_instances: [],
				skipped_instances: [],
			};

			// Current buggy behavior: completes today, moves to next week
			// This skips THIS Friday entirely

			// Expected behavior: complete last week's instance, move to THIS Friday
			const correctTask = {
				...weeklyTask,
				complete_instances: [lastWeekStr],
				scheduled: todayStr, // This Friday
			};

			const nextOccurrence = getNextUncompletedOccurrence(correctTask);
			expect(formatDateForStorage(nextOccurrence!)).toBe(todayStr);
		});
	});

	describe('Completion date determination logic', () => {
		it.skip('reproduces issue #936 - should determine completion date based on scheduled, not today', () => {
			// Reproduces issue #936
			// The key insight: when completing a recurring task, the completion date
			// should be determined by the task's scheduled date, not by "today"

			const today = new Date(Date.UTC(2025, 0, 10));
			const scheduled = new Date(Date.UTC(2025, 0, 8)); // 2 days overdue
			const scheduledStr = formatDateForStorage(scheduled);

			const task: TaskInfo = {
				title: 'Daily task',
				status: ' ',
				path: 'tasks/daily.md',
				scheduled: scheduledStr,
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [],
				skipped_instances: [],
			};

			// The completion date should be determined by:
			// 1. If scheduled is in the past: use scheduled date (the overdue instance)
			// 2. If scheduled is today: use today
			// 3. If scheduled is in the future: use scheduled date (completing ahead)

			const determineCompletionDate = (task: TaskInfo): Date => {
				const todayDate = parseDateToUTC(getTodayString());
				const scheduledDate = task.scheduled ? parseDateToUTC(task.scheduled) : todayDate;

				// For overdue tasks, complete the scheduled (past) date
				if (scheduledDate < todayDate) {
					return scheduledDate;
				}
				// For current or future, use the scheduled date
				return scheduledDate;
			};

			const completionDate = determineCompletionDate(task);
			expect(formatDateForStorage(completionDate)).toBe(scheduledStr);
		});

		it.skip('reproduces issue #936 - should not complete future date for overdue task', () => {
			// Reproduces issue #936
			// Edge case: ensure we don't accidentally mark future dates as complete

			const today = new Date(Date.UTC(2025, 0, 10));
			const yesterday = new Date(Date.UTC(2025, 0, 9));
			const tomorrow = new Date(Date.UTC(2025, 0, 11));
			const yesterdayStr = formatDateForStorage(yesterday);
			const tomorrowStr = formatDateForStorage(tomorrow);

			const overdueTask: TaskInfo = {
				title: 'Daily task',
				status: ' ',
				path: 'tasks/daily.md',
				scheduled: yesterdayStr, // Overdue
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [],
				skipped_instances: [],
			};

			// After completion, complete_instances should NOT include tomorrow
			// It should only include yesterday (the overdue instance being completed)
			const afterCompletion = {
				...overdueTask,
				complete_instances: [yesterdayStr],
			};

			expect(afterCompletion.complete_instances).not.toContain(tomorrowStr);
			expect(afterCompletion.complete_instances).toContain(yesterdayStr);
		});
	});

	describe('Scheduled date update behavior', () => {
		it.skip('reproduces issue #936 - scheduled date should advance to next uncompleted occurrence', () => {
			// Reproduces issue #936
			// After completing an overdue instance, scheduled should move to the next
			// uncompleted occurrence (which could be today)

			const today = new Date(Date.UTC(2025, 0, 10));
			const yesterday = new Date(Date.UTC(2025, 0, 9));
			const todayStr = formatDateForStorage(today);
			const yesterdayStr = formatDateForStorage(yesterday);

			const overdueTask: TaskInfo = {
				title: 'Daily task',
				status: ' ',
				path: 'tasks/daily.md',
				scheduled: yesterdayStr, // Yesterday - overdue
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [yesterdayStr], // Yesterday just completed
				skipped_instances: [],
			};

			const nextDates = updateToNextScheduledOccurrence(overdueTask, false);

			// Next scheduled should be today (not tomorrow)
			expect(nextDates.scheduled).toBe(todayStr);
		});

		it.skip('reproduces issue #936 - completing current day instance should move to tomorrow', () => {
			// Reproduces issue #936
			// Contrast with the overdue case: if task IS scheduled for today,
			// completing it should move to tomorrow (normal behavior)

			const today = new Date(Date.UTC(2025, 0, 10));
			const tomorrow = new Date(Date.UTC(2025, 0, 11));
			const todayStr = formatDateForStorage(today);
			const tomorrowStr = formatDateForStorage(tomorrow);

			const currentTask: TaskInfo = {
				title: 'Daily task',
				status: ' ',
				path: 'tasks/daily.md',
				scheduled: todayStr, // Today - not overdue
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [todayStr], // Today just completed
				skipped_instances: [],
			};

			const nextDates = updateToNextScheduledOccurrence(currentTask, false);

			// Next scheduled should be tomorrow
			expect(nextDates.scheduled).toBe(tomorrowStr);
		});
	});

	describe('UI rendering expectations', () => {
		it.skip('reproduces issue #936 - task should NOT be struck out if current day is still pending', () => {
			// Reproduces issue #936
			// After completing an overdue instance, if today's instance is still pending,
			// the task should appear as a normal todo, not struck out/faded

			const today = new Date(Date.UTC(2025, 0, 10));
			const yesterday = new Date(Date.UTC(2025, 0, 9));
			const todayStr = formatDateForStorage(today);
			const yesterdayStr = formatDateForStorage(yesterday);

			// After completing yesterday's overdue instance
			const taskAfterCompletion: TaskInfo = {
				title: 'Daily task',
				status: ' ',
				path: 'tasks/daily.md',
				scheduled: todayStr, // Now scheduled for today
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: [yesterdayStr], // Yesterday completed
				skipped_instances: [],
			};

			// Today is NOT in complete_instances
			expect(taskAfterCompletion.complete_instances?.includes(todayStr)).toBe(false);

			// The effective status for today should be "open"
			const effectiveStatus = getEffectiveTaskStatus(taskAfterCompletion, today);
			expect(effectiveStatus).toBe('open'); // Not 'done', not struck out

			// The task should be visible in the todo list, not hidden in completed
		});

		it.skip('reproduces issue #936 - task should be struck out only after completing today', () => {
			// Reproduces issue #936
			// The task should only appear completed when today's instance is complete

			const today = new Date(Date.UTC(2025, 0, 10));
			const tomorrow = new Date(Date.UTC(2025, 0, 11));
			const todayStr = formatDateForStorage(today);
			const tomorrowStr = formatDateForStorage(tomorrow);

			// After completing both yesterday AND today
			const fullyCompletedTask: TaskInfo = {
				title: 'Daily task',
				status: ' ',
				path: 'tasks/daily.md',
				scheduled: tomorrowStr, // Now scheduled for tomorrow
				recurrence: 'DTSTART:20250101;FREQ=DAILY',
				complete_instances: ['2025-01-09', todayStr], // Yesterday AND today completed
				skipped_instances: [],
			};

			// Today IS in complete_instances
			expect(fullyCompletedTask.complete_instances?.includes(todayStr)).toBe(true);

			// The effective status for today should be "done"
			const effectiveStatus = getEffectiveTaskStatus(fullyCompletedTask, today);
			expect(effectiveStatus).toBe('done'); // Now it's correctly completed
		});
	});
});

describe('Issue #936: Potential fix approaches', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(Date.UTC(2025, 0, 10, 12, 0, 0)));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('Fix approach: Detect overdue and complete the correct date', () => {
		it.skip('reproduces issue #936 - documents the recommended fix approach', () => {
			// Reproduces issue #936
			// Recommended fix for toggleRecurringTaskComplete in TaskService.ts

			// Current code (TaskService.ts lines 1801-1809):
			// const targetDate = date || (() => {
			//   const todayLocal = getTodayLocal();
			//   return createUTCDateFromLocalCalendarDate(todayLocal);
			// })();

			// Proposed fix:
			// const getCompletionTargetDate = (task: TaskInfo, explicitDate?: Date): Date => {
			//   if (explicitDate) return explicitDate;
			//
			//   const todayLocal = getTodayLocal();
			//   const today = createUTCDateFromLocalCalendarDate(todayLocal);
			//   const todayStr = formatDateForStorage(today);
			//
			//   // If task has a scheduled date in the past, complete that date instead
			//   if (task.scheduled) {
			//     const scheduledDate = parseDateToUTC(task.scheduled);
			//     if (scheduledDate < today) {
			//       // Task is overdue - complete the scheduled (overdue) date
			//       return scheduledDate;
			//     }
			//   }
			//
			//   // Task is current or future - complete today
			//   return today;
			// };

			expect(true).toBe(true); // Documentation placeholder
		});
	});

	describe('Fix approach: Bulk catch-up option', () => {
		it.skip('reproduces issue #936 - documents bulk catch-up approach', () => {
			// Reproduces issue #936
			// Alternative approach: provide a "catch up" action for very overdue tasks

			// This could be a separate context menu option:
			// "Complete and catch up to today" which would:
			// 1. Add all overdue dates to complete_instances
			// 2. Move scheduled to today
			// 3. Task remains as a todo for today

			// Benefits:
			// - Better UX for tasks that are multiple days/weeks overdue
			// - Preserves accurate completion history
			// - Single action instead of multiple clicks

			expect(true).toBe(true); // Documentation placeholder
		});
	});
});
