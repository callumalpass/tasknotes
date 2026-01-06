/**
 * Issue #1035: [Bug]: Clicking the title causes a jump to the bottom of the page on iPhone
 *
 * Bug description:
 * When clicking the title of a TaskNote in the TaskNote window on iPhone,
 * it automatically jumps to the bottom of the page, forcing the user to
 * scroll back up. This interrupts workflow and makes working with tasks
 * more difficult.
 *
 * Root cause hypothesis:
 * On iOS/mobile browsers, when an HTML input element receives focus, the browser
 * may automatically scroll to bring the input into view. If the modal's content
 * structure or the focusTitleInput() method (src/modals/TaskModal.ts:1680-1685)
 * triggers focus in a way that confuses the mobile browser's scroll calculation,
 * it could cause unexpected scroll behavior.
 *
 * The issue likely stems from:
 * 1. The title input's focus() + select() combination on mobile
 * 2. iOS Safari's aggressive scroll-to-input behavior
 * 3. Potential viewport height calculation issues with the modal
 * 4. The setTimeout delay (100ms) in focusTitleInput() might cause timing issues
 *
 * Related code:
 * - src/modals/TaskModal.ts:585-598 - Title input creation
 * - src/modals/TaskModal.ts:1680-1685 - focusTitleInput() method
 * - src/modals/TaskEditModal.ts:256 - Calls focusTitleInput() on modal open
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1035
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1035: iPhone title click causes scroll jump', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1035 - clicking title input causes page to scroll to bottom on mobile', async () => {
    /**
     * This test reproduces the scroll jump issue when clicking the title
     * in a TaskNote edit modal on iPhone.
     *
     * Steps to reproduce:
     * 1. Open TaskNote edit modal on mobile device
     * 2. Click on the title input field
     * 3. Observe: page jumps to the bottom
     *
     * Expected behavior:
     * - Clicking title should focus the input without scrolling
     * - The modal content should remain at the top/current position
     *
     * Potential fixes:
     * 1. Use preventScroll option when focusing: this.titleInput.focus({ preventScroll: true })
     * 2. Store scroll position before focus and restore it after
     * 3. Add scrollIntoView with { block: 'nearest' } after focus
     * 4. Use requestAnimationFrame to batch focus and scroll reset
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card to edit
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible - cannot test title click behavior');
      return;
    }

    // Click to open the edit modal
    await taskCard.click();
    await page.waitForTimeout(500);

    // Wait for the task edit modal to appear
    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the title input
    const titleInput = modal.locator('.title-input, input.title-input');
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    // Get the modal content container that scrolls
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (!await modalContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Modal content container not found');
      return;
    }

    // Record initial scroll position of the modal
    const initialScroll = await modalContent.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    console.log('Initial scroll state:', initialScroll);

    // Click on the title input (simulating user clicking to edit title)
    await titleInput.click();
    await page.waitForTimeout(300);

    // Record scroll position after clicking title
    const afterClickScroll = await modalContent.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    console.log('After click scroll state:', afterClickScroll);

    // The bug: clicking title causes modal to scroll to bottom
    // The scroll position should remain near the top (where the title is)
    // A jump to the bottom would show scrollTop ≈ scrollHeight - clientHeight

    const scrolledToBottom =
      afterClickScroll.scrollTop > initialScroll.scrollTop + 100 ||
      afterClickScroll.scrollTop >= afterClickScroll.scrollHeight - afterClickScroll.clientHeight - 50;

    // This should NOT be true - clicking title shouldn't scroll to bottom
    expect(scrolledToBottom).toBe(false);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1035 - title input focus does not use preventScroll', async () => {
    /**
     * This test verifies that the title input focus mechanism properly
     * uses preventScroll to avoid mobile browser scroll behavior.
     *
     * The focusTitleInput() method in TaskModal.ts currently does:
     * setTimeout(() => {
     *   this.titleInput.focus();
     *   this.titleInput.select();
     * }, 100);
     *
     * On iOS, this can cause unwanted scrolling. The fix should use:
     * this.titleInput.focus({ preventScroll: true });
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    // Click to open the edit modal
    await taskCard.click();
    await page.waitForTimeout(500);

    // Wait for modal
    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the title input
    const titleInput = modal.locator('.title-input, input.title-input');

    if (!await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Title input not visible');
      return;
    }

    // First, blur the title (it may already be focused from modal open)
    await titleInput.blur();
    await page.waitForTimeout(200);

    // Get modal content scroll container
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    // Ensure we're scrolled to top
    await modalContent.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(100);

    // Now manually focus the title input
    await titleInput.focus();
    await page.waitForTimeout(300);

    // Check scroll position
    const scrollAfterFocus = await modalContent.evaluate((el) => el.scrollTop);

    // On mobile, without preventScroll, the browser may scroll
    // When fixed, focus should not change scroll position
    expect(scrollAfterFocus).toBe(0);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1035 - modal scroll position preserved after title interactions', async () => {
    /**
     * This test verifies that interacting with the title input
     * preserves the modal's scroll position.
     *
     * This is particularly important on iOS where keyboard interactions
     * can cause viewport shifts.
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    // Click to open the edit modal
    await taskCard.click();
    await page.waitForTimeout(500);

    // Wait for modal
    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('.title-input, input.title-input');
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    // First, ensure the modal content is scrolled to the top
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (await modalContent.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Scroll to top and record position
      await modalContent.evaluate((el) => {
        el.scrollTop = 0;
      });

      await page.waitForTimeout(100);
      const beforeInteraction = await modalContent.evaluate((el) => el.scrollTop);

      // Click title
      await titleInput.click();
      await page.waitForTimeout(200);

      // Type something
      await titleInput.type('test');
      await page.waitForTimeout(200);

      // Click outside title (blur)
      await modal.click({ position: { x: 10, y: 200 } });
      await page.waitForTimeout(200);

      // Click title again
      await titleInput.click();
      await page.waitForTimeout(200);

      // Check scroll position hasn't changed significantly
      const afterInteraction = await modalContent.evaluate((el) => el.scrollTop);

      console.log(`Scroll position - before: ${beforeInteraction}, after: ${afterInteraction}`);

      // The difference should be minimal (within some tolerance for minor adjustments)
      const scrollDifference = Math.abs(afterInteraction - beforeInteraction);
      expect(scrollDifference).toBeLessThan(50);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1035 - touch interaction on title input causes scroll jump', async () => {
    /**
     * This test simulates touch interaction specifically, which may
     * trigger different behavior than mouse clicks on mobile.
     *
     * iOS touch events and their effect on focus/scroll can differ
     * from desktop mouse events.
     */
    const page = app.page;

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task list view
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1000);

    // Find a task card
    const taskCard = page.locator('.task-card').first();

    if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No task cards visible');
      return;
    }

    // Click to open the edit modal
    await taskCard.click();
    await page.waitForTimeout(500);

    // Wait for modal
    const modal = page.locator('.modal.mod-tasknotes, .minimalist-task-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('.title-input, input.title-input');
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    // Get title input position
    const titleBox = await titleInput.boundingBox();

    if (!titleBox) {
      console.log('Could not get title input bounding box');
      return;
    }

    // Get modal scroll container
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (!await modalContent.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Modal content not visible');
      return;
    }

    // Ensure scrolled to top
    await modalContent.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(100);

    const scrollBefore = await modalContent.evaluate((el) => el.scrollTop);

    // Simulate touch event on title input
    const touchX = titleBox.x + titleBox.width / 2;
    const touchY = titleBox.y + titleBox.height / 2;

    await page.touchscreen.tap(touchX, touchY);
    await page.waitForTimeout(500);

    const scrollAfter = await modalContent.evaluate((el) => el.scrollTop);

    console.log(`Touch scroll - before: ${scrollBefore}, after: ${scrollAfter}`);

    // Touch on title should not cause significant scroll
    const scrollJump = scrollAfter - scrollBefore;
    expect(scrollJump).toBeLessThan(50);

    // Close modal
    await page.keyboard.press('Escape');
  });
});
