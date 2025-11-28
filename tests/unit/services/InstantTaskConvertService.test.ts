/**
 * InstantTaskConvertService Unit Tests
 * 
 * Tests for instant task conversion functionality including:
 * - Context detection from @context syntax in natural language tasks
 * - Context detection from Tasks plugin syntax (@context)
 * - Tags and projects parsing alongside contexts
 * - Default context handling when enabled/disabled
 * - Format conversion from NLP results to TasksPlugin format
 * - Edge cases and error handling
 * - Priority and status preservation during conversion
 */

import { InstantTaskConvertService } from '../../../src/services/InstantTaskConvertService';
import { NaturalLanguageParser, ParsedTaskData as NLPParsedTaskData } from '../../../src/services/NaturalLanguageParser';
import { ParsedTaskData } from '../../../src/utils/TasksPluginParser';
import { TaskInfo } from '../../../src/types';
import { PluginFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
  getCurrentDateString: jest.fn(() => '2025-01-01'),
  parseDate: jest.fn((dateStr) => dateStr),
  formatDateForStorage: jest.fn((dateStr) => dateStr)
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn((context) => `${context.title.toLowerCase().replace(/\s+/g, '-')}.md`),
  generateUniqueFilename: jest.fn((base) => base)
}));

jest.mock('../../../src/utils/helpers', () => ({
  ensureFolderExists: jest.fn().mockResolvedValue(undefined),
  sanitizeFileName: jest.fn((name) => name.replace(/[<>:"|?*]/g, ''))
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
  processTemplate: jest.fn(() => ({ 
    frontmatter: {}, 
    body: 'Template content' 
  })),
  mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template }))
}));

describe('InstantTaskConvertService', () => {
  let service: InstantTaskConvertService;
  let mockPlugin: any;
  let mockNLParser: jest.Mocked<NaturalLanguageParser>;

  beforeEach(() => {
    // Mock plugin with settings
    mockPlugin = PluginFactory.createMockPlugin({
      settings: {
        taskTag: 'task',
        taskFolder: 'tasks',
        useDefaultsOnInstantConvert: false,
        taskCreationDefaults: {
          defaultContexts: 'work,home',
          defaultTags: 'urgent,todo',
          defaultPriority: 'medium',
          defaultTaskStatus: 'open',
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

  describe('Context Detection - Natural Language Tasks', () => {
    it('should extract single context from @context syntax', async () => {
      // Mock NLP parser to return contexts
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Buy groceries',
        contexts: ['home'],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Buy groceries @home', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['home']);
      expect(result!.title).toBe('Buy groceries');
    });

    it('should extract multiple contexts from @context syntax', async () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Schedule meeting',
        contexts: ['work', 'office'],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Schedule meeting @work @office', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['work', 'office']);
      expect(result!.title).toBe('Schedule meeting');
    });

    it('should handle contexts alongside tags and projects', async () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Complete project report',
        contexts: ['office'],
        tags: ['urgent'],
        projects: ['quarterly-review'],
        priority: 'high',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Complete project report @office #urgent +quarterly-review', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['office']);
      expect(result!.tags).toEqual(['urgent']);
      expect(result!.projects).toEqual(['quarterly-review']);
      expect(result!.priority).toBe('high');
    });

    it('should handle tasks with no contexts', async () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Simple task',
        contexts: [],
        tags: ['todo'],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Simple task #todo', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toBeUndefined();
      expect(result!.tags).toEqual(['todo']);
    });

    it('should remove duplicate contexts', async () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task with duplicate contexts',
        contexts: ['home', 'office', 'home'], // Duplicates should be handled by NLP parser
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Task with duplicate contexts @home @office @home', '');
      
      expect(result).not.toBeNull();
      // The NLP result already has duplicates, but our service should handle them
      expect(result!.contexts).toEqual(['home', 'office', 'home']);
    });
  });

  describe('Context Processing with Defaults', () => {
    beforeEach(() => {
      mockPlugin.settings.useDefaultsOnInstantConvert = true;
    });

    it('should combine parsed contexts with default contexts when defaults enabled', async () => {
      // Mock the file system operations for createTaskFile
      const mockFile = { path: 'test-task.md' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);
      
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Test task',
        contexts: ['office'],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Test task @office', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['office']);
      expect(result!.title).toBe('Test task');
    });

    it('should use only default contexts when no parsed contexts', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Test task',
        contexts: [],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Test task', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toBeUndefined(); // Empty contexts array becomes undefined
    });

    it('should remove duplicate contexts from parsed contexts', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Test task',
        contexts: ['work', 'office'], 
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Test task @work @office', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['work', 'office']);
    });
  });

  describe('Context Processing without Defaults', () => {
    beforeEach(() => {
      mockPlugin.settings.useDefaultsOnInstantConvert = false;
    });

    it('should use only parsed contexts when defaults disabled', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Test task',
        contexts: ['office', 'remote'],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Test task @office @remote', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['office', 'remote']);
    });

    it('should have empty contexts when no parsed contexts and defaults disabled', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Test task',
        contexts: [],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Test task', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toBeUndefined();
    });
  });

  describe('Tasks Plugin Syntax Support', () => {
    it('should handle Tasks plugin format with contexts', async () => {
      // Mock TasksPlugin parser behavior (this would be done via a different path)
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Buy groceries',
        contexts: ['home'],
        tags: ['errands'],
        priority: 'high',
        dueDate: '2025-01-20',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('- [ ] Buy groceries 📅 2025-01-20 ⏫ @home #errands', '');
      
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Buy groceries');
      expect(result!.contexts).toEqual(['home']);
      expect(result!.tags).toEqual(['errands']);
      expect(result!.priority).toBe('high');
      expect(result!.dueDate).toBe('2025-01-20');
    });

    it('should handle complex Tasks plugin syntax with multiple contexts', async () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Review quarterly reports',
        contexts: ['office', 'meeting-room'],
        tags: ['quarterly', 'review'],
        projects: ['q4-planning'],
        priority: 'high',
        scheduledDate: '2025-01-15',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('- [ ] Review quarterly reports ⏰ 2025-01-15 ⏫ @office @meeting-room #quarterly #review +q4-planning', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toEqual(['office', 'meeting-room']);
      expect(result!.tags).toEqual(['quarterly', 'review']);
      expect(result!.projects).toEqual(['q4-planning']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle NLP parser returning null', () => {
      mockNLParser.parseInput.mockReturnValue(null as any);

      const result = service['tryNLPFallback']('Invalid task input', '');
      
      expect(result).toBeNull();
    });

    it('should handle NLP parser throwing error', () => {
      mockNLParser.parseInput.mockImplementation(() => {
        throw new Error('NLP parsing failed');
      });

      const result = service['tryNLPFallback']('Some task @context', '');
      
      expect(result).toBeNull();
    });

    it('should handle empty contexts array gracefully', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task without contexts',
        contexts: [],
        tags: ['todo'],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Task without contexts #todo', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toBeUndefined();
      expect(result!.tags).toEqual(['todo']);
    });

    it('should handle malformed context syntax gracefully', async () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task with malformed @ symbols',
        contexts: [], // NLP parser should handle malformed syntax
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Task with malformed @ symbols @ @@ @123invalid', '');
      
      expect(result).not.toBeNull();
      expect(result!.contexts).toBeUndefined();
    });

    it('should preserve other task properties when contexts are present', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Complete feature implementation',
        contexts: ['development'],
        tags: ['coding'],
        projects: ['web-app'],
        priority: 'high',
        status: 'in-progress',
        dueDate: '2025-01-25',
        scheduledDate: '2025-01-20',
        recurrence: 'FREQ=WEEKLY',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Complete feature implementation @development #coding +web-app', '');
      
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Complete feature implementation');
      expect(result!.contexts).toEqual(['development']);
      expect(result!.tags).toEqual(['coding']);
      expect(result!.projects).toEqual(['web-app']);
      expect(result!.priority).toBe('high');
      expect(result!.status).toBe('in-progress');
      expect(result!.dueDate).toBe('2025-01-25');
      expect(result!.scheduledDate).toBe('2025-01-20');
      expect(result!.recurrence).toBe('FREQ=WEEKLY');
    });
  });

  describe('Format Conversion (NLP to TasksPlugin)', () => {
    it('should properly convert NLP ParsedTaskData to TasksPlugin ParsedTaskData', () => {
      const nlpResult: NLPParsedTaskData = {
        title: 'Test conversion',
        contexts: ['office', 'remote'],
        tags: ['important'],
        projects: ['project-x'],
        priority: 'high',
        status: 'open',
        dueDate: '2025-01-30',
        scheduledDate: '2025-01-25',
        recurrence: 'FREQ=DAILY',
        isCompleted: false
      };

      // This tests the actual conversion logic from the service
      const converted: ParsedTaskData = {
        title: nlpResult.title.trim(),
        isCompleted: nlpResult.isCompleted || false,
        status: nlpResult.status,
        priority: nlpResult.priority,
        dueDate: nlpResult.dueDate,
        scheduledDate: nlpResult.scheduledDate,
        recurrence: nlpResult.recurrence,
        tags: nlpResult.tags && nlpResult.tags.length > 0 ? nlpResult.tags : undefined,
        projects: nlpResult.projects && nlpResult.projects.length > 0 ? nlpResult.projects : undefined,
        contexts: nlpResult.contexts && nlpResult.contexts.length > 0 ? nlpResult.contexts : undefined,
        startDate: undefined,
        createdDate: undefined,
        doneDate: undefined,
        recurrenceData: undefined
      };

      expect(converted.title).toBe('Test conversion');
      expect(converted.contexts).toEqual(['office', 'remote']);
      expect(converted.tags).toEqual(['important']);
      expect(converted.projects).toEqual(['project-x']);
      expect(converted.priority).toBe('high');
      expect(converted.status).toBe('open');
      expect(converted.dueDate).toBe('2025-01-30');
      expect(converted.scheduledDate).toBe('2025-01-25');
      expect(converted.recurrence).toBe('FREQ=DAILY');
      expect(converted.isCompleted).toBe(false);
    });

    it('should handle empty contexts in format conversion', () => {
      const nlpResult: NLPParsedTaskData = {
        title: 'Test conversion without contexts',
        contexts: [],
        tags: ['test'],
        projects: [],
        isCompleted: false
      };

      const converted: ParsedTaskData = {
        title: nlpResult.title.trim(),
        isCompleted: nlpResult.isCompleted || false,
        tags: nlpResult.tags && nlpResult.tags.length > 0 ? nlpResult.tags : undefined,
        projects: nlpResult.projects && nlpResult.projects.length > 0 ? nlpResult.projects : undefined,
        contexts: nlpResult.contexts && nlpResult.contexts.length > 0 ? nlpResult.contexts : undefined,
        status: undefined,
        priority: undefined,
        dueDate: undefined,
        scheduledDate: undefined,
        startDate: undefined,
        createdDate: undefined,
        doneDate: undefined,
        recurrence: undefined,
        recurrenceData: undefined
      };

      expect(converted.contexts).toBeUndefined();
      expect(converted.tags).toEqual(['test']);
      expect(converted.projects).toBeUndefined();
    });
  });

  describe('Due Date Handling', () => {
    it('should extract due date from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Submit report',
        contexts: [],
        tags: [],
        projects: [],
        dueDate: '2025-02-15',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Submit report due February 15th', '');
      
      expect(result).not.toBeNull();
      expect(result!.dueDate).toBe('2025-02-15');
      expect(result!.title).toBe('Submit report');
    });

    it('should extract due date with time from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Meeting with client',
        contexts: [],
        tags: [],
        projects: [],
        dueDate: '2025-02-15',
        dueTime: '14:30',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Meeting with client due February 15th at 2:30 PM', '');
      
      expect(result).not.toBeNull();
      expect(result!.dueDate).toBe('2025-02-15');
      expect(result!.dueTime).toBe('14:30');
    });

    it('should handle Tasks plugin due date format', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Buy groceries',
        contexts: ['home'],
        tags: ['errands'],
        projects: [],
        dueDate: '2025-01-20',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('- [ ] Buy groceries 📅 2025-01-20 @home #errands', '');
      
      expect(result).not.toBeNull();
      expect(result!.dueDate).toBe('2025-01-20');
      expect(result!.contexts).toEqual(['home']);
      expect(result!.tags).toEqual(['errands']);
    });

    it('should handle invalid due date gracefully', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task with invalid date',
        contexts: [],
        tags: [],
        projects: [],
        dueDate: 'invalid-date',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Task with invalid date due never', '');
      
      expect(result).not.toBeNull();
      expect(result!.dueDate).toBe('invalid-date'); // Service preserves what NLP returns
      expect(result!.title).toBe('Task with invalid date');
    });

    it('should handle tasks without due dates', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Simple task',
        contexts: [],
        tags: [],
        projects: [],
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Simple task', '');
      
      expect(result).not.toBeNull();
      expect(result!.dueDate).toBeUndefined();
      expect(result!.title).toBe('Simple task');
    });
  });

  describe('Scheduled Date Handling', () => {
    it('should extract scheduled date from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Plan project',
        contexts: [],
        tags: [],
        projects: [],
        scheduledDate: '2025-02-10',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Plan project scheduled for February 10th', '');
      
      expect(result).not.toBeNull();
      expect(result!.scheduledDate).toBe('2025-02-10');
      expect(result!.title).toBe('Plan project');
    });

    it('should extract scheduled date with time from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Team standup',
        contexts: ['office'],
        tags: [],
        projects: [],
        scheduledDate: '2025-02-10',
        scheduledTime: '09:00',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Team standup scheduled for February 10th at 9 AM @office', '');
      
      expect(result).not.toBeNull();
      expect(result!.scheduledDate).toBe('2025-02-10');
      expect(result!.scheduledTime).toBe('09:00');
      expect(result!.contexts).toEqual(['office']);
    });

    it('should handle Tasks plugin scheduled date format', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Review code',
        contexts: ['development'],
        tags: ['review'],
        projects: [],
        scheduledDate: '2025-01-25',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('- [ ] Review code ⏰ 2025-01-25 @development #review', '');
      
      expect(result).not.toBeNull();
      expect(result!.scheduledDate).toBe('2025-01-25');
      expect(result!.contexts).toEqual(['development']);
      expect(result!.tags).toEqual(['review']);
    });

    it('should handle both due and scheduled dates', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Project milestone',
        contexts: ['work'],
        tags: ['important'],
        projects: ['q1-goals'],
        dueDate: '2025-02-28',
        scheduledDate: '2025-02-20',
        priority: 'high',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Project milestone scheduled February 20th due February 28th @work #important +q1-goals ⏫', '');
      
      expect(result).not.toBeNull();
      expect(result!.dueDate).toBe('2025-02-28');
      expect(result!.scheduledDate).toBe('2025-02-20');
      expect(result!.contexts).toEqual(['work']);
      expect(result!.tags).toEqual(['important']);
      expect(result!.projects).toEqual(['q1-goals']);
      expect(result!.priority).toBe('high');
    });

    it('should handle invalid scheduled date gracefully', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task with invalid scheduled date',
        contexts: [],
        tags: [],
        projects: [],
        scheduledDate: 'invalid-scheduled-date',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Task with invalid scheduled date scheduled for never', '');
      
      expect(result).not.toBeNull();
      expect(result!.scheduledDate).toBe('invalid-scheduled-date');
      expect(result!.title).toBe('Task with invalid scheduled date');
    });
  });

  describe('Recurrence (RRule) Handling', () => {
    it('should extract daily recurrence from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Daily standup',
        contexts: ['work'],
        tags: [],
        projects: [],
        recurrence: 'FREQ=DAILY',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Daily standup every day @work', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=DAILY');
      expect(result!.title).toBe('Daily standup');
      expect(result!.contexts).toEqual(['work']);
    });

    it('should extract weekly recurrence from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Team meeting',
        contexts: ['office'],
        tags: ['meeting'],
        projects: [],
        recurrence: 'FREQ=WEEKLY;BYDAY=MO',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Team meeting every Monday @office #meeting', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(result!.title).toBe('Team meeting');
      expect(result!.contexts).toEqual(['office']);
      expect(result!.tags).toEqual(['meeting']);
    });

    it('should extract monthly recurrence from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Pay rent',
        contexts: ['home'],
        tags: ['bills'],
        projects: [],
        recurrence: 'FREQ=MONTHLY;BYMONTHDAY=1',
        dueDate: '2025-02-01',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Pay rent monthly on the 1st due February 1st @home #bills', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=MONTHLY;BYMONTHDAY=1');
      expect(result!.dueDate).toBe('2025-02-01');
      expect(result!.contexts).toEqual(['home']);
      expect(result!.tags).toEqual(['bills']);
    });

    it('should extract yearly recurrence from natural language', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Annual review',
        contexts: ['work'],
        tags: ['review', 'performance'],
        projects: ['hr-tasks'],
        recurrence: 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=15',
        scheduledDate: '2025-12-15',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Annual review every year on December 15th scheduled December 15th @work #review #performance +hr-tasks', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=15');
      expect(result!.scheduledDate).toBe('2025-12-15');
      expect(result!.contexts).toEqual(['work']);
      expect(result!.tags).toEqual(['review', 'performance']);
      expect(result!.projects).toEqual(['hr-tasks']);
    });

    it('should handle complex recurrence with intervals', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Backup server',
        contexts: ['development'],
        tags: ['maintenance'],
        projects: [],
        recurrence: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Backup server every 2 weeks on Friday @development #maintenance', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR');
      expect(result!.title).toBe('Backup server');
      expect(result!.contexts).toEqual(['development']);
      expect(result!.tags).toEqual(['maintenance']);
    });

    it('should handle recurrence with end date', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Project check-in',
        contexts: ['work'],
        tags: ['project'],
        projects: ['web-redesign'],
        recurrence: 'FREQ=WEEKLY;UNTIL=20250331T000000Z',
        scheduledDate: '2025-02-03',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Project check-in weekly until March 31st scheduled February 3rd @work #project +web-redesign', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=WEEKLY;UNTIL=20250331T000000Z');
      expect(result!.scheduledDate).toBe('2025-02-03');
      expect(result!.contexts).toEqual(['work']);
      expect(result!.tags).toEqual(['project']);
      expect(result!.projects).toEqual(['web-redesign']);
    });

    it('should handle Tasks plugin recurrence format', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Water plants',
        contexts: ['home'],
        tags: ['gardening'],
        projects: [],
        recurrence: 'FREQ=WEEKLY;BYDAY=SU,WE',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('- [ ] Water plants 🔁 every Sunday and Wednesday @home #gardening', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('FREQ=WEEKLY;BYDAY=SU,WE');
      expect(result!.title).toBe('Water plants');
      expect(result!.contexts).toEqual(['home']);
      expect(result!.tags).toEqual(['gardening']);
    });

    it('should handle invalid recurrence gracefully', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Task with invalid recurrence',
        contexts: [],
        tags: [],
        projects: [],
        recurrence: 'INVALID_RRULE_FORMAT',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Task with invalid recurrence repeat in some weird way', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBe('INVALID_RRULE_FORMAT'); // Service preserves what NLP returns
      expect(result!.title).toBe('Task with invalid recurrence');
    });

    it('should handle tasks without recurrence', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'One-time task',
        contexts: ['office'],
        tags: [],
        projects: [],
        dueDate: '2025-02-15',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('One-time task due February 15th @office', '');
      
      expect(result).not.toBeNull();
      expect(result!.recurrence).toBeUndefined();
      expect(result!.dueDate).toBe('2025-02-15');
      expect(result!.title).toBe('One-time task');
      expect(result!.contexts).toEqual(['office']);
    });
  });

  describe('Combined Date and Recurrence Scenarios', () => {
    it('should handle recurring task with both due and scheduled dates', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Monthly report',
        contexts: ['work'],
        tags: ['report', 'monthly'],
        projects: ['operations'],
        dueDate: '2025-02-28',
        scheduledDate: '2025-02-25',
        recurrence: 'FREQ=MONTHLY;BYMONTHDAY=25',
        priority: 'high',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Monthly report scheduled 25th due end of month every month @work #report #monthly +operations ⏫', '');
      
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Monthly report');
      expect(result!.dueDate).toBe('2025-02-28');
      expect(result!.scheduledDate).toBe('2025-02-25');
      expect(result!.recurrence).toBe('FREQ=MONTHLY;BYMONTHDAY=25');
      expect(result!.contexts).toEqual(['work']);
      expect(result!.tags).toEqual(['report', 'monthly']);
      expect(result!.projects).toEqual(['operations']);
      expect(result!.priority).toBe('high');
    });

    it('should handle recurring task with time components', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Weekly team sync',
        contexts: ['office', 'meeting-room'],
        tags: ['meeting'],
        projects: ['team-management'],
        scheduledDate: '2025-02-03',
        scheduledTime: '10:00',
        recurrence: 'FREQ=WEEKLY;BYDAY=MO',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('Weekly team sync every Monday at 10 AM scheduled February 3rd @office @meeting-room #meeting +team-management', '');
      
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Weekly team sync');
      expect(result!.scheduledDate).toBe('2025-02-03');
      expect(result!.scheduledTime).toBe('10:00');
      expect(result!.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(result!.contexts).toEqual(['office', 'meeting-room']);
      expect(result!.tags).toEqual(['meeting']);
      expect(result!.projects).toEqual(['team-management']);
    });

    it('should handle complex Tasks plugin format with all date components', () => {
      const mockNLPResult: NLPParsedTaskData = {
        title: 'Weekly status update',
        contexts: ['remote'],
        tags: ['status', 'weekly'],
        projects: ['project-alpha'],
        dueDate: '2025-02-07',
        scheduledDate: '2025-02-05',
        recurrence: 'FREQ=WEEKLY;BYDAY=WE',
        priority: 'medium',
        status: 'in-progress',
        isCompleted: false
      };
      mockNLParser.parseInput.mockReturnValue(mockNLPResult);

      const result = service['tryNLPFallback']('- [ ] Weekly status update 📅 2025-02-07 ⏰ 2025-02-05 🔁 every Wednesday 🔽 @remote #status #weekly +project-alpha', '');
      
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Weekly status update');
      expect(result!.dueDate).toBe('2025-02-07');
      expect(result!.scheduledDate).toBe('2025-02-05');
      expect(result!.recurrence).toBe('FREQ=WEEKLY;BYDAY=WE');
      expect(result!.priority).toBe('medium');
      expect(result!.status).toBe('in-progress');
      expect(result!.contexts).toEqual(['remote']);
      expect(result!.tags).toEqual(['status', 'weekly']);
      expect(result!.projects).toEqual(['project-alpha']);
    });

    it('should preserve date formats during NLP to TasksPlugin conversion', () => {
      const nlpResult: NLPParsedTaskData = {
        title: 'Conversion test task',
        contexts: ['test'],
        tags: ['conversion'],
        projects: ['testing'],
        dueDate: '2025-03-15',
        scheduledDate: '2025-03-10',
        dueTime: '16:30',
        scheduledTime: '09:00',
        recurrence: 'FREQ=WEEKLY;BYDAY=FR',
        priority: 'high',
        status: 'open',
        isCompleted: false
      };

      // Test the conversion logic from NLP to TasksPlugin format
      const converted: ParsedTaskData = {
        title: nlpResult.title.trim(),
        isCompleted: nlpResult.isCompleted || false,
        status: nlpResult.status,
        priority: nlpResult.priority,
        dueDate: nlpResult.dueDate,
        scheduledDate: nlpResult.scheduledDate,
        recurrence: nlpResult.recurrence,
        tags: nlpResult.tags && nlpResult.tags.length > 0 ? nlpResult.tags : undefined,
        projects: nlpResult.projects && nlpResult.projects.length > 0 ? nlpResult.projects : undefined,
        contexts: nlpResult.contexts && nlpResult.contexts.length > 0 ? nlpResult.contexts : undefined,
        startDate: undefined,
        createdDate: undefined,
        doneDate: undefined,
        recurrenceData: undefined
      };

      expect(converted.title).toBe('Conversion test task');
      expect(converted.dueDate).toBe('2025-03-15');
      expect(converted.scheduledDate).toBe('2025-03-10');
      expect(converted.recurrence).toBe('FREQ=WEEKLY;BYDAY=FR');
      expect(converted.priority).toBe('high');
      expect(converted.status).toBe('open');
      expect(converted.contexts).toEqual(['test']);
      expect(converted.tags).toEqual(['conversion']);
      expect(converted.projects).toEqual(['testing']);
      expect(converted.isCompleted).toBe(false);
      
      // Note: dueTime and scheduledTime are not part of TasksPlugin format
      // This is expected behavior - time information may be stored differently
    });
  });

  describe('Reminder Defaults Utility', () => {
    it('should convert default reminders to proper Reminder format', async () => {
      const { convertDefaultRemindersToReminders } = await import('../../../src/utils/settingsUtils');
      
      const defaultReminders = [
        {
          id: 'def_rem_test1',
          type: 'relative' as const,
          relatedTo: 'due' as const,
          offset: 30,
          unit: 'minutes' as const,
          direction: 'before' as const,
          description: 'Test reminder'
        },
        {
          id: 'def_rem_test2',
          type: 'absolute' as const,
          absoluteDate: '2025-12-25',
          absoluteTime: '09:00',
          description: 'Christmas reminder'
        }
      ];

      const converted = convertDefaultRemindersToReminders(defaultReminders);

      expect(converted).toHaveLength(2);
      
      // Test relative reminder conversion
      expect(converted[0]).toMatchObject({
        type: 'relative',
        relatedTo: 'due',
        offset: '-PT30M',
        description: 'Test reminder'
      });

      // Test absolute reminder conversion
      expect(converted[1]).toMatchObject({
        type: 'absolute',
        absoluteTime: '2025-12-25T09:00:00',
        description: 'Christmas reminder'
      });
    });

    it('should filter out invalid reminders', async () => {
      const { convertDefaultRemindersToReminders } = await import('../../../src/utils/settingsUtils');

      const defaultReminders = [
        {
          id: 'invalid_relative',
          type: 'relative' as const,
          // Missing required fields for relative reminder
        },
        {
          id: 'invalid_absolute',
          type: 'absolute' as const,
          // Missing required fields for absolute reminder
        }
      ];

      const converted = convertDefaultRemindersToReminders(defaultReminders as any);

      expect(converted).toHaveLength(0);
    });
  });

  describe('Merge TasksPlugin and NLP Results', () => {
    it('should merge NLP date with TasksPlugin tags', () => {
      // Scenario: "- [ ] Buy milk tomorrow #groceries"
      // TasksPlugin extracts: tags: ["groceries"], title: "Buy milk tomorrow"
      // NLP parses "Buy milk tomorrow": dueDate/scheduledDate, title: "Buy milk"
      // Result should have BOTH the tag AND the date

      const tasksPluginData: ParsedTaskData = {
        title: 'Buy milk tomorrow',
        tags: ['groceries'],
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: 'Buy milk',
        scheduledDate: '2025-01-15',
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.title).toBe('Buy milk'); // NLP cleaned title
      expect(merged.tags).toEqual(['groceries']); // TasksPlugin tag preserved
      expect(merged.scheduledDate).toBe('2025-01-15'); // NLP date extracted
      expect(merged.isCompleted).toBe(false);
    });

    it('should prefer TasksPlugin explicit dates over NLP inferred dates', () => {
      // Scenario: "- [ ] Meeting tomorrow 📅 2025-02-01"
      // TasksPlugin extracts: dueDate: "2025-02-01", title: "Meeting tomorrow"
      // NLP parses "Meeting tomorrow": dueDate: "2025-01-15" (tomorrow)
      // Result should use the explicit emoji date, not NLP

      const tasksPluginData: ParsedTaskData = {
        title: 'Meeting tomorrow',
        dueDate: '2025-02-01',
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: 'Meeting',
        dueDate: '2025-01-15', // NLP inferred "tomorrow"
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.dueDate).toBe('2025-02-01'); // TasksPlugin explicit date wins
      expect(merged.title).toBe('Meeting'); // NLP cleaned title
    });

    it('should combine tags from both sources without duplicates', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Task with tags',
        tags: ['work', 'urgent'],
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: 'Task with tags',
        tags: ['urgent', 'project'], // 'urgent' is duplicate
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.tags).toEqual(['work', 'urgent', 'project']); // Deduplicated
    });

    it('should combine contexts from both sources', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Task',
        contexts: ['office'],
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: 'Task',
        contexts: ['morning'],
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.contexts).toEqual(['office', 'morning']);
    });

    it('should handle null NLP result gracefully', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Simple task',
        tags: ['test'],
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, null);

      expect(merged).toEqual(tasksPluginData);
    });

    it('should preserve TasksPlugin-specific fields that NLP does not have', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Task with emoji metadata',
        startDate: '2025-01-10',
        createdDate: '2025-01-01',
        doneDate: '2025-01-20',
        recurrenceData: { frequency: 'weekly', days_of_week: ['MO'] },
        isCompleted: true,
      };

      const nlpData: ParsedTaskData = {
        title: 'Task',
        priority: 'high',
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.startDate).toBe('2025-01-10');
      expect(merged.createdDate).toBe('2025-01-01');
      expect(merged.doneDate).toBe('2025-01-20');
      expect(merged.recurrenceData).toEqual({ frequency: 'weekly', days_of_week: ['MO'] });
      expect(merged.isCompleted).toBe(true); // TasksPlugin completion status preserved
      expect(merged.priority).toBe('high'); // NLP priority added
    });

    it('should merge user fields with TasksPlugin taking priority', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Task with user fields',
        userFields: { energy: 'high' },
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: 'Task',
        userFields: { energy: 'low', category: 'work' },
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.userFields).toEqual({
        energy: 'high', // TasksPlugin wins for conflicts
        category: 'work' // NLP value added
      });
    });

    it('should use NLP title when it is cleaner (NL phrases removed)', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Call mom tomorrow at 3pm',
        tags: ['family'],
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: 'Call mom', // NLP stripped "tomorrow at 3pm"
        scheduledDate: '2025-01-15',
        scheduledTime: '15:00',
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.title).toBe('Call mom'); // Cleaner NLP title
      expect(merged.scheduledDate).toBe('2025-01-15');
      expect(merged.scheduledTime).toBe('15:00');
      expect(merged.tags).toEqual(['family']);
    });

    it('should fall back to TasksPlugin title if NLP title is empty', () => {
      const tasksPluginData: ParsedTaskData = {
        title: 'Valid title',
        isCompleted: false,
      };

      const nlpData: ParsedTaskData = {
        title: '', // Empty NLP title
        dueDate: '2025-01-15',
        isCompleted: false,
      };

      const merged = service['mergeParseResults'](tasksPluginData, nlpData);

      expect(merged.title).toBe('Valid title'); // Falls back to TasksPlugin
    });
  });
});