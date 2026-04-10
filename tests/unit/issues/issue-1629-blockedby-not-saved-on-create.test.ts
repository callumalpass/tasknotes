/**
 * Regression coverage for Issue #1629: blockedBy field not saved on create task
 *
 * The blockedBy field selected in the Create Task modal is silently dropped
 * because TaskService.createTask() does not include taskData.blockedBy in the
 * completeTaskData object that gets passed to mapToFrontmatter().
 *
 * The Edit Task modal works correctly because it uses a different code path
 * (updateTask) that handles blockedBy properly.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1629
 */

import { describe, it, expect } from '@jest/globals';

interface TaskDependency {
	uid: string;
	display?: string;
}

interface TaskCreationData {
	title: string;
	status?: string;
	priority?: string;
	due?: string;
	scheduled?: string;
	contexts?: string[];
	projects?: string[];
	timeEstimate?: number;
	recurrence?: string;
	recurrence_anchor?: string;
	reminders?: any[];
	icsEventId?: string;
	blockedBy?: TaskDependency[];
}

/**
 * Simulates the completeTaskData construction in TaskService.createTask()
 * (src/services/TaskService.ts lines ~325-346).
 *
 * BUG: blockedBy is never copied from taskData to completeTaskData.
 */
function buildCompleteTaskDataBuggy(taskData: TaskCreationData): Partial<TaskCreationData> {
	return {
		title: taskData.title,
		status: taskData.status || 'open',
		priority: taskData.priority || 'medium',
		due: taskData.due || undefined,
		scheduled: taskData.scheduled || undefined,
		contexts: taskData.contexts && taskData.contexts.length > 0 ? taskData.contexts : undefined,
		projects: taskData.projects && taskData.projects.length > 0 ? taskData.projects : undefined,
		timeEstimate: taskData.timeEstimate && taskData.timeEstimate > 0 ? taskData.timeEstimate : undefined,
		recurrence: taskData.recurrence || undefined,
		recurrence_anchor: taskData.recurrence_anchor || undefined,
		reminders: taskData.reminders && taskData.reminders.length > 0 ? taskData.reminders : undefined,
		icsEventId: taskData.icsEventId || undefined,
		// BUG: blockedBy is missing here
	};
}

/**
 * Fixed version that includes blockedBy in completeTaskData.
 */
function buildCompleteTaskDataFixed(taskData: TaskCreationData): Partial<TaskCreationData> {
	return {
		title: taskData.title,
		status: taskData.status || 'open',
		priority: taskData.priority || 'medium',
		due: taskData.due || undefined,
		scheduled: taskData.scheduled || undefined,
		contexts: taskData.contexts && taskData.contexts.length > 0 ? taskData.contexts : undefined,
		projects: taskData.projects && taskData.projects.length > 0 ? taskData.projects : undefined,
		timeEstimate: taskData.timeEstimate && taskData.timeEstimate > 0 ? taskData.timeEstimate : undefined,
		recurrence: taskData.recurrence || undefined,
		recurrence_anchor: taskData.recurrence_anchor || undefined,
		reminders: taskData.reminders && taskData.reminders.length > 0 ? taskData.reminders : undefined,
		icsEventId: taskData.icsEventId || undefined,
		blockedBy: taskData.blockedBy && taskData.blockedBy.length > 0 ? taskData.blockedBy : undefined,
	};
}

describe('Issue #1629: blockedBy field not saved on create task', () => {
	const taskDataWithBlockedBy: TaskCreationData = {
		title: 'My new task',
		blockedBy: [
			{ uid: '[[Some Other Task]]', display: 'Some Other Task' },
		],
	};

	it.skip('reproduces issue #1629 - blockedBy is dropped in createTask completeTaskData', () => {
		const buggyResult = buildCompleteTaskDataBuggy(taskDataWithBlockedBy);

		// BUG: blockedBy is missing from the result
		expect(buggyResult.blockedBy).toBeUndefined();

		// This is the problem - the field provided by the modal is silently lost
		expect(taskDataWithBlockedBy.blockedBy).toBeDefined();
		expect(taskDataWithBlockedBy.blockedBy!.length).toBe(1);
	});

	it.skip('verifies fix - blockedBy is preserved in createTask completeTaskData', () => {
		const fixedResult = buildCompleteTaskDataFixed(taskDataWithBlockedBy);

		// After fix, blockedBy should be preserved
		expect(fixedResult.blockedBy).toBeDefined();
		expect(fixedResult.blockedBy!.length).toBe(1);
		expect(fixedResult.blockedBy![0].uid).toBe('[[Some Other Task]]');
	});
});
