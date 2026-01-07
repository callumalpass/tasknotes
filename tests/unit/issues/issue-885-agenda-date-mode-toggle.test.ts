/**
 * Skipped tests for Issue #885: Change date sorting in agenda view to respect when tasks have no due date
 *
 * Feature Request:
 * The user wants the agenda view to distinguish between scheduled dates (when you can START a task)
 * and due dates (hard deadlines). Currently:
 * - Tasks with past scheduled dates but no due dates are shown as "Overdue" (incorrect)
 * - Tasks with future scheduled dates but no due dates appear under their scheduled date as if it were a deadline
 *
 * Requested behavior:
 * 1. Toggle between "due date mode" and "scheduled date mode" for the agenda view
 * 2. In scheduled date mode:
 *    - Group by scheduled date
 *    - Show past-scheduled tasks in a section called "Past" or "Started" (customizable name)
 * 3. In due date mode:
 *    - Group by due date only
 *    - "Overdue" section only contains tasks with past DUE dates
 *    - Configurable handling for tasks with no due date:
 *      a) Show in "No Due Date" section at top
 *      b) Show in "No Due Date" section at bottom
 *      c) Hide them entirely
 *
 * Related files:
 * - src/bases/CalendarView.ts (CalendarView extends BasesViewBase)
 * - src/bases/calendar-core.ts (generateCalendarEvents, event grouping)
 * - src/templates/defaultBasesFiles.ts (view templates with filters)
 * - src/services/FilterService.ts (getAgendaDataWithOverdue)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/885
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FilterService } from '../../../src/services/FilterService';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { TaskFactory, PluginFactory } from '../../helpers/mock-factories';
import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #885: Agenda view date mode toggle feature', () => {
    let filterService: FilterService;
    let mockCacheManager: any;
    let statusManager: StatusManager;
    let priorityManager: PriorityManager;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock system date to Jan 7, 2026 for consistent testing
        jest.useFakeTimers();
        jest.setSystemTime(new Date(Date.UTC(2026, 0, 7, 12, 0, 0))); // Jan 7, 2026 12:00 UTC

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

    describe('Current problematic behavior', () => {
        it.skip('reproduces issue #885 - task with past scheduled date but no due date incorrectly shown as overdue', async () => {
            // Reproduces issue #885
            // A task with only a scheduled date in the past (no due date) is currently
            // grouped into "Overdue" when it should NOT be - it just means the user
            // is free to start working on it, not that it's late.

            const yesterday = new Date(Date.UTC(2026, 0, 6)); // Jan 6, 2026

            const taskScheduledYesterdayNoDue: TaskInfo = TaskFactory.createTask({
                path: 'tasks/scheduled-past-no-due.md',
                title: 'Task I can start anytime (scheduled yesterday)',
                scheduled: formatDateForStorage(yesterday),
                due: undefined, // No due date - no time pressure
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskScheduledYesterdayNoDue.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskScheduledYesterdayNoDue);

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
                [new Date(Date.UTC(2026, 0, 7))], // Today
                query,
                true
            );

            // CURRENT BEHAVIOR: Task IS considered overdue because scheduled date is past
            // This is the bug - the user doesn't want this task in "Overdue"
            // because it has no due date, just a past scheduled date.
            //
            // EXPECTED BEHAVIOR (after feature implementation):
            // In "due date mode", this task should NOT be in "Overdue" because it has no due date.
            // It should instead appear in a "No Due Date" section (placement configurable).
            //
            // In "scheduled date mode", this task should appear in a "Past" or "Started" section,
            // NOT "Overdue" - the terminology matters because "overdue" implies lateness.
        });

        it.skip('reproduces issue #885 - task with future scheduled date but no due date shown under scheduled date as if deadline', async () => {
            // Reproduces issue #885
            // A task with only a future scheduled date (no due date) is grouped by
            // its scheduled date, making it look like that's the deadline when it isn't.

            const nextWeek = new Date(Date.UTC(2026, 0, 14)); // Jan 14, 2026

            const taskScheduledNextWeekNoDue: TaskInfo = TaskFactory.createTask({
                path: 'tasks/scheduled-future-no-due.md',
                title: 'Task I plan to start next week (no deadline)',
                scheduled: formatDateForStorage(nextWeek),
                due: undefined, // No due date
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskScheduledNextWeekNoDue.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskScheduledNextWeekNoDue);

            // CURRENT BEHAVIOR: Task appears grouped under Jan 14 in agenda view,
            // indistinguishable from tasks that are DUE on Jan 14.
            //
            // EXPECTED BEHAVIOR (after feature implementation):
            // In "due date mode": Task should appear in "No Due Date" section
            // (not grouped by scheduled date since we're in due date mode).
            //
            // In "scheduled date mode": Task appears under Jan 14, but the section
            // should clearly indicate these are scheduled dates, not due dates.
        });
    });

    describe('Requested feature: Due Date Mode', () => {
        it.skip('reproduces issue #885 - due date mode should only show tasks with past due dates in Overdue', async () => {
            // Reproduces issue #885
            // Tests the requested "due date mode" behavior

            const yesterday = new Date(Date.UTC(2026, 0, 6));
            const tomorrow = new Date(Date.UTC(2026, 0, 8));

            const tasks: TaskInfo[] = [
                // Task 1: Due yesterday - should be in Overdue
                TaskFactory.createTask({
                    path: 'tasks/due-yesterday.md',
                    title: 'Actually overdue task',
                    due: formatDateForStorage(yesterday),
                    scheduled: undefined,
                    status: ' ',
                }),
                // Task 2: Scheduled yesterday, no due date - should NOT be in Overdue (in due date mode)
                TaskFactory.createTask({
                    path: 'tasks/scheduled-yesterday-no-due.md',
                    title: 'Started but no deadline',
                    scheduled: formatDateForStorage(yesterday),
                    due: undefined,
                    status: ' ',
                }),
                // Task 3: Scheduled yesterday, due tomorrow - should NOT be in Overdue
                TaskFactory.createTask({
                    path: 'tasks/scheduled-yesterday-due-tomorrow.md',
                    title: 'Started but due tomorrow',
                    scheduled: formatDateForStorage(yesterday),
                    due: formatDateForStorage(tomorrow),
                    status: ' ',
                }),
            ];

            mockCacheManager.getAllTaskPaths.mockReturnValue(tasks.map(t => t.path));
            mockCacheManager.getCachedTaskInfo.mockImplementation((path: string) => {
                return Promise.resolve(tasks.find(t => t.path === path) ?? null);
            });

            // EXPECTED: In "due date mode", only task 1 should be in Overdue section
            // Task 2 has no due date - should go to "No Due Date" section
            // Task 3 is due tomorrow - should be under tomorrow's date
        });

        it.skip('reproduces issue #885 - no due date placement option: top of agenda', async () => {
            // Reproduces issue #885
            // Tests configurable placement of "No Due Date" section at top

            const noDueDateTask: TaskInfo = TaskFactory.createTask({
                path: 'tasks/no-due-date.md',
                title: 'Task without deadline',
                scheduled: undefined,
                due: undefined,
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([noDueDateTask.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(noDueDateTask);

            // EXPECTED: With noDueDatePlacement='top', this task should appear
            // in a "No Due Date" section at the very top of the agenda,
            // before "Overdue" and before any dated sections.
        });

        it.skip('reproduces issue #885 - no due date placement option: bottom of agenda', async () => {
            // Reproduces issue #885
            // Tests configurable placement of "No Due Date" section at bottom

            const noDueDateTask: TaskInfo = TaskFactory.createTask({
                path: 'tasks/no-due-date.md',
                title: 'Task without deadline',
                scheduled: undefined,
                due: undefined,
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([noDueDateTask.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(noDueDateTask);

            // EXPECTED: With noDueDatePlacement='bottom', this task should appear
            // in a "No Due Date" section at the very bottom of the agenda,
            // after all dated sections.
        });

        it.skip('reproduces issue #885 - no due date placement option: hidden', async () => {
            // Reproduces issue #885
            // Tests hiding tasks with no due date entirely

            const tasks: TaskInfo[] = [
                TaskFactory.createTask({
                    path: 'tasks/has-due-date.md',
                    title: 'Task with deadline',
                    due: formatDateForStorage(new Date(Date.UTC(2026, 0, 10))),
                    scheduled: undefined,
                    status: ' ',
                }),
                TaskFactory.createTask({
                    path: 'tasks/no-due-date.md',
                    title: 'Task without deadline',
                    scheduled: formatDateForStorage(new Date(Date.UTC(2026, 0, 5))),
                    due: undefined,
                    status: ' ',
                }),
            ];

            mockCacheManager.getAllTaskPaths.mockReturnValue(tasks.map(t => t.path));
            mockCacheManager.getCachedTaskInfo.mockImplementation((path: string) => {
                return Promise.resolve(tasks.find(t => t.path === path) ?? null);
            });

            // EXPECTED: With noDueDatePlacement='hidden', only the task with a due date
            // should appear in the agenda view. The task without a due date should be
            // completely filtered out.
        });
    });

    describe('Requested feature: Scheduled Date Mode', () => {
        it.skip('reproduces issue #885 - scheduled date mode groups by scheduled date', async () => {
            // Reproduces issue #885
            // Tests the requested "scheduled date mode" behavior

            const jan10 = new Date(Date.UTC(2026, 0, 10));
            const jan15 = new Date(Date.UTC(2026, 0, 15));

            const tasks: TaskInfo[] = [
                TaskFactory.createTask({
                    path: 'tasks/scheduled-jan10.md',
                    title: 'Scheduled for Jan 10',
                    scheduled: formatDateForStorage(jan10),
                    due: formatDateForStorage(jan15), // Due date is different
                    status: ' ',
                }),
                TaskFactory.createTask({
                    path: 'tasks/scheduled-jan15.md',
                    title: 'Scheduled for Jan 15',
                    scheduled: formatDateForStorage(jan15),
                    due: undefined,
                    status: ' ',
                }),
            ];

            mockCacheManager.getAllTaskPaths.mockReturnValue(tasks.map(t => t.path));
            mockCacheManager.getCachedTaskInfo.mockImplementation((path: string) => {
                return Promise.resolve(tasks.find(t => t.path === path) ?? null);
            });

            // EXPECTED: In "scheduled date mode":
            // - Task 1 appears under Jan 10 (its scheduled date, not Jan 15 due date)
            // - Task 2 appears under Jan 15 (its scheduled date)
            // The grouping is by scheduled date, ignoring due dates.
        });

        it.skip('reproduces issue #885 - scheduled date mode shows past-scheduled as "Past" not "Overdue"', async () => {
            // Reproduces issue #885
            // Tests that in scheduled date mode, the section for past tasks is called
            // "Past" or "Started" instead of "Overdue"

            const yesterday = new Date(Date.UTC(2026, 0, 6));

            const pastScheduledTask: TaskInfo = TaskFactory.createTask({
                path: 'tasks/past-scheduled.md',
                title: 'I could have started this yesterday',
                scheduled: formatDateForStorage(yesterday),
                due: undefined,
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([pastScheduledTask.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(pastScheduledTask);

            // EXPECTED: In "scheduled date mode", this task should appear in a section
            // called "Past" or "Started" (user-customizable name), NOT "Overdue".
            //
            // The terminology matters because:
            // - "Overdue" implies lateness and missed deadlines
            // - "Past" or "Started" just means the scheduled start date has passed
            //   but there's no deadline pressure
        });

        it.skip('reproduces issue #885 - scheduled date mode section name should be customizable', async () => {
            // Reproduces issue #885
            // Tests that the "Past scheduled" section name can be customized

            const yesterday = new Date(Date.UTC(2026, 0, 6));

            const pastScheduledTask: TaskInfo = TaskFactory.createTask({
                path: 'tasks/past-scheduled.md',
                title: 'Task with past scheduled date',
                scheduled: formatDateForStorage(yesterday),
                due: undefined,
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([pastScheduledTask.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(pastScheduledTask);

            // EXPECTED: User should be able to configure the section name to be:
            // - "Past" (default)
            // - "Started"
            // - "Available"
            // - Or any custom string
        });
    });

    describe('Requested feature: Mode toggle UI', () => {
        it.skip('reproduces issue #885 - agenda view should have mode toggle control', async () => {
            // Reproduces issue #885
            // Tests that there should be a UI toggle to switch between modes

            // EXPECTED: The agenda view should have a toggle/button to switch between:
            // - "Due Date Mode" - groups by due date, Overdue = past due dates
            // - "Scheduled Date Mode" - groups by scheduled date, Past = past scheduled dates
            //
            // This toggle could be:
            // 1. In the view header/toolbar
            // 2. In view settings/options
            // 3. A quick toggle button
        });
    });

    describe('Edge cases', () => {
        it.skip('reproduces issue #885 - task with both scheduled and due date in due mode', async () => {
            // Reproduces issue #885
            // Tests how a task with both dates is handled in due date mode

            const scheduledYesterday = new Date(Date.UTC(2026, 0, 6));
            const dueNextWeek = new Date(Date.UTC(2026, 0, 14));

            const taskWithBothDates: TaskInfo = TaskFactory.createTask({
                path: 'tasks/both-dates.md',
                title: 'Scheduled yesterday, due next week',
                scheduled: formatDateForStorage(scheduledYesterday),
                due: formatDateForStorage(dueNextWeek),
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskWithBothDates.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskWithBothDates);

            // EXPECTED in "due date mode":
            // Task should appear under Jan 14 (its due date)
            // It should NOT appear in "Overdue" because due date is in the future
            // The past scheduled date is irrelevant in due date mode
        });

        it.skip('reproduces issue #885 - task with neither scheduled nor due date', async () => {
            // Reproduces issue #885
            // Tests how a task with no dates at all is handled

            const taskWithNoDates: TaskInfo = TaskFactory.createTask({
                path: 'tasks/no-dates.md',
                title: 'Task with no dates',
                scheduled: undefined,
                due: undefined,
                status: ' ',
            });

            mockCacheManager.getAllTaskPaths.mockReturnValue([taskWithNoDates.path]);
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskWithNoDates);

            // EXPECTED in "due date mode":
            // Task appears in "No Due Date" section (placement per user setting)
            //
            // EXPECTED in "scheduled date mode":
            // Task appears in "Unscheduled" section
        });
    });
});
