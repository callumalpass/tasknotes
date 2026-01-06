/**
 * Issue #1127: "Task List" page doesn't respect custom priority colours
 *
 * Bug Description:
 * Custom priority colors configured in Settings -> TaskNotes -> Task Properties
 * work correctly when tasks are displayed inline in notes, but do not work in:
 * 1. The "Subtasks" section at the bottom/top of notes
 * 2. The "Task List" page (accessed via "Open Task List" button)
 *
 * Root cause analysis:
 * The priority dot color is set incorrectly. In TaskCard.ts:
 * - Line 1461: `priorityDot.style.borderColor = priorityConfig.color` sets borderColor
 * - Line 1409: `card.style.setProperty("--priority-color", priorityConfig.color)` sets CSS variable
 *
 * But in task-card-bem.css (lines 831-864):
 * - The CSS expects `background-color: var(--priority-color, transparent)` (line 838)
 * - Higher specificity selectors with `[data-priority]` override with fallback colors (line 844)
 * - Fallback CSS rules like `.task-card--priority-medium` use hardcoded CSS variables
 *   like `--priority-medium-color` which may not match user's custom colors
 *
 * The mismatch between JavaScript setting `borderColor` and CSS expecting `background-color`
 * causes the priority dot to show incorrect colors. Additionally, the CSS fallback rules
 * use default colors that override the user's custom priority color configuration.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1127
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1127: Custom priority colors not respected in Task List', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1127 - priority dot should use custom color in Task List view', async () => {
    /**
     * This test verifies that custom priority colors defined in settings
     * are correctly applied to priority dots in the Task List view.
     *
     * Expected behavior after fix:
     * - Priority dots in Task List should display the user-defined custom color
     * - The background-color of the priority dot should match the color configured
     *   in Settings -> TaskNotes -> Task Properties
     *
     * Current behavior (bug):
     * - Priority dots show default/fallback colors (e.g., green for "normal")
     * - The custom color set by the user is ignored due to CSS specificity issues
     * - The inline style sets borderColor but CSS expects background-color
     */
    const page = app.page;

    // Open the Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Wait for the task list to load
    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Find a task card with a priority dot
    const priorityDot = page.locator('.task-card__priority-dot').first();

    if (await priorityDot.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get the computed styles of the priority dot
      const styles = await priorityDot.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          // Get the CSS variable value if set
          priorityColorVar: computed.getPropertyValue('--priority-color').trim(),
        };
      });

      console.log('Priority dot styles:', JSON.stringify(styles, null, 2));

      // Get the parent card's priority color CSS variable
      const card = page.locator('.task-card').first();
      const cardPriorityColor = await card.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('--priority-color').trim();
      });

      console.log('Card --priority-color CSS variable:', cardPriorityColor);

      // The bug: background-color doesn't match the card's --priority-color
      // After fix: the priority dot's background-color should use the custom color
      if (cardPriorityColor) {
        // Convert hex to rgb if needed for comparison
        const normalizeColor = (color: string) => {
          // Create a temporary element to normalize color format
          const temp = document.createElement('div');
          temp.style.color = color;
          document.body.appendChild(temp);
          const normalized = window.getComputedStyle(temp).color;
          document.body.removeChild(temp);
          return normalized;
        };

        // This assertion will fail until the bug is fixed
        // The background-color should match the custom priority color
        const bgColorMatches = await page.evaluate(
          ({ bgColor, customColor }) => {
            // Normalize both colors for comparison
            const temp = document.createElement('div');
            document.body.appendChild(temp);

            temp.style.color = bgColor;
            const normalizedBg = window.getComputedStyle(temp).color;

            temp.style.color = customColor;
            const normalizedCustom = window.getComputedStyle(temp).color;

            document.body.removeChild(temp);

            return normalizedBg === normalizedCustom;
          },
          { bgColor: styles.backgroundColor, customColor: cardPriorityColor }
        );

        // This should be true after the fix
        expect(bgColorMatches).toBe(true);
      }
    } else {
      console.log('No priority dots found in Task List - create a task with priority to test');
    }

    // Close the Task List view
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1127 - priority dot should use custom color in Subtasks section', async () => {
    /**
     * This test verifies that custom priority colors are correctly applied
     * to priority dots in the Subtasks section of task notes.
     *
     * Expected behavior after fix:
     * - Priority dots in Subtasks section should display user-defined colors
     * - Visual consistency with inline task display
     *
     * Current behavior (bug):
     * - Subtask priority dots show default/fallback colors
     * - Custom colors are not applied
     */
    const page = app.page;

    // Create a task to examine subtasks
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Look for a subtasks section if it exists in the modal
    const subtasksSection = modal.locator('.task-card--subtask, .subtasks-container, [class*="subtask"]');

    if (await subtasksSection.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const subtaskPriorityDot = subtasksSection.locator('.task-card__priority-dot').first();

      if (await subtaskPriorityDot.isVisible({ timeout: 1000 }).catch(() => false)) {
        const styles = await subtaskPriorityDot.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
          };
        });

        console.log('Subtask priority dot styles:', JSON.stringify(styles, null, 2));

        // The bug manifests here too - background-color uses fallback instead of custom color
      }
    } else {
      console.log('No subtasks section found in modal');
    }

    // Close the modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Handle potential "discard changes" dialog
    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1127 - CSS property mismatch between borderColor and background-color', async () => {
    /**
     * This test directly examines the CSS property mismatch that causes the bug.
     *
     * The issue is that JavaScript sets:
     *   priorityDot.style.borderColor = priorityConfig.color
     *
     * But CSS expects:
     *   background-color: var(--priority-color, transparent)
     *
     * The fix should ensure the priority color is applied to background-color,
     * not borderColor.
     */
    const page = app.page;

    // Open Task List to examine priority dots
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const priorityDot = page.locator('.task-card__priority-dot').first();

    if (await priorityDot.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check both the inline style and computed style
      const styleAnalysis = await priorityDot.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const htmlEl = el as HTMLElement;

        return {
          // Inline styles (set by JavaScript)
          inlineBackgroundColor: htmlEl.style.backgroundColor,
          inlineBorderColor: htmlEl.style.borderColor,

          // Computed styles (what's actually rendered)
          computedBackgroundColor: computed.backgroundColor,
          computedBorderColor: computed.borderColor,

          // CSS variable on the element
          priorityColorVar: computed.getPropertyValue('--priority-color').trim(),

          // Check if background is transparent (indicating bug)
          backgroundIsTransparent:
            computed.backgroundColor === 'transparent' ||
            computed.backgroundColor === 'rgba(0, 0, 0, 0)',
        };
      });

      console.log('Style analysis:', JSON.stringify(styleAnalysis, null, 2));

      // The bug: borderColor is set inline but backgroundColor is not
      // After fix: backgroundColor should be set to the custom priority color
      expect(styleAnalysis.inlineBorderColor).toBeTruthy(); // Currently set (bug behavior)

      // This assertion documents the expected fix:
      // Either backgroundColor should be set inline, or the CSS variable should work
      const hasCorrectBackgroundColor =
        styleAnalysis.inlineBackgroundColor !== '' ||
        (styleAnalysis.priorityColorVar !== '' && !styleAnalysis.backgroundIsTransparent);

      // This should be true after the fix
      expect(hasCorrectBackgroundColor).toBe(true);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1127 - compare inline task vs Task List priority colors', async () => {
    /**
     * This test compares priority dot colors between:
     * 1. Inline task display (works correctly per the issue report)
     * 2. Task List view (bug - shows wrong colors)
     *
     * Both should display the same custom priority color for the same task.
     */
    const page = app.page;

    // First, get priority color from Task List
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    let taskListPriorityColor: string | null = null;
    const taskListDot = page.locator('.task-card__priority-dot').first();

    if (await taskListDot.isVisible({ timeout: 3000 }).catch(() => false)) {
      taskListPriorityColor = await taskListDot.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      console.log('Task List priority dot background-color:', taskListPriorityColor);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Now check inline task display - open a note with tasks
    // The inline widget uses different class names
    const inlinePriorityDot = page.locator('.task-inline-preview__priority-dot').first();

    let inlinePriorityColor: string | null = null;
    if (await inlinePriorityDot.isVisible({ timeout: 3000 }).catch(() => false)) {
      inlinePriorityColor = await inlinePriorityDot.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      console.log('Inline task priority dot background-color:', inlinePriorityColor);
    }

    // Compare colors - they should match for the same priority level
    if (taskListPriorityColor && inlinePriorityColor) {
      console.log('Color comparison:', {
        taskList: taskListPriorityColor,
        inline: inlinePriorityColor,
        match: taskListPriorityColor === inlinePriorityColor,
      });

      // After the fix, both should show the same custom color
      expect(taskListPriorityColor).toBe(inlinePriorityColor);
    }
  });

  test.fixme('reproduces issue #1127 - verify CSS variable inheritance for priority colors', async () => {
    /**
     * This test verifies that the CSS variable system for priority colors
     * works correctly throughout the component hierarchy.
     *
     * The expected flow:
     * 1. User sets custom priority color in settings
     * 2. PriorityManager generates CSS with --priority-{value}-color variables
     * 3. TaskCard sets --priority-color on the card element
     * 4. Priority dot inherits and uses this CSS variable
     *
     * The bug occurs because:
     * - CSS fallback rules with higher specificity override the variable
     * - The [data-priority] selector expects --current-priority-color which isn't set
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Check CSS variable chain
    const card = page.locator('.task-card').first();

    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const cssVarAnalysis = await card.evaluate((cardEl) => {
        const cardComputed = window.getComputedStyle(cardEl);
        const dot = cardEl.querySelector('.task-card__priority-dot') as HTMLElement;

        let dotAnalysis = null;
        if (dot) {
          const dotComputed = window.getComputedStyle(dot);
          dotAnalysis = {
            // CSS variable on dot
            priorityColorOnDot: dotComputed.getPropertyValue('--priority-color').trim(),
            // What CSS actually applies
            computedBackground: dotComputed.backgroundColor,
            // Check if using fallback
            usingFallback: dotComputed.backgroundColor.includes('rgb'),
          };
        }

        return {
          // CSS variable on card (set by JavaScript)
          priorityColorOnCard: cardComputed.getPropertyValue('--priority-color').trim(),
          // Card class for priority
          cardClasses: cardEl.className,
          // Dot analysis
          dot: dotAnalysis,
          // Check for data-priority attribute (CSS selector expects this)
          hasDataPriority: cardEl.hasAttribute('data-priority'),
        };
      });

      console.log('CSS variable analysis:', JSON.stringify(cssVarAnalysis, null, 2));

      // The bug: hasDataPriority is likely false, but CSS selector expects [data-priority]
      // After fix: either data-priority should be set, or CSS selectors should not require it

      if (cssVarAnalysis.priorityColorOnCard && cssVarAnalysis.dot) {
        // The priority color variable should cascade to the dot's background
        // This assertion documents the expected behavior after fix
        expect(cssVarAnalysis.dot.computedBackground).not.toBe('transparent');
        expect(cssVarAnalysis.dot.computedBackground).not.toBe('rgba(0, 0, 0, 0)');
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
