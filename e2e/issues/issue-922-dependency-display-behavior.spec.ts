/**
 * Issue #922: [Bug] Dependency display behavior
 *
 * This issue reports multiple problems with how dependency (blocked/blocking)
 * information is displayed in task cards:
 *
 * 1. Icon display in task cards:
 *    - Tasks that are blocking other tasks show a "git-branch" icon (dependency concept icon)
 *      instead of a "blocking" specific icon
 *    - Tasks that are blocked show NO icon at all
 *    - Expected: Both blocked and blocking tasks should show appropriate distinct icons
 *
 * 2. Property display settings:
 *    - When "blocked" and "blocking" are enabled in settings under
 *      Appearance & UI -> Task Cards -> Default visible properties -> Core Properties:
 *    - "Blocking (count)" shows in red on task cards in Agenda/Task List views
 *    - "Blocked" text does NOT show even when enabled in settings
 *    - In embedded task card widgets on the task itself, "Blocking" text doesn't display either
 *
 * 3. No clickable links to blocked or blocking tasks:
 *    - The blockedBy property is an object with multiple lines (uid, reltype, gap)
 *      which makes the link not clickable in reading/preview mode or file properties sidebar
 *    - There's no automated clickable link to "tasks blocking this task" in the task card
 *    - There's no automated clickable link to "tasks blocked by this task" in the task card
 *
 * Affected files:
 * - src/ui/TaskCard.ts (lines 1535-1643): Icon and property display logic
 * - src/types.ts (lines 424-468): TaskDependency data structure
 * - src/utils/dependencyUtils.ts: Dependency serialization and formatting
 * - styles/task-card-bem.css (lines 142-159, 488-519): Styling for blocked/blocking badges
 *
 * @see https://github.com/callumalpass/tasknotes/issues/922
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #922: Dependency display behavior', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #922 - blocked tasks should show an icon in task cards', async () => {
    /**
     * Bug: Tasks that are blocked by other tasks do not show any icon in task cards.
     *
     * Current behavior:
     * - Blocking tasks show "git-branch" icon (via blocking toggle)
     * - Blocked tasks show NO icon
     *
     * Expected behavior:
     * - Blocked tasks should show a "blocked" indicator icon (e.g., chain-link or similar)
     *
     * Code reference:
     * - src/ui/TaskCard.ts:1535-1552 creates blocking toggle with "git-branch" icon
     * - There is no corresponding code to create a blocked indicator icon
     */
    const page = app.page;

    // Create a blocking task (Task A)
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.modal');
    const titleInput = modal.locator('input[placeholder*="title"], input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Blocking Task A - 922');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Create a blocked task (Task B) that is blocked by Task A
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(1000);

    const modal2 = page.locator('.modal');
    const titleInput2 = modal2.locator('input[placeholder*="title"], input[aria-label*="title"]').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill('Blocked Task B - 922');

      // Set blockedBy to reference Task A
      const blockedByField = modal2.locator('[data-property="blockedBy"], .blockedBy-field').first();
      if (await blockedByField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await blockedByField.click();
        await page.keyboard.type('Blocking Task A - 922', { delay: 30 });
        await page.waitForTimeout(500);
        const suggestion = page.locator('.suggestion-item').first();
        if (await suggestion.isVisible({ timeout: 1000 }).catch(() => false)) {
          await suggestion.click();
        }
      }

      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Open Agenda or Task List view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(2000);

    // Find the blocked task card
    const blockedTaskCard = page.locator('.task-card').filter({ hasText: 'Blocked Task B - 922' }).first();
    const blockedTaskVisible = await blockedTaskCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (blockedTaskVisible) {
      // Check for blocked indicator icon
      // Current behavior: NO icon is shown for blocked tasks
      // The task-card__blocking-toggle class is used for blocking tasks, but there's no
      // corresponding task-card__blocked-toggle or similar for blocked tasks
      const blockedIcon = blockedTaskCard.locator('.task-card__blocked-toggle, .task-card__blocked-indicator, [class*="blocked"]');
      const hasBlockedIcon = await blockedIcon.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Blocked task card visible:', blockedTaskVisible);
      console.log('Has blocked icon:', hasBlockedIcon);

      // This assertion will fail with current behavior - blocked tasks show no icon
      // expect(hasBlockedIcon).toBe(true);

      if (!hasBlockedIcon) {
        console.log('BUG REPRODUCED: Blocked task shows no indicator icon');
      }
    }
  });

  test.fixme('reproduces issue #922 - blocking tasks use generic dependency icon instead of specific blocking icon', async () => {
    /**
     * Bug: Tasks that are blocking other tasks show the "git-branch" icon
     * which represents the general concept of dependencies, rather than
     * a specific "blocking" icon.
     *
     * The user reports seeing three different icons:
     * 1. Chain link icon - for "blocked by"
     * 2. Two connected nodes icon - for "blocking"
     * 3. Two connected nodes with different curve - for dependencies concept
     *
     * Current behavior:
     * - Blocking tasks show "git-branch" icon (dependencies concept)
     *
     * Expected behavior:
     * - Blocking tasks should show a distinct "blocking" icon (two connected nodes)
     *
     * Code reference: src/ui/TaskCard.ts:1542 uses icon: "git-branch"
     */
    const page = app.page;

    // Open Agenda or Task List view where we have the blocking task from previous test
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(2000);

    // Find the blocking task card
    const blockingTaskCard = page.locator('.task-card').filter({ hasText: 'Blocking Task A - 922' }).first();
    const blockingTaskVisible = await blockingTaskCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (blockingTaskVisible) {
      // Check the icon used for the blocking toggle
      const blockingToggle = blockingTaskCard.locator('.task-card__blocking-toggle');
      const toggleVisible = await blockingToggle.isVisible({ timeout: 2000 }).catch(() => false);

      if (toggleVisible) {
        // Check what icon is being used
        const iconElement = blockingToggle.locator('svg, .svg-icon');
        const iconClasses = await iconElement.getAttribute('class').catch(() => '');

        console.log('Blocking toggle icon classes:', iconClasses);

        // The current implementation uses "git-branch" icon
        // Expected: Should use a more specific "blocking" icon (e.g., git-merge, workflow, etc.)
        // or the "two connected nodes" icon described in the issue

        console.log('Current icon is "git-branch" - should be a specific blocking icon');
      }
    }
  });

  test.fixme('reproduces issue #922 - "blocked" property text does not display when enabled in settings', async () => {
    /**
     * Bug: When "blocked" is enabled in settings under
     * Appearance & UI -> Task Cards -> Default visible properties -> Core Properties,
     * the "Blocked" text does NOT appear on task cards, even for blocked tasks.
     *
     * Current behavior:
     * - "Blocking (count)" text appears in red when enabled
     * - "Blocked" text does NOT appear even when enabled
     *
     * Code reference:
     * - src/ui/TaskCard.ts:1603-1622 handles "blocked" property display
     * - The code checks task.isBlocked and creates a pill if true
     * - The issue may be that isBlocked is not being computed correctly
     *   or the property isn't being included in propertiesToShow
     */
    const page = app.page;

    // Enable blocked property in settings
    await runCommand(page, 'TaskNotes: Open settings');
    await page.waitForTimeout(1500);

    const settingsModal = page.locator('.modal, .tn-settings');
    await settingsModal.waitFor({ timeout: 5000 }).catch(() => {});

    // Navigate to Appearance & UI -> Task Cards -> Default visible properties
    // and enable "blocked" property
    // (This navigation depends on the settings UI structure)

    // Close settings for now
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Open Agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(2000);

    // Find the blocked task card
    const blockedTaskCard = page.locator('.task-card').filter({ hasText: 'Blocked Task B - 922' }).first();
    const blockedTaskVisible = await blockedTaskCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (blockedTaskVisible) {
      // Check for "Blocked" text pill
      const blockedPill = blockedTaskCard.locator('.task-card__metadata-pill--blocked');
      const hasBlockedPill = await blockedPill.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Blocked task visible:', blockedTaskVisible);
      console.log('Has "Blocked" text pill:', hasBlockedPill);

      if (!hasBlockedPill) {
        console.log('BUG REPRODUCED: "Blocked" text does not display even when enabled in settings');

        // Additional debug: Check if task.isBlocked is actually true
        // This might be a data/cache issue rather than display issue
      }
    }
  });

  test.fixme('reproduces issue #922 - "blocking" property text does not display in embedded task widgets', async () => {
    /**
     * Bug: In embedded task card widgets on the task note itself,
     * the "Blocking" text does not display even when the task is blocking others.
     *
     * Current behavior:
     * - "Blocking (count)" appears in Agenda and Task List views
     * - "Blocking" does NOT appear in embedded task card widgets
     *
     * This may be due to different rendering paths or property visibility
     * settings not being applied to embedded widgets.
     */
    const page = app.page;

    // Open the blocking task note directly
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Blocking Task A - 922', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Look for the embedded task card widget on the note
    const embeddedWidget = page.locator('.tasknotes-task-widget, .task-widget, .embedded-task-card');
    const widgetVisible = await embeddedWidget.isVisible({ timeout: 5000 }).catch(() => false);

    if (widgetVisible) {
      // Check for "Blocking" text in the embedded widget
      const blockingPill = embeddedWidget.locator('.task-card__metadata-pill--blocking, text=Blocking');
      const hasBlockingText = await blockingPill.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Embedded widget visible:', widgetVisible);
      console.log('Has "Blocking" text in widget:', hasBlockingText);

      if (!hasBlockingText) {
        console.log('BUG REPRODUCED: "Blocking" text does not display in embedded task widgets');
      }
    }

    // Close the note
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #922 - blockedBy links not clickable in reading mode due to object structure', async () => {
    /**
     * Bug: The blockedBy property stores TaskDependency objects with multiple fields
     * (uid, reltype, gap), which makes the link not directly clickable in:
     * - Reading/preview mode
     * - File properties sidebar view
     *
     * Data structure (from src/types.ts:424-468):
     * ```yaml
     * blockedBy:
     *   - uid: "[[Blocking Task]]"
     *     reltype: "FINISHTOSTART"
     *     gap: null
     * ```
     *
     * The nested object structure means the Obsidian link syntax [[Task]]
     * inside the uid field is not recognized as a clickable link.
     *
     * Expected behavior:
     * - Links to blocking tasks should be clickable somewhere in the UI
     * - Either in the frontmatter display, or in a dedicated UI element
     */
    const page = app.page;

    // Open the blocked task note to view its frontmatter
    await runCommand(page, 'Quick switcher: Open quick switcher');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt');
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('Blocked Task B - 922', { delay: 30 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Switch to reading mode to test link clickability
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(1000);

    // Check if there's a clickable link to the blocking task
    // The blockedBy property is stored as an object, so [[Blocking Task A - 922]]
    // inside the uid field may not be rendered as a clickable link

    // Look for the file properties view in the sidebar
    const propertiesPanel = page.locator('.file-properties, .metadata-container');
    const propertiesVisible = await propertiesPanel.isVisible({ timeout: 3000 }).catch(() => false);

    if (propertiesVisible) {
      // Check for blockedBy property and its link
      const blockedByProperty = propertiesPanel.locator('[data-property="blockedBy"], .property-blockedBy');
      const blockedByVisible = await blockedByProperty.isVisible({ timeout: 2000 }).catch(() => false);

      if (blockedByVisible) {
        // Check if there's a clickable link within the blockedBy property
        const linkInBlockedBy = blockedByProperty.locator('a.internal-link, .cm-hmd-internal-link');
        const hasClickableLink = await linkInBlockedBy.isVisible({ timeout: 1000 }).catch(() => false);

        console.log('blockedBy property visible:', blockedByVisible);
        console.log('Has clickable link in blockedBy:', hasClickableLink);

        if (!hasClickableLink) {
          console.log('BUG REPRODUCED: blockedBy link is not clickable due to object structure');
        }
      }
    }

    // Switch back to edit mode
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(500);

    // Close the note
    await page.keyboard.press('Control+w');
    await page.waitForTimeout(500);
  });

  test.fixme('reproduces issue #922 - no clickable links to blocked tasks from blocking task card', async () => {
    /**
     * Bug: There is no automated clickable link to "tasks blocked by this task"
     * anywhere in the task card, note body, or properties view.
     *
     * The blocking toggle does expand to show blocking tasks, but:
     * 1. The expand feature may not be discoverable
     * 2. The links in the expanded section may not be clickable
     *
     * Expected behavior:
     * - Users should be able to easily navigate to tasks that are blocked by this task
     * - Either via a clickable link in the task card, or in the properties view
     */
    const page = app.page;

    // Open Agenda view
    await runCommand(page, 'TaskNotes: Open agenda view');
    await page.waitForTimeout(2000);

    // Find the blocking task card
    const blockingTaskCard = page.locator('.task-card').filter({ hasText: 'Blocking Task A - 922' }).first();
    const blockingTaskVisible = await blockingTaskCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (blockingTaskVisible) {
      // Look for the blocking toggle
      const blockingToggle = blockingTaskCard.locator('.task-card__blocking-toggle');
      const toggleVisible = await blockingToggle.isVisible({ timeout: 2000 }).catch(() => false);

      if (toggleVisible) {
        // Click the toggle to expand blocked tasks
        await blockingToggle.click();
        await page.waitForTimeout(500);

        // Check if blocked tasks are shown
        const blockedTasksContainer = blockingTaskCard.locator('.task-card__blocking');
        const containerVisible = await blockedTasksContainer.isVisible({ timeout: 2000 }).catch(() => false);

        if (containerVisible) {
          // Check if the blocked task link is clickable
          const blockedTaskLink = blockedTasksContainer.locator('a.internal-link, .task-card--dependency');
          const linkClickable = await blockedTaskLink.isVisible({ timeout: 1000 }).catch(() => false);

          console.log('Blocked tasks container visible:', containerVisible);
          console.log('Blocked task link clickable:', linkClickable);

          // The expanded section shows task cards, but the user wants direct clickable links
          // that work from the main task card or properties
        }
      }
    }
  });

  test.fixme('reproduces issue #922 - property visibility settings should affect embedded widgets consistently', async () => {
    /**
     * Bug: The property visibility settings for "blocked" and "blocking"
     * work differently between:
     * - Agenda view / Task List view (blocking shows, blocked doesn't)
     * - Embedded task widgets (neither show)
     *
     * Expected behavior:
     * - Property visibility settings should apply consistently across all views
     * - If "blocked" and "blocking" are enabled, they should show everywhere
     */
    const page = app.page;

    // First verify that propertiesToShow includes blocked and blocking
    // when they're enabled in settings

    // Open settings and check the property visibility configuration
    await runCommand(page, 'TaskNotes: Open settings');
    await page.waitForTimeout(1500);

    const settingsModal = page.locator('.modal, .tn-settings');
    if (await settingsModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for the Default visible properties section
      // This would involve navigating through the settings UI

      // For now, just log what we're testing
      console.log('Testing property visibility consistency across views');

      // Check if blocked and blocking are in the default visible properties
      // src/settings/defaults.ts shows they're NOT in DEFAULT_INTERNAL_VISIBLE_PROPERTIES

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // The issue is that even when enabled, the display behavior differs:
    // - "blocking" shows in agenda/task list views but not embedded widgets
    // - "blocked" doesn't show anywhere

    // This suggests the rendering code paths are different for:
    // 1. Views (TaskCard.ts with full propertiesToShow handling)
    // 2. Embedded widgets (may use different rendering or property set)
  });
});
