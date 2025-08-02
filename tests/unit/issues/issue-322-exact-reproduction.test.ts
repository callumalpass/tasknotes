/**
 * Test for Issue #322: Tuesday recurring tasks showing on Monday in completion calendar
 * 
 * From GitHub discussion: https://github.com/callumalpass/tasknotes/discussions/322
 * 
 * User report: "For a weekly recurring task set to recur on Tuesdays, 
 * the completion calendar is incorrectly showing Monday dates"
 * Example: Tuesday July 29th shows as July 28th (Monday)
 */

import { generateRecurringInstances } from '../../../src/utils/helpers';
import { formatDateForStorage, createUTCDateForRRule, getUTCStartOfMonth, getUTCEndOfMonth } from '../../../src/utils/dateUtils';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';

describe('Issue #322: Tuesday recurring tasks showing on Monday', () => {
    it('should reproduce the exact bug: Tuesday task showing on Monday dates', () => {
        console.log('=== Issue #322 Reproduction Test ===');
        
        // Create exact task from user report: weekly recurring task set for Tuesdays
        const tuesdayTask: TaskInfo = TaskFactory.createTask({
            id: 'tuesday-weekly-task',
            title: 'Weekly Tuesday Task',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            scheduled: '2024-07-30', // Tuesday, July 30, 2024 (using date from GitHub example)
            dateCreated: '2024-07-30T00:00:00Z',
            complete_instances: []
        });

        console.log('Task scheduled for:', tuesdayTask.scheduled);
        console.log('Task recurrence:', tuesdayTask.recurrence);
        
        // Test the month containing July 29 (the date mentioned in the bug report)
        const july2024 = new Date('2024-07-01T00:00:00.000Z'); // July 2024
        
        // Create date range like TaskEditModal does
        const bufferStart = getUTCStartOfMonth(july2024);
        bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1); // June
        const bufferEnd = getUTCEndOfMonth(july2024);
        bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1); // August
        
        console.log('Date range for recurring generation:');
        console.log('  Buffer start:', bufferStart.toISOString());
        console.log('  Buffer end:', bufferEnd.toISOString());
        
        // Generate recurring instances like TaskEditModal does
        const recurringDates = generateRecurringInstances(tuesdayTask, bufferStart, bufferEnd);
        const recurringDateStrings = recurringDates.map(d => formatDateForStorage(d));
        
        console.log('Generated recurring dates:');
        recurringDates.forEach((date, index) => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            const dateStr = formatDateForStorage(date);
            console.log(`  ${index + 1}: ${dateStr} (${dayName})`);
        });
        
        // Check for the specific dates mentioned in the bug report
        const july29Monday = '2024-07-29'; // Monday July 29 (what user sees in bug)
        const july30Tuesday = '2024-07-30'; // Tuesday July 30 (what should be shown)
        
        const hasMonday29 = recurringDateStrings.includes(july29Monday);
        const hasTuesday30 = recurringDateStrings.includes(july30Tuesday);
        
        console.log('\\nBug analysis:');
        console.log(`  Monday July 29 included: ${hasMonday29} (BUG if true)`);
        console.log(`  Tuesday July 30 included: ${hasTuesday30} (CORRECT if true)`);
        
        // Check future dates mentioned in bug report
        const august5Monday = '2024-08-05'; // Monday Aug 5 (bug shows this)
        const august6Tuesday = '2024-08-06'; // Tuesday Aug 6 (should show this)
        
        const hasAugust5 = recurringDateStrings.includes(august5Monday);
        const hasAugust6 = recurringDateStrings.includes(august6Tuesday);
        
        console.log(`  Monday August 5 included: ${hasAugust5} (BUG if true)`);
        console.log(`  Tuesday August 6 included: ${hasAugust6} (CORRECT if true)`);
        
        // The bug exists if we're showing Monday dates instead of Tuesday dates
        if (hasMonday29 && !hasTuesday30) {
            console.log('🐛 BUG CONFIRMED: Tuesday task showing on Monday!');
            console.log('   This reproduces issue #322 exactly');
        } else if (!hasMonday29 && hasTuesday30) {
            console.log('✅ CORRECT: Tuesday task showing on Tuesday');
            console.log('   Issue #322 appears to be fixed');
        } else {
            console.log('⚠️  UNEXPECTED: Both or neither dates present');
        }
        
        // Verify all recurring dates are actually Tuesdays (day 2)
        const wrongDayDates = recurringDates.filter(date => date.getUTCDay() !== 2);
        if (wrongDayDates.length > 0) {
            console.log('🐛 ADDITIONAL BUG: Non-Tuesday dates generated:');
            wrongDayDates.forEach(date => {
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
                console.log(`   ${formatDateForStorage(date)} is a ${dayName}`);
            });
        }
        
        // For the test to fail when bug is present, we expect ONLY Tuesday dates
        // But if the bug exists, we'll see Monday dates instead
        expect(recurringDates.every(date => date.getUTCDay() === 2)).toBe(true);
    });
    
    it('should demonstrate timezone impact on RRule processing', () => {
        console.log('\\n=== Timezone Impact Analysis ===');
        
        const tuesdayTask: TaskInfo = TaskFactory.createTask({
            id: 'timezone-test-task',
            title: 'Timezone Test Task',
            recurrence: 'FREQ=WEEKLY;BYDAY=TU',
            scheduled: '2024-07-30', // Tuesday
            dateCreated: '2024-07-30T00:00:00Z',
            complete_instances: []
        });
        
        // Test different ways of creating the date range
        console.log('1. UTC date range (correct approach):');
        const utcStart = new Date('2024-07-28T00:00:00.000Z'); // Sunday
        const utcEnd = new Date('2024-08-03T23:59:59.999Z'); // Saturday
        
        const utcResults = generateRecurringInstances(tuesdayTask, utcStart, utcEnd);
        utcResults.forEach(date => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            console.log(`   ${formatDateForStorage(date)} (${dayName})`);
        });
        
        console.log('\\n2. Local date range (potential bug source):');
        const localStart = new Date(2024, 6, 28); // July 28 in local timezone
        const localEnd = new Date(2024, 7, 3); // August 3 in local timezone
        
        console.log(`   Local start: ${localStart.toISOString()}`);
        console.log(`   Local end: ${localEnd.toISOString()}`);
        
        const localResults = generateRecurringInstances(tuesdayTask, localStart, localEnd);
        localResults.forEach(date => {
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
            console.log(`   ${formatDateForStorage(date)} (${dayName})`);
        });
        
        // Check if different date range creation methods produce different results
        const utcDates = utcResults.map(d => formatDateForStorage(d));
        const localDates = localResults.map(d => formatDateForStorage(d));
        
        if (JSON.stringify(utcDates) !== JSON.stringify(localDates)) {
            console.log('🐛 TIMEZONE BUG: Different results from UTC vs local date ranges!');
            console.log('   UTC dates:', utcDates);
            console.log('   Local dates:', localDates);
        } else {
            console.log('✅ CONSISTENT: Same results regardless of date range creation method');
        }
    });
});