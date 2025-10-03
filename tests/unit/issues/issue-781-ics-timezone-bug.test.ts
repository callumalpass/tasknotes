import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import { ICSEvent } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn(),
    requestUrl: jest.fn(),
    TFile: jest.fn()
}));

// Mock ICAL to ensure it's available in test environment
jest.mock('ical.js', () => {
    const actualICAL = jest.requireActual('ical.js');
    return actualICAL;
});

describe('Issue #781 - ICS Calendar Timezone Conversion Bug', () => {
    let service: ICSSubscriptionService;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock plugin
        mockPlugin = {
            loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
            saveData: jest.fn().mockResolvedValue(undefined),
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

    it('should convert Outlook event from EST to local timezone (MST)', () => {
        // Scenario from issue #781:
        // - Event scheduled for 3 PM EST (15:00 EST = 20:00 UTC)
        // - User is in MST timezone (UTC-7)
        // - Should display as 1 PM MST (13:00 MST)
        // - Bug: Currently shows as 3 PM MST (incorrect)

        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VTIMEZONE
TZID:Eastern Standard Time
BEGIN:STANDARD
DTSTART:16011104T020000
RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010311T020000
RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=Eastern Standard Time:20250110T150000
DTEND;TZID=Eastern Standard Time:20250110T160000
UID:outlook-meeting-123
SUMMARY:Team Meeting
LOCATION:Conference Room
DESCRIPTION:Weekly team sync
END:VEVENT
END:VCALENDAR`;

        // Parse the ICS data
        const events = (service as any).parseICS(icsData, 'outlook-sub');

        expect(events).toHaveLength(1);

        const event = events[0];

        // The start time should be stored as ISO string in UTC
        // 3 PM EST = 20:00 UTC (during standard time)
        expect(event.start).toBe('2025-01-10T20:00:00.000Z');

        // When displayed in MST (UTC-7), this should show as 1 PM
        const displayDate = new Date(event.start);

        // Simulate displaying in MST timezone (we can't actually change Node's timezone in tests)
        // But we can verify the UTC time is correct
        expect(displayDate.getUTCHours()).toBe(20); // 20:00 UTC
        expect(displayDate.getUTCMinutes()).toBe(0);

        // The bug would be if the time was stored as:
        // '2025-01-10T15:00:00.000Z' (3 PM UTC instead of 3 PM EST)
        // This would display as 3 PM in any timezone viewing it as a UTC time
        expect(event.start).not.toBe('2025-01-10T15:00:00.000Z');
    });

    it('should handle timezone-aware events correctly for different timezones', () => {
        // Test with Pacific Time (PT) event
        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VTIMEZONE
TZID:America/Los_Angeles
BEGIN:STANDARD
DTSTART:20241103T020000
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
TZNAME:PST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20250309T020000
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
TZNAME:PDT
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=America/Los_Angeles:20250115T140000
DTEND;TZID=America/Los_Angeles:20250115T150000
UID:pst-event-456
SUMMARY:West Coast Meeting
END:VEVENT
END:VCALENDAR`;

        const events = (service as any).parseICS(icsData, 'test-sub');

        expect(events).toHaveLength(1);

        const event = events[0];

        // 2 PM PST (Pacific Standard Time) = 22:00 UTC
        // (PST is UTC-8 during winter)
        expect(event.start).toBe('2025-01-15T22:00:00.000Z');
    });

    it('should handle all-day events without timezone issues', () => {
        // All-day events should not have timezone conversion issues
        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20250120
DTEND;VALUE=DATE:20250121
UID:allday-event-789
SUMMARY:All Day Event
END:VEVENT
END:VCALENDAR`;

        const events = (service as any).parseICS(icsData, 'test-sub');

        expect(events).toHaveLength(1);

        const event = events[0];

        // All-day events should be marked as such
        expect(event.allDay).toBe(true);

        // The date should be preserved correctly
        const startDate = new Date(event.start);
        expect(startDate.getUTCFullYear()).toBe(2025);
        expect(startDate.getUTCMonth()).toBe(0); // January (0-indexed)
        expect(startDate.getUTCDate()).toBe(20);
    });

    it('should handle events without timezone information (floating time)', () => {
        // Events without TZID should be treated as "floating" time
        // and interpreted in the local timezone
        const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250125T100000
DTEND:20250125T110000
UID:floating-event-999
SUMMARY:Floating Time Event
END:VEVENT
END:VCALENDAR`;

        const events = (service as any).parseICS(icsData, 'test-sub');

        expect(events).toHaveLength(1);

        const event = events[0];

        // Floating time events (no Z, no TZID) should be interpreted as local time
        // The exact behavior depends on ICAL.js implementation
        expect(event.start).toBeDefined();
        expect(event.allDay).toBe(false);
    });
});
