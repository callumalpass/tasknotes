/**
 * Test for Issue #769: NLP unexpectedly assigns unmapped/hardcoded "waiting" status when the word "blocked" is typed in the task title
 *
 * This test verifies that when user has custom status configurations, the NLP processor
 * should only use those configurations and not fall back to hardcoded status patterns.
 */

import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';

describe('NaturalLanguageParser - Issue #769 Fix', () => {
  describe('Hardcoded status fallback prevention', () => {
    it('should NOT set status to "waiting" when "blocked" is used with custom status configs', () => {
      // Setup: User has custom status configurations (no "waiting" status defined)
      const customStatuses: StatusConfig[] = [
        { id: 'todo', value: 'todo', label: 'To Do', color: '#808080', isCompleted: false, order: 1 },
        { id: 'doing', value: 'doing', label: 'Doing', color: '#0066cc', isCompleted: false, order: 2 },
        { id: 'review', value: 'review', label: 'In Review', color: '#ff9900', isCompleted: false, order: 3 }
      ];

      const parser = new NaturalLanguageParser(customStatuses, [], false);

      // Test: Parse input with "blocked" keyword (which maps to "waiting" in fallback patterns)
      const result = parser.parseInput('Task is blocked by dependencies');

      // Expectation: Should NOT set status to "waiting" since user has custom configs
      expect(result.status).toBeUndefined();
      expect(result.title).toBe('Task is blocked by dependencies');
    });

    it('should use fallback patterns when NO custom status configs are provided', () => {
      // Setup: No custom status configurations
      const parser = new NaturalLanguageParser([], [], false);

      // Test: Parse input with "blocked" keyword
      const result = parser.parseInput('Task is blocked by dependencies');

      // Expectation: Should use fallback pattern and set status to "waiting"
      expect(result.status).toBe('waiting');
      expect(result.title).toBe('Task is by dependencies'); // "blocked" should be removed
    });

    it('should still work with custom status configs when matching status exists', () => {
      // Setup: User has custom status configurations including one that matches
      const customStatuses: StatusConfig[] = [
        { id: 'todo', value: 'todo', label: 'To Do', color: '#808080', isCompleted: false, order: 1 },
        { id: 'doing', value: 'doing', label: 'Doing', color: '#0066cc', isCompleted: false, order: 2 },
        { id: 'blocked', value: 'blocked', label: 'Blocked', color: '#red', isCompleted: false, order: 3 }
      ];

      const parser = new NaturalLanguageParser(customStatuses, [], false);

      // Test: Parse input with "blocked" keyword that matches custom status
      const result = parser.parseInput('Task is blocked by dependencies');

      // Expectation: Should use custom "blocked" status, not fallback "waiting"
      expect(result.status).toBe('blocked');
      expect(result.title).toBe('Task is by dependencies');
    });

    it('should not use any other hardcoded fallback patterns with custom configs', () => {
      // Setup: User has custom status configurations
      const customStatuses: StatusConfig[] = [
        { id: 'todo', value: 'todo', label: 'To Do', color: '#808080', isCompleted: false, order: 1 },
        { id: 'custom', value: 'custom', label: 'Custom Status', color: '#0066cc', isCompleted: false, order: 2 }
      ];

      const parser = new NaturalLanguageParser(customStatuses, [], false);

      // Test various fallback keywords that should not be recognized
      const testCases = [
        { input: 'Task is waiting for approval', expectedStatus: undefined },
        { input: 'Task is done today', expectedStatus: undefined },
        { input: 'Task is cancelled', expectedStatus: undefined },
        { input: 'Task is in progress', expectedStatus: undefined },
        { input: 'Task is on hold', expectedStatus: undefined }
      ];

      testCases.forEach(({ input, expectedStatus }) => {
        const result = parser.parseInput(input);
        expect(result.status).toBe(expectedStatus);
        // Title should contain the status word since it wasn't recognized
        const statusWord = input.split(' ').find(word =>
          ['waiting', 'done', 'cancelled', 'progress', 'hold'].some(s => word.toLowerCase().includes(s))
        );
        if (statusWord && !statusWord.includes('progress')) { // 'in progress' is two words
          expect(result.title).toContain(statusWord);
        }
      });
    });
  });
});