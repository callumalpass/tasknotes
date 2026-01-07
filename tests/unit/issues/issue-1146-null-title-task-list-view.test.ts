/**
 * Issue #1146: Title is null in Task List View
 *
 * Bug Description:
 * When creating a new task, it shows in the Task List view with the title as "null".
 * The user has to manually edit the task markdown file to add a title property.
 *
 * User's raw markdown shows no title property in frontmatter:
 * ```yaml
 * ---
 * status: open
 * priority: normal
 * scheduled: 2025-11-18
 * dateCreated: 2025-11-18T13:24:38.557-06:00
 * dateModified: 2025-11-18T13:24:38.557-06:00
 * tags:
 *   - task
 * ---
 * ```
 *
 * Root cause analysis:
 * When storeTitleInFilename=true, the title is stored in the filename and not in
 * frontmatter. The FieldMapper should fall back to the filename when:
 * 1. No title property exists in frontmatter
 * 2. The title property is null or undefined
 *
 * Additionally, there's a related issue where String(null) produces "null" (truthy)
 * instead of falling back to a default like "Untitled".
 *
 * Related issues:
 * - #1270: null columns appearing in Kanban (String(null) = "null" is truthy)
 * - #1326: Empty front-matter properties graceful handling
 * - #1434: Migration title fallback when storeTitleInFilename setting changes
 *
 * @see https://github.com/cldellow/tasknotes/issues/1146
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

describe.skip("Issue #1146: Title is null in Task List View", () => {
	let fieldMapper: FieldMapper;

	beforeEach(() => {
		fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	});

	describe("Task created with storeTitleInFilename=true", () => {
		/**
		 * When storeTitleInFilename is true and no title property exists in frontmatter,
		 * the title should be extracted from the filename.
		 */
		it("should extract title from filename when no title property in frontmatter", () => {
			const frontmatter = {
				status: "open",
				priority: "normal",
				scheduled: "2025-11-18",
				dateCreated: "2025-11-18T13:24:38.557-06:00",
				dateModified: "2025-11-18T13:24:38.557-06:00",
				tags: ["task"],
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(
				frontmatter,
				"tasks/My New Task.md",
				true // storeTitleInFilename=true
			);

			// Should extract title from filename
			expect(taskInfo.title).toBe("My New Task");
			expect(taskInfo.title).not.toBe("null");
			expect(taskInfo.title).not.toBeNull();
			expect(taskInfo.title).not.toBeUndefined();
		});

		it("should handle nested folder paths correctly", () => {
			const frontmatter = {
				status: "open",
				priority: "normal",
				tags: ["task"],
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(
				frontmatter,
				"projects/work/q1/Important Project Task.md",
				true
			);

			// Should extract just the filename without path or extension
			expect(taskInfo.title).toBe("Important Project Task");
		});

		it("should handle special characters in filename", () => {
			const frontmatter = {
				status: "open",
				tags: ["task"],
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(
				frontmatter,
				"tasks/Review PR - Add authentication.md",
				true
			);

			expect(taskInfo.title).toBe("Review PR - Add authentication");
		});
	});

	describe("String(null) producing 'null' string bug", () => {
		/**
		 * This tests the scenario where a null value gets converted to the string "null"
		 * via String(null), which is truthy and doesn't trigger fallback logic.
		 */

		function simulateTitleResolution(title: unknown): string {
			// Simulates the buggy pattern: String(title) || "Untitled"
			return String(title) || "Untitled";
		}

		function fixedTitleResolution(title: unknown): string {
			// Fixed pattern: check for null/undefined before String()
			if (title === null || title === undefined) {
				return "Untitled";
			}
			const stringValue = String(title);
			return stringValue === "" || stringValue === "null" || stringValue === "undefined"
				? "Untitled"
				: stringValue;
		}

		it("should NOT display 'null' when title is null", () => {
			const result = simulateTitleResolution(null);

			// BUG: String(null) = "null" which is truthy
			// Expected: "Untitled", Actual: "null"
			expect(result).toBe("Untitled");
			expect(result).not.toBe("null");
		});

		it("should NOT display 'undefined' when title is undefined", () => {
			const result = simulateTitleResolution(undefined);

			// BUG: String(undefined) = "undefined" which is truthy
			// Expected: "Untitled", Actual: "undefined"
			expect(result).toBe("Untitled");
			expect(result).not.toBe("undefined");
		});

		it("fixed version should handle null correctly", () => {
			expect(fixedTitleResolution(null)).toBe("Untitled");
		});

		it("fixed version should handle undefined correctly", () => {
			expect(fixedTitleResolution(undefined)).toBe("Untitled");
		});

		it("fixed version should preserve valid titles", () => {
			expect(fixedTitleResolution("My Task")).toBe("My Task");
			expect(fixedTitleResolution("Task with numbers 123")).toBe("Task with numbers 123");
		});
	});

	describe("createTaskInfoFromProperties title fallback chain", () => {
		/**
		 * Tests the fallback chain in createTaskInfoFromProperties (helpers.ts:126-130):
		 * title: props.title || basesItem.name || basesItem.path?.split("/").pop()?.replace(".md", "") || "Untitled"
		 */

		interface BasesDataItem {
			path?: string;
			name?: string;
			properties?: Record<string, any>;
		}

		function simulateTitleFallbackChain(
			props: { title?: string | null },
			basesItem: BasesDataItem
		): string {
			// Current implementation
			return (
				props.title ||
				basesItem.name ||
				basesItem.path?.split("/").pop()?.replace(".md", "") ||
				"Untitled"
			);
		}

		it("should use props.title when available", () => {
			const result = simulateTitleFallbackChain(
				{ title: "My Task Title" },
				{ path: "tasks/different-name.md" }
			);
			expect(result).toBe("My Task Title");
		});

		it("should fall back to basesItem.name when props.title is undefined", () => {
			const result = simulateTitleFallbackChain(
				{ title: undefined },
				{ path: "tasks/file.md", name: "Bases Item Name" }
			);
			expect(result).toBe("Bases Item Name");
		});

		it("should fall back to filename from path when both title and name are undefined", () => {
			const result = simulateTitleFallbackChain(
				{ title: undefined },
				{ path: "tasks/Task From Filename.md" }
			);
			expect(result).toBe("Task From Filename");
		});

		it("should return 'Untitled' when all fallbacks fail", () => {
			const result = simulateTitleFallbackChain({ title: undefined }, {});
			expect(result).toBe("Untitled");
		});

		it("BUG: should NOT return empty string when props.title is empty string", () => {
			const result = simulateTitleFallbackChain(
				{ title: "" },
				{ path: "tasks/Should Use This.md" }
			);

			// Empty string is falsy, so fallback chain continues
			// This is actually correct behavior
			expect(result).toBe("Should Use This");
		});

		it("BUG: should handle null props.title correctly", () => {
			const result = simulateTitleFallbackChain(
				{ title: null as unknown as string },
				{ path: "tasks/Fallback Title.md" }
			);

			// null is falsy, so fallback chain should continue
			expect(result).toBe("Fallback Title");
		});
	});

	describe("FieldMapper.mapFromFrontmatter edge cases", () => {
		it("should handle explicitly null title property in frontmatter", () => {
			const frontmatter = {
				title: null,
				status: "open",
				tags: ["task"],
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(
				frontmatter,
				"tasks/Title Should Be From Filename.md",
				true
			);

			// When title is null in frontmatter with storeTitleInFilename=true,
			// should fall back to filename
			expect(taskInfo.title).toBe("Title Should Be From Filename");
		});

		it("should handle title property with value 'null' string", () => {
			const frontmatter = {
				title: "null", // The actual string "null"
				status: "open",
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "tasks/other.md", false);

			// If someone intentionally sets title to the string "null", we should preserve it
			// (though this is an edge case and probably not intended)
			expect(taskInfo.title).toBe("null");
		});

		it("should handle storeTitleInFilename=false with missing title", () => {
			const frontmatter = {
				status: "open",
				priority: "normal",
				tags: ["task"],
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(
				frontmatter,
				"tasks/Some Task.md",
				false // storeTitleInFilename=false
			);

			// When storeTitleInFilename is false and no title property,
			// title should be undefined (caller handles fallback to "Untitled")
			expect(taskInfo.title).toBeUndefined();
		});
	});

	describe("Integration: Full task creation flow", () => {
		/**
		 * Simulates the complete flow from task creation to display in Task List View
		 */

		interface TaskCreationData {
			title: string;
			status?: string;
			priority?: string;
		}

		interface FrontmatterOutput {
			status: string;
			priority: string;
			tags: string[];
			// title is intentionally omitted when storeTitleInFilename=true
			title?: string;
		}

		function createTaskFrontmatter(
			data: TaskCreationData,
			storeTitleInFilename: boolean
		): FrontmatterOutput {
			const fm: FrontmatterOutput = {
				status: data.status || "open",
				priority: data.priority || "normal",
				tags: ["task"],
			};

			// Only add title to frontmatter if storeTitleInFilename is false
			if (!storeTitleInFilename) {
				fm.title = data.title;
			}

			return fm;
		}

		function getDisplayTitle(
			frontmatter: FrontmatterOutput,
			filename: string,
			storeTitleInFilename: boolean
		): string {
			// Simulate what Task List View should do
			if (frontmatter.title) {
				return frontmatter.title;
			}

			if (storeTitleInFilename) {
				// Extract from filename
				return filename.replace(".md", "");
			}

			return "Untitled";
		}

		it("should display correct title when storeTitleInFilename=true", () => {
			const taskData = { title: "Buy groceries" };
			const storeTitleInFilename = true;

			const frontmatter = createTaskFrontmatter(taskData, storeTitleInFilename);
			const filename = "Buy groceries.md";

			const displayTitle = getDisplayTitle(frontmatter, filename, storeTitleInFilename);

			// Title should NOT be "null"
			expect(displayTitle).toBe("Buy groceries");
			expect(displayTitle).not.toBe("null");
		});

		it("should display correct title when storeTitleInFilename=false", () => {
			const taskData = { title: "Buy groceries" };
			const storeTitleInFilename = false;

			const frontmatter = createTaskFrontmatter(taskData, storeTitleInFilename);
			const filename = "some-task-id.md";

			const displayTitle = getDisplayTitle(frontmatter, filename, storeTitleInFilename);

			expect(displayTitle).toBe("Buy groceries");
		});
	});
});
