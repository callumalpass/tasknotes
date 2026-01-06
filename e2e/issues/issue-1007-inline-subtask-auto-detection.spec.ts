/**
 * Issue #1007: [FR]: Auto-detection of inline sub-tasks
 *
 * Feature request for automatic detection of inline subtasks based on indentation,
 * similar to how Task Genius plugin handles subtask hierarchy.
 *
 * Problem:
 * - Currently, TaskNotes uses a file-based subtask system where subtasks are
 *   separate files that reference a parent task via the "projects" field
 * - Users want inline subtasks (indented checkboxes) to be automatically recognized
 *   as subtasks of the parent task above them
 * - This would improve flow/UX when working with hierarchical task lists
 *
 * Requested behavior:
 * - Indented checkboxes should be auto-detected as subtasks of the preceding parent task
 * - A progress bar showing subtask completion percentage would be helpful
 * - Only indented items should be considered subtasks (not all items in a list)
 *
 * Example markdown structure the user wants supported:
 * ```
 * - [ ] Parent task
 *   - [ ] Subtask 1
 *   - [x] Subtask 2 (completed)
 *   - [ ] Subtask 3
 * ```
 * In this case, the parent task should show "1/3 subtasks complete" or similar.
 *
 * Implementation considerations:
 * - TasksPluginParser.ts already detects checkboxes via CHECKBOX_PATTERN
 * - Would need to add indentation detection to determine hierarchy
 * - Could add a new service for inline subtask detection
 * - Progress calculation would need to scan indented items following a parent
 * - UI would need to render a progress bar/indicator on parent tasks
 *
 * Current architecture:
 * - Tasks are individual files with YAML frontmatter (file-first approach)
 * - Subtask relationships use the "projects" field linking to parent tasks
 * - ProjectSubtasksService manages the subtask hierarchy
 * - No indentation-based hierarchy detection currently exists
 *
 * Affected areas:
 * - src/utils/TasksPluginParser.ts - Would need indentation-aware parsing
 * - src/services/ - New InlineSubtaskService for hierarchy detection
 * - src/ui/TaskCard.ts - Progress bar rendering
 * - src/editor/ - Inline task rendering with progress indicators
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1007
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1007: Auto-detection of inline sub-tasks', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1007 - indented checkboxes not recognized as subtasks', async () => {
    /**
     * This test verifies that indented checkboxes are NOT currently recognized
     * as subtasks of their parent task.
     *
     * STEPS TO REPRODUCE:
     * 1. Create a new note with a hierarchical task list (indented checkboxes)
     * 2. The parent task checkbox should show subtask progress, but currently doesn't
     *
     * CURRENT BEHAVIOR:
     * - All checkboxes are treated as independent tasks
     * - No hierarchy is inferred from indentation
     * - No progress bar is shown for parent tasks
     *
     * EXPECTED BEHAVIOR (after fix):
     * - Indented checkboxes are recognized as subtasks
     * - Parent task shows progress (e.g., "2/4 subtasks complete")
     * - Progress bar visualization similar to Task Genius plugin
     */
    const page = app.page;

    // Create a new note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    // Type a hierarchical task list in the editor
    const editor = page.locator('.cm-content, .markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Focus the editor and type the task hierarchy
    await editor.click();
    await page.waitForTimeout(200);

    // Create a parent task with indented subtasks
    const taskHierarchy = `- [ ] Parent task for project
  - [ ] Subtask 1 - design phase
  - [x] Subtask 2 - implementation (completed)
  - [ ] Subtask 3 - testing
  - [x] Subtask 4 - documentation (completed)`;

    await page.keyboard.type(taskHierarchy);
    await page.waitForTimeout(500);

    // Take a screenshot of the current state
    await page.screenshot({
      path: 'test-results/screenshots/issue-1007-hierarchical-tasks-no-detection.png',
    });

    // Check for any subtask progress indicator on the parent task
    // Currently, this should NOT exist (the feature doesn't exist yet)
    const progressIndicator = page.locator(
      '.subtask-progress, .task-progress-bar, [data-subtask-count], .inline-subtask-progress'
    );
    const hasProgress = await progressIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Subtask progress indicator visible: ${hasProgress}`);

    // This expectation will FAIL once the feature is implemented
    // Currently, there is no progress indicator for inline subtasks
    expect(hasProgress).toBe(false);

    // After the feature is implemented, this should be true:
    // expect(hasProgress).toBe(true);
  });

  test.fixme('reproduces issue #1007 - no progress bar for parent tasks with inline subtasks', async () => {
    /**
     * This test checks for the presence of a progress bar on parent tasks
     * that have indented subtasks.
     *
     * The user specifically mentioned wanting a "progress bar of subtasks completion"
     * similar to Task Genius plugin.
     *
     * CURRENT BEHAVIOR:
     * - No progress bar exists for inline subtask completion
     *
     * EXPECTED BEHAVIOR (after fix):
     * - Parent task line shows a small progress bar
     * - Progress bar reflects completion status of indented subtasks
     * - Example: If 2/4 subtasks are complete, progress bar shows 50%
     */
    const page = app.page;

    // Create a new note
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content, .markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(200);

    // Create tasks with some completed subtasks
    const taskHierarchy = `# Test note for inline subtasks

- [ ] Main project task
  - [x] First subtask (done)
  - [x] Second subtask (done)
  - [ ] Third subtask (pending)
  - [ ] Fourth subtask (pending)`;

    await page.keyboard.type(taskHierarchy);
    await page.waitForTimeout(500);

    // Look for progress bar element
    const progressBar = page.locator(
      '.subtask-progress-bar, .task-completion-progress, .inline-progress-indicator'
    );

    const hasProgressBar = await progressBar.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Progress bar visible: ${hasProgressBar}`);

    // Currently no progress bar exists
    expect(hasProgressBar).toBe(false);

    // After fix, the progress bar should show 50% (2/4 subtasks complete)
    // and this expectation should change to:
    // expect(hasProgressBar).toBe(true);
    // const progressValue = await progressBar.getAttribute('data-progress');
    // expect(progressValue).toBe('50');

    await page.screenshot({
      path: 'test-results/screenshots/issue-1007-no-progress-bar.png',
    });
  });

  test.fixme('reproduces issue #1007 - TasksPluginParser does not extract indentation level', async () => {
    /**
     * This test documents that the current TasksPluginParser does not
     * extract or preserve indentation information from task lines.
     *
     * The CHECKBOX_PATTERN in TasksPluginParser.ts captures:
     * - Leading whitespace (but discards it for task matching)
     * - Checkbox state ([x] or [ ])
     * - Task content
     *
     * It does NOT currently:
     * - Track indentation level (how many spaces/tabs)
     * - Associate tasks with their parent based on indentation
     * - Calculate hierarchy depth
     *
     * CURRENT BEHAVIOR:
     * - Parser extracts task data but ignores hierarchical context
     * - All tasks are parsed as flat, independent items
     *
     * EXPECTED BEHAVIOR (after fix):
     * - Parser should include indentation level in ParsedTaskData
     * - Hierarchy can be reconstructed from indentation levels
     */
    const page = app.page;

    // This is primarily a code-level test, but we document the expected
    // UI behavior that would result from the parser enhancement

    // Create a note with varying indentation levels
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content, .markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(200);

    // Multi-level hierarchy
    const deepHierarchy = `- [ ] Level 0 task
  - [ ] Level 1 subtask A
  - [ ] Level 1 subtask B
    - [ ] Level 2 sub-subtask B1
    - [x] Level 2 sub-subtask B2 (completed)
  - [x] Level 1 subtask C (completed)`;

    await page.keyboard.type(deepHierarchy);
    await page.waitForTimeout(500);

    // Check if any hierarchy indicators are rendered
    const hierarchyIndicator = page.locator(
      '[data-indent-level], .task-hierarchy-depth, .subtask-nesting-indicator'
    );

    const hasHierarchyInfo = await hierarchyIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Hierarchy indicators visible: ${hasHierarchyInfo}`);

    // Currently no hierarchy detection
    expect(hasHierarchyInfo).toBe(false);

    await page.screenshot({
      path: 'test-results/screenshots/issue-1007-no-hierarchy-detection.png',
    });
  });

  test.fixme('reproduces issue #1007 - instant convert does not preserve subtask relationships', async () => {
    /**
     * This test checks that when converting inline tasks to TaskNotes,
     * the parent-child relationship based on indentation is NOT preserved.
     *
     * The InstantTaskConvertService converts individual checkboxes to
     * TaskNote files, but does not establish project links based on
     * indentation hierarchy.
     *
     * CURRENT BEHAVIOR:
     * - Each converted task becomes an independent TaskNote file
     * - No "projects" field is populated based on indentation
     *
     * EXPECTED BEHAVIOR (after fix):
     * - Converting a parent task should also convert its indented subtasks
     * - Subtask files should have "projects" field linking to parent
     * - Or: Option to keep inline subtasks as checkboxes within parent note
     */
    const page = app.page;

    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content, .markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(200);

    // Create a simple parent-subtask structure
    const taskWithSubtasks = `- [ ] Convert me to TaskNote
  - [ ] I am a subtask
  - [ ] I am another subtask`;

    await page.keyboard.type(taskWithSubtasks);
    await page.waitForTimeout(500);

    // Look for instant convert buttons
    const convertButton = page.locator(
      '.instant-convert-button, .convert-to-tasknote-button, [data-action="convert-task"]'
    );

    const hasConvertButton = await convertButton.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasConvertButton) {
      console.log('Convert button found - would convert tasks individually, not as hierarchy');

      // Document that clicking convert would NOT preserve hierarchy
      // The subtasks would become separate, unrelated TaskNote files
    } else {
      console.log('No instant convert button visible in this context');
    }

    await page.screenshot({
      path: 'test-results/screenshots/issue-1007-instant-convert-no-hierarchy.png',
    });
  });

  test.fixme('reproduces issue #1007 - comparison with desired Task Genius behavior', async () => {
    /**
     * This test documents the desired behavior by comparing to what the user
     * described as similar to "Task Genius" plugin functionality.
     *
     * Task Genius features (referenced in the issue):
     * - Auto-detection of indented items as subtasks
     * - Progress bar showing completion percentage
     * - Visual indicator of subtask count/status on parent
     *
     * The user provided a screenshot showing:
     * - A parent task "Do something" with subtasks
     * - Subtasks listed with checkboxes
     * - A progress bar next to the parent task
     *
     * CURRENT BEHAVIOR:
     * - No auto-detection of inline subtasks
     * - No progress bar visualization
     * - Subtasks only work via file-based "projects" field linking
     *
     * EXPECTED BEHAVIOR (after fix):
     * - Inline subtask detection based on indentation
     * - Progress bar showing X/Y subtasks complete
     * - Works without requiring separate task files
     */
    const page = app.page;

    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content, .markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(200);

    // Recreate the structure from the user's screenshot
    const taskGeniusStyle = `- [ ] Do something
  - [ ] Subtask one
  - [x] Subtask two
  - [ ] Subtask three`;

    await page.keyboard.type(taskGeniusStyle);
    await page.waitForTimeout(500);

    // Check for Task Genius-like features
    const progressElements = page.locator(
      '.subtask-count, .completion-badge, .progress-indicator, [data-subtasks]'
    );

    const hasTaskGeniusFeatures =
      await progressElements.isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`Task Genius-like features present: ${hasTaskGeniusFeatures}`);

    // Document what's missing
    const missingFeatures = [
      'No automatic subtask detection from indentation',
      'No progress bar showing completion percentage',
      'No visual indicator of subtask count on parent task',
      'No inline progress calculation',
    ];

    console.log('Missing features compared to Task Genius:');
    missingFeatures.forEach((feature) => console.log(`  - ${feature}`));

    expect(hasTaskGeniusFeatures).toBe(false);

    await page.screenshot({
      path: 'test-results/screenshots/issue-1007-missing-task-genius-features.png',
    });
  });

  test.fixme('reproduces issue #1007 - only indented items should be subtasks', async () => {
    /**
     * This test verifies the specific requirement that ONLY indented items
     * should be considered subtasks.
     *
     * The user explicitly stated: "I think it only makes sense for indented
     * items to be considered subtasks."
     *
     * This means:
     * - Items at the same indentation level are siblings, not parent-child
     * - Only items indented MORE than the preceding task are subtasks
     * - Dedentation should end the subtask scope
     *
     * Example:
     * ```
     * - [ ] Task A          <- Parent
     *   - [ ] Subtask A1    <- Child of A
     *   - [ ] Subtask A2    <- Child of A
     * - [ ] Task B          <- NOT a child of A (same level)
     *   - [ ] Subtask B1    <- Child of B
     * ```
     */
    const page = app.page;

    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content, .markdown-source-view');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(200);

    // Create a structure with multiple parent tasks and subtasks
    const multiParentStructure = `- [ ] Task A (should have 2 subtasks)
  - [ ] Subtask A1
  - [x] Subtask A2 (completed)
- [ ] Task B (should NOT be subtask of A)
  - [ ] Subtask B1
- [ ] Task C (no subtasks)`;

    await page.keyboard.type(multiParentStructure);
    await page.waitForTimeout(500);

    // After implementation, we would verify:
    // - Task A shows "1/2 subtasks complete"
    // - Task B shows "0/1 subtasks complete"
    // - Task C shows no subtask indicator
    // - Task B is NOT counted as a subtask of Task A

    console.log('Verifying indentation-only subtask scope:');
    console.log('  Task A at level 0 - should have 2 subtasks (A1, A2)');
    console.log('  Task B at level 0 - NOT a subtask of A, has 1 subtask (B1)');
    console.log('  Task C at level 0 - NOT a subtask, has no subtasks');

    await page.screenshot({
      path: 'test-results/screenshots/issue-1007-indentation-scope-verification.png',
    });
  });
});
