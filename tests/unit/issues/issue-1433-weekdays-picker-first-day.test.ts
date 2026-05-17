import { DateContextMenu } from "../../../src/components/DateContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("obsidian");

function createPlugin(firstDay: number): TaskNotesPlugin {
	return {
		i18n: createI18nService(),
		settings: {
			calendarViewSettings: {
				firstDay,
			},
		},
	} as unknown as TaskNotesPlugin;
}

function getWeekdayLabels(firstDay: number): string[] {
	return new DateContextMenu({
		onSelect: jest.fn(),
		plugin: createPlugin(firstDay),
	})
		.getDateOptions()
		.filter((option) => option.category === "weekday")
		.map((option) => option.label);
}

describe("Issue #1433: weekday picker respects first day of week", () => {
	it("keeps Sunday first when firstDay is 0", () => {
		expect(getWeekdayLabels(0)).toEqual([
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		]);
	});

	it("starts weekdays with Monday when firstDay is 1", () => {
		expect(getWeekdayLabels(1)).toEqual([
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
			"Sunday",
		]);
	});

	it("starts weekdays with Saturday when firstDay is 6", () => {
		expect(getWeekdayLabels(6)).toEqual([
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
