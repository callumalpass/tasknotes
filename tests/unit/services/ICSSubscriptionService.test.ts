import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import { ICSEvent } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';

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

describe.skip('ICSSubscriptionService - Recurring Event Exceptions', () => {
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

    describe('parseICS with EXDATE and RECURRENCE-ID', () => {
        it('should exclude dates listed in EXDATE', () => {
            // First, test with a simple non-recurring event to ensure basic parsing works
            const simpleIcsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
DTSTART:20250106T150000Z
DTEND:20250106T160000Z
UID:simple-test-123
SUMMARY:Simple Meeting
END:VEVENT
END:VCALENDAR`;

            const simpleEvents = (service as any).parseICS(simpleIcsData, 'test-sub-id');
            console.log('Debug: Simple event parsing returned', simpleEvents.length, 'events');

            // Now test with recurring event
            const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
DTSTART:20250106T150000Z
DTEND:20250106T160000Z
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=5
EXDATE:20250113T150000Z
EXDATE:20250127T150000Z
UID:test-event-123
SUMMARY:Weekly Meeting
END:VEVENT
END:VCALENDAR`;

            // Access private method via any cast
            const events = (service as any).parseICS(icsData, 'test-sub-id');
            console.log('Debug: parseICS returned', events.length, 'events');
            console.log('Debug: events:', events);
            
            // Should have 3 events (5 total - 2 excluded)
            expect(events).toHaveLength(3);
            
            // Verify excluded dates are not present
            const eventDates = events.map((e: ICSEvent) => new Date(e.start).toISOString());
            expect(eventDates).not.toContain('2025-01-13T15:00:00.000Z');
            expect(eventDates).not.toContain('2025-01-27T15:00:00.000Z');
            
            // Verify included dates
            expect(eventDates).toContain('2025-01-06T15:00:00.000Z');
            expect(eventDates).toContain('2025-01-20T15:00:00.000Z');
            expect(eventDates).toContain('2025-02-03T15:00:00.000Z');
        });

        it('should replace recurring instances with modified versions using RECURRENCE-ID', () => {
            const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
DTSTART:20250106T150000Z
DTEND:20250106T160000Z
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3
UID:test-event-456
SUMMARY:Original Meeting
LOCATION:Room A
END:VEVENT
BEGIN:VEVENT
DTSTART:20250113T153000Z
DTEND:20250113T163000Z
RECURRENCE-ID:20250113T150000Z
UID:test-event-456
SUMMARY:Modified Meeting
LOCATION:Room B
END:VEVENT
END:VCALENDAR`;

            const events = (service as any).parseICS(icsData, 'test-sub-id');
            
            // Should have 3 events total
            expect(events).toHaveLength(3);
            
            // Find the modified event
            const modifiedEvent = events.find((e: ICSEvent) => 
                e.start === '2025-01-13T15:30:00.000Z'
            );
            
            expect(modifiedEvent).toBeDefined();
            expect(modifiedEvent.title).toBe('Modified Meeting');
            expect(modifiedEvent.location).toBe('Room B');
            expect(modifiedEvent.end).toBe('2025-01-13T16:30:00.000Z');
            
            // Verify original time slot is not present
            const originalTimeEvent = events.find((e: ICSEvent) => 
                e.start === '2025-01-13T15:00:00.000Z'
            );
            expect(originalTimeEvent).toBeUndefined();
        });

        it('should handle both EXDATE and RECURRENCE-ID together', () => {
            const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
DTSTART:20250106T150000Z
DTEND:20250106T160000Z
RRULE:FREQ=DAILY;COUNT=7
EXDATE:20250108T150000Z
EXDATE:20250110T150000Z
UID:complex-event
SUMMARY:Daily Standup
END:VEVENT
BEGIN:VEVENT
DTSTART:20250107T140000Z
DTEND:20250107T150000Z
RECURRENCE-ID:20250107T150000Z
UID:complex-event
SUMMARY:Daily Standup (Early)
END:VEVENT
END:VCALENDAR`;

            const events = (service as any).parseICS(icsData, 'test-sub-id');
            
            // Should have 5 events (7 - 2 excluded, with 1 modified)
            expect(events).toHaveLength(5);
            
            const eventDates = events.map((e: ICSEvent) => ({
                start: e.start,
                title: e.title
            }));
            
            // Check excluded dates are not present
            expect(eventDates.find(e => e.start === '2025-01-08T15:00:00.000Z')).toBeUndefined();
            expect(eventDates.find(e => e.start === '2025-01-10T15:00:00.000Z')).toBeUndefined();
            
            // Check modified event
            const modifiedEvent = eventDates.find(e => e.start === '2025-01-07T14:00:00.000Z');
            expect(modifiedEvent).toBeDefined();
            expect(modifiedEvent?.title).toBe('Daily Standup (Early)');
            
            // Original time for Jan 7 should not exist
            expect(eventDates.find(e => e.start === '2025-01-07T15:00:00.000Z')).toBeUndefined();
        });

        it('should handle timezone-aware EXDATE and RECURRENCE-ID', () => {
            const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:20231105T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20240310T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20250106T150000
DTEND;TZID=America/New_York:20250106T160000
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4
EXDATE;TZID=America/New_York:20250113T150000
UID:tz-event
SUMMARY:Team Sync
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20250120T153000
DTEND;TZID=America/New_York:20250120T163000
RECURRENCE-ID;TZID=America/New_York:20250120T150000
UID:tz-event
SUMMARY:Team Sync (Delayed)
END:VEVENT
END:VCALENDAR`;

            const events = (service as any).parseICS(icsData, 'test-sub-id');
            
            // Should have 3 events (4 - 1 excluded, with 1 modified)
            expect(events).toHaveLength(3);
            
            // Verify the excluded date is not present
            const jan13Event = events.find((e: ICSEvent) => {
                const date = new Date(e.start);
                return date.getDate() === 13 && date.getMonth() === 0; // January 13
            });
            expect(jan13Event).toBeUndefined();
            
            // Verify the modified event
            const jan20Event = events.find((e: ICSEvent) => {
                const date = new Date(e.start);
                return date.getDate() === 20 && date.getMonth() === 0; // January 20
            });
            expect(jan20Event).toBeDefined();
            expect(jan20Event?.title).toBe('Team Sync (Delayed)');
            
            // The modified event should be at 3:30 PM, not 3:00 PM
            const modifiedDate = new Date(jan20Event!.start);
            expect(modifiedDate.getHours()).toBe(20); // 3:30 PM ET = 20:30 UTC in January
            expect(modifiedDate.getMinutes()).toBe(30);
        });
    });

    describe('Issue #342 - Outlook recurring event modifications', () => {
        it('should correctly handle the exact scenario from issue #342', () => {
            // Simulate the exact case: Monday 3pm moved to Tuesday 3:30pm
            const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN
BEGIN:VEVENT
DTSTART;TZID=Eastern Standard Time:20250106T150000
DTEND;TZID=Eastern Standard Time:20250106T160000
RRULE:FREQ=WEEKLY;BYDAY=MO
UID:outlook-meeting-789
SUMMARY:Weekly Review
LOCATION:Conference Room
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Eastern Standard Time:20250107T153000
DTEND;TZID=Eastern Standard Time:20250107T163000
RECURRENCE-ID;TZID=Eastern Standard Time:20250106T150000
UID:outlook-meeting-789
SUMMARY:Weekly Review
LOCATION:Conference Room
SEQUENCE:1
END:VEVENT
END:VCALENDAR`;

            const events = (service as any).parseICS(icsData, 'outlook-sub');
            
            // Filter to just the first week to verify the fix
            const firstWeekEvents = events.filter((e: ICSEvent) => {
                const date = new Date(e.start);
                return date >= new Date('2025-01-06') && date < new Date('2025-01-13');
            });
            
            // Should only have the Tuesday event, not Monday
            expect(firstWeekEvents).toHaveLength(1);
            
            const tuesdayEvent = firstWeekEvents[0];
            const eventDate = new Date(tuesdayEvent.start);
            
            // Verify it's on Tuesday (day 2) at 3:30 PM
            expect(eventDate.getDay()).toBe(2); // Tuesday
            expect(eventDate.getHours()).toBe(20); // 3:30 PM ET = 20:30 UTC in January
            expect(eventDate.getMinutes()).toBe(30);
            
            // Verify no Monday event exists
            const mondayEvent = firstWeekEvents.find((e: ICSEvent) => {
                const date = new Date(e.start);
                return date.getDay() === 1; // Monday
            });
            expect(mondayEvent).toBeUndefined();
        });
    });
});

describe('ICSSubscriptionService - HTTP Basic Authentication', () => {
    let service: ICSSubscriptionService;
    let mockPlugin: any;
    let mockRequestUrl: jest.Mock;

    beforeEach(() => {
        // Get the mocked requestUrl
        mockRequestUrl = require('obsidian').requestUrl;
        mockRequestUrl.mockReset();
        mockRequestUrl.mockResolvedValue({
            text: `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
DTSTART:20250106T150000Z
DTEND:20250106T160000Z
UID:test-event-123
SUMMARY:Test Event
END:VEVENT
END:VCALENDAR`
        });

        // Mock plugin with i18n
        mockPlugin = {
            loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
            saveData: jest.fn().mockResolvedValue(undefined),
            i18n: {
                translate: jest.fn((key: string) => key),
            },
            app: {
                vault: {
                    getAbstractFileByPath: jest.fn(),
                    cachedRead: jest.fn(),
                    getFiles: jest.fn().mockReturnValue([]),
                    on: jest.fn().mockReturnValue({ unload: jest.fn() }),
                    offref: jest.fn()
                }
            }
        };

        service = new ICSSubscriptionService(mockPlugin);
    });

    it('should not include Authorization header for public calendars (authType none)', async () => {
        const subscription = {
            id: 'test-sub-1',
            name: 'Public Calendar',
            url: 'https://example.com/calendar.ics',
            type: 'remote' as const,
            color: '#4285F4',
            enabled: true,
            refreshInterval: 60,
            authType: 'none' as const,
        };

        // Add subscription and trigger fetch
        mockPlugin.loadData.mockResolvedValue({ icsSubscriptions: [subscription] });
        await service.initialize();

        // Verify requestUrl was called without Authorization header
        expect(mockRequestUrl).toHaveBeenCalled();
        const callArgs = mockRequestUrl.mock.calls[0][0];
        expect(callArgs.headers).not.toHaveProperty('Authorization');
    });

    it('should include Basic Auth header when authType is basic with credentials', async () => {
        const subscription = {
            id: 'test-sub-2',
            name: 'Baikal Calendar',
            url: 'https://baikal.example.com/dav.php/calendars/user/default/?export',
            type: 'remote' as const,
            color: '#4285F4',
            enabled: true,
            refreshInterval: 60,
            authType: 'basic' as const,
            username: 'testuser',
            password: 'testpass123',
        };

        // Add subscription and trigger fetch
        mockPlugin.loadData.mockResolvedValue({ icsSubscriptions: [subscription] });
        await service.initialize();

        // Verify requestUrl was called with correct Authorization header
        expect(mockRequestUrl).toHaveBeenCalled();
        const callArgs = mockRequestUrl.mock.calls[0][0];
        expect(callArgs.headers).toHaveProperty('Authorization');
        
        // Verify the Basic auth header format
        const expectedAuth = `Basic ${btoa('testuser:testpass123')}`;
        expect(callArgs.headers.Authorization).toBe(expectedAuth);
    });

    it('should not include Authorization header when authType is basic but credentials are missing', async () => {
        const subscription = {
            id: 'test-sub-3',
            name: 'Misconfigured Calendar',
            url: 'https://example.com/calendar.ics',
            type: 'remote' as const,
            color: '#4285F4',
            enabled: true,
            refreshInterval: 60,
            authType: 'basic' as const,
            username: '', // Empty username
            password: 'somepass',
        };

        mockPlugin.loadData.mockResolvedValue({ icsSubscriptions: [subscription] });
        await service.initialize();

        // Should not include Authorization when username is empty
        expect(mockRequestUrl).toHaveBeenCalled();
        const callArgs = mockRequestUrl.mock.calls[0][0];
        expect(callArgs.headers).not.toHaveProperty('Authorization');
    });

    it('should handle special characters in username and password', async () => {
        const subscription = {
            id: 'test-sub-4',
            name: 'Special Chars Calendar',
            url: 'https://example.com/calendar.ics',
            type: 'remote' as const,
            color: '#4285F4',
            enabled: true,
            refreshInterval: 60,
            authType: 'basic' as const,
            username: 'user@example.com',
            password: 'p@ss:word/123!',
        };

        mockPlugin.loadData.mockResolvedValue({ icsSubscriptions: [subscription] });
        await service.initialize();

        expect(mockRequestUrl).toHaveBeenCalled();
        const callArgs = mockRequestUrl.mock.calls[0][0];
        
        // Verify special characters are properly encoded
        const expectedAuth = `Basic ${btoa('user@example.com:p@ss:word/123!')}`;
        expect(callArgs.headers.Authorization).toBe(expectedAuth);
    });
});