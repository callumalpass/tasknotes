/**
 * Issue #1153: [Bug] Views don't appear; clicking to open them suggests text applications
 *
 * User reported that after updating plugins, TaskNotes views no longer appear. When
 * clicking to open them (e.g., .base files), the system suggests text applications
 * instead of opening the view, as if the plugin weren't activated.
 *
 * This is a symptom of Bases view types not being registered properly. The issue
 * is related to #1187 where the same behavior occurs when `enableBases: false`
 * is saved in settings from a previous version.
 *
 * Possible root causes:
 * 1. `enableBases: false` persisted in data.json from older version
 * 2. Obsidian version < 1.10.1 (required for public Bases API with groupBy support)
 * 3. Bases internal plugin is disabled in Obsidian
 * 4. View registration failed silently during plugin load
 * 5. Plugin load order issue where Bases wasn't ready when TaskNotes tried to register
 *
 * Symptoms:
 * - .base files open with "Open with..." dialog instead of Bases views
 * - TaskNotes commands to open views don't work
 * - Views appear blank or show file picker
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1153
 * @see https://github.com/callumalpass/tasknotes/issues/1187 (related)
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const E2E_VAULT_DIR = path.join(PROJECT_ROOT, 'tasknotes-e2e-vault');
const PLUGIN_DATA_PATH = path.join(E2E_VAULT_DIR, '.obsidian/plugins/tasknotes/data.json');

let app: ObsidianApp;

test.describe('Issue #1153: Views don\'t appear after plugin update', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #1153 - views should appear after plugin update',
    async () => {
      /**
       * This test verifies that TaskNotes views are properly registered and
       * can be opened after a plugin update.
       *
       * Current behavior (bug):
       * - Views don't appear
       * - Clicking to open views shows "Open with..." dialog suggesting text apps
       * - Plugin appears as if it weren't activated
       *
       * Expected behavior:
       * - Views should be properly registered with Obsidian
       * - Opening .base files should show the appropriate TaskNotes view
       * - TaskNotes commands should successfully open views
       */
      const page = app.page;

      // First verify the plugin is enabled
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      // Navigate to Community plugins to verify TaskNotes is enabled
      const communityPlugins = page.locator('.vertical-tab-nav-item').filter({
        hasText: /community plugins/i,
      });

      if (await communityPlugins.isVisible({ timeout: 2000 })) {
        await communityPlugins.click();
        await page.waitForTimeout(300);

        // Find TaskNotes in the list
        const taskNotesPlugin = page.locator('.installed-plugin-item').filter({
          hasText: /tasknotes/i,
        });

        if (await taskNotesPlugin.isVisible({ timeout: 2000 })) {
          // Check if the toggle is on
          const toggle = taskNotesPlugin.locator('.checkbox-container');
          const isEnabled = await toggle.evaluate((el) =>
            el.classList.contains('is-enabled')
          );

          console.log(`TaskNotes plugin enabled: ${isEnabled}`);
          expect(isEnabled).toBe(true);
        }
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Try to open a TaskNotes view via command
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(1500);

      // Check if the view opened or if we got an error
      // The view should be visible as a workspace leaf
      const taskListLeaf = page.locator(
        '.workspace-leaf-content[data-type*="tasknotesTaskList"], ' +
        '.workspace-leaf-content[data-type*="tasknotes"], ' +
        '.workspace-leaf .tasknotes-task-list, ' +
        '.bases-view'
      );

      const viewOpened = await taskListLeaf.isVisible({ timeout: 3000 }).catch(() => false);

      if (!viewOpened) {
        // Check for error notices
        const errorNotice = page.locator('.notice, .modal-container').filter({
          hasText: /unknown.*view|error|failed/i,
        });

        const hasError = await errorNotice.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasError) {
          const errorText = await errorNotice.textContent();
          console.log(`Error when opening view: ${errorText}`);
        }

        // Also check if a file picker / "Open with" dialog appeared
        const filePicker = page.locator(
          '.modal-container:has-text("Open with"), ' +
          '.modal-container:has-text("Choose an app"), ' +
          '.suggestion-container:has-text("text")'
        );

        const hasFilePicker = await filePicker.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasFilePicker) {
          console.log('CONFIRMED: "Open with" dialog appeared instead of view');
        }
      }

      // The test passes if the view opened correctly
      expect(viewOpened).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #1153 - opening .base file should show TaskNotes view, not file picker',
    async () => {
      /**
       * This test verifies that .base files open with TaskNotes views
       * instead of showing a file picker or text editor.
       *
       * The bug manifests when:
       * - User has .base files in their vault
       * - Clicking on them shows "Open with..." dialog
       * - Text applications are suggested instead of Bases views
       */
      const page = app.page;

      // Look for any .base files in the file explorer
      const fileExplorer = page.locator('.nav-files-container');
      await expect(fileExplorer).toBeVisible({ timeout: 5000 });

      // Search for a .base file
      const baseFile = page.locator('.nav-file-title[data-path$=".base"]').first();

      if (await baseFile.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Click on the .base file
        await baseFile.click();
        await page.waitForTimeout(1000);

        // Check what opened
        // If the bug is present, we'll see a file picker or text editor
        // If working correctly, we'll see a Bases view

        const textEditor = page.locator('.markdown-source-view, .cm-editor').filter({
          has: page.locator('text=/viewType|type.*tasknotesTaskList/'),
        });

        const hasTextEditor = await textEditor.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasTextEditor) {
          console.log('CONFIRMED: .base file opened in text editor instead of Bases view');
        }

        // Check for the file picker dialog
        const openWithDialog = page.locator('.modal-container').filter({
          hasText: /open with|choose.*app/i,
        });

        const hasOpenWithDialog = await openWithDialog.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasOpenWithDialog) {
          console.log('CONFIRMED: "Open with" dialog appeared for .base file');
        }

        // The expected behavior is to have a Bases view visible
        const basesView = page.locator(
          '.bases-view, ' +
          '.workspace-leaf-content[data-type="bases"], ' +
          '.tasknotes-task-list, ' +
          '.kanban-view, ' +
          '.calendar-view'
        );

        const hasBasesView = await basesView.isVisible({ timeout: 2000 }).catch(() => false);

        expect(hasBasesView).toBe(true);
      } else {
        console.log('No .base files found in vault - skipping file click test');
      }
    }
  );

  test.fixme(
    'reproduces issue #1153 - verifies Bases view types are registered',
    async () => {
      /**
       * This test checks that TaskNotes view types are properly registered
       * with the Bases plugin. If views don't appear, this registration
       * may have failed.
       *
       * Registration can fail if:
       * 1. enableBases setting is false
       * 2. Obsidian API version < 1.10.1
       * 3. Bases plugin is not available
       * 4. registerBasesView function is not available on plugin
       */
      const page = app.page;

      // Check console for registration messages
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[TaskNotes][Bases]')) {
          consoleMessages.push(text);
        }
      });

      // Reload the plugin to capture registration logs
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(5000);

      // Log any Bases-related messages
      console.log('Bases registration messages:');
      consoleMessages.forEach((msg) => console.log(`  ${msg}`));

      // Check if registration succeeded or failed
      const hasSuccessMessage = consoleMessages.some((msg) =>
        msg.includes('Successfully registered view')
      );

      const hasFailureMessage = consoleMessages.some((msg) =>
        msg.includes('Failed to register') ||
        msg.includes('not available') ||
        msg.includes('returned false')
      );

      if (hasFailureMessage) {
        console.log('CONFIRMED: Bases view registration failed');
      }

      // After plugin load, try to open a view
      await page.waitForTimeout(2000);
      await runCommand(page, 'TaskNotes: Open task list');
      await page.waitForTimeout(1500);

      const viewOpened = await page
        .locator('.workspace-leaf-content[data-type*="tasknotesTaskList"], .bases-view')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(viewOpened).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #1153 - checks enableBases setting in data.json',
    async () => {
      /**
       * This test checks if the enableBases setting might be causing
       * the view registration to fail. This is related to issue #1187.
       *
       * If enableBases is false in data.json, views won't be registered.
       */
      const page = app.page;

      // Read the plugin data.json
      if (fs.existsSync(PLUGIN_DATA_PATH)) {
        const dataJson = JSON.parse(fs.readFileSync(PLUGIN_DATA_PATH, 'utf-8'));

        console.log(`enableBases setting value: ${dataJson.enableBases}`);

        // If enableBases is explicitly false, that's likely the cause
        if (dataJson.enableBases === false) {
          console.log('CONFIRMED: enableBases is false - this prevents view registration');
          console.log('Workaround: Set enableBases to true in data.json and reload');
        }

        // The setting should be true (or undefined, which defaults to true)
        expect(dataJson.enableBases).not.toBe(false);
      } else {
        console.log('Plugin data.json not found - using defaults');
      }
    }
  );

  test.fixme(
    'reproduces issue #1153 - verifies Obsidian version compatibility',
    async () => {
      /**
       * TaskNotes Bases views require Obsidian 1.10.1+ for the public
       * Bases API with groupBy support. Older versions won't have
       * views registered.
       */
      const page = app.page;

      // Get Obsidian version from the app
      const obsidianVersion = await page.evaluate(() => {
        // @ts-expect-error - accessing Obsidian internals
        return (window as any).app?.manifest?.version ||
          // @ts-expect-error - alternative access
          (window as any).electron?.app?.getVersion?.() ||
          'unknown';
      });

      console.log(`Obsidian version: ${obsidianVersion}`);

      if (obsidianVersion !== 'unknown') {
        // Parse version and check against 1.10.1
        const [major, minor, patch] = obsidianVersion.split('.').map(Number);

        const meetsMinVersion =
          major > 1 ||
          (major === 1 && minor > 10) ||
          (major === 1 && minor === 10 && patch >= 1);

        if (!meetsMinVersion) {
          console.log(
            `CONFIRMED: Obsidian version ${obsidianVersion} < 1.10.1 - ` +
            'Bases views require 1.10.1+'
          );
        }

        expect(meetsMinVersion).toBe(true);
      }
    }
  );

  test.fixme(
    'reproduces issue #1153 - verifies Bases internal plugin is enabled',
    async () => {
      /**
       * The Bases plugin must be enabled for TaskNotes views to register.
       * This test checks if Bases is available and enabled.
       */
      const page = app.page;

      // Check if Bases plugin is enabled via the API
      const basesEnabled = await page.evaluate(() => {
        // @ts-expect-error - accessing Obsidian internals
        const app = (window as any).app;
        const internalPlugins = app?.internalPlugins;

        if (!internalPlugins) {
          return { available: false, reason: 'Internal plugins not accessible' };
        }

        const basesPlugin = internalPlugins.getEnabledPluginById?.('bases');

        if (!basesPlugin) {
          // Check if it exists but is disabled
          const allPlugins = internalPlugins.plugins || {};
          const basesExists = 'bases' in allPlugins;

          if (basesExists) {
            return { available: false, reason: 'Bases plugin exists but is disabled' };
          }
          return { available: false, reason: 'Bases plugin not found' };
        }

        return {
          available: true,
          hasRegistrations: !!basesPlugin.registrations,
          registrationCount: Object.keys(basesPlugin.registrations || {}).length,
        };
      });

      console.log('Bases plugin status:', basesEnabled);

      if (!basesEnabled.available) {
        console.log(`CONFIRMED: Bases plugin issue - ${basesEnabled.reason}`);
      }

      expect(basesEnabled.available).toBe(true);
    }
  );
});
