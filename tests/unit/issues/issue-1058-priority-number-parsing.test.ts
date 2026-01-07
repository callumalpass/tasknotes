/**
 * Test for Issue #1058: Priority parsing only works when the property is set to text
 *
 * From GitHub issue: https://github.com/callumalpass/tasknotes/issues/1058
 *
 * User report: "I'd like to use numbers to model priorities (from 3 to -3),
 * but the plugin only recognizes the task priority if it's configured as text type
 * which means I currently need to encode the numbers like this:
 * ```yaml
 * priority: "1"
 * ```"
 *
 * The issue is that when Obsidian's property type is set to "Number", the priority
 * value comes through as an actual number (e.g., 1) rather than a string ("1").
 * The FieldMapper.mapFromFrontmatter() method doesn't convert numeric priority
 * values to strings for internal use, unlike how it handles boolean status values.
 *
 * Root cause: In FieldMapper.ts line 75-77, priority is assigned directly without
 * type conversion. Compare this to status handling (lines 65-73) which explicitly
 * converts boolean values to strings.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1058
 */

import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

describe("Issue #1058 - Priority parsing only works with text type", () => {
	let fieldMapper: FieldMapper;

	beforeEach(() => {
		fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	});

	describe("mapFromFrontmatter - reading numeric priority values", () => {
		/**
		 * This test reproduces the exact scenario from issue #1058:
		 * When Obsidian's property type is set to "Number", the priority value
		 * comes through as an actual JavaScript number, not a string.
		 *
		 * Expected behavior: The FieldMapper should convert the number to a string
		 * for internal use, similar to how boolean status values are converted.
		 *
		 * Current behavior (BUG): The priority is stored as-is (number type),
		 * which causes downstream issues since the plugin expects string priorities.
		 */
		it.skip("reproduces issue #1058 - should convert numeric priority to string", () => {
			const frontmatter = {
				title: "Test Task",
				priority: 1, // Number type (as Obsidian provides when property type is "Number")
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			// Internal representation should always be string
			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("1");
		});

		/**
		 * Test the user's specific use case from the issue: using numbers from 3 to -3
		 */
		it.skip("reproduces issue #1058 - should handle positive priority numbers (user wants 3 to -3 range)", () => {
			const frontmatter = {
				title: "High Priority Task",
				priority: 3, // Highest priority in user's schema
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("3");
		});

		/**
		 * Test negative priority values (user's use case: -3 to 3 range)
		 */
		it.skip("reproduces issue #1058 - should handle negative priority numbers", () => {
			const frontmatter = {
				title: "Low Priority Task",
				priority: -3, // Lowest priority in user's schema
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("-3");
		});

		/**
		 * Test zero priority value
		 */
		it.skip("reproduces issue #1058 - should handle zero priority", () => {
			const frontmatter = {
				title: "Normal Priority Task",
				priority: 0, // Middle priority in user's schema
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("0");
		});

		/**
		 * Test decimal/floating point priority values
		 */
		it.skip("reproduces issue #1058 - should handle decimal priority numbers", () => {
			const frontmatter = {
				title: "Task with decimal priority",
				priority: 1.5,
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("1.5");
		});

		/**
		 * Ensure string priorities still work (backwards compatibility)
		 */
		it("should continue to handle string priority values correctly", () => {
			const frontmatter = {
				title: "Test Task",
				priority: "high", // String type
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("high");
		});

		/**
		 * Ensure quoted numeric strings still work (user's current workaround)
		 */
		it("should handle quoted numeric strings (user workaround) correctly", () => {
			const frontmatter = {
				title: "Test Task",
				priority: "1", // String "1" (user's current workaround)
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			expect(typeof taskInfo.priority).toBe("string");
			expect(taskInfo.priority).toBe("1");
		});
	});

	describe("comparison with status handling", () => {
		/**
		 * This test demonstrates how status already handles type conversion correctly.
		 * Priority should follow the same pattern.
		 */
		it("status correctly converts boolean values to strings (reference implementation)", () => {
			const frontmatter = {
				title: "Test Task",
				status: true, // Boolean (like when Obsidian checkbox property)
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, "test-task.md");

			// Status converts booleans to strings - priority should do the same for numbers
			expect(typeof taskInfo.status).toBe("string");
			expect(taskInfo.status).toBe("true");
		});
	});
});
