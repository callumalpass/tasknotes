/**
 * Issue #819: [FR] Command to Edit an Inline Task
 *
 * Feature request for a command to view/edit an inline task while the cursor
 * is positioned over it, similar to "Show quick actions for current task"
 * but for inline task references (wikilinks to task notes).
 *
 * Current state:
 * - "Quick actions for current task" command exists for task note files
 * - Task Link Overlays provide inline task display with clickable elements
 * - No command exists to trigger edit/actions from cursor position on inline task
 *
 * Requested behavior:
 * - When cursor is over/within an inline task (wikilink to a task note)
 * - User can invoke a command to view/edit that task
 * - Should work similar to "Show quick actions for current task"
 * - Opens TaskActionPaletteModal or TaskEditModal for the referenced task
 *
 * Implementation considerations:
 * - Need to detect cursor position within a task link
 * - Parse the link target to identify the task note
 * - Reuse existing TaskActionPaletteModal or TaskEditModal
 * - Add new command "Quick actions for inline task at cursor"
 * - Register command in main.ts commandDefinitions
 *
 * Affected areas:
 * - src/main.ts (new command registration)
 * - src/editor/TaskLinkOverlay.ts (cursor position detection utilities)
 * - src/modals/TaskActionPaletteModal.ts (modal invocation)
 * - src/i18n/resources/ (translation keys)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/819
 * @see src/modals/TaskActionPaletteModal.ts (existing quick actions modal)
 * @see docs/features/inline-tasks.md (inline task documentation)
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #819: Command to edit inline task at cursor', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #819 - command should exist for inline task quick actions', async () => {
    /**
     * A command should exist to show quick actions for the inline task under cursor.
     *
     * Expected behavior:
     * - Command "Quick actions for inline task" or similar exists
     * - Available in command palette
     * - Can be assigned a hotkey
     */
    const page = app.page;

    // Open command palette
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(500);

    // Search for inline task related commands
    await page.keyboard.type('inline task');
    await page.waitForTimeout(500);

    // Look for a command related to editing/actions for inline task
    const inlineTaskCommand = page.locator('.suggestion-item:has-text("inline task"), .suggestion-content:has-text("inline task")');
    const commandExists = await inlineTaskCommand.first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Inline task action command exists: ${commandExists}`);

    // Close command palette
    await page.keyboard.press('Escape');

    // After implementation:
    // expect(commandExists).toBe(true);
  });

  test.fixme('reproduces issue #819 - command opens quick actions when cursor on task link', async () => {
    /**
     * When cursor is positioned on an inline task (wikilink to task note),
     * the command should open quick actions for that task.
     *
     * Expected behavior:
     * 1. Create a note with inline task reference
     * 2. Position cursor on the task link
     * 3. Run command
     * 4. TaskActionPaletteModal opens for the referenced task
     */
    const page = app.page;

    // Create a new note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    // Type content with a task reference (assuming a task exists)
    await page.keyboard.type('# Project Notes\n\n');
    await page.keyboard.type('Working on: [[');
    await page.waitForTimeout(300);

    // Type task name (would trigger autocomplete in real scenario)
    await page.keyboard.type('Test Task');
    await page.keyboard.type(']]');
    await page.waitForTimeout(500);

    // Move cursor back into the link
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    // Try to run the inline task quick actions command
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(500);
    await page.keyboard.type('quick actions inline');
    await page.waitForTimeout(500);

    // Check if command appears and can be executed
    const actionCommand = page.locator('.suggestion-item:has-text("inline"), .suggestion-content:has-text("inline")');
    const commandAvailable = await actionCommand.first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Quick actions for inline task command available: ${commandAvailable}`);

    // Close modal/palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');

    // After implementation:
    // - Command should be found
    // - Executing it should open TaskActionPaletteModal
    // expect(commandAvailable).toBe(true);
  });

  test.fixme('reproduces issue #819 - command shows error when cursor not on task link', async () => {
    /**
     * When cursor is NOT on an inline task, the command should show
     * an appropriate message/notice.
     *
     * Expected behavior:
     * - Run command with cursor on plain text
     * - Notice appears: "No inline task at cursor position" or similar
     * - No modal opens
     */
    const page = app.page;

    // Create a new note with plain text
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    await page.keyboard.type('# Plain Note\n\n');
    await page.keyboard.type('This is just regular text without any task links.');
    await page.waitForTimeout(300);

    // Position cursor in middle of plain text
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // Try to run the inline task quick actions command
    await runCommand(page, 'Quick actions for inline task');
    await page.waitForTimeout(500);

    // Check for notice/error message
    const notice = page.locator('.notice:has-text("task"), .notice:has-text("cursor")');
    const noticeVisible = await notice.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Error notice shown when no task at cursor: ${noticeVisible}`);

    // Close any dialogs
    await page.keyboard.press('Escape');

    // After implementation:
    // - Should show a notice that there's no inline task at cursor
    // expect(noticeVisible).toBe(true);
  });

  test.fixme('reproduces issue #819 - command detects task link under cursor correctly', async () => {
    /**
     * The command should correctly identify when cursor is within a task wikilink.
     *
     * Expected behavior:
     * - Cursor at start of [[TaskName]] - command works
     * - Cursor in middle of [[TaskName]] - command works
     * - Cursor at end of [[TaskName]] - command works
     * - Cursor just before [[ or after ]] - command does not work
     */
    const page = app.page;

    // Create note with task link
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    await page.keyboard.type('Before [[Test Task]] After');
    await page.waitForTimeout(300);

    // Test different cursor positions
    // Position 1: Just inside the opening [[
    await page.keyboard.press('Home');
    for (let i = 0; i < 9; i++) { // Move to after [[
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(100);

    // The command should recognize this as being on an inline task
    // (actual test would invoke command and check result)

    console.log('Test: Cursor positioning for inline task detection');
    console.log('- Cursor just after [[ should detect task');
    console.log('- Cursor in middle of task name should detect task');
    console.log('- Cursor just before ]] should detect task');
    console.log('- Cursor before [[ or after ]] should NOT detect task');

    // Close any dialogs
    await page.keyboard.press('Escape');

    // After implementation:
    // - Test each cursor position and verify detection
  });

  test.fixme('reproduces issue #819 - command works with aliased task links', async () => {
    /**
     * The command should work with aliased wikilinks like [[Task Note|Display Name]].
     *
     * Expected behavior:
     * - [[Task Note|My Task]] - cursor on alias still detects Task Note
     * - Opens quick actions for "Task Note", not the alias
     */
    const page = app.page;

    // Create note with aliased task link
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    await page.keyboard.type('Working on [[Test Task|Important Work]]');
    await page.waitForTimeout(300);

    // Move cursor into the aliased link
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    console.log('Test: Aliased task link detection');
    console.log('- Cursor on alias "Important Work" should still detect "Test Task"');
    console.log('- Quick actions should open for "Test Task" not the alias');

    // Close any dialogs
    await page.keyboard.press('Escape');

    // After implementation:
    // - Verify the correct task (not alias) is identified
  });

  test.fixme('reproduces issue #819 - quick actions modal shows correct task info', async () => {
    /**
     * When the command opens TaskActionPaletteModal, it should show
     * actions for the referenced task, not the current note.
     *
     * Expected behavior:
     * - Modal title shows the referenced task name
     * - Actions affect the referenced task (status change, etc.)
     * - Current note remains unchanged
     */
    const page = app.page;

    // This test would require:
    // 1. A note containing [[Task Note]] reference
    // 2. Cursor positioned on the reference
    // 3. Running the new command
    // 4. Verifying modal shows Task Note info, not current note

    console.log('Test: Quick actions modal displays correct task');
    console.log('- Modal should show referenced task title');
    console.log('- Status actions should affect referenced task');
    console.log('- Priority actions should affect referenced task');
    console.log('- Current containing note should remain unchanged');

    // After implementation:
    // - Open modal and verify task name in header
    // - Perform an action and verify it affected the right task
  });

  test.fixme('reproduces issue #819 - command can be triggered via hotkey', async () => {
    /**
     * Users should be able to assign a hotkey to quickly invoke this command.
     *
     * Expected behavior:
     * - Command appears in hotkey settings
     * - Hotkey can be assigned
     * - Hotkey triggers the command when pressed
     */
    const page = app.page;

    // Open hotkey settings
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(500);

    // Navigate to hotkeys tab
    const hotkeysTab = page.locator('.vertical-tab-nav-item:has-text("Hotkeys")');
    if (await hotkeysTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hotkeysTab.click();
      await page.waitForTimeout(300);
    }

    // Search for the inline task command
    const searchInput = page.locator('.hotkey-search-container input, input[placeholder*="filter"]');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('inline task');
      await page.waitForTimeout(300);
    }

    // Check if command appears in hotkey list
    const hotkeyItem = page.locator('.hotkey-search-results .setting-hotkey, .setting-item:has-text("inline task")');
    const commandInHotkeys = await hotkeyItem.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Command available in hotkey settings: ${commandInHotkeys}`);

    // Close settings
    await page.keyboard.press('Escape');

    // After implementation:
    // expect(commandInHotkeys).toBe(true);
  });

  test.fixme('reproduces issue #819 - edit action from quick actions opens task editor', async () => {
    /**
     * Selecting "Edit task details" from quick actions should open
     * the full TaskEditModal for the inline task.
     *
     * Expected behavior:
     * - Quick actions modal shows "Edit task details" option
     * - Selecting it opens TaskEditModal
     * - TaskEditModal shows the referenced task's details
     * - Changes affect the referenced task file
     */
    const page = app.page;

    console.log('Test: Edit action from inline task quick actions');
    console.log('- Quick actions should include "Edit task details"');
    console.log('- Selecting it opens TaskEditModal');
    console.log('- Modal displays referenced task info');
    console.log('- Saving changes updates the task file');

    // After implementation:
    // 1. Position cursor on inline task
    // 2. Run quick actions command
    // 3. Select "Edit task details"
    // 4. Verify TaskEditModal opens with correct task
    // 5. Make a change and save
    // 6. Verify task file was updated
  });
});
