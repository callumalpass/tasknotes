import { updateToNextScheduledOccurrence, getNextUncompletedOccurrence } from "../../../src/utils/helpers";
import { formatDateForStorage, parseDateToUTC, getTodayString } from "../../../src/utils/dateUtils";
import { TaskInfo } from "../../../src/types";

/**
 * Issue #1324: Skip/Unskip Instance Date Reversion Bug
 *
 * When skipping a recurring task instance, the due date and scheduled date
 * correctly advance to the next interval. However, when unskipping that
 * same instance, the dates should revert to the original dates if the
 * original due date is still in the future - but they don't.
 *
 * The same issue applies to "Mark Complete for This Date" / "Mark Incomplete".
 *
 * PROBLEM ANALYSIS:
 * The issue is in the interaction between TaskService.toggleRecurringTaskSkipped()
 * and the UI (TaskCard/CalendarView). After skipping:
 *
 * 1. User has task scheduled for "today", due "tomorrow"
 * 2. User clicks "Skip Instance" on the task
 * 3. TaskService:
 *    - Adds "today" to skipped_instances ✓
 *    - Calls updateToNextScheduledOccurrence() which returns "tomorrow"
 *    - Updates task.scheduled to "tomorrow", task.due to "day after tomorrow"
 * 4. UI shows task now scheduled for "tomorrow"
 * 5. When user opens context menu, targetDate = "tomorrow" (current scheduled date)
 * 6. User clicks "Unskip Instance"
 * 7. TaskService tries to unskip "tomorrow" but "tomorrow" was never skipped!
 *    The skipped date was "today"
 * 8. Nothing happens or wrong date is unskipped
 *
 * The core bug is that after skipping, the UI shows the NEW scheduled date,
 * but the SKIPPED date is different. There's no UI path to select the
 * originally skipped date to unskip it.
 *
 * Additionally, even if the correct date is passed to unskip, the
 * updateToNextScheduledOccurrence() is called again which finds the
 * next available date rather than reverting to the original.
 */
describe("Issue #1324: Skip/Unskip instance should properly revert dates", () => {
	// Get today and compute relative dates for tests
	const today = getTodayString();

	// Helper to add days to a date string
	const addDays = (dateStr: string, days: number): string => {
		const date = parseDateToUTC(dateStr);
		date.setUTCDate(date.getUTCDate() + days);
		return formatDateForStorage(date);
	};

	// Use dates relative to today
	const tomorrow = addDays(today, 1);
	const dayAfterTomorrow = addDays(today, 2);
	const nextWeek = addDays(today, 7);

	// Helper to create a recurring task with daily recurrence
	const makeDailyRecurringTask = (
		scheduledDate: string,
		dueDate: string
	): TaskInfo => ({
		id: "test-task",
		title: "Daily Recurring Task",
		status: "open",
		priority: "normal",
		path: "tasks/daily-task.md",
		archived: false,
		recurrence: `DTSTART:${scheduledDate.replace(/-/g, "")};RRULE:FREQ=DAILY`,
		recurrence_anchor: "scheduled",
		scheduled: scheduledDate,
		due: dueDate,
		skipped_instances: [],
		complete_instances: [],
	});

	/**
	 * Simulates the full skip -> unskip workflow as it happens in the UI
	 */
	const simulateSkipUnskipWorkflow = (
		task: TaskInfo,
		skipDate: string
	): { afterSkipTask: TaskInfo; afterUnskipTask: TaskInfo; unskipTargetDate: string } => {
		// Step 1: Skip the instance (what TaskService.toggleRecurringTaskSkipped does when skipping)
		const taskWithSkip = { ...task };
		taskWithSkip.skipped_instances = [...(task.skipped_instances || []), skipDate];

		const afterSkip = updateToNextScheduledOccurrence(taskWithSkip, true);
		taskWithSkip.scheduled = afterSkip.scheduled || taskWithSkip.scheduled;
		taskWithSkip.due = afterSkip.due || taskWithSkip.due;

		// Step 2: In the UI, the task now shows with new scheduled date
		// When user opens context menu, targetDate = task.scheduled (the new date)
		const unskipTargetDate = taskWithSkip.scheduled;

		// Step 3: User clicks "Unskip" - TaskService tries to unskip unskipTargetDate
		// This is the BUG: unskipTargetDate is the NEW scheduled date, not the skipped date
		const taskForUnskip = { ...taskWithSkip };

		// The unskip removes unskipTargetDate from skipped_instances
		// But unskipTargetDate was never in skipped_instances!
		taskForUnskip.skipped_instances = (taskForUnskip.skipped_instances || [])
			.filter(d => d !== unskipTargetDate);

		// updateToNextScheduledOccurrence is called again
		const afterUnskip = updateToNextScheduledOccurrence(taskForUnskip, true);
		taskForUnskip.scheduled = afterUnskip.scheduled || taskForUnskip.scheduled;
		taskForUnskip.due = afterUnskip.due || taskForUnskip.due;

		return {
			afterSkipTask: taskWithSkip,
			afterUnskipTask: taskForUnskip,
			unskipTargetDate
		};
	};

	describe("UI workflow bug: targetDate mismatch", () => {
		it("should demonstrate that UI passes wrong date when unskipping", () => {
			// Task scheduled for today, due tomorrow
			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			const result = simulateSkipUnskipWorkflow(task, originalScheduled);

			// After skip, scheduled is tomorrow
			expect(result.afterSkipTask.scheduled).toBe(tomorrow);
			expect(result.afterSkipTask.skipped_instances).toContain(originalScheduled);

			// BUG: The UI would pass tomorrow as the unskip target
			// But today is what's actually in skipped_instances
			expect(result.unskipTargetDate).toBe(tomorrow);
			expect(result.unskipTargetDate).not.toBe(originalScheduled);

			// After "unskip" attempt, the original date is STILL in skipped_instances
			// because we tried to unskip the wrong date!
			expect(result.afterUnskipTask.skipped_instances).toContain(originalScheduled);
		});

		it("should show that correct unskip would revert to original date", () => {
			// Same setup
			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			// Skip the task
			task.skipped_instances = [originalScheduled];
			const afterSkip = updateToNextScheduledOccurrence(task, true);
			task.scheduled = afterSkip.scheduled!;
			task.due = afterSkip.due!;

			// Now do a CORRECT unskip by using the originally skipped date
			task.skipped_instances = task.skipped_instances.filter(d => d !== originalScheduled);

			// After unskip with correct date, getNextUncompletedOccurrence should find today
			const nextOccurrence = getNextUncompletedOccurrence(task);

			// This DOES work correctly because today is no longer in skipped_instances
			// and DTSTART is today
			expect(formatDateForStorage(nextOccurrence!)).toBe(originalScheduled);

			// And updateToNextScheduledOccurrence should return today
			const afterUnskip = updateToNextScheduledOccurrence(task, true);
			expect(afterUnskip.scheduled).toBe(originalScheduled);
			expect(afterUnskip.due).toBe(originalDue);
		});
	});

	describe("Expected behavior after fix", () => {
		it("should revert scheduled/due dates when unskipping with original skipped date", () => {
			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			// Skip
			task.skipped_instances = [originalScheduled];
			const afterSkip = updateToNextScheduledOccurrence(task, true);
			expect(afterSkip.scheduled).toBe(tomorrow);
			expect(afterSkip.due).toBe(dayAfterTomorrow);

			// Update task with new dates
			task.scheduled = afterSkip.scheduled!;
			task.due = afterSkip.due!;

			// Correct unskip: remove the ORIGINAL skipped date, not the current scheduled
			task.skipped_instances = [];

			// Next occurrence should be original date
			const afterUnskip = updateToNextScheduledOccurrence(task, true);
			expect(afterUnskip.scheduled).toBe(originalScheduled);
			expect(afterUnskip.due).toBe(originalDue);
		});

		it("should handle tasks with large due date offset", () => {
			// From issue: "Due Date is a week after its Scheduled Date"
			const scheduledToday = today;
			const dueNextWeek = nextWeek;

			const task: TaskInfo = {
				id: "test-task",
				title: "Task with long due offset",
				status: "open",
				priority: "normal",
				path: "tasks/long-offset.md",
				archived: false,
				recurrence: `DTSTART:${scheduledToday.replace(/-/g, "")};RRULE:FREQ=DAILY`,
				recurrence_anchor: "scheduled",
				scheduled: scheduledToday,
				due: dueNextWeek,
				skipped_instances: [],
				complete_instances: [],
			};

			// Skip
			task.skipped_instances = [scheduledToday];
			const afterSkip = updateToNextScheduledOccurrence(task, true);

			// Due maintains 7-day offset
			expect(afterSkip.scheduled).toBe(tomorrow);
			expect(afterSkip.due).toBe(addDays(tomorrow, 7));

			// Correct unskip
			task.scheduled = afterSkip.scheduled!;
			task.due = afterSkip.due!;
			task.skipped_instances = [];

			const afterUnskip = updateToNextScheduledOccurrence(task, true);
			expect(afterUnskip.scheduled).toBe(scheduledToday);
			expect(afterUnskip.due).toBe(dueNextWeek);
		});
	});

	describe("Complete/Incomplete has same issue", () => {
		it("should demonstrate same targetDate mismatch for mark incomplete", () => {
			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			// Mark complete for today
			task.complete_instances = [originalScheduled];
			const afterComplete = updateToNextScheduledOccurrence(task, true);
			task.scheduled = afterComplete.scheduled!;
			task.due = afterComplete.due!;

			// Task now shows scheduled for tomorrow
			expect(task.scheduled).toBe(tomorrow);

			// UI would pass tomorrow as target date for "mark incomplete"
			// But today is what's in complete_instances
			const uiTargetDate = task.scheduled; // This is wrong!
			expect(uiTargetDate).not.toBe(originalScheduled);

			// Trying to mark incomplete for the wrong date
			task.complete_instances = task.complete_instances.filter(d => d !== uiTargetDate);

			// Original date is STILL in complete_instances
			expect(task.complete_instances).toContain(originalScheduled);
		});
	});

	describe("Baseline behavior tests", () => {
		it("should correctly maintain offset when not skipped", () => {
			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			task.skipped_instances = [];

			const result = updateToNextScheduledOccurrence(task, true);

			expect(result.scheduled).toBe(originalScheduled);
			expect(result.due).toBe(originalDue);
		});

		it("should NOT revert to past dates", () => {
			const pastScheduled = "2020-01-01";
			const pastDue = "2020-01-02";
			const task = makeDailyRecurringTask(pastScheduled, pastDue);
			task.skipped_instances = [];

			const result = updateToNextScheduledOccurrence(task, true);

			// Should advance to today, not go back to 2020
			expect(result.scheduled).not.toBe(pastScheduled);
			expect(result.scheduled).toBe(today);
		});
	});

	/**
	 * Tests for expected behavior that the fix should implement
	 *
	 * The fix should make the UI/service smart enough to:
	 * 1. Show "Unskip Instance" for the SKIPPED date, not the current scheduled date
	 * 2. OR: When unskipping, look at skipped_instances to find the right date to unskip
	 * 3. OR: Store the pre-skip scheduled/due dates and restore them on unskip
	 */
	describe("Expected unskip behavior via context menu", () => {
		it("context menu currently fails to identify prior skipped occurrences", () => {
			// This tests what the context menu CURRENTLY does (which is wrong)
			// After skipping today, the task shows scheduled for tomorrow
			// The context menu checks if TOMORROW is skipped (which it isn't)
			// So it doesn't offer the "Unskip" option properly

			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			// Skip today
			task.skipped_instances = [originalScheduled];
			const afterSkip = updateToNextScheduledOccurrence(task, true);
			task.scheduled = afterSkip.scheduled!;
			task.due = afterSkip.due!;

			// Current scheduled date is tomorrow
			expect(task.scheduled).toBe(tomorrow);

			// Current context menu logic (from TaskContextMenu.ts:87):
			// const dateStr = formatDateForStorage(this.options.targetDate);
			// const isSkippedForDate = task.skipped_instances?.includes(dateStr) || false;
			//
			// When targetDate = tomorrow (the current scheduled), this is FALSE
			// because tomorrow was never skipped - today was!
			const targetDateFromUI = task.scheduled; // tomorrow
			const isSkippedForDate = task.skipped_instances?.includes(targetDateFromUI) || false;

			// This is FALSE, which is why "Unskip Instance" doesn't work correctly
			expect(isSkippedForDate).toBe(false);

			// But there IS a skipped occurrence before the current scheduled date
			const hasSkippedBeforeScheduled = (task.skipped_instances || []).some(skippedDate => {
				return skippedDate < task.scheduled;
			});
			expect(hasSkippedBeforeScheduled).toBe(true);
		});

		it("simulated UI unskip workflow fails to revert dates", () => {
			// This simulates the full buggy workflow
			const originalScheduled = today;
			const originalDue = tomorrow;
			const task = makeDailyRecurringTask(originalScheduled, originalDue);

			// Step 1: Skip today
			task.skipped_instances = [originalScheduled];
			const afterSkip = updateToNextScheduledOccurrence(task, true);
			task.scheduled = afterSkip.scheduled!;
			task.due = afterSkip.due!;

			expect(task.scheduled).toBe(tomorrow);
			expect(task.due).toBe(dayAfterTomorrow);

			// Step 2: User tries to "unskip" but UI passes wrong targetDate
			const targetDateFromUI = task.scheduled; // tomorrow - WRONG!

			// This simulates what toggleRecurringTaskSkipped does:
			// It removes targetDateFromUI from skipped_instances
			task.skipped_instances = task.skipped_instances.filter(d => d !== targetDateFromUI);

			// But tomorrow was never in skipped_instances! Original is still there
			expect(task.skipped_instances).toContain(originalScheduled);
			expect(task.skipped_instances.length).toBe(1); // Still has 1 skipped

			// When updateToNextScheduledOccurrence is called, it still skips today
			const afterUnskip = updateToNextScheduledOccurrence(task, true);

			// BUG DEMONSTRATION: dates don't revert because wrong date was unskipped
			expect(afterUnskip.scheduled).toBe(tomorrow); // Still tomorrow, not today!
			expect(afterUnskip.due).toBe(dayAfterTomorrow); // Still day after tomorrow

			// Expected (after fix): should be original dates
			// expect(afterUnskip.scheduled).toBe(originalScheduled);
			// expect(afterUnskip.due).toBe(originalDue);
		});
	});
});
