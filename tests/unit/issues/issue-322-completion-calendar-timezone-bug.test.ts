/**
 * Issue #322: Completion Calendar Timezone Bug
 * https://github.com/callumalpass/tasknotes/discussions/322
 * 
 * Problem: Weekly Tuesday recurring task shows completion dates on Mondays in North American timezones
 * - Task recurs weekly on Tuesdays
 * - Completion calendar shows dates on Mondays instead (July 28th instead of July 29th)
 * - Issue appears in North America (UTC-5 to UTC-8) but not Australia (UTC+8 to UTC+11)
 */

import { TaskInfo } from '../../../src/types';
import { format } from 'date-fns';
import {
    createUTCDateForRRule,
    formatUTCDateForCalendar,
    generateUTCCalendarDates,
    getUTCStartOfWeek,
    getUTCEndOfWeek,
    getUTCStartOfMonth,
    getUTCEndOfMonth
} from '../../../src/utils/dateUtils';
import { generateRecurringInstances } from '../../../src/utils/helpers';

describe('Issue #322: Completion Calendar Timezone Bug', () => {
    // Mock North American timezone (EST = UTC-5)
    const originalTimezone = process.env.TZ;
    
    beforeAll(() => {
        // Simulate North American Eastern Time
        process.env.TZ = 'America/New_York';
    });
    
    afterAll(() => {
        // Restore original timezone
        process.env.TZ = originalTimezone;
    });

    it('should reproduce the Tuesday→Monday shift bug in North American timezone', () => {
        console.log('=== Reproducing Issue #322: Weekly Tuesday Task Shows on Monday ===');
        
        // Create a weekly Tuesday recurring task (matching the GitHub issue)
        const task: TaskInfo = {
            title: 'Weekly meeting',
            status: 'open',
            priority: 'medium',
            path: '/tasks/weekly-meeting.md',
            archived: false,
            recurrence: 'FREQ=WEEKLY;BYDAY=TU', // Weekly on Tuesday
            complete_instances: [],
            dateCreated: '2025-07-01T00:00:00Z' // Anchor date for recurrence
        };
        
        // Test date: Tuesday, July 29th, 2025 (matching the user's report)
        const testDate = new Date('2025-07-29T10:00:00-04:00'); // 10 AM EDT (North American user context)
        console.log(`Test date (local): ${testDate.toLocaleDateString()} (${format(testDate, 'EEEE')})`);
        console.log(`Test date (ISO): ${testDate.toISOString()}`);
        
        // === Simulate the TaskEditModal completion calendar logic ===
        
        // 1. Get the month boundaries for calendar display
        const monthStart = getUTCStartOfMonth(testDate);
        const monthEnd = getUTCEndOfMonth(testDate);
        
        console.log(`Month boundaries: ${format(monthStart, 'yyyy-MM-dd')} to ${format(monthEnd, 'yyyy-MM-dd')}`);
        
        // 2. Generate recurring instances for this month (with buffer)
        const bufferStart = getUTCStartOfMonth(testDate);
        bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
        const bufferEnd = getUTCEndOfMonth(testDate);
        bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
        
        const recurringDates = generateRecurringInstances(task, bufferStart, bufferEnd);
        const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
        
        console.log('Recurring date instances generated:');
        recurringDates.forEach(date => {
            const dayName = format(date, 'EEEE');
            const dateStr = formatUTCDateForCalendar(date);
            console.log(`  ${dateStr} (${dayName})`);
        });
        
        // 3. Generate calendar grid for the month
        const firstDaySetting = 0; // Sunday = 0 (default)
        const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
        const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
        const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);
        
        console.log('\nCalendar grid days for July 2025:');
        allDays.forEach(day => {
            const dayStr = formatUTCDateForCalendar(day);
            const dayName = format(day, 'EEEE');
            // Check if day is in July 2025
            const isCurrentMonth = dayStr.startsWith('2025-07');
            const isRecurring = recurringDateStrings.has(dayStr);
            
            if (isCurrentMonth) {
                console.log(`  ${dayStr} (${dayName}) ${isRecurring ? '🔄 RECURRING' : ''}`);
            }
        });
        
        // === The Bug Check ===
        
        // Expected: July 29th (Tuesday) should be marked as recurring
        const july29 = '2025-07-29';
        const july28 = '2025-07-28';
        
        const tuesday29IsRecurring = recurringDateStrings.has(july29);
        const monday28IsRecurring = recurringDateStrings.has(july28);
        
        console.log(`\n=== Bug Analysis (Issue #322) ===`);
        console.log(`July 29th (Tuesday) marked as recurring: ${tuesday29IsRecurring}`);
        console.log(`July 28th (Monday) marked as recurring: ${monday28IsRecurring}`);
        
        if (monday28IsRecurring && !tuesday29IsRecurring) {
            console.log('🐛 BUG CONFIRMED: Tuesday task showing on Monday!');
            console.log('   This matches the reported issue #322');
        } else if (tuesday29IsRecurring && !monday28IsRecurring) {
            console.log('✅ WORKING CORRECTLY: Tuesday task showing on Tuesday');
        } else {
            console.log('⚠️  UNEXPECTED: Neither or both dates marked as recurring');
        }
        
        // This assertion should FAIL if the bug exists (Tuesday task showing on Monday)
        // and PASS when the bug is fixed (Tuesday task showing on Tuesday)
        expect(tuesday29IsRecurring).toBe(true); // Tuesday should be recurring
        expect(monday28IsRecurring).toBe(false); // Monday should NOT be recurring
        
        // Additional checks for other July Tuesdays
        const julyTuesdays = ['2025-07-01', '2025-07-08', '2025-07-15', '2025-07-22', '2025-07-29'];
        const julyMondays = ['2025-06-30', '2025-07-07', '2025-07-14', '2025-07-21', '2025-07-28'];
        
        console.log('\n=== Full Month Analysis ===');
        julyTuesdays.forEach((tuesday, index) => {
            const monday = julyMondays[index];
            const tuesdayRecurring = recurringDateStrings.has(tuesday);
            const mondayRecurring = recurringDateStrings.has(monday);
            
            console.log(`${tuesday} (Tue): ${tuesdayRecurring ? '✓' : '✗'} | ${monday} (Mon): ${mondayRecurring ? '✓' : '✗'}`);
            
            // All Tuesdays should be recurring, no Mondays should be
            expect(tuesdayRecurring).toBe(true);
            expect(mondayRecurring).toBe(false);
        });
    });

    it('should handle timezone edge cases correctly', () => {
        // Test with a task that has existing completions
        const task: TaskInfo = {
            title: 'Weekly standup',
            status: 'open', 
            priority: 'high',
            path: '/tasks/standup.md',
            archived: false,
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            complete_instances: ['2025-07-15', '2025-07-22'], // Previous Tuesday completions
            dateCreated: '2025-07-01T00:00:00Z' // Anchor date for recurrence
        };

        const testDate = new Date('2025-07-29T10:00:00-04:00'); // EDT
        
        const bufferStart = getUTCStartOfMonth(testDate);
        bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
        const bufferEnd = getUTCEndOfMonth(testDate);
        bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
        
        const recurringDates = generateRecurringInstances(task, bufferStart, bufferEnd);
        const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
        
        // Check that completed dates are still properly identified as recurring days
        expect(recurringDateStrings.has('2025-07-15')).toBe(true); // Completed Tuesday
        expect(recurringDateStrings.has('2025-07-22')).toBe(true); // Completed Tuesday
        expect(recurringDateStrings.has('2025-07-29')).toBe(true); // Current Tuesday
        
        // Ensure Mondays are NOT marked as recurring
        expect(recurringDateStrings.has('2025-07-14')).toBe(false); // Monday before completed Tuesday
        expect(recurringDateStrings.has('2025-07-21')).toBe(false); // Monday before completed Tuesday
        expect(recurringDateStrings.has('2025-07-28')).toBe(false); // Monday before current Tuesday
    });

    it('should work correctly in Australian timezone for comparison', () => {
        // Temporarily switch to Australian timezone
        const originalTZ = process.env.TZ;
        process.env.TZ = 'Australia/Sydney';
        
        try {
            const task: TaskInfo = {
                title: 'Weekly meeting',
                status: 'open',
                priority: 'medium',
                path: '/tasks/weekly-meeting.md',
                archived: false,
                recurrence: 'FREQ=WEEKLY;BYDAY=TU',
                complete_instances: [],
                dateCreated: '2025-07-01T00:00:00Z' // Anchor date for recurrence
            };
            
            // Same date but in Australian context
            const testDate = new Date('2025-07-29T10:00:00+10:00'); // AEST
            
            const bufferStart = getUTCStartOfMonth(testDate);
            bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
            const bufferEnd = getUTCEndOfMonth(testDate);
            bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
            
            const recurringDates = generateRecurringInstances(task, bufferStart, bufferEnd);
            const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
            
            console.log('Australian timezone test - Recurring dates:');
            recurringDates.forEach(date => {
                console.log(`  ${formatUTCDateForCalendar(date)} (${format(date, 'EEEE')})`);
            });
            
            // In Australian timezone, should still work correctly
            expect(recurringDateStrings.has('2025-07-29')).toBe(true); // Tuesday
            expect(recurringDateStrings.has('2025-07-28')).toBe(false); // Monday
            
        } finally {
            process.env.TZ = originalTZ;
        }
    });
});