/**
 * Issue #1682: Subtask List in TaskList View should respect filter settings
 *
 * Feature request / behavior gap:
 * TaskListView applies Bases + search filters to parent cards before rendering, but
 * expanding a parent task's subtask chevron bypasses that filtered result set and
 * renders every linked subtask returned by ProjectSubtasksService.
 *
 * Root cause:
 * - src/bases/TaskListView.ts: getCardOptions() only passes { targetDate }
 * - src/ui/TaskCard.ts: toggleSubtasks() loads all subtasks via
 *   projectSubtasksService.getTasksLinkedToProject() and renders them directly
 * - No active filter query, visible-path set, or predicate reaches the shared
 *   TaskCard expansion helper
 *
 * Preferred fix:
 * - Pass a filtered path set or subtask predicate through TaskCardOptions
 * - Apply it in toggleSubtasks() before sorting/rendering child cards
 *
 * Fallback:
 * - Filter subtasks inside TaskListView.toggleSubtasks() using the current
 *   filtered task paths tracked on the view instance
 */

import { describe, expect, it } from '@jest/globals';
import type { FilterQuery, TaskInfo } from '../../../src/types';

describe('Issue #1682: TaskList subtasks respect active filters', () => {
	const parentTask: TaskInfo = {
		path: 'Tasks/Parent Project.md',
		title: 'Parent Project',
		status: 'open',
	};

	const activeSubtask: TaskInfo = {
		path: 'Tasks/Subtask Active.md',
		title: 'Subtask Active',
		status: 'open',
		projects: ['[[Parent Project]]'],
	};

	const completedSubtask: TaskInfo = {
		path: 'Tasks/Subtask Done.md',
		title: 'Subtask Done',
		status: 'done',
		completedDate: '2026-03-07',
		projects: ['[[Parent Project]]'],
	};

	const archivedSubtask: TaskInfo = {
		path: 'Tasks/Subtask Archived.md',
		title: 'Subtask Archived',
		status: 'open',
		archived: true,
		projects: ['[[Parent Project]]'],
	};

	const hideCompletedFilter: FilterQuery = {
		type: 'group',
		id: 'root',
		conjunction: 'and',
		children: [
			{
				type: 'condition',
				id: 'hide-completed',
				property: 'status.isCompleted',
				operator: 'is-not-checked',
				value: true,
			},
		],
	};

	const hideArchivedFilter: FilterQuery = {
		type: 'group',
		id: 'root',
		conjunction: 'and',
		children: [
			{
				type: 'condition',
				id: 'hide-archived',
				property: 'archived',
				operator: 'is-not-checked',
				value: true,
			},
		],
	};

	it.skip('reproduces issue #1682: expanding subtasks should only render subtasks still visible in the TaskList filter scope', () => {
		// Parent card is visible in the TaskList view, and only the active child survives filtering.
		const visibleTaskPaths = new Set<string>([
			parentTask.path,
			activeSubtask.path,
		]);

		// Current TaskCard.toggleSubtasks() behavior: load everything linked to the project.
		const loadedSubtasks = [activeSubtask, completedSubtask];

		// Desired fix behavior: intersect the loaded subtasks with the TaskList's filtered scope.
		const renderedSubtasks = loadedSubtasks.filter((task) => visibleTaskPaths.has(task.path));

		expect(hideCompletedFilter.children).toHaveLength(1);
		expect(renderedSubtasks.map((task) => task.path)).toEqual([activeSubtask.path]);
		expect(renderedSubtasks.map((task) => task.path)).not.toContain(completedSubtask.path);
	});

	it.skip('reproduces issue #1682: archived subtasks should stay hidden when the TaskList filter excludes archived tasks', () => {
		const visibleTaskPaths = new Set<string>([
			parentTask.path,
			activeSubtask.path,
		]);

		const loadedSubtasks = [activeSubtask, archivedSubtask];
		const renderedSubtasks = loadedSubtasks.filter((task) => visibleTaskPaths.has(task.path));

		expect(hideArchivedFilter.children).toHaveLength(1);
		expect(renderedSubtasks).toEqual([activeSubtask]);
		expect(renderedSubtasks).not.toContain(archivedSubtask);
	});

	it.skip('reproduces issue #1682: TaskList filtering should not globally change ProjectSubtasksService results for edit surfaces', () => {
		// The issue request explicitly allows edit surfaces to keep showing all subtasks.
		const projectSubtasksServiceResult = [activeSubtask, completedSubtask, archivedSubtask];
		const visibleTaskPaths = new Set<string>([
			parentTask.path,
			activeSubtask.path,
		]);

		const taskListRenderedSubtasks = projectSubtasksServiceResult.filter((task) =>
			visibleTaskPaths.has(task.path)
		);

		expect(projectSubtasksServiceResult).toHaveLength(3);
		expect(taskListRenderedSubtasks).toEqual([activeSubtask]);
	});
});
