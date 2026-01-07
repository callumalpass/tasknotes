/**
 * Issue #1085 - Recurring problem with timezones (regression of #781)
 *
 * Original issue #781: ICS calendar events from Outlook with non-IANA timezone
 * identifiers (e.g., "Eastern Standard Time" instead of "America/New_York")
 * were not being converted to the user's local timezone.
 *
 * The bug causes events scheduled at 3 PM EST to display as 3 PM MST (user's timezone)
 * instead of the correct 1 PM MST.
 *
 * Root cause: The timezone conversion code may be:
 * 1. Not properly recognizing non-IANA timezone identifiers in VTIMEZONE
 * 2. Not applying the correct offset when converting to UTC
 * 3. Issues with how FullCalendar interprets the ISO timestamps
 *
 * The fix in #781 was to use toUnixTime() instead of toJSDate() for conversion,
 * but this regression suggests the fix may have been partially reverted or
 * there are edge cases not being handled.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1085
 * @see https://github.com/callumalpass/tasknotes/issues/781
 */

import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import ICAL from 'ical.js';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

describe.skip('Issue #1085 - ICS Timezone Regression (regression of #781)', () => {
	let service: ICSSubscriptionService;
	let mockPlugin: any;

	beforeEach(() => {
		// Mock plugin
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
					on: jest.fn(),
					offref: jest.fn(),
				},
			},
		};

		service = new ICSSubscriptionService(mockPlugin);
	});

	describe('Outlook calendar with non-IANA timezone identifiers', () => {
		it('should convert events with "Eastern Standard Time" TZID to UTC correctly', () => {
			// Scenario from issue #781/#1085:
			// - Event scheduled for 3 PM EST (15:00 EST = 20:00 UTC)
			// - TZID uses "Eastern Standard Time" (Windows/Outlook format)
			// - Bug: Event displays at 3 PM in any timezone instead of being converted
			//
			// The VTIMEZONE block defines the offset rules, but if the code
			// doesn't properly register/use these, the time won't be converted.

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'CALSCALE:GREGORIAN',
				'METHOD:PUBLISH',
				'BEGIN:VTIMEZONE',
				'TZID:Eastern Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011104T020000',
				'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
				'TZOFFSETFROM:-0400',
				'TZOFFSETTO:-0500',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010311T020000',
				'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
				'TZOFFSETFROM:-0500',
				'TZOFFSETTO:-0400',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=Eastern Standard Time:20250110T150000',
				'DTEND;TZID=Eastern Standard Time:20250110T160000',
				'UID:outlook-meeting-1085-test',
				'SUMMARY:Team Meeting',
				'LOCATION:Conference Room',
				'DESCRIPTION:Weekly team sync',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			// Parse the ICS data using the service's private method
			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// January 10, 2025 is during EST (standard time, UTC-5)
			// 3 PM EST = 15:00 EST = 20:00 UTC
			//
			// If the bug is present, the time will be stored as:
			// '2025-01-10T15:00:00.000Z' (wrong - treating EST time as UTC)
			//
			// If fixed correctly, it should be:
			// '2025-01-10T20:00:00.000Z' (correct - properly converted to UTC)

			expect(event.start).toBe('2025-01-10T20:00:00.000Z');
			expect(event.end).toBe('2025-01-10T21:00:00.000Z');

			// Verify it's NOT the buggy value
			expect(event.start).not.toBe('2025-01-10T15:00:00.000Z');
		});

		it('should convert events during daylight saving time correctly', () => {
			// Test case for EDT (Eastern Daylight Time, UTC-4)
			// July 15, 2025 is during EDT
			// 3 PM EDT = 15:00 EDT = 19:00 UTC (not 20:00 like EST)

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:Eastern Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011104T020000',
				'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
				'TZOFFSETFROM:-0400',
				'TZOFFSETTO:-0500',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010311T020000',
				'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
				'TZOFFSETFROM:-0500',
				'TZOFFSETTO:-0400',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=Eastern Standard Time:20250715T150000',
				'DTEND;TZID=Eastern Standard Time:20250715T160000',
				'UID:outlook-summer-meeting-1085',
				'SUMMARY:Summer Team Meeting',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// 3 PM EDT (UTC-4) = 19:00 UTC
			expect(event.start).toBe('2025-07-15T19:00:00.000Z');
			expect(event.end).toBe('2025-07-15T20:00:00.000Z');
		});

		it('should handle events with "Pacific Standard Time" TZID', () => {
			// Pacific time zone test
			// January (PST, UTC-8): 2 PM PST = 22:00 UTC

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:Pacific Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011104T020000',
				'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
				'TZOFFSETFROM:-0700',
				'TZOFFSETTO:-0800',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010311T020000',
				'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
				'TZOFFSETFROM:-0800',
				'TZOFFSETTO:-0700',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=Pacific Standard Time:20250120T140000',
				'DTEND;TZID=Pacific Standard Time:20250120T150000',
				'UID:outlook-pst-meeting-1085',
				'SUMMARY:West Coast Meeting',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// 2 PM PST (UTC-8) = 22:00 UTC
			expect(event.start).toBe('2025-01-20T22:00:00.000Z');
			expect(event.end).toBe('2025-01-20T23:00:00.000Z');
		});
	});

	describe('Events without VTIMEZONE definition', () => {
		it('should handle events with TZID but no VTIMEZONE block', () => {
			// Some calendars send TZID without corresponding VTIMEZONE definition
			// This can happen with simplified/non-compliant calendar exports
			// These should be treated as floating time or local time

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Test//Test//EN',
				'BEGIN:VEVENT',
				'DTSTART;TZID=Zurich:20250115T100000',
				'DTEND;TZID=Zurich:20250115T110000',
				'UID:no-vtimezone-event-1085',
				'SUMMARY:Meeting with non-standard TZID',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'test-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// Without a VTIMEZONE definition, the behavior depends on ical.js
			// It should either:
			// - Treat as floating time (local)
			// - Try to resolve "Zurich" as Europe/Zurich
			//
			// The key is that it shouldn't crash and should return a valid event
			expect(event.start).toBeDefined();
			expect(event.title).toBe('Meeting with non-standard TZID');
		});
	});

	describe('Infomaniak calendar format', () => {
		it('should handle Infomaniak calendar events with custom TZID', () => {
			// Infomaniak is mentioned in the original fix commit as a provider
			// that uses non-IANA TZIDs

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Infomaniak//Calendar//EN',
				'BEGIN:VTIMEZONE',
				'TZID:Europe/Zurich',
				'BEGIN:STANDARD',
				'DTSTART:19701025T030000',
				'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'TZNAME:CET',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:19700329T020000',
				'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'TZNAME:CEST',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=Europe/Zurich:20250115T140000',
				'DTEND;TZID=Europe/Zurich:20250115T150000',
				'UID:infomaniak-event-1085',
				'SUMMARY:Zurich Meeting',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'infomaniak-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// January 15 is in CET (Central European Time, UTC+1)
			// 2 PM CET = 14:00 CET = 13:00 UTC
			expect(event.start).toBe('2025-01-15T13:00:00.000Z');
			expect(event.end).toBe('2025-01-15T14:00:00.000Z');
		});
	});

	describe('UTC events', () => {
		it('should handle events already in UTC (with Z suffix)', () => {
			// Events with Z suffix are already in UTC and should pass through unchanged

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Test//Test//EN',
				'BEGIN:VEVENT',
				'DTSTART:20250115T200000Z',
				'DTEND:20250115T210000Z',
				'UID:utc-event-1085',
				'SUMMARY:UTC Event',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'test-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// Should remain as 20:00 UTC
			expect(event.start).toBe('2025-01-15T20:00:00.000Z');
			expect(event.end).toBe('2025-01-15T21:00:00.000Z');
		});
	});

	describe('Floating time events', () => {
		it('should handle floating time events (no timezone specified)', () => {
			// Events without timezone specification are "floating" and
			// represent the same wall-clock time in any timezone

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Test//Test//EN',
				'BEGIN:VEVENT',
				'DTSTART:20250115T100000',
				'DTEND:20250115T110000',
				'UID:floating-event-1085',
				'SUMMARY:Floating Time Event',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'test-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// For floating time, the behavior depends on implementation
			// The key is that the event is parsed successfully
			expect(event.start).toBeDefined();
			expect(event.allDay).toBe(false);
		});
	});

	describe('All-day events', () => {
		it('should handle all-day events without timezone conversion issues', () => {
			// All-day events (VALUE=DATE) should not have timezone issues
			// as they represent a calendar day, not a specific moment in time

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Test//Test//EN',
				'BEGIN:VEVENT',
				'DTSTART;VALUE=DATE:20250120',
				'DTEND;VALUE=DATE:20250121',
				'UID:allday-event-1085',
				'SUMMARY:All Day Event',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'test-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			expect(event.allDay).toBe(true);
			// All-day events should return date-only string
			expect(event.start).toBe('2025-01-20');
		});
	});
});

describe.skip('Issue #1085 - Playwright E2E Tests', () => {
	/**
	 * These tests would need to be implemented as Playwright E2E tests
	 * to properly verify the visual display of ICS events in the calendar view.
	 *
	 * Test scenarios to implement:
	 *
	 * 1. Add an ICS subscription with an Outlook calendar URL
	 * 2. Verify an event at 3 PM EST displays at the correct local time:
	 *    - If user is in EST: Should show 3 PM
	 *    - If user is in MST (UTC-7): Should show 1 PM
	 *    - If user is in UTC: Should show 8 PM
	 *
	 * 3. Verify the tooltip/event details show the correct time
	 * 4. Verify the event appears in the correct time slot in timeGrid view
	 */

	it.todo('should display Outlook calendar events at correct local time');
	it.todo('should handle daylight saving time transitions correctly');
	it.todo('should display event tooltips with correct timezone-aware time');
});
