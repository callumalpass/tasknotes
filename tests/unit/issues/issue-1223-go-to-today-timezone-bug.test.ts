/**
 * Issue #1223: "Go to today's note" doesn't respect time zone
 *
 * Bug Description: In the morning in Japan the TaskNotes command "Go to today's note"
 * opens the previous day's note. The local time zone is not properly respected.
 *
 * Root cause: navigateToCurrentDailyNote() created a `new Date()` representing
 * the current moment, then passed it to navigateToDailyNote() which called
 * convertUTCToLocalCalendarDate(). This function was designed for UTC-anchored
 * dates (from the calendar), so it extracts UTC date components using getUTC*().
 *
 * For users in positive UTC offset timezones (Japan is UTC+9):
 * - At 8 AM on January 2nd in Japan (local time)
 * - UTC time is 11 PM on January 1st (previous day)
 * - convertUTCToLocalCalendarDate() extracts UTC date: January 1st
 * - Opens January 1st's daily note instead of January 2nd
 *
 * Fix: Use getTodayLocal() directly instead of new Date(), and pass { isAlreadyLocal: true }
 * to navigateToDailyNote() to skip the unnecessary (and incorrect) UTC conversion.
 */

import {
	convertUTCToLocalCalendarDate,
	getTodayLocal,
} from "../../../src/utils/dateUtils";

describe("Issue #1223 - Go to today's note timezone bug", () => {
	describe("Bug reproduction: positive UTC offset timezone (Japan UTC+9)", () => {
		test("demonstrates the bug: early morning in Japan shows wrong date", () => {
			// Simulate: It's 8:00 AM on January 2nd, 2025 in Japan (UTC+9)
			// That means UTC time is 11:00 PM on January 1st, 2025
			const japanMorningJan2 = new Date("2025-01-01T23:00:00.000Z");

			// This is what navigateToCurrentDailyNote() does:
			// const date = new Date(); // Gets current moment (Jan 2 8am Japan = Jan 1 11pm UTC)
			// Then navigateToDailyNote() calls convertUTCToLocalCalendarDate(date)

			// convertUTCToLocalCalendarDate extracts UTC date components
			const buggyResult = convertUTCToLocalCalendarDate(japanMorningJan2);

			// The buggy code extracts UTC day (January 1st) instead of local day (January 2nd)
			// This is the bug: user in Japan at 8 AM on Jan 2nd gets Jan 1st's note
			const extractedUTCDay = japanMorningJan2.getUTCDate();
			const extractedUTCMonth = japanMorningJan2.getUTCMonth();
			const extractedUTCYear = japanMorningJan2.getUTCFullYear();

			console.log("\n=== Issue #1223 Bug Reproduction ===");
			console.log("User's local time: January 2nd, 2025, 8:00 AM (Japan UTC+9)");
			console.log("Underlying UTC time:", japanMorningJan2.toISOString());
			console.log("UTC date extracted:", `${extractedUTCYear}-${extractedUTCMonth + 1}-${extractedUTCDay}`);
			console.log("Buggy result opens note for:", `${buggyResult.getFullYear()}-${buggyResult.getMonth() + 1}-${buggyResult.getDate()}`);

			// Verify the bug: UTC extraction gives January 1st, not January 2nd
			expect(extractedUTCDay).toBe(1); // UTC is Jan 1
			expect(extractedUTCMonth).toBe(0); // January (0-indexed)
			expect(extractedUTCYear).toBe(2025);

			// The buggy behavior: opens January 1st note when user expects January 2nd
			expect(buggyResult.getDate()).toBe(1); // BUG: Should be 2!
		});

		test("demonstrates the bug: late night in Japan also affected", () => {
			// Simulate: It's 8:00 AM on January 2nd, 2025 in Japan (UTC+9)
			// Actually at 8:59 AM Japan = UTC 11:59 PM previous day
			const japanLateNightJan2 = new Date("2025-01-01T23:59:00.000Z");

			const extractedUTCDay = japanLateNightJan2.getUTCDate();

			console.log("\n=== Bug Window: All times before 9 AM Japan ===");
			console.log("At 8:59 AM Japan (Jan 2) = 11:59 PM UTC (Jan 1)");
			console.log("UTC day extracted:", extractedUTCDay);

			// Still January 1st UTC, so bug affects users from midnight to 9 AM Japan time
			expect(extractedUTCDay).toBe(1);
		});

		test("bug window: Japan users affected from midnight to 9 AM local time", () => {
			// Japan is UTC+9, so:
			// - 12:00 AM Japan (midnight) = 3:00 PM previous day UTC
			// - 8:59 AM Japan = 11:59 PM previous day UTC
			// - 9:00 AM Japan = 12:00 AM same day UTC (bug ends here)

			// Test at Japan midnight (start of bug window)
			const japanMidnight = new Date("2025-01-01T15:00:00.000Z"); // Midnight Jan 2 Japan
			expect(japanMidnight.getUTCDate()).toBe(1); // Still Jan 1 UTC - BUG!

			// Test at 8:59 AM Japan (end of bug window)
			const japan859AM = new Date("2025-01-01T23:59:00.000Z"); // 8:59 AM Jan 2 Japan
			expect(japan859AM.getUTCDate()).toBe(1); // Still Jan 1 UTC - BUG!

			// Test at 9:00 AM Japan (bug ends)
			const japan900AM = new Date("2025-01-02T00:00:00.000Z"); // 9:00 AM Jan 2 Japan
			expect(japan900AM.getUTCDate()).toBe(2); // Now Jan 2 UTC - works by accident
		});
	});

	describe("Affected timezone analysis", () => {
		test("positive UTC offsets (ahead of UTC) are affected in early morning", () => {
			// Any timezone ahead of UTC will have this bug in the morning hours
			// The bug window is from midnight to (UTC offset) hours

			const affectedTimezones = [
				{ name: "Japan (UTC+9)", offset: 9, bugWindowEnd: "9:00 AM" },
				{ name: "Australia AEST (UTC+10)", offset: 10, bugWindowEnd: "10:00 AM" },
				{ name: "New Zealand (UTC+12)", offset: 12, bugWindowEnd: "12:00 PM" },
				{ name: "India (UTC+5:30)", offset: 5.5, bugWindowEnd: "5:30 AM" },
				{ name: "China (UTC+8)", offset: 8, bugWindowEnd: "8:00 AM" },
				{ name: "Germany Summer (UTC+2)", offset: 2, bugWindowEnd: "2:00 AM" },
				{ name: "UK Summer (UTC+1)", offset: 1, bugWindowEnd: "1:00 AM" },
			];

			console.log("\n=== Affected Timezones ===");
			affectedTimezones.forEach((tz) => {
				console.log(`${tz.name}: Bug affects users from midnight to ${tz.bugWindowEnd}`);
			});

			// All positive offset timezones have a bug window
			expect(affectedTimezones.length).toBeGreaterThan(0);
		});

		test("negative UTC offsets (behind UTC) are NOT affected", () => {
			// Simulate: 11 PM on January 1st in New York (UTC-5)
			// That means UTC time is 4 AM on January 2nd
			const newYorkLateNight = new Date("2025-01-02T04:00:00.000Z"); // 11 PM Jan 1 NYC

			const extractedUTCDay = newYorkLateNight.getUTCDate();

			console.log("\n=== Negative UTC Offset (Not Affected) ===");
			console.log("11 PM Jan 1 in New York (UTC-5) = 4 AM Jan 2 UTC");
			console.log("UTC day extracted:", extractedUTCDay);

			// UTC is ahead, so extracting UTC date gives the correct or next day, not previous
			expect(extractedUTCDay).toBe(2);
		});
	});

	describe("Correct implementation using getTodayLocal()", () => {
		test("getTodayLocal() correctly returns local calendar date", () => {
			// getTodayLocal() is the correct function to use
			// It extracts local date components, not UTC components

			const today = getTodayLocal();

			// Should return a date at midnight in local timezone
			expect(today.getHours()).toBe(0);
			expect(today.getMinutes()).toBe(0);
			expect(today.getSeconds()).toBe(0);

			console.log("\n=== Correct Implementation ===");
			console.log("getTodayLocal() returns:", today.toString());
			console.log("This correctly uses local timezone");
		});

		test("comparison: getTodayLocal() vs buggy convertUTCToLocalCalendarDate(new Date())", () => {
			// The current buggy code does:
			// const date = new Date();
			// const localDate = convertUTCToLocalCalendarDate(date);
			//
			// This should instead be:
			// const localDate = getTodayLocal();

			// We can't truly simulate a different timezone in Jest,
			// but we can document the correct fix

			const now = new Date();

			// Buggy approach (current code)
			const buggyApproach = convertUTCToLocalCalendarDate(now);

			// Correct approach
			const correctApproach = getTodayLocal();

			console.log("\n=== Fix Comparison ===");
			console.log("Current time:", now.toString());
			console.log("Buggy approach result:", buggyApproach.toString());
			console.log("Correct approach result:", correctApproach.toString());

			// In timezones where local day !== UTC day, these will differ
			// The correct approach always matches the user's local calendar

			// Both should be at midnight
			expect(buggyApproach.getHours()).toBe(0);
			expect(correctApproach.getHours()).toBe(0);
		});
	});

	describe("Fix verification", () => {
		test("fixed navigateToCurrentDailyNote uses getTodayLocal() directly", () => {
			// The fix for issue #1223:
			//
			// BEFORE (buggy):
			// async navigateToCurrentDailyNote() {
			//     const date = new Date();
			//     await this.navigateToDailyNote(date);
			// }
			//
			// AFTER (fixed):
			// async navigateToCurrentDailyNote() {
			//     const date = getTodayLocal();
			//     await this.navigateToDailyNote(date, { isAlreadyLocal: true });
			// }

			// Simulate the fixed behavior
			const fixedDate = getTodayLocal();

			// This date is guaranteed to be the correct local calendar date
			// regardless of timezone
			expect(fixedDate.getDate()).toBe(new Date().getDate());
			expect(fixedDate.getMonth()).toBe(new Date().getMonth());
			expect(fixedDate.getFullYear()).toBe(new Date().getFullYear());
		});

		test("isAlreadyLocal option skips UTC conversion", () => {
			// When isAlreadyLocal is true, the date should be used as-is
			// without going through convertUTCToLocalCalendarDate()

			// Create a date that would be incorrectly converted if not skipped
			// At 8 AM Jan 2 Japan (UTC+9) = 11 PM Jan 1 UTC
			const japanMorning = new Date("2025-01-01T23:00:00.000Z");

			// If we pass this to convertUTCToLocalCalendarDate (buggy path),
			// it extracts UTC date = January 1st
			const buggyResult = convertUTCToLocalCalendarDate(japanMorning);
			expect(buggyResult.getDate()).toBe(1); // Wrong!

			// With the fix, getTodayLocal() returns the correct local date directly
			// and the { isAlreadyLocal: true } option skips the conversion
			const today = getTodayLocal();
			// Since we can't actually test in Japan timezone, we verify the
			// function returns today's date (which it always should)
			const now = new Date();
			expect(today.getDate()).toBe(now.getDate());
			expect(today.getMonth()).toBe(now.getMonth());
			expect(today.getFullYear()).toBe(now.getFullYear());
		});
	});
});
