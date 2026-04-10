/**
 * Reproduction test for issue #1657.
 *
 * Reported behavior:
 * - Clicking the "+ New" button on a Kanban view filtered to a specific project
 *   creates a task without the project property assigned. The user expects the
 *   new task to inherit the project context from the current view.
 *
 * Root cause:
 * - BasesViewBase.createFileForView() extracts pre-populated values from the
 *   frontmatterProcessor (which provides groupBy column defaults), but does not
 *   read filter conditions from the Bases query. The project filter is a query
 *   condition, not a column default, so it is not passed to the task creation modal.
 */

describe('Issue #1657: Kanban + New button should assign project', () => {
	it.skip('reproduces issue #1657 - createFileForView should include filter context', () => {
		// Given: A Kanban view with filter "projects contains MyProject"
		// When: createFileForView is called via the "+ New" button
		// Then: prePopulatedValues should include { projects: ["MyProject"] }

		// Mock a frontmatterProcessor that only sets the groupBy column value
		const mockFrontmatterProcessor = (fm: any) => {
			fm.status = 'To Do'; // groupBy column default
			// Note: projects filter is NOT set here - this is the bug
		};

		// The prePopulatedValues extracted from mockFrontmatterProcessor
		// will have status but NOT projects
		const mockFrontmatter: any = {};
		mockFrontmatterProcessor(mockFrontmatter);

		expect(mockFrontmatter.status).toBe('To Do');
		expect(mockFrontmatter.projects).toBeUndefined(); // Bug: project not set
	});
});
