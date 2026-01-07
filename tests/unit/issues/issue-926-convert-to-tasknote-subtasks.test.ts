/**
 * Issue #926: [FR]: Convert To Tasknote: Include Subtasks
 *
 * Feature Description:
 * Currently, the "Convert to Tasknote" feature only converts a single checkbox line
 * into a TaskNote file. If the user has sketched out a task hierarchy using native
 * bullets or checkboxes (subtasks indented under a parent), these child items are
 * not converted along with the parent task.
 *
 * The user wants to be able to:
 * 1. Sketch out a task tree using indented bullets or checkboxes
 * 2. Convert the parent checkbox to a TaskNote
 * 3. Have the child bullets/checkboxes automatically become subtasks of the new TaskNote
 *
 * This would significantly reduce friction in task entry, allowing users to quickly
 * map out their todos without losing trains of thought.
 *
 * Current behavior:
 * - "Convert to Tasknote" only converts the single checkbox line
 * - Child bullets under the checkbox are ignored
 * - Users must manually create subtasks after conversion
 *
 * Desired behavior:
 * - When converting a checkbox with indented children, detect the hierarchy
 * - Convert child checkboxes into linked subtasks (TaskNote files with parent as project)
 * - Convert non-checkbox bullets into the task's body/details text
 * - Maintain the hierarchy structure in the resulting TaskNote relationships
 *
 * This is related to Issue #931 ("Convert note to project") but focuses specifically
 * on the single-task conversion use case rather than batch converting an entire note.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/926
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #926: Convert to Tasknote with subtasks', () => {
	/**
	 * Helper type representing a parsed checkbox with potential children
	 */
	interface CheckboxWithChildren {
		text: string;
		isCheckbox: boolean;
		isCompleted: boolean;
		indentLevel: number;
		children: CheckboxWithChildren[];
	}

	describe('Detecting child items under a checkbox', () => {
		it.skip('reproduces issue #926: should identify immediate child bullets under a checkbox', () => {
			const noteContent = `
- [ ] Parent task
  - Child bullet 1
  - Child bullet 2
`;
			// Expected: Two child bullets detected under parent checkbox
			// Both are non-checkbox bullets, so should become body text
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should identify child checkboxes as subtasks', () => {
			const noteContent = `
- [ ] Parent task
  - [ ] Subtask 1
  - [ ] Subtask 2
`;
			// Expected: Two child checkboxes detected under parent
			// These should become separate TaskNotes linked to parent
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should handle mixed child types (checkboxes and bullets)', () => {
			const noteContent = `
- [ ] Parent task
  - This is a note (body text)
  - [ ] Subtask 1
  - Another note line
  - [ ] Subtask 2
`;
			// Expected: Non-checkbox bullets become body text
			// Checkbox bullets become subtasks
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should detect multi-level hierarchy', () => {
			const noteContent = `
- [ ] Parent task
  - [ ] Child task
    - [ ] Grandchild task
`;
			// Expected: Nested hierarchy preserved
			// Grandchild has Child as project, Child has Parent as project
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should correctly parse indent levels', () => {
			const noteContent = `
- [ ] Task at level 0
  - [ ] Task at level 1
    - [ ] Task at level 2
      - [ ] Task at level 3
`;
			// Expected: Each task correctly identified at its indent level
			// Parent-child relationships based on indentation
			expect(true).toBe(true);
		});
	});

	describe('Converting checkbox with children to TaskNote', () => {
		it.skip('reproduces issue #926: should convert parent checkbox to TaskNote', () => {
			const noteContent = `
- [ ] My project task
  - [ ] Step 1
  - [ ] Step 2
`;
			// Expected: Parent becomes a TaskNote file
			// Current note becomes the project for parent task
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should create subtasks for child checkboxes', () => {
			const noteContent = `
- [ ] Shopping list
  - [ ] Buy groceries
  - [ ] Pick up dry cleaning
  - [ ] Return library books
`;
			// Expected: "Shopping list" becomes parent TaskNote
			// Each child checkbox becomes a separate TaskNote
			// All child TaskNotes have "Shopping list" as their project
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should add non-checkbox bullets to body text', () => {
			const noteContent = `
- [ ] Plan vacation
  - Research destinations
  - Check budget constraints
  - [ ] Book flights
  - [ ] Reserve hotel
`;
			// Expected: "Plan vacation" TaskNote has body text:
			//   "Research destinations\nCheck budget constraints"
			// "Book flights" and "Reserve hotel" become subtasks
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should preserve metadata in child checkboxes', () => {
			const noteContent = `
- [ ] Project X high
  - [ ] Phase 1 due tomorrow
  - [ ] Phase 2 @work #urgent
  - [ ] Phase 3 low
`;
			// Expected: Each subtask preserves its inline NLP metadata
			// Phase 1 has due date of tomorrow
			// Phase 2 has @work context and #urgent tag
			// Phase 3 has low priority
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should handle completed child checkboxes', () => {
			const noteContent = `
- [ ] Project with progress
  - [x] Already done step
  - [ ] Not yet done step
`;
			// Expected: Completed child checkbox becomes completed subtask
			// Uncompleted child remains uncompleted
			expect(true).toBe(true);
		});
	});

	describe('Editor replacement after conversion', () => {
		it.skip('reproduces issue #926: should replace entire hierarchy with single link', () => {
			const noteContent = `
- [ ] Parent task
  - [ ] Subtask 1
  - [ ] Subtask 2
- [ ] Next unrelated task
`;
			// Expected: Parent and both subtask lines replaced with single wikilink
			// "Next unrelated task" line remains unchanged
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should maintain proper formatting after replacement', () => {
			const noteContent = `
Some text before

- [ ] Task with children
  - [ ] Child 1
  - [ ] Child 2

Some text after
`;
			// Expected: Text before and after remains intact
			// Only the task hierarchy is replaced with wikilink
			expect(true).toBe(true);
		});
	});

	describe('Edge cases', () => {
		it.skip('reproduces issue #926: should handle checkbox with no children (unchanged behavior)', () => {
			const noteContent = `
- [ ] Simple task with no children
`;
			// Expected: Converts as normal, no special handling needed
			// This is the current behavior which should remain unchanged
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should handle deeply nested structures', () => {
			const noteContent = `
- [ ] Level 1
  - [ ] Level 2a
    - [ ] Level 3a
    - [ ] Level 3b
  - [ ] Level 2b
    - [ ] Level 3c
`;
			// Expected: Full tree converted with proper parent-child relationships
			// Level 3a and 3b are children of Level 2a
			// Level 3c is child of Level 2b
			// Level 2a and 2b are children of Level 1
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should handle only body text children (no subtasks)', () => {
			const noteContent = `
- [ ] Task with only notes
  - Note line 1
  - Note line 2
  - Note line 3
`;
			// Expected: All child bullets become body text of the TaskNote
			// No subtasks created
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should handle tabs vs spaces for indentation', () => {
			const noteContentSpaces = `
- [ ] Parent (spaces)
  - [ ] Child with spaces
`;
			const noteContentTabs = `
- [ ] Parent (tabs)
\t- [ ] Child with tab
`;
			// Expected: Both indentation styles correctly parsed
			// Child relationships detected regardless of indent character
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should stop at same or lower indent level', () => {
			const noteContent = `
- [ ] Parent task
  - [ ] Child of parent
- [ ] Sibling task (not a child)
  - [ ] Child of sibling
`;
			// Expected: "Child of parent" is child of "Parent task"
			// "Sibling task" is NOT a child (same indent level)
			// "Child of sibling" is child of "Sibling task" only
			expect(true).toBe(true);
		});
	});

	describe('Integration with existing functionality', () => {
		it.skip('reproduces issue #926: should work with batch convert (convert all tasks)', () => {
			const noteContent = `
- [ ] Task 1
  - [ ] Subtask 1a
  - [ ] Subtask 1b
- [ ] Task 2
  - [ ] Subtask 2a
`;
			// Expected: Batch convert creates both parent tasks AND their subtasks
			// All hierarchies preserved
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should inherit defaults from parent note', () => {
			// Note has frontmatter with defaults like tags, contexts, etc.
			const noteFrontmatter = `---
tags: [project-a]
contexts: [work]
---

- [ ] Task with children
  - [ ] Subtask 1
`;
			// Expected: Both parent and subtasks inherit defaults from note frontmatter
			// (if "inherit from parent note" setting is enabled)
			expect(true).toBe(true);
		});

		it.skip('reproduces issue #926: should work with selection-based conversion', () => {
			const noteContent = `
Some text

- [ ] Selected parent
  - [ ] Selected child 1
  - [ ] Selected child 2

More text
`;
			// Expected: If user selects the parent + children, all are converted
			// Selection detection should include child lines
			expect(true).toBe(true);
		});
	});
});
