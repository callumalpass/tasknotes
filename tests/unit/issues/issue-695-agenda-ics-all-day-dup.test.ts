import { AgendaView } from '../../../src/views/AgendaView';
import { ICSEvent } from '../../../src/types';
import { createUTCDateFromLocalCalendarDate } from '../../../src/utils/dateUtils';

describe('Issue #695 - Agenda all-day ICS duplication', () => {
    it('should not surface exclusive-end all-day events on the following day', () => {
        const filterFn = (AgendaView.prototype as any).filterICSEventsForDate as (
            events: ICSEvent[],
            date: Date
        ) => ICSEvent[];

        const localStart = new Date(2025, 1, 20); // Feb 20, 2025
        const localEndExclusive = new Date(2025, 1, 21); // Feb 21, 2025 (exclusive end)

        const events: ICSEvent[] = [
            {
                id: 'sub-uid',
                subscriptionId: 'sub',
                title: 'All day test',
                start: localStart.toISOString(),
                end: localEndExclusive.toISOString(),
                allDay: true,
                description: undefined,
                location: undefined,
                url: undefined
            }
        ];

        const firstDay = createUTCDateFromLocalCalendarDate(localStart);
        const secondDay = createUTCDateFromLocalCalendarDate(localEndExclusive);

        expect(filterFn(events, firstDay)).toHaveLength(1);
        expect(filterFn(events, secondDay)).toHaveLength(0);
    });
});
