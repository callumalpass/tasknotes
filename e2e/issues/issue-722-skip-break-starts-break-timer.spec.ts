/**
 * Issue #722: [Bug] Pomodoro "Skip Break" actually starts the break timer
 *
 * User reported that when "Auto-Start Break" is disabled and they click "Skip Break"
 * after a work session completes, the break timer starts counting down instead of
 * preparing for the next work session without starting anything.
 *
 * Steps to reproduce:
 * 1. Disable "Auto-Start Break" in pomodoro settings
 * 2. Complete a work pomodoro session
 * 3. When the break is prepared (not started), click "Skip Break"
 * 4. Expected: Timer resets to work duration, remains paused, ready for next work session
 * 5. Actual: Timer starts running (either break or short work session with break duration)
 *
 * Root cause analysis:
 * In PomodoroView.ts, the "Skip Break" click handler calls startPomodoro() when
 * nextSessionType is a break type. However:
 * - startPomodoro() uses this.state.timeRemaining if no duration provided (line 200-202)
 * - At this point, timeRemaining is still set to the break duration
 * - This either starts a work session with the wrong duration, or the display is confusing
 *
 * The fix should:
 * - NOT start any session when skip break is clicked
 * - Simply reset state to prepare for next work session (reset timeRemaining to work duration)
 * - Clear the break preparation state (nextSessionType)
 * - Leave the timer paused and ready for user to start when they want
 *
 * Affected areas:
 * - src/views/PomodoroView.ts (skip break click handler at line 406-418)
 * - src/services/PomodoroService.ts (may need new method like skipBreak())
 *
 * @see https://github.com/callumalpass/tasknotes/issues/722
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand, updateSettings } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #722: Skip Break button starts timer instead of preparing work session', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #722 - skip break should not start any timer', async () => {
    /**
     * When "Skip Break" is clicked after a work session completes (with auto-start disabled),
     * the timer should be reset to work duration and remain paused.
     *
     * Expected behavior:
     * - Timer shows work duration (e.g., 25:00)
     * - Timer is NOT running (paused state)
     * - User can manually start the next work session when ready
     *
     * Bug behavior:
     * - Timer starts counting down immediately after clicking "Skip Break"
     * - Session appears in history as interrupted if stopped
     */
    const page = app.page;

    // Ensure auto-start breaks is disabled
    await updateSettings(page, {
      pomodoroAutoStartBreaks: false,
      pomodoroWorkDuration: 25,
      pomodoroShortBreakDuration: 5,
    });

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const pomodoroView = page.locator('.pomodoro-view');
    await expect(pomodoroView).toBeVisible({ timeout: 5000 });

    // For testing purposes, we need to simulate completing a work session
    // This would require either:
    // 1. A very short work duration setting for test
    // 2. Directly manipulating the service state
    // 3. Using test fixtures/mocks
    //
    // For now, document the manual reproduction steps:
    //
    // Manual test steps:
    // 1. Set work duration to 1 minute (minimum)
    // 2. Start pomodoro
    // 3. Wait for work session to complete
    // 4. Observe: "Skip Break" button should appear
    // 5. Click "Skip Break"
    // 6. Bug: Timer starts counting down (break timer runs)
    // 7. Expected: Timer shows 25:00 (or configured work duration), paused

    // Start a work session (we'll need to wait or fast-forward)
    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // For a proper test, we'd need to fast-forward the timer
      // or set up the state to simulate post-work-completion

      console.log('Skip Break bug requires completing a work session first.');
      console.log('Manual reproduction: Complete work session, then click Skip Break.');
      console.log('Bug: Timer starts running. Expected: Timer paused at work duration.');
    }

    // After fix implementation, the test should:
    // 1. Complete a work session (via fast-forward or short duration)
    // 2. Verify skip break button appears
    // 3. Click skip break
    // 4. Verify timer shows work duration
    // 5. Verify timer is NOT running (no countdown)
    // 6. Verify no session is created in history
  });

  test.fixme('reproduces issue #722 - skip break should not create interrupted session in history', async () => {
    /**
     * When "Skip Break" is clicked and user later stops any session that was started,
     * interrupted sessions appear in the overview, which is confusing.
     *
     * Expected behavior:
     * - Clicking "Skip Break" creates no session at all
     * - History only shows actual work/break sessions
     *
     * Bug behavior:
     * - A session starts when Skip Break is clicked
     * - If user stops it, it appears as "interrupted" in history
     */
    const page = app.page;

    // This test would verify:
    // 1. Complete a work session
    // 2. Click "Skip Break"
    // 3. Verify no new session was created in pomodoroService state
    // 4. Check history view shows no interrupted sessions from this action

    console.log('Test verifies Skip Break does not create unwanted session entries.');
    console.log('Bug: Clicking Skip Break can create interrupted sessions in history.');
  });

  test.fixme('reproduces issue #722 - skip break should reset to correct work duration', async () => {
    /**
     * After skipping break, the timer should show the configured work duration,
     * not the break duration.
     *
     * Expected behavior:
     * - After Skip Break: Timer shows 25:00 (or configured work duration)
     *
     * Bug behavior:
     * - Timer might show break duration (e.g., 5:00) if startPomodoro uses
     *   the current timeRemaining which was set to break duration
     */
    const page = app.page;

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    // Get timer display
    const timerDisplay = page.locator('.pomodoro-view__timer');
    const initialTime = await timerDisplay.textContent().catch(() => '');

    console.log(`Timer display: ${initialTime}`);
    console.log('After Skip Break, timer should show work duration (e.g., 25:00), not break duration (e.g., 5:00).');

    // After fix:
    // 1. Complete work session
    // 2. Click Skip Break
    // 3. Verify timer shows configured work duration
    // expect(await timerDisplay.textContent()).toMatch(/25:00|24:\d{2}/);
  });

  test.fixme('reproduces issue #722 - skip break preserves selected task for next session', async () => {
    /**
     * If a task was selected for the work session, clicking Skip Break should
     * preserve that task selection for the next work session.
     *
     * Expected behavior:
     * - Task selected for work session
     * - Work session completes
     * - Click Skip Break
     * - Same task still selected for next work session
     */
    const page = app.page;

    console.log('Test verifies task selection is preserved when skipping break.');
    console.log('User should not have to re-select task after skipping break.');

    // After fix:
    // 1. Select a task in pomodoro view
    // 2. Complete work session
    // 3. Click Skip Break
    // 4. Verify selected task is still shown
  });
});
