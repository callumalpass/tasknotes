/**
 * Issue #1034: Embedded Calendar has unusual proportions
 *
 * Bug: When a calendar base is embedded in a note, it displays with unusual
 * proportions - often appearing too tall relative to its width, creating
 * an awkward layout that doesn't fit well within the note content.
 *
 * Root cause hypothesis:
 * The calendar view uses CSS `height: 100vh` (styles/advanced-calendar-view.css:3)
 * combined with hardcoded min-heights in CalendarView.ts:
 * - rootElement: min-height: 800px (line 1859)
 * - calendarEl: min-height: 700px (line 1867)
 *
 * When embedded in a note via `.internal-embed`, these fixed/viewport-relative
 * heights don't adapt to the embedded context, causing the calendar to be
 * disproportionately tall. Unlike a standalone calendar view that fills its
 * own pane, an embedded calendar should have proportions suitable for inline
 * display within note content.
 *
 * Related code locations:
 * - src/bases/CalendarView.ts:1852-1870 - setupContainer() with hardcoded min-heights
 * - styles/advanced-calendar-view.css:2-7 - Root container height: 100vh
 * - styles/advanced-calendar-view.css:582-588 - Calendar container styling
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1034
 */

import { test, expect, Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1034: Embedded Calendar unusual proportions', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1034 - embedded calendar has disproportionate height', async () => {
    /**
     * This test checks if an embedded calendar has unusual proportions
     * (specifically being too tall relative to its width/container).
     *
     * STEPS TO REPRODUCE:
     * 1. Open a note with an embedded calendar base (![[path/to/calendar.base]])
     * 2. Observe the embedded calendar dimensions
     *
     * EXPECTED BEHAVIOR:
     * The embedded calendar should have reasonable proportions that fit well
     * within the note content - similar aspect ratio to what you'd expect
     * from a calendar widget (roughly square or wider than tall).
     *
     * ACTUAL BEHAVIOR (bug):
     * The calendar appears very tall relative to its width, creating awkward
     * proportions that dominate the note and look out of place. This is caused
     * by hardcoded min-heights (800px, 700px) and viewport-relative height (100vh)
     * that don't adapt to embedded contexts.
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

    // Find the embedded calendar
    const embeddedCalendar = page.locator('.internal-embed .advanced-calendar-view, .internal-embed .tn-base-calendar-view');
    const calendarVisible = await embeddedCalendar.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!calendarVisible) {
      console.log('Embedded calendar not found - test requires a note with embedded calendar base');
      await page.screenshot({ path: 'test-results/screenshots/issue-1034-no-embedded-calendar.png' });
      return;
    }

    // Take screenshot showing the proportions issue
    await page.screenshot({ path: 'test-results/screenshots/issue-1034-embedded-calendar-proportions.png' });

    // Measure the dimensions of the embedded calendar
    const dimensions = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed');
      const calendar = embed?.querySelector('.advanced-calendar-view, .tn-base-calendar-view, .fc');

      if (embed && calendar) {
        const embedRect = embed.getBoundingClientRect();
        const calRect = calendar.getBoundingClientRect();
        const embedStyles = window.getComputedStyle(embed);
        const calStyles = calendar instanceof Element ? window.getComputedStyle(calendar) : null;

        return {
          embed: {
            width: embedRect.width,
            height: embedRect.height,
            aspectRatio: embedRect.width / embedRect.height,
          },
          calendar: {
            width: calRect.width,
            height: calRect.height,
            aspectRatio: calRect.width / calRect.height,
            minHeight: calStyles?.minHeight || 'none',
            maxHeight: calStyles?.maxHeight || 'none',
            computedHeight: calStyles?.height || 'auto',
          },
          viewportHeight: window.innerHeight,
          // Check if calendar height exceeds reasonable embedded proportion
          heightExceedsViewport: calRect.height > window.innerHeight * 0.5,
          // Check if the aspect ratio is very tall (height much greater than width)
          isTooTall: calRect.height > calRect.width * 1.5,
        };
      }
      return null;
    });

    console.log('Embedded calendar dimensions:', JSON.stringify(dimensions, null, 2));

    if (dimensions) {
      // Log the key metrics
      console.log(`Calendar width: ${dimensions.calendar.width}px`);
      console.log(`Calendar height: ${dimensions.calendar.height}px`);
      console.log(`Calendar aspect ratio (w/h): ${dimensions.calendar.aspectRatio.toFixed(2)}`);
      console.log(`Height exceeds 50% viewport: ${dimensions.heightExceedsViewport}`);
      console.log(`Is too tall (h > 1.5*w): ${dimensions.isTooTall}`);
      console.log(`Calendar min-height: ${dimensions.calendar.minHeight}`);

      // The bug causes the calendar to be very tall relative to width
      // A reasonable embedded calendar should have aspect ratio > 0.7 (width >= 70% of height)
      // The hardcoded min-heights cause aspect ratios around 0.5-0.6 or worse
      expect(dimensions.isTooTall).toBe(false);

      // The embedded calendar height shouldn't need to exceed 50% of viewport
      // An embedded widget should be compact and proportional
      expect(dimensions.heightExceedsViewport).toBe(false);
    }
  });

  test.fixme('reproduces issue #1034 - embedded calendar min-height causes overflow', async () => {
    /**
     * This test checks if the hardcoded min-heights in CalendarView.ts cause
     * the embedded calendar to overflow its intended space.
     *
     * The issue is that min-height: 800px (root) and min-height: 700px (calendar)
     * are appropriate for a full-pane calendar view but not for an embedded widget.
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

    // Check for overflow and min-height issues
    const overflowMetrics = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed');
      const calendar = embed?.querySelector('.advanced-calendar-view, .tn-base-calendar-view');

      if (!embed || !calendar) return null;

      // Get all elements with hardcoded min-heights
      const elementsWithMinHeight: Array<{
        selector: string;
        minHeight: string;
        actualHeight: number;
      }> = [];

      // Check the main calendar container
      if (calendar instanceof Element) {
        const styles = window.getComputedStyle(calendar);
        if (styles.minHeight && styles.minHeight !== 'none' && styles.minHeight !== '0px') {
          elementsWithMinHeight.push({
            selector: calendar.className,
            minHeight: styles.minHeight,
            actualHeight: calendar.getBoundingClientRect().height,
          });
        }
      }

      // Check for inline styles with min-height
      const elementsWithInlineMinHeight = embed.querySelectorAll('[style*="min-height"]');
      elementsWithInlineMinHeight.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const styleAttr = el.getAttribute('style') || '';
        const match = styleAttr.match(/min-height:\s*(\d+px)/);
        if (match) {
          elementsWithMinHeight.push({
            selector: `[style*=min-height] #${index}`,
            minHeight: match[1],
            actualHeight: rect.height,
          });
        }
      });

      // Check if the embed container is scrollable (indicating overflow)
      const embedEl = embed as HTMLElement;
      const isScrollable = embedEl.scrollHeight > embedEl.clientHeight;

      return {
        elementsWithMinHeight,
        embedScrollHeight: embedEl.scrollHeight,
        embedClientHeight: embedEl.clientHeight,
        isScrollable,
        // Large min-heights (>500px) are problematic for embedded contexts
        hasProblematicMinHeight: elementsWithMinHeight.some(
          (el) => parseInt(el.minHeight) > 500
        ),
      };
    });

    console.log('Overflow metrics:', JSON.stringify(overflowMetrics, null, 2));

    if (overflowMetrics) {
      // Log findings
      console.log(`Elements with min-height: ${overflowMetrics.elementsWithMinHeight.length}`);
      overflowMetrics.elementsWithMinHeight.forEach((el) => {
        console.log(`  - ${el.selector}: min-height=${el.minHeight}, actual=${el.actualHeight}px`);
      });
      console.log(`Embed is scrollable: ${overflowMetrics.isScrollable}`);
      console.log(`Has problematic min-height (>500px): ${overflowMetrics.hasProblematicMinHeight}`);

      // For embedded contexts, min-heights should be much smaller or not set
      // The hardcoded 700px/800px values are the root cause of the proportion issue
      expect(overflowMetrics.hasProblematicMinHeight).toBe(false);
    }
  });

  test.fixme('reproduces issue #1034 - compare standalone vs embedded calendar proportions', async () => {
    /**
     * This test compares the proportions of a standalone calendar view vs
     * an embedded calendar to highlight the proportion discrepancy.
     *
     * A standalone calendar filling its own pane can reasonably be tall,
     * but an embedded calendar should adapt to be more compact/proportional.
     */
    const page = app.page;

    // First, open a standalone calendar view
    await runCommand(page, 'TaskNotes: Open Calendar');
    await page.waitForTimeout(2000);

    // Measure standalone calendar proportions
    const standaloneMetrics = await page.evaluate(() => {
      const calendar = document.querySelector('.advanced-calendar-view');
      if (calendar) {
        const rect = calendar.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          aspectRatio: rect.width / rect.height,
          // For standalone, filling the pane is expected
          fillsPane: rect.height > window.innerHeight * 0.7,
        };
      }
      return null;
    });

    console.log('Standalone calendar metrics:', JSON.stringify(standaloneMetrics, null, 2));
    await page.screenshot({ path: 'test-results/screenshots/issue-1034-standalone-calendar.png' });

    // Now open a note with embedded calendar
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input');
    await expect(quickSwitcher).toBeVisible({ timeout: 3000 });
    await quickSwitcher.fill('Embedded-Calendar-Test');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Measure embedded calendar proportions
    const embeddedMetrics = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed');
      const calendar = embed?.querySelector('.advanced-calendar-view, .tn-base-calendar-view, .fc');

      if (calendar) {
        const rect = calendar.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          aspectRatio: rect.width / rect.height,
          // For embedded, it should NOT fill the viewport
          fillsPane: rect.height > window.innerHeight * 0.7,
        };
      }
      return null;
    });

    console.log('Embedded calendar metrics:', JSON.stringify(embeddedMetrics, null, 2));
    await page.screenshot({ path: 'test-results/screenshots/issue-1034-embedded-calendar.png' });

    // Compare the proportions
    if (standaloneMetrics && embeddedMetrics) {
      console.log('Comparison:');
      console.log(`  Standalone aspect ratio: ${standaloneMetrics.aspectRatio.toFixed(2)}`);
      console.log(`  Embedded aspect ratio: ${embeddedMetrics.aspectRatio.toFixed(2)}`);
      console.log(`  Standalone fills pane: ${standaloneMetrics.fillsPane}`);
      console.log(`  Embedded fills pane: ${embeddedMetrics.fillsPane}`);

      // The embedded calendar should NOT behave like a standalone one
      // It should have different (more compact) proportions
      // The bug is that they have similar proportions due to hardcoded min-heights
      expect(embeddedMetrics.fillsPane).toBe(false);

      // Embedded should ideally have a better (higher) aspect ratio than standalone
      // because it should be more compact/proportional for inline display
      // Currently, both have similar poor ratios due to the hardcoded heights
    }
  });

  test.fixme('reproduces issue #1034 - 100vh height causes issues in embedded context', async () => {
    /**
     * This test specifically checks if the CSS `height: 100vh` on
     * .advanced-calendar-view causes layout issues when embedded.
     *
     * In an embedded context, 100vh is relative to the entire viewport,
     * not the embed container, causing the calendar to be inappropriately sized.
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

    // Check for viewport-relative sizing issues
    const viewportSizingMetrics = await page.evaluate(() => {
      const embed = document.querySelector('.internal-embed');
      const calendar = embed?.querySelector('.advanced-calendar-view');

      if (!embed || !calendar) return null;

      const calendarStyles = window.getComputedStyle(calendar);
      const calendarRect = calendar.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if height is viewport-relative
      const computedHeight = calendarStyles.height;
      const isViewportRelative =
        computedHeight.includes('vh') ||
        Math.abs(calendarRect.height - viewportHeight) < 50; // Close to viewport height

      return {
        computedHeight,
        actualHeight: calendarRect.height,
        viewportHeight,
        heightToViewportRatio: calendarRect.height / viewportHeight,
        isViewportRelative,
        // Embedded calendar shouldn't be close to viewport height
        isTooCloseToViewportHeight: calendarRect.height > viewportHeight * 0.6,
      };
    });

    console.log('Viewport sizing metrics:', JSON.stringify(viewportSizingMetrics, null, 2));

    if (viewportSizingMetrics) {
      console.log(`Computed height: ${viewportSizingMetrics.computedHeight}`);
      console.log(`Actual height: ${viewportSizingMetrics.actualHeight}px`);
      console.log(`Viewport height: ${viewportSizingMetrics.viewportHeight}px`);
      console.log(`Height/viewport ratio: ${viewportSizingMetrics.heightToViewportRatio.toFixed(2)}`);
      console.log(`Is viewport-relative: ${viewportSizingMetrics.isViewportRelative}`);

      // For embedded calendars, height should NOT be viewport-relative
      // and should not approach the viewport height
      expect(viewportSizingMetrics.isTooCloseToViewportHeight).toBe(false);
    }
  });
});
