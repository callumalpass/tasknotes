/**
 * Tests to reproduce and verify the MiniCalendarView date normalization bug.
 * 
 * BUG: normalizeDateString uses the problematic parseDate function, which can
 * shift datetime strings to wrong calendar days depending on user's timezone.
 */

import { normalizeDateString, getDatePart } from '../../../src/utils/dateUtils';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('MiniCalendarView Date Normalization Bug Reproduction', () => {
    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('should reproduce the normalization bug with European datetime in California', () => {
        // Set timezone to Pacific Time (UTC-7/UTC-8)
        process.env.TZ = 'America/Los_Angeles';

        // Task has a due datetime from Berlin timezone (UTC+2)
        const berlinDateTime = '2024-10-26T01:00:00+02:00'; // 1 AM in Berlin on Oct 26
        
        // BUG: normalizeDateString uses parseDate internally, which converts
        // this to local time and may shift the calendar date
        const normalizedDate = normalizeDateString(berlinDateTime);
        
        console.log('Original Berlin datetime:', berlinDateTime);
        console.log('Normalized date (buggy):', normalizedDate);
        
        // The bug: In Pacific time, this Berlin datetime (Oct 26 1AM) becomes
        // Oct 25 4PM local time, so normalizeDateString might return "2024-10-25"
        // when it should return "2024-10-26" (the original calendar date)
        
        // This test will show the bug exists
        expect(normalizedDate).toBe('2024-10-25'); // BUG: Wrong date due to timezone shift
    });

    test('should reproduce the normalization bug with UTC datetime in Eastern timezone', () => {
        process.env.TZ = 'America/New_York';

        // Task has a due datetime in UTC on the boundary
        const utcDateTime = '2024-10-26T02:00:00Z'; // 2 AM UTC on Oct 26
        
        const normalizedDate = normalizeDateString(utcDateTime);
        
        console.log('Original UTC datetime:', utcDateTime);
        console.log('Normalized date (buggy):', normalizedDate);
        
        // In Eastern time, this becomes Oct 25 10PM/9PM, so the calendar date shifts
        expect(normalizedDate).toBe('2024-10-25'); // BUG: Wrong date
    });

    test('should demonstrate correct behavior with getDatePart', () => {
        process.env.TZ = 'America/Los_Angeles';

        // Same Berlin datetime as before
        const berlinDateTime = '2024-10-26T01:00:00+02:00';
        
        // CORRECT approach: getDatePart extracts YYYY-MM-DD without timezone conversion
        const correctDate = getDatePart(berlinDateTime);
        
        console.log('Original Berlin datetime:', berlinDateTime);
        console.log('Correct date extraction:', correctDate);
        
        // getDatePart should always return the calendar date from the original string
        expect(correctDate).toBe('2024-10-26'); // CORRECT: Preserves original calendar date
    });

    test('should show normalizeDateString works correctly for date-only strings', () => {
        process.env.TZ = 'America/Los_Angeles';

        // Date-only string (no time component)
        const dateOnly = '2024-10-26';
        
        const normalizedDate = normalizeDateString(dateOnly);
        
        console.log('Date-only string:', dateOnly);
        console.log('Normalized date:', normalizedDate);
        
        // For date-only strings, normalizeDateString should work correctly
        expect(normalizedDate).toBe('2024-10-26');
    });

    test('should demonstrate the impact on MiniCalendarView affected dates collection', () => {
        process.env.TZ = 'America/Los_Angeles';

        // Simulate a task update scenario
        const originalTask = {
            due: '2024-10-26T01:00:00+02:00', // Berlin time
            scheduled: '2024-10-27T03:00:00+02:00' // Berlin time next day
        };

        const updatedTask = {
            due: '2024-10-26T10:00:00-07:00', // California time same day
            scheduled: '2024-10-27T15:00:00-07:00' // California time next day
        };

        // BUG: Using normalizeDateString (like MiniCalendarView does)
        const affectedDatesBuggy = new Set<string>();
        
        if (originalTask.due) {
            affectedDatesBuggy.add(normalizeDateString(originalTask.due));
        }
        if (originalTask.scheduled) {
            affectedDatesBuggy.add(normalizeDateString(originalTask.scheduled));
        }
        if (updatedTask.due) {
            affectedDatesBuggy.add(normalizeDateString(updatedTask.due));
        }
        if (updatedTask.scheduled) {
            affectedDatesBuggy.add(normalizeDateString(updatedTask.scheduled));
        }

        console.log('Affected dates (buggy approach):', Array.from(affectedDatesBuggy));
        
        // CORRECT: Using getDatePart
        const affectedDatesCorrect = new Set<string>();
        
        if (originalTask.due) {
            affectedDatesCorrect.add(getDatePart(originalTask.due));
        }
        if (originalTask.scheduled) {
            affectedDatesCorrect.add(getDatePart(originalTask.scheduled));
        }
        if (updatedTask.due) {
            affectedDatesCorrect.add(getDatePart(updatedTask.due));
        }
        if (updatedTask.scheduled) {
            affectedDatesCorrect.add(getDatePart(updatedTask.scheduled));
        }

        console.log('Affected dates (correct approach):', Array.from(affectedDatesCorrect));
        
        // The buggy approach might miss dates or include wrong dates
        // The correct approach should include exactly the calendar dates involved
        expect(affectedDatesCorrect).toEqual(new Set(['2024-10-26', '2024-10-27']));
        
        // The buggy approach will have different results
        expect(affectedDatesBuggy).not.toEqual(affectedDatesCorrect);
    });

    test('should reproduce timezone edge case with date boundary crossing', () => {
        process.env.TZ = 'Pacific/Honolulu'; // UTC-10

        // Datetime that crosses date boundary when converted to local time
        const earlyUTCDateTime = '2024-10-26T05:00:00Z'; // 5 AM UTC on Oct 26
        
        const normalizedDate = normalizeDateString(earlyUTCDateTime);
        const correctDate = getDatePart(earlyUTCDateTime);
        
        console.log('Original UTC datetime:', earlyUTCDateTime);
        console.log('Normalized date (buggy):', normalizedDate);
        console.log('Correct date extraction:', correctDate);
        
        // In Hawaii time (UTC-10), 5 AM UTC becomes 7 PM the previous day
        expect(normalizedDate).toBe('2024-10-25'); // BUG: Wrong date
        expect(correctDate).toBe('2024-10-26'); // CORRECT: Original calendar date
    });
});