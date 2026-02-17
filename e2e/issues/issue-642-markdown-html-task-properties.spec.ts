/**
 * Issue #642: [FR] Accept Markdown/HTML for Task Properties
 *
 * Feature Request Description:
 * When a user inserts a link into the title or custom properties, it is both
 * un-clickable and cannot be hidden or linked under text. Similarly, markdown
 * formatting (bold, italic, highlights, etc.) is not rendered — the raw syntax
 * is shown as plain text instead.
 *
 * Current Behavior:
 * - Links in task titles are displayed as plain text (not clickable)
 * - Markdown formatting in titles (e.g. **bold**, *italic*) is shown as raw syntax
 * - Custom property values with markdown/HTML are not rendered
 * - Task titles use `createSpan({ text: task.title })` which sets textContent
 *
 * Expected Behavior:
 * - Markdown links in titles should be rendered as clickable links
 * - Basic markdown formatting (bold, italic, highlight) should be rendered
 * - Custom property values should also support markdown rendering
 * - Ideally, titles pass through a markdown rendering pipeline before display
 *
 * @see https://github.com/callumalpass/tasknotes/issues/642
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #642: Accept Markdown/HTML for Task Properties', () => {
	test.beforeAll(async () => {
		app = await launchObsidian();
	});

	test.afterAll(async () => {
		if (app) {
			await closeObsidian(app);
		}
	});

	test.fixme(
		'reproduces issue #642 - markdown link in task title should be rendered as clickable link',
		async () => {
			/**
			 * Steps to reproduce:
			 * 1. Create a task with a markdown link in the title,
			 *    e.g. "Review [project docs](https://example.com)"
			 * 2. Open the Task List view
			 * 3. Observe that the link text is displayed as raw markdown syntax
			 *    rather than as a rendered clickable link
			 *
			 * Expected: The title should render "project docs" as a clickable
			 * hyperlink pointing to https://example.com
			 * Current: The title shows the raw text "[project docs](https://example.com)"
			 */
			const page = app.page;

			// Open the Task List view
			await runCommand(page, 'TaskNotes: Open task list view');
			await page.waitForTimeout(1500);

			// Find a task card title element
			const titleElements = page.locator('.task-card__title-text');
			const titleCount = await titleElements.count();
			console.log(`Found ${titleCount} task title(s) in Task List view`);

			if (titleCount > 0) {
				// Check if any title contains a markdown link rendered as <a>
				// Currently, titles are plain text spans with no child elements
				for (let i = 0; i < Math.min(5, titleCount); i++) {
					const title = titleElements.nth(i);
					const text = await title.textContent();

					// Check if the title text contains markdown link syntax
					if (text && text.includes('](')) {
						console.log(`Title ${i} contains raw markdown link: "${text}"`);

						// Check if there's a rendered <a> element inside the title
						const links = title.locator('a');
						const linkCount = await links.count();

						// EXPECTED: links should be rendered as <a> elements
						// CURRENT: raw markdown syntax shown as plain text, no <a> elements
						console.log(`Links found in title: ${linkCount}`);
						// expect(linkCount).toBeGreaterThan(0);
					}
				}
			}
		}
	);

	test.fixme(
		'reproduces issue #642 - bold/italic markdown in task title should be rendered with formatting',
		async () => {
			/**
			 * Steps to reproduce:
			 * 1. Create a task with bold/italic markdown in the title,
			 *    e.g. "Fix **critical** bug in *parser*"
			 * 2. Open the Task List view
			 * 3. Observe that **bold** and *italic* syntax is shown as raw text
			 *
			 * Expected: "critical" should appear bold, "parser" should appear italic
			 * Current: The raw markdown characters (**) and (*) are visible in the title
			 */
			const page = app.page;

			await runCommand(page, 'TaskNotes: Open task list view');
			await page.waitForTimeout(1500);

			const titleElements = page.locator('.task-card__title-text');
			const titleCount = await titleElements.count();

			if (titleCount > 0) {
				for (let i = 0; i < Math.min(5, titleCount); i++) {
					const title = titleElements.nth(i);
					const text = await title.textContent();

					if (text && (text.includes('**') || text.includes('*'))) {
						console.log(`Title ${i} contains raw markdown formatting: "${text}"`);

						// Check for rendered bold (<strong>) elements
						const boldElements = title.locator('strong');
						const boldCount = await boldElements.count();

						// Check for rendered italic (<em>) elements
						const italicElements = title.locator('em');
						const italicCount = await italicElements.count();

						console.log(`Bold elements: ${boldCount}, Italic elements: ${italicCount}`);

						// EXPECTED: markdown formatting should produce <strong>/<em> elements
						// CURRENT: raw markdown syntax displayed as plain text
						// expect(boldCount + italicCount).toBeGreaterThan(0);
					}
				}
			}
		}
	);

	test.fixme(
		'reproduces issue #642 - markdown in custom property values should be rendered',
		async () => {
			/**
			 * Steps to reproduce:
			 * 1. Create a task with a custom property containing a markdown link,
			 *    e.g. a "notes" property with value "[reference](https://example.com)"
			 * 2. Open the Task List view with the custom property visible
			 * 3. Observe that the link in the custom property is not clickable
			 *
			 * Note: Custom properties already support wikilinks ([[link]]) and
			 * markdown links ([text](url)) via renderTextWithLinks(), but they
			 * do NOT support inline formatting (bold, italic, highlight, etc.)
			 *
			 * Expected: Custom property values should render markdown formatting
			 * Current: Only links are detected; bold/italic/highlight is plain text
			 */
			const page = app.page;

			await runCommand(page, 'TaskNotes: Open task list view');
			await page.waitForTimeout(1500);

			// Look for custom property value containers in task cards
			const propertyValues = page.locator('.task-card__metadata span');
			const propCount = await propertyValues.count();
			console.log(`Found ${propCount} property value span(s)`);

			if (propCount > 0) {
				for (let i = 0; i < Math.min(10, propCount); i++) {
					const prop = propertyValues.nth(i);
					const text = await prop.textContent();

					if (text && (text.includes('**') || text.includes('==') || text.includes('~~'))) {
						console.log(`Property ${i} contains raw markdown: "${text}"`);

						// Check for any rendered formatting elements
						const formattedElements = prop.locator('strong, em, mark, del');
						const formattedCount = await formattedElements.count();

						// EXPECTED: markdown formatting should be rendered
						// CURRENT: raw syntax displayed as plain text
						console.log(`Formatted elements in property: ${formattedCount}`);
						// expect(formattedCount).toBeGreaterThan(0);
					}
				}
			}
		}
	);
});
