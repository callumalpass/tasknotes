/**
 * Skipped tests for Issue #1594: Completing a repeating task that's overdue doesn't work from the note
 *
 * Bug Description:
 * When marking a repeating task as "done" on a date that's after when it was due,
 * the wrong completion date is attributed, making calendar view cumbersome to use.
 *
 * Two scenarios reported:
 *
 * 1. Marking an overdue recurring task as "done" from the current date:
 *    - Task is scheduled for Jan 9, user completes it on Jan 12
 *    - The completion is recorded for Jan 12 (current date), not Jan 9 (scheduled date)
 *    - This causes the next occurrence to jump forward, skipping days in between
 *
 * 2. Clicking on a past occurrence in calendar view and clicking "Done" from its note:
 *    - User clicks on the Jan 9 occurrence in calendar
 *    - Opens the task note
 *    - Clicks "Done" from the note view
 *    - The task is marked as "Done" entirely (status change), not for the occurrence
 *    - The instance completion doesn't happen correctly
 *
 * Root Cause Analysis:
 * - Scenario 1: toggleRecurringTaskComplete() defaults to today's date when no explicit
 *   date is passed. When completing an overdue task, it should detect the overdue state
 *   and complete the scheduled date instead.
 *
 * - Scenario 2: When opening a task note from a calendar occurrence, the occurrence date
 *   context is lost. The note view's "Done" button triggers a status change (updateProperty)
 *   instead of toggleRecurringTaskComplete with the correct target date.
 *
 * Related Issues: #936, #925, #314
 *
 * Related Code:
 * - src/services/TaskService.ts: toggleRecurringTaskComplete() lines 1818-2011
 * - src/services/TaskService.ts: updateProperty() lines 687-900
 * - src/bases/CalendarView.ts: handleEventClick() lines 1147-1186
 * - src/bases/calendar-core.ts: getTargetDateForEvent() lines 339-367
 * - src/components/TaskContextMenu.ts: lines 56-87
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
	formatDateForStorage,
	createUTCDateFromLocalCalendarDate,
	parseDateToUTC,
	getTodayString,
	getTodayLocal,
} from "../../../src/utils/dateUtils";
import {
	getNextUncompletedOccurrence,
	updateToNextScheduledOccurrence,
	getEffectiveTaskStatus,
} from "../../../src/utils/helpers";
import { TaskInfo } from "../../../src/types";

describe("Issue #1594: Completing an overdue repeating task from the note", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		// Set system time to January 12, 2025, 12:00 UTC
		// This matches the user's scenario where they complete on Jan 12 a task due on Jan 9
		jest.setSystemTime(new Date(Date.UTC(2025, 0, 12, 12, 0, 0)));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("Scenario 1: Completing overdue task attributes wrong completion date", () => {
		it.skip("reproduces issue #1594 - completing 3-day overdue task should complete the scheduled date, not today", () => {
			// Reproduces issue #1594
			// Today is Jan 12, 2025
			// Task was scheduled for Jan 9, 2025 (3 days overdue)
			// User clicks "complete" on the task

			const today = new Date(Date.UTC(2025, 0, 12));
			const scheduledDate = new Date(Date.UTC(2025, 0, 9)); // 3 days ago
			const todayStr = formatDateForStorage(today);
			const scheduledStr = formatDateForStorage(scheduledDate);

			const overdueTask: TaskInfo = {
				title: "Weekly review",
				status: " ",
				path: "tasks/weekly-review.md",
				scheduled: scheduledStr, // Jan 9 - overdue!
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// CURRENT BEHAVIOR (BUG):
			// toggleRecurringTaskComplete uses today's date (Jan 12) for completion
			// This marks Jan 12 as complete, but the task was scheduled for Jan 9
			const buggyCompleteInstances = [todayStr]; // Jan 12
			const buggyTask = {
				...overdueTask,
				complete_instances: buggyCompleteInstances,
			};
			const buggyNextOccurrence = getNextUncompletedOccurrence(buggyTask);

			// BUG: Next occurrence skips Jan 10, 11, 12 and goes to Jan 13
			expect(formatDateForStorage(buggyNextOccurrence!)).toBe("2025-01-13");

			// EXPECTED BEHAVIOR:
			// Should complete Jan 9 (the overdue scheduled instance)
			// Then next uncompleted occurrence should be Jan 10
			const correctCompleteInstances = [scheduledStr]; // Jan 9
			const correctTask = {
				...overdueTask,
				complete_instances: correctCompleteInstances,
			};
			const correctNextOccurrence = getNextUncompletedOccurrence(correctTask);

			// Task should move to Jan 10, not skip multiple days
			expect(formatDateForStorage(correctNextOccurrence!)).toBe("2025-01-10");
		});

		it.skip("reproduces issue #1594 - calendar view should show completion on correct date", () => {
			// Reproduces issue #1594
			// After completing an overdue task, the calendar should show:
			// - Jan 9 as completed (the overdue instance)
			// - Jan 10, 11, 12 as still pending or due to be caught up

			const today = new Date(Date.UTC(2025, 0, 12));
			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan10 = new Date(Date.UTC(2025, 0, 10));
			const jan9Str = formatDateForStorage(jan9);
			const jan10Str = formatDateForStorage(jan10);

			// After correct completion of overdue instance
			const taskAfterCompletion: TaskInfo = {
				title: "Daily task",
				status: " ",
				path: "tasks/daily.md",
				scheduled: jan10Str, // Should move to Jan 10 (next uncompleted)
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [jan9Str], // Jan 9 completed
				skipped_instances: [],
			};

			// Jan 9 should show as complete
			const jan9Status = getEffectiveTaskStatus(taskAfterCompletion, jan9);
			expect(jan9Status).toBe("done");

			// Jan 10 should show as open/pending
			const jan10Status = getEffectiveTaskStatus(taskAfterCompletion, jan10);
			expect(jan10Status).toBe("open");
		});

		it.skip("reproduces issue #1594 - demonstrates the completion date determination logic needed", () => {
			// Reproduces issue #1594
			// The fix should determine completion date based on task's scheduled date
			// when the task is overdue

			const today = new Date(Date.UTC(2025, 0, 12));
			const scheduledDate = new Date(Date.UTC(2025, 0, 9));
			const scheduledStr = formatDateForStorage(scheduledDate);

			const overdueTask: TaskInfo = {
				title: "Daily task",
				status: " ",
				path: "tasks/daily.md",
				scheduled: scheduledStr, // Jan 9 - overdue
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// Proposed logic for determining completion date:
			const determineCompletionDate = (task: TaskInfo, explicitDate?: Date): Date => {
				// If explicit date provided (e.g., from context menu), use it
				if (explicitDate) {
					return explicitDate;
				}

				const todayLocal = getTodayLocal();
				const todayUTC = createUTCDateFromLocalCalendarDate(todayLocal);

				// Check if task has a scheduled date in the past
				if (task.scheduled) {
					const taskScheduled = parseDateToUTC(task.scheduled);
					if (taskScheduled < todayUTC) {
						// Task is overdue - complete the scheduled (past) date
						return taskScheduled;
					}
				}

				// Task is current or future - use today
				return todayUTC;
			};

			const completionDate = determineCompletionDate(overdueTask);
			expect(formatDateForStorage(completionDate)).toBe(scheduledStr); // Should be Jan 9, not Jan 12
		});
	});

	describe("Scenario 2: Clicking Done from note view after opening past occurrence", () => {
		it.skip("reproduces issue #1594 - clicking Done from note should complete the occurrence, not change status", () => {
			// Reproduces issue #1594
			// User workflow:
			// 1. Opens calendar, sees task on Jan 9
			// 2. Clicks on Jan 9 occurrence, which opens the task note
			// 3. From the note, clicks "Done" button
			// 4. BUG: This changes the task's STATUS to done, not the instance completion

			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan9Str = formatDateForStorage(jan9);

			const recurringTask: TaskInfo = {
				title: "Daily standup",
				status: " ", // Initially open
				path: "tasks/daily-standup.md",
				scheduled: jan9Str,
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// CURRENT BEHAVIOR (BUG):
			// When clicking "Done" from note view, updateProperty is called with status="x"
			// This sets the task's overall status to done, not completing the instance
			const buggyResult: TaskInfo = {
				...recurringTask,
				status: "x", // Entire task marked done - WRONG for recurring tasks!
				// complete_instances is unchanged - the occurrence isn't marked
			};

			// The task appears "done" entirely, not just for the occurrence
			expect(buggyResult.status).toBe("x");
			expect(buggyResult.complete_instances).not.toContain(jan9Str);

			// EXPECTED BEHAVIOR:
			// Clicking "Done" on a recurring task should call toggleRecurringTaskComplete
			// with the target date (from calendar context if available, or scheduled date)
			const correctResult: TaskInfo = {
				...recurringTask,
				status: " ", // Status remains open (for recurring tasks)
				complete_instances: [jan9Str], // Instance is marked as complete
			};

			expect(correctResult.status).toBe(" ");
			expect(correctResult.complete_instances).toContain(jan9Str);
		});

		it.skip("reproduces issue #1594 - note view loses occurrence date context from calendar", () => {
			// Reproduces issue #1594
			// The issue is that when clicking on a calendar occurrence and opening the note,
			// the occurrence date context is lost.

			// When user clicks on Jan 9 occurrence in calendar:
			// - getTargetDateForEvent() correctly extracts Jan 9
			// - TaskContextMenu uses this date for "Mark Complete"

			// But when the note opens:
			// - The note view doesn't know which occurrence was clicked
			// - The "Done" action in note view has no occurrence context
			// - It falls back to changing the task's status instead

			// This test documents that the calendar correctly passes the date,
			// but the note view doesn't receive or use it

			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan9Str = formatDateForStorage(jan9);

			// Calendar context menu correctly uses the occurrence date
			const calendarContextDate = jan9;
			expect(formatDateForStorage(calendarContextDate)).toBe(jan9Str);

			// Note view action: no occurrence date available
			// The note's "Done" button doesn't have access to which calendar occurrence
			// the user clicked to open this note

			// Potential fixes:
			// 1. Pass occurrence date to note view when opening from calendar
			// 2. Detect overdue recurring tasks and prompt user for which date to complete
			// 3. Use the scheduled date as the default completion date for overdue tasks
		});

		it.skip("reproduces issue #1594 - recurring task status vs instance completion confusion", () => {
			// Reproduces issue #1594
			// The UX confusion: for recurring tasks, clicking "Done" in note view
			// should complete an instance, not mark the entire task as done

			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan9Str = formatDateForStorage(jan9);

			const recurringTask: TaskInfo = {
				title: "Daily exercise",
				status: " ",
				path: "tasks/daily-exercise.md",
				scheduled: jan9Str,
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// For recurring tasks, the expected behavior:
			// - "Done" action should call toggleRecurringTaskComplete
			// - This adds the date to complete_instances
			// - The task's status remains open (since it recurs)

			// For non-recurring tasks, the expected behavior:
			// - "Done" action calls updateProperty with status="x"
			// - This marks the task as done

			// The issue is that the current implementation doesn't differentiate
			// these cases properly when using the note view's Done action

			expect(recurringTask.recurrence).toBeDefined();
			// If task has recurrence, Done should use toggleRecurringTaskComplete
		});
	});

	describe("Calendar view occurrence marking", () => {
		it.skip("reproduces issue #1594 - right-click context menu should work for past occurrences", () => {
			// Reproduces issue #1594
			// User right-clicks on Jan 9 occurrence in calendar and selects "Mark Complete"
			// This SHOULD work correctly via the context menu

			const today = new Date(Date.UTC(2025, 0, 12));
			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan9Str = formatDateForStorage(jan9);

			const recurringTask: TaskInfo = {
				title: "Daily review",
				status: " ",
				path: "tasks/daily-review.md",
				scheduled: jan9Str,
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// Context menu passes the correct target date (Jan 9)
			// toggleRecurringTaskComplete is called with that date

			// After context menu completion:
			const afterContextMenuCompletion: TaskInfo = {
				...recurringTask,
				complete_instances: [jan9Str],
				scheduled: "2025-01-10", // Should move to next uncompleted
			};

			// Verify Jan 9 is in complete_instances
			expect(afterContextMenuCompletion.complete_instances).toContain(jan9Str);

			// Verify scheduled moved correctly
			expect(afterContextMenuCompletion.scheduled).toBe("2025-01-10");
		});

		it.skip("reproduces issue #1594 - left-click opens note but loses date context", () => {
			// Reproduces issue #1594
			// User left-clicks on Jan 9 occurrence, which opens the note
			// The note doesn't know it was opened from the Jan 9 calendar occurrence

			// This is the key UX issue: the click action opens the note,
			// but doesn't pass along the occurrence date context

			// The user then sees the note with a generic "Done" button
			// that doesn't know about the Jan 9 context

			// Two potential solutions:
			// 1. Store the occurrence context when opening from calendar
			//    (e.g., in a modal, sidebar, or temporary state)
			// 2. Make the note's Done action smarter about detecting overdue
			//    recurring tasks and using the scheduled date
		});
	});

	describe("Proposed fix behavior", () => {
		it.skip("reproduces issue #1594 - fix should use scheduled date for overdue tasks", () => {
			// Reproduces issue #1594
			// The fix in toggleRecurringTaskComplete should:
			// 1. Check if no explicit date is provided
			// 2. Check if task.scheduled is in the past (overdue)
			// 3. If overdue, use the scheduled date as the completion target
			// 4. This ensures the overdue instance is completed, not today's date

			const today = new Date(Date.UTC(2025, 0, 12));
			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan9Str = formatDateForStorage(jan9);
			const jan10Str = "2025-01-10";

			const overdueTask: TaskInfo = {
				title: "Daily task",
				status: " ",
				path: "tasks/daily.md",
				scheduled: jan9Str, // 3 days overdue
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// After the fix, calling toggleRecurringTaskComplete without explicit date
			// should detect overdue and complete the scheduled date
			const afterFix: TaskInfo = {
				...overdueTask,
				complete_instances: [jan9Str], // Completed Jan 9, not Jan 12
				scheduled: jan10Str, // Next occurrence is Jan 10
			};

			expect(afterFix.complete_instances).toContain(jan9Str);
			expect(afterFix.complete_instances).not.toContain(formatDateForStorage(today));
			expect(afterFix.scheduled).toBe(jan10Str);
		});

		it.skip("reproduces issue #1594 - fix should handle note view Done action for recurring tasks", () => {
			// Reproduces issue #1594
			// The fix should ensure that clicking "Done" on a recurring task in note view:
			// 1. Calls toggleRecurringTaskComplete instead of updateProperty(status)
			// 2. Uses the scheduled date (or detects overdue and uses that)
			// 3. Does NOT change the task's overall status to "done"

			const jan9 = new Date(Date.UTC(2025, 0, 9));
			const jan9Str = formatDateForStorage(jan9);

			const recurringTask: TaskInfo = {
				title: "Daily standup",
				status: " ",
				path: "tasks/daily-standup.md",
				scheduled: jan9Str,
				recurrence: "DTSTART:20250101;FREQ=DAILY",
				complete_instances: [],
				skipped_instances: [],
			};

			// The note view's Done action should detect this is a recurring task
			// and handle it appropriately
			const hasRecurrence = !!recurringTask.recurrence;
			expect(hasRecurrence).toBe(true);

			// If recurring, Done should use toggleRecurringTaskComplete
			// If not recurring, Done can use updateProperty(status)
		});
	});
});

describe("Issue #1594: Edge cases and related scenarios", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(Date.UTC(2025, 0, 12, 12, 0, 0)));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it.skip("reproduces issue #1594 - multiple days overdue with cascading completion", () => {
		// Reproduces issue #1594
		// If task is 3 days overdue, user may want to catch up one day at a time
		// Each completion should advance to the next day

		const jan9Str = "2025-01-09";
		const jan10Str = "2025-01-10";
		const jan11Str = "2025-01-11";
		const jan12Str = "2025-01-12";

		let task: TaskInfo = {
			title: "Daily exercise",
			status: " ",
			path: "tasks/daily-exercise.md",
			scheduled: jan9Str, // 3 days overdue on Jan 12
			recurrence: "DTSTART:20250101;FREQ=DAILY",
			complete_instances: [],
			skipped_instances: [],
		};

		// First completion: Jan 9 -> Jan 10
		task = {
			...task,
			complete_instances: [jan9Str],
			scheduled: jan10Str,
		};
		expect(task.scheduled).toBe(jan10Str);

		// Second completion: Jan 10 -> Jan 11
		task = {
			...task,
			complete_instances: [jan9Str, jan10Str],
			scheduled: jan11Str,
		};
		expect(task.scheduled).toBe(jan11Str);

		// Third completion: Jan 11 -> Jan 12 (today)
		task = {
			...task,
			complete_instances: [jan9Str, jan10Str, jan11Str],
			scheduled: jan12Str,
		};
		expect(task.scheduled).toBe(jan12Str);

		// Now task is current, not overdue
		// Fourth completion: Jan 12 -> Jan 13
		task = {
			...task,
			complete_instances: [jan9Str, jan10Str, jan11Str, jan12Str],
			scheduled: "2025-01-13",
		};
		expect(task.scheduled).toBe("2025-01-13");
	});

	it.skip("reproduces issue #1594 - weekly recurring task overdue by 1 week", () => {
		// Reproduces issue #1594
		// The same issue affects all recurrence frequencies

		const jan5Str = "2025-01-05"; // Last Sunday
		const jan12Str = "2025-01-12"; // This Sunday (today)
		const jan19Str = "2025-01-19"; // Next Sunday

		const weeklyTask: TaskInfo = {
			title: "Weekly review",
			status: " ",
			path: "tasks/weekly-review.md",
			scheduled: jan5Str, // 1 week overdue
			recurrence: "DTSTART:20250105;FREQ=WEEKLY;BYDAY=SU",
			complete_instances: [],
			skipped_instances: [],
		};

		// Current buggy behavior: completes today (Jan 12), moves to Jan 19
		// This skips this week's instance entirely!

		// Expected behavior: complete Jan 5, move to Jan 12 (this Sunday)
		const correctTask: TaskInfo = {
			...weeklyTask,
			complete_instances: [jan5Str],
			scheduled: jan12Str, // Should be this Sunday, not next Sunday
		};

		const nextOccurrence = getNextUncompletedOccurrence(correctTask);
		expect(formatDateForStorage(nextOccurrence!)).toBe(jan12Str);
	});

	it.skip("reproduces issue #1594 - task scheduled for future should complete normally", () => {
		// Reproduces issue #1594
		// If task is scheduled for today or future, completing should work as before
		// (complete the scheduled date, advance to next occurrence)

		const jan12Str = "2025-01-12"; // Today
		const jan13Str = "2025-01-13"; // Tomorrow

		const currentTask: TaskInfo = {
			title: "Daily task",
			status: " ",
			path: "tasks/daily.md",
			scheduled: jan12Str, // Today - not overdue
			recurrence: "DTSTART:20250101;FREQ=DAILY",
			complete_instances: [],
			skipped_instances: [],
		};

		// Completing today's task should work normally
		const afterCompletion: TaskInfo = {
			...currentTask,
			complete_instances: [jan12Str],
			scheduled: jan13Str,
		};

		expect(afterCompletion.complete_instances).toContain(jan12Str);
		expect(afterCompletion.scheduled).toBe(jan13Str);
	});
});
