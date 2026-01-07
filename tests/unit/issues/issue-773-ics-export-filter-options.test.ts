import { CalendarExportService, ICSExportOptions } from '../../../src/services/CalendarExportService';
import { TaskInfo } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn()
}));

describe('Issue #773 - Add options to filter tasks for ICS export', () => {
    /**
     * This test documents the feature request from Issue #773.
     *
     * Current behavior:
     *   - All tasks are exported to ICS, including:
     *     - Archived tasks
     *     - Completed tasks
     *     - Tasks without due dates
     *
     * Requested behavior:
     *   - Add filter options to ICSExportOptions:
     *     - excludeArchived: Exclude archived tasks from export
     *     - excludeCompleted: Exclude completed tasks from export
     *     - requireDueDate: Only include tasks that have due dates
     *
     * The user notes that tasks without due dates create noise on calendars,
     * and suggests that displaying tasks without due dates should be opt-in.
     */

    // Sample tasks for testing
    const createTestTasks = (): TaskInfo[] => [
        {
            title: 'Active task with due date',
            path: 'tasks/active-due.md',
            scheduled: '2025-01-14T10:00:00',
            due: '2025-01-20T17:00:00',
            status: 'todo',
            archived: false,
            tags: [],
            projects: [],
            contexts: []
        },
        {
            title: 'Completed task',
            path: 'tasks/completed.md',
            scheduled: '2025-01-10T10:00:00',
            due: '2025-01-12T17:00:00',
            status: 'done',
            archived: false,
            tags: [],
            projects: [],
            contexts: []
        },
        {
            title: 'Archived task',
            path: 'tasks/archived.md',
            scheduled: '2024-12-01T10:00:00',
            due: '2024-12-15T17:00:00',
            status: 'done',
            archived: true,
            tags: [],
            projects: [],
            contexts: []
        },
        {
            title: 'Task without due date',
            path: 'tasks/no-due.md',
            scheduled: '2025-01-14T14:00:00',
            // No due date
            status: 'todo',
            archived: false,
            tags: [],
            projects: [],
            contexts: []
        },
        {
            title: 'Task with no dates at all',
            path: 'tasks/no-dates.md',
            // No scheduled, no due
            status: 'todo',
            archived: false,
            tags: [],
            projects: [],
            contexts: []
        }
    ];

    describe('Feature: Exclude archived tasks', () => {
        it.skip('reproduces issue #773 - should support excludeArchived option to filter out archived tasks', () => {
            const tasks = createTestTasks();

            // When excludeArchived is true, archived tasks should not appear in the ICS output
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks, {
                excludeArchived: true
            } as ICSExportOptions);

            // Should NOT contain the archived task
            expect(icsContent).not.toContain('Archived task');

            // Should contain other tasks
            expect(icsContent).toContain('Active task with due date');
            expect(icsContent).toContain('Completed task');
            expect(icsContent).toContain('Task without due date');
        });

        it.skip('reproduces issue #773 - should include archived tasks by default (backwards compatible)', () => {
            const tasks = createTestTasks();

            // Without the option, all tasks including archived should be exported
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

            // Should contain ALL tasks including archived
            expect(icsContent).toContain('Archived task');
            expect(icsContent).toContain('Active task with due date');
        });
    });

    describe('Feature: Exclude completed tasks', () => {
        it.skip('reproduces issue #773 - should support excludeCompleted option to filter out completed tasks', () => {
            const tasks = createTestTasks();

            // When excludeCompleted is true, completed tasks should not appear
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks, {
                excludeCompleted: true
            } as ICSExportOptions);

            // Should NOT contain completed tasks
            expect(icsContent).not.toContain('Completed task');
            expect(icsContent).not.toContain('Archived task'); // Also completed

            // Should contain non-completed tasks
            expect(icsContent).toContain('Active task with due date');
            expect(icsContent).toContain('Task without due date');
        });

        it.skip('reproduces issue #773 - should include completed tasks by default (backwards compatible)', () => {
            const tasks = createTestTasks();

            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

            // Should contain completed tasks
            expect(icsContent).toContain('Completed task');
        });
    });

    describe('Feature: Require due date', () => {
        it.skip('reproduces issue #773 - should support requireDueDate option to filter out tasks without due dates', () => {
            const tasks = createTestTasks();

            // When requireDueDate is true, only tasks with due dates should appear
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks, {
                requireDueDate: true
            } as ICSExportOptions);

            // Should NOT contain tasks without due dates
            expect(icsContent).not.toContain('Task without due date');
            expect(icsContent).not.toContain('Task with no dates at all');

            // Should contain tasks WITH due dates
            expect(icsContent).toContain('Active task with due date');
            expect(icsContent).toContain('Completed task');
            expect(icsContent).toContain('Archived task');
        });

        it.skip('reproduces issue #773 - should include tasks without due dates by default (backwards compatible)', () => {
            const tasks = createTestTasks();

            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

            // Should contain tasks without due dates
            expect(icsContent).toContain('Task without due date');
            expect(icsContent).toContain('Task with no dates at all');
        });
    });

    describe('Feature: Combined filters', () => {
        it.skip('reproduces issue #773 - should support combining multiple filter options', () => {
            const tasks = createTestTasks();

            // Apply all filters: exclude archived, exclude completed, require due date
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks, {
                excludeArchived: true,
                excludeCompleted: true,
                requireDueDate: true
            } as ICSExportOptions);

            // Only active, non-archived tasks with due dates should appear
            expect(icsContent).toContain('Active task with due date');

            // Everything else should be filtered out
            expect(icsContent).not.toContain('Completed task');
            expect(icsContent).not.toContain('Archived task');
            expect(icsContent).not.toContain('Task without due date');
            expect(icsContent).not.toContain('Task with no dates at all');
        });

        it.skip('reproduces issue #773 - should work with existing useDurationForExport option', () => {
            const tasks = createTestTasks();

            // Combine new filter options with existing duration option
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks, {
                useDurationForExport: true,
                excludeCompleted: true,
                requireDueDate: true
            } as ICSExportOptions);

            // Should apply both filters and use duration for remaining tasks
            expect(icsContent).toContain('Active task with due date');
            expect(icsContent).not.toContain('Completed task');
            expect(icsContent).not.toContain('Task without due date');
        });
    });

    describe('Current behavior (before fix)', () => {
        it('currently exports ALL tasks including archived, completed, and those without due dates', () => {
            const tasks = createTestTasks();

            // Current behavior: no filtering options available
            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

            // Count VEVENTs
            const vevents = icsContent.split('BEGIN:VEVENT').length - 1;

            // All 5 tasks should be exported (current behavior)
            expect(vevents).toBe(5);

            // All tasks appear in output
            expect(icsContent).toContain('Active task with due date');
            expect(icsContent).toContain('Completed task');
            expect(icsContent).toContain('Archived task');
            expect(icsContent).toContain('Task without due date');
            expect(icsContent).toContain('Task with no dates at all');
        });

        it('ICSExportOptions interface currently only has useDurationForExport option', () => {
            // This test documents that the interface needs to be extended
            const options: ICSExportOptions = {
                useDurationForExport: true
            };

            // The following would need to be added to ICSExportOptions:
            // - excludeArchived?: boolean;
            // - excludeCompleted?: boolean;
            // - requireDueDate?: boolean;

            expect(options.useDurationForExport).toBe(true);
        });

        it('tasks without due dates create calendar events using fallback dates', () => {
            // This demonstrates the "noise" mentioned in the issue
            const taskNoDue: TaskInfo = {
                title: 'Task without due date causes noise',
                path: 'tasks/noise.md',
                // No scheduled, no due
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            const icsContent = CalendarExportService.generateMultipleTasksICSContent([taskNoDue]);

            // Task still appears with fallback date (current date)
            expect(icsContent).toContain('BEGIN:VEVENT');
            expect(icsContent).toContain('Task without due date causes noise');
            expect(icsContent).toContain('DTSTART:'); // Uses fallback date
        });
    });

    describe('Implementation guidance', () => {
        it.skip('reproduces issue #773 - ICSExportOptions should be extended with filter properties', () => {
            /**
             * The ICSExportOptions interface should be extended to include:
             *
             * export interface ICSExportOptions {
             *     useDurationForExport?: boolean;
             *     excludeArchived?: boolean;     // New: exclude archived tasks
             *     excludeCompleted?: boolean;    // New: exclude completed tasks
             *     requireDueDate?: boolean;      // New: only include tasks with due dates
             * }
             *
             * The generateMultipleTasksICSContent method should filter tasks
             * based on these options before generating VEVENT entries.
             */

            // Test that extended options are accepted
            const options: ICSExportOptions = {
                useDurationForExport: false,
                excludeArchived: true,
                excludeCompleted: true,
                requireDueDate: true
            } as ICSExportOptions;

            expect(options.excludeArchived).toBe(true);
            expect(options.excludeCompleted).toBe(true);
            expect(options.requireDueDate).toBe(true);
        });
    });
});
