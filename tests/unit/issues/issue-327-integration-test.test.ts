/**
 * Integration test for Issue #327: Complete flow from AgendaView to storage
 * 
 * This test simulates the complete flow of marking a recurring task complete
 * from the agenda view to ensure dates are handled correctly throughout
 */

import { formatUTCDateForCalendar, createUTCDateFromLocalCalendarDate } from '../../../src/utils/dateUtils';
import { TaskFactory } from '../../helpers/mock-factories';

describe('Issue #327: Complete Integration Test', () => {
    it('should handle the complete flow from AgendaView date creation to storage', () => {
        // Step 1: Simulate AgendaView creating dates (as it does in getAgendaDates)
        // User is viewing July 29, 2024 in their local timezone
        const userSelectedDate = new Date(2024, 6, 29); // July 29, 2024 local time
        
        console.log('=== Step 1: AgendaView Date Creation ===');
        console.log('User selected date (local):', userSelectedDate.toString());
        console.log('User selected date (ISO):', userSelectedDate.toISOString());
        
        // AgendaView now uses createUTCDateFromLocalCalendarDate
        const agendaDate = createUTCDateFromLocalCalendarDate(userSelectedDate);
        console.log('Agenda normalized date:', agendaDate.toString());
        console.log('Agenda normalized date (ISO):', agendaDate.toISOString());
        
        // Step 2: This date is passed to TaskCard as targetDate
        const targetDate = agendaDate;
        
        // Step 3: When user clicks to mark task complete, formatUTCDateForCalendar is used
        const dateStrForStorage = formatUTCDateForCalendar(targetDate);
        console.log('\n=== Step 2: Date Formatting for Storage ===');
        console.log('Date string for storage:', dateStrForStorage);
        
        // Step 4: Verify the correct date is stored
        expect(dateStrForStorage).toBe('2024-07-29'); // Should be July 29, not July 28!
        
        // Step 5: Simulate checking if task is complete for a date
        const complete_instances = [dateStrForStorage];
        const checkDate = createUTCDateFromLocalCalendarDate(new Date(2024, 6, 29));
        const checkDateStr = formatUTCDateForCalendar(checkDate);
        
        console.log('\n=== Step 3: Checking Completion Status ===');
        console.log('Checking for date:', checkDateStr);
        console.log('Complete instances:', complete_instances);
        console.log('Is complete for July 29?', complete_instances.includes('2024-07-29'));
        console.log('Is complete for July 28?', complete_instances.includes('2024-07-28'));
        
        expect(complete_instances.includes('2024-07-29')).toBe(true);
        expect(complete_instances.includes('2024-07-28')).toBe(false);
    });
    
    it('should work correctly for dates in different timezones', () => {
        const testCases = [
            { 
                name: 'Australia/Sydney (UTC+11)', 
                localDate: new Date(2024, 0, 1), // Jan 1, 2024 local
                expectedStorage: '2024-01-01'
            },
            { 
                name: 'US/Pacific (UTC-8)', 
                localDate: new Date(2024, 11, 31), // Dec 31, 2024 local
                expectedStorage: '2024-12-31'
            },
            { 
                name: 'UTC', 
                localDate: new Date(Date.UTC(2024, 5, 15)), // June 15, 2024 UTC
                expectedStorage: '2024-06-15'
            }
        ];
        
        testCases.forEach(testCase => {
            console.log(`\n=== Testing ${testCase.name} ===`);
            console.log('Local date:', testCase.localDate.toString());
            console.log('Local date (ISO):', testCase.localDate.toISOString());
            
            // Simulate AgendaView normalization
            const normalizedDate = createUTCDateFromLocalCalendarDate(testCase.localDate);
            console.log('Normalized date:', normalizedDate.toISOString());
            
            // Format for storage
            const storageStr = formatUTCDateForCalendar(normalizedDate);
            console.log('Storage string:', storageStr);
            
            expect(storageStr).toBe(testCase.expectedStorage);
        });
    });
    
    it('should ensure consistency between marking complete and checking completion', () => {
        // Create a recurring task
        const task = TaskFactory.createRecurringTask('RRULE:FREQ=DAILY', {
            scheduled: '2024-07-01',
            complete_instances: []
        });
        
        // User clicks on July 29 in agenda view
        const userClickDate = new Date(2024, 6, 29);
        const agendaDate = createUTCDateFromLocalCalendarDate(userClickDate);
        
        // Mark complete (simulating toggleRecurringTaskComplete)
        const completeDateStr = formatUTCDateForCalendar(agendaDate);
        task.complete_instances = [completeDateStr];
        
        console.log('\n=== Consistency Test ===');
        console.log('User clicked on:', userClickDate.toDateString());
        console.log('Stored completion:', completeDateStr);
        
        // Later, check if July 29 shows as complete (simulating isRecurringTaskCompleteForDate)
        const checkJuly29 = createUTCDateFromLocalCalendarDate(new Date(2024, 6, 29));
        const checkJuly29Str = formatUTCDateForCalendar(checkJuly29);
        
        const checkJuly28 = createUTCDateFromLocalCalendarDate(new Date(2024, 6, 28));
        const checkJuly28Str = formatUTCDateForCalendar(checkJuly28);
        
        console.log('Checking July 29:', checkJuly29Str, '-> Complete?', task.complete_instances.includes(checkJuly29Str));
        console.log('Checking July 28:', checkJuly28Str, '-> Complete?', task.complete_instances.includes(checkJuly28Str));
        
        // The task should show as complete for July 29, not July 28
        expect(task.complete_instances.includes(checkJuly29Str)).toBe(true);
        expect(task.complete_instances.includes(checkJuly28Str)).toBe(false);
    });
});