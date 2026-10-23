import { msg } from "@lingui/core/macro";
import { Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import type { TranslationKey } from "../../i18n";
import {
	createSettingGroup,
	configureTextSetting,
	configureToggleSetting,
	configureDropdownSetting,
	configureNumberSetting,
} from "../components/settingHelpers";
import { PropertySelectorModal } from "../../modals/PropertySelectorModal";
import { getAvailableProperties, getPropertyLabels } from "../../utils/propertyHelpers";
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

/**
 * Renders the Appearance & UI tab - visual customization settings
 */
export function renderAppearanceTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Task Cards Section
	const availableProperties = getAvailableProperties(plugin);
	const currentProperties = plugin.settings.defaultVisibleProperties || [];
	const currentLabels = getPropertyLabels(plugin, currentProperties);

	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Task cards", context: "settings.appearance.taskCards.header" })),
			description: translate(msg({ message: "Configure how task cards are displayed across all views.", context: "settings.appearance.taskCards.description" })),
		},
		(group) => {
			group.addSetting((setting) => {
				setting
					.setName(
						translate(msg({ message: "Default visible properties", context: "settings.appearance.taskCards.defaultVisibleProperties.name" }))
					)
					.setDesc(
						translate(
							msg({ message: "Choose which properties appear on task cards by default.", context: "settings.appearance.taskCards.defaultVisibleProperties.description" })
						)
					)
					.addButton((button) => {
						button.setButtonText(translate(msg({ message: "Configure", context: "common.configure" }))).onClick(() => {
							const modal = new PropertySelectorModal(
								plugin.app,
								availableProperties,
								currentProperties,
								async (selected) => {
									plugin.settings.defaultVisibleProperties = selected;
									save();
									new Notice(translate(msg({ message: "Default task card properties updated", context: "settings.appearance.taskCards.updated" })));
									// Re-render to update display
									renderAppearanceTab(container, plugin, save);
								},
								translate(msg({ message: "Select task card properties", context: "modals.propertySelector.title" })),
								translate(msg({ message: "Choose which properties to display in task cards. Selected properties appear in the order below.", context: "modals.propertySelector.description" })),
								plugin
							);
							modal.open();
						});
					});
			});

			// Show currently selected properties
			group.addSetting((setting) => {
				setting.setDesc(
					translate(msg({ message: "Currently showing: {properties}", context: "settings.appearance.taskCards.showing" }), {
						properties: currentLabels.join(", "),
					})
				);
				setting.settingEl.addClass("settings-view__group-description");
			});

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Group complete and skip actions in a submenu", context: "settings.appearance.taskCards.completionSubmenu.name" })),
						desc: translate(
							msg({ message: "Nest the complete and skip actions under a submenu in the task context menu. Turn off to show them directly in the menu.", context: "settings.appearance.taskCards.completionSubmenu.description" })
						),
						getValue: () => plugin.settings.completionMenuAsSubmenu,
						setValue: async (value: boolean) => {
							plugin.settings.completionMenuAsSubmenu = value;
							save();
						},
					})
			);
		}
	);

	// Display Formatting Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Display formatting", context: "settings.appearance.displayFormatting.header" })),
			description: translate(msg({ message: "Configure how dates, times, and other data are displayed across the plugin.", context: "settings.appearance.displayFormatting.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Time format", context: "settings.appearance.displayFormatting.timeFormat.name" })),
						desc: translate(
							msg({ message: "Display time in 12-hour or 24-hour format throughout the plugin", context: "settings.appearance.displayFormatting.timeFormat.description" })
						),
						options: [
							{
								value: "12",
								label: translate(
									msg({ message: "12-hour (AM/PM)", context: "settings.appearance.displayFormatting.timeFormat.options.twelveHour" })
								),
							},
							{
								value: "24",
								label: translate(
									msg({ message: "24-hour", context: "settings.appearance.displayFormatting.timeFormat.options.twentyFourHour" })
								),
							},
						],
						getValue: () => plugin.settings.calendarViewSettings.timeFormat,
						setValue: async (value: string) => {
							plugin.settings.calendarViewSettings.timeFormat = value as "12" | "24";
							save();
						},
					})
			);
		}
	);

	// Calendar View Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Calendar view", context: "settings.appearance.calendarView.header" })),
			description: translate(msg({ message: "Customize the appearance and behavior of the calendar view.", context: "settings.appearance.calendarView.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Default view", context: "settings.appearance.calendarView.defaultView.name" })),
						desc: translate(msg({ message: "The calendar view shown when opening the calendar tab", context: "settings.appearance.calendarView.defaultView.description" })),
						options: [
							{
								value: "dayGridMonth",
								label: translate(
									msg({ message: "Month grid", context: "settings.appearance.calendarView.defaultView.options.monthGrid" })
								),
							},
							{
								value: "timeGridWeek",
								label: translate(
									msg({ message: "Week timeline", context: "settings.appearance.calendarView.defaultView.options.weekTimeline" })
								),
							},
							{
								value: "timeGridDay",
								label: translate(
									msg({ message: "Day timeline", context: "settings.appearance.calendarView.defaultView.options.dayTimeline" })
								),
							},
							{
								value: "multiMonthYear",
								label: translate(
									msg({ message: "Year view", context: "settings.appearance.calendarView.defaultView.options.yearView" })
								),
							},
							{
								value: "timeGridCustom",
								label: translate(
									msg({ message: "Custom multi-day", context: "settings.appearance.calendarView.defaultView.options.customMultiDay" })
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
							renderAppearanceTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.calendarViewSettings.defaultView === "timeGridCustom") {
				group.addSetting(
					(setting) =>
						void configureNumberSetting(setting, {
							name: translate(msg({ message: "Custom view day count", context: "settings.appearance.calendarView.customDayCount.name" })),
							desc: translate(
								msg({ message: "Number of days to show in custom multi-day view", context: "settings.appearance.calendarView.customDayCount.description" })
							),
							placeholder: translate(
								msg({ message: "3", context: "settings.appearance.calendarView.customDayCount.placeholder" })
							),
							min: 2,
							max: 10,
							getValue: () => plugin.settings.calendarViewSettings.customDayCount,
							setValue: async (value: number) => {
								plugin.settings.calendarViewSettings.customDayCount = value;
								save();
							},
						})
				);
			}

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "First day of week", context: "settings.appearance.calendarView.firstDayOfWeek.name" })),
						desc: translate(
							msg({ message: "Which day should be the first column in week views", context: "settings.appearance.calendarView.firstDayOfWeek.description" })
						),
						options: [
							{ value: "0", label: translate(msg({ message: "Sunday", context: "common.weekdays.sunday" })) },
							{ value: "1", label: translate(msg({ message: "Monday", context: "common.weekdays.monday" })) },
							{ value: "2", label: translate(msg({ message: "Tuesday", context: "common.weekdays.tuesday" })) },
							{ value: "3", label: translate(msg({ message: "Wednesday", context: "common.weekdays.wednesday" })) },
							{ value: "4", label: translate(msg({ message: "Thursday", context: "common.weekdays.thursday" })) },
							{ value: "5", label: translate(msg({ message: "Friday", context: "common.weekdays.friday" })) },
							{ value: "6", label: translate(msg({ message: "Saturday", context: "common.weekdays.saturday" })) },
						],
						getValue: () => plugin.settings.calendarViewSettings.firstDay.toString(),
						setValue: async (value: string) => {
							plugin.settings.calendarViewSettings.firstDay = parseCalendarFirstDay(
								value,
								plugin.settings.calendarViewSettings.firstDay
							);
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show weekends", context: "settings.appearance.calendarView.showWeekends.name" })),
						desc: translate(
							msg({ message: "Display weekends in calendar views", context: "settings.appearance.calendarView.showWeekends.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.showWeekends,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.showWeekends = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show week numbers", context: "settings.appearance.calendarView.showWeekNumbers.name" })),
						desc: translate(
							msg({ message: "Display week numbers in calendar views", context: "settings.appearance.calendarView.showWeekNumbers.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.weekNumbers,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.weekNumbers = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show today highlight", context: "settings.appearance.calendarView.showTodayHighlight.name" })),
						desc: translate(
							msg({ message: "Highlight the current day in calendar views", context: "settings.appearance.calendarView.showTodayHighlight.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.showTodayHighlight,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.showTodayHighlight = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show current time indicator", context: "settings.appearance.calendarView.showCurrentTimeIndicator.name" })
						),
						desc: translate(
							msg({ message: "Display a line showing the current time in timeline views", context: "settings.appearance.calendarView.showCurrentTimeIndicator.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.nowIndicator,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.nowIndicator = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Selection mirror", context: "settings.appearance.calendarView.selectionMirror.name" })),
						desc: translate(
							msg({ message: "Show a visual preview while dragging to select time ranges", context: "settings.appearance.calendarView.selectionMirror.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.selectMirror,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.selectMirror = value;
							save();
						},
					})
			);

			// Calendar locale setting with blur validation
			group.addSetting((setting) => {
				setting
					.setName(translate(msg({ message: "Calendar locale", context: "settings.appearance.calendarView.calendarLocale.name" })))
					.setDesc(
						translate(msg({ message: "Calendar locale for date formatting and calendar system (e.g., \"en\", \"fa\" for Farsi/Persian, \"de\" for German). Leave empty to auto-detect from browser.", context: "settings.appearance.calendarView.calendarLocale.description" }))
					)
					.addText((text) => {
						text.setPlaceholder(
							translate(msg({ message: "Auto-detect", context: "settings.appearance.calendarView.calendarLocale.placeholder" }))
						);
						text.setValue(plugin.settings.calendarViewSettings.locale || "");
						text.inputEl.addClass("settings-view__input");

						// Validate and save on blur (when user clicks out of field)
						text.inputEl.addEventListener("blur", () => {
							const trimmed = text.getValue().trim();
							if (trimmed) {
								try {
									// Use Intl.getCanonicalLocales to validate the locale tag
									Intl.getCanonicalLocales(trimmed);
									plugin.settings.calendarViewSettings.locale = trimmed;
									save();
								} catch {
									// Invalid locale - show notice and clear the field
									new Notice(
										translate(
											msg({ message: "Invalid locale. Please enter a valid language tag (e.g., ''en'', ''de'', ''fr-FR'').", context: "settings.appearance.calendarView.calendarLocale.invalidLocale" })
										)
									);
									plugin.settings.calendarViewSettings.locale = "";
									text.setValue("");
									save();
								}
							} else {
								// Empty string is valid (means auto-detect)
								plugin.settings.calendarViewSettings.locale = "";
								save();
							}
						});
					});
			});
		}
	);

	// Default event visibility section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Default event visibility", context: "settings.appearance.defaultEventVisibility.header" })),
			description: translate(msg({ message: "Configure which event types are visible by default when opening the calendar. Users can still toggle these on/off in the calendar view.", context: "settings.appearance.defaultEventVisibility.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show scheduled tasks", context: "settings.appearance.defaultEventVisibility.showScheduledTasks.name" })
						),
						desc: translate(
							msg({ message: "Display tasks with scheduled dates by default", context: "settings.appearance.defaultEventVisibility.showScheduledTasks.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowScheduled,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowScheduled = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show due dates", context: "settings.appearance.defaultEventVisibility.showDueDates.name" })
						),
						desc: translate(
							msg({ message: "Display task due dates by default", context: "settings.appearance.defaultEventVisibility.showDueDates.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowDue,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowDue = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show due dates when scheduled", context: "settings.appearance.defaultEventVisibility.showDueWhenScheduled.name" })
						),
						desc: translate(
							msg({ message: "Display due dates even for tasks that already have scheduled dates", context: "settings.appearance.defaultEventVisibility.showDueWhenScheduled.description" })
						),
						getValue: () =>
							plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled =
								value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show time entries", context: "settings.appearance.defaultEventVisibility.showTimeEntries.name" })
						),
						desc: translate(
							msg({ message: "Display completed time tracking entries by default", context: "settings.appearance.defaultEventVisibility.showTimeEntries.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowTimeEntries,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowTimeEntries = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show recurring tasks", context: "settings.appearance.defaultEventVisibility.showRecurringTasks.name" })
						),
						desc: translate(
							msg({ message: "Display recurring task instances by default", context: "settings.appearance.defaultEventVisibility.showRecurringTasks.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowRecurring,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowRecurring = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show ICS events", context: "settings.appearance.defaultEventVisibility.showICSEvents.name" })
						),
						desc: translate(
							msg({ message: "Display events from ICS subscriptions by default", context: "settings.appearance.defaultEventVisibility.showICSEvents.description" })
						),
						getValue: () => plugin.settings.calendarViewSettings.defaultShowICSEvents,
						setValue: async (value: boolean) => {
							plugin.settings.calendarViewSettings.defaultShowICSEvents = value;
							save();
						},
					})
			);
		}
	);

	// Time Settings
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Time settings", context: "settings.appearance.timeSettings.header" })),
			description: translate(msg({ message: "Configure time-related display settings for timeline views.", context: "settings.appearance.timeSettings.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Time slot duration", context: "settings.appearance.timeSettings.timeSlotDuration.name" })),
						desc: translate(
							msg({ message: "Duration of each time slot in timeline views", context: "settings.appearance.timeSettings.timeSlotDuration.description" })
						),
						options: [
							{
								value: "00:15:00",
								label: translate(
									msg({ message: "15 minutes", context: "settings.appearance.timeSettings.timeSlotDuration.options.fifteenMinutes" })
								),
							},
							{
								value: "00:30:00",
								label: translate(
									msg({ message: "30 minutes", context: "settings.appearance.timeSettings.timeSlotDuration.options.thirtyMinutes" })
								),
							},
							{
								value: "01:00:00",
								label: translate(
									msg({ message: "60 minutes", context: "settings.appearance.timeSettings.timeSlotDuration.options.sixtyMinutes" })
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
					})
			);

			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(msg({ message: "Start time", context: "settings.appearance.timeSettings.startTime.name" })),
						desc: translate(msg({ message: "Earliest time shown in timeline views (HH:MM format)", context: "settings.appearance.timeSettings.startTime.description" })),
						placeholder: translate(
							msg({ message: "06:00", context: "settings.appearance.timeSettings.startTime.placeholder" })
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
									translate(msg({ message: "Invalid time format. Please use hh:mm (e.g., {example})", context: "settings.appearance.timeSettings.invalidFormat" }), {
										example: "08:00",
									})
								);
								return;
							}
							const [hours, minutes] = value.split(":").map(Number);
							if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
								new Notice(
									translate(msg({ message: "Invalid time. Hours must be 00-23 and minutes 00-59", context: "settings.appearance.timeSettings.invalidTime" }))
								);
								return;
							}
							plugin.settings.calendarViewSettings.slotMinTime = value + ":00";
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(msg({ message: "End time", context: "settings.appearance.timeSettings.endTime.name" })),
						desc: translate(msg({ message: "Latest time shown in timeline views (HH:MM format). Use values above 24:00 to show early next-day hours, such as 26:00 for 2 AM.", context: "settings.appearance.timeSettings.endTime.description" })),
						placeholder: translate(
							msg({ message: "26:00", context: "settings.appearance.timeSettings.endTime.placeholder" })
						),
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
									translate(msg({ message: "Invalid time format. Please use hh:mm (e.g., {example})", context: "settings.appearance.timeSettings.invalidFormat" }), {
										example: "26:00",
									})
								);
								return;
							}
							const result = normalizeCalendarTimeValue(value, "24:00:00", {
								maxHour: CALENDAR_END_TIME_MAX_HOUR,
								allowMaxHourOnlyAtZero: true,
							});
							if (!result.isValid) {
								new Notice(
									translate(msg({ message: "Invalid time. Use 00:00-48:00; values after midnight use 24:00-48:00, such as 26:00 for 2 am next day", context: "settings.appearance.timeSettings.invalidEndTime" }))
								);
								return;
							}
							plugin.settings.calendarViewSettings.slotMaxTime = result.value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureTextSetting(setting, {
						name: translate(msg({ message: "Initial scroll time", context: "settings.appearance.timeSettings.initialScrollTime.name" })),
						desc: translate(
							msg({ message: "Time to scroll to when opening timeline views (HH:MM format)", context: "settings.appearance.timeSettings.initialScrollTime.description" })
						),
						placeholder: translate(
							msg({ message: "09:00", context: "settings.appearance.timeSettings.initialScrollTime.placeholder" })
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
									translate(msg({ message: "Invalid time format. Please use hh:mm (e.g., {example})", context: "settings.appearance.timeSettings.invalidFormat" }), {
										example: "08:00",
									})
								);
								return;
							}
							const [hours, minutes] = value.split(":").map(Number);
							if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
								new Notice(
									translate(msg({ message: "Invalid time. Hours must be 00-23 and minutes 00-59", context: "settings.appearance.timeSettings.invalidTime" }))
								);
								return;
							}
							plugin.settings.calendarViewSettings.scrollTime = value + ":00";
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureNumberSetting(setting, {
						name: translate(msg({ message: "Event minimum height", context: "settings.appearance.timeSettings.eventMinHeight.name" })),
						desc: translate(
							msg({ message: "Minimum height for events in timeline views (pixels)", context: "settings.appearance.timeSettings.eventMinHeight.description" })
						),
						placeholder: translate(
							msg({ message: "15", context: "settings.appearance.timeSettings.eventMinHeight.placeholder" })
						),
						min: 5,
						max: 100,
						debounceMs: 300,
						getValue: () => plugin.settings.calendarViewSettings.eventMinHeight,
						setValue: async (value: number) => {
							plugin.settings.calendarViewSettings.eventMinHeight = value;
							save();
						},
					})
			);
		}
	);

	// UI Elements Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "UI elements", context: "settings.appearance.uiElements.header" })),
			description: translate(msg({ message: "Configure the display of various UI elements.", context: "settings.appearance.uiElements.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show tracked tasks in status bar", context: "settings.appearance.uiElements.showTrackedTasksInStatusBar.name" })
						),
						desc: translate(
							msg({ message: "Display currently tracked tasks in Obsidian''s status bar", context: "settings.appearance.uiElements.showTrackedTasksInStatusBar.description" })
						),
						getValue: () => plugin.settings.showTrackedTasksInStatusBar,
						setValue: async (value: boolean) => {
							plugin.settings.showTrackedTasksInStatusBar = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show relationships widget", context: "settings.appearance.uiElements.showRelationshipsWidget.name" })
						),
						desc: translate(
							msg({ message: "Display a widget showing all relationships for the current note (subtasks, projects, dependencies)", context: "settings.appearance.uiElements.showRelationshipsWidget.description" })
						),
						getValue: () => plugin.settings.showRelationships,
						setValue: async (value: boolean) => {
							plugin.settings.showRelationships = value;
							save();
							renderAppearanceTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.showRelationships) {
				group.addSetting(
					(setting) =>
						void configureDropdownSetting(setting, {
							name: translate(
								msg({ message: "Relationships position", context: "settings.appearance.uiElements.relationshipsPosition.name" })
							),
							desc: translate(
								msg({ message: "Where to position the relationships widget", context: "settings.appearance.uiElements.relationshipsPosition.description" })
							),
							options: [
								{
									value: "top",
									label: translate(
										msg({ message: "Top of note", context: "settings.appearance.uiElements.relationshipsPosition.options.top" })
									),
								},
								{
									value: "bottom",
									label: translate(
										msg({ message: "Bottom of note", context: "settings.appearance.uiElements.relationshipsPosition.options.bottom" })
									),
								},
							],
							getValue: () => plugin.settings.relationshipsPosition,
							setValue: async (value: string) => {
								plugin.settings.relationshipsPosition = value as "top" | "bottom";
								save();
							},
						})
				);
			}

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(msg({ message: "Show task card in note", context: "settings.appearance.uiElements.showTaskCardInNote.name" })),
						desc: translate(
							msg({ message: "Display a task card widget at the top of task notes showing the task details and actions", context: "settings.appearance.uiElements.showTaskCardInNote.description" })
						),
						getValue: () => plugin.settings.showTaskCardInNote,
						setValue: async (value: boolean) => {
							plugin.settings.showTaskCardInNote = value;
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Strike through completed task titles", context: "settings.appearance.uiElements.showCompletedTaskStrikethrough.name" })
						),
						desc: translate(
							msg({ message: "Draw a line through completed task card titles. Turn off to keep completed tasks easier to read", context: "settings.appearance.uiElements.showCompletedTaskStrikethrough.description" })
						),
						getValue: () => plugin.settings.showCompletedTaskStrikethrough,
						setValue: async (value: boolean) => {
							plugin.settings.showCompletedTaskStrikethrough = value;
							save();
							plugin.app.workspace.trigger("tasknotes:refresh-views");
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureToggleSetting(setting, {
						name: translate(
							msg({ message: "Show expandable subtasks", context: "settings.appearance.uiElements.showExpandableSubtasks.name" })
						),
						desc: translate(
							msg({ message: "Allow expanding/collapsing subtask sections in task cards", context: "settings.appearance.uiElements.showExpandableSubtasks.description" })
						),
						getValue: () => plugin.settings.showExpandableSubtasks,
						setValue: async (value: boolean) => {
							plugin.settings.showExpandableSubtasks = value;
							save();
							renderAppearanceTab(container, plugin, save);
						},
					})
			);

			if (plugin.settings.showExpandableSubtasks) {
				group.addSetting(
					(setting) =>
						void configureToggleSetting(setting, {
							name: translate(
								msg({ message: "Expand subtasks by default", context: "settings.appearance.uiElements.expandSubtasksByDefault.name" })
							),
							desc: translate(
								msg({ message: "Show project subtasks expanded when task cards are rendered", context: "settings.appearance.uiElements.expandSubtasksByDefault.description" })
							),
							getValue: () => plugin.settings.expandSubtasksByDefault,
							setValue: async (value: boolean) => {
								plugin.settings.expandSubtasksByDefault = value;
								save();
							},
						})
				);

				group.addSetting(
					(setting) =>
						void configureDropdownSetting(setting, {
							name: translate(
								msg({ message: "Subtask chevron position", context: "settings.appearance.uiElements.subtaskChevronPosition.name" })
							),
							desc: translate(
								msg({ message: "Position of expand/collapse chevrons in task cards", context: "settings.appearance.uiElements.subtaskChevronPosition.description" })
							),
							options: [
								{
									value: "left",
									label: translate(
										msg({ message: "Left side", context: "settings.appearance.uiElements.subtaskChevronPosition.options.left" })
									),
								},
								{
									value: "right",
									label: translate(
										msg({ message: "Right side", context: "settings.appearance.uiElements.subtaskChevronPosition.options.right" })
									),
								},
							],
							getValue: () => plugin.settings.subtaskChevronPosition,
							setValue: async (value: string) => {
								plugin.settings.subtaskChevronPosition = value as "left" | "right";
								save();
							},
						})
				);
			}

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Views button alignment", context: "settings.appearance.uiElements.viewsButtonAlignment.name" })),
						desc: translate(
							msg({ message: "Alignment of the views/filters button in the task interface", context: "settings.appearance.uiElements.viewsButtonAlignment.description" })
						),
						options: [
							{
								value: "left",
								label: translate(
									msg({ message: "Left side", context: "settings.appearance.uiElements.viewsButtonAlignment.options.left" })
								),
							},
							{
								value: "right",
								label: translate(
									msg({ message: "Right side", context: "settings.appearance.uiElements.viewsButtonAlignment.options.right" })
								),
							},
						],
						getValue: () => plugin.settings.viewsButtonAlignment,
						setValue: async (value: string) => {
							plugin.settings.viewsButtonAlignment = value as "left" | "right";
							save();
						},
					})
			);
		}
	);

	// Task Interaction Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Task interaction", context: "settings.general.taskInteraction.header" })),
			description: translate(msg({ message: "Configure how clicking on tasks behaves.", context: "settings.general.taskInteraction.description" })),
		},
		(group) => {
			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Single-click action", context: "settings.general.taskInteraction.singleClick.name" })),
						desc: translate(msg({ message: "Action performed when single-clicking a task card", context: "settings.general.taskInteraction.singleClick.description" })),
						options: [
							{
								value: "edit",
								label: translate(msg({ message: "Edit task", context: "settings.general.taskInteraction.actions.edit" })),
							},
							{
								value: "openNote",
								label: translate(
									msg({ message: "Open note", context: "settings.general.taskInteraction.actions.openNote" })
								),
							},
						],
						getValue: () => plugin.settings.singleClickAction,
						setValue: async (value: string) => {
							plugin.settings.singleClickAction = value as "edit" | "openNote";
							save();
						},
					})
			);

			group.addSetting(
				(setting) =>
					void configureDropdownSetting(setting, {
						name: translate(msg({ message: "Double-click action", context: "settings.general.taskInteraction.doubleClick.name" })),
						desc: translate(msg({ message: "Action performed when double-clicking a task card", context: "settings.general.taskInteraction.doubleClick.description" })),
						options: [
							{
								value: "edit",
								label: translate(msg({ message: "Edit task", context: "settings.general.taskInteraction.actions.edit" })),
							},
							{
								value: "openNote",
								label: translate(
									msg({ message: "Open note", context: "settings.general.taskInteraction.actions.openNote" })
								),
							},
							{
								value: "none",
								label: translate(msg({ message: "No action", context: "settings.general.taskInteraction.actions.none" })),
							},
						],
						getValue: () => plugin.settings.doubleClickAction,
						setValue: async (value: string) => {
							plugin.settings.doubleClickAction = value as
								| "edit"
								| "openNote"
								| "none";
							save();
						},
					})
			);
		}
	);
}
