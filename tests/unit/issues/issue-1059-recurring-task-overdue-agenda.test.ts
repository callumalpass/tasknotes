/**
 * Test for Issue #1059: Some overdue tasks missing from the agenda view
 *
 * From GitHub issue: https://github.com/callumalpass/tasknotes/issues/1059
 *
 * User report: "There's an unintuitive (potentially dangerous) behaviour in the agenda view -
 * when I have an unfinished task with RRULE indicating the previous week, it does not show up
 * in the current week's agenda - it should show up in the `Overdue` section though."
 *
 * The issue is that recurring tasks with RRULE whose DTSTART is in the past (e.g., first of the month)
 * don't appear in the Overdue section of the agenda view, even when the task is incomplete and
 * the scheduled date has been updated to a future date.
 *
 * Example from the issue:
 * - Today: 2025-11-03
 * - Task has recurrence: DTSTART:20251101;FREQ=MONTHLY;BYMONTHDAY=1
 * - Task has scheduled: 2025-11-04 (tomorrow)
 * - Task status: open
 * - Expected: Task should appear in Overdue section because the recurrence DTSTART (Nov 1) has passed
 * - Actual: Task doesn't appear in current week's agenda at all
 */

import { FilterService } from "../../../src/services/FilterService";
import { StatusManager } from "../../../src/services/StatusManager";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { FilterQuery, TaskInfo } from "../../../src/types";
import { TaskFactory, PluginFactory } from "../../helpers/mock-factories";
import {
	createUTCDateFromLocalCalendarDate,
	formatDateForStorage,
} from "../../../src/utils/dateUtils";

describe("Issue #1059 - Recurring task with past RRULE not appearing in Overdue section", () => {
	let filterService: FilterService;
	let mockCacheManager: any;
	let statusManager: StatusManager;
	let priorityManager: PriorityManager;
	let mockPlugin: any;

	beforeEach(() => {
		// Mock system date to Nov 3, 2025 for consistent testing (matches issue report)
		jest.useFakeTimers();
		jest.setSystemTime(new Date(Date.UTC(2025, 10, 3, 12, 0, 0))); // Nov 3, 2025 12:00 UTC

		// Setup mock services
		statusManager = new StatusManager([
			{
				id: "open",
				value: " ",
				label: "Open",
				color: "#000000",
				isCompleted: false,
				order: 1,
			},
			{
				id: "done",
				value: "x",
				label: "Done",
				color: "#00ff00",
				isCompleted: true,
				order: 2,
			},
		]);
		priorityManager = new PriorityManager([
			{ id: "normal", value: "normal", label: "Normal", color: "#000000", weight: 0 },
		]);
		mockCacheManager = PluginFactory.createMockPlugin().cacheManager;

		mockPlugin = {
			settings: {
				hideCompletedFromOverdue: true,
				userFields: [],
			},
			i18n: {
				translate: (key: string) => key,
				getCurrentLocale: () => "en",
			},
		};

		filterService = new FilterService(
			mockCacheManager,
			statusManager,
			priorityManager,
			mockPlugin
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	/**
	 * This test reproduces the exact scenario from issue #1059:
	 * - A monthly recurring task with DTSTART on Nov 1, 2025
	 * - Today is Nov 3, 2025
	 * - The task has scheduled date set to Nov 4, 2025 (tomorrow)
	 * - The task is open (not completed)
	 *
	 * Expected behavior: The task should appear in the Overdue section because
	 * the RRULE DTSTART (Nov 1) has passed and the instance is not completed.
	 *
	 * Current behavior (BUG): The task doesn't appear in the Overdue section.
	 */
	it.skip("reproduces issue #1059 - recurring task with past DTSTART should appear in Overdue", async () => {
		// Create the exact task from the issue
		// Today is Nov 3, 2025
		// RRULE DTSTART is Nov 1, 2025 (which has passed)
		// Scheduled is Nov 4, 2025 (tomorrow)
		const recurringTask: TaskInfo = TaskFactory.createTask({
			path: "tasks/monthly-task.md",
			content: "- [ ] Monthly recurring task",
			title: "Monthly recurring task",
			scheduled: "2025-11-04", // Tomorrow
			status: " ", // Open (not completed)
			recurrence: "DTSTART:20251101;FREQ=MONTHLY;BYMONTHDAY=1",
			complete_instances: [], // No completions
		});

		// Mock the cache to return our test task
		mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTask.path]);
		mockCacheManager.getCachedTaskInfo.mockResolvedValue(recurringTask);

		// Create a default filter query
		const query: FilterQuery = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [],
			sortKey: "scheduled",
			sortDirection: "asc",
			groupKey: "none",
		};

		// Get overdue tasks
		const overdueTasks = await filterService.getOverdueTasks(query);

		// The task's RRULE DTSTART (Nov 1) has passed and it's not completed
		// It should appear in the Overdue section
		expect(overdueTasks.length).toBeGreaterThan(0);
		expect(overdueTasks.some((t) => t.path === recurringTask.path)).toBe(true);
	});

	/**
	 * Additional test case: Even though the scheduled date is in the future (tomorrow),
	 * the task should still show in agenda because the recurring instance from Nov 1 is overdue.
	 */
	it.skip("reproduces issue #1059 - task with future scheduled but past DTSTART should appear in agenda Overdue section", async () => {
		// Today is Nov 3, 2025
		const today = new Date(Date.UTC(2025, 10, 3)); // Nov 3, 2025

		const recurringTask: TaskInfo = TaskFactory.createTask({
			path: "tasks/monthly-task.md",
			content: "- [ ] Monthly recurring task",
			title: "Monthly recurring task",
			scheduled: "2025-11-04", // Tomorrow - future scheduled date
			status: " ",
			recurrence: "DTSTART:20251101;FREQ=MONTHLY;BYMONTHDAY=1", // Nov 1 instance is overdue
			complete_instances: [],
		});

		mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTask.path]);
		mockCacheManager.getCachedTaskInfo.mockResolvedValue(recurringTask);

		const query: FilterQuery = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [],
			sortKey: "scheduled",
			sortDirection: "asc",
			groupKey: "none",
		};

		// Get agenda data for today with overdue section enabled
		const todayUTC = createUTCDateFromLocalCalendarDate(today);
		const { dailyData, overdueTasks } = await filterService.getAgendaDataWithOverdue(
			[todayUTC],
			query,
			true // showOverdueSection = true
		);

		// The recurring task should appear in the overdue section because
		// the Nov 1 instance is past due and not completed
		expect(overdueTasks.some((t) => t.path === recurringTask.path)).toBe(true);
	});

	/**
	 * Test that weekly recurring task with past DTSTART also shows in overdue
	 */
	it.skip("reproduces issue #1059 - weekly recurring task from previous week should appear in Overdue", async () => {
		// Today is Nov 3, 2025 (Monday)
		// Task has RRULE with DTSTART last week (Oct 27, 2025)
		const recurringTask: TaskInfo = TaskFactory.createTask({
			path: "tasks/weekly-task.md",
			content: "- [ ] Weekly recurring task",
			title: "Weekly recurring task",
			scheduled: "2025-11-04", // Scheduled for tomorrow
			status: " ",
			recurrence: "DTSTART:20251027;FREQ=WEEKLY;BYDAY=MO", // Every Monday, started Oct 27
			complete_instances: [], // Oct 27 instance not completed
		});

		mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTask.path]);
		mockCacheManager.getCachedTaskInfo.mockResolvedValue(recurringTask);

		const query: FilterQuery = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [],
			sortKey: "scheduled",
			sortDirection: "asc",
			groupKey: "none",
		};

		const overdueTasks = await filterService.getOverdueTasks(query);

		// The Oct 27 instance is past due and not in complete_instances
		// It should appear in the Overdue section
		expect(overdueTasks.length).toBeGreaterThan(0);
		expect(overdueTasks.some((t) => t.path === recurringTask.path)).toBe(true);
	});

	/**
	 * Edge case: Task with completed past instances should NOT appear in overdue
	 */
	it.skip("reproduces issue #1059 - recurring task with completed past instance should NOT appear in Overdue", async () => {
		// Today is Nov 3, 2025
		// Task has RRULE with DTSTART Nov 1, but that instance is marked complete
		const recurringTask: TaskInfo = TaskFactory.createTask({
			path: "tasks/monthly-task-completed.md",
			content: "- [x] Monthly recurring task",
			title: "Monthly recurring task",
			scheduled: "2025-11-04",
			status: " ", // Still open for future instances
			recurrence: "DTSTART:20251101;FREQ=MONTHLY;BYMONTHDAY=1",
			complete_instances: ["2025-11-01"], // Nov 1 instance IS completed
		});

		mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTask.path]);
		mockCacheManager.getCachedTaskInfo.mockResolvedValue(recurringTask);

		const query: FilterQuery = {
			type: "group",
			id: "root",
			conjunction: "and",
			children: [],
			sortKey: "scheduled",
			sortDirection: "asc",
			groupKey: "none",
		};

		const overdueTasks = await filterService.getOverdueTasks(query);

		// The Nov 1 instance is completed, so task should NOT appear in overdue
		expect(overdueTasks.some((t) => t.path === recurringTask.path)).toBe(false);
	});
});
