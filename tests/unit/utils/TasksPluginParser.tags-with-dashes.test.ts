/**
 * TasksPluginParser - Tags with Dashes Tests
 *
 * Tests documenting Issue #1422: Tags names including dashes not rendered correctly
 *
 * The bug: TAG_PATTERN uses /#[\w/]+/g which doesn't include hyphens.
 * Tags like #my-tag are incorrectly parsed as #my (losing the -tag part).
 *
 * @see https://github.com/anthropics/tasknotes/issues/1422
 */

import { TasksPluginParser } from '../../../src/utils/TasksPluginParser';

describe('Issue #1422: Tags with dashes', () => {
  describe('TasksPluginParser.parseTaskLine - tag extraction', () => {
    it('should extract tags containing dashes', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Task with #my-tag');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.tags).toContain('my-tag');
    });

    it('should extract tags with multiple dashes', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Task with #multi-part-tag-name');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.tags).toContain('multi-part-tag-name');
    });

    it('should extract multiple tags including ones with dashes', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Review #feature-request for #high-priority client');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.tags).toEqual(expect.arrayContaining(['feature-request', 'high-priority']));
    });

    it('should extract hierarchical tags with dashes', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Work on #project/sub-project');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.tags).toContain('project/sub-project');
    });

    it('should preserve dashes in tag names when cleaning title', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Fix bug #my-tag');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.title).toBe('Fix bug');
    });

    it('should handle tags starting with dashes after the hash', () => {
      // Edge case: #-prefixed-tag
      const result = TasksPluginParser.parseTaskLine('- [ ] Test #-prefixed-tag');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.tags).toContain('-prefixed-tag');
    });

    it('should handle tags ending with dashes', () => {
      // Edge case: #trailing-dash-
      const result = TasksPluginParser.parseTaskLine('- [ ] Test #trailing-dash-');

      expect(result.isTaskLine).toBe(true);
      // Whether trailing dash should be included is debatable
      // At minimum, the tag should be extracted
      expect(result.parsedData?.tags?.length).toBeGreaterThan(0);
    });
  });

  describe('TasksPluginParser.parseTaskLine - title cleaning with dashed tags', () => {
    it('should remove entire dashed tag from title', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Complete report #work-related');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.title).toBe('Complete report');
      expect(result.parsedData?.title).not.toContain('-related');
    });

    it('should handle multiple dashed tags in title cleaning', () => {
      const result = TasksPluginParser.parseTaskLine('- [ ] Task #tag-one #tag-two');

      expect(result.isTaskLine).toBe(true);
      expect(result.parsedData?.title).toBe('Task');
      expect(result.parsedData?.title).not.toContain('-one');
      expect(result.parsedData?.title).not.toContain('-two');
    });
  });
});
