import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';

jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn()
}));

describe('Issue #1542 - Declined events showing up in calendar view', () => {
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

	function buildICS(...vevents: string[]): string {
		return [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Test//Test//EN',
			...vevents,
			'END:VCALENDAR'
		].join('\r\n');
	}

	function makeEvent(uid: string, extra: string[] = []): string[] {
		return [
			'BEGIN:VEVENT',
			`UID:${uid}`,
			'DTSTART:20260301T100000Z',
			'DTEND:20260301T110000Z',
			'SUMMARY:Test Event',
			...extra,
			'END:VEVENT'
		];
	}

	it('should filter out events with STATUS:CANCELLED', () => {
		const ics = buildICS(
			...makeEvent('normal-1'),
			...makeEvent('cancelled-1', ['STATUS:CANCELLED']),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(1);
		expect(events[0].id).toContain('normal-1');
	});

	it('should filter out events with STATUS:CANCELLED (case-insensitive)', () => {
		const ics = buildICS(
			...makeEvent('cancelled-lower', ['STATUS:cancelled']),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(0);
	});

	it('should filter out events where an attendee has PARTSTAT=DECLINED', () => {
		const ics = buildICS(
			...makeEvent('declined-1', [
				'ORGANIZER;CN=Boss:mailto:boss@example.com',
				'ATTENDEE;PARTSTAT=DECLINED;CN=Me:mailto:me@example.com',
			]),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(0);
	});

	it('should keep events where all attendees have PARTSTAT=ACCEPTED', () => {
		const ics = buildICS(
			...makeEvent('accepted-1', [
				'ORGANIZER;CN=Boss:mailto:boss@example.com',
				'ATTENDEE;PARTSTAT=ACCEPTED;CN=Me:mailto:me@example.com',
			]),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(1);
	});

	it('should keep events where attendees have PARTSTAT=TENTATIVE', () => {
		const ics = buildICS(
			...makeEvent('tentative-1', [
				'ATTENDEE;PARTSTAT=TENTATIVE;CN=Me:mailto:me@example.com',
			]),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(1);
	});

	it('should keep events with PARTSTAT=NEEDS-ACTION', () => {
		const ics = buildICS(
			...makeEvent('needs-action-1', [
				'ATTENDEE;PARTSTAT=NEEDS-ACTION;CN=Me:mailto:me@example.com',
			]),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(1);
	});

	it('should keep events with no attendees', () => {
		const ics = buildICS(
			...makeEvent('no-attendees'),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(1);
	});

	it('should keep confirmed events', () => {
		const ics = buildICS(
			...makeEvent('confirmed-1', ['STATUS:CONFIRMED']),
		);

		const events = (service as any).parseICS(ics, 'sub-1');

		expect(events).toHaveLength(1);
	});
});
