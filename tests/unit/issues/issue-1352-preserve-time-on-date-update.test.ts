/**
 * Test for Issue #1352: Preserve time when updating schedule/due date
 *
 * Problem: When using the date context menu's increment operations (+1 day, -1 day, etc.),
 * the time component of the scheduled/due date is lost.
 *
 * Example:
 *   scheduled_date: 2025-12-10T16:00
 *   After "+1 day": 2025-12-11 (time lost!)
 *   Expected: 2025-12-11T16:00 (time preserved)
 *
 * Root cause: DateContextMenu.getDateOptions() uses moment.js format("YYYY-MM-DD")
 * which strips the time component. The fix should use addDaysToDateTime() from
 * dateUtils.ts which already preserves time when present.
 *
 * @see https://github.com/callumc/tasknotes/issues/1352
 */

import { hasTimeComponent, addDaysToDateTime, getTimePart } from "../../../src/utils/dateUtils";

describe("Issue #1352: Preserve time when updating schedule/due date", () => {
	describe("Current behavior (demonstrates the bug)", () => {
		it("should show that moment.js format('YYYY-MM-DD') loses time information", () => {
			// This simulates what DateContextMenu currently does (lines 136-159)
			const currentDateWithTime = "2025-12-10T16:00";

			// Simulating moment.js behavior as in DateContextMenu.getDateOptions()
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const moment = (window as any).moment || require("moment");
			const currentDate = moment(currentDateWithTime);
			const incrementedValue = currentDate.clone().add(1, "day").format("YYYY-MM-DD");

			// BUG: Time component is lost!
			expect(incrementedValue).toBe("2025-12-11"); // No time!
			expect(hasTimeComponent(incrementedValue)).toBe(false);

			// This is the problem - the original had a time component
			expect(hasTimeComponent(currentDateWithTime)).toBe(true);
			expect(getTimePart(currentDateWithTime)).toBe("16:00");
		});
	});

	describe("Expected behavior (using addDaysToDateTime)", () => {
		it("should preserve time when adding 1 day to datetime", () => {
			const currentDateWithTime = "2025-12-10T16:00";
			const result = addDaysToDateTime(currentDateWithTime, 1);

			// Time should be preserved
			expect(result).toBe("2025-12-11T16:00");
			expect(hasTimeComponent(result)).toBe(true);
			expect(getTimePart(result)).toBe("16:00");
		});

		it("should preserve time when subtracting 1 day from datetime", () => {
			const currentDateWithTime = "2025-12-10T16:00";
			const result = addDaysToDateTime(currentDateWithTime, -1);

			expect(result).toBe("2025-12-09T16:00");
			expect(hasTimeComponent(result)).toBe(true);
			expect(getTimePart(result)).toBe("16:00");
		});

		it("should preserve time when adding 1 week to datetime", () => {
			const currentDateWithTime = "2025-12-10T16:00";
			const result = addDaysToDateTime(currentDateWithTime, 7);

			expect(result).toBe("2025-12-17T16:00");
			expect(hasTimeComponent(result)).toBe(true);
			expect(getTimePart(result)).toBe("16:00");
		});

		it("should preserve time when subtracting 1 week from datetime", () => {
			const currentDateWithTime = "2025-12-10T16:00";
			const result = addDaysToDateTime(currentDateWithTime, -7);

			expect(result).toBe("2025-12-03T16:00");
			expect(hasTimeComponent(result)).toBe(true);
			expect(getTimePart(result)).toBe("16:00");
		});

		it("should NOT add time when original date has no time", () => {
			const currentDateOnly = "2025-12-10";
			const result = addDaysToDateTime(currentDateOnly, 1);

			// Should remain date-only
			expect(result).toBe("2025-12-11");
			expect(hasTimeComponent(result)).toBe(false);
		});

		it("should preserve morning time (edge case)", () => {
			const earlyMorning = "2025-12-10T06:30";
			const result = addDaysToDateTime(earlyMorning, 1);

			expect(result).toBe("2025-12-11T06:30");
			expect(getTimePart(result)).toBe("06:30");
		});

		it("should preserve late night time (edge case)", () => {
			const lateNight = "2025-12-10T23:45";
			const result = addDaysToDateTime(lateNight, 1);

			expect(result).toBe("2025-12-11T23:45");
			expect(getTimePart(result)).toBe("23:45");
		});

		it("should preserve midnight time", () => {
			const midnight = "2025-12-10T00:00";
			const result = addDaysToDateTime(midnight, 1);

			expect(result).toBe("2025-12-11T00:00");
			expect(getTimePart(result)).toBe("00:00");
		});
	});

	describe("DateContextMenu fix verification", () => {
		/**
		 * This test documents what DateContextMenu.getDateOptions() SHOULD do.
		 *
		 * Instead of:
		 *   value: currentDate.clone().add(1, "day").format("YYYY-MM-DD")
		 *
		 * It should use:
		 *   value: addDaysToDateTime(this.options.currentValue, 1)
		 *
		 * Or alternatively preserve time inline:
		 *   value: hasTimeComponent(currentValue)
		 *       ? currentDate.clone().add(1, "day").format("YYYY-MM-DDTHH:mm")
		 *       : currentDate.clone().add(1, "day").format("YYYY-MM-DD")
		 */
		it("should document the required fix for DateContextMenu", () => {
			const testCases = [
				{
					description: "+1 day with time",
					input: "2025-12-10T16:00",
					days: 1,
					expected: "2025-12-11T16:00",
				},
				{
					description: "-1 day with time",
					input: "2025-12-10T16:00",
					days: -1,
					expected: "2025-12-09T16:00",
				},
				{
					description: "+1 week with time",
					input: "2025-12-10T16:00",
					days: 7,
					expected: "2025-12-17T16:00",
				},
				{
					description: "-1 week with time",
					input: "2025-12-10T16:00",
					days: -7,
					expected: "2025-12-03T16:00",
				},
				{
					description: "+1 day without time",
					input: "2025-12-10",
					days: 1,
					expected: "2025-12-11",
				},
				{
					description: "-1 day without time",
					input: "2025-12-10",
					days: -1,
					expected: "2025-12-09",
				},
			];

			testCases.forEach(({ description, input, days, expected }) => {
				const result = addDaysToDateTime(input, days);
				expect(result).toBe(expected);

				// Verify time preservation
				if (hasTimeComponent(input)) {
					expect(hasTimeComponent(result)).toBe(true);
					expect(getTimePart(result)).toBe(getTimePart(input));
				} else {
					expect(hasTimeComponent(result)).toBe(false);
				}
			});
		});
	});
});
