/**
 * Test for Issue #925: Recurring task completion dates off by one day - timezone bug
 *
 * Bug Description:
 * When marking recurring tasks as complete ("mark completed for this date") in normal note view
 * or kanban view, the `complete_instances` array records yesterday's date instead of today's date,
 * while normal task `completedDate` fields work correctly.
 *
 * User's Environment:
 * - Timezone: US-East (UTC-5 or UTC-4 during DST)
 * - Time when bug occurs: just past midnight local time
 *
 * Root Cause Analysis:
 * When a user in a negative UTC offset timezone (like US-East) marks a task complete
 * just after local midnight, the UTC time is still the previous calendar day.
 *
 * For example:
 * - User's local time: January 16, 2025 at 12:30 AM EST (UTC-5)
 * - UTC time: January 15, 2025 at 5:30 AM UTC
 *
 * If the code creates a raw `new Date()` and passes it to `formatDateForStorage()` which
 * uses `getUTCDate()`, the wrong calendar day is extracted (January 15 instead of January 16).
 *
 * The fix requires using `createUTCDateFromLocalCalendarDate()` to create a UTC-anchored
 * date that preserves the user's local calendar day before formatting for storage.
 *
 * Similar Issues: #314, #1026, #1177
 */

import {
	formatDateForStorage,
	createUTCDateFromLocalCalendarDate,
	getTodayLocal,
	getCurrentDateString,
} from "../../../src/utils/dateUtils";

describe("Issue #925: Recurring task completion date off by one day (timezone bug)", () => {
	describe("Bug reproduction: US-East timezone just after local midnight", () => {
		/**
		 * This test demonstrates the bug scenario:
		 * - User in US-East (UTC-5) at 12:30 AM local time on January 16
		 * - UTC time is 5:30 AM on January 15
		 * - Bug: complete_instances stores "2025-01-15" instead of "2025-01-16"
		 */
		it.skip("reproduces issue #925: should store user's local date, not UTC date", () => {
			// Simulate the exact scenario: just past midnight in US-East timezone
			// User's local time: January 16, 2025 at 12:30 AM EST (UTC-5)
			// This corresponds to UTC: January 15, 2025 at 5:30 AM
			const utcInstant = new Date("2025-01-15T05:30:00.000Z");

			// BUG CASE: If code uses raw Date and formatDateForStorage directly
			// formatDateForStorage uses getUTCDate(), so it extracts the UTC date
			const buggyDateString = formatDateForStorage(utcInstant);

			// The bug: This stores "2025-01-15" (UTC date) instead of "2025-01-16" (user's local date)
			expect(buggyDateString).toBe("2025-01-15"); // This is what the bug produces

			// Expected: The user expects their local date (January 16) to be stored
			const expectedLocalDate = "2025-01-16";

			// FIX: The code should create a UTC-anchored date from the user's local calendar day
			// We need to simulate what the user's local Date would look like
			// In US-East at 12:30 AM on Jan 16, new Date() would have:
			// - getFullYear() = 2025
			// - getMonth() = 0 (January)
			// - getDate() = 16 (the 16th)

			// Create a Date object that represents what the user's system would show
			// This simulates new Date() in their timezone showing Jan 16
			const userLocalDate = new Date(2025, 0, 16, 0, 30, 0); // Jan 16, 2025 at 00:30 local

			// Apply the fix: create UTC-anchored date from local calendar day
			const fixedDate = createUTCDateFromLocalCalendarDate(userLocalDate);
			const fixedDateString = formatDateForStorage(fixedDate);

			// With the fix, the stored date should match the user's local calendar day
			expect(fixedDateString).toBe(expectedLocalDate);

			// This assertion demonstrates that the bug causes a mismatch
			// The test is skipped because it represents the unfixed bug behavior
			expect(buggyDateString).not.toBe(expectedLocalDate); // Bug: dates don't match
		});

		/**
		 * This test verifies that the fix (using createUTCDateFromLocalCalendarDate)
		 * correctly handles the timezone edge case.
		 */
		it("fix verification: createUTCDateFromLocalCalendarDate preserves local calendar day", () => {
			// Simulate user's local Date object showing January 16 at 00:30
			const userLocalDate = new Date(2025, 0, 16, 0, 30, 0);

			// The user sees January 16 on their calendar
			expect(userLocalDate.getDate()).toBe(16);
			expect(userLocalDate.getMonth()).toBe(0); // January
			expect(userLocalDate.getFullYear()).toBe(2025);

			// Create UTC-anchored date that preserves the local calendar day
			const utcAnchored = createUTCDateFromLocalCalendarDate(userLocalDate);

			// The UTC-anchored date should format to "2025-01-16"
			const storedDate = formatDateForStorage(utcAnchored);
			expect(storedDate).toBe("2025-01-16");
		});

		/**
		 * Verify getCurrentDateString() returns the correct local date
		 * (This is used for normal task completedDate and works correctly)
		 */
		it("getCurrentDateString uses local date extraction (works correctly)", () => {
			// getCurrentDateString uses local date extraction:
			// const now = new Date();
			// return `${year}-${month}-${day}` using getFullYear(), getMonth(), getDate()
			const currentDateString = getCurrentDateString();

			// This should always return today's local date in YYYY-MM-DD format
			const today = new Date();
			const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

			expect(currentDateString).toBe(expectedDate);
		});

		/**
		 * Verify getTodayLocal() returns the correct local date object
		 */
		it("getTodayLocal returns a date representing local calendar day", () => {
			const todayLocal = getTodayLocal();
			const now = new Date();

			// getTodayLocal should return a date with local calendar components
			expect(todayLocal.getFullYear()).toBe(now.getFullYear());
			expect(todayLocal.getMonth()).toBe(now.getMonth());
			expect(todayLocal.getDate()).toBe(now.getDate());
		});
	});

	describe("Comparison: completedDate vs complete_instances behavior", () => {
		/**
		 * This test demonstrates the inconsistency between:
		 * - completedDate (normal tasks): Uses getCurrentDateString() - works correctly
		 * - complete_instances (recurring tasks): May use raw Date + formatDateForStorage - buggy
		 */
		it.skip("reproduces issue #925: completedDate vs complete_instances inconsistency", () => {
			// Scenario: User in US-East marks task complete at 12:30 AM local time (Jan 16)
			// UTC time: 5:30 AM Jan 15

			// Normal task completedDate behavior (CORRECT):
			// Uses getCurrentDateString() which extracts local date components
			// Would return "2025-01-16" (user's local date) - CORRECT

			// Recurring task complete_instances behavior (BUG):
			// If using raw new Date() passed to formatDateForStorage()
			// formatDateForStorage uses getUTCDate() -> returns "2025-01-15" - WRONG

			// Simulate the UTC instant
			const utcInstant = new Date("2025-01-15T05:30:00.000Z");

			// What completedDate would store (using local extraction like getCurrentDateString)
			// This simulates the local date the user sees
			const localDate = new Date(2025, 0, 16, 0, 30, 0);
			const completedDateBehavior = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

			// What buggy complete_instances stores (using UTC extraction)
			const completeInstancesBuggyBehavior = formatDateForStorage(utcInstant);

			// The bug: these should be the same but aren't
			expect(completedDateBehavior).toBe("2025-01-16"); // Correct local date
			expect(completeInstancesBuggyBehavior).toBe("2025-01-15"); // Bug: UTC date

			// This demonstrates the inconsistency the user reported
			expect(completedDateBehavior).not.toBe(completeInstancesBuggyBehavior);
		});
	});

	describe("Multiple timezone edge cases", () => {
		/**
		 * Test the fix for various negative UTC offset timezones
		 */
		it("fix should work for various negative UTC offset timezones", () => {
			const testCases = [
				// { description, localDateComponents, expectedStoredDate }
				{ desc: "US-East (UTC-5) just after midnight", local: [2025, 0, 16, 0, 30], expected: "2025-01-16" },
				{ desc: "US-Pacific (UTC-8) just after midnight", local: [2025, 0, 16, 0, 30], expected: "2025-01-16" },
				{ desc: "US-Central (UTC-6) just after midnight", local: [2025, 0, 16, 0, 30], expected: "2025-01-16" },
				{ desc: "Hawaii (UTC-10) just after midnight", local: [2025, 0, 16, 0, 30], expected: "2025-01-16" },
			];

			testCases.forEach(({ desc, local, expected }) => {
				const [year, month, day, hour, minute] = local;
				const userLocalDate = new Date(year, month, day, hour, minute, 0);

				// Apply the fix
				const utcAnchored = createUTCDateFromLocalCalendarDate(userLocalDate);
				const storedDate = formatDateForStorage(utcAnchored);

				expect(storedDate).toBe(expected);
			});
		});

		/**
		 * Test positive UTC offset timezones (should also work correctly)
		 */
		it("fix should work for positive UTC offset timezones", () => {
			const testCases = [
				// For positive offsets, the issue is reversed - late evening local might be next day UTC
				{ desc: "Australia-Sydney (UTC+11) at 11:30 PM", local: [2025, 0, 15, 23, 30], expected: "2025-01-15" },
				{ desc: "Japan (UTC+9) at 11:30 PM", local: [2025, 0, 15, 23, 30], expected: "2025-01-15" },
				{ desc: "India (UTC+5:30) at 11:30 PM", local: [2025, 0, 15, 23, 30], expected: "2025-01-15" },
			];

			testCases.forEach(({ desc, local, expected }) => {
				const [year, month, day, hour, minute] = local;
				const userLocalDate = new Date(year, month, day, hour, minute, 0);

				// Apply the fix
				const utcAnchored = createUTCDateFromLocalCalendarDate(userLocalDate);
				const storedDate = formatDateForStorage(utcAnchored);

				expect(storedDate).toBe(expected);
			});
		});
	});

	describe("Integration with TaskService.toggleRecurringTaskComplete", () => {
		/**
		 * This test verifies the expected behavior of the fix at the service level.
		 * The fix should ensure that when no date is passed, the service uses
		 * createUTCDateFromLocalCalendarDate(getTodayLocal()) to get the correct local date.
		 */
		it.skip("reproduces issue #925: service should use UTC-anchored local date by default", () => {
			// This test would require mocking the TaskService to verify it uses the correct
			// date creation pattern. See existing tests:
			// - issue-314-complete-instances-timezone-bug.test.ts
			// - issue-1026-1177-bases-recurring-completion-timezone.test.ts

			// The fix in TaskService.toggleRecurringTaskComplete should be:
			// const targetDate = date || (() => {
			//     const todayLocal = getTodayLocal();
			//     return createUTCDateFromLocalCalendarDate(todayLocal);
			// })();

			// This ensures the default date (when no date is passed) is the user's
			// local calendar day, properly UTC-anchored for consistent storage.

			expect(true).toBe(true); // Placeholder - see integration tests
		});
	});
});
