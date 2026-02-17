/**
 * Issue #648: [FR] Make context entries clickable links
 *
 * Feature Request Description:
 * When a user enters a wikilink like `[[Joe Smith]]` in the context field of a task,
 * it is stored correctly as a clickable link in the task note frontmatter. However,
 * when displayed in Task View, Kanban View, and other views, it appears as `@JoeSmith`
 * — a colored tag span — rather than a clickable internal link that navigates to the
 * referenced note.
 *
 * Current Behavior:
 * - Context entries in views display as non-link tag spans (e.g. `@JoeSmith`)
 * - Clicking a context opens the tag search pane, not the linked note
 * - Spaces are stripped from context names (`Joe Smith` → `JoeSmith`)
 *
 * Expected Behavior:
 * - Context entries containing wikilinks should render as clickable internal links
 * - Clicking such a context should navigate to the linked note
 * - Display text should preserve spaces (e.g. `@Joe Smith`)
 * - Plain text contexts can continue working as tag search buttons
 *
 * @see https://github.com/callumalpass/tasknotes/issues/648
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #648: Make context entries clickable links', () => {
	test.beforeAll(async () => {
		app = await launchObsidian();
	});

	test.afterAll(async () => {
		if (app) {
			await closeObsidian(app);
		}
	});

	test.fixme(
		'reproduces issue #648 - wikilink context should render as clickable link in task list view',
		async () => {
			/**
			 * Steps to reproduce:
			 * 1. Create a note called "Joe Smith" in the vault
			 * 2. Create a task with context set to `[[Joe Smith]]`
			 * 3. Open the Task List view
			 * 4. Observe that the context displays as `@JoeSmith` (non-link span)
			 *
			 * Expected: The context should display as a clickable link (like projects)
			 * that navigates to the "Joe Smith" note when clicked.
			 */
			const page = app.page;

			// Open the Task List view
			await runCommand(page, 'TaskNotes: Open task list view');
			await page.waitForTimeout(1500);

			// Look for a task card with a context entry
			const contextTags = page.locator('.context-tag');
			const contextCount = await contextTags.count();
			console.log(`Found ${contextCount} context tag(s) in Task List view`);

			if (contextCount > 0) {
				const firstContext = contextTags.first();
				const tagName = await firstContext.evaluate(el => el.tagName);
				const text = await firstContext.textContent();

				console.log(`Context tag: <${tagName}> with text "${text}"`);

				// Current: context is rendered as a <span> element
				// Expected: wikilink contexts should be <a> with internal-link class
				// expect(tagName).toBe('A');

				const hasLinkClass = await firstContext.evaluate(
					el => el.classList.contains('internal-link')
				);
				console.log(`Has internal-link class: ${hasLinkClass}`);

				// EXPECTED: wikilink-based contexts should have internal-link class
				// CURRENT: rendered as plain span.context-tag without link semantics
				// expect(hasLinkClass).toBe(true);
			}
		}
	);

	test.fixme(
		'reproduces issue #648 - wikilink context should render as clickable link in kanban view',
		async () => {
			/**
			 * Same issue as the task list view, but verified in the Kanban view.
			 * Context entries with wikilinks should be clickable internal links
			 * in all views where contexts are displayed.
			 */
			const page = app.page;

			// Open the Kanban view
			await runCommand(page, 'TaskNotes: Open kanban view');
			await page.waitForTimeout(1500);

			const contextTags = page.locator('.context-tag');
			const contextCount = await contextTags.count();
			console.log(`Found ${contextCount} context tag(s) in Kanban view`);

			if (contextCount > 0) {
				const firstContext = contextTags.first();
				const tagName = await firstContext.evaluate(el => el.tagName);

				// Current: <span> tag
				// Expected: <a> tag with internal-link class for wikilink contexts
				console.log(`Kanban context rendered as: <${tagName}>`);
				// expect(tagName).toBe('A');
			}
		}
	);

	test.fixme(
		'reproduces issue #648 - clicking wikilink context should navigate to note, not open tag search',
		async () => {
			/**
			 * Currently, clicking any context entry opens the tag search pane
			 * with the context name as a search query (e.g. `#JoeSmith`).
			 *
			 * For contexts that originated from wikilinks, clicking should instead
			 * navigate to the linked note file (e.g. open "Joe Smith.md").
			 */
			const page = app.page;

			await runCommand(page, 'TaskNotes: Open task list view');
			await page.waitForTimeout(1500);

			const contextTags = page.locator('.context-tag');
			const contextCount = await contextTags.count();

			if (contextCount > 0) {
				const firstContext = contextTags.first();
				const text = await firstContext.textContent();
				console.log(`Clicking context: "${text}"`);

				await firstContext.click();
				await page.waitForTimeout(1000);

				// Check what happened after clicking
				// Current: tag search pane opens with query like #JoeSmith
				// Expected: note "Joe Smith.md" should open in the editor

				// Look for search pane (current behavior)
				const searchPane = page.locator('.search-input-container, .workspace-leaf-content[data-type="search"]');
				const searchOpened = await searchPane.isVisible({ timeout: 2000 }).catch(() => false);
				console.log(`Search pane opened after context click: ${searchOpened}`);

				// EXPECTED: For wikilink contexts, the linked note should open instead
				// of the search pane
			}
		}
	);
});
