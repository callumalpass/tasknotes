/**
 * Issue #1227: Project view that shows tasks broken again in 4.0.5
 *
 * Bug report: The view that shows tasks related to a project stopped appearing
 * automatically in version 4.0.5. Users need to manually add `![[relationships.base]]`
 * inside the #project note to see the associated tasks.
 *
 * The bug worked in 4.0.4 but regressed in 4.0.5.
 *
 * Root cause analysis:
 * The RelationshipsDecorations plugin should automatically inject a relationships
 * widget into project notes (notes that are referenced by tasks via the "projects"
 * property). The widget embeds the `relationships.base` file to show related tasks.
 *
 * The regression may be related to:
 * 1. The project detection logic in `isFileUsedAsProject()`
 * 2. The DependencyCache not being initialized/built when the widget tries to check
 * 3. Timing issues with when the widget injection occurs vs cache readiness
 * 4. Changes to how frontmatter-less project notes are detected
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1227
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #1227: Project view tasks not showing automatically', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1227 - relationships widget should appear on project notes', async () => {
    /**
     * This test verifies that when a user opens a project note (a note referenced
     * by tasks via the "projects" field), the relationships widget automatically
     * appears showing the related tasks.
     *
     * Expected behavior (worked in 4.0.4):
     * - Open a project note (note referenced by tasks)
     * - The relationships widget should automatically appear
     * - The widget should show tasks that reference this project
     *
     * Current behavior (bug in 4.0.5):
     * - Open a project note
     * - No widget appears automatically
     * - User must manually add `![[relationships.base]]` to see related tasks
     */
    const page = app.page;

    // First, create a task that references a project
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(1000);

    // Check if the task creation modal is visible
    const modal = page.locator('.tasknotes-modal, .modal-container').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in task details - the exact selectors depend on TaskNotes modal structure
    // We need to set a project reference
    const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="Task"], .task-title-input').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('Test task for project view bug #1227');
    }

    // Find and set the project field
    // This might be a dropdown, autocomplete, or text field
    const projectField = page.locator('[data-field="projects"], .project-field, input[placeholder*="project"]').first();
    if (await projectField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectField.click();
      await page.keyboard.type('TestProject1227');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }

    // Save the task
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), .mod-cta').first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }
    await page.waitForTimeout(1000);

    // Now create the project note (or open it if it already exists)
    await runCommand(page, 'Create new note');
    await page.waitForTimeout(500);

    // Name the note as the project
    const fileNameInput = page.locator('input[placeholder*="name"], .prompt-input').first();
    if (await fileNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fileNameInput.fill('TestProject1227');
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);

    // The relationships widget should appear automatically since this note is
    // referenced as a project by our task
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    // This is the failing assertion - the widget should be visible
    await expect(relationshipsWidget).toBeVisible({ timeout: 5000 });

    // Additionally, the widget should contain our task
    const widgetContent = await relationshipsWidget.textContent();
    expect(widgetContent).toContain('Test task for project view bug');
  });

  test.fixme('reproduces issue #1227 - project notes without frontmatter should show widget', async () => {
    /**
     * This test specifically covers project notes that don't have frontmatter.
     * The 4.0.5 release notes mention a fix for "relationships widget not appearing
     * on project notes without frontmatter", suggesting this was a known issue.
     *
     * The bug reporter's scenario likely involves:
     * 1. A plain note with just #project tag (no YAML frontmatter)
     * 2. Tasks referencing this note via [[ProjectName]] in their projects field
     * 3. The relationships widget should still appear on the project note
     */
    const page = app.page;

    // Open or navigate to a project note that has NO frontmatter
    // Just a plain markdown file that is referenced by tasks
    const projectNotePath = 'TestProjectNoFrontmatter1227.md';

    // Use quick switcher to open/create the file
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input').first();
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickSwitcher.fill(projectNotePath);
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);

    // Verify we're on a note without frontmatter
    // The editor content should not start with "---"
    const editorContent = page.locator('.cm-content, .markdown-source-view .cm-sizer');
    const content = await editorContent.textContent().catch(() => '');

    // Now create a task that references this project
    await runCommand(page, 'TaskNotes: Create new task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.tasknotes-modal, .modal-container').first();
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set project to reference our frontmatter-less note
      const projectField = page.locator('[data-field="projects"], .project-field, input[placeholder*="project"]').first();
      if (await projectField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await projectField.click();
        await page.keyboard.type('TestProjectNoFrontmatter1227');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
      }

      const titleInput = page.locator('input[placeholder*="title"], .task-title-input').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Task referencing frontmatter-less project');
      }

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), .mod-cta').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
      }
      await page.waitForTimeout(1000);
    }

    // Navigate back to the project note
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);
    const quickSwitcher2 = page.locator('.prompt-input').first();
    if (await quickSwitcher2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickSwitcher2.fill(projectNotePath);
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // The relationships widget should appear even though this note has no frontmatter
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');

    // This should pass after the fix - widget visible on frontmatter-less project notes
    await expect(relationshipsWidget).toBeVisible({ timeout: 5000 });
  });

  test.fixme('reproduces issue #1227 - workaround manual embed should work', async () => {
    /**
     * This test documents the workaround mentioned in the bug report:
     * Manually adding `![[relationships.base]]` to the project note.
     *
     * If the automatic widget fails, users can use this workaround.
     * This test verifies the workaround itself works.
     */
    const page = app.page;

    // Create/open a project note
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input').first();
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickSwitcher.fill('TestProjectWorkaround1227.md');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);

    // Type the workaround embed into the note
    const editor = page.locator('.cm-content, .markdown-source-view .cm-editor');
    await editor.click();
    await page.keyboard.type('![[relationships.base]]');
    await page.waitForTimeout(500);

    // Wait for the embed to render
    await page.waitForTimeout(2000);

    // The embedded relationships view should appear
    // Note: This embeds the Bases file which renders a table/view of related tasks
    const embeddedView = page.locator('.internal-embed, .markdown-embed');
    await expect(embeddedView).toBeVisible({ timeout: 5000 });
  });

  test.fixme('reproduces issue #1227 - DependencyCache should be initialized before widget check', async () => {
    /**
     * This test checks a potential root cause: the DependencyCache not being
     * initialized when the RelationshipsDecorations plugin checks whether a
     * note is used as a project.
     *
     * The `isFileUsedAsProject()` method logs a warning and triggers sync build
     * if indexes aren't built, but there might be a race condition or the
     * sync build might not complete before the widget decision is made.
     *
     * Expected behavior:
     * - When opening any note, the DependencyCache should already be built
     * - The `projectReferences` map should contain all project->task mappings
     * - Widget injection should correctly identify project notes
     */
    const page = app.page;

    // Open the console to check for warning messages
    // In Playwright we can't directly access console, but we can use CDP
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('DependencyCache')) {
        consoleMessages.push(msg.text());
      }
    });

    // Reload/restart to trigger initialization
    await page.reload();
    await page.waitForTimeout(3000);

    // Open a known project note
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input').first();
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickSwitcher.fill('TestProject1227');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(2000);

    // Check if there were any "indexes not built" warnings
    const hasInitializationWarning = consoleMessages.some((msg) =>
      msg.includes('isFileUsedAsProject called before indexes built')
    );

    // This should be false - indexes should be built before we need them
    // If this is true, there's a race condition causing the bug
    expect(hasInitializationWarning).toBe(false);

    // And the widget should be visible
    const relationshipsWidget = page.locator('.tasknotes-relationships-widget');
    await expect(relationshipsWidget).toBeVisible({ timeout: 5000 });
  });

  test.fixme('reproduces issue #1227 - widget should appear in both source and live preview modes', async () => {
    /**
     * The 4.0.5 release notes mention removing the "live preview mode restriction"
     * to allow widgets in both source and live preview modes. This test verifies
     * that the widget appears regardless of which editor mode is active.
     *
     * The bug reporter might be using source mode, which could explain why the
     * widget isn't appearing if there's still a mode-related issue.
     */
    const page = app.page;

    // Navigate to a project note
    await page.keyboard.press('Control+o');
    await page.waitForTimeout(500);

    const quickSwitcher = page.locator('.prompt-input').first();
    if (await quickSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickSwitcher.fill('TestProject1227');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);

    // Test in Live Preview mode (default)
    const widgetInLivePreview = page.locator('.tasknotes-relationships-widget');
    const isVisibleInLivePreview = await widgetInLivePreview.isVisible({ timeout: 3000 }).catch(() => false);

    // Switch to Source mode
    await runCommand(page, 'Toggle Live Preview/Source mode');
    await page.waitForTimeout(1000);

    // Widget should still be visible in Source mode
    const widgetInSource = page.locator('.tasknotes-relationships-widget');
    const isVisibleInSource = await widgetInSource.isVisible({ timeout: 3000 }).catch(() => false);

    // Switch to Reading mode
    await runCommand(page, 'Toggle reading view');
    await page.waitForTimeout(1000);

    // Widget should also be visible in Reading mode
    const widgetInReading = page.locator('.tasknotes-relationships-widget');
    const isVisibleInReading = await widgetInReading.isVisible({ timeout: 3000 }).catch(() => false);

    // All three modes should show the widget
    expect(isVisibleInLivePreview).toBe(true);
    expect(isVisibleInSource).toBe(true);
    expect(isVisibleInReading).toBe(true);
  });
});
