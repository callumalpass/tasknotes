/**
 * NaturalLanguageParser Status Extraction Tests
 * 
 * Tests for robust string-based status extraction that handles any characters
 * Obsidian properties accept and prevents conflicts with date parsing.
 */

import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';

describe('NaturalLanguageParser - Status Extraction', () => {
  let parser: NaturalLanguageParser;
  let statusConfigs: StatusConfig[];
  let priorityConfigs: PriorityConfig[];

  beforeEach(() => {
    // Standard status configurations including complex names
    statusConfigs = [
      { id: 'open', value: 'open', label: 'Open', color: '#808080', isCompleted: false, order: 1 },
      { id: 'active', value: 'active', label: 'Active = Now', color: '#0066cc', isCompleted: false, order: 2 },
      { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#ff9900', isCompleted: false, order: 3 },
      { id: 'waiting', value: 'waiting', label: 'Status: Waiting for Review (2024)', color: '#purple', isCompleted: false, order: 4 },
      { id: 'done', value: 'done', label: 'Done', color: '#00aa00', isCompleted: true, order: 5 }
    ];

    priorityConfigs = [
      { id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 }
    ];

    parser = new NaturalLanguageParser(statusConfigs, priorityConfigs, false);
  });

  describe('String-based Status Matching', () => {
    it('should extract simple status labels', () => {
      const result = parser.parseInput('Task with Open status');

      expect(result.status).toBe('open');
      expect(result.title).toBe('Task with status');
    });

    it('should extract complex status labels with special characters', () => {
      const result = parser.parseInput('Task Active = Now');

      expect(result.status).toBe('active');
      expect(result.title).toBe('Task');
      // Should not parse "Now" as a date since status is extracted first
      expect(result.dueDate).toBeUndefined();
    });

    it('should extract status with parentheses and colons', () => {
      const result = parser.parseInput('Task Status: Waiting for Review (2024)');

      expect(result.status).toBe('waiting');
      expect(result.title).toBe('Task');
    });

    it('should handle status values as well as labels', () => {
      const result = parser.parseInput('Task in-progress');

      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('Task');
    });
  });

  describe('Boundary Checking', () => {
    it('should match status at beginning of text', () => {
      const result = parser.parseInput('Open task for review');

      expect(result.status).toBe('open');
      expect(result.title).toBe('task for review');
    });

    it('should match status at end of text', () => {
      const result = parser.parseInput('Task is Done');

      expect(result.status).toBe('done');
      expect(result.title).toBe('Task is');
    });

    it('should match status in middle with proper boundaries', () => {
      const result = parser.parseInput('Task In Progress review');

      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('Task review');
    });

    it('should not match partial words', () => {
      const result = parser.parseInput('Task Progressive work');
      
      // Should not match "Progress" from "Progressive"
      expect(result.status).toBeUndefined();
      expect(result.title).toBe('Task Progressive work');
    });
  });

  describe('Longest Match Priority', () => {
    it('should prefer longer status matches over shorter ones', () => {
      // Add overlapping status configs
      const overlappingConfigs = [
        ...statusConfigs,
        { id: 'progress', value: 'progress', label: 'Progress', color: '#blue', isCompleted: false, order: 6 }
      ];
      
      const overlappingParser = new NaturalLanguageParser(overlappingConfigs, priorityConfigs, false);
      const result = overlappingParser.parseInput('Task In Progress review');

      // Should match "In Progress" (longer) not "Progress" (shorter)
      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('Task review');
    });
  });

  describe('Case Insensitive Matching', () => {
    it('should match status regardless of case', () => {
      const result = parser.parseInput('Task ACTIVE = NOW');

      expect(result.status).toBe('active');
      expect(result.title).toBe('Task');
    });

    it('should match mixed case status', () => {
      const result = parser.parseInput('Task in progress');

      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('Task');
    });
  });

  describe('Date Parser Conflict Prevention', () => {
    it('should extract status before date parsing to prevent "Now" conflicts', () => {
      const result = parser.parseInput('Task Active = Now tomorrow at 3pm');

      expect(result.status).toBe('active');
      expect(result.title).toBe('Task'); // "tomorrow at 3pm" should be parsed as date and removed
      // "Now" should not be parsed as current time since it was removed with status
      expect(result.dueDate).toBeDefined(); // Should parse "tomorrow at 3pm"
      expect(result.dueTime).toBeDefined();
    });

    it('should handle status with other time keywords', () => {
      // Add status with time keyword
      const timeStatusConfigs = [
        ...statusConfigs,
        { id: 'today-status', value: 'today-status', label: 'Due Today', color: '#red', isCompleted: false, order: 6 }
      ];
      
      const timeParser = new NaturalLanguageParser(timeStatusConfigs, priorityConfigs, false);
      const result = timeParser.parseInput('Task Due Today tomorrow');
      
      expect(result.status).toBe('today-status');
      expect(result.title).toBe('Task'); // "tomorrow" should be parsed as date and removed
      // Should parse "tomorrow" as due date, not "Today" from status
      expect(result.dueDate).toBeDefined();
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle Unicode characters in status names', () => {
      const unicodeConfigs = [
        ...statusConfigs,
        { id: 'emoji', value: 'emoji', label: '🔥 High Priority!', color: '#red', isCompleted: false, order: 6 }
      ];
      
      const unicodeParser = new NaturalLanguageParser(unicodeConfigs, priorityConfigs, false);
      const result = unicodeParser.parseInput('Task 🔥 High Priority! tomorrow');
      
      expect(result.status).toBe('emoji');
      expect(result.title).toBe('Task'); // "tomorrow" should be parsed as date and removed
    });

    it('should handle multiple spaces in status names', () => {
      const spaceConfigs = [
        ...statusConfigs,
        { id: 'spaces', value: 'spaces', label: 'Status   With   Spaces', color: '#blue', isCompleted: false, order: 6 }
      ];
      
      const spaceParser = new NaturalLanguageParser(spaceConfigs, priorityConfigs, false);
      const result = spaceParser.parseInput('Task Status   With   Spaces today');
      
      expect(result.status).toBe('spaces');
      expect(result.title).toBe('Task'); // "today" should be parsed as date and removed
    });
  });

  describe('Fallback Regex Patterns', () => {
    it('should use fallback patterns when no custom statuses match', () => {
      const result = parser.parseInput('Task is waiting for approval');
      
      expect(result.status).toBe('waiting');
      expect(result.title).toBe('Task is for approval');
    });

    it('should prefer custom status over fallback patterns', () => {
      const result = parser.parseInput('Task is Done today');
      
      // Should use custom "Done" status, not fallback "done" pattern
      expect(result.status).toBe('done');
      expect(result.title).toBe('Task is'); // "today" should be parsed as date and removed
    });
  });

  describe('No Status Configurations', () => {
    it('should work with empty status configurations', () => {
      const emptyParser = new NaturalLanguageParser([], priorityConfigs, false);
      const result = emptyParser.parseInput('Task in progress today');
      
      // Should use fallback pattern
      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('Task'); // "today" should be parsed as date and removed
    });
  });

  describe('Integration with Other NLP Elements', () => {
    it('should extract status along with other elements', () => {
      const result = parser.parseInput('Buy groceries Active = Now @home #errands tomorrow');
      
      expect(result.status).toBe('active');
      expect(result.contexts).toContain('home');
      expect(result.tags).toContain('errands');
      expect(result.title).toBe('Buy groceries'); // "tomorrow" should be parsed as date and removed
      expect(result.dueDate).toBeDefined();
    });

    it('should maintain extraction order to prevent conflicts', () => {
      const result = parser.parseInput('Task Active = Now due tomorrow at 2pm @work +project');

      expect(result.status).toBe('active');
      expect(result.contexts).toContain('work');
      expect(result.projects).toContain('project');
      expect(result.dueDate).toBeDefined();
      expect(result.dueTime).toBeDefined();
      expect(result.title).toBe('Task'); // "due tomorrow at 2pm" should be parsed as date and removed
    });
  });

  describe('Regression Tests - Issue: Status Parsing with Markdown Special Characters', () => {
    it('should extract status when autocomplete inserts the VALUE instead of LABEL', () => {
      // CRITICAL: Autocomplete inserts s.value, not s.label!
      // So if label is "*41🟩Done = Recent" and value is "done-recent",
      // the autocomplete will insert "done-recent " into the text
      const statusWithAsterisk: StatusConfig[] = [
        { id: 'done-recent', value: 'done-recent', label: '*41🟩Done = Recent', color: '#00aa00', isCompleted: true, order: 1 }
      ];
      const parserWithAsterisk = new NaturalLanguageParser(statusWithAsterisk, priorityConfigs, false);

      // This is what actually gets inserted by autocomplete
      const result = parserWithAsterisk.parseInput('Task done-recent ');

      expect(result.status).toBe('done-recent');
      expect(result.title).toBe('Task');
    });

    it('should extract status when user types trigger + label manually (FIXED!)', () => {
      // ROOT CAUSE: User has status with label "41🟩Done = Recent" (no asterisk)
      // User types "*" (trigger) + "41🟩Done = Recent" manually
      // Text becomes "Task *41🟩Done = Recent"
      // FIX: Parser now tries matching both "41🟩Done = Recent" and "*41🟩Done = Recent"
      const statusWithoutAsterisk: StatusConfig[] = [
        { id: 'done-recent', value: 'done-recent', label: '41🟩Done = Recent', color: '#00aa00', isCompleted: true, order: 1 }
      ];
      const parserWithoutAsterisk = new NaturalLanguageParser(statusWithoutAsterisk, priorityConfigs, false);

      // User types "*41🟩Done = Recent" (trigger + label)
      const result = parserWithoutAsterisk.parseInput('Task *41🟩Done = Recent');

      // FIXED: Status should now be extracted correctly
      expect(result.status).toBe('done-recent');
      expect(result.title).toBe('Task');
    });

    it('should extract status starting with underscore (markdown bold marker)', () => {
      const statusWithUnderscore: StatusConfig[] = [
        { id: 'important', value: 'important', label: '_Important_', color: '#ff0000', isCompleted: false, order: 1 }
      ];
      const parserWithUnderscore = new NaturalLanguageParser(statusWithUnderscore, priorityConfigs, false);

      const result = parserWithUnderscore.parseInput('Task _Important_');

      expect(result.status).toBe('important');
      expect(result.title).toBe('Task');
    });

    it('should extract status starting with tilde (markdown strikethrough marker)', () => {
      const statusWithTilde: StatusConfig[] = [
        { id: 'deprecated', value: 'deprecated', label: '~Deprecated~', color: '#gray', isCompleted: false, order: 1 }
      ];
      const parserWithTilde = new NaturalLanguageParser(statusWithTilde, priorityConfigs, false);

      const result = parserWithTilde.parseInput('Task ~Deprecated~');

      expect(result.status).toBe('deprecated');
      expect(result.title).toBe('Task');
    });

    it('should extract status with brackets (markdown link markers)', () => {
      const statusWithBrackets: StatusConfig[] = [
        { id: 'linked', value: 'linked', label: '[Linked]', color: '#blue', isCompleted: false, order: 1 }
      ];
      const parserWithBrackets = new NaturalLanguageParser(statusWithBrackets, priorityConfigs, false);

      const result = parserWithBrackets.parseInput('Task [Linked]');

      expect(result.status).toBe('linked');
      expect(result.title).toBe('Task');
    });
  });

  describe('Regression Tests - Issue: Status with Temporal Keywords', () => {
    it('should extract status containing "Now" without parsing it as a date', () => {
      // Regression: Status "10🔥Expedite = Now" had "Now" parsed as due date
      const statusWithNow: StatusConfig[] = [
        { id: 'expedite', value: 'expedite', label: '10🔥Expedite = Now', color: '#ff0000', isCompleted: false, order: 1 }
      ];
      const parserWithNow = new NaturalLanguageParser(statusWithNow, priorityConfigs, false);

      const result = parserWithNow.parseInput('Task 10🔥Expedite = Now');

      expect(result.status).toBe('expedite');
      expect(result.title).toBe('Task');
      // "Now" should NOT be parsed as a date since it's part of the status
      expect(result.dueDate).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should extract status with trigger + temporal keyword without parsing as date', () => {
      // User types "*10🔥Expedite = Now" (trigger + label with temporal keyword)
      const statusWithNow: StatusConfig[] = [
        { id: 'expedite', value: 'expedite', label: '10🔥Expedite = Now', color: '#ff0000', isCompleted: false, order: 1 }
      ];
      const parserWithNow = new NaturalLanguageParser(statusWithNow, priorityConfigs, false);

      const result = parserWithNow.parseInput('Task *10🔥Expedite = Now');

      expect(result.status).toBe('expedite');
      expect(result.title).toBe('Task');
      // "Now" should NOT be parsed as a date since it's part of the status
      expect(result.dueDate).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should extract status containing "Today" without parsing it as a date', () => {
      const statusWithToday: StatusConfig[] = [
        { id: 'today-priority', value: 'today-priority', label: 'Due Today', color: '#ff0000', isCompleted: false, order: 1 }
      ];
      const parserWithToday = new NaturalLanguageParser(statusWithToday, priorityConfigs, false);

      const result = parserWithToday.parseInput('Task Due Today');

      expect(result.status).toBe('today-priority');
      expect(result.title).toBe('Task');
      // "Today" should NOT be parsed as a date since it's part of the status
      expect(result.dueDate).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should extract status containing "Tomorrow" without parsing it as a date', () => {
      const statusWithTomorrow: StatusConfig[] = [
        { id: 'tomorrow-status', value: 'tomorrow-status', label: 'For Tomorrow', color: '#blue', isCompleted: false, order: 1 }
      ];
      const parserWithTomorrow = new NaturalLanguageParser(statusWithTomorrow, priorityConfigs, false);

      const result = parserWithTomorrow.parseInput('Task For Tomorrow');

      expect(result.status).toBe('tomorrow-status');
      expect(result.title).toBe('Task');
      // "Tomorrow" should NOT be parsed as a date since it's part of the status
      expect(result.dueDate).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
    });

    it('should extract status with temporal keyword and still parse separate date', () => {
      // Status contains "Now" but there's also a separate "tomorrow" that should be parsed
      const statusWithNow: StatusConfig[] = [
        { id: 'expedite', value: 'expedite', label: '10🔥Expedite = Now', color: '#ff0000', isCompleted: false, order: 1 }
      ];
      const parserWithNow = new NaturalLanguageParser(statusWithNow, priorityConfigs, false);

      const result = parserWithNow.parseInput('Task 10🔥Expedite = Now tomorrow');

      expect(result.status).toBe('expedite');
      expect(result.title).toBe('Task');
      // "tomorrow" should be parsed as a date (separate from status)
      expect(result.dueDate).toBeDefined();
    });
  });
});
