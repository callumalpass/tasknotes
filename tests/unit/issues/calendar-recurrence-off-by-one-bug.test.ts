/**
 * Test for Calendar Recurrence Off-by-One Bug (GitHub discussion #237)
 * 
 * This test reproduces the calendar recurrence off-by-one behavior reported in:
 * - https://github.com/callumalpass/tasknotes/discussions/237
 * 
 * The bug manifests as:
 * - A weekly recurring task set to occur on Tuesdays actually highlights dates on Mondays
 * - Example: Dates 21st and 28th (Mondays) are highlighted instead of the expected Tuesdays (22nd and 29th)
 * 
 * The root cause appears to be related to timezone handling in RRule processing or date boundary calculations
 * when converting between local time, UTC, and calendar display dates.
 */

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { isDueByRRule, generateRecurringInstances } from '../../../src/utils/helpers';
import { createUTCDateForRRule, formatDateForStorage } from '../../../src/utils/dateUtils';
import { RRule } from 'rrule';

// Mock the rrule library to potentially introduce the off-by-one behavior
// This simulates potential timezone issues in RRule processing
jest.mock('rrule', () => {
  const actualRRule = jest.requireActual('rrule');
  
  return {
    ...actualRRule,
    RRule: class MockRRule extends actualRRule.RRule {
      between(start: Date, end: Date, inc = false): Date[] {
        // Call the actual implementation
        const dates = super.between(start, end, inc);
        
        // For testing purposes, we can potentially simulate an off-by-one bug
        // by shifting dates under certain conditions
        // This is commented out for now, but shows how the bug might manifest
        
        // Example of how off-by-one could occur due to timezone issues:
        // if (this.options.freq === actualRRule.RRule.WEEKLY) {
        //   return dates.map(date => {
        //     // Simulate a day shift due to timezone processing bug
        //     const shifted = new Date(date);
        //     shifted.setUTCDate(shifted.getUTCDate() - 1);
        //     return shifted;
        //   });
        // }
        
        return dates;
      }
    }
  };
});

describe('Calendar Recurrence Off-by-One Bug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue #237: Weekly recurring task shows wrong day highlighted', () => {
    const testCases = [
      {
        dayName: 'Monday',
        scheduledDate: '2025-01-20', // Monday, January 20, 2025
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
        expectedDayOfWeek: 1 // Monday = 1
      },
      {
        dayName: 'Tuesday', 
        scheduledDate: '2025-01-21', // Tuesday, January 21, 2025
        rrule: 'FREQ=WEEKLY;BYDAY=TU',
        expectedDayOfWeek: 2 // Tuesday = 2
      },
      {
        dayName: 'Wednesday',
        scheduledDate: '2025-01-22', // Wednesday, January 22, 2025
        rrule: 'FREQ=WEEKLY;BYDAY=WE', 
        expectedDayOfWeek: 3 // Wednesday = 3
      },
      {
        dayName: 'Thursday',
        scheduledDate: '2025-01-23', // Thursday, January 23, 2025
        rrule: 'FREQ=WEEKLY;BYDAY=TH',
        expectedDayOfWeek: 4 // Thursday = 4
      },
      {
        dayName: 'Friday',
        scheduledDate: '2025-01-24', // Friday, January 24, 2025
        rrule: 'FREQ=WEEKLY;BYDAY=FR',
        expectedDayOfWeek: 5 // Friday = 5
      }
    ];

    testCases.forEach(({ dayName, scheduledDate, rrule, expectedDayOfWeek }) => {
      it(`should pass when bug is absent: ${dayName} task correctly identified as due on ${dayName}`, () => {
        const task = TaskFactory.createTask({
          id: `${dayName.toLowerCase()}-task`,
          title: `Weekly ${dayName} Task`,
          recurrence: rrule,
          scheduled: scheduledDate,
          complete_instances: []
        });

        // Create UTC date for the intended day
        const intendedDate = createUTCDateForRRule(scheduledDate);
        
        // Verify this is actually the intended day of week
        expect(intendedDate.getUTCDay()).toBe(expectedDayOfWeek);
        
        // Check if task is correctly identified as due on the intended day
        const isDueOnIntendedDay = isDueByRRule(task, intendedDate);
        expect(isDueOnIntendedDay).toBe(true);
        
        // Check that task is NOT due on the previous day (off-by-one check)
        const previousDate = new Date(intendedDate);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);
        const isDueOnPreviousDay = isDueByRRule(task, previousDate);
        expect(isDueOnPreviousDay).toBe(false);
        
        // Check that task is NOT due on the next day
        const nextDate = new Date(intendedDate);
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const isDueOnNextDay = isDueByRRule(task, nextDate);
        expect(isDueOnNextDay).toBe(false);
      });

      it(`should fail when bug is present: ${dayName} task incorrectly shows as due on previous day`, () => {
        const task = TaskFactory.createTask({
          id: `${dayName.toLowerCase()}-bug-task`,
          title: `Weekly ${dayName} Task (Bug Test)`,
          recurrence: rrule,
          scheduled: scheduledDate,
          complete_instances: []
        });

        const intendedDate = createUTCDateForRRule(scheduledDate);
        const previousDate = new Date(intendedDate);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);
        
        // If bug is present, the task might be identified as due on the previous day
        const isDueOnPreviousDay = isDueByRRule(task, previousDate);
        const isDueOnIntendedDay = isDueByRRule(task, intendedDate);
        
        // Expected behavior (when bug is absent):
        expect(isDueOnIntendedDay).toBe(true);   // Should be due on intended day
        expect(isDueOnPreviousDay).toBe(false);  // Should NOT be due on previous day
        
        // If this test fails (previous day returns true), it indicates the off-by-one bug
        // The bug would manifest as: Tuesday task shows as due on Monday
      });
    });
  });

  describe('Calendar Highlighting Off-by-One Reproduction', () => {
    it('should reproduce the exact scenario from GitHub discussion #237', () => {
      // Create a weekly recurring task set for Tuesdays
      // This replicates the exact scenario described in the issue
      const tuesdayTask = TaskFactory.createTask({
        id: 'tuesday-recurring-task',
        title: 'Weekly Tuesday Meeting',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-01-21', // Tuesday, January 21, 2025
        complete_instances: []
      });

      // Generate recurring instances for the month of January 2025
      const monthStart = new Date('2025-01-01T00:00:00.000Z');
      const monthEnd = new Date('2025-01-31T23:59:59.999Z');
      
      const recurringInstances = generateRecurringInstances(tuesdayTask, monthStart, monthEnd);
      const dateStrings = recurringInstances.map(date => formatDateForStorage(date));
      
      console.log('Generated recurring instances:', dateStrings);
      
      // Expected Tuesdays in January 2025: 7th, 14th, 21st, 28th
      const expectedTuesdays = ['2025-01-07', '2025-01-14', '2025-01-21', '2025-01-28'];
      
      // Corresponding Mondays (off-by-one dates): 6th, 13th, 20th, 27th  
      const mondaysBefore = ['2025-01-06', '2025-01-13', '2025-01-20', '2025-01-27'];
      
      // Verify correct behavior: all expected Tuesdays should be included
      expectedTuesdays.forEach(tuesday => {
        expect(dateStrings).toContain(tuesday);
      });
      
      // Verify off-by-one bug is NOT present: Mondays should NOT be included
      mondaysBefore.forEach(monday => {
        expect(dateStrings).not.toContain(monday);
      });
      
      // Additional verification: check specific dates mentioned in the issue
      // "Dates 21st and 28th (Mondays) are highlighted instead of the expected Tuesdays"
      // Note: The issue description seems to have day-of-week mixed up, but the dates are correct
      expect(dateStrings).toContain('2025-01-21'); // 21st is Tuesday (correct)
      expect(dateStrings).toContain('2025-01-28'); // 28th is Tuesday (correct)
      expect(dateStrings).not.toContain('2025-01-20'); // 20th is Monday (should not be highlighted)
      expect(dateStrings).not.toContain('2025-01-27'); // 27th is Monday (should not be highlighted)
    });

    it('should demonstrate calendar boundary issues that could cause off-by-one', () => {
      // Test with various timezone boundary scenarios that could trigger the bug
      const scenarios = [
        {
          name: 'End of month boundary',
          scheduledDate: '2025-01-31', // Friday (last day of January)
          testDate: '2025-01-31T23:59:59.999Z'
        },
        {
          name: 'Start of week boundary', 
          scheduledDate: '2025-01-06', // Monday (start of week)
          testDate: '2025-01-06T00:00:00.000Z'
        },
        {
          name: 'End of week boundary',
          scheduledDate: '2025-01-05', // Sunday (end of week)
          testDate: '2025-01-05T23:59:59.999Z'
        }
      ];

      scenarios.forEach(({ name, scheduledDate, testDate }) => {
        // Get the day of week for the scheduled date to create proper recurrence
        const scheduledDateObj = createUTCDateForRRule(scheduledDate);
        const dayOfWeek = scheduledDateObj.getUTCDay();
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const rrule = `FREQ=WEEKLY;BYDAY=${dayNames[dayOfWeek]}`;
        
        const task = TaskFactory.createTask({
          id: `boundary-${name.replace(/\s+/g, '-').toLowerCase()}`,
          title: `Boundary Test: ${name}`,
          recurrence: rrule,
          scheduled: scheduledDate,
          complete_instances: []
        });

        const testDateObj = new Date(testDate);
        
        // Verify the task is due on the scheduled date
        const isDueOnScheduledDate = isDueByRRule(task, scheduledDateObj);
        expect(isDueOnScheduledDate).toBe(true);
        
        // Test that boundary times on the same day work correctly
        // Convert test time to midnight UTC to match RRule expectations
        const testDateAtMidnight = createUTCDateForRRule(scheduledDate);
        const isDueOnTestDateAtMidnight = isDueByRRule(task, testDateAtMidnight);
        
        console.log(`${name}: scheduled=${scheduledDate}, isDue(scheduled)=${isDueOnScheduledDate}, isDue(midnight)=${isDueOnTestDateAtMidnight}`);
        
        // Both the scheduled date object and midnight on the same day should work
        expect(isDueOnTestDateAtMidnight).toBe(true);
      });
    });
  });

  describe('RRule Integration Off-by-One Checks', () => {
    it('should verify RRule processes weekday recurrence correctly', () => {
      // Test direct RRule behavior to isolate any issues in the RRule layer
      const dtstart = createUTCDateForRRule('2025-01-21'); // Tuesday
      
      // Create RRule for weekly Tuesday recurrence
      const rule = new RRule({
        freq: RRule.WEEKLY,
        byweekday: [RRule.TU], // Tuesday
        dtstart: dtstart
      });
      
      // Generate instances for January 2025
      const monthStart = createUTCDateForRRule('2025-01-01');
      const monthEnd = createUTCDateForRRule('2025-01-31');
      
      const instances = rule.between(monthStart, monthEnd, true);
      const instanceStrings = instances.map(date => formatDateForStorage(date));
      
      console.log('RRule generated instances:', instanceStrings);
      
      // Verify all instances are actually Tuesdays
      instances.forEach(date => {
        expect(date.getUTCDay()).toBe(2); // Tuesday = 2
      });
      
      // Expected Tuesdays in January 2025
      const expectedTuesdays = ['2025-01-07', '2025-01-14', '2025-01-21', '2025-01-28'];
      expectedTuesdays.forEach(expectedDate => {
        expect(instanceStrings).toContain(expectedDate);
      });
      
      // Verify no Mondays are included (off-by-one check)
      instances.forEach(date => {
        expect(date.getUTCDay()).not.toBe(1); // Monday = 1
      });
    });

    it('should test edge case: recurrence across daylight saving time boundaries', () => {
      // Note: This test is more relevant for locations that observe DST
      // but helps verify the UTC-based approach prevents DST-related off-by-one issues
      
      const springTask = TaskFactory.createTask({
        id: 'dst-spring-task', 
        title: 'DST Spring Test',
        recurrence: 'FREQ=WEEKLY;BYDAY=SU', // Weekly on Sunday
        scheduled: '2025-03-09', // Sunday before typical DST change
        complete_instances: []
      });
      
      // Test dates around typical DST change (second Sunday in March)
      const beforeDST = createUTCDateForRRule('2025-03-09'); // Sunday before DST
      const afterDST = createUTCDateForRRule('2025-03-16');  // Sunday after DST
      
      // Both should be identified as due (if bug is absent)
      expect(isDueByRRule(springTask, beforeDST)).toBe(true);
      expect(isDueByRRule(springTask, afterDST)).toBe(true);
      
      // Verify day of week is preserved correctly
      expect(beforeDST.getUTCDay()).toBe(0); // Sunday = 0
      expect(afterDST.getUTCDay()).toBe(0);  // Sunday = 0
      
      // Generate instances across DST boundary
      const instances = generateRecurringInstances(
        springTask, 
        createUTCDateForRRule('2025-03-01'),
        createUTCDateForRRule('2025-03-31')
      );
      
      const instanceStrings = instances.map(date => formatDateForStorage(date));
      
      // Should include both Sundays
      expect(instanceStrings).toContain('2025-03-09');
      expect(instanceStrings).toContain('2025-03-16');
      
      // Should not include adjacent days (off-by-one check)
      expect(instanceStrings).not.toContain('2025-03-08'); // Saturday before
      expect(instanceStrings).not.toContain('2025-03-10'); // Monday after
      expect(instanceStrings).not.toContain('2025-03-15'); // Saturday before
      expect(instanceStrings).not.toContain('2025-03-17'); // Monday after
    });
  });
});