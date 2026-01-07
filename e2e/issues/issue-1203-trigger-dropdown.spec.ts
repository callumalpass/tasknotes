/**
 * Issue #1203: [Bug] Problem with Trigger
 *
 * This issue reports problems with trigger dropdown behavior in the NLP input field.
 * Based on the discussion in the issue comments:
 * - The maintainer mentioned "improving those dropdowns"
 * - PR #1215 was created to address rich metadata display in project autosuggestion
 * - The original video showed UI/UX issues with trigger autosuggestion dropdowns
 *
 * The trigger system allows users to type special characters (like @, #, +, *)
 * to get autosuggestion dropdowns for contexts, tags, projects, and status.
 *
 * Note: Since the original video is not available for analysis, these tests
 * cover general trigger dropdown functionality that may relate to the reported issue.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1203
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1203: Trigger dropdown problems', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1203 - trigger dropdown should display correctly', async () => {
    /**
     * This test verifies that trigger dropdowns work correctly in the task creation modal.
     *
     * Potential issues reported:
     * - Dropdown positioning problems
     * - Dropdown not appearing when typing trigger characters
     * - Dropdown selections not working properly
     * - Visual glitches with dropdown appearance
     */
    const page = app.page;

    // Open the quick add task command
    await runCommand(page, 'TaskNotes: Quick add task');
    await page.waitForTimeout(1000);

    // Verify the task creation modal is visible
    const modal = page.locator('.modal, .tasknotes-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the NLP input field (could be textarea or CodeMirror editor)
    const nlpInput = modal.locator(
      '.task-creation-nlp-input, .cm-editor, textarea'
    ).first();
    await expect(nlpInput).toBeVisible({ timeout: 3000 });

    // Test 1: Type @ trigger for context suggestions
    await nlpInput.click();
    await page.keyboard.type('Test task @', { delay: 50 });
    await page.waitForTimeout(500);

    // Check if autocomplete dropdown appears
    const autocompleteDropdown = page.locator(
      '.cm-tooltip-autocomplete, .suggestion-container, .autocomplete-dropdown'
    );

    // The dropdown should appear after typing a trigger character
    const dropdownVisible = await autocompleteDropdown.isVisible({ timeout: 2000 }).catch(() => false);

    // Document the expected behavior
    expect(dropdownVisible).toBe(true);

    // If dropdown is visible, verify it has content
    if (dropdownVisible) {
      const suggestions = autocompleteDropdown.locator('.cm-completionLabel, .suggestion-item, .autocomplete-item');
      const suggestionCount = await suggestions.count();

      // Should have at least some context suggestions
      expect(suggestionCount).toBeGreaterThan(0);
    }

    // Clear input and test # trigger
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await nlpInput.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Task with tag #', { delay: 50 });
    await page.waitForTimeout(500);

    // Note: # trigger may use Obsidian's native tag suggester when configured
    // The dropdown behavior depends on settings.nlpTriggers configuration

    // Clean up - close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1203 - project autosuggestion should show metadata', async () => {
    /**
     * This test verifies that project autosuggestion (+) shows rich metadata.
     * This was specifically mentioned in the issue comments and addressed by PR #1215.
     *
     * Expected behavior:
     * - Typing + should trigger project autosuggestion
     * - Project suggestions should display additional context/metadata
     * - The display should match what "Add to Project" button shows
     */
    const page = app.page;

    // Open the quick add task command
    await runCommand(page, 'TaskNotes: Quick add task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.modal, .tasknotes-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const nlpInput = modal.locator(
      '.task-creation-nlp-input, .cm-editor, textarea'
    ).first();
    await expect(nlpInput).toBeVisible({ timeout: 3000 });

    // Type + trigger for project suggestions
    await nlpInput.click();
    await page.keyboard.type('Task for +', { delay: 50 });
    await page.waitForTimeout(500);

    const autocompleteDropdown = page.locator(
      '.cm-tooltip-autocomplete, .suggestion-container'
    );

    const dropdownVisible = await autocompleteDropdown.isVisible({ timeout: 2000 }).catch(() => false);

    if (dropdownVisible) {
      // Check for metadata display in project suggestions
      // After PR #1215, project suggestions should include metadata rows
      const metadataDisplay = autocompleteDropdown.locator(
        '.cm-project-suggestion__metadata, .project-metadata, .suggestion-metadata'
      );

      const hasMetadata = await metadataDisplay.isVisible({ timeout: 1000 }).catch(() => false);

      // This documents the expectation that project suggestions show metadata
      // The feature was added in PR #1215
      expect(hasMetadata).toBe(true);
    }

    // Clean up
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1203 - dropdown keyboard navigation works correctly', async () => {
    /**
     * This test verifies that dropdown keyboard navigation works correctly.
     * Common trigger dropdown issues include:
     * - Arrow keys not working to navigate suggestions
     * - Enter/Tab not selecting the highlighted option
     * - Focus issues when using keyboard
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Quick add task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.modal, .tasknotes-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const nlpInput = modal.locator(
      '.task-creation-nlp-input, .cm-editor, textarea'
    ).first();
    await expect(nlpInput).toBeVisible({ timeout: 3000 });

    // Type @ trigger
    await nlpInput.click();
    await page.keyboard.type('@', { delay: 50 });
    await page.waitForTimeout(500);

    const autocompleteDropdown = page.locator(
      '.cm-tooltip-autocomplete, .suggestion-container'
    );

    const dropdownVisible = await autocompleteDropdown.isVisible({ timeout: 2000 }).catch(() => false);

    if (dropdownVisible) {
      // Test arrow down navigation
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      // Check if an item is selected/highlighted
      const selectedItem = autocompleteDropdown.locator(
        '.cm-completionLabel-active, .is-selected, .suggestion-item.is-active, [aria-selected="true"]'
      );

      const hasSelection = await selectedItem.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasSelection).toBe(true);

      // Test Enter to accept selection
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // The dropdown should close after selection
      const dropdownStillVisible = await autocompleteDropdown.isVisible({ timeout: 500 }).catch(() => false);
      expect(dropdownStillVisible).toBe(false);
    }

    // Clean up
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
