import { CalendarExportService } from '../../../src/services/CalendarExportService';
import { TaskInfo } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn()
}));

describe('Issue #1108 - ICS Export should use task duration instead of due date', () => {
    /**
     * This test documents the feature request from Issue #1108.
     *
     * With useDurationForExport option:
     *   - scheduled date → DTSTART
     *   - scheduled + timeEstimate (duration) → DTEND
     *   - due date is ignored for DTEND calculation
     *
     * Without option (default, backwards compatible):
     *   - scheduled date → DTSTART
     *   - due date → DTEND (if present)
     *   - fallback: scheduled + 1 hour → DTEND
     *
     * This aligns with GTD workflow where:
     *   - scheduled + duration = when you plan to work on the task
     *   - due date = deadline (separate from work planning)
     */

    // Helper to parse ICS date format
    const parseICSDate = (ics: string): Date => {
        // YYYYMMDDTHHMMSSZ -> Date
        const year = parseInt(ics.substr(0, 4));
        const month = parseInt(ics.substr(4, 2)) - 1;
        const day = parseInt(ics.substr(6, 2));
        const hour = parseInt(ics.substr(9, 2));
        const minute = parseInt(ics.substr(11, 2));
        const second = parseInt(ics.substr(13, 2));
        return new Date(Date.UTC(year, month, day, hour, minute, second));
    };

    describe('Feature: Use timeEstimate for event duration', () => {
        it('should use timeEstimate to calculate DTEND when option is enabled', () => {
            // Task scheduled for Tuesday at 10:00 with 2 hour duration
            // Expected: Calendar event from 10:00 to 12:00
            const task: TaskInfo = {
                title: 'Plan meeting agenda',
                path: 'tasks/plan-meeting.md',
                scheduled: '2025-01-14T10:00:00',
                timeEstimate: 120, // 120 minutes = 2 hours
                due: '2025-01-20T17:00:00', // Due date should be IGNORED when using duration
                status: 'todo',
                priority: 'medium',
                tags: [],
                projects: [],
                contexts: []
            };

            const icsContent = CalendarExportService.generateICSContent(task, { useDurationForExport: true });

            // Parse the ICS content
            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            // Extract times
            const startTime = dtstart!.replace('DTSTART:', '');
            const endTime = dtend!.replace('DTEND:', '');

            // End should be on the same day as start (using duration, not due date)
            expect(endTime).toContain('20250114T'); // Same day as start
            expect(endTime).not.toContain('20250120'); // NOT the due date

            const startDate = parseICSDate(startTime);
            const endDate = parseICSDate(endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            // Duration should be 120 minutes (2 hours)
            expect(durationMinutes).toBe(120);
        });

        it('should fall back to 1 hour when timeEstimate is not set and option is enabled', () => {
            const task: TaskInfo = {
                title: 'Quick task',
                path: 'tasks/quick-task.md',
                scheduled: '2025-01-14T14:00:00',
                // No timeEstimate, no due date
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            const icsContent = CalendarExportService.generateICSContent(task, { useDurationForExport: true });

            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            const startTime = dtstart!.replace('DTSTART:', '');
            const endTime = dtend!.replace('DTEND:', '');

            const startDate = parseICSDate(startTime);
            const endDate = parseICSDate(endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            // With no timeEstimate, should fall back to 1 hour duration
            expect(durationMinutes).toBe(60);
        });

        it('should ignore due date when useDurationForExport option is true', () => {
            // This is the key behavior change requested
            const task: TaskInfo = {
                title: 'Important task with deadline',
                path: 'tasks/important.md',
                scheduled: '2025-01-14T09:00:00',
                timeEstimate: 60, // 1 hour
                due: '2025-01-31T23:59:00', // Deadline far in future - should NOT be used as DTEND
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            const icsContent = CalendarExportService.generateICSContent(task, { useDurationForExport: true });

            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            // DTEND should NOT contain the due date (January 31)
            expect(dtend).not.toContain('20250131');

            // The duration should be 1 hour (timeEstimate)
            const startTime = dtstart!.replace('DTSTART:', '');
            const endTime = dtend!.replace('DTEND:', '');
            const startDate = parseICSDate(startTime);
            const endDate = parseICSDate(endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            expect(durationMinutes).toBe(60);
        });

        it('should use due date when useDurationForExport is false (default behavior)', () => {
            const task: TaskInfo = {
                title: 'Task with due date',
                path: 'tasks/task.md',
                scheduled: '2025-01-14T09:00:00',
                timeEstimate: 60,
                due: '2025-01-31T23:59:00',
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            // Without the option, should use due date
            const icsContent = CalendarExportService.generateICSContent(task, { useDurationForExport: false });

            const lines = icsContent.split('\r\n');
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtend).toBeDefined();
            // DTEND should use due date
            expect(dtend).toContain('20250131');
        });

        it('should use due date when option is not provided (backwards compatible)', () => {
            const task: TaskInfo = {
                title: 'Task with due date',
                path: 'tasks/task.md',
                scheduled: '2025-01-14T09:00:00',
                timeEstimate: 60,
                due: '2025-01-31T23:59:00',
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            // Without passing options at all, should use due date (backwards compatible)
            const icsContent = CalendarExportService.generateICSContent(task);

            const lines = icsContent.split('\r\n');
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtend).toBeDefined();
            // DTEND should use due date
            expect(dtend).toContain('20250131');
        });
    });

    describe('Feature: generateMultipleTasksICSContent with duration option', () => {
        it('should use duration for all tasks when option is enabled', () => {
            const tasks: TaskInfo[] = [
                {
                    title: 'Task 1',
                    path: 'tasks/task1.md',
                    scheduled: '2025-01-14T10:00:00',
                    timeEstimate: 120, // 2 hours
                    due: '2025-01-20T17:00:00',
                    status: 'todo',
                    tags: [],
                    projects: [],
                    contexts: []
                },
                {
                    title: 'Task 2',
                    path: 'tasks/task2.md',
                    scheduled: '2025-01-15T14:00:00',
                    timeEstimate: 30, // 30 minutes
                    due: '2025-01-25T12:00:00',
                    status: 'todo',
                    tags: [],
                    projects: [],
                    contexts: []
                }
            ];

            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks, { useDurationForExport: true });

            // Should have two VEVENTs
            const vevents = icsContent.split('BEGIN:VEVENT').length - 1;
            expect(vevents).toBe(2);

            // Check that neither uses due date
            expect(icsContent).not.toContain('20250120'); // Task 1 due date
            expect(icsContent).not.toContain('20250125'); // Task 2 due date

            // Should contain scheduled dates
            expect(icsContent).toContain('20250114T'); // Task 1 scheduled
            expect(icsContent).toContain('20250115T'); // Task 2 scheduled
        });
    });

    describe('Settings integration', () => {
        it('generateICSContent accepts ICSExportOptions parameter', () => {
            const task: TaskInfo = {
                title: 'Test options',
                path: 'tasks/test.md',
                scheduled: '2025-01-14T10:00:00',
                timeEstimate: 90,
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            // Should accept options without error
            const icsWithDuration = CalendarExportService.generateICSContent(task, { useDurationForExport: true });
            const icsWithoutDuration = CalendarExportService.generateICSContent(task, { useDurationForExport: false });
            const icsNoOptions = CalendarExportService.generateICSContent(task);

            expect(icsWithDuration).toBeDefined();
            expect(icsWithoutDuration).toBeDefined();
            expect(icsNoOptions).toBeDefined();

            // With duration option, should use 90 minutes
            const linesWithDuration = icsWithDuration.split('\r\n');
            const dtendWithDuration = linesWithDuration.find(l => l.startsWith('DTEND:'))!.replace('DTEND:', '');
            const dtstartWithDuration = linesWithDuration.find(l => l.startsWith('DTSTART:'))!.replace('DTSTART:', '');

            const startDateWithDuration = parseICSDate(dtstartWithDuration);
            const endDateWithDuration = parseICSDate(dtendWithDuration);
            const durationWithOption = (endDateWithDuration.getTime() - startDateWithDuration.getTime()) / (1000 * 60);
            expect(durationWithOption).toBe(90);

            // Without duration option, should fall back to 1 hour
            const linesNoOptions = icsNoOptions.split('\r\n');
            const dtendNoOptions = linesNoOptions.find(l => l.startsWith('DTEND:'))!.replace('DTEND:', '');
            const dtstartNoOptions = linesNoOptions.find(l => l.startsWith('DTSTART:'))!.replace('DTSTART:', '');

            const startDateNoOptions = parseICSDate(dtstartNoOptions);
            const endDateNoOptions = parseICSDate(dtendNoOptions);
            const durationNoOptions = (endDateNoOptions.getTime() - startDateNoOptions.getTime()) / (1000 * 60);
            expect(durationNoOptions).toBe(60); // 1 hour fallback
        });
    });

    describe('Backwards compatibility (before fix)', () => {
        it('currently uses due date as DTEND when both scheduled and due are present', () => {
            const task: TaskInfo = {
                title: 'Test current behavior',
                path: 'tasks/test.md',
                scheduled: '2025-01-14T10:00:00',
                timeEstimate: 120, // 2 hours - currently IGNORED unless option is enabled
                due: '2025-01-20T17:00:00',
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            const icsContent = CalendarExportService.generateICSContent(task);
            const lines = icsContent.split('\r\n');

            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            // Default behavior: DTEND uses due date
            expect(dtend).toContain('20250120'); // Uses due date
        });

        it('currently adds timeEstimate to description but does not use it for event duration by default', () => {
            const task: TaskInfo = {
                title: 'Task with duration',
                path: 'tasks/test.md',
                scheduled: '2025-01-14T10:00:00',
                timeEstimate: 90, // 90 minutes
                status: 'todo',
                tags: [],
                projects: [],
                contexts: []
            };

            const icsContent = CalendarExportService.generateICSContent(task);

            // timeEstimate IS included in description
            expect(icsContent).toContain('90 minutes');

            // But NOT used for calculating DTEND by default
            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            const startTime = dtstart!.replace('DTSTART:', '');
            const endTime = dtend!.replace('DTEND:', '');
            const startDate = parseICSDate(startTime);
            const endDate = parseICSDate(endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            // Default behavior: falls back to 1 hour, not 90 minutes
            expect(durationMinutes).toBe(60);
        });
    });
});
