import { DateValue } from "obsidian";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { buildSettingsDataForSave, buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import {
	createTimeFormatHelper,
	formatDateForDisplay,
	formatDateForStorage,
	formatDateLabel,
	formatDateTimeForDisplay,
	formatTimestampForDisplay,
	getDateDisplayPattern,
} from "../../../src/utils/dateUtils";
import { Calendar } from "@tasknotes/calendar";
import { createI18nService } from "../../../src/i18n";
import { observeTranslation } from "../../helpers/real-i18n";
import { getCalendarDateDisplayOptions, ISOCalendarFormatter, applyCalendarDateDisplay } from "../../../src/bases/calendarDateDisplay";
import { renderPropertyMetadata } from "../../../src/ui/taskCardProperties";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { TaskListView } from "../../../src/bases/TaskListView";
import { CalendarView } from "../../../src/bases/CalendarView";
import type { TaskInfo } from "../../../src/types";

// Exercise real date-fns tokens, not the suite's simplified format mock.
jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));
jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	DateValue: class {
		constructor(private value: string) {}
		static parseFromString(value: string) { return new this(value); }
		toString() { return this.value; }
		renderTo(el: HTMLElement) { el.textContent = "Native date display"; }
	},
}));

function pluginFixture() {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			dateDisplayFormat: "iso" as "iso" | "default",
			calendarViewSettings: { ...DEFAULT_SETTINGS.calendarViewSettings },
		},
		app: { renderContext: {}, metadataCache: {}, workspace: {} },
		fieldMapper: {
			lookupMappingKey: (key: string) => key,
			toUserField: (key: string) => key,
		},
		statusManager: { isCompletedStatus: () => false },
		i18n: {
			translate: observeTranslation(),
		},
	};
}

const task = {
	path: "Tasks/date-display.md", title: "Date display", status: "open", priority: "normal",
	due: "2026-08-23T19:16", scheduled: "2026-08-23",
	dateCreated: "2026-08-23T19:16", dateModified: "2026-08-23T19:16",
	completedDate: "2026-08-23", occurrence_date: "2026-08-23",
} as TaskInfo;

describe("#2354 date display preference", () => {
	afterEach(() => jest.useRealTimers());

	it("defaults existing settings and persists ISO without changing stored dates", () => {
		expect(buildSettingsFromLoadedData(null).settings.dateDisplayFormat).toBe("default");
		const settings = buildSettingsFromLoadedData({ dateDisplayFormat: "iso" }).settings;
		expect(settings.dateDisplayFormat).toBe("iso");
		expect(buildSettingsDataForSave({}, settings).dateDisplayFormat).toBe("iso");
		expect(formatDateForStorage(new Date(Date.UTC(2026, 7, 23)))).toBe("2026-08-23");
	});

	it.each(["2026-08-23", "2026-12-31", "2027-01-01"])("keeps date-only %s free of time and timezone shifts", (value) => {
		expect(formatDateTimeForDisplay(value, { dateDisplayFormat: "iso" })).toBe(value);
		expect(formatDateForDisplay(value, undefined, "iso")).toBe(value);
	});

	it("preserves default patterns and time-only requests", () => {
		expect(formatDateTimeForDisplay("2026-08-23")).toBe("Aug 23, 2026");
		expect(formatDateTimeForDisplay("2026-08-23", { dateDisplayFormat: "iso", dateFormat: "" })).toBe("");
		expect(formatDateTimeForDisplay("2026-08-23T19:16", { dateDisplayFormat: "iso", dateFormat: "" })).toBe("19:16");
		expect(getDateDisplayPattern("default", "MMM d")).toBe("MMM d");
	});

	it.each(["12", "24"] as const)("honors the %s-hour preference in all shared timestamp helpers", (clock) => {
		const expected = clock === "12" ? "2026-08-23 7:16 PM" : "2026-08-23 19:16";
		const value = "2026-08-23T19:16";
		expect(formatDateTimeForDisplay(value, { dateDisplayFormat: "iso", userTimeFormat: clock })).toBe(expected);
		expect(formatTimestampForDisplay(value, undefined, clock, "iso")).toBe(expected);
		expect(formatDateLabel(new Date(value), { dateDisplayFormat: "iso", calendarViewSettings: { timeFormat: clock } }, "MMM d", true)).toBe(expected);
		expect(createTimeFormatHelper(clock, "iso").formatDateTime(new Date(value))).toBe(expected);
	});

	it("converts timezone-bearing timestamps to local display without changing the instant", () => {
		const date = new Date(2026, 7, 23, 19, 16);
		expect(formatDateTimeForDisplay(date.toISOString(), { dateDisplayFormat: "iso" })).toBe("2026-08-23 19:16");
	});

	it("handles empty and invalid inputs without throwing", () => {
		for (const value of ["", "not-a-date"]) {
			expect(formatDateTimeForDisplay(value, { dateDisplayFormat: "iso" })).toBe(value);
			expect(formatTimestampForDisplay(value, undefined, "24", "iso")).toBe(value);
		}
	});

	it.each(["due", "scheduled", "dateCreated", "dateModified", "completedDate", "occurrenceDate"])("uses ISO for task-card %s, including today's dates", (property) => {
		jest.useFakeTimers().setSystemTime(new Date(2026, 7, 23, 12));
		const el = renderPropertyMetadata(document.createElement("div"), property, task, pluginFixture() as never);
		expect(el?.textContent).toContain("2026-08-23");
		expect(el?.textContent).not.toContain("error");
	});

	it("formats user-defined date properties and leaves string formulas alone", () => {
		const plugin = pluginFixture();
		const customTask = { ...task, customProperties: { reviewDate: new Date(2026, 7, 23) } };
		const el = renderPropertyMetadata(document.createElement("div"), "reviewDate", customTask, plugin as never);
		expect(el?.textContent).toContain("2026-08-23");
		const formulaTask = { ...task, basesData: { getValue: () => "Aug 23 (custom)" } };
		const formulaEl = renderPropertyMetadata(document.createElement("div"), "formula.custom", formulaTask as never, plugin as never);
		expect(formulaEl?.textContent).toContain("Aug 23 (custom)");
	});

	it.each(["2026-08-23", "2026-08-23T19:16"])("formats native Bases DateValue %s without rewriting string formulas", (value) => {
		const plugin = pluginFixture();
		const nativeTask = { ...task, basesData: { getValue: () => DateValue.parseFromString(value) } };
		const container = document.createElement("div");
		const el = renderPropertyMetadata(container, "file.ctime", nativeTask as never, plugin as never);
		expect(el?.textContent).toContain(value.replace("T", " "));
		plugin.settings.dateDisplayFormat = "default";
		const nativeEl = renderPropertyMetadata(container, "file.ctime", nativeTask as never, plugin as never);
		expect(nativeEl?.textContent).toContain("Native date display");
	});

	it("uses ISO and the chosen clock for all Task Information dates", () => {
		const plugin = pluginFixture();
		plugin.settings.calendarViewSettings.timeFormat = "12";
		const modal = Object.assign(Object.create(TaskEditModal.prototype), {
			plugin, task, t: (key: string) => key,
		});
		const container = document.createElement("div");
		modal.createMetadataSection(container);
		const values = Array.from(container.querySelectorAll(".metadata-value"), el => el.textContent);
		expect(values).toEqual(["2026-08-23 7:16 PM", "2026-08-23 7:16 PM", task.path]);
	});

	it("invalidates calendar and task-list render caches when only the date setting changes", () => {
		const plugin = pluginFixture();
		const calendar = Object.assign(Object.create(CalendarView.prototype), { plugin, config: { get: () => undefined } });
		const list = Object.assign(Object.create(TaskListView.prototype), { plugin });
		const calendarBefore = calendar.getConfigSnapshot();
		const listBefore = list.buildCardRenderSignature(["due"], {});
		plugin.settings.dateDisplayFormat = "default";
		expect(calendar.getConfigSnapshot()).not.toBe(calendarBefore);
		expect(list.buildCardRenderSignature(["due"], {})).not.toBe(listBefore);
	});

	it("formats engine civil days, headings, titles and popovers without OS timezone shifts", () => {
		const start = Date.UTC(2026, 11, 31) / 86400000;
		const end = start + 1;
		const fmt = new ISOCalendarFormatter("fr", true);
		expect(fmt.fullDate(start)).toBe("2026-12-31");
		expect(fmt.longDate(start)).toBe("2026-12-31");
		expect(fmt.listDay(start)).toBe("2026-12-31");
		expect(fmt.monthYear(start)).toBe("2026-12");
		expect(fmt.year(start)).toBe("2026");
		expect(fmt.range(start, end)).toBe("2026-12-31 – 2027-01-01");
		expect(fmt.range(start, start)).toBe("2026-12-31");
		const options = getCalendarDateDisplayOptions("iso");
		const calendar = new Calendar(document.createElement("div"), { ...options, date: "2026-12-31", view: "day", locale: "fr" });
		try {
			applyCalendarDateDisplay(calendar, "iso");
			expect(calendar.getView().title).toBe("2026-12-31");
			expect(options.dayHeaderContent?.(calendar.dayArg(start))).toBe("2026-12-31");
			calendar.changeView("month");
			expect(calendar.getView().title).toBe("2026-12");
			expect(options.dayHeaderContent?.(calendar.dayArg(start))).toBeUndefined();
			applyCalendarDateDisplay(calendar, "default");
			expect(calendar.getView().title).toMatch(/décembre.*2026/);
		} finally { calendar.destroy(); }
		expect(getCalendarDateDisplayOptions("default").dayHeaderContent).toBeUndefined();
	});

	it("combines localized default dates, ISO dates and the explicit clock preference", () => {
		createI18nService({ initialLocale: "fr" });
		try {
			expect(formatDateForDisplay("2026-08-23")).toContain("août");
			expect(formatDateLabel(new Date(2026, 7, 23), {})).toContain("août");
			expect(formatDateForDisplay("2026-08-23", undefined, "iso")).toBe("2026-08-23");
			expect(formatTimestampForDisplay("2026-08-23T19:16", undefined, "12", "iso")).toBe("2026-08-23 7:16 PM");
		} finally { createI18nService(); }
	});});
