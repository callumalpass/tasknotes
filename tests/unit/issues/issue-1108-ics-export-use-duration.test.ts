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
     * Current behavior: When exporting to ICS, the service uses:
     *   - scheduled date → DTSTART
     *   - due date → DTEND (if present)
     *   - fallback: scheduled + 1 hour → DTEND
     *
     * Requested behavior: Option to use:
     *   - scheduled date → DTSTART
     *   - scheduled + timeEstimate (duration) → DTEND
     *
     * This aligns with GTD workflow where:
     *   - scheduled + duration = when you plan to work on the task
     *   - due date = deadline (separate from work planning)
     */

    describe('Feature: Use timeEstimate for event duration', () => {
        it.skip('should use timeEstimate to calculate DTEND when option is enabled', () => {
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

            // TODO: This method signature would need to accept an options object
            // with a flag like { useDurationForEnd: true }
            const icsContent = CalendarExportService.generateICSContent(task);

            // Parse the ICS content
            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            // Extract times
            const startTime = dtstart!.replace('DTSTART:', '');
            const endTime = dtend!.replace('DTEND:', '');

            // Start should be 10:00 UTC (2025-01-14T10:00:00Z)
            expect(startTime).toContain('20250114T');

            // End should be 12:00 UTC (start + 2 hours), NOT the due date
            // Currently fails because it uses due date as end time
            expect(endTime).toContain('20250114T'); // Same day as start
            // The end time should be 2 hours after start, not the due date

            // Parse and compare times properly
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

            const startDate = parseICSDate(startTime);
            const endDate = parseICSDate(endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            // Duration should be 120 minutes (2 hours)
            expect(durationMinutes).toBe(120);
        });

        it.skip('should fall back to 1 hour when timeEstimate is not set and option is enabled', () => {
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

            const icsContent = CalendarExportService.generateICSContent(task);

            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            // With no timeEstimate, should fall back to 1 hour duration
            // This is existing behavior and should be preserved
        });

        it.skip('should ignore due date when useDurationForEnd option is true', () => {
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

            // TODO: Need to pass option to use duration instead of due date
            const icsContent = CalendarExportService.generateICSContent(task);

            const lines = icsContent.split('\r\n');
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtend).toBeDefined();

            // DTEND should be 2025-01-14T10:00:00Z (start + 1 hour)
            // NOT 2025-01-31T23:59:00Z (due date)
            expect(dtend).toContain('20250114T');
            expect(dtend).not.toContain('20250131');
        });
    });

    describe('Feature: Separate export for due dates', () => {
        it.skip('should support exporting due dates to a separate file (deadline.ics)', () => {
            // User suggests due dates could be exported separately as deadlines
            // This would allow calendars to show both:
            // 1. Work blocks (scheduled + duration)
            // 2. Deadlines (due dates as separate events or all-day reminders)

            const tasks: TaskInfo[] = [
                {
                    title: 'Task with both scheduled and due',
                    path: 'tasks/task1.md',
                    scheduled: '2025-01-14T10:00:00',
                    timeEstimate: 120,
                    due: '2025-01-20T17:00:00',
                    status: 'todo',
                    tags: [],
                    projects: [],
                    contexts: []
                }
            ];

            // TODO: New method to generate deadline-only ICS
            // const deadlineIcs = CalendarExportService.generateDeadlinesICSContent(tasks);

            // The deadline ICS should contain events for due dates only
            // Perhaps as all-day events or as point-in-time reminders
        });
    });

    describe('Settings integration', () => {
        it.skip('should respect ICSIntegrationSettings.useDurationForExport setting', () => {
            // TODO: ICSIntegrationSettings should have a new option:
            // useDurationForExport: boolean
            //
            // When true:
            //   - DTSTART = scheduled date/time
            //   - DTEND = scheduled + timeEstimate
            //   - Due date is NOT used for DTEND
            //
            // When false (default for backwards compatibility):
            //   - DTSTART = scheduled date/time
            //   - DTEND = due date (if exists) or scheduled + 1 hour
        });
    });

    describe('Current behavior (before fix)', () => {
        it('currently uses due date as DTEND when both scheduled and due are present', () => {
            const task: TaskInfo = {
                title: 'Test current behavior',
                path: 'tasks/test.md',
                scheduled: '2025-01-14T10:00:00',
                timeEstimate: 120, // 2 hours - currently IGNORED
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

            // Currently: DTEND uses due date (this is the behavior we want to optionally change)
            expect(dtend).toContain('20250120'); // Uses due date
        });

        it('currently adds timeEstimate to description but does not use it for event duration', () => {
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

            // But NOT used for calculating DTEND
            const lines = icsContent.split('\r\n');
            const dtstart = lines.find(l => l.startsWith('DTSTART:'));
            const dtend = lines.find(l => l.startsWith('DTEND:'));

            expect(dtstart).toBeDefined();
            expect(dtend).toBeDefined();

            // Current behavior: falls back to 1 hour, not 90 minutes
            const parseICSDate = (ics: string): Date => {
                const year = parseInt(ics.substr(0, 4));
                const month = parseInt(ics.substr(4, 2)) - 1;
                const day = parseInt(ics.substr(6, 2));
                const hour = parseInt(ics.substr(9, 2));
                const minute = parseInt(ics.substr(11, 2));
                const second = parseInt(ics.substr(13, 2));
                return new Date(Date.UTC(year, month, day, hour, minute, second));
            };

            const startTime = dtstart!.replace('DTSTART:', '');
            const endTime = dtend!.replace('DTEND:', '');
            const startDate = parseICSDate(startTime);
            const endDate = parseICSDate(endTime);
            const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            // Currently defaults to 60 minutes (1 hour) when no due date, ignoring timeEstimate
            expect(durationMinutes).toBe(60);
        });
    });
});
