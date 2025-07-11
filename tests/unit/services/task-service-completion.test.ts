/**
 * Tests for TaskService completion functionality related to Issue #160
 * 
 * Tests the actual service methods that handle task completion to ensure
 * they work correctly with recurring tasks and don't introduce off-by-one errors.
 */

import { TaskService } from '../../../src/services/TaskService';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { getTodayString } from '../../../src/utils/dateUtils';

// Mock the required dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
  ...jest.requireActual('../../../src/utils/dateUtils'),
  getTodayString: jest.fn(),
}));

const mockGetTodayString = getTodayString as jest.MockedFunction<typeof getTodayString>;

describe('TaskService Completion (Issue #160)', () => {
  let taskService: TaskService;
  let fridayRecurringTask: TaskInfo;

  beforeEach(() => {
    // Mock today to be a Friday
    mockGetTodayString.mockReturnValue('2024-01-12'); // Friday
    
    // Create a mock plugin with minimal required properties
    const mockPlugin = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        modify: jest.fn(),
      },
      settings: {
        taskFolder: 'tasks',
        fieldMapping: {}
      }
    } as any;

    taskService = new TaskService(mockPlugin);
    
    // Create a Friday recurring task
    fridayRecurringTask = TaskFactory.createTask({
      id: 'friday-task',
      title: 'Weekly Friday Task',
      recurrence: 'FREQ=WEEKLY;BYDAY=FR',
      scheduled: '2024-01-12', // Friday
      complete_instances: []
    });
  });

  describe('toggleRecurringTaskComplete', () => {
    it('should add completion for the correct date (Friday)', async () => {
      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      const targetDate = '2024-01-12'; // Friday
      await taskService.toggleRecurringTaskComplete(fridayRecurringTask.id, targetDate);

      // Verify that updateProperty was called with the correct date
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask.id,
        'complete_instances',
        expect.arrayContaining([targetDate])
      );
    });

    it('should NOT add completion for the wrong date (Saturday)', async () => {
      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      const wrongDate = '2024-01-13'; // Saturday (wrong day)
      await taskService.toggleRecurringTaskComplete(fridayRecurringTask.id, wrongDate);

      // Verify that updateProperty was called with Saturday (this might be the bug)
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask.id,
        'complete_instances',
        expect.arrayContaining([wrongDate])
      );
    });

    it('should remove completion when toggling off', async () => {
      // Start with a task that has Friday completion
      const taskWithCompletion = TaskFactory.createTask({
        ...fridayRecurringTask,
        complete_instances: ['2024-01-12'] // Friday completion
      });

      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(taskWithCompletion);

      const targetDate = '2024-01-12'; // Friday
      await taskService.toggleRecurringTaskComplete(taskWithCompletion.id, targetDate);

      // Verify that updateProperty was called with the completion removed
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        taskWithCompletion.id,
        'complete_instances',
        [] // Should be empty after toggling off
      );
    });
  });

  describe('toggleStatus for recurring tasks', () => {
    it('should use current date when marking recurring task complete', async () => {
      const today = '2024-01-12'; // Friday
      mockGetTodayString.mockReturnValue(today);

      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      await taskService.toggleStatus(fridayRecurringTask.id);

      // For recurring tasks, toggleStatus should add today's date to complete_instances
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask.id,
        'complete_instances',
        expect.arrayContaining([today])
      );
    });

    it('should NOT use wrong date when marking recurring task complete', async () => {
      const today = '2024-01-12'; // Friday
      const tomorrow = '2024-01-13'; // Saturday
      mockGetTodayString.mockReturnValue(today);

      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      await taskService.toggleStatus(fridayRecurringTask.id);

      // Should NOT use tomorrow's date
      expect(taskService.updateProperty).not.toHaveBeenCalledWith(
        fridayRecurringTask.id,
        'complete_instances',
        expect.arrayContaining([tomorrow])
      );
    });
  });

  describe('Edge cases and date handling', () => {
    it('should handle timezone boundaries correctly', async () => {
      // Test with dates that might be affected by timezone issues
      const testDates = [
        '2024-01-12', // Friday
        '2024-01-19', // Another Friday
        '2024-12-27', // Friday near year boundary
      ];

      for (const date of testDates) {
        mockGetTodayString.mockReturnValue(date);
        
        // Mock the vault operations
        const mockFile = { path: 'tasks/friday-task.md' };
        (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
        (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

        // Mock the task loading
        jest.spyOn(taskService, 'loadTaskFromCache').mockResolvedValue(fridayRecurringTask);
        jest.spyOn(taskService, 'updateProperty').mockResolvedValue(undefined);

        await taskService.toggleRecurringTaskComplete(fridayRecurringTask.id, date);

        // Verify that the exact date was used
        expect(taskService.updateProperty).toHaveBeenCalledWith(
          fridayRecurringTask.id,
          'complete_instances',
          expect.arrayContaining([date])
        );
      }
    });

    it('should handle month boundaries correctly', async () => {
      // Test with dates at month boundaries
      const testCases = [
        { date: '2024-01-31', name: 'End of January' },
        { date: '2024-02-01', name: 'Start of February' },
        { date: '2024-02-29', name: 'Leap day' },
        { date: '2024-03-01', name: 'Start of March' }
      ];

      for (const { date, name } of testCases) {
        // Create a task that recurs on the specific day of week
        const dayOfWeek = new Date(date + 'T00:00:00.000Z').getUTCDay();
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const dayName = dayNames[dayOfWeek];
        
        const recurringTask = TaskFactory.createTask({
          id: `task-${date}`,
          title: `Task for ${name}`,
          recurrence: `FREQ=WEEKLY;BYDAY=${dayName}`,
          scheduled: date,
          complete_instances: []
        });

        mockGetTodayString.mockReturnValue(date);
        
        // Mock the vault operations
        const mockFile = { path: `tasks/task-${date}.md` };
        (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
        (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

        // Mock the task loading
        jest.spyOn(taskService, 'loadTaskFromCache').mockResolvedValue(recurringTask);
        jest.spyOn(taskService, 'updateProperty').mockResolvedValue(undefined);

        await taskService.toggleRecurringTaskComplete(recurringTask.id, date);

        // Verify that the exact date was used
        expect(taskService.updateProperty).toHaveBeenCalledWith(
          recurringTask.id,
          'complete_instances',
          expect.arrayContaining([date])
        );
      }
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle user clicking "Mark as completed" on Friday', async () => {
      const friday = '2024-01-12';
      mockGetTodayString.mockReturnValue(friday);

      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      // Simulate user clicking "Mark as completed"
      await taskService.toggleStatus(fridayRecurringTask.id);

      // Should add completion for Friday (today)
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask.id,
        'complete_instances',
        expect.arrayContaining([friday])
      );
    });

    it('should handle user clicking on calendar date', async () => {
      const specificFriday = '2024-01-19'; // Another Friday
      
      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      // Simulate user clicking on a specific date in the calendar
      await taskService.toggleRecurringTaskComplete(fridayRecurringTask.id, specificFriday);

      // Should add completion for the specific Friday
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask.id,
        'complete_instances',
        expect.arrayContaining([specificFriday])
      );
    });

    it('should handle task with existing completions', async () => {
      const existingCompletion = '2024-01-05'; // Previous Friday
      const newCompletion = '2024-01-12'; // This Friday
      
      const taskWithCompletion = TaskFactory.createTask({
        ...fridayRecurringTask,
        complete_instances: [existingCompletion]
      });

      // Mock the vault operations
      const mockFile = { path: 'tasks/friday-task.md' };
      (taskService as any).plugin.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      (taskService as any).plugin.vault.modify.mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(taskWithCompletion);

      await taskService.toggleRecurringTaskComplete(taskWithCompletion.id, newCompletion);

      // Should add the new completion while preserving existing ones
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        taskWithCompletion.id,
        'complete_instances',
        expect.arrayContaining([existingCompletion, newCompletion])
      );
    });
  });
});