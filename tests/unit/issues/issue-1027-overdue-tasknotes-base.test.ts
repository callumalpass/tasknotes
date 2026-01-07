/**
 * Skipped tests for Issue #1027: Overdue TaskNotes base not working
 *
 * Bug Description:
 * User created a TaskNote base that displays just overdue tasks, but while some
 * overdue tasks show up, others don't, even though they should based on the filters.
 *
 * Root Cause:
 * This is the same underlying issue as #1231. The Bases "Overdue" view filter
 * in defaultBasesFiles.ts (line 565) only checks:
 *   - date(${dueProperty}) < today()
 *
 * It does NOT check scheduled dates:
 *   - date(${scheduledProperty}) < today()
 *
 * This means tasks that are overdue based on their scheduled date (but not their
 * due date) will not appear in the overdue section, even though FilterService
 * correctly identifies them as overdue.
 *
 * Related Issues:
 * - #1231: Task List base overdue not including overdue scheduled tasks (same root cause)
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
 * @see https://github.com/callumalpass/tasknotes/issues/1027
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FilterService } from '../../../src/services/FilterService';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { TaskFactory, PluginFactory } from '../../helpers/mock-factories';
import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #1027: Overdue TaskNotes base not working', () => {
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

    describe('User scenario: Custom overdue TaskNote base showing inconsistent results', () => {
        it.skip('reproduces issue #1027 - some overdue tasks missing from custom overdue base', async () => {
            // Reproduces issue #1027
            // User creates a custom base with overdue filter, but not all overdue tasks appear
            //
            // Today: Oct 6, 2025
            // Task 1: Due Oct 3 (3 days ago) - SHOULD appear, DOES appear
            // Task 2: Scheduled Oct 4 (2 days ago), no due date - SHOULD appear, DOESN'T appear
            // Task 3: Due Oct 5 (yesterday) - SHOULD appear, DOES appear
            // Task 4: Scheduled Oct 2, Due Oct 10 (future) - SHOULD appear (scheduled overdue), DOESN'T appear

            const tasks: TaskInfo[] = [
                // Task 1: Overdue due date - appears correctly
                TaskFactory.createTask({
                    path: 'tasks/task-1-due-overdue.md',
                    title: 'Task 1: Due date overdue',
                    due: formatDateForStorage(new Date(Date.UTC(2025, 9, 3))), // Oct 3
                    scheduled: undefined,
                    status: ' ',
                }),
                // Task 2: Only scheduled date (overdue) - BUG: won't appear
                TaskFactory.createTask({
                    path: 'tasks/task-2-scheduled-only.md',
                    title: 'Task 2: Scheduled only (overdue)',
                    scheduled: formatDateForStorage(new Date(Date.UTC(2025, 9, 4))), // Oct 4
                    due: undefined,
                    status: ' ',
                }),
                // Task 3: Overdue due date - appears correctly
                TaskFactory.createTask({
                    path: 'tasks/task-3-due-yesterday.md',
                    title: 'Task 3: Due yesterday',
                    due: formatDateForStorage(new Date(Date.UTC(2025, 9, 5))), // Oct 5
                    scheduled: undefined,
                    status: ' ',
                }),
                // Task 4: Scheduled overdue, due in future - BUG: won't appear
                TaskFactory.createTask({
                    path: 'tasks/task-4-scheduled-past-due-future.md',
                    title: 'Task 4: Scheduled overdue, due in future',
                    scheduled: formatDateForStorage(new Date(Date.UTC(2025, 9, 2))), // Oct 2
                    due: formatDateForStorage(new Date(Date.UTC(2025, 9, 10))), // Oct 10
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
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            const { overdueTasks } = await filterService.getAgendaDataWithOverdue(
                [new Date(Date.UTC(2025, 9, 6))], // Today
                query,
                true
            );

            // FilterService correctly identifies ALL 4 tasks as overdue
            expect(overdueTasks.length).toBe(4);
            expect(overdueTasks.some(t => t.path === 'tasks/task-1-due-overdue.md')).toBe(true);
            expect(overdueTasks.some(t => t.path === 'tasks/task-2-scheduled-only.md')).toBe(true);
            expect(overdueTasks.some(t => t.path === 'tasks/task-3-due-yesterday.md')).toBe(true);
            expect(overdueTasks.some(t => t.path === 'tasks/task-4-scheduled-past-due-future.md')).toBe(true);

            // BUG: The Bases "Overdue" filter only checks: date(due) < today()
            // So it would only show:
            //   - Task 1 (due Oct 3 < today) ✓
            //   - Task 3 (due Oct 5 < today) ✓
            //
            // It would NOT show:
            //   - Task 2 (no due date, only scheduled) ✗
            //   - Task 4 (due Oct 10 > today, even though scheduled Oct 2 < today) ✗
            //
            // This creates the inconsistency the user reported: "some overdue tasks show up,
            // others don't, even though they should based on the filters"
        });

        it.skip('reproduces issue #1027 - recurring tasks with overdue scheduled dates not appearing', async () => {
            // Reproduces issue #1027
            // Recurring tasks that are overdue based on scheduled date don't appear

            const tasks: TaskInfo[] = [
                // Daily recurring task - scheduled yesterday, not completed
                TaskFactory.createTask({
                    path: 'tasks/daily-task.md',
                    title: 'Daily recurring task',
                    scheduled: formatDateForStorage(new Date(Date.UTC(2025, 9, 5))), // Oct 5 (yesterday)
                    recurrence: 'RRULE:FREQ=DAILY',
                    due: undefined,
                    status: ' ',
                    completeInstances: [], // Not completed
                }),
                // Weekly task with due date overdue
                TaskFactory.createTask({
                    path: 'tasks/weekly-task.md',
                    title: 'Weekly task with due',
                    due: formatDateForStorage(new Date(Date.UTC(2025, 9, 3))), // Oct 3
                    recurrence: 'RRULE:FREQ=WEEKLY',
                    scheduled: undefined,
                    status: ' ',
                    completeInstances: [],
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

            // FilterService finds both recurring tasks as overdue
            expect(overdueTasks.length).toBe(2);
            expect(overdueTasks.some(t => t.path === 'tasks/daily-task.md')).toBe(true);
            expect(overdueTasks.some(t => t.path === 'tasks/weekly-task.md')).toBe(true);

            // BUG: Bases filter only checks due date
            // - daily-task.md has no due date, so it won't appear
            // - weekly-task.md has due date overdue, so it will appear
        });
    });

    describe('Verification: FilterService overdue detection is correct', () => {
        it('should correctly identify tasks as overdue based on scheduled date', async () => {
            // This test PASSES - verifies FilterService already handles this correctly
            // The bug is in the Bases filter template, not FilterService

            const yesterday = new Date(Date.UTC(2025, 9, 5)); // Oct 5

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
                [new Date(Date.UTC(2025, 9, 6))], // Today
                query,
                true
            );

            // FilterService correctly identifies this as overdue
            expect(overdueTasks.length).toBe(1);
            expect(overdueTasks[0].path).toBe('tasks/scheduled-only.md');
        });

        it('should correctly identify tasks as overdue when scheduled is past but due is future', async () => {
            // This test PASSES - verifies FilterService behavior
            // Task scheduled yesterday but due next week should be overdue

            const yesterday = new Date(Date.UTC(2025, 9, 5));
            const nextWeek = new Date(Date.UTC(2025, 9, 13));

            const task: TaskInfo = TaskFactory.createTask({
                path: 'tasks/scheduled-past-due-future.md',
                title: 'Scheduled past, due future',
                scheduled: formatDateForStorage(yesterday),
                due: formatDateForStorage(nextWeek),
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([task.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(task);

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

            // FilterService correctly identifies this as overdue (scheduled is past)
            expect(overdueTasks.length).toBe(1);
            expect(overdueTasks[0].path).toBe('tasks/scheduled-past-due-future.md');
        });
    });
});
