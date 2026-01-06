/**
 * Issue #1037: Embedded Calendar Year View Strange Spacing
 *
 * Bug: When using the embedded calendar in year view, there are multiple
 * layout/display issues:
 *
 * 1. The year "2029" is displayed vertically (stacked digits) instead of
 *    horizontally in the toolbar title area
 * 2. A translation key is shown as raw text: "views.basesCalendar.buttonText.refresh"
 *    instead of the translated "Refresh" button text
 * 3. Large white/empty space to the right of the calendar grid - the calendar
 *    doesn't fill the available width properly
 *
 * Root cause hypothesis:
 * - The vertical year display suggests a CSS width constraint issue on the
 *   .fc-toolbar-title element when embedded, causing text to wrap per character
 * - The raw translation key suggests the i18n service may not be properly
 *   initialized or accessible when calendar bases are embedded in notes
 * - The empty space issue suggests the multiMonthYear view isn't respecting
 *   the container width in embedded contexts
 *
 * Related code locations:
 * - src/bases/CalendarView.ts:640-710 - Calendar toolbar configuration
 * - src/bases/CalendarView.ts:674 - Refresh button text translation
 * - styles/advanced-calendar-view.css:643-649 - .fc-toolbar-title styling
 * - styles/advanced-calendar-view.css:787-814 - Multi-month (year) view styling
 * - src/i18n/resources/en.ts:178 - refresh button translation key
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1037
 */

import { test, expect, Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1037: Embedded Calendar Year View Strange Spacing', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1037 - year displayed vertically in embedded calendar toolbar', async () => {
    /**
     * This test checks if the year in the calendar toolbar title is displayed
     * horizontally (correct) or vertically stacked (bug).
     *
     * STEPS TO REPRODUCE:
     * 1. Open a note with an embedded calendar base
     * 2. Switch to year view (multiMonthYear)
     * 3. Observe the toolbar title showing the year
     *
     * EXPECTED BEHAVIOR:
     * The year should display horizontally like "2029" in a single line
     *
     * ACTUAL BEHAVIOR (bug):
     * The year displays vertically with each digit on a separate line:
     * 2
     * 0
     * 2
     * 9
     *
     * This is likely caused by the toolbar title container having a very
     * narrow width when embedded, forcing the text to wrap per character.
     */
    const page = app.page;

    // Open a note with an embedded calendar
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-Calendar-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Find the embedded calendar and switch to year view
    const embeddedCalendar = page.locator('.internal-embed .advanced-calendar-view, .tn-base-calendar-view');
    const calendarVisible = await embeddedCalendar.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!calendarVisible) {
      console.log('Embedded calendar not found - test requires a note with embedded calendar base');
      await page.screenshot({ path: 'test-results/screenshots/issue-1037-no-embedded-calendar.png' });
      return;
    }

    // Click the year view button
    const yearButton = page.locator('.internal-embed .fc-multiMonthYear-button, .internal-embed button:has-text("Y")');
    if (await yearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await yearButton.click();
      await page.waitForTimeout(1000);
    }

    // Take screenshot showing the toolbar
    await page.screenshot({ path: 'test-results/screenshots/issue-1037-year-view-toolbar.png' });

    // Check the toolbar title dimensions
    const toolbarTitleMetrics = await page.evaluate(() => {
      const title = document.querySelector('.internal-embed .fc-toolbar-title');
      if (title) {
        const rect = title.getBoundingClientRect();
        const styles = window.getComputedStyle(title);
        const text = title.textContent || '';

        return {
          width: rect.width,
          height: rect.height,
          text: text,
          textLength: text.length,
          // A 4-digit year displayed horizontally should have width > height
          // If height > width, the text is likely wrapped vertically
          isVertical: rect.height > rect.width * 2,
          fontSize: styles.fontSize,
          lineHeight: styles.lineHeight,
        };
      }
      return null;
    });

    console.log('Toolbar title metrics:', JSON.stringify(toolbarTitleMetrics, null, 2));

    if (toolbarTitleMetrics) {
      // The year (e.g., "2029") should display horizontally
      // Width should be greater than height for horizontal text
      // If the text is vertical, height will be much greater than width
      expect(toolbarTitleMetrics.isVertical).toBe(false);

      // Additionally, the width should be reasonable for a 4-digit year
      // A 4-digit year at ~16px font should be around 40-60px wide, not 10-20px
      expect(toolbarTitleMetrics.width).toBeGreaterThan(30);
    }
  });

  test.fixme('reproduces issue #1037 - translation key shown instead of translated text', async () => {
    /**
     * This test checks if translation keys are displayed as raw text instead
     * of being translated properly.
     *
     * STEPS TO REPRODUCE:
     * 1. Open a note with an embedded calendar base
     * 2. Look at the toolbar buttons
     * 3. Observe the refresh button showing raw translation key
     *
     * EXPECTED BEHAVIOR:
     * The refresh button should show "Refresh" (or equivalent in user's locale)
     *
     * ACTUAL BEHAVIOR (bug):
     * The button shows "views.basesCalendar.buttonText.refresh"
     *
     * This suggests the i18n service may not be properly accessible when
     * the calendar base is rendered in an embedded context.
     */
    const page = app.page;

    // Open a note with an embedded calendar
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-Calendar-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Look for any raw translation keys in the embedded calendar toolbar
    const rawTranslationKeys = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed .advanced-calendar-view, .tn-base-calendar-view');
      if (!embed) return [];

      // Find all text content in buttons and toolbar
      const buttons = embed.querySelectorAll('button, .fc-toolbar *');
      const rawKeys: string[] = [];

      buttons.forEach((el) => {
        const text = el.textContent?.trim() || '';
        // Translation keys follow patterns like "views.xxx.yyy" or "settings.xxx.yyy"
        if (text.match(/^(views|settings|common)\.\w+(\.\w+)+$/)) {
          rawKeys.push(text);
        }
      });

      return rawKeys;
    });

    console.log('Raw translation keys found:', rawTranslationKeys);

    // Take screenshot showing the buttons
    await page.screenshot({ path: 'test-results/screenshots/issue-1037-translation-keys.png' });

    // There should be no raw translation keys visible
    expect(rawTranslationKeys).toHaveLength(0);
  });

  test.fixme('reproduces issue #1037 - calendar grid does not fill container width', async () => {
    /**
     * This test checks if the calendar grid properly fills the available
     * container width when in year view.
     *
     * STEPS TO REPRODUCE:
     * 1. Open a note with an embedded calendar base
     * 2. Switch to year view
     * 3. Observe large white/empty space to the right of the calendar grid
     *
     * EXPECTED BEHAVIOR:
     * The calendar grid should fill the available width, with months
     * arranged to use the full container space
     *
     * ACTUAL BEHAVIOR (bug):
     * There's a large white/empty area to the right of the calendar grid,
     * as if the multiMonthYear view has a fixed width that doesn't adapt
     * to the embedded container.
     */
    const page = app.page;

    // Open a note with an embedded calendar
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-Calendar-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Find the embedded calendar and switch to year view
    const embeddedCalendar = page.locator('.internal-embed .advanced-calendar-view, .tn-base-calendar-view');
    const calendarVisible = await embeddedCalendar.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!calendarVisible) {
      console.log('Embedded calendar not found');
      return;
    }

    // Click the year view button
    const yearButton = page.locator('.internal-embed .fc-multiMonthYear-button, .internal-embed button:has-text("Y")');
    if (await yearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await yearButton.click();
      await page.waitForTimeout(1000);
    }

    // Take screenshot showing the layout
    await page.screenshot({ path: 'test-results/screenshots/issue-1037-year-view-width.png' });

    // Measure the container and calendar grid widths
    const widthMetrics = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed');
      const calendarView = embed?.querySelector('.advanced-calendar-view, .fc');
      const calendarGrid = embed?.querySelector('.fc-view-harness, .fc-multimonth');

      if (embed && calendarView && calendarGrid) {
        const embedRect = embed.getBoundingClientRect();
        const viewRect = calendarView.getBoundingClientRect();
        const gridRect = calendarGrid.getBoundingClientRect();

        return {
          embedWidth: embedRect.width,
          calendarViewWidth: viewRect.width,
          calendarGridWidth: gridRect.width,
          // Calculate how much of the container is unused
          unusedSpace: embedRect.width - gridRect.width,
          // Calculate fill percentage
          fillPercentage: (gridRect.width / embedRect.width) * 100,
        };
      }
      return null;
    });

    console.log('Width metrics:', JSON.stringify(widthMetrics, null, 2));

    if (widthMetrics) {
      // The calendar grid should fill at least 90% of the container width
      // Large unused space indicates the layout bug
      expect(widthMetrics.fillPercentage).toBeGreaterThan(90);

      // The unused space should be minimal (less than 50px for normal padding)
      expect(widthMetrics.unusedSpace).toBeLessThan(100);
    }
  });

  test.fixme('reproduces issue #1037 - compare year view layout between embedded and standalone calendar', async () => {
    /**
     * This test compares the year view layout between an embedded calendar
     * and a standalone calendar view to identify layout differences.
     *
     * This helps determine if the spacing issues are specific to embedded
     * contexts or affect all calendar instances.
     */
    const page = app.page;

    // First, open a standalone calendar view
    await runCommand(page, 'TaskNotes: Open Calendar');
    await page.waitForTimeout(2000);

    // Switch to year view in standalone calendar
    const standaloneYearButton = page.locator('.advanced-calendar-view .fc-multiMonthYear-button');
    if (await standaloneYearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await standaloneYearButton.click();
      await page.waitForTimeout(1000);
    }

    // Measure standalone calendar layout
    const standaloneMetrics = await page.evaluate(() => {
      const calendar = document.querySelector('.advanced-calendar-view');
      const title = calendar?.querySelector('.fc-toolbar-title');
      const grid = calendar?.querySelector('.fc-view-harness');

      if (calendar && title && grid) {
        const calRect = calendar.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();

        return {
          calendarWidth: calRect.width,
          titleWidth: titleRect.width,
          titleHeight: titleRect.height,
          titleText: title.textContent,
          gridWidth: gridRect.width,
          gridFillPercentage: (gridRect.width / calRect.width) * 100,
        };
      }
      return null;
    });

    console.log('Standalone calendar metrics:', JSON.stringify(standaloneMetrics, null, 2));
    await page.screenshot({ path: 'test-results/screenshots/issue-1037-standalone-year-view.png' });

    // Now open a note with embedded calendar
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-Calendar-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Switch to year view in embedded calendar
    const embeddedYearButton = page.locator('.internal-embed .fc-multiMonthYear-button, .internal-embed button:has-text("Y")');
    if (await embeddedYearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await embeddedYearButton.click();
      await page.waitForTimeout(1000);
    }

    // Measure embedded calendar layout
    const embeddedMetrics = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed');
      const calendar = embed?.querySelector('.advanced-calendar-view, .fc');
      const title = embed?.querySelector('.fc-toolbar-title');
      const grid = embed?.querySelector('.fc-view-harness');

      if (embed && calendar && title && grid) {
        const embedRect = embed.getBoundingClientRect();
        const calRect = calendar.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();

        return {
          embedWidth: embedRect.width,
          calendarWidth: calRect.width,
          titleWidth: titleRect.width,
          titleHeight: titleRect.height,
          titleText: title.textContent,
          gridWidth: gridRect.width,
          gridFillPercentage: (gridRect.width / embedRect.width) * 100,
        };
      }
      return null;
    });

    console.log('Embedded calendar metrics:', JSON.stringify(embeddedMetrics, null, 2));
    await page.screenshot({ path: 'test-results/screenshots/issue-1037-embedded-year-view.png' });

    // Compare the layouts
    if (standaloneMetrics && embeddedMetrics) {
      console.log('Comparison:');
      console.log(`  Title width - Standalone: ${standaloneMetrics.titleWidth}px, Embedded: ${embeddedMetrics.titleWidth}px`);
      console.log(`  Title height - Standalone: ${standaloneMetrics.titleHeight}px, Embedded: ${embeddedMetrics.titleHeight}px`);
      console.log(`  Grid fill % - Standalone: ${standaloneMetrics.gridFillPercentage.toFixed(1)}%, Embedded: ${embeddedMetrics.gridFillPercentage.toFixed(1)}%`);

      // The embedded calendar should have similar layout proportions to standalone
      // If the title height is much greater in embedded, it's the vertical text bug
      const titleHeightRatio = embeddedMetrics.titleHeight / standaloneMetrics.titleHeight;
      expect(titleHeightRatio).toBeLessThan(2); // Should be roughly similar, not 4x taller

      // Grid fill percentage should be similar
      const fillDifference = Math.abs(standaloneMetrics.gridFillPercentage - embeddedMetrics.gridFillPercentage);
      expect(fillDifference).toBeLessThan(20); // Should be within 20% of each other
    }
  });
});
