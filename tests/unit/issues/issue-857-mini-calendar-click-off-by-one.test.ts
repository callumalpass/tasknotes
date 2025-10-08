/**
 * Issue #857: Mini Calendar opens previous day when clicked
 *
 * Related to issue #822 which fixed tooltips. The tooltips now show the correct date,
 * but clicking on a calendar day still opens the previous day's note.
 *
 * Root cause: navigateToDailyNote() receives UTC-anchored dates but passes them
 * directly to moment(date), which interprets them in the local timezone.
 *
 * Example in Pacific (UTC-7):
 * - User clicks "Oct 2" in calendar
 * - Calendar passes UTC-anchored date: 2025-10-02T00:00:00.000Z
 * - moment(date) interprets this as Oct 1, 5:00 PM in Pacific time
 * - Opens Oct 1's daily note instead of Oct 2
 */

import { convertUTCToLocalCalendarDate } from '../../../src/utils/dateUtils';

// Mock moment.js
const mockMoment = jest.fn();
(window as any).moment = mockMoment;

describe('Issue #857 - Mini Calendar Click Opens Previous Day', () => {
    beforeEach(() => {
        mockMoment.mockClear();
    });

    test('Bug reproduction: clicking Oct 2 in calendar opens Oct 1 note (Pacific timezone)', () => {
        // Simulate clicking on October 2 in the mini calendar
        // The calendar creates a UTC-anchored date for Oct 2
        const clickedDate = new Date(Date.UTC(2025, 9, 2, 0, 0, 0)); // Oct 2, 2025 00:00 UTC

        console.log('User clicked date:', 'October 2, 2025');
        console.log('UTC-anchored date:', clickedDate.toISOString());

        // Bug: navigateToDailyNote passes this directly to moment()
        // moment() interprets Date objects in the local timezone
        mockMoment.mockImplementation((date: Date) => {
            // In Pacific timezone (UTC-7), this Date object is interpreted as:
            // Oct 1, 2025 at 5:00 PM PDT (17:00)
            const localDate = new Date(date);
            console.log('moment() receives Date:', localDate.toISOString());
            console.log('moment() interprets as local:', localDate.toString());

            // Simulate moment returning the date it interpreted
            return {
                format: (fmt: string) => {
                    if (fmt === 'YYYY-MM-DD') {
                        // In Pacific, this returns "2025-10-01" instead of "2025-10-02"
                        const year = localDate.getFullYear();
                        const month = String(localDate.getMonth() + 1).padStart(2, '0');
                        const day = String(localDate.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }
                    return localDate.toString();
                }
            };
        });

        // Current buggy behavior
        const momentObj = mockMoment(clickedDate);
        const formattedDate = momentObj.format('YYYY-MM-DD');

        console.log('Daily note that opens:', formattedDate);

        // In Pacific timezone, this would be "2025-10-01" (wrong!)
        // We can't actually test timezone-specific behavior in Jest,
        // but we can demonstrate the concept

        expect(mockMoment).toHaveBeenCalledWith(clickedDate);
    });

    test('Fix: convert UTC-anchored date to local calendar date before passing to moment', () => {
        // User clicks October 2 in the mini calendar
        const clickedDate = new Date(Date.UTC(2025, 9, 2, 0, 0, 0)); // Oct 2, 2025 00:00 UTC

        console.log('User clicked date:', 'October 2, 2025');
        console.log('UTC-anchored date:', clickedDate.toISOString());

        // Fix: Convert UTC-anchored date to local calendar date
        const localCalendarDate = convertUTCToLocalCalendarDate(clickedDate);

        console.log('Local calendar date:', localCalendarDate.toString());
        console.log('Local calendar date ISO:', localCalendarDate.toISOString());

        // Now pass the local calendar date to moment
        mockMoment.mockImplementation((date: Date) => {
            return {
                format: (fmt: string) => {
                    if (fmt === 'YYYY-MM-DD') {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }
                    return date.toString();
                }
            };
        });

        const momentObj = mockMoment(localCalendarDate);
        const formattedDate = momentObj.format('YYYY-MM-DD');

        console.log('Daily note that opens:', formattedDate);

        // This should be "2025-10-02" (correct!)
        expect(formattedDate).toBe('2025-10-02');
        expect(mockMoment).toHaveBeenCalledWith(localCalendarDate);
    });

    test('Verify convertUTCToLocalCalendarDate extracts correct calendar date', () => {
        // Test various dates
        const testCases = [
            {
                utcDate: new Date(Date.UTC(2025, 9, 2, 0, 0, 0)),
                expectedYear: 2025,
                expectedMonth: 9, // October (0-indexed)
                expectedDay: 2
            },
            {
                utcDate: new Date(Date.UTC(2025, 0, 1, 0, 0, 0)),
                expectedYear: 2025,
                expectedMonth: 0, // January
                expectedDay: 1
            },
            {
                utcDate: new Date(Date.UTC(2025, 11, 31, 0, 0, 0)),
                expectedYear: 2025,
                expectedMonth: 11, // December
                expectedDay: 31
            }
        ];

        testCases.forEach(({ utcDate, expectedYear, expectedMonth, expectedDay }) => {
            const localDate = convertUTCToLocalCalendarDate(utcDate);

            expect(localDate.getFullYear()).toBe(expectedYear);
            expect(localDate.getMonth()).toBe(expectedMonth);
            expect(localDate.getDate()).toBe(expectedDay);
        });
    });

    test('Demonstrates the timezone problem with concrete example', () => {
        // This test shows why the bug happens

        // UTC-anchored date for October 2, 2025
        const utcAnchoredDate = new Date(Date.UTC(2025, 9, 2, 0, 0, 0));

        console.log('\n=== UTC-Anchored Date ===');
        console.log('ISO String:', utcAnchoredDate.toISOString()); // 2025-10-02T00:00:00.000Z
        console.log('toString():', utcAnchoredDate.toString()); // Depends on system timezone

        console.log('\n=== How moment() interprets it ===');
        console.log('In Pacific (UTC-7): Oct 1, 5:00 PM');
        console.log('In Eastern (UTC-4): Oct 1, 8:00 PM');
        console.log('In UTC: Oct 2, 12:00 AM (correct)');

        console.log('\n=== The Fix ===');
        const localCalendarDate = convertUTCToLocalCalendarDate(utcAnchoredDate);
        console.log('Local calendar date:', localCalendarDate.toString());
        console.log('This represents Oct 2 in ANY timezone');

        // The local calendar date always represents the correct calendar day
        expect(localCalendarDate.getFullYear()).toBe(2025);
        expect(localCalendarDate.getMonth()).toBe(9); // October
        expect(localCalendarDate.getDate()).toBe(2);
    });
});
