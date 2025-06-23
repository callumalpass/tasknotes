/**
 * Task Management Workflow Integration Tests
 * 
 * Tests complete task management workflows including:
 * - Task editing and updates
 * - Status changes and completion
 * - Recurring task management
 * - Time tracking workflows
 * - Task archiving and deletion
 * - Bulk operations
 * - Cross-view synchronization
 * - Error handling and recovery
 */

import { TaskEditModal } from '../../src/modals/TaskEditModal';
import { TaskService } from '../../src/services/TaskService';
import { CacheManager } from '../../src/services/CacheManager';
import { TestEnvironment, WorkflowTester } from '../helpers/integration-helpers';
import { TaskFactory } from '../helpers/mock-factories';
import { TaskInfo } from '../../src/types';
import { MockObsidian, TFile, Notice } from '../__mocks__/obsidian';

// Mock external dependencies
jest.mock('obsidian');
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    }
    return date.toISOString();
  })
}));

jest.mock('../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-15T10:00:00.000+00:00'),
  getCurrentDateString: jest.fn(() => '2025-01-15'),
  hasTimeComponent: jest.fn((date) => date?.includes('T')),
  getDatePart: jest.fn((date) => date?.split('T')[0] || date),
  getTimePart: jest.fn((date) => date?.includes('T') ? '10:00' : null),
  isTodayTimeAware: jest.fn((date) => date?.includes('2025-01-15')),
  isOverdueTimeAware: jest.fn((date) => date?.includes('2020-01-01'))
}));

jest.mock('../../src/utils/helpers', () => ({
  getEffectiveTaskStatus: jest.fn((task, date) => {
    if (task.recurrence && task.complete_instances?.includes('2025-01-15')) {
      return 'done';
    }
    return task.status || 'open';
  }),
  calculateTotalTimeSpent: jest.fn((entries) => 
    entries?.reduce((sum: number, entry: any) => sum + (entry.duration || 30), 0) || 0
  )
}));

describe('Task Management Workflow Integration', () => {
  let testEnv: TestEnvironment;
  let workflowTester: WorkflowTester;

  beforeEach(async () => {
    jest.clearAllMocks();
    MockObsidian.reset();
    
    testEnv = new TestEnvironment();
    await testEnv.setup();
    
    workflowTester = new WorkflowTester(testEnv);
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(async () => {
    await testEnv.cleanup();
    jest.restoreAllMocks();
  });

  describe('Task Editing Workflows', () => {
    it('should edit task through modal and update all systems', async () => {
      const originalTask = TaskFactory.createTask({
        title: 'Original Task',
        priority: 'normal',
        status: 'open',
        due: '2025-01-20'
      });

      const updates = {
        title: 'Updated Task Title',
        priority: 'high',
        status: 'in-progress',
        due: '2025-01-25T14:00',
        contexts: ['work', 'urgent'],
        tags: ['updated']
      };

      const result = await workflowTester.testTaskEdit({
        originalTask,
        updates,
        expectedChanges: updates
      });

      expect(result.success).toBe(true);
      expect(result.taskUpdated).toBe(true);
      expect(result.fileModified).toBe(true);
      expect(result.cacheRefreshed).toBe(true);
      expect(result.uiUpdated).toBe(true);
      
      expect(testEnv.mockPlugin.taskService.updateTask).toHaveBeenCalledWith(
        originalTask.path,
        expect.objectContaining(updates)
      );
    });

    it('should handle partial task updates', async () => {
      const originalTask = TaskFactory.createTask({
        title: 'Task to partially update',
        priority: 'normal',
        contexts: ['home'],
        tags: ['original']
      });

      const partialUpdates = {
        priority: 'high',
        due: '2025-01-30'
      };

      const result = await workflowTester.testTaskEdit({
        originalTask,
        updates: partialUpdates,
        expectedChanges: partialUpdates,
        preserveExisting: true
      });

      expect(result.success).toBe(true);
      expect(testEnv.mockPlugin.taskService.updateTask).toHaveBeenCalledWith(
        originalTask.path,
        expect.objectContaining({
          ...partialUpdates,
          title: originalTask.title, // Should preserve
          contexts: originalTask.contexts, // Should preserve
          tags: originalTask.tags // Should preserve
        })
      );
    });

    it('should validate edits before applying', async () => {
      const originalTask = TaskFactory.createTask({
        title: 'Valid task'
      });

      const invalidUpdates = {
        title: '', // Invalid: empty title
        priority: 'invalid-priority'
      };

      const result = await workflowTester.testTaskEdit({
        originalTask,
        updates: invalidUpdates,
        expectValidationError: true
      });

      expect(result.success).toBe(false);
      expect(result.validationError).toBeTruthy();
      expect(testEnv.mockPlugin.taskService.updateTask).not.toHaveBeenCalled();
    });

    it('should handle edit conflicts gracefully', async () => {
      const originalTask = TaskFactory.createTask({
        title: 'Conflicted task',
        dateModified: '2025-01-15T10:00:00.000Z'
      });

      // Mock file modified externally
      testEnv.mockPlugin.taskService.updateTask.mockRejectedValueOnce(
        new Error('File was modified externally')
      );

      const updates = {
        title: 'Updated title'
      };

      const result = await workflowTester.testTaskEdit({
        originalTask,
        updates,
        expectConflict: true
      });

      expect(result.success).toBe(false);
      expect(result.conflictDetected).toBe(true);
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining('File was modified externally')
      );
    });
  });

  describe('Status Management Workflows', () => {
    it('should update task status and refresh dependent views', async () => {
      const task = TaskFactory.createTask({
        title: 'Status test task',
        status: 'open'
      });

      const result = await workflowTester.testStatusChange({
        task,
        newStatus: 'done',
        expectedStatusUpdate: 'done',
        expectCompletionDate: true
      });

      expect(result.success).toBe(true);
      expect(result.statusUpdated).toBe(true);
      expect(result.completionDateSet).toBe(true);
      expect(result.viewsRefreshed).toBe(true);
      
      expect(testEnv.mockPlugin.taskService.updateTaskProperty).toHaveBeenCalledWith(
        task,
        'status',
        'done'
      );
    });

    it('should cycle through available statuses', async () => {
      const task = TaskFactory.createTask({
        title: 'Cycling task',
        status: 'open'
      });

      testEnv.mockPlugin.statusManager.getNextStatus.mockReturnValue('in-progress');

      const result = await workflowTester.testStatusCycle({
        task,
        expectedNextStatus: 'in-progress'
      });

      expect(result.success).toBe(true);
      expect(result.statusCycled).toBe(true);
      expect(testEnv.mockPlugin.statusManager.getNextStatus).toHaveBeenCalledWith('open');
    });

    it('should handle custom status workflows', async () => {
      const customStatuses = [
        { value: 'todo', label: 'To Do' },
        { value: 'review', label: 'In Review' },
        { value: 'approved', label: 'Approved' },
        { value: 'done', label: 'Done' }
      ];

      testEnv.mockPlugin.settings.customStatuses = customStatuses;
      testEnv.mockPlugin.statusManager.getAllStatuses.mockReturnValue(customStatuses);

      const task = TaskFactory.createTask({
        title: 'Custom status task',
        status: 'todo'
      });

      const result = await workflowTester.testStatusChange({
        task,
        newStatus: 'review',
        expectedStatusUpdate: 'review'
      });

      expect(result.success).toBe(true);
      expect(result.statusUpdated).toBe(true);
    });

    it('should handle bulk status updates', async () => {
      const tasks = [
        TaskFactory.createTask({ title: 'Task 1', status: 'open' }),
        TaskFactory.createTask({ title: 'Task 2', status: 'open' }),
        TaskFactory.createTask({ title: 'Task 3', status: 'in-progress' })
      ];

      const result = await workflowTester.testBulkStatusUpdate({
        tasks,
        newStatus: 'done',
        expectedUpdatedCount: 3
      });

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
      expect(testEnv.mockPlugin.taskService.updateTaskProperty).toHaveBeenCalledTimes(3);
    });
  });

  describe('Recurring Task Management', () => {
    it('should handle recurring task completion for specific date', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
        title: 'Daily recurring task',
        complete_instances: ['2025-01-14'] // Already completed yesterday
      });

      const targetDate = new Date('2025-01-15');

      const result = await workflowTester.testRecurringTaskCompletion({
        task: recurringTask,
        targetDate,
        expectInstanceCompletion: true
      });

      expect(result.success).toBe(true);
      expect(result.instanceCompleted).toBe(true);
      expect(result.taskFileUpdated).toBe(true);
      
      expect(testEnv.mockPlugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(
        recurringTask,
        targetDate
      );
    });

    it('should handle recurring task instance unchecking', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=WEEKLY', {
        title: 'Weekly task',
        complete_instances: ['2025-01-15', '2025-01-08'] // Today and last week completed
      });

      const targetDate = new Date('2025-01-15');

      const result = await workflowTester.testRecurringTaskCompletion({
        task: recurringTask,
        targetDate,
        expectInstanceUncompletion: true
      });

      expect(result.success).toBe(true);
      expect(result.instanceUncompleted).toBe(true);
      expect(result.taskFileUpdated).toBe(true);
    });

    it('should handle recurring task editing without affecting instances', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=WEEKLY;BYDAY=MO,WE,FR', {
        title: 'Recurring meeting prep',
        complete_instances: ['2025-01-13', '2025-01-15'] // Previous completions
      });

      const updates = {
        title: 'Updated recurring meeting prep',
        priority: 'high',
        timeEstimate: 60
      };

      const result = await workflowTester.testTaskEdit({
        originalTask: recurringTask,
        updates,
        expectInstancePreservation: true
      });

      expect(result.success).toBe(true);
      expect(result.instancesPreserved).toBe(true);
      expect(result.taskUpdated).toBe(true);
    });

    it('should validate recurring task pattern changes', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
        title: 'Daily task to modify'
      });

      const recurrenceUpdates = {
        recurrence: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
      };

      const result = await workflowTester.testRecurrenceEdit({
        task: recurringTask,
        newRecurrence: recurrenceUpdates.recurrence,
        expectPatternValidation: true
      });

      expect(result.success).toBe(true);
      expect(result.patternValidated).toBe(true);
      expect(result.recurrenceUpdated).toBe(true);
    });
  });

  describe('Time Tracking Workflows', () => {
    it('should start and stop time tracking', async () => {
      const task = TaskFactory.createTask({
        title: 'Time tracking task',
        timeEntries: []
      });

      // Start time tracking
      const startResult = await workflowTester.testTimeTrackingStart({
        task,
        expectActiveSession: true
      });

      expect(startResult.success).toBe(true);
      expect(startResult.sessionStarted).toBe(true);
      expect(testEnv.mockPlugin.startTimeTracking).toHaveBeenCalledWith(task);

      // Stop time tracking
      const stopResult = await workflowTester.testTimeTrackingStop({
        task,
        expectSessionEnd: true,
        expectTimeEntryCreation: true
      });

      expect(stopResult.success).toBe(true);
      expect(stopResult.sessionEnded).toBe(true);
      expect(stopResult.timeEntryCreated).toBe(true);
      expect(testEnv.mockPlugin.stopTimeTracking).toHaveBeenCalledWith(task);
    });

    it('should handle time tracking with existing entries', async () => {
      const existingTimeEntries = [
        {
          startTime: '2025-01-14T09:00:00Z',
          endTime: '2025-01-14T10:30:00Z',
          description: 'Previous session',
          duration: 90
        },
        {
          startTime: '2025-01-14T14:00:00Z',
          endTime: '2025-01-14T15:15:00Z',
          description: 'Another session',
          duration: 75
        }
      ];

      const task = TaskFactory.createTask({
        title: 'Task with existing time',
        timeEntries: existingTimeEntries,
        timeEstimate: 240 // 4 hours estimated
      });

      const result = await workflowTester.testTimeTrackingWithHistory({
        task,
        expectTotalCalculation: true,
        expectedTotalMinutes: 165, // 90 + 75
        expectProgressCalculation: true
      });

      expect(result.success).toBe(true);
      expect(result.totalCalculated).toBe(true);
      expect(result.progressCalculated).toBe(true);
      expect(result.totalMinutes).toBe(165);
    });

    it('should handle concurrent time tracking prevention', async () => {
      const task1 = TaskFactory.createTask({ title: 'Task 1' });
      const task2 = TaskFactory.createTask({ title: 'Task 2' });

      // Mock active session for task1
      testEnv.mockPlugin.getActiveTimeSession.mockImplementation((task) => {
        if (task.path === task1.path) {
          return { startTime: '2025-01-15T10:00:00Z' };
        }
        return null;
      });

      const result = await workflowTester.testConcurrentTimeTracking({
        activeTask: task1,
        newTask: task2,
        expectActiveSessionStop: true,
        expectNewSessionStart: true
      });

      expect(result.success).toBe(true);
      expect(result.previousSessionStopped).toBe(true);
      expect(result.newSessionStarted).toBe(true);
    });
  });

  describe('Task Archiving and Deletion', () => {
    it('should archive task and update views', async () => {
      const task = TaskFactory.createTask({
        title: 'Task to archive',
        archived: false
      });

      const result = await workflowTester.testTaskArchiving({
        task,
        expectArchive: true,
        expectViewUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.taskArchived).toBe(true);
      expect(result.viewsUpdated).toBe(true);
      expect(testEnv.mockPlugin.toggleTaskArchive).toHaveBeenCalledWith(task);
    });

    it('should unarchive task and restore to active views', async () => {
      const archivedTask = TaskFactory.createTask({
        title: 'Archived task',
        archived: true
      });

      const result = await workflowTester.testTaskArchiving({
        task: archivedTask,
        expectUnarchive: true,
        expectViewUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.taskUnarchived).toBe(true);
      expect(result.viewsUpdated).toBe(true);
    });

    it('should delete task with confirmation', async () => {
      const task = TaskFactory.createTask({
        title: 'Task to delete'
      });

      const result = await workflowTester.testTaskDeletion({
        task,
        confirmDeletion: true,
        expectFileRemoval: true,
        expectCacheUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.taskDeleted).toBe(true);
      expect(result.fileRemoved).toBe(true);
      expect(result.cacheUpdated).toBe(true);
      expect(testEnv.mockPlugin.taskService.deleteTask).toHaveBeenCalledWith(task);
    });

    it('should cancel task deletion when not confirmed', async () => {
      const task = TaskFactory.createTask({
        title: 'Task deletion cancelled'
      });

      const result = await workflowTester.testTaskDeletion({
        task,
        confirmDeletion: false,
        expectCancellation: true
      });

      expect(result.success).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.deletionCancelled).toBe(true);
      expect(testEnv.mockPlugin.taskService.deleteTask).not.toHaveBeenCalled();
    });

    it('should handle bulk task operations', async () => {
      const tasks = [
        TaskFactory.createTask({ title: 'Bulk task 1' }),
        TaskFactory.createTask({ title: 'Bulk task 2' }),
        TaskFactory.createTask({ title: 'Bulk task 3' })
      ];

      const result = await workflowTester.testBulkTaskOperation({
        tasks,
        operation: 'archive',
        expectBulkConfirmation: true,
        expectedProcessedCount: 3
      });

      expect(result.success).toBe(true);
      expect(result.bulkConfirmationShown).toBe(true);
      expect(result.processedCount).toBe(3);
      expect(testEnv.mockPlugin.toggleTaskArchive).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cross-View Synchronization', () => {
    it('should synchronize task updates across all open views', async () => {
      const task = TaskFactory.createTask({
        title: 'Sync test task'
      });

      // Mock multiple views being open
      const mockViews = [
        { viewType: 'task-list', refresh: jest.fn() },
        { viewType: 'calendar', refresh: jest.fn() },
        { viewType: 'kanban', refresh: jest.fn() }
      ];

      testEnv.mockApp.workspace.iterateAllLeaves.mockImplementation((callback) => {
        mockViews.forEach(view => {
          callback({ view });
        });
      });

      const result = await workflowTester.testCrossViewSync({
        task,
        updates: { title: 'Updated sync task', priority: 'high' },
        expectedViewRefreshCount: 3
      });

      expect(result.success).toBe(true);
      expect(result.viewsRefreshed).toBe(3);
      mockViews.forEach(view => {
        expect(view.refresh).toHaveBeenCalled();
      });
    });

    it('should handle view-specific update optimizations', async () => {
      const task = TaskFactory.createTask({
        title: 'Optimization test',
        scheduled: '2025-01-15'
      });

      const result = await workflowTester.testViewSpecificUpdates({
        task,
        updates: { scheduled: '2025-01-20' },
        expectCalendarRefresh: true,
        expectListRefresh: false // Optimization: list doesn't need refresh for date change
      });

      expect(result.success).toBe(true);
      expect(result.calendarRefreshed).toBe(true);
      expect(result.listRefreshed).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary file system errors', async () => {
      const task = TaskFactory.createTask({
        title: 'Recovery test task'
      });

      // Mock temporary file system error
      testEnv.mockPlugin.taskService.updateTask
        .mockRejectedValueOnce(new Error('EACCES: permission denied'))
        .mockResolvedValueOnce({ file: new TFile('test.md') });

      const result = await workflowTester.testErrorRecovery({
        task,
        updates: { title: 'Updated after error' },
        expectRetry: true,
        expectEventualSuccess: true
      });

      expect(result.success).toBe(true);
      expect(result.retryAttempted).toBe(true);
      expect(result.eventuallySucceeded).toBe(true);
      expect(testEnv.mockPlugin.taskService.updateTask).toHaveBeenCalledTimes(2);
    });

    it('should handle cache corruption gracefully', async () => {
      const task = TaskFactory.createTask({
        title: 'Cache corruption test'
      });

      // Mock cache corruption
      testEnv.mockPlugin.cacheManager.getTaskInfo.mockRejectedValueOnce(
        new Error('Cache corrupted')
      );

      const result = await workflowTester.testCacheCorruptionRecovery({
        task,
        expectCacheRebuild: true,
        expectDataRecovery: true
      });

      expect(result.success).toBe(true);
      expect(result.cacheRebuilt).toBe(true);
      expect(result.dataRecovered).toBe(true);
      expect(testEnv.mockPlugin.cacheManager.rebuildCache).toHaveBeenCalled();
    });

    it('should maintain data integrity during concurrent operations', async () => {
      const task = TaskFactory.createTask({
        title: 'Concurrency test task'
      });

      // Simulate concurrent edits
      const concurrentOperations = [
        () => workflowTester.testTaskEdit({
          originalTask: task,
          updates: { priority: 'high' }
        }),
        () => workflowTester.testStatusChange({
          task,
          newStatus: 'in-progress'
        }),
        () => workflowTester.testTimeTrackingStart({ task })
      ];

      const results = await Promise.allSettled(
        concurrentOperations.map(op => op())
      );

      // At least one operation should succeed, data should remain consistent
      const successfulResults = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );

      expect(successfulResults.length).toBeGreaterThan(0);
      expect(testEnv.mockPlugin.taskService.updateTask).toHaveBeenCalled();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large task updates efficiently', async () => {
      const largeTasks = Array.from({ length: 500 }, (_, i) =>
        TaskFactory.createTask({ title: `Large dataset task ${i + 1}` })
      );

      const startTime = Date.now();
      
      const result = await workflowTester.testLargeDatasetPerformance({
        tasks: largeTasks,
        operation: 'bulk-status-update',
        newStatus: 'done'
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.processedCount).toBe(500);
    });

    it('should optimize cache operations during frequent updates', async () => {
      const task = TaskFactory.createTask({
        title: 'Frequent update task'
      });

      // Perform many rapid updates
      const updatePromises = Array.from({ length: 50 }, (_, i) =>
        workflowTester.testTaskEdit({
          originalTask: task,
          updates: { title: `Updated title ${i + 1}` }
        })
      );

      const results = await Promise.all(updatePromises);

      expect(results.every(r => r.success)).toBe(true);
      // Cache should be optimized - not every update should trigger full refresh
      expect(testEnv.mockPlugin.cacheManager.refreshTaskCache.mock.calls.length)
        .toBeLessThan(50);
    });
  });
});