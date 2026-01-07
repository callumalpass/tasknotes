/**
 * Issue #950: [Bug]: invisible chevron for opening subtasks when the task name is too long
 *
 * Bug description:
 * The chevron icon used to expand/collapse subtasks becomes invisible or inaccessible
 * when the task name is too long. This affects tasks that have subtasks (parent tasks/projects)
 * where users need to click the chevron to expand and view subtasks.
 *
 * Root cause analysis:
 * The task card uses a flex layout structure:
 * - main-row (flex container, width: 100%)
 *   - content (flex: 1, min-width: 0)
 *     - title (word-wrap: break-word, white-space: normal)
 *   - badges (flex-shrink: 0) - contains the chevron
 *
 * When the task title is very long:
 * 1. The title may wrap to multiple lines
 * 2. The badges container (including chevron) should remain visible on the right
 * 3. However, if the title overflows or the container doesn't handle overflow properly,
 *    the chevron becomes invisible or pushed out of view
 *
 * The chevron by default has opacity: 0 and becomes opacity: 1 on hover.
 * Additionally, if the badges container is pushed off-screen or hidden,
 * users cannot access the expand functionality at all.
 *
 * CSS files involved:
 * - styles/task-card-bem.css (lines 66-100 for main-row and content)
 * - styles/task-card-bem.css (lines 443-485 for chevron styling)
 * - styles/task-card-bem.css (lines 346-356 for badges container)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/950
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #950: Invisible chevron for opening subtasks when task name is too long', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #950 - chevron visibility with very long task name', async () => {
    /**
     * This test reproduces the core issue: when a task has a very long name,
     * the chevron for expanding subtasks should still be visible and accessible.
     *
     * Steps:
     * 1. Create a parent task with a very long name
     * 2. Create a subtask linked to the parent
     * 3. Open the task list view
     * 4. Find the parent task and verify the chevron is visible/accessible
     */
    const page = app.page;

    // Very long task name that would cause wrapping or overflow
    const longTaskName = 'This is a very long task name that should definitely cause the title to wrap to multiple lines and potentially push the chevron off screen or make it invisible when viewing in the task list because the content area takes up too much horizontal space';

    // Step 1: Create a parent task with the very long name
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill(longTaskName);
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 2: Create a subtask that references the parent
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal2 = page.locator('.modal');
    await expect(modal2).toBeVisible({ timeout: 5000 });

    const titleInput2 = modal2.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Subtask for issue 950 test');
    }

    // Set the parent/project field
    const projectInput = modal2.locator('input[placeholder*="project"], .project-input, [data-property="project"] input, [data-property="projects"] input').first();
    if (await projectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectInput.click();
      await page.keyboard.type(longTaskName.substring(0, 50), { delay: 20 });
      await page.waitForTimeout(500);

      const suggestion = page.locator('.suggestion-item').first();
      if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
      }
    }

    const createButton2 = modal2.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // Step 3: Open the task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Step 4: Find the parent task card with the long name
    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Find the task card containing our long title
    const parentTaskCard = page.locator('.task-card').filter({
      hasText: longTaskName.substring(0, 30), // Match first part of the title
    }).first();

    const cardVisible = await parentTaskCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (!cardVisible) {
      console.log('Parent task card not found in task list');
      return;
    }

    // Hover over the task card to reveal the chevron
    await parentTaskCard.hover();
    await page.waitForTimeout(300);

    // Step 5: Check if the chevron is visible
    const chevron = parentTaskCard.locator('.task-card__chevron');
    const chevronExists = await chevron.count() > 0;

    if (!chevronExists) {
      console.log('BUG: No chevron element found for task with subtasks');
    }

    // Check if the chevron is actually visible (opacity > 0, in viewport)
    if (chevronExists) {
      const chevronBox = await chevron.boundingBox();
      const cardBox = await parentTaskCard.boundingBox();

      if (chevronBox && cardBox) {
        // Check if chevron is within the visible bounds of the card
        const isWithinCard =
          chevronBox.x >= cardBox.x &&
          chevronBox.x + chevronBox.width <= cardBox.x + cardBox.width &&
          chevronBox.y >= cardBox.y &&
          chevronBox.y + chevronBox.height <= cardBox.y + cardBox.height;

        if (!isWithinCard) {
          console.log('BUG REPRODUCED: Chevron is positioned outside the task card bounds');
          console.log(`Card bounds: x=${cardBox.x}, width=${cardBox.width}`);
          console.log(`Chevron bounds: x=${chevronBox.x}, width=${chevronBox.width}`);
        }

        // Verify chevron is visible (has non-zero opacity after hover)
        const chevronOpacity = await chevron.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return parseFloat(style.opacity);
        });

        if (chevronOpacity === 0) {
          console.log('BUG: Chevron has 0 opacity even after hover');
        }

        // The chevron should be visible and clickable
        expect(chevronOpacity).toBeGreaterThan(0);
        expect(isWithinCard).toBe(true);
      } else {
        console.log('Could not get bounding box - element may not be visible');
        // If we can't get the bounding box, the chevron is not properly visible
        expect(chevronBox).not.toBeNull();
      }
    }

    // Cleanup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #950 - chevron clickable with long task name', async () => {
    /**
     * This test verifies that even with a long task name, the chevron
     * can be clicked to expand subtasks.
     */
    const page = app.page;

    // Open the task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find any task card that has a chevron (has subtasks)
    const taskCardWithChevron = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithChevron.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks found');
      return;
    }

    // Get the task title text
    const titleText = await taskCardWithChevron.locator('.task-card__title-text').textContent();
    console.log(`Testing task: "${titleText?.substring(0, 50)}..."`);

    // Hover to reveal chevron
    await taskCardWithChevron.hover();
    await page.waitForTimeout(300);

    // Try to click the chevron
    const chevron = taskCardWithChevron.locator('.task-card__chevron');

    // Check if chevron is clickable (not covered by other elements)
    const isClickable = await chevron.isEnabled().catch(() => false);

    if (!isClickable) {
      console.log('BUG: Chevron is not clickable');
    }

    // Attempt to click and expand
    try {
      await chevron.click({ timeout: 2000 });
      await page.waitForTimeout(500);

      // Check if subtasks are now visible (expanded)
      const isExpanded = await chevron.evaluate((el) => {
        return el.classList.contains('task-card__chevron--expanded');
      });

      console.log(`Chevron expanded state after click: ${isExpanded}`);

      // Click again to collapse
      await chevron.click({ timeout: 2000 });
      await page.waitForTimeout(300);

      expect(isExpanded).toBe(true);
    } catch {
      console.log('BUG REPRODUCED: Could not click chevron - it may be invisible or covered');
      expect.fail('Chevron should be clickable');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #950 - chevron visibility at different container widths', async () => {
    /**
     * This test checks chevron visibility at different viewport/container widths.
     * Narrow containers are more likely to trigger the bug where the chevron
     * gets pushed off-screen.
     */
    const page = app.page;

    // Test with narrow viewport
    await page.setViewportSize({ width: 400, height: 800 });
    await page.waitForTimeout(300);

    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCardWithChevron = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithChevron.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks found');
      return;
    }

    // Hover to reveal chevron
    await taskCardWithChevron.hover();
    await page.waitForTimeout(300);

    const chevron = taskCardWithChevron.locator('.task-card__chevron');
    const chevronBox = await chevron.boundingBox();
    const viewportSize = page.viewportSize();

    if (chevronBox && viewportSize) {
      // Check if chevron is within viewport
      const isInViewport =
        chevronBox.x >= 0 &&
        chevronBox.x + chevronBox.width <= viewportSize.width;

      if (!isInViewport) {
        console.log('BUG REPRODUCED: Chevron is outside viewport at narrow width');
        console.log(`Viewport width: ${viewportSize.width}`);
        console.log(`Chevron x: ${chevronBox.x}, width: ${chevronBox.width}`);
      }

      expect(isInViewport).toBe(true);
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #950 - chevron visible in sidebar/side panel', async () => {
    /**
     * This test checks chevron visibility in the sidebar or side panel
     * where the container width is typically narrower.
     *
     * The side panel often has limited width, making this scenario
     * more likely to trigger the invisible chevron bug.
     */
    const page = app.page;

    // Open task list in side panel (if available)
    await runCommand(page, 'TaskNotes: Open task list in side panel');
    await page.waitForTimeout(1000);

    // Check if side panel opened
    const sidePanel = page.locator('.workspace-leaf-content:has(.tasknotes-plugin)');
    const sidePanelVisible = await sidePanel.isVisible({ timeout: 3000 }).catch(() => false);

    if (!sidePanelVisible) {
      // Try alternative command
      await runCommand(page, 'TaskNotes: Show task list in right sidebar');
      await page.waitForTimeout(1000);
    }

    const taskCardWithChevron = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    }).first();

    if (!await taskCardWithChevron.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards with subtasks found in side panel');
      return;
    }

    // Hover to reveal chevron
    await taskCardWithChevron.hover();
    await page.waitForTimeout(300);

    const chevron = taskCardWithChevron.locator('.task-card__chevron');
    const chevronBox = await chevron.boundingBox();
    const cardBox = await taskCardWithChevron.boundingBox();

    if (chevronBox && cardBox) {
      // In a narrow side panel, check if chevron stays within card bounds
      const isWithinCard =
        chevronBox.x >= cardBox.x &&
        chevronBox.x + chevronBox.width <= cardBox.x + cardBox.width;

      if (!isWithinCard) {
        console.log('BUG REPRODUCED: Chevron overflows card bounds in side panel');
      }

      // Verify chevron has non-zero opacity
      const chevronOpacity = await chevron.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.opacity);
      });

      expect(chevronOpacity).toBeGreaterThan(0);
      expect(isWithinCard).toBe(true);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #950 - title text truncation does not hide chevron', async () => {
    /**
     * This test verifies that when a long title is truncated (via CSS),
     * the chevron remains visible and is not pushed out of view.
     *
     * The expected behavior is that the title should truncate with ellipsis
     * if needed, allowing the chevron to remain visible.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find all task cards with chevrons
    const taskCards = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    });

    const cardCount = await taskCards.count();
    console.log(`Found ${cardCount} task cards with chevrons`);

    let bugsFound = 0;

    // Check up to 5 cards
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = taskCards.nth(i);
      const title = card.locator('.task-card__title-text');
      const chevron = card.locator('.task-card__chevron');

      await card.hover();
      await page.waitForTimeout(200);

      const titleBox = await title.boundingBox();
      const chevronBox = await chevron.boundingBox();
      const cardBox = await card.boundingBox();

      if (titleBox && chevronBox && cardBox) {
        // Check if title overlaps with chevron (would indicate improper layout)
        const titleOverlapsChevron =
          titleBox.x + titleBox.width > chevronBox.x;

        if (titleOverlapsChevron) {
          console.log(`BUG: Title overlaps chevron in card ${i}`);
          bugsFound++;
        }

        // Check if chevron is visible within card
        if (chevronBox.x + chevronBox.width > cardBox.x + cardBox.width) {
          console.log(`BUG: Chevron overflows card bounds in card ${i}`);
          bugsFound++;
        }
      }
    }

    expect(bugsFound).toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #950 - chevron visible with multiline wrapped title', async () => {
    /**
     * This test specifically checks the case where the title wraps to
     * multiple lines. The chevron should remain visible and properly
     * positioned even when the title content spans multiple lines.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find task cards
    const taskCards = page.locator('.task-card').filter({
      has: page.locator('.task-card__chevron'),
    });

    if (await taskCards.count() === 0) {
      console.log('No task cards with chevrons found');
      return;
    }

    // Get the first card
    const card = taskCards.first();
    await card.hover();
    await page.waitForTimeout(200);

    const title = card.locator('.task-card__title');
    const chevron = card.locator('.task-card__chevron');
    const mainRow = card.locator('.task-card__main-row');

    // Check if title is multiline by comparing its height to line-height
    const titleStyle = await title.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        height: el.getBoundingClientRect().height,
        lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4,
      };
    });

    const isMultiline = titleStyle.height > titleStyle.lineHeight * 1.5;
    console.log(`Title is multiline: ${isMultiline}`);
    console.log(`Title height: ${titleStyle.height}, line-height: ${titleStyle.lineHeight}`);

    // Regardless of multiline, chevron should be visible and accessible
    const chevronVisible = await chevron.isVisible();
    const chevronBox = await chevron.boundingBox();
    const mainRowBox = await mainRow.boundingBox();

    if (chevronBox && mainRowBox) {
      // Chevron should be within the main row bounds
      const isWithinMainRow =
        chevronBox.x >= mainRowBox.x &&
        chevronBox.x + chevronBox.width <= mainRowBox.x + mainRowBox.width;

      if (!isWithinMainRow) {
        console.log('BUG REPRODUCED: Chevron is outside main row bounds');
      }

      expect(chevronVisible).toBe(true);
      expect(isWithinMainRow).toBe(true);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
