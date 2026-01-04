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
 * TRIGGER LOOP ORDER:
 * The triggerPatterns array (lines 701-716) is ordered as ["due", "scheduled"].
 * This means "due" triggers are always checked first, regardless of their
 * position in the input text. So even if user types "scheduled for Jan 9 due Jan 10",
 * the parser finds the "due" match first and returns early.
 *
 * RELEVANT SETTINGS:
 * - nlpDefaultToScheduled (boolean): When no explicit trigger is found, determines
 *   whether dates default to scheduledDate (true) or dueDate (false). This setting
 *   is correctly handled for single-date inputs but is irrelevant for the bug since
 *   explicit triggers are present.
 * - nlpLanguage (string): Determines which locale's dateTriggers are used.
 *   English triggers are: due: ["due", "deadline", "must be done by", "by"]
 *                         scheduled: ["scheduled for", "start on", "begin on", "work on", "on"]
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
		it("should extract both scheduled and due dates when both are specified", () => {
			const input = "Task scheduled for tomorrow due next week";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.title).toBe("Task");
		});

		it("should handle due before scheduled in input order", () => {
			// Testing the reverse order to ensure both triggers work regardless of order
			const input = "Task due next week scheduled for tomorrow";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.title).toBe("Task");
		});

		it("should extract both dates with times when specified", () => {
			// Extended case with times
			const input = "Meeting scheduled for tomorrow at 9am due tomorrow at 5pm";

			const result = parser.parseInput(input);

			// Should have both dates and times
			expect(result.scheduledDate).toBeDefined();
			expect(result.scheduledTime).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.dueTime).toBeDefined();
		});

		it("should handle same date for both scheduled and due", () => {
			// The exact scenario from the issue report
			const input = "Task scheduled for Jan 9 due Jan 9";

			const result = parser.parseInput(input);

			// Both should be set to the same date
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.scheduledDate).toBe(result.dueDate);
		});

		it("should properly clean title after extracting both dates", () => {
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
		it("should handle multiple date formats in dual date input", () => {
			// Different date formats for each trigger
			const input = "Project scheduled for 2025-01-15 due 2025-01-20";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBe("2025-01-15");
			expect(result.dueDate).toBe("2025-01-20");
		});

		it("should preserve tags and contexts with dual dates", () => {
			const input = "Task scheduled for tomorrow due next week #urgent @home +project";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.tags).toContain("urgent");
			expect(result.contexts).toContain("home");
			expect(result.projects).toContain("project");
		});

		it("should handle alternative trigger words for both dates", () => {
			// Using alternative trigger words
			const input = "Task on tomorrow deadline next week";

			const result = parser.parseInput(input);

			// "on" is a scheduled trigger, "deadline" is a due trigger
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});
	});

	describe("Settings interaction (nlpDefaultToScheduled)", () => {
		it("should respect nlpDefaultToScheduled=true for single implicit date", () => {
			// With defaultToScheduled=true (default in our setup)
			const input = "Task tomorrow";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeUndefined();
		});

		it("should respect nlpDefaultToScheduled=false for single implicit date", () => {
			// Create parser with defaultToScheduled=false
			const parserDueDefault = new NaturalLanguageParser(
				mockStatusConfigs,
				mockPriorityConfigs,
				false // defaultToScheduled = false
			);

			const input = "Task tomorrow";
			const result = parserDueDefault.parseInput(input);

			expect(result.dueDate).toBeDefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it("should ignore nlpDefaultToScheduled when both explicit triggers present", () => {
			// When explicit triggers are used, the setting should be irrelevant
			// because we're explicitly specifying both dates
			const parserDueDefault = new NaturalLanguageParser(
				mockStatusConfigs,
				mockPriorityConfigs,
				false // defaultToScheduled = false
			);

			const input = "Task scheduled for tomorrow due next week";
			const result = parserDueDefault.parseInput(input);

			// Both should be set regardless of default setting
			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});
	});

	describe("Trigger processing order", () => {
		it("should process both triggers regardless of input order - scheduled first", () => {
			// User puts scheduled before due in their input
			const input = "Task scheduled for tomorrow due next week";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should process both triggers regardless of input order - due first", () => {
			// User puts due before scheduled in their input
			const input = "Task due next week scheduled for tomorrow";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("confirms fix: both scheduled and due are captured", () => {
			// This test confirms the fix for Issue #1421
			const input = "Task scheduled for tomorrow due next week";
			const result = parser.parseInput(input);

			// Both dates should now be captured correctly
			expect(result.dueDate).toBeDefined();
			expect(result.scheduledDate).toBeDefined();
		});
	});

	describe("Alternative trigger words", () => {
		it("should handle 'deadline' trigger for due date with explicit scheduled", () => {
			const input = "Task scheduled for tomorrow deadline next week";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should handle 'by' trigger for due date with explicit scheduled", () => {
			const input = "Task scheduled for tomorrow by next week";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should handle 'start on' trigger for scheduled with explicit due", () => {
			const input = "Task start on tomorrow due next week";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should handle 'work on' trigger for scheduled with explicit due", () => {
			const input = "Task work on tomorrow due next week";
			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});
	});
});
