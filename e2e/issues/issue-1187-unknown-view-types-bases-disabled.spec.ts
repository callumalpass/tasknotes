/**
 * Issue #1187: [Bug] "Unknown view types" when opening bases if bases support was previously turned off
 *
 * User reported that after upgrading to V4, they can't open TaskNotes bases because
 * the "Unknown view types" error appears. The user previously disabled bases support
 * in settings (pre-V4), and now the setting toggle is gone.
 *
 * Root cause:
 * 1. User had `enableBases: false` saved in their data.json from pre-V4
 * 2. In V4, the enableBases toggle was removed from the settings UI
 * 3. Settings loading (main.ts:1270) does `...DEFAULT_SETTINGS, ...loadedData`,
 *    so the saved `enableBases: false` overrides the default `true`
 * 4. View registration (registration.ts:15) checks `plugin.settings.enableBases`
 *    and early returns if false
 * 5. When Obsidian tries to restore workspace with Bases views, they aren't registered
 * 6. User sees "Unknown view types" error and has no UI to fix it
 *
 * Workaround: Manually edit `.obsidian/plugins/tasknotes/data.json` and set
 * `"enableBases": true`, then reload
 *
 * Suggested fix: Either:
 * a) Add migration logic to force `enableBases: true` when loading settings (since
 *    the UI option to disable it is gone in V4)
 * b) Remove the `enableBases` setting entirely since it's always-on in V4
 * c) Re-add the setting toggle if users should be able to disable bases
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1187
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const E2E_VAULT_DIR = path.join(PROJECT_ROOT, 'tasknotes-e2e-vault');
const PLUGIN_DATA_PATH = path.join(E2E_VAULT_DIR, '.obsidian/plugins/tasknotes/data.json');

let app: ObsidianApp;

test.describe('Issue #1187: Unknown view types when bases support was disabled', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1187 - enableBases:false causes Unknown view types error', async () => {
    /**
     * This test simulates the scenario where a user:
     * 1. Had enableBases: false saved from a previous version
     * 2. Upgraded to V4 where the setting toggle was removed
     * 3. Tries to open a Bases view and sees "Unknown view types" error
     *
     * The test:
     * 1. Modifies data.json to set enableBases: false
     * 2. Reloads the plugin
     * 3. Attempts to open a Bases view (e.g., task list)
     * 4. Verifies the error appears
     *
     * Note: This test requires careful cleanup to restore normal functionality
     */
    const page = app.page;

    // Backup current data.json if it exists
    let originalData: string | null = null;
    if (fs.existsSync(PLUGIN_DATA_PATH)) {
      originalData = fs.readFileSync(PLUGIN_DATA_PATH, 'utf-8');
    }

    try {
      // Read current data and set enableBases to false
      const currentData = originalData ? JSON.parse(originalData) : {};
      currentData.enableBases = false;

      // Write modified settings
      fs.writeFileSync(PLUGIN_DATA_PATH, JSON.stringify(currentData, null, 2));

      // Reload the plugin to apply the setting
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(3000); // Wait for reload

      // Try to open a Bases view
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(1000);

      // Look for error indicators
      // The "Unknown view types" error typically appears in a notice or modal
      const errorNotice = page.locator('.notice, .modal-container').filter({
        hasText: /unknown.*view.*type/i,
      });

      const hasError = await errorNotice.isVisible({ timeout: 3000 }).catch(() => false);

      // Alternatively check console for errors (via page evaluation)
      // Note: This requires special setup to capture console logs

      // Document the expected vs actual behavior
      if (hasError) {
        console.log('CONFIRMED: Unknown view types error when enableBases is false');
      } else {
        // The view might just fail silently or show a different error
        console.log('Error presentation may differ - check console for warnings');
      }

      // The bug is confirmed if:
      // 1. No task list view opens (because views weren't registered)
      // 2. An error appears about unknown view types
      const taskListView = page.locator('.workspace-leaf-content[data-type="tasknotesTaskList"]');
      const viewOpened = await taskListView.isVisible({ timeout: 2000 }).catch(() => false);

      // When enableBases is false, the view should NOT open successfully
      // because it was never registered
      expect(viewOpened).toBe(false);

    } finally {
      // CRITICAL: Restore original data.json to not break other tests
      if (originalData) {
        fs.writeFileSync(PLUGIN_DATA_PATH, originalData);
      }

      // Reload to restore normal state
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(3000);
    }
  });

  test.fixme('reproduces issue #1187 - no UI option to re-enable bases in V4', async () => {
    /**
     * Part of the bug is that users have no way to re-enable bases through the UI
     * because the toggle was removed in V4.
     *
     * This test verifies that:
     * 1. The enableBases toggle is NOT present in settings
     * 2. Users who need to enable bases have no UI path to do so
     */
    const page = app.page;

    // Open plugin settings
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(500);

    // Navigate to TaskNotes settings
    const pluginSettings = page.locator('.vertical-tab-nav-item').filter({
      hasText: /tasknotes/i,
    });

    if (await pluginSettings.isVisible({ timeout: 2000 })) {
      await pluginSettings.click();
      await page.waitForTimeout(500);

      // Search for any setting related to "bases" or "enableBases"
      const settingsContent = page.locator('.vertical-tab-content');
      const basesToggle = settingsContent.locator('text=/enable.*bases|bases.*support/i');

      const hasBasesToggle = await basesToggle.isVisible({ timeout: 2000 }).catch(() => false);

      // In V4, the toggle was removed, so users can't enable/disable bases through UI
      console.log(`Bases toggle present in settings: ${hasBasesToggle}`);

      // This documents that there's no UI to manage the setting
      // Users must edit data.json manually
    }

    // Close settings
    await page.keyboard.press('Escape');
  });

  test.fixme('reproduces issue #1187 - settings migration should handle enableBases', async () => {
    /**
     * The ideal fix would be for the settings migration to handle this case.
     *
     * Possible solutions:
     * 1. Force enableBases: true during migration if the setting UI is gone
     * 2. Remove enableBases from settings entirely (always enabled in V4)
     * 3. Re-add the UI toggle if it should remain configurable
     *
     * This test documents the expected migration behavior.
     */
    const page = app.page;

    // Simulate a fresh upgrade scenario
    let originalData: string | null = null;
    if (fs.existsSync(PLUGIN_DATA_PATH)) {
      originalData = fs.readFileSync(PLUGIN_DATA_PATH, 'utf-8');
    }

    try {
      // Create settings as they would have been saved in pre-V4
      const preV4Settings = originalData ? JSON.parse(originalData) : {};
      preV4Settings.enableBases = false; // User had disabled this

      fs.writeFileSync(PLUGIN_DATA_PATH, JSON.stringify(preV4Settings, null, 2));

      // Reload to simulate the upgrade
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(3000);

      // After upgrade, read the settings again
      const postUpgradeData = JSON.parse(fs.readFileSync(PLUGIN_DATA_PATH, 'utf-8'));

      // EXPECTED behavior (not currently implemented):
      // The settings migration should detect that enableBases: false
      // exists but the UI toggle is gone, and should set it to true
      //
      // CURRENT behavior (the bug):
      // enableBases remains false, causing view registration to fail

      console.log(`enableBases after migration: ${postUpgradeData.enableBases}`);

      // This test documents what SHOULD happen after the fix
      // expect(postUpgradeData.enableBases).toBe(true);

    } finally {
      // Restore original settings
      if (originalData) {
        fs.writeFileSync(PLUGIN_DATA_PATH, originalData);
      }
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(3000);
    }
  });
});
