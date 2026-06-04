import type { BasesAllOptions, BasesOptions, BasesViewConfig } from "obsidian";
import type TaskNotesPlugin from "../main";
import { DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT } from "./MiniCalendarView";
import { isNoteFileOrFormulaProperty } from "./propertyFilters";

type CalendarOptionsConfig = Pick<BasesViewConfig, "get">;
type Translate = (key: string) => string;

const CALENDAR_VIEW_OPTIONS: Record<string, string> = {
	dayGridMonth: "Month",
	timeGridWeek: "Week",
	timeGridCustom: "Custom days",
	timeGridDay: "Day",
	listWeek: "List",
	multiMonthYear: "Year",
};

function translateCalendarSetting(plugin: TaskNotesPlugin): Translate {
	return (key: string) => plugin.i18n.translate(`views.basesCalendar.settings.${key}`);
}

function readOption<T>(config: CalendarOptionsConfig, key: string, fallback: T): T {
	const value = config.get(key);
	return value === null || value === undefined ? fallback : (value as T);
}

function readStringOption(config: CalendarOptionsConfig, key: string, fallback: string): string {
	const value = readOption<unknown>(config, key, fallback);
	return typeof value === "string" ? value : fallback;
}

function readBooleanOption(config: CalendarOptionsConfig, key: string, fallback: boolean): boolean {
	const value = readOption<unknown>(config, key, fallback);
	return typeof value === "boolean" ? value : fallback;
}

function hasConfiguredValue(config: CalendarOptionsConfig, key: string): boolean {
	const value = config.get(key);
	if (value === null || value === undefined) {
		return false;
	}
	return typeof value === "string" ? value.trim().length > 0 : true;
}

function getCalendarView(config: CalendarOptionsConfig, defaultView: string): string {
	return readStringOption(config, "calendarView", defaultView);
}

function isTimeGridView(viewType: string): boolean {
	return (
		viewType === "timeGridWeek" || viewType === "timeGridCustom" || viewType === "timeGridDay"
	);
}

function isMonthDensityView(viewType: string): boolean {
	return viewType === "dayGridMonth" || viewType === "multiMonthYear";
}

function isTodayWidthView(viewType: string): boolean {
	return viewType === "timeGridWeek" || viewType === "timeGridCustom";
}

function isCurrentView(
	config: CalendarOptionsConfig,
	defaultView: string,
	predicate: (viewType: string) => boolean
): boolean {
	return predicate(getCalendarView(config, defaultView));
}

function buildWeekdayOptions(plugin: TaskNotesPlugin): Record<string, string> {
	return {
		"0": plugin.i18n.translate("common.weekdays.sunday"),
		"1": plugin.i18n.translate("common.weekdays.monday"),
		"2": plugin.i18n.translate("common.weekdays.tuesday"),
		"3": plugin.i18n.translate("common.weekdays.wednesday"),
		"4": plugin.i18n.translate("common.weekdays.thursday"),
		"5": plugin.i18n.translate("common.weekdays.friday"),
		"6": plugin.i18n.translate("common.weekdays.saturday"),
	};
}

function buildExternalCalendarToggleGroups(
	plugin: TaskNotesPlugin,
	t: Translate
): BasesAllOptions[] {
	const options: BasesAllOptions[] = [];

	const subscriptions = plugin.icsSubscriptionService?.getSubscriptions() ?? [];
	if (subscriptions.length > 0) {
		options.push({
			type: "group",
			displayName: t("groups.calendarSubscriptions"),
			items: subscriptions.map((sub) => ({
				type: "toggle",
				key: `showICS_${sub.id}`,
				displayName: sub.name,
				default: true,
			})),
		});
	}

	const googleCalendars = plugin.googleCalendarService?.getAvailableCalendars() ?? [];
	if (googleCalendars.length > 0) {
		options.push({
			type: "group",
			displayName: t("groups.googleCalendars") || "Google Calendars",
			items: googleCalendars.map((cal) => ({
				type: "toggle",
				key: `showGoogleCalendar_${cal.id}`,
				displayName: cal.summary || cal.id,
				default: true,
			})),
		});
	}

	const microsoftCalendars = plugin.microsoftCalendarService?.getAvailableCalendars() ?? [];
	if (microsoftCalendars.length > 0) {
		options.push({
			type: "group",
			displayName: t("groups.microsoftCalendars") || "Microsoft Calendars",
			items: microsoftCalendars.map((cal) => ({
				type: "toggle",
				key: `showMicrosoftCalendar_${cal.id}`,
				displayName: cal.summary || cal.id,
				default: true,
			})),
		});
	}

	return options;
}

function buildCalendarEventOptions(
	plugin: TaskNotesPlugin,
	config: CalendarOptionsConfig,
	t: Translate
): BasesAllOptions {
	const calendarSettings = plugin.settings.calendarViewSettings;

	return {
		type: "group",
		displayName: t("groups.events"),
		items: [
			{
				type: "toggle",
				key: "showScheduled",
				displayName: t("events.showScheduledTasks"),
				default: calendarSettings.defaultShowScheduled,
			},
			{
				type: "toggle",
				key: "showDue",
				displayName: t("events.showDueTasks"),
				default: calendarSettings.defaultShowDue,
			},
			{
				type: "toggle",
				key: "showScheduledToDueSpan",
				displayName: t("layout.spanScheduledToDue"),
				default: calendarSettings.defaultShowScheduledToDueSpan,
				shouldHide: () =>
					!readBooleanOption(
						config,
						"showScheduled",
						calendarSettings.defaultShowScheduled
					) || !readBooleanOption(config, "showDue", calendarSettings.defaultShowDue),
			},
			{
				type: "toggle",
				key: "showRecurring",
				displayName: t("events.showRecurringTasks"),
				default: calendarSettings.defaultShowRecurring,
			},
			{
				type: "toggle",
				key: "showCompletedRecurringInstances",
				displayName: t("events.showCompletedRecurringInstances"),
				default: true,
				shouldHide: () =>
					!readBooleanOption(
						config,
						"showRecurring",
						calendarSettings.defaultShowRecurring
					),
			},
			{
				type: "toggle",
				key: "showSkippedRecurringInstances",
				displayName: t("events.showSkippedRecurringInstances"),
				default: true,
				shouldHide: () =>
					!readBooleanOption(
						config,
						"showRecurring",
						calendarSettings.defaultShowRecurring
					),
			},
			{
				type: "toggle",
				key: "showTimeEntries",
				displayName: t("events.showTimeEntries"),
				default: calendarSettings.defaultShowTimeEntries,
			},
			{
				type: "toggle",
				key: "showTimeblocks",
				displayName: t("events.showTimeblocks"),
				default: calendarSettings.defaultShowTimeblocks,
			},
			{
				type: "toggle",
				key: "showPropertyBasedEvents",
				displayName: t("events.showPropertyBasedEvents"),
				default: true,
			},
		],
	};
}

function buildCalendarDateNavigationOptions(
	config: CalendarOptionsConfig,
	t: Translate
): BasesAllOptions {
	return {
		type: "group",
		displayName: t("groups.dateNavigation"),
		items: [
			{
				type: "text",
				key: "initialDate",
				displayName: t("dateNavigation.navigateToDate"),
				default: "",
				placeholder: t("dateNavigation.navigateToDatePlaceholder"),
			},
			{
				type: "property",
				key: "initialDateProperty",
				displayName: t("dateNavigation.navigateToDateFromProperty"),
				placeholder: t("dateNavigation.navigateToDateFromPropertyPlaceholder"),
				filter: (prop: string) => prop.startsWith("note.") || prop.startsWith("file."),
			},
			{
				type: "dropdown",
				key: "initialDateStrategy",
				displayName: t("dateNavigation.propertyNavigationStrategy"),
				default: "first",
				options: {
					first: t("dateNavigation.strategies.first"),
					earliest: t("dateNavigation.strategies.earliest"),
					latest: t("dateNavigation.strategies.latest"),
				},
				shouldHide: () => !hasConfiguredValue(config, "initialDateProperty"),
			},
			{
				type: "toggle",
				key: "createDailyNotesFromDateLinks",
				displayName: t("dateNavigation.createDailyNotesFromDateLinks"),
				default: true,
			},
		],
	};
}

function buildCalendarViewModeOptions(
	plugin: TaskNotesPlugin,
	config: CalendarOptionsConfig,
	t: Translate
): BasesAllOptions {
	const calendarSettings = plugin.settings.calendarViewSettings;
	const defaultView = calendarSettings.defaultView;

	return {
		type: "group",
		displayName: t("groups.view"),
		items: [
			{
				type: "dropdown",
				key: "calendarView",
				displayName: t("layout.calendarView"),
				default: defaultView,
				options: CALENDAR_VIEW_OPTIONS,
			},
			{
				type: "slider",
				key: "customDayCount",
				displayName: t("layout.customDayCount"),
				default: calendarSettings.customDayCount || 3,
				min: 1,
				max: 14,
				step: 1,
				shouldHide: () => getCalendarView(config, defaultView) !== "timeGridCustom",
			},
			{
				type: "slider",
				key: "listDayCount",
				displayName: t("layout.listDayCount"),
				default: 7,
				min: 1,
				max: 365,
				step: 1,
				shouldHide: () => getCalendarView(config, defaultView) !== "listWeek",
			},
			{
				type: "dropdown",
				key: "heightMode",
				displayName: t("layout.heightMode"),
				default: "fill",
				options: {
					fill: t("layout.heightModeFill"),
					auto: t("layout.heightModeAuto"),
				},
			},
		],
	};
}

function buildCalendarDisplayOptions(
	plugin: TaskNotesPlugin,
	config: CalendarOptionsConfig,
	t: Translate
): BasesAllOptions {
	const calendarSettings = plugin.settings.calendarViewSettings;
	const defaultView = calendarSettings.defaultView;

	return {
		type: "group",
		displayName: t("groups.display"),
		items: [
			{
				type: "dropdown",
				key: "firstDay",
				displayName: t("layout.weekStartsOn"),
				default: String(calendarSettings.firstDay),
				options: buildWeekdayOptions(plugin),
			},
			{
				type: "dropdown",
				key: "timeFormat",
				displayName: t("layout.timeFormat"),
				default: calendarSettings.timeFormat,
				options: {
					"12": t("layout.timeFormat12"),
					"24": t("layout.timeFormat24"),
				},
			},
			{
				type: "toggle",
				key: "weekNumbers",
				displayName: t("layout.showWeekNumbers"),
				default: calendarSettings.weekNumbers,
				shouldHide: () => getCalendarView(config, defaultView) === "listWeek",
			},
			{
				type: "toggle",
				key: "showWeekends",
				displayName: t("layout.showWeekends"),
				default: calendarSettings.showWeekends,
			},
			{
				type: "toggle",
				key: "showAllDaySlot",
				displayName: t("layout.showAllDaySlot"),
				default: true,
			},
			{
				type: "toggle",
				key: "showTodayHighlight",
				displayName: t("layout.showTodayHighlight"),
				default: calendarSettings.showTodayHighlight,
			},
			{
				type: "slider",
				key: "todayColumnWidthMultiplier",
				displayName: t("layout.todayColumnWidthMultiplier"),
				default: 1,
				min: 1,
				max: 5,
				step: 0.5,
				shouldHide: () =>
					!isCurrentView(config, defaultView, (viewType) => isTodayWidthView(viewType)),
			},
			{
				type: "toggle",
				key: "enableSearch",
				displayName: t("layout.enableSearch"),
				default: false,
			},
		],
	};
}

function buildCalendarTimeGridOptions(plugin: TaskNotesPlugin, t: Translate): BasesOptions[] {
	const calendarSettings = plugin.settings.calendarViewSettings;

	return [
		{
			type: "text",
			key: "slotMinTime",
			displayName: t("layout.dayStartTime"),
			default: calendarSettings.slotMinTime,
			placeholder: t("layout.dayStartTimePlaceholder"),
		},
		{
			type: "text",
			key: "slotMaxTime",
			displayName: t("layout.dayEndTime"),
			default: calendarSettings.slotMaxTime,
			placeholder: t("layout.dayEndTimePlaceholder"),
		},
		{
			type: "text",
			key: "slotDuration",
			displayName: t("layout.timeSlotDuration"),
			default: calendarSettings.slotDuration,
			placeholder: t("layout.timeSlotDurationPlaceholder"),
		},
		{
			type: "text",
			key: "snapDuration",
			displayName: t("layout.dragDropResolution"),
			default: calendarSettings.slotDuration,
			placeholder: t("layout.dragDropResolutionPlaceholder"),
		},
		{
			type: "text",
			key: "scrollTime",
			displayName: t("layout.initialScrollTime"),
			default: calendarSettings.scrollTime,
			placeholder: t("layout.initialScrollTimePlaceholder"),
		},
		{
			type: "toggle",
			key: "nowIndicator",
			displayName: t("layout.showNowIndicator"),
			default: calendarSettings.nowIndicator,
		},
		{
			type: "toggle",
			key: "showTimeGrid",
			displayName: t("layout.showTimeGrid"),
			default: true,
		},
		{
			type: "toggle",
			key: "selectMirror",
			displayName: t("layout.showSelectionPreview"),
			default: calendarSettings.selectMirror,
		},
	];
}

function buildCalendarEventLayoutOptions(
	plugin: TaskNotesPlugin,
	config: CalendarOptionsConfig,
	t: Translate
): BasesOptions[] {
	const calendarSettings = plugin.settings.calendarViewSettings;
	const defaultView = calendarSettings.defaultView;
	const shouldHideTimeGridOption = () =>
		!isCurrentView(config, defaultView, (viewType) => isTimeGridView(viewType));
	const shouldHideMonthDensityOption = () =>
		!isCurrentView(config, defaultView, (viewType) => isMonthDensityView(viewType));

	return [
		{
			type: "toggle",
			key: "slotEventOverlap",
			displayName: t("layout.slotEventOverlap"),
			default: calendarSettings.slotEventOverlap,
			shouldHide: shouldHideTimeGridOption,
		},
		{
			type: "slider",
			key: "eventMinHeight",
			displayName: t("layout.minimumEventHeight"),
			default: calendarSettings.eventMinHeight,
			min: 15,
			max: 100,
			step: 5,
			shouldHide: shouldHideTimeGridOption,
		},
		{
			type: "slider",
			key: "eventMaxStack",
			displayName: t("layout.eventMaxStack"),
			default: calendarSettings.eventMaxStack ?? 0,
			min: 0,
			max: 10,
			step: 1,
			shouldHide: shouldHideTimeGridOption,
		},
		{
			type: "slider",
			key: "dayMaxEvents",
			displayName: t("layout.dayMaxEvents"),
			default:
				typeof calendarSettings.dayMaxEvents === "number"
					? calendarSettings.dayMaxEvents
					: 0,
			min: 0,
			max: 20,
			step: 1,
			shouldHide: shouldHideMonthDensityOption,
		},
		{
			type: "slider",
			key: "dayMaxEventRows",
			displayName: t("layout.dayMaxEventRows"),
			default:
				typeof calendarSettings.dayMaxEventRows === "number"
					? calendarSettings.dayMaxEventRows
					: 0,
			min: 0,
			max: 10,
			step: 1,
			shouldHide: shouldHideMonthDensityOption,
		},
	];
}

function buildCalendarPropertyEventOptions(
	config: CalendarOptionsConfig,
	t: Translate
): BasesAllOptions {
	return {
		type: "group",
		displayName: t("groups.propertyBasedEvents"),
		shouldHide: () => !readBooleanOption(config, "showPropertyBasedEvents", true),
		items: [
			{
				type: "property",
				key: "startDateProperty",
				displayName: t("propertyBasedEvents.startDateProperty"),
				placeholder: t("propertyBasedEvents.startDatePropertyPlaceholder"),
				filter: (prop: string) => isNoteFileOrFormulaProperty(prop),
			},
			{
				type: "property",
				key: "endDateProperty",
				displayName: t("propertyBasedEvents.endDateProperty"),
				placeholder: t("propertyBasedEvents.endDatePropertyPlaceholder"),
				filter: (prop: string) => isNoteFileOrFormulaProperty(prop),
			},
			{
				type: "property",
				key: "titleProperty",
				displayName: t("propertyBasedEvents.titleProperty"),
				placeholder: t("propertyBasedEvents.titlePropertyPlaceholder"),
				filter: (prop: string) => isNoteFileOrFormulaProperty(prop),
			},
		],
	};
}

export function buildCalendarViewOptions(
	plugin: TaskNotesPlugin,
	config: CalendarOptionsConfig
): BasesAllOptions[] {
	const t = translateCalendarSetting(plugin);
	const defaultView = plugin.settings.calendarViewSettings.defaultView;

	return [
		buildCalendarEventOptions(plugin, config, t),
		buildCalendarDateNavigationOptions(config, t),
		buildCalendarViewModeOptions(plugin, config, t),
		buildCalendarDisplayOptions(plugin, config, t),
		{
			type: "group",
			displayName: t("groups.timeGrid"),
			shouldHide: () =>
				!isCurrentView(config, defaultView, (viewType) => isTimeGridView(viewType)),
			items: buildCalendarTimeGridOptions(plugin, t),
		},
		{
			type: "group",
			displayName: t("groups.eventLayout"),
			shouldHide: () => {
				const viewType = getCalendarView(config, defaultView);
				return !isTimeGridView(viewType) && !isMonthDensityView(viewType);
			},
			items: buildCalendarEventLayoutOptions(plugin, config, t),
		},
		buildCalendarPropertyEventOptions(config, t),
		...buildExternalCalendarToggleGroups(plugin, t),
	];
}

export function buildMiniCalendarViewOptions(plugin: TaskNotesPlugin): BasesAllOptions[] {
	const t = translateCalendarSetting(plugin);
	const options: BasesAllOptions[] = [
		{
			type: "property",
			key: "dateProperty",
			displayName: "Date Property",
			placeholder: "Select property to show on calendar",
			default: "file.ctime",
			filter: (prop: string) =>
				prop.startsWith("note.") || prop.startsWith("file.") || prop.startsWith("task."),
		},
		{
			type: "property",
			key: "titleProperty",
			displayName: "Title Property",
			placeholder: "Select property to use as title",
			default: "file.name",
			filter: (prop: string) => isNoteFileOrFormulaProperty(prop),
		},
		{
			type: "slider",
			key: "heatMapMaxCount",
			displayName: "Max color note count",
			default: DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT,
			min: 1,
			max: 20,
			step: 1,
		},
	];

	options.push(...buildExternalCalendarToggleGroups(plugin, t));
	return options;
}
