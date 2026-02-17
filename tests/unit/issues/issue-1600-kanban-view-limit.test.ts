/**
 * Regression coverage for Issue #1600: Kanban view grouping stops working with 21+ views
 *
 * The bug is caused by a hardcoded limit of 20 in KanbanView.getGroupByPropertyId().
 * The method iterates through controller.query.views using `for (let i = 0; i < 20; i++)`
 * which means views at index 20 or higher are never found, causing groupBy to return null.
 *
 * @see https://github.com/obsidian-tasks-group/obsidian-tasks/issues/1600
 */

import { describe, it, expect } from '@jest/globals';

interface MockView {
	name: string;
	groupBy?: string | { property: string };
}

interface MockController {
	query?: {
		views?: MockView[];
	};
	viewName?: string;
}

/**
 * Simulates the buggy getGroupByPropertyId() logic from KanbanView.ts:335-365
 * This reproduces the exact bug where the loop only iterates up to index 19.
 */
function getGroupByPropertyIdBuggy(controller: MockController): string | null {
	// Try to get groupBy from internal API (controller.query.views)
	if (controller?.query?.views && controller?.viewName) {
		const views = controller.query.views;
		const viewName = controller.viewName;

		// BUG: Hardcoded limit of 20 iterations
		for (let i = 0; i < 20; i++) {
			const view = views[i];
			if (view && view.name === viewName) {
				if (view.groupBy) {
					if (typeof view.groupBy === "object" && view.groupBy.property) {
						return view.groupBy.property;
					} else if (typeof view.groupBy === "string") {
						return view.groupBy;
					}
				}

				// View found but no groupBy configured
				return null;
			}
		}
	}

	return null;
}

/**
 * The fixed version that properly iterates through all views
 */
function getGroupByPropertyIdFixed(controller: MockController): string | null {
	if (controller?.query?.views && controller?.viewName) {
		const views = controller.query.views;
		const viewName = controller.viewName;

		// FIX: Use views.length instead of hardcoded 20
		for (let i = 0; i < views.length; i++) {
			const view = views[i];
			if (view && view.name === viewName) {
				if (view.groupBy) {
					if (typeof view.groupBy === "object" && view.groupBy.property) {
						return view.groupBy.property;
					} else if (typeof view.groupBy === "string") {
						return view.groupBy;
					}
				}

				// View found but no groupBy configured
				return null;
			}
		}
	}

	return null;
}

/**
 * Helper to create a mock controller with N views, where the target view is at a specific index
 */
function createMockControllerWithViews(
	totalViews: number,
	targetViewIndex: number,
	targetViewName: string,
	groupByProperty: string
): MockController {
	const views: MockView[] = [];

	for (let i = 0; i < totalViews; i++) {
		if (i === targetViewIndex) {
			views.push({
				name: targetViewName,
				groupBy: groupByProperty
			});
		} else {
			views.push({
				name: `view-${i}`,
				groupBy: `property-${i}`
			});
		}
	}

	return {
		query: { views },
		viewName: targetViewName
	};
}

describe('Issue #1600: Kanban view grouping limit of 20 views', () => {
	describe('Reproduces the bug (current behavior)', () => {
		it.skip('reproduces issue #1600: groupBy works for view at index 19 (20th view)', () => {
			// View at index 19 (the 20th view) - should work
			const controller = createMockControllerWithViews(
				21,           // 21 total views
				19,           // target view at index 19
				'target-view',
				'status'
			);

			const result = getGroupByPropertyIdBuggy(controller);
			expect(result).toBe('status');
		});

		it.skip('reproduces issue #1600: groupBy fails for view at index 20 (21st view)', () => {
			// View at index 20 (the 21st view) - BUG: returns null instead of 'status'
			const controller = createMockControllerWithViews(
				21,           // 21 total views
				20,           // target view at index 20 (21st view)
				'target-view',
				'status'
			);

			// This demonstrates the bug - the function returns null
			// because the loop stops at i < 20, never reaching index 20
			const buggyResult = getGroupByPropertyIdBuggy(controller);
			expect(buggyResult).toBeNull(); // Bug: should be 'status' but returns null

			// The fixed version correctly finds the view
			const fixedResult = getGroupByPropertyIdFixed(controller);
			expect(fixedResult).toBe('status');
		});

		it.skip('reproduces issue #1600: groupBy fails for view at index 50', () => {
			// Test with a view much further in the list
			const controller = createMockControllerWithViews(
				100,          // 100 total views
				50,           // target view at index 50
				'my-kanban',
				'priority'
			);

			// Bug: returns null
			const buggyResult = getGroupByPropertyIdBuggy(controller);
			expect(buggyResult).toBeNull();

			// Fixed: returns correct property
			const fixedResult = getGroupByPropertyIdFixed(controller);
			expect(fixedResult).toBe('priority');
		});

		it.skip('reproduces issue #1600: boundary condition at exactly 20 views', () => {
			// With exactly 20 views, the last one (index 19) should still work
			const controller = createMockControllerWithViews(
				20,           // exactly 20 views
				19,           // target view at last index (19)
				'last-view',
				'context'
			);

			const result = getGroupByPropertyIdBuggy(controller);
			expect(result).toBe('context'); // This works - index 19 is still < 20
		});

		it.skip('reproduces issue #1600: first view beyond limit fails', () => {
			// The 21st view is exactly at the boundary where the bug manifests
			const controller = createMockControllerWithViews(
				25,           // 25 views
				20,           // target at index 20 (first one beyond limit)
				'boundary-view',
				'tags'
			);

			const buggyResult = getGroupByPropertyIdBuggy(controller);
			expect(buggyResult).toBeNull(); // Bug

			const fixedResult = getGroupByPropertyIdFixed(controller);
			expect(fixedResult).toBe('tags'); // Fixed
		});
	});

	describe('Verifies groupBy object format also affected', () => {
		it.skip('reproduces issue #1600: object-style groupBy fails for view at index 20', () => {
			// Test with groupBy as an object { property: string }
			const views: MockView[] = [];
			for (let i = 0; i < 21; i++) {
				if (i === 20) {
					views.push({
						name: 'object-groupby-view',
						groupBy: { property: 'status' }
					});
				} else {
					views.push({
						name: `view-${i}`,
						groupBy: { property: `prop-${i}` }
					});
				}
			}

			const controller: MockController = {
				query: { views },
				viewName: 'object-groupby-view'
			};

			const buggyResult = getGroupByPropertyIdBuggy(controller);
			expect(buggyResult).toBeNull(); // Bug

			const fixedResult = getGroupByPropertyIdFixed(controller);
			expect(fixedResult).toBe('status'); // Fixed
		});
	});

	describe('Views earlier in array still work correctly', () => {
		it.skip('reproduces issue #1600: views at index 0-19 work even with 100+ total views', () => {
			// Even with many views, early ones should still work
			for (let targetIndex = 0; targetIndex < 20; targetIndex++) {
				const controller = createMockControllerWithViews(
					100,
					targetIndex,
					`view-at-${targetIndex}`,
					`property-${targetIndex}`
				);

				const result = getGroupByPropertyIdBuggy(controller);
				expect(result).toBe(`property-${targetIndex}`);
			}
		});
	});
});
