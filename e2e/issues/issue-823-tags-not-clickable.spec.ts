/**
 * Issue #823: [Bug]: Tags are not clickable, not searchable
 *
 * Bug Description:
 * When using Kanban view, clicking on a tag should filter the view to show
 * only tasks with that tag by opening Obsidian's search pane with a tag query.
 * Instead, users see an error notification:
 * "Search pane opened but could not set tag query"
 *
 * Root cause:
 * The openTagsPane() method in src/main.ts:1987 tries to set the search query
 * using several methods:
 * 1. searchView.setQuery() - for newer Obsidian versions
 * 2. searchView.searchComponent.setValue() - alternative method
 * 3. searchView.searchInputEl.value - direct DOM manipulation fallback
 *
 * If none of these methods are available (due to Obsidian version differences
 * or the search view not being fully loaded/initialized), the error is shown.
 *
 * The issue is that:
 * - The search leaf may be created but the view not fully initialized
 * - Some Obsidian versions may have different API structures
 * - There may be a timing issue where the view isn't ready when we try to set the query
 *
 * Affected code paths:
 * - src/main.ts:1987-2055 - openTagsPane() method
 * - src/ui/TaskCard.ts:688-694 - contexts onTagClick handler
 * - src/ui/TaskCard.ts:720-726 - tags onTagClick handler
 * - src/ui/TaskCard.ts:1094-1100 - generic property tag click handler
 * - src/ui/renderers/tagRenderer.ts - tag rendering with click handlers
 *
 * @see https://github.com/callumalpass/tasknotes/issues/823
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #823: Tags not clickable in Kanban view', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #823 - clicking tag in Kanban view should open search with tag query', async () => {
    /**
     * This test reproduces the main issue: clicking a tag in Kanban view
     * should open the search pane and set the search query to filter by that tag.
     *
     * Expected behavior:
     * - Click on a tag in a task card
     * - Search pane opens in left sidebar
     * - Search query is set to "tag:#tagname"
     * - Search results show tasks with that tag
     *
     * Current behavior:
     * - Click on a tag
     * - Search pane opens
     * - Error notification: "Search pane opened but could not set tag query"
     * - Search query is not set
     */
    const page = app.page;

    // First open a Kanban board view
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    // Verify Kanban board is visible
    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Find task cards with tags
    const taskCards = page.locator('.task-card');
    const cardCount = await taskCards.count();
    console.log(`Found ${cardCount} task cards`);

    // Look for tag elements within task cards
    const tagElements = page.locator('.task-card .tag, .task-card__metadata-pill--tags .tag');
    const tagCount = await tagElements.count();
    console.log(`Found ${tagCount} tag elements`);

    if (tagCount > 0) {
      const firstTag = tagElements.first();
      const tagText = await firstTag.textContent();
      console.log(`Clicking on tag: ${tagText}`);

      // Click the tag
      await firstTag.click();
      await page.waitForTimeout(1000);

      // Check for error notification (the bug behavior)
      const errorNotice = page.locator('.notice').filter({
        hasText: /could not set tag query/i,
      });
      const hasError = await errorNotice.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasError) {
        console.log('BUG REPRODUCED: Error notification appeared');
        // This is the bug - we should NOT see this error
      }

      // Check if search pane opened
      const searchPane = page.locator('.workspace-leaf-content[data-type="search"]');
      const searchPaneVisible = await searchPane.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Search pane visible: ${searchPaneVisible}`);

      if (searchPaneVisible) {
        // Check if search query was set correctly
        const searchInput = page.locator('.search-input-container input, .search-input');
        const searchValue = await searchInput.inputValue().catch(() => '');
        console.log(`Search query value: "${searchValue}"`);

        // The search should contain "tag:" followed by the tag name
        const expectedTagName = tagText?.replace('#', '') || '';
        const hasCorrectQuery = searchValue.includes('tag:') && searchValue.includes(expectedTagName);
        console.log(`Search query correctly set: ${hasCorrectQuery}`);

        // After fix: expect(hasCorrectQuery).toBe(true);
        // After fix: expect(hasError).toBe(false);
      }
    } else {
      console.log('No tags found in Kanban view - need test data with tags');
    }
  });

  test.fixme('reproduces issue #823 - tag search should work when search pane is already open', async () => {
    /**
     * This test checks if the tag click works when the search pane is already
     * open, which might have different behavior than when creating a new search leaf.
     *
     * Expected behavior:
     * - Search pane is already open
     * - Click on a tag in a task card
     * - Search query is updated to filter by that tag
     *
     * This tests a different code path where searchLeaf already exists.
     */
    const page = app.page;

    // First, manually open the search pane
    await runCommand(page, 'Search: Search in all files');
    await page.waitForTimeout(1000);

    // Verify search pane is open
    const searchPane = page.locator('.workspace-leaf-content[data-type="search"]');
    await expect(searchPane).toBeVisible({ timeout: 5000 });

    // Now open Kanban board
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Find and click a tag
    const tagElements = page.locator('.task-card .tag');
    const tagCount = await tagElements.count();

    if (tagCount > 0) {
      const firstTag = tagElements.first();
      const tagText = await firstTag.textContent();
      console.log(`Clicking on tag with search already open: ${tagText}`);

      await firstTag.click();
      await page.waitForTimeout(1000);

      // Check for error
      const errorNotice = page.locator('.notice').filter({
        hasText: /could not set tag query/i,
      });
      const hasError = await errorNotice.isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Error when search pane already open: ${hasError}`);

      // Check if search query was updated
      const searchInput = page.locator('.search-input-container input, .search-input');
      const searchValue = await searchInput.inputValue().catch(() => '');
      console.log(`Search query after click: "${searchValue}"`);

      // After fix: Search should have the tag query set correctly
    } else {
      console.log('No tags found - need test data');
    }
  });

  test.fixme('reproduces issue #823 - context tags should also be clickable and searchable', async () => {
    /**
     * This test verifies that context tags (@context) are also clickable
     * and trigger the same search behavior.
     *
     * The code in TaskCard.ts handles both regular tags and contexts,
     * so both should have the same issue.
     *
     * Expected behavior:
     * - Click on a @context tag in a task card
     * - Search pane opens with query for that context
     */
    const page = app.page;

    // Open Kanban board
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Look for context tags (rendered with .context-tag class)
    const contextTags = page.locator('.task-card .context-tag');
    const contextCount = await contextTags.count();
    console.log(`Found ${contextCount} context tag elements`);

    if (contextCount > 0) {
      const firstContext = contextTags.first();
      const contextText = await firstContext.textContent();
      console.log(`Clicking on context: ${contextText}`);

      await firstContext.click();
      await page.waitForTimeout(1000);

      // Check for error
      const errorNotice = page.locator('.notice').filter({
        hasText: /could not set tag query/i,
      });
      const hasError = await errorNotice.isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Error when clicking context tag: ${hasError}`);

      // After fix: expect(hasError).toBe(false);
    } else {
      console.log('No context tags found - need test data with contexts');
    }
  });

  test.fixme('reproduces issue #823 - tag click should handle deferred/lazy-loaded search views', async () => {
    /**
     * This test addresses a potential root cause: Obsidian may defer loading
     * of views until they're actually needed. When openTagsPane() creates a
     * new search leaf, the view might not be fully initialized yet.
     *
     * The fix should:
     * 1. Wait for the search view to be fully loaded before setting the query
     * 2. Or use Obsidian's global search API instead of manipulating the view directly
     *
     * Expected behavior after fix:
     * - Even if search view was never opened before, clicking a tag should work
     */
    const page = app.page;

    // Start fresh by reloading or ensuring search pane hasn't been opened
    // (This is hard to guarantee in E2E but we can try)

    // Open Kanban board first
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Find a tag and click it
    const tagElements = page.locator('.task-card .tag');
    if (await tagElements.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const firstTag = tagElements.first();
      const tagText = await firstTag.textContent();

      console.log(`Testing deferred view scenario with tag: ${tagText}`);

      // Click the tag
      await firstTag.click();

      // Give extra time for async operations
      await page.waitForTimeout(2000);

      // Verify the search pane is visible and query is set
      const searchPane = page.locator('.workspace-leaf-content[data-type="search"]');
      const isSearchVisible = await searchPane.isVisible({ timeout: 3000 }).catch(() => false);

      if (isSearchVisible) {
        // Additional check: is the search view actually initialized?
        const searchInput = page.locator('.search-input-container input, .search-input');
        const inputVisible = await searchInput.isVisible({ timeout: 1000 }).catch(() => false);
        console.log(`Search input visible (view initialized): ${inputVisible}`);

        if (inputVisible) {
          const searchValue = await searchInput.inputValue().catch(() => '');
          console.log(`Search value in deferred scenario: "${searchValue}"`);
        }
      }

      // Check for error
      const errorNotice = page.locator('.notice').filter({
        hasText: /could not set tag query/i,
      });
      const hasError = await errorNotice.isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`Error in deferred view scenario: ${hasError}`);
    }
  });

  test.fixme('reproduces issue #823 - verify tag click handler is attached', async () => {
    /**
     * This test verifies that the click handler is actually attached to tag elements.
     * If tags are not clickable at all (not just failing to set query), this would
     * indicate a different issue with the tag rendering.
     *
     * The tagRenderer.ts creates tags with:
     * - role="button" attribute
     * - tabindex="0" for keyboard accessibility
     * - click and keydown event listeners
     */
    const page = app.page;

    // Open Kanban board
    await runCommand(page, 'TaskNotes: Open task board');
    await page.waitForTimeout(2000);

    const kanbanBoard = page.locator('.kanban-view__board');
    await kanbanBoard.waitFor({ timeout: 10000 });

    // Find tag elements
    const tagElements = page.locator('.task-card .tag');
    const tagCount = await tagElements.count();

    if (tagCount > 0) {
      const firstTag = tagElements.first();

      // Check that tag has expected attributes
      const role = await firstTag.getAttribute('role');
      const tabindex = await firstTag.getAttribute('tabindex');

      console.log(`Tag attributes - role: ${role}, tabindex: ${tabindex}`);

      // Tags should have role="button" and tabindex="0" for accessibility
      expect(role).toBe('button');
      expect(tabindex).toBe('0');

      // Check if the tag is styled as clickable (cursor: pointer)
      const cursor = await firstTag.evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });
      console.log(`Tag cursor style: ${cursor}`);

      // Should be 'pointer' to indicate it's clickable
      // expect(cursor).toBe('pointer');
    }
  });
});
