/**
 * Skipped tests for Issue #1232: Recurring tasks do not show in today's tasks view
 * even if next scheduled day is today's
 *
 * Bug Description:
 * When a recurring task is scheduled for today (according to its RRULE), it does not
 * appear in the "Today" tasks view in Bases.
 *
 * Root Cause:
 * The Bases filter template for "Today" view uses a simple date comparison:
 *   - date(${scheduledProperty}) == today()
 *   - date(${dueProperty}) == today()
 *
 * For recurring tasks, the `scheduled` property contains the original DTSTART date
 * (when the recurrence pattern began), NOT the next occurrence date. So even if
 * today is a valid occurrence according to the RRULE, the filter fails because:
 *   Original scheduled date (e.g., 2025-01-01) != today (e.g., 2025-10-06)
 *
 * Example:
 * - Task created with: scheduled: 2025-01-01, recurrence: RRULE:FREQ=DAILY
 * - Today is 2025-10-06
 * - The task should appear in "Today" view because 2025-10-06 is a valid daily occurrence
 * - But the filter checks: date("2025-01-01") == today() -> false
 * - So the task is incorrectly excluded from "Today" view
 *
 * Related files:
 * - src/templates/defaultBasesFiles.ts (lines 527-549 - "Today" view filter)
 * - src/utils/helpers.ts (isDueByRRule function - correctly calculates occurrences)
 * - src/services/BasesFilterConverter.ts (filter evaluation)
 *
 * The isDueByRRule helper function in helpers.ts correctly uses the RRULE to determine
 * if a task is due on a specific date, but the Bases filter system cannot call this
 * function - it only supports simple date comparisons.
 *
 * Suggested fix approaches:
 * 1. Store a computed "next_occurrence" property and use that in filters
 * 2. Modify the filter logic to not require a date match for recurring tasks
 * 3. Create a formula that can evaluate RRULE patterns in Bases
 * 4. Special-case recurring tasks in the filter to show all incomplete recurring tasks
 *    and let the view layer filter by isDueByRRule
 */

import { describe, it, expect } from '@jest/globals';
import { isDueByRRule } from '../../../src/utils/helpers';
import { TaskInfo } from '../../../src/types';
import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #1232: Recurring tasks do not show in today\'s tasks view', () => {
    describe('Core bug demonstration', () => {
        it.skip('reproduces issue #1232 - recurring task scheduled in past should appear on today', () => {
            // Reproduces issue #1232
            // A daily recurring task created on 2025-01-01 should appear on 2025-10-06

            const task: TaskInfo = {
                title: 'Daily standup',
                status: 'open',
                path: 'tasks/daily-standup.md',
                scheduled: '2025-01-01', // Original start date
                recurrence: 'RRULE:FREQ=DAILY',
            };

            const today = new Date(Date.UTC(2025, 9, 6)); // Oct 6, 2025

            // isDueByRRule correctly identifies that today is a valid occurrence
            const isDue = isDueByRRule(task, today);
            expect(isDue).toBe(true);

            // But the Bases filter compares:
            // date("2025-01-01") == today()  -> false
            // This is the bug - the filter uses the wrong comparison
            const scheduledDateMatchesToday = task.scheduled === formatDateForStorage(today);
            expect(scheduledDateMatchesToday).toBe(false);

            // EXPECTED: Task should appear in Today view
            // ACTUAL: Task does not appear because filter comparison fails
        });

        it.skip('reproduces issue #1232 - weekly recurring task should appear on correct day', () => {
            // Reproduces issue #1232
            // A weekly recurring task on Mondays should appear every Monday

            const task: TaskInfo = {
                title: 'Weekly review',
                status: 'open',
                path: 'tasks/weekly-review.md',
                scheduled: '2025-01-06', // First Monday of 2025
                recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
            };

            // October 6, 2025 is a Monday
            const mondayOct6 = new Date(Date.UTC(2025, 9, 6));

            // isDueByRRule correctly identifies Monday as a valid occurrence
            const isDue = isDueByRRule(task, mondayOct6);
            expect(isDue).toBe(true);

            // But filter would compare: date("2025-01-06") == date("2025-10-06") -> false
            const scheduledDateMatchesToday = task.scheduled === formatDateForStorage(mondayOct6);
            expect(scheduledDateMatchesToday).toBe(false);

            // Bug: Task should appear on Oct 6 but doesn't due to filter logic
        });

        it.skip('reproduces issue #1232 - monthly recurring task should appear on correct day', () => {
            // Reproduces issue #1232
            // A monthly recurring task on the 15th should appear every 15th

            const task: TaskInfo = {
                title: 'Monthly report',
                status: 'open',
                path: 'tasks/monthly-report.md',
                scheduled: '2025-01-15', // 15th of January
                recurrence: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15',
            };

            // October 15, 2025
            const oct15 = new Date(Date.UTC(2025, 9, 15));

            // isDueByRRule correctly identifies the 15th as a valid occurrence
            const isDue = isDueByRRule(task, oct15);
            expect(isDue).toBe(true);

            // Filter comparison fails
            const scheduledDateMatchesToday = task.scheduled === formatDateForStorage(oct15);
            expect(scheduledDateMatchesToday).toBe(false);
        });
    });

    describe('Bases filter logic analysis', () => {
        it.skip('reproduces issue #1232 - simulates the Bases Today filter behavior', () => {
            // Reproduces issue #1232
            // This test simulates what the Bases filter actually does

            const task: TaskInfo = {
                title: 'Daily task',
                status: 'open',
                path: 'tasks/daily.md',
                scheduled: '2025-01-01',
                recurrence: 'RRULE:FREQ=DAILY',
                complete_instances: [], // No completed instances
            };

            const today = new Date(Date.UTC(2025, 9, 6));
            const todayStr = formatDateForStorage(today);

            // Filter condition 1: Incomplete status check (WORKS CORRECTLY)
            // "!complete_instances.contains(today().format("yyyy-MM-dd"))"
            const isIncomplete = !task.complete_instances?.includes(todayStr);
            expect(isIncomplete).toBe(true); // Correctly identifies as incomplete

            // Filter condition 2: Date match check (FAILS FOR RECURRING TASKS)
            // "date(scheduled) == today()"
            const dateMatches = task.scheduled === todayStr;
            expect(dateMatches).toBe(false); // This is the bug!

            // The AND of both conditions fails:
            const wouldAppearInTodayView = isIncomplete && dateMatches;
            expect(wouldAppearInTodayView).toBe(false);

            // But it SHOULD appear because isDueByRRule returns true
            expect(isDueByRRule(task, today)).toBe(true);
        });

        it.skip('reproduces issue #1232 - non-recurring tasks work correctly', () => {
            // Reproduces issue #1232
            // Verify that non-recurring tasks scheduled for today DO appear

            const task: TaskInfo = {
                title: 'One-time task',
                status: 'open',
                path: 'tasks/one-time.md',
                scheduled: '2025-10-06', // Scheduled for today
            };

            const today = new Date(Date.UTC(2025, 9, 6));
            const todayStr = formatDateForStorage(today);

            // For non-recurring tasks, the simple date comparison works
            const dateMatches = task.scheduled === todayStr;
            expect(dateMatches).toBe(true); // This works!

            // So non-recurring tasks appear correctly
            // Only recurring tasks have this bug
        });
    });

    describe('Expected behavior after fix', () => {
        it.skip('reproduces issue #1232 - recurring task should use RRULE for date matching', () => {
            // Reproduces issue #1232
            // After fix, the filter should use RRULE to determine if task is due today

            const task: TaskInfo = {
                title: 'Daily task',
                status: 'open',
                path: 'tasks/daily.md',
                scheduled: '2025-01-01',
                recurrence: 'RRULE:FREQ=DAILY',
                complete_instances: [],
            };

            const today = new Date(Date.UTC(2025, 9, 6));
            const todayStr = formatDateForStorage(today);

            // The correct logic should be:
            // For recurring tasks: isDueByRRule(task, today) && !complete_instances.includes(todayStr)
            // For non-recurring tasks: scheduled == today

            const hasRecurrence = !!task.recurrence;
            const isIncomplete = !task.complete_instances?.includes(todayStr);

            let shouldAppearInTodayView: boolean;
            if (hasRecurrence) {
                // Use RRULE evaluation for recurring tasks
                shouldAppearInTodayView = isDueByRRule(task, today) && isIncomplete;
            } else {
                // Use simple date comparison for non-recurring tasks
                shouldAppearInTodayView = task.scheduled === todayStr && isIncomplete;
            }

            expect(shouldAppearInTodayView).toBe(true);
        });

        it.skip('reproduces issue #1232 - completed recurring task instance should not appear', () => {
            // Reproduces issue #1232
            // A recurring task that is completed for today should not appear

            const today = new Date(Date.UTC(2025, 9, 6));
            const todayStr = formatDateForStorage(today);

            const task: TaskInfo = {
                title: 'Daily task (completed today)',
                status: 'open',
                path: 'tasks/daily.md',
                scheduled: '2025-01-01',
                recurrence: 'RRULE:FREQ=DAILY',
                complete_instances: [todayStr], // Completed today
            };

            // isDueByRRule says it's due today
            expect(isDueByRRule(task, today)).toBe(true);

            // But it's in complete_instances, so should not appear
            const isIncomplete = !task.complete_instances?.includes(todayStr);
            expect(isIncomplete).toBe(false);

            // Should not appear in Today view (completed for today)
            const shouldAppearInTodayView = isDueByRRule(task, today) && isIncomplete;
            expect(shouldAppearInTodayView).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it.skip('reproduces issue #1232 - task with due date but no scheduled date', () => {
            // Reproduces issue #1232
            // Recurring task with due date instead of scheduled date

            const task: TaskInfo = {
                title: 'Recurring due task',
                status: 'open',
                path: 'tasks/recurring-due.md',
                due: '2025-01-01',
                recurrence: 'RRULE:FREQ=DAILY',
            };

            const today = new Date(Date.UTC(2025, 9, 6));

            // The filter also checks: date(due) == today()
            // This has the same bug for recurring tasks
            expect(isDueByRRule(task, today)).toBe(true);
            expect(task.due === formatDateForStorage(today)).toBe(false);
        });

        it.skip('reproduces issue #1232 - DTSTART in RRULE should be used for calculations', () => {
            // Reproduces issue #1232
            // When DTSTART is embedded in the RRULE, it should be used

            const task: TaskInfo = {
                title: 'Task with DTSTART in RRULE',
                status: 'open',
                path: 'tasks/dtstart-rrule.md',
                scheduled: '2025-10-01', // This might differ from DTSTART
                recurrence: 'DTSTART:20250101;RRULE:FREQ=DAILY',
            };

            const today = new Date(Date.UTC(2025, 9, 6));

            // isDueByRRule uses the DTSTART from the RRULE string (2025-01-01)
            expect(isDueByRRule(task, today)).toBe(true);
        });

        it.skip('reproduces issue #1232 - recurring task with end date in past', () => {
            // Reproduces issue #1232
            // A recurring task that has ended should not appear

            const task: TaskInfo = {
                title: 'Ended recurring task',
                status: 'open',
                path: 'tasks/ended.md',
                scheduled: '2025-01-01',
                recurrence: 'RRULE:FREQ=DAILY;UNTIL=20250901', // Ended Sept 1, 2025
            };

            const today = new Date(Date.UTC(2025, 9, 6)); // Oct 6, 2025 (after end)

            // isDueByRRule correctly returns false for dates after UNTIL
            expect(isDueByRRule(task, today)).toBe(false);

            // This case would correctly NOT appear (though for wrong reason in current code)
        });
    });
});

describe('Issue #1232: Bases filter template analysis', () => {
    it.skip('reproduces issue #1232 - documents the problematic filter pattern', () => {
        // Reproduces issue #1232
        // The current filter in defaultBasesFiles.ts (lines 527-549) is:
        //
        // - type: tasknotesTaskList
        //   name: "Today"
        //   filters:
        //     and:
        //       # Incomplete tasks (handles both recurring and non-recurring)
        //       - or:
        //         # Non-recurring task that's not in any completed status
        //         - and:
        //           - ${recurrenceProperty}.isEmpty()
        //           - ${nonRecurringIncompleteFilter}
        //         # Recurring task where today is not in complete_instances
        //         - and:
        //           - ${recurrenceProperty}
        //           - "!${completeInstancesProperty}.contains(today().format(\"yyyy-MM-dd\"))"
        //       # Due or scheduled today  <-- THIS IS THE PROBLEM
        //       - or:
        //         - date(${dueProperty}) == today()
        //         - date(${scheduledProperty}) == today()
        //
        // The second part of the AND requires the date to match today.
        // For recurring tasks, this should be replaced with RRULE evaluation.

        expect(true).toBe(true); // Placeholder for documentation
    });

    it.skip('reproduces issue #1232 - suggested filter modification', () => {
        // Reproduces issue #1232
        // Possible fix: For recurring tasks, rely only on the incomplete check
        // and let the view layer use isDueByRRule to filter
        //
        // Alternative filter structure:
        //
        // filters:
        //   and:
        //     - or:
        //       # Non-recurring task scheduled/due today
        //       - and:
        //         - ${recurrenceProperty}.isEmpty()
        //         - ${nonRecurringIncompleteFilter}
        //         - or:
        //           - date(${dueProperty}) == today()
        //           - date(${scheduledProperty}) == today()
        //       # Recurring task that is incomplete for today
        //       # (let the view layer filter by isDueByRRule)
        //       - and:
        //         - ${recurrenceProperty}
        //         - "!${completeInstancesProperty}.contains(today().format(\"yyyy-MM-dd\"))"
        //
        // This would show ALL incomplete recurring tasks, then the view layer
        // would need to filter them using isDueByRRule.

        expect(true).toBe(true); // Placeholder for documentation
    });
});
