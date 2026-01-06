/**
 * Issue #1237: Mini calendar view - mark current day clearly
 *
 * Feature request: The mini calendar view has no clear indication of the
 * current day, making it harder to open today's note. The user reports that
 * while the selected/opened daily note is highlighted, the actual "today"
 * date does not have a visible highlight.
 *
 * Currently, today's date only gets a small dot indicator via ::after pseudo-element.
 * The user requests a more prominent visual highlight (like a background color
 * or border) similar to how the selected date is styled.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1237
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1237: Mini calendar today marker visibility', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1237 - today marker should be clearly visible', async () => {
    /**
     * This test verifies that today's date in the mini calendar is clearly
     * marked and distinguishable from other dates.
     *
     * Expected behavior after fix:
     * - Today's date should have a clearly visible indicator
     * - The indicator should be more prominent than just a small dot
     * - Today should be distinguishable even when another date is selected
     * - The visual should make it easy to identify today at a glance
     *
     * Current behavior (bug):
     * - Today only has a small dot indicator (::after pseudo-element)
     * - This is subtle and easy to miss, especially when viewing a different
     *   month or when a different date is selected
     */
    const page = app.page;

    // Open the mini calendar view
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    // Find the mini calendar
    const miniCalendar = page.locator('.mini-calendar-view').first();
    await expect(miniCalendar).toBeVisible({ timeout: 5000 });

    // Find the "today" element - it should have the --today modifier class
    const todayElement = page.locator('.mini-calendar-view__day--today');
    await expect(todayElement).toBeVisible({ timeout: 2000 });

    // Verify today has the aria-current="date" attribute (accessibility)
    await expect(todayElement).toHaveAttribute('aria-current', 'date');

    // Check the visual styling of today's element
    const todayStyles = await todayElement.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      const pseudoAfter = window.getComputedStyle(el, '::after');

      return {
        backgroundColor: computed.backgroundColor,
        border: computed.border,
        borderWidth: computed.borderWidth,
        boxShadow: computed.boxShadow,
        color: computed.color,
        fontWeight: computed.fontWeight,
        // Check ::after pseudo-element (current small dot indicator)
        afterWidth: pseudoAfter.width,
        afterHeight: pseudoAfter.height,
        afterBackground: pseudoAfter.backgroundColor,
        afterPosition: pseudoAfter.position,
      };
    });

    // Log current styling for debugging
    console.log('Today element styles:', JSON.stringify(todayStyles, null, 2));

    /**
     * The feature request is for a "clear indication" of the current day.
     * Currently, the main element has background: none, relying only on
     * the ::after pseudo-element for the indicator.
     *
     * A proper implementation should have at least ONE of these:
     * - A visible background color (not 'none' or 'transparent')
     * - A visible border
     * - A visible box-shadow
     *
     * This test will fail until the feature is implemented because
     * the current styling only uses a subtle ::after dot indicator.
     */

    // The today element should have a clearly visible indicator
    // At minimum, it should have a non-transparent background OR a border
    const hasVisibleBackground =
      todayStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      todayStyles.backgroundColor !== 'transparent';

    const hasVisibleBorder =
      todayStyles.borderWidth !== '0px' &&
      todayStyles.border !== 'none' &&
      todayStyles.border !== '';

    const hasVisibleBoxShadow =
      todayStyles.boxShadow !== 'none' &&
      todayStyles.boxShadow !== '';

    const hasClearVisualIndicator = hasVisibleBackground || hasVisibleBorder || hasVisibleBoxShadow;

    // This assertion documents the expected behavior after the fix
    expect(hasClearVisualIndicator).toBe(true);

    // Close the view
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1237 - today should be distinguishable when another day is selected', async () => {
    /**
     * This test verifies that today remains clearly visible even when
     * a different date is selected. The user's scenario was that they
     * had opened yesterday's note (selected/highlighted) but couldn't
     * easily identify where "today" was in the calendar.
     */
    const page = app.page;

    // Open the mini calendar view
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    // Find the mini calendar
    const miniCalendar = page.locator('.mini-calendar-view').first();
    await expect(miniCalendar).toBeVisible({ timeout: 5000 });

    // Find today's element
    const todayElement = page.locator('.mini-calendar-view__day--today');
    await expect(todayElement).toBeVisible({ timeout: 2000 });

    // Get today's date number to find a different day to click
    const todayDateNum = await todayElement.textContent();
    const todayNum = parseInt(todayDateNum || '0', 10);

    // Find another day in the same month (not today) and click it
    const allDays = page.locator('.mini-calendar-view__day:not(.mini-calendar-view__day--outside-month)');
    const dayCount = await allDays.count();

    // Click on a different day (yesterday or day before)
    let differentDayClicked = false;
    for (let i = 0; i < dayCount; i++) {
      const day = allDays.nth(i);
      const dayText = await day.textContent();
      const dayNum = parseInt(dayText || '0', 10);

      // Click a day that is not today
      if (dayNum !== todayNum && dayNum > 0) {
        await day.click();
        differentDayClicked = true;
        break;
      }
    }

    expect(differentDayClicked).toBe(true);
    await page.waitForTimeout(300);

    // Now verify that today is still clearly marked even though another day is selected
    const todayAfterSelection = page.locator('.mini-calendar-view__day--today');
    await expect(todayAfterSelection).toBeVisible();

    // Verify the selected day is different from today
    const selectedDay = page.locator('.mini-calendar-view__day--selected');
    await expect(selectedDay).toBeVisible();

    // Today and selected should be different elements (unless user clicked today)
    const todayHasSelected = await todayAfterSelection.evaluate((el) =>
      el.classList.contains('mini-calendar-view__day--selected')
    );

    // If today is not selected, verify today still has clear visual indicator
    if (!todayHasSelected) {
      const todayStyles = await todayAfterSelection.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          border: computed.border,
          borderWidth: computed.borderWidth,
          boxShadow: computed.boxShadow,
        };
      });

      // Today should still be clearly visible when not selected
      const hasVisibleBackground =
        todayStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        todayStyles.backgroundColor !== 'transparent';

      const hasVisibleBorder =
        todayStyles.borderWidth !== '0px' &&
        todayStyles.border !== 'none';

      const hasVisibleBoxShadow =
        todayStyles.boxShadow !== 'none' &&
        todayStyles.boxShadow !== '';

      // This documents the expectation: today should be clearly marked
      // even when it's not the selected date
      expect(hasVisibleBackground || hasVisibleBorder || hasVisibleBoxShadow).toBe(true);
    }

    // Close the view
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1237 - today indicator contrast check', async () => {
    /**
     * This test verifies that the today indicator has sufficient visual
     * contrast to be easily noticeable. The current small dot indicator
     * may be too subtle for quick identification.
     */
    const page = app.page;

    // Open the mini calendar view
    await runCommand(page, 'TaskNotes: Open calendar view');
    await page.waitForTimeout(1000);

    const miniCalendar = page.locator('.mini-calendar-view').first();
    await expect(miniCalendar).toBeVisible({ timeout: 5000 });

    const todayElement = page.locator('.mini-calendar-view__day--today');
    await expect(todayElement).toBeVisible({ timeout: 2000 });

    // Get a regular (non-today, non-selected) day for comparison
    const regularDay = page.locator(
      '.mini-calendar-view__day:not(.mini-calendar-view__day--today):not(.mini-calendar-view__day--selected):not(.mini-calendar-view__day--outside-month)'
    ).first();

    if (await regularDay.isVisible()) {
      // Compare styles between today and regular day
      const [todayStyles, regularStyles] = await Promise.all([
        todayElement.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            border: computed.border,
            color: computed.color,
            fontWeight: computed.fontWeight,
          };
        }),
        regularDay.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            border: computed.border,
            color: computed.color,
            fontWeight: computed.fontWeight,
          };
        }),
      ]);

      console.log('Today styles:', JSON.stringify(todayStyles, null, 2));
      console.log('Regular day styles:', JSON.stringify(regularStyles, null, 2));

      // Today should have at least one visually distinguishing property
      // that makes it stand out from regular days
      const hasDifferentBackground = todayStyles.backgroundColor !== regularStyles.backgroundColor;
      const hasDifferentBorder = todayStyles.border !== regularStyles.border;
      const hasDifferentColor = todayStyles.color !== regularStyles.color;
      const hasDifferentWeight = todayStyles.fontWeight !== regularStyles.fontWeight;

      const hasVisualDifference =
        hasDifferentBackground || hasDifferentBorder || hasDifferentColor || hasDifferentWeight;

      // This test expects today to be visually distinct from regular days
      // Currently may pass due to color change, but the feature request
      // is for more prominent highlighting (background/border)
      expect(hasVisualDifference).toBe(true);
    }

    // Close the view
    await page.keyboard.press('Escape');
  });
});
