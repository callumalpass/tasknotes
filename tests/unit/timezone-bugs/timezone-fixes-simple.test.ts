/**
 * Simple tests to verify that the timezone bug fixes work correctly.
 */

import { parseDateToUTC, formatDateForStorage, isTodayUTC, getDatePart } from '../../../src/utils/dateUtils';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('Timezone Fixes - Simple Verification', () => {
    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('formatDateForStorage is timezone-independent', () => {
        // Test in California timezone
        process.env.TZ = 'America/Los_Angeles';
        
        const targetDate = parseDateToUTC('2024-10-26');
        const result1 = formatDateForStorage(targetDate);
        
        // Test in New York timezone
        process.env.TZ = 'America/New_York';
        const result2 = formatDateForStorage(targetDate);
        
        // Test in UTC
        process.env.TZ = 'UTC';
        const result3 = formatDateForStorage(targetDate);
        
        // All should be the same regardless of timezone
        expect(result1).toBe('2024-10-26');
        expect(result2).toBe('2024-10-26');
        expect(result3).toBe('2024-10-26');
    });

    test('getDatePart preserves original calendar date', () => {
        process.env.TZ = 'America/Los_Angeles';
        
        // Test various datetime formats that might cause timezone issues
        const testCases = [
            '2024-10-26T01:00:00+02:00', // Berlin time
            '2024-10-26T10:00:00-07:00', // Pacific time
            '2024-10-26T05:00:00Z',      // UTC time
            '2024-10-26',               // Date-only
        ];
        
        for (const dateTime of testCases) {
            const result = getDatePart(dateTime);
            expect(result).toBe('2024-10-26');
        }
    });

    test('Date boundary crossing edge case', () => {
        // Hawaii timezone (UTC-10) - most extreme case
        process.env.TZ = 'Pacific/Honolulu';

        // Early UTC time that would be previous day in Hawaii
        const earlyUTCDate = new Date('2024-10-26T05:00:00.000Z');
        
        // Our fixed functions should preserve the UTC calendar date
        const formattedDate = formatDateForStorage(earlyUTCDate);
        const datePart = getDatePart('2024-10-26T05:00:00Z');
        
        expect(formattedDate).toBe('2024-10-26');
        expect(datePart).toBe('2024-10-26');
    });

    test('Task update affected dates scenario', () => {
        process.env.TZ = 'America/Los_Angeles';

        // Simulate task with timezone-sensitive datetime
        const originalTask = {
            due: '2024-10-26T02:00:00+02:00', // Berlin time
            scheduled: '2024-10-27T01:00:00+02:00' // Berlin time next day
        };

        const updatedTask = {
            due: '2024-10-26T14:00:00-07:00', // Pacific time same day
            scheduled: '2024-10-27T10:00:00-07:00' // Pacific time next day
        };

        // Using getDatePart (our fix) should correctly identify affected dates
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

        // Should correctly identify both calendar dates
        expect(affectedDates).toEqual(new Set(['2024-10-26', '2024-10-27']));
    });

    test('FilterService date query scenario', () => {
        process.env.TZ = 'America/Los_Angeles';

        // User clicks on October 26 in the calendar
        const selectedDate = parseDateToUTC('2024-10-26');
        
        // With our fix, FilterService will correctly format for queries
        const queryDate = formatDateForStorage(selectedDate);
        expect(queryDate).toBe('2024-10-26');
        
        // This verifies the fix prevents querying wrong dates
    });

    test('Real-world extreme timezone test', () => {
        // Test in the most extreme timezone (UTC+14)
        process.env.TZ = 'Pacific/Kiritimati';

        const testDate = parseDateToUTC('2024-10-26');
        const formatted = formatDateForStorage(testDate);
        
        // Should still work correctly
        expect(formatted).toBe('2024-10-26');
        
        // Test negative extreme (UTC-12)
        process.env.TZ = 'Etc/GMT+12';
        
        const formatted2 = formatDateForStorage(testDate);
        expect(formatted2).toBe('2024-10-26');
    });
});