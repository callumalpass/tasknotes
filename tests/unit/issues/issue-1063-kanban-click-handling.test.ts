/**
 * Issue #1063: [Bug] Click handling not working in Kanban view
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1063
 *
 * Bug Description:
 * In the Kanban view, clicking on a task does nothing (should open a modal);
 * double clicking does nothing (should open note).
 *
 * Version: 4.0.0-beta.1
 *
 * Root Cause Analysis:
 * The issue appears to be related to the event handling architecture between the
 * card wrapper and the task card elements in KanbanView.
 *
 * In KanbanView.ts, there's a specific structure:
 * 1. cardWrapper (div.kanban-view__card-wrapper) - created by KanbanView, made draggable
 * 2. card (div.task-card) - created by createTaskCard(), has click handlers attached
 *
 * The cardWrapper has event listeners added via setupCardDragHandlers():
 * - click handler (line 1436-1442): Checks for selection mode, calls stopPropagation if selection
 * - contextmenu handler (line 1445-1464): Always calls preventDefault and stopPropagation
 * - dragstart/dragend handlers for drag-and-drop functionality
 *
 * The inner card has click handlers via createTaskClickHandler() from clickHandlers.ts:
 * - Single-click: Opens task edit modal (if settings.singleClickAction === "edit")
 * - Double-click: Opens note (if settings.doubleClickAction === "openNote")
 * - Uses a 250ms timeout to distinguish single vs double clicks
 *
 * The click handler in createTaskClickHandler() (line 73-122) also calls stopPropagation()
 * at line 105, which should prevent the wrapper's handler from receiving the event.
 *
 * Potential issues to investigate:
 * 1. Event capture vs bubble phase conflicts - if wrapper uses capture, it runs first
 * 2. The excludeSelector option in createTaskClickHandler - check if something is being excluded
 * 3. Virtual scrolling re-rendering - cards may lose handlers when recycled
 * 4. CSS pointer-events on mobile (line 500-504 in kanban-view.css)
 *
 * Key Code Locations:
 * - KanbanView.setupCardDragHandlers(): src/bases/KanbanView.ts:1434-1552
 * - createTaskClickHandler(): src/utils/clickHandlers.ts:19-198
 * - createTaskCard click setup: src/ui/TaskCard.ts:1674-1686
 * - createNormalColumn: src/bases/KanbanView.ts:955-970
 * - createVirtualColumn: src/bases/KanbanView.ts:874-909
 *
 * Suggested Investigation Points:
 * 1. Check if click handlers are being attached to cards in virtual scrolled columns
 * 2. Verify event propagation order between wrapper and card
 * 3. Check if drag listeners on wrapper interfere with click detection
 * 4. Test with different settings for singleClickAction/doubleClickAction
 */

import { TaskInfo } from '../../../src/types';

/**
 * Helper to create a minimal task for testing
 */
function createMinimalTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: 'tasks/test-task.md',
		path: 'tasks/test-task.md',
		title: 'Test Task',
		status: 'todo',
		...overrides,
	} as TaskInfo;
}

describe('Issue #1063 - Kanban Click Handling Bug', () => {
	describe('Event Handler Architecture Analysis', () => {
		it('documents the expected click handler chain', () => {
			/**
			 * Expected event flow for a click on a task card in Kanban view:
			 *
			 * 1. User clicks on .task-card element (inner card)
			 * 2. card.addEventListener('click', clickHandler) fires first (bubble phase)
			 *    - From TaskCard.ts:1684
			 *    - Calls createTaskClickHandler().clickHandler
			 *    - Checks for selection mode (shift key)
			 *    - Stops propagation at line 105 of clickHandlers.ts
			 *    - Sets timeout for single/double click detection
			 * 3. After 250ms (if no second click), handleSingleClick executes
			 *    - Opens task edit modal OR opens note (based on settings)
			 *
			 * For double-click:
			 * 1. First click starts 250ms timeout
			 * 2. Second click within 250ms clears timeout
			 * 3. handleDoubleClick executes immediately
			 *    - Opens note OR opens modal (based on settings)
			 */
			expect(true).toBe(true); // Documentation test
		});

		it('documents wrapper click handler behavior', () => {
			/**
			 * The cardWrapper click handler in KanbanView.setupCardDragHandlers():
			 *
			 * cardWrapper.addEventListener("click", (e: MouseEvent) => {
			 *   if (this.handleSelectionClick(e, task.path)) {
			 *     e.stopPropagation();
			 *     return;
			 *   }
			 * });
			 *
			 * handleSelectionClick returns false when:
			 * - Selection mode is NOT active AND
			 * - No modifier keys (shift/ctrl/meta) are pressed
			 *
			 * So for a normal click without modifiers, the wrapper's handler
			 * should do nothing (handleSelectionClick returns false).
			 *
			 * Bug hypothesis: The wrapper's handler may be interfering with the
			 * card's handler in some way, or the card's handler is not being
			 * attached properly in certain scenarios (e.g., virtual scrolling).
			 */
			expect(true).toBe(true); // Documentation test
		});
	});

	describe('EXPECTED BEHAVIOR - Click Actions', () => {
		it.skip('reproduces issue #1063 - single click on kanban card should open task modal', async () => {
			/**
			 * Expected behavior:
			 * When user single-clicks on a task card in Kanban view,
			 * and settings.singleClickAction === "edit" (default),
			 * the task edit modal should open.
			 *
			 * Test scenario:
			 * 1. Render Kanban view with at least one task
			 * 2. Single-click on the task card
			 * 3. Wait 250ms+ for single-click detection
			 * 4. Verify task edit modal opens
			 *
			 * Currently: Nothing happens
			 * Expected: Modal opens
			 */
			const task = createMinimalTask({ title: 'Click Test Task' });

			// This would require E2E/integration testing setup
			// Documenting expected behavior for now
			expect(task.title).toBe('Click Test Task');
		});

		it.skip('reproduces issue #1063 - double click on kanban card should open note', async () => {
			/**
			 * Expected behavior:
			 * When user double-clicks on a task card in Kanban view,
			 * and settings.doubleClickAction === "openNote" (default),
			 * the note file should open.
			 *
			 * Test scenario:
			 * 1. Render Kanban view with at least one task
			 * 2. Double-click on the task card (two clicks within 250ms)
			 * 3. Verify note opens in editor
			 *
			 * Currently: Nothing happens
			 * Expected: Note opens
			 */
			const task = createMinimalTask({ title: 'Double Click Test Task' });

			// This would require E2E/integration testing setup
			// Documenting expected behavior for now
			expect(task.title).toBe('Double Click Test Task');
		});

		it.skip('reproduces issue #1063 - ctrl/cmd + click should open note in new tab', async () => {
			/**
			 * Expected behavior:
			 * When user ctrl+clicks (Windows/Linux) or cmd+clicks (Mac) on a task card,
			 * the note should open in a new tab.
			 *
			 * This is handled by the click handler before the single/double click detection.
			 * See clickHandlers.ts:46-49
			 *
			 * Currently: Nothing happens
			 * Expected: Note opens in new tab
			 */
			const task = createMinimalTask({ title: 'Ctrl Click Test Task' });
			expect(task.title).toBe('Ctrl Click Test Task');
		});
	});

	describe('Virtual Scrolling Hypothesis', () => {
		it.skip('reproduces issue #1063 - cards in virtualized columns should have working click handlers', () => {
			/**
			 * Hypothesis: When KanbanView uses virtual scrolling for columns with many cards
			 * (>= 15 cards, see VIRTUAL_SCROLL_THRESHOLD), the click handlers may not be
			 * properly attached when cards are recycled.
			 *
			 * Virtual scrolling is implemented in createVirtualColumn() at line 874-909.
			 * The renderItem callback creates cards and calls setupCardDragHandlers().
			 *
			 * When a card is scrolled out of view and recycled, the event listeners
			 * attached by createTaskCard() should persist, but there may be an issue
			 * with the VirtualScroller not properly re-attaching handlers.
			 *
			 * Test scenario:
			 * 1. Create Kanban view with 20+ tasks in one column (triggers virtual scrolling)
			 * 2. Scroll to see different cards
			 * 3. Click on a card that was recycled
			 * 4. Verify click handler works
			 */
			const VIRTUAL_SCROLL_THRESHOLD = 15;
			expect(VIRTUAL_SCROLL_THRESHOLD).toBe(15);
		});
	});

	describe('Drag Interaction Hypothesis', () => {
		it.skip('reproduces issue #1063 - click should work even with draggable attribute', () => {
			/**
			 * Hypothesis: The draggable="true" attribute on cardWrapper may interfere
			 * with click events in some browsers or situations.
			 *
			 * The cardWrapper is set as draggable at line 958 in createNormalColumn():
			 *   cardWrapper.setAttribute("draggable", "true");
			 *
			 * The dragstart event listener (line 1466-1524) may be capturing or
			 * interfering with click events in some way.
			 *
			 * Test scenario:
			 * 1. Render Kanban view with a task
			 * 2. Click on task (not drag)
			 * 3. Verify click handler fires (not dragstart)
			 */
			expect(true).toBe(true);
		});
	});

	describe('Mobile Touch Handling', () => {
		it.skip('reproduces issue #1063 - touch interactions should work on mobile', () => {
			/**
			 * On mobile devices (Platform.isMobile), setupCardTouchHandlers() is called
			 * at line 1552 to handle touch-based interactions.
			 *
			 * The touch handling includes:
			 * - Long press to initiate drag (LONG_PRESS_DELAY = 350ms)
			 * - Touch move threshold (TOUCH_MOVE_THRESHOLD = 10px)
			 *
			 * However, normal taps should still work as clicks.
			 *
			 * Bug may be specific to mobile or may affect both desktop and mobile.
			 */
			const LONG_PRESS_DELAY = 350;
			expect(LONG_PRESS_DELAY).toBe(350);
		});
	});

	describe('Settings Configuration', () => {
		it('documents relevant settings that affect click behavior', () => {
			/**
			 * Click behavior is controlled by these plugin settings:
			 *
			 * - singleClickAction: "edit" | "openNote"
			 *   Default: "edit" - opens task edit modal
			 *
			 * - doubleClickAction: "edit" | "openNote" | "none"
			 *   Default: "openNote" - opens the note file
			 *   If "none": Single click triggers immediately (no 250ms delay)
			 *
			 * These settings are checked in clickHandlers.ts:
			 * - Line 51-56: singleClickAction handling
			 * - Line 65-70: doubleClickAction handling
			 * - Line 107-110: doubleClickAction === "none" bypass
			 *
			 * Bug may occur regardless of settings, or may be setting-specific.
			 */
			const defaultSettings = {
				singleClickAction: 'edit',
				doubleClickAction: 'openNote',
			};
			expect(defaultSettings.singleClickAction).toBe('edit');
			expect(defaultSettings.doubleClickAction).toBe('openNote');
		});
	});
});

describe('Issue #1063 - Potential Root Causes', () => {
	describe('Event Propagation Analysis', () => {
		it.skip('reproduces issue #1063 - verifies event propagation from card to wrapper', () => {
			/**
			 * The event flow should be:
			 * 1. Click on .task-card (inner element)
			 * 2. Event bubbles to .kanban-view__card-wrapper (parent)
			 *
			 * Both elements have click listeners:
			 * - task-card: via createTaskClickHandler() in TaskCard.ts:1684
			 * - cardWrapper: via setupCardDragHandlers() in KanbanView.ts:1436
			 *
			 * The card's click handler calls e.stopPropagation() at line 105
			 * of clickHandlers.ts, which should prevent the wrapper's handler
			 * from running.
			 *
			 * If the card's handler is NOT attached (for some reason), then:
			 * - The wrapper's handler runs
			 * - handleSelectionClick returns false (no selection mode, no modifiers)
			 * - Nothing else happens - the click is essentially swallowed
			 *
			 * This could explain the bug: if card handlers aren't attached,
			 * clicks do nothing.
			 */
			expect(true).toBe(true);
		});
	});

	describe('Handler Attachment Verification', () => {
		it.skip('reproduces issue #1063 - verifies click handlers are attached to task cards', () => {
			/**
			 * In createTaskCard() (TaskCard.ts:1674-1686):
			 *
			 * const { clickHandler, dblclickHandler, contextmenuHandler } = createTaskClickHandler({
			 *   task,
			 *   plugin,
			 *   contextMenuHandler: async (e) => {
			 *     const path = card.dataset.taskPath;
			 *     if (!path) return;
			 *     await showTaskContextMenu(e, path, plugin, targetDate);
			 *   },
			 * });
			 *
			 * card.addEventListener("click", clickHandler);
			 * card.addEventListener("dblclick", dblclickHandler);
			 * card.addEventListener("contextmenu", contextmenuHandler);
			 *
			 * These handlers should always be attached when createTaskCard is called.
			 * Unless there's an error during card creation that prevents this code
			 * from running.
			 *
			 * Test: Verify handlers are attached after createTaskCard() returns
			 */
			expect(true).toBe(true);
		});
	});

	describe('Beta Version Regression', () => {
		it('documents when the bug was introduced', () => {
			/**
			 * The bug is reported in version 4.0.0-beta.1.
			 *
			 * Between beta.0 and beta.1, these relevant commits were made:
			 * - b0015519: "Implement lazy TaskCard rendering with event delegation for Bases views"
			 *   This introduced an interactionMode option (eager/lazy) and event delegation
			 *
			 * However, examining the current codebase, the lazy rendering/event delegation
			 * pattern doesn't seem to be present in KanbanView or TaskCard.
			 * It may have been reverted or only applies to TaskListView.
			 *
			 * Other potentially relevant commits:
			 * - 4045b34c: "Add virtual scrolling to KanbanView columns with 50+ cards"
			 * - 1c65a2e9: "Add lazy rendering and event delegation to KanbanView"
			 *
			 * The virtual scrolling threshold was lowered from 50 to 30 to 15 in
			 * subsequent commits.
			 */
			const versionWithBug = '4.0.0-beta.1';
			expect(versionWithBug).toBe('4.0.0-beta.1');
		});
	});
});

/**
 * E2E Test Considerations
 *
 * A proper fix verification would require E2E tests (Playwright) that:
 *
 * 1. Set up a test vault with TaskNotes plugin
 * 2. Create tasks that appear in Kanban view
 * 3. Render the Kanban view
 * 4. Simulate user clicks on task cards
 * 5. Verify modals open / notes open as expected
 *
 * Example Playwright test structure:
 *
 * test.fixme('reproduces issue #1063 - kanban click opens modal', async ({ page }) => {
 *   // Navigate to Kanban view
 *   await page.goto('/kanban-view');
 *
 *   // Find a task card
 *   const taskCard = page.locator('.task-card').first();
 *
 *   // Single click
 *   await taskCard.click();
 *
 *   // Wait for modal (with 250ms+ delay for single-click detection)
 *   await page.waitForTimeout(300);
 *
 *   // Verify modal is visible
 *   await expect(page.locator('.task-edit-modal')).toBeVisible();
 * });
 */
