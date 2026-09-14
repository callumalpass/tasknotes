import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import type { ICSEvent } from '../../../src/types';

jest.mock('obsidian', () => ({ Notice: jest.fn(), requestUrl: jest.fn(), TFile: jest.fn() }));
jest.mock('ical.js', () => jest.requireActual('../../../node_modules/ical.js/dist/ical.es5.cjs'));

describe('Issue #2314 - ICS recurrence overrides', () => {
	const service = new ICSSubscriptionService({} as any);
	const parse = (lines: string[]) => (service as unknown as {
		parseICS(data: string, subscriptionId: string): ICSEvent[];
	}).parseICS(['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR'].join('\r\n'), 'sub');

	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-10T00:00:00Z').getTime());
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([
		['UTC', ':20260910T173000Z', ':20260909T173000Z', ':20260909T183000Z', '2026-09-09T17:30:00.000Z'],
		['IANA', ';TZID=America/New_York:20260910T133000', ';TZID=America/New_York:20260909T133000', ';TZID=America/New_York:20260909T143000', '2026-09-09T17:30:00.000Z'],
		['Windows', ';TZID=Eastern Standard Time:20260910T133000', ';TZID=Eastern Standard Time:20260909T133000', ';TZID=Eastern Standard Time:20260909T143000', '2026-09-09T17:30:00.000Z'],
		['all-day', ';VALUE=DATE:20260910', ';VALUE=DATE:20260909', ';VALUE=DATE:20260910', '2026-09-09'],
	])('replaces the original slot for %s dates', (_label, original, moved, end, expected) => {
		const events = parse([
			'BEGIN:VEVENT', 'UID:series', `DTSTART${original}`, 'RRULE:FREQ=WEEKLY;COUNT=2', 'SUMMARY:Original', 'END:VEVENT',
			'BEGIN:VEVENT', 'UID:series', `RECURRENCE-ID${original}`, `DTSTART${moved}`, `DTEND${end}`, 'SUMMARY:Moved', 'LOCATION:New room', 'END:VEVENT',
		]);
		expect(events).toHaveLength(2);
		expect(events.filter(e => e.title === 'Moved')).toHaveLength(1);
		expect(events[0]).toMatchObject({ start: expected, title: 'Moved', location: 'New room', recurringEventId: 'sub-series' });
		expect(events[1].title).toBe('Original');
	});

	it.each(['CANCELLED', 'cancelled'])('suppresses %s overrides even without DTSTART', (status) => {
		const events = parse([
			'BEGIN:VEVENT', 'UID:series', 'DTSTART:20260910T173000Z', 'RRULE:FREQ=WEEKLY;COUNT=2', 'SUMMARY:Original', 'END:VEVENT',
			'BEGIN:VEVENT', 'UID:series', 'RECURRENCE-ID:20260910T173000Z', `STATUS:${status}`, 'END:VEVENT',
		]);
		expect(events.map(e => e.start)).toEqual(['2026-09-17T17:30:00.000Z']);
	});

	it('does not emit a cancelled override with a moved DTSTART', () => {
		const events = parse([
			'BEGIN:VEVENT', 'UID:series', 'DTSTART:20260910T173000Z', 'RRULE:FREQ=WEEKLY;COUNT=1', 'END:VEVENT',
			'BEGIN:VEVENT', 'UID:series', 'RECURRENCE-ID:20260910T173000Z', 'DTSTART:20260909T173000Z', 'STATUS:CANCELLED', 'END:VEVENT',
		]);
		expect(events).toEqual([]);
	});

	it('matches by UID regardless of component order and preserves other series and EXDATE', () => {
		const events = parse([
			'BEGIN:VEVENT', 'UID:series', 'RECURRENCE-ID:20260910T173000Z', 'DTSTART:20260909T173000Z', 'SUMMARY:Moved', 'END:VEVENT',
			'BEGIN:VEVENT', 'UID:series', 'DTSTART:20260910T173000Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'EXDATE:20260917T173000Z', 'END:VEVENT',
			'BEGIN:VEVENT', 'UID:other', 'DTSTART:20260910T173000Z', 'RRULE:FREQ=WEEKLY;COUNT=1', 'SUMMARY:Unrelated', 'END:VEVENT',
		]);
		expect(events).toHaveLength(3);
		expect(events.map(e => e.start)).toEqual(['2026-09-09T17:30:00.000Z', '2026-09-24T17:30:00.000Z', '2026-09-10T17:30:00.000Z']);
		expect(events[2].title).toBe('Unrelated');
	});
});
