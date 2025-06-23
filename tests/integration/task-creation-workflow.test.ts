/**
 * Task Creation Workflow Integration Tests
 * 
 * Tests complete task creation workflows including:
 * - Natural language task creation
 * - Manual task creation through modal
 * - Task conversion from existing text
 * - File system integration and validation
 * - Cache updates and refresh
 * - UI state management across components
 * - Error handling in complex scenarios
 */

import { TaskCreationModal } from '../../src/modals/TaskCreationModal';
import { TaskService } from '../../src/services/TaskService';
import { NaturalLanguageParser } from '../../src/services/NaturalLanguageParser';
import { CacheManager } from '../../src/services/CacheManager';
import { TestEnvironment, WorkflowTester } from '../helpers/integration-helpers';
import { TaskFactory } from '../helpers/mock-factories';
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
  hasTimeComponent: jest.fn((date) => date?.includes('T')),
  getDatePart: jest.fn((date) => date?.split('T')[0] || date),
  getTimePart: jest.fn((date) => date?.includes('T') ? '10:00' : null),
  validateDateInput: jest.fn(() => true),
  validateDateTimeInput: jest.fn(() => true)
}));

jest.mock('../../src/utils/helpers', () => ({
  ensureFolderExists: jest.fn().mockResolvedValue(undefined),
  generateTaskBodyFromTemplate: jest.fn((template, data) => 
    `# ${data.title}\n\nDetails: ${data.details || 'No details'}`
  ),
  calculateDefaultDate: jest.fn((option) => {
    if (option === 'today') return '2025-01-15';
    if (option === 'tomorrow') return '2025-01-16';
    return '';
  })
}));

jest.mock('../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn((context) => 
    `${context.title.toLowerCase().replace(/\s+/g, '-')}-${context.date.toISOString().split('T')[0]}`
  )
}));

describe('Task Creation Workflow Integration', () => {
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

  describe('Natural Language Task Creation', () => {
    it('should create task from natural language input', async () => {
      const input = 'Buy groceries tomorrow 3pm @home #errands';
      
      const result = await workflowTester.testNaturalLanguageTaskCreation({
        input,
        expectedTitle: 'Buy groceries',
        expectedDueDate: '2025-01-16T15:00',
        expectedContexts: ['home'],
        expectedTags: ['errands']
      });

      expect(result.success).toBe(true);
      expect(result.taskFile).toBeTruthy();
      expect(result.cacheUpdated).toBe(true);
      expect(testEnv.mockPlugin.taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Buy groceries',
          due: '2025-01-16T15:00',
          contexts: ['home'],
          tags: expect.arrayContaining(['task', 'errands'])
        })
      );
    });

    it('should handle complex natural language with multiple elements', async () => {
      const input = 'Schedule team meeting next Monday 2pm for 1.5h @work #important #meeting recurring weekly';
      
      const result = await workflowTester.testNaturalLanguageTaskCreation({
        input,
        expectedTitle: 'Schedule team meeting',
        expectedScheduledDate: '2025-01-20T14:00',
        expectedContexts: ['work'],
        expectedTags: ['important', 'meeting'],
        expectedTimeEstimate: 90,
        expectedRecurrence: 'FREQ=WEEKLY'
      });

      expect(result.success).toBe(true);
      expect(result.taskFile).toBeTruthy();
    });

    it('should handle natural language parsing errors gracefully', async () => {
      // Mock parser to throw error
      testEnv.mockPlugin.nlParser.parseInput.mockImplementationOnce(() => {
        throw new Error('Parse error');
      });

      const input = 'Invalid natural language input $%^&*';
      
      const result = await workflowTester.testNaturalLanguageTaskCreation({
        input,
        expectedTitle: 'Invalid natural language input $%^&*', // Fallback
        expectError: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create task')
      );
    });

    it('should update cache after natural language task creation', async () => {
      const input = 'Review documents @office #urgent';
      
      const result = await workflowTester.testNaturalLanguageTaskCreation({
        input,
        expectedTitle: 'Review documents'
      });

      expect(result.success).toBe(true);
      expect(testEnv.mockPlugin.cacheManager.refreshTaskCache).toHaveBeenCalled();
      expect(testEnv.mockPlugin.cacheManager.updateContextsCache).toHaveBeenCalled();
      expect(testEnv.mockPlugin.cacheManager.updateTagsCache).toHaveBeenCalled();
    });
  });

  describe('Manual Task Creation through Modal', () => {
    it('should create task through detailed form', async () => {
      const taskData = {
        title: 'Complete project proposal',
        priority: 'high',
        status: 'in-progress',
        dueDate: '2025-01-20T17:00',
        scheduledDate: '2025-01-18',
        contexts: ['work', 'urgent'],
        tags: ['proposal', 'deadline'],
        timeEstimate: 180,
        details: 'Need to include budget analysis and timeline',
        recurrence: 'FREQ=MONTHLY;BYMONTHDAY=15'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(true);
      expect(result.taskFile).toBeTruthy();
      expect(testEnv.mockPlugin.taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: taskData.title,
          priority: taskData.priority,
          status: taskData.status,
          due: taskData.dueDate,
          scheduled: taskData.scheduledDate,
          contexts: taskData.contexts,
          tags: expect.arrayContaining(['task', ...taskData.tags]),
          timeEstimate: taskData.timeEstimate,
          details: taskData.details,
          recurrence: taskData.recurrence
        })
      );
    });

    it('should handle form validation errors', async () => {
      const invalidTaskData = {
        title: '', // Invalid: empty title
        priority: 'high'
      };
      
      const result = await workflowTester.testManualTaskCreation(invalidTaskData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title is required');
      expect(testEnv.mockPlugin.taskService.createTask).not.toHaveBeenCalled();
    });

    it('should handle recurrence validation errors', async () => {
      const taskData = {
        title: 'Valid title',
        recurrence: {
          frequency: 'weekly',
          daysOfWeek: [] // Invalid: no days selected for weekly recurrence
        }
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please select at least one day');
    });

    it('should create minimal task with defaults', async () => {
      const minimalTaskData = {
        title: 'Simple task'
      };
      
      const result = await workflowTester.testManualTaskCreation(minimalTaskData);

      expect(result.success).toBe(true);
      expect(testEnv.mockPlugin.taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Simple task',
          status: 'open', // Default status
          priority: 'normal', // Default priority
          tags: ['task'] // Default task tag
        })
      );
    });
  });

  describe('Task Conversion from Existing Text', () => {
    it('should convert Tasks plugin format to TaskNotes', async () => {
      const tasksPluginText = '- [ ] Buy groceries 📅 2025-01-20 ⏫ @home #errands';
      const selectionInfo = {
        taskLine: tasksPluginText,
        details: 'Additional notes about shopping',
        startLine: 5,
        endLine: 6,
        originalContent: [tasksPluginText, 'Additional notes about shopping']
      };
      
      const result = await workflowTester.testTaskConversion({
        originalText: tasksPluginText,
        selectionInfo,
        expectedTitle: 'Buy groceries',
        expectedDueDate: '2025-01-20',
        expectedPriority: 'high',
        expectedContexts: ['home'],
        expectedTags: ['errands']
      });

      expect(result.success).toBe(true);
      expect(result.taskFile).toBeTruthy();
      expect(result.originalTextReplaced).toBe(true);
      expect(result.linkText).toContain('[[');
      expect(result.linkText).toContain('Buy groceries]]');
    });

    it('should handle multi-line task conversion', async () => {
      const multiLineSelection = {
        taskLine: '- [ ] Complex task with multiple lines',
        details: 'Line 1 of details\nLine 2 of details\nLine 3 of details',
        startLine: 10,
        endLine: 13,
        originalContent: [
          '  - [ ] Complex task with multiple lines',
          '    Line 1 of details',
          '    Line 2 of details',
          '    Line 3 of details'
        ]
      };
      
      const result = await workflowTester.testTaskConversion({
        originalText: multiLineSelection.taskLine,
        selectionInfo: multiLineSelection,
        expectedTitle: 'Complex task with multiple lines'
      });

      expect(result.success).toBe(true);
      expect(result.originalTextReplaced).toBe(true);
      // Should preserve original indentation
      expect(result.linkText).toMatch(/^\s\s-\s\[\[/);
    });

    it('should handle conversion errors gracefully', async () => {
      // Mock task service to throw error
      testEnv.mockPlugin.taskService.createTask.mockRejectedValueOnce(
        new Error('File system error')
      );

      const result = await workflowTester.testTaskConversion({
        originalText: '- [ ] Task that will fail',
        expectedTitle: 'Task that will fail',
        expectError: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.originalTextReplaced).toBe(false);
    });
  });

  describe('File System Integration', () => {
    it('should create task file in correct folder structure', async () => {
      testEnv.mockPlugin.settings.tasksFolderPath = 'Tasks/Projects';
      
      const taskData = {
        title: 'Project task'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(true);
      expect(require('../../src/utils/helpers').ensureFolderExists)
        .toHaveBeenCalledWith(expect.anything(), 'Tasks/Projects');
    });

    it('should handle folder creation errors', async () => {
      const mockEnsureFolderExists = require('../../src/utils/helpers').ensureFolderExists;
      mockEnsureFolderExists.mockRejectedValueOnce(new Error('Permission denied'));

      const taskData = {
        title: 'Task with folder error'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should use template for task content generation', async () => {
      testEnv.mockPlugin.settings.taskBodyTemplate = '# {{title}}\n\nPriority: {{priority}}\nStatus: {{status}}\n\n{{details}}';
      
      const taskData = {
        title: 'Template test task',
        priority: 'high',
        details: 'Custom task details'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(true);
      expect(require('../../src/utils/helpers').generateTaskBodyFromTemplate)
        .toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            title: taskData.title,
            priority: taskData.priority,
            details: taskData.details
          })
        );
    });

    it('should handle file naming conflicts', async () => {
      // Mock file already exists
      testEnv.mockApp.vault.adapter.exists.mockResolvedValue(true);
      
      const taskData = {
        title: 'Duplicate task name'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      // Should still succeed by generating unique filename
      expect(result.success).toBe(true);
      expect(result.taskFile).toBeTruthy();
    });
  });

  describe('Cache and State Management', () => {
    it('should refresh all relevant caches after task creation', async () => {
      const taskData = {
        title: 'Cache test task',
        contexts: ['new-context'],
        tags: ['new-tag']
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(true);
      expect(testEnv.mockPlugin.cacheManager.refreshTaskCache).toHaveBeenCalled();
      expect(testEnv.mockPlugin.cacheManager.updateContextsCache).toHaveBeenCalled();
      expect(testEnv.mockPlugin.cacheManager.updateTagsCache).toHaveBeenCalled();
    });

    it('should update calendar view after task creation', async () => {
      // Mock calendar view being open
      const mockCalendarView = {
        refresh: jest.fn()
      };
      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const taskData = {
        title: 'Calendar task',
        scheduledDate: '2025-01-20'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(true);
      expect(mockCalendarView.refresh).toHaveBeenCalled();
    });

    it('should handle concurrent task creation requests', async () => {
      const taskData1 = { title: 'Concurrent task 1' };
      const taskData2 = { title: 'Concurrent task 2' };
      const taskData3 = { title: 'Concurrent task 3' };
      
      const results = await Promise.all([
        workflowTester.testManualTaskCreation(taskData1),
        workflowTester.testManualTaskCreation(taskData2),
        workflowTester.testManualTaskCreation(taskData3)
      ]);

      expect(results.every(r => r.success)).toBe(true);
      expect(testEnv.mockPlugin.taskService.createTask).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should recover from partial task creation failures', async () => {
      // Mock file creation to succeed but cache update to fail
      testEnv.mockPlugin.cacheManager.refreshTaskCache.mockRejectedValueOnce(
        new Error('Cache update failed')
      );

      const taskData = {
        title: 'Partial failure task'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      // Should still report success if task file was created
      expect(result.success).toBe(true);
      expect(result.taskFile).toBeTruthy();
      expect(result.cacheUpdated).toBe(false);
    });

    it('should handle invalid characters in task titles', async () => {
      const taskData = {
        title: 'Task with invalid chars: <>:"|?*\\/[]'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(true);
      // Filename should be sanitized
      expect(require('../../src/utils/filenameGenerator').generateTaskFilename)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            title: taskData.title
          }),
          expect.anything()
        );
    });

    it('should handle very long task titles', async () => {
      const longTitle = 'a'.repeat(300); // Very long title
      const taskData = {
        title: longTitle
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title is too long');
    });

    it('should handle network interruption during creation', async () => {
      // Mock network error
      testEnv.mockPlugin.taskService.createTask.mockRejectedValueOnce(
        new Error('Network timeout')
      );

      const taskData = {
        title: 'Network error task'
      };
      
      const result = await workflowTester.testManualTaskCreation(taskData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create task')
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle rapid task creation efficiently', async () => {
      const startTime = Date.now();
      
      const taskPromises = Array.from({ length: 20 }, (_, i) => 
        workflowTester.testManualTaskCreation({
          title: `Rapid task ${i + 1}`
        })
      );
      
      const results = await Promise.all(taskPromises);
      const endTime = Date.now();

      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
      expect(testEnv.mockPlugin.taskService.createTask).toHaveBeenCalledTimes(20);
    });

    it('should maintain performance with large task datasets', async () => {
      // Pre-populate cache with many tasks
      const existingTasks = Array.from({ length: 1000 }, (_, i) => 
        TaskFactory.createTask({ title: `Existing task ${i + 1}` })
      );
      testEnv.mockPlugin.cacheManager.getAllTasks.mockResolvedValue(existingTasks);

      const taskData = {
        title: 'New task in large dataset'
      };
      
      const startTime = Date.now();
      const result = await workflowTester.testManualTaskCreation(taskData);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should still be fast
    });
  });

  describe('Cross-Component Integration', () => {
    it('should integrate modal, service, and cache components correctly', async () => {
      const taskData = {
        title: 'Integration test task',
        priority: 'high',
        contexts: ['integration-test'],
        tags: ['test']
      };
      
      const result = await workflowTester.testFullIntegrationWorkflow(taskData);

      expect(result.modalCreated).toBe(true);
      expect(result.formPopulated).toBe(true);
      expect(result.validationPassed).toBe(true);
      expect(result.taskServiceCalled).toBe(true);
      expect(result.fileCreated).toBe(true);
      expect(result.cacheUpdated).toBe(true);
      expect(result.uiRefreshed).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should maintain data consistency across all components', async () => {
      const taskData = {
        title: 'Consistency test task',
        dueDate: '2025-01-25T14:30',
        priority: 'high',
        contexts: ['work'],
        recurrence: 'FREQ=WEEKLY;BYDAY=MO'
      };
      
      const result = await workflowTester.testDataConsistency(taskData);

      expect(result.modalData).toEqual(result.serviceData);
      expect(result.serviceData).toEqual(result.fileData);
      expect(result.fileData).toEqual(result.cacheData);
      expect(result.success).toBe(true);
    });
  });
});