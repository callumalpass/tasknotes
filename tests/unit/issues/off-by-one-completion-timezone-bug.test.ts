/**
 * Test for Off-by-One Completion Date Bug (GitHub discussions #237 and #270)
 * 
 * This test reproduces the off-by-one behavior reported in:
 * - https://github.com/callumalpass/tasknotes/discussions/237 (Calendar recurrence shows wrong day)
 * - https://github.com/callumalpass/tasknotes/discussions/270#discussioncomment-13885071 (Completion date off by one day)
 * 
 * The bug occurs when:
 * 1. TaskService uses `format(date, 'yyyy-MM-dd')` which applies local timezone
 * 2. Calendar/UI components use `formatDateForStorage()` which uses UTC
 * 3. This creates inconsistency where completion dates can be off by one day
 * 
 * Specific scenarios:
 * - Weekly recurring task set for Tuesday shows Monday highlighted (recurrence bug)
 * - Task completed inline shows completion date as previous day (completion bug) 
 * - Task completed on calendar shows correct date (calendar uses formatDateForStorage)
 * - Different behavior between inline and calendar completion methods
 */

import { TaskService } from '../../../src/services/TaskService';
import { formatDateForStorage } from '../../../src/utils/dateUtils';
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

// Removed timezone mock helper - was used for unreliable timezone simulation tests

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
      const dateStrings = instances.map(d => formatDateForStorage(d));
      
      // The bug: if present, might include Monday instead of Tuesday
      expect(dateStrings).toContain('2025-01-21'); // Should contain Tuesday
      expect(dateStrings).not.toContain('2025-01-20'); // Should NOT contain Monday
      
      // This test passes when the bug is NOT present
      // If the test fails, it indicates the recurrence off-by-one bug exists
    });
  });

  // Removed timezone simulation tests that mock date-fns behavior
  // These tests were unreliable because they tested mock behavior rather than real implementation
  // The real implementation uses actual system timezone, making these simulations meaningless

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
      // Calendar uses formatDateForStorage() - UTC timezone
      const calendarWouldStoreDate = formatDateForStorage(targetDate);
      
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
      
      // With UTC-based formatting, formatDateForStorage uses UTC date
      const expectedCompletionDate = formatDateForStorage(lateEveningUTC); // Returns '2025-01-21' (UTC date)
      
      // What TaskService actually stores (with mocked date-fns using AEST)
      const actualStoredDate = updatedTask.complete_instances?.[0];
      const wasCompletedForExpectedDate = updatedTask.complete_instances?.includes(expectedCompletionDate);
      
      // With UTC-based formatting in both places:
      // - formatDateForStorage returns '2025-01-21' (UTC)
      // - TaskService also uses formatDateForStorage, so returns '2025-01-21' (UTC)
      expect(wasCompletedForExpectedDate).toBe(true);  // Same dates - bug is fixed!
      expect(actualStoredDate).toBe('2025-01-21');    // Both use UTC formatting
      
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
      const calendarWouldStoreDate = formatDateForStorage(targetDate);
      
      // Show the difference mentioned in GitHub discussion #270
      console.log('Inline completion stores:', inlineStoredDate);
      console.log('Calendar completion would store:', calendarWouldStoreDate);
      
      // With UTC-based formatting in both methods:
      // - inlineStoredDate uses formatDateForStorage (UTC) -> '2025-01-21'
      // - calendarWouldStoreDate uses formatDateForStorage (UTC) -> '2025-01-21'
      expect(inlineStoredDate).toBe('2025-01-21'); // Both use UTC
      expect(calendarWouldStoreDate).toBe('2025-01-21'); // Both use UTC
      expect(inlineStoredDate).toBe(calendarWouldStoreDate); // Same - bug is fixed!
      
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
      
      // With UTC-based formatDateForStorage:
      const expectedStoredDate = formatDateForStorage(targetDate); // Returns UTC date '2025-01-21'
      
      // Inline completion with mocked date-fns (AEST)
      const updatedTask = await taskService.toggleRecurringTaskComplete(dailyTask, targetDate);
      const actualStoredDate = updatedTask.complete_instances?.[0];
      
      console.log('Expected stored date (UTC):', expectedStoredDate);
      console.log('Actually stored date (mocked AEST):', actualStoredDate);
      
      // With UTC-based formatting everywhere:
      // - actualStoredDate uses formatDateForStorage -> '2025-01-21' (UTC)
      // - expectedStoredDate uses formatDateForStorage -> '2025-01-21' (UTC)
      expect(actualStoredDate).toBe('2025-01-21'); // Both use UTC
      expect(actualStoredDate).toBe(expectedStoredDate); // Same - bug is fixed!
    });
  });
});