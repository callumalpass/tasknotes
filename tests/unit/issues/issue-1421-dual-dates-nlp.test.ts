import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { StatusConfig, PriorityConfig } from "../../../src/types";
import { ChronoTestUtils } from "../../__mocks__/chrono-node";

/**
 * Issue #1421: Cannot set both Due and Scheduled dates using natural language
 *
 * When entering text like "create a note scheduled for Jan 9 due Jan 9" in the
 * New Task dialog, the natural language parser only captures one of the dates.
 * The parser correctly recognizes both "scheduled" and "due" triggers, but
 * returns early after processing the first one, discarding the second.
 *
 * ROOT CAUSE:
 * In NaturalLanguageParser.parseUnifiedDatesAndTimes() (line ~749), there is an
 * early return statement after processing the first explicit trigger match:
 *
 *   return workingText; // Early return after finding explicit trigger
 *
 * This means if the input contains both "scheduled for <date>" and "due <date>",
 * only the first trigger encountered in the loop is processed.
 *
 * EXPECTED BEHAVIOR:
 * Both date triggers should be processed, allowing users to set both scheduled
 * and due dates in a single natural language input.
 *
 * REPRODUCTION:
 * 1. Open New Task dialog
 * 2. Type "Task scheduled for Jan 9 due Jan 10"
 * 3. Observe that only one date field is populated in the preview
 *
 * @see https://github.com/wealthychef1/tasknotes/issues/1421
 */
describe("Issue #1421: Setting both due and scheduled dates via natural language", () => {
	let parser: NaturalLanguageParser;
	let mockStatusConfigs: StatusConfig[];
	let mockPriorityConfigs: PriorityConfig[];

	beforeEach(() => {
		jest.clearAllMocks();
		ChronoTestUtils.reset();

		mockStatusConfigs = [
			{ id: "open", value: "open", label: "Open", color: "#blue", isCompleted: false, order: 1 },
			{ id: "done", value: "done", label: "Done", color: "#green", isCompleted: true, order: 2 },
		];

		mockPriorityConfigs = [
			{ id: "normal", value: "normal", label: "Normal", color: "#blue", weight: 5 },
		];

		parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true);
	});

	describe("Dual date extraction", () => {
		it.skip("should extract both scheduled and due dates when both are specified", () => {
			// This test documents the bug - it should pass once fixed
			const input = "Task scheduled for tomorrow due next week";

			const result = parser.parseInput(input);

			// Currently fails: only scheduledDate is set because of early return
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.title).toBe("Task");
		});

		it.skip("should handle due before scheduled in input order", () => {
			// Testing the reverse order to ensure both triggers work regardless of order
			const input = "Task due next week scheduled for tomorrow";

			const result = parser.parseInput(input);

			// Currently fails: only dueDate is set because "due" trigger is first in array
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.title).toBe("Task");
		});

		it.skip("should extract both dates with times when specified", () => {
			// Extended case with times
			const input = "Meeting scheduled for tomorrow at 9am due tomorrow at 5pm";

			const result = parser.parseInput(input);

			// Should have both dates and times
			expect(result.scheduledDate).toBeDefined();
			expect(result.scheduledTime).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.dueTime).toBeDefined();
		});

		it.skip("should handle same date for both scheduled and due", () => {
			// The exact scenario from the issue report
			const input = "Task scheduled for Jan 9 due Jan 9";

			const result = parser.parseInput(input);

			// Both should be set to the same date
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.scheduledDate).toBe(result.dueDate);
		});

		it.skip("should properly clean title after extracting both dates", () => {
			// Ensure the title is properly cleaned of both date expressions
			const input = "Complete report scheduled for tomorrow due next week #work";

			const result = parser.parseInput(input);

			// Title should not contain date expressions
			expect(result.title).toBe("Complete report");
			expect(result.tags).toContain("work");
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});
	});

	describe("Single date extraction (existing behavior)", () => {
		it("should still work with only scheduled date", () => {
			const input = "Task scheduled for tomorrow";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeUndefined();
		});

		it("should still work with only due date", () => {
			const input = "Task due tomorrow";

			const result = parser.parseInput(input);

			expect(result.dueDate).toBeDefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it("should use defaultToScheduled when no explicit trigger", () => {
			const input = "Task tomorrow";

			const result = parser.parseInput(input);

			// defaultToScheduled is true in our test setup
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeUndefined();
		});
	});

	describe("Edge cases", () => {
		it.skip("should handle multiple date formats in dual date input", () => {
			// Different date formats for each trigger
			const input = "Project scheduled for 2025-01-15 due 2025-01-20";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBe("2025-01-15");
			expect(result.dueDate).toBe("2025-01-20");
		});

		it.skip("should preserve tags and contexts with dual dates", () => {
			const input = "Task scheduled for tomorrow due next week #urgent @home +project";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.tags).toContain("urgent");
			expect(result.contexts).toContain("home");
			expect(result.projects).toContain("project");
		});

		it.skip("should handle alternative trigger words for both dates", () => {
			// Using alternative trigger words
			const input = "Task on tomorrow deadline next week";

			const result = parser.parseInput(input);

			// "on" is a scheduled trigger, "deadline" is a due trigger
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});
	});
});
