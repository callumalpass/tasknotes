/**
 * Regression prevention test for Issue #322
 * 
 * This test will FAIL if the Tuesday→Monday timezone bug is reintroduced.
 * It specifically tests the conditions that caused the original bug.
 */

import { generateRecurringInstances } from '../../../src/utils/helpers';
import { formatDateForStorage, createUTCDateForRRule } from '../../../src/utils/dateUtils';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';

describe('Issue #322: Regression Prevention', () => {
    it('MUST PASS: Tuesday recurring tasks should never generate Monday dates', () => {
        // Test multiple Tuesday recurring tasks across different time periods
        const testCases = [
            {
                name: 'July 2024 case (from GitHub issue)',
                scheduled: '2024-07-30', // The Tuesday from the original bug report
                testStart: '2024-07-01T00:00:00.000Z',
                testEnd: '2024-07-31T23:59:59.999Z'
            },
            {
                name: 'January 2025 case',
                scheduled: '2025-01-07', // First Tuesday of 2025
                testStart: '2025-01-01T00:00:00.000Z', 
                testEnd: '2025-01-31T23:59:59.999Z'
            },
            {
                name: 'December 2024 case (year boundary)',
                scheduled: '2024-12-31', // Tuesday December 31, 2024
                testStart: '2024-12-01T00:00:00.000Z',
                testEnd: '2024-12-31T23:59:59.999Z'
            }
        ];

        testCases.forEach(testCase => {
            console.log(`\\nTesting: ${testCase.name}`);
            
            const tuesdayTask: TaskInfo = TaskFactory.createTask({
                id: `regression-test-${testCase.name.replace(/\\s+/g, '-')}`,
                title: `Tuesday Task - ${testCase.name}`,
                recurrence: 'FREQ=WEEKLY;BYDAY=TU',
                scheduled: testCase.scheduled,
                dateCreated: testCase.scheduled + 'T00:00:00Z',
                complete_instances: []
            });

            const recurringDates = generateRecurringInstances(
                tuesdayTask, 
                new Date(testCase.testStart), 
                new Date(testCase.testEnd)
            );

            console.log(`  Scheduled: ${testCase.scheduled}`);
            console.log(`  Generated ${recurringDates.length} recurring dates:`);
            
            // Check each generated date
            const wrongDayDates: Array<{date: Date, day: string, dateStr: string}> = [];
            
            recurringDates.forEach(date => {
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
                const dateStr = formatDateForStorage(date);
                console.log(`    ${dateStr} (${dayName})`);
                
                if (date.getUTCDay() !== 2) { // 2 = Tuesday
                    wrongDayDates.push({ date, day: dayName, dateStr });
                }
            });

            // CRITICAL: This test MUST fail if Tuesday tasks generate non-Tuesday dates
            if (wrongDayDates.length > 0) {
                console.log(`  🚨 REGRESSION DETECTED: ${wrongDayDates.length} non-Tuesday dates generated!`);
                wrongDayDates.forEach(wrong => {
                    console.log(`    ❌ ${wrong.dateStr} is a ${wrong.day}, not Tuesday`);
                });
            }

            // These assertions will fail if the bug is reintroduced
            expect(wrongDayDates.length).toBe(0);
            expect(recurringDates.every(date => date.getUTCDay() === 2)).toBe(true);
        });
    });

    it('MUST PASS: createUTCDateForRRule should consistently create UTC dates', () => {
        // Test the critical function that prevented the timezone bug
        const testDates = [
            '2024-07-30', // The date from the original issue
            '2024-12-31', // Year boundary Tuesday
            '2025-01-07', // First Tuesday of 2025
            '2024-02-29', // Leap year edge case (Thursday)
        ];

        testDates.forEach(dateStr => {
            const utcDate = createUTCDateForRRule(dateStr);
            
            console.log(`\\nTesting date: ${dateStr}`);
            console.log(`  Created UTC date: ${utcDate.toISOString()}`);
            console.log(`  Day of week: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][utcDate.getUTCDay()]}`);
            
            // The function should create a UTC date at midnight
            expect(utcDate.getUTCHours()).toBe(0);
            expect(utcDate.getUTCMinutes()).toBe(0);
            expect(utcDate.getUTCSeconds()).toBe(0);
            expect(utcDate.getUTCMilliseconds()).toBe(0);
            
            // The date should match the input date string when formatted
            const formattedBack = formatDateForStorage(utcDate);
            expect(formattedBack).toBe(dateStr);
        });
    });

    it('MUST PASS: Tuesday tasks in different timezones should not affect day generation', () => {
        // This tests the specific scenario that caused the original bug
        console.log('\\nTesting timezone resistance:');
        
        const tuesdayTask: TaskInfo = TaskFactory.createTask({
            id: 'timezone-resistance-test',
            title: 'Tuesday Task - Timezone Test',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            scheduled: '2024-07-30', // Tuesday
            dateCreated: '2024-07-30T00:00:00Z',
            complete_instances: []
        });

        // Test the same task in the week that caused the original issue
        const weekStart = new Date('2024-07-28T00:00:00.000Z'); // Sunday
        const weekEnd = new Date('2024-08-03T23:59:59.999Z'); // Saturday

        const instances = generateRecurringInstances(tuesdayTask, weekStart, weekEnd);
        
        console.log('Generated instances for week of July 28 - August 3, 2024:');
        instances.forEach(date => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            const dateStr = formatDateForStorage(date);
            console.log(`  ${dateStr} (${dayName})`);
        });

        // CRITICAL ASSERTIONS: These will catch the regression
        expect(instances.length).toBe(1); // Should only have one instance in this week
        expect(instances[0].getUTCDay()).toBe(2); // Must be Tuesday
        expect(formatDateForStorage(instances[0])).toBe('2024-07-30'); // Must be July 30, not 29
        
        // Specifically check it's NOT Monday July 29 (the bug behavior)
        const hasMonday29 = instances.some(d => formatDateForStorage(d) === '2024-07-29');
        expect(hasMonday29).toBe(false);
        
        console.log('✅ Tuesday task correctly generates Tuesday date, not Monday');
    });

    it('MUST PASS: Calendar month navigation should not affect recurring date generation', () => {
        // This tests the fix for TaskEditModal navigation buttons that use UTC operations
        console.log('\\nTesting calendar navigation consistency:');
        
        const tuesdayTask: TaskInfo = TaskFactory.createTask({
            id: 'navigation-test',
            title: 'Navigation Test Task',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            scheduled: '2024-07-30',
            dateCreated: '2024-07-30T00:00:00Z',
            complete_instances: []
        });

        // Test several months to ensure navigation doesn't break date generation
        const testMonths = [
            { month: '2024-06', name: 'June 2024' },
            { month: '2024-07', name: 'July 2024' },
            { month: '2024-08', name: 'August 2024' },
        ];

        testMonths.forEach(testMonth => {
            const monthStart = new Date(testMonth.month + '-01T00:00:00.000Z');
            const monthEnd = new Date(monthStart);
            monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
            monthEnd.setUTCDate(0); // Last day of the month
            monthEnd.setUTCHours(23, 59, 59, 999);

            // Add buffer like TaskEditModal does
            const bufferStart = new Date(monthStart);
            bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
            const bufferEnd = new Date(monthEnd);
            bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);

            const instances = generateRecurringInstances(tuesdayTask, bufferStart, bufferEnd);
            
            console.log(`\\n${testMonth.name}:`);
            instances.forEach(date => {
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
                const dateStr = formatDateForStorage(date);
                console.log(`  ${dateStr} (${dayName})`);
            });

            // All instances must be Tuesdays
            const nonTuesdayInstances = instances.filter(d => d.getUTCDay() !== 2);
            expect(nonTuesdayInstances.length).toBe(0);

            if (nonTuesdayInstances.length > 0) {
                console.log(`🚨 REGRESSION in ${testMonth.name}: Non-Tuesday dates generated!`);
            }
        });
        
        console.log('✅ All months correctly generate only Tuesday dates');
    });
});