/**
 * TaskService Unit Tests
 * 
 * Tests for the core TaskService functionality including:
 * - Task creation with various scenarios
 * - Task property updates
 * - Status toggling and completion handling
 * - Time tracking operations
 * - Bulk task updates
 * - Task deletion
 * - Error handling and edge cases
 */

import { TFile } from 'obsidian';
import { TaskService, TaskCreationData } from '../../../src/services/TaskService';
import { TaskInfo, TimeEntry } from '../../../src/types';
import { TaskFactory, PluginFactory, FileSystemFactory } from '../../helpers/mock-factories';
import { MockObsidian } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
  getCurrentDateString: jest.fn(() => '2025-01-01')
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn((context) => `${context.title.toLowerCase().replace(/\s+/g, '-')}`),
  generateUniqueFilename: jest.fn((base) => base)
}));

jest.mock('../../../src/utils/helpers', () => ({
  ensureFolderExists: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
  processTemplate: jest.fn(() => ({ 
    frontmatter: {}, 
    body: 'Template content' 
  })),
  mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template }))
}));

describe('TaskService', () => {
  let taskService: TaskService;
  let mockPlugin: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    MockObsidian.reset();

    // Create mock plugin with enhanced services
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

    taskService = new TaskService(mockPlugin);
  });

  describe('createTask', () => {
    it('should create a basic task with minimal data', async () => {
      const taskData: TaskCreationData = {
        title: 'Test Task'
      };

      const { file, taskInfo } = await taskService.createTask(taskData);

      expect(file).toBeInstanceOf(TFile);
      expect(taskInfo).toMatchObject({
        title: 'Test Task',
        status: 'open',
        priority: 'normal',
        archived: false
      });
      expect(taskInfo.path).toMatch(/test-task\.md$/);
      expect(taskInfo.dateCreated).toBe('2025-01-01T12:00:00Z');
      expect(taskInfo.dateModified).toBe('2025-01-01T12:00:00Z');
    });

    it('should create a task with all properties', async () => {
      const taskData: TaskCreationData = {
        title: 'Complex Task',
        status: 'in-progress',
        priority: 'high',
        due: '2025-01-15',
        scheduled: '2025-01-10',
        contexts: ['work', 'urgent'],
        timeEstimate: 120,
        recurrence: 'FREQ=DAILY;INTERVAL=1',
        details: 'Task description'
      };

      const { file, taskInfo } = await taskService.createTask(taskData);

      expect(taskInfo).toMatchObject({
        title: 'Complex Task',
        status: 'in-progress',
        priority: 'high',
        due: '2025-01-15',
        scheduled: '2025-01-10',
        contexts: ['work', 'urgent'],
        timeEstimate: 120,
        recurrence: 'FREQ=DAILY;INTERVAL=1'
      });
      expect(taskInfo.tags).toContain('task');
    });

    it('should handle default folder configuration', async () => {
      mockPlugin.settings.taskCreationDefaults.defaultFolder = 'Projects/Tasks';
      
      const taskData: TaskCreationData = {
        title: 'Folder Test Task'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Projects/Tasks/folder-test-task.md',
        expect.stringContaining('title: Folder Test Task')
      );
    });

    it('should apply template when configured', async () => {
      mockPlugin.settings.taskCreationDefaults.useBodyTemplate = true;
      mockPlugin.settings.taskCreationDefaults.bodyTemplate = 'templates/task-template.md';
      
      const mockTemplateFile = new TFile('templates/task-template.md');
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockTemplateFile);
      mockPlugin.app.vault.read.mockResolvedValue('Template content with {{title}}');

      const taskData: TaskCreationData = {
        title: 'Template Task',
        details: 'Custom details'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.read).toHaveBeenCalledWith(mockTemplateFile);
    });

    it('should validate required fields', async () => {
      await expect(taskService.createTask({ title: '' })).rejects.toThrow('Title is required');
      await expect(taskService.createTask({ title: '   ' })).rejects.toThrow('Title is required');
    });

    it('should validate title length', async () => {
      const longTitle = 'A'.repeat(201);
      await expect(taskService.createTask({ title: longTitle })).rejects.toThrow('Title is too long');
    });

    it('should ensure task tag is always included', async () => {
      const taskData: TaskCreationData = {
        title: 'Tag Test Task',
        tags: ['custom', 'tags']
      };

      const { taskInfo } = await taskService.createTask(taskData);

      expect(taskInfo.tags).toEqual(['task', 'custom', 'tags']);
    });

    it('should handle template processing errors gracefully', async () => {
      mockPlugin.settings.taskCreationDefaults.useBodyTemplate = true;
      mockPlugin.settings.taskCreationDefaults.bodyTemplate = 'nonexistent-template.md';
      
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

      const taskData: TaskCreationData = {
        title: 'Template Error Task'
      };

      // Should not throw, but should log warning
      const { taskInfo } = await taskService.createTask(taskData);
      expect(taskInfo.title).toBe('Template Error Task');
    });

    it('should emit task creation event', async () => {
      const taskData: TaskCreationData = {
        title: 'Event Test Task'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.emitter.trigger).toHaveBeenCalledWith('task-updated', {
        path: expect.stringMatching(/event-test-task\.md$/),
        updatedTask: expect.objectContaining({ title: 'Event Test Task' })
      });
    });

    it('should update cache proactively', async () => {
      const taskData: TaskCreationData = {
        title: 'Cache Test Task'
      };

      const { taskInfo } = await taskService.createTask(taskData);

      expect(mockPlugin.cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
        taskInfo.path,
        taskInfo
      );
    });
  });

  describe('toggleStatus', () => {
    it('should toggle from open to completed status', async () => {
      const task = TaskFactory.createTask({ status: 'open' });
      
      const result = await taskService.toggleStatus(task);

      expect(result.status).toBe('done');
    });

    it('should toggle from completed to open status', async () => {
      const task = TaskFactory.createTask({ status: 'done' });
      mockPlugin.statusManager.isCompletedStatus.mockReturnValue(true);
      
      const result = await taskService.toggleStatus(task);

      expect(result.status).toBe('open');
    });

    it('should use first completed status when toggling to completed', async () => {
      const task = TaskFactory.createTask({ status: 'open' });
      mockPlugin.statusManager.getCompletedStatuses.mockReturnValue(['completed', 'done']);
      
      const result = await taskService.toggleStatus(task);

      expect(result.status).toBe('completed');
    });

    it('should handle missing completed statuses gracefully', async () => {
      const task = TaskFactory.createTask({ status: 'open' });
      mockPlugin.statusManager.getCompletedStatuses.mockReturnValue([]);
      
      const result = await taskService.toggleStatus(task);

      expect(result.status).toBe('done'); // fallback
    });
  });

  describe('updateProperty', () => {
    let task: TaskInfo;
    let mockFile: TFile;

    beforeEach(() => {
      task = TaskFactory.createTask();
      mockFile = new TFile(task.path);
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(task);
    });

    it('should update a single property', async () => {
      const result = await taskService.updateProperty(task, 'priority', 'high');

      expect(result.priority).toBe('high');
      expect(result.dateModified).toBe('2025-01-01T12:00:00Z');
    });

    it('should handle status updates with completion date for non-recurring tasks', async () => {
      const nonRecurringTask = TaskFactory.createTask({ recurrence: undefined });
      
      const result = await taskService.updateProperty(nonRecurringTask, 'status', 'done');

      expect(result.status).toBe('done');
      expect(result.completedDate).toBe('2025-01-01');
    });

    it('should not set completion date for recurring tasks', async () => {
      const recurringTask = TaskFactory.createTask({ recurrence: 'FREQ=DAILY' });
      
      const result = await taskService.updateProperty(recurringTask, 'status', 'done');

      expect(result.status).toBe('done');
      expect(result.completedDate).toBeUndefined();
    });

    it('should clear completion date when marking as incomplete', async () => {
      const completedTask = TaskFactory.createTask({ 
        status: 'done', 
        completedDate: '2025-01-01' 
      });
      
      const result = await taskService.updateProperty(completedTask, 'status', 'open');

      expect(result.status).toBe('open');
      expect(result.completedDate).toBeUndefined();
    });

    it('should remove empty due/scheduled dates', async () => {
      await taskService.updateProperty(task, 'due', undefined);

      expect(mockPlugin.app.fileManager.processFrontMatter).toHaveBeenCalledWith(
        mockFile,
        expect.any(Function)
      );
    });

    it('should use fresh task data to prevent overwrites', async () => {
      const freshTask = { ...task, priority: 'medium' };
      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(freshTask);
      
      const result = await taskService.updateProperty(task, 'status', 'done');

      expect(result.priority).toBe('medium'); // from fresh data
      expect(result.status).toBe('done'); // from update
    });

    it('should handle file not found error', async () => {
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

      await expect(taskService.updateProperty(task, 'status', 'done'))
        .rejects.toThrow('Cannot find task file');
    });

    it('should handle cache errors gracefully', async () => {
      mockPlugin.cacheManager.updateTaskInfoInCache.mockRejectedValue(new Error('Cache error'));

      // Should not throw, just log error
      const result = await taskService.updateProperty(task, 'priority', 'high');
      expect(result.priority).toBe('high');
    });

    it('should handle event emission errors gracefully', async () => {
      mockPlugin.emitter.trigger.mockImplementation(() => {
        throw new Error('Event error');
      });

      // Should not throw, just log error
      const result = await taskService.updateProperty(task, 'priority', 'high');
      expect(result.priority).toBe('high');
    });
  });

  describe('toggleArchive', () => {
    let task: TaskInfo;
    let mockFile: TFile;

    beforeEach(() => {
      task = TaskFactory.createTask({ archived: false, tags: ['task'] });
      mockFile = new TFile(task.path);
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    });

    it('should archive an unarchived task', async () => {
      const result = await taskService.toggleArchive(task);

      expect(result.archived).toBe(true);
      expect(result.tags).toContain('archived');
    });

    it('should unarchive an archived task', async () => {
      const archivedTask = TaskFactory.createTask({ 
        archived: true, 
        tags: ['task', 'archived'] 
      });
      
      const result = await taskService.toggleArchive(archivedTask);

      expect(result.archived).toBe(false);
      expect(result.tags).not.toContain('archived');
    });

    it('should handle tasks without existing tags', async () => {
      const taskWithoutTags = TaskFactory.createTask({ tags: undefined });
      
      const result = await taskService.toggleArchive(taskWithoutTags);

      expect(result.tags).toEqual(['archived']);
    });

    it('should use custom archive tag from field mapping', async () => {
      mockPlugin.fieldMapper.getMapping.mockReturnValue({ archiveTag: 'custom-archived' });
      
      const result = await taskService.toggleArchive(task);

      expect(result.tags).toContain('custom-archived');
    });
  });

  describe('startTimeTracking', () => {
    let task: TaskInfo;
    let mockFile: TFile;

    beforeEach(() => {
      task = TaskFactory.createTask();
      mockFile = new TFile(task.path);
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockPlugin.getActiveTimeSession.mockReturnValue(null);
    });

    it('should start time tracking for a task', async () => {
      const result = await taskService.startTimeTracking(task);

      expect(result.timeEntries).toHaveLength(1);
      expect(result.timeEntries![0]).toMatchObject({
        startTime: '2025-01-01T12:00:00Z',
        description: 'Work session'
      });
      expect(result.timeEntries![0].endTime).toBeUndefined();
    });

    it('should add to existing time entries', async () => {
      const taskWithEntries = TaskFactory.createTaskWithTimeTracking();
      const existingCount = taskWithEntries.timeEntries?.length || 0;
      
      const result = await taskService.startTimeTracking(taskWithEntries);

      expect(result.timeEntries).toHaveLength(existingCount + 1);
    });

    it('should prevent starting when already tracking', async () => {
      const activeSession = { startTime: '2025-01-01T11:00:00Z' };
      mockPlugin.getActiveTimeSession.mockReturnValue(activeSession);

      await expect(taskService.startTimeTracking(task))
        .rejects.toThrow('Time tracking is already active for this task');
    });

    it('should handle file not found error', async () => {
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

      await expect(taskService.startTimeTracking(task))
        .rejects.toThrow('Cannot find task file');
    });
  });

  describe('stopTimeTracking', () => {
    let task: TaskInfo;
    let mockFile: TFile;
    let activeSession: TimeEntry;

    beforeEach(() => {
      activeSession = {
        startTime: '2025-01-01T11:00:00Z',
        description: 'Active session'
      };
      
      task = TaskFactory.createTask({
        timeEntries: [activeSession]
      });
      
      mockFile = new TFile(task.path);
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockPlugin.getActiveTimeSession.mockReturnValue(activeSession);
    });

    it('should stop active time tracking', async () => {
      const result = await taskService.stopTimeTracking(task);

      expect(result.timeEntries![0]).toMatchObject({
        startTime: '2025-01-01T11:00:00Z',
        endTime: '2025-01-01T12:00:00Z',
        description: 'Active session'
      });
    });

    it('should prevent stopping when not tracking', async () => {
      mockPlugin.getActiveTimeSession.mockReturnValue(null);

      await expect(taskService.stopTimeTracking(task))
        .rejects.toThrow('No active time tracking session for this task');
    });

    it('should handle missing time entries array', async () => {
      const taskWithoutEntries = TaskFactory.createTask({ timeEntries: undefined });
      
      // Should not throw but won't find entry to update
      await taskService.stopTimeTracking(taskWithoutEntries);
    });
  });

  describe('updateTask', () => {
    let task: TaskInfo;
    let mockFile: TFile;

    beforeEach(() => {
      task = TaskFactory.createTask();
      mockFile = new TFile(task.path);
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    });

    it('should update multiple properties', async () => {
      const updates = {
        title: 'Updated Task',
        priority: 'high',
        status: 'in-progress'
      };

      const result = await taskService.updateTask(task, updates);

      expect(result).toMatchObject(updates);
      expect(result.dateModified).toBe('2025-01-01T12:00:00Z');
    });

    it('should handle completion date for status changes', async () => {
      const updates = { status: 'done' };

      const result = await taskService.updateTask(task, updates);

      expect(result.status).toBe('done');
      expect(result.completedDate).toBe('2025-01-01');
    });

    it('should preserve complete_instances for recurring tasks', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
        complete_instances: ['2024-12-30', '2024-12-31']
      });

      const result = await taskService.updateTask(recurringTask, { priority: 'high' });

      expect(result.complete_instances).toEqual(['2024-12-30', '2024-12-31']);
    });

    it('should remove undefined fields from frontmatter', async () => {
      const updates = {
        due: undefined,
        scheduled: undefined,
        timeEstimate: undefined
      };

      await taskService.updateTask(task, updates);

      // Verify that processFrontMatter callback removes these fields
      expect(mockPlugin.app.fileManager.processFrontMatter).toHaveBeenCalled();
    });

    it('should preserve tags when not being updated', async () => {
      const taskWithTags = TaskFactory.createTask({ tags: ['task', 'important'] });
      const updates = { priority: 'high' };

      const result = await taskService.updateTask(taskWithTags, updates);

      expect(result.tags).toEqual(['task', 'important']);
    });

    it('should handle cache and event errors gracefully', async () => {
      mockPlugin.cacheManager.updateTaskInfoInCache.mockRejectedValue(new Error('Cache error'));
      mockPlugin.emitter.trigger.mockImplementation(() => {
        throw new Error('Event error');
      });

      const updates = { priority: 'high' };
      const result = await taskService.updateTask(task, updates);

      expect(result.priority).toBe('high');
    });
  });

  describe('deleteTask', () => {
    let task: TaskInfo;
    let mockFile: TFile;

    beforeEach(() => {
      task = TaskFactory.createTask();
      mockFile = new TFile(task.path);
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    });

    it('should delete a task successfully', async () => {
      await taskService.deleteTask(task);

      expect(mockPlugin.app.vault.delete).toHaveBeenCalledWith(mockFile);
      expect(mockPlugin.cacheManager.clearCacheEntry).toHaveBeenCalledWith(task.path);
      expect(mockPlugin.emitter.trigger).toHaveBeenCalledWith('task-deleted', {
        path: task.path,
        deletedTask: task
      });
    });

    it('should handle file not found error', async () => {
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

      await expect(taskService.deleteTask(task))
        .rejects.toThrow('Cannot find task file');
    });

    it('should handle vault deletion errors', async () => {
      mockPlugin.app.vault.delete.mockRejectedValue(new Error('Deletion failed'));

      await expect(taskService.deleteTask(task))
        .rejects.toThrow('Failed to delete task');
    });
  });

  describe('Error Handling', () => {
    it('should handle field mapper errors gracefully', async () => {
      mockPlugin.fieldMapper.mapToFrontmatter.mockImplementation(() => {
        throw new Error('Field mapping error');
      });

      const taskData: TaskCreationData = { title: 'Error Test Task' };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Failed to create task');
    });

    it('should handle vault operation errors', async () => {
      mockPlugin.app.vault.create.mockRejectedValue(new Error('Vault error'));

      const taskData: TaskCreationData = { title: 'Vault Error Task' };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Failed to create task');
    });

    it('should include error details in thrown errors', async () => {
      mockPlugin.app.vault.create.mockRejectedValue(new Error('Specific vault error'));

      const taskData: TaskCreationData = { title: 'Error Details Task' };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Failed to create task: Specific vault error');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete task creation workflow', async () => {
      const taskData: TaskCreationData = {
        title: 'Integration Test Task',
        status: 'open',
        priority: 'normal',
        due: '2025-01-15',
        contexts: ['work'],
        timeEstimate: 60,
        details: 'Integration test details'
      };

      const { file, taskInfo } = await taskService.createTask(taskData);

      // Verify file creation
      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        expect.stringMatching(/integration-test-task\.md$/),
        expect.stringContaining('title: Integration Test Task')
      );

      // Verify cache update
      expect(mockPlugin.cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
        taskInfo.path,
        taskInfo
      );

      // Verify event emission
      expect(mockPlugin.emitter.trigger).toHaveBeenCalledWith('task-updated', {
        path: taskInfo.path,
        updatedTask: taskInfo
      });

      // Verify task info structure
      expect(taskInfo).toMatchObject({
        title: 'Integration Test Task',
        status: 'open',
        priority: 'normal',
        due: '2025-01-15',
        contexts: ['work'],
        timeEstimate: 60,
        archived: false
      });
    });

    it('should handle task lifecycle from creation to completion', async () => {
      // Create task
      const { taskInfo: created } = await taskService.createTask({
        title: 'Lifecycle Task'
      });

      // Update task
      const updated = await taskService.updateTask(created, {
        status: 'in-progress',
        priority: 'high'
      });

      // Complete task
      const completed = await taskService.toggleStatus(updated);

      expect(completed.status).toBe('done');
      expect(completed.priority).toBe('high');
    });
  });
});