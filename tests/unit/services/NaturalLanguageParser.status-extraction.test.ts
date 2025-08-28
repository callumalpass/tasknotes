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
      expect(result.title).toBe('Task tomorrow at 3pm');
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
      expect(result.title).toBe('Task tomorrow');
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
      expect(result.title).toBe('Task tomorrow');
    });

    it('should handle multiple spaces in status names', () => {
      const spaceConfigs = [
        ...statusConfigs,
        { id: 'spaces', value: 'spaces', label: 'Status   With   Spaces', color: '#blue', isCompleted: false, order: 6 }
      ];
      
      const spaceParser = new NaturalLanguageParser(spaceConfigs, priorityConfigs, false);
      const result = spaceParser.parseInput('Task Status   With   Spaces today');
      
      expect(result.status).toBe('spaces');
      expect(result.title).toBe('Task today');
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
      expect(result.title).toBe('Task is today');
    });
  });

  describe('No Status Configurations', () => {
    it('should work with empty status configurations', () => {
      const emptyParser = new NaturalLanguageParser([], priorityConfigs, false);
      const result = emptyParser.parseInput('Task in progress today');
      
      // Should use fallback pattern
      expect(result.status).toBe('in-progress');
      expect(result.title).toBe('Task today');
    });
  });

  describe('Integration with Other NLP Elements', () => {
    it('should extract status along with other elements', () => {
      const result = parser.parseInput('Buy groceries Active = Now @home #errands tomorrow');
      
      expect(result.status).toBe('active');
      expect(result.contexts).toContain('home');
      expect(result.tags).toContain('errands');
      expect(result.title).toBe('Buy groceries tomorrow');
      expect(result.dueDate).toBeDefined();
    });

    it('should maintain extraction order to prevent conflicts', () => {
      const result = parser.parseInput('Task Active = Now due tomorrow at 2pm @work +project');
      
      expect(result.status).toBe('active');
      expect(result.contexts).toContain('work');
      expect(result.projects).toContain('project');
      expect(result.dueDate).toBeDefined();
      expect(result.dueTime).toBeDefined();
      expect(result.title).toBe('Task due at 2pm');
    });
  });
});
