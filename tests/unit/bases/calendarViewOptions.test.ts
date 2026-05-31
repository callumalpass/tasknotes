import type { BasesAllOptions, BasesOptions } from "obsidian";
import { buildCalendarViewOptions } from "../../../src/bases/calendarViewOptions";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

type TestConfig = {
	get(key: string): unknown;
};

type TestGroup = Extract<BasesAllOptions, { type: "group" }>;

function createConfig(values: Record<string, unknown> = {}): TestConfig {
	return {
		get: (key: string) => values[key],
	};
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			calendarViewSettings: {
				...DEFAULT_SETTINGS.calendarViewSettings,
				defaultView: "timeGridWeek",
			},
		},
		i18n: {
			translate: (key: string) => key,
		},
	} as unknown as TaskNotesPlugin;
}

function isGroup(option: BasesAllOptions): option is TestGroup {
	return option.type === "group";
}

function findGroup(options: BasesAllOptions[], groupKey: string): TestGroup {
	const displayName = `views.basesCalendar.settings.groups.${groupKey}`;
	const group = options.find((option) => isGroup(option) && option.displayName === displayName);
	if (!group || !isGroup(group)) {
		throw new Error(`Missing group ${groupKey}`);
	}
	return group;
}

function findOption(options: BasesAllOptions[], key: string): BasesOptions {
	for (const option of options) {
		if (isGroup(option)) {
			const child = option.items.find((item) => item.key === key);
			if (child) {
				return child;
			}
			continue;
		}

		if (option.key === key) {
			return option;
		}
	}

	throw new Error(`Missing option ${key}`);
}

function isHidden(option: BasesOptions | TestGroup): boolean {
	return option.shouldHide?.() ?? false;
}

describe("calendar view options", () => {
	it("splits the Calendar menu into task-oriented groups", () => {
		const options = buildCalendarViewOptions(createPlugin(), createConfig());

		expect(options.filter(isGroup).map((group) => group.displayName)).toEqual([
			"views.basesCalendar.settings.groups.events",
			"views.basesCalendar.settings.groups.dateNavigation",
			"views.basesCalendar.settings.groups.view",
			"views.basesCalendar.settings.groups.display",
			"views.basesCalendar.settings.groups.timeGrid",
			"views.basesCalendar.settings.groups.eventLayout",
			"views.basesCalendar.settings.groups.propertyBasedEvents",
		]);
	});

	it("only shows custom range controls for their matching Calendar view", () => {
		const plugin = createPlugin();
		const listOptions = buildCalendarViewOptions(
			plugin,
			createConfig({ calendarView: "listWeek" })
		);
		const customOptions = buildCalendarViewOptions(
			plugin,
			createConfig({ calendarView: "timeGridCustom" })
		);

		expect(isHidden(findOption(listOptions, "listDayCount"))).toBe(false);
		expect(isHidden(findOption(listOptions, "customDayCount"))).toBe(true);
		expect(isHidden(findOption(customOptions, "listDayCount"))).toBe(true);
		expect(isHidden(findOption(customOptions, "customDayCount"))).toBe(false);
	});

	it("hides time-grid controls outside time-grid views", () => {
		const plugin = createPlugin();
		const monthOptions = buildCalendarViewOptions(
			plugin,
			createConfig({ calendarView: "dayGridMonth" })
		);
		const weekOptions = buildCalendarViewOptions(
			plugin,
			createConfig({ calendarView: "timeGridWeek" })
		);

		expect(isHidden(findGroup(monthOptions, "timeGrid"))).toBe(true);
		expect(isHidden(findGroup(weekOptions, "timeGrid"))).toBe(false);
		expect(isHidden(findOption(monthOptions, "eventMaxStack"))).toBe(true);
		expect(isHidden(findOption(weekOptions, "eventMaxStack"))).toBe(false);
	});

	it("only shows month density controls for month and year views", () => {
		const plugin = createPlugin();
		const monthOptions = buildCalendarViewOptions(
			plugin,
			createConfig({ calendarView: "dayGridMonth" })
		);
		const weekOptions = buildCalendarViewOptions(
			plugin,
			createConfig({ calendarView: "timeGridWeek" })
		);

		expect(isHidden(findOption(monthOptions, "dayMaxEvents"))).toBe(false);
		expect(isHidden(findOption(monthOptions, "dayMaxEventRows"))).toBe(false);
		expect(isHidden(findOption(weekOptions, "dayMaxEvents"))).toBe(true);
		expect(isHidden(findOption(weekOptions, "dayMaxEventRows"))).toBe(true);
	});

	it("hides dependent controls until their parent option is enabled", () => {
		const plugin = createPlugin();
		const options = buildCalendarViewOptions(
			plugin,
			createConfig({
				showRecurring: false,
				showPropertyBasedEvents: false,
				showDue: false,
			})
		);

		expect(isHidden(findOption(options, "showCompletedRecurringInstances"))).toBe(true);
		expect(isHidden(findOption(options, "showSkippedRecurringInstances"))).toBe(true);
		expect(isHidden(findOption(options, "showScheduledToDueSpan"))).toBe(true);
		expect(isHidden(findGroup(options, "propertyBasedEvents"))).toBe(true);
		expect(isHidden(findOption(options, "initialDateStrategy"))).toBe(true);
	});

	it("shows dependent controls when their parent option is configured", () => {
		const plugin = createPlugin();
		const options = buildCalendarViewOptions(
			plugin,
			createConfig({
				showRecurring: true,
				showPropertyBasedEvents: true,
				showScheduled: true,
				showDue: true,
				initialDateProperty: "note.scheduled",
			})
		);

		expect(isHidden(findOption(options, "showCompletedRecurringInstances"))).toBe(false);
		expect(isHidden(findOption(options, "showSkippedRecurringInstances"))).toBe(false);
		expect(isHidden(findOption(options, "showScheduledToDueSpan"))).toBe(false);
		expect(isHidden(findGroup(options, "propertyBasedEvents"))).toBe(false);
		expect(isHidden(findOption(options, "initialDateStrategy"))).toBe(false);
	});
});
