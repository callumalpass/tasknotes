/**
 * Issue #1581: [Bug] Pomodoro starts break duration instead of work duration after app restart
 *
 * User reported that after completing a work Pomodoro session and restarting Obsidian,
 * pressing Start initiates a break (e.g. 5 minutes) instead of a work session, even though
 * the timer display shows the correct work duration (e.g. 45 minutes).
 *
 * Steps to reproduce:
 * 1. Set a custom work duration (e.g. 45 min) and short break (e.g. 5 min).
 * 2. Complete a full work Pomodoro session.
 * 3. When the break is prepared (timer shows 5 min, button says "Start Short Break"), close Obsidian.
 * 4. Reopen Obsidian.
 * 5. Observe the timer now displays 45:00 (work duration) — this looks correct.
 * 6. Press Start.
 * 7. Bug: A 5-minute short break starts instead of a 45-minute work session.
 *
 * Root cause:
 * In PomodoroService.ts, loadState() correctly resets timeRemaining to the work duration
 * when there's no active session (line 128-130), but does not reset nextSessionType.
 * This field is persisted to disk via saveState(), so after a restart it still holds
 * "short-break" from the previous completed work session.
 *
 * The start button handler in PomodoroView.ts (line 382) checks state.nextSessionType
 * to decide whether to call startBreak() or startPomodoro(), so it dispatches a break
 * even though the display shows work duration.
 *
 * The same issue exists in stopPomodoro() — it resets currentSession, isRunning, and
 * timeRemaining but not nextSessionType.
 *
 * Affected areas:
 * - src/services/PomodoroService.ts (loadState, stopPomodoro)
 * - src/views/PomodoroView.ts (start button handler)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1581
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand, updateSettings } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1581: Pomodoro starts break instead of work session after restart', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1581 - nextSessionType persists across restart causing wrong session type', async () => {
    /**
     * After a work session completes, nextSessionType is set to "short-break".
     * When Obsidian is restarted, loadState() resets timeRemaining to work duration
     * but does NOT reset nextSessionType. So pressing Start dispatches a break.
     *
     * Expected: After restart with no active session, pressing Start begins a work session.
     * Actual: A short break starts because nextSessionType is still "short-break".
     */
    const page = app.page;

    await updateSettings(page, {
      pomodoroWorkDuration: 45,
      pomodoroShortBreakDuration: 5,
      pomodoroAutoStartBreaks: false,
    });

    // Open pomodoro view
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const pomodoroView = page.locator('.pomodoro-view');
    await expect(pomodoroView).toBeVisible({ timeout: 5000 });

    // To reproduce this properly, we need to:
    // 1. Complete a work session (sets nextSessionType = "short-break")
    // 2. Close Obsidian (state persisted with nextSessionType = "short-break")
    // 3. Reopen Obsidian (loadState resets timeRemaining but not nextSessionType)
    // 4. Press Start
    // 5. Verify a WORK session starts (45 min), not a break (5 min)

    // After fix:
    // const startButton = page.locator('.pomodoro-view__start-button');
    // await startButton.click();
    // const timerDisplay = page.locator('.pomodoro-view__timer');
    // // Timer should show 45:00 (work), not 05:00 (break)
    // await expect(timerDisplay).toContainText('45:00');

    console.log('Bug: After restart, Start button begins a break instead of work session.');
    console.log('Root cause: loadState() does not reset nextSessionType when clearing stale sessions.');
  });

  test.fixme('reproduces issue #1581 - loadState should reset nextSessionType when clearing previous day sessions', async () => {
    /**
     * loadState() clears currentSession when the date changes (line 105-110),
     * but does not clear nextSessionType. If a break was pending from the previous
     * day, the user would start a break on the new day.
     *
     * Expected: On new day, nextSessionType is cleared so Start begins a work session.
     * Actual: nextSessionType from previous day's last session persists.
     */
    const page = app.page;

    await updateSettings(page, {
      pomodoroWorkDuration: 25,
      pomodoroShortBreakDuration: 5,
    });

    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    // This scenario requires simulating a day change between sessions.
    // After fix, loadState() line 105-110 should also set:
    //   this.state.nextSessionType = undefined;

    console.log('Bug: nextSessionType from previous day persists after date change.');
    console.log('loadState() clears currentSession on new day but not nextSessionType.');
  });

  test.fixme('reproduces issue #1581 - loadState should reset nextSessionType for stale sessions (>24h)', async () => {
    /**
     * loadState() clears sessions older than 24 hours (line 119-124),
     * resetting currentSession, isRunning, and timeRemaining, but not nextSessionType.
     *
     * Expected: After clearing a stale session, nextSessionType is also cleared.
     * Actual: nextSessionType remains from the stale session's completion.
     */
    const page = app.page;

    // This scenario requires a session that was started > 24 hours ago.
    // After fix, loadState() line 119-124 should also set:
    //   this.state.nextSessionType = undefined;

    console.log('Bug: nextSessionType not cleared when stale sessions (>24h) are cleaned up.');
  });

  test.fixme('reproduces issue #1581 - stopPomodoro should reset nextSessionType', async () => {
    /**
     * stopPomodoro() resets currentSession, isRunning, and timeRemaining (lines 468-471),
     * but does not reset nextSessionType.
     *
     * If a work session completes (setting nextSessionType = "short-break"), then the
     * user stops/interrupts the prepared break, nextSessionType still says "short-break".
     * The next Start press would begin a break instead of a work session.
     *
     * Expected: After stopping, nextSessionType is cleared so Start begins work.
     * Actual: nextSessionType persists from prior completion.
     */
    const page = app.page;

    await updateSettings(page, {
      pomodoroWorkDuration: 25,
      pomodoroShortBreakDuration: 5,
      pomodoroAutoStartBreaks: false,
    });

    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const pomodoroView = page.locator('.pomodoro-view');
    await expect(pomodoroView).toBeVisible({ timeout: 5000 });

    // To reproduce:
    // 1. Complete a work session (nextSessionType = "short-break")
    // 2. Don't start the break
    // 3. Click stop/reset
    // 4. Press Start
    // 5. Verify a WORK session starts, not a break

    // After fix, stopPomodoro() should also set:
    //   this.state.nextSessionType = undefined;

    console.log('Bug: stopPomodoro() does not reset nextSessionType.');
    console.log('After stopping, Start may begin a break instead of a work session.');
  });
});
