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
import { getCalendarDateDisplayOptions, formatCalendarISODate } from "../../../src/bases/calendarDateDisplay";
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
			translate: (key: string, params?: Record<string, unknown>) =>
				`${key} ${Object.values(params ?? {}).join(" ")}`,
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
		expect(values).toEqual(["2026-08-23 7:16 PM", "2026-08-23", "2026-08-23 7:16 PM", "2026-08-23 7:16 PM", task.path]);
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

	it("formats FullCalendar's own timezone parts and date ranges", () => {
		const start = { year: 2026, month: 11, day: 31 };
		const end = { year: 2027, month: 0, day: 1 };
		expect(formatCalendarISODate(start)).toBe("2026-12-31");
		const options = getCalendarDateDisplayOptions("iso");
		expect(options.dayHeaderFormat).toBeUndefined(); // Month weekday headings must not show placeholder dates.
		const timeGridHeader = options.views!.timeGrid.dayHeaderFormat as (arg: unknown) => string;
		expect(timeGridHeader({ date: start })).toBe("2026-12-31");
		const monthTitle = options.views!.dayGridMonth.titleFormat as (arg: unknown) => string;
		expect(monthTitle({ date: start })).toBe("2026-12");
		for (const name of ["dayPopoverFormat", "listDayFormat"] as const) {
			const formatter = options[name] as (arg: unknown) => string;
			expect(formatter({ date: start })).toBe("2026-12-31");
		}
		const title = options.titleFormat as (arg: unknown) => string;
		expect(title({ start, end })).toBe("2026-12-31 – 2027-01-01");
		expect(title({ start })).toBe("2026-12-31");
		expect(getCalendarDateDisplayOptions("default")).toEqual({});
	});
});
