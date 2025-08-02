/**
 * Tests to demonstrate the setUTC anti-pattern bugs in navigation and date calculation.
 * 
 * The anti-pattern: Creating a local Date object and then manipulating its UTC components
 * leads to incorrect date calculations, especially around DST boundaries.
 */

import { calculateDefaultDate } from '../../../src/utils/helpers';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('setUTC Anti-Pattern Bug Reproduction', () => {
    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('Bug in calculateDefaultDate: setUTCDate on local Date object', () => {
        // Test in Pacific timezone during DST transition
        process.env.TZ = 'America/Los_Angeles';

        // Mock a specific date around DST boundary
        const originalDate = global.Date;
        const mockDate = new Date('2025-03-08T10:00:00-08:00'); // Day before DST starts
        
        global.Date = jest.fn(() => mockDate) as any;
        global.Date.UTC = originalDate.UTC;
        global.Date.parse = originalDate.parse;
        global.Date.now = () => mockDate.getTime();

        try {
            console.log('Mocked "today":', mockDate.toString());
            console.log('Mocked "today" UTC:', mockDate.toISOString());

            // Test calculateDefaultDate for 'tomorrow'
            const tomorrow = calculateDefaultDate('tomorrow');
            console.log('calculateDefaultDate("tomorrow"):', tomorrow);

            // The bug: calculateDefaultDate creates a local Date (mockDate)
            // then calls setUTCDate(today.getUTCDate() + 1)
            // This manipulates the UTC representation of a local time, 
            // which can cause unexpected date jumps

            // Let's manually reproduce the buggy logic
            const today = new Date(mockDate);
            const buggyTomorrow = new Date(today);
            console.log('Before setUTCDate:', buggyTomorrow.toString());
            console.log('today.getUTCDate():', today.getUTCDate());
            
            buggyTomorrow.setUTCDate(today.getUTCDate() + 1);
            console.log('After setUTCDate:', buggyTomorrow.toString());
            console.log('Buggy tomorrow UTC:', buggyTomorrow.toISOString());

            // Show what the correct approach would be
            const correctTomorrow = new Date(today);
            correctTomorrow.setDate(today.getDate() + 1); // Use local date methods
            console.log('Correct tomorrow:', correctTomorrow.toString());

        } finally {
            global.Date = originalDate;
        }
    });

    test('Bug in MiniCalendarView navigation: setUTCMonth on selectedDate', () => {
        process.env.TZ = 'America/Los_Angeles';

        // Simulate a selected date that's at a timezone boundary
        const selectedDate = new Date('2025-03-31T23:00:00-07:00'); // March 31, 11 PM PDT
        
        console.log('Original selected date:', selectedDate.toString());
        console.log('Original selected date UTC:', selectedDate.toISOString());

        // Simulate the buggy navigation logic from MiniCalendarView
        const date = new Date(selectedDate);
        console.log('Before setUTCMonth:', date.toString());
        console.log('date.getUTCMonth():', date.getUTCMonth());
        
        // This is the anti-pattern: manipulating UTC components of a local Date
        date.setUTCMonth(date.getUTCMonth() - 1);
        
        console.log('After setUTCMonth (buggy):', date.toString());
        console.log('Buggy result UTC:', date.toISOString());

        // Show what the correct approach would be
        const correctDate = new Date(selectedDate);
        correctDate.setMonth(correctDate.getMonth() - 1); // Use local month methods
        console.log('Correct result:', correctDate.toString());

        // The issue: setUTCMonth can cause unexpected jumps when the local
        // and UTC representations are in different months due to timezone offset
    });

    test('Demonstrate potential month skipping bug', () => {
        process.env.TZ = 'Pacific/Honolulu'; // UTC-10, extreme offset

        // Date that's in a different month in UTC vs local time
        const localDate = new Date('2025-03-01T02:00:00-10:00'); // 2 AM Hawaii time, March 1
        
        console.log('Local date:', localDate.toString());
        console.log('UTC representation:', localDate.toISOString()); // This is March 1 at 12:00 UTC
        console.log('Local month:', localDate.getMonth()); // March = 2
        console.log('UTC month:', localDate.getUTCMonth()); // March = 2

        // Navigate to "previous month" using the anti-pattern
        const buggyPrevious = new Date(localDate);
        buggyPrevious.setUTCMonth(buggyPrevious.getUTCMonth() - 1);
        
        console.log('Buggy previous month:', buggyPrevious.toString());
        
        // Navigate to "previous month" using correct approach
        const correctPrevious = new Date(localDate);
        correctPrevious.setMonth(correctPrevious.getMonth() - 1);
        
        console.log('Correct previous month:', correctPrevious.toString());

        // In this case, both approaches might work the same, but the anti-pattern
        // is fragile and can break with different date/timezone combinations
    });

    test('Edge case: DST transition boundary', () => {
        process.env.TZ = 'America/New_York';

        // Date right at DST transition (Spring forward: 2:00 AM becomes 3:00 AM)
        const dstTransitionDate = new Date('2025-03-09T01:30:00-05:00'); // 1:30 AM EST
        
        console.log('DST transition date:', dstTransitionDate.toString());
        console.log('DST transition UTC:', dstTransitionDate.toISOString());

        // Test date arithmetic around DST boundaries
        const nextDay = new Date(dstTransitionDate);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        
        console.log('Next day (setUTCDate):', nextDay.toString());

        const correctNextDay = new Date(dstTransitionDate);
        correctNextDay.setDate(correctNextDay.getDate() + 1);
        
        console.log('Next day (setDate):', correctNextDay.toString());

        // Around DST transitions, UTC-based arithmetic can skip hours
        // that don't exist (2:00-3:00 AM) or repeat hours that exist twice
    });

    test('Show the fix for calculateDefaultDate', () => {
        process.env.TZ = 'America/Los_Angeles';

        const today = new Date();
        
        // Current buggy approach (similar to calculateDefaultDate)
        const buggyTomorrow = new Date(today);
        buggyTomorrow.setUTCDate(today.getUTCDate() + 1);
        
        // Correct approach using local date methods
        const correctTomorrow = new Date(today);
        correctTomorrow.setDate(today.getDate() + 1);
        
        // Even better: use date-fns for robust date arithmetic
        const { addDays } = require('date-fns');
        const bestTomorrow = addDays(today, 1);
        
        console.log('Buggy tomorrow:', buggyTomorrow.toString());
        console.log('Correct tomorrow:', correctTomorrow.toString());
        console.log('Best tomorrow (date-fns):', bestTomorrow.toString());

        // For most cases these will be the same, but the UTC approach is fragile
    });
});