/**
 * Issue #1160: [FR] Countdown Timer View
 *
 * Feature request for a dedicated countdown timer interface with three control buttons:
 * - Start: Begins the countdown
 * - Stop/Pause: Pauses/resumes the timer
 * - Finish: Immediately ends the countdown and triggers recording
 *
 * Current state:
 * - PomodoroView exists with complex multi-phase timer (work/break cycles)
 * - No dedicated simple countdown timer interface exists
 *
 * Requested behavior:
 * - A focused, simple countdown timer view
 * - Three primary buttons: Start, Stop/Pause, Finish
 * - Finish button immediately stops the timer and records the session
 * - Clean, minimal interface compared to full Pomodoro view
 *
 * Implementation considerations:
 * - New view class: CountdownTimerView extending ItemView
 * - Reuse existing PomodoroService for timer state management
 * - Leverage existing session recording via addSessionToHistory()
 * - Simple UI focused on the three core buttons
 * - May need new view type constant: COUNTDOWN_TIMER_VIEW_TYPE
 *
 * Affected areas:
 * - src/views/ (new CountdownTimerView.ts)
 * - src/main.ts (view registration)
 * - src/services/PomodoroService.ts (may need minor adjustments)
 * - styles/ (new countdown-timer-view.css)
 * - src/i18n/resources/ (translation keys)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1160
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1160: Countdown Timer View', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1160 - countdown timer view should be accessible via command', async () => {
    /**
     * The countdown timer view should be openable via a command palette action.
     *
     * Expected behavior:
     * - Command "TaskNotes: Open countdown timer" (or similar) should exist
     * - Executing the command opens the countdown timer view
     * - View displays in a leaf pane
     */
    const page = app.page;

    // Try to open countdown timer view via command
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1500);

    // After implementation:
    // - Verify the countdown timer view is visible
    // - Check for view-specific elements (timer display, control buttons)
    const countdownView = page.locator('.countdown-timer-view');
    const viewExists = await countdownView.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Countdown timer view visible: ${viewExists}`);

    // Expected: viewExists should be true after implementation
    // expect(viewExists).toBe(true);
  });

  test.fixme('reproduces issue #1160 - view should display three control buttons', async () => {
    /**
     * The countdown timer view should show three distinct control buttons:
     * 1. Start - begins the countdown
     * 2. Stop/Pause - pauses or resumes the timer
     * 3. Finish - immediately ends countdown and records
     *
     * Button visibility may change based on timer state (similar to PomodoroView).
     */
    const page = app.page;

    // Open countdown timer view
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1500);

    // Look for control buttons
    const startButton = page.locator('button:has-text("Start"), .countdown-timer-view__start-button');
    const pauseButton = page.locator('button:has-text("Pause"), button:has-text("Stop"), .countdown-timer-view__pause-button');
    const finishButton = page.locator('button:has-text("Finish"), .countdown-timer-view__finish-button');

    const startExists = await startButton.isVisible({ timeout: 2000 }).catch(() => false);
    const pauseExists = await pauseButton.isVisible({ timeout: 2000 }).catch(() => false);
    const finishExists = await finishButton.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Start button visible: ${startExists}`);
    console.log(`Pause button visible: ${pauseExists}`);
    console.log(`Finish button visible: ${finishExists}`);

    // After implementation:
    // expect(startExists).toBe(true);
    // Pause and Finish may only be visible when timer is running
  });

  test.fixme('reproduces issue #1160 - Start button should begin the countdown', async () => {
    /**
     * Clicking the Start button should:
     * 1. Begin the countdown timer
     * 2. Update the UI to show running state
     * 3. Start decrementing the time display
     * 4. Show/enable Pause and Finish buttons
     */
    const page = app.page;

    // Open countdown timer view
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1500);

    // Click Start button
    const startButton = page.locator('button:has-text("Start"), .countdown-timer-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Check timer is running
    // The timer display should be updating
    // Pause/Stop button should now be visible

    console.log('Start button click test - verifies timer starts');

    // After implementation:
    // - Verify timer display is counting down
    // - Verify Start button is hidden or disabled
    // - Verify Pause/Stop button is now visible
    // - Verify Finish button is visible
  });

  test.fixme('reproduces issue #1160 - Stop/Pause button should pause the timer', async () => {
    /**
     * Clicking the Stop/Pause button while timer is running should:
     * 1. Pause the countdown
     * 2. Preserve the remaining time
     * 3. Allow resuming via Start/Resume button
     */
    const page = app.page;

    // Open countdown timer view and start timer
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    const startButton = page.locator('button:has-text("Start"), .countdown-timer-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1500);
    }

    // Click Pause button
    const pauseButton = page.locator('button:has-text("Pause"), button:has-text("Stop"), .countdown-timer-view__pause-button');
    if (await pauseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pauseButton.click();
      await page.waitForTimeout(500);
    }

    console.log('Pause button click test - verifies timer pauses');

    // After implementation:
    // - Verify timer display is frozen (not counting down)
    // - Verify Resume/Start button appears
    // - Verify time remaining is preserved
  });

  test.fixme('reproduces issue #1160 - Finish button should immediately end and record', async () => {
    /**
     * Clicking the Finish button should:
     * 1. Immediately stop the countdown (regardless of remaining time)
     * 2. Trigger session recording (time spent should be saved)
     * 3. Reset the view to initial state
     * 4. Show completion feedback (notification or UI update)
     *
     * This is the key differentiator from just pausing - Finish commits
     * the session and records the time tracking data.
     */
    const page = app.page;

    // Open countdown timer view and start timer
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    const startButton = page.locator('button:has-text("Start"), .countdown-timer-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000); // Let timer run for a bit
    }

    // Click Finish button
    const finishButton = page.locator('button:has-text("Finish"), .countdown-timer-view__finish-button');
    if (await finishButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await finishButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('Finish button click test - verifies immediate completion and recording');

    // After implementation:
    // - Verify timer has stopped
    // - Verify session was recorded (check Pomodoro stats or history)
    // - Verify view is reset to initial state
    // - Verify completion notification appeared
  });

  test.fixme('reproduces issue #1160 - timer display should show remaining time', async () => {
    /**
     * The countdown timer view should prominently display:
     * - Remaining time in MM:SS or HH:MM:SS format
     * - Visual indication of progress (optional progress ring/bar)
     * - Clear distinction between running and paused states
     */
    const page = app.page;

    // Open countdown timer view
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    // Look for timer display element
    const timerDisplay = page.locator('.countdown-timer-view__timer-display, .timer-display, [class*="timer"]');
    const displayExists = await timerDisplay.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Timer display visible: ${displayExists}`);

    // After implementation:
    // - Verify timer display shows time in expected format
    // - Verify display updates while running
    // - expect(timerDisplay).toContainText(/\d{1,2}:\d{2}/);
  });

  test.fixme('reproduces issue #1160 - should allow setting custom duration', async () => {
    /**
     * Users should be able to set a custom countdown duration.
     * This could be via:
     * - Direct input field
     * - Preset buttons (5min, 15min, 25min, etc.)
     * - Settings configuration
     */
    const page = app.page;

    // Open countdown timer view
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    // Look for duration input or preset buttons
    const durationInput = page.locator('input[type="number"], .countdown-timer-view__duration-input');
    const presetButtons = page.locator('.countdown-timer-view__preset, button:has-text(/\\d+\\s*min/i)');

    const inputExists = await durationInput.isVisible({ timeout: 2000 }).catch(() => false);
    const presetsExist = await presetButtons.first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Duration input visible: ${inputExists}`);
    console.log(`Preset buttons visible: ${presetsExist}`);

    // After implementation:
    // - Verify user can set custom duration
    // - Verify timer respects the set duration
  });

  test.fixme('reproduces issue #1160 - recorded session should include actual time spent', async () => {
    /**
     * When Finish is clicked, the recorded session should capture:
     * - Actual elapsed time (not the full planned duration)
     * - Start and end timestamps
     * - Any paused periods (if tracking active periods)
     *
     * This ensures accurate time tracking even when finishing early.
     */
    const page = app.page;

    // Open countdown timer, start, wait a bit, then finish
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    const startButton = page.locator('button:has-text("Start"), .countdown-timer-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000); // Run for 3 seconds
    }

    const finishButton = page.locator('button:has-text("Finish"), .countdown-timer-view__finish-button');
    if (await finishButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await finishButton.click();
      await page.waitForTimeout(500);
    }

    // Check Pomodoro stats for the recorded session
    await runCommand(page, 'TaskNotes: Open pomodoro stats');
    await page.waitForTimeout(1500);

    console.log('Session recording test - verifies actual elapsed time is recorded');

    // After implementation:
    // - Verify a session entry exists
    // - Verify session duration matches actual elapsed time (~3 seconds)
    // - Verify session is marked as completed (not interrupted)
  });

  test.fixme('reproduces issue #1160 - should integrate with existing task selection', async () => {
    /**
     * If the countdown timer supports task association (like Pomodoro):
     * - User should be able to select a task to track time against
     * - Finished session should update the task's tracked time
     * - Task reference should be stored with the session
     */
    const page = app.page;

    // Open countdown timer view
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    // Look for task selector
    const taskSelector = page.locator('.countdown-timer-view__task-selector, [class*="task-select"]');
    const selectorExists = await taskSelector.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Task selector visible: ${selectorExists}`);

    // After implementation (if task association is supported):
    // - Verify user can select a task
    // - Verify finishing updates the task's tracked time
  });

  test.fixme('reproduces issue #1160 - view should persist state across reopen', async () => {
    /**
     * If the user closes and reopens the countdown timer view:
     * - Running timer should continue (or show paused state with remaining time)
     * - Timer state should be restored from PomodoroService
     *
     * This leverages the existing service architecture for state persistence.
     */
    const page = app.page;

    // Open countdown timer and start
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    const startButton = page.locator('button:has-text("Start"), .countdown-timer-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Close the view
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Reopen the view
    await runCommand(page, 'TaskNotes: Open countdown timer');
    await page.waitForTimeout(1000);

    console.log('State persistence test - verifies timer state survives view close/reopen');

    // After implementation:
    // - Verify timer is still running (or shows correct paused state)
    // - Verify remaining time is accurate
  });
});
