/**
 * Issue #605: [Bug]: Incorrect priority check on task list dropdown
 *
 * @see https://github.com/callumalpass/tasknotes/issues/605
 *
 * Bug:
 * On Kanban view, when clicking the priority icon of a task to change priority,
 * the wrong priority is checked as currently selected in the dropdown menu.
 * This is purely cosmetic and doesn't affect functionality.
 *
 * The issue is visible in:
 * - Kanban view
 * - Task list view
 * - Project subtask listings
 *
 * Root cause analysis:
 * Two contributing factors have been identified:
 *
 * 1. Stale closures: The task object is captured in closures when the priority dot's
 *    click handler is created (in createTaskCard and updateTaskCard). If the task's
 *    priority is changed through a different mechanism (e.g., context menu, modal edit,
 *    or file edit), the closure may still hold the old task object with the previous
 *    priority value. The PriorityContextMenu then receives this stale `currentValue`
 *    and checks the wrong item.
 *
 * 2. Type coercion mismatch: When YAML stores priority as a number (e.g., `priority: 1`),
 *    FieldMapper.mapFromFrontmatter assigns it directly without converting to string.
 *    PriorityContextMenu.buildMenu() uses strict equality (`===`) to compare
 *    PriorityConfig.value (always a string) with the task's priority (possibly a number),
 *    so no item gets checked — or if a falsy numeric value triggers the `|| "normal"`
 *    fallback in TaskManager, the wrong priority gets checked.
 *
 * Relevant code paths:
 * - PriorityContextMenu.buildMenu() at src/components/PriorityContextMenu.ts:37
 *   → `if (priority.value === this.options.currentValue)` uses strict equality
 * - createPriorityClickHandler() at src/ui/TaskCard.ts:260-279
 *   → Closes over `task.priority` at card creation time
 * - updateTaskCard() at src/ui/TaskCard.ts:1960-1975, 1992-2010
 *   → Replaces handlers with new closures but uses the `task` object from the caller
 * - TaskListView.showPriorityMenu() at src/bases/TaskListView.ts:1084
 *   → Uses `task.priority` from taskInfoCache
 * - KanbanView.showPriorityMenu() at src/bases/KanbanView.ts:2334
 *   → Uses `task.priority` from taskInfoCache
 * - FieldMapper.mapFromFrontmatter() at src/services/FieldMapper.ts:75-76
 *   → Assigns priority directly from frontmatter without type coercion
 */

import { PriorityConfig } from '../../../src/types';
import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';

/**
 * Simulates the PriorityContextMenu.buildMenu() comparison logic.
 * Returns the value that would get a checkmark in the dropdown.
 */
function getCheckedPriorityValue(
	priorities: PriorityConfig[],
	currentValue: any
): string | undefined {
	// Sort by weight descending (same as PriorityContextMenu.buildMenu)
	const sorted = [...priorities].sort((a, b) => b.weight - a.weight);
	const checked = sorted.find((p) => p.value === currentValue);
	return checked?.value;
}

const DEFAULT_PRIORITIES: PriorityConfig[] = [
	{ id: 'none', value: 'none', label: 'None', color: '#cccccc', weight: 0 },
	{ id: 'low', value: 'low', label: 'Low', color: '#00aa00', weight: 1 },
	{ id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 },
	{ id: 'high', value: 'high', label: 'High', color: '#ff0000', weight: 3 },
];

describe('Issue #605: Incorrect priority check on task list dropdown', () => {
	describe('PriorityContextMenu checkmark comparison logic', () => {
		it.skip('reproduces issue #605: should check the correct priority when currentValue matches a config value', () => {
			// With default string priorities, the comparison should work correctly
			// This test verifies the baseline comparison logic

			// Task has "high" priority
			const checked = getCheckedPriorityValue(DEFAULT_PRIORITIES, 'high');
			expect(checked).toBe('high');

			// Task has "low" priority
			const checkedLow = getCheckedPriorityValue(DEFAULT_PRIORITIES, 'low');
			expect(checkedLow).toBe('low');

			// Task has "normal" priority
			const checkedNormal = getCheckedPriorityValue(DEFAULT_PRIORITIES, 'normal');
			expect(checkedNormal).toBe('normal');

			// Task has "none" priority
			const checkedNone = getCheckedPriorityValue(DEFAULT_PRIORITIES, 'none');
			expect(checkedNone).toBe('none');
		});

		it.skip('reproduces issue #605: should handle numeric priority values from YAML frontmatter', () => {
			// When YAML stores priority as a number (e.g., `priority: 1`),
			// FieldMapper passes the number through without conversion.
			// PriorityContextMenu uses strict equality (===) so "1" !== 1.
			const numericPriorities: PriorityConfig[] = [
				{ id: 'p0', value: '0', label: 'None', color: '#cccccc', weight: 0 },
				{ id: 'p1', value: '1', label: 'Low', color: '#00aa00', weight: 1 },
				{ id: 'p2', value: '2', label: 'Normal', color: '#ffaa00', weight: 2 },
				{ id: 'p3', value: '3', label: 'High', color: '#ff0000', weight: 3 },
			];

			// When YAML parses `priority: 3`, it becomes the number 3, not the string "3"
			const yamlParsedValue = 3; // number, not string

			// The dropdown should check "High" (value: "3"), but strict equality fails:
			// "3" === 3 → false
			const checked = getCheckedPriorityValue(numericPriorities, yamlParsedValue);

			// BUG: This will be undefined because no priority.value (string) matches
			// the numeric currentValue. The dropdown shows no checkmark at all.
			// Expected: should check the priority with value "3" (High)
			expect(checked).toBe('3');
		});

		it.skip('reproduces issue #605: stale task data causes wrong priority to be checked', () => {
			// Simulates the scenario where a task's priority is changed but the
			// closure-captured task object still has the old value.

			// Initial task state: priority is "low"
			const originalTask = {
				title: 'Test task',
				priority: 'low',
				path: 'test.md',
			};

			// User changes priority to "high" via some mechanism
			// But the click handler closure still references the old task object
			const staleCurrentValue = originalTask.priority; // Still "low"

			// The dropdown should show "high" as checked (the actual current priority),
			// but instead shows "low" because of the stale closure
			const checked = getCheckedPriorityValue(DEFAULT_PRIORITIES, staleCurrentValue);

			// BUG: This checks "low" instead of the actual current priority "high"
			// The test documents that stale closures lead to incorrect checkmarks
			expect(checked).toBe('low'); // This passes but is wrong — it should be "high"

			// What SHOULD happen: the dropdown should use fresh task data
			const freshCurrentValue = 'high'; // The actual current priority
			const correctlyChecked = getCheckedPriorityValue(DEFAULT_PRIORITIES, freshCurrentValue);
			expect(correctlyChecked).toBe('high');
		});
	});

	describe('FieldMapper priority type coercion', () => {
		let fieldMapper: FieldMapper;

		beforeEach(() => {
			fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
		});

		it.skip('reproduces issue #605: mapFromFrontmatter should coerce numeric priority to string', () => {
			// When Obsidian/YAML provides a numeric priority, mapFromFrontmatter
			// should convert it to a string for consistent comparison with PriorityConfig.value
			const frontmatter = {
				title: 'Test task',
				status: 'open',
				priority: 3, // YAML parsed as number
			};

			const mapped = fieldMapper.mapFromFrontmatter(frontmatter, 'test.md');

			// BUG: mapped.priority will be the number 3, not the string "3"
			// This causes PriorityContextMenu's strict equality check to fail
			expect(typeof mapped.priority).toBe('string');
			expect(mapped.priority).toBe('3');
		});

		it.skip('reproduces issue #605: mapFromFrontmatter should coerce zero priority to string', () => {
			// Edge case: priority of 0 is falsy in JS, which could trigger
			// the `|| "normal"` fallback in TaskManager.extractTaskInfoFromNative
			const frontmatter = {
				title: 'Test task',
				status: 'open',
				priority: 0, // YAML parsed as number, and it's falsy
			};

			const mapped = fieldMapper.mapFromFrontmatter(frontmatter, 'test.md');

			// BUG: Even though 0 is a valid priority value, it might be
			// overwritten by the "normal" default due to falsy check
			expect(typeof mapped.priority).toBe('string');
			expect(mapped.priority).toBe('0');
		});
	});

	describe('Stale cache scenario - TaskListView/KanbanView', () => {
		it.skip('reproduces issue #605: priority dropdown should use fresh task data, not cached closure data', () => {
			// This test documents the stale closure scenario that occurs in both
			// TaskListView and KanbanView when the priority is changed.
			//
			// Flow:
			// 1. Task card is created with task.priority = "low"
			// 2. Click handler closure captures task object with priority "low"
			// 3. User changes priority to "high" via context menu or modal
			// 4. updateTaskProperty updates the file, but the click handler
			//    may still reference the old task object
			// 5. User clicks priority dot again — dropdown shows "low" as checked
			//
			// The fix should ensure that when the priority dropdown opens, it
			// retrieves the current priority value from a fresh source (e.g.,
			// re-reading from the cache or the file) rather than relying on the
			// value captured in the closure at card creation/update time.

			interface MockTask {
				path: string;
				priority: string;
			}

			// Simulate the cache
			const taskInfoCache = new Map<string, MockTask>();
			const task: MockTask = { path: 'test.md', priority: 'low' };
			taskInfoCache.set('test.md', task);

			// Simulate closure capturing the task at creation time
			const capturedTask = task;

			// Now priority changes — cache is updated with a NEW object
			const updatedTask: MockTask = { path: 'test.md', priority: 'high' };
			taskInfoCache.set('test.md', updatedTask);

			// The closure still has the old reference
			const closureValue = capturedTask.priority;

			// BUG: closureValue is "low" but actual priority is "high"
			expect(closureValue).not.toBe(taskInfoCache.get('test.md')!.priority);

			// The dropdown should use the cache value (or fresh data), not the closure value
			const freshValue = taskInfoCache.get('test.md')!.priority;
			const checked = getCheckedPriorityValue(DEFAULT_PRIORITIES, freshValue);
			expect(checked).toBe('high');

			// But what actually happens with the stale closure:
			const staleChecked = getCheckedPriorityValue(DEFAULT_PRIORITIES, closureValue);
			expect(staleChecked).toBe('low'); // Wrong! Should be "high"
		});
	});
});
