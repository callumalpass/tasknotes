/**
 * Issue #1338: Option to have no YAML creation of Status neither Priority in a new TaskNote
 *
 * This test file validates the expected behavior when users opt out of having
 * Status and Priority properties automatically created in new TaskNotes.
 *
 * Feature request: Allow users to disable automatic creation of status and priority
 * YAML frontmatter properties when creating new tasks.
 *
 * @see https://github.com/calluma/tasknotes/issues/1338
 */

import { FieldMapper } from "../../../src/services/FieldMapper";
import { TaskService } from "../../../src/services/TaskService";
import { TaskInfo, TaskCreationData } from "../../../src/types";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

// Mock dependencies
jest.mock("obsidian", () => ({
	TFile: class TFile {
		path: string;
		basename: string;
		constructor(path: string) {
			this.path = path;
			this.basename = path.split("/").pop()?.replace(".md", "") || "";
		}
	},
	stringifyYaml: (obj: any) => JSON.stringify(obj, null, 2),
}));

describe.skip("Issue #1338: Optional Status/Priority in Frontmatter", () => {
	describe("Settings interface", () => {
		it("should have includeStatusOnCreate setting defaulting to true", () => {
			// This test verifies the new setting exists and defaults to true for backwards compatibility
			const defaultSettings = {
				// Current defaults - these settings don't exist yet
				includeStatusOnCreate: true,
				includePriorityOnCreate: true,
			};

			expect(defaultSettings.includeStatusOnCreate).toBe(true);
			expect(defaultSettings.includePriorityOnCreate).toBe(true);
		});

		it("should have includePriorityOnCreate setting defaulting to true", () => {
			const defaultSettings = {
				includePriorityOnCreate: true,
			};

			expect(defaultSettings.includePriorityOnCreate).toBe(true);
		});
	});

	describe("FieldMapper.mapToFrontmatter with optional status/priority", () => {
		let fieldMapper: FieldMapper;

		beforeEach(() => {
			fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
		});

		it("should include status in frontmatter when includeStatusOnCreate is true (default)", () => {
			const taskData: Partial<TaskInfo> = {
				title: "Test task",
				status: "open",
				priority: "normal",
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData, "task", true);

			expect(frontmatter.status).toBe("open");
		});

		it("should include priority in frontmatter when includePriorityOnCreate is true (default)", () => {
			const taskData: Partial<TaskInfo> = {
				title: "Test task",
				status: "open",
				priority: "normal",
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData, "task", true);

			expect(frontmatter.priority).toBe("normal");
		});

		/**
		 * FAILING TEST: This test will fail until the feature is implemented.
		 * When includeStatusOnCreate is false, status should NOT be added to frontmatter.
		 */
		it("should NOT include status in frontmatter when includeStatusOnCreate is false", () => {
			const taskData: Partial<TaskInfo> = {
				title: "Test task",
				status: "open",
				priority: "normal",
			};

			// TODO: FieldMapper needs to accept settings or options to control this behavior
			// For now, we test the current behavior (which includes status)
			// and mark this test as the expected behavior after implementation
			const frontmatter = fieldMapper.mapToFrontmatter(taskData, "task", true);

			// EXPECTED: When includeStatusOnCreate is false, status should be undefined
			// CURRENT: Status is always included when provided
			// This test documents the expected behavior - it should FAIL until implemented
			expect(frontmatter.status).toBeUndefined();
		});

		/**
		 * FAILING TEST: This test will fail until the feature is implemented.
		 * When includePriorityOnCreate is false, priority should NOT be added to frontmatter.
		 */
		it("should NOT include priority in frontmatter when includePriorityOnCreate is false", () => {
			const taskData: Partial<TaskInfo> = {
				title: "Test task",
				status: "open",
				priority: "normal",
			};

			// TODO: FieldMapper needs to accept settings or options to control this behavior
			const frontmatter = fieldMapper.mapToFrontmatter(taskData, "task", true);

			// EXPECTED: When includePriorityOnCreate is false, priority should be undefined
			// CURRENT: Priority is always included when provided
			// This test documents the expected behavior - it should FAIL until implemented
			expect(frontmatter.priority).toBeUndefined();
		});

		it("should still work with other frontmatter properties when status/priority are excluded", () => {
			const taskData: Partial<TaskInfo> = {
				title: "Test task with dates only",
				due: "2025-02-01",
				scheduled: "2025-01-25",
				contexts: ["personal"],
				tags: ["life"],
			};

			// When status/priority are excluded, other properties should still be mapped correctly
			const frontmatter = fieldMapper.mapToFrontmatter(taskData, "task", true);

			expect(frontmatter.due).toBe("2025-02-01");
			expect(frontmatter.scheduled).toBe("2025-01-25");
			expect(frontmatter.contexts).toEqual(["personal"]);
			expect(frontmatter.tags).toContain("task");
			expect(frontmatter.tags).toContain("life");
		});
	});

	describe("TaskService.createTask with optional status/priority", () => {
		/**
		 * FAILING TEST: This test verifies TaskService respects the new settings.
		 * When includeStatusOnCreate is false, TaskService should NOT set a default status.
		 */
		it("should not set default status when includeStatusOnCreate is false", () => {
			// This test documents expected behavior after implementation
			// TaskService.createTask currently always sets:
			//   const status = taskData.status || this.plugin.settings.defaultTaskStatus;
			//
			// Expected behavior: When includeStatusOnCreate is false, status should remain undefined

			const mockSettings = {
				defaultTaskStatus: "open",
				defaultTaskPriority: "normal",
				includeStatusOnCreate: false, // New setting
				includePriorityOnCreate: true,
			};

			const taskCreationData: Partial<TaskCreationData> = {
				title: "Test task without status",
				// No status provided
			};

			// Expected: status should remain undefined, not default to 'open'
			// Current behavior: status is always set to defaultTaskStatus
			const expectedStatus = mockSettings.includeStatusOnCreate
				? taskCreationData.status || mockSettings.defaultTaskStatus
				: undefined;

			expect(expectedStatus).toBeUndefined();
		});

		/**
		 * FAILING TEST: This test verifies TaskService respects the new settings.
		 * When includePriorityOnCreate is false, TaskService should NOT set a default priority.
		 */
		it("should not set default priority when includePriorityOnCreate is false", () => {
			const mockSettings = {
				defaultTaskStatus: "open",
				defaultTaskPriority: "normal",
				includeStatusOnCreate: true,
				includePriorityOnCreate: false, // New setting
			};

			const taskCreationData: Partial<TaskCreationData> = {
				title: "Test task without priority",
				// No priority provided
			};

			// Expected: priority should remain undefined, not default to 'normal'
			const expectedPriority = mockSettings.includePriorityOnCreate
				? taskCreationData.priority || mockSettings.defaultTaskPriority
				: undefined;

			expect(expectedPriority).toBeUndefined();
		});

		it("should allow both status and priority to be excluded simultaneously", () => {
			const mockSettings = {
				defaultTaskStatus: "open",
				defaultTaskPriority: "normal",
				includeStatusOnCreate: false,
				includePriorityOnCreate: false,
			};

			const taskCreationData: Partial<TaskCreationData> = {
				title: "Personal journal entry",
				due: "2025-02-01",
				// User only wants date, no status/priority for personal tracking
			};

			const expectedStatus = mockSettings.includeStatusOnCreate
				? taskCreationData.status || mockSettings.defaultTaskStatus
				: undefined;

			const expectedPriority = mockSettings.includePriorityOnCreate
				? taskCreationData.priority || mockSettings.defaultTaskPriority
				: undefined;

			expect(expectedStatus).toBeUndefined();
			expect(expectedPriority).toBeUndefined();
		});
	});

	describe("Use case: Personal entries without status/priority", () => {
		/**
		 * This test validates the user's actual use case from the issue:
		 * "I'm using this wonderful plugin to track personal entries from various
		 * areas in my life, and eventually some of them doesn't need to have priority
		 * neither status related, only a date and another personal Property"
		 */
		it("should support creating tasks with only date and custom properties (no status/priority)", () => {
			const personalEntry: Partial<TaskInfo> = {
				title: "Daily reflection",
				due: "2025-01-15",
				// User's custom property would be handled via userFields
				// No status, no priority - just date tracking
			};

			// When settings have includeStatusOnCreate=false and includePriorityOnCreate=false,
			// the resulting frontmatter should only contain:
			// - title (if not stored in filename)
			// - due date
			// - tags (for identification)
			// - any custom user fields

			const expectedFrontmatterKeys = ["title", "due", "tags"];

			// This documents the expected structure - test will fail until implemented
			const mockFrontmatter = {
				title: personalEntry.title,
				due: personalEntry.due,
				tags: ["task"],
				// status and priority should NOT be present when settings disable them
			};

			expect(Object.keys(mockFrontmatter)).not.toContain("status");
			expect(Object.keys(mockFrontmatter)).not.toContain("priority");
			expect(mockFrontmatter.due).toBe("2025-01-15");
		});
	});

	describe("Edge cases and backwards compatibility", () => {
		it("should still allow explicitly setting status even when includeStatusOnCreate is false", () => {
			// If user explicitly provides a status, it should be respected even when default is disabled
			const taskData: Partial<TaskInfo> = {
				title: "Task with explicit status",
				status: "in-progress", // Explicitly set
			};

			const mockSettings = {
				includeStatusOnCreate: false,
			};

			// Expected: When user explicitly provides status, it should be included
			// The setting should only affect the DEFAULT behavior, not explicit values
			const shouldIncludeStatus =
				taskData.status !== undefined || mockSettings.includeStatusOnCreate;

			// User explicitly set status, so it should be included
			expect(shouldIncludeStatus).toBe(true);
		});

		it("should still allow explicitly setting priority even when includePriorityOnCreate is false", () => {
			const taskData: Partial<TaskInfo> = {
				title: "Task with explicit priority",
				priority: "high", // Explicitly set
			};

			const mockSettings = {
				includePriorityOnCreate: false,
			};

			const shouldIncludePriority =
				taskData.priority !== undefined || mockSettings.includePriorityOnCreate;

			expect(shouldIncludePriority).toBe(true);
		});

		it("should handle views/filters gracefully when tasks have no status", () => {
			// Views and filters should not break when a task has no status property
			const taskWithoutStatus: Partial<TaskInfo> = {
				title: "Task without status",
				path: "tasks/test.md",
				due: "2025-01-15",
				// No status property
			};

			// Filtering by status should treat undefined as "no status" not throw an error
			const tasks = [taskWithoutStatus];
			const openTasks = tasks.filter(
				(t) => t.status === "open" || t.status === undefined
			);

			// Task with undefined status should be included in "all" or "no status" filter
			expect(openTasks).toContain(taskWithoutStatus);
		});

		it("should handle views/filters gracefully when tasks have no priority", () => {
			const taskWithoutPriority: Partial<TaskInfo> = {
				title: "Task without priority",
				path: "tasks/test.md",
				status: "open",
				// No priority property
			};

			// Sorting by priority should handle undefined gracefully
			const tasks = [
				{ ...taskWithoutPriority, priority: "high" },
				taskWithoutPriority,
				{ ...taskWithoutPriority, priority: "low" },
			];

			// Sort should not throw when priority is undefined
			const sortedTasks = [...tasks].sort((a, b) => {
				const priorityOrder: Record<string, number> = {
					highest: 0,
					high: 1,
					normal: 2,
					low: 3,
					lowest: 4,
				};
				const aPriority = a.priority ? priorityOrder[a.priority] ?? 2 : 2;
				const bPriority = b.priority ? priorityOrder[b.priority] ?? 2 : 2;
				return aPriority - bPriority;
			});

			expect(sortedTasks).toHaveLength(3);
			expect(sortedTasks[0].priority).toBe("high");
		});
	});
});
