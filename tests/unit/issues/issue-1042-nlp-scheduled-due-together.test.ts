import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { StatusConfig, PriorityConfig } from "../../../src/types";
import { ChronoTestUtils } from "../../__mocks__/chrono-node";

/**
 * Issue #1042: NLP doesn't handle scheduled and due information together
 *
 * When entering task text with both scheduled date/time and due date/time,
 * the NLP parser forgets the scheduled information when due date is added.
 *
 * REPRODUCTION:
 * 1. Enter task with scheduled date/time: "Task scheduled for tomorrow at 9am"
 * 2. Add due date information: "Task scheduled for tomorrow at 9am due next week"
 * 3. Observe that scheduled information is forgotten - only due date is captured
 *
 * This issue is closely related to Issue #1421 (cannot set both due and scheduled
 * dates using natural language). The underlying cause is the same - the parser
 * returns early after processing the first explicit trigger.
 *
 * ROOT CAUSE (from #1421):
 * In NaturalLanguageParser.parseUnifiedDatesAndTimes(), the early return statement
 * after processing the first explicit trigger match prevents both date types from
 * being captured.
 *
 * EXPECTED BEHAVIOR:
 * Both scheduled and due dates/times should be correctly parsed when the user
 * enters both in the natural language input.
 *
 * @see https://github.com/wealthychef1/tasknotes/issues/1042
 * @see https://github.com/wealthychef1/tasknotes/issues/1421 (related issue)
 */
describe("Issue #1042: NLP doesn't handle scheduled and due information together", () => {
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

	describe("Exact reproduction from issue report", () => {
		it("reproduces issue #1042 - scheduled info forgotten when due date added", () => {
			// Step 1: User enters task with scheduled date/time
			const step1Input = "Task scheduled for tomorrow at 9am";
			const step1Result = parser.parseInput(step1Input);

			// Verify scheduled date is captured
			expect(step1Result.scheduledDate).toBeDefined();
			expect(step1Result.title).toBe("Task");

			// Step 2: User adds due date information
			const step2Input = "Task scheduled for tomorrow at 9am due next week";
			const step2Result = parser.parseInput(step2Input);

			// BUG: Scheduled information should NOT be forgotten after adding due date
			expect(step2Result.scheduledDate).toBeDefined();
			expect(step2Result.dueDate).toBeDefined();
			expect(step2Result.title).toBe("Task");
		});

		it("reproduces issue #1042 - both dates with times should be captured", () => {
			// User enters both scheduled and due with times
			const input = "Meeting scheduled for tomorrow at 9am due tomorrow at 5pm";

			const result = parser.parseInput(input);

			// Both dates and times should be captured
			expect(result.scheduledDate).toBeDefined();
			expect(result.scheduledTime).toBe("09:00");
			expect(result.dueDate).toBeDefined();
			expect(result.dueTime).toBe("17:00");
			expect(result.title).toBe("Meeting");
		});
	});

	describe("Incremental input scenarios", () => {
		it("should preserve scheduled info when incrementally adding due date", () => {
			// Simulates user typing step by step as seen in the issue screenshots
			const incrementalInputs = [
				"Task",
				"Task scheduled",
				"Task scheduled for tomorrow",
				"Task scheduled for tomorrow at 9am",
				"Task scheduled for tomorrow at 9am due",
				"Task scheduled for tomorrow at 9am due next week",
			];

			// Final input should have both dates
			const finalInput = incrementalInputs[incrementalInputs.length - 1];
			const result = parser.parseInput(finalInput);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should handle reverse order - due entered first, then scheduled", () => {
			const input = "Task due next week scheduled for tomorrow at 9am";

			const result = parser.parseInput(input);

			expect(result.dueDate).toBeDefined();
			expect(result.scheduledDate).toBeDefined();
			expect(result.scheduledTime).toBe("09:00");
		});
	});

	describe("Preview data verification", () => {
		it("preview should show both scheduled and due dates", () => {
			const input = "Task scheduled for tomorrow at 9am due next week";
			const parsed = parser.parseInput(input);
			const previewData = parser.getPreviewData(parsed);

			// Preview should contain both scheduled and due items
			const hasScheduledPreview = previewData.some((item) =>
				item.text.toLowerCase().includes("scheduled")
			);
			const hasDuePreview = previewData.some((item) =>
				item.text.toLowerCase().includes("due")
			);

			expect(hasScheduledPreview).toBe(true);
			expect(hasDuePreview).toBe(true);
		});
	});

	describe("Edge cases from issue", () => {
		it("should handle scheduled date/time before due date/time", () => {
			// Pattern from issue screenshots - using mock-supported date format
			const input = "Task scheduled for tomorrow at 9am due next week";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.scheduledTime).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should handle alternative scheduled triggers with due", () => {
			// "start on" is an alternative trigger for scheduled
			const input = "Task start on tomorrow due next week";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});

		it("should handle 'on' trigger for scheduled with 'deadline' for due", () => {
			// Testing alternative trigger words
			const input = "Task on tomorrow deadline next week";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
		});
	});

	describe("Title cleanup with dual dates", () => {
		it("should properly clean title when both dates are extracted", () => {
			const input = "Complete the report scheduled for tomorrow at 9am due next week";

			const result = parser.parseInput(input);

			// Title should not contain date expressions
			expect(result.title).toBe("Complete the report");
			expect(result.title).not.toContain("scheduled");
			expect(result.title).not.toContain("due");
			expect(result.title).not.toContain("tomorrow");
			expect(result.title).not.toContain("next week");
		});
	});

	describe("Preserving other metadata with dual dates", () => {
		it("should preserve tags, contexts, and projects with both dates", () => {
			const input =
				"Task scheduled for tomorrow due next week #urgent @home +project";

			const result = parser.parseInput(input);

			expect(result.scheduledDate).toBeDefined();
			expect(result.dueDate).toBeDefined();
			expect(result.tags).toContain("urgent");
			expect(result.contexts).toContain("home");
			expect(result.projects).toContain("project");
		});
	});
});
