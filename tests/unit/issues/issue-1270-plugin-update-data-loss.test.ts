/**
 * Issue #1270: Plugin update deleted all views, search is gone, detailed tags missing
 *
 * User reported that after plugin update:
 * 1. All curated views were deleted
 * 2. Search functionality is gone from kanban
 * 3. Tags are missing
 * 4. Two columns labeled "null" appeared (instead of "None")
 * 5. 1,952 notes appeared in a null column including every image in the vault
 *
 * Root causes identified:
 * - String(null) produces "null" which is truthy, so fallback to "None" never triggers
 * - Migration error handler clears all saved views as fallback
 * - Non-task files (images) not filtered from Bases data
 */

import { describe, it, expect } from "@jest/globals";

describe.skip("Issue #1270: Plugin update data loss bugs", () => {
	describe("Bug 1: null columns appearing in Kanban view", () => {
		/**
		 * This test reproduces the bug in KanbanView.ts:386 where:
		 * const columnKey = String(item) || "None";
		 *
		 * When item is null, String(null) = "null" which is truthy,
		 * so the fallback "None" never triggers. This creates columns
		 * labeled "null" instead of "None".
		 */
		function simulateColumnKeyGeneration(item: unknown): string {
			// Current buggy behavior from KanbanView.ts:386
			const columnKey = String(item) || "None";
			return columnKey;
		}

		function fixedColumnKeyGeneration(item: unknown): string {
			// Fixed behavior: properly handle null/undefined
			if (item === null || item === undefined) {
				return "None";
			}
			const stringValue = String(item);
			return stringValue === "" ? "None" : stringValue;
		}

		it("should NOT create a column named 'null' when grouping value is null", () => {
			// This test currently fails - demonstrates the bug
			const result = simulateColumnKeyGeneration(null);

			// BUG: String(null) = "null" which is truthy
			// Expected: "None", Actual: "null"
			expect(result).toBe("None");
		});

		it("should NOT create a column named 'undefined' when grouping value is undefined", () => {
			const result = simulateColumnKeyGeneration(undefined);

			// BUG: String(undefined) = "undefined" which is truthy
			// Expected: "None", Actual: "undefined"
			expect(result).toBe("None");
		});

		it("should handle empty string correctly", () => {
			const result = simulateColumnKeyGeneration("");

			// This case actually works because String("") = "" is falsy
			expect(result).toBe("None");
		});

		it("should preserve valid string values", () => {
			expect(simulateColumnKeyGeneration("High")).toBe("High");
			expect(simulateColumnKeyGeneration("In Progress")).toBe("In Progress");
			expect(simulateColumnKeyGeneration("Work")).toBe("Work");
		});

		it("should handle numeric values", () => {
			expect(simulateColumnKeyGeneration(1)).toBe("1");
			// Note: 0 becomes "0" which is truthy - this is acceptable behavior
			expect(simulateColumnKeyGeneration(0)).toBe("0");
		});

		describe("Fixed implementation comparison", () => {
			it("fixed version should return 'None' for null", () => {
				expect(fixedColumnKeyGeneration(null)).toBe("None");
			});

			it("fixed version should return 'None' for undefined", () => {
				expect(fixedColumnKeyGeneration(undefined)).toBe("None");
			});

			it("fixed version should preserve valid values", () => {
				expect(fixedColumnKeyGeneration("High")).toBe("High");
				expect(fixedColumnKeyGeneration("Work")).toBe("Work");
			});
		});
	});

	describe("Bug 2: Migration error handler clears all saved views", () => {
		/**
		 * In ViewStateManager.ts:435-440, when migration fails,
		 * the fallback behavior clears ALL saved views:
		 *
		 * catch (error) {
		 *   this.savedViews = [];
		 *   await this.saveSavedViewsToPluginData();
		 * }
		 *
		 * This is catastrophic - a single migration error loses all user's curated views.
		 */

		interface SavedView {
			id: string;
			name: string;
		}

		class MockViewStateManager {
			savedViews: SavedView[] = [];

			// Simulates the current buggy migration behavior
			async performMigrationBuggy(): Promise<void> {
				try {
					// Simulate migration that throws an error
					throw new Error("Migration failed - some property changed");
				} catch {
					// BUG: Fallback clears ALL saved views - catastrophic data loss
					this.savedViews = [];
				}
			}

			// Simulates the fixed migration behavior
			async performMigrationFixed(): Promise<void> {
				const originalViews = [...this.savedViews];
				try {
					// Simulate migration that throws an error
					throw new Error("Migration failed - some property changed");
				} catch {
					// FIXED: Preserve original views on migration failure
					// Only clear views that specifically failed to migrate
					this.savedViews = originalViews;
				}
			}
		}

		it("should NOT clear all saved views when migration fails", async () => {
			const manager = new MockViewStateManager();
			manager.savedViews = [
				{ id: "view1", name: "My Kanban" },
				{ id: "view2", name: "Priority View" },
				{ id: "view3", name: "Project Overview" },
			];

			await manager.performMigrationBuggy();

			// BUG: All views are cleared on any migration error
			// Expected: Views should be preserved
			expect(manager.savedViews.length).toBeGreaterThan(0);
		});

		it("fixed version should preserve views on migration failure", async () => {
			const manager = new MockViewStateManager();
			manager.savedViews = [
				{ id: "view1", name: "My Kanban" },
				{ id: "view2", name: "Priority View" },
				{ id: "view3", name: "Project Overview" },
			];

			const originalLength = manager.savedViews.length;
			await manager.performMigrationFixed();

			expect(manager.savedViews.length).toBe(originalLength);
		});
	});

	describe("Bug 3: Non-task files included in Bases data", () => {
		/**
		 * The BasesDataAdapter extracts ALL files from basesView.data.data
		 * without filtering for task files. This causes images and other
		 * non-task files to appear in the kanban view.
		 *
		 * From helpers.ts:209-226, identifyTaskNotesFromBasesData()
		 * converts all items without checking if they're actual task files.
		 */

		interface BasesDataItem {
			path: string;
			properties?: Record<string, unknown>;
		}

		interface TaskInfo {
			path: string;
			status: string;
		}

		function isTaskFile(path: string): boolean {
			// Simple check - in reality this would check frontmatter/properties
			const taskExtensions = [".md"];
			const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
			const ext = path.substring(path.lastIndexOf("."));

			if (imageExtensions.includes(ext)) return false;
			if (!taskExtensions.includes(ext)) return false;

			// Would also check for task properties in frontmatter
			return true;
		}

		// Current buggy behavior - no filtering
		function identifyTaskNotesBuggy(dataItems: BasesDataItem[]): TaskInfo[] {
			return dataItems
				.filter((item) => item?.path)
				.map((item) => ({
					path: item.path,
					status: "todo",
				}));
		}

		// Fixed behavior - filter non-task files
		function identifyTaskNotesFixed(dataItems: BasesDataItem[]): TaskInfo[] {
			return dataItems
				.filter((item) => item?.path && isTaskFile(item.path))
				.map((item) => ({
					path: item.path,
					status: "todo",
				}));
		}

		const mixedData: BasesDataItem[] = [
			{ path: "tasks/implement-feature.md" },
			{ path: "tasks/fix-bug.md" },
			{ path: "attachments/screenshot.png" },
			{ path: "attachments/photo.jpg" },
			{ path: "assets/diagram.svg" },
			{ path: "notes/meeting-notes.md" },
			{ path: "images/banner.webp" },
		];

		it("should NOT include image files in task list", () => {
			const result = identifyTaskNotesBuggy(mixedData);

			// BUG: Images are included in the task list
			const hasImages = result.some(
				(t) =>
					t.path.endsWith(".png") ||
					t.path.endsWith(".jpg") ||
					t.path.endsWith(".svg") ||
					t.path.endsWith(".webp")
			);

			// Expected: no images, Actual: images included
			expect(hasImages).toBe(false);
		});

		it("should only include markdown files with task properties", () => {
			const result = identifyTaskNotesBuggy(mixedData);

			// All results should be markdown files
			const allMarkdown = result.every((t) => t.path.endsWith(".md"));

			expect(allMarkdown).toBe(true);
		});

		it("fixed version should exclude images", () => {
			const result = identifyTaskNotesFixed(mixedData);

			const hasImages = result.some(
				(t) =>
					t.path.endsWith(".png") ||
					t.path.endsWith(".jpg") ||
					t.path.endsWith(".svg") ||
					t.path.endsWith(".webp")
			);

			expect(hasImages).toBe(false);
		});

		it("fixed version should only include markdown files", () => {
			const result = identifyTaskNotesFixed(mixedData);

			expect(result.length).toBe(3); // Only the 3 .md files
			expect(result.every((t) => t.path.endsWith(".md"))).toBe(true);
		});
	});

	describe("Bug 4: Array with null elements creates null columns", () => {
		/**
		 * When a task has a list property (like tags) with null elements,
		 * each null element creates a separate "null" column.
		 */

		function groupTasksByListProperty(
			tasks: { id: string; tags: (string | null)[] }[]
		): Map<string, string[]> {
			const groups = new Map<string, string[]>();

			for (const task of tasks) {
				for (const tag of task.tags) {
					// Current buggy behavior from KanbanView.ts:386
					const columnKey = String(tag) || "None";

					if (!groups.has(columnKey)) {
						groups.set(columnKey, []);
					}
					groups.get(columnKey)!.push(task.id);
				}
			}

			return groups;
		}

		it("should NOT create columns named 'null' for null array elements", () => {
			const tasks = [
				{ id: "task1", tags: ["work", null, "important"] },
				{ id: "task2", tags: [null, "personal"] },
				{ id: "task3", tags: ["work", null] },
			];

			const groups = groupTasksByListProperty(tasks);

			// BUG: A "null" column is created
			expect(groups.has("null")).toBe(false);
		});

		it("should group null tags into 'None' column instead", () => {
			const tasks = [
				{ id: "task1", tags: ["work", null] },
				{ id: "task2", tags: [null] },
			];

			const groups = groupTasksByListProperty(tasks);

			// Tasks with null tags should go to "None" column
			expect(groups.has("None")).toBe(true);
		});
	});
});
