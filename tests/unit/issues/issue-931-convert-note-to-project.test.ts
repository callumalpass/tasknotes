/**
 * Issue #931: [FR] "Convert note to project" command
 *
 * Feature Description:
 * A more specific version of the "convert all tasks in note" command that allows users
 * to lay out a complex project in one note with dependencies and detailed notes for each
 * subtask, then convert it all at once into a set of interrelated Task Notes.
 *
 * Conversion Rules:
 * - A checkbox bullet becomes a Task Note with the current note as its Project
 * - A checkbox subbullet of a checkbox becomes a Task Note with parent bullet as its Project
 * - A subbullet WITHOUT a checkbox becomes text in the body of the parent Task Note
 * - A checkbox bullet with an ordinal number becomes part of a dependency sequence
 * - Tasks with the same ordinal number (and same/no parent) are parallel in the sequence
 * - Converted tasks inherit tags, contexts, priority, due date, status from current note
 * - Inline NLP can override: tags, contexts, projects, priority, status, due/scheduled dates
 *
 * Example structure:
 * - [ ] TASK_A #tag : Creates task with current note as project
 *   - This becomes body text for TASK_A
 *   - [ ] TASK_B low in-progress due tomorrow : Creates task with TASK_A as project
 * 1. [ ] TASK_1 : Creates task in dependency sequence
 * 2. [ ] TASK_2 : Creates task with TASK_1 as blocking task
 *   - [ ] TASK_C : Creates task with TASK_2 as project
 *   1. [ ] TASK_2.1 : Creates task with TASK_2 as project, in sub-sequence
 *   2. [ ] TASK_2.2 : Creates task with TASK_2.1 as blocking task
 * 3. [ ] TASK_3A : Creates task with TASK_2 as blocking task
 * 3. [ ] TASK_3B : Creates task with TASK_2 as blocking task (same ordinal = parallel)
 * 4. [ ] TASK_4 : Creates task with both TASK_3A and TASK_3B as blocking tasks
 *
 * @see https://github.com/calluma/tasknotes/issues/931
 */

import { TaskInfo, TaskDependency } from '../../../src/types';

describe('Issue #931: Convert note to project command', () => {
	/**
	 * Helper type for parsed checkbox items from a note
	 */
	interface ParsedCheckboxItem {
		text: string;
		isCheckbox: boolean;
		isCompleted: boolean;
		ordinalNumber: number | null;
		indentLevel: number;
		children: ParsedCheckboxItem[];
		parsedMetadata?: {
			title?: string;
			tags?: string[];
			contexts?: string[];
			projects?: string[];
			priority?: string;
			status?: string;
			dueDate?: string;
			scheduledDate?: string;
		};
	}

	/**
	 * Helper type for the conversion result
	 */
	interface ConversionResult {
		tasks: Array<{
			taskInfo: Partial<TaskInfo>;
			project: string | null; // Path to parent task/note
			blockedBy: string[]; // Paths to blocking tasks
		}>;
		errors: string[];
	}

	describe('Parsing checkbox hierarchy from note content', () => {
		it.skip('reproduces issue #931: should parse basic checkbox items', () => {
			const noteContent = `
- [ ] Task A
- [ ] Task B
- [x] Task C (completed)
`;
			// Expected: 3 checkbox items, one completed
			// Implementation would use a parser similar to InstantTaskConvertService
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should parse nested checkbox hierarchy', () => {
			const noteContent = `
- [ ] Parent Task
  - [ ] Child Task 1
  - [ ] Child Task 2
    - [ ] Grandchild Task
`;
			// Expected: Hierarchical structure with proper parent-child relationships
			// Child tasks should have Parent Task as their project reference
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should distinguish checkbox vs non-checkbox bullets', () => {
			const noteContent = `
- [ ] Task with details
  - This is a note (no checkbox)
  - Another note line
  - [ ] This is a subtask (has checkbox)
`;
			// Expected: Non-checkbox bullets become body text of parent task
			// The subtask remains a separate task with parent as project
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should parse ordinal numbered checkboxes', () => {
			const noteContent = `
1. [ ] First task in sequence
2. [ ] Second task in sequence
3. [ ] Third task in sequence
`;
			// Expected: Tasks with ordinal numbers form a dependency chain
			// Task 2 blocked by Task 1, Task 3 blocked by Task 2
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle parallel ordinals (same number)', () => {
			const noteContent = `
1. [ ] Task 1
2. [ ] Task 2A
2. [ ] Task 2B
3. [ ] Task 3
`;
			// Expected: Task 2A and 2B both depend on Task 1
			// Task 3 depends on BOTH Task 2A and Task 2B
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should parse nested ordinal sequences', () => {
			const noteContent = `
1. [ ] Parent sequence task
  1. [ ] Child sequence task 1
  2. [ ] Child sequence task 2
2. [ ] Second parent task
`;
			// Expected: Child sequence is independent from parent sequence
			// Child task 2 depends on Child task 1 (not Parent task 1)
			expect(true).toBe(true);
		});
	});

	describe('NLP metadata extraction from checkbox text', () => {
		it.skip('reproduces issue #931: should extract tags from checkbox text', () => {
			const checkboxText = '- [ ] Task A #tagexample1 #tagexample2 : Description';
			// Expected: tags: ['tagexample1', 'tagexample2']
			// Title should be cleaned: "Task A : Description" or "Task A"
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should extract contexts from checkbox text', () => {
			const checkboxText = '- [ ] Task A @home @office : Description';
			// Expected: contexts: ['home', 'office']
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should extract priority from checkbox text', () => {
			const checkboxText = '- [ ] Task A low : Description';
			// Expected: priority: 'low'
			// Also test: high, medium, normal, urgent, etc.
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should extract status from checkbox text', () => {
			const checkboxText = '- [ ] Task A in-progress : Description';
			// Expected: status: 'in-progress'
			// Also test: open, done, backlog, etc.
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should extract due date from checkbox text', () => {
			const checkboxText = '- [ ] Task A due tomorrow : Description';
			// Expected: dueDate to be parsed via NLP (chrono-node)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should extract scheduled date from checkbox text', () => {
			const checkboxText = '- [ ] Task A scheduled next monday : Description';
			// Expected: scheduledDate to be parsed via NLP (chrono-node)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should extract additional projects from checkbox text', () => {
			const checkboxText = '- [ ] Task A +extra-project : Description';
			// Expected: projects includes 'extra-project' in addition to inherited project
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle combined metadata in checkbox text', () => {
			const checkboxText = '- [ ] Task A #urgent @office low in-progress due friday +project-x : Detailed notes';
			// Expected: All metadata extracted correctly
			// tags: ['urgent'], contexts: ['office'], priority: 'low',
			// status: 'in-progress', dueDate: 'friday', projects: includes 'project-x'
			expect(true).toBe(true);
		});
	});

	describe('Inheritance of metadata from parent note', () => {
		const parentNoteMetadata = {
			tags: ['parent-tag'],
			contexts: ['parent-context'],
			priority: 'high',
			status: 'open',
			dueDate: '2025-02-01',
		};

		it.skip('reproduces issue #931: should inherit tags from parent note', () => {
			const checkboxText = '- [ ] Child task';
			// Expected: Created task has tags: ['parent-tag']
			// When child has additional tags, they should merge: ['parent-tag', 'child-tag']
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should inherit contexts from parent note', () => {
			const checkboxText = '- [ ] Child task';
			// Expected: Created task has contexts: ['parent-context']
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should inherit priority from parent note by default', () => {
			const checkboxText = '- [ ] Child task';
			// Expected: Created task has priority: 'high' (from parent)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should override priority when specified inline', () => {
			const checkboxText = '- [ ] Child task low';
			// Expected: Created task has priority: 'low' (overrides parent's 'high')
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should inherit status from parent note by default', () => {
			const checkboxText = '- [ ] Child task';
			// Expected: Created task has status: 'open' (from parent)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should override status when specified inline', () => {
			const checkboxText = '- [ ] Child task in-progress';
			// Expected: Created task has status: 'in-progress' (overrides parent's 'open')
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should inherit due date from parent note by default', () => {
			const checkboxText = '- [ ] Child task';
			// Expected: Created task has dueDate: '2025-02-01' (from parent)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should override due date when specified inline', () => {
			const checkboxText = '- [ ] Child task due tomorrow';
			// Expected: Created task has dueDate parsed from 'tomorrow', not parent date
			expect(true).toBe(true);
		});
	});

	describe('Project relationships', () => {
		it.skip('reproduces issue #931: should set current note as project for top-level tasks', () => {
			const noteContent = `
- [ ] Top level task
`;
			const currentNotePath = 'Projects/My Project.md';
			// Expected: Created task has projects: ['Projects/My Project']
			// or uses wikilink format: projects: ['[[My Project]]']
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should set parent checkbox as project for nested tasks', () => {
			const noteContent = `
- [ ] Parent Task
  - [ ] Child Task
`;
			// Expected: Child Task has Parent Task as its project
			// This requires creating Parent Task first, then referencing it
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle deeply nested project relationships', () => {
			const noteContent = `
- [ ] Level 1
  - [ ] Level 2
    - [ ] Level 3
`;
			// Expected:
			// Level 1 project = current note
			// Level 2 project = Level 1
			// Level 3 project = Level 2
			expect(true).toBe(true);
		});
	});

	describe('Dependency relationships (blocking tasks)', () => {
		it.skip('reproduces issue #931: should create dependencies for sequential ordinals', () => {
			const noteContent = `
1. [ ] Task 1
2. [ ] Task 2
`;
			// Expected: Task 2 has blockedBy: [Task 1 reference]
			// Uses TaskDependency with reltype: 'FINISHTOSTART'
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle parallel ordinals correctly', () => {
			const noteContent = `
1. [ ] Task 1
2. [ ] Task 2A
2. [ ] Task 2B
3. [ ] Task 3
`;
			// Expected:
			// Task 2A blockedBy: [Task 1]
			// Task 2B blockedBy: [Task 1]
			// Task 3 blockedBy: [Task 2A, Task 2B] - both must complete
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle gaps in ordinal sequence', () => {
			const noteContent = `
1. [ ] Task 1
5. [ ] Task 5
10. [ ] Task 10
`;
			// Expected: Linear chain, Task 5 depends on Task 1, Task 10 depends on Task 5
			// Gap numbers don't matter, only relative ordering
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should keep nested ordinal sequences independent', () => {
			const noteContent = `
1. [ ] Parent 1
  1. [ ] Child 1.1
  2. [ ] Child 1.2
2. [ ] Parent 2
`;
			// Expected:
			// Child 1.1 has no blockedBy (first in its sequence)
			// Child 1.2 blockedBy: [Child 1.1]
			// Parent 2 blockedBy: [Parent 1] (not blocked by children)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should mix ordinal and non-ordinal checkboxes', () => {
			const noteContent = `
- [ ] Unordered task A
1. [ ] Ordered task 1
- [ ] Unordered task B
2. [ ] Ordered task 2
`;
			// Expected:
			// Unordered tasks have no dependency relationships
			// Ordered task 2 blockedBy: [Ordered task 1]
			// Unordered tasks are independent
			expect(true).toBe(true);
		});
	});

	describe('Body text extraction from non-checkbox bullets', () => {
		it.skip('reproduces issue #931: should collect non-checkbox bullets as task body', () => {
			const noteContent = `
- [ ] Task with notes
  - This is the first note
  - This is the second note
  - And a third one
`;
			// Expected: Task created with details/body containing:
			// "- This is the first note\n- This is the second note\n- And a third one"
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should preserve bullet formatting in body', () => {
			const noteContent = `
- [ ] Task
  - First level note
    - Second level note
  - Back to first level
`;
			// Expected: Body text preserves indentation structure
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should separate body text from subtask checkboxes', () => {
			const noteContent = `
- [ ] Parent task
  - This is a note (body text)
  - [ ] This is a subtask (separate task)
  - Another note (body text)
`;
			// Expected:
			// Parent task body: "- This is a note (body text)\n- Another note (body text)"
			// Subtask created as separate task with parent as project
			expect(true).toBe(true);
		});
	});

	describe('Full conversion workflow', () => {
		it.skip('reproduces issue #931: should convert complete example from issue', () => {
			const noteContent = `
- [ ] TASKEXAMPLEA #tagexample1 : This becomes a task
  - This becomes a bullet point in the body of the note for TASKEXAMPLEA
  - [ ] TASKEXAMPLEB low in-progress due tomorrow: This becomes a task with TASKEXAMPLEA as its Project

1. [ ] TASKEXAMPLE1: This becomes a task in sequence

2. [ ] TASKEXAMPLE2: This becomes a task with TASKEXAMPLE1 as a blocking task
  - [ ] TASKEXAMPLEC: This becomes a task with TASKEXAMPLE2 as its Project
    - This becomes a bullet point in body of TASKEXAMPLEC
  1. [ ] TASKEXAMPLE2.1: Sub-sequence task
  2. [ ] TASKEXAMPLE2.2: Task with TASKEXAMPLE2.1 as blocking task

3. [ ] TASKEXAMPLE3A: Task with TASKEXAMPLE2 as blocking task
3. [ ] TASKEXAMPLE3B: Task with TASKEXAMPLE2 as blocking task (parallel)

4. [ ] TASKEXAMPLE4: Task with both TASKEXAMPLE3A and TASKEXAMPLE3B as blocking tasks
`;
			// Expected: Full hierarchy of tasks created with:
			// - Correct project relationships
			// - Correct dependency chains
			// - Inherited metadata from parent note
			// - Inline metadata overrides applied
			// - Body text collected from non-checkbox bullets
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should create task files in correct order', () => {
			// Tasks must be created in order so that:
			// 1. Parent tasks exist before children reference them as projects
			// 2. Blocking tasks exist before dependent tasks reference them
			// Expected: BFS or topological sort order for creation
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should replace original note content with links', () => {
			// After conversion, original checkboxes should be replaced with
			// links to the created task notes (similar to instant convert behavior)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle conversion errors gracefully', () => {
			// If some tasks fail to create, should:
			// - Continue converting other tasks
			// - Report which tasks failed
			// - Not leave note in inconsistent state
			expect(true).toBe(true);
		});
	});

	describe('Edge cases and error handling', () => {
		it.skip('reproduces issue #931: should handle empty note', () => {
			const noteContent = '';
			// Expected: No tasks created, no error
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle note with no checkboxes', () => {
			const noteContent = `
# My Note
- Regular bullet
- Another bullet
`;
			// Expected: No tasks created, no error
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle malformed checkboxes', () => {
			const noteContent = `
- [ ]No space after checkbox
- [x]Also no space
-[ ] Space in wrong place
`;
			// Expected: Gracefully handle or skip malformed items
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle very deep nesting', () => {
			const noteContent = `
- [ ] Level 1
  - [ ] Level 2
    - [ ] Level 3
      - [ ] Level 4
        - [ ] Level 5
          - [ ] Level 6
`;
			// Expected: All levels converted correctly with proper project relationships
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle duplicate task titles', () => {
			const noteContent = `
- [ ] Same Title
- [ ] Same Title
- [ ] Same Title
`;
			// Expected: All tasks created with unique filenames
			// (using existing unique filename generation logic)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should handle special characters in task titles', () => {
			const noteContent = `
- [ ] Task with "quotes" and <brackets>
- [ ] Task with: colons and | pipes
- [ ] Task with / slashes \\ backslashes
`;
			// Expected: Filenames sanitized, titles preserved in frontmatter
			expect(true).toBe(true);
		});
	});

	describe('Configuration options (potential settings)', () => {
		it.skip('reproduces issue #931: should respect setting for inheritance behavior', () => {
			// User may want to configure whether metadata is inherited
			// Example settings:
			// - inheritTagsFromProject: boolean
			// - inheritPriorityFromProject: boolean
			// - inheritDueDateFromProject: boolean
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should respect setting for dependency creation', () => {
			// User may want to configure how ordinal numbers are interpreted
			// Example settings:
			// - createDependenciesFromOrdinals: boolean
			// - dependencyRelationType: 'FINISHTOSTART' | 'STARTTOSTART' | etc.
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #931: should respect setting for body text handling', () => {
			// User may want to configure how non-checkbox bullets are handled
			// Example settings:
			// - nonCheckboxBulletsAsBody: boolean
			// - preserveBulletFormatting: boolean
			expect(true).toBe(true);
		});
	});
});
