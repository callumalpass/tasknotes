/**
 * Issue #1040: [FR] Add pomodoro timer to status bar
 *
 * Feature request to display the pomodoro timer in Obsidian's status bar,
 * similar to the Pomodoro Timer plugin by eatgrass.
 *
 * Current state:
 * - StatusBarService exists and displays tracked tasks in the status bar
 * - PomodoroService has full timer functionality with EVENT_POMODORO_TICK events
 * - No integration exists to show pomodoro timer in status bar
 *
 * Requested behavior:
 * - Display active pomodoro timer countdown in the status bar
 * - Show remaining time (MM:SS format)
 * - Visible at all times during an active pomodoro session
 * - Allow quick visibility of work/break session progress without opening the view
 *
 * Implementation considerations:
 * - Extend StatusBarService or create new PomodoroStatusBarService
 * - Listen to EVENT_POMODORO_TICK events for real-time updates
 * - Add new setting: showPomodoroInStatusBar (boolean)
 * - Display format: "🍅 MM:SS" or similar icon + time
 * - Handle different states: work, short-break, long-break, paused
 * - Click handler could open PomodoroView or toggle pause
 *
 * Affected areas:
 * - src/services/StatusBarService.ts (extend existing service)
 * - src/services/PomodoroService.ts (expose state getters if needed)
 * - src/settings.ts (new setting: showPomodoroInStatusBar)
 * - styles/status-bar.css (pomodoro-specific styling)
 * - src/i18n/resources/ (translation keys for tooltip)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1040
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1040: Pomodoro timer in status bar', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1040 - pomodoro timer should appear in status bar when active', async () => {
    /**
     * When a pomodoro session is running, the timer should be visible in the status bar.
     *
     * Expected behavior:
     * - Start a pomodoro session
     * - Status bar should display the countdown timer
     * - Timer should update in real-time
     */
    const page = app.page;

    // Open pomodoro view and start a session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    // Start a pomodoro session
    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for pomodoro timer in status bar
    const pomodoroStatusBar = page.locator('.status-bar .tasknotes-pomodoro-status, .status-bar [class*="pomodoro"]');
    const statusBarVisible = await pomodoroStatusBar.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Pomodoro status bar visible: ${statusBarVisible}`);

    // After implementation:
    // expect(statusBarVisible).toBe(true);
  });

  test.fixme('reproduces issue #1040 - status bar should show remaining time in MM:SS format', async () => {
    /**
     * The pomodoro status bar item should display time remaining in a readable format.
     *
     * Expected behavior:
     * - Time displayed as MM:SS (e.g., "25:00", "24:59")
     * - Updates every second while running
     */
    const page = app.page;

    // Open pomodoro view and start a session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1000);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1500);
    }

    // Look for time display in status bar
    const timeDisplay = page.locator('.status-bar .tasknotes-pomodoro-status, .status-bar [class*="pomodoro-time"]');
    const timeText = await timeDisplay.textContent().catch(() => '');

    console.log(`Pomodoro status bar text: ${timeText}`);

    // After implementation:
    // - Verify time format matches MM:SS pattern
    // expect(timeText).toMatch(/\d{1,2}:\d{2}/);
  });

  test.fixme('reproduces issue #1040 - status bar should indicate session type (work/break)', async () => {
    /**
     * Users should be able to distinguish between work and break sessions at a glance.
     *
     * Expected behavior:
     * - Work sessions: show work icon/indicator (e.g., 🍅)
     * - Break sessions: show break icon/indicator (e.g., ☕)
     * - Or use color coding / text labels
     */
    const page = app.page;

    // Start a work session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1000);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Check status bar for session type indicator
    const statusBarItem = page.locator('.status-bar .tasknotes-pomodoro-status');
    const statusContent = await statusBarItem.textContent().catch(() => '');

    console.log(`Status bar content during work: ${statusContent}`);

    // After implementation:
    // - Verify work session has appropriate indicator
    // - Could test break sessions by completing a pomodoro or via API
  });

  test.fixme('reproduces issue #1040 - status bar should hide when no active session', async () => {
    /**
     * When no pomodoro session is active, the status bar item should not be shown
     * (or should show an idle state).
     *
     * Expected behavior:
     * - No active session = status bar item hidden or showing "Ready"
     * - Saves status bar space when not in use
     */
    const page = app.page;

    // Stop any active pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1000);

    const stopButton = page.locator('.pomodoro-view__stop-button');
    if (await stopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopButton.click();
      await page.waitForTimeout(1000);
    }

    // Check that status bar item is hidden
    const pomodoroStatusBar = page.locator('.status-bar .tasknotes-pomodoro-status');
    const statusBarVisible = await pomodoroStatusBar.isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`Pomodoro status bar visible when idle: ${statusBarVisible}`);

    // After implementation:
    // expect(statusBarVisible).toBe(false);
  });

  test.fixme('reproduces issue #1040 - clicking status bar should open pomodoro view', async () => {
    /**
     * Clicking the pomodoro status bar item should provide quick access to the full view.
     *
     * Expected behavior:
     * - Click on status bar item opens PomodoroView
     * - Or could toggle pause/resume (alternative behavior)
     */
    const page = app.page;

    // Start a pomodoro session first
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1000);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Close the pomodoro view
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Click on status bar item
    const pomodoroStatusBar = page.locator('.status-bar .tasknotes-pomodoro-status');
    if (await pomodoroStatusBar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pomodoroStatusBar.click();
      await page.waitForTimeout(1000);
    }

    // Check if pomodoro view opened
    const pomodoroView = page.locator('.pomodoro-view');
    const viewVisible = await pomodoroView.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Pomodoro view opened after click: ${viewVisible}`);

    // After implementation:
    // expect(viewVisible).toBe(true);
  });

  test.fixme('reproduces issue #1040 - status bar should show paused state', async () => {
    /**
     * When a pomodoro session is paused, the status bar should indicate this.
     *
     * Expected behavior:
     * - Paused indicator (e.g., ⏸️ icon, "Paused" text, or pulsing animation)
     * - Time should still be displayed but not counting down
     */
    const page = app.page;

    // Start and pause a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1000);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1500);
    }

    // Pause the session
    const pauseButton = page.locator('.pomodoro-view__pause-button');
    if (await pauseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pauseButton.click();
      await page.waitForTimeout(1000);
    }

    // Check status bar for paused indicator
    const statusBarItem = page.locator('.status-bar .tasknotes-pomodoro-status');
    const statusContent = await statusBarItem.textContent().catch(() => '');
    const hasClass = await statusBarItem.evaluate(el => el.className).catch(() => '');

    console.log(`Status bar content when paused: ${statusContent}`);
    console.log(`Status bar classes when paused: ${hasClass}`);

    // After implementation:
    // - Verify paused state is visually indicated
    // expect(statusContent).toContain('⏸️') or similar
  });

  test.fixme('reproduces issue #1040 - setting should control status bar visibility', async () => {
    /**
     * A setting should allow users to enable/disable the pomodoro status bar display.
     *
     * Expected behavior:
     * - Setting: "Show pomodoro timer in status bar" (default: true/false)
     * - When disabled, status bar item never shows
     * - When enabled, shows during active sessions
     */
    const page = app.page;

    // Open settings
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(1500);

    // Navigate to TaskNotes settings
    const tasknotesSettings = page.locator('[data-tab="tasknotes"], .vertical-tab-nav-item:has-text("TaskNotes")');
    if (await tasknotesSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tasknotesSettings.click();
      await page.waitForTimeout(1000);
    }

    // Look for pomodoro status bar setting
    const pomodoroStatusSetting = page.locator('text=/pomodoro.*status.*bar|status.*bar.*pomodoro/i');
    const settingExists = await pomodoroStatusSetting.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Pomodoro status bar setting exists: ${settingExists}`);

    // Close settings
    await page.keyboard.press('Escape');

    // After implementation:
    // expect(settingExists).toBe(true);
  });

  test.fixme('reproduces issue #1040 - tooltip should show additional info on hover', async () => {
    /**
     * Hovering over the status bar item should show helpful information.
     *
     * Expected behavior:
     * - Tooltip with session type (Work/Short Break/Long Break)
     * - Task name if a task is associated
     * - Completed pomodoros count for today
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1000);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Hover over status bar item
    const pomodoroStatusBar = page.locator('.status-bar .tasknotes-pomodoro-status');
    if (await pomodoroStatusBar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pomodoroStatusBar.hover();
      await page.waitForTimeout(500);
    }

    // Check for tooltip
    const tooltip = page.locator('.tooltip, [role="tooltip"]');
    const tooltipVisible = await tooltip.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Tooltip visible on hover: ${tooltipVisible}`);

    // After implementation:
    // expect(tooltipVisible).toBe(true);
    // expect(await tooltip.textContent()).toContain('Work');
  });
});
