/**
 * Issue #1047: [FR]: Remove sideways scroll bar for mobile "Edit Task" pop up
 *
 * Bug description:
 * When scrolling down in the "Edit Task" popup on iPhone, if the task name is
 * long enough, a horizontal scrollbar appears. This causes unintended sideways
 * scrolling when scrolling vertically, which is annoying. The issue is particularly
 * noticeable in the "File:" metadata section at the bottom which displays the
 * full file path.
 *
 * Root cause:
 * The `.metadata-value` class (which displays the file path) uses monospace font
 * and has no overflow handling (word-break, overflow-wrap, or max-width). On
 * narrow mobile screens (< 600px), long file paths extend beyond the viewport
 * width, causing horizontal overflow.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1047
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1047: Mobile Edit Task popup horizontal scroll', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1047 - long file path causes horizontal scroll on mobile', async () => {
    /**
     * This test reproduces the horizontal scrollbar issue on mobile devices.
     *
     * The bug manifests when:
     * 1. User opens Edit Task popup on a mobile device (narrow viewport)
     * 2. The task has a long file path (e.g., deeply nested folder structure)
     * 3. The "File:" metadata section at the bottom shows the full path
     * 4. The path overflows horizontally, causing a scrollbar
     *
     * Expected behavior:
     * - The file path should wrap or be truncated to fit within the modal
     * - No horizontal scrollbar should appear on the modal
     * - Vertical scrolling should not cause horizontal movement
     *
     * Potential fixes:
     * 1. Add `word-break: break-all` or `overflow-wrap: anywhere` to .metadata-value
     * 2. Add `max-width: 100%` and `overflow: hidden` to prevent overflow
     * 3. Truncate with ellipsis and show full path on hover/tap
     * 4. Add mobile-specific overflow handling in @media (max-width: 600px)
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

    // Find the metadata section which contains the file path
    const metadataContainer = modal.locator('.metadata-container');
    const metadataValue = modal.locator('.metadata-value');

    if (await metadataValue.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get the metadata value element's dimensions
      const valueBox = await metadataValue.boundingBox();
      const modalBox = await modal.boundingBox();

      if (valueBox && modalBox) {
        // Check if the metadata value extends beyond the modal's right edge
        const valueRightEdge = valueBox.x + valueBox.width;
        const modalRightEdge = modalBox.x + modalBox.width;

        // The bug: metadata value extends beyond modal boundaries
        // This should fail when the file path is too long
        expect(valueRightEdge).toBeLessThanOrEqual(modalRightEdge);
      }
    }

    // Check for horizontal scrollbar on the modal content
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (await modalContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get scroll dimensions
      const { scrollWidth, clientWidth, hasHorizontalScroll } = await modalContent.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasHorizontalScroll: el.scrollWidth > el.clientWidth,
      }));

      console.log(`Modal content - scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);

      // The bug: modal should not have horizontal scroll
      // When fixed, scrollWidth should equal clientWidth (no overflow)
      expect(hasHorizontalScroll).toBe(false);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1047 - metadata-value CSS lacks overflow handling', async () => {
    /**
     * This test verifies the CSS properties of the metadata-value element.
     *
     * Currently, the .metadata-value class has:
     * - font-family: var(--font-monospace) - wider characters, less natural wrapping
     * - No word-break, overflow-wrap, or max-width properties
     *
     * Expected CSS properties for fix:
     * - word-break: break-all or break-word
     * - overflow-wrap: anywhere or break-word
     * - max-width: 100% or calc(100% - 80px) to account for .metadata-key
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list and edit a task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test CSS');
      return;
    }

    await taskCard.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the metadata value element
    const metadataValue = modal.locator('.metadata-value').first();

    if (await metadataValue.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check CSS properties that should handle overflow
      const cssProperties = await metadataValue.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          wordBreak: style.wordBreak,
          overflowWrap: style.overflowWrap,
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
          maxWidth: style.maxWidth,
        };
      });

      console.log('Metadata value CSS:', cssProperties);

      // The fix should include word-break or overflow-wrap to handle long paths
      // Currently these are likely 'normal' which doesn't break long strings
      const hasBreakingBehavior =
        cssProperties.wordBreak === 'break-all' ||
        cssProperties.wordBreak === 'break-word' ||
        cssProperties.overflowWrap === 'anywhere' ||
        cssProperties.overflowWrap === 'break-word';

      // This assertion documents the expected fix
      expect(hasBreakingBehavior).toBe(true);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1047 - scrolling vertically should not scroll horizontally', async () => {
    /**
     * This test verifies that vertical scrolling in the edit modal
     * doesn't cause unintended horizontal movement.
     *
     * The user reported that scrolling down causes the view to also
     * move side to side, which is frustrating on touch devices.
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list and edit a task
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test scrolling');
      return;
    }

    await taskCard.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (await modalContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Record initial scroll position
      const initialScroll = await modalContent.evaluate((el) => ({
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      }));

      // Simulate vertical scroll (touch swipe down)
      await modalContent.evaluate((el) => {
        el.scrollTop += 100; // Scroll down 100px
      });

      await page.waitForTimeout(200);

      // Check that horizontal scroll hasn't changed
      const afterScroll = await modalContent.evaluate((el) => ({
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      }));

      // Horizontal scroll should remain 0 after vertical scrolling
      // If the modal has horizontal overflow, touch scrolling may
      // inadvertently cause horizontal movement
      expect(afterScroll.scrollLeft).toBe(initialScroll.scrollLeft);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1047 - mobile media query should handle metadata overflow', async () => {
    /**
     * This test verifies that the mobile-specific CSS media query
     * includes proper overflow handling for the metadata section.
     *
     * The existing @media (max-width: 600px) query handles:
     * - Modal width (90vw)
     * - Action bar wrapping
     * - Button container layout
     *
     * It should also handle:
     * - Metadata value overflow (word-break, overflow-wrap)
     * - Metadata container max-width constraints
     */
    const page = app.page;

    // Set viewport just under the 600px breakpoint
    await page.setViewportSize({ width: 599, height: 800 });

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

    // Check that the metadata item container constrains its content
    const metadataItem = modal.locator('.metadata-item').first();

    if (await metadataItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      const { itemWidth, containerWidth } = await metadataItem.evaluate((el) => {
        const item = el as HTMLElement;
        const container = item.closest('.metadata-content') || item.parentElement;
        return {
          itemWidth: item.scrollWidth,
          containerWidth: container ? container.clientWidth : 0,
        };
      });

      // The metadata item should not exceed its container width
      expect(itemWidth).toBeLessThanOrEqual(containerWidth);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });
});
