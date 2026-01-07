/**
 * Issue #706: [FR] Allow for easier time input for the Pomodoro timer
 *
 * Feature request to improve time input for the Pomodoro timer. Currently, users
 * must either change settings or click increment/decrement buttons minute by minute
 * (25 clicks to change from 25 to 50 minutes). Additionally, times above 59 minutes
 * don't show an hours column.
 *
 * Current state:
 * - Timer display shows MM:SS format
 * - Time adjustment via +/- buttons (60 seconds per click)
 * - Settings allow configuring default durations (1-120 minutes)
 * - No way to directly edit the timer display
 * - No hour column when minutes exceed 59 (shows 60:00, 61:00, etc.)
 *
 * Requested behavior:
 * - Allow direct editing of timer display when not counting down
 * - Support numeric input for hours, minutes, and seconds
 * - Optional: Scroll wheel adjustment when hovering over time columns
 * - Optional: Context-sensitive hour column (show when needed)
 *
 * Use cases:
 * - Quick adjustment to arbitrary durations without multiple clicks
 * - Setting timers under 1 minute for speed challenges
 * - Using the timer as a general purpose timer, not just Pomodoro
 * - Mobile users who want to type instead of increment/decrement
 *
 * Implementation considerations:
 * - Timer display should become editable when paused/stopped
 * - Input validation for numeric values only
 * - Format parsing: support "10", "10:00", "1:30:00" etc.
 * - Update PomodoroView.ts timer display to be an input/contenteditable
 * - Persist custom duration appropriately
 * - Consider UX for transitioning between display and edit modes
 *
 * Affected areas:
 * - src/views/PomodoroView.ts (timer display, time input handling)
 * - src/services/PomodoroService.ts (support arbitrary durations)
 * - styles/pomodoro-view.css (editable timer styling)
 * - src/settings.ts (possibly new settings for hour display preference)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/706
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand, updateSettings } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #706: Easier time input for Pomodoro timer', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #706 - timer display should be editable when not running', async () => {
    /**
     * The timer display should allow direct text editing when the timer is not
     * actively counting down (i.e., when paused or stopped).
     *
     * Expected behavior:
     * - Timer display is clickable when not running
     * - Clicking transforms display into an editable input
     * - User can type a custom time value
     * - Value is accepted on blur or Enter key
     *
     * Current behavior:
     * - Timer display is read-only
     * - No way to directly edit the time
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const pomodoroView = page.locator('.pomodoro-view');
    await expect(pomodoroView).toBeVisible({ timeout: 5000 });

    // Get the timer display element
    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    // Verify timer is not running (start button should be visible)
    const startButton = page.locator('.pomodoro-view__start-button');
    await expect(startButton).toBeVisible();

    // Try to click on the timer display to edit it
    await timerDisplay.click();

    // Check if timer becomes editable (input field or contenteditable)
    // Currently this will fail because the feature doesn't exist
    const isEditable = await timerDisplay.getAttribute('contenteditable');
    const inputField = page.locator('.pomodoro-view__timer-input');
    const hasInputField = await inputField.isVisible({ timeout: 500 }).catch(() => false);

    console.log(`Timer contenteditable: ${isEditable}`);
    console.log(`Timer input field present: ${hasInputField}`);
    console.log('Feature request: Timer display should be editable when clicked (while not running)');

    // After implementation, uncomment:
    // expect(isEditable === 'true' || hasInputField).toBe(true);
  });

  test.fixme('reproduces issue #706 - should accept direct numeric input for custom time', async () => {
    /**
     * When the timer display is in edit mode, it should accept numeric input
     * and parse various time formats.
     *
     * Expected behavior:
     * - Input "10" → 10:00 (10 minutes)
     * - Input "10:30" → 10:30 (10 minutes 30 seconds)
     * - Input "1:30:00" → 1:30:00 (1 hour 30 minutes)
     * - Only numeric characters and colons allowed
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    // Attempt to input a custom time
    await timerDisplay.click();

    // Try typing a custom time value
    // This documents the expected behavior after implementation
    console.log('Expected: Typing "10" should set timer to 10:00');
    console.log('Expected: Typing "10:30" should set timer to 10:30');
    console.log('Expected: Typing "1:30:00" should set timer to 1 hour 30 minutes');

    // After implementation:
    // await timerDisplay.fill('10');
    // await timerDisplay.press('Enter');
    // const displayText = await timerDisplay.textContent();
    // expect(displayText).toBe('10:00');
  });

  test.fixme('reproduces issue #706 - should not allow editing while timer is running', async () => {
    /**
     * The timer display should NOT be editable while actively counting down.
     * This prevents accidental changes during a session.
     *
     * Expected behavior:
     * - Timer is running (counting down)
     * - Clicking on timer display does nothing
     * - Timer remains in display mode (not editable)
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    // Start a pomodoro session
    const startButton = page.locator('.pomodoro-view__start-button');
    await expect(startButton).toBeVisible();
    await startButton.click();
    await page.waitForTimeout(1000);

    // Timer should now be running
    const timerDisplay = page.locator('.pomodoro-view__timer-display');

    // Try to click/edit the timer while running
    await timerDisplay.click();

    // Verify timer is NOT editable
    const isEditable = await timerDisplay.getAttribute('contenteditable');
    const inputField = page.locator('.pomodoro-view__timer-input');
    const hasInputField = await inputField.isVisible({ timeout: 500 }).catch(() => false);

    console.log('Timer should NOT be editable while running');
    console.log(`Timer contenteditable: ${isEditable}`);
    console.log(`Timer input field present: ${hasInputField}`);

    // Stop the timer to clean up
    const stopButton = page.locator('.pomodoro-view__stop-button');
    if (await stopButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await stopButton.click();
    }

    // After implementation:
    // expect(isEditable !== 'true' && !hasInputField).toBe(true);
  });

  test.fixme('reproduces issue #706 - should display hours column when time exceeds 59 minutes', async () => {
    /**
     * When the timer duration exceeds 59 minutes, an hours column should be displayed
     * instead of showing "60:00", "61:00", etc.
     *
     * Expected behavior:
     * - 59:59 displays as "59:59"
     * - 60:00 displays as "1:00:00" (HH:MM:SS)
     * - 90:00 displays as "1:30:00"
     *
     * Current behavior:
     * - Timer shows "60:00", "61:00" which requires extra cognitive load
     */
    const page = app.page;

    // Set a long work duration in settings
    await updateSettings(page, {
      pomodoroWorkDuration: 90, // 90 minutes = 1 hour 30 minutes
    });

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    const displayText = await timerDisplay.textContent();
    console.log(`Timer display for 90 minutes: "${displayText}"`);
    console.log('Expected: "1:30:00" (HH:MM:SS format)');
    console.log('Current: Likely shows "90:00" (no hours column)');

    // After implementation:
    // expect(displayText).toBe('1:30:00');

    // Reset settings
    await updateSettings(page, {
      pomodoroWorkDuration: 25,
    });
  });

  test.fixme('reproduces issue #706 - should allow setting sub-minute durations', async () => {
    /**
     * Users want to set timers under 1 minute for speed challenges
     * (e.g., answering flashcards in 45 seconds).
     *
     * Expected behavior:
     * - Able to set timer to values like 0:45 (45 seconds)
     * - Timer correctly counts down from sub-minute durations
     * - Session is tracked properly even for very short durations
     *
     * Current behavior:
     * - Settings allow minimum 1 minute
     * - Cannot set times under 1 minute via UI
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    // Try to set a sub-minute duration
    console.log('Feature request: Allow setting timer to sub-minute values (e.g., 0:45)');
    console.log('Use case: Speed challenges like answering flashcards under 45 seconds');
    console.log('Current limitation: Minimum is 1 minute in settings');

    // After implementation:
    // await timerDisplay.click();
    // await timerDisplay.fill('0:45');
    // await timerDisplay.press('Enter');
    // const displayText = await timerDisplay.textContent();
    // expect(displayText).toBe('0:45');
  });

  test.fixme('reproduces issue #706 - scroll wheel should adjust time when hovering', async () => {
    /**
     * Optional feature: Scroll wheel over time columns adjusts the value.
     *
     * Expected behavior (nice to have):
     * - Hover over minutes column
     * - Scroll up → increase minutes
     * - Scroll down → decrease minutes
     * - Same for hours and seconds columns
     * - This could replace or supplement +/- buttons
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    const initialText = await timerDisplay.textContent();
    console.log(`Initial timer: ${initialText}`);

    // Attempt scroll wheel adjustment
    await timerDisplay.hover();
    await page.mouse.wheel(0, -100); // Scroll up

    const afterScrollText = await timerDisplay.textContent();
    console.log(`After scroll up: ${afterScrollText}`);
    console.log('Optional feature: Scroll wheel over timer to adjust time');
    console.log('This would make +/- buttons potentially obsolete');

    // After implementation:
    // expect(afterScrollText).not.toBe(initialText);
  });

  test.fixme('reproduces issue #706 - excessive clicks required to change duration', async () => {
    /**
     * Documents the current pain point: changing from 25 to 50 minutes
     * requires 25 clicks on the increment button.
     *
     * This test demonstrates the current UX issue that the feature request
     * aims to solve.
     */
    const page = app.page;

    // Reset to default settings
    await updateSettings(page, {
      pomodoroWorkDuration: 25,
    });

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    const initialText = await timerDisplay.textContent();
    console.log(`Initial timer: ${initialText}`);

    // Count clicks needed to get to 50 minutes
    const addTimeButton = page.locator('.pomodoro-view__add-time');
    let clickCount = 0;

    // This demonstrates the pain point - we'd need 25 clicks to go from 25 to 50 minutes
    // We'll just click a few times to demonstrate
    for (let i = 0; i < 3; i++) {
      await addTimeButton.click();
      clickCount++;
    }

    const afterClicksText = await timerDisplay.textContent();
    console.log(`After ${clickCount} clicks: ${afterClicksText}`);
    console.log('Pain point: Would need 25 clicks to change from 25:00 to 50:00');
    console.log('Feature request: Allow direct input to type "50" instead');
  });

  test.fixme('reproduces issue #706 - input validation should restrict to numeric and colon only', async () => {
    /**
     * When editing the timer, input should be restricted to valid time characters.
     *
     * Expected behavior:
     * - Only allow digits 0-9 and colon ":"
     * - Reject alphabetic characters
     * - Reject special characters
     * - Handle paste validation
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const timerDisplay = page.locator('.pomodoro-view__timer-display');
    await expect(timerDisplay).toBeVisible();

    console.log('Input validation requirements:');
    console.log('- Only numeric characters (0-9) and colon (:) allowed');
    console.log('- Invalid input should be rejected or filtered');
    console.log('- Examples: "abc" → rejected, "25:00" → accepted, "25:ab" → filtered to "25:"');

    // After implementation:
    // await timerDisplay.click();
    // await timerDisplay.type('abc25:00xyz');
    // const value = await timerDisplay.inputValue();
    // expect(value).toBe('25:00'); // Only valid characters kept
  });
});
