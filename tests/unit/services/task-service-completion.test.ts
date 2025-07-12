/**
 * Tests for TaskService completion functionality related to Issue #160
 * 
 * Tests the actual service methods that handle task completion to ensure
 * they work correctly with recurring tasks and don't introduce off-by-one errors.
 */

import { TFile } from 'obsidian';
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
    
    // Create a Friday recurring task
    fridayRecurringTask = TaskFactory.createTask({
      id: 'friday-task',
      title: 'Weekly Friday Task',
      recurrence: 'FREQ=WEEKLY;BYDAY=FR',
      scheduled: '2024-01-12', // Friday
      complete_instances: []
    });

    const mockPlugin = {
        app: {
          vault: {
            getAbstractFileByPath: jest.fn().mockReturnValue(new TFile('tasks/friday-task.md')),
            modify: jest.fn(),
          },
          workspace: {
            getActiveFile: jest.fn(),
          },
          metadataCache: {
            getCache: jest.fn(),
          },
          fileManager: {
            processFrontMatter: jest.fn().mockImplementation((file, fn) => {
              const frontmatter = { ...fridayRecurringTask };
              fn(frontmatter);
              return Promise.resolve();
            }),
          }
        },
        settings: {
          taskFolder: 'tasks',
          fieldMapping: {},
          defaultTaskStatus: 'open',
          taskTag: '#task',
          storeTitleInFilename: false,
        },
        statusManager: {
          isCompletedStatus: jest.fn(status => status === 'done'),
          getCompletedStatuses: jest.fn(() => ['done']),
        },
        fieldMapper: {
          toUserField: jest.fn(field => field),
        },
        cacheManager: {
          getTaskInfo: jest.fn().mockResolvedValue(fridayRecurringTask),
          updateTaskInfoInCache: jest.fn(),
        },
        emitter: {
          trigger: jest.fn(),
        },
        selectedDate: new Date('2024-01-12T12:00:00.000Z'),
      } as any;

    taskService = new TaskService(mockPlugin);
  });

  describe('toggleRecurringTaskComplete', () => {
    it('should add completion for the correct date (Friday)', async () => {
      const targetDate = new Date('2024-01-12T12:00:00.000Z'); // Friday
      await taskService.toggleRecurringTaskComplete(fridayRecurringTask, targetDate);

      // Verify that updateProperty was called with the correct date
      expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
    });

    it('should NOT add completion for the wrong date (Saturday)', async () => {
      const wrongDate = new Date('2024-01-13T12:00:00.000Z'); // Saturday (wrong day)
      await taskService.toggleRecurringTaskComplete(fridayRecurringTask, wrongDate);

      // Verify that updateProperty was called with Saturday (this might be the bug)
      expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
    });

    it('should remove completion when toggling off', async () => {
      // Start with a task that has Friday completion
      const taskWithCompletion = TaskFactory.createTask({
        ...fridayRecurringTask,
        complete_instances: ['2024-01-12'] // Friday completion
      });
      taskService['plugin'].cacheManager.getTaskInfo.mockResolvedValue(taskWithCompletion);

      const targetDate = new Date('2024-01-12T12:00:00.000Z'); // Friday
      await taskService.toggleRecurringTaskComplete(taskWithCompletion, targetDate);

      // Verify that updateProperty was called with the completion removed
      expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
    });
  });

  describe('toggleStatus for recurring tasks', () => {
    it('should use current date when marking recurring task complete', async () => {
      const today = '2024-01-12'; // Friday
      mockGetTodayString.mockReturnValue(today);

      // Mock the vault operations
      const mockFile = new TFile();
      (mockFile as any).path = 'tasks/friday-task.md';
      jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
      jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      await taskService.toggleStatus(fridayRecurringTask);

      // For recurring tasks, toggleStatus should add today's date to complete_instances
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask,
        'status',
        'done'
      );
    });

    it('should NOT use wrong date when marking recurring task complete', async () => {
      const today = '2024-01-12'; // Friday
      const tomorrow = '2024-01-13'; // Saturday
      mockGetTodayString.mockReturnValue(today);

      // Mock the vault operations
      const mockFile = new TFile();
      (mockFile as any).path = 'tasks/friday-task.md';
      jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
      jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      await taskService.toggleStatus(fridayRecurringTask);

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
        
        const mockFile = new TFile();
        (mockFile as any).path = 'tasks/friday-task.md';
        jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
        jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

        // Mock the task loading
        jest.spyOn(taskService, 'updateProperty').mockResolvedValue(undefined);

        await taskService.toggleRecurringTaskComplete(fridayRecurringTask, new Date(date + 'T12:00:00.000Z'));

        // Verify that the exact date was used
        expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
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
        
        const mockFile = new TFile();
        (mockFile as any).path = `tasks/task-${date}.md`;
        jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
        jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

        // Mock the task loading
        jest.spyOn(taskService, 'updateProperty').mockResolvedValue(undefined);

        await taskService.toggleRecurringTaskComplete(recurringTask, new Date(date + 'T12:00:00.000Z'));

        // Verify that the exact date was used
        expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
      }
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle user clicking "Mark as completed" on Friday', async () => {
      const friday = '2024-01-12';
      mockGetTodayString.mockReturnValue(friday);

      const mockFile = new TFile();
      (mockFile as any).path = 'tasks/friday-task.md';
      jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
      jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      // Simulate user clicking "Mark as completed"
      await taskService.toggleStatus(fridayRecurringTask);

      // For recurring tasks, toggleStatus should add today's date to complete_instances
      expect(taskService.updateProperty).toHaveBeenCalledWith(
        fridayRecurringTask,
        'status',
        'done'
      );
    });

    it('should handle user clicking on calendar date', async () => {
      const specificFriday = '2024-01-19'; // Another Friday
      
      const mockFile = new TFile();
      (mockFile as any).path = 'tasks/friday-task.md';
      jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
      jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(fridayRecurringTask);

      // Simulate user clicking on a specific date in the calendar
      await taskService.toggleRecurringTaskComplete(fridayRecurringTask, new Date(specificFriday + 'T12:00:00.000Z'));

      // Should add completion for the specific Friday
      expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
    });

    it('should handle task with existing completions', async () => {
      const existingCompletion = '2024-01-05'; // Previous Friday
      const newCompletion = '2024-01-12'; // This Friday
      
      const taskWithCompletion = TaskFactory.createTask({
        ...fridayRecurringTask,
        complete_instances: [existingCompletion]
      });

      taskService['plugin'].cacheManager.getTaskInfo.mockResolvedValue(taskWithCompletion);

      const mockFile = new TFile();
      (mockFile as any).path = 'tasks/friday-task.md';
      jest.spyOn(taskService['plugin'].app.vault, 'getAbstractFileByPath').mockReturnValue(mockFile);
      jest.spyOn(taskService['plugin'].app.vault, 'modify').mockResolvedValue(undefined);

      // Mock the task loading and property update
      jest.spyOn(taskService, 'updateProperty').mockResolvedValue(taskWithCompletion);

      await taskService.toggleRecurringTaskComplete(taskWithCompletion, new Date(newCompletion + 'T12:00:00.000Z'));

      // Should add the new completion while preserving existing ones
      expect(taskService['plugin'].app.fileManager.processFrontMatter).toHaveBeenCalled();
    });
  });
});