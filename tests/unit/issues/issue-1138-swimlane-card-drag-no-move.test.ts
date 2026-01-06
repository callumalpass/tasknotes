/**
 * Test for Issue #1138: Kanban Swimlane - Cards don't move
 *
 * Bug Description:
 * When trying to move a card in a Kanban swimlane view, nothing happens visually.
 * The messages "Task status updated" and "task projects updated" appear (indicating
 * the backend update succeeded), but the card remains in its original position.
 *
 * User's configuration:
 * - The "projects" field is selected for swimlane
 * - When dragging a card between swimlanes, success messages appear but card doesn't move
 *
 * Video: https://github.com/user-attachments/assets/2b9e1e2f-acda-443c-adae-4cc8d4d003b8
 *
 * Potential Root Causes:
 * 1. List property swimlane handling - when a task has multiple project values (e.g., [A, B]),
 *    it appears in multiple swimlanes via "explode" logic. Dragging from swimlane "B" to "A"
 *    removes "B" and adds "A", but the task already had "A", so it appears unchanged.
 *
 * 2. State cleanup issue - `draggedTaskPaths` is not cleared in the drop handler,
 *    potentially causing stale state issues on subsequent drags.
 *
 * 3. Swimlane key mismatch - the source swimlane value captured during dragstart may not
 *    match the visual swimlane key due to case sensitivity or formatting differences.
 *
 * @see https://github.com/obsidianmd/tasknotes/issues/1138
 */

import { describe, it, expect } from "@jest/globals";

/**
 * Simulates the list property update logic from KanbanView.updateListPropertyOnDrop
 * (lines 1776-1809)
 */
function updateListPropertyOnDrop(
	currentValue: string[],
	sourceValue: string,
	targetValue: string
): string[] {
	// If dropping on the same column, do nothing (line 1783)
	if (sourceValue === targetValue) return currentValue;

	// Ensure we're working with an array (lines 1796-1798)
	let value = Array.isArray(currentValue) ? [...currentValue] : currentValue ? [currentValue as any] : [];

	// Create new array: remove source value, add target value (if not already present)
	// (lines 1801-1804)
	const newValue = value.filter((v: string) => v !== sourceValue);
	if (!newValue.includes(targetValue) && targetValue !== "None") {
		newValue.push(targetValue);
	}

	return newValue;
}

/**
 * Simulates swimlane distribution with exploded list columns
 * Based on KanbanView lines 612-661
 */
function distributeTasksToSwimlanes(
	tasks: Array<{ path: string; projects: string[] }>,
	explodeListProperty: boolean
): Map<string, string[]> {
	const swimlanes = new Map<string, string[]>();

	for (const task of tasks) {
		if (explodeListProperty && task.projects.length > 0) {
			// Explode: task appears in each swimlane for each project value
			for (const project of task.projects) {
				if (!swimlanes.has(project)) {
					swimlanes.set(project, []);
				}
				swimlanes.get(project)!.push(task.path);
			}
		} else {
			// Non-exploded: use first value or "None"
			const swimlaneKey = task.projects.length > 0 ? task.projects.join(", ") : "None";
			if (!swimlanes.has(swimlaneKey)) {
				swimlanes.set(swimlaneKey, []);
			}
			swimlanes.get(swimlaneKey)!.push(task.path);
		}
	}

	return swimlanes;
}

describe("Issue #1138: Kanban Swimlane - Cards don't move", () => {
	describe("Root cause 1: List property swimlane with multi-value tasks", () => {
		/**
		 * This test demonstrates the likely root cause of issue #1138.
		 *
		 * When a task has multiple project values (e.g., projects: [Alpha, Beta]),
		 * and swimlanes are enabled with "explode" mode, the task appears in BOTH
		 * swimlanes. Dragging from one swimlane to another:
		 * - Removes the source swimlane value from the array
		 * - Adds the target swimlane value (but it's already there!)
		 *
		 * Result: The task's projects array loses one value but still contains
		 * the target value, so the task remains visible in the target swimlane
		 * but ALSO disappears from the source - giving the impression it didn't move.
		 */
		it.skip("reproduces issue #1138: task with multi-value list property appears to not move", () => {
			// Setup: Task has projects: [Alpha, Beta]
			const initialProjects = ["Alpha", "Beta"];

			// Task appears in both swimlanes due to "explode" behavior
			const tasks = [{ path: "task1.md", projects: initialProjects }];
			const swimlanesBefore = distributeTasksToSwimlanes(tasks, true);

			expect(swimlanesBefore.get("Alpha")).toContain("task1.md");
			expect(swimlanesBefore.get("Beta")).toContain("task1.md");

			// User drags task from "Beta" swimlane to "Alpha" swimlane
			const sourceSwimLane = "Beta";
			const targetSwimLane = "Alpha";

			// This is what the drop handler does for list properties
			const newProjects = updateListPropertyOnDrop(initialProjects, sourceSwimLane, targetSwimLane);

			// Expected behavior: projects should be ["Alpha"] only
			// Actual result: ["Alpha"] - which is correct, BUT...
			expect(newProjects).toEqual(["Alpha"]);

			// The problem: After the update, task still appears in "Alpha" swimlane
			// User expected the card to "move" visually, but it was already there!
			const tasksAfter = [{ path: "task1.md", projects: newProjects }];
			const swimlanesAfter = distributeTasksToSwimlanes(tasksAfter, true);

			// Task is in Alpha swimlane (was already there before the drag)
			expect(swimlanesAfter.get("Alpha")).toContain("task1.md");
			// Task is no longer in Beta swimlane (correct)
			expect(swimlanesAfter.has("Beta")).toBe(false);

			// BUG: The visual outcome is that the card in "Alpha" swimlane didn't move
			// because it was already there. The card in "Beta" swimlane disappeared.
			// This matches the user's report: "nothing happens" when trying to move
			// a card - they're likely dragging from one appearance to another.
		});

		it("should correctly update projects when dragging between swimlanes", () => {
			// Normal case: task with single project value
			const initialProjects = ["Beta"];
			const sourceSwimLane = "Beta";
			const targetSwimLane = "Alpha";

			const newProjects = updateListPropertyOnDrop(initialProjects, sourceSwimLane, targetSwimLane);

			// Task should now be in Alpha only
			expect(newProjects).toEqual(["Alpha"]);
		});

		it("should handle drag to same swimlane (no-op)", () => {
			const initialProjects = ["Alpha"];
			const sourceSwimLane = "Alpha";
			const targetSwimLane = "Alpha";

			const newProjects = updateListPropertyOnDrop(initialProjects, sourceSwimLane, targetSwimLane);

			// No change expected
			expect(newProjects).toEqual(["Alpha"]);
		});

		it("should handle drag to None swimlane by removing project", () => {
			const initialProjects = ["Alpha", "Beta"];
			const sourceSwimLane = "Alpha";
			const targetSwimLane = "None";

			const newProjects = updateListPropertyOnDrop(initialProjects, sourceSwimLane, targetSwimLane);

			// "None" is not added (line 1802), but "Alpha" is removed
			expect(newProjects).toEqual(["Beta"]);
		});
	});

	describe("Root cause 2: draggedTaskPaths state not cleared in drop handler", () => {
		/**
		 * Tests the state management issue where draggedTaskPaths is not cleared
		 * in the drop handler, potentially causing stale state issues.
		 */
		interface DragState {
			draggedTaskPath: string | null;
			draggedTaskPaths: string[];
			draggedFromColumn: string | null;
			draggedFromSwimlane: string | null;
		}

		function createInitialState(): DragState {
			return {
				draggedTaskPath: null,
				draggedTaskPaths: [],
				draggedFromColumn: null,
				draggedFromSwimlane: null,
			};
		}

		function simulateDragStart(state: DragState, taskPath: string, column: string, swimlane: string): void {
			state.draggedTaskPath = taskPath;
			state.draggedTaskPaths = [taskPath]; // Line 1508
			state.draggedFromColumn = column; // Line 1521-1522
			state.draggedFromSwimlane = swimlane; // Line 1523
		}

		/**
		 * Simulates the CURRENT (buggy) drop handler behavior
		 * Lines 1247-1259 in KanbanView.ts
		 */
		function simulateSwimlaneDropCurrent(state: DragState): void {
			// After handleTaskDrop completes...
			state.draggedTaskPath = null; // Line 1257
			state.draggedFromColumn = null; // Line 1258
			// BUG: draggedTaskPaths is NOT cleared!
			// BUG: draggedFromSwimlane is NOT cleared!
		}

		/**
		 * Simulates the FIXED drop handler behavior
		 */
		function simulateSwimlaneDropFixed(state: DragState): void {
			state.draggedTaskPath = null;
			state.draggedFromColumn = null;
			state.draggedTaskPaths = []; // FIX: Clear this
			state.draggedFromSwimlane = null; // FIX: Clear this
		}

		it("current behavior: draggedTaskPaths retains stale values after drop", () => {
			const state = createInitialState();

			// First drag and drop
			simulateDragStart(state, "task1.md", "Todo", "ProjectA");
			simulateSwimlaneDropCurrent(state);

			// BUG: draggedTaskPaths still contains ["task1.md"]
			expect(state.draggedTaskPaths).toEqual(["task1.md"]);
			expect(state.draggedFromSwimlane).toBe("ProjectA");

			// On next drag, this stale state could cause issues
		});

		it.skip("reproduces issue #1138: stale draggedTaskPaths affects subsequent drag", () => {
			const state = createInitialState();

			// First drag and drop
			simulateDragStart(state, "task1.md", "Todo", "ProjectA");
			simulateSwimlaneDropCurrent(state);

			// Second drag - simulate starting to drag task2
			// At this point, draggedTaskPaths still has ["task1.md"] from previous drag
			// In handleTaskDrop (line 1707-1708):
			// const pathsToUpdate = this.draggedTaskPaths.length > 1 ? this.draggedTaskPaths : [taskPath];
			// Since draggedTaskPaths.length is 1 (not > 1), it uses [taskPath] - this is OK for single drag

			// But if user had selected multiple tasks before, draggedTaskPaths could have > 1 items
			// and cause the wrong tasks to be updated

			// This specific scenario is less likely to cause the reported bug,
			// but the incomplete state cleanup is still a code quality issue.
		});

		it("fixed behavior: all drag state should be cleared after drop", () => {
			const state = createInitialState();

			simulateDragStart(state, "task1.md", "Todo", "ProjectA");
			simulateSwimlaneDropFixed(state);

			expect(state.draggedTaskPath).toBeNull();
			expect(state.draggedTaskPaths).toEqual([]);
			expect(state.draggedFromColumn).toBeNull();
			expect(state.draggedFromSwimlane).toBeNull();
		});
	});

	describe("Root cause 3: Swimlane property value mismatch", () => {
		/**
		 * Tests potential case sensitivity or formatting issues that could
		 * cause the source swimlane value to not match the actual frontmatter value.
		 */
		it("should handle case mismatch between swimlane key and frontmatter value", () => {
			// Task has: projects: ["alpha"] (lowercase)
			// Swimlane shows: "Alpha" (capitalized for display)
			const frontmatterProjects = ["alpha"];
			const displaySwimLaneKey = "Alpha"; // As shown in UI
			const sourceFromDrag = "Alpha"; // What's captured in dragstart from data-swimlane

			// If we try to remove "Alpha" from ["alpha"], it won't match!
			const result = updateListPropertyOnDrop(frontmatterProjects, sourceFromDrag, "Beta");

			// BUG: "alpha" was not removed because we tried to filter "Alpha"
			expect(result).toContain("alpha"); // Original value remains
			expect(result).toContain("Beta"); // New value added
			// Task is now in BOTH swimlanes: ["alpha", "Beta"]
		});

		it.skip("reproduces issue #1138: case-insensitive swimlane matching", () => {
			// This would be the expected fix behavior
			const frontmatterProjects = ["alpha"];
			const sourceFromDrag = "Alpha"; // Capitalized in UI

			// A fixed implementation would use case-insensitive matching
			// const result = updateListPropertyOnDropCaseInsensitive(frontmatterProjects, sourceFromDrag, "Beta");
			// expect(result).toEqual(["Beta"]);
		});
	});

	describe("Swimlane distribution logic", () => {
		it("should correctly distribute tasks with list properties to multiple swimlanes", () => {
			const tasks = [
				{ path: "task1.md", projects: ["Alpha"] },
				{ path: "task2.md", projects: ["Beta"] },
				{ path: "task3.md", projects: ["Alpha", "Beta"] }, // In both
			];

			const swimlanes = distributeTasksToSwimlanes(tasks, true);

			expect(swimlanes.get("Alpha")).toEqual(["task1.md", "task3.md"]);
			expect(swimlanes.get("Beta")).toEqual(["task2.md", "task3.md"]);
		});

		it("should place tasks without projects in 'None' swimlane", () => {
			const tasks = [
				{ path: "task1.md", projects: [] },
				{ path: "task2.md", projects: ["Alpha"] },
			];

			const swimlanes = distributeTasksToSwimlanes(tasks, true);

			expect(swimlanes.get("None")).toEqual(["task1.md"]);
			expect(swimlanes.get("Alpha")).toEqual(["task2.md"]);
		});
	});
});
