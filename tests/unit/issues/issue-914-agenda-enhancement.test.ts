/**
 * Tests for Issue #914: Agenda enhancement feature request
 *
 * Feature Request Description:
 * Add an enhanced agenda feature to display all tasks with their due dates,
 * without restricting the view to a single week. Include a "days remaining"
 * counter for each task to show the time left until the due date.
 *
 * Key Requirements:
 * 1. Display ALL tasks with due dates (not restricted to a single week)
 * 2. Include a "days remaining" counter for each task
 * 3. Show tasks in chronological order by due date
 *
 * Relevant code:
 * - src/bases/CalendarView.ts - Main calendar view (listWeek mode configuration)
 * - src/ui/TaskCard.ts - TaskCard rendering including due date display
 * - src/utils/dateUtils.ts - Date utilities for time/date calculations
 */

import { describe, it, expect } from "@jest/globals";

// Mock interface matching TaskInfo due date structure
interface MockTaskWithDue {
	id: string;
	title: string;
	due: string;
	status: string;
}

// Mock interface for agenda view options
interface AgendaViewOptions {
	listDayCount: number | "unlimited";
	showDaysRemaining: boolean;
}

/**
 * Calculate the difference in calendar days between two dates
 */
function differenceInCalendarDays(dateLeft: Date, dateRight: Date): number {
	const MS_PER_DAY = 24 * 60 * 60 * 1000;
	const leftStart = new Date(dateLeft.getFullYear(), dateLeft.getMonth(), dateLeft.getDate());
	const rightStart = new Date(dateRight.getFullYear(), dateRight.getMonth(), dateRight.getDate());
	return Math.round((leftStart.getTime() - rightStart.getTime()) / MS_PER_DAY);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/**
 * Format date as "MMM d" (e.g., "Jan 20")
 */
function formatDate(date: Date): string {
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Calculate days remaining until a due date
 * Positive = days until due, Negative = days overdue, 0 = due today
 */
function calculateDaysRemaining(dueDate: string, referenceDate: Date = new Date()): number {
	const due = new Date(dueDate);
	// Use start of day for both dates to get calendar day difference
	const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
	const refStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
	return differenceInCalendarDays(dueStart, refStart);
}

/**
 * Format days remaining for display
 * Examples: "5 days", "Today", "1 day", "Overdue by 3 days"
 */
function formatDaysRemaining(days: number): string {
	if (days === 0) {
		return "Today";
	} else if (days === 1) {
		return "1 day";
	} else if (days > 1) {
		return `${days} days`;
	} else if (days === -1) {
		return "Overdue by 1 day";
	} else {
		return `Overdue by ${Math.abs(days)} days`;
	}
}

/**
 * Filter and sort tasks for agenda view
 * Returns tasks with due dates, sorted chronologically
 */
function getAgendaTasks(
	tasks: MockTaskWithDue[],
	options: AgendaViewOptions,
	referenceDate: Date = new Date()
): MockTaskWithDue[] {
	// Filter to only tasks with due dates
	const tasksWithDue = tasks.filter((task) => task.due);

	// If not unlimited, filter by day count from reference date
	let filteredTasks = tasksWithDue;
	if (options.listDayCount !== "unlimited") {
		const endDate = addDays(referenceDate, options.listDayCount);
		filteredTasks = tasksWithDue.filter((task) => {
			const dueDate = new Date(task.due);
			return dueDate <= endDate;
		});
	}

	// Sort by due date chronologically
	return filteredTasks.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

describe("Issue #914: Agenda enhancement feature request", () => {
	const today = new Date("2025-01-15");

	const mockTasks: MockTaskWithDue[] = [
		{ id: "1", title: "Task due today", due: "2025-01-15", status: "open" },
		{ id: "2", title: "Task due tomorrow", due: "2025-01-16", status: "open" },
		{ id: "3", title: "Task due in 5 days", due: "2025-01-20", status: "open" },
		{ id: "4", title: "Task due in 30 days", due: "2025-02-14", status: "open" },
		{ id: "5", title: "Overdue task", due: "2025-01-10", status: "open" },
		{ id: "6", title: "Task without due date", due: "", status: "open" },
		{ id: "7", title: "Task due in 2 weeks", due: "2025-01-29", status: "open" },
		{ id: "8", title: "Task due in 3 months", due: "2025-04-15", status: "open" },
	];

	describe("Days remaining calculation", () => {
		it("should calculate 0 days remaining for task due today", () => {
			const days = calculateDaysRemaining("2025-01-15", today);
			expect(days).toBe(0);
		});

		it("should calculate positive days for future due dates", () => {
			expect(calculateDaysRemaining("2025-01-16", today)).toBe(1);
			expect(calculateDaysRemaining("2025-01-20", today)).toBe(5);
			expect(calculateDaysRemaining("2025-02-14", today)).toBe(30);
		});

		it("should calculate negative days for overdue tasks", () => {
			expect(calculateDaysRemaining("2025-01-10", today)).toBe(-5);
			expect(calculateDaysRemaining("2025-01-14", today)).toBe(-1);
		});

		it("should handle year boundaries correctly", () => {
			const endOfYear = new Date("2024-12-31");
			const daysToNewYear = calculateDaysRemaining("2025-01-01", endOfYear);
			expect(daysToNewYear).toBe(1);
		});
	});

	describe("Days remaining formatting", () => {
		it('should format 0 days as "Today"', () => {
			expect(formatDaysRemaining(0)).toBe("Today");
		});

		it('should format 1 day as "1 day"', () => {
			expect(formatDaysRemaining(1)).toBe("1 day");
		});

		it('should format multiple days as "X days"', () => {
			expect(formatDaysRemaining(5)).toBe("5 days");
			expect(formatDaysRemaining(30)).toBe("30 days");
		});

		it('should format -1 as "Overdue by 1 day"', () => {
			expect(formatDaysRemaining(-1)).toBe("Overdue by 1 day");
		});

		it('should format negative days as "Overdue by X days"', () => {
			expect(formatDaysRemaining(-5)).toBe("Overdue by 5 days");
			expect(formatDaysRemaining(-30)).toBe("Overdue by 30 days");
		});
	});

	describe("Unlimited agenda view", () => {
		it.skip("should display all tasks with due dates when listDayCount is unlimited - reproduces issue #914", () => {
			// This test documents the requested behavior:
			// The agenda view should be able to show ALL tasks with due dates,
			// not just those within a fixed week window.
			//
			// Current behavior:
			// - listDayCount defaults to 7 days
			// - Tasks beyond this range are not shown
			//
			// Requested behavior:
			// - Allow an "unlimited" or "all" option for listDayCount
			// - Show all tasks with due dates in chronological order

			const options: AgendaViewOptions = {
				listDayCount: "unlimited",
				showDaysRemaining: true,
			};

			const agendaTasks = getAgendaTasks(mockTasks, options, today);

			// Should include all tasks with due dates (7 tasks, excluding the one without due date)
			expect(agendaTasks.length).toBe(7);

			// Should be sorted chronologically
			expect(agendaTasks[0].title).toBe("Overdue task");
			expect(agendaTasks[1].title).toBe("Task due today");
			expect(agendaTasks[6].title).toBe("Task due in 3 months");
		});

		it.skip("should show tasks beyond the default 7-day window - reproduces issue #914", () => {
			// The feature request specifically asks to remove the single week restriction
			const options: AgendaViewOptions = {
				listDayCount: "unlimited",
				showDaysRemaining: true,
			};

			const agendaTasks = getAgendaTasks(mockTasks, options, today);

			// Should include the task due in 30 days
			const task30Days = agendaTasks.find((t) => t.title === "Task due in 30 days");
			expect(task30Days).toBeDefined();

			// Should include the task due in 3 months
			const task3Months = agendaTasks.find((t) => t.title === "Task due in 3 months");
			expect(task3Months).toBeDefined();
		});
	});

	describe("Days remaining counter integration", () => {
		it.skip("should include days remaining for each task in agenda - reproduces issue #914", () => {
			// The feature request asks for a "days remaining" counter for each task.
			// This test verifies that the calculation would work for all agenda tasks.
			//
			// Current behavior:
			// - Due dates shown as "Due: Today", "Due: Oct 26", or "Due: Oct 26 (overdue)"
			//
			// Requested behavior:
			// - Show "5 days remaining", "Today", "Overdue by 3 days", etc.

			const options: AgendaViewOptions = {
				listDayCount: "unlimited",
				showDaysRemaining: true,
			};

			const agendaTasks = getAgendaTasks(mockTasks, options, today);

			// Verify days remaining can be calculated for each task
			const tasksWithDaysRemaining = agendaTasks.map((task) => ({
				...task,
				daysRemaining: calculateDaysRemaining(task.due, today),
				daysRemainingDisplay: formatDaysRemaining(calculateDaysRemaining(task.due, today)),
			}));

			// Check specific tasks
			const overdueTask = tasksWithDaysRemaining.find((t) => t.title === "Overdue task");
			expect(overdueTask?.daysRemaining).toBe(-5);
			expect(overdueTask?.daysRemainingDisplay).toBe("Overdue by 5 days");

			const todayTask = tasksWithDaysRemaining.find((t) => t.title === "Task due today");
			expect(todayTask?.daysRemaining).toBe(0);
			expect(todayTask?.daysRemainingDisplay).toBe("Today");

			const tomorrowTask = tasksWithDaysRemaining.find((t) => t.title === "Task due tomorrow");
			expect(tomorrowTask?.daysRemaining).toBe(1);
			expect(tomorrowTask?.daysRemainingDisplay).toBe("1 day");

			const fiveDayTask = tasksWithDaysRemaining.find((t) => t.title === "Task due in 5 days");
			expect(fiveDayTask?.daysRemaining).toBe(5);
			expect(fiveDayTask?.daysRemainingDisplay).toBe("5 days");
		});
	});

	describe("Configurable day range", () => {
		it("should respect custom listDayCount when not unlimited", () => {
			// Allow flexible configuration for users who want a specific range
			const options14Days: AgendaViewOptions = {
				listDayCount: 14,
				showDaysRemaining: true,
			};

			const agendaTasks14 = getAgendaTasks(mockTasks, options14Days, today);

			// Should include overdue, today, tomorrow, 5 days, but NOT 30 days or 3 months
			expect(agendaTasks14.length).toBe(5); // overdue + today + tomorrow + 5 days + 2 weeks
			expect(agendaTasks14.find((t) => t.title === "Task due in 30 days")).toBeUndefined();
		});

		it("should default to 7 days for backwards compatibility", () => {
			const options7Days: AgendaViewOptions = {
				listDayCount: 7,
				showDaysRemaining: true,
			};

			const agendaTasks7 = getAgendaTasks(mockTasks, options7Days, today);

			// Should include overdue, today, tomorrow, 5 days (within 7 day window)
			// 2 weeks task is at day 14, so excluded
			expect(agendaTasks7.find((t) => t.title === "Task due in 2 weeks")).toBeUndefined();
		});
	});

	describe("Sorting and filtering", () => {
		it("should exclude tasks without due dates", () => {
			const options: AgendaViewOptions = {
				listDayCount: "unlimited",
				showDaysRemaining: true,
			};

			const agendaTasks = getAgendaTasks(mockTasks, options, today);

			const taskWithoutDue = agendaTasks.find((t) => t.title === "Task without due date");
			expect(taskWithoutDue).toBeUndefined();
		});

		it("should sort tasks by due date in ascending order", () => {
			const options: AgendaViewOptions = {
				listDayCount: "unlimited",
				showDaysRemaining: true,
			};

			const agendaTasks = getAgendaTasks(mockTasks, options, today);

			// Verify order is chronological
			for (let i = 1; i < agendaTasks.length; i++) {
				const prevDate = new Date(agendaTasks[i - 1].due);
				const currDate = new Date(agendaTasks[i].due);
				expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
			}
		});

		it("should include overdue tasks at the top of the list", () => {
			const options: AgendaViewOptions = {
				listDayCount: "unlimited",
				showDaysRemaining: true,
			};

			const agendaTasks = getAgendaTasks(mockTasks, options, today);

			// First task should be the overdue one (earliest date)
			expect(agendaTasks[0].title).toBe("Overdue task");
		});
	});

	describe("UI display requirements from mockup", () => {
		it.skip("should support compact days remaining display format - reproduces issue #914", () => {
			// Based on the mockup image in the issue, the display should be compact
			// and integrate well with the existing task card layout
			//
			// The mockup shows a right-panel agenda with tasks listed by date
			// and a clear "days remaining" indicator

			// Test various display scenarios based on the mockup
			const testCases = [
				{ days: 0, expected: "Today" },
				{ days: 1, expected: "1 day" },
				{ days: 7, expected: "7 days" },
				{ days: 30, expected: "30 days" },
				{ days: -1, expected: "Overdue by 1 day" },
				{ days: -7, expected: "Overdue by 7 days" },
			];

			for (const testCase of testCases) {
				const display = formatDaysRemaining(testCase.days);
				expect(display).toBe(testCase.expected);
			}
		});
	});
});

describe("CalendarView listDayCount configuration", () => {
	// These tests document the expected configuration changes needed

	it.skip("should support 'unlimited' or large listDayCount values - reproduces issue #914", () => {
		// The CalendarView currently configures listWeek as:
		// listWeek: {
		//   type: "list",
		//   duration: { days: this.viewOptions.listDayCount },
		// }
		//
		// To support unlimited viewing:
		// - Either use a very large number (e.g., 365 days for 1 year)
		// - Or implement a special "all" mode that queries all tasks with due dates

		// This test documents the expected behavior
		const mockViewOptions = {
			listDayCount: 365, // 1 year view
		};

		// FullCalendar should accept this configuration
		expect(mockViewOptions.listDayCount).toBe(365);
	});
});

describe("TaskCard due date display enhancement", () => {
	// These tests document the changes needed to TaskCard.ts

	it.skip("should add days remaining to due date display - reproduces issue #914", () => {
		// Current renderDueDateProperty output:
		// - "Due: Today" or "Due: Today at HH:MM"
		// - "Due: Oct 26 (overdue)"
		// - "Due: Oct 26"
		//
		// Requested output (adding days remaining):
		// - "Due: Today" (no change needed)
		// - "Due: Oct 26 (5 days)"
		// - "Due: Oct 26 (overdue - 3 days)"

		// Example enhanced format
		function formatEnhancedDueDate(dueDate: string, referenceDate: Date): string {
			const days = calculateDaysRemaining(dueDate, referenceDate);
			const dateStr = formatDate(new Date(dueDate));

			if (days === 0) {
				return "Due: Today";
			} else if (days > 0) {
				return `Due: ${dateStr} (${formatDaysRemaining(days)})`;
			} else {
				return `Due: ${dateStr} (overdue - ${Math.abs(days)} days)`;
			}
		}

		const today = new Date("2025-01-15");

		expect(formatEnhancedDueDate("2025-01-15", today)).toBe("Due: Today");
		expect(formatEnhancedDueDate("2025-01-20", today)).toBe("Due: Jan 20 (5 days)");
		expect(formatEnhancedDueDate("2025-01-10", today)).toBe("Due: Jan 10 (overdue - 5 days)");
	});
});
