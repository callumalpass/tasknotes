/**
 * Skipped tests for Issue #1231: Task List base overdue not including overdue scheduled tasks
 *
 * Bug Description:
 * After the release moving towards using Bases, the overdue scheduled tasks are no longer
 * visible by default. Previously, the agenda view's "Overdue" section showed both:
 * - Tasks overdue based on due date
 * - Tasks overdue based on scheduled date
 *
 * Now, the default bases file template only shows overdue on the due date.
 *
 * Root Cause:
 * The Bases "Overdue" view filter in defaultBasesFiles.ts (line 565) only checks:
 *   - date(${dueProperty}) < today()
 *
 * This excludes tasks that only have an overdue scheduled date (no due date set).
 *
 * Meanwhile, FilterService.getOverdueTasks() (lines 2556-2569) correctly checks BOTH:
 *   - if (task.due) { isOverdueTimeAware(task.due, ...) }
 *   - if (task.scheduled) { isOverdueTimeAware(task.scheduled, ...) }
 *
 * This discrepancy means:
 * - The old agenda view (using FilterService) showed overdue scheduled tasks
 * - The new Bases view filter does NOT show overdue scheduled tasks
 *
 * Related files:
 * - src/templates/defaultBasesFiles.ts (lines 550-570 - "Overdue" view filter)
 * - src/services/FilterService.ts (lines 2528-2580 - getOverdueTasks method)
 * - src/utils/dateUtils.ts (isOverdueTimeAware function)
 *
 * Suggested fix:
 * Update the Bases "Overdue" view filter to also check scheduled date:
 *   - or:
 *     - date(${dueProperty}) < today()
 *     - date(${scheduledProperty}) < today()
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1231
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FilterService } from '../../../src/services/FilterService';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { TaskFactory, PluginFactory } from '../../helpers/mock-factories';
import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #1231: Bases overdue view not including overdue scheduled tasks', () => {
    let filterService: FilterService;
    let mockCacheManager: any;
    let statusManager: StatusManager;
    let priorityManager: PriorityManager;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock system date to Oct 6, 2025 for consistent testing
        jest.useFakeTimers();
        jest.setSystemTime(new Date(Date.UTC(2025, 9, 6, 12, 0, 0))); // Oct 6, 2025 12:00 UTC

        // Setup mock services
        statusManager = new StatusManager([
            { id: 'open', value: ' ', label: 'Open', color: '#000000', isCompleted: false, order: 1 },
            { id: 'done', value: 'x', label: 'Done', color: '#00ff00', isCompleted: true, order: 2 }
        ]);
        priorityManager = new PriorityManager([
            { id: 'normal', value: 'normal', label: 'Normal', color: '#000000', weight: 0 }
        ]);
        mockCacheManager = PluginFactory.createMockPlugin().cacheManager;

        mockPlugin = {
            settings: {
                hideCompletedFromOverdue: true,
                userFields: []
            },
            i18n: {
                translate: (key: string) => key,
                getCurrentLocale: () => 'en'
            }
        };

        filterService = new FilterService(
            mockCacheManager,
            statusManager,
            priorityManager,
            mockPlugin
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Core bug demonstration - scheduled date vs due date handling', () => {
        it.skip('reproduces issue #1231 - task with only overdue scheduled date should appear in overdue section', async () => {
            // Reproduces issue #1231
            // A task with only a scheduled date in the past should be considered overdue

            const yesterday = new Date(Date.UTC(2025, 9, 5)); // Oct 5, 2025

            // Task with ONLY a scheduled date (no due date) that is in the past
            const taskWithOnlyScheduledDate: TaskInfo = TaskFactory.createTask({
                path: 'tasks/scheduled-only.md',
                title: 'Task with only scheduled date',
                scheduled: formatDateForStorage(yesterday), // Yesterday
                due: undefined, // No due date
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskWithOnlyScheduledDate.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskWithOnlyScheduledDate);

            const query: FilterQuery = {
                type: 'group',
                id: 'root',
                conjunction: 'and',
                children: [],
                sortKey: 'scheduled',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const { overdueTasks } = await filterService.getAgendaDataWithOverdue(
                [new Date(Date.UTC(2025, 9, 6))], // Today
                query,
                true
            );

            // FilterService correctly identifies this as overdue
            expect(overdueTasks.some(t => t.path === taskWithOnlyScheduledDate.path)).toBe(true);

            // BUG: But the Bases filter template ONLY checks:
            //   date(${dueProperty}) < today()
            // Since this task has no due date, it won't match the Bases filter
            // even though FilterService correctly identifies it as overdue.
            //
            // The Bases filter should ALSO check:
            //   date(${scheduledProperty}) < today()
            //
            // EXPECTED: Task appears in Bases "Overdue" view
            // ACTUAL: Task does NOT appear because Bases filter only checks due date
        });

        it.skip('reproduces issue #1231 - task with overdue scheduled date and future due date', async () => {
            // Reproduces issue #1231
            // Edge case: Task scheduled for yesterday but due next week
            // Should this be considered overdue? The user expected to work on it yesterday.

            const yesterday = new Date(Date.UTC(2025, 9, 5));
            const nextWeek = new Date(Date.UTC(2025, 9, 13));

            const taskScheduledYesterdayDueNextWeek: TaskInfo = TaskFactory.createTask({
                path: 'tasks/scheduled-yesterday-due-next-week.md',
                title: 'Task scheduled yesterday, due next week',
                scheduled: formatDateForStorage(yesterday),
                due: formatDateForStorage(nextWeek),
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskScheduledYesterdayDueNextWeek.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskScheduledYesterdayDueNextWeek);

            const query: FilterQuery = {
                type: 'group',
                id: 'root',
                conjunction: 'and',
                children: [],
                sortKey: 'scheduled',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const { overdueTasks } = await filterService.getAgendaDataWithOverdue(
                [new Date(Date.UTC(2025, 9, 6))],
                query,
                true
            );

            // FilterService correctly identifies this as overdue (scheduled date is past)
            expect(overdueTasks.some(t => t.path === taskScheduledYesterdayDueNextWeek.path)).toBe(true);

            // BUG: Bases filter checks: date(due) < today()
            // Since due is next week, this is FALSE, so task doesn't appear
            //
            // EXPECTED: Task appears in "Overdue" because scheduled date is past
            // ACTUAL: Task does NOT appear because only due date is checked
        });

        it.skip('reproduces issue #1231 - recurring task with overdue scheduled date', async () => {
            // Reproduces issue #1231
            // A recurring task where the current instance's scheduled date is in the past

            const yesterday = new Date(Date.UTC(2025, 9, 5));

            const recurringTaskOverdueScheduled: TaskInfo = TaskFactory.createTask({
                path: 'tasks/recurring-scheduled-overdue.md',
                title: 'Daily recurring task - overdue scheduled',
                scheduled: formatDateForStorage(yesterday),
                recurrence: 'RRULE:FREQ=DAILY',
                due: undefined,
                status: ' ',
                completeInstances: [], // Not completed for yesterday
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTaskOverdueScheduled.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(recurringTaskOverdueScheduled);

            const query: FilterQuery = {
                type: 'group',
                id: 'root',
                conjunction: 'and',
                children: [],
                sortKey: 'scheduled',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const { overdueTasks } = await filterService.getAgendaDataWithOverdue(
                [new Date(Date.UTC(2025, 9, 6))],
                query,
                true
            );

            // FilterService checks scheduled date for recurring tasks
            expect(overdueTasks.some(t => t.path === recurringTaskOverdueScheduled.path)).toBe(true);

            // BUG: Bases filter only checks:
            //   date(${dueProperty}) < today()
            // This recurring task has no due date, so it won't match
        });
    });

    describe('Comparison: FilterService vs Bases filter behavior', () => {
        it.skip('demonstrates the discrepancy between FilterService and Bases filter', async () => {
            // Reproduces issue #1231
            // This test shows the exact discrepancy between the two filtering mechanisms

            const yesterday = new Date(Date.UTC(2025, 9, 5));

            // Create multiple tasks to demonstrate different scenarios
            const tasks: TaskInfo[] = [
                // Task 1: Only due date (past) - BOTH should show as overdue
                TaskFactory.createTask({
                    path: 'tasks/due-only-past.md',
                    title: 'Due only (past)',
                    due: formatDateForStorage(yesterday),
                    scheduled: undefined,
                    status: ' ',
                }),
                // Task 2: Only scheduled date (past) - FilterService shows, Bases doesn't
                TaskFactory.createTask({
                    path: 'tasks/scheduled-only-past.md',
                    title: 'Scheduled only (past)',
                    scheduled: formatDateForStorage(yesterday),
                    due: undefined,
                    status: ' ',
                }),
                // Task 3: Both dates in past - BOTH should show as overdue
                TaskFactory.createTask({
                    path: 'tasks/both-past.md',
                    title: 'Both dates past',
                    due: formatDateForStorage(yesterday),
                    scheduled: formatDateForStorage(yesterday),
                    status: ' ',
                }),
            ];

            mockCacheManager.getAllTaskPaths.mockReturnValue(tasks.map(t => t.path));
            mockCacheManager.getCachedTaskInfo.mockImplementation((path: string) => {
                return Promise.resolve(tasks.find(t => t.path === path) ?? null);
            });

            const query: FilterQuery = {
                type: 'group',
                id: 'root',
                conjunction: 'and',
                children: [],
                sortKey: 'scheduled',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const { overdueTasks } = await filterService.getAgendaDataWithOverdue(
                [new Date(Date.UTC(2025, 9, 6))],
                query,
                true
            );

            // FilterService correctly identifies ALL 3 tasks as overdue
            expect(overdueTasks.length).toBe(3);
            expect(overdueTasks.some(t => t.path === 'tasks/due-only-past.md')).toBe(true);
            expect(overdueTasks.some(t => t.path === 'tasks/scheduled-only-past.md')).toBe(true);
            expect(overdueTasks.some(t => t.path === 'tasks/both-past.md')).toBe(true);

            // BUG: The Bases filter template in defaultBasesFiles.ts (line 565):
            //   - date(${dueProperty}) < today()
            //
            // Would only match:
            //   - tasks/due-only-past.md (due date is past) ✓
            //   - tasks/both-past.md (due date is past) ✓
            //
            // Would NOT match:
            //   - tasks/scheduled-only-past.md (no due date, only scheduled) ✗
            //
            // The filter should be updated to:
            //   - or:
            //     - date(${dueProperty}) < today()
            //     - date(${scheduledProperty}) < today()
        });
    });

    describe('Expected behavior after fix', () => {
        it('should verify FilterService already handles scheduled dates correctly', async () => {
            // This test PASSES - it demonstrates that FilterService already has the correct behavior
            // The issue is that the Bases filter template doesn't match this behavior

            const yesterday = new Date(Date.UTC(2025, 9, 5));

            const taskWithOnlyScheduledDate: TaskInfo = TaskFactory.createTask({
                path: 'tasks/scheduled-only.md',
                title: 'Task with only scheduled date',
                scheduled: formatDateForStorage(yesterday),
                due: undefined,
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskWithOnlyScheduledDate.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskWithOnlyScheduledDate);

            const query: FilterQuery = {
                type: 'group',
                id: 'root',
                conjunction: 'and',
                children: [],
                sortKey: 'scheduled',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const { overdueTasks } = await filterService.getAgendaDataWithOverdue(
                [new Date(Date.UTC(2025, 9, 6))],
                query,
                true
            );

            // FilterService correctly handles this - the issue is the Bases template
            expect(overdueTasks.length).toBe(1);
            expect(overdueTasks[0].path).toBe('tasks/scheduled-only.md');
        });
    });
});
