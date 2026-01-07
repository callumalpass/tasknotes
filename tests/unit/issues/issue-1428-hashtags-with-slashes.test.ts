/**
 * Test for issue #1428: Hashtags containing "/" are not rendered correctly in Agenda and Task views
 *
 * Bug Description:
 * When hashtags contain a forward slash (/) such as #team/member, #customer/customername,
 * or any similar combination, the tags are not displayed correctly in the Agenda view
 * and the default Task view.
 *
 * Instead of being rendered as a single hashtag (green background), the tag appears
 * truncated and inconsistently formatted. For example, #project/backend renders as
 * just #project with the /backend part left as plain text.
 *
 * Root Cause:
 * The tag rendering regex in linkRenderer.ts line 171 uses /(^|\s)(#\w+)/g which only
 * matches word characters (\w) after the hash. It does not match forward slashes or
 * hyphens, causing hierarchical tags like #project/frontend to be truncated to #project.
 *
 * The parser in TasksPluginParser.ts correctly extracts tags with slashes using
 * /#[\w/-]+/g, but the renderer uses a different, more restrictive regex.
 *
 * @see https://github.com/anthropics/tasknotes/issues/1428
 */

import { renderTextWithLinks, LinkServices } from '../../../src/ui/renderers/linkRenderer';
import { makeContainer } from '../../helpers/dom-helpers';

describe.skip('Issue #1428: Hashtags with slashes not rendered correctly', () => {
  // Mock LinkServices for rendering
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

  describe('renderTextWithLinks - hierarchical tags with slashes', () => {
    it('should render #team/member as a single clickable tag', () => {
      renderTextWithLinks(container, 'Task with #team/member', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      // Find all rendered tag elements
      const tagElements = container.querySelectorAll('a.tag');

      // Should have exactly one tag element
      expect(tagElements.length).toBe(1);

      // The tag should contain the full hierarchical tag text
      expect(tagElements[0].textContent).toBe('#team/member');
    });

    it('should render #customer/customername as a single clickable tag', () => {
      renderTextWithLinks(container, 'Contact #customer/customername today', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#customer/customername');
    });

    it('should render #project/frontend as a single clickable tag', () => {
      renderTextWithLinks(container, 'Work on #project/frontend', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#project/frontend');
    });

    it('should render deeply nested hierarchical tags correctly', () => {
      renderTextWithLinks(container, 'Organize #work/project/phase1/task', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#work/project/phase1/task');
    });

    it('should render multiple hierarchical tags in the same text', () => {
      renderTextWithLinks(
        container,
        'Task for #team/frontend and #team/backend',
        mockLinkServices,
        { onTagClick: tagClickHandler }
      );

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(2);
      expect(tagElements[0].textContent).toBe('#team/frontend');
      expect(tagElements[1].textContent).toBe('#team/backend');
    });

    it('should pass the full hierarchical tag to the click handler', () => {
      renderTextWithLinks(container, 'Task #team/member', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElement = container.querySelector('a.tag') as HTMLElement;
      expect(tagElement).not.toBeNull();

      // Simulate click
      tagElement.click();

      // Verify the click handler was called with the FULL tag including the slash
      expect(tagClickHandler).toHaveBeenCalledWith('#team/member', expect.any(MouseEvent));
    });
  });

  describe('renderTextWithLinks - tags with hyphens (regression check)', () => {
    it('should render #my-tag as a single clickable tag', () => {
      renderTextWithLinks(container, 'Task with #my-tag', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#my-tag');
    });

    it('should render #multi-part-tag-name as a single clickable tag', () => {
      renderTextWithLinks(container, 'Item with #multi-part-tag-name', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#multi-part-tag-name');
    });
  });

  describe('renderTextWithLinks - combined slashes and hyphens', () => {
    it('should render #project/sub-project correctly', () => {
      renderTextWithLinks(container, 'Work on #project/sub-project', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#project/sub-project');
    });

    it('should render #team-a/member-1 correctly', () => {
      renderTextWithLinks(container, 'Assign to #team-a/member-1', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#team-a/member-1');
    });
  });

  describe('renderTextWithLinks - tag at start of text', () => {
    it('should render hierarchical tag at the start of text', () => {
      renderTextWithLinks(container, '#team/member is assigned', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      const tagElements = container.querySelectorAll('a.tag');

      expect(tagElements.length).toBe(1);
      expect(tagElements[0].textContent).toBe('#team/member');
    });
  });

  describe('text content verification', () => {
    it('should not leave /member as orphaned plain text after #team', () => {
      renderTextWithLinks(container, 'Task with #team/member assigned', mockLinkServices, {
        onTagClick: tagClickHandler,
      });

      // Get the full text content
      const fullText = container.textContent;

      // The text should NOT contain "/member" as separate plain text
      // It should either be part of the tag or not appear at all outside the tag
      const tagElement = container.querySelector('a.tag');
      const tagText = tagElement?.textContent || '';

      // If the tag is rendered correctly, it should contain both "team" and "member"
      expect(tagText).toContain('team');
      expect(tagText).toContain('member');

      // The remaining text should be "Task with " and " assigned"
      // NOT "Task with " + "#team" + "/member" + " assigned"
      expect(fullText).toBe('Task with #team/member assigned');
    });
  });
});
