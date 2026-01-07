/**
 * Issue #982: [FR]: Update font size to match font size chosen in settings on mobile
 *
 * Feature request description:
 * When using Obsidian on mobile (iPhone), the default text font is too small. Even
 * when the user changes the text font size in Obsidian settings to make it larger,
 * the font for tasks in bases view and agenda view doesn't get larger, making task
 * management on mobile difficult.
 *
 * Root cause:
 * The plugin uses its own CSS variable system (--tn-font-size-*) based on Material 3
 * design tokens with hardcoded pixel values (e.g., 10px, 11px, 12px, 14px). These
 * variables are defined in styles/variables.css and don't reference Obsidian's
 * font size settings (--font-text-size or similar).
 *
 * Affected components:
 * - Agenda view (styles/agenda-view.css)
 * - Bases views (styles/bases-views.css)
 * - Task cards (styles/task-card-bem.css)
 *
 * Suggested fix:
 * 1. Use relative units (em/rem) based on a root font size that respects Obsidian settings
 * 2. Read Obsidian's font size CSS variable and apply a scale factor
 * 3. Add a TaskNotes setting to override font sizes on mobile
 *
 * @see https://github.com/callumalpass/tasknotes/issues/982
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #982: Mobile font size settings not applied to bases/agenda views', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #982 - bases view ignores Obsidian font size settings on mobile', async () => {
    /**
     * This test verifies that font sizes in bases view respond to Obsidian's
     * font size settings, particularly important on mobile where users need
     * larger fonts for readability.
     *
     * The bug manifests when:
     * 1. User sets a larger font size in Obsidian settings
     * 2. Normal text in notes appears larger
     * 3. But text in bases view (task cards, group headers) stays the same size
     * 4. This makes task management difficult on mobile devices
     *
     * Expected behavior:
     * - Task card titles should scale with Obsidian's font size setting
     * - Group headers should scale proportionally
     * - All text in bases view should remain readable when user increases font size
     */
    const page = app.page;

    // Set viewport to iPhone dimensions to simulate mobile
    await page.setViewportSize({ width: 390, height: 844 });

    // Open a regular note first to establish baseline font size
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskListContainer = page.locator('.tasknotes-plugin');
    await expect(taskListContainer).toBeVisible({ timeout: 5000 });

    // Get the computed font sizes from bases view elements
    const baseFontSizes = await page.evaluate(() => {
      const getComputedFontSize = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        return window.getComputedStyle(el).fontSize;
      };

      // Get Obsidian's current font size setting (if available)
      const root = document.documentElement;
      const obsidianFontSize = window.getComputedStyle(root).getPropertyValue('--font-text-size').trim();

      return {
        obsidianFontSize,
        taskTitle: getComputedFontSize('.task-card__title'),
        groupHeader: getComputedFontSize('.task-group__title'),
        // For comparison, get normal editor text size
        editorText: getComputedFontSize('.cm-content'),
      };
    });

    console.log('Base font sizes:', baseFontSizes);

    // Now simulate changing Obsidian's font size (larger)
    // Note: This is a simplified approach - in reality, changing Obsidian settings
    // requires interaction with the settings modal or modifying app state
    await page.evaluate(() => {
      // Simulate a larger font size setting by modifying the CSS variable
      document.documentElement.style.setProperty('--font-text-size', '20px');
    });

    await page.waitForTimeout(500);

    // Re-check font sizes after the change
    const updatedFontSizes = await page.evaluate(() => {
      const getComputedFontSize = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        return window.getComputedStyle(el).fontSize;
      };

      return {
        taskTitle: getComputedFontSize('.task-card__title'),
        groupHeader: getComputedFontSize('.task-group__title'),
        editorText: getComputedFontSize('.cm-content'),
      };
    });

    console.log('Updated font sizes after change:', updatedFontSizes);

    // The issue: task card fonts don't change even when Obsidian font size changes
    // This expectation should FAIL until the issue is fixed
    if (baseFontSizes.taskTitle && updatedFontSizes.taskTitle) {
      const basePx = parseFloat(baseFontSizes.taskTitle);
      const updatedPx = parseFloat(updatedFontSizes.taskTitle);

      // If the font size changed, the issue is fixed
      // Currently this will likely be equal (both ~14px) showing the bug
      expect(updatedPx).toBeGreaterThan(basePx);
    }
  });

  test.fixme('reproduces issue #982 - agenda view ignores Obsidian font size settings on mobile', async () => {
    /**
     * Similar to the bases view test, this verifies that agenda view elements
     * respond to Obsidian's font size settings.
     *
     * The agenda view uses the same CSS variable system (--tn-font-size-*)
     * which is independent of Obsidian's typography settings.
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(1000);

    const agendaContainer = page.locator('.tasknotes-agenda-view, .agenda-view');

    if (!await agendaContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Agenda view not visible - cannot test font scaling');
      return;
    }

    // Get baseline font sizes from agenda view elements
    const baseFontSizes = await page.evaluate(() => {
      const getComputedFontSize = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        return window.getComputedStyle(el).fontSize;
      };

      return {
        periodTitle: getComputedFontSize('.agenda-period-title'),
        dayName: getComputedFontSize('.agenda-day__name'),
        dayDate: getComputedFontSize('.agenda-day__date'),
        itemCount: getComputedFontSize('.agenda-day__count'),
      };
    });

    console.log('Agenda view base font sizes:', baseFontSizes);

    // Simulate changing Obsidian's font size
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--font-text-size', '20px');
    });

    await page.waitForTimeout(500);

    const updatedFontSizes = await page.evaluate(() => {
      const getComputedFontSize = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        return window.getComputedStyle(el).fontSize;
      };

      return {
        periodTitle: getComputedFontSize('.agenda-period-title'),
        dayName: getComputedFontSize('.agenda-day__name'),
        dayDate: getComputedFontSize('.agenda-day__date'),
        itemCount: getComputedFontSize('.agenda-day__count'),
      };
    });

    console.log('Agenda view updated font sizes:', updatedFontSizes);

    // Check if any font size changed - should fail until issue is fixed
    if (baseFontSizes.dayName && updatedFontSizes.dayName) {
      const basePx = parseFloat(baseFontSizes.dayName);
      const updatedPx = parseFloat(updatedFontSizes.dayName);

      // This assertion should fail, demonstrating the bug
      expect(updatedPx).toBeGreaterThan(basePx);
    }
  });

  test.fixme('documents CSS variable architecture - font sizes use fixed px values', async () => {
    /**
     * This test documents the root cause: the plugin's CSS variables use
     * fixed pixel values instead of relative units or references to
     * Obsidian's font size settings.
     *
     * The fix should involve:
     * 1. Using relative units (rem/em) that scale with root font size
     * 2. Or reading Obsidian's --font-text-size and applying as a base
     * 3. Or adding a plugin setting for mobile font scaling
     */
    const page = app.page;

    // Get the current values of the plugin's font size variables
    const cssVariables = await page.evaluate(() => {
      const getVar = (name: string) => {
        return window.getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim();
      };

      const plugin = document.querySelector('.tasknotes-plugin');
      const pluginStyle = plugin ? window.getComputedStyle(plugin) : null;

      return {
        // Obsidian's font size variable
        obsidianFontTextSize: getVar('--font-text-size'),
        // Plugin's font size variables (if accessible from :root)
        csTextBodyMedium: getVar('--cs-text-body-medium'),
        csTextBodyLarge: getVar('--cs-text-body-large'),
        csTextTitleMedium: getVar('--cs-text-title-medium'),
        // Plugin-scoped variables (from .tasknotes-plugin scope)
        tnFontSizeMd: pluginStyle?.getPropertyValue('--tn-font-size-md')?.trim() || 'not found',
        tnFontSizeLg: pluginStyle?.getPropertyValue('--tn-font-size-lg')?.trim() || 'not found',
      };
    });

    console.log('CSS Variables:', cssVariables);

    // Document that plugin uses fixed pixel values
    // These are currently defined as:
    // --cs-text-body-medium: 0.75rem (12px)
    // --cs-text-body-large: 0.875rem (14px)
    // These rem values are based on browser default (16px), not Obsidian's font setting

    // The plugin should ideally reference Obsidian's font size or allow configuration
    // Currently, --tn-font-size-* variables use the --cs-* values which are fixed

    // This test documents the current state and will help verify the fix
    expect(cssVariables.csTextBodyMedium).toBe('0.75rem'); // 12px fixed
    expect(cssVariables.csTextBodyLarge).toBe('0.875rem'); // 14px fixed
  });
});
