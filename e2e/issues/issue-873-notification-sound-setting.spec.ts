/**
 * Issue #873: [FR]: Notification Sound setting
 *
 * Feature request to add a setting for notification sounds when task reminders trigger.
 * Currently, Windows 11 (and potentially other platforms) don't play sounds with system
 * notifications, and Obsidian's native notifications are also silent.
 *
 * The user requests:
 * - Ability to set a notification sound for task reminders
 * - Option for predefined sounds or custom sound uploads
 *
 * Implementation considerations:
 * - Similar to existing Pomodoro sound implementation using Web Audio API
 * - Settings needed: enableNotificationSound, notificationSoundVolume, notificationSoundType
 * - Could use AudioContext for generated sounds or HTMLAudioElement for custom sounds
 * - Need to handle browser autoplay policies (user gesture requirement)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/873
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #873: Notification Sound Setting', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #873 - notification settings should have sound toggle option',
    async () => {
      /**
       * The notification settings section should include a toggle to enable/disable
       * notification sounds, similar to how Pomodoro has pomodoroSoundEnabled.
       *
       * Expected behavior after implementation:
       * - A toggle labeled "Enable notification sound" or similar
       * - Located in the Features tab, under the Notifications section
       * - Only visible when enableNotifications is true
       */
      const page = app.page;

      // Open settings
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      // Navigate to the TaskNotes settings
      const taskNotesSettings = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await taskNotesSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesSettings.click();
        await page.waitForTimeout(300);
      }

      // Navigate to Features tab
      const featuresTab = page.locator('.tasknotes-settings-tab:has-text("Features")');
      if (await featuresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await featuresTab.click();
        await page.waitForTimeout(300);
      }

      // Look for notification settings section
      const notificationSection = page.locator(
        '.settings-view__group:has(.setting-item-heading:has-text("Notifications"))'
      );
      await expect(notificationSection).toBeVisible({ timeout: 5000 });

      // After implementation, there should be a sound toggle setting
      // Currently this would fail as the setting doesn't exist
      const soundToggle = notificationSection.locator(
        '.setting-item:has-text("sound"), .setting-item:has-text("Sound")'
      );

      // This assertion documents the expected behavior
      // After fix: sound toggle should be visible within notification settings
      await expect(soundToggle).toBeVisible({ timeout: 2000 });

      // Close settings
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #873 - notification sound volume slider should be available',
    async () => {
      /**
       * When notification sound is enabled, a volume slider should be available
       * to control the notification sound volume (similar to pomodoroSoundVolume).
       *
       * Expected behavior after implementation:
       * - Volume slider (0-100) appears when sound is enabled
       * - Slider should control the volume of notification sounds
       */
      const page = app.page;

      // Open settings
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      // Navigate to TaskNotes settings
      const taskNotesSettings = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await taskNotesSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesSettings.click();
        await page.waitForTimeout(300);
      }

      // Navigate to Features tab
      const featuresTab = page.locator('.tasknotes-settings-tab:has-text("Features")');
      if (await featuresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await featuresTab.click();
        await page.waitForTimeout(300);
      }

      // Look for notification settings section
      const notificationSection = page.locator(
        '.settings-view__group:has(.setting-item-heading:has-text("Notifications"))'
      );
      await expect(notificationSection).toBeVisible({ timeout: 5000 });

      // After implementation, there should be a volume slider when sound is enabled
      const volumeSlider = notificationSection.locator('input[type="range"], .slider');

      // This assertion documents the expected behavior
      // After fix: volume slider should be visible when notification sound is enabled
      await expect(volumeSlider).toBeVisible({ timeout: 2000 });

      // Close settings
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #873 - notification sound should play when reminder triggers',
    async () => {
      /**
       * When a task reminder triggers and notification sound is enabled,
       * an audible sound should play in addition to showing the notification.
       *
       * This is particularly important on Windows 11 where system notifications
       * don't play sounds, and for Obsidian in-app notices which are silent.
       *
       * Implementation note: The sound implementation could follow the pattern
       * used in PomodoroService.playCompletionSound() which uses Web Audio API.
       */
      const page = app.page;

      // Note: Testing actual audio playback in Playwright is complex
      // This test documents the expected behavior and could verify:
      // 1. AudioContext is created when notification triggers
      // 2. Settings are respected (enabled, volume)

      // Open the calendar view (notifications are often triggered from here)
      await runCommand(page, 'TaskNotes: Open calendar view');
      await page.waitForTimeout(1000);

      // For now, just verify the notification system is working
      const calendarContainer = page.locator('.fc');
      await expect(calendarContainer).toBeVisible({ timeout: 10000 });

      // Check if AudioContext API is available in the browser context
      const hasAudioContext = await page.evaluate(() => {
        return 'AudioContext' in window || 'webkitAudioContext' in window;
      });

      console.log(`AudioContext available: ${hasAudioContext}`);
      expect(hasAudioContext).toBe(true);

      // After implementation, when a reminder triggers:
      // 1. NotificationService.triggerNotification() should check sound settings
      // 2. If enabled, play sound using AudioContext (similar to PomodoroService)
      // 3. Sound volume should respect the notificationSoundVolume setting
    }
  );

  test.fixme(
    'reproduces issue #873 - notification sound type selection should be available',
    async () => {
      /**
       * Users should be able to select from predefined sound types or potentially
       * upload custom notification sounds.
       *
       * Predefined sound options could include:
       * - Beep (default, similar to Pomodoro completion sound)
       * - Chime
       * - Bell
       * - Custom (file upload)
       *
       * Implementation considerations:
       * - Predefined sounds can use Web Audio API oscillators with different frequencies
       * - Custom sounds would need file handling and HTMLAudioElement
       */
      const page = app.page;

      // Open settings
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      // Navigate to TaskNotes settings
      const taskNotesSettings = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await taskNotesSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesSettings.click();
        await page.waitForTimeout(300);
      }

      // Navigate to Features tab
      const featuresTab = page.locator('.tasknotes-settings-tab:has-text("Features")');
      if (await featuresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await featuresTab.click();
        await page.waitForTimeout(300);
      }

      // Look for notification settings section
      const notificationSection = page.locator(
        '.settings-view__group:has(.setting-item-heading:has-text("Notifications"))'
      );
      await expect(notificationSection).toBeVisible({ timeout: 5000 });

      // After implementation, there should be a dropdown for sound type selection
      const soundTypeDropdown = notificationSection.locator(
        'select, .dropdown-component, .setting-item:has-text("Sound type")'
      );

      // This assertion documents the expected behavior
      // After fix: sound type selector should be visible
      await expect(soundTypeDropdown).toBeVisible({ timeout: 2000 });

      // Close settings
      await page.keyboard.press('Escape');
    }
  );

  test.fixme(
    'reproduces issue #873 - sound preview button should be available',
    async () => {
      /**
       * Users should be able to preview the selected notification sound
       * before saving their preferences.
       *
       * Expected behavior:
       * - A "Preview" or "Test" button next to the sound settings
       * - Clicking the button plays the currently selected sound
       * - Uses the current volume setting for the preview
       */
      const page = app.page;

      // Open settings
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      // Navigate to TaskNotes settings
      const taskNotesSettings = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await taskNotesSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskNotesSettings.click();
        await page.waitForTimeout(300);
      }

      // Navigate to Features tab
      const featuresTab = page.locator('.tasknotes-settings-tab:has-text("Features")');
      if (await featuresTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await featuresTab.click();
        await page.waitForTimeout(300);
      }

      // Look for notification settings section
      const notificationSection = page.locator(
        '.settings-view__group:has(.setting-item-heading:has-text("Notifications"))'
      );
      await expect(notificationSection).toBeVisible({ timeout: 5000 });

      // After implementation, there should be a preview/test button
      const previewButton = notificationSection.locator(
        'button:has-text("Preview"), button:has-text("Test"), button:has-text("Play")'
      );

      // This assertion documents the expected behavior
      // After fix: preview button should be visible in sound settings
      await expect(previewButton).toBeVisible({ timeout: 2000 });

      // Close settings
      await page.keyboard.press('Escape');
    }
  );
});
