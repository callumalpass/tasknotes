/**
 * Issue #1046: [Bug]: Task links in notes change format when I edit a task in a side panel
 *
 * Bug description:
 * When a user has task links in their daily note (showing rich format with status
 * circle, priority, and scheduled date), and they edit a task in a side panel,
 * the task links in the daily note revert to plain underlined text links.
 * The rich format only returns when the user clicks on the daily note again.
 *
 * Root cause:
 * The TaskLinkOverlay (ViewPlugin) refreshes decorations via EVENT_TASK_UPDATED,
 * but when a side panel has focus, the main note's editor view may not properly
 * receive or process the update event. The decorations appear to be invalidated
 * but not rebuilt until the leaf becomes active again (triggering active-leaf-change).
 *
 * The issue is in the event dispatch mechanism:
 * 1. main.ts iterateRootLeaves() dispatches taskUpdateEffect to all markdown views
 * 2. However, if the view isn't fully visible/active, the decoration rebuild may not
 *    complete properly or the widget cache (activeWidgets) may not be cleared correctly
 * 3. The active-leaf-change listener in main.ts calls dispatchTaskUpdate() when
 *    returning to a note, which fixes the issue
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1046
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1046: Task link format changes when editing in side panel', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1046 - task links revert to plain text after side panel edit', async () => {
    /**
     * This test reproduces the core bug: task links in a daily note lose their
     * rich formatting (status circle, priority, scheduled date) when editing
     * a task in a side panel, until the user clicks back on the daily note.
     *
     * Steps to reproduce:
     * 1. Create a task in a TaskNotes base
     * 2. Create a daily note with a wikilink to that task
     * 3. Verify the task link shows rich format (TaskLinkWidget)
     * 4. Open the task in a side panel (split view)
     * 5. Edit the task in the side panel
     * 6. Check the daily note's task link format WITHOUT clicking on it
     * 7. Expected: Rich format should persist
     * 8. Actual (bug): Task link reverts to plain underlined text
     */
    const page = app.page;

    // Step 1: Open the task list view to get tasks
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1500);

    // Find a task to work with
    const taskCard = page.locator('.task-card, .bases-item').first();
    const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasTask) {
      console.log('No tasks available - creating one');
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Test Task for Issue 1046');
      }

      const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createButton.click();
      }
      await page.waitForTimeout(1500);
    }

    // Get the task title/path for linking
    // We'll create a daily note with a link to this task
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Step 2: Create a "daily note" with a task link
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    // Type content including a task link
    // The task link should render as a TaskLinkWidget with rich formatting
    await page.keyboard.type('# Daily Note Test 1046\n\nHere is a task link:\n\n[[Test Task for Issue 1046]]\n\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1500);

    // Step 3: Verify the task link shows rich format
    // In live preview, TaskLinkWidget creates elements with .task-link-widget class
    // or uses createTaskCard() which includes status dots, priority dots, etc.
    const taskLinkWidget = page.locator('.task-link-widget, .task-card-inline, [class*="task-link"]').first();
    const hasRichFormat = await taskLinkWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Initial task link rich format visible:', hasRichFormat);

    if (!hasRichFormat) {
      // Try to find the link element and check its structure
      const internalLink = page.locator('.cm-hmd-internal-link, .internal-link').first();
      const linkVisible = await internalLink.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Basic internal link visible:', linkVisible);
    }

    // Step 4: Open the task in a side panel (split right)
    // Use Ctrl+Click to open in a new pane, or use the command
    await runCommand(page, 'Split right');
    await page.waitForTimeout(500);

    // Navigate to the task in the new pane
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Test Task for Issue 1046', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Verify we now have a split view with two panes
    const workspaceLeaves = page.locator('.workspace-leaf');
    const leafCount = await workspaceLeaves.count();
    console.log('Number of workspace leaves (panes):', leafCount);

    // Step 5: Edit the task in the side panel
    // The task should now be open in the right pane
    // Make a small edit to trigger the task update event
    const editor = page.locator('.workspace-leaf:last-child .cm-editor, .workspace-leaf:last-child .markdown-source-view');
    const editorVisible = await editor.isVisible({ timeout: 2000 }).catch(() => false);

    if (editorVisible) {
      await editor.click();
      await page.waitForTimeout(300);

      // Make an edit - add some text to the task content
      await page.keyboard.press('End');
      await page.keyboard.type('\n\nEdited via side panel at ' + Date.now(), { delay: 20 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(1000);
    }

    // Step 6: Check the daily note's task link format WITHOUT clicking on it
    // Focus should still be on the side panel (task note)
    // We need to check if the left pane (daily note) still shows rich formatting

    // Locate the first workspace leaf (should be the daily note)
    const dailyNotePane = page.locator('.workspace-leaf').first();

    // Check if task links in the daily note are still showing rich format
    const richTaskLinkInDailyNote = dailyNotePane.locator('.task-link-widget, .task-card-inline, [class*="task-link"]').first();
    const stillHasRichFormat = await richTaskLinkInDailyNote.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Task link rich format after side panel edit (without clicking):', stillHasRichFormat);

    // Check if the link has reverted to plain format
    const plainLink = dailyNotePane.locator('.cm-hmd-internal-link:not(.task-link-widget), a.internal-link').first();
    const hasPlainFormat = await plainLink.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Task link plain format detected:', hasPlainFormat);

    // The bug: Task link should maintain rich format, but reverts to plain
    // This assertion documents the expected behavior (should pass when fixed)
    // Currently, stillHasRichFormat will be false after the side panel edit
    expect(stillHasRichFormat).toBe(true);

    // Cleanup: Close the split pane
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1046 - task link format restores when clicking back on note', async () => {
    /**
     * This test verifies the workaround behavior: clicking on the note restores
     * the rich task link format. This happens because active-leaf-change triggers
     * dispatchTaskUpdate() in main.ts.
     *
     * This confirms the root cause is related to leaf focus and event dispatch.
     */
    const page = app.page;

    // Create a note with task link
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    await page.keyboard.type('# Daily Note Restore Test\n\n[[Test Task for Issue 1046]]\n\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1500);

    // Note the initial state of task links
    const initialWidget = page.locator('.task-link-widget, .task-card-inline').first();
    const initialRich = await initialWidget.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Initial rich format:', initialRich);

    // Open a side panel with a task
    await runCommand(page, 'Split right');
    await page.waitForTimeout(500);

    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Test Task for Issue 1046', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Edit the task in side panel
    const editor = page.locator('.workspace-leaf:last-child .cm-editor');
    if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editor.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('End');
      await page.keyboard.type('\n\nAnother edit ' + Date.now(), { delay: 20 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(1000);
    }

    // Check format in daily note (should be broken - plain text)
    const dailyNotePane = page.locator('.workspace-leaf').first();
    const beforeClick = dailyNotePane.locator('.task-link-widget, .task-card-inline').first();
    const beforeClickRich = await beforeClick.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Before clicking daily note - rich format:', beforeClickRich);

    // Now click on the daily note pane to trigger active-leaf-change
    await dailyNotePane.click();
    await page.waitForTimeout(1000);

    // Check format again - should be restored now
    const afterClick = page.locator('.task-link-widget, .task-card-inline').first();
    const afterClickRich = await afterClick.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('After clicking daily note - rich format:', afterClickRich);

    // The workaround works: clicking restores the format
    // But the bug is that it shouldn't require clicking
    expect(afterClickRich).toBe(true);

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1046 - EVENT_TASK_UPDATED dispatch to non-active leaves', async () => {
    /**
     * This test investigates whether EVENT_TASK_UPDATED properly triggers
     * decoration refresh in non-active leaves.
     *
     * Technical context from main.ts (line 662-682):
     * The taskUpdateListenerForEditor iterates all root leaves and dispatches
     * taskUpdateEffect. However, the ViewPlugin's update() may not properly
     * rebuild decorations if the view isn't the active one.
     *
     * The fix should ensure decorations are rebuilt regardless of which leaf
     * is currently active.
     */
    const page = app.page;

    // This test documents the technical issue with event dispatch

    // Open task list view first
    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1500);

    // Check if we can observe the task update events
    // We'll use the browser's console to monitor events
    await page.evaluate(() => {
      // Patch the event emitter to log events
      const workspace = (window as any).app?.workspace;
      if (workspace) {
        console.log('[Test] Workspace available');
        const originalTrigger = workspace.trigger?.bind(workspace);
        if (originalTrigger) {
          workspace.trigger = (event: string, ...args: any[]) => {
            if (event.includes('task') || event.includes('data')) {
              console.log(`[Test] Event triggered: ${event}`);
            }
            return originalTrigger(event, ...args);
          };
        }
      }
    });

    // Create two notes side by side
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);
    await page.keyboard.type('# Note A with task link\n\n[[Test Task]]\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1000);

    await runCommand(page, 'Split right');
    await page.waitForTimeout(500);

    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);
    await page.keyboard.type('# Note B - editing here\n\nSome content\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1000);

    // Edit in Note B (right pane, active)
    await page.keyboard.type('\nMore content ' + Date.now(), { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Capture console logs to see if events fired
    const consoleLogs = await page.evaluate(() => {
      return (window as any).testEventLogs || [];
    });

    console.log('Event logs:', consoleLogs);

    // The issue: Even though events fire, Note A's decorations may not update
    // because the ViewPlugin.update() doesn't properly rebuild when not active

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1046 - TaskLinkOverlay decoration state during side panel focus', async () => {
    /**
     * This test examines the TaskLinkOverlay ViewPlugin's behavior when
     * another pane has focus.
     *
     * From TaskLinkOverlay.ts:
     * - refreshDecorations() clears activeWidgets and dispatches taskUpdateEffect
     * - The update() method rebuilds decorations via buildDecorations()
     * - buildDecorations() creates TaskLinkWidget instances
     *
     * The issue may be:
     * 1. queueMicrotask in refreshDecorations() doesn't execute for non-active views
     * 2. The widget cache (activeWidgets) doesn't clear properly
     * 3. buildDecorations() returns early or produces incorrect results
     */
    const page = app.page;

    // Setup: Create a split view with daily note (left) and task (right)
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);
    await page.keyboard.type('# Decoration State Test\n\n[[Test Task for Issue 1046]]\n', { delay: 20 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1500);

    // Check initial decoration state
    const checkDecorationState = async () => {
      return await page.evaluate(() => {
        // Find CodeMirror editor views
        const editors = document.querySelectorAll('.cm-editor');
        const states: any[] = [];

        editors.forEach((editor, idx) => {
          const view = (editor as any).cmView?.view;
          if (view) {
            // Check for TaskLink decorations
            const decorations = view.state?.field?.(
              // Try to access the decoration state field
              // This is internal and may not be accessible
            );
            states.push({
              editorIndex: idx,
              hasView: true,
              // Check for task link widget elements
              hasTaskLinkWidgets: editor.querySelectorAll('.task-link-widget, .task-card-inline').length,
              hasInternalLinks: editor.querySelectorAll('.cm-hmd-internal-link').length,
            });
          } else {
            states.push({
              editorIndex: idx,
              hasView: false,
            });
          }
        });

        return states;
      });
    };

    const initialState = await checkDecorationState();
    console.log('Initial decoration state:', JSON.stringify(initialState, null, 2));

    // Split and open task in side panel
    await runCommand(page, 'Split right');
    await page.waitForTimeout(500);

    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);
    await page.keyboard.type('Test Task for Issue 1046', { delay: 30 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Edit task in side panel
    const editor = page.locator('.workspace-leaf:last-child .cm-editor');
    if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editor.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('End');
      await page.keyboard.type('\n\nDecoration test edit', { delay: 20 });
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(1500);
    }

    // Check decoration state after edit (focus still on side panel)
    const afterEditState = await checkDecorationState();
    console.log('Decoration state after side panel edit:', JSON.stringify(afterEditState, null, 2));

    // The bug: The first editor (daily note) should still have task link widgets
    // but they may have been removed or not rebuilt after the task update event

    // Expected: Both editors maintain proper decoration state
    // Actual: Left editor (daily note) loses task link widget decorations

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1046 - jarring UX when constantly switching between daily note and side panel', async () => {
    /**
     * This test documents the UX impact described by the user:
     * "it is really jarring to constantly have that happen as I switch back and forth"
     *
     * The user's workflow:
     * 1. Daily note open with task links (rich format showing status/priority/date)
     * 2. Open TaskNotes base in side panel
     * 3. Edit a task in side panel
     * 4. Look at daily note - task links are now plain text
     * 5. Click daily note - rich format returns
     * 6. Go back to side panel to edit another task
     * 7. Repeat - each time seeing the format change
     *
     * This creates visual "flashing" that disrupts the user's focus.
     */
    const page = app.page;

    console.log('Simulating user workflow with multiple back-and-forth edits...');

    // Setup: Daily note with multiple task links
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);
    await page.keyboard.type(`# My Daily Tasks\n
## Today's Focus

- [[Task 1]]
- [[Task 2]]
- [[Task 3]]

## Notes

Working on multiple tasks today.
`, { delay: 10 });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1500);

    // Record initial visual state
    const captureVisualState = async (label: string) => {
      const widgets = await page.locator('.task-link-widget, .task-card-inline').count();
      const plainLinks = await page.locator('.cm-hmd-internal-link').count();
      console.log(`[${label}] Task widgets: ${widgets}, Plain links: ${plainLinks}`);
      return { widgets, plainLinks };
    };

    const initial = await captureVisualState('Initial');

    // Split and open task list
    await runCommand(page, 'Split right');
    await page.waitForTimeout(500);

    await runCommand(page, 'TaskNotes: Open task list view');
    await page.waitForTimeout(1500);

    // Simulate multiple edit cycles
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Edit cycle ${i} ---`);

      // Click on a task card in the side panel to edit
      const taskCard = page.locator('.workspace-leaf:last-child .task-card, .workspace-leaf:last-child .bases-item').first();
      if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await taskCard.click();
        await page.waitForTimeout(1000);

        // Make a quick edit if modal appears
        const modal = page.locator('.modal');
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Close modal after "editing"
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // Check daily note state WITHOUT clicking on it
      const afterEdit = await captureVisualState(`After edit ${i} (no click)`);

      // User notices the format change - this is the jarring experience
      // The expectation is that widgets should remain visible
      if (afterEdit.widgets < initial.widgets) {
        console.log(`  -> BUG: Lost ${initial.widgets - afterEdit.widgets} task widgets!`);
      }

      // Simulate clicking back on daily note
      const dailyNotePane = page.locator('.workspace-leaf').first();
      await dailyNotePane.click();
      await page.waitForTimeout(500);

      const afterClick = await captureVisualState(`After clicking daily note ${i}`);

      // Format should be restored after clicking
      if (afterClick.widgets >= initial.widgets) {
        console.log(`  -> Format restored after clicking`);
      }
    }

    // Cleanup
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });
});
