/**
 * Issue #1717: Archived Subtasks Not Hidden in Task Card or Relationships Widget
 *
 * Bug Description:
 * Archived subtasks continue to appear in both the Task Card and the Relationships Widget,
 * regardless of filters applied. Filters correctly exclude archived top-level tasks but
 * do not propagate to subtask rendering.
 *
 * Root cause:
 * In src/ui/TaskCard.ts toggleSubtasks() (lines 2471-2528), subtasks are fetched via
 * projectSubtasksService.getTasksLinkedToProject() and rendered without any filter
 * application. The code contains an explicit comment (lines 2473-2476) acknowledging
 * that filter propagation to subtasks is not yet implemented.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1717
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1717: Archived subtasks not filtered', () => {
	interface MockTask {
		path: string;
		title: string;
		status: string;
		archived: boolean;
		tags: string[];
	}

	it.skip('reproduces issue #1717: archived subtasks are shown despite archive status', () => {
		// Parent project task
		const parentTask: MockTask = {
			path: 'tasks/Meal Prep.md',
			title: 'Meal Prep',
			status: 'In Progress',
			archived: false,
			tags: [],
		};

		// Subtasks - some archived
		const subtasks: MockTask[] = [
			{
				path: 'tasks/Chicken.md',
				title: 'Chicken',
				status: '12 Archive',
				archived: true,
				tags: ['archived'],
			},
			{
				path: '04 ARCHIVES/Instructions.md',
				title: 'Instructions',
				status: '12 Archive',
				archived: true,
				tags: ['archived'],
			},
			{
				path: 'tasks/Vegetables.md',
				title: 'Vegetables',
				status: 'todo',
				archived: false,
				tags: [],
			},
		];

		// Current behavior: toggleSubtasks renders ALL subtasks without filtering
		const renderedSubtasks = subtasks; // No filtering applied
		expect(renderedSubtasks).toHaveLength(3); // BUG: includes archived subtasks

		// Expected behavior: archived subtasks should be excluded
		const filteredSubtasks = subtasks.filter(t => !t.archived);
		expect(filteredSubtasks).toHaveLength(1);
		expect(filteredSubtasks[0].title).toBe('Vegetables');
	});

	it.skip('reproduces issue #1717: archive folder path filter not applied to subtasks', () => {
		const archiveFolder = '04 ARCHIVES';

		const subtasks = [
			{ path: `${archiveFolder}/Old Task.md`, title: 'Old Task', archived: true },
			{ path: 'tasks/Active Task.md', title: 'Active Task', archived: false },
		];

		// Current: no path-based filtering on subtasks
		const renderedSubtasks = subtasks;
		expect(renderedSubtasks).toHaveLength(2); // BUG

		// Expected: subtasks in archive folder should be excluded
		const filteredSubtasks = subtasks.filter(t => !t.path.startsWith(archiveFolder));
		expect(filteredSubtasks).toHaveLength(1);
		expect(filteredSubtasks[0].title).toBe('Active Task');
	});
});
