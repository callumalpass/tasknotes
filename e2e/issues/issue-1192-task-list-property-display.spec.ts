/**
 * Issue #1192: [Bug/Question] How to adjust the display of tasks in the `tasknotesTaskList`?
 *
 * User wants to:
 * 1. Hide the title displayed on the second line (metadata row)
 * 2. Hide the `threshold_date` custom property when not defined
 *
 * The user has a custom property `threshold_date` of type "date" that shows
 * even when not defined. They also don't want the title/name appearing in
 * the metadata line.
 *
 * Analysis:
 * - The title appearing on the metadata line suggests `note.name` or `file.name`
 *   is included in the Bases view's visible properties configuration
 * - Custom date properties should be hidden when undefined via `hasValidValue()`
 *   check in TaskCard.ts:933
 * - This may be a configuration issue rather than a code bug
 *
 * Possible solutions:
 * 1. Remove `note.name`/`file.name` from visible properties in Bases config
 * 2. Verify that undefined user properties return null/undefined properly
 * 3. Add documentation on how to configure visible properties
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1192
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1192: Task list property display configuration', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1192 - undefined custom date properties should be hidden', async () => {
    /**
     * This test verifies that custom user properties (especially date types)
     * are not displayed when they have no value set.
     *
     * The user has a custom property `threshold_date` of type "date" that
     * appears in the task card metadata even when not defined.
     *
     * Expected behavior:
     * - Properties with undefined/null/empty values should not render
     * - The hasValidValue() check in TaskCard.ts should filter these out
     */
    const page = app.page;

    // Open a Bases view with tasknotesTaskList type
    // This requires having a Bases view configured in the test vault
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1000);

    // Look for task cards in the view
    const taskCards = page.locator('.task-card');
    const cardCount = await taskCards.count();

    if (cardCount > 0) {
      // Find a task card that might have undefined custom properties
      const firstCard = taskCards.first();
      const metadataLine = firstCard.locator('.task-card__metadata');

      // Check if metadata line exists
      const hasMetadata = await metadataLine.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasMetadata) {
        // Look for any property that displays with "(empty)" or undefined value
        const emptyIndicators = metadataLine.locator(':has-text("(empty)"), :has-text("undefined")');
        const emptyCount = await emptyIndicators.count();

        // Properties with no value should not render at all, not show "(empty)"
        // Note: The current implementation may show "(empty)" for undefined user properties
        // This test documents that behavior as potentially undesirable
        expect(emptyCount).toBe(0);

        // Check specifically for threshold_date or similar custom date properties
        // that might be showing when undefined
        const datePropertyLabels = metadataLine.locator(
          ':has-text("threshold"), :has-text("Threshold")'
        );
        const hasThresholdProperty = await datePropertyLabels.count();

        // If threshold_date has no value, it should not appear in metadata
        // This assertion documents the expected behavior
        // (can't fully verify without knowing the task's frontmatter)
        console.log(`Found ${hasThresholdProperty} threshold-related property displays`);
      }
    } else {
      console.log('No task cards found in view to verify property display behavior');
    }
  });

  test.fixme('reproduces issue #1192 - title should be configurable in metadata line', async () => {
    /**
     * The user doesn't want the title displayed on the "second line" (metadata row).
     *
     * This could mean:
     * 1. `note.name` or `file.name` is in visible properties and showing in metadata
     * 2. There's a duplicate title appearing in the metadata section
     *
     * Solution:
     * - Users should be able to remove `note.name` from visible properties
     * - The Bases UI should allow configuring which properties appear
     */
    const page = app.page;

    // Open a Bases view with tasknotesTaskList type
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1000);

    // Look for task cards
    const taskCards = page.locator('.task-card');
    const cardCount = await taskCards.count();

    if (cardCount > 0) {
      const firstCard = taskCards.first();

      // The card should have a title on the first line
      const titleElement = firstCard.locator('.task-card__title');
      await expect(titleElement).toBeVisible({ timeout: 2000 });

      // Get the title text
      const titleText = await titleElement.textContent();

      // Check the metadata line for duplicate title/name
      const metadataLine = firstCard.locator('.task-card__metadata');
      const hasMetadata = await metadataLine.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasMetadata && titleText) {
        // The title should NOT appear again in the metadata line
        // Look for property that might be showing the file/note name
        const metadataContent = await metadataLine.textContent();

        // Check if the title text appears in the metadata
        // (This would indicate note.name or file.name is in visible properties)
        const hasDuplicateTitle = metadataContent?.includes(titleText.trim());

        // Users should be able to configure this - documenting current behavior
        console.log(`Title appears in metadata: ${hasDuplicateTitle}`);
        console.log(`Title: "${titleText?.trim()}"`);
        console.log(`Metadata: "${metadataContent?.trim()}"`);

        // Ideally, if users don't want title in metadata, they should be able
        // to remove it from visible properties configuration
      }
    }
  });

  test.fixme('reproduces issue #1192 - visible properties should be configurable in Bases', async () => {
    /**
     * The underlying solution to this issue is proper configuration of
     * visible properties in the Bases view.
     *
     * Users should be able to:
     * 1. Remove properties like `note.name` from the visible properties
     * 2. Have undefined properties automatically hidden
     *
     * This test verifies that the configuration mechanism exists.
     */
    const page = app.page;

    // Try to access Bases configuration for a tasknotesTaskList view
    // This would typically be done through the Bases UI

    // Look for the Bases settings icon or configuration option
    const basesSettingsButton = page.locator(
      '[aria-label*="Configure"], [aria-label*="Settings"], ' +
      '.bases-config-button, .view-action[aria-label*="config"]'
    );

    // Navigate to a view that uses Bases
    await runCommand(page, 'TaskNotes: Open task list');
    await page.waitForTimeout(1000);

    // Check if there's a way to configure visible properties
    // The Bases plugin should provide property visibility controls
    const configAccess = await basesSettingsButton.first().isVisible({ timeout: 2000 }).catch(() => false);

    if (configAccess) {
      await basesSettingsButton.first().click();
      await page.waitForTimeout(500);

      // Look for property configuration in the settings panel
      const propertyConfig = page.locator(
        ':has-text("Properties"), :has-text("Columns"), :has-text("Visible")'
      );

      const hasPropertyConfig = await propertyConfig.first().isVisible({ timeout: 2000 }).catch(() => false);

      // Users should have access to property visibility configuration
      console.log(`Property configuration access: ${hasPropertyConfig}`);

      // Close any open panels
      await page.keyboard.press('Escape');
    } else {
      console.log('Could not locate Bases configuration access');
    }
  });
});
