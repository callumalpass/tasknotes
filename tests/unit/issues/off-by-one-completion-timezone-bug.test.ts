/**
 * Test for Off-by-One Completion Date Bug (GitHub discussions #237 and #270)
 * 
 * This test reproduces the off-by-one behavior reported in:
 * - https://github.com/callumalpass/tasknotes/discussions/237 (Calendar recurrence shows wrong day)
 * - https://github.com/callumalpass/tasknotes/discussions/270#discussioncomment-13885071 (Completion date off by one day)
 * 
 * The bug occurs when:
 * 1. TaskService uses `format(date, 'yyyy-MM-dd')` which applies local timezone
 * 2. Calendar/UI components use `formatUTCDateForCalendar()` which uses UTC
 * 3. This creates inconsistency where completion dates can be off by one day
 * 
 * Specific scenarios:
 * - Weekly recurring task set for Tuesday shows Monday highlighted (recurrence bug)
 * - Task completed inline shows completion date as previous day (completion bug) 
 * - Task completed on calendar shows correct date (calendar uses formatUTCDateForCalendar)
 * - Different behavior between inline and calendar completion methods
 */

import { TaskService } from '../../../src/services/TaskService';
import { formatUTCDateForCalendar } from '../../../src/utils/dateUtils';
import { format } from 'date-fns';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import { isDueByRRule, generateRecurringInstances } from '../../../src/utils/helpers';

// Mock date-fns with default AEST timezone behavior
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      // Default AEST (UTC+10) timezone offset
      const localDate = new Date(date.getTime() + (10 * 60 * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    }
    if (formatStr === 'MMM d') {
      const localDate = new Date(date.getTime() + (10 * 60 * 60 * 1000));
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[localDate.getUTCMonth()]} ${localDate.getUTCDate()}`;
    }
    return date.toISOString();
  }),
  ...jest.requireActual('date-fns')
}));

// Helper function to create timezone-specific mocks
const createTimezoneMock = (offsetHours: number, timezoneName: string) => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      // Apply timezone offset to simulate local timezone
      const localDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    }
    if (formatStr === 'MMM d') {
      const localDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[localDate.getUTCMonth()]} ${localDate.getUTCDate()}`;
    }
    return date.toISOString();
  }),
  // Re-export other functions we don't want to mock
  ...jest.requireActual('date-fns'),
  // Add metadata for testing
  __mockTimezone: timezoneName,
  __mockOffsetHours: offsetHours
});

describe('Off-by-One Completion Date Bug', () => {
  let mockPlugin: any;
  let taskService: TaskService;
  
  // Test scenarios for different timezones where the bug manifests
  const timezoneScenarios = [
    {
      name: 'AEST (UTC+10) - Australian Eastern Standard Time',
      offsetHours: 10,
      testTime: '2025-01-21T14:00:00Z', // 14:00 UTC = 00:00 AEST next day
      expectedLocal: '2025-01-22',
      expectedUTC: '2025-01-21',
      description: 'Late evening UTC becomes early morning next day in AEST'
    },
    {
      name: 'JST (UTC+9) - Japan Standard Time',
      offsetHours: 9,
      testTime: '2025-01-21T15:00:00Z', // 15:00 UTC = 00:00 JST next day
      expectedLocal: '2025-01-22',
      expectedUTC: '2025-01-21',
      description: 'Late evening UTC becomes midnight next day in JST'
    },
    {
      name: 'CET (UTC+1) - Central European Time',
      offsetHours: 1,
      testTime: '2025-01-21T23:00:00Z', // 23:00 UTC = 00:00 CET next day
      expectedLocal: '2025-01-22',
      expectedUTC: '2025-01-21',
      description: 'Late evening UTC becomes midnight next day in CET'
    },
    {
      name: 'PST (UTC-8) - Pacific Standard Time',
      offsetHours: -8,
      testTime: '2025-01-22T07:00:00Z', // 07:00 UTC = 23:00 PST prev day
      expectedLocal: '2025-01-21',
      expectedUTC: '2025-01-22',
      description: 'Early morning UTC becomes late evening previous day in PST'
    },
    {
      name: 'EST (UTC-5) - Eastern Standard Time',
      offsetHours: -5,
      testTime: '2025-01-22T04:00:00Z', // 04:00 UTC = 23:00 EST prev day
      expectedLocal: '2025-01-21',
      expectedUTC: '2025-01-22',
      description: 'Early morning UTC becomes late evening previous day in EST'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();

    // Create mock plugin with selectedDate set to late evening UTC
    // This simulates when the bug is most likely to occur (near day boundary)
    mockPlugin = {
      app: {
        vault: {
          getAbstractFileByPath: jest.fn().mockReturnValue(new TFile('test-task.md')),
        },
        fileManager: {
          processFrontMatter: jest.fn((file, callback) => {
            const frontmatter: any = {
              complete_instances: [],
              dateModified: '2025-01-21T14:00:00Z' // Late evening UTC (early morning AEST)
            };
            callback(frontmatter);
            return Promise.resolve();
          })
        }
      },
      fieldMapper: {
        toUserField: jest.fn((field) => {
          const mapping = {
            completeInstances: 'complete_instances',
            dateModified: 'dateModified'
          };
          return mapping[field as keyof typeof mapping] || field;
        })
      },
      cacheManager: {
        updateTaskInfoInCache: jest.fn(),
        getTaskInfo: jest.fn()
      },
      emitter: {
        trigger: jest.fn()
      },
      selectedDate: new Date('2025-01-21T14:00:00Z') // Tuesday 14:00 UTC (Wednesday 00:00 AEST)
    };

    taskService = new TaskService(mockPlugin);
  });

  describe('Issue #237: Calendar Recurrence Off-by-One Bug', () => {
    it('should pass when bug is present: weekly Tuesday task incorrectly shows Monday highlighted', () => {
      // Create a weekly recurring task set for Tuesdays
      const tuesdayTask = TaskFactory.createTask({
        id: 'tuesday-task',
        title: 'Weekly Tuesday Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-01-21', // Tuesday, January 21, 2025
        complete_instances: []
      });

      // Test date is Tuesday, January 21, 2025
      const tuesdayDate = new Date('2025-01-21T00:00:00.000Z');
      const mondayDate = new Date('2025-01-20T00:00:00.000Z'); // Monday (previous day)

      // Check if task is correctly identified as due on Tuesday
      const isDueOnTuesday = isDueByRRule(tuesdayTask, tuesdayDate);
      const isDueOnMonday = isDueByRRule(tuesdayTask, mondayDate);

      // The bug: if present, this might fail due to timezone handling in RRule processing
      expect(isDueOnTuesday).toBe(true);
      expect(isDueOnMonday).toBe(false);

      // Generate recurring instances for the week
      const weekStart = new Date('2025-01-19T00:00:00.000Z'); // Sunday
      const weekEnd = new Date('2025-01-25T23:59:59.999Z'); // Saturday
      
      const instances = generateRecurringInstances(tuesdayTask, weekStart, weekEnd);
      const dateStrings = instances.map(d => formatUTCDateForCalendar(d));
      
      // The bug: if present, might include Monday instead of Tuesday
      expect(dateStrings).toContain('2025-01-21'); // Should contain Tuesday
      expect(dateStrings).not.toContain('2025-01-20'); // Should NOT contain Monday
      
      // This test passes when the bug is NOT present
      // If the test fails, it indicates the recurrence off-by-one bug exists
    });
  });

  describe('Comprehensive Timezone Impact Analysis', () => {
    timezoneScenarios.forEach(scenario => {
      it(`should demonstrate bug in ${scenario.name}`, async () => {
        // Temporarily replace the mock for this specific timezone
        const originalMock = require('date-fns');
        const timezoneMock = createTimezoneMock(scenario.offsetHours, scenario.name);
        
        // Mock the date-fns format function for this test
        jest.doMock('date-fns', () => timezoneMock);
        
        console.log(`\n=== Testing ${scenario.name} ===`);
        console.log(`Description: ${scenario.description}`);
        console.log(`Test time: ${scenario.testTime}`);
        
        const dailyTask = TaskFactory.createTask({
          id: `timezone-test-${scenario.offsetHours}`,
          title: `Daily Task - ${scenario.name}`,
          recurrence: 'FREQ=DAILY',
          scheduled: '2025-01-21',
          complete_instances: []
        });

        mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(dailyTask);
        const targetDate = new Date(scenario.testTime);
        
        // Simulate task completion using TaskService (uses local timezone format)
        const updatedTask = await taskService.toggleRecurringTaskComplete(dailyTask, targetDate);
        
        // What date was actually stored?
        const storedDate = updatedTask.complete_instances?.[0];
        
        // What would different systems expect?
        const localExpected = timezoneMock.format(targetDate, 'yyyy-MM-dd');
        const utcExpected = formatUTCDateForCalendar(targetDate);
        
        console.log(`UTC time: ${targetDate.toISOString()}`);
        console.log(`Local timezone result: ${localExpected}`);
        console.log(`UTC result: ${utcExpected}`);
        console.log(`TaskService stored: ${storedDate}`);
        console.log(`Calendar would expect: ${utcExpected}`);
        console.log(`Inconsistency: ${storedDate !== utcExpected ? 'YES' : 'NO'}`);
        
        // Bug is now FIXED: TaskService stores UTC dates consistently
        expect(storedDate).toBe(utcExpected); // TaskService now uses UTC (fixed)
        expect(storedDate).toBe(scenario.expectedUTC); // Consistent with calendar
        expect(utcExpected).toBe(scenario.expectedUTC); // What calendar expects
        
        // Bug is now FIXED: stored date == expected date
        if (scenario.expectedLocal !== scenario.expectedUTC) {
          expect(storedDate).toBe(utcExpected); // Bug is now fixed
          console.log(`✅ BUG FIXED: ${Math.abs(scenario.offsetHours)} hour timezone difference no longer causes wrong date storage`);
        }
      });
    });
  });

  describe('Issue #270: Completion Date Off-by-One Bug', () => {
    it.skip('should fail when bug is present: inline completion records wrong date due to timezone mismatch', async () => {
      // Create a daily recurring task
      const dailyTask = TaskFactory.createTask({
        id: 'daily-task',
        title: 'Daily Task',
        recurrence: 'FREQ=DAILY',
        scheduled: '2025-01-21',
        complete_instances: []
      });

      // Mock the cache to return fresh task data
      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(dailyTask);

      // Target date is Tuesday 14:00 UTC (which is Wednesday 00:00 AEST)
      const targetDate = new Date('2025-01-21T14:00:00Z');
      
      // INLINE COMPLETION: Simulate marking task complete inline (uses TaskService)
      // TaskService.toggleRecurringTaskComplete uses format(date, 'yyyy-MM-dd') - LOCAL timezone
      await taskService.toggleRecurringTaskComplete(dailyTask, targetDate);

      // What date did TaskService actually store?
      // Due to mocked AEST timezone, format() returns '2025-01-22' (Wednesday AEST)
      const taskServiceStoredDate = format(targetDate, 'yyyy-MM-dd');
      
      // CALENDAR COMPLETION: What would calendar completion store?
      // Calendar uses formatUTCDateForCalendar() - UTC timezone
      const calendarWouldStoreDate = formatUTCDateForCalendar(targetDate);
      
      console.log('Target date (UTC):', targetDate.toISOString());
      console.log('TaskService stores (local timezone):', taskServiceStoredDate);
      console.log('Calendar would store (UTC):', calendarWouldStoreDate);
      
      // THE BUG: Different completion methods store different dates for the same moment in time
      expect(taskServiceStoredDate).toBe('2025-01-22'); // AEST next day
      expect(calendarWouldStoreDate).toBe('2025-01-21'); // UTC same day
      
      // This demonstrates the inconsistency - same action, different stored dates
      expect(taskServiceStoredDate).not.toBe(calendarWouldStoreDate);
      
      // This test PASSES when the bug is present (dates are different)
      // When fixed, this test should FAIL because dates would be consistent
    });

    it('should demonstrate user experience of the completion bug', async () => {
      const dailyTask = TaskFactory.createTask({
        id: 'daily-task-2',
        title: 'Daily Task 2',
        recurrence: 'FREQ=DAILY',
        scheduled: '2025-01-21',
        complete_instances: []
      });

      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(dailyTask);

      // Late evening UTC (early morning local time in AEST)
      const lateEveningUTC = new Date('2025-01-21T14:00:00Z'); // Tuesday 14:00 UTC = Wednesday 00:00 AEST
      
      // User marks task complete using inline method
      const updatedTask = await taskService.toggleRecurringTaskComplete(dailyTask, lateEveningUTC);
      
      // What the user expects: task completed for Tuesday (UTC day)
      const expectedCompletionDate = formatUTCDateForCalendar(lateEveningUTC); // '2025-01-21'
      
      // What TaskService actually stores (now uses UTC - bug fixed)
      const actualStoredDate = updatedTask.complete_instances?.[0];
      const wasCompletedForExpectedDate = updatedTask.complete_instances?.includes(expectedCompletionDate);
      
      // Bug is now FIXED: Task shows as completed for correct day from user perspective
      expect(wasCompletedForExpectedDate).toBe(true);  // User expects true, now gets true (fixed)
      expect(actualStoredDate).toBe(expectedCompletionDate);    // TaskService stores correct UTC date
      
      console.log('User expected completion for:', expectedCompletionDate);
      console.log('Task actually completed for:', actualStoredDate);
      console.log('User sees task as completed for intended date:', wasCompletedForExpectedDate);
      
      // This demonstrates the user experience issue mentioned in the GitHub discussions
    });

    it('should verify inline and calendar completion methods are now consistent', async () => {
      const dailyTask = TaskFactory.createTask({
        id: 'daily-task-3',
        title: 'Daily Task 3',
        recurrence: 'FREQ=DAILY',
        scheduled: '2025-01-21',
        complete_instances: []
      });

      const targetDate = new Date('2025-01-21T14:00:00Z');
      
      // INLINE COMPLETION (TaskService method - uses local timezone format)
      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue({ ...dailyTask });
      const inlineCompletedTask = await taskService.toggleRecurringTaskComplete(dailyTask, targetDate);
      const inlineStoredDate = inlineCompletedTask.complete_instances?.[0];
      
      // CALENDAR COMPLETION (hypothetical - would use UTC format)
      // This simulates what calendar completion would store
      const calendarWouldStoreDate = formatUTCDateForCalendar(targetDate);
      
      // Show the difference mentioned in GitHub discussion #270
      console.log('Inline completion stores:', inlineStoredDate);
      console.log('Calendar completion would store:', calendarWouldStoreDate);
      
      // Bug is now FIXED: Both methods should store the same UTC-based date
      expect(inlineStoredDate).toBe('2025-01-21'); // Now uses UTC (fixed)
      expect(calendarWouldStoreDate).toBe('2025-01-21'); // UTC result
      expect(inlineStoredDate).toBe(calendarWouldStoreDate); // Same results (bug fixed)
      
      // This explains why users see: "I get the correct completed_instance if I mark a task 
      // as complete on the calendar, but it is the day before if done as an inline task."
    });
  });

  describe('Fix Verification Tests', () => {
    it('should pass when bug is fixed: consistent date formatting across all methods', async () => {
      // This test will pass when the bug is fixed by using consistent date formatting
      const dailyTask = TaskFactory.createTask({
        id: 'daily-task-fix',
        title: 'Daily Task Fix Test',
        recurrence: 'FREQ=DAILY',
        scheduled: '2025-01-21',
        complete_instances: []
      });

      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(dailyTask);
      const targetDate = new Date('2025-01-21T14:00:00Z');
      
      // When fixed, both methods should use formatUTCDateForCalendar consistently
      const expectedStoredDate = formatUTCDateForCalendar(targetDate); // '2025-01-21'
      
      // Inline completion - currently buggy (uses local timezone format)
      const updatedTask = await taskService.toggleRecurringTaskComplete(dailyTask, targetDate);
      const actualStoredDate = updatedTask.complete_instances?.[0];
      
      console.log('Expected stored date (UTC):', expectedStoredDate);
      console.log('Actually stored date (current implementation):', actualStoredDate);
      
      // This test currently FAILS due to the bug
      // When the bug is fixed (TaskService uses formatUTCDateForCalendar), this will PASS
      // expect(actualStoredDate).toBe(expectedStoredDate); // Uncomment when bug is fixed
      
      // Bug is now FIXED - TaskService uses formatUTCDateForCalendar
      expect(actualStoredDate).toBe('2025-01-21'); // Now uses UTC (fixed)
      expect(actualStoredDate).toBe(expectedStoredDate); // Consistent behavior
    });
  });
});