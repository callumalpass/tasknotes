/**
 * Regression coverage for issue #1680.
 *
 * Bases stores custom view options under an `options` object in `.base` files.
 * CalendarView must read those values so `showPropertyBasedEvents: false`
 * actually suppresses property-based rows in Agenda/List views.
 */

import {
	getCalendarConfigValue,
	readCalendarConfigValue,
	type CalendarViewConfigReader,
} from "../../../src/bases/CalendarView";

function createConfig(values: Record<string, unknown>): CalendarViewConfigReader {
	return {
		get: (key: string) => values[key],
	};
}

describe("Issue #1680: agenda property-based event toggle", () => {
	it("reads false values from nested Bases options instead of falling back to defaults", () => {
		const config = createConfig({
			options: {
				showPropertyBasedEvents: false,
				calendarView: "listWeek",
			},
			startDateProperty: "file.ctime",
		});

		expect(readCalendarConfigValue(config, "showPropertyBasedEvents")).toBe(false);
		expect(getCalendarConfigValue(config, "showPropertyBasedEvents", true)).toBe(false);
		expect(getCalendarConfigValue(config, "calendarView", "timeGridWeek")).toBe("listWeek");
		expect(getCalendarConfigValue(config, "startDateProperty", null)).toBe("file.ctime");
	});

	it("keeps direct config values ahead of nested options values", () => {
		const config = createConfig({
			showPropertyBasedEvents: true,
			options: {
				showPropertyBasedEvents: false,
			},
		});

		expect(getCalendarConfigValue(config, "showPropertyBasedEvents", false)).toBe(true);
	});

	it("falls back when neither direct config nor nested options provide a value", () => {
		const config = createConfig({
			options: {},
		});

		expect(getCalendarConfigValue(config, "showPropertyBasedEvents", true)).toBe(true);
		expect(getCalendarConfigValue(config, "enableSearch", false)).toBe(false);
	});
});
