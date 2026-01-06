/**
 * Test for Issue #1433: Week Days Picker Ignores First Day of Week Setting
 *
 * Problem: The "Week Days" picker that appears in the right-click context menu
 * when setting Scheduled or Due dates does not respect the "First Day of Week"
 * setting configured in Tasknotes calendar settings. Even when the first day is
 * set to Monday (firstDay: 1), the picker displays Sunday as the first day.
 *
 * Expected: Weekday options should be ordered according to the firstDay setting:
 *   - firstDay: 0 (Sunday) -> Sun, Mon, Tue, Wed, Thu, Fri, Sat
 *   - firstDay: 1 (Monday) -> Mon, Tue, Wed, Thu, Fri, Sat, Sun
 *   - firstDay: 6 (Saturday) -> Sat, Sun, Mon, Tue, Wed, Thu, Fri
 *
 * Root cause: DateContextMenu.getDateOptions() uses a hardcoded array starting
 * with Sunday (lines 177-185) and iterates using index without considering the
 * plugin's firstDay setting from calendarViewSettings.
 *
 * @see https://github.com/callumc/tasknotes/issues/1433
 */

import moment from "moment";

// Mock moment.js on window (as Obsidian does)
(window as any).moment = moment;

// Standard weekday names for reference
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * This function simulates what DateContextMenu.getDateOptions() currently does
 * for generating weekday options. It demonstrates the bug: the weekday array
 * is always generated starting from Sunday, ignoring any firstDay setting.
 */
function generateWeekdayOptionsLikeDateContextMenu(
	_firstDay: number = 0,
	translate: (key: string) => string = (key) => {
		const dayMatch = key.match(/common\.weekdays\.(\w+)/);
		return dayMatch ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1) : key;
	}
): Array<{ label: string; value: string; category: string }> {
	const today = moment();
	const options: Array<{ label: string; value: string; category: string }> = [];

	// This is the bug: hardcoded array starting with Sunday
	// The firstDay parameter is IGNORED
	const weekdayCodes = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

	weekdayCodes.forEach((dayName, index) => {
		let targetDate = today.clone().day(index);
		if (targetDate.isSameOrBefore(today, "day")) {
			targetDate = targetDate.add(1, "week");
		}
		const label = translate(`common.weekdays.${dayName.toLowerCase()}`);
		options.push({
			label,
			value: targetDate.format("YYYY-MM-DD"),
			category: "weekday",
		});
	});

	return options;
}

/**
 * This function shows what the EXPECTED behavior should be:
 * reorder the weekdays array based on the firstDay setting.
 */
function generateWeekdayOptionsWithFirstDayRespected(
	firstDay: number = 0,
	translate: (key: string) => string = (key) => {
		const dayMatch = key.match(/common\.weekdays\.(\w+)/);
		return dayMatch ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1) : key;
	}
): Array<{ label: string; value: string; category: string }> {
	const today = moment();
	const options: Array<{ label: string; value: string; category: string }> = [];

	// Reorder weekday names based on firstDay setting
	const weekdayCodes = [...WEEKDAY_NAMES.slice(firstDay), ...WEEKDAY_NAMES.slice(0, firstDay)];

	weekdayCodes.forEach((dayName) => {
		// Get the actual day index for this day name
		const dayIndex = WEEKDAY_NAMES.indexOf(dayName);
		let targetDate = today.clone().day(dayIndex);
		if (targetDate.isSameOrBefore(today, "day")) {
			targetDate = targetDate.add(1, "week");
		}
		const label = translate(`common.weekdays.${dayName.toLowerCase()}`);
		options.push({
			label,
			value: targetDate.format("YYYY-MM-DD"),
			category: "weekday",
		});
	});

	return options;
}

// Helper to extract just the labels in order
function getLabels(options: Array<{ label: string }>): string[] {
	return options.map((option) => option.label);
}

describe("Issue #1433: Week Days Picker Ignores First Day of Week Setting", () => {
	describe("Current behavior (demonstrates the bug)", () => {
		it("should show that weekdays are always ordered starting from Sunday regardless of firstDay setting", () => {
			// Simulate what DateContextMenu currently does
			const optionsWithFirstDay0 = generateWeekdayOptionsLikeDateContextMenu(0);
			const optionsWithFirstDay1 = generateWeekdayOptionsLikeDateContextMenu(1);
			const optionsWithFirstDay6 = generateWeekdayOptionsLikeDateContextMenu(6);

			// BUG: All three produce the same order (Sunday first) regardless of firstDay
			expect(getLabels(optionsWithFirstDay0)).toEqual(WEEKDAY_NAMES);
			expect(getLabels(optionsWithFirstDay1)).toEqual(WEEKDAY_NAMES); // Should be Monday first!
			expect(getLabels(optionsWithFirstDay6)).toEqual(WEEKDAY_NAMES); // Should be Saturday first!
		});

		it("should show that with firstDay = 1 (Monday), Sunday is still first (BUG)", () => {
			const options = generateWeekdayOptionsLikeDateContextMenu(1);
			const labels = getLabels(options);

			// BUG: Even with firstDay = 1 (Monday), Sunday is still first!
			expect(labels[0]).toBe("Sunday");
			expect(labels[0]).not.toBe("Monday"); // This is the bug
		});
	});

	describe("Expected behavior (these tests should pass when the bug is fixed)", () => {
		it.failing("should order weekdays starting from Monday when firstDay = 1", () => {
			// Using the buggy current behavior function
			const options = generateWeekdayOptionsLikeDateContextMenu(1);
			const labels = getLabels(options);

			// Expected: Monday should be first when firstDay = 1
			// This test FAILS because of the bug
			expect(labels[0]).toBe("Monday");
			expect(labels).toEqual([
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
				"Sunday",
			]);
		});

		it.failing("should order weekdays starting from Saturday when firstDay = 6", () => {
			// Using the buggy current behavior function
			const options = generateWeekdayOptionsLikeDateContextMenu(6);
			const labels = getLabels(options);

			// Expected: Saturday should be first when firstDay = 6
			// This test FAILS because of the bug
			expect(labels[0]).toBe("Saturday");
			expect(labels).toEqual([
				"Saturday",
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
			]);
		});
	});

	describe("Correct implementation reference", () => {
		it("should show correct behavior with Monday first (firstDay = 1)", () => {
			const options = generateWeekdayOptionsWithFirstDayRespected(1);
			const labels = getLabels(options);

			expect(labels[0]).toBe("Monday");
			expect(labels).toEqual([
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
				"Sunday",
			]);
		});

		it("should show correct behavior with Sunday first (firstDay = 0)", () => {
			const options = generateWeekdayOptionsWithFirstDayRespected(0);
			const labels = getLabels(options);

			expect(labels[0]).toBe("Sunday");
			expect(labels).toEqual(WEEKDAY_NAMES);
		});

		it("should show correct behavior with Saturday first (firstDay = 6)", () => {
			const options = generateWeekdayOptionsWithFirstDayRespected(6);
			const labels = getLabels(options);

			expect(labels[0]).toBe("Saturday");
			expect(labels).toEqual([
				"Saturday",
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
			]);
		});
	});

	describe("Date calculation verification", () => {
		it("should verify dates are still correct after reordering", () => {
			// Both implementations should produce valid dates that match the labels
			const buggyOptions = generateWeekdayOptionsLikeDateContextMenu(1);
			const correctOptions = generateWeekdayOptionsWithFirstDayRespected(1);

			// Check buggy version dates match labels
			buggyOptions.forEach((option) => {
				const date = new Date(option.value);
				const actualDayName = WEEKDAY_NAMES[date.getDay()];
				expect(option.label).toBe(actualDayName);
			});

			// Check correct version dates match labels
			correctOptions.forEach((option) => {
				const date = new Date(option.value);
				const actualDayName = WEEKDAY_NAMES[date.getDay()];
				expect(option.label).toBe(actualDayName);
			});
		});

		it("should verify all dates are in the future (or today)", () => {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const options = generateWeekdayOptionsWithFirstDayRespected(1);

			options.forEach((option) => {
				const optionDate = new Date(option.value);
				expect(optionDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
			});
		});
	});

	describe("User experience scenarios", () => {
		it.failing("should provide consistent weekday ordering with calendar views when firstDay = 1", () => {
			// European/ISO standard: Monday is first day of week
			// The context menu should match calendar view settings
			const buggyOptions = generateWeekdayOptionsLikeDateContextMenu(1);
			const labels = getLabels(buggyOptions);

			// User expectation: Monday first, matching their calendar view
			// This test FAILS because of the bug
			expect(labels[0]).toBe("Monday");
			expect(labels[labels.length - 1]).toBe("Sunday");
		});

		it("should demonstrate the fix needed in DateContextMenu.getDateOptions()", () => {
			/**
			 * The fix in DateContextMenu.ts should:
			 *
			 * 1. Get firstDay from plugin settings:
			 *    const firstDay = this.options.plugin?.settings?.calendarViewSettings?.firstDay ?? 0;
			 *
			 * 2. Reorder the weekdayCodes array:
			 *    const weekdayCodes = [
			 *        ...["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
			 *            .slice(firstDay),
			 *        ...["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
			 *            .slice(0, firstDay)
			 *    ];
			 *
			 * 3. Update the loop to use the actual day index for date calculation:
			 *    const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			 *    weekdayCodes.forEach((dayName) => {
			 *        const dayIndex = WEEKDAY_NAMES.indexOf(dayName);
			 *        let targetDate = today.clone().day(dayIndex);
			 *        // ... rest of logic
			 *    });
			 */

			// Verify the fix approach works
			const fixedOptions = generateWeekdayOptionsWithFirstDayRespected(1);
			expect(getLabels(fixedOptions)[0]).toBe("Monday");
		});
	});
});
