/**
 * Test for July 2025 Monday/Tuesday Off-by-One Bug (GitHub discussion #237)
 * 
 * This reproduces the specific bug reported where:
 * - A weekly recurring task set for Tuesdays
 * - Should appear on July 22nd and 29th, 2025 (Tuesdays)
 * - Actually appears on July 21st and 28th, 2025 (Mondays) 
 * - Consistently one day early (off-by-one)
 * 
 * This suggests a logic error in RRule processing, date conversion, or timezone handling.
 */

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { 
  generateRecurringInstances, 
  isDueByRRule
} from '../../../src/utils/helpers';
import { 
  formatDateForStorage, 
  createUTCDateForRRule
} from '../../../src/utils/dateUtils';

describe('July 2025 Monday/Tuesday Off-by-One Bug', () => {

  describe('Reproduce the exact July 2025 scenario', () => {
    it('should fail when bug is present: Tuesday task incorrectly appears on Mondays', () => {
      // Create a weekly Tuesday recurring task
      const tuesdayTask = TaskFactory.createTask({
        id: 'july-tuesday-bug-test',
        title: 'Weekly Tuesday Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-07-01', // Start of July 2025 (Tuesday)
        complete_instances: []
      });

      // Generate recurring instances for July 2025
      const julyStart = new Date('2025-07-01T00:00:00.000Z');
      const julyEnd = new Date('2025-07-31T23:59:59.999Z');
      
      const recurringDates = generateRecurringInstances(tuesdayTask, julyStart, julyEnd);
      const dateStrings = recurringDates.map(d => formatDateForStorage(d));
      
      console.log('Generated recurring dates for July 2025:', dateStrings);
      
      // Verify what days of the week these actually are
      const dateAnalysis = dateStrings.map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00.000Z');
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return {
          date: dateStr,
          dayOfWeek: date.getUTCDay(),
          dayName: dayNames[date.getUTCDay()],
          dayOfMonth: date.getUTCDate()
        };
      });
      
      console.log('\nDate analysis:');
      dateAnalysis.forEach(({ date, dayName, dayOfMonth }) => {
        console.log(`  ${date} = ${dayName} (${dayOfMonth}${getOrdinalSuffix(dayOfMonth)})`);
      });
      
      // Check if the bug is present: are we getting Mondays instead of Tuesdays?
      const actualDaysOfWeek = dateAnalysis.map(d => d.dayOfWeek);
      const isShowingMondays = actualDaysOfWeek.every(day => day === 1); // Monday = 1
      const isShowingTuesdays = actualDaysOfWeek.every(day => day === 2); // Tuesday = 2
      
      console.log(`\nBug check:`);
      console.log(`All dates are Mondays: ${isShowingMondays}`);
      console.log(`All dates are Tuesdays: ${isShowingTuesdays}`);
      
      // Expected behavior: should show Tuesdays
      expect(isShowingTuesdays).toBe(true);
      expect(isShowingMondays).toBe(false);
      
      // Check the specific dates mentioned in the bug report
      const hasMonday21st = dateStrings.includes('2025-07-21');
      const hasMonday28th = dateStrings.includes('2025-07-28');
      const hasTuesday22nd = dateStrings.includes('2025-07-22');
      const hasTuesday29th = dateStrings.includes('2025-07-29');
      
      console.log(`\nSpecific date check:`);
      console.log(`Has July 21st (Monday): ${hasMonday21st} - should be FALSE`);
      console.log(`Has July 28th (Monday): ${hasMonday28th} - should be FALSE`);
      console.log(`Has July 22nd (Tuesday): ${hasTuesday22nd} - should be TRUE`);
      console.log(`Has July 29th (Tuesday): ${hasTuesday29th} - should be TRUE`);
      
      // If bug is present, these assertions will fail
      expect(hasMonday21st).toBe(false);  // Should NOT include Monday 21st
      expect(hasMonday28th).toBe(false);  // Should NOT include Monday 28th
      expect(hasTuesday22nd).toBe(true);  // Should include Tuesday 22nd
      expect(hasTuesday29th).toBe(true);  // Should include Tuesday 29th
    });

    it('should test isDueByRRule for specific July dates', () => {
      const tuesdayTask = TaskFactory.createTask({
        id: 'july-isduebyrrule-test',
        title: 'Tuesday Task for isDueByRRule Test',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-07-01', // Tuesday, July 1st, 2025
        complete_instances: []
      });

      // Test the specific dates mentioned in the bug report
      const monday21st = createUTCDateForRRule('2025-07-21');
      const tuesday22nd = createUTCDateForRRule('2025-07-22');
      const monday28th = createUTCDateForRRule('2025-07-28');
      const tuesday29th = createUTCDateForRRule('2025-07-29');
      
      const isDueMonday21st = isDueByRRule(tuesdayTask, monday21st);
      const isDueTuesday22nd = isDueByRRule(tuesdayTask, tuesday22nd);
      const isDueMonday28th = isDueByRRule(tuesdayTask, monday28th);
      const isDueTuesday29th = isDueByRRule(tuesdayTask, tuesday29th);
      
      console.log('\nisDueByRRule results:');
      console.log(`Monday 21st: ${isDueMonday21st} (should be false)`);
      console.log(`Tuesday 22nd: ${isDueTuesday22nd} (should be true)`);
      console.log(`Monday 28th: ${isDueMonday28th} (should be false)`);
      console.log(`Tuesday 29th: ${isDueTuesday29th} (should be true)`);
      
      // Verify the correct days
      expect(isDueMonday21st).toBe(false);   // Monday should not be due
      expect(isDueTuesday22nd).toBe(true);   // Tuesday should be due
      expect(isDueMonday28th).toBe(false);   // Monday should not be due
      expect(isDueTuesday29th).toBe(true);   // Tuesday should be due
      
      // If the bug exists, the Monday checks might return true when they should be false
    });

    it('should verify the scheduled date and RRule anchor behavior', () => {
      // Test different scheduled dates to see if the anchor date affects the off-by-one
      
      const testCases = [
        {
          name: 'Scheduled on Tuesday July 1st',
          scheduled: '2025-07-01', // Tuesday
          description: 'Anchor on actual Tuesday'
        },
        {
          name: 'Scheduled on Monday June 30th', 
          scheduled: '2025-06-30', // Monday (day before July)
          description: 'Anchor on Monday before July'
        },
        {
          name: 'Scheduled on Wednesday July 2nd',
          scheduled: '2025-07-02', // Wednesday  
          description: 'Anchor on Wednesday after July 1st'
        }
      ];
      
      testCases.forEach(({ name, scheduled, description }) => {
        console.log(`\n=== ${name} ===`);
        console.log(`Description: ${description}`);
        
        const task = TaskFactory.createTask({
          id: `anchor-test-${scheduled}`,
          title: `Tuesday Task - ${name}`,
          recurrence: 'FREQ=WEEKLY;BYDAY=TU',
          scheduled: scheduled,
          complete_instances: []
        });
        
        // Check what the anchor date is
        const anchorDate = createUTCDateForRRule(scheduled);
        const anchorDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][anchorDate.getUTCDay()];
        console.log(`Anchor date: ${scheduled} (${anchorDayName})`);
        
        // Generate July instances
        const julyStart = new Date('2025-07-01T00:00:00.000Z');
        const julyEnd = new Date('2025-07-31T23:59:59.999Z');
        const instances = generateRecurringInstances(task, julyStart, julyEnd);
        const dateStrings = instances.map(d => formatDateForStorage(d));
        
        console.log(`July instances: ${dateStrings.join(', ')}`);
        
        // Check if all instances are actually Tuesdays
        const allAreTuesdays = instances.every(date => date.getUTCDay() === 2);
        console.log(`All instances are Tuesdays: ${allAreTuesdays}`);
        
        // The anchor date shouldn't matter - all should generate Tuesdays
        expect(allAreTuesdays).toBe(true);
      });
    });
  });

  describe('Timezone and Date Boundary Investigation', () => {
    it('should investigate potential timezone issues in RRule processing', () => {
      // Create a Tuesday task and check how different timezone contexts might affect it
      const tuesdayTask = TaskFactory.createTask({
        id: 'timezone-investigation',
        title: 'Timezone Investigation Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-07-01',
        complete_instances: []
      });
      
      // Test at different times of day to see if time affects date calculation
      const testTimes = [
        '2025-07-22T00:00:00.000Z', // Tuesday midnight UTC
        '2025-07-22T12:00:00.000Z', // Tuesday noon UTC  
        '2025-07-22T23:59:59.999Z', // Tuesday just before midnight UTC
        '2025-07-21T23:59:59.999Z', // Monday just before midnight UTC (boundary)
      ];
      
      testTimes.forEach(timeStr => {
        const testDate = new Date(timeStr);
        const isDue = isDueByRRule(tuesdayTask, testDate);
        const dateStr = formatDateForStorage(testDate);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][testDate.getUTCDay()];
        
        console.log(`${timeStr} (${dateStr}, ${dayName}): isDue = ${isDue}`);
        
        // Only Tuesday times should return true
        const shouldBeDue = testDate.getUTCDay() === 2;
        expect(isDue).toBe(shouldBeDue);
      });
    });

    it('should test createUTCDateForRRule consistency', () => {
      // Test if createUTCDateForRRule is creating consistent dates
      const testDates = [
        '2025-07-21', // Monday
        '2025-07-22', // Tuesday
        '2025-07-28', // Monday  
        '2025-07-29'  // Tuesday
      ];
      
      console.log('\ncreatUUTCDateForRRule consistency check:');
      testDates.forEach(dateStr => {
        const utcDate = createUTCDateForRRule(dateStr);
        const backToString = formatDateForStorage(utcDate);
        const dayOfWeek = utcDate.getUTCDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        
        console.log(`${dateStr} -> ${utcDate.toISOString()} -> ${backToString} (${dayName})`);
        
        // Round trip should be consistent
        expect(backToString).toBe(dateStr);
        
        // Day of week should be correct
        if (dateStr === '2025-07-21' || dateStr === '2025-07-28') {
          expect(dayOfWeek).toBe(1); // Monday
        } else if (dateStr === '2025-07-22' || dateStr === '2025-07-29') {
          expect(dayOfWeek).toBe(2); // Tuesday
        }
      });
    });
  });
});

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}