/**
 * Tests to verify that the timezone bug fixes work correctly.
 * These tests should pass after the fixes are applied.
 */

import { parseDateToUTC, formatDateForStorage, isTodayUTC, getDatePart } from '../../../src/utils/dateUtils';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('Timezone Fixes Verification', () => {
    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('Fix 1: formatDateForStorage is timezone-independent', () => {
        // Test in multiple timezones
        const testTimezones = ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'];
        
        for (const timezone of testTimezones) {
            process.env.TZ = timezone;
            
            const targetDate = parseDateToUTC('2024-10-26');
            const result = formatDateForStorage(targetDate);
            
            // Should always return the same result regardless of timezone
            expect(result).toBe('2024-10-26');
        }
    });

    test('Fix 2: isTodayUTC works correctly across timezones', () => {
        // Mock today as 2024-10-26 for consistent testing
        const mockTodayDate = new Date(2024, 9, 26); // October 26, 2024
        const mockGetTodayLocal = jest.fn(() => mockTodayDate);
        
        jest.doMock('../../../src/utils/dateUtils', () => ({
            ...jest.requireActual('../../../src/utils/dateUtils'),
            getTodayLocal: mockGetTodayLocal
        }));

        const { isTodayUTC: isTodayUTCMocked } = require('../../../src/utils/dateUtils');

        // Test in multiple timezones
        const testTimezones = ['America/Los_Angeles', 'America/New_York', 'UTC', 'Asia/Tokyo'];
        
        for (const timezone of testTimezones) {
            process.env.TZ = timezone;
            
            const todayUTC = parseDateToUTC('2024-10-26');
            const yesterdayUTC = parseDateToUTC('2024-10-25');
            const tomorrowUTC = parseDateToUTC('2024-10-27');
            
            // Should correctly identify today regardless of timezone
            expect(isTodayUTCMocked(todayUTC)).toBe(true);
            expect(isTodayUTCMocked(yesterdayUTC)).toBe(false);
            expect(isTodayUTCMocked(tomorrowUTC)).toBe(false);
        }

        jest.unmock('../../../src/utils/dateUtils');
    });

    test('Fix 3: getDatePart preserves original calendar date', () => {
        // Test in multiple timezones
        const testTimezones = ['America/Los_Angeles', 'Europe/Berlin', 'Pacific/Honolulu'];
        
        for (const timezone of testTimezones) {
            process.env.TZ = timezone;
            
            // Test various datetime formats
            const testCases = [
                '2024-10-26T01:00:00+02:00', // Berlin time
                '2024-10-26T10:00:00-07:00', // Pacific time
                '2024-10-26T05:00:00Z',      // UTC time
                '2024-10-26',               // Date-only
            ];
            
            for (const dateTime of testCases) {
                const result = getDatePart(dateTime);
                
                // Should always extract the original calendar date
                expect(result).toBe('2024-10-26');
            }
        }
    });

    test('Bug reproduction: Date boundary crossing edge case', () => {
        // Hawaii timezone (UTC-10) - most extreme case
        process.env.TZ = 'Pacific/Honolulu';

        // Early UTC time that crosses date boundary in Hawaii
        const earlyUTCDate = new Date('2024-10-26T05:00:00.000Z');
        
        // Our fixed functions should handle this correctly
        const formattedDate = formatDateForStorage(earlyUTCDate);
        const datePart = getDatePart('2024-10-26T05:00:00Z');
        
        // Both should preserve the original calendar date
        expect(formattedDate).toBe('2024-10-26');
        expect(datePart).toBe('2024-10-26');
        
        // Local time string would show Oct 25 in Hawaii, but our functions
        // correctly preserve the UTC calendar date
        console.log('Local time in Hawaii:', earlyUTCDate.toString());
        console.log('Formatted date (fixed):', formattedDate);
        console.log('Date part (fixed):', datePart);
    });

    test('FilterService scenario: User clicks on calendar date', () => {
        process.env.TZ = 'America/Los_Angeles';

        // User clicks on October 26 in the calendar
        const selectedDate = parseDateToUTC('2024-10-26');
        
        // With our fix, FilterService will correctly query for Oct 26 tasks
        const queryDate = formatDateForStorage(selectedDate);
        expect(queryDate).toBe('2024-10-26');
        
        // Before the fix, it would have queried for Oct 25 in Pacific timezone
        // This test confirms the fix works
    });

    test('AgendaView scenario: Today header detection', () => {
        process.env.TZ = 'America/New_York';

        // Mock today as October 26
        const mockTodayDate = new Date(2024, 9, 26); // October 26, 2024
        const mockGetTodayLocal = jest.fn(() => mockTodayDate);
        
        jest.doMock('../../../src/utils/dateUtils', () => ({
            ...jest.requireActual('../../../src/utils/dateUtils'),
            getTodayLocal: mockGetTodayLocal
        }));

        const { isTodayUTC: isTodayUTCMocked } = require('../../../src/utils/dateUtils');

        // UTC-anchored date for October 26
        const agendaItemDate = parseDateToUTC('2024-10-26');
        
        // With our fix, AgendaView will correctly show "Today" header
        const showTodayHeader = isTodayUTCMocked(agendaItemDate);
        expect(showTodayHeader).toBe(true);
        
        // Before the fix, date-fns isToday() would have returned false
        // in Eastern timezone for a UTC-anchored date
        
        jest.unmock('../../../src/utils/dateUtils');
    });

    test('MiniCalendarView scenario: Task update affected dates', () => {
        process.env.TZ = 'America/Los_Angeles';

        // Simulate task with European datetime
        const originalTask = {
            due: '2024-10-26T02:00:00+02:00', // 2 AM Berlin time
            scheduled: '2024-10-27T01:00:00+02:00' // 1 AM Berlin time next day
        };

        const updatedTask = {
            due: '2024-10-26T14:00:00-07:00', // 2 PM Pacific time same day
            scheduled: '2024-10-27T10:00:00-07:00' // 10 AM Pacific time next day
        };

        // With our fix using getDatePart, we correctly identify affected dates
        const affectedDates = new Set<string>();
        
        if (originalTask.due) {
            affectedDates.add(getDatePart(originalTask.due));
        }
        if (originalTask.scheduled) {
            affectedDates.add(getDatePart(originalTask.scheduled));
        }
        if (updatedTask.due) {
            affectedDates.add(getDatePart(updatedTask.due));
        }
        if (updatedTask.scheduled) {
            affectedDates.add(getDatePart(updatedTask.scheduled));
        }

        // Should correctly identify the calendar dates involved
        expect(affectedDates).toEqual(new Set(['2024-10-26', '2024-10-27']));
        
        // Before the fix, normalizeDateString might have included wrong dates
        // due to timezone conversion, potentially missing calendar updates
    });
});