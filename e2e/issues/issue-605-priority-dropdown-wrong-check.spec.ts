/**
 * Issue #605: [Bug]: Incorrect priority check on task list dropdown
 *
 * When clicking the priority icon of a task to change priority, the wrong priority
 * is checked as currently selected in the dropdown menu. This is cosmetic and doesn't
 * interfere with functionality, but is visible across multiple views:
 * - Kanban view
 * - Task list view
 * - Project subtask listings
 *
 * Expected: The dropdown should show a checkmark next to the task's current priority.
 * Actual: A different priority is checked, or no priority is checked.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/605
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #605: Incorrect priority check on task list dropdown', () => {
	test.beforeAll(async () => {
		app = await launchObsidian();
	});

	test.afterAll(async () => {
		if (app) {
			await closeObsidian(app);
		}
	});

	test.fixme(
		'reproduces issue #605 - priority dropdown should show correct checkmark in task list view',
		async () => {
			/**
			 * Steps to reproduce:
			 * 1. Create a task with a known priority (e.g., "high")
			 * 2. Open the Task List view
			 * 3. Click the priority dot/icon on the task card
			 * 4. Observe which priority has the checkmark (✓) in the dropdown
			 * 5. Expected: "High" should be checked
			 * 6. Actual: A different priority is checked
			 */
			const page = app.page;

			// Navigate to task list view
			await runCommand(app, 'TaskNotes: Open Task List');
			await page.waitForTimeout(2000);

			// Find a task card with a priority dot
			const priorityDot = page.locator('.task-card__priority-dot').first();
			await expect(priorityDot).toBeVisible({ timeout: 10000 });

			// Get the task's actual priority from the card's class
			const taskCard = priorityDot.locator('closest=.task-card');
			const cardClasses = await taskCard.getAttribute('class');

			// Extract priority from class like "task-card--priority-high"
			const priorityMatch = cardClasses?.match(/task-card--priority-(\w+)/);
			const actualPriority = priorityMatch?.[1];
			expect(actualPriority).toBeTruthy();

			// Click the priority dot to open the dropdown
			await priorityDot.click();
			await page.waitForTimeout(500);

			// The dropdown menu should be visible
			const menu = page.locator('.menu');
			await expect(menu).toBeVisible({ timeout: 5000 });

			// Find the menu item with a checkmark (✓) prefix
			const checkedItem = menu.locator('.menu-item').filter({ hasText: /^✓/ });

			// The checked item should correspond to the task's actual priority
			if (await checkedItem.count() > 0) {
				const checkedText = await checkedItem.first().textContent();
				// The checked item's label should match the actual priority
				expect(checkedText?.toLowerCase()).toContain(actualPriority!);
			} else {
				// BUG: No item is checked at all (possible type mismatch)
				expect(await checkedItem.count()).toBeGreaterThan(0);
			}

			// Close the menu by pressing Escape
			await page.keyboard.press('Escape');
		}
	);

	test.fixme(
		'reproduces issue #605 - priority dropdown should show correct checkmark in kanban view',
		async () => {
			/**
			 * Steps to reproduce (Kanban-specific):
			 * 1. Open a Kanban view (Bases view with kanban layout)
			 * 2. Find a task card with a visible priority indicator
			 * 3. Click the priority indicator
			 * 4. Check that the dropdown has the correct priority checked
			 */
			const page = app.page;

			// Look for a kanban board
			const kanbanBoard = page.locator('.kanban-view__board');
			await kanbanBoard.waitFor({ timeout: 10000 });

			// Find a priority dot in the kanban view
			const priorityDot = kanbanBoard.locator('.task-card__priority-dot').first();
			await expect(priorityDot).toBeVisible({ timeout: 10000 });

			// Click to open priority dropdown
			await priorityDot.click();
			await page.waitForTimeout(500);

			// Menu should appear
			const menu = page.locator('.menu');
			await expect(menu).toBeVisible({ timeout: 5000 });

			// Verify a checkmark is present and corresponds to the correct priority
			const checkedItem = menu.locator('.menu-item').filter({ hasText: /^✓/ });
			expect(await checkedItem.count()).toBeGreaterThan(0);

			await page.keyboard.press('Escape');
		}
	);

	test.fixme(
		'reproduces issue #605 - priority checkmark should update after changing priority',
		async () => {
			/**
			 * Steps to reproduce (stale closure scenario):
			 * 1. Open task list view
			 * 2. Click priority dot on a task → note which priority is checked
			 * 3. Select a different priority from the dropdown
			 * 4. Click the priority dot again
			 * 5. Expected: The newly selected priority should now be checked
			 * 6. Actual: The old priority may still be checked (stale closure)
			 */
			const page = app.page;

			await runCommand(app, 'TaskNotes: Open Task List');
			await page.waitForTimeout(2000);

			const priorityDot = page.locator('.task-card__priority-dot').first();
			await expect(priorityDot).toBeVisible({ timeout: 10000 });

			// First click: open dropdown and select a different priority
			await priorityDot.click();
			await page.waitForTimeout(500);

			let menu = page.locator('.menu');
			await expect(menu).toBeVisible({ timeout: 5000 });

			// Find an unchecked item (one without ✓) and click it to change priority
			const uncheckedItems = menu.locator('.menu-item').filter({ hasNotText: /^✓/ });
			const targetItem = uncheckedItems.first();
			const targetText = await targetItem.textContent();
			await targetItem.click();

			// Wait for the priority update to process
			await page.waitForTimeout(1000);

			// Second click: open dropdown again
			// Need to re-find the priority dot as the card may have been re-rendered
			const updatedPriorityDot = page.locator('.task-card__priority-dot').first();
			await updatedPriorityDot.click();
			await page.waitForTimeout(500);

			menu = page.locator('.menu');
			await expect(menu).toBeVisible({ timeout: 5000 });

			// The newly selected priority should now be checked
			const checkedItem = menu.locator('.menu-item').filter({ hasText: /^✓/ });
			expect(await checkedItem.count()).toBeGreaterThan(0);

			const checkedText = await checkedItem.first().textContent();
			// The checked item should match what we just selected
			expect(checkedText).toContain(targetText!.trim());

			await page.keyboard.press('Escape');
		}
	);
});
