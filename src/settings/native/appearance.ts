import { Notice } from "obsidian";
import type { TranslationKey } from "../../i18n";
import { propertySelectionPage } from "./propertySelection";
import type { CalendarViewSettings } from "../../types/settings";
import { CALENDAR_END_TIME_MAX_HOUR, normalizeCalendarTimeValue } from "../../utils/calendarTime";
type CalendarDefaultView = CalendarViewSettings["defaultView"];
type CalendarFirstDay = CalendarViewSettings["firstDay"];
type CalendarSlotDuration = CalendarViewSettings["slotDuration"];
const CALENDAR_DEFAULT_VIEWS: readonly CalendarDefaultView[] = [
	"dayGridMonth",
	"timeGridWeek",
	"timeGridDay",
	"multiMonthYear",
	"timeGridCustom",
];
const CALENDAR_FIRST_DAYS: readonly CalendarFirstDay[] = [0, 1, 2, 3, 4, 5, 6];
const CALENDAR_SLOT_DURATIONS: readonly CalendarSlotDuration[] = [
	"00:15:00",
	"00:30:00",
	"01:00:00",
];
function isCalendarDefaultView(value: string): value is CalendarDefaultView {
	return CALENDAR_DEFAULT_VIEWS.some((view) => view === value);
}
function parseCalendarFirstDay(value: string, fallback: CalendarFirstDay): CalendarFirstDay {
	const parsed = Number.parseInt(value, 10);
	return CALENDAR_FIRST_DAYS.find((day) => day === parsed) ?? fallback;
}
function isCalendarSlotDuration(value: string): value is CalendarSlotDuration {
	return CALENDAR_SLOT_DURATIONS.some((duration) => duration === value);
}
import { SettingsContext } from "../native/SettingsContext";
import type { SettingDefinitionGroup } from "obsidian";

export function appearanceDefinitions(ctx: SettingsContext): SettingDefinitionGroup[] {
	const { plugin, save } = ctx;
	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
	return [
		{
			type: "group",
			heading: translate("settings.appearance.taskCards.header"),
			items: [
				propertySelectionPage(
					ctx,
					"defaultVisibleProperties",
					translate("settings.appearance.taskCards.defaultVisibleProperties.name"),
					translate("settings.appearance.taskCards.defaultVisibleProperties.description")
				),
				ctx.toggle("completionMenuAsSubmenu", {
					name: translate("settings.appearance.taskCards.completionSubmenu.name"),
					desc: translate("settings.appearance.taskCards.completionSubmenu.description"),
					getValue: () => plugin.settings.completionMenuAsSubmenu,
					setValue: async (value: boolean) => {
						plugin.settings.completionMenuAsSubmenu = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.appearance.displayFormatting.header"),
			items: [
				ctx.dropdown("dateDisplayFormat", {
					name: translate("settings.appearance.displayFormatting.dateFormat.name"),
					desc: translate("settings.appearance.displayFormatting.dateFormat.description"),
					options: [
						{ value: "default", label: translate("settings.appearance.displayFormatting.dateFormat.options.default") },
						{ value: "iso", label: "ISO 8601 (2026-08-23)" },
					],
					getValue: () => plugin.settings.dateDisplayFormat,
					setValue: async (value: string) => {
						if (value !== "default" && value !== "iso") return;
						plugin.settings.dateDisplayFormat = value;
						save();
					},
				}),
				ctx.dropdown("calendarViewSettings.timeFormat", {
					name: translate("settings.appearance.displayFormatting.timeFormat.name"),
					desc: translate("settings.appearance.displayFormatting.timeFormat.description"),
					options: [
						{
							value: "12",
							label: translate(
								"settings.appearance.displayFormatting.timeFormat.options.twelveHour"
							),
						},
						{
							value: "24",
							label: translate(
								"settings.appearance.displayFormatting.timeFormat.options.twentyFourHour"
							),
						},
					],
					getValue: () => plugin.settings.calendarViewSettings.timeFormat,
					setValue: async (value: string) => {
						plugin.settings.calendarViewSettings.timeFormat = value as "12" | "24";
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.appearance.calendarView.header"),
			items: [
				ctx.dropdown("calendarViewSettings.defaultView", {
					name: translate("settings.appearance.calendarView.defaultView.name"),
					desc: translate("settings.appearance.calendarView.defaultView.description"),
					options: [
						{
							value: "dayGridMonth",
							label: translate(
								"settings.appearance.calendarView.defaultView.options.monthGrid"
							),
						},
						{
							value: "timeGridWeek",
							label: translate(
								"settings.appearance.calendarView.defaultView.options.weekTimeline"
							),
						},
						{
							value: "timeGridDay",
							label: translate(
								"settings.appearance.calendarView.defaultView.options.dayTimeline"
							),
						},
						{
							value: "multiMonthYear",
							label: translate(
								"settings.appearance.calendarView.defaultView.options.yearView"
							),
						},
						{
							value: "timeGridCustom",
							label: translate(
								"settings.appearance.calendarView.defaultView.options.customMultiDay"
							),
						},
					],
					getValue: () => plugin.settings.calendarViewSettings.defaultView,
					setValue: async (value: string) => {
						if (!isCalendarDefaultView(value)) {
							return;
						}
						plugin.settings.calendarViewSettings.defaultView = value;
						save();
						// Re-render to show custom day count if needed
						ctx.refresh();
					},
				}),
				ctx.number(
					"calendarViewSettings.customDayCount",
					{
						name: translate("settings.appearance.calendarView.customDayCount.name"),
						desc: translate(
							"settings.appearance.calendarView.customDayCount.description"
						),
						placeholder: translate(
							"settings.appearance.calendarView.customDayCount.placeholder"
						),
						min: 2,
						max: 10,
						getValue: () => plugin.settings.calendarViewSettings.customDayCount,
						setValue: async (value: number) => {
							plugin.settings.calendarViewSettings.customDayCount = value;
							save();
						},
					},
					() => !(plugin.settings.calendarViewSettings.defaultView === "timeGridCustom")
				),
				ctx.dropdown("calendarViewSettings.firstDay", {
					name: translate("settings.appearance.calendarView.firstDayOfWeek.name"),
					desc: translate("settings.appearance.calendarView.firstDayOfWeek.description"),
					options: [
						{ value: "0", label: translate("common.weekdays.sunday") },
						{ value: "1", label: translate("common.weekdays.monday") },
						{ value: "2", label: translate("common.weekdays.tuesday") },
						{ value: "3", label: translate("common.weekdays.wednesday") },
						{ value: "4", label: translate("common.weekdays.thursday") },
						{ value: "5", label: translate("common.weekdays.friday") },
						{ value: "6", label: translate("common.weekdays.saturday") },
					],
					getValue: () => plugin.settings.calendarViewSettings.firstDay.toString(),
					setValue: async (value: string) => {
						plugin.settings.calendarViewSettings.firstDay = parseCalendarFirstDay(
							value,
							plugin.settings.calendarViewSettings.firstDay
						);
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.showWeekends", {
					name: translate("settings.appearance.calendarView.showWeekends.name"),
					desc: translate("settings.appearance.calendarView.showWeekends.description"),
					getValue: () => plugin.settings.calendarViewSettings.showWeekends,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.showWeekends = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.weekNumbers", {
					name: translate("settings.appearance.calendarView.showWeekNumbers.name"),
					desc: translate("settings.appearance.calendarView.showWeekNumbers.description"),
					getValue: () => plugin.settings.calendarViewSettings.weekNumbers,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.weekNumbers = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.showTodayHighlight", {
					name: translate("settings.appearance.calendarView.showTodayHighlight.name"),
					desc: translate(
						"settings.appearance.calendarView.showTodayHighlight.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.showTodayHighlight,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.showTodayHighlight = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.nowIndicator", {
					name: translate(
						"settings.appearance.calendarView.showCurrentTimeIndicator.name"
					),
					desc: translate(
						"settings.appearance.calendarView.showCurrentTimeIndicator.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.nowIndicator,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.nowIndicator = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.selectMirror", {
					name: translate("settings.appearance.calendarView.selectionMirror.name"),
					desc: translate("settings.appearance.calendarView.selectionMirror.description"),
					getValue: () => plugin.settings.calendarViewSettings.selectMirror,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.selectMirror = value;
						save();
					},
				}),
				ctx.text("calendarViewSettings.locale", {
					name: translate("settings.appearance.calendarView.calendarLocale.name"),
					desc: translate("settings.appearance.calendarView.calendarLocale.description"),
					getValue: () => plugin.settings.calendarViewSettings.locale || "",
					validate: (value) => {
						try {
							if (value.trim()) Intl.getCanonicalLocales(value.trim());
						} catch {
							return translate(
								"settings.appearance.calendarView.calendarLocale.invalidLocale"
							);
						}
					},
					setValue: (value) => {
						plugin.settings.calendarViewSettings.locale = value.trim();
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.appearance.defaultEventVisibility.header"),
			items: [
				ctx.toggle("calendarViewSettings.defaultShowScheduled", {
					name: translate(
						"settings.appearance.defaultEventVisibility.showScheduledTasks.name"
					),
					desc: translate(
						"settings.appearance.defaultEventVisibility.showScheduledTasks.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.defaultShowScheduled,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.defaultShowScheduled = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.defaultShowDue", {
					name: translate("settings.appearance.defaultEventVisibility.showDueDates.name"),
					desc: translate(
						"settings.appearance.defaultEventVisibility.showDueDates.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.defaultShowDue,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.defaultShowDue = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.defaultShowDueWhenScheduled", {
					name: translate(
						"settings.appearance.defaultEventVisibility.showDueWhenScheduled.name"
					),
					desc: translate(
						"settings.appearance.defaultEventVisibility.showDueWhenScheduled.description"
					),
					getValue: () =>
						plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.defaultShowTimeEntries", {
					name: translate(
						"settings.appearance.defaultEventVisibility.showTimeEntries.name"
					),
					desc: translate(
						"settings.appearance.defaultEventVisibility.showTimeEntries.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeEntries,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.defaultShowTimeEntries = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.defaultShowRecurring", {
					name: translate(
						"settings.appearance.defaultEventVisibility.showRecurringTasks.name"
					),
					desc: translate(
						"settings.appearance.defaultEventVisibility.showRecurringTasks.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.defaultShowRecurring,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.defaultShowRecurring = value;
						save();
					},
				}),
				ctx.toggle("calendarViewSettings.defaultShowICSEvents", {
					name: translate(
						"settings.appearance.defaultEventVisibility.showICSEvents.name"
					),
					desc: translate(
						"settings.appearance.defaultEventVisibility.showICSEvents.description"
					),
					getValue: () => plugin.settings.calendarViewSettings.defaultShowICSEvents,
					setValue: async (value: boolean) => {
						plugin.settings.calendarViewSettings.defaultShowICSEvents = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.appearance.timeSettings.header"),
			items: [
				ctx.dropdown("calendarViewSettings.slotDuration", {
					name: translate("settings.appearance.timeSettings.timeSlotDuration.name"),
					desc: translate(
						"settings.appearance.timeSettings.timeSlotDuration.description"
					),
					options: [
						{
							value: "00:15:00",
							label: translate(
								"settings.appearance.timeSettings.timeSlotDuration.options.fifteenMinutes"
							),
						},
						{
							value: "00:30:00",
							label: translate(
								"settings.appearance.timeSettings.timeSlotDuration.options.thirtyMinutes"
							),
						},
						{
							value: "01:00:00",
							label: translate(
								"settings.appearance.timeSettings.timeSlotDuration.options.sixtyMinutes"
							),
						},
					],
					getValue: () => plugin.settings.calendarViewSettings.slotDuration,
					setValue: async (value: string) => {
						if (!isCalendarSlotDuration(value)) {
							return;
						}
						plugin.settings.calendarViewSettings.slotDuration = value;
						save();
					},
				}),
				ctx.text("calendarViewSettings.slotMinTime", {
					validate: (value) =>
						/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
							? undefined
							: ctx.t("settings.native.invalidTimeHoursMustBe0023AndMinutes"),
					name: translate("settings.appearance.timeSettings.startTime.name"),
					desc: translate("settings.appearance.timeSettings.startTime.description"),
					placeholder: translate(
						"settings.appearance.timeSettings.startTime.placeholder"
					),
					debounceMs: 500,
					getValue: () => {
						const timeValue = plugin.settings.calendarViewSettings.slotMinTime;
						if (
							!timeValue ||
							timeValue.length < 5 ||
							!/^\d{2}:\d{2}:\d{2}$/.test(timeValue)
						) {
							return "00:00";
						}
						return timeValue.slice(0, 5);
					},
					setValue: async (value: string) => {
						if (!/^\d{2}:\d{2}$/.test(value)) {
							new Notice(
								ctx.t("settings.native.invalidTimeFormatPleaseUseHhMmFormatE")
							);
							return;
						}
						const [hours, minutes] = value.split(":").map(Number);
						if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
							new Notice(
								ctx.t("settings.native.invalidTimeHoursMustBe0023AndMinutes")
							);
							return;
						}
						plugin.settings.calendarViewSettings.slotMinTime = value + ":00";
						save();
					},
				}),
				ctx.text("calendarViewSettings.slotMaxTime", {
					validate: (value) =>
						/^\d{2}:\d{2}$/.test(value) &&
						normalizeCalendarTimeValue(value, "24:00:00", {
							maxHour: CALENDAR_END_TIME_MAX_HOUR,
							allowMaxHourOnlyAtZero: true,
						}).isValid
							? undefined
							: ctx.t("settings.native.invalidTimeUse00004800ValuesAfter"),
					name: translate("settings.appearance.timeSettings.endTime.name"),
					desc: translate("settings.appearance.timeSettings.endTime.description"),
					placeholder: translate("settings.appearance.timeSettings.endTime.placeholder"),
					debounceMs: 500,
					getValue: () => {
						const timeValue = plugin.settings.calendarViewSettings.slotMaxTime;
						if (
							!timeValue ||
							timeValue.length < 5 ||
							!/^\d{2}:\d{2}:\d{2}$/.test(timeValue)
						) {
							return "24:00";
						}
						return timeValue.slice(0, 5);
					},
					setValue: async (value: string) => {
						if (!/^\d{2}:\d{2}$/.test(value)) {
							new Notice(
								ctx.t("settings.native.invalidTimeFormatPleaseUseHhMmFormatE2")
							);
							return;
						}
						const result = normalizeCalendarTimeValue(value, "24:00:00", {
							maxHour: CALENDAR_END_TIME_MAX_HOUR,
							allowMaxHourOnlyAtZero: true,
						});
						if (!result.isValid) {
							new Notice(ctx.t("settings.native.invalidTimeUse00004800ValuesAfter"));
							return;
						}
						plugin.settings.calendarViewSettings.slotMaxTime = result.value;
						save();
					},
				}),
				ctx.text("calendarViewSettings.scrollTime", {
					validate: (value) =>
						/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
							? undefined
							: ctx.t("settings.native.invalidTimeHoursMustBe0023AndMinutes"),
					name: translate("settings.appearance.timeSettings.initialScrollTime.name"),
					desc: translate(
						"settings.appearance.timeSettings.initialScrollTime.description"
					),
					placeholder: translate(
						"settings.appearance.timeSettings.initialScrollTime.placeholder"
					),
					debounceMs: 500,
					getValue: () => {
						const timeValue = plugin.settings.calendarViewSettings.scrollTime;
						if (
							!timeValue ||
							timeValue.length < 5 ||
							!/^\d{2}:\d{2}:\d{2}$/.test(timeValue)
						) {
							return "08:00";
						}
						return timeValue.slice(0, 5);
					},
					setValue: async (value: string) => {
						if (!/^\d{2}:\d{2}$/.test(value)) {
							new Notice(
								ctx.t("settings.native.invalidTimeFormatPleaseUseHhMmFormatE")
							);
							return;
						}
						const [hours, minutes] = value.split(":").map(Number);
						if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
							new Notice(
								ctx.t("settings.native.invalidTimeHoursMustBe0023AndMinutes")
							);
							return;
						}
						plugin.settings.calendarViewSettings.scrollTime = value + ":00";
						save();
					},
				}),
				ctx.number("calendarViewSettings.eventMinHeight", {
					name: translate("settings.appearance.timeSettings.eventMinHeight.name"),
					desc: translate("settings.appearance.timeSettings.eventMinHeight.description"),
					placeholder: translate(
						"settings.appearance.timeSettings.eventMinHeight.placeholder"
					),
					min: 5,
					max: 100,
					debounceMs: 300,
					getValue: () => plugin.settings.calendarViewSettings.eventMinHeight,
					setValue: async (value: number) => {
						plugin.settings.calendarViewSettings.eventMinHeight = value;
						save();
					},
				}),
			],
		},
		{
			type: "group",
			heading: translate("settings.appearance.uiElements.header"),
			items: [
				ctx.toggle("showTrackedTasksInStatusBar", {
					name: translate(
						"settings.appearance.uiElements.showTrackedTasksInStatusBar.name"
					),
					desc: translate(
						"settings.appearance.uiElements.showTrackedTasksInStatusBar.description"
					),
					getValue: () => plugin.settings.showTrackedTasksInStatusBar,
					setValue: async (value: boolean) => {
						plugin.settings.showTrackedTasksInStatusBar = value;
						save();
					},
				}),
				ctx.toggle("showRelationships", {
					name: translate("settings.appearance.uiElements.showRelationshipsWidget.name"),
					desc: translate(
						"settings.appearance.uiElements.showRelationshipsWidget.description"
					),
					getValue: () => plugin.settings.showRelationships,
					setValue: async (value: boolean) => {
						plugin.settings.showRelationships = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.dropdown(
					"relationshipsPosition",
					{
						name: translate(
							"settings.appearance.uiElements.relationshipsPosition.name"
						),
						desc: translate(
							"settings.appearance.uiElements.relationshipsPosition.description"
						),
						options: [
							{
								value: "top",
								label: translate(
									"settings.appearance.uiElements.relationshipsPosition.options.top"
								),
							},
							{
								value: "bottom",
								label: translate(
									"settings.appearance.uiElements.relationshipsPosition.options.bottom"
								),
							},
						],
						getValue: () => plugin.settings.relationshipsPosition,
						setValue: async (value: string) => {
							plugin.settings.relationshipsPosition = value as "top" | "bottom";
							save();
						},
					},
					() => !plugin.settings.showRelationships
				),
				ctx.toggle("showTaskCardInNote", {
					name: translate("settings.appearance.uiElements.showTaskCardInNote.name"),
					desc: translate(
						"settings.appearance.uiElements.showTaskCardInNote.description"
					),
					getValue: () => plugin.settings.showTaskCardInNote,
					setValue: async (value: boolean) => {
						plugin.settings.showTaskCardInNote = value;
						save();
					},
				}),
				ctx.toggle("showCompletedTaskStrikethrough", {
					name: translate(
						"settings.appearance.uiElements.showCompletedTaskStrikethrough.name"
					),
					desc: translate(
						"settings.appearance.uiElements.showCompletedTaskStrikethrough.description"
					),
					getValue: () => plugin.settings.showCompletedTaskStrikethrough,
					setValue: async (value: boolean) => {
						plugin.settings.showCompletedTaskStrikethrough = value;
						save();
						plugin.app.workspace.trigger("tasknotes:refresh-views");
					},
				}),
				ctx.toggle("showExpandableSubtasks", {
					name: translate("settings.appearance.uiElements.showExpandableSubtasks.name"),
					desc: translate(
						"settings.appearance.uiElements.showExpandableSubtasks.description"
					),
					getValue: () => plugin.settings.showExpandableSubtasks,
					setValue: async (value: boolean) => {
						plugin.settings.showExpandableSubtasks = value;
						save();
						ctx.refresh();
					},
				}),
				ctx.toggle(
					"expandSubtasksByDefault",
					{
						name: translate(
							"settings.appearance.uiElements.expandSubtasksByDefault.name"
						),
						desc: translate(
							"settings.appearance.uiElements.expandSubtasksByDefault.description"
						),
						getValue: () => plugin.settings.expandSubtasksByDefault,
						setValue: async (value: boolean) => {
							plugin.settings.expandSubtasksByDefault = value;
							save();
						},
					},
					() => !plugin.settings.showExpandableSubtasks
				),
				ctx.dropdown(
					"subtaskChevronPosition",
					{
						name: translate(
							"settings.appearance.uiElements.subtaskChevronPosition.name"
						),
						desc: translate(
							"settings.appearance.uiElements.subtaskChevronPosition.description"
						),
						options: [
							{
								value: "left",
								label: translate(
									"settings.appearance.uiElements.subtaskChevronPosition.options.left"
								),
							},
							{
								value: "right",
								label: translate(
									"settings.appearance.uiElements.subtaskChevronPosition.options.right"
								),
							},
						],
						getValue: () => plugin.settings.subtaskChevronPosition,
						setValue: async (value: string) => {
							plugin.settings.subtaskChevronPosition = value as "left" | "right";
							save();
						},
					},
					() => !plugin.settings.showExpandableSubtasks
				),
			],
		},
		{
			type: "group",
			heading: translate("settings.general.taskInteraction.header"),
			items: [
				ctx.dropdown("singleClickAction", {
					name: translate("settings.general.taskInteraction.singleClick.name"),
					desc: translate("settings.general.taskInteraction.singleClick.description"),
					options: [
						{
							value: "edit",
							label: translate("settings.general.taskInteraction.actions.edit"),
						},
						{
							value: "openNote",
							label: translate("settings.general.taskInteraction.actions.openNote"),
						},
					],
					getValue: () => plugin.settings.singleClickAction,
					setValue: async (value: string) => {
						plugin.settings.singleClickAction = value as "edit" | "openNote";
						save();
					},
				}),
				ctx.dropdown("doubleClickAction", {
					name: translate("settings.general.taskInteraction.doubleClick.name"),
					desc: translate("settings.general.taskInteraction.doubleClick.description"),
					options: [
						{
							value: "edit",
							label: translate("settings.general.taskInteraction.actions.edit"),
						},
						{
							value: "openNote",
							label: translate("settings.general.taskInteraction.actions.openNote"),
						},
						{
							value: "none",
							label: translate("settings.general.taskInteraction.actions.none"),
						},
					],
					getValue: () => plugin.settings.doubleClickAction,
					setValue: async (value: string) => {
						plugin.settings.doubleClickAction = value as "edit" | "openNote" | "none";
						save();
					},
				}),
			],
		},
	];
}
