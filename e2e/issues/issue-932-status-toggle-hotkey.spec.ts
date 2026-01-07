/**
 * Issue #932: [FR] Status toggle with hot key
 *
 * Feature Request Description:
 * Currently status can be manually changed only with mouse clicks.
 * The user is requesting a keyboard shortcut to cycle across different statuses,
 * similar to how Obsidian's checkbox status toggle works.
 *
 * Current behavior:
 * - Status can be changed by clicking the status dot on task cards (cycles through statuses)
 * - Status can be changed via the context menu
 * - There is no keyboard shortcut/hotkey to cycle status
 *
 * Requested behavior:
 * - A hotkey command that cycles through task statuses
 * - Should work when viewing a task note in the editor
 * - Similar to Obsidian's built-in checkbox toggle (Cmd/Ctrl+Enter)
 *
 * Implementation approach:
 * - Add a new command "toggle-task-status" or "cycle-task-status"
 * - Use editorCallback to get the active file and toggle its status
 * - Leverage existing StatusManager.getNextStatus() for cycling logic
 * - Optionally support Shift modifier to cycle backwards (like status dot click)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/932
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #932: Status toggle with hotkey', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'FR #932 - command to cycle task status forward should exist',
    async () => {
      /**
       * This test verifies that a command exists to cycle task status forward.
       *
       * Expected command behavior:
       * - Command available in command palette (e.g., "TaskNotes: Cycle task status")
       * - When executed on a task note, cycles status to the next value
       * - Status order follows the configured status order in settings
       * - Default cycle: backlog → open → in-progress → done → backlog
       */
      const page = app.page;

      // Open command palette
      await page.keyboard.press('ControlOrMeta+p');
      await page.waitForTimeout(500);

      const commandPalette = page.locator('.prompt, .suggestion-container');
      await expect(commandPalette).toBeVisible({ timeout: 3000 });

      // Search for status cycle/toggle command
      await page.keyboard.type('TaskNotes cycle status');
      await page.waitForTimeout(300);

      // Look for the command in suggestions
      const suggestions = page.locator('.suggestion-item, .prompt-results .suggestion');
      const suggestionCount = await suggestions.count();

      // Get all suggestion texts
      const suggestionTexts: string[] = [];
      for (let i = 0; i < suggestionCount; i++) {
        const text = await suggestions.nth(i).textContent();
        if (text) suggestionTexts.push(text.toLowerCase());
      }

      console.log('Found suggestions:', suggestionTexts);

      // Close command palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Feature request: command should exist
      // The command name might be: "Cycle task status", "Toggle task status", "Next task status"
      const hasStatusCycleCommand = suggestionTexts.some(
        (text) =>
          (text.includes('cycle') || text.includes('toggle') || text.includes('next')) &&
          text.includes('status')
      );

      expect(hasStatusCycleCommand).toBe(true);
    }
  );

  test.fixme(
    'FR #932 - cycle status command should cycle through statuses when executed',
    async () => {
      /**
       * This test verifies that the cycle status command actually changes
       * the task status when executed on a task note.
       *
       * Steps:
       * 1. Create or open a task with status "open"
       * 2. Execute the cycle status command
       * 3. Verify status changed to "in-progress" (next status)
       * 4. Execute again
       * 5. Verify status changed to "done" (next status)
       */
      const page = app.page;

      // Create a new task with default status
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await taskModal.isVisible({ timeout: 3000 })) {
        // Set a title
        const titleInput = taskModal.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 1000 })) {
          await titleInput.fill('Test task for status cycling');
        }

        // Save the task
        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save|create/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // The task note should now be open
      // Check current status in frontmatter
      await page.keyboard.press('ControlOrMeta+e'); // Toggle to source mode
      await page.waitForTimeout(300);

      const editor = page.locator('.cm-editor .cm-content');
      let sourceContent = await editor.textContent().catch(() => '');

      // Extract current status
      const statusMatch = sourceContent.match(/status:\s*(\w+[-\w]*)/);
      const initialStatus = statusMatch ? statusMatch[1] : 'unknown';
      console.log('Initial status:', initialStatus);

      // Switch back to reading mode
      await page.keyboard.press('ControlOrMeta+e');
      await page.waitForTimeout(300);

      // Execute the cycle status command
      await runCommand(page, 'TaskNotes: Cycle task status');
      await page.waitForTimeout(500);

      // Check if status changed
      await page.keyboard.press('ControlOrMeta+e'); // Back to source mode
      await page.waitForTimeout(300);

      sourceContent = await editor.textContent().catch(() => '');
      const newStatusMatch = sourceContent.match(/status:\s*(\w+[-\w]*)/);
      const newStatus = newStatusMatch ? newStatusMatch[1] : 'unknown';
      console.log('New status after cycle:', newStatus);

      // Status should have changed to the next value
      expect(newStatus).not.toBe(initialStatus);

      // Verify status cycled forward according to default order
      // Default: backlog(0) → open(1) → in-progress(2) → done(3)
      const statusOrder = ['backlog', 'open', 'in-progress', 'done'];
      const initialIndex = statusOrder.indexOf(initialStatus);
      const expectedNextIndex = (initialIndex + 1) % statusOrder.length;
      const expectedNextStatus = statusOrder[expectedNextIndex];

      if (initialIndex >= 0) {
        expect(newStatus).toBe(expectedNextStatus);
      }
    }
  );

  test.fixme(
    'FR #932 - hotkey should be assignable to cycle status command',
    async () => {
      /**
       * This test verifies that users can assign a custom hotkey to the
       * cycle status command through Obsidian's hotkey settings.
       *
       * Expected behavior:
       * - Command appears in Obsidian's Hotkeys settings
       * - User can assign a custom hotkey (e.g., Cmd+Shift+S)
       * - Pressing the hotkey cycles the status
       */
      const page = app.page;

      // Open settings
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });

      // Navigate to Hotkeys tab
      const hotkeysTab = page.locator('.vertical-tab-nav-item:has-text("Hotkeys")');
      if (await hotkeysTab.isVisible({ timeout: 2000 })) {
        await hotkeysTab.click();
        await page.waitForTimeout(500);
      }

      // Search for the cycle status command
      const searchInput = page.locator(
        '.setting-item input[type="text"], .hotkey-search-container input'
      );
      if (await searchInput.isVisible({ timeout: 2000 })) {
        await searchInput.fill('tasknotes cycle status');
        await page.waitForTimeout(500);
      }

      // Look for the command in the filtered list
      const hotkeyItems = page.locator('.setting-item, .hotkey-setting-item');
      const itemCount = await hotkeyItems.count();

      console.log('Hotkey items found:', itemCount);

      let commandFound = false;
      for (let i = 0; i < itemCount; i++) {
        const item = hotkeyItems.nth(i);
        const text = await item.textContent();
        if (
          text &&
          text.toLowerCase().includes('tasknotes') &&
          (text.toLowerCase().includes('cycle') ||
            text.toLowerCase().includes('toggle') ||
            text.toLowerCase().includes('status'))
        ) {
          commandFound = true;
          console.log('Found command in hotkeys:', text);
          break;
        }
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Feature request: command should appear in hotkeys settings
      expect(commandFound).toBe(true);
    }
  );

  test.fixme(
    'FR #932 - command should work with Shift modifier to cycle backwards',
    async () => {
      /**
       * This test verifies that there's a way to cycle status backwards,
       * similar to how Shift+Click on status dot cycles backwards.
       *
       * Two possible implementations:
       * 1. Shift+hotkey cycles backwards (same command)
       * 2. Separate command for cycle backwards
       *
       * Expected behavior:
       * - With modifier/separate command: done → in-progress → open → backlog
       */
      const page = app.page;

      // Create a task with "done" status
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await taskModal.isVisible({ timeout: 3000 })) {
        // Set a title
        const titleInput = taskModal.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 1000 })) {
          await titleInput.fill('Test task for backwards status cycling');
        }

        // Set status to "done"
        const statusSelector = taskModal.locator(
          '[data-field="status"], .status-selector, .status-dropdown'
        );
        if (await statusSelector.isVisible({ timeout: 1000 })) {
          await statusSelector.click();
          await page.waitForTimeout(300);

          // Select "done" from dropdown
          const doneOption = page.locator('.menu-item, .suggestion-item').filter({
            hasText: /^done$/i,
          });
          if (await doneOption.isVisible({ timeout: 1000 })) {
            await doneOption.click();
            await page.waitForTimeout(300);
          }
        }

        // Save the task
        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save|create/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Check initial status is "done"
      await page.keyboard.press('ControlOrMeta+e');
      await page.waitForTimeout(300);

      const editor = page.locator('.cm-editor .cm-content');
      let sourceContent = await editor.textContent().catch(() => '');

      const statusMatch = sourceContent.match(/status:\s*(\w+[-\w]*)/);
      const initialStatus = statusMatch ? statusMatch[1] : 'unknown';
      console.log('Initial status:', initialStatus);

      // Switch back to reading mode
      await page.keyboard.press('ControlOrMeta+e');
      await page.waitForTimeout(300);

      // Try the cycle backwards command (or cycle with Shift)
      // The exact implementation might be either a separate command or Shift modifier
      await runCommand(page, 'TaskNotes: Cycle task status backwards');
      await page.waitForTimeout(500);

      // Check if status changed backwards
      await page.keyboard.press('ControlOrMeta+e');
      await page.waitForTimeout(300);

      sourceContent = await editor.textContent().catch(() => '');
      const newStatusMatch = sourceContent.match(/status:\s*(\w+[-\w]*)/);
      const newStatus = newStatusMatch ? newStatusMatch[1] : 'unknown';
      console.log('New status after backwards cycle:', newStatus);

      // If started from "done", backwards should go to "in-progress"
      if (initialStatus === 'done') {
        expect(newStatus).toBe('in-progress');
      }
    }
  );

  test.fixme(
    'FR #932 - status cycle should respect custom status order from settings',
    async () => {
      /**
       * This test verifies that the cycle command respects the user's
       * custom status configuration, including:
       * - Custom status values
       * - Custom status order
       * - Skipping certain statuses (if configured)
       */
      const page = app.page;

      // First, check what statuses are configured
      await runCommand(page, 'Settings');
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.modal');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });

      // Navigate to TaskNotes settings
      const tasknotesTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")');
      if (await tasknotesTab.isVisible({ timeout: 2000 })) {
        await tasknotesTab.click();
        await page.waitForTimeout(300);
      }

      // Look for status configuration section
      const statusSection = page.locator('.setting-item:has-text("Status"), [data-setting="status"]');
      const statusConfigVisible = await statusSection.first().isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Status configuration section visible:', statusConfigVisible);

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // The test verifies that whatever order is configured in settings,
      // the cycle command should follow that order
      // This is documentation of expected behavior for the feature
    }
  );

  test.fixme(
    'FR #932 - cycle status should show notice with new status',
    async () => {
      /**
       * This test verifies that when status is cycled via hotkey,
       * a notice is shown to confirm the new status.
       *
       * Expected behavior:
       * - Execute cycle status command
       * - Notice appears showing the new status (e.g., "Task marked as 'in-progress'")
       * - Similar to the toggleTaskStatus() behavior in main.ts
       */
      const page = app.page;

      // Open an existing task or create one
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const taskModal = page.locator('.tasknotes-modal.minimalist-task-modal');
      if (await taskModal.isVisible({ timeout: 3000 })) {
        const titleInput = taskModal.locator('input[type="text"]').first();
        if (await titleInput.isVisible({ timeout: 1000 })) {
          await titleInput.fill('Test task for status notice');
        }

        const saveButton = taskModal.locator('button.mod-cta').filter({ hasText: /save|create/i });
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Clear any existing notices
      const existingNotices = page.locator('.notice');
      const existingCount = await existingNotices.count();
      for (let i = 0; i < existingCount; i++) {
        const closeBtn = existingNotices.nth(i).locator('.notice-close, .close-button');
        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeBtn.click();
        }
      }
      await page.waitForTimeout(300);

      // Execute cycle status command
      await runCommand(page, 'TaskNotes: Cycle task status');
      await page.waitForTimeout(500);

      // Look for status change notice
      const statusNotice = page.locator('.notice').filter({
        hasText: /marked as|status changed|now/i,
      });

      const noticeVisible = await statusNotice.isVisible({ timeout: 2000 }).catch(() => false);
      if (noticeVisible) {
        const noticeText = await statusNotice.textContent();
        console.log('Status notice:', noticeText);
      }

      // Feature request: notice should be shown
      expect(noticeVisible).toBe(true);
    }
  );

  test.fixme(
    'FR #932 - cycle status should work for current task when in task list view',
    async () => {
      /**
       * This test explores whether the cycle status command should also work
       * when viewing tasks in a list view, operating on the currently selected task.
       *
       * This might be a stretch goal for the feature request.
       *
       * Possible behaviors:
       * 1. Only works when task note is open in editor
       * 2. Works on selected task in task list
       * 3. Works on task under cursor in editor (for inline tasks)
       */
      const page = app.page;

      // Open Task List view
      await runCommand(page, 'TaskNotes: Open Task List');
      await page.waitForTimeout(1000);

      const taskList = page.locator('.tasknotes-plugin, .bases-container');
      await expect(taskList).toBeVisible({ timeout: 10000 });

      // Select a task card
      const taskCards = page.locator('.task-card');
      const cardCount = await taskCards.count();

      if (cardCount > 0) {
        const firstCard = taskCards.first();
        await firstCard.click();
        await page.waitForTimeout(300);

        // Try to execute cycle status command
        await runCommand(page, 'TaskNotes: Cycle task status');
        await page.waitForTimeout(500);

        // Check if status was cycled (would need to verify via notice or visual change)
        const notice = page.locator('.notice');
        const noticeVisible = await notice.isVisible({ timeout: 1000 }).catch(() => false);

        console.log('Notice shown after cycle in list view:', noticeVisible);

        // This documents the expected behavior for the feature
        // Implementation decision: Should this work in list view?
      }
    }
  );
});
