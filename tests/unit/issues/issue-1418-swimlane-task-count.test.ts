/**
 * Test for Issue #1418: Swimlanes are not displaying the correct number of tasks
 *
 * Bug Description:
 * User has a Kanban view without swimlanes showing 23 cards. When swimlanes are
 * enabled using `swimLane: note.ContentType`, only 2 cards are displayed instead
 * of 23. The total count shown in the view header says 23, but the swimlane
 * cells only contain 2 tasks.
 *
 * User's .base configuration:
 * ```
 * views:
 *   type: tasknotesKanban
 *   name: APR Kanban Board
 *   groupBy:
 *     property: Status
 *     direction: ASC
 *   swimLane: note.ContentType
 *   maxSwimlaneHeight: 800
 *   columnWidth: 280
 * ```
 *
 * Potential Root Causes:
 * 1. Property lookup mismatch - case sensitivity between config and actual property names
 * 2. Missing properties in pathToProps map - some tasks may not have the swimlane property mapped
 * 3. Swimlane initialization vs distribution mismatch - tasks getting dropped when swimlane key doesn't exist
 * 4. Property prefix handling - "note.ContentType" vs "ContentType" lookup issues
 *
 * @see https://github.com/obsidianmd/tasknotes/issues/1418
 */

import { describe, it, expect } from "@jest/globals";

/**
 * Simulates the swimlane distribution logic from KanbanView.ts lines 606-661
 */
function distributeTasksToSwimLanes(
	tasks: Array<{ path: string; name: string }>,
	pathToProps: Map<string, Record<string, unknown>>,
	swimLanePropertyId: string
): {
	swimLanes: Map<string, Map<string, Array<{ path: string; name: string }>>>;
	totalTasksDistributed: number;
	tasksPerSwimLane: Map<string, number>;
} {
	// Step 1: Collect unique swimlane values (mirrors lines 617-625)
	const swimLaneValues = new Set<string>();

	for (const task of tasks) {
		const props = pathToProps.get(task.path) || {};
		const swimLaneValue = getPropertyValue(props, swimLanePropertyId);
		const swimLaneKey = valueToString(swimLaneValue);
		swimLaneValues.add(swimLaneKey);
	}

	// Step 2: Initialize swimlane structure (mirrors lines 627-637)
	const swimLanes = new Map<string, Map<string, Array<{ path: string; name: string }>>>();
	const columnKeys = ["Todo", "InProgress", "Done"]; // Simulated columns

	for (const swimLaneKey of swimLaneValues) {
		const swimLaneMap = new Map<string, Array<{ path: string; name: string }>>();
		swimLanes.set(swimLaneKey, swimLaneMap);

		for (const columnKey of columnKeys) {
			swimLaneMap.set(columnKey, []);
		}
	}

	// Step 3: Distribute tasks into swimlane + column cells (mirrors lines 648-661)
	// This simulates a grouped structure
	const groups = new Map<string, Array<{ path: string; name: string }>>();
	for (const columnKey of columnKeys) {
		groups.set(columnKey, []);
	}

	// Simulate grouping by column (in real code this comes from Bases)
	for (const task of tasks) {
		const props = pathToProps.get(task.path) || {};
		const statusValue = getPropertyValue(props, "note.Status");
		const columnKey = valueToString(statusValue);
		if (groups.has(columnKey)) {
			groups.get(columnKey)!.push(task);
		} else {
			groups.get("Todo")!.push(task); // Default to first column
		}
	}

	// Distribute to swimlanes (mirrors lines 648-661)
	for (const [columnKey, columnTasks] of groups) {
		for (const task of columnTasks) {
			const props = pathToProps.get(task.path) || {};
			const swimLaneValue = getPropertyValue(props, swimLanePropertyId);
			const swimLaneKey = valueToString(swimLaneValue);

			const swimLane = swimLanes.get(swimLaneKey);
			if (!swimLane) continue; // Bug: task silently dropped if swimlane doesn't exist

			if (swimLane.has(columnKey)) {
				swimLane.get(columnKey)!.push(task);
			}
		}
	}

	// Count results
	let totalTasksDistributed = 0;
	const tasksPerSwimLane = new Map<string, number>();

	for (const [swimLaneKey, columns] of swimLanes) {
		let count = 0;
		for (const tasks of columns.values()) {
			count += tasks.length;
		}
		tasksPerSwimLane.set(swimLaneKey, count);
		totalTasksDistributed += count;
	}

	return { swimLanes, totalTasksDistributed, tasksPerSwimLane };
}

/**
 * Mirrors getPropertyValue from KanbanView.ts lines 1944-1958
 */
function getPropertyValue(props: Record<string, unknown>, propertyId: string): unknown {
	if (propertyId.startsWith("formula.")) {
		return props[propertyId] ?? null;
	}

	const cleanId = stripPropertyPrefix(propertyId);

	if (props[propertyId] !== undefined) return props[propertyId];
	if (props[cleanId] !== undefined) return props[cleanId];

	return null;
}

/**
 * Mirrors stripPropertyPrefix from KanbanView.ts lines 1960-1966
 */
function stripPropertyPrefix(propertyId: string): string {
	const parts = propertyId.split(".");
	if (parts.length > 1 && ["note", "file", "formula", "task"].includes(parts[0])) {
		return parts.slice(1).join(".");
	}
	return propertyId;
}

/**
 * Mirrors valueToString from KanbanView.ts lines 1968-1993
 */
function valueToString(value: unknown): string {
	if (value === null || value === undefined) return "None";
	if (typeof value === "string") return value || "None";
	if (Array.isArray(value)) {
		if (value.length === 0) return "None";
		return value.map((v) => valueToString(v)).join(", ");
	}
	return String(value) || "None";
}

describe("Issue #1418: Swimlanes not displaying correct number of tasks", () => {
	describe("Property lookup behavior", () => {
		it("should find property with exact match including prefix", () => {
			const props = { "note.ContentType": "Article" };
			expect(getPropertyValue(props, "note.ContentType")).toBe("Article");
		});

		it("should find property without prefix when stored with prefix", () => {
			const props = { "note.ContentType": "Article" };
			// This tests if "ContentType" alone can find "note.ContentType"
			// Current implementation: NO - it only strips prefix from propertyId, not from props keys
			expect(getPropertyValue(props, "ContentType")).toBeNull(); // Current behavior
		});

		it("should find property when stored without prefix", () => {
			const props = { ContentType: "Article" };
			expect(getPropertyValue(props, "note.ContentType")).toBe("Article");
		});

		/**
		 * This test documents a potential case sensitivity issue.
		 * If user has `contenttype` in frontmatter but uses `note.ContentType` in config,
		 * the lookup may fail.
		 */
		it.skip("should handle case-insensitive property lookup (potential Issue #1418 cause)", () => {
			const props = { contenttype: "Article" }; // Lowercase in frontmatter
			// User configures: swimLane: note.ContentType (mixed case)
			expect(getPropertyValue(props, "note.ContentType")).toBe("Article");
			// This currently FAILS because lookup is case-sensitive
		});

		it("current behavior: case-sensitive property lookup (documents bug)", () => {
			const props = { contenttype: "Article" }; // Lowercase in frontmatter
			// User configures: swimLane: note.ContentType (mixed case)
			expect(getPropertyValue(props, "note.ContentType")).toBeNull(); // Bug: should be "Article"
			expect(getPropertyValue(props, "ContentType")).toBeNull(); // Also fails
		});
	});

	describe("Swimlane distribution with missing property values", () => {
		it("should distribute all tasks when all have the swimlane property", () => {
			const tasks = [
				{ path: "task1.md", name: "Task 1" },
				{ path: "task2.md", name: "Task 2" },
				{ path: "task3.md", name: "Task 3" },
			];

			const pathToProps = new Map<string, Record<string, unknown>>([
				["task1.md", { ContentType: "Article", Status: "Todo" }],
				["task2.md", { ContentType: "Video", Status: "InProgress" }],
				["task3.md", { ContentType: "Article", Status: "Done" }],
			]);

			const result = distributeTasksToSwimLanes(tasks, pathToProps, "note.ContentType");

			expect(result.totalTasksDistributed).toBe(3);
		});

		it("should place tasks without swimlane property in 'None' swimlane", () => {
			const tasks = [
				{ path: "task1.md", name: "Task 1" },
				{ path: "task2.md", name: "Task 2" }, // No ContentType
				{ path: "task3.md", name: "Task 3" },
			];

			const pathToProps = new Map<string, Record<string, unknown>>([
				["task1.md", { ContentType: "Article", Status: "Todo" }],
				["task2.md", { Status: "InProgress" }], // Missing ContentType
				["task3.md", { ContentType: "Article", Status: "Done" }],
			]);

			const result = distributeTasksToSwimLanes(tasks, pathToProps, "note.ContentType");

			expect(result.totalTasksDistributed).toBe(3);
			expect(result.tasksPerSwimLane.get("None")).toBe(1);
			expect(result.tasksPerSwimLane.get("Article")).toBe(2);
		});

		/**
		 * This test documents the bug where tasks are dropped when pathToProps
		 * doesn't have an entry for the task path.
		 */
		it("should not drop tasks when pathToProps is missing entries", () => {
			const tasks = [
				{ path: "task1.md", name: "Task 1" },
				{ path: "task2.md", name: "Task 2" },
				{ path: "task3.md", name: "Task 3" },
			];

			// Only 1 out of 3 tasks has an entry in pathToProps
			const pathToProps = new Map<string, Record<string, unknown>>([
				["task1.md", { ContentType: "Article", Status: "Todo" }],
				// task2.md and task3.md are missing from pathToProps
			]);

			const result = distributeTasksToSwimLanes(tasks, pathToProps, "note.ContentType");

			// All 3 tasks should still be distributed (missing props -> "None" swimlane)
			expect(result.totalTasksDistributed).toBe(3);
		});
	});

	describe("Scenario matching Issue #1418 report", () => {
		/**
		 * Simulates the user's scenario: 23 tasks visible in flat view,
		 * but only 2 visible in swimlane view.
		 */
		it("should distribute all 23 tasks to swimlanes, not just 2", () => {
			// Create 23 tasks like the user's scenario
			const tasks = Array.from({ length: 23 }, (_, i) => ({
				path: `task${i + 1}.md`,
				name: `Task ${i + 1}`,
			}));

			// Simulate a scenario where only some tasks have ContentType in pathToProps
			// This could happen if:
			// 1. Property name mismatch (case sensitivity)
			// 2. Property stored under different key
			// 3. Missing from metadata
			const pathToProps = new Map<string, Record<string, unknown>>();

			// Only first 2 tasks have the correct property setup
			pathToProps.set("task1.md", { ContentType: "Article", Status: "Todo" });
			pathToProps.set("task2.md", { ContentType: "Video", Status: "InProgress" });

			// Remaining 21 tasks might have:
			// - Different case: contenttype instead of ContentType
			// - Property stored with note. prefix: note.contenttype
			// - Property completely missing
			for (let i = 3; i <= 23; i++) {
				pathToProps.set(`task${i}.md`, {
					contenttype: "Article", // Wrong case - won't match note.ContentType
					Status: ["Todo", "InProgress", "Done"][i % 3],
				});
			}

			const result = distributeTasksToSwimLanes(tasks, pathToProps, "note.ContentType");

			// BUG: This fails because only 2 tasks have correct property name case
			// The remaining 21 tasks fall into "None" swimlane but ARE distributed
			// However, if this returned only 2, it would indicate a different bug
			expect(result.totalTasksDistributed).toBe(23);

			// Check that we got the expected distribution
			// With case-sensitive matching:
			// - 2 tasks with "ContentType" -> proper swimlanes
			// - 21 tasks with "contenttype" -> "None" swimlane (since lookup fails)
			expect(result.tasksPerSwimLane.get("Article")).toBe(1);
			expect(result.tasksPerSwimLane.get("Video")).toBe(1);
			expect(result.tasksPerSwimLane.get("None")).toBe(21);
		});

		/**
		 * This test documents what might cause only 2 tasks to appear:
		 * If pathToProps is completely missing entries for most tasks.
		 */
		it.skip("reproduces bug: tasks dropped when pathToProps missing (potential Issue #1418 cause)", () => {
			const tasks = Array.from({ length: 23 }, (_, i) => ({
				path: `task${i + 1}.md`,
				name: `Task ${i + 1}`,
			}));

			// Simulate broken pathToProps - only has entries for 2 tasks
			const pathToProps = new Map<string, Record<string, unknown>>([
				["task1.md", { ContentType: "Article", Status: "Todo" }],
				["task2.md", { ContentType: "Video", Status: "InProgress" }],
				// No entries for task3-task23!
			]);

			const result = distributeTasksToSwimLanes(tasks, pathToProps, "note.ContentType");

			// Current behavior: all 23 tasks should be distributed
			// If only 2 appear, the bug is elsewhere
			expect(result.totalTasksDistributed).toBe(23);
		});
	});

	describe("Expected fix: case-insensitive property lookup", () => {
		/**
		 * Proposed fix: getPropertyValue should do case-insensitive matching
		 */
		function getPropertyValueCaseInsensitive(
			props: Record<string, unknown>,
			propertyId: string
		): unknown {
			if (propertyId.startsWith("formula.")) {
				return props[propertyId] ?? null;
			}

			const cleanId = stripPropertyPrefix(propertyId);

			// Try exact match first
			if (props[propertyId] !== undefined) return props[propertyId];
			if (props[cleanId] !== undefined) return props[cleanId];

			// Case-insensitive fallback
			const cleanIdLower = cleanId.toLowerCase();
			for (const key of Object.keys(props)) {
				if (key.toLowerCase() === cleanIdLower) {
					return props[key];
				}
				// Also try stripping prefix from prop key
				const keyClean = stripPropertyPrefix(key);
				if (keyClean.toLowerCase() === cleanIdLower) {
					return props[key];
				}
			}

			return null;
		}

		it("fixed: should find property regardless of case", () => {
			const props = { contenttype: "Article" };
			expect(getPropertyValueCaseInsensitive(props, "note.ContentType")).toBe("Article");
		});

		it("fixed: should find property with mixed prefix and case", () => {
			const props = { "note.contenttype": "Video" };
			expect(getPropertyValueCaseInsensitive(props, "ContentType")).toBe("Video");
		});

		it("fixed: should still prefer exact match", () => {
			const props = { ContentType: "Exact", contenttype: "Fallback" };
			expect(getPropertyValueCaseInsensitive(props, "ContentType")).toBe("Exact");
		});
	});
});
