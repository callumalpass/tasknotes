/**
 * Issue #1595: [Bug]: Note modal floating buttons in the way on mobile
 *
 * Bug description:
 * The open note, archive, save, cancel buttons now float and block the rest of
 * the modal on mobile. The buttons appear to overlay the modal content rather
 * than being positioned at the bottom of the modal in a non-obstructing manner.
 *
 * Root cause:
 * The button container styles for mobile may be using fixed/sticky positioning
 * or absolute positioning that causes the buttons to float over content.
 * Looking at task-modal.css, the expanded modal uses flex layout with
 * `.modal-button-container` having `flex-shrink: 0` and pinned positioning,
 * but on mobile viewports (< 600px) the buttons switch to full-width stacked
 * layout which may not account for proper spacing with the modal content.
 *
 * The issue likely stems from:
 * 1. Button container using positioning that overlays scrollable content
 * 2. Missing padding-bottom on modal content to account for button height
 * 3. Flex layout not properly allocating space between content and buttons
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1595
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1595: Mobile modal floating buttons blocking content', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1595 - buttons overlap modal content on mobile', async () => {
    /**
     * This test reproduces the floating button issue on mobile devices.
     *
     * The bug manifests when:
     * 1. User opens a task edit modal on mobile (narrow viewport)
     * 2. The "Open note", "Archive", "Save", and "Cancel" buttons float
     * 3. These buttons block/overlay the modal content instead of being
     *    properly positioned at the bottom
     *
     * Expected behavior:
     * - Buttons should be at the bottom of the modal
     * - Modal content should be fully visible and scrollable above the buttons
     * - No overlap between buttons and form content
     *
     * Potential fixes:
     * 1. Ensure button container has proper position relative to modal content
     * 2. Add padding-bottom to modal content equal to button container height
     * 3. Use flex layout where content gets flex: 1 and buttons get flex-shrink: 0
     * 4. Ensure overflow-y: auto on content area stops before buttons
     */
    const page = app.page;

    // Set viewport to mobile size (iPhone dimensions)
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card to edit
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test edit modal');
      return;
    }

    // Click to open the edit modal
    await taskCard.click();
    await page.waitForTimeout(500);

    // Wait for the task edit modal to appear
    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the button container and modal content areas
    const buttonContainer = modal.locator('.modal-button-container');
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (!await buttonContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Button container not visible');
      return;
    }

    // Get bounding boxes of button container and modal content
    const buttonBox = await buttonContainer.boundingBox();
    const modalBox = await modal.boundingBox();

    if (buttonBox && modalBox) {
      // The button container should be at the bottom of the modal,
      // not floating over the middle of the content
      const buttonTopRelativeToModal = buttonBox.y - modalBox.y;
      const modalContentHeight = modalBox.height;

      // Buttons should be in the bottom portion of the modal (last ~20%)
      const expectedButtonPosition = modalContentHeight * 0.8;

      console.log(`Button top position: ${buttonTopRelativeToModal}, Modal height: ${modalContentHeight}`);

      // This will fail if buttons are floating in the middle
      expect(buttonTopRelativeToModal).toBeGreaterThan(expectedButtonPosition);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1595 - form fields obscured by floating buttons', async () => {
    /**
     * This test verifies that form fields in the modal are not obscured
     * by the floating button container.
     *
     * When the bug occurs, users cannot see or interact with form fields
     * at the bottom of the modal because the buttons overlay them.
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list and edit a task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    await taskCard.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the button container
    const buttonContainer = modal.locator('.modal-button-container');
    const buttonBox = await buttonContainer.boundingBox();

    // Find form elements that might be obscured
    const formElements = modal.locator('.details-container, .action-bar, .title-input-container');

    for (let i = 0; i < await formElements.count(); i++) {
      const element = formElements.nth(i);
      if (await element.isVisible().catch(() => false)) {
        const elementBox = await element.boundingBox();

        if (elementBox && buttonBox) {
          // Check if any form element overlaps with the button container
          const overlapsVertically =
            elementBox.y < buttonBox.y + buttonBox.height &&
            elementBox.y + elementBox.height > buttonBox.y;

          const overlapsHorizontally =
            elementBox.x < buttonBox.x + buttonBox.width &&
            elementBox.x + elementBox.width > buttonBox.x;

          // Form elements should not overlap with buttons
          if (overlapsVertically && overlapsHorizontally) {
            console.log(`Form element ${i} overlaps with button container`);
          }

          // This assertion documents that form elements should not be overlapped
          expect(overlapsVertically && overlapsHorizontally).toBe(false);
        }
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1595 - button container CSS has proper mobile layout', async () => {
    /**
     * This test verifies the CSS properties of the button container
     * to ensure it's properly laid out on mobile.
     *
     * Expected CSS for proper layout:
     * - position: relative (not fixed/absolute/sticky)
     * - No negative margins that push into content area
     * - Proper flex-shrink: 0 to maintain size
     * - Clear separation from scrollable content
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list and edit a task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    await taskCard.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check button container CSS properties
    const buttonContainer = modal.locator('.modal-button-container');

    if (await buttonContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      const cssProperties = await buttonContainer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          top: style.top,
          bottom: style.bottom,
          left: style.left,
          right: style.right,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
          flexShrink: style.flexShrink,
          zIndex: style.zIndex,
        };
      });

      console.log('Button container CSS:', cssProperties);

      // Button container should not use fixed or sticky positioning
      // that would cause it to float over content
      expect(cssProperties.position).not.toBe('fixed');
      expect(cssProperties.position).not.toBe('sticky');

      // If using absolute positioning, it could be the cause of the issue
      if (cssProperties.position === 'absolute') {
        console.log('WARNING: Button container uses absolute positioning');
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1595 - modal content scrollable without button interference', async () => {
    /**
     * This test verifies that the modal content is fully scrollable
     * and the buttons don't interfere with scrolling or visibility.
     *
     * When the bug occurs:
     * - Scrolling reveals content that was hidden behind buttons
     * - The last items in the form are obscured until scrolled
     * - Users have to scroll to see all form fields
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list and edit a task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    await taskCard.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the scrollable content area
    const scrollableContent = modal.locator('.modal-split-content, .modal-content');

    if (await scrollableContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get scroll dimensions
      const scrollInfo = await scrollableContent.evaluate((el) => {
        return {
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          hasVerticalScroll: el.scrollHeight > el.clientHeight,
        };
      });

      console.log('Scroll info:', scrollInfo);

      // If there's scrollable content, verify that scrolling to the bottom
      // doesn't leave content hidden behind buttons
      if (scrollInfo.hasVerticalScroll) {
        // Scroll to bottom
        await scrollableContent.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });

        await page.waitForTimeout(200);

        // Get the button container and last form element positions
        const buttonContainer = modal.locator('.modal-button-container');
        const lastFormElement = modal.locator('.details-container > *:last-child, .metadata-container');

        const buttonBox = await buttonContainer.boundingBox();
        const lastElementBox = await lastFormElement.first().boundingBox().catch(() => null);

        if (buttonBox && lastElementBox) {
          // The last form element should be visible above the buttons
          const lastElementBottom = lastElementBox.y + lastElementBox.height;
          const buttonsTop = buttonBox.y;

          // Last element should end before buttons start
          expect(lastElementBottom).toBeLessThanOrEqual(buttonsTop);
        }
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
  });
});
