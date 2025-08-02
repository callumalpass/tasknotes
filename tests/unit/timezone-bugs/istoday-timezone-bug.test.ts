/**
 * Tests to reproduce and verify the isToday timezone bug.
 * 
 * BUG: date-fns isToday() is used on UTC-anchored dates, causing
 * incorrect "Today" detection for users in non-UTC timezones.
 */

const { isToday } = require('date-fns');
import { parseDateToUTC, getTodayLocal, createUTCDateFromLocalCalendarDate } from '../../../src/utils/dateUtils';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('isToday Timezone Bug Reproduction', () => {
    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('should reproduce the isToday bug in California timezone', () => {
        // Set timezone to Pacific Time (UTC-7/UTC-8)
        process.env.TZ = 'America/Los_Angeles';

        // Simulate the scenario: User's local "today" is October 26, 2024
        // But the calendar shows a UTC-anchored date for October 26
        const localToday = '2024-10-26';
        const utcAnchoredDate = parseDateToUTC(localToday);
        
        // The UTC-anchored date is 2024-10-26T00:00:00.000Z
        expect(utcAnchoredDate.toISOString()).toBe('2024-10-26T00:00:00.000Z');
        
        // BUG: date-fns isToday() interprets this UTC date in the local timezone
        // In Pacific time, 2024-10-26T00:00:00.000Z is actually October 25th at 5PM/4PM
        // So isToday() will return false even though the calendar date is "today"
        const isTodayResult = isToday(utcAnchoredDate);
        
        // This should be true (the calendar date IS today), but the bug makes it false
        console.log('UTC date in Pacific timezone:', utcAnchoredDate.toString());
        console.log('isToday result:', isTodayResult);
        
        // BUG REPRODUCTION: This will be false due to timezone interpretation
        expect(isTodayResult).toBe(false); // This shows the bug exists
    });

    test('should reproduce the isToday bug in Eastern timezone', () => {
        process.env.TZ = 'America/New_York';

        const localToday = '2024-10-26';
        const utcAnchoredDate = parseDateToUTC(localToday);
        
        expect(utcAnchoredDate.toISOString()).toBe('2024-10-26T00:00:00.000Z');
        
        // In Eastern time, 2024-10-26T00:00:00.000Z is October 25th at 8PM/7PM
        const isTodayResult = isToday(utcAnchoredDate);
        
        console.log('UTC date in Eastern timezone:', utcAnchoredDate.toString());
        console.log('isToday result:', isTodayResult);
        
        // BUG: Will be false when it should be true
        expect(isTodayResult).toBe(false);
    });

    test('should work correctly in UTC timezone (control test)', () => {
        process.env.TZ = 'UTC';

        const localToday = '2024-10-26';
        const utcAnchoredDate = parseDateToUTC(localToday);
        
        expect(utcAnchoredDate.toISOString()).toBe('2024-10-26T00:00:00.000Z');
        
        // In UTC, the date-fns isToday() will work correctly
        // because the local timezone IS UTC
        const isTodayResult = isToday(utcAnchoredDate);
        
        console.log('UTC date in UTC timezone:', utcAnchoredDate.toString());
        console.log('isToday result:', isTodayResult);
        
        // This will be true because there's no timezone mismatch
        expect(isTodayResult).toBe(true);
    });

    test('should demonstrate correct behavior with manual date comparison', () => {
        process.env.TZ = 'America/Los_Angeles';

        const targetCalendarDate = '2024-10-26';
        const utcAnchoredDate = parseDateToUTC(targetCalendarDate);
        
        // CORRECT approach: Compare the calendar dates directly
        const todayLocal = getTodayLocal(); // Gets today in YYYY-MM-DD format
        console.log('Today local type:', typeof todayLocal, todayLocal);
        const todayLocalString = typeof todayLocal === 'string' ? todayLocal : todayLocal.toISOString().split('T')[0];
        const isActuallyToday = (targetCalendarDate === todayLocalString);
        
        console.log('Target calendar date:', targetCalendarDate);
        console.log('Today local:', todayLocal);
        console.log('Is actually today:', isActuallyToday);
        
        // This approach works correctly regardless of timezone
        // because it compares the calendar date strings directly
        expect(isActuallyToday).toBe(true);
    });

    test('should demonstrate correct behavior with UTC date comparison', () => {
        process.env.TZ = 'America/Los_Angeles';

        const targetCalendarDate = '2024-10-26';
        const utcAnchoredDate = parseDateToUTC(targetCalendarDate);
        
        // CORRECT approach: Create UTC anchors for both dates and compare
        const todayLocal = getTodayLocal();
        const todayUTCAnchor = parseDateToUTC(todayLocal);
        
        const isCorrectlyToday = (
            utcAnchoredDate.getUTCFullYear() === todayUTCAnchor.getUTCFullYear() &&
            utcAnchoredDate.getUTCMonth() === todayUTCAnchor.getUTCMonth() &&
            utcAnchoredDate.getUTCDate() === todayUTCAnchor.getUTCDate()
        );
        
        console.log('Target UTC anchor:', utcAnchoredDate.toISOString());
        console.log('Today UTC anchor:', todayUTCAnchor.toISOString());
        console.log('Is correctly today:', isCorrectlyToday);
        
        // This approach also works correctly
        expect(isCorrectlyToday).toBe(true);
    });
});