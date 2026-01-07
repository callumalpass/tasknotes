/**
 * Test for issue #934: Emoji Support in Tags
 *
 * Bug Description:
 * If a tag contains an emoji, it is not registered by Natural Language Processing
 * on task creation and therefore not added to the tags property. Also, tags with
 * emojis that have been manually added to the tags property won't display the
 * emoji in the Task View representation of the task.
 *
 * Two aspects of this bug:
 * 1. NLP extraction: Tags with emojis (e.g., #important🔥, #work💼) are not
 *    extracted properly because the regex pattern `[\p{L}\p{N}\p{M}_/-]+`
 *    doesn't include emoji Unicode categories (\p{Emoji} or \p{Extended_Pictographic})
 *
 * 2. Tag rendering: Tags with emojis that are manually added to frontmatter
 *    don't display the emoji in the Task View because the normalizeTag function
 *    strips non-letter/number characters using the same restrictive pattern.
 *
 * Root Cause:
 * The regex patterns in NaturalLanguageParser.ts (line 252) and tagRenderer.ts
 * (line 161) use `\p{L}\p{N}\p{M}` Unicode categories which include letters,
 * numbers, and combining marks, but NOT emojis. Emojis are in separate Unicode
 * categories like \p{Emoji}, \p{Extended_Pictographic}, or \p{So} (Other_Symbol).
 *
 * @see https://github.com/anthropics/tasknotes/issues/934
 */

import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';
import { normalizeTag } from '../../../src/ui/renderers/tagRenderer';
import { renderTextWithLinks, LinkServices } from '../../../src/ui/renderers/linkRenderer';
import { makeContainer } from '../../helpers/dom-helpers';

describe('Issue #934: Emoji Support in Tags', () => {
  describe('NLP Tag Extraction with Emojis', () => {
    let parser: NaturalLanguageParser;
    let mockStatusConfigs: StatusConfig[];
    let mockPriorityConfigs: PriorityConfig[];

    beforeEach(() => {
      mockStatusConfigs = [
        { id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
        { id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 2 }
      ];
      mockPriorityConfigs = [
        { id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 5 }
      ];
      parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true);
    });

    it.skip('reproduces issue #934: should extract tags with trailing emojis', () => {
      // User reports: #important🔥 is not extracted
      const result = parser.parseInput('Complete task #important🔥');

      // BUG: Currently the emoji is stripped and tag becomes just "important"
      // or the entire tag is not extracted at all
      expect(result.tags).toContain('important🔥');
      expect(result.title).toBe('Complete task');
    });

    it.skip('reproduces issue #934: should extract tags with leading emojis', () => {
      // Tags like #🔥hot or #💼work
      const result = parser.parseInput('Review #🔥hot item');

      expect(result.tags).toContain('🔥hot');
      expect(result.title).toBe('Review item');
    });

    it.skip('reproduces issue #934: should extract tags containing emojis in the middle', () => {
      // Tags like #work💼task
      const result = parser.parseInput('Do #work💼task');

      expect(result.tags).toContain('work💼task');
      expect(result.title).toBe('Do');
    });

    it.skip('reproduces issue #934: should extract emoji-only tags', () => {
      // Tags like #🔥 or #💼
      const result = parser.parseInput('Handle #🔥 urgently');

      expect(result.tags).toContain('🔥');
      expect(result.title).toBe('Handle urgently');
    });

    it.skip('reproduces issue #934: should extract multiple tags with different emoji positions', () => {
      const result = parser.parseInput('Task #important🔥 #💼work #code🚀ship');

      expect(result.tags).toContain('important🔥');
      expect(result.tags).toContain('💼work');
      expect(result.tags).toContain('code🚀ship');
      expect(result.title).toBe('Task');
    });

    it.skip('reproduces issue #934: should handle compound emojis in tags', () => {
      // Compound emojis like 👨‍💻 (man technologist) use zero-width joiners
      const result = parser.parseInput('Meeting with #team👨‍💻dev');

      expect(result.tags).toContain('team👨‍💻dev');
      expect(result.title).toBe('Meeting with');
    });

    it.skip('reproduces issue #934: should handle flag emojis in tags', () => {
      // Flag emojis are regional indicator pairs
      const result = parser.parseInput('International #project🇺🇸');

      expect(result.tags).toContain('project🇺🇸');
      expect(result.title).toBe('International');
    });
  });

  describe('Tag Rendering with Emojis (normalizeTag)', () => {
    it.skip('reproduces issue #934: should preserve emojis when normalizing tags', () => {
      // BUG: normalizeTag strips emojis because they don't match \p{L}\p{N}
      const normalized = normalizeTag('important🔥');

      // Currently returns "#important" without the emoji
      expect(normalized).toBe('#important🔥');
    });

    it.skip('reproduces issue #934: should preserve leading emojis in tags', () => {
      const normalized = normalizeTag('🔥hot');

      // Currently returns "#hot" without the emoji
      expect(normalized).toBe('#🔥hot');
    });

    it.skip('reproduces issue #934: should preserve emoji-only tags', () => {
      const normalized = normalizeTag('🔥');

      // Currently returns null because after stripping the emoji, nothing remains
      expect(normalized).toBe('#🔥');
    });

    it.skip('reproduces issue #934: should preserve compound emojis in tags', () => {
      const normalized = normalizeTag('dev👨‍💻team');

      expect(normalized).toBe('#dev👨‍💻team');
    });

    it.skip('reproduces issue #934: should preserve tags with hash prefix and emojis', () => {
      const normalized = normalizeTag('#important🔥');

      expect(normalized).toBe('#important🔥');
    });

    it.skip('reproduces issue #934: should handle mix of Unicode letters, numbers, and emojis', () => {
      // Combining accented characters with emojis
      const normalized = normalizeTag('café☕');

      expect(normalized).toBe('#café☕');
    });
  });

  describe('Tag Display in Task View (renderTextWithLinks)', () => {
    const mockLinkServices: LinkServices = {
      metadataCache: {
        getFirstLinkpathDest: jest.fn().mockReturnValue(null),
      } as any,
      workspace: {
        trigger: jest.fn(),
        getLeaf: jest.fn().mockReturnValue({ openFile: jest.fn() }),
        openLinkText: jest.fn(),
      } as any,
    };

    let container: HTMLElement;
    let tagClickHandler: jest.Mock;

    beforeEach(() => {
      container = makeContainer();
      tagClickHandler = jest.fn();
    });

    it.skip('reproduces issue #934: should render tags with trailing emojis correctly', () => {
      renderTextWithLinks(container, 'Task with #important🔥', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      // BUG: Currently may render as #important without the emoji
      expect(tagElements[0].textContent).toBe('#important🔥');
    });

    it.skip('reproduces issue #934: should render tags with leading emojis correctly', () => {
      renderTextWithLinks(container, 'Handle #🔥hot task', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#🔥hot');
    });

    it.skip('reproduces issue #934: should render emoji-only tags correctly', () => {
      renderTextWithLinks(container, 'Priority #🔥 item', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#🔥');
    });

    it.skip('reproduces issue #934: should pass emoji tags to click handler correctly', () => {
      renderTextWithLinks(container, 'Task #important🔥', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElement = container.querySelector('a.tag') as HTMLElement;
      expect(tagElement).not.toBeNull();

      tagElement.click();

      // Click handler should receive the full tag including emoji
      expect(tagClickHandler).toHaveBeenCalledWith('#important🔥', expect.any(MouseEvent));
    });

    it.skip('reproduces issue #934: should not leave emoji as orphaned text after tag', () => {
      renderTextWithLinks(container, 'Work on #project🚀 today', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const fullText = container.textContent;

      // The emoji should not appear separately as orphaned plain text
      expect(fullText).toBe('Work on #project🚀 today');

      // Verify the tag element contains the full tag with emoji
      const tagElement = container.querySelector('a.tag');
      expect(tagElement?.textContent).toBe('#project🚀');
    });
  });

  describe('Combined emoji and hierarchical tag support', () => {
    let parser: NaturalLanguageParser;
    let mockStatusConfigs: StatusConfig[];
    let mockPriorityConfigs: PriorityConfig[];

    beforeEach(() => {
      mockStatusConfigs = [
        { id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
        { id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 2 }
      ];
      mockPriorityConfigs = [
        { id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 5 }
      ];
      parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true);
    });

    it.skip('reproduces issue #934: should extract hierarchical tags with emojis', () => {
      // Combining issue #1428 (slashes) with #934 (emojis)
      const result = parser.parseInput('Task #project/frontend🚀');

      expect(result.tags).toContain('project/frontend🚀');
      expect(result.title).toBe('Task');
    });

    it.skip('reproduces issue #934: should extract tags with hyphens and emojis', () => {
      const result = parser.parseInput('Handle #bug-fix🐛');

      expect(result.tags).toContain('bug-fix🐛');
      expect(result.title).toBe('Handle');
    });
  });
});
