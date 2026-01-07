/**
 * Issue #1213: Embedded task list bases create empty space when typing below
 *
 * Bug: When a task list base is embedded in a note, typing new lines below it
 * inserts unwanted empty space between the base and the new lines.
 *
 * Important: This only happens when in a 'new window' i.e. not the primary
 * Obsidian window (popout window).
 *
 * Root cause hypothesis:
 * The embedded task list uses CSS with `max-height: 100vh` and flex layout.
 * In a popout window, the viewport height calculation may differ from the
 * main window, causing layout issues where the embedded view reserves more
 * space than necessary, creating visual gaps when typing below it.
 *
 * Related code locations:
 * - src/bases/TaskListView.ts:102 - `max-height: 100vh; overflow-y: auto`
 * - src/bases/BasesViewBase.ts - Container setup and window context handling
 * - src/utils/VirtualScroller.ts - Scroll container detection
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1213
 */

import { test, expect, Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1213: Embedded task list empty space in popout window', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  // Helper to move current pane to a new popout window
  async function moveToPopoutWindow(page: Page): Promise<Page | null> {
    // Use Obsidian command to move pane to new window
    await runCommand(page, 'Move current pane to new window');
    await page.waitForTimeout(2000);

    // Get the browser context to find the new window
    const context = page.context();
    const pages = context.pages();

    // Return the newest page (the popout window) if one was created
    if (pages.length > 1) {
      // The popout window is typically the last page
      return pages[pages.length - 1];
    }
    return null;
  }

  test.fixme('reproduces issue #1213 - embedded task list creates empty space when typing below in popout window', async () => {
    /**
     * This test reproduces the bug where typing new lines below an embedded
     * task list base in a popout window creates unwanted empty space.
     *
     * STEPS TO REPRODUCE:
     * 1. Open a note with an embedded task list base
     * 2. Move the note to a new/popout window
     * 3. Position cursor below the embedded base
     * 4. Type new lines / content
     * 5. Observe unwanted empty space appearing between the base and new content
     *
     * EXPECTED BEHAVIOR:
     * New content should appear immediately below the embedded task list base
     * with consistent spacing (same as in the primary window).
     *
     * ACTUAL BEHAVIOR (bug):
     * Unwanted empty space appears between the embedded base and the new lines,
     * making the layout appear broken.
     */
    const page = app.page;

    // Open the existing test file with embedded task list
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    // Type the name of the test file
    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-TaskList-Test');
    await page.waitForTimeout(300);

    // Select the first result
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verify the note is open and embedded base is visible
    const embeddedBase = page.locator('.internal-embed, .tn-bases-items-container, .bases-view');
    const baseVisible = await embeddedBase.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!baseVisible) {
      console.log('Embedded task list base not found in test note');
      // Try to verify we at least have the correct note open
      const noteTitle = page.locator('.inline-title, .view-header-title');
      const title = await noteTitle.textContent().catch(() => '');
      console.log('Current note title:', title);
    }

    // Capture the initial layout state in main window
    const mainWindowLayout = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed, .tn-bases-items-container');
      if (embed) {
        const rect = embed.getBoundingClientRect();
        const parent = embed.closest('.markdown-preview-view, .markdown-source-view');
        return {
          embedHeight: rect.height,
          embedBottom: rect.bottom,
          parentScrollHeight: parent?.scrollHeight || 0,
          viewportHeight: window.innerHeight,
        };
      }
      return null;
    });

    console.log('Main window layout before popout:', mainWindowLayout);

    // Move to popout window
    const popoutPage = await moveToPopoutWindow(page);
    if (!popoutPage) {
      console.log('Popout window not available in this test environment');
      return;
    }

    await popoutPage.waitForTimeout(1500);

    // Verify the embedded base is visible in the popout window
    const popoutEmbeddedBase = popoutPage.locator('.internal-embed, .tn-bases-items-container, .bases-view');
    const popoutBaseVisible = await popoutEmbeddedBase.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!popoutBaseVisible) {
      console.log('Embedded task list base not visible in popout window');
      await popoutPage.screenshot({ path: 'test-results/screenshots/issue-1213-popout-no-embed.png' });
      return;
    }

    // Capture layout state in popout window
    const popoutLayout = await popoutPage.evaluate(() => {
      const embed = document.querySelector('.internal-embed, .tn-bases-items-container');
      if (embed) {
        const rect = embed.getBoundingClientRect();
        const parent = embed.closest('.markdown-preview-view, .markdown-source-view');
        return {
          embedHeight: rect.height,
          embedBottom: rect.bottom,
          parentScrollHeight: parent?.scrollHeight || 0,
          viewportHeight: window.innerHeight,
        };
      }
      return null;
    });

    console.log('Popout window layout:', popoutLayout);

    // Take screenshot before typing
    await popoutPage.screenshot({ path: 'test-results/screenshots/issue-1213-before-typing.png' });

    // Switch to edit mode if in reading view
    await runCommand(popoutPage, 'Toggle Live Preview/Source mode').catch(() => {
      // Command might fail, that's ok
    });
    await popoutPage.waitForTimeout(500);

    // Find the editor content area and click at the end of the document
    const editorContent = popoutPage.locator('.cm-content, .markdown-source-view .cm-editor');
    if (await editorContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click at the end of the document
      await editorContent.click();
      await popoutPage.keyboard.press('Control+End');
      await popoutPage.waitForTimeout(300);

      // Type some new lines below the embedded content
      await popoutPage.keyboard.press('Enter');
      await popoutPage.keyboard.press('Enter');
      await popoutPage.keyboard.type('New line 1 - testing empty space issue', { delay: 30 });
      await popoutPage.keyboard.press('Enter');
      await popoutPage.keyboard.type('New line 2 - should appear right below', { delay: 30 });
      await popoutPage.waitForTimeout(500);

      // Take screenshot after typing
      await popoutPage.screenshot({ path: 'test-results/screenshots/issue-1213-after-typing.png' });

      // Capture the layout after typing
      const afterTypingLayout = await popoutPage.evaluate(() => {
        const embed = document.querySelector('.internal-embed, .tn-bases-items-container');
        const newContent = Array.from(document.querySelectorAll('.cm-line'))
          .find(el => el.textContent?.includes('New line 1'));

        if (embed && newContent) {
          const embedRect = embed.getBoundingClientRect();
          const newContentRect = newContent.getBoundingClientRect();
          return {
            embedBottom: embedRect.bottom,
            newContentTop: newContentRect.top,
            gap: newContentRect.top - embedRect.bottom,
          };
        }
        return null;
      });

      console.log('Layout after typing:', afterTypingLayout);

      // The bug is that there's an abnormally large gap between the embed and new content
      // A normal gap should be around 20-50px (normal line spacing)
      // The bug causes gaps of 100px+ due to max-height: 100vh in popout windows
      if (afterTypingLayout) {
        const maxExpectedGap = 100; // pixels - adjust based on expected behavior
        const actualGap = afterTypingLayout.gap;

        console.log(`Gap between embed and new content: ${actualGap}px`);
        console.log(`Expected max gap: ${maxExpectedGap}px`);

        // This assertion documents the expected behavior:
        // The gap should be reasonable (not excessively large)
        expect(actualGap).toBeLessThan(maxExpectedGap);
      }
    } else {
      console.log('Editor content not found in popout window');
      await popoutPage.screenshot({ path: 'test-results/screenshots/issue-1213-no-editor.png' });
    }
  });

  test.fixme('reproduces issue #1213 - layout difference between main window and popout window', async () => {
    /**
     * This test compares the embedded task list layout between the main window
     * and a popout window to identify any viewport-related differences.
     *
     * The issue mentions this "only happens when in a 'new window'" which suggests
     * the bug is related to how viewport height (100vh) is calculated differently
     * in popout windows versus the main Obsidian window.
     */
    const page = app.page;

    // Open a note with embedded task list
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-TaskList-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Measure layout in main window
    const mainWindowMeasurements = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed, .tn-bases-items-container');
      const itemsContainer = document.querySelector('.tn-bases-items-container');

      const result: Record<string, unknown> = {
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };

      if (embed) {
        const embedRect = embed.getBoundingClientRect();
        const embedStyles = window.getComputedStyle(embed);
        result.embed = {
          height: embedRect.height,
          top: embedRect.top,
          bottom: embedRect.bottom,
          maxHeight: embedStyles.maxHeight,
          overflow: embedStyles.overflow,
        };
      }

      if (itemsContainer) {
        const containerRect = itemsContainer.getBoundingClientRect();
        const containerStyles = window.getComputedStyle(itemsContainer);
        result.itemsContainer = {
          height: containerRect.height,
          maxHeight: containerStyles.maxHeight,
          flex: containerStyles.flex,
          overflow: containerStyles.overflowY,
        };
      }

      return result;
    });

    console.log('Main window measurements:', JSON.stringify(mainWindowMeasurements, null, 2));

    // Screenshot main window state
    await page.screenshot({ path: 'test-results/screenshots/issue-1213-main-window.png' });

    // Move to popout window
    const popoutPage = await moveToPopoutWindow(page);
    if (!popoutPage) {
      console.log('Popout window not available in this test environment');
      return;
    }

    await popoutPage.waitForTimeout(1500);

    // Measure layout in popout window
    const popoutMeasurements = await popoutPage.evaluate(() => {
      const embed = document.querySelector('.internal-embed, .tn-bases-items-container');
      const itemsContainer = document.querySelector('.tn-bases-items-container');

      const result: Record<string, unknown> = {
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };

      if (embed) {
        const embedRect = embed.getBoundingClientRect();
        const embedStyles = window.getComputedStyle(embed);
        result.embed = {
          height: embedRect.height,
          top: embedRect.top,
          bottom: embedRect.bottom,
          maxHeight: embedStyles.maxHeight,
          overflow: embedStyles.overflow,
        };
      }

      if (itemsContainer) {
        const containerRect = itemsContainer.getBoundingClientRect();
        const containerStyles = window.getComputedStyle(itemsContainer);
        result.itemsContainer = {
          height: containerRect.height,
          maxHeight: containerStyles.maxHeight,
          flex: containerStyles.flex,
          overflow: containerStyles.overflowY,
        };
      }

      return result;
    });

    console.log('Popout window measurements:', JSON.stringify(popoutMeasurements, null, 2));

    // Screenshot popout window state
    await popoutPage.screenshot({ path: 'test-results/screenshots/issue-1213-popout-window.png' });

    // Compare measurements
    // The bug likely manifests as different max-height calculations
    // or different container heights between windows
    if (mainWindowMeasurements.itemsContainer && popoutMeasurements.itemsContainer) {
      const mainHeight = (mainWindowMeasurements.itemsContainer as { height: number }).height;
      const popoutHeight = (popoutMeasurements.itemsContainer as { height: number }).height;

      console.log(`Main window container height: ${mainHeight}px`);
      console.log(`Popout window container height: ${popoutHeight}px`);

      // The container heights should be proportionally similar
      // Large differences indicate the bug
      const heightDifference = Math.abs(popoutHeight - mainHeight);
      const mainViewportHeight = mainWindowMeasurements.viewportHeight as number;
      const popoutViewportHeight = popoutMeasurements.viewportHeight as number;

      console.log(`Main viewport: ${mainViewportHeight}px, Popout viewport: ${popoutViewportHeight}px`);
      console.log(`Height difference: ${heightDifference}px`);

      // Normalize for viewport differences
      const viewportRatio = popoutViewportHeight / mainViewportHeight;
      const expectedPopoutHeight = mainHeight * viewportRatio;
      const normalizedDifference = Math.abs(popoutHeight - expectedPopoutHeight);

      console.log(`Expected popout height (normalized): ${expectedPopoutHeight}px`);
      console.log(`Normalized difference: ${normalizedDifference}px`);

      // If using max-height: 100vh correctly, heights should scale with viewport
      // Large normalized differences indicate a bug
      expect(normalizedDifference).toBeLessThan(100);
    }
  });

  test.fixme('reproduces issue #1213 - check if other embedded views have same issue', async () => {
    /**
     * The user mentioned they're "not sure whether this is also an issue for other views."
     *
     * This test checks if other embedded view types (kanban, calendar, etc.) have
     * the same empty space issue in popout windows.
     */
    const page = app.page;

    // Create a temporary note with different embedded views to test
    // For now, we just document this as an area for investigation

    console.log('Testing other embedded view types in popout windows');
    console.log('View types to test: TaskList, Kanban, Calendar, Mini-Calendar');

    // This test documents the need to check other view types
    // Each embedded view type may have different container styling
    // that could be affected by the popout window viewport issue

    // Note: A comprehensive fix should ensure ALL embedded base views
    // handle popout window viewports correctly, not just TaskListView

    expect(true).toBe(true); // Placeholder - expand when testing other views
  });
});
