/**
 * Issue #820: [FR] Add pomodoro timer as status bar style with configurable location
 *
 * Feature request (originally in Chinese) to display the pomodoro timer in various
 * locations, not limited to the bottom status bar. User wants flexibility similar
 * to the Pomodoro Timer plugin but with options to show the timer in different areas
 * such as the view header / page header area.
 *
 * Current state:
 * - StatusBarService exists for tracked tasks in bottom status bar
 * - PomodoroService provides full timer functionality
 * - Issue #1040 requests basic status bar timer display
 * - No option to display timer in alternate locations (e.g., view header)
 *
 * Requested behavior:
 * - Display pomodoro timer countdown (similar to Pomodoro Timer plugin)
 * - Support multiple display locations, not just bottom status bar
 * - Option to show timer in view/page header area
 * - Configurable display position setting
 *
 * Relationship to other issues:
 * - Related to Issue #1040 (status bar timer) - this extends that request
 * - This issue adds location flexibility on top of basic status bar display
 *
 * Implementation considerations:
 * - Extend StatusBarService or create PomodoroDisplayService
 * - Add setting: pomodoroTimerLocation: "status-bar" | "view-header" | "both" | "none"
 * - View header integration requires understanding Obsidian's leaf/view header API
 * - May need to inject elements into workspace-leaf-content areas
 * - Consider using Obsidian's view header actions API if available
 *
 * Affected areas:
 * - src/services/StatusBarService.ts (for status bar option)
 * - src/services/PomodoroService.ts (expose state for displays)
 * - src/settings.ts (new location setting)
 * - src/views/PomodoroView.ts (potential integration with view headers)
 * - styles/status-bar.css (timer styling for both locations)
 * - styles/pomodoro.css (view header timer styling)
 * - src/i18n/resources/ (translation keys)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/820
 * @see https://github.com/callumalpass/tasknotes/issues/1040 (related)
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #820: Pomodoro timer display location options', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #820 - setting for timer display location should exist', async () => {
    /**
     * Users should be able to choose where the pomodoro timer is displayed.
     *
     * Expected behavior:
     * - Setting exists: "Pomodoro timer display location"
     * - Options: Status bar, View header, Both, None
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

    // Look for timer location setting
    const locationSetting = page.locator('text=/timer.*location|display.*location|pomodoro.*position/i');
    const settingExists = await locationSetting.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Timer display location setting exists: ${settingExists}`);

    // Close settings
    await page.keyboard.press('Escape');

    // After implementation:
    // expect(settingExists).toBe(true);
  });

  test.fixme('reproduces issue #820 - timer can display in status bar', async () => {
    /**
     * When location is set to "status-bar" or "both", timer should appear in bottom status bar.
     *
     * Expected behavior:
     * - Start pomodoro session
     * - Timer countdown visible in bottom status bar
     * - Format: icon + MM:SS (e.g., "🍅 24:59")
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for timer in status bar
    const statusBarTimer = page.locator('.status-bar .tasknotes-pomodoro-timer, .status-bar [class*="pomodoro"]');
    const timerVisible = await statusBarTimer.isVisible({ timeout: 2000 }).catch(() => false);
    const timerText = await statusBarTimer.textContent().catch(() => '');

    console.log(`Status bar timer visible: ${timerVisible}`);
    console.log(`Status bar timer text: ${timerText}`);

    // After implementation:
    // expect(timerVisible).toBe(true);
    // expect(timerText).toMatch(/\d{1,2}:\d{2}/);
  });

  test.fixme('reproduces issue #820 - timer can display in view header area', async () => {
    /**
     * When location is set to "view-header" or "both", timer should appear in the
     * view/page header area (near the top of the workspace).
     *
     * Expected behavior:
     * - Start pomodoro session
     * - Timer countdown visible in view header area
     * - Should be positioned near other view actions/breadcrumbs
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for timer in view header area
    // View header is typically .view-header or .workspace-leaf-header
    const viewHeaderTimer = page.locator('.view-header .tasknotes-pomodoro-timer, .workspace-leaf-header .tasknotes-pomodoro-timer, .view-header-title-container .tasknotes-pomodoro-timer');
    const headerTimerVisible = await viewHeaderTimer.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`View header timer visible: ${headerTimerVisible}`);

    // After implementation:
    // expect(headerTimerVisible).toBe(true);
  });

  test.fixme('reproduces issue #820 - both locations can show timer simultaneously', async () => {
    /**
     * When location is set to "both", timer should appear in both status bar
     * and view header simultaneously.
     *
     * Expected behavior:
     * - Both displays show the same countdown
     * - Both update in real-time
     * - Consistent styling across both locations
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);
    }

    // Check both locations
    const statusBarTimer = page.locator('.status-bar .tasknotes-pomodoro-timer');
    const viewHeaderTimer = page.locator('.view-header .tasknotes-pomodoro-timer, .workspace-leaf-header .tasknotes-pomodoro-timer');

    const statusBarVisible = await statusBarTimer.isVisible({ timeout: 2000 }).catch(() => false);
    const headerVisible = await viewHeaderTimer.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Status bar timer visible: ${statusBarVisible}`);
    console.log(`View header timer visible: ${headerVisible}`);

    // After implementation (when setting is "both"):
    // expect(statusBarVisible).toBe(true);
    // expect(headerVisible).toBe(true);
  });

  test.fixme('reproduces issue #820 - view header timer shows session type indicator', async () => {
    /**
     * The view header timer should distinguish between work and break sessions.
     *
     * Expected behavior:
     * - Work session: work indicator (e.g., 🍅 or color)
     * - Break session: break indicator (e.g., ☕ or different color)
     * - Clear visual distinction at a glance
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);
    }

    // Check view header timer for session indicator
    const viewHeaderTimer = page.locator('.view-header .tasknotes-pomodoro-timer, .workspace-leaf-header .tasknotes-pomodoro-timer');
    const timerContent = await viewHeaderTimer.textContent().catch(() => '');
    const timerClasses = await viewHeaderTimer.evaluate(el => el.className).catch(() => '');

    console.log(`View header timer content: ${timerContent}`);
    console.log(`View header timer classes: ${timerClasses}`);

    // After implementation:
    // - Should have class or icon indicating work/break session
    // expect(timerContent).toContain('🍅') or expect(timerClasses).toContain('work');
  });

  test.fixme('reproduces issue #820 - clicking view header timer opens pomodoro view', async () => {
    /**
     * Clicking the timer in the view header should provide quick access to controls.
     *
     * Expected behavior:
     * - Click on view header timer opens PomodoroView
     * - Or shows a quick controls popup
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Close the pomodoro view
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Click on view header timer
    const viewHeaderTimer = page.locator('.view-header .tasknotes-pomodoro-timer, .workspace-leaf-header .tasknotes-pomodoro-timer');
    if (await viewHeaderTimer.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewHeaderTimer.click();
      await page.waitForTimeout(1000);
    }

    // Check if pomodoro view or quick controls opened
    const pomodoroView = page.locator('.pomodoro-view');
    const viewVisible = await pomodoroView.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Pomodoro view opened after header timer click: ${viewVisible}`);

    // After implementation:
    // expect(viewVisible).toBe(true);
  });

  test.fixme('reproduces issue #820 - timer persists across view changes', async () => {
    /**
     * The view header timer should remain visible when switching between notes/views.
     *
     * Expected behavior:
     * - Timer visible in one note's header
     * - Switch to another note
     * - Timer still visible in new note's header
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Check timer is visible
    const viewHeaderTimer = page.locator('.view-header .tasknotes-pomodoro-timer, .workspace-leaf-header .tasknotes-pomodoro-timer');
    const initiallyVisible = await viewHeaderTimer.isVisible({ timeout: 2000 }).catch(() => false);

    // Open quick switcher and switch to a different file
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Check timer is still visible
    const stillVisible = await viewHeaderTimer.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Timer initially visible: ${initiallyVisible}`);
    console.log(`Timer visible after view change: ${stillVisible}`);

    // After implementation:
    // expect(initiallyVisible).toBe(true);
    // expect(stillVisible).toBe(true);
  });

  test.fixme('reproduces issue #820 - compact display mode for small spaces', async () => {
    /**
     * Timer should adapt to available space, especially in narrow sidebars or headers.
     *
     * Expected behavior:
     * - Full display: "🍅 24:59" (icon + time)
     * - Compact display: "24:59" (time only) or circular indicator
     * - Automatically adapts based on container width
     */
    const page = app.page;

    // Start a pomodoro session
    await runCommand(page, 'TaskNotes: Open pomodoro view');
    await page.waitForTimeout(1500);

    const startButton = page.locator('.pomodoro-view__start-button');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for responsive/compact styling
    const timer = page.locator('.tasknotes-pomodoro-timer');
    const hasResponsiveClass = await timer.evaluate(el => {
      return el.classList.contains('compact') ||
             el.classList.contains('responsive') ||
             getComputedStyle(el).getPropertyValue('--timer-mode');
    }).catch(() => false);

    console.log(`Timer has responsive styling: ${hasResponsiveClass}`);

    // After implementation:
    // - Timer should have responsive CSS or modifier classes
  });
});
