/**
 * Test for Issue #160: Inconsistency between TaskEditModal calendar and TaskService completion
 * 
 * This test specifically targets the interaction between:
 * 1. TaskEditModal completion calendar (uses formatUTCDateForCalendar)
 * 2. TaskService toggleRecurringTaskComplete (uses date-fns format)
 */

import { format } from 'date-fns';
import { formatUTCDateForCalendar, createUTCDateForRRule } from '../../../src/utils/dateUtils';
import { generateRecurringInstances } from '../../../src/utils/helpers';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';

describe('Issue #160: TaskEditModal vs TaskService inconsistency', () => {
  it('should reproduce the exact bug: calendar highlighting vs completion recording', () => {
    console.log('=== TaskEditModal vs TaskService Bug Reproduction ===');
    
    // Create a Friday recurring task
    const fridayTask: TaskInfo = TaskFactory.createTask({
      id: 'test-friday-task',
      title: 'Weekly Friday Task',
      recurrence: 'FREQ=WEEKLY;BYDAY=FR',
      scheduled: '2024-01-12', // Friday
      complete_instances: []
    });

    // Simulate what happens in TaskEditModal completion calendar
    console.log('\n1. TaskEditModal Calendar Logic:');
    
    // Calendar generates dates using date-fns (which creates local timezone dates)
    const weekStart = new Date(2024, 0, 8); // Local timezone: Monday Jan 8
    const weekEnd = new Date(2024, 0, 14);   // Local timezone: Sunday Jan 14
    
    console.log('Week start (local):', weekStart.toISOString());
    console.log('Week end (local):', weekEnd.toISOString());
    
    // Simulate eachDayOfInterval - creates local timezone dates
    const allDays: Date[] = [];
    for (let day = new Date(weekStart); day <= weekEnd; day.setDate(day.getDate() + 1)) {
      allDays.push(new Date(day)); // These are local timezone dates
    }
    
    // Calendar formats these local dates using formatUTCDateForCalendar (treating them as UTC)
    const calendarDateStrings = allDays.map(day => {
      const formatted = formatUTCDateForCalendar(day);
      console.log(`  ${day.toISOString()} → ${formatted} (day ${day.getUTCDay()})`);
      return formatted;
    });
    
    // Generate recurring instances (these are properly UTC)
    const recurringDates = generateRecurringInstances(fridayTask, weekStart, weekEnd);
    const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
    
    console.log('\nRecurring date strings (UTC):', Array.from(recurringDateStrings));
    console.log('Calendar date strings (local treated as UTC):', calendarDateStrings);
    
    // Find which day the calendar would highlight as recurring
    const highlightedDays = calendarDateStrings.filter(dateStr => recurringDateStrings.has(dateStr));
    console.log('Days highlighted in calendar:', highlightedDays);
    
    // Simulate what happens when user clicks on a calendar day
    console.log('\n2. TaskService Completion Logic:');
    
    // User clicks on what they think is Friday (Jan 12)
    const userClickedDay = allDays[4]; // Should be Friday (index 4 = Friday)
    console.log('User clicked day:', userClickedDay.toISOString());
    console.log('User clicked day (local):', userClickedDay.toLocaleDateString());
    
    // TaskService formats this using date-fns format (local timezone)
    const completionDateStr = format(userClickedDay, 'yyyy-MM-dd');
    console.log('TaskService would record:', completionDateStr);
    
    // Calendar formats the same date using UTC methods
    const calendarDateStr = formatUTCDateForCalendar(userClickedDay);
    console.log('Calendar shows this as:', calendarDateStr);
    
    console.log('\n3. Bug Analysis:');
    if (completionDateStr !== calendarDateStr) {
      console.log('🐛 BUG CONFIRMED: Date inconsistency!');
      console.log(`  Calendar shows: ${calendarDateStr}`);
      console.log(`  Service records: ${completionDateStr}`);
      console.log('  This is why Friday tasks appear to be completed on Saturday!');
    } else {
      console.log('✅ No inconsistency found');
    }
    
    // Check if the recorded completion would match the recurring day
    const fridayRecurringDay = Array.from(recurringDateStrings)[0];
    if (fridayRecurringDay && completionDateStr !== fridayRecurringDay) {
      console.log('🐛 ADDITIONAL BUG: Completion doesn\'t match recurring day!');
      console.log(`  Recurring day: ${fridayRecurringDay}`);
      console.log(`  Completion recorded: ${completionDateStr}`);
    }
  });

  it('should demonstrate the fix by using consistent date handling', () => {
    console.log('\n=== Demonstrating the Fix ===');
    
    const fridayTask: TaskInfo = TaskFactory.createTask({
      id: 'test-friday-task',
      title: 'Weekly Friday Task',
      recurrence: 'FREQ=WEEKLY;BYDAY=FR',
      scheduled: '2024-01-12', // Friday
      complete_instances: []
    });

    // FIXED approach: Use UTC dates consistently
    console.log('Using consistent UTC date handling:');
    
    // Create UTC dates for the week
    const weekStartUTC = new Date('2024-01-08T00:00:00.000Z'); // Monday UTC
    const weekEndUTC = new Date('2024-01-14T23:59:59.999Z');   // Sunday UTC
    
    const allDaysUTC: Date[] = [];
    for (let day = new Date(weekStartUTC); day <= weekEndUTC; day.setUTCDate(day.getUTCDate() + 1)) {
      allDaysUTC.push(new Date(day));
    }
    
    // Both calendar and service use the same formatting
    const calendarDateStrings = allDaysUTC.map(day => formatUTCDateForCalendar(day));
    const recurringDates = generateRecurringInstances(fridayTask, weekStartUTC, weekEndUTC);
    const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
    
    console.log('Calendar dates (UTC):', calendarDateStrings);
    console.log('Recurring dates (UTC):', Array.from(recurringDateStrings));
    
    // When user clicks, use the same UTC formatting
    const userClickedDayUTC = allDaysUTC[4]; // Friday UTC
    const completionDateStr = formatUTCDateForCalendar(userClickedDayUTC); // Use same function!
    
    console.log('User clicked (UTC):', userClickedDayUTC.toISOString());
    console.log('Completion recorded (UTC):', completionDateStr);
    
    // Check consistency
    const fridayRecurringDay = Array.from(recurringDateStrings)[0];
    if (completionDateStr === fridayRecurringDay) {
      console.log('✅ FIXED: Completion matches recurring day!');
      console.log(`  Both use: ${completionDateStr}`);
    } else {
      console.log('❌ Still inconsistent');
    }
  });
});