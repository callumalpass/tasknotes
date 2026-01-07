/**
 * Issue #1216: Show Relationships widget only when relationships exist
 * (hide when empty)
 *
 * Feature request: The unified Relationships widget renders on all notes when
 * enabled, even when there are zero relationships. While individual tabs
 * (Subtasks, Projects, Blocked By, Blocking) correctly hide themselves when
 * empty, the widget container itself still appears, taking up vertical space
 * and showing an empty box.
 *
 * Desired behavior: Add an option to hide the entire Relationships widget
 * container when:
 * - No subtasks exist
 * - No project links exist
 * - No blocking dependencies exist
 * - No blocked dependencies exist
 *
 * Proposed solution: Add a setting under Settings → TaskNotes → General:
 * - Show relationships widget:
 *   - `Always` (current behavior, default)
 *   - `When populated` (new behavior - hide when all tabs are empty)
 *   - `Never` (disable widget entirely)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1216
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1216: Relationships widget empty state visibility', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1216 - widget shows on task without relationships', async () => {
    /**
     * This test verifies that the Relationships widget container appears
     * on a task note even when it has no relationships (no subtasks, no
     * project links, no dependencies).
     *
     * Current behavior (issue):
     * - The widget container renders with an empty box
     * - Takes up vertical space unnecessarily
     *
     * Expected behavior after fix (with "When populated" setting):
     * - Widget should be hidden when all relationship tabs are empty
     */
    const page = app.page;

    // Create a new simple task with no relationships
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in minimal task details - just a title
    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Simple Task Without Relationships');
    }

    // Create the task (without any subtasks, project links, or dependencies)
    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(1000);
    } else {
      // Close modal and use keyboard shortcut if no button found
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Wait for the task note to open in the editor
    await page.waitForTimeout(1500);

    // Look for the relationships widget in the editor
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    // Check if widget is visible
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    if (widgetVisible) {
      // Check if the widget has any actual content (populated tabs)
      const widgetContent = await relationshipsWidget.evaluate((widget) => {
        // Look for tabs or content within the Bases view
        const tabs = widget.querySelectorAll('.bases-tab, .bases-view-tab, [data-tab]');
        const lists = widget.querySelectorAll('.task-list, .bases-list, ul, li');
        const errorMessage = widget.querySelector('.relationships__error');

        return {
          hasVisibleTabs: tabs.length > 0,
          hasListItems: lists.length > 0,
          hasError: !!errorMessage,
          errorText: errorMessage?.textContent || null,
          innerHTML: widget.innerHTML.substring(0, 500), // Debug info
        };
      });

      console.log('Widget content analysis:', JSON.stringify(widgetContent, null, 2));

      // The issue is that the widget container is visible even when empty
      // After the fix (with "When populated" mode), this widget should NOT be visible
      // when there are no relationships

      // For now, document that this is the problematic behavior
      // This test will pass when widget is visible (current behavior)
      // but documents what needs to change
      expect(widgetVisible).toBe(true); // Current behavior - widget shows even when empty
    }

    // Clean up - close the task note
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1216 - widget should respect "When populated" setting', async () => {
    /**
     * This test verifies that a new "When populated" setting would properly
     * hide the relationships widget when there are no relationships.
     *
     * Expected behavior after fix:
     * - Settings should have three options: Always, When populated, Never
     * - "When populated" should hide the widget container entirely when:
     *   - No subtasks exist for this note
     *   - No project links exist for this note
     *   - No blocking dependencies exist
     *   - No blocked dependencies exist
     */
    const page = app.page;

    // Open TaskNotes settings
    await runCommand(page, 'Open settings');
    await page.waitForTimeout(1000);

    // Navigate to TaskNotes settings section
    const settingsModal = page.locator('.modal.mod-settings, .setting-item');
    await expect(settingsModal.first()).toBeVisible({ timeout: 5000 });

    // Look for TaskNotes plugin in the sidebar
    const pluginTab = page.locator('text=TaskNotes').first();
    if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pluginTab.click();
      await page.waitForTimeout(500);
    }

    // Search for the relationships widget setting
    // Currently there's only a boolean toggle - this should become a dropdown
    const showRelationshipsSetting = page.locator('text=Show relationships widget, text=relationships widget');

    if (await showRelationshipsSetting.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get the setting element type - currently a toggle
      const settingContainer = showRelationshipsSetting.first().locator('xpath=ancestor::*[contains(@class, "setting-item")]');

      const settingInfo = await settingContainer.evaluate((container) => {
        const toggle = container.querySelector('.checkbox-container, input[type="checkbox"]');
        const dropdown = container.querySelector('select, .dropdown');

        return {
          hasToggle: !!toggle,
          hasDropdown: !!dropdown,
          controlType: toggle ? 'toggle' : (dropdown ? 'dropdown' : 'unknown'),
        };
      }).catch(() => ({ hasToggle: false, hasDropdown: false, controlType: 'not_found' }));

      console.log('Settings control type:', settingInfo);

      // Currently this is a boolean toggle
      // After the fix, this should be a dropdown with: Always, When populated, Never
      // This assertion documents the expected change
      expect(settingInfo.controlType).toBe('toggle'); // Current behavior
      // After fix: expect(settingInfo.hasDropdown).toBe(true);
    }

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1216 - widget visible on project note without linked tasks', async () => {
    /**
     * This test verifies that the Relationships widget also appears on
     * project notes that don't have any linked tasks yet.
     *
     * Use case from issue: "Project notes without any linked tasks yet"
     * should have the option to hide the empty widget.
     */
    const page = app.page;

    // Create or open a project note (a note that could have tasks linked to it)
    // In TaskNotes, a project note is typically just a regular note that tasks reference

    // First, create a new note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(1000);

    // Type a simple project structure
    await page.keyboard.type('# Project: Empty Test Project\n\nThis is a project note without any linked tasks.\n\n', { delay: 20 });
    await page.waitForTimeout(500);

    // Check if the relationships widget appears
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    const widgetVisible = await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Widget visible on project note:', widgetVisible);

    // If widget is visible, check its content
    if (widgetVisible) {
      const isEmpty = await relationshipsWidget.evaluate((widget) => {
        // Check if all tabs/sections are empty
        const container = widget.querySelector('.relationships__bases-container');
        if (!container) return true;

        // Look for any actual task items
        const taskItems = container.querySelectorAll('.task-list-item, .kanban-card, .bases-item');
        return taskItems.length === 0;
      });

      console.log('Widget is empty:', isEmpty);

      // Document that widget shows even when empty on project notes
      // This is the behavior the issue wants to address
    }

    // Close the note without saving
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(300);

    // Handle potential "discard changes" dialog
    const discardButton = page.locator('button:has-text("Don\'t save"), button:has-text("Discard")');
    if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await discardButton.click();
      await page.waitForTimeout(300);
    }
  });

  test.fixme('reproduces issue #1216 - vertical space taken by empty widget', async () => {
    /**
     * This test measures the vertical space consumed by the empty
     * Relationships widget, documenting the visual clutter mentioned
     * in the issue.
     *
     * The issue mentions: "taking up vertical space and showing an empty box"
     */
    const page = app.page;

    // Create a new task
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in minimal task details
    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task for Space Measurement');
    }

    // Create the task
    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Wait for the task note to open
    await page.waitForTimeout(1500);

    // Measure the relationships widget dimensions
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    if (await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false)) {
      const dimensions = await relationshipsWidget.boundingBox();

      if (dimensions) {
        console.log('Empty relationships widget dimensions:', {
          height: dimensions.height,
          width: dimensions.width,
          x: dimensions.x,
          y: dimensions.y,
        });

        // Document the vertical space taken
        // Even a "small" empty widget taking 50+ pixels is visual clutter
        // on notes without relationships
        expect(dimensions.height).toBeGreaterThan(0); // Widget has height even when empty

        // After the fix with "When populated" setting:
        // The widget should have 0 height (or not be in DOM) when empty
      }
    }

    // Clean up
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #1216 - individual tabs hide when empty but container remains', async () => {
    /**
     * This test verifies that while individual tabs (Subtasks, Projects,
     * Blocked By, Blocking) correctly hide themselves when empty, the
     * widget container itself still appears.
     *
     * This is the core of the issue - tab-level hiding works, but
     * container-level hiding doesn't exist.
     */
    const page = app.page;

    // Create a task without any relationships
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const titleInput = modal.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Task for Tab Visibility Test');
    }

    const createButton = modal.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(1500);

    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    if (await relationshipsWidget.isVisible({ timeout: 3000 }).catch(() => false)) {
      const tabAnalysis = await relationshipsWidget.evaluate((widget) => {
        // The widget embeds a Bases view which has tabs
        const basesContainer = widget.querySelector('.relationships__bases-container');
        if (!basesContainer) return { containerExists: true, noBasesContent: true };

        // Look for tab headers
        const tabHeaders = basesContainer.querySelectorAll('.bases-tab-header, .tab-header, [role="tab"]');

        // Look for visible vs hidden tabs
        const visibleTabs: string[] = [];
        const hiddenTabs: string[] = [];

        tabHeaders.forEach((tab) => {
          const style = window.getComputedStyle(tab as Element);
          const isHidden = style.display === 'none' || style.visibility === 'hidden';
          const tabName = (tab as Element).textContent?.trim() || 'unknown';

          if (isHidden) {
            hiddenTabs.push(tabName);
          } else {
            visibleTabs.push(tabName);
          }
        });

        // Check if container is visible even if all tabs are hidden
        const containerStyle = window.getComputedStyle(widget);
        const containerVisible = containerStyle.display !== 'none' && containerStyle.visibility !== 'hidden';

        return {
          containerExists: true,
          containerVisible,
          totalTabs: tabHeaders.length,
          visibleTabs,
          hiddenTabs,
          allTabsHidden: tabHeaders.length > 0 && visibleTabs.length === 0,
        };
      });

      console.log('Tab visibility analysis:', JSON.stringify(tabAnalysis, null, 2));

      // The issue states: "individual tabs correctly hide themselves when empty"
      // but "the widget container itself still appears"

      // This documents the problematic behavior
      if (tabAnalysis.containerVisible) {
        console.log('Container is visible even though content may be empty');
        // After the fix, container should hide when allTabsHidden is true
        // (and "When populated" setting is enabled)
      }
    }

    // Clean up
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });
});
