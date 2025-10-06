import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import { ICSEvent } from '../../../src/types';
import * as ICAL from 'ical.js';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn(),
    requestUrl: jest.fn(),
    TFile: jest.fn()
}));

describe('Issue #854 - All-day ICS events showing on wrong day', () => {
    let service: ICSSubscriptionService;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock plugin
        mockPlugin = {
            loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
            saveData: jest.fn().mockResolvedValue(undefined),
            i18n: {
                translate: jest.fn((key: string) => key)
            },
            app: {
                vault: {
                    getAbstractFileByPath: jest.fn(),
                    cachedRead: jest.fn(),
                    getFiles: jest.fn().mockReturnValue([]),
                    on: jest.fn(),
                    offref: jest.fn()
                }
            }
        };

        service = new ICSSubscriptionService(mockPlugin);
    });

    it('should preserve the date for all-day events regardless of timezone', () => {
        // Test case from issue #854:
        // All-day event on Jan 20, 2025 should display on Jan 20 in ANY timezone
        // Bug: Currently shows on Jan 19 in PST (UTC-8) and other negative UTC offset timezones

        const icsData = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Test//Test//EN',
            'BEGIN:VEVENT',
            'DTSTART;VALUE=DATE:20250120',
            'DTEND;VALUE=DATE:20250121',
            'UID:allday-event-123',
            'SUMMARY:All Day Event',
            'DESCRIPTION:Should show on Jan 20',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\n');

        // Parse the ICS data
        const events = (service as any).parseICS(icsData, 'test-sub');

        expect(events).toHaveLength(1);

        const event = events[0];

        // Verify it's marked as all-day
        expect(event.allDay).toBe(true);

        // The critical test: the stored date should maintain the calendar date (Jan 20)
        // when interpreted in ANY timezone
        const startDate = new Date(event.start);

        // When we parse an all-day event for Jan 20, we need to ensure that
        // regardless of the user's timezone, the date appears as Jan 20
        // The bug is that using Date.UTC() creates midnight UTC, which when
        // displayed in negative UTC timezones (like PST = UTC-8), shows the previous day

        // Check the date components - these should be Jan 20 when viewed locally
        // This will fail with the current implementation in negative UTC timezones
        const localYear = startDate.getFullYear();
        const localMonth = startDate.getMonth(); // 0-indexed
        const localDay = startDate.getDate();

        expect(localYear).toBe(2025);
        expect(localMonth).toBe(0); // January
        expect(localDay).toBe(20); // Should be 20, but will be 19 in PST with current bug
    });

    it('should handle all-day events spanning multiple days correctly', () => {
        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20250210
DTEND;VALUE=DATE:20250212
UID:multiday-event-456
SUMMARY:Two Day Event
END:VEVENT
END:VCALENDAR`;

        const events = (service as any).parseICS(icsData, 'test-sub');

        expect(events).toHaveLength(1);

        const event = events[0];
        expect(event.allDay).toBe(true);

        const startDate = new Date(event.start);
        const endDate = new Date(event.end!);

        // Start should be Feb 10 in local time
        expect(startDate.getFullYear()).toBe(2025);
        expect(startDate.getMonth()).toBe(1); // February (0-indexed)
        expect(startDate.getDate()).toBe(10);

        // End should be Feb 12 in local time (exclusive in ICS format)
        expect(endDate.getFullYear()).toBe(2025);
        expect(endDate.getMonth()).toBe(1); // February (0-indexed)
        expect(endDate.getDate()).toBe(12);
    });

    it('should handle all-day recurring events correctly', () => {
        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20250115
DTEND;VALUE=DATE:20250116
RRULE:FREQ=WEEKLY;COUNT=3
UID:recurring-allday-789
SUMMARY:Weekly All Day Event
END:VEVENT
END:VCALENDAR`;

        const events = (service as any).parseICS(icsData, 'test-sub');

        // Should have 3 occurrences
        expect(events.length).toBeGreaterThanOrEqual(3);

        // Check first occurrence (Jan 15)
        const firstEvent = events[0];
        expect(firstEvent.allDay).toBe(true);

        const firstDate = new Date(firstEvent.start);
        expect(firstDate.getFullYear()).toBe(2025);
        expect(firstDate.getMonth()).toBe(0); // January
        expect(firstDate.getDate()).toBe(15);

        // Check second occurrence (Jan 22)
        const secondEvent = events[1];
        const secondDate = new Date(secondEvent.start);
        expect(secondDate.getFullYear()).toBe(2025);
        expect(secondDate.getMonth()).toBe(0); // January
        expect(secondDate.getDate()).toBe(22);

        // Check third occurrence (Jan 29)
        const thirdEvent = events[2];
        const thirdDate = new Date(thirdEvent.start);
        expect(thirdDate.getFullYear()).toBe(2025);
        expect(thirdDate.getMonth()).toBe(0); // January
        expect(thirdDate.getDate()).toBe(29);
    });

    it('should distinguish between all-day and timed events', () => {
        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20250120
DTEND;VALUE=DATE:20250121
UID:allday-1
SUMMARY:All Day Event
END:VEVENT
BEGIN:VEVENT
DTSTART:20250120T140000Z
DTEND:20250120T150000Z
UID:timed-1
SUMMARY:Timed Event
END:VEVENT
END:VCALENDAR`;

        const events = (service as any).parseICS(icsData, 'test-sub');

        expect(events).toHaveLength(2);

        const allDayEvent = events.find((e: ICSEvent) => e.title === 'All Day Event');
        const timedEvent = events.find((e: ICSEvent) => e.title === 'Timed Event');

        expect(allDayEvent).toBeDefined();
        expect(timedEvent).toBeDefined();

        // All-day event should maintain calendar date
        expect(allDayEvent!.allDay).toBe(true);
        const allDayDate = new Date(allDayEvent!.start);
        expect(allDayDate.getDate()).toBe(20);

        // Timed event properly converts to UTC
        expect(timedEvent!.allDay).toBe(false);
        expect(timedEvent!.start).toBe('2025-01-20T14:00:00.000Z');
    });
});
