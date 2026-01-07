/**
 * Issue #1023: [Bug]: Keyboard blocks custom field when creating tasks on iPhone
 *
 * Bug description:
 * When creating a task on iPhone and using custom fields (like "Details"),
 * the keyboard blocks the view of what the user is typing. The user cannot
 * scroll up to see the text, and clicking anywhere in the custom field
 * causes the keyboard to block it, preventing cursor placement within the text.
 *
 * Root cause hypothesis:
 * On iOS, when the virtual keyboard appears, it reduces the viewport height.
 * The modal content does not properly scroll to keep the focused input visible
 * above the keyboard. This is a common iOS webview issue where:
 * 1. The modal uses fixed/absolute positioning that doesn't account for keyboard
 * 2. scrollIntoView or similar mechanisms aren't being used when inputs focus
 * 3. The modal container's overflow/scroll behavior doesn't adapt to keyboard presence
 * 4. CSS viewport units (vh) don't account for the iOS keyboard
 *
 * Related issues:
 * - #1024: iPhone time picker immediately closes (iOS input focus issues)
 * - #1035: iPhone title click scroll jump (iOS scroll/focus behavior)
 * - #1025: iPhone disappearing subtasks (mobile rendering issues)
 *
 * Affected code:
 * - src/modals/TaskModal.ts - Custom field creation (lines 1026-1092, 1094-1180)
 * - src/modals/TaskCreationModal.ts - Task creation modal
 * - styles/task-modal.css - Modal styling and responsive design
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1023
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1023: iPhone keyboard blocks custom field input', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1023 - keyboard blocks custom field when typing on iPhone', async () => {
    /**
     * This test reproduces the keyboard blocking issue when editing
     * custom fields in the task creation modal on iPhone.
     *
     * Steps to reproduce:
     * 1. Open task creation modal on iPhone
     * 2. Scroll down to a custom field (like "Details")
     * 3. Tap the custom field to enter text
     * 4. The keyboard appears and blocks the input field
     * 5. User cannot see what they're typing
     * 6. User cannot scroll up to see the input while keyboard is open
     *
     * Expected behavior:
     * - When a custom field receives focus, the modal should scroll
     *   to keep the input visible above the keyboard
     * - User should be able to see their input while typing
     * - User should be able to scroll within the modal while keyboard is open
     */
    const page = app.page;

    // Set viewport to iPhone dimensions
    const iPhoneViewport = {
      width: 390,  // iPhone 14 width
      height: 844, // iPhone 14 height
    };
    await page.setViewportSize(iPhoneViewport);

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    // Wait for task modal to appear
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Look for custom fields section - they appear under "Custom Fields" label
    // Custom fields are created as Setting components with text/number/date inputs
    const customFieldInput = modal.locator('.setting-item input[type="text"], .setting-item textarea').first();

    // If no custom fields are configured, look for the details editor instead
    // which behaves similarly
    let targetInput = customFieldInput;
    if (!await customFieldInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try the details/description editor
      const detailsEditor = modal.locator('.details-editor, .markdown-editor, [contenteditable="true"]').first();
      if (await detailsEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
        targetInput = detailsEditor;
      } else {
        console.log('No custom fields or details editor found in modal');
        await page.keyboard.press('Escape');
        return;
      }
    }

    // Get the modal content container (the scrollable area)
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    // Ensure we can find the scrollable container
    if (!await modalContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Modal content container not found');
      await page.keyboard.press('Escape');
      return;
    }

    // Get the input's position before focusing
    const inputBox = await targetInput.boundingBox();
    if (!inputBox) {
      console.log('Could not get input bounding box');
      await page.keyboard.press('Escape');
      return;
    }

    // Record the input's initial position relative to viewport
    const inputInitialY = inputBox.y;

    // Simulate iPhone keyboard appearing by reducing viewport
    // iPhone keyboard is typically ~300px tall
    const keyboardHeight = 300;
    const viewportWithKeyboard = {
      width: iPhoneViewport.width,
      height: iPhoneViewport.height - keyboardHeight,
    };

    // Tap on the input to focus it (this would trigger keyboard on real device)
    await targetInput.tap();
    await page.waitForTimeout(300);

    // Simulate keyboard appearing by reducing viewport
    await page.setViewportSize(viewportWithKeyboard);
    await page.waitForTimeout(300);

    // Get the input's position after "keyboard" appeared
    const inputBoxAfterKeyboard = await targetInput.boundingBox();

    if (!inputBoxAfterKeyboard) {
      console.log('Could not get input bounding box after keyboard');
      await page.keyboard.press('Escape');
      return;
    }

    // Check if the input is still visible above the "keyboard"
    // The input's bottom edge should be above the keyboard (within the reduced viewport)
    const inputBottom = inputBoxAfterKeyboard.y + inputBoxAfterKeyboard.height;
    const visibleAreaBottom = viewportWithKeyboard.height;

    console.log(`Input bottom: ${inputBottom}, Visible area bottom: ${visibleAreaBottom}`);

    // The bug: input is below the visible area (blocked by keyboard)
    // When fixed: input should be scrolled into view above the keyboard
    const inputIsVisible = inputBottom <= visibleAreaBottom;

    expect(inputIsVisible).toBe(true);

    // Reset viewport
    await page.setViewportSize(iPhoneViewport);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1023 - cannot scroll to see custom field with keyboard open', async () => {
    /**
     * This test verifies that the modal can be scrolled while the keyboard
     * is open, allowing the user to see the custom field they're editing.
     *
     * The bug is that on iPhone, the modal content cannot be scrolled up
     * to reveal the text being typed in a custom field while the keyboard
     * is blocking it.
     */
    const page = app.page;

    // Set iPhone viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Get the modal content container
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (!await modalContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Modal content not found');
      await page.keyboard.press('Escape');
      return;
    }

    // Check if the modal content is scrollable
    const scrollInfo = await modalContent.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      overflow: window.getComputedStyle(el).overflow,
      overflowY: window.getComputedStyle(el).overflowY,
    }));

    console.log('Scroll info:', scrollInfo);

    // Try to scroll the modal content
    const initialScrollTop = scrollInfo.scrollTop;

    // Scroll down
    await modalContent.evaluate((el) => {
      el.scrollTop = el.scrollTop + 100;
    });
    await page.waitForTimeout(100);

    const newScrollTop = await modalContent.evaluate((el) => el.scrollTop);

    // Verify scrolling works
    const canScroll = scrollInfo.scrollHeight > scrollInfo.clientHeight;
    const didScroll = newScrollTop !== initialScrollTop;

    console.log(`Can scroll: ${canScroll}, Did scroll: ${didScroll}`);

    // The modal content should be scrollable
    // If scrollHeight <= clientHeight, there's not enough content to scroll
    // but the important thing is that scroll is not blocked
    if (canScroll) {
      expect(didScroll).toBe(true);
    }

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1023 - custom field input should use scrollIntoView on focus', async () => {
    /**
     * This test checks whether custom field inputs properly scroll into view
     * when focused, which is essential for iOS keyboard behavior.
     *
     * The fix should ensure that when a custom field receives focus,
     * scrollIntoView({ block: 'center', behavior: 'smooth' }) or similar
     * is called to keep the input visible above the keyboard.
     */
    const page = app.page;

    // Set iPhone viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find any text input in the modal (could be title, custom field, etc.)
    const textInput = modal.locator('input[type="text"]').first();

    if (!await textInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('No text input found');
      await page.keyboard.press('Escape');
      return;
    }

    // Get the modal scroll container
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    // Scroll the modal down so the input is at the bottom
    await modalContent.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);

    const scrollBeforeFocus = await modalContent.evaluate((el) => el.scrollTop);

    // Focus the input (which should trigger scrollIntoView)
    await textInput.focus();
    await page.waitForTimeout(300);

    const scrollAfterFocus = await modalContent.evaluate((el) => el.scrollTop);

    // Get input position in viewport
    const inputBox = await textInput.boundingBox();

    if (!inputBox) {
      console.log('Could not get input bounding box');
      await page.keyboard.press('Escape');
      return;
    }

    // The input should be visible in the viewport
    // On a 844px tall iPhone, with ~300px keyboard, visible area is ~544px
    // Input should be in the upper portion of this area
    const maxVisibleY = 544; // Approximate visible area with keyboard

    console.log(`Input Y: ${inputBox.y}, Scroll before: ${scrollBeforeFocus}, Scroll after: ${scrollAfterFocus}`);

    // When the fix is applied, the modal should scroll to bring the input into view
    // The input should be well above where the keyboard would appear
    expect(inputBox.y).toBeLessThan(maxVisibleY);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1023 - touch on custom field to position cursor is blocked', async () => {
    /**
     * This test reproduces the issue where the user cannot position
     * their cursor within a custom field because the keyboard blocks
     * the field, and tapping anywhere in the field doesn't work properly.
     *
     * Steps to reproduce:
     * 1. Enter text in a custom field
     * 2. Try to tap within the text to position cursor
     * 3. The keyboard blocks the field, preventing cursor positioning
     */
    const page = app.page;

    // Set iPhone viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find a text input
    const textInput = modal.locator('input[type="text"]').first();

    if (!await textInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('No text input found');
      await page.keyboard.press('Escape');
      return;
    }

    // Focus and type some text
    await textInput.tap();
    await page.waitForTimeout(200);
    await textInput.fill('This is a test text for cursor positioning');
    await page.waitForTimeout(200);

    // Simulate keyboard reducing viewport
    await page.setViewportSize({ width: 390, height: 544 });
    await page.waitForTimeout(200);

    // Get the input's bounding box
    const inputBox = await textInput.boundingBox();

    if (!inputBox) {
      console.log('Input not visible after keyboard simulation');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.keyboard.press('Escape');
      return;
    }

    // Check if input is in visible area
    const inputVisible = inputBox.y >= 0 && inputBox.y + inputBox.height <= 544;

    console.log(`Input box: y=${inputBox.y}, height=${inputBox.height}, visible=${inputVisible}`);

    // The bug: input is not visible when keyboard is open
    // When fixed: input should remain visible and interactable
    expect(inputVisible).toBe(true);

    // Try to tap on the input to position cursor
    if (inputVisible) {
      const tapX = inputBox.x + inputBox.width / 4; // Tap near start of text
      const tapY = inputBox.y + inputBox.height / 2;

      await page.touchscreen.tap(tapX, tapY);
      await page.waitForTimeout(200);

      // Verify input is still focused
      const isFocused = await textInput.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);
    }

    // Reset viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Close modal
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1023 - modal CSS viewport units with iOS keyboard', async () => {
    /**
     * This test checks if the modal CSS uses viewport units (vh) that
     * don't account for the iOS keyboard, causing layout issues.
     *
     * On iOS Safari, 100vh includes the area behind the keyboard,
     * so elements sized with vh may extend behind the keyboard.
     * The fix should use dvh (dynamic viewport height) or
     * CSS env(keyboard-inset-height) where supported.
     */
    const page = app.page;

    // Set iPhone viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open task creation modal
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Get modal content styles
    const modalContent = modal.locator('.modal-content, .minimalist-modal-container');

    if (!await modalContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Modal content not found');
      await page.keyboard.press('Escape');
      return;
    }

    const styles = await modalContent.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        height: computed.height,
        maxHeight: computed.maxHeight,
        minHeight: computed.minHeight,
        overflow: computed.overflow,
        overflowY: computed.overflowY,
        position: computed.position,
      };
    });

    console.log('Modal content styles:', styles);

    // Check for vh units in max-height (which would be problematic on iOS)
    // The fix should use auto, or a pixel value, or dvh units
    const usesVhUnits = styles.maxHeight.includes('vh') || styles.height.includes('vh');

    // Log for debugging
    console.log(`Uses vh units: ${usesVhUnits}`);

    // Ideally, the modal should use overflow-y: auto and not rely on vh
    // for height calculations that could be affected by keyboard
    expect(styles.overflowY === 'auto' || styles.overflow === 'auto').toBe(true);

    // Close modal
    await page.keyboard.press('Escape');
  });
});
