/**
 * Issue #765: [FR] Reduce side margins in embedded Bases when using side panels
 *
 * Feature Request: When TaskNotes views are embedded via Bases plugin in a note,
 * the side margins are larger than when using the plugin directly in the sidebar.
 * This wastes valuable screen space, especially on small monitors.
 *
 * User workflow:
 * - Works with a small monitor and uses TaskNotes in the sidebar
 * - When using the plugin directly in the sidebar, tasks use maximum space with minimal indents
 * - When embedding a Bases view in a note (e.g., in a side panel), larger margins appear
 *
 * Root cause analysis:
 * When TaskNotes views are embedded via Bases plugin in markdown notes:
 * 1. The embed is wrapped in Obsidian's `.markdown-embed` > `.inline-embed` > `.markdown-preview-view`
 * 2. `.markdown-preview-view` applies `padding: var(--file-margins)` which is typically 32px
 * 3. In the sidebar, views are rendered directly without this wrapper and its padding
 *
 * Related CSS variables (from Obsidian's app.css):
 * - `--file-margins: var(--file-margins-y) var(--file-margins-x)`
 * - `--file-margins-x: var(--size-4-8)` = 32px on desktop
 * - On mobile, `--file-margins-x: var(--size-4-6)` = 24px
 *
 * Related files:
 * - src/bases/registration.ts - Registers Bases view factories
 * - src/bases/BasesViewBase.ts - Base class for Bases views
 * - src/bases/TaskListView.ts - Task list view implementation
 * - styles/bases-views.css - Bases view styling
 *
 * @see https://github.com/callumalpass/tasknotes/issues/765
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #765: Reduce side margins in embedded Bases when using side panels', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #765 - embedded Bases view has larger margins than sidebar view', async () => {
    /**
     * This test compares the margins/padding of TaskNotes views in two contexts:
     * 1. Rendered directly in a sidebar panel (minimal margins)
     * 2. Embedded via Bases plugin in a note displayed in a side panel (larger margins)
     *
     * EXPECTED BEHAVIOR:
     * Both contexts should have similar compact margins to maximize usable space,
     * especially important for users with small monitors.
     *
     * ACTUAL BEHAVIOR (issue):
     * The embedded Bases view has significantly larger side margins (32px+) due to
     * Obsidian's --file-margins CSS variable applied to .markdown-preview-view wrapper.
     */
    const page = app.page;

    // First, open TaskNotes view directly in sidebar
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1000);

    // Measure margins in direct sidebar view
    const sidebarMeasurements = await page.evaluate(() => {
      // Find TaskNotes view in sidebar
      const sidebarView = document.querySelector('.workspace-leaf-content[data-type*="tasknotes"], .workspace-leaf-content .tn-bases-tasknotes-list, .workspace-leaf-content .tn-task-list-view');
      if (!sidebarView) {
        return null;
      }

      const rect = sidebarView.getBoundingClientRect();
      const styles = window.getComputedStyle(sidebarView);
      const parent = sidebarView.closest('.workspace-leaf');
      const parentRect = parent?.getBoundingClientRect();

      return {
        viewWidth: rect.width,
        parentWidth: parentRect?.width || 0,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        marginLeft: styles.marginLeft,
        marginRight: styles.marginRight,
        leftOffset: parentRect ? rect.left - parentRect.left : 0,
        rightOffset: parentRect ? parentRect.right - rect.right : 0,
        totalHorizontalPadding: (parentRect?.width || 0) - rect.width,
      };
    });

    console.log('Sidebar view measurements:', JSON.stringify(sidebarMeasurements, null, 2));

    // Take screenshot of sidebar view
    await page.screenshot({ path: 'test-results/screenshots/issue-765-sidebar-view.png' });

    // Now open a note with embedded Bases view
    // First try to find an existing test note or create one
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-TaskList-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Measure margins in embedded Bases view
    const embeddedMeasurements = await page.evaluate(() => {
      // Find embedded Bases view (embedded in markdown)
      const embedContainer = document.querySelector('.markdown-embed .tn-bases-tasknotes-list, .internal-embed .tn-bases-tasknotes-list, .bases-view .tn-bases-tasknotes-list');
      const markdownPreviewView = document.querySelector('.markdown-embed .markdown-preview-view, .internal-embed .markdown-preview-view');

      if (!embedContainer && !markdownPreviewView) {
        // Try to find any embedded bases container
        const anyEmbed = document.querySelector('.markdown-embed, .internal-embed');
        return {
          found: false,
          hasEmbed: !!anyEmbed,
          embedClasses: anyEmbed?.className || 'none',
        };
      }

      const viewElement = embedContainer || markdownPreviewView;
      if (!viewElement) {
        return { found: false };
      }

      const rect = viewElement.getBoundingClientRect();
      const styles = window.getComputedStyle(viewElement);
      const embed = viewElement.closest('.markdown-embed, .internal-embed');
      const embedRect = embed?.getBoundingClientRect();

      // Get file-margins CSS variable
      const root = document.documentElement;
      const computedRoot = window.getComputedStyle(root);
      const fileMargins = computedRoot.getPropertyValue('--file-margins').trim();
      const fileMarginsX = computedRoot.getPropertyValue('--file-margins-x').trim();

      return {
        found: true,
        viewWidth: rect.width,
        embedWidth: embedRect?.width || 0,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        marginLeft: styles.marginLeft,
        marginRight: styles.marginRight,
        leftOffset: embedRect ? rect.left - embedRect.left : 0,
        rightOffset: embedRect ? embedRect.right - rect.right : 0,
        totalHorizontalPadding: (embedRect?.width || 0) - rect.width,
        fileMargins,
        fileMarginsX,
      };
    });

    console.log('Embedded view measurements:', JSON.stringify(embeddedMeasurements, null, 2));

    // Take screenshot of embedded view
    await page.screenshot({ path: 'test-results/screenshots/issue-765-embedded-view.png' });

    // Compare the measurements
    if (sidebarMeasurements && embeddedMeasurements && (embeddedMeasurements as { found: boolean }).found) {
      const sidebarPadding = sidebarMeasurements.totalHorizontalPadding;
      const embeddedPadding = (embeddedMeasurements as { totalHorizontalPadding: number }).totalHorizontalPadding;

      console.log(`Sidebar total horizontal padding: ${sidebarPadding}px`);
      console.log(`Embedded total horizontal padding: ${embeddedPadding}px`);
      console.log(`Difference: ${embeddedPadding - sidebarPadding}px`);

      // The issue is that the embedded view has significantly more padding
      // After the fix, they should be roughly equal (within reasonable tolerance)
      const maxAllowedDifference = 20; // Allow some difference for borders etc.
      const actualDifference = Math.abs(embeddedPadding - sidebarPadding);

      // This assertion will fail in the current state, documenting the bug
      expect(actualDifference).toBeLessThanOrEqual(maxAllowedDifference);
    }
  });

  test.fixme('reproduces issue #765 - measure file-margins impact on embedded Bases', async () => {
    /**
     * This test specifically measures the impact of Obsidian's --file-margins
     * CSS variable on embedded Bases views.
     *
     * The issue is that embedded views inherit the markdown preview padding
     * which uses --file-margins (typically 32px), while sidebar views don't.
     */
    const page = app.page;

    // Navigate to a note with embedded Bases view
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-TaskList-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Analyze the CSS hierarchy of embedded views
    const cssAnalysis = await page.evaluate(() => {
      const layers: { selector: string; paddingLeft: string; paddingRight: string; marginLeft: string; marginRight: string }[] = [];

      // Check each layer of the embed hierarchy
      const selectors = [
        '.markdown-embed',
        '.markdown-embed .inline-embed',
        '.markdown-embed .markdown-preview-view',
        '.markdown-embed .markdown-preview-sizer',
        '.markdown-embed .tn-bases-tasknotes-list',
        '.internal-embed',
        '.bases-view',
        '.tn-bases-items-container',
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          const styles = window.getComputedStyle(el);
          layers.push({
            selector,
            paddingLeft: styles.paddingLeft,
            paddingRight: styles.paddingRight,
            marginLeft: styles.marginLeft,
            marginRight: styles.marginRight,
          });
        }
      }

      // Get relevant CSS variables
      const root = document.documentElement;
      const computedRoot = window.getComputedStyle(root);

      return {
        layers,
        cssVariables: {
          fileMargins: computedRoot.getPropertyValue('--file-margins').trim(),
          fileMarginsX: computedRoot.getPropertyValue('--file-margins-x').trim(),
          fileMarginsY: computedRoot.getPropertyValue('--file-margins-y').trim(),
          embedPadding: computedRoot.getPropertyValue('--embed-padding').trim(),
        },
      };
    });

    console.log('CSS hierarchy analysis:', JSON.stringify(cssAnalysis, null, 2));

    // The fix should add CSS that overrides or compensates for the --file-margins
    // when TaskNotes Bases views are embedded
    if (cssAnalysis.layers.length > 0) {
      // Find the layer that adds the most horizontal padding
      let maxPadding = 0;
      let culpritLayer = '';

      for (const layer of cssAnalysis.layers) {
        const leftPad = parseInt(layer.paddingLeft) || 0;
        const rightPad = parseInt(layer.paddingRight) || 0;
        const totalPad = leftPad + rightPad;

        if (totalPad > maxPadding) {
          maxPadding = totalPad;
          culpritLayer = layer.selector;
        }
      }

      console.log(`Layer with most padding: ${culpritLayer} (${maxPadding}px total)`);

      // After fix, the total padding from embed wrappers should be minimal
      const maxAcceptablePadding = 24; // Allow some padding, but not the full 64px (32px each side)
      expect(maxPadding).toBeLessThanOrEqual(maxAcceptablePadding);
    }
  });

  test.fixme('reproduces issue #765 - visual comparison sidebar vs embedded in side panel', async () => {
    /**
     * This test captures visual evidence of the margin difference between
     * sidebar view and embedded view when both are displayed in side panels.
     *
     * The user specifically mentions:
     * - Using the plugin in the sidebar (minimal margins)
     * - Creating a view using Bases plugin (embedded in note) with larger margins
     * - "The display immediately shrinks and becomes cumbersome and less clear"
     */
    const page = app.page;

    // Open TaskNotes sidebar view
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1000);

    // Take screenshot of just the sidebar
    const sidebarLeaf = page.locator('.workspace-leaf:has([data-type*="tasknotes"]), .workspace-leaf:has(.tn-task-list-view)').first();
    if (await sidebarLeaf.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sidebarLeaf.screenshot({
        path: 'test-results/screenshots/issue-765-sidebar-panel.png',
      });
    }

    // Calculate usable content width ratio in sidebar
    const sidebarContentRatio = await page.evaluate(() => {
      const leaf = document.querySelector('.workspace-leaf:has([data-type*="tasknotes"]), .workspace-leaf:has(.tn-task-list-view)');
      const content = document.querySelector('.tn-task-list-view, .tn-bases-tasknotes-list');

      if (!leaf || !content) return null;

      const leafRect = (leaf as HTMLElement).getBoundingClientRect();
      const contentRect = (content as HTMLElement).getBoundingClientRect();

      return {
        leafWidth: leafRect.width,
        contentWidth: contentRect.width,
        ratio: contentRect.width / leafRect.width,
        wastedSpace: leafRect.width - contentRect.width,
      };
    });

    console.log('Sidebar content ratio:', sidebarContentRatio);

    // Now open a note with embedded view
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-TaskList-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Take screenshot of the embedded view area
    const embedContainer = page.locator('.markdown-embed, .internal-embed').first();
    if (await embedContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await embedContainer.screenshot({
        path: 'test-results/screenshots/issue-765-embedded-panel.png',
      });
    }

    // Calculate usable content width ratio in embedded view
    const embeddedContentRatio = await page.evaluate(() => {
      const embed = document.querySelector('.markdown-embed, .internal-embed');
      const content = embed?.querySelector('.tn-bases-tasknotes-list, .tn-bases-items-container');

      if (!embed || !content) return null;

      const embedRect = embed.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();

      return {
        embedWidth: embedRect.width,
        contentWidth: contentRect.width,
        ratio: contentRect.width / embedRect.width,
        wastedSpace: embedRect.width - contentRect.width,
      };
    });

    console.log('Embedded content ratio:', embeddedContentRatio);

    // Compare ratios - they should be similar
    if (sidebarContentRatio && embeddedContentRatio) {
      console.log(`Sidebar utilization: ${(sidebarContentRatio.ratio * 100).toFixed(1)}%`);
      console.log(`Embedded utilization: ${(embeddedContentRatio.ratio * 100).toFixed(1)}%`);
      console.log(`Sidebar wasted space: ${sidebarContentRatio.wastedSpace}px`);
      console.log(`Embedded wasted space: ${embeddedContentRatio.wastedSpace}px`);

      // The embedded view should utilize space as efficiently as the sidebar
      // After fix, the ratios should be within 10% of each other
      const ratioDifference = Math.abs(sidebarContentRatio.ratio - embeddedContentRatio.ratio);
      expect(ratioDifference).toBeLessThan(0.10);
    }
  });

  test.fixme('reproduces issue #765 - suggested fix: override file-margins for embedded Bases', async () => {
    /**
     * This test documents and verifies the suggested fix approach:
     * Add CSS that overrides --file-margins for embedded TaskNotes Bases views.
     *
     * Potential fix in styles/bases-views.css:
     * ```css
     * .markdown-embed .tn-bases-tasknotes-list,
     * .markdown-embed .tn-bases-items-container,
     * .internal-embed .tn-bases-tasknotes-list,
     * .internal-embed .tn-bases-items-container {
     *   margin-left: calc(-1 * var(--file-margins-x, 32px));
     *   margin-right: calc(-1 * var(--file-margins-x, 32px));
     *   width: calc(100% + 2 * var(--file-margins-x, 32px));
     * }
     * ```
     *
     * Alternative: Override the parent container's padding:
     * ```css
     * .markdown-embed:has(.tn-bases-tasknotes-list) .markdown-preview-view,
     * .internal-embed:has(.tn-bases-tasknotes-list) .markdown-preview-view {
     *   padding-left: var(--tn-spacing-sm);
     *   padding-right: var(--tn-spacing-sm);
     * }
     * ```
     */
    const page = app.page;

    // This test verifies that the fix correctly reduces margins
    // Navigate to embedded view
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-TaskList-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Check if the fix's CSS is applied
    const fixVerification = await page.evaluate(() => {
      const embeddedList = document.querySelector('.markdown-embed .tn-bases-tasknotes-list, .internal-embed .tn-bases-tasknotes-list');
      if (!embeddedList) return { found: false };

      const styles = window.getComputedStyle(embeddedList);
      const rect = embeddedList.getBoundingClientRect();

      // Check if negative margins are applied to compensate for file-margins
      const marginLeft = parseInt(styles.marginLeft) || 0;
      const marginRight = parseInt(styles.marginRight) || 0;

      // Check the parent markdown-preview-view padding
      const previewView = embeddedList.closest('.markdown-preview-view');
      const previewStyles = previewView ? window.getComputedStyle(previewView) : null;

      return {
        found: true,
        listMarginLeft: marginLeft,
        listMarginRight: marginRight,
        previewPaddingLeft: previewStyles?.paddingLeft || 'N/A',
        previewPaddingRight: previewStyles?.paddingRight || 'N/A',
        effectiveWidth: rect.width,
      };
    });

    console.log('Fix verification:', JSON.stringify(fixVerification, null, 2));

    if ((fixVerification as { found: boolean }).found) {
      // After fix: either the list has negative margins, or preview has reduced padding
      const marginLeft = (fixVerification as { listMarginLeft: number }).listMarginLeft;
      const previewPaddingLeft = parseInt((fixVerification as { previewPaddingLeft: string }).previewPaddingLeft) || 0;

      // Check if fix is applied: negative margins OR reduced preview padding
      const hasNegativeMargins = marginLeft < 0;
      const hasReducedPadding = previewPaddingLeft < 32; // Default file-margins-x is 32px

      console.log(`Has negative margins: ${hasNegativeMargins} (${marginLeft}px)`);
      console.log(`Has reduced padding: ${hasReducedPadding} (${previewPaddingLeft}px)`);

      // After fix, one of these conditions should be true
      expect(hasNegativeMargins || hasReducedPadding).toBe(true);
    }
  });
});
