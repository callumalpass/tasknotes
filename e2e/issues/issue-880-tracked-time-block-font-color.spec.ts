/**
 * Issue #880: [Bug]: Tracked Time Blocks in Advanced Calendar have an unreadable font color
 *
 * The text color for tracked time blocks (time entries) in the Advanced Calendar view
 * is set to `var(--color-base-40)`, which is not readable against the background,
 * especially in dark mode.
 *
 * The issue was reported with themes like `Minimal`, `Fancy-A-Story`, and `Baseline`
 * in dark mode.
 *
 * Root cause analysis:
 * - Time entry events are created without explicit textColor in createTimeEntryEvents()
 * - The CSS in advanced-calendar-view.css defines colors for time entries:
 *   - Light mode: color: #059669 (lines 99-102)
 *   - Dark mode: color: #6ee7b7 (lines 122-125)
 * - However, themes may override these with less readable colors like --color-base-40
 * - The CSS specificity might not be sufficient to override theme styles
 *
 * @see https://github.com/callumalpass/tasknotes/issues/880
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #880: Tracked Time Blocks Font Color Readability', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #880 - time entry text should be readable in light mode',
    async () => {
      /**
       * Time entry events (tracked time blocks) should have readable text color
       * in light mode. The expected color is #059669 (darker green) which provides
       * good contrast against the light striped background.
       *
       * Current issue: The text may be using var(--color-base-40) which doesn't
       * provide sufficient contrast.
       */
      const page = app.page;

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view to see time entries clearly
      const weekButton = page.locator('.fc-timeGridWeek-button');
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Look for time entry events (tracked time blocks)
      const timeEntryEvents = page.locator('.fc-event[data-event-type="timeEntry"]');
      const timeEntryCount = await timeEntryEvents.count();

      if (timeEntryCount === 0) {
        console.log('No time entry events found. Create a task with tracked time to test.');
        return;
      }

      console.log(`Found ${timeEntryCount} time entry event(s)`);

      // Check the text color of the first time entry
      const firstTimeEntry = timeEntryEvents.first();
      const titleElement = firstTimeEntry.locator('.fc-event-title, .fc-event-time');

      if (await titleElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const computedColor = await titleElement.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        console.log(`Time entry text color: ${computedColor}`);

        // Expected color in light mode: #059669 (rgb(5, 150, 105))
        // The color should be a readable green, not a muted gray like color-base-40
        // color-base-40 in Obsidian is typically around rgb(138, 143, 152) in light mode

        // Check that the color provides sufficient contrast (is not a muted gray)
        // A simple heuristic: green component should be significantly higher than others
        const colorMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (colorMatch) {
          const [, r, g, b] = colorMatch.map(Number);
          const isGreenish = g > r && g > b;
          const isNotMutedGray = Math.abs(r - g) > 20 || Math.abs(g - b) > 20;

          console.log(`RGB: (${r}, ${g}, ${b}), isGreenish: ${isGreenish}, isNotMutedGray: ${isNotMutedGray}`);

          // After fix, the text should be a visible green color
          expect(isGreenish || isNotMutedGray).toBe(true);
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #880 - time entry text should be readable in dark mode',
    async () => {
      /**
       * Time entry events should have readable text color in dark mode.
       * The expected color is #6ee7b7 (lighter green) which provides
       * good contrast against the dark striped background.
       *
       * This is particularly important as the issue was reported in dark mode
       * with themes like Minimal, Fancy-A-Story, and Baseline.
       */
      const page = app.page;

      // Ensure dark mode is active (if possible to toggle)
      // Note: Obsidian's theme is typically controlled by system or settings
      // For now, we'll check the current state

      const isDarkMode = await page.evaluate(() => {
        return document.body.classList.contains('theme-dark');
      });

      console.log(`Current mode: ${isDarkMode ? 'dark' : 'light'}`);

      // Open the calendar view
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view
      const weekButton = page.locator('.fc-timeGridWeek-button');
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Look for time entry events
      const timeEntryEvents = page.locator('.fc-event[data-event-type="timeEntry"]');
      const timeEntryCount = await timeEntryEvents.count();

      if (timeEntryCount === 0) {
        console.log('No time entry events found.');
        return;
      }

      // Check the text color
      const firstTimeEntry = timeEntryEvents.first();
      const titleElement = firstTimeEntry.locator('.fc-event-title, .fc-event-time');

      if (await titleElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const computedColor = await titleElement.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        console.log(`Time entry text color in ${isDarkMode ? 'dark' : 'light'} mode: ${computedColor}`);

        // In dark mode, expected color: #6ee7b7 (rgb(110, 231, 183))
        // Should be a bright, visible green

        const colorMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (colorMatch && isDarkMode) {
          const [, r, g, b] = colorMatch.map(Number);

          // In dark mode, color should be light enough to be visible
          // color-base-40 in dark mode is typically around rgb(90, 94, 99) - too dark
          // Expected #6ee7b7 is rgb(110, 231, 183) - much brighter

          const brightness = (r + g + b) / 3;
          const isLightEnough = brightness > 100; // Should be reasonably bright

          console.log(`RGB: (${r}, ${g}, ${b}), brightness: ${brightness}, isLightEnough: ${isLightEnough}`);

          // After fix, the text should be bright enough to read
          expect(isLightEnough).toBe(true);
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #880 - time entry CSS should have sufficient specificity',
    async () => {
      /**
       * The CSS rules for time entry text color should have enough specificity
       * to override theme styles. Currently, the styles use:
       *
       * .fc-event[data-event-type="timeEntry"] .fc-event-time,
       * .fc-event[data-event-type="timeEntry"] .fc-event-title {
       *     color: #059669 !important;
       * }
       *
       * The !important should help, but themes may still override if they use
       * more specific selectors or their own !important rules.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Switch to week view
      const weekButton = page.locator('.fc-timeGridWeek-button');
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Look for time entry events
      const timeEntryEvents = page.locator('.fc-event[data-event-type="timeEntry"]');
      const timeEntryCount = await timeEntryEvents.count();

      if (timeEntryCount === 0) {
        console.log('No time entry events found.');
        return;
      }

      // Check if the CSS is being applied correctly
      const firstTimeEntry = timeEntryEvents.first();

      // Check the computed style to see if our CSS or theme CSS is winning
      const styleInfo = await firstTimeEntry.evaluate((el) => {
        const titleEl = el.querySelector('.fc-event-title') || el.querySelector('.fc-event-time');
        if (!titleEl) return null;

        const style = window.getComputedStyle(titleEl as Element);
        return {
          color: style.color,
          // Get all applied CSS rules if possible
          element: (titleEl as Element).outerHTML,
        };
      });

      console.log('Time entry style info:', styleInfo);

      // The color should NOT be the default theme color (--color-base-40)
      // It should be our explicit green color
      if (styleInfo && styleInfo.color) {
        // Check if the color is close to the expected green values
        const colorMatch = styleInfo.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (colorMatch) {
          const [, r, g, b] = colorMatch.map(Number);

          // Expected light mode: rgb(5, 150, 105) - #059669
          // Expected dark mode: rgb(110, 231, 183) - #6ee7b7
          // Bad value (color-base-40): approximately rgb(138, 143, 152) or rgb(90, 94, 99)

          const isExpectedLightGreen = Math.abs(r - 5) < 20 && Math.abs(g - 150) < 30 && Math.abs(b - 105) < 30;
          const isExpectedDarkGreen = Math.abs(r - 110) < 30 && Math.abs(g - 231) < 30 && Math.abs(b - 183) < 30;
          const isGreenColor = g > r && g > b; // Green channel dominant

          console.log(`Color check: isExpectedLightGreen=${isExpectedLightGreen}, isExpectedDarkGreen=${isExpectedDarkGreen}, isGreenColor=${isGreenColor}`);

          // After fix, the color should be one of the expected green values
          expect(isExpectedLightGreen || isExpectedDarkGreen || isGreenColor).toBe(true);
        }
      }
    }
  );

  test.fixme(
    'reproduces issue #880 - time entry should maintain readability across popular themes',
    async () => {
      /**
       * The issue was specifically reported with:
       * - Minimal theme
       * - Fancy-A-Story theme
       * - Baseline theme
       *
       * All in dark mode. The time entry text should remain readable
       * regardless of which theme is active.
       *
       * This test documents the expected behavior: our CSS should use
       * sufficiently specific selectors to override theme defaults.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Get current theme info
      const themeInfo = await page.evaluate(() => {
        const body = document.body;
        return {
          isDark: body.classList.contains('theme-dark'),
          classes: Array.from(body.classList),
          // Check for common theme indicators
          hasMinimal: body.classList.contains('theme-minimal') ||
                      document.querySelector('style[data-theme*="minimal"]') !== null,
        };
      });

      console.log('Theme info:', themeInfo);

      // Switch to week view
      const weekButton = page.locator('.fc-timeGridWeek-button');
      if (await weekButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weekButton.click();
        await page.waitForTimeout(500);
      }

      // Look for time entry events
      const timeEntryEvents = page.locator('.fc-event[data-event-type="timeEntry"]');
      const timeEntryCount = await timeEntryEvents.count();

      if (timeEntryCount === 0) {
        console.log('No time entry events found. Skipping theme compatibility check.');
        return;
      }

      // Check contrast ratio
      const contrastInfo = await timeEntryEvents.first().evaluate((el) => {
        const titleEl = el.querySelector('.fc-event-title') || el.querySelector('.fc-event-time');
        if (!titleEl) return null;

        const textColor = window.getComputedStyle(titleEl as Element).color;
        const bgColor = window.getComputedStyle(el).backgroundColor;

        // Parse RGB values
        const parseColor = (color: string) => {
          const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (match) {
            return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
          }
          return null;
        };

        const text = parseColor(textColor);
        const bg = parseColor(bgColor);

        if (!text || !bg) return { textColor, bgColor, contrast: 'unknown' };

        // Calculate relative luminance
        const luminance = (rgb: { r: number; g: number; b: number }) => {
          const sRGB = [rgb.r, rgb.g, rgb.b].map((c) => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
        };

        const textLum = luminance(text);
        const bgLum = luminance(bg);
        const lighter = Math.max(textLum, bgLum);
        const darker = Math.min(textLum, bgLum);
        const contrastRatio = (lighter + 0.05) / (darker + 0.05);

        return {
          textColor,
          bgColor,
          contrast: contrastRatio.toFixed(2),
          meetsWCAG_AA: contrastRatio >= 4.5,
          meetsWCAG_AAA: contrastRatio >= 7,
        };
      });

      console.log('Contrast info:', contrastInfo);

      // WCAG AA requires 4.5:1 contrast for normal text
      // After fix, time entry text should meet at least WCAG AA
      if (contrastInfo && typeof contrastInfo.meetsWCAG_AA === 'boolean') {
        expect(contrastInfo.meetsWCAG_AA).toBe(true);
      }
    }
  );
});
