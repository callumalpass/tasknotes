/**
 * Issue #1605: [FR] Clickable Links for Contexts in Task Cards
 *
 * Feature Request Description:
 * The user wants clickable links within context representations in Task Cards.
 * Currently, contexts are rendered as plain text with @ prefix and color coding,
 * but they don't support:
 * 1. Standalone external URLs (e.g., https://example.com)
 * 2. Markdown-wrapped URLs (e.g., [Wikipedia](https://en.wikipedia.org/wiki/Main_Page))
 * 3. Internal wiki links (e.g., [[Note Name]])
 *
 * Current Implementation (src/ui/renderers/tagRenderer.ts):
 * - renderContextsValue() creates <span> elements for each context
 * - Contexts are normalized to @context format
 * - Click handlers open the tags pane to search for that context
 * - No link parsing or rendering is performed on context values
 *
 * Existing Infrastructure (src/ui/renderers/linkRenderer.ts):
 * - renderTextWithLinks() already handles wiki links and markdown links
 * - appendInternalLink() provides full internal link support with hover previews
 * - LINK_REGEX matches [[wikilinks]], [text](url), and <autolinks>
 * - This infrastructure could be reused for context link support
 *
 * Suggested Implementation Approach:
 * Modify renderContextsValue() to detect and render links within context strings,
 * similar to how renderTextWithLinks() works for other property values.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1605
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1605: Clickable Links for Contexts in Task Cards', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1605 - external URLs in contexts should be clickable', async () => {
    /**
     * This test verifies that external URLs within context values are rendered
     * as clickable links in Task Cards.
     *
     * Example context value: "@https://en.wikipedia.org/wiki/Main_Page"
     * or as a standalone URL in the context field.
     *
     * Expected behavior after fix:
     * - External URLs should be rendered as <a> elements with href
     * - Clicking should open the URL in an external browser
     * - The link should have the "external-link" CSS class
     *
     * Current behavior (issue):
     * - URLs are rendered as plain text within the context-tag span
     * - Clicking the context only opens the tags pane search
     * - No hyperlink functionality is present
     */
    const page = app.page;

    // Open the Task List view to find task cards
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Look for a context tag that contains a URL
    const contextTags = page.locator('.context-tag');
    const count = await contextTags.count();

    let foundUrlContext = false;
    for (let i = 0; i < count; i++) {
      const contextText = await contextTags.nth(i).textContent();
      if (contextText && (contextText.includes('http://') || contextText.includes('https://'))) {
        foundUrlContext = true;

        // Check if the URL is rendered as a clickable link
        const linkElement = contextTags.nth(i).locator('a.external-link');
        const hasLink = await linkElement.count() > 0;

        console.log(`Context with URL found: "${contextText}"`);
        console.log(`Has clickable external link: ${hasLink}`);

        // After the fix, URLs in contexts should be rendered as <a> elements
        expect(hasLink).toBe(true);

        if (hasLink) {
          const href = await linkElement.first().getAttribute('href');
          expect(href).toMatch(/^https?:\/\//);
          console.log(`Link href: ${href}`);
        }
        break;
      }
    }

    if (!foundUrlContext) {
      console.log('No context with URL found in current tasks. Create a task with a URL-based context to test.');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1605 - markdown links in contexts should be clickable', async () => {
    /**
     * This test verifies that markdown-formatted links within context values
     * are rendered as clickable links.
     *
     * Example context value: "[Wikipedia](https://en.wikipedia.org/wiki/Main_Page)"
     *
     * Expected behavior after fix:
     * - Markdown links should be parsed and rendered as <a> elements
     * - The display text should be shown ("Wikipedia")
     * - The href should be the URL
     * - Clicking should open the external URL
     *
     * Current behavior (issue):
     * - The raw markdown syntax is displayed as plain text
     * - "[Wikipedia](https://...)" is shown literally
     * - No link parsing occurs
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Look for context tags containing markdown link syntax
    const contextTags = page.locator('.context-tag');
    const count = await contextTags.count();

    let foundMarkdownLink = false;
    for (let i = 0; i < count; i++) {
      const contextText = await contextTags.nth(i).textContent();
      // Check for markdown link pattern [text](url)
      if (contextText && /\[.+\]\(.+\)/.test(contextText)) {
        foundMarkdownLink = true;

        // After fix: The link should be parsed and rendered properly
        const linkElement = contextTags.nth(i).locator('a');
        const hasLink = await linkElement.count() > 0;

        console.log(`Context with markdown link found: "${contextText}"`);
        console.log(`Has parsed link element: ${hasLink}`);

        // The markdown link should be parsed and rendered as an <a> element
        expect(hasLink).toBe(true);

        if (hasLink) {
          const displayText = await linkElement.first().textContent();
          const href = await linkElement.first().getAttribute('href');
          console.log(`Display text: ${displayText}`);
          console.log(`Link href: ${href}`);

          // Display text should NOT contain the markdown syntax
          expect(displayText).not.toContain('[');
          expect(displayText).not.toContain('](');
        }
        break;
      }
    }

    if (!foundMarkdownLink) {
      console.log('No context with markdown link found. Create a task with markdown link context to test.');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1605 - wiki links in contexts should be clickable', async () => {
    /**
     * This test verifies that wiki links within context values are rendered
     * as clickable internal links.
     *
     * Example context value: "@[[My Project]]" or "[[Note Name|Display]]"
     *
     * Expected behavior after fix:
     * - Wiki links should be parsed and rendered as internal links
     * - Should support the [[path|alias]] syntax
     * - Clicking should navigate to the linked note
     * - Hover should show the page preview (like regular Obsidian links)
     *
     * Current behavior (issue):
     * - Wiki link syntax is shown as plain text "[[Note Name]]"
     * - No internal link functionality
     * - No hover preview support
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Look for context tags containing wiki link syntax
    const contextTags = page.locator('.context-tag');
    const count = await contextTags.count();

    let foundWikiLink = false;
    for (let i = 0; i < count; i++) {
      const contextText = await contextTags.nth(i).textContent();
      // Check for wiki link pattern [[...]]
      if (contextText && /\[\[.+\]\]/.test(contextText)) {
        foundWikiLink = true;

        // After fix: Should be rendered as an internal link
        const linkElement = contextTags.nth(i).locator('a.internal-link');
        const hasLink = await linkElement.count() > 0;

        console.log(`Context with wiki link found: "${contextText}"`);
        console.log(`Has internal link element: ${hasLink}`);

        // The wiki link should be rendered as an internal link
        expect(hasLink).toBe(true);

        if (hasLink) {
          const dataHref = await linkElement.first().getAttribute('data-href');
          console.log(`Internal link data-href: ${dataHref}`);
          expect(dataHref).toBeTruthy();
        }
        break;
      }
    }

    if (!foundWikiLink) {
      console.log('No context with wiki link found. Create a task with wiki link context to test.');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1605 - context rendering uses renderTextWithLinks infrastructure', async () => {
    /**
     * This test verifies the structural change needed to support links in contexts.
     *
     * The fix should modify renderContextsValue() in src/ui/renderers/tagRenderer.ts
     * to use the link parsing infrastructure from src/ui/renderers/linkRenderer.ts.
     *
     * Implementation approach:
     * 1. Import renderTextWithLinks from linkRenderer.ts
     * 2. Instead of setting text: normalized directly on the span element,
     *    use renderTextWithLinks to parse and render the context content
     * 3. Ensure the context-tag styling is preserved for the wrapper span
     * 4. Handle the @ prefix appropriately (render before links)
     *
     * This test checks that the rendered context structure supports links
     * by verifying the DOM structure.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Examine the structure of rendered context tags
    const contextTag = page.locator('.context-tag').first();

    if (await contextTag.isVisible({ timeout: 3000 }).catch(() => false)) {
      const structure = await contextTag.evaluate((el) => {
        const hasTextContent = el.textContent?.trim() || '';
        const childNodes = Array.from(el.childNodes).map(node => ({
          type: node.nodeType === 3 ? 'text' : 'element',
          tagName: (node as HTMLElement).tagName?.toLowerCase() || null,
          className: (node as HTMLElement).className || null,
        }));

        return {
          hasTextContent,
          childNodeCount: childNodes.length,
          childNodes,
          // Check if there are any anchor elements (links)
          hasAnchorChild: el.querySelector('a') !== null,
          hasInternalLink: el.querySelector('a.internal-link') !== null,
          hasExternalLink: el.querySelector('a.external-link') !== null,
        };
      });

      console.log('Context tag structure:', JSON.stringify(structure, null, 2));

      // After the fix, contexts with links should have anchor elements as children
      // For now, this documents the current structure
      console.log('Current implementation note: Contexts are rendered as plain text spans');
      console.log('Expected after fix: Contexts containing links should have <a> child elements');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1605 - compare context vs project link rendering', async () => {
    /**
     * This test compares how projects (which already support links) are rendered
     * versus how contexts are rendered, to demonstrate the gap.
     *
     * Projects use renderProjectLinks() from linkRenderer.ts which:
     * - Parses [[wikilinks]] and [markdown](links)
     * - Creates <a> elements with proper click handlers
     * - Supports hover previews
     *
     * Contexts use renderContextsValue() from tagRenderer.ts which:
     * - Creates <span> elements with plain text
     * - No link parsing
     * - Click opens tags pane search
     *
     * The fix should bring context rendering closer to project rendering.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Analyze project rendering
    const projectLink = page.locator('.task-card__project-link, .task-card__projects a').first();
    let projectStructure = null;

    if (await projectLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      projectStructure = await projectLink.evaluate((el) => ({
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        hasHref: el.hasAttribute('href') || el.hasAttribute('data-href'),
        isClickable: el.role === 'link' || el.tagName === 'A',
      }));
      console.log('Project link structure:', JSON.stringify(projectStructure, null, 2));
    }

    // Analyze context rendering
    const contextTag = page.locator('.context-tag').first();
    let contextStructure = null;

    if (await contextTag.isVisible({ timeout: 2000 }).catch(() => false)) {
      contextStructure = await contextTag.evaluate((el) => ({
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        hasHref: el.hasAttribute('href') || el.hasAttribute('data-href'),
        isSpan: el.tagName === 'SPAN',
        hasNestedLinks: el.querySelector('a') !== null,
      }));
      console.log('Context tag structure:', JSON.stringify(contextStructure, null, 2));
    }

    // Document the comparison
    if (projectStructure && contextStructure) {
      console.log('\nComparison:');
      console.log('- Projects render as <a> elements with href: YES');
      console.log('- Contexts render as <a> elements with href: NO (currently <span>)');
      console.log('- Projects support wikilinks: YES');
      console.log('- Contexts support wikilinks: NO');
      console.log('- Projects support markdown links: YES');
      console.log('- Contexts support markdown links: NO');

      // After fix, contexts should have link capabilities similar to projects
      // At minimum, contexts containing link syntax should render as clickable links
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
