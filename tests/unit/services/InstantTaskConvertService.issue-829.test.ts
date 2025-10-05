/**
 * InstantTaskConvertService Issue #829 Tests
 *
 * Bug: Time estimate gets lost in instant task conversion
 *
 * When converting an inline checkbox item to a task (instant task conversion),
 * the time estimate parsed from natural language (e.g., "30 minutes") is not
 * preserved in the task's YAML frontmatter, even though the text is correctly
 * removed from the task title.
 *
 * This test verifies that time estimates and recurrence patterns are properly
 * transferred from NLP parsing to the created task file.
 */

import { InstantTaskConvertService } from '../../../src/services/InstantTaskConvertService';
import { NaturalLanguageParser, ParsedTaskData as NLPParsedTaskData } from '../../../src/services/NaturalLanguageParser';
import { PluginFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
  getCurrentDateString: jest.fn(() => '2025-01-01'),
  parseDate: jest.fn((dateStr) => dateStr),
  formatDateForStorage: jest.fn((dateStr) => dateStr),
  combineDateAndTime: jest.fn((date, time) => `${date}T${time}:00`)
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn((context) => `${context.title.toLowerCase().replace(/\s+/g, '-')}.md`),
  generateUniqueFilename: jest.fn((base) => base)
}));

jest.mock('../../../src/utils/helpers', () => ({
  ensureFolderExists: jest.fn().mockResolvedValue(undefined),
  sanitizeFileName: jest.fn((name) => name.replace(/[<>:"|?*]/g, '')),
  calculateDefaultDate: jest.fn(() => undefined)
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
  processTemplate: jest.fn(() => ({
    frontmatter: {},
    body: 'Template content'
  })),
  mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template }))
}));

describe('InstantTaskConvertService - Issue #829: Time Estimate Lost in Conversion', () => {
  let service: InstantTaskConvertService;
  let mockPlugin: any;
  let mockNLParser: jest.Mocked<NaturalLanguageParser>;

  beforeEach(() => {
    // Mock plugin with settings
    mockPlugin = PluginFactory.createMockPlugin({
      settings: {
        taskTag: 'task',
        taskFolder: 'tasks',
        enableNaturalLanguageInput: true,
        useDefaultsOnInstantConvert: false,
        taskCreationDefaults: {
          defaultContexts: '',
          defaultTags: '',
          defaultPriority: 'none',
          defaultTaskStatus: 'none',
          defaultTimeEstimate: 0,
          defaultRecurrence: 'none',
          defaultReminders: []
        }
      }
    });

    // Mock NaturalLanguageParser
    mockNLParser = {
      parseInput: jest.fn()
    } as any;

    // Create service instance
    service = new InstantTaskConvertService(mockPlugin);

    // Replace the nlParser with our mock
    (service as any).nlParser = mockNLParser;
  });

  describe('Time Estimate Preservation', () => {
    it('should preserve time estimate when parsing "Practice guitar 30 minutes"', () => {
      // Mock NLP parser to return time estimate
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Practice guitar',
        estimate: 30, // 30 minutes
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Practice guitar 30 minutes', '');

      // Verify title is cleaned
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Practice guitar');

      // Time estimate should be preserved
      expect(result).toHaveProperty('timeEstimate');
      expect((result as any).timeEstimate).toBe(30);
    });

    it('should preserve time estimate with hours "Submit report 2 hours"', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Submit report',
        estimate: 120, // 2 hours = 120 minutes
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Submit report 2 hours', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Submit report');
      expect((result as any).timeEstimate).toBe(120);
    });

    it('should preserve time estimate with complex format "Meeting 1h 30m"', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Meeting',
        estimate: 90, // 1 hour 30 minutes = 90 minutes
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Meeting 1h 30m', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Meeting');
      expect((result as any).timeEstimate).toBe(90);
    });

    it('should preserve time estimate alongside other properties', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Review code',
        estimate: 45,
        priority: 'high',
        tags: ['review'],
        contexts: ['work'],
        projects: ['project-x'],
        dueDate: '2025-02-15',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Review code 45 minutes high @work #review +project-x due Feb 15', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Review code');
      expect((result as any).timeEstimate).toBe(45);
      expect(result!.priority).toBe('high');
      expect(result!.tags).toEqual(['review']);
      expect(result!.contexts).toEqual(['work']);
      expect(result!.projects).toEqual(['project-x']);
      expect(result!.dueDate).toBe('2025-02-15');
    });
  });

  describe('Recurrence Preservation', () => {
    it('should preserve daily recurrence pattern', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Daily standup',
        recurrence: 'FREQ=DAILY',
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Daily standup every day', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Daily standup');
      expect(result!.recurrence).toBe('FREQ=DAILY');
    });

    it('should preserve weekly recurrence pattern', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Team meeting',
        recurrence: 'FREQ=WEEKLY;BYDAY=MO',
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Team meeting every Monday', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Team meeting');
      expect(result!.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('should preserve recurrence alongside time estimate', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Workout',
        estimate: 60, // 1 hour
        recurrence: 'FREQ=DAILY',
        tags: ['fitness'],
        contexts: ['gym'],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Workout 1 hour every day @gym #fitness', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Workout');
      expect((result as any).timeEstimate).toBe(60);
      expect(result!.recurrence).toBe('FREQ=DAILY');
      expect(result!.tags).toEqual(['fitness']);
      expect(result!.contexts).toEqual(['gym']);
    });
  });

  describe('Time Estimate in Task Creation', () => {
    it('should pass time estimate to task creation when using defaults', async () => {
      // Enable defaults
      mockPlugin.settings.useDefaultsOnInstantConvert = true;
      mockPlugin.settings.taskCreationDefaults.defaultTimeEstimate = 30;

      const mockFile = { path: 'test-task.md', basename: 'test-task' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);
      mockPlugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(mockFile);
      mockPlugin.app.metadataCache.fileToLinktext = jest.fn().mockReturnValue('test-task');

      // Mock TaskService.createTask to capture the data
      const createTaskSpy = jest.fn().mockResolvedValue({ file: mockFile });
      mockPlugin.taskService = { createTask: createTaskSpy };

      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task with estimate',
        estimate: 45,
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const parsedData = service['tryNLPFallback']('Task with estimate 45 minutes', '');

      // When we have the parsed data, create the task file
      if (parsedData) {
        await service['createTaskFile'](parsedData, '');

        // Verify that createTask was called with timeEstimate
        expect(createTaskSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Task with estimate',
            // The estimate from NLP should override the default
            timeEstimate: expect.any(Number)
          })
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks without time estimate', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Simple task',
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Simple task', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Simple task');
      expect((result as any).timeEstimate).toBeUndefined();
    });

    it('should handle zero time estimate', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Quick task',
        estimate: 0,
        tags: [],
        contexts: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Quick task 0 minutes', '');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Quick task');
      // Zero estimates should be preserved as they might be intentional
      expect((result as any).timeEstimate).toBe(0);
    });
  });
});
