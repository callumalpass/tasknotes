/**
 * Test for GitHub Issues #1026 and #1177
 *
 * Bug: Completing recurring tasks from Base views records the wrong date when the user
 * is in a negative UTC offset timezone (e.g., PST UTC-8) and it's after UTC midnight
 * but before local midnight.
 *
 * Example scenario:
 * - User in PST (UTC-8)
 * - Local time: Wednesday 2025-11-19 at 8:00 PM PST
 * - UTC time: Thursday 2025-11-20 at 4:00 AM UTC
 * - Task scheduled: "2025-11-19"
 * - Expected: Complete instance for "2025-11-19"
 * - Actual (bug): Complete instance for "2025-11-20"
 *
 * Root cause: Base views create `targetDate = new Date()` which is a local timezone Date.
 * When this is passed to `formatDateForStorage()`, which uses `.getUTCDate()`, the wrong
 * calendar day is extracted for users in negative UTC offset timezones after UTC midnight.
 *
 * The fix: Base views should use createUTCDateFromLocalCalendarDate(new Date()) to create
 * a UTC-anchored date that preserves the user's local calendar day.
 */

import { formatDateForStorage, createUTCDateFromLocalCalendarDate } from "../../../src/utils/dateUtils";
import { TaskListView } from "../../../src/bases/TaskListView";
import { KanbanView } from "../../../src/bases/KanbanView";

describe("Issue #1026 & #1177: Bases recurring completion timezone bug", () => {
	/**
	 * This test verifies that TaskListView uses properly UTC-anchored dates
	 * that will format correctly for any timezone.
	 */
	describe("TaskListView targetDate must be UTC-anchored", () => {
		it("currentTargetDate initialized in constructor should be UTC-anchored", () => {
			const mockPlugin = {
				fieldMapper: {},
			};
			const view = new TaskListView({}, document.createElement("div"), mockPlugin as any);

			// Check the currentTargetDate that is initialized in the constructor
			// This is the date that gets passed to createTaskCard
			const currentTargetDate = (view as any).currentTargetDate as Date;

			// It should be UTC-anchored (midnight UTC)
			expect(currentTargetDate.getUTCHours()).toBe(0);
			expect(currentTargetDate.getUTCMinutes()).toBe(0);
			expect(currentTargetDate.getUTCSeconds()).toBe(0);
			expect(currentTargetDate.getUTCMilliseconds()).toBe(0);
		});

		it("getTaskActionDate should return UTC-anchored date from scheduled date", () => {
			const mockPlugin = {
				fieldMapper: {},
			};
			const view = new TaskListView({}, document.createElement("div"), mockPlugin as any);

			// Task with scheduled date
			const taskWithScheduled = {
				title: "Test task",
				status: "open",
				path: "test.md",
				recurrence: "RRULE:FREQ=DAILY",
				scheduled: "2025-11-19",
			};

			const actionDate = (view as any).getTaskActionDate(taskWithScheduled) as Date;

			// Should be UTC-anchored at midnight UTC for Nov 19
			expect(actionDate.toISOString()).toBe("2025-11-19T00:00:00.000Z");
			expect(formatDateForStorage(actionDate)).toBe("2025-11-19");
		});

		it("getTaskActionDate fallback should return UTC-anchored date", () => {
			const mockPlugin = {
				fieldMapper: {},
			};
			const view = new TaskListView({}, document.createElement("div"), mockPlugin as any);

			// Task without scheduled or due date (triggers fallback)
			const taskWithoutDates = {
				title: "Test task",
				status: "open",
				path: "test.md",
				recurrence: "RRULE:FREQ=DAILY",
			};

			const actionDate = (view as any).getTaskActionDate(taskWithoutDates) as Date;

			// The fallback date should be UTC-anchored (midnight UTC)
			expect(actionDate.getUTCHours()).toBe(0);
			expect(actionDate.getUTCMinutes()).toBe(0);
			expect(actionDate.getUTCSeconds()).toBe(0);
		});
	});

	describe("KanbanView targetDate must be UTC-anchored", () => {
		it("getTaskActionDate fallback should return a UTC-anchored date", () => {
			const mockPlugin = {
				fieldMapper: {},
			};
			const view = new KanbanView({}, document.createElement("div"), mockPlugin as any);

			// Test with a task that has no scheduled or due date (triggers fallback)
			const taskWithoutDates = {
				title: "Test task",
				status: "open",
				path: "test.md",
				recurrence: "RRULE:FREQ=DAILY",
				// No scheduled or due date
			};

			const actionDate = (view as any).getTaskActionDate(taskWithoutDates) as Date;

			// The fallback date should be UTC-anchored
			expect(actionDate.getUTCHours()).toBe(0);
			expect(actionDate.getUTCMinutes()).toBe(0);
			expect(actionDate.getUTCSeconds()).toBe(0);
		});
	});

	/**
	 * This test verifies that the date stored in complete_instances matches the
	 * user's local calendar day, not the UTC day.
	 */
	describe("formatDateForStorage with UTC-anchored dates", () => {
		it("should store the correct local calendar day regardless of timezone", () => {
			// Simulate: User's local time is Nov 19 at 8PM
			// Their local Date object represents this moment
			const userLocalTime = new Date(2025, 10, 19, 20, 0, 0); // Nov 19, 8PM local

			// The correct approach: create UTC-anchored date from local calendar day
			const utcAnchored = createUTCDateFromLocalCalendarDate(userLocalTime);

			// This should always store "2025-11-19" regardless of the user's timezone
			const storedDate = formatDateForStorage(utcAnchored);
			expect(storedDate).toBe("2025-11-19");
		});

		it("BUG CASE: raw new Date() can cause wrong day to be stored", () => {
			// This demonstrates what happens with the buggy code
			// When it's 8PM PST on Nov 19 (which is 4AM UTC on Nov 20)

			// Simulate the UTC instant when it's 8PM PST Nov 19
			const utcInstant = new Date("2025-11-20T04:00:00.000Z");

			// If we pass this directly to formatDateForStorage (the bug)
			const buggyStoredDate = formatDateForStorage(utcInstant);

			// It stores Nov 20 (the UTC date) instead of Nov 19 (user's local date)
			expect(buggyStoredDate).toBe("2025-11-20");

			// The fix: if we had the user's local Date and UTC-anchored it properly:
			// (In the real bug, new Date() would give us local time, then formatDateForStorage
			// extracts UTC components, causing the mismatch)
		});
	});
});
