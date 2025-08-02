/**
 * Test for Issue #314: complete_instances has incorrect time zone
 * 
 * Bug Description:
 * When marking a recurring task complete at 10:00 AEST on July 28, 2025,
 * the complete_instances property is incorrectly set to "2025-07-27" instead of "2025-07-28".
 * 
 * This test reproduces the behavior and should FAIL when the bug is present.
 * The test simulates the user's environment (AEST timezone) and verifies that
 * the correct date is stored in complete_instances.
 */

import { TaskService } from '../../../src/services/TaskService';
import { TaskInfo } from '../../../src/types';
import { formatDateForStorage } from '../../../src/utils/dateUtils';
import { PluginFactory } from '../../helpers/mock-factories';

describe('Issue #314: complete_instances timezone bug reproduction', () => {
  let taskService: TaskService;
  let mockPlugin: any;

  beforeEach(() => {
    mockPlugin = PluginFactory.createMockPlugin({
      statusManager: {
        isCompletedStatus: jest.fn((status) => status === 'done'),
        getCompletedStatuses: jest.fn(() => ['done', 'completed'])
      },
      getActiveTimeSession: jest.fn(),
      cacheManager: {
        updateTaskInfoInCache: jest.fn().mockResolvedValue(undefined),
        getTaskInfo: jest.fn(),
        clearCacheEntry: jest.fn()
      }
    });
    
    // Add the missing method from main.ts
    mockPlugin.isRecurringTaskCompleteForDate = jest.fn((task: TaskInfo, date: Date) => {
      if (!task.recurrence) return false;
      const dateStr = formatDateForStorage(date);
      const completeInstances = Array.isArray(task.complete_instances) ? task.complete_instances : [];
      return completeInstances.includes(dateStr);
    });
    
    taskService = new TaskService(mockPlugin);
  });

  test('should store correct date in complete_instances when marking task complete in AEST timezone', async () => {
    // Setup: Create a recurring task
    const recurringTask: TaskInfo = {
      title: 'Test Recurring Task',
      status: 'open',
      priority: 'medium',
      path: 'test-recurring-task.md',
      tags: ['task'],
      recurrence: 'FREQ=DAILY',
      complete_instances: [],
      archived: false,
      dateCreated: '2025-07-27T12:00:00Z',
      dateModified: '2025-07-27T12:00:00Z'
    };

    // Mock the current time to be 10:00 AM AEST on July 28, 2025
    // AEST is UTC+10, so 10:00 AM AEST = 00:00 UTC the same day
    const aestTime = new Date('2025-07-28T00:00:00.000Z'); // 10:00 AM AEST = 00:00 UTC
    
    // Mock the plugin's selectedDate to be July 28, 2025 in the user's local time
    mockPlugin.selectedDate = aestTime;

    // Act: Toggle the recurring task to complete for July 28, 2025
    const updatedTask = await taskService.toggleRecurringTaskComplete(recurringTask, aestTime);

    // Assert: The complete_instances should contain "2025-07-28", not "2025-07-27"
    const expectedDateString = '2025-07-28';
    const actualCompleteInstances = updatedTask.complete_instances || [];
    
    // This test should FAIL when the bug is present
    expect(actualCompleteInstances).toContain(expectedDateString);
    expect(actualCompleteInstances).not.toContain('2025-07-27');
    
    // Additional validation: Ensure formatDateForStorage works correctly
    const formattedDate = formatDateForStorage(aestTime);
    expect(formattedDate).toBe('2025-07-28');
  });

  test('should demonstrate the before/after behavior of the timezone fix', async () => {
    // Setup: Create a recurring task
    const recurringTask: TaskInfo = {
      title: 'Edge Case Task',
      status: 'open', 
      priority: 'medium',
      path: 'edge-case-task.md',
      tags: ['task'],
      recurrence: 'FREQ=DAILY',
      complete_instances: [],
      archived: false,
      dateCreated: '2025-07-27T12:00:00Z',
      dateModified: '2025-07-27T12:00:00Z'
    };

    // Test 1: The OLD buggy behavior (when calendar created local timezone dates)
    // This is what the calendar used to create for "July 28" click in AEST timezone
    const oldBuggyDate = new Date('2025-07-27T14:00:00.000Z'); // July 28 AEST = July 27 14:00 UTC
    const updatedTaskOld = await taskService.toggleRecurringTaskComplete({...recurringTask}, oldBuggyDate);
    const oldCompleteInstances = updatedTaskOld.complete_instances || [];
    
    console.log('OLD BUGGY BEHAVIOR:');
    console.log('  Calendar created (July 28 AEST):', oldBuggyDate.toISOString());
    console.log('  formatDateForStorage result:', formatDateForStorage(oldBuggyDate));
    console.log('  Stored in complete_instances:', oldCompleteInstances);
    
    // Test 2: The NEW fixed behavior (when calendar creates UTC dates)
    // This is what the fixed calendar now creates for "July 28" click
    const newFixedDate = new Date('2025-07-28T00:00:00.000Z'); // July 28 UTC
    const updatedTaskNew = await taskService.toggleRecurringTaskComplete({...recurringTask}, newFixedDate);
    const newCompleteInstances = updatedTaskNew.complete_instances || [];
    
    console.log('NEW FIXED BEHAVIOR:');
    console.log('  Calendar creates (July 28 UTC):', newFixedDate.toISOString());
    console.log('  formatDateForStorage result:', formatDateForStorage(newFixedDate));
    console.log('  Stored in complete_instances:', newCompleteInstances);
    
    // Assert: With our fixes, both now store the correct date
    expect(oldCompleteInstances).toContain('2025-07-28'); // Fixed: now stores correct date
    expect(newCompleteInstances).toContain('2025-07-28'); // Fixed: stores correct date
    expect(oldCompleteInstances).not.toContain('2025-07-27'); // Fixed: no wrong date
    expect(newCompleteInstances).not.toContain('2025-07-27'); // Fixed: no wrong date
  });

  test('should reproduce the exact scenario from the issue report', async () => {
    // Setup: Reproduce the exact conditions from the bug report
    const recurringTask: TaskInfo = {
      title: 'Bug Report Task',
      status: 'open',
      priority: 'medium', 
      path: 'bug-report-task.md',
      tags: ['task'],
      recurrence: 'FREQ=DAILY',
      complete_instances: [],
      archived: false,
      dateCreated: '2025-07-27T12:00:00Z',
      dateModified: '2025-07-27T12:00:00Z'
    };

    // The user reported marking complete at 10:00 AEST on July 28, 2025
    // 10:00 AM AEST = 00:00 UTC on the same day (July 28)
    const userActionTime = new Date('2025-07-28T00:00:00.000Z');

    // Act: Mark the task complete (this is where the bug occurs)
    const updatedTask = await taskService.toggleRecurringTaskComplete(recurringTask, userActionTime);

    // Assert: This should FAIL if the bug is present
    // The bug would cause "2025-07-27" to be stored instead of "2025-07-28"
    const actualCompleteInstances = updatedTask.complete_instances || [];
    
    // The correct behavior: should store "2025-07-28"
    expect(actualCompleteInstances).toContain('2025-07-28');
    
    // The bug behavior: should NOT store "2025-07-27" 
    expect(actualCompleteInstances).not.toContain('2025-07-27');
    
    // Verify the task should appear as completed in the Agenda view for July 28
    const isCompleteForCorrectDate = mockPlugin.isRecurringTaskCompleteForDate(updatedTask, userActionTime);
    expect(isCompleteForCorrectDate).toBe(true);
    
    // Verify the task should NOT appear as completed for July 27
    const july27 = new Date('2025-07-27T00:00:00.000Z');
    const isCompleteForWrongDate = mockPlugin.isRecurringTaskCompleteForDate(updatedTask, july27);
    expect(isCompleteForWrongDate).toBe(false);
  });

  test('should maintain consistency across different views (Agenda, Kanban, Tasks)', async () => {
    // This test ensures that the date formatting is consistent across all views
    // mentioned in the issue comments (Agenda, Kanban, inline Tasks, Tasks view)
    
    const recurringTask: TaskInfo = {
      title: 'Multi-View Task',
      status: 'open',
      priority: 'medium',
      path: 'multi-view-task.md', 
      tags: ['task'],
      recurrence: 'FREQ=DAILY',
      complete_instances: [],
      archived: false,
      dateCreated: '2025-07-27T12:00:00Z',
      dateModified: '2025-07-27T12:00:00Z'
    };

    const targetDate = new Date('2025-07-28T05:00:00.000Z'); // 3 PM AEST July 28

    // Act: Mark task complete
    const updatedTask = await taskService.toggleRecurringTaskComplete(recurringTask, targetDate);

    // Assert: All views should see the same completion state
    const expectedDateString = '2025-07-28';
    const actualCompleteInstances = updatedTask.complete_instances || [];

    // The core completion data should be correct
    expect(actualCompleteInstances).toContain(expectedDateString);

    // Simulate what each view would check:
    
    // 1. Agenda View - uses formatDateForStorage(targetDate)
    const agendaViewDate = formatDateForStorage(targetDate);
    expect(agendaViewDate).toBe(expectedDateString);
    expect(actualCompleteInstances.includes(agendaViewDate)).toBe(true);

    // 2. Tasks View - uses isRecurringTaskCompleteForDate
    const tasksViewComplete = mockPlugin.isRecurringTaskCompleteForDate(updatedTask, targetDate);
    expect(tasksViewComplete).toBe(true);

    // 3. Kanban View - should show same completion state
    const kanbanViewComplete = actualCompleteInstances.includes(formatDateForStorage(targetDate));
    expect(kanbanViewComplete).toBe(true);

    // 4. Inline Tasks - should also show same completion state  
    const inlineTasksComplete = actualCompleteInstances.includes(formatDateForStorage(targetDate));
    expect(inlineTasksComplete).toBe(true);

    // All views should agree on the completion state
    expect(tasksViewComplete).toBe(kanbanViewComplete);
    expect(kanbanViewComplete).toBe(inlineTasksComplete);
  });
});