/**
 * Test designed to FAIL when Issue #322 bug is present
 * 
 * This test simulates the exact conditions that cause Tuesday recurring tasks 
 * to show on Monday dates in the completion calendar for North American users.
 * 
 * The test should FAIL when the bug exists and PASS when fixed.
 */

import { generateRecurringInstances } from '../../../src/utils/helpers';
import { formatUTCDateForCalendar, createUTCDateForRRule, getUTCStartOfMonth, getUTCEndOfMonth } from '../../../src/utils/dateUtils';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';

// Mock the environment to simulate North American conditions that trigger the bug
const originalTimezone = process.env.TZ;

describe('Issue #322: Failing reproduction test', () => {
    beforeAll(() => {
        // Set timezone to Eastern Time (where the bug is most likely to manifest)
        process.env.TZ = 'America/New_York';
    });

    afterAll(() => {
        // Restore original timezone
        if (originalTimezone) {
            process.env.TZ = originalTimezone;
        } else {
            delete process.env.TZ;
        }
    });

    it('should FAIL when bug is present: Tuesday task generates Monday completion dates', () => {
        console.log('=== DESIGNED TO FAIL WHEN BUG IS PRESENT ===');
        
        // Create a Tuesday recurring task (exactly as user reported)
        const tuesdayTask: TaskInfo = TaskFactory.createTask({
            id: 'tuesday-bug-test',
            title: 'Weekly Tuesday Task - Bug Test',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            scheduled: '2024-07-30', // Known Tuesday from bug report
            dateCreated: '2024-07-30T00:00:00Z',
            complete_instances: []
        });

        // Simulate the exact month from the bug report (July 2024)
        const displayDate = new Date('2024-07-29T00:00:00.000Z'); // The date mentioned in bug report
        
        // Create date range exactly like TaskEditModal does
        const bufferStart = getUTCStartOfMonth(displayDate);
        bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
        const bufferEnd = getUTCEndOfMonth(displayDate);
        bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
        
        console.log('Testing with Eastern Time (UTC-4/UTC-5)');
        console.log('Display date:', displayDate.toISOString());
        console.log('Task scheduled for:', tuesdayTask.scheduled);

        // Generate recurring instances (this is where the bug would occur)
        const recurringDates = generateRecurringInstances(tuesdayTask, bufferStart, bufferEnd);
        const recurringDateStrings = recurringDates.map(d => formatUTCDateForCalendar(d));
        
        console.log('Generated recurring dates:');
        recurringDates.forEach((date, index) => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            const dateStr = formatUTCDateForCalendar(date);
            console.log(`  ${dateStr} (${dayName}) - Day of week: ${date.getUTCDay()}`);
        });
        
        // The specific dates mentioned in the GitHub issue
        const july29Monday = '2024-07-29'; // Monday (what user sees - BUG)
        const july30Tuesday = '2024-07-30'; // Tuesday (what should be shown - CORRECT)
        
        const hasJuly29 = recurringDateStrings.includes(july29Monday);
        const hasJuly30 = recurringDateStrings.includes(july30Tuesday);
        
        console.log('\\nBug detection:');
        console.log(`July 29 (Monday) present: ${hasJuly29} ${hasJuly29 ? '← BUG!' : ''}`);
        console.log(`July 30 (Tuesday) present: ${hasJuly30} ${hasJuly30 ? '← CORRECT' : ''}`);
        
        // Check all dates are actually Tuesdays (day 2)
        const nonTuesdayDates = recurringDates.filter(date => date.getUTCDay() !== 2);
        
        if (nonTuesdayDates.length > 0) {
            console.log('🐛 BUG CONFIRMED: Non-Tuesday dates found:');
            nonTuesdayDates.forEach(date => {
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
                const dateStr = formatUTCDateForCalendar(date);
                console.log(`   ${dateStr} is a ${dayName} (should be Tuesday)`);
            });
            
            // This assertion should FAIL when the bug is present
            expect(nonTuesdayDates.length).toBe(0);
        }
        
        // Primary bug detection: all recurring dates must be Tuesdays
        // This test FAILS when bug is present (non-Tuesday dates generated)
        // This test PASSES when bug is fixed (only Tuesday dates generated)
        expect(recurringDates.every(date => date.getUTCDay() === 2)).toBe(true);
        
        console.log(nonTuesdayDates.length === 0 ? 
            '✅ Test PASSED: Bug appears to be fixed' : 
            '❌ Test FAILED: Bug is present');
    });

    it('should FAIL when timezone handling causes date shift', () => {
        console.log('\\n=== Testing timezone-specific date generation ===');
        
        // Create task with a time that could cross date boundaries
        const tuesdayTask: TaskInfo = TaskFactory.createTask({
            id: 'timezone-shift-test',
            title: 'Timezone Shift Test',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            scheduled: '2024-07-30T23:00:00-04:00', // Late Tuesday evening EST
            dateCreated: '2024-07-30T23:00:00-04:00',
            complete_instances: []
        });

        // Test around the problematic date
        const testStart = new Date('2024-07-28T00:00:00.000Z'); // Sunday
        const testEnd = new Date('2024-08-03T23:59:59.999Z'); // Saturday
        
        const recurringDates = generateRecurringInstances(tuesdayTask, testStart, testEnd);
        
        console.log('Scheduled time with timezone:', tuesdayTask.scheduled);
        console.log('Generated dates:');
        recurringDates.forEach(date => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            const dateStr = formatUTCDateForCalendar(date);
            console.log(`  ${dateStr} (${dayName}) - UTC day: ${date.getUTCDay()}`);
        });
        
        // Check if any dates are Monday instead of Tuesday (the bug)
        const mondayDates = recurringDates.filter(date => date.getUTCDay() === 1); // Monday = 1
        const tuesdayDates = recurringDates.filter(date => date.getUTCDay() === 2); // Tuesday = 2
        
        if (mondayDates.length > 0) {
            console.log('🐛 TIMEZONE BUG: Tuesday task generating Monday dates!');
            mondayDates.forEach(date => {
                console.log(`   ${formatUTCDateForCalendar(date)} is Monday (should be Tuesday)`);
            });
        }
        
        // This should fail if the bug causes Tuesday tasks to generate Monday dates
        expect(mondayDates.length).toBe(0);
        expect(tuesdayDates.length).toBeGreaterThan(0);
    });

    it('should fail if RRule dtstart timezone handling is broken', () => {
        console.log('\\n=== Testing RRule dtstart timezone handling ===');
        
        // Test with different timezone specifications in the scheduled date
        const testCases = [
            {
                name: 'Local EST time',
                scheduled: '2024-07-30T20:00:00-04:00', // 8 PM EST = Midnight UTC Wednesday
                expected: 'Tuesday'
            },
            {
                name: 'UTC time',
                scheduled: '2024-07-30T00:00:00Z', // Midnight UTC Tuesday
                expected: 'Tuesday'
            },
            {
                name: 'Date only',
                scheduled: '2024-07-30', // Date without time
                expected: 'Tuesday'
            }
        ];

        testCases.forEach(testCase => {
            console.log(`\\nTesting: ${testCase.name}`);
            console.log(`Scheduled: ${testCase.scheduled}`);
            
            const task: TaskInfo = TaskFactory.createTask({
                id: `rrule-test-${testCase.name}`,
                title: `RRule Test - ${testCase.name}`,
                recurrence: 'FREQ=WEEKLY;BYDAY=TU',
                scheduled: testCase.scheduled,
                dateCreated: testCase.scheduled,
                complete_instances: []
            });

            // Test the week containing the scheduled date
            const recurringDates = generateRecurringInstances(
                task, 
                new Date('2024-07-28T00:00:00.000Z'), // Sunday
                new Date('2024-08-03T23:59:59.999Z')  // Saturday
            );
            
            recurringDates.forEach(date => {
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
                const dateStr = formatUTCDateForCalendar(date);
                console.log(`  Generated: ${dateStr} (${dayName})`);
                
                // Each generated date should be a Tuesday
                if (date.getUTCDay() !== 2) {
                    console.log(`  🐛 ERROR: Expected Tuesday, got ${dayName}`);
                }
            });
            
            // This will fail if timezone handling breaks day-of-week calculation
            const wrongDayDates = recurringDates.filter(date => date.getUTCDay() !== 2);
            expect(wrongDayDates.length).toBe(0);
        });
    });
});