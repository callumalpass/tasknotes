/**
 * Issue #1228: Minimal theme settings for header colors aren't shown inside
 * the "details" panel of the editor
 *
 * Feature request: The details panel of the editor should show the TaskNote
 * body the same way it looks when opening the TaskNote directly. Currently,
 * markdown renders properly but custom header colors from themes (like Minimal)
 * are lost in the details panel.
 *
 * The issue has two parts:
 * 1. Custom header colors from themes don't apply to the details panel
 * 2. Header fold toggles show as dots instead of arrows (unlike regular editor)
 *
 * Root cause: The details panel uses EmbeddableMarkdownEditor (CodeMirror-based)
 * which is a live editing interface, not Obsidian's markdown-rendered view.
 * Theme CSS variables for header colors target rendered markdown (.markdown-rendered)
 * rather than CodeMirror's editor tokens (.cm-header-*).
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1228
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1228: Details panel header colors and styling', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1228 - header colors should match theme settings in details panel', async () => {
    /**
     * This test verifies that header colors in the details panel match
     * the theme's custom header colors.
     *
     * Expected behavior after fix:
     * - Headers (H1, H2, H3, etc.) in the details panel should use the same
     *   colors as when viewing the note directly
     * - Theme CSS variables (like --h1-color, --h2-color from Minimal theme)
     *   should apply to CodeMirror header tokens
     *
     * Current behavior (bug):
     * - Headers in the details panel use default CodeMirror colors
     * - Theme header color customizations are ignored
     */
    const page = app.page;

    // Open an existing task or create a new task with headers in details
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the details editor container
    const detailsEditor = modal.locator('.details-markdown-editor');
    await expect(detailsEditor).toBeVisible({ timeout: 3000 });

    // Type some markdown with headers in the details field
    const cmContent = detailsEditor.locator('.cm-content');
    await cmContent.click();
    await page.keyboard.type('# Header 1\n## Header 2\n### Header 3\n\nSome body text.', { delay: 30 });
    await page.waitForTimeout(500);

    // Get the header elements in the CodeMirror editor
    const h1Element = detailsEditor.locator('.cm-header-1').first();
    const h2Element = detailsEditor.locator('.cm-header-2').first();
    const bodyText = detailsEditor.locator('.cm-line:not(:has(.cm-header-1)):not(:has(.cm-header-2)):not(:has(.cm-header-3))').last();

    // Get colors of headers and body text
    const [h1Color, h2Color, bodyColor] = await Promise.all([
      h1Element.isVisible({ timeout: 1000 }).catch(() => false)
        ? h1Element.evaluate(el => window.getComputedStyle(el).color)
        : Promise.resolve(null),
      h2Element.isVisible({ timeout: 1000 }).catch(() => false)
        ? h2Element.evaluate(el => window.getComputedStyle(el).color)
        : Promise.resolve(null),
      bodyText.isVisible({ timeout: 1000 }).catch(() => false)
        ? bodyText.evaluate(el => window.getComputedStyle(el).color)
        : Promise.resolve(null),
    ]);

    console.log('Details panel header colors:', { h1Color, h2Color, bodyColor });

    // Now compare with a regular markdown view (if we can open the note directly)
    // For this test, we check that headers have DIFFERENT colors
    // (Minimal theme and other themes typically color headers differently)

    // At minimum, H1 should be styled differently from H2 and body text
    // if theme header colors are being applied
    if (h1Color && h2Color && bodyColor) {
      // In a properly themed view, headers typically have distinct colors
      // If all text is the same color, theme colors aren't being applied
      const allSameColor = h1Color === h2Color && h2Color === bodyColor;

      // This assertion documents the expected behavior:
      // Headers should NOT all be the same color as body text if theme is active
      // Currently this may fail because CodeMirror doesn't pick up theme variables
      expect(allSameColor).toBe(false);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1228 - header fold toggle should show arrow instead of dot', async () => {
    /**
     * This test verifies that header fold toggles in the details panel
     * show arrows (like in the regular editor) instead of dots.
     *
     * Expected behavior after fix:
     * - Fold toggles for headers should display as arrows/chevrons
     * - Visual consistency with the regular editor view
     *
     * Current behavior (bug):
     * - Fold toggles show as dots instead of the usual arrow indicators
     */
    const page = app.page;

    // Open a task with headers in the details
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const detailsEditor = modal.locator('.details-markdown-editor');
    await expect(detailsEditor).toBeVisible({ timeout: 3000 });

    // Type markdown with a header that can be folded
    const cmContent = detailsEditor.locator('.cm-content');
    await cmContent.click();
    await page.keyboard.type('# Foldable Header\n\nContent under the header\n\nMore content', { delay: 30 });
    await page.waitForTimeout(500);

    // Look for fold indicators - could be various classes depending on implementation
    const foldIndicators = [
      '.cm-foldGutter-indicatorOpen',
      '.cm-foldGutter',
      '.cm-fold-indicator',
      '.collapse-indicator',
      '.cm-gutterElement', // Generic gutter element that might contain fold icon
    ];

    let foldIndicatorFound = false;
    let indicatorContent = '';

    for (const selector of foldIndicators) {
      const indicator = detailsEditor.locator(selector).first();
      if (await indicator.isVisible({ timeout: 500 }).catch(() => false)) {
        foldIndicatorFound = true;
        indicatorContent = await indicator.evaluate(el => {
          // Check for arrow-like characters or SVG
          const text = el.textContent || '';
          const hasArrowChar = /[▼▶►◄◀▾▸]/u.test(text);
          const hasSvg = el.querySelector('svg') !== null;
          const styles = window.getComputedStyle(el, '::before');
          const beforeContent = styles.content;

          return JSON.stringify({
            text,
            hasArrowChar,
            hasSvg,
            beforeContent,
            className: el.className,
          });
        });
        console.log(`Fold indicator (${selector}):`, indicatorContent);
        break;
      }
    }

    if (foldIndicatorFound) {
      const info = JSON.parse(indicatorContent);

      // The issue is that dots are shown instead of arrows
      // Check if there's an arrow or chevron indicator
      const hasArrowIndicator = info.hasArrowChar || info.hasSvg ||
        info.beforeContent?.includes('▼') ||
        info.beforeContent?.includes('►');

      // This assertion documents the expected behavior:
      // Fold indicators should be arrows, not dots
      expect(hasArrowIndicator).toBe(true);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1228 - compare details panel vs direct note view styling', async () => {
    /**
     * This test compares the styling between:
     * 1. The details panel in the task modal (EmbeddableMarkdownEditor)
     * 2. Opening the TaskNote file directly (Obsidian's reading/editing view)
     *
     * The user's request is that both should render markdown the same way,
     * particularly regarding header colors from custom themes.
     */
    const page = app.page;

    // First, create a task and note its styling in the details panel
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const detailsEditor = modal.locator('.details-markdown-editor');

    // Add a title for the task first (required field)
    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input');
    if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await titleInput.fill('Test Task for Issue 1228');
    }

    // Add markdown content in details
    if (await detailsEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const cmContent = detailsEditor.locator('.cm-content');
      await cmContent.click();
      await page.keyboard.type('## Test Header\n\nBody text for comparison.', { delay: 30 });
      await page.waitForTimeout(300);

      // Capture styling in details panel
      const detailsStyles = await detailsEditor.evaluate((container) => {
        const header = container.querySelector('.cm-header-2');
        const body = container.querySelector('.cm-line:not(:has(.cm-header-2))');

        return {
          headerColor: header ? window.getComputedStyle(header).color : null,
          headerFontWeight: header ? window.getComputedStyle(header).fontWeight : null,
          headerFontSize: header ? window.getComputedStyle(header).fontSize : null,
          bodyColor: body ? window.getComputedStyle(body).color : null,
          bodyFontSize: body ? window.getComputedStyle(body).fontSize : null,
        };
      });

      console.log('Details panel styles:', JSON.stringify(detailsStyles, null, 2));

      // For a complete test, we would need to:
      // 1. Save/create the task
      // 2. Open the note file directly
      // 3. Compare the styles
      //
      // For now, this test documents the expected behavior and
      // captures the current styling for debugging purposes.

      // The key assertion: headers in details should have theme-appropriate styling
      // If the theme sets custom header colors, they should be reflected here
      if (detailsStyles.headerColor && detailsStyles.bodyColor) {
        // Headers typically should look different from body in themed views
        // This test may fail if theme colors aren't being applied to CodeMirror
        console.log('Header vs body color match:', detailsStyles.headerColor === detailsStyles.bodyColor);
      }
    }

    // Close modal without saving
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Handle potential "discard changes" dialog
    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1228 - CSS variables from theme should apply to details editor', async () => {
    /**
     * This test checks if CSS variables from themes (particularly Minimal theme)
     * are accessible and could be applied to the details editor.
     *
     * Themes like Minimal define custom properties for header colors:
     * --h1-color, --h2-color, --h3-color, etc.
     *
     * The fix would need to ensure CodeMirror header tokens use these variables.
     */
    const page = app.page;

    // Open a task modal to access the details editor
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check what CSS variables are available in the document
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement;
      const computed = window.getComputedStyle(root);

      // Common theme header color variables
      const headerVars = [
        '--h1-color',
        '--h2-color',
        '--h3-color',
        '--h4-color',
        '--h5-color',
        '--h6-color',
        '--heading-color',
        '--inline-title-color',
      ];

      const foundVars: Record<string, string> = {};
      for (const varName of headerVars) {
        const value = computed.getPropertyValue(varName).trim();
        if (value) {
          foundVars[varName] = value;
        }
      }

      return foundVars;
    });

    console.log('Available theme CSS variables for headers:', JSON.stringify(cssVariables, null, 2));

    // If theme variables exist, verify they SHOULD be applied to details editor
    const hasThemeHeaderColors = Object.keys(cssVariables).length > 0;

    if (hasThemeHeaderColors) {
      // Theme has header color variables defined
      // The fix would need to apply these to .cm-header-* classes
      console.log('Theme provides header color customization');

      // Check if details editor currently uses these variables
      const detailsEditor = modal.locator('.details-markdown-editor');
      if (await detailsEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
        const editorUsesThemeVars = await detailsEditor.evaluate((editor) => {
          const header = editor.querySelector('.cm-header-1, .cm-header-2, .cm-header-3');
          if (header) {
            const computedColor = window.getComputedStyle(header).color;
            // Check if the color matches any theme variable values
            return { computedColor, usesThemeVar: false }; // Would need comparison logic
          }
          return null;
        });

        console.log('Details editor header styling:', editorUsesThemeVars);
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
