/**
 * Issue #657: [FR] Create separate body templates for project level tasks and regular tasks
 *
 * Feature Request Description:
 * Project-level tasks have different YAML needs and body template structures compared to
 * regular tasks. A project-level task may need:
 * - Date aggregation from subtasks (earliest start -> latest due)
 * - Backlinks and connections to related documents
 * - Bases tables accumulating related notes, meeting notes, clips
 * - Dataview blocks for project-level queries
 *
 * Current Behavior:
 * - Single body template path (bodyTemplate) applied to ALL tasks via TaskCreationDefaults
 * - No distinction between project-level tasks and regular tasks during template selection
 * - ProjectSubtasksService can detect if a task is used as a project, but this is not
 *   used during task creation to select different templates
 *
 * Expected Behavior:
 * - Two separate template path settings:
 *   1. bodyTemplate (existing) - for regular tasks
 *   2. projectBodyTemplate (new) - for project-level tasks
 * - When creating a task that is designated as a project, the project template is used
 * - Regular tasks continue to use the existing bodyTemplate
 *
 * Related: Issue #693 (conditional templates by tag/property) is a broader version
 * of this feature. This issue specifically targets the project vs regular task distinction.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/657
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #657: Separate body templates for project-level and regular tasks', () => {
	test.beforeAll(async () => {
		app = await launchObsidian();
	});

	test.afterAll(async () => {
		if (app) {
			await closeObsidian(app);
		}
	});

	test.fixme(
		'reproduces issue #657 - settings should have separate template paths for project and regular tasks',
		async () => {
			/**
			 * This test verifies that the settings UI provides two separate template
			 * path fields: one for regular tasks and one for project-level tasks.
			 *
			 * Currently there is only a single bodyTemplate setting that applies to all tasks.
			 */
			const page = app.page;

			await runCommand(page, 'Open settings');
			await page.waitForTimeout(1000);

			const settingsModal = page.locator('.modal.mod-settings');
			if (await settingsModal.isVisible({ timeout: 5000 }).catch(() => false)) {
				const pluginTab = page.locator('.vertical-tab-nav-item:has-text("TaskNotes")').first();
				if (await pluginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
					await pluginTab.click();
					await page.waitForTimeout(500);
				}

				// Look for template-related settings
				const templateSettings = page.locator('.setting-item').filter({
					hasText: /template/i,
				});
				const templateSettingsCount = await templateSettings.count();
				console.log(`Found ${templateSettingsCount} template-related settings`);

				// Look specifically for a project-level template setting
				const projectTemplateField = page.locator('.setting-item').filter({
					hasText: /project.*template|template.*project/i,
				});
				const hasProjectTemplateField = await projectTemplateField.count();

				console.log(`Project template settings found: ${hasProjectTemplateField}`);

				// EXPECTED: At least one setting for "Project body template" or similar
				// CURRENT: Only a single "Body template" setting exists for all tasks
				// expect(hasProjectTemplateField).toBeGreaterThan(0);

				await page.keyboard.press('Escape');
			}
		}
	);

	test.fixme(
		'reproduces issue #657 - project-level task should use project body template',
		async () => {
			/**
			 * This test verifies that when creating a task designated as a project,
			 * it uses the project-specific body template rather than the regular one.
			 *
			 * Setup:
			 * 1. Configure a regular body template (Templates/RegularTask.md)
			 * 2. Configure a project body template (Templates/ProjectTask.md)
			 * 3. Create a project-level task
			 * 4. Verify it uses the project template content
			 */
			const page = app.page;

			// Create a task via TaskNotes
			await runCommand(page, 'TaskNotes: Create new task');
			await page.waitForTimeout(500);

			const createModal = page.locator('.modal');
			if (await createModal.isVisible({ timeout: 5000 }).catch(() => false)) {
				const titleInput = createModal
					.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[type="text"]')
					.first();

				if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
					await titleInput.fill('Q1 Project Plan');
				}

				// Look for a project designation toggle or field
				// EXPECTED: There should be a way to mark a task as a "project-level task"
				// during creation, which would trigger the project template
				const projectToggle = createModal
					.locator('[data-field="project"], .project-toggle, input[name="isProject"]')
					.first();

				const hasProjectToggle = await projectToggle.isVisible({ timeout: 2000 }).catch(() => false);
				console.log(`Project toggle in creation modal: ${hasProjectToggle}`);

				// Create the task
				const createButton = createModal.locator('button:has-text("Create"), button:has-text("Save")').first();
				if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
					await createButton.click();
				} else {
					await page.keyboard.press('Enter');
				}
				await page.waitForTimeout(1500);

				// EXPECTED: The created task should use project-specific template content
				// with bases tables, backlinks sections, date aggregation fields, etc.
				// CURRENT: Uses the same single template for all tasks regardless of project status
			}

			await page.keyboard.press('Escape');
			await page.waitForTimeout(300);

			console.log('\n=== Issue #657 Feature Gap ===');
			console.log('Current: Single bodyTemplate setting for all tasks');
			console.log('Expected: Separate projectBodyTemplate for project-level tasks');
			console.log('Expected: Regular tasks use bodyTemplate, project tasks use projectBodyTemplate');
		}
	);

	test.fixme(
		'reproduces issue #657 - regular task should still use the regular body template',
		async () => {
			/**
			 * This test verifies that when both templates are configured, a regular
			 * (non-project) task still uses the regular body template.
			 *
			 * This ensures backward compatibility: adding a project template setting
			 * should not change the behavior for regular tasks.
			 */
			const page = app.page;

			await runCommand(page, 'TaskNotes: Create new task');
			await page.waitForTimeout(500);

			const createModal = page.locator('.modal');
			if (await createModal.isVisible({ timeout: 5000 }).catch(() => false)) {
				const titleInput = createModal
					.locator('input[placeholder*="title"], input.task-title, .task-title-input, input[type="text"]')
					.first();

				if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
					await titleInput.fill('Simple daily standup note');
				}

				// Do NOT set this as a project-level task
				// Just create it as a regular task

				const createButton = createModal.locator('button:has-text("Create"), button:has-text("Save")').first();
				if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
					await createButton.click();
				} else {
					await page.keyboard.press('Enter');
				}
				await page.waitForTimeout(1500);

				// EXPECTED: The created task should use the regular bodyTemplate content
				// NOT the project template content
				// CURRENT: Uses the single bodyTemplate (correct behavior, just need to preserve it)
			}

			await page.keyboard.press('Escape');
			await page.waitForTimeout(300);

			console.log('\n=== Issue #657 Backward Compatibility ===');
			console.log('Regular tasks should continue using bodyTemplate (existing behavior)');
			console.log('Only project-level tasks should use the new projectBodyTemplate');
		}
	);
});
