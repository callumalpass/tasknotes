/**
 * Issue #1630: Task cards do not respect readable line length in Minimal theme
 *
 * Bug description:
 * When the Minimal theme is active and Obsidian's "Readable line length" is enabled,
 * the TaskNotes task card widget at the top of a task note is aligned to the full
 * editor width instead of the centered readable content column.
 *
 * Root cause hypothesis:
 * The widget is injected as a direct child of `.cm-sizer` / `.markdown-preview-sizer`
 * and styled as a full-width block with only vertical margins. In Minimal, readable
 * line length centering is applied to inner content containers, so the injected widget
 * bypasses that centering and remains left-aligned.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1630
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1630: Minimal theme readable line length alignment', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1630', async () => {
    const page = app.page;

    // Configure environment for reproduction: Minimal theme + readable line length.
    const setupResult = await page.evaluate(async () => {
      const obsidianApp = (window as any).app;
      if (!obsidianApp) {
        return { hasApp: false, themeApplied: false, readableLineLengthApplied: false };
      }

      let themeApplied = false;
      let readableLineLengthApplied = false;

      try {
        if (obsidianApp.customCss?.setTheme) {
          await obsidianApp.customCss.setTheme('Minimal');
          themeApplied = true;
        }
      } catch {
        // Best effort setup for repro environment.
      }

      try {
        if (obsidianApp.vault?.setConfig) {
          await obsidianApp.vault.setConfig('readableLineLength', true);
          readableLineLengthApplied = true;
        } else if (obsidianApp.vault?.config) {
          obsidianApp.vault.config.readableLineLength = true;
          if (obsidianApp.vault?.saveConfig) {
            await obsidianApp.vault.saveConfig();
          }
          readableLineLengthApplied = true;
        }
      } catch {
        // Best effort setup for repro environment.
      }

      obsidianApp.workspace?.trigger?.('css-change');

      return {
        hasApp: true,
        themeApplied,
        readableLineLengthApplied,
      };
    });

    console.log('Issue #1630 setup:', JSON.stringify(setupResult, null, 2));
    await page.waitForTimeout(1000);

    // Open a known task note to ensure the inline task card widget is rendered.
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(400);
    await page.locator('.prompt-input').fill('Buy groceries');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    const taskCardWidget = page.locator('.task-card-note-widget, .tasknotes-task-card-note-widget').first();
    await expect(taskCardWidget).toBeVisible({ timeout: 5000 });

    const alignmentMetrics = await page.evaluate(() => {
      const widget = document.querySelector('.task-card-note-widget, .tasknotes-task-card-note-widget') as HTMLElement | null;
      const livePreviewContent = document.querySelector('.workspace-leaf.mod-active .cm-content') as HTMLElement | null;
      const readingModeSection = document.querySelector('.workspace-leaf.mod-active .markdown-preview-section') as HTMLElement | null;
      const readableLineContainer = document.querySelector('.workspace-leaf.mod-active .is-readable-line-width') as HTMLElement | null;
      const baseline = livePreviewContent || readingModeSection || readableLineContainer;

      if (!widget || !baseline) {
        return null;
      }

      const widgetRect = widget.getBoundingClientRect();
      const baselineRect = baseline.getBoundingClientRect();
      const widgetStyles = window.getComputedStyle(widget);
      const rootStyles = window.getComputedStyle(document.documentElement);

      return {
        widgetLeft: widgetRect.left,
        baselineLeft: baselineRect.left,
        leftDifference: Math.abs(widgetRect.left - baselineRect.left),
        widgetWidth: widgetRect.width,
        baselineWidth: baselineRect.width,
        widgetMarginLeft: widgetStyles.marginLeft,
        widgetMarginRight: widgetStyles.marginRight,
        hasReadableLineWidth: !!document.querySelector('.workspace-leaf.mod-active .is-readable-line-width'),
        fileLineWidth: rootStyles.getPropertyValue('--file-line-width').trim(),
        fileMargins: rootStyles.getPropertyValue('--file-margins').trim(),
        fileMarginsX: rootStyles.getPropertyValue('--file-margins-x').trim(),
      };
    }) as {
      widgetLeft: number;
      baselineLeft: number;
      leftDifference: number;
      widgetWidth: number;
      baselineWidth: number;
      widgetMarginLeft: string;
      widgetMarginRight: string;
      hasReadableLineWidth: boolean;
      fileLineWidth: string;
      fileMargins: string;
      fileMarginsX: string;
    } | null;

    console.log('Issue #1630 alignment metrics:', JSON.stringify(alignmentMetrics, null, 2));
    await page.screenshot({ path: 'test-results/screenshots/issue-1630-minimal-readable-line-length.png' });

    expect(alignmentMetrics).not.toBeNull();
    if (!alignmentMetrics) return;

    // Expected after fix: widget and centered content should align.
    const tolerancePx = 8;
    expect(alignmentMetrics.leftDifference).toBeLessThanOrEqual(tolerancePx);
  });
});
