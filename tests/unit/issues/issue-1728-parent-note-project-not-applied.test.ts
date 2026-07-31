/**
 * Test to reproduce Issue #1728: Tasks created from within a Project note are not
 * automatically assigned to that Project (even with parent toggle enabled)
 *
 * Bug Description:
 * When creating a task from within a Project note, the newly created task is not
 * automatically assigned to that project, even when "Use parent note as project"
 * toggle is enabled in settings.
 *
 * Root Cause:
 * The openTaskCreationModal() method (main.ts line 2324) does not check the
 * useParentNoteAsProject setting. Only the createInlineTask() method (line 2970)
 * applies this logic. The command palette "Create new task" and ribbon icon both
 * call openTaskCreationModal() without parent note injection.
 *
 * Key locations:
 * - src/main.ts:openTaskCreationModal() (line 2324) - MISSING the check
 * - src/main.ts:createInlineTask() (line 2970) - HAS the check (correct)
 * - src/services/InstantTaskConvertService.ts (line 617) - HAS the check (correct)
 * - src/modals/TaskCreationModal.ts:applyPrePopulatedValues() (line 1161) - handles projects
 */

import {
	applyParentNoteProjectDefault,
	shouldApplyParentNoteProjectDefault,
} from "../../../src/utils/taskCreationPrepopulation";

describe('Issue #1728: Parent note not applied as project in modal creation', () => {
	it('applies the active parent note as the default project when none is pre-populated', () => {
		const result = applyParentNoteProjectDefault(undefined, '[[My Project]]');

		expect(result?.projects).toEqual(['[[My Project]]']);
	});

	it('preserves explicit project pre-population from callers', () => {
		const result = applyParentNoteProjectDefault(
			{ projects: ['[[Existing Project]]'], priority: 'high' },
			'[[My Project]]'
		);

		expect(result).toEqual({
			projects: ['[[Existing Project]]'],
			priority: 'high',
		});
	});

	it('returns undefined when there is no parent note and no existing defaults', () => {
		expect(applyParentNoteProjectDefault(undefined, undefined)).toBeUndefined();
	});

	it("uses the normal task creation toggle independently from inline conversion", () => {
		const defaults = {
			useParentNoteForTaskCreation: false,
			useParentNoteAsProject: true,
		};

		expect(shouldApplyParentNoteProjectDefault(defaults, "task-creation")).toBe(false);
		expect(shouldApplyParentNoteProjectDefault(defaults, "inline-creation")).toBe(true);
	});
});
