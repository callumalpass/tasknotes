/**
 * Issue #1710: Subtask doesn't automatically inherit project
 *
 * When creating a new subtask from a Kanban board project view, the subtask's
 * project property is not pre-populated with the parent's project. The context
 * menu "Create subtask" action only sets the parent task as the project reference,
 * not the parent task's own project.
 *
 * ROOT CAUSE:
 * In TaskContextMenu.ts (line ~650), openTaskCreationModal is called with
 * `projects: [projectReference]` where projectReference is a link to the parent
 * task file. The parent task's own project property is not read or propagated.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1710
 */

import { describe, it, expect } from '@jest/globals';

interface MockTaskInfo {
	path: string;
	title: string;
	projects?: string[];
}

interface PrePopulatedValues {
	projects?: string[];
}

/**
 * Simulates the current "Create subtask" behavior from TaskContextMenu
 */
function createSubtaskPrePopulation_current(
	parentTask: MockTaskInfo,
	parentFileLink: string
): PrePopulatedValues {
	// Current behavior: only sets parent task as project
	return {
		projects: [parentFileLink],
	};
}

/**
 * Proposed fix: inherit parent's project AND set parent as project
 */
function createSubtaskPrePopulation_fixed(
	parentTask: MockTaskInfo,
	parentFileLink: string
): PrePopulatedValues {
	const projects: string[] = [];

	// Inherit parent's project(s)
	if (parentTask.projects && parentTask.projects.length > 0) {
		projects.push(...parentTask.projects);
	}

	// Also set parent task as project (for subtask relationship)
	if (!projects.includes(parentFileLink)) {
		projects.push(parentFileLink);
	}

	return { projects };
}

describe('Issue #1710: Subtask project inheritance', () => {
	const parentTask: MockTaskInfo = {
		path: 'Tasks/Build login page.md',
		title: 'Build login page',
		projects: ['[[Projects/YGPT Dashboard]]'],
	};
	const parentFileLink = '[[Tasks/Build login page]]';

	it.skip('reproduces issue #1710 - subtask does not inherit parent project', () => {
		const prePopulated = createSubtaskPrePopulation_current(parentTask, parentFileLink);

		// Current: only has parent task link, NOT the parent's project
		expect(prePopulated.projects).toEqual([parentFileLink]);
		// BUG: parent's project "YGPT Dashboard" is missing
		expect(prePopulated.projects).not.toContain('[[Projects/YGPT Dashboard]]');
	});

	it.skip('verifies fix for issue #1710 - subtask inherits parent project', () => {
		const prePopulated = createSubtaskPrePopulation_fixed(parentTask, parentFileLink);

		// Fixed: should have both the parent's project AND the parent task link
		expect(prePopulated.projects).toContain('[[Projects/YGPT Dashboard]]');
		expect(prePopulated.projects).toContain(parentFileLink);
	});

	it.skip('verifies fix handles parent with no project', () => {
		const orphanTask: MockTaskInfo = {
			path: 'Tasks/Orphan task.md',
			title: 'Orphan task',
			projects: [],
		};
		const orphanLink = '[[Tasks/Orphan task]]';

		const prePopulated = createSubtaskPrePopulation_fixed(orphanTask, orphanLink);

		// Should still set parent task as project even if parent has no project
		expect(prePopulated.projects).toEqual([orphanLink]);
	});
});
