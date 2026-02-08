import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';

jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn()
}));

describe('Issue #1571 - ICS sync not working with Google Calendar', () => {
	let service: ICSSubscriptionService;

	beforeEach(() => {
		const mockPlugin: any = {
			loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
			saveData: jest.fn().mockResolvedValue(undefined),
			i18n: { translate: jest.fn((key: string) => key) },
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

	// The exact ICS data from the user's report (Google Calendar export)
	const GOOGLE_CALENDAR_ICS = [
		'BEGIN:VCALENDAR',
		'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
		'VERSION:2.0',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-CALNAME:user@gmail.com',
		'X-WR-TIMEZONE:Asia/Kolkata',
		'BEGIN:VEVENT',
		'DTSTART:20250525T160900Z',
		'DTSTAMP:20260208T201319Z',
		'UID:0nmi60tv2vvhndv3ppf0d70@google.com',
		'CREATED:20250525T073705Z',
		'LAST-MODIFIED:20250525T074440Z',
		'SEQUENCE:0',
		'STATUS:CONFIRMED',
		'SUMMARY:restart scripts due to server start',
		'TRANSP:OPAQUE',
		'BEGIN:VALARM',
		'ACTION:DISPLAY',
		'TRIGGER:-P0DT0H15M0S',
		'DESCRIPTION:This is an event reminder',
		'END:VALARM',
		'END:VEVENT',
		'BEGIN:VEVENT',
		'DTSTART;VALUE=DATE:20260210',
		'DTEND;VALUE=DATE:20260211',
		'DTSTAMP:20260208T201319Z',
		'UID:2uu4a0k5rsjr76iol23c07mo3k@google.com',
		'CREATED:20260208T200948Z',
		'LAST-MODIFIED:20260208T200948Z',
		'SEQUENCE:0',
		'STATUS:CONFIRMED',
		'SUMMARY:test199',
		'TRANSP:TRANSPARENT',
		'END:VEVENT',
		'BEGIN:VEVENT',
		'DTSTART;VALUE=DATE:20260210',
		'DTEND;VALUE=DATE:20260211',
		'DTSTAMP:20260208T201319Z',
		'UID:4glrbohm8ah9iu5mjm744iree3@google.com',
		'CREATED:20260208T201303Z',
		'LAST-MODIFIED:20260208T201304Z',
		'SEQUENCE:0',
		'STATUS:CONFIRMED',
		'SUMMARY:etst200',
		'TRANSP:TRANSPARENT',
		'END:VEVENT',
		'BEGIN:VEVENT',
		'DTSTART;VALUE=DATE:20260211',
		'DTEND;VALUE=DATE:20260212',
		'DTSTAMP:20260208T201319Z',
		'UID:4hmhj3nkb52hffruq2pq5cr@google.com',
		'CREATED:20260208T195638Z',
		'LAST-MODIFIED:20260208T195716Z',
		'SEQUENCE:2',
		'STATUS:CONFIRMED',
		'SUMMARY:tset103',
		'TRANSP:TRANSPARENT',
		'END:VEVENT',
		'END:VCALENDAR'
	].join('\r\n');

	test.skip('reproduces issue #1571 - should parse Google Calendar ICS with VALARM', () => {
		const events = (service as any).parseICS(GOOGLE_CALENDAR_ICS, 'sub-1');

		expect(events).toHaveLength(4);
	});

	test.skip('reproduces issue #1571 - should correctly parse timed event with VALARM subcomponent', () => {
		const events = (service as any).parseICS(GOOGLE_CALENDAR_ICS, 'sub-1');

		const timedEvent = events.find((e: any) => e.title === 'restart scripts due to server start');
		expect(timedEvent).toBeDefined();
		expect(timedEvent.allDay).toBe(false);
		expect(timedEvent.start).toContain('2025-05-25');
	});

	test.skip('reproduces issue #1571 - should correctly parse all-day VALUE=DATE events', () => {
		const events = (service as any).parseICS(GOOGLE_CALENDAR_ICS, 'sub-1');

		const allDayEvents = events.filter((e: any) => e.allDay === true);
		expect(allDayEvents).toHaveLength(3);

		const test199 = allDayEvents.find((e: any) => e.title === 'test199');
		expect(test199).toBeDefined();
		expect(test199.start).toBe('2026-02-10');
		expect(test199.end).toBe('2026-02-11');
	});

	test.skip('reproduces issue #1571 - should handle event with no DTEND (only DTSTART)', () => {
		// The first event in the user's ICS has no DTEND — ical.js defaults endDate
		// to startDate in production. The mock returns undefined for end,
		// but the parser should not throw regardless.
		const events = (service as any).parseICS(GOOGLE_CALENDAR_ICS, 'sub-1');

		const timedEvent = events.find((e: any) => e.title === 'restart scripts due to server start');
		expect(timedEvent).toBeDefined();
		expect(timedEvent.allDay).toBe(false);
		expect(timedEvent.start).toContain('2025-05-25');
	});

	test.skip('reproduces issue #1571 - should parse ICS with LF line endings (non-standard)', () => {
		// Google Calendar may serve files with LF-only line endings
		const icsWithLF = GOOGLE_CALENDAR_ICS.replace(/\r\n/g, '\n');
		const events = (service as any).parseICS(icsWithLF, 'sub-1');

		expect(events).toHaveLength(4);
	});

	test.skip('reproduces issue #1571 - should handle X-WR-TIMEZONE without VTIMEZONE', () => {
		// The user's ICS has X-WR-TIMEZONE:Asia/Kolkata but no VTIMEZONE component.
		// This is common for Google Calendar public URL exports.
		// Verify parsing doesn't fail and events have correct times.
		const events = (service as any).parseICS(GOOGLE_CALENDAR_ICS, 'sub-1');

		expect(events.length).toBeGreaterThan(0);
		// The timed event should be in UTC (Z suffix in source)
		const timedEvent = events.find((e: any) => e.allDay === false);
		expect(timedEvent).toBeDefined();
		expect(timedEvent.start).toContain('T');
	});
});
