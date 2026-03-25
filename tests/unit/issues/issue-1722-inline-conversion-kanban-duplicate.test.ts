/**
 * Issue #1722: Inline task conversion creates duplicates in Kanban view until refresh
 *
 * Bug Description:
 * When an inline task on a note is converted into a tasknote, a duplicate of the task
 * is shown in the Kanban view until the view is closed and reopened. Both the old inline
 * task entry and the new tasknote file appear as separate cards.
 *
 * Root cause:
 * When converting an inline task to a tasknote file, the Bases data layer receives the new
 * file event and adds it to the data set. However, the stale inline task entry (keyed by
 * source file path + line) may persist in the KanbanView's currentTaskElements map and
 * taskInfoCache until a full data refresh from Bases removes the old inline item.
 * The KanbanView.handleTaskUpdate() calls debouncedRefresh(), but if Bases hasn't removed
 * the old inline item from its query results, both entries appear.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1722
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1722: Inline task conversion Kanban duplicate', () => {
	it.skip('reproduces issue #1722: both inline and converted tasknote appear in task list', () => {
		// Simulate the scenario: a task exists as an inline checkbox in a note
		const inlineTask = {
			path: 'notes/daily-note.md',
			line: 5,
			title: 'Buy groceries',
			status: 'todo',
			isInlineTask: true,
		};

		// After conversion, the task now exists as a separate file
		const convertedTask = {
			path: 'tasks/Buy groceries.md',
			title: 'Buy groceries',
			status: 'todo',
			isInlineTask: false,
		};

		// Simulate Bases data containing both entries during the transition window
		const basesData = [inlineTask, convertedTask];

		// BUG: No deduplication - both appear as separate tasks
		const taskCards = basesData.map(t => ({ path: t.path, title: t.title }));
		expect(taskCards).toHaveLength(2); // This is the bug - should be 1

		// Expected: deduplication logic should detect that the inline task was converted
		// and only show the new tasknote file
		const uniqueTasks = basesData.filter(t => !t.isInlineTask ||
			!basesData.some(other => !other.isInlineTask && other.title === t.title));
		expect(uniqueTasks).toHaveLength(1);
		expect(uniqueTasks[0].path).toBe('tasks/Buy groceries.md');
	});
});
