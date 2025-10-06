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

        // All-day events are now stored as date-only strings (YYYY-MM-DD)
        // to preserve calendar date semantics without timezone ambiguity
        const events: ICSEvent[] = [
            {
                id: 'sub-uid',
                subscriptionId: 'sub',
                title: 'All day test',
                start: '2025-02-20',
                end: '2025-02-21',
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
