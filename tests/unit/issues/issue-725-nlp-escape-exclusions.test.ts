import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { StatusConfig, PriorityConfig } from "../../../src/types";
import { ChronoTestUtils } from "../../__mocks__/chrono-node";

/**
 * Issue #725: Natural Language Processing Exclusions
 *
 * Users want a way to prevent certain words from being processed as dates
 * when using natural language input. For example, typing "Something Today"
 * should preserve "Today" as literal text rather than converting it to
 * today's date.
 *
 * CURRENT BEHAVIOR:
 * - Input: "Something Today"
 * - Result: Title becomes "Something" with due/scheduled date set to today's date
 * - The word "Today" is consumed by the NLP date parser
 *
 * EXPECTED BEHAVIOR (after fix):
 * - Users should be able to escape or quote words to prevent NLP processing
 * - Common escape mechanisms that could be considered:
 *   - Backticks: `today` - preserves the literal text
 *   - Single quotes: 'today' - preserves the literal text
 *   - Double quotes: "today" - preserves the literal text
 *   - Backslash: \today - escapes the word
 *
 * The user specifically mentioned trying single and double quotes but
 * these are not currently recognized as escape mechanisms.
 *
 * RELEVANT CODE:
 * - NaturalLanguageParser.ts - Main parser class
 * - parseUnifiedDatesAndTimes() - Uses chrono-node to extract dates
 * - chrono-node library parses natural language like "today", "tomorrow", etc.
 *
 * USE CASE EXAMPLES:
 * - "Schedule Today meeting" - User wants a task titled "Schedule Today meeting"
 * - "Review 'Today is the Day' book" - User wants to reference a book title
 * - "Send email about Tomorrow's Deadline" - "Tomorrow's Deadline" is a project name
 *
 * @see https://github.com/wealthychef1/tasknotes/issues/725
 */
describe("Issue #725: NLP escape/exclusion mechanism for date words", () => {
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

	describe("Backtick escape mechanism", () => {
		it.skip("reproduces issue #725: should preserve backtick-quoted 'today' as literal text", () => {
			// User input: "Something `today`"
			// Expected: Title = "Something today", no date extracted
			const input = "Something `today`";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Something today");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should preserve backtick-quoted 'tomorrow' as literal text", () => {
			const input = "Read `tomorrow` magazine issue";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Read tomorrow magazine issue");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should still parse unquoted dates normally", () => {
			// Mixed case: some words escaped, others parsed
			const input = "Review `today` article due tomorrow";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Review today article");
			expect(result.dueDate).toBeDefined(); // "tomorrow" should be parsed
		});
	});

	describe("Single quote escape mechanism", () => {
		it.skip("reproduces issue #725: should preserve single-quoted 'today' as literal text", () => {
			// This is what the user specifically tried according to the issue
			const input = "Something 'Today'";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Something Today");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should preserve single-quoted multi-word phrases", () => {
			const input = "Review 'Today is the Day' book";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Review Today is the Day book");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});
	});

	describe("Double quote escape mechanism", () => {
		it.skip("reproduces issue #725: should preserve double-quoted 'today' as literal text", () => {
			// This is what the user specifically tried according to the issue
			const input = 'Something "Today"';

			const result = parser.parseInput(input);

			expect(result.title).toBe("Something Today");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should preserve double-quoted phrases with date words", () => {
			const input = 'Discuss "Tomorrow Never Dies" movie';

			const result = parser.parseInput(input);

			expect(result.title).toBe("Discuss Tomorrow Never Dies movie");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});
	});

	describe("Real-world use cases from issue #725", () => {
		it.skip("reproduces issue #725: 'Something Today' without quotes parses Today as date (current behavior)", () => {
			// This documents the CURRENT behavior that the user finds problematic
			const input = "Something Today";

			const result = parser.parseInput(input);

			// Current behavior: "Today" is parsed as a date
			// This test documents the issue - Today gets consumed
			expect(result.title).toBe("Something");
			expect(result.scheduledDate).toBeDefined(); // defaultToScheduled is true
		});

		it.skip("reproduces issue #725: user should be able to create task titled 'Something Today'", () => {
			// Using some escape mechanism (backticks in this example)
			const input = "Something `Today`";

			const result = parser.parseInput(input);

			// Expected behavior after fix
			expect(result.title).toBe("Something Today");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: project names containing date words", () => {
			// Common use case: project or entity names containing "Today", "Tomorrow", etc.
			const input = "Update `Today Show` segment notes";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Update Today Show segment notes");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: book/movie titles with date words", () => {
			const input = "Watch `Tomorrow When the War Began`";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Watch Tomorrow When the War Began");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});
	});

	describe("Edge cases for escape mechanism", () => {
		it.skip("reproduces issue #725: should handle escaped word at start of input", () => {
			const input = "`Today` is a good day for coding";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Today is a good day for coding");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should handle escaped word at end of input", () => {
			const input = "The meeting is called `Today`";

			const result = parser.parseInput(input);

			expect(result.title).toBe("The meeting is called Today");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should handle multiple escaped words", () => {
			const input = "`Today` and `tomorrow` are important";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Today and tomorrow are important");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: escape should not affect other NLP features", () => {
			// Tags, priorities, etc. should still work
			const input = "Read `Today` magazine #reading !high";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Read Today magazine");
			expect(result.tags).toContain("reading");
			expect(result.priority).toBe("high");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: should work with explicit date triggers alongside escaped words", () => {
			// User wants to reference "Today" literally but also set an actual due date
			const input = "Review `Today` article due next week";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Review Today article");
			expect(result.dueDate).toBeDefined(); // "next week" should still be parsed
		});
	});

	describe("Compatibility with existing features", () => {
		it.skip("reproduces issue #725: escaped text should work with tags and contexts", () => {
			const input = "Discuss `Tomorrow` plan #work @office";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Discuss Tomorrow plan");
			expect(result.tags).toContain("work");
			expect(result.contexts).toContain("office");
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: escaped text should work with recurrence patterns", () => {
			const input = "Read `Today` magazine every week";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Read Today magazine");
			expect(result.recurrence).toBeDefined();
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});

		it.skip("reproduces issue #725: escaped text should work with time estimates", () => {
			const input = "Write `Today` report 2h";

			const result = parser.parseInput(input);

			expect(result.title).toBe("Write Today report");
			expect(result.estimate).toBe(120); // 2 hours = 120 minutes
			expect(result.dueDate).toBeUndefined();
			expect(result.scheduledDate).toBeUndefined();
		});
	});
});
