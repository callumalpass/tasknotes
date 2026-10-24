/**
 * NaturalLanguageParser Unit Tests
 * 
 * Tests for the natural language parsing functionality including:
 * - Basic text parsing and extraction
 * - Date and time parsing with chrono-node
 * - Recurrence pattern recognition and RRule generation
 * - Priority and status extraction
 * - Tags and contexts extraction
 * - Time estimate parsing
 * - Edge cases and error handling
 */

import { NaturalLanguageParser, ParsedTaskData } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';
import { ChronoTestUtils } from '../../__mocks__/chrono-node';
import { RRuleTestUtils } from '../../__mocks__/rrule';

// Mock date-fns to ensure consistent test results
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    } else if (formatStr === 'HH:mm') {
      return date.toISOString().split('T')[1].substring(0, 5);
    }
    return date.toISOString();
  }),
  parse: jest.fn(),
  addDays: jest.fn(),
  addWeeks: jest.fn(),
  addMonths: jest.fn(),
  addYears: jest.fn(),
  startOfDay: jest.fn(),
  isValid: jest.fn(() => true)
}));

describe('NaturalLanguageParser', () => {
  let parser: NaturalLanguageParser;
  let mockStatusConfigs: StatusConfig[];
  let mockPriorityConfigs: PriorityConfig[];

  beforeEach(() => {
    jest.clearAllMocks();
    ChronoTestUtils.reset();
    RRuleTestUtils.reset();

    // Set up mock configurations
    mockStatusConfigs = [
      { id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
      { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#orange', isCompleted: false, order: 2 },
      { id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 3 }
    ];

    mockPriorityConfigs = [
      { id: 'low', value: 'low', label: 'Low', color: '#gray', weight: 1 },
      { id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 5 },
      { id: 'high', value: 'high', label: 'High', color: '#orange', weight: 8 },
      { id: 'urgent', value: 'urgent', label: 'Urgent', color: '#red', weight: 10 }
    ];

    parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true);
  });

  describe('Basic Text Parsing', () => {
    it('should parse simple task title', () => {
      const result = parser.parseInput('Complete project documentation');

      expect(result.title).toBe('Complete project documentation');
      expect(result.tags).toEqual([]);
      expect(result.contexts).toEqual([]);
    });

    it('should handle empty input', () => {
      const result = parser.parseInput('');

      expect(result.title).toBe('Untitled Task');
      expect(result.tags).toEqual([]);
      expect(result.contexts).toEqual([]);
    });

    it('should handle whitespace-only input', () => {
      const result = parser.parseInput('   \n  \t  ');

      expect(result.title).toBe('Untitled Task');
    });

    it('should separate title from details', () => {
      const input = 'Review pull request\nCheck code quality\nVerify tests pass';
      const result = parser.parseInput(input);

      expect(result.title).toBe('Review pull request');
      expect(result.details).toBe('Check code quality\nVerify tests pass');
    });
  });

  describe('Tags and Contexts Extraction', () => {
    it('should extract hashtags as tags', () => {
      const result = parser.parseInput('Complete #documentation #review task');

      expect(result.tags).toEqual(['documentation', 'review']);
      expect(result.title).toBe('Complete task');
    });

    it('should extract @mentions as contexts', () => {
      const result = parser.parseInput('Meeting @work @urgent with team');

      expect(result.contexts).toEqual(['work', 'urgent']);
      expect(result.title).toBe('Meeting with team');
    });

    it('should extract nested contexts with forward slashes', () => {
      const result = parser.parseInput('Buy milk @shopping/groceries @home/kitchen');

      expect(result.contexts).toEqual(['shopping/groceries', 'home/kitchen']);
      expect(result.title).toBe('Buy milk');
    });

    it('should handle mixed tags and contexts', () => {
      const result = parser.parseInput('Fix #bug @home in #codebase @weekend');

      expect(result.tags).toEqual(['bug', 'codebase']);
      expect(result.contexts).toEqual(['home', 'weekend']);
      expect(result.title).toBe('Fix in');
    });

    it('should handle duplicate tags and contexts', () => {
      const result = parser.parseInput('Task #work #work @office @office');

      expect(result.tags).toEqual(['work']);
      expect(result.contexts).toEqual(['office']);
    });

    it('should extract nested tags with forward slashes', () => {
      const result = parser.parseInput('Complete #project/backend #feature/auth task');

      expect(result.tags).toEqual(['project/backend', 'feature/auth']);
      expect(result.title).toBe('Complete task');
    });

    it('should extract mixed regular and nested tags', () => {
      const result = parser.parseInput('Review #documentation #code/frontend #bugfix');

      expect(result.tags).toEqual(['documentation', 'code/frontend', 'bugfix']);
      expect(result.title).toBe('Review');
    });

    it('should handle deeply nested tags', () => {
      const result = parser.parseInput('Fix #project/mobile/ios/authentication issue');

      expect(result.tags).toEqual(['project/mobile/ios/authentication']);
      expect(result.title).toBe('Fix issue');
    });

    it('should handle nested tags with contexts and other elements', () => {
      const result = parser.parseInput('urgent Meeting #project/planning @work due tomorrow');

      expect(result.tags).toEqual(['project/planning']);
      expect(result.contexts).toEqual(['work']);
      expect(result.priority).toBe('urgent');
      expect(result.title).toBe('Meeting');
    });

    it('should extract tags with hyphens correctly', () => {
      const result = parser.parseInput('Configure #Home-Assistant integration');

      expect(result.tags).toEqual(['Home-Assistant']);
      expect(result.title).toBe('Configure integration');
    });
  });

  describe('Projects Extraction', () => {
    it('should extract simple +project syntax', () => {
      const result = parser.parseInput('Complete task +project @work');

      expect(result.projects).toEqual(['project']);
      expect(result.contexts).toEqual(['work']);
      expect(result.title).toBe('Complete task');
    });

    it('should extract multiple projects', () => {
      const result = parser.parseInput('Task +project1 +project2 planning');

      expect(result.projects).toEqual(['project1', 'project2']);
      expect(result.title).toBe('Task planning');
    });

    it('should extract +[[wikilink]] project syntax', () => {
      const result = parser.parseInput('Meeting +[[Project Name With Spaces]]');

      expect(result.projects).toEqual(['[[Project Name With Spaces]]']);
      expect(result.title).toBe('Meeting');
    });

    it('should extract mixed simple and wikilink projects', () => {
      const result = parser.parseInput('Review +simple-project +[[Complex Project Name]]');
      
      expect(result.projects).toEqual(['[[Complex Project Name]]', 'simple-project']);
      expect(result.title).toBe('Review');
    });

    it('should handle projects with forward slashes', () => {
      const result = parser.parseInput('Update +project/subproject documentation');

      expect(result.projects).toEqual(['project/subproject']);
      expect(result.title).toBe('Update documentation');
    });

    it('should remove duplicate projects', () => {
      const result = parser.parseInput('Task +project +project progress');

      expect(result.projects).toEqual(['project']);
      expect(result.title).toBe('Task progress');
    });

    it('should handle projects alongside tags and contexts', () => {
      const result = parser.parseInput('Complete #urgent @work +quarterly-review task');

      expect(result.projects).toEqual(['quarterly-review']);
      expect(result.tags).toEqual(['urgent']);
      expect(result.contexts).toEqual(['work']);
      expect(result.title).toBe('Complete task');
    });

    it('should handle wikilink projects with paths and pipe syntax', () => {
      const result = parser.parseInput('this is a test +[[../../Untitled 9|Untitled 9]]');

      expect(result.projects).toEqual(['[[../../Untitled 9|Untitled 9]]']);
      expect(result.title).toBe('this is a test');
    });

    it('should handle projects with hyphens', () => {
      const result = parser.parseInput('Update +project-with-hyphens documentation');

      expect(result.projects).toEqual(['project-with-hyphens']);
      expect(result.title).toBe('Update documentation');
    });
  });

  describe('Priority Extraction', () => {
    it('should extract configured priority values', () => {
      const result = parser.parseInput('urgent task needs completion');

      expect(result.priority).toBe('urgent');
      expect(result.title).toBe('task needs completion');
    });

    it('should extract configured priority labels', () => {
      const result = parser.parseInput('This is a High priority task');

      expect(result.priority).toBe('high');
      expect(result.title).toBe('This is a priority task');
    });

    it('should use fallback patterns when no config provided', () => {
      // Clear any chrono mocks that might affect this test
      ChronoTestUtils.mockParseResult('tomorrow', []);
      
      const parserWithoutConfig = new NaturalLanguageParser([], [], true);
      const result = parserWithoutConfig.parseInput('important meeting tomorrow');

      expect(result.priority).toBe('high');
      expect(result.title).toBe('meeting tomorrow');
    });

    it('should extract only first priority match', () => {
      const result = parser.parseInput('urgent high priority task');

      expect(result.priority).toBe('urgent');
      expect(result.title).toBe('high priority task');
    });

    it('should be case insensitive', () => {
      const result = parser.parseInput('URGENT task completion');

      expect(result.priority).toBe('urgent');
    });
  });

  describe('Status Extraction', () => {
    it('should extract configured status values', () => {
      const result = parser.parseInput('done with the project');

      expect(result.status).toBe('done');
      expect(result.title).toBe('with the project');
    });

    it('should extract configured status labels', () => {
      const result = parser.parseInput('This task is In Progress');

      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('This task is');
    });

    it('should use fallback patterns when no config provided', () => {
      const parserWithoutConfig = new NaturalLanguageParser([], [], true);
      const result = parserWithoutConfig.parseInput('task is completed');

      expect(result.status).toBe('done');
      expect(result.title).toBe('task is');
    });

    it('should handle compound status phrases', () => {
      const parserWithoutConfig = new NaturalLanguageParser([], [], true);
      const result = parserWithoutConfig.parseInput('task in progress');

      expect(result.status).toBe('in-progress');
    });
  });

  describe('Date and Time Parsing', () => {
    beforeEach(() => {
      // Mock chrono-node to return predictable dates
      const tomorrow = new Date('2025-01-02T14:30:00Z');
      ChronoTestUtils.mockParseResult('tomorrow', [{
        start: {
          date: () => tomorrow,
          isCertain: (component: string) => component === 'hour',
          get: (component: string) => {
            switch (component) {
              case 'year': return 2025;
              case 'month': return 1;
              case 'day': return 2;
              case 'hour': return 14;
              case 'minute': return 30;
              default: return 0;
            }
          }
        },
        text: 'tomorrow',
        index: 0
      }]);
    });

    it('should parse basic date expressions', () => {
      const result = parser.parseInput('Complete task tomorrow');

      expect(result.scheduledDate).toBe('2025-01-02');
      expect(result.title).toBe('Complete task');
    });

    it('should parse explicit due dates', () => {
      const result = parser.parseInput('Task due tomorrow');

      expect(result.dueDate).toBe('2025-01-02');
      expect(result.title).toBe('Task');
    });

    it('should parse scheduled dates', () => {
      const result = parser.parseInput('Task scheduled for tomorrow');

      expect(result.scheduledDate).toBe('2025-01-02');
      expect(result.title).toBe('Task');
    });

    it('should extract time when certain', () => {
      // Mock a specific case for time parsing
      ChronoTestUtils.mockParseResult('tomorrow at 2:30pm', [{
        start: {
          date: () => new Date('2025-01-02T14:30:00Z'),
          isCertain: (component: string) => component === 'hour',
          get: (component: string) => {
            switch (component) {
              case 'year': return 2025;
              case 'month': return 1;
              case 'day': return 2;
              case 'hour': return 14;
              case 'minute': return 30;
              default: return 0;
            }
          }
        },
        text: 'tomorrow at 2:30pm',
        index: 0
      }]);

      const result = parser.parseInput('Meeting tomorrow at 2:30pm');

      expect(result.scheduledDate).toBe('2025-01-02');
      expect(result.scheduledTime).toBe('14:30');
    });

    it('should default to scheduled when defaultToScheduled is true', () => {
      const result = parser.parseInput('Complete task tomorrow');

      expect(result.scheduledDate).toBe('2025-01-02');
      expect(result.dueDate).toBeUndefined();
    });

    it('should default to due when defaultToScheduled is false', () => {
      const parserWithDueDefault = new NaturalLanguageParser([], [], false);
      const result = parserWithDueDefault.parseInput('Complete task tomorrow');

      expect(result.dueDate).toBe('2025-01-02');
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should handle date ranges', () => {
      // Mock chrono to return a range
      ChronoTestUtils.mockParseResult('from tomorrow to next friday', [{
        start: {
          date: () => new Date('2025-01-02T09:00:00Z'),
          get: (component: string) => {
            const date = new Date('2025-01-02T09:00:00Z');
            switch (component) {
              case 'year': return date.getFullYear();
              case 'month': return date.getMonth() + 1;
              case 'day': return date.getDate();
              case 'hour': return date.getHours();
              case 'minute': return date.getMinutes();
              default: return 0;
            }
          },
          isCertain: (component: string) => component === 'hour'
        },
        end: {
          date: () => new Date('2025-01-06T17:00:00Z'),
          get: (component: string) => {
            const date = new Date('2025-01-06T17:00:00Z');
            switch (component) {
              case 'year': return date.getFullYear();
              case 'month': return date.getMonth() + 1;
              case 'day': return date.getDate();
              case 'hour': return date.getHours();
              case 'minute': return date.getMinutes();
              default: return 0;
            }
          },
          isCertain: (component: string) => component === 'hour'
        },
        text: 'from tomorrow to next friday',
        index: 0
      }]);

      const result = parser.parseInput('Project from tomorrow to next friday');

      expect(result.scheduledDate).toBe('2025-01-02');
      expect(result.scheduledTime).toBe('09:00');
      expect(result.dueDate).toBe('2025-01-06');
      expect(result.dueTime).toBe('17:00');
    });

    it('should handle chrono parsing errors gracefully', () => {
      ChronoTestUtils.mockParseResult('invalid date', []);

      const result = parser.parseInput('Task with invalid date');

      expect(result.dueDate).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
      expect(result.title).toBe('Task with invalid date');
    });
  });

  describe('Recurrence Pattern Recognition', () => {
    it('should parse daily recurrence', () => {
      const result = parser.parseInput('Stand-up meeting daily');

      expect(result.recurrence).toBe('FREQ=DAILY');
      expect(result.title).toBe('Stand-up meeting');
    });

    it('should parse weekly recurrence', () => {
      const result = parser.parseInput('Team review weekly');

      expect(result.recurrence).toBe('FREQ=WEEKLY');
      expect(result.title).toBe('Team review');
    });

    it('should parse every N days pattern', () => {
      const result = parser.parseInput('Check email every 3 days');

      expect(result.recurrence).toBe('FREQ=DAILY;INTERVAL=3');
      expect(result.title).toBe('Check email');
    });

    it('should parse every other period', () => {
      const result = parser.parseInput('Client meeting every other week');

      expect(result.recurrence).toBe('FREQ=WEEKLY;INTERVAL=2');
      expect(result.title).toBe('Client meeting');
    });

    it('should parse specific weekdays', () => {
      const result = parser.parseInput('Gym session every monday');

      expect(result.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(result.title).toBe('Gym session');
    });

    it('should parse plural weekdays', () => {
      const result = parser.parseInput('Workout on mondays');

      expect(result.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(result.title).toBe('Workout on');
    });

    it('should parse ordinal weekdays', () => {
      const result = parser.parseInput('Board meeting every first monday');

      expect(result.recurrence).toBe('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1');
      expect(result.title).toBe('Board meeting');
    });

    it('should parse last weekday of month', () => {
      const result = parser.parseInput('Review every last friday');

      expect(result.recurrence).toBe('FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1');
      expect(result.title).toBe('Review');
    });

    it('should parse second/third/fourth weekdays', () => {
      let result = parser.parseInput('Meeting every second monday');
      expect(result.recurrence).toBe('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2');

      result = parser.parseInput('Meeting every third wednesday');
      expect(result.recurrence).toBe('FREQ=MONTHLY;BYDAY=WE;BYSETPOS=3');

      result = parser.parseInput('Meeting every fourth friday');
      expect(result.recurrence).toBe('FREQ=MONTHLY;BYDAY=FR;BYSETPOS=4');
    });

    it('should validate RRule strings and reject invalid ones', () => {
      // Mock an invalid scenario internally
      const result = parser.parseInput('Meeting with invalid recurrence pattern');

      // Should not set recurrence for unrecognized patterns
      expect(result.recurrence).toBeUndefined();
    });

    it('should handle multiple recurrence patterns (use first match)', () => {
      const result = parser.parseInput('Task daily weekly');

      expect(result.recurrence).toBe('FREQ=DAILY');
      expect(result.title).toBe('Task weekly');
    });
  });

  describe('Time Estimate Extraction', () => {
    it('should parse hours only', () => {
      const result = parser.parseInput('Complete task 2 hours');

      expect(result.estimate).toBe(120); // 2 hours = 120 minutes
      expect(result.title).toBe('Complete task');
    });

    it('should parse minutes only', () => {
      const result = parser.parseInput('Quick call 30 minutes');

      expect(result.estimate).toBe(30);
      expect(result.title).toBe('Quick call');
    });

    it('should parse combined format', () => {
      const result = parser.parseInput('Long meeting 1h30m');

      expect(result.estimate).toBe(90); // 1 hour 30 minutes = 90 minutes
      expect(result.title).toBe('Long meeting');
    });

    it('should parse combined format with space', () => {
      const result = parser.parseInput('Long meeting 1h 30m');

      expect(result.estimate).toBe(90);
      expect(result.title).toBe('Long meeting');
    });

    it('should parse various time formats', () => {
      const testCases = [
        { input: 'Task 1hr', expected: 60 },
        { input: 'Task 45min', expected: 45 },
        { input: 'Task 2h', expected: 120 },
        { input: 'Task 30m', expected: 30 },
        { input: 'Task 1 hour', expected: 60 },
        { input: 'Task 45 minutes', expected: 45 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parser.parseInput(input);
        expect(result.estimate).toBe(expected);
      });
    });

    it('should sum multiple time estimates', () => {
      const result = parser.parseInput('Project 2 hours 30 minutes');

      expect(result.estimate).toBe(150); // 2 hours + 30 minutes = 150 minutes
    });

    it('should handle zero or negative estimates', () => {
      const result = parser.parseInput('Task 0 minutes');

      expect(result.estimate).toBeUndefined(); // Should not set estimate for 0
    });
  });

  describe('Complex Parsing Scenarios', () => {
    it('should parse complex input with all components', () => {
      const input = 'urgent Review #documentation @work due tomorrow 2h daily';
      
      // Mock tomorrow for predictable testing
      const tomorrow = new Date('2025-01-02T00:00:00Z');
      ChronoTestUtils.mockParseResult('tomorrow', [{
        start: {
          date: () => tomorrow,
          get: (component: string) => {
            switch (component) {
              case 'year': return tomorrow.getFullYear();
              case 'month': return tomorrow.getMonth() + 1;
              case 'day': return tomorrow.getDate();
              case 'hour': return tomorrow.getHours();
              case 'minute': return tomorrow.getMinutes();
              default: return 0;
            }
          },
          isCertain: () => false
        },
        text: 'tomorrow',
        index: 0
      }]);

      const result = parser.parseInput(input);

      expect(result.title).toBe('Review');
      expect(result.priority).toBe('urgent');
      expect(result.tags).toEqual(['documentation']);
      expect(result.contexts).toEqual(['work']);
      expect(result.dueDate).toBe('2025-01-02');
      expect(result.estimate).toBe(120);
      expect(result.recurrence).toBe('FREQ=DAILY');
    });

    it('should handle input with details', () => {
      const input = 'Review pull request #code\nCheck for:\n- Code quality\n- Test coverage';
      const result = parser.parseInput(input);

      expect(result.title).toBe('Review pull request');
      expect(result.tags).toEqual(['code']);
      expect(result.details).toBe('Check for:\n- Code quality\n- Test coverage');
    });

    it('should prioritize explicit date keywords over defaults', () => {
      const input = 'Task scheduled for tomorrow due next week';
      
      ChronoTestUtils.mockParseResult('tomorrow', [{
        start: { 
          date: () => new Date('2025-01-02T00:00:00Z'), 
          get: (component: string) => {
            const date = new Date('2025-01-02T00:00:00Z');
            switch (component) {
              case 'year': return date.getFullYear();
              case 'month': return date.getMonth() + 1;
              case 'day': return date.getDate();
              case 'hour': return date.getHours();
              case 'minute': return date.getMinutes();
              default: return 0;
            }
          },
          isCertain: () => false 
        },
        text: 'tomorrow',
        index: 0
      }]);

      const result = parser.parseInput(input);

      expect(result.scheduledDate).toBe('2025-01-02');
    });

    it('should handle edge case with only special characters', () => {
      const result = parser.parseInput('#tag @context');

      expect(result.title).toBe('Untitled Task');
      expect(result.tags).toEqual(['tag']);
      expect(result.contexts).toEqual(['context']);
    });

    it('should not match keywords that are substrings of other words', () => {
      const result = parser.parseInput('This is a task for the donec project');
      expect(result.status).toBeUndefined();
      expect(result.title).toBe('This is a task for the donec project');
    });
  });

  describe('Validation and Cleanup', () => {
    it('should remove duplicate tags and contexts', () => {
      const result = parser.parseInput('Task #work #work @office @office');

      expect(result.tags).toEqual(['work']);
      expect(result.contexts).toEqual(['office']);
    });

    it('should filter out empty tags and contexts', () => {
      // Simulate a scenario where empty values might be added
      const result = parser.parseInput('Task # @');

      expect(result.tags).toEqual([]);
      expect(result.contexts).toEqual([]);
    });

    it('should validate date formats', () => {
      // Mock an invalid date scenario
      const mockInvalidDate = require('date-fns');
      mockInvalidDate.isValid.mockReturnValueOnce(false);

      const result = parser.parseInput('Task tomorrow');

      // Invalid dates should be removed
      expect(result.dueDate).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should provide fallback title for empty results', () => {
      const result = parser.parseInput('   ');

      expect(result.title).toBe('Untitled Task');
    });
  });

  describe('Preview Generation', () => {
    it('should generate preview data for parsed task', () => {
      const parsedData: ParsedTaskData = {
        title: 'Review Documentation',
        priority: 'high',
        status: 'open',
        dueDate: '2025-01-02',
        dueTime: '14:30',
        tags: ['documentation'],
        contexts: ['work'],
        projects: [],
        estimate: 120,
        recurrence: 'FREQ=DAILY'
      };

      const preview = parser.getPreviewData(parsedData);

      expect(preview).toContainEqual({ icon: 'edit-3', text: '"Review Documentation"' });
      expect(preview).toContainEqual({ icon: 'alert-triangle', text: 'Priority: high' });
      expect(preview).toContainEqual({ icon: 'activity', text: 'Status: open' });
      expect(preview).toContainEqual({ icon: 'calendar', text: 'Due: 2025-01-02 at 14:30' });
      expect(preview).toContainEqual({ icon: 'tag', text: 'Tags: #documentation' });
      expect(preview).toContainEqual({ icon: 'map-pin', text: 'Contexts: @work' });
      expect(preview).toContainEqual({ icon: 'clock', text: 'Estimate: 120 min' });
      expect(preview).toContainEqual({ icon: 'repeat', text: 'Recurrence: every day' });
    });

    it('should generate text preview', () => {
      const parsedData: ParsedTaskData = {
        title: 'Simple Task',
        priority: 'normal',
        tags: ['test'],
        contexts: [],
        projects: []
      };

      const preview = parser.getPreviewText(parsedData);

      expect(preview).toContain('Simple Task');
      expect(preview).toContain('Priority: normal');
      expect(preview).toContain('Tags: #test');
    });

    it('should handle preview with details truncation', () => {
      const longDetails = 'A'.repeat(100);
      const parsedData: ParsedTaskData = {
        title: 'Task with long details',
        details: longDetails,
        tags: [],
        contexts: [],
        projects: []
      };

      const preview = parser.getPreviewData(parsedData);
      const detailsPreview = preview.find(p => p.icon === 'file-text');

      expect(detailsPreview?.text).toContain('...');
      expect(detailsPreview?.text.length).toBeLessThan(longDetails.length + 20);
    });

    it('should handle invalid recurrence in preview', () => {
      const parsedData: ParsedTaskData = {
        title: 'Task',
        recurrence: 'INVALID_RRULE',
        tags: [],
        contexts: [],
        projects: []
      };

      const preview = parser.getPreviewData(parsedData);
      const recurrencePreview = preview.find(p => p.icon === 'repeat');

      expect(recurrencePreview?.text).toContain('Invalid recurrence');
    });
  });

  describe('Error Handling', () => {
    it('should handle chrono-node parsing errors', () => {
      // Mock chrono to throw an error
      const mockChrono = require('chrono-node');
      mockChrono.parse.mockImplementation(() => {
        throw new Error('Chrono parsing error');
      });

      const result = parser.parseInput('Task tomorrow');

      // Should not throw, should return valid result
      expect(result.title).toBe('Task tomorrow');
      expect(result.dueDate).toBeUndefined();
    });

    it('should handle RRule parsing errors in preview', () => {
      const parsedData: ParsedTaskData = {
        title: 'Task',
        recurrence: 'FREQ=DAILY',
        tags: [],
        contexts: [],
        projects: []
      };

      // Mock RRule.fromString to throw
      const mockRRule = require('rrule');
      mockRRule.RRule.fromString.mockImplementation(() => {
        throw new Error('RRule error');
      });

      const preview = parser.getPreviewData(parsedData);
      const recurrencePreview = preview.find(p => p.icon === 'repeat');

      expect(recurrencePreview?.text).toContain('Invalid recurrence');
    });

    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        '###',
        '@@@',
        'due due due',
        'every every daily',
        '1h2h3h4h5h'
      ];

      malformedInputs.forEach(input => {
        expect(() => parser.parseInput(input)).not.toThrow();
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should work without any configurations', () => {
      const basicParser = new NaturalLanguageParser();
      const result = basicParser.parseInput('high priority task');

      expect(result.priority).toBe('high');
      expect(result.title).toBe('priority task');
    });

    it('should prefer configured values over fallbacks', () => {
      const customStatusConfigs = [
        { id: 'backlog', value: 'backlog', label: 'Backlog', color: '#gray', isCompleted: false, order: 1 }
      ];

      const customParser = new NaturalLanguageParser(customStatusConfigs, [], true);
      const result = customParser.parseInput('backlog task');

      expect(result.status).toBe('backlog');
    });

    it('should handle empty configurations gracefully', () => {
      const emptyParser = new NaturalLanguageParser([], [], true);
      const result = emptyParser.parseInput('urgent important task');

      expect(result.priority).toBe('urgent'); // fallback pattern
      expect(result.title).toBe('important task');
    });
  });
});