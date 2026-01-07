/**
 * Issue #939: [FR] New Task/Edit Task modal in sidebar
 *
 * Feature request to open the edit task modal in the right or left sidebar,
 * allowing users to view other content while editing task details.
 *
 * Requested behavior:
 * - Task modal can be opened as a sidebar view (left or right)
 * - Sidebar view syncs with currently active note by default
 * - Sidebar view can be pinned (doesn't change with active note)
 * - Sidebar view can be linked to a specific tab
 * - Optional setting to make sidebar the default behavior
 *
 * Use cases:
 * - Reference and edit task details while working on related notes
 * - Access full markdown editor and sophisticated metadata management together
 * - Create new tasks without interrupting current reading/writing
 * - Go through filtered task lists in a Base while editing in sidebar
 *
 * Implementation would require:
 * - New TaskModalView extending Obsidian's ItemView (similar to PomodoroView)
 * - New view type constant in types.ts
 * - View registration in main.ts
 * - Settings for sidebar preferences
 * - Commands to open task modal in sidebar
 *
 * @see https://github.com/callumalpass/tasknotes/issues/939
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #939: Task modal in sidebar', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme(
    'reproduces issue #939 - should be able to open task edit modal in right sidebar',
    async () => {
      /**
       * This test verifies that the task edit modal can be opened in the
       * right sidebar as a persistent view.
       *
       * Expected behavior (not yet implemented):
       * - A command exists to open the task modal in the sidebar
       * - The modal appears as a sidebar leaf, not a popup modal
       * - The sidebar view contains all task editing functionality
       */
      const page = app.page;

      // First, create or open a task to edit
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      // Fill in task details
      const titleInput = page.locator('.tasknotes-modal input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 2000 })) {
        await titleInput.fill('Test task for sidebar modal');
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(300);

      // Try to open task edit modal in sidebar (command doesn't exist yet)
      await runCommand(page, 'TaskNotes: Open task modal in right sidebar');
      await page.waitForTimeout(1000);

      // Check if a sidebar view was created
      const rightSidebar = page.locator('.mod-right-split .workspace-leaf-content');
      const taskModalView = rightSidebar.locator('[data-type*="task-modal"], .tasknotes-task-modal-view');

      const sidebarViewOpened = await taskModalView.isVisible({ timeout: 2000 }).catch(() => false);

      // Verify it's in the sidebar, not a modal popup
      const isPopupModal = await page.locator('.modal-container .tasknotes-modal').isVisible({ timeout: 500 }).catch(() => false);

      if (sidebarViewOpened && !isPopupModal) {
        console.log('SUCCESS: Task modal opened in sidebar');
      } else if (isPopupModal) {
        console.log('FEATURE NOT IMPLEMENTED: Task modal opened as popup instead of sidebar');
      } else {
        console.log('FEATURE NOT IMPLEMENTED: Task modal sidebar command not available');
      }

      expect(sidebarViewOpened).toBe(true);
      expect(isPopupModal).toBe(false);
    }
  );

  test.fixme(
    'reproduces issue #939 - should be able to open task edit modal in left sidebar',
    async () => {
      /**
       * This test verifies that the task edit modal can be opened in the
       * left sidebar as an alternative to the right sidebar.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open task modal in left sidebar');
      await page.waitForTimeout(1000);

      const leftSidebar = page.locator('.mod-left-split .workspace-leaf-content');
      const taskModalView = leftSidebar.locator('[data-type*="task-modal"], .tasknotes-task-modal-view');

      const sidebarViewOpened = await taskModalView.isVisible({ timeout: 2000 }).catch(() => false);

      expect(sidebarViewOpened).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #939 - sidebar task modal should sync with active note',
    async () => {
      /**
       * This test verifies that when a task note becomes active,
       * the sidebar task modal updates to show that task's details.
       *
       * Expected behavior:
       * - When user opens a task note file, sidebar modal shows that task
       * - Switching to a different task note updates the sidebar modal
       */
      const page = app.page;

      // First open the sidebar task modal
      await runCommand(page, 'TaskNotes: Open task modal in right sidebar');
      await page.waitForTimeout(500);

      // Create two test tasks
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(300);

      const titleInput = page.locator('.tasknotes-modal input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 1000 })) {
        await titleInput.fill('First test task');
        await page.keyboard.press('Escape');
      }

      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(300);

      if (await titleInput.isVisible({ timeout: 1000 })) {
        await titleInput.fill('Second test task');
        await page.keyboard.press('Escape');
      }

      // Navigate to the first task via file explorer or quick switcher
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);

      const quickSwitcher = page.locator('.prompt-input');
      if (await quickSwitcher.isVisible({ timeout: 1000 })) {
        await quickSwitcher.fill('First test task');
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);

      // Check that sidebar shows first task
      const rightSidebar = page.locator('.mod-right-split .workspace-leaf-content');
      const sidebarTitle = rightSidebar.locator('.tasknotes-task-modal-view input[type="text"]').first();

      const firstTaskShowing = await sidebarTitle.inputValue().then(
        (v) => v.includes('First test task')
      ).catch(() => false);

      // Navigate to second task
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);

      if (await quickSwitcher.isVisible({ timeout: 1000 })) {
        await quickSwitcher.fill('Second test task');
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);

      // Check that sidebar now shows second task
      const secondTaskShowing = await sidebarTitle.inputValue().then(
        (v) => v.includes('Second test task')
      ).catch(() => false);

      expect(firstTaskShowing).toBe(true);
      expect(secondTaskShowing).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #939 - sidebar task modal should support pinning',
    async () => {
      /**
       * This test verifies that the sidebar task modal can be pinned
       * so it doesn't change when the active note changes.
       *
       * Expected behavior:
       * - A pin button/action is available in the sidebar view
       * - When pinned, switching active notes doesn't change the displayed task
       * - Unpinning resumes sync with active note
       */
      const page = app.page;

      // Open sidebar task modal
      await runCommand(page, 'TaskNotes: Open task modal in right sidebar');
      await page.waitForTimeout(500);

      // Navigate to a task
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);

      const quickSwitcher = page.locator('.prompt-input');
      if (await quickSwitcher.isVisible({ timeout: 1000 })) {
        await quickSwitcher.fill('First test task');
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);

      // Find and click the pin button in sidebar
      const rightSidebar = page.locator('.mod-right-split .workspace-leaf-content');
      const pinButton = rightSidebar.locator('.tasknotes-task-modal-view .pin-button, [aria-label*="pin" i]');

      if (await pinButton.isVisible({ timeout: 1000 })) {
        await pinButton.click();
        await page.waitForTimeout(300);
      }

      // Get the currently displayed task title
      const sidebarTitle = rightSidebar.locator('.tasknotes-task-modal-view input[type="text"]').first();
      const pinnedTaskTitle = await sidebarTitle.inputValue().catch(() => '');

      // Navigate to a different task
      await runCommand(page, 'Quick switcher: Open quick switcher');
      await page.waitForTimeout(300);

      if (await quickSwitcher.isVisible({ timeout: 1000 })) {
        await quickSwitcher.fill('Second test task');
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);

      // Check that sidebar still shows the pinned task
      const currentTitle = await sidebarTitle.inputValue().catch(() => '');

      expect(currentTitle).toBe(pinnedTaskTitle);
    }
  );

  test.fixme(
    'reproduces issue #939 - new task creation should work from sidebar modal',
    async () => {
      /**
       * This test verifies that new tasks can be created through the
       * sidebar modal without interrupting the main workspace view.
       *
       * Expected behavior:
       * - A "new task" mode/button exists in the sidebar view
       * - Creating a task doesn't create a popup modal
       * - Current reading/writing in main pane is uninterrupted
       */
      const page = app.page;

      // Open some content in the main pane
      await runCommand(page, 'Create new note');
      await page.waitForTimeout(300);

      const mainEditor = page.locator('.workspace-split:not(.mod-left-split):not(.mod-right-split) .cm-editor');
      if (await mainEditor.isVisible({ timeout: 1000 })) {
        await mainEditor.click();
        await page.keyboard.type('This is my current work that should not be interrupted');
      }

      // Open task modal in sidebar
      await runCommand(page, 'TaskNotes: Open task modal in right sidebar');
      await page.waitForTimeout(500);

      // Create a new task from the sidebar
      const rightSidebar = page.locator('.mod-right-split .workspace-leaf-content');
      const newTaskButton = rightSidebar.locator('.tasknotes-task-modal-view .new-task-button, [aria-label*="new task" i]');

      if (await newTaskButton.isVisible({ timeout: 1000 })) {
        await newTaskButton.click();
        await page.waitForTimeout(300);
      }

      // Fill in the new task in the sidebar
      const sidebarTitle = rightSidebar.locator('.tasknotes-task-modal-view input[type="text"]').first();
      if (await sidebarTitle.isVisible({ timeout: 1000 })) {
        await sidebarTitle.fill('New task from sidebar');
      }

      // Verify no popup modal appeared
      const popupModal = page.locator('.modal-container .tasknotes-modal');
      const hasPopupModal = await popupModal.isVisible({ timeout: 500 }).catch(() => false);

      // Verify main editor content is preserved
      const mainContent = await mainEditor.textContent().catch(() => '');
      const contentPreserved = mainContent.includes('should not be interrupted');

      expect(hasPopupModal).toBe(false);
      expect(contentPreserved).toBe(true);
    }
  );

  test.fixme(
    'reproduces issue #939 - sidebar modal should work alongside Base filtered task list',
    async () => {
      /**
       * This test verifies that users can open a Base with filtered tasks
       * and edit them one-by-one using the sidebar modal.
       *
       * Expected behavior:
       * - Open a Base with filtered task list in main pane
       * - Click on a task to select it
       * - Sidebar modal shows that task's details
       * - Edit task, save, move to next task
       * - Base list remains visible throughout
       */
      const page = app.page;

      // Open a Base file in the main pane
      const baseFile = page.locator('.nav-file-title[data-path$=".base"]').first();
      if (await baseFile.isVisible({ timeout: 2000 }).catch(() => false)) {
        await baseFile.click();
        await page.waitForTimeout(1000);
      } else {
        // Create a Base via command if none exist
        await runCommand(page, 'TaskNotes: Open task list');
        await page.waitForTimeout(1000);
      }

      // Open sidebar task modal
      await runCommand(page, 'TaskNotes: Open task modal in right sidebar');
      await page.waitForTimeout(500);

      // Click on a task in the Base list
      const mainPane = page.locator('.workspace-split:not(.mod-left-split):not(.mod-right-split)');
      const taskItem = mainPane.locator('.task-item, .tasknotes-task-item').first();

      if (await taskItem.isVisible({ timeout: 2000 })) {
        await taskItem.click();
        await page.waitForTimeout(500);

        // Verify sidebar now shows this task
        const rightSidebar = page.locator('.mod-right-split .workspace-leaf-content');
        const sidebarView = rightSidebar.locator('.tasknotes-task-modal-view');

        const sidebarShowsTask = await sidebarView.isVisible({ timeout: 1000 }).catch(() => false);

        // Verify Base list is still visible in main pane
        const baseStillVisible = await mainPane.locator('.bases-view, .task-list').isVisible({ timeout: 1000 }).catch(() => false);

        expect(sidebarShowsTask).toBe(true);
        expect(baseStillVisible).toBe(true);
      } else {
        console.log('No tasks found in Base to test with');
      }
    }
  );

  test.fixme(
    'reproduces issue #939 - settings toggle for default sidebar behavior',
    async () => {
      /**
       * This test verifies that there's a setting to make sidebar
       * the default behavior when opening the task modal.
       *
       * Expected behavior:
       * - Setting exists in TaskNotes settings
       * - When enabled, task modal commands open in sidebar by default
       * - When disabled, task modal commands open as popup modal
       */
      const page = app.page;

      // Open TaskNotes settings
      await runCommand(page, 'Open settings');
      await page.waitForTimeout(500);

      const communityPlugins = page.locator('.vertical-tab-nav-item').filter({
        hasText: /community plugins/i,
      });

      if (await communityPlugins.isVisible({ timeout: 1000 })) {
        await communityPlugins.click();
        await page.waitForTimeout(300);

        // Find TaskNotes settings
        const taskNotesSettings = page.locator('.installed-plugin-item').filter({
          hasText: /tasknotes/i,
        });

        if (await taskNotesSettings.isVisible({ timeout: 1000 })) {
          const settingsButton = taskNotesSettings.locator('.clickable-icon[aria-label*="settings" i]');
          if (await settingsButton.isVisible({ timeout: 500 })) {
            await settingsButton.click();
            await page.waitForTimeout(500);
          }
        }
      }

      // Look for the sidebar modal setting
      const sidebarSetting = page.locator('.setting-item').filter({
        hasText: /sidebar.*modal|modal.*sidebar|default.*sidebar/i,
      });

      const settingExists = await sidebarSetting.isVisible({ timeout: 2000 }).catch(() => false);

      await page.keyboard.press('Escape');

      expect(settingExists).toBe(true);
    }
  );
});
