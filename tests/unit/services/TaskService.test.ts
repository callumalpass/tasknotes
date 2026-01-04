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

import { FileSystemFactory, PluginFactory, TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import { TaskCreationData, TaskService } from '../../../src/services/TaskService';
import { TaskInfo, TimeEntry } from '../../../src/types';

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
  ensureFolderExists: jest.fn().mockResolvedValue(undefined),
  calculateDefaultDate: jest.fn().mockImplementation((option: string) => {
    switch (option) {
      case 'today': return '2025-01-15';
      case 'tomorrow': return '2025-01-16';
      case 'next-week': return '2025-01-22';
      default: return undefined;
    }
  }),
  addDTSTARTToRecurrenceRule: jest.fn((rule: string) => rule),
  updateDTSTARTInRecurrenceRule: jest.fn((rule: string) => rule),
  updateToNextScheduledOccurrence: jest.fn(),
  splitFrontmatterAndBody: jest.fn(() => ({ frontmatter: {}, body: '' }))
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

    // Add getActiveFile method to workspace mock
    mockPlugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);

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
      // With default tag-based identification, task tag should be included
      expect(taskInfo.tags).toContain('task');
    });

    it('should handle default folder configuration', async () => {
      mockPlugin.settings.tasksFolder = 'Projects/Tasks';

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

    it('should handle inline conversion context with currentNotePath variable', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = 'Tasks/{{currentNotePath}}';

      const mockCurrentFile = new TFile('Projects/MyProject/note.md');
      mockCurrentFile.parent = { path: 'Projects/MyProject' } as any;
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      const taskData: TaskCreationData = {
        title: 'Inline Task',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Tasks/Projects/MyProject/inline-task.md',
        expect.stringContaining('title: Inline Task')
      );
    });

    it('should handle inline conversion context without currentNotePath variable', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = 'InlineTasks';

      const taskData: TaskCreationData = {
        title: 'Simple Inline Task',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'InlineTasks/simple-inline-task.md',
        expect.stringContaining('title: Simple Inline Task')
      );
    });

    it('should handle inline conversion context with currentNotePath when no active file', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = 'Tasks/{{currentNotePath}}';
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(null);

      const taskData: TaskCreationData = {
        title: 'No File Context Task',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Tasks//no-file-context-task.md',
        expect.stringContaining('title: No File Context Task')
      );
    });

    it('should handle inline conversion context with currentNotePath when file has no parent', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = 'Tasks/{{currentNotePath}}';

      const mockCurrentFile = new TFile('note.md');
      // Don't set parent - this will be undefined
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      const taskData: TaskCreationData = {
        title: 'Root File Task',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Tasks//root-file-task.md',
        expect.stringContaining('title: Root File Task')
      );
    });

    it('should handle inline conversion context with currentNoteTitle variable', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = 'Tasks/{{currentNoteTitle}}';

      const mockCurrentFile = new TFile('Projects/MyProject/HAB NB 1.md');
      Object.defineProperty(mockCurrentFile, 'basename', { value: 'HAB NB 1', writable: false });
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      const taskData: TaskCreationData = {
        title: 'Task in note specific folder',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Tasks/HAB NB 1/task-in-note-specific-folder.md',
        expect.stringContaining('title: Task in note specific folder')
      );
    });

    it('should handle inline conversion context with both currentNotePath and currentNoteTitle variables', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = '{{currentNotePath}}/{{currentNoteTitle}}';

      const mockCurrentFile = new TFile('Projects/MyProject/HAB NB 1.md');
      Object.defineProperty(mockCurrentFile, 'basename', { value: 'HAB NB 1', writable: false });
      mockCurrentFile.parent = { path: 'Projects/MyProject' } as any;
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      const taskData: TaskCreationData = {
        title: 'Combined template task',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Projects/MyProject/HAB NB 1/combined-template-task.md',
        expect.stringContaining('title: Combined template task')
      );
    });

    it('should handle inline conversion context with currentNoteTitle when no active file', async () => {
      mockPlugin.settings.inlineTaskConvertFolder = 'Tasks/{{currentNoteTitle}}';
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(null);

      const taskData: TaskCreationData = {
        title: 'No active file task',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Tasks//no-active-file-task.md',
        expect.stringContaining('title: No active file task')
      );
    });

    // Issue #1334: Support {{currentNotePath}} for modal-inline-creation context (Create new inline task command)
    // The 'Create New Inline Task' command now uses 'modal-inline-creation' context (fixed in #1424)
    // to distinguish it from 'manual-creation' (Create New Task command).
    it('should handle modal-inline-creation context with currentNotePath variable (#1334)', async () => {
      // modal-inline-creation uses inlineTaskConvertFolder with variable support
      mockPlugin.settings.inlineTaskConvertFolder = 'Tasks/{{currentNotePath}}';

      const mockCurrentFile = new TFile('Projects/MyProject/note.md');
      mockCurrentFile.parent = { path: 'Projects/MyProject' } as any;
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      const taskData: TaskCreationData = {
        title: 'Modal Inline Task',
        creationContext: 'modal-inline-creation' // Create New Inline Task command uses this
      };

      await taskService.createTask(taskData);

      // modal-inline-creation respects inlineTaskConvertFolder with {{currentNotePath}}
      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Tasks/Projects/MyProject/modal-inline-task.md',
        expect.stringContaining('title: Modal Inline Task')
      );
    });

    // Issue #1424: Create New Task command should use default task folder (tasksFolder), not inlineTaskConvertFolder
    // The "Create New Task" command (via TaskCreationModal) should create tasks in the configured default folder,
    // NOT in the active folder. Fixed by introducing 'modal-inline-creation' context for Create New Inline Task.
    //
    // The distinction:
    // - "Create New Task" command: Uses 'manual-creation' -> tasksFolder (default task folder setting)
    // - "Create New Inline Task" command: Uses 'modal-inline-creation' -> inlineTaskConvertFolder with {{currentNotePath}} support
    // - Checkbox conversion: Uses 'inline-conversion' -> inlineTaskConvertFolder with {{currentNotePath}} support
    it('should use default task folder for Create New Task command, not inlineTaskConvertFolder (#1424)', async () => {
      // Configure both folders - this is the scenario described in the bug
      mockPlugin.settings.tasksFolder = 'TaskNotes/Tasks';  // Default folder setting
      mockPlugin.settings.inlineTaskConvertFolder = '{{currentNotePath}}';  // Inline conversion setting

      // User has a note open somewhere else
      const mockCurrentFile = new TFile('Projects/MyProject/meeting-notes.md');
      mockCurrentFile.parent = { path: 'Projects/MyProject' } as any;
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      // TaskCreationModal (Create New Task command) sets creationContext: 'manual-creation'
      const taskData: TaskCreationData = {
        title: 'Buy groceries',
        creationContext: 'manual-creation'
      };

      await taskService.createTask(taskData);

      // FIXED: Now correctly creates in 'TaskNotes/Tasks/buy-groceries.md' (default folder)
      // Previously incorrectly created in 'Projects/MyProject/buy-groceries.md' (active folder)
      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'TaskNotes/Tasks/buy-groceries.md',
        expect.stringContaining('title: Buy groceries')
      );
    });

    // Additional test to clarify the expected behavior difference between command types
    it('should still use inlineTaskConvertFolder for inline-conversion context (#1424)', async () => {
      // Configure both folders
      mockPlugin.settings.tasksFolder = 'TaskNotes/Tasks';  // Default folder setting
      mockPlugin.settings.inlineTaskConvertFolder = '{{currentNotePath}}';  // Inline conversion setting

      // User has a note open
      const mockCurrentFile = new TFile('Projects/MyProject/meeting-notes.md');
      mockCurrentFile.parent = { path: 'Projects/MyProject' } as any;
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      // Inline conversion (checkbox to task) sets creationContext: 'inline-conversion'
      const taskData: TaskCreationData = {
        title: 'Review proposal',
        creationContext: 'inline-conversion'
      };

      await taskService.createTask(taskData);

      // Inline conversion SHOULD use inlineTaskConvertFolder with {{currentNotePath}}
      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Projects/MyProject/review-proposal.md',
        expect.stringContaining('title: Review proposal')
      );
    });

    // Test for modal-inline-creation context (Create New Inline Task command)
    it('should use inlineTaskConvertFolder for modal-inline-creation context (#1424)', async () => {
      // Configure both folders
      mockPlugin.settings.tasksFolder = 'TaskNotes/Tasks';  // Default folder setting
      mockPlugin.settings.inlineTaskConvertFolder = '{{currentNotePath}}';  // Inline conversion setting

      // User has a note open
      const mockCurrentFile = new TFile('Projects/MyProject/meeting-notes.md');
      mockCurrentFile.parent = { path: 'Projects/MyProject' } as any;
      mockPlugin.app.workspace.getActiveFile.mockReturnValue(mockCurrentFile);

      // Create New Inline Task command sets creationContext: 'modal-inline-creation'
      const taskData: TaskCreationData = {
        title: 'Follow up on meeting',
        creationContext: 'modal-inline-creation'
      };

      await taskService.createTask(taskData);

      // modal-inline-creation uses inlineTaskConvertFolder with {{currentNotePath}}
      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'Projects/MyProject/follow-up-on-meeting.md',
        expect.stringContaining('title: Follow up on meeting')
      );
    });

    it('should handle project template variables correctly by extracting basenames from wikilinks', async () => {
      mockPlugin.settings.tasksFolder = 'projects/{{context}}/{{project}}/tasks';

      // Mock metadataCache to resolve project links
      const mockFile = { basename: 'testProject Root' };
      mockPlugin.app.metadataCache.getFirstLinkpathDest = jest.fn().mockReturnValue(mockFile);

      const taskData: TaskCreationData = {
        title: 'Test Task with Project Link',
        contexts: ['testContext'],
        projects: ['[[projects/testContext/testProject/testProject Root]]']
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'projects/testContext/testProject Root/tasks/test-task-with-project-link.md',
        expect.stringContaining('title: Test Task with Project Link')
      );
    });

    it('should handle project template variables with pipe syntax correctly', async () => {
      mockPlugin.settings.tasksFolder = 'projects/{{project}}/tasks';

      const taskData: TaskCreationData = {
        title: 'Test Task with Pipe Syntax',
        projects: ['[[long/path/to/project|Display Name]]']
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'projects/Display Name/tasks/test-task-with-pipe-syntax.md',
        expect.stringContaining('title: Test Task with Pipe Syntax')
      );
    });

    it('should handle project template variables for non-wikilink projects', async () => {
      mockPlugin.settings.tasksFolder = 'projects/{{project}}/tasks';

      const taskData: TaskCreationData = {
        title: 'Test Task with Simple Project',
        projects: ['Simple Project Name']
      };

      await taskService.createTask(taskData);

      expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
        'projects/Simple Project Name/tasks/test-task-with-simple-project.md',
        expect.stringContaining('title: Test Task with Simple Project')
      );
    });

    it('should validate required fields', async () => {
      await expect(taskService.createTask({ title: '' })).rejects.toThrow('Title is required');
      await expect(taskService.createTask({ title: '   ' })).rejects.toThrow('Title is required');
    });

    it('should accept long titles without error', async () => {
      const longTitle = 'A'.repeat(201);
      const result = await taskService.createTask({ title: longTitle });
      expect(result.taskInfo.title).toBe(longTitle);
    });

    it('should ensure task tag is included when using tag-based identification', async () => {
      // Ensure we're using tag-based identification (default)
      mockPlugin.settings.taskIdentificationMethod = 'tag';

      const taskData: TaskCreationData = {
        title: 'Tag Test Task',
        tags: ['custom', 'tags']
      };

      const { taskInfo } = await taskService.createTask(taskData);

      expect(taskInfo.tags).toEqual(['task', 'custom', 'tags']);
    });

    it('should use property-based identification when configured', async () => {
      // Configure property-based identification
      mockPlugin.settings.taskIdentificationMethod = 'property';
      mockPlugin.settings.taskPropertyName = 'category';
      mockPlugin.settings.taskPropertyValue = '[[Tasks]]';

      const taskData: TaskCreationData = {
        title: 'Property Test Task',
        tags: ['custom', 'tags']
      };

      const { taskInfo } = await taskService.createTask(taskData);

      // Should NOT include task tag in tags array
      expect(taskInfo.tags).toEqual(['custom', 'tags']);
    });

    it('should not add task tag when using property identification with no custom tags', async () => {
      // Configure property-based identification
      mockPlugin.settings.taskIdentificationMethod = 'property';
      mockPlugin.settings.taskPropertyName = 'type';
      mockPlugin.settings.taskPropertyValue = 'task';

      const taskData: TaskCreationData = {
        title: 'Property No Tags Test',
        // No tags provided
      };

      const { taskInfo } = await taskService.createTask(taskData);

      // Should have empty tags array (no task tag added)
      expect(taskInfo.tags).toEqual([]);
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

    it('should coerce boolean-like property value to boolean true in frontmatter when using property identification', async () => {
      // Configure property-based identification with boolean-like string
      mockPlugin.settings.taskIdentificationMethod = 'property';
      mockPlugin.settings.taskPropertyName = 'isTask';
      mockPlugin.settings.taskPropertyValue = 'true';

      // Spy on stringifyYaml to capture the frontmatter object passed during file creation
      const obsidian = require('obsidian');
      const yamlSpy = jest.spyOn(obsidian, 'stringifyYaml');

      await taskService.createTask({ title: 'Boolean Property Task' });

      expect(yamlSpy).toHaveBeenCalled();
      const fmArg = yamlSpy.mock.calls[0][0] as any;
      expect(typeof fmArg.isTask).toBe('boolean');
      expect(fmArg.isTask).toBe(true);

      yamlSpy.mockRestore();
    });

    it('should coerce boolean-like property value to boolean false in frontmatter when using property identification', async () => {
      // Configure property-based identification with boolean-like string
      mockPlugin.settings.taskIdentificationMethod = 'property';
      mockPlugin.settings.taskPropertyName = 'isTask';
      mockPlugin.settings.taskPropertyValue = 'false';

      const obsidian = require('obsidian');
      const yamlSpy = jest.spyOn(obsidian, 'stringifyYaml');

      await taskService.createTask({ title: 'Boolean Property False Task' });

      expect(yamlSpy).toHaveBeenCalled();
      const fmArg = yamlSpy.mock.calls[0][0] as any;
      expect(typeof fmArg.isTask).toBe('boolean');
      expect(fmArg.isTask).toBe(false);

      yamlSpy.mockRestore();
    });

    it('should write boolean status "true" as boolean true in frontmatter', async () => {
      const obsidian = require('obsidian');
      const yamlSpy = jest.spyOn(obsidian, 'stringifyYaml');

      const taskData: TaskCreationData = {
        title: 'Boolean Status Task',
        status: 'true'
      };

      await taskService.createTask(taskData);

      expect(yamlSpy).toHaveBeenCalled();
      const fmArg = yamlSpy.mock.calls[0][0] as any;
      expect(typeof fmArg.status).toBe('boolean');
      expect(fmArg.status).toBe(true);

      yamlSpy.mockRestore();
    });

    it('should write boolean status "false" as boolean false in frontmatter', async () => {
      const obsidian = require('obsidian');
      const yamlSpy = jest.spyOn(obsidian, 'stringifyYaml');

      const taskData: TaskCreationData = {
        title: 'Boolean Status False Task',
        status: 'false'
      };

      await taskService.createTask(taskData);

      expect(yamlSpy).toHaveBeenCalled();
      const fmArg = yamlSpy.mock.calls[0][0] as any;
      expect(typeof fmArg.status).toBe('boolean');
      expect(fmArg.status).toBe(false);

      yamlSpy.mockRestore();
    });

    it('should write regular status values as strings in frontmatter', async () => {
      const obsidian = require('obsidian');
      const yamlSpy = jest.spyOn(obsidian, 'stringifyYaml');

      const taskData: TaskCreationData = {
        title: 'Regular Status Task',
        status: 'in-progress'
      };

      await taskService.createTask(taskData);

      expect(yamlSpy).toHaveBeenCalled();
      const fmArg = yamlSpy.mock.calls[0][0] as any;
      expect(typeof fmArg.status).toBe('string');
      expect(fmArg.status).toBe('in-progress');

      yamlSpy.mockRestore();
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
      mockPlugin.cacheManager.getTaskInfo.mockResolvedValue(recurringTask);

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
      mockPlugin.cacheManager.updateTaskInfoInCache.mockImplementation(() => {
        throw new Error('Cache error');
      });

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
      // Update the fieldMapper to use a custom archive tag
      const customMapping = { 
        ...mockPlugin.fieldMapper.getMapping(),
        archiveTag: 'custom-archived'
      };
      mockPlugin.fieldMapper.updateMapping(customMapping);

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
      mockPlugin.cacheManager.updateTaskInfoInCache.mockImplementation(() => {
        throw new Error('Cache error');
      });
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
      // Create a spy on the real fieldMapper method to force it to throw
      const mapToFrontmatterSpy = jest.spyOn(mockPlugin.fieldMapper, 'mapToFrontmatter')
        .mockImplementation(() => {
          throw new Error('Field mapping error');
        });

      const taskData: TaskCreationData = { title: 'Error Test Task' };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Failed to create task');

      mapToFrontmatterSpy.mockRestore();
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

      const { taskInfo } = await taskService.createTask(taskData);

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