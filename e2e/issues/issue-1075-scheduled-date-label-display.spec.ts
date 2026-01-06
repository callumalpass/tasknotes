/**
 * Issue #1075: "Label" instead of "today" for scheduled date
 *
 * Bug description: When clicking on a scheduled date for a task on Mac,
 * the date input shows "Label" instead of the actual date value or placeholder.
 * This appears to be a Mac/Safari/WebKit-specific issue where the native
 * <input type="date"> element displays its field labels incorrectly.
 *
 * The issue affects the ScheduledDateModal and potentially DueDateModal
 * which use native HTML date inputs styled with webkit datetime pseudo-elements.
 *
 * Root cause hypothesis:
 * - Safari/WebKit renders `-webkit-datetime-edit-label` pseudo-element
 *   which shows "Label" text when not properly styled or hidden
 * - The CSS in date-picker.css and modal-bem.css may be missing rules
 *   for the `-webkit-datetime-edit-label` pseudo-element
 * - This only manifests on Mac because of WebKit's specific date input rendering
 *
 * Potential fixes:
 * 1. Add CSS to hide or style `-webkit-datetime-edit-label` pseudo-element
 * 2. Ensure the date input has proper value/placeholder handling on WebKit
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1075
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1075: Scheduled date label display bug', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1075 - date input should not display "Label" text', async () => {
    /**
     * This test verifies that native date inputs in the ScheduledDateModal
     * do not display "Label" text on Mac/WebKit browsers.
     *
     * Steps to reproduce:
     * 1. Open a task that has a scheduled date
     * 2. Click on the scheduled date to open the ScheduledDateModal
     * 3. Observe the date input field
     *
     * Expected behavior:
     * - Date input should show the current date value or be empty
     * - Should NOT display "Label" anywhere in the input
     *
     * Actual behavior (bug):
     * - On Mac, the date input displays "Label" replacing the date value
     */
    const page = app.page;

    // Create a task with a scheduled date
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Look for any date input in the modal
    const dateInput = modal.locator('input[type="date"]').first();

    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get the rendered text content visible in the input
      const inputValue = await dateInput.inputValue();
      const inputText = await dateInput.evaluate((el: HTMLInputElement) => {
        // Get computed styles to check webkit pseudo-elements
        const style = window.getComputedStyle(el, '::-webkit-datetime-edit-label');
        return {
          value: el.value,
          placeholder: el.placeholder,
          // Check if the displayed text contains "Label"
          innerText: el.innerText || '',
        };
      });

      console.log('Date input state:', inputText);

      // The date input value should not contain "Label"
      expect(inputValue.toLowerCase()).not.toContain('label');

      // Set a date value and verify it displays correctly
      await dateInput.fill('2024-12-25');
      await page.waitForTimeout(300);

      const newValue = await dateInput.inputValue();
      expect(newValue).toBe('2024-12-25');

      // Take a screenshot for visual verification on Mac
      // The screenshot would show if "Label" is visible
      await dateInput.screenshot({ path: 'test-results/issue-1075-date-input.png' });
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1075 - webkit datetime label pseudo-element styling', async () => {
    /**
     * This test checks if the webkit datetime label pseudo-element CSS
     * is properly configured to prevent "Label" text from appearing.
     *
     * On Mac/Safari, the <input type="date"> element uses several
     * webkit pseudo-elements:
     * - ::-webkit-datetime-edit - main edit container
     * - ::-webkit-datetime-edit-label - field labels (the bug!)
     * - ::-webkit-datetime-edit-fields-wrapper - wrapper for fields
     * - ::-webkit-datetime-edit-text - separator text
     * - ::-webkit-datetime-edit-month-field - month field
     * - ::-webkit-datetime-edit-day-field - day field
     * - ::-webkit-datetime-edit-year-field - year field
     *
     * If -webkit-datetime-edit-label is not hidden/styled, Safari shows "Label".
     */
    const page = app.page;

    // Navigate to ScheduledDateModal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const dateInput = modal.locator('input[type="date"]').first();

    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check computed styles for webkit pseudo-elements
      const webkitStyles = await page.evaluate(() => {
        const dateInput = document.querySelector('input[type="date"]');
        if (!dateInput) return null;

        // Note: We can't directly access pseudo-element styles via JS
        // but we can check if the CSS rules exist in stylesheets
        const styles: Record<string, boolean> = {};

        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              const selector = (rule as CSSStyleRule).selectorText || '';
              if (selector.includes('-webkit-datetime-edit-label')) {
                styles['hasLabelRule'] = true;
              }
              if (selector.includes('-webkit-datetime-edit-separator')) {
                styles['hasSeparatorRule'] = true;
              }
            }
          } catch {
            // Cross-origin stylesheets may throw
          }
        }

        return styles;
      });

      console.log('Webkit datetime CSS rules found:', webkitStyles);

      // The fix would ensure these pseudo-elements have proper styling
      // to prevent "Label" text from appearing
      // expect(webkitStyles?.hasLabelRule).toBe(true);
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1075 - quick date buttons should work correctly', async () => {
    /**
     * This test verifies that the quick date buttons (Today, Tomorrow, etc.)
     * properly update the date input value without triggering the "Label" bug.
     *
     * The bug report mentions "Label replaces whatever the current selection is
     * (whether that be today, tomorrow, etc.)" - this suggests clicking quick
     * buttons may be related to the display issue.
     */
    const page = app.page;

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the scheduled date section and quick buttons
    // The ScheduledDateModal has buttons: Today, Tomorrow, Next week, Now, Clear
    const todayButton = modal.locator('button', { hasText: /^Today$/i }).first();
    const tomorrowButton = modal.locator('button', { hasText: /^Tomorrow$/i }).first();
    const dateInput = modal.locator('input[type="date"]').first();

    if (await todayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click Today button
      await todayButton.click();
      await page.waitForTimeout(300);

      // Get the date input value
      const todayValue = await dateInput.inputValue();
      console.log('After clicking Today:', todayValue);

      // Value should be a valid date, not "Label"
      expect(todayValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(todayValue.toLowerCase()).not.toContain('label');

      // Verify visually the input doesn't show "Label"
      // Take screenshot for manual verification
      await modal.screenshot({ path: 'test-results/issue-1075-after-today-click.png' });

      // Click Tomorrow button
      if (await tomorrowButton.isVisible().catch(() => false)) {
        await tomorrowButton.click();
        await page.waitForTimeout(300);

        const tomorrowValue = await dateInput.inputValue();
        console.log('After clicking Tomorrow:', tomorrowValue);

        expect(tomorrowValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(tomorrowValue.toLowerCase()).not.toContain('label');
      }
    }

    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1075 - DueDateModal has same issue', async () => {
    /**
     * The DueDateModal uses the same native date input pattern as ScheduledDateModal.
     * This test verifies both modals are affected and would need the same fix.
     */
    const page = app.page;

    // Try to access a due date modal if possible
    // This requires having a task with due date options
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Look for due date inputs
    const allDateInputs = modal.locator('input[type="date"]');
    const count = await allDateInputs.count();

    console.log(`Found ${count} date inputs in modal`);

    // All date inputs should properly display values without "Label"
    for (let i = 0; i < count; i++) {
      const input = allDateInputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        // Set a test value
        await input.fill('2024-06-15');
        await page.waitForTimeout(200);

        const value = await input.inputValue();
        expect(value).toBe('2024-06-15');
        expect(value.toLowerCase()).not.toContain('label');
      }
    }

    await page.keyboard.press('Escape');
  });
});
