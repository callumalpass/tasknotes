/**
 * Issue #874: [FR] More flexibility removing items in UI
 *
 * Feature request description:
 * Users want the ability to hide/remove non-essential fields from the task
 * creation and editing UI. The plugin's workflow agnosticism is appreciated,
 * but having unused fields visible creates visual clutter and adds friction.
 *
 * Fields that users may want to hide:
 * - Contexts
 * - Subtasks
 * - Title (when using NLP input)
 * - Tags
 * - Time estimates
 * - Blocked by / Blocking (dependencies)
 * - Action bar icons in collapsed view
 *
 * Current state:
 * - There IS a field configuration system (modalFieldsConfig) with enabled,
 *   visibleInCreation, and visibleInEdit flags
 * - There IS a settings tab (Task Modal Fields) with toggles
 * - But: Action bar icons are NOT configurable
 * - But: The settings UI may not be discoverable enough
 *
 * Requested enhancements:
 * 1. Expose action bar icon visibility settings
 * 2. Make field visibility settings more discoverable
 * 3. Allow hiding all non-essential fields individually
 *
 * Related code locations:
 * - src/modals/TaskModal.ts (base modal with action bar icons)
 * - src/modals/TaskCreationModal.ts (creation modal)
 * - src/modals/TaskEditModal.ts (edit modal)
 * - src/utils/fieldConfigDefaults.ts (field configuration defaults)
 * - src/settings/tabs/modalFieldsTab.ts (settings tab UI)
 * - src/settings/components/FieldManagerComponent.ts (field manager component)
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/853
 * @see https://github.com/callumalpass/tasknotes/issues/874
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand, openSettingsTab } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #874: Modal field visibility customization', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Field visibility settings', () => {
    test.fixme('settings should provide toggles for all modal fields', async () => {
      /**
       * Test that the settings UI exposes visibility toggles for all configurable fields.
       * Users should be able to enable/disable: contexts, tags, time estimate, projects,
       * subtasks, blocked by, blocking, and any custom fields.
       */
      const page = app.page;

      // Open TaskNotes settings
      await openSettingsTab(page, 'TaskNotes');
      await page.waitForTimeout(500);

      // Navigate to Task Modal Fields tab
      const modalFieldsTab = page.locator('.vertical-tab-nav-item:has-text("Task Modal Fields")');
      await expect(modalFieldsTab).toBeVisible({ timeout: 5000 });
      await modalFieldsTab.click();
      await page.waitForTimeout(300);

      // Verify field manager is visible
      const fieldManager = page.locator('.field-manager');
      await expect(fieldManager).toBeVisible({ timeout: 5000 });

      // Check that expected field groups/tabs exist
      const tabs = page.locator('.field-manager__tab');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(4); // basic, metadata, organization, dependencies

      // Check for specific field toggles
      const expectedFields = [
        'Contexts',
        'Tags',
        'Time Estimate',
        'Subtasks',
        'Blocked By',
        'Blocking',
      ];

      for (const fieldName of expectedFields) {
        // Navigate through tabs to find the field
        const fieldCard = page.locator('.card', { hasText: fieldName });
        if (await fieldCard.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Verify the card has toggle switches
          const toggles = fieldCard.locator('.card-toggle, input[type="checkbox"]');
          const toggleCount = await toggles.count();
          expect(toggleCount).toBeGreaterThanOrEqual(1);
        }
      }

      // Close settings
      await page.keyboard.press('Escape');
    });

    test.fixme('disabling a field in settings should hide it in creation modal', async () => {
      /**
       * Test that toggling off a field in settings actually hides it in the task creation modal.
       */
      const page = app.page;

      // First, open settings and disable the contexts field
      await openSettingsTab(page, 'TaskNotes');
      await page.waitForTimeout(500);

      const modalFieldsTab = page.locator('.vertical-tab-nav-item:has-text("Task Modal Fields")');
      await modalFieldsTab.click();
      await page.waitForTimeout(300);

      // Navigate to metadata group (where contexts is)
      const metadataTab = page.locator('.field-manager__tab:has-text("Metadata")');
      if (await metadataTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await metadataTab.click();
        await page.waitForTimeout(200);
      }

      // Find contexts field card and disable it
      const contextsCard = page.locator('.card', { hasText: 'Contexts' });
      if (await contextsCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Find the "Enabled" toggle and turn it off
        const enabledToggle = contextsCard.locator('.card-toggle, input[type="checkbox"]').first();
        if (await enabledToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
          const isChecked = await enabledToggle.isChecked().catch(() => true);
          if (isChecked) {
            await enabledToggle.click();
            await page.waitForTimeout(200);
          }
        }
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Expand the modal if needed to see all fields
      const expandIcon = modal.locator('[data-action="expand"], .task-modal__action--expand');
      if (await expandIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandIcon.click();
        await page.waitForTimeout(300);
      }

      // Verify contexts field is NOT visible
      const contextsField = modal.locator('.task-modal__field--contexts, [data-field="contexts"]');
      await expect(contextsField).not.toBeVisible({ timeout: 2000 });

      // Cleanup - close modal and re-enable contexts
      await page.keyboard.press('Escape');
    });

    test.fixme('disabling a field in settings should hide it in edit modal', async () => {
      /**
       * Test that toggling off a field in settings hides it in the task edit modal.
       */
      const page = app.page;

      // Similar to above but verify in edit modal
      // First create a task, then open it for editing and verify field is hidden

      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const createModal = page.locator('.modal');
      await expect(createModal).toBeVisible({ timeout: 5000 });

      // Fill title and save
      const titleInput = createModal.locator('input[placeholder*="title"], input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Test task for field visibility');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Open the task for editing
      await runCommand(page, 'TaskNotes: Quick actions for current task');
      await page.waitForTimeout(500);

      // Select edit action
      const editAction = page.locator('.suggestion-item:has-text("Edit"), .task-action-palette__item:has-text("Edit")').first();
      if (await editAction.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editAction.click();
        await page.waitForTimeout(500);
      }

      const editModal = page.locator('.modal');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // Expand modal if needed
      const expandIcon = editModal.locator('[data-action="expand"], .task-modal__action--expand');
      if (await expandIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandIcon.click();
        await page.waitForTimeout(300);
      }

      // Verify the disabled field is not visible (assuming contexts was disabled from previous test)
      const contextsField = editModal.locator('.task-modal__field--contexts, [data-field="contexts"]');
      await expect(contextsField).not.toBeVisible({ timeout: 2000 });

      await page.keyboard.press('Escape');
    });
  });

  test.describe('Action bar icon visibility', () => {
    test.fixme('settings should allow hiding action bar icons', async () => {
      /**
       * Test that settings provide controls for hiding individual action bar icons.
       * The action bar includes: due date, scheduled date, status, priority, recurrence, reminders.
       *
       * This is a key part of the feature request - users want to hide icons they don't use.
       */
      const page = app.page;

      await openSettingsTab(page, 'TaskNotes');
      await page.waitForTimeout(500);

      // Look for action bar icon settings
      // These should be in the Task Modal Fields tab or a dedicated section
      const modalFieldsTab = page.locator('.vertical-tab-nav-item:has-text("Task Modal Fields")');
      await modalFieldsTab.click();
      await page.waitForTimeout(300);

      // Look for action bar configuration section
      const actionBarSection = page.locator('.setting-item', { hasText: /action.*bar|icon.*visibility/i });

      // Or individual icon toggles
      const iconToggleNames = [
        'Due Date',
        'Scheduled Date',
        'Status',
        'Priority',
        'Recurrence',
        'Reminders',
      ];

      let foundActionBarSettings = false;

      // Check if there's a dedicated action bar section
      if (await actionBarSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        foundActionBarSettings = true;
      }

      // Or check for individual icon toggles anywhere in settings
      for (const iconName of iconToggleNames) {
        const iconToggle = page.locator('.setting-item', { hasText: iconName });
        if (await iconToggle.isVisible({ timeout: 500 }).catch(() => false)) {
          foundActionBarSettings = true;
          break;
        }
      }

      // This assertion will fail until action bar icon settings are implemented
      expect(foundActionBarSettings).toBe(true);

      await page.keyboard.press('Escape');
    });

    test.fixme('hiding due date icon should remove it from action bar', async () => {
      /**
       * Test that disabling the due date action bar icon removes it from the modal.
       */
      const page = app.page;

      // Open task creation modal
      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Look for action bar icons in collapsed state
      const actionBar = modal.locator('.task-modal__action-bar, .task-modal__actions');

      // Count visible action icons before
      const dueIcon = actionBar.locator('[data-action="due"], .task-modal__action--due, [aria-label*="due" i]');

      // After disabling in settings, this icon should not be visible
      // This test documents the expected behavior
      await expect(dueIcon).not.toBeVisible({ timeout: 2000 });

      await page.keyboard.press('Escape');
    });

    test.fixme('hidden icons should not show when modal is collapsed', async () => {
      /**
       * Test that when icons are hidden via settings, they don't appear in the
       * collapsed modal view (the action bar with quick-access icons).
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Ensure modal is in collapsed state (not expanded)
      const collapseIcon = modal.locator('[data-action="collapse"], .task-modal__action--collapse');
      if (await collapseIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await collapseIcon.click();
        await page.waitForTimeout(200);
      }

      // Count visible action bar icons
      const actionIcons = modal.locator('.task-modal__action-bar .clickable-icon, .task-modal__actions > button');
      const iconCount = await actionIcons.count();

      // If user has hidden some icons, count should be less than the default 6
      // (due, scheduled, status, priority, recurrence, reminders)
      // This test documents that we expect some icons to be hideable
      expect(iconCount).toBeLessThan(6);

      await page.keyboard.press('Escape');
    });
  });

  test.describe('Field group visibility', () => {
    test.fixme('should be able to hide entire field groups', async () => {
      /**
       * Test that users can hide entire groups of fields (e.g., hide all dependencies).
       * This would be more efficient than hiding individual fields.
       */
      const page = app.page;

      await openSettingsTab(page, 'TaskNotes');
      await page.waitForTimeout(500);

      const modalFieldsTab = page.locator('.vertical-tab-nav-item:has-text("Task Modal Fields")');
      await modalFieldsTab.click();
      await page.waitForTimeout(300);

      // Look for group-level visibility controls
      const dependenciesGroup = page.locator('.field-manager__tab:has-text("Dependencies")');
      if (await dependenciesGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dependenciesGroup.click();
        await page.waitForTimeout(200);

        // Look for a "hide group" or similar control
        const hideGroupControl = page.locator(
          '.setting-item:has-text("hide group"), ' +
          '.setting-item:has-text("disable group"), ' +
          'button:has-text("Hide All")'
        );

        // This tests that group-level hiding is available
        await expect(hideGroupControl).toBeVisible({ timeout: 2000 });
      }

      await page.keyboard.press('Escape');
    });

    test.fixme('hidden field group should not render in modal', async () => {
      /**
       * Test that when a field group is hidden, the entire section doesn't render.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Expand modal to see field groups
      const expandIcon = modal.locator('[data-action="expand"], .task-modal__action--expand');
      if (await expandIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandIcon.click();
        await page.waitForTimeout(300);
      }

      // If dependencies group was hidden, verify it's not present
      const dependenciesSection = modal.locator(
        '.task-modal__group--dependencies, ' +
        '.task-modal__section:has-text("Dependencies"), ' +
        '[data-group="dependencies"]'
      );

      // This test documents expected behavior when group is hidden
      await expect(dependenciesSection).not.toBeVisible({ timeout: 2000 });

      await page.keyboard.press('Escape');
    });
  });

  test.describe('Visibility state persistence', () => {
    test.fixme('field visibility settings should persist after restart', async () => {
      /**
       * Test that field visibility settings are persisted to plugin settings
       * and survive vault reloads.
       */
      const page = app.page;

      // Modify a field visibility setting
      await openSettingsTab(page, 'TaskNotes');
      await page.waitForTimeout(500);

      const modalFieldsTab = page.locator('.vertical-tab-nav-item:has-text("Task Modal Fields")');
      await modalFieldsTab.click();
      await page.waitForTimeout(300);

      // Toggle a field off
      const metadataTab = page.locator('.field-manager__tab:has-text("Metadata")');
      if (await metadataTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await metadataTab.click();
        await page.waitForTimeout(200);
      }

      // Find and toggle time estimate field
      const timeEstimateCard = page.locator('.card', { hasText: 'Time Estimate' });
      if (await timeEstimateCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        const toggle = timeEstimateCard.locator('.card-toggle, input[type="checkbox"]').first();
        if (await toggle.isVisible({ timeout: 1000 }).catch(() => false)) {
          await toggle.click();
          await page.waitForTimeout(200);
        }
      }

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Reload the vault/plugin
      await runCommand(page, 'Reload app without saving');
      await page.waitForTimeout(2000);

      // Re-open settings and verify the setting persisted
      await openSettingsTab(page, 'TaskNotes');
      await page.waitForTimeout(500);

      await modalFieldsTab.click();
      await page.waitForTimeout(300);

      if (await metadataTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await metadataTab.click();
        await page.waitForTimeout(200);
      }

      const timeEstimateCardAfterReload = page.locator('.card', { hasText: 'Time Estimate' });
      if (await timeEstimateCardAfterReload.isVisible({ timeout: 2000 }).catch(() => false)) {
        const toggle = timeEstimateCardAfterReload.locator('.card-toggle, input[type="checkbox"]').first();
        const isChecked = await toggle.isChecked().catch(() => true);
        // Should still be unchecked
        expect(isChecked).toBe(false);
      }

      await page.keyboard.press('Escape');
    });
  });

  test.describe('Quick toggle UI', () => {
    test.fixme('should provide quick way to access field visibility from modal', async () => {
      /**
       * Test for a feature where users can quickly access field visibility settings
       * directly from the modal, rather than navigating through settings.
       *
       * This addresses the discoverability concern in the feature request.
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Create new task');
      await page.waitForTimeout(500);

      const modal = page.locator('.modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Look for a settings/gear icon or context menu in the modal
      const settingsIcon = modal.locator(
        '[data-action="settings"], ' +
        '.task-modal__action--settings, ' +
        '[aria-label*="settings" i], ' +
        '.lucide-settings'
      );

      // Or a "customize" option in a context menu
      // Right-click on the modal or look for overflow menu
      const overflowMenu = modal.locator('.task-modal__overflow, .task-modal__more');

      if (await settingsIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Click settings icon should open field customization
        await settingsIcon.click();
        await page.waitForTimeout(300);

        const fieldTogglePopup = page.locator('.field-toggle-popup, .customize-fields-modal');
        await expect(fieldTogglePopup).toBeVisible({ timeout: 2000 });
      } else if (await overflowMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
        await overflowMenu.click();
        await page.waitForTimeout(200);

        const customizeOption = page.locator(
          '.menu-item:has-text("Customize"), ' +
          '.menu-item:has-text("Configure fields")'
        );
        await expect(customizeOption).toBeVisible({ timeout: 2000 });
      } else {
        // This assertion will fail until quick toggle feature is implemented
        expect(false).toBe(true);
      }

      await page.keyboard.press('Escape');
    });
  });
});
