/**
 * Issue #1006 - Remote calendar events 1h ahead due to DST transition differences
 *
 * Bug description:
 * After the time change in Europe, events from Outlook calendar are showing
 * one hour ahead of the correct time. The user expects the issue to resolve
 * when the US time change occurs.
 *
 * Root cause analysis:
 * This appears to be a DST (Daylight Saving Time) transition mismatch issue.
 * Europe and the US transition between standard time and daylight saving time
 * on different dates:
 * - Europe: Last Sunday of March / Last Sunday of October
 * - US: Second Sunday of March / First Sunday of November
 *
 * During the period between these transitions (typically 2-4 weeks in spring
 * and fall), the offset between European and US timezones differs by 1 hour
 * from normal.
 *
 * For example:
 * - Normal: CET (UTC+1) is 6 hours ahead of EST (UTC-5)
 * - During spring gap (Europe DST, US not): CEST (UTC+2) is 7 hours ahead of EST (UTC-5)
 * - During fall gap (Europe standard, US DST): CET (UTC+1) is 5 hours ahead of EDT (UTC-4)
 *
 * If the calendar system isn't properly accounting for DST on both ends of
 * the timezone conversion, events will appear 1 hour off during these periods.
 *
 * @see https://github.com/your-repo/issues/1006
 * @see tests/unit/issues/issue-781-ics-timezone-bug.test.ts
 * @see tests/unit/issues/issue-1085-ics-timezone-regression.test.ts
 */

import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

describe.skip('Issue #1006 - Remote calendar events 1h ahead during DST transition period', () => {
	let service: ICSSubscriptionService;
	let mockPlugin: any;

	beforeEach(() => {
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

	describe('DST transition gap between Europe and US (Spring)', () => {
		/**
		 * Spring 2025 DST transitions:
		 * - Europe: March 30, 2025 (clocks go forward)
		 * - US: March 9, 2025 (clocks go forward)
		 *
		 * Between March 9 and March 30, the US is on DST but Europe is not.
		 * During this period:
		 * - US Eastern: EDT (UTC-4)
		 * - Central Europe: CET (UTC+1)
		 * - Difference: 5 hours (instead of normal 6 hours)
		 */
		it('should handle events during spring DST gap (US on DST, Europe not yet)', () => {
			// Event: March 20, 2025 at 3 PM CET (Europe still on standard time)
			// Expected UTC: 14:00 (CET is UTC+1 during standard time)
			// US user in EDT (UTC-4) should see: 10:00 AM
			//
			// Bug: If the system assumes Europe is already on DST (CEST, UTC+2),
			// it would calculate UTC as 13:00 and show 9:00 AM EDT (1 hour early)
			// OR if it doesn't properly track DST status, it could show 11:00 AM (1 hour late)

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:W. Europe Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T030000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=W. Europe Standard Time:20250320T150000',
				'DTEND;TZID=W. Europe Standard Time:20250320T160000',
				'UID:outlook-dst-gap-spring-1006',
				'SUMMARY:Meeting during spring DST gap',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// March 20, 2025 - Europe is NOT yet on DST (still CET, UTC+1)
			// 3 PM CET = 14:00 UTC
			expect(event.start).toBe('2025-03-20T14:00:00.000Z');
			expect(event.end).toBe('2025-03-20T15:00:00.000Z');
		});

		it('should handle events on the day Europe transitions to DST', () => {
			// Event: March 30, 2025 at 3 PM CEST (Europe's DST transition day)
			// After 2 AM -> 3 AM transition, this event is in CEST (UTC+2)
			// Expected UTC: 13:00

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:W. Europe Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T030000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=W. Europe Standard Time:20250330T150000',
				'DTEND;TZID=W. Europe Standard Time:20250330T160000',
				'UID:outlook-dst-transition-day-1006',
				'SUMMARY:Meeting on Europe DST transition day',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// March 30, 2025 afternoon - Europe IS on DST (CEST, UTC+2)
			// 3 PM CEST = 13:00 UTC
			expect(event.start).toBe('2025-03-30T13:00:00.000Z');
			expect(event.end).toBe('2025-03-30T14:00:00.000Z');
		});
	});

	describe('DST transition gap between Europe and US (Fall)', () => {
		/**
		 * Fall 2025 DST transitions:
		 * - Europe: October 26, 2025 (clocks go back)
		 * - US: November 2, 2025 (clocks go back)
		 *
		 * Between October 26 and November 2, Europe is on standard time but US is still on DST.
		 * During this period:
		 * - US Eastern: EDT (UTC-4)
		 * - Central Europe: CET (UTC+1)
		 * - Difference: 5 hours (instead of normal 6 hours)
		 */
		it('should handle events during fall DST gap (Europe standard, US still on DST)', () => {
			// Event: October 28, 2025 at 3 PM CET (Europe back on standard time)
			// Expected UTC: 14:00 (CET is UTC+1)
			// US user in EDT (UTC-4) should see: 10:00 AM
			//
			// Bug: If the system assumes US is also on standard time (EST, UTC-5),
			// the display would be off by 1 hour

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:W. Europe Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T030000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=W. Europe Standard Time:20251028T150000',
				'DTEND;TZID=W. Europe Standard Time:20251028T160000',
				'UID:outlook-dst-gap-fall-1006',
				'SUMMARY:Meeting during fall DST gap',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// October 28, 2025 - Europe IS back on standard time (CET, UTC+1)
			// 3 PM CET = 14:00 UTC
			expect(event.start).toBe('2025-10-28T14:00:00.000Z');
			expect(event.end).toBe('2025-10-28T15:00:00.000Z');
		});

		it('should handle events on the day Europe transitions back from DST', () => {
			// Event: October 26, 2025 at 3 PM CET (Europe's fall DST transition day)
			// After 3 AM -> 2 AM transition, afternoon events are in CET (UTC+1)
			// Expected UTC: 14:00

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:W. Europe Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T030000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=W. Europe Standard Time:20251026T150000',
				'DTEND;TZID=W. Europe Standard Time:20251026T160000',
				'UID:outlook-dst-transition-fall-1006',
				'SUMMARY:Meeting on Europe fall DST transition day',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// October 26, 2025 afternoon - Europe IS back on standard time (CET, UTC+1)
			// 3 PM CET = 14:00 UTC
			expect(event.start).toBe('2025-10-26T14:00:00.000Z');
			expect(event.end).toBe('2025-10-26T15:00:00.000Z');
		});
	});

	describe('Outlook non-IANA timezone handling during DST gaps', () => {
		it('should correctly parse Outlook "Romance Standard Time" (Paris/Brussels) during DST gap', () => {
			// Romance Standard Time is used for France, Belgium, etc.
			// Event: March 20, 2025 at 2 PM CET

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:Romance Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T030000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=Romance Standard Time:20250320T140000',
				'DTEND;TZID=Romance Standard Time:20250320T150000',
				'UID:outlook-romance-tz-1006',
				'SUMMARY:Paris meeting during DST gap',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// March 20, 2025 - Europe not yet on DST (CET, UTC+1)
			// 2 PM CET = 13:00 UTC
			expect(event.start).toBe('2025-03-20T13:00:00.000Z');
			expect(event.end).toBe('2025-03-20T14:00:00.000Z');
		});

		it('should correctly parse Outlook "GMT Standard Time" (UK) during DST gap', () => {
			// GMT Standard Time is used for UK
			// UK transitions: Last Sunday March / Last Sunday October (same as EU)
			// Event: March 20, 2025 at 2 PM GMT (UK not on DST yet)

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:GMT Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0000',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T010000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0000',
				'TZOFFSETTO:+0100',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=GMT Standard Time:20250320T140000',
				'DTEND;TZID=GMT Standard Time:20250320T150000',
				'UID:outlook-gmt-tz-1006',
				'SUMMARY:London meeting during DST gap',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			expect(events).toHaveLength(1);

			const event = events[0];

			// March 20, 2025 - UK not yet on DST (GMT, UTC+0)
			// 2 PM GMT = 14:00 UTC
			expect(event.start).toBe('2025-03-20T14:00:00.000Z');
			expect(event.end).toBe('2025-03-20T15:00:00.000Z');
		});
	});

	describe('Multi-week recurring event across DST transitions', () => {
		it('should maintain correct times for recurring events spanning DST transition', () => {
			// Recurring weekly event starting in March, spanning the European DST transition
			// Event every Thursday at 3 PM local time
			// March 20 (before DST): 3 PM CET = 14:00 UTC
			// March 27 (before DST): 3 PM CET = 14:00 UTC
			// April 3 (after DST): 3 PM CEST = 13:00 UTC

			const icsData = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
				'BEGIN:VTIMEZONE',
				'TZID:W. Europe Standard Time',
				'BEGIN:STANDARD',
				'DTSTART:16011028T030000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
				'TZOFFSETFROM:+0200',
				'TZOFFSETTO:+0100',
				'END:STANDARD',
				'BEGIN:DAYLIGHT',
				'DTSTART:16010325T020000',
				'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
				'TZOFFSETFROM:+0100',
				'TZOFFSETTO:+0200',
				'END:DAYLIGHT',
				'END:VTIMEZONE',
				'BEGIN:VEVENT',
				'DTSTART;TZID=W. Europe Standard Time:20250320T150000',
				'DTEND;TZID=W. Europe Standard Time:20250320T160000',
				'RRULE:FREQ=WEEKLY;BYDAY=TH;COUNT=4',
				'UID:outlook-recurring-dst-1006',
				'SUMMARY:Weekly meeting across DST',
				'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n');

			const events = (service as any).parseICS(icsData, 'outlook-sub');

			// Should have at least the base event
			expect(events.length).toBeGreaterThanOrEqual(1);

			// The first event should be correct
			const firstEvent = events[0];
			// March 20 (CET, UTC+1): 3 PM = 14:00 UTC
			expect(firstEvent.start).toBe('2025-03-20T14:00:00.000Z');

			// Note: How recurring events are expanded depends on the implementation.
			// The key point is that each instance should maintain the correct wall-clock time
			// in the original timezone, which means UTC times will shift when DST changes.
		});
	});
});

describe.skip('Issue #1006 - Potential Playwright E2E Tests', () => {
	/**
	 * These tests would need to be implemented as Playwright E2E tests
	 * to properly verify the visual display of ICS events during DST gap periods.
	 *
	 * Test scenarios:
	 *
	 * 1. Configure Obsidian/TaskNotes to display times in US Eastern timezone
	 * 2. Add an ICS subscription from a European Outlook calendar
	 * 3. Create test events during DST gap periods (March 9-30, October 26-Nov 2)
	 * 4. Verify events display at the correct time accounting for the DST mismatch
	 *
	 * The bug manifests when:
	 * - Europe is on standard time, US is on daylight time (or vice versa)
	 * - Events appear 1 hour off because the offset calculation doesn't account
	 *   for different DST transition dates between regions
	 */

	it.todo('should display European events correctly during spring DST gap (US EDT, Europe CET)');
	it.todo('should display European events correctly during fall DST gap (US EDT, Europe CET)');
	it.todo('should handle recurring events that span DST transitions in calendar view');
	it.todo('should show correct times in event tooltips during DST gap periods');
});
