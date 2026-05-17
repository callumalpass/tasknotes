import { CalendarExportService } from '../../../src/services/CalendarExportService';
import { TaskInfo } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn()
}));

/**
 * Issue #919: Exported ICS is not valid
 * @see https://github.com/obsidian-tasks-group/obsidian-tasks/issues/919
 *
 * The exported ICS contains invalid STATUS values for VEVENT components.
 *
 * According to RFC 5545 (iCalendar standard):
 * - VEVENT STATUS can only be: TENTATIVE, CONFIRMED, or CANCELLED
 *   @see https://icalendar.org/iCalendar-RFC-5545/3-8-1-11-status.html
 *
 * - VTODO STATUS can be: NEEDS-ACTION, COMPLETED, IN-PROCESS, or CANCELLED
 *
 * The current implementation uses VTODO status values (NEEDS-ACTION, COMPLETED,
 * IN-PROCESS) for VEVENT components, which causes calendar apps to reject the
 * ICS file with "Invalid STATUS value" errors.
 *
 * Root cause: The statusMap in generateICSContent maps task statuses to VTODO
 * values but exports them inside VEVENT components. Either:
 * 1. Use VEVENT-compatible status values (TENTATIVE, CONFIRMED, CANCELLED)
 * 2. Or export tasks as VTODO components instead of VEVENT
 */
describe('Issue #919 - ICS VEVENT STATUS values are invalid', () => {
    // Valid status values per RFC 5545
    const VALID_VEVENT_STATUSES = ['TENTATIVE', 'CONFIRMED', 'CANCELLED'];

    // Helper to extract STATUS value from ICS content
    const extractStatus = (icsContent: string): string | undefined => {
        const lines = icsContent.split('\r\n');
        const statusLine = lines.find(l => l.startsWith('STATUS:'));
        return statusLine?.replace('STATUS:', '');
    };

    // Helper to check if the ICS contains VEVENT (not VTODO)
    const isVEvent = (icsContent: string): boolean => {
        return icsContent.includes('BEGIN:VEVENT');
    };

    const createTask = (status: string): TaskInfo => ({
        title: 'Test task',
        path: 'tasks/test.md',
        scheduled: '2025-01-14T10:00:00',
        status: status,
        tags: [],
        projects: [],
        contexts: []
    });

    describe('VEVENT status validation', () => {
        it('exports todo status as a valid CONFIRMED VEVENT status', () => {
            const task = createTask('todo');
            const icsContent = CalendarExportService.generateICSContent(task);

            // Verify it's exported as VEVENT (not VTODO)
            expect(isVEvent(icsContent)).toBe(true);

            const status = extractStatus(icsContent);
            expect(status).toBe('CONFIRMED');
            expect(VALID_VEVENT_STATUSES).toContain(status);
        });

        it('exports in-progress status as a valid CONFIRMED VEVENT status', () => {
            const task = createTask('in-progress');
            const icsContent = CalendarExportService.generateICSContent(task);

            expect(isVEvent(icsContent)).toBe(true);

            const status = extractStatus(icsContent);
            expect(status).toBe('CONFIRMED');
            expect(VALID_VEVENT_STATUSES).toContain(status);
        });

        it('exports done status as a valid CONFIRMED VEVENT status', () => {
            const task = createTask('done');
            const icsContent = CalendarExportService.generateICSContent(task);

            expect(isVEvent(icsContent)).toBe(true);

            const status = extractStatus(icsContent);
            expect(status).toBe('CONFIRMED');
            expect(VALID_VEVENT_STATUSES).toContain(status);
        });

        it('exports cancelled status as CANCELLED', () => {
            // CANCELLED is valid for both VEVENT and VTODO, so this should pass
            const task = createTask('cancelled');
            const icsContent = CalendarExportService.generateICSContent(task);

            expect(isVEvent(icsContent)).toBe(true);

            const status = extractStatus(icsContent);
            expect(status).toBe('CANCELLED');
            // CANCELLED is valid for VEVENT
            expect(VALID_VEVENT_STATUSES).toContain(status);
        });

        it('exports custom/unknown statuses as valid CONFIRMED VEVENT status', () => {
            const task = createTask('custom-status');
            const icsContent = CalendarExportService.generateICSContent(task);

            expect(isVEvent(icsContent)).toBe(true);

            const status = extractStatus(icsContent);
            expect(status).toBe('CONFIRMED');
            expect(VALID_VEVENT_STATUSES).toContain(status);
        });

        it('preserves an explicit tentative status as TENTATIVE', () => {
            const task = createTask('tentative');
            const icsContent = CalendarExportService.generateICSContent(task);

            const status = extractStatus(icsContent);
            expect(status).toBe('TENTATIVE');
            expect(VALID_VEVENT_STATUSES).toContain(status);
        });
    });

    describe('generateMultipleTasksICSContent has same issue', () => {
        it('exports valid VEVENT status values for multiple tasks', () => {
            const tasks: TaskInfo[] = [
                createTask('todo'),
                createTask('in-progress'),
                createTask('done')
            ];

            const icsContent = CalendarExportService.generateMultipleTasksICSContent(tasks);

            // All VEVENT components should have valid VEVENT status values
            const lines = icsContent.split('\r\n');
            const statusLines = lines.filter(l => l.startsWith('STATUS:'));

            expect(statusLines.length).toBe(3);

            statusLines.forEach(statusLine => {
                const status = statusLine.replace('STATUS:', '');
                expect(VALID_VEVENT_STATUSES).toContain(status);
            });
        });
    });

    describe('Reference: fixed behavior', () => {
        it('does not emit VTODO-only status values inside VEVENT components', () => {
            const todoTask = createTask('todo');
            const inProgressTask = createTask('in-progress');
            const doneTask = createTask('done');
            const cancelledTask = createTask('cancelled');

            expect(extractStatus(CalendarExportService.generateICSContent(todoTask))).toBe('CONFIRMED');
            expect(extractStatus(CalendarExportService.generateICSContent(inProgressTask))).toBe('CONFIRMED');
            expect(extractStatus(CalendarExportService.generateICSContent(doneTask))).toBe('CONFIRMED');
            expect(extractStatus(CalendarExportService.generateICSContent(cancelledTask))).toBe('CANCELLED');
        });
    });
});
