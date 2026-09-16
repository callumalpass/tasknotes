import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import type { ICSEvent } from '../../../src/types';

jest.mock('obsidian', () => ({ Notice: jest.fn(), requestUrl: jest.fn(), TFile: jest.fn() }));
jest.mock('ical.js', () => jest.requireActual('../../../node_modules/ical.js/dist/ical.es5.cjs'));

const service = new ICSSubscriptionService({} as any);
const parse = (events: string[], name?: string) => (service as unknown as {
	parseICS(data: string, subscriptionId: string): ICSEvent[];
}).parseICS([
	'BEGIN:VCALENDAR', 'VERSION:2.0',
	...(name ? [`X-WR-CALNAME:${name}`] : []),
	...events, 'END:VCALENDAR',
].join('\r\n'), 'sub');

const guest = 'ATTENDEE;PARTSTAT=DECLINED;X-RESPONSE-COMMENT="Sorry\\; I have a conflict: all day":mailto:guest@example.com';
const owner = (status: string) => `ATTENDEE;PARTSTAT=${status}:mailto:OWNER@example.com`;
const event = (...properties: string[]) => [
	'BEGIN:VEVENT', 'UID:meeting', 'DTSTART:20260914T140000Z', 'DTEND:20260914T180000Z',
	'SUMMARY:Meeting', 'STATUS:CONFIRMED', ...properties, 'END:VEVENT',
];

describe('Issue #2313 - only the calendar owner can decline a meeting for this feed', () => {
	beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-14T00:00:00Z')));
	afterEach(() => jest.restoreAllMocks());

	it.each(['ACCEPTED', 'TENTATIVE', 'NEEDS-ACTION'])(
		'keeps owner-%s meetings despite a guest decline and quoted delimiters', status => {
			expect(parse(event(guest, owner(status)), 'owner@example.com')).toHaveLength(1);
		}
	);

	it.each(['DECLINED', 'declined'])('hides the identified owner-%s meeting', status => {
		expect(parse(event(guest, owner(status)), 'MAILTO:owner@example.com')).toEqual([]);
	});

	it.each([undefined, 'Team Calendar', 'Someone <owner@example.com>'])(
		'does not infer the owner from guests when the calendar name is %s', name => {
			expect(parse(event(guest, owner('DECLINED')), name)).toHaveLength(1);
		}
	);

	it('keeps meetings organized by the owner with no owner attendee', () => {
		expect(parse(event('ORGANIZER:mailto:owner@example.com', guest), 'owner@example.com')).toHaveLength(1);
	});

	it('does not use attendee CN as an owner identity', () => {
		expect(parse(event('ATTENDEE;CN=owner@example.com;PARTSTAT=DECLINED:mailto:guest@example.com'), 'owner@example.com')).toHaveLength(1);
	});

	it('still hides cancelled events regardless of attendee response', () => {
		expect(parse(event(guest, owner('ACCEPTED')).map(line => line === 'STATUS:CONFIRMED' ? 'STATUS:CANCELLED' : line), 'owner@example.com')).toEqual([]);
	});

	it.each([
		['ACCEPTED', 'DECLINED', ['2026-09-21T14:00:00.000Z']],
		['DECLINED', 'ACCEPTED', ['2026-09-14T14:00:00.000Z']],
		['ACCEPTED', undefined, ['2026-09-14T14:00:00.000Z', '2026-09-21T14:00:00.000Z']],
		['DECLINED', undefined, []],
	] as const)('uses owner responses on recurrence overrides (%s -> %s)', (masterStatus, overrideStatus, expected) => {
		const events = parse([
			...event('RRULE:FREQ=WEEKLY;COUNT=2', owner(masterStatus), guest),
			...event('RECURRENCE-ID:20260914T140000Z', guest, ...(overrideStatus ? [owner(overrideStatus)] : [])),
		], 'owner@example.com');
		expect(events.map(e => e.start)).toEqual(expected);
	});
});
