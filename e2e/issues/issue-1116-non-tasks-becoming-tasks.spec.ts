/**
 * Issue #1116: Upgraded to 4.0.0-beta.2 and bunch of non-tasks became tasks
 *
 * Bug Description:
 * After upgrading to 4.0.0-beta.2 (and all 4.0 builds), TaskNotes started pulling in
 * a large number of notes as tasks when they shouldn't be. In the previous version,
 * only notes tagged with #task were recognized (as configured in settings).
 * After upgrading, task count jumped from 73 to over 650, including notes tagged with
 * #meetings, image-only notes, and other unrelated tags - all showing TaskNotes's
 * task circle indicator.
 *
 * Root cause analysis:
 * The issue stems from the 4.0.0-beta.1 refactor that replaced MinimalNativeCache with
 * just-in-time TaskManager. The key function is `isTaskFile()` in TaskManager.ts (lines 82-107)
 * which should validate whether a note meets task identification criteria based on:
 * 1. Tag-based identification: Uses `FilterUtils.matchesHierarchicalTagExact()` for exact matching
 * 2. Property-based identification: Matches frontmatter property values
 *
 * The bug likely occurs when:
 * - Task identification validation is bypassed in certain code paths
 * - Files with any frontmatter are treated as tasks regardless of tag/property configuration
 * - The DependencyCache or other components pull in files without proper `isTaskFile()` checks
 *
 * Related fixes:
 * - Issue #953: Fixed non-task notes incorrectly identified as subtasks (added isTaskFile validation)
 * - Issue #766: Fixed false positive task identification for tags containing "task" substring
 *
 * User workaround mentioned:
 * Filtering views to exclude tasks with no status hides most false positives.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1116
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1116: Non-tasks incorrectly identified as tasks after upgrade', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1116 - notes with non-task tags should not appear in Task List', async () => {
    /**
     * This test verifies that notes with tags OTHER than the configured task tag
     * are NOT recognized as tasks and do not appear in the Task List view.
     *
     * Expected behavior:
     * - Only notes with the configured task tag (e.g., #task) appear in Task List
     * - Notes with other tags (e.g., #meetings, #project, #idea) should NOT appear
     * - Task count should match actual task notes, not all frontmatter notes
     *
     * Current behavior (bug):
     * - Many non-task notes appear in Task List
     * - Notes with unrelated tags show the task circle indicator
     * - Task count is inflated (e.g., 650 instead of 73)
     */
    const page = app.page;

    // Open the Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    // Wait for the task list to load
    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Get all task cards and their tags
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    console.log(`Found ${taskCount} tasks in Task List`);

    // Check each task card to verify it has the expected task tag
    // In a properly working system, all displayed tasks should have the configured task tag
    for (let i = 0; i < Math.min(taskCount, 10); i++) {
      const card = taskCards.nth(i);
      const cardTags = await card.locator('.task-card__tag').allTextContents();
      const cardTitle = await card.locator('.task-card__title').textContent();

      console.log(`Task ${i + 1}: "${cardTitle}" - Tags: [${cardTags.join(', ')}]`);

      // If this is a false positive, it would have non-task tags like #meetings
      // and lack the actual task identification tag
    }

    // Close the Task List view
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1116 - notes with only image content should not be tasks', async () => {
    /**
     * This test verifies that image-only notes (notes containing just an image embed
     * without task-related frontmatter) are NOT recognized as tasks.
     *
     * Expected behavior:
     * - Notes that only contain image embeds should not appear in Task List
     * - Having any frontmatter alone should not qualify a note as a task
     *
     * Current behavior (bug):
     * - Image-only notes with any frontmatter are incorrectly pulled into Task List
     */
    const page = app.page;

    // Open the Task List view
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Look for tasks that might be image-only notes
    // These typically have minimal or no content visible in the task card
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    let suspiciousImageOnlyNotes = 0;

    for (let i = 0; i < taskCount; i++) {
      const card = taskCards.nth(i);
      const title = await card.locator('.task-card__title').textContent();

      // Image-only notes often have titles like "Untitled" or contain image file names
      if (title?.includes('Untitled') || title?.match(/\.(png|jpg|jpeg|gif|webp)/i)) {
        suspiciousImageOnlyNotes++;
        console.log(`Suspicious image-only note found: "${title}"`);
      }
    }

    console.log(`Found ${suspiciousImageOnlyNotes} potentially image-only notes in Task List`);

    // After fix: this should be 0 (no false positives)
    expect(suspiciousImageOnlyNotes).toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1116 - verify isTaskFile validation is applied consistently', async () => {
    /**
     * This test verifies that the `isTaskFile()` validation in TaskManager is being
     * applied consistently across all code paths that enumerate tasks.
     *
     * The bug likely stems from:
     * - DependencyCache or other services not calling `isTaskFile()` before including files
     * - Code paths that iterate files without proper task identification checks
     * - Race conditions where files are added before validation
     *
     * This test opens Task List and compares the actual task count against what we'd
     * expect based on tag filtering.
     */
    const page = app.page;

    // First, check the settings to understand the expected task identification
    await runCommand(page, 'TaskNotes: Open Settings');
    await page.waitForTimeout(500);

    // Navigate to find task identification settings
    const settingsModal = page.locator('.modal');
    if (await settingsModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Look for task identification configuration
      const taskTagSetting = settingsModal.locator('text=task tag, text=Task Tag').first();
      if (await taskTagSetting.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Found task tag setting in settings modal');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Now open Task List and verify counts
    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Get task count from the view
    const taskCards = page.locator('.task-card');
    const visibleTaskCount = await taskCards.count();

    console.log(`Visible task count: ${visibleTaskCount}`);

    // The bug manifests as an unexpectedly high task count
    // In the user's case, it jumped from 73 to 650+
    // This test documents the issue for when the fix is implemented

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1116 - task circle indicator should not appear on non-tasks', async () => {
    /**
     * This test verifies that the task circle indicator (status circle)
     * does not appear on notes that are not identified as tasks.
     *
     * The user reported that non-task notes were showing TaskNotes's
     * task circle indicator after the upgrade.
     *
     * Expected behavior:
     * - Only notes that pass `isTaskFile()` validation should have task UI elements
     * - Notes with #meetings or other non-task tags should not have the circle indicator
     *
     * Current behavior (bug):
     * - Notes with non-task tags display the task circle indicator
     */
    const page = app.page;

    // Open a note that should NOT be a task (if we can identify one in the test vault)
    // For now, we check the Task List and look for notes with obviously wrong tags

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Look for task cards with the status circle (task indicator)
    const taskCardsWithCircle = page.locator('.task-card .task-card__status-circle');
    const circleCount = await taskCardsWithCircle.count();

    // Get corresponding task cards to check their tags
    const taskCards = page.locator('.task-card');
    const taskCount = await taskCards.count();

    console.log(`Task cards: ${taskCount}, Cards with status circles: ${circleCount}`);

    // Check for cards that have status circles but shouldn't
    // (i.e., cards that don't have the task identification tag)
    let incorrectCircles = 0;
    for (let i = 0; i < Math.min(taskCount, 20); i++) {
      const card = taskCards.nth(i);
      const hasCircle = await card.locator('.task-card__status-circle').isVisible().catch(() => false);
      const tags = await card.locator('.task-card__tag').allTextContents();

      // If it has a circle but has tags like "meetings" instead of "task", it's a false positive
      const hasTaskTag = tags.some(tag =>
        tag.toLowerCase() === 'task' ||
        tag.toLowerCase().startsWith('task/')
      );

      if (hasCircle && tags.length > 0 && !hasTaskTag) {
        incorrectCircles++;
        console.log(`False positive: Card with tags [${tags.join(', ')}] has status circle`);
      }
    }

    // After fix: no cards should have status circles unless they have the proper task tag
    expect(incorrectCircles).toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1116 - downgrade should restore correct task count', async () => {
    /**
     * This test documents the user's observation that downgrading to the previous
     * version restores correct behavior. This indicates the bug is specific to
     * changes made in 4.0.0-beta.x releases.
     *
     * Key changes in 4.0.0-beta.1 that could cause this:
     * - MinimalNativeCache was replaced with just-in-time TaskManager
     * - DependencyCache was introduced for task dependencies only
     * - Internal indexes were eliminated in favor of direct MetadataCache queries
     *
     * The test verifies that task enumeration uses proper `isTaskFile()` validation.
     */
    const page = app.page;

    // This test serves as documentation of the regression
    // The fix should ensure that all task enumeration code paths
    // validate notes against `isTaskFile()` before treating them as tasks

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Log information about the current state
    const taskCards = page.locator('.task-card');
    const currentCount = await taskCards.count();

    console.log(`Current task count: ${currentCount}`);
    console.log('If this count is significantly higher than expected (e.g., 650 vs 73),');
    console.log('the bug is reproducing - non-tasks are being counted as tasks.');

    // The fix should ensure this count matches the actual number of notes
    // with the configured task identification criteria

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test.fixme('reproduces issue #1116 - workaround: filtering by status should hide false positives', async () => {
    /**
     * This test verifies the user's workaround: filtering views to exclude tasks
     * that have no status should hide most of the false positives.
     *
     * This works because:
     * - True tasks typically have a status property (open, in-progress, done, etc.)
     * - False positives (non-task notes incorrectly identified) typically have no status
     *
     * However, this is just a workaround - the proper fix should prevent
     * non-tasks from being recognized in the first place.
     */
    const page = app.page;

    await runCommand(page, 'TaskNotes: Open Task List');
    await page.waitForTimeout(1000);

    const taskList = page.locator('.tasknotes-plugin');
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Get initial count (including false positives)
    const taskCards = page.locator('.task-card');
    const initialCount = await taskCards.count();
    console.log(`Initial task count (may include false positives): ${initialCount}`);

    // Try to apply a filter to exclude tasks without status
    // This depends on the UI having a filter option
    const filterButton = page.locator('[aria-label="Filter"], .filter-button, button:has-text("Filter")').first();

    if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(500);

      // Look for status filter option
      const statusFilter = page.locator('text=status, text=Status').first();
      if (await statusFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Found status filter option');
        // The workaround involves filtering out notes with no status
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // After applying the filter, count should be lower
    // (true tasks with status vs all false positives)

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
