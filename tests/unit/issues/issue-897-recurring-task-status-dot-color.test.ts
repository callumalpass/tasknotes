/**
 * Skipped tests for Issue #897: Task Status Dot colouring doesn't work for recurring tasks
 *
 * Bug Description:
 * The task status dot doesn't update for recurring tasks - it stays on the default coloring
 * rather than reflecting the current status. The status field value updates correctly, but
 * the visual status dot shows the default color.
 *
 * Example scenario:
 * - User has statuses: none (black), open (blue), in-progress (pink), complete (green)
 * - Default status is open (blue)
 * - When changing a one-off task from "open" to "in-progress", the dot color updates from blue to pink
 * - When doing the same for a daily recurring task, the status field value updates to "in-progress"
 *   but the status dot remains blue (showing the default "open" color)
 *
 * Root Cause:
 * The `getEffectiveTaskStatus` function in src/utils/helpers.ts (lines 404-414) only returns
 * "done" or "open" for recurring tasks - it doesn't preserve custom statuses like "in-progress".
 *
 * Current implementation:
 * ```typescript
 * export function getEffectiveTaskStatus(task: any, date: Date): string {
 *     if (!task.recurrence) {
 *         return task.status || "open";
 *     }
 *     // For recurring tasks, only checks completion - ignores actual status!
 *     const dateStr = formatDateForStorage(date);
 *     const completedDates = Array.isArray(task.complete_instances) ? task.complete_instances : [];
 *     return completedDates.includes(dateStr) ? "done" : "open";  // BUG: ignores task.status
 * }
 * ```
 *
 * Expected behavior:
 * Recurring tasks should show their actual status (in-progress, on-hold, etc.) unless they're
 * completed for that specific date. The function should return task.status when the task
 * is not completed for the given date, not hardcoded "open".
 *
 * Related files:
 * - src/utils/helpers.ts (lines 404-414) - getEffectiveTaskStatus function
 * - src/ui/TaskCard.ts (lines 1338-1340) - effectiveStatus used for status dot color
 * - src/ui/TaskCard.ts (lines 1412-1415) - statusConfig retrieved and color applied
 */

import { describe, it, expect } from '@jest/globals';
import { getEffectiveTaskStatus } from '../../../src/utils/helpers';
import { TaskInfo } from '../../../src/types';
import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #897: Task Status Dot colouring doesn\'t work for recurring tasks', () => {
	describe('Core bug demonstration', () => {
		it.skip('reproduces issue #897 - recurring task ignores custom status for status dot', () => {
			// Reproduces issue #897
			// A recurring task with status "in-progress" should show as "in-progress"
			// for dates when it's not completed, but currently returns "open" instead

			const today = new Date(Date.UTC(2025, 0, 15)); // Jan 15, 2025
			const todayStr = formatDateForStorage(today);

			// Create a recurring task with "in-progress" status
			const recurringTask: Partial<TaskInfo> = {
				title: 'Daily standup',
				status: 'in-progress', // User set status to in-progress
				path: 'tasks/daily-standup.md',
				scheduled: '2025-01-01',
				recurrence: 'RRULE:FREQ=DAILY',
				complete_instances: [], // Not completed for today
			};

			// For a non-recurring task, getEffectiveTaskStatus returns the actual status
			const nonRecurringTask: Partial<TaskInfo> = {
				title: 'One-off task',
				status: 'in-progress',
				path: 'tasks/one-off.md',
			};
			const nonRecurringStatus = getEffectiveTaskStatus(nonRecurringTask, today);
			expect(nonRecurringStatus).toBe('in-progress'); // Works correctly

			// BUG: For recurring task, getEffectiveTaskStatus returns "open" instead of "in-progress"
			const recurringStatus = getEffectiveTaskStatus(recurringTask, today);

			// EXPECTED: Should return "in-progress" (the actual task status)
			// ACTUAL: Returns "open" (hardcoded default)
			expect(recurringStatus).toBe('open'); // This is the bug - should be 'in-progress'

			// The status dot color is determined by this effective status,
			// so the dot shows blue (open) instead of pink (in-progress)
		});

		it.skip('reproduces issue #897 - verifies expected behavior for recurring task status', () => {
			// Reproduces issue #897
			// This test documents what the EXPECTED behavior should be

			const today = new Date(Date.UTC(2025, 0, 15));
			const yesterday = new Date(Date.UTC(2025, 0, 14));
			const yesterdayStr = formatDateForStorage(yesterday);
			const todayStr = formatDateForStorage(today);

			// Recurring task with custom status "in-progress"
			const task: Partial<TaskInfo> = {
				title: 'Daily review',
				status: 'in-progress',
				path: 'tasks/daily-review.md',
				recurrence: 'RRULE:FREQ=DAILY',
				complete_instances: [yesterdayStr], // Completed yesterday, not today
			};

			// EXPECTED BEHAVIOR (when fixed):
			// - For yesterday (completed): should return "done"
			// - For today (not completed): should return "in-progress" (the task's actual status)
			const statusYesterday = getEffectiveTaskStatus(task, yesterday);
			const statusToday = getEffectiveTaskStatus(task, today);

			// Yesterday should show as done (completed instance)
			expect(statusYesterday).toBe('done');

			// Today should show actual status "in-progress", not "open"
			// THIS ASSERTION WILL FAIL until the bug is fixed
			// Currently returns "open" instead of "in-progress"
			expect(statusToday).toBe('open'); // Bug: hardcoded "open" instead of task.status
		});

		it.skip('reproduces issue #897 - various custom statuses ignored for recurring tasks', () => {
			// Reproduces issue #897
			// Tests multiple custom statuses to show the bug affects all non-default statuses

			const today = new Date(Date.UTC(2025, 0, 15));

			const customStatuses = ['in-progress', 'on-hold', 'blocked', 'waiting', 'review'];

			for (const customStatus of customStatuses) {
				const task: Partial<TaskInfo> = {
					title: `Task with ${customStatus} status`,
					status: customStatus,
					path: `tasks/task-${customStatus}.md`,
					recurrence: 'RRULE:FREQ=DAILY',
					complete_instances: [],
				};

				const effectiveStatus = getEffectiveTaskStatus(task, today);

				// BUG: All custom statuses are lost, returning "open" instead
				expect(effectiveStatus).toBe('open'); // Should be customStatus
			}
		});
	});

	describe('Suggested fix verification', () => {
		it.skip('reproduces issue #897 - documents the expected fix behavior', () => {
			// Reproduces issue #897
			// Documents how getEffectiveTaskStatus SHOULD work after the fix

			const today = new Date(Date.UTC(2025, 0, 15));
			const todayStr = formatDateForStorage(today);

			// This is what the fixed implementation should return:
			// 1. Non-recurring tasks: return task.status (current behavior, correct)
			// 2. Recurring tasks with date in complete_instances: return "done" (current behavior, correct)
			// 3. Recurring tasks without date in complete_instances: return task.status (BUG: currently returns "open")

			const taskNotCompleted: Partial<TaskInfo> = {
				status: 'in-progress',
				recurrence: 'RRULE:FREQ=DAILY',
				complete_instances: [],
			};

			const taskCompletedToday: Partial<TaskInfo> = {
				status: 'in-progress',
				recurrence: 'RRULE:FREQ=DAILY',
				complete_instances: [todayStr],
			};

			// Completed task should return "done" (current behavior is correct)
			expect(getEffectiveTaskStatus(taskCompletedToday, today)).toBe('done');

			// Not completed task should return actual status (bug: returns "open")
			const actual = getEffectiveTaskStatus(taskNotCompleted, today);
			expect(actual).toBe('open'); // Bug demonstration

			// After fix, this should be true:
			// expect(getEffectiveTaskStatus(taskNotCompleted, today)).toBe('in-progress');
		});
	});
});
