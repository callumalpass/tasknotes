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

jest.mock('obsidian');

describe('Issue #1728: Parent note not applied as project in modal creation', () => {
	it.skip('reproduces issue #1728: openTaskCreationModal should apply useParentNoteAsProject', () => {
		// Simulate the settings
		const settings = {
			taskCreationDefaults: {
				useParentNoteAsProject: true,
			},
		};

		// Simulate the current active file (a Project note)
		const currentFile = {
			path: 'Projects/My Project.md',
			basename: 'My Project',
		};

		// Helper that mimics generateMarkdownLink
		function generateMarkdownLink(file: typeof currentFile): string {
			return `[[${file.basename}]]`;
		}

		// --- Path 1: createInlineTask (CORRECT - applies parent note) ---
		function createInlineTaskPrePopulated(): { projects?: string[] } {
			const prePopulatedValues: { projects?: string[] } = {};
			if (settings.taskCreationDefaults.useParentNoteAsProject) {
				if (currentFile) {
					const parentNote = generateMarkdownLink(currentFile);
					prePopulatedValues.projects = [parentNote];
				}
			}
			return prePopulatedValues;
		}

		const inlineResult = createInlineTaskPrePopulated();
		expect(inlineResult.projects).toBeDefined();
		expect(inlineResult.projects).toContain('[[My Project]]');

		// --- Path 2: openTaskCreationModal (BUGGY - does NOT apply parent note) ---
		// This simulates the current behavior of openTaskCreationModal which
		// just passes through whatever prePopulatedValues it receives (usually undefined)
		function openTaskCreationModalPrePopulated(
			prePopulatedValues?: { projects?: string[] }
		): { projects?: string[] } | undefined {
			// BUG: No useParentNoteAsProject check here!
			// The method just passes prePopulatedValues through as-is
			return prePopulatedValues;
		}

		// When called from command palette with no args, parent note is NOT applied
		const modalResult = openTaskCreationModalPrePopulated();
		// This assertion demonstrates the bug: modalResult is undefined,
		// meaning no project is pre-populated
		expect(modalResult).toBeUndefined();

		// --- Expected fix: openTaskCreationModal should also check the setting ---
		function openTaskCreationModalFixed(
			prePopulatedValues?: { projects?: string[] }
		): { projects?: string[] } {
			const values = prePopulatedValues || {};
			if (settings.taskCreationDefaults.useParentNoteAsProject) {
				if (currentFile) {
					const parentNote = generateMarkdownLink(currentFile);
					if (!values.projects) {
						values.projects = [];
					}
					values.projects.push(parentNote);
				}
			}
			return values;
		}

		const fixedResult = openTaskCreationModalFixed();
		expect(fixedResult.projects).toBeDefined();
		expect(fixedResult.projects).toContain('[[My Project]]');
	});
});
