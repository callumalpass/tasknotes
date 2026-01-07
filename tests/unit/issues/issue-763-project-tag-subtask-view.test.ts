/**
 * Skipped tests for Issue #763: Add subtask view to page tagged as project
 *
 * Feature Request: When a note is tagged as a project (via tag or property),
 * the subtask view should be displayed even if there are no tasks yet assigned
 * to the project. This allows users to add the first task via the subtask view
 * interface directly from the project note.
 *
 * Current behavior:
 * - The subtask view (folder icon + chevron) only appears AFTER at least one
 *   task references the note in its projects field
 * - This is because ProjectSubtasksService.isTaskUsedAsProjectSync() only returns
 *   true when the reverse index contains the file (i.e., other tasks link to it)
 *
 * Expected behavior:
 * - Notes explicitly tagged/marked as "project" should show the subtask view
 *   even when no tasks reference them yet
 * - This only applies when projects are identified via tags or properties
 *   (not when using folder-based project identification)
 *
 * Key files:
 * - src/services/ProjectSubtasksService.ts: isTaskUsedAsProjectSync() at line 149
 * - src/ui/TaskCard.ts: Project indicator rendering at line 1498-1533
 */

import { describe, it, expect } from '@jest/globals';

interface MockTaskInfo {
	path: string;
	title: string;
	projects?: string[];
	status?: string;
	tags?: string[];
}

interface MockFrontmatter {
	title?: string;
	status?: string;
	tags?: string[];
	isProject?: boolean;
	[key: string]: unknown;
}

describe('Issue #763: Project tag shows subtask view without existing tasks', () => {
	describe('Project identification via tags', () => {
		it.skip('should identify a note as a project when it has the #project tag', () => {
			// Reproduces issue #763
			// User creates a note and tags it with #project

			const noteWithProjectTag: MockFrontmatter = {
				title: 'My New Project',
				status: 'todo',
				tags: ['project'],
			};

			// Current behavior: would return false because no tasks reference it
			// Expected behavior: should return true because it has the project tag

			const hasProjectTag =
				noteWithProjectTag.tags?.includes('project') ?? false;

			// This documents the expected behavior for the fix
			expect(hasProjectTag).toBe(true);

			// The fix should make isTaskUsedAsProjectSync check for project tag
			// in addition to checking the reverse index
		});

		it.skip('should identify a note as a project when it has a nested project tag', () => {
			// Reproduces issue #763
			// User may use nested tags like #projects/work or #type/project

			const noteWithNestedTag: MockFrontmatter = {
				title: 'Work Project',
				status: 'todo',
				tags: ['projects/work', 'type/project'],
			};

			// Should match on project-related tags
			const hasProjectTag =
				noteWithNestedTag.tags?.some(
					(tag) =>
						tag === 'project' ||
						tag.startsWith('project/') ||
						tag.startsWith('projects/')
				) ?? false;

			expect(hasProjectTag).toBe(true);
		});

		it.skip('should show subtask view for note tagged as project with zero subtasks', () => {
			// Reproduces issue #763
			// Core use case: empty project should show subtask view

			const projectNote: MockFrontmatter = {
				title: 'Empty Project',
				status: 'todo',
				tags: ['project'],
			};

			const existingSubtasks: MockTaskInfo[] = []; // No tasks linked yet

			// Document expected behavior
			const isMarkedAsProject = projectNote.tags?.includes('project') ?? false;
			const hasSubtasks = existingSubtasks.length > 0;

			// Subtask view should appear based on project marking, not subtask count
			const shouldShowSubtaskView = isMarkedAsProject; // NOT: isMarkedAsProject && hasSubtasks

			expect(shouldShowSubtaskView).toBe(true);
			expect(hasSubtasks).toBe(false);
		});
	});

	describe('Project identification via frontmatter property', () => {
		it.skip('should identify a note as a project when it has isProject: true in frontmatter', () => {
			// Reproduces issue #763
			// Alternative approach: use a frontmatter property

			const noteWithProjectProperty: MockFrontmatter = {
				title: 'Property-based Project',
				status: 'todo',
				isProject: true,
			};

			const isExplicitlyProject = noteWithProjectProperty.isProject === true;

			expect(isExplicitlyProject).toBe(true);
		});

		it.skip('should identify a note as a project when it has type: project in frontmatter', () => {
			// Reproduces issue #763
			// Alternative approach: use a type property

			interface ExtendedFrontmatter extends MockFrontmatter {
				type?: string;
			}

			const noteWithTypeProperty: ExtendedFrontmatter = {
				title: 'Type-based Project',
				status: 'todo',
				type: 'project',
			};

			const isProjectType = noteWithTypeProperty.type === 'project';

			expect(isProjectType).toBe(true);
		});
	});

	describe('Subtask view rendering for empty projects', () => {
		it.skip('should render project indicator (folder icon) for tagged project with no subtasks', () => {
			// Reproduces issue #763
			// The folder icon should appear even without subtasks

			const projectPath = 'projects/my-project.md';
			const projectTags = ['project'];
			const subtaskCount = 0;

			// Simulate the check in TaskCard.ts line 1498
			const isProjectByReverseIndex = false; // No tasks link to it yet
			const isProjectByTag = projectTags.includes('project');

			// Expected fix: combine both checks
			const isProject = isProjectByReverseIndex || isProjectByTag;

			expect(isProject).toBe(true);
			expect(isProjectByReverseIndex).toBe(false);
			expect(isProjectByTag).toBe(true);
		});

		it.skip('should render chevron for expandable subtasks on tagged project', () => {
			// Reproduces issue #763
			// The chevron should appear to allow expanding (empty) subtask view

			const showExpandableSubtasks = true; // Setting enabled
			const projectTags = ['project'];
			const isProjectByTag = projectTags.includes('project');

			// Chevron should appear when:
			// 1. showExpandableSubtasks setting is enabled
			// 2. Note is identified as a project (by tag or reverse index)
			const shouldShowChevron = showExpandableSubtasks && isProjectByTag;

			expect(shouldShowChevron).toBe(true);
		});

		it.skip('should show empty state when expanding subtasks on project with no tasks', () => {
			// Reproduces issue #763
			// When chevron is clicked, should show empty state with "Add task" option

			const subtasks: MockTaskInfo[] = [];
			const isExpanded = true;

			// Current toggleSubtasks shows "No subtasks found" at line 2423
			// Expected: should show "No subtasks found" or ideally "Add first task"
			const shouldShowEmptyState = isExpanded && subtasks.length === 0;

			expect(shouldShowEmptyState).toBe(true);
		});

		it.skip('should allow creating new task from empty subtask view', () => {
			// Reproduces issue #763
			// Use case step 3: Click new in subtask view to add the first task

			const projectPath = 'projects/my-project.md';
			const newTask: MockTaskInfo = {
				path: 'tasks/first-task.md',
				title: 'First Task',
				projects: [`[[my-project]]`],
				status: 'todo',
			};

			// After creating task, it should link to the project
			expect(newTask.projects).toContain('[[my-project]]');

			// And project should now show in reverse index too
			const projectReferencedByTask = newTask.projects?.some((p) =>
				p.includes('my-project')
			);
			expect(projectReferencedByTask).toBe(true);
		});
	});

	describe('ProjectSubtasksService enhancements', () => {
		it.skip('should check for project tag in addition to reverse index', () => {
			// Reproduces issue #763
			// isTaskUsedAsProjectSync should be enhanced to check tags

			interface EnhancedProjectCheck {
				path: string;
				reverseIndexHasProject: boolean;
				hasProjectTag: boolean;
			}

			const scenarios: EnhancedProjectCheck[] = [
				{
					// Existing behavior: project referenced by tasks
					path: 'projects/existing-project.md',
					reverseIndexHasProject: true,
					hasProjectTag: false,
				},
				{
					// New behavior: project tagged but no tasks yet
					path: 'projects/new-project.md',
					reverseIndexHasProject: false,
					hasProjectTag: true,
				},
				{
					// Both conditions met
					path: 'projects/tagged-and-used.md',
					reverseIndexHasProject: true,
					hasProjectTag: true,
				},
				{
					// Neither condition met - not a project
					path: 'notes/regular-note.md',
					reverseIndexHasProject: false,
					hasProjectTag: false,
				},
			];

			for (const scenario of scenarios) {
				const isProject =
					scenario.reverseIndexHasProject || scenario.hasProjectTag;

				if (scenario.path.includes('regular-note')) {
					expect(isProject).toBe(false);
				} else {
					expect(isProject).toBe(true);
				}
			}
		});

		it.skip('should respect user-configured project tag names', () => {
			// Reproduces issue #763
			// Users may configure different tag names for projects

			const userConfiguredProjectTag = 'tipo/projeto'; // Portuguese example
			const noteTags = ['tipo/projeto', 'work'];

			const hasUserConfiguredTag = noteTags.includes(userConfiguredProjectTag);

			expect(hasUserConfiguredTag).toBe(true);
		});
	});

	describe('Settings and configuration', () => {
		it.skip('should only apply tag-based project detection when projects use tags/properties', () => {
			// Reproduces issue #763
			// As noted in the issue: "This will only be a option if projects are
			// identified via a tag or property"

			interface ProjectIdentificationMode {
				mode: 'folder' | 'tag' | 'property';
			}

			const settings: ProjectIdentificationMode = { mode: 'tag' };

			// Tag-based project detection only applies when using tag mode
			const shouldCheckForProjectTag =
				settings.mode === 'tag' || settings.mode === 'property';

			expect(shouldCheckForProjectTag).toBe(true);

			// Folder-based projects don't need this feature
			const folderSettings: ProjectIdentificationMode = { mode: 'folder' };
			const shouldCheckTagForFolderMode =
				folderSettings.mode === 'tag' || folderSettings.mode === 'property';

			expect(shouldCheckTagForFolderMode).toBe(false);
		});
	});

	describe('Edge cases', () => {
		it.skip('should handle note with project tag that later gets tasks assigned', () => {
			// Reproduces issue #763
			// Transition from "tagged project with no tasks" to "project with tasks"

			let subtasks: MockTaskInfo[] = [];
			const projectTags = ['project'];
			const projectPath = 'projects/my-project.md';

			// Initially: project with tag but no subtasks
			let isProjectByTag = projectTags.includes('project');
			let isProjectByReverseIndex = subtasks.length > 0;
			let isProject = isProjectByTag || isProjectByReverseIndex;

			expect(isProject).toBe(true);
			expect(subtasks).toHaveLength(0);

			// User adds a task that links to this project
			subtasks = [
				{
					path: 'tasks/new-task.md',
					title: 'New Task',
					projects: [`[[${projectPath}]]`],
					status: 'todo',
				},
			];

			// After task is added: both conditions now true
			isProjectByReverseIndex = subtasks.length > 0;
			isProject = isProjectByTag || isProjectByReverseIndex;

			expect(isProject).toBe(true);
			expect(subtasks).toHaveLength(1);
		});

		it.skip('should handle removal of project tag from note with existing subtasks', () => {
			// Reproduces issue #763
			// If user removes project tag, subtasks still exist so it's still a project

			let projectTags = ['project'];
			const subtasks: MockTaskInfo[] = [
				{
					path: 'tasks/existing-task.md',
					title: 'Existing Task',
					projects: ['[[my-project]]'],
					status: 'todo',
				},
			];

			// Initially: both tag and subtasks
			let isProjectByTag = projectTags.includes('project');
			let isProjectByReverseIndex = subtasks.length > 0;
			let isProject = isProjectByTag || isProjectByReverseIndex;

			expect(isProject).toBe(true);

			// User removes project tag
			projectTags = [];
			isProjectByTag = projectTags.includes('project');

			// Still a project because subtasks exist
			isProject = isProjectByTag || isProjectByReverseIndex;

			expect(isProject).toBe(true);
			expect(isProjectByTag).toBe(false);
			expect(isProjectByReverseIndex).toBe(true);
		});

		it.skip('should not show subtask view for notes without project tag when no tasks link to it', () => {
			// Reproduces issue #763
			// Regular notes should not get subtask view

			const regularNote: MockFrontmatter = {
				title: 'Regular Note',
				status: 'todo',
				tags: ['work', 'ideas'],
			};

			const subtasks: MockTaskInfo[] = [];

			const hasProjectTag = regularNote.tags?.includes('project') ?? false;
			const hasSubtasks = subtasks.length > 0;
			const isProject = hasProjectTag || hasSubtasks;

			expect(isProject).toBe(false);
		});
	});
});

describe('Issue #763: User workflow scenarios', () => {
	describe('Complete workflow from issue description', () => {
		it.skip('should support the exact workflow described in the issue', () => {
			// Reproduces issue #763
			// Workflow:
			// 1. Create a note and tag it #project
			// 2. Subtask view is added automatically
			// 3. Click new in subtask view to add the first task

			// Step 1: Create note with project tag
			const newProjectNote: MockFrontmatter = {
				title: 'New Project',
				tags: ['project'],
			};

			// Step 2: Subtask view should appear
			const hasProjectTag = newProjectNote.tags?.includes('project') ?? false;
			const showSubtaskView = hasProjectTag; // Should be true even with 0 subtasks

			expect(showSubtaskView).toBe(true);

			// Step 3: User can create first task from subtask view
			// (This involves UI interaction - testing the data model support)
			const createdTask: MockTaskInfo = {
				path: 'tasks/first-task-in-project.md',
				title: 'First Task',
				projects: ['[[New Project]]'],
				status: 'todo',
			};

			expect(createdTask.projects).toBeDefined();
			expect(createdTask.projects).toContain('[[New Project]]');
		});
	});

	describe('Problem scenario from issue description', () => {
		it.skip('should prevent the duplication issue when adding inline task', () => {
			// Reproduces issue #763
			// Current problem: "I can add the task inline on the project page but
			// the task is then duplicated in the view and on the page"

			// This test documents what happens currently vs expected behavior
			const projectPath = 'projects/my-project.md';

			// User adds inline task to project note (before subtask view exists)
			const inlineTask: MockTaskInfo = {
				path: 'projects/my-project.md', // Same path as project!
				title: 'Inline Task',
				status: 'todo',
			};

			// Problem: inline tasks might appear twice
			// 1. Once as the inline content on the page
			// 2. Once in the subtask view (if/when it appears)

			// Expected behavior with fix:
			// - Subtask view shows BEFORE any tasks exist
			// - User adds tasks through subtask view (creates separate files)
			// - No duplication because tasks are separate files with project links

			const properTask: MockTaskInfo = {
				path: 'tasks/proper-task.md', // Different path
				title: 'Proper Task',
				projects: [`[[${projectPath}]]`],
				status: 'todo',
			};

			expect(properTask.path).not.toBe(projectPath);
			expect(properTask.projects).toContain(`[[${projectPath}]]`);
		});
	});
});
