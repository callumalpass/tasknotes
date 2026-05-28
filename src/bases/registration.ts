import type TaskNotesPlugin from "../main";
import { requireApiVersion } from "obsidian";
import type { BasesAllOptions, BasesOptions } from "obsidian";
import { buildTaskListViewFactory } from "./TaskListView";
import { buildKanbanViewFactory } from "./KanbanView";
import { buildCalendarViewFactory } from "./CalendarView";
import {
	DEFAULT_MINI_CALENDAR_HEAT_MAP_MAX_COUNT,
	buildMiniCalendarViewFactory,
} from "./MiniCalendarView";
import { registerBasesView, unregisterBasesView } from "./api";
import { isNoteFileOrFormulaProperty } from "./propertyFilters";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const KANBAN_CARD_LAYOUT_OPTIONS: Record<string, string> = {
	default: "Default",
	compact: "Compact",
};

const TASK_LIST_DEFAULT_COLLAPSED_STATE_OPTIONS: Record<string, string> = {
	Expanded: "Expanded",
	Collapsed: "Collapsed",
};

const EXPANDED_RELATIONSHIP_FILTER_MODE_OPTIONS: Record<string, string> = {
	inherit: "Inherit",
	"show-all": "Show all",
};

/**
 * Register TaskNotes views with Bases plugin
 * Requires Obsidian 1.10.1+ (public Bases API with groupBy support)
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<void> {
	if (!plugin.settings.enableBases) return;
	// All views now require Obsidian 1.10.1+ (public Bases API with groupBy support)
	if (!requireApiVersion("1.10.1")) return;
	const logger = createTaskNotesLogger({
		tag: "Bases/Registration",
		isDebugEnabled: () => plugin.settings.enableDebugLogging,
	});

	const attemptRegistration = async (): Promise<boolean> => {
		try {
			// Register Task List view using public API
			const taskListSuccess = registerBasesView(
				plugin,
				"tasknotesTaskList",
				{
					name: "TaskNotes Task List",
					icon: "tasknotes-simple",
					factory: buildTaskListViewFactory(plugin),
					options: () => [
						{
							type: "property",
							key: "subGroup",
							displayName: "Sub-group by",
							placeholder: "Select property for sub-grouping (optional)",
							filter: (prop: string) => {
								// Show all note, task, and formula properties that could be used for sub-grouping
								return prop.startsWith("note.") || prop.startsWith("task.") || prop.startsWith("formula.");
							},
						},
						{
							type: "toggle",
							key: "enableSearch",
							displayName: "Enable search box",
							default: false,
						},
						{
							type: "dropdown",
							key: "defaultCollapsedState",
							displayName: "Default collapsed state",
							default: "Expanded",
							options: TASK_LIST_DEFAULT_COLLAPSED_STATE_OPTIONS,
						},
						{
							type: "dropdown",
							key: "expandedRelationshipFilterMode",
							displayName: "Expanded relationships",
							default: "inherit",
							options: EXPANDED_RELATIONSHIP_FILTER_MODE_OPTIONS,
						},
					],
				},
				logger
			);

			// Register Kanban view using public API
			const kanbanSuccess = registerBasesView(
				plugin,
				"tasknotesKanban",
				{
					name: "TaskNotes Kanban",
					icon: "tasknotes-simple",
					factory: buildKanbanViewFactory(plugin),
					options: () => [
					{
						type: "property",
						key: "swimLane",
						displayName: "Swim Lane",
						placeholder: "Select property for swim lanes (optional)",
						filter: (prop: string) => {
							// Show all note, task, and formula properties that could be used for swimlanes
							return prop.startsWith("note.") || prop.startsWith("task.") || prop.startsWith("formula.");
						},
					},
					{
						type: "slider",
						key: "columnWidth",
						displayName: "Column Width",
						default: 280,
						min: 200,
						max: 500,
						step: 20,
					},
					{
						type: "slider",
						key: "maxSwimlaneHeight",
						displayName: "Max Swimlane Height",
						default: 600,
						min: 300,
						max: 1200,
						step: 50,
					},
					{
						type: "toggle",
						key: "hideEmptyColumns",
						displayName: "Hide Empty Columns",
						default: false,
					},
					{
						type: "text",
						key: "pinnedColumns",
						displayName: "Pinned Columns",
						placeholder: "Comma-separated column values to keep visible",
						default: "",
					},
					{
						type: "toggle",
						key: "hideEmptySwimLanes",
						displayName: "Hide Empty Swimlanes",
						default: false,
					},
					{
						type: "toggle",
						key: "enableSearch",
						displayName: "Enable search box",
						default: false,
					},
					{
						type: "toggle",
						key: "explodeListColumns",
						displayName: "Show items in multiple columns",
						default: true,
					},
					{
						type: "toggle",
						key: "consolidateStatusIcon",
						displayName: "Show status icon in column header only",
						default: false,
					},
					{
						type: "dropdown",
						key: "cardLayout",
						displayName: "Card layout",
						default: "default",
						options: KANBAN_CARD_LAYOUT_OPTIONS,
					},
					{
						type: "text",
						key: "columnOrder",
						displayName: "Column Order (Advanced)",
						placeholder: "Auto-managed when dragging columns",
						default: "{}",
					},
					{
						type: "text",
						key: "swimLaneOrder",
						displayName: "Swim Lane Order (Advanced)",
						placeholder: "JSON object keyed by swim lane property",
						default: "{}",
					},
					{
						type: "dropdown",
						key: "expandedRelationshipFilterMode",
						displayName: "Expanded relationships",
						default: "inherit",
						options: EXPANDED_RELATIONSHIP_FILTER_MODE_OPTIONS,
					},
					],
				},
				logger
			);

			// Register Calendar view using public API
			const calendarSuccess = registerBasesView(
				plugin,
				"tasknotesCalendar",
				{
					name: "TaskNotes Calendar",
					icon: "tasknotes-simple",
					factory: buildCalendarViewFactory(plugin),
					options: () => {
						const calendarSettings = plugin.settings.calendarViewSettings;
						const t = (key: string) => plugin.i18n.translate(`views.basesCalendar.settings.${key}`);

						const options: BasesAllOptions[] = [
							{
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
										key: "showRecurring",
										displayName: t("events.showRecurringTasks"),
										default: calendarSettings.defaultShowRecurring,
									},
									{
										type: "toggle",
										key: "showCompletedRecurringInstances",
										displayName: t("events.showCompletedRecurringInstances"),
										default: true,
									},
									{
										type: "toggle",
										key: "showSkippedRecurringInstances",
										displayName: t("events.showSkippedRecurringInstances"),
										default: true,
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
							},
							{
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
										filter: (prop: string) => {
											// Show date-type properties from notes and files
											return prop.startsWith("note.") || prop.startsWith("file.");
										},
									},
									{
										type: "dropdown",
										key: "initialDateStrategy",
										displayName: t("dateNavigation.propertyNavigationStrategy"),
										default: "first",
										options: {
											"first": t("dateNavigation.strategies.first"),
											"earliest": t("dateNavigation.strategies.earliest"),
											"latest": t("dateNavigation.strategies.latest"),
										},
									},
									{
										type: "toggle",
										key: "createDailyNotesFromDateLinks",
										displayName: t("dateNavigation.createDailyNotesFromDateLinks"),
										default: true,
									},
								],
							},
							{
								type: "group",
								displayName: t("groups.layout"),
								items: [
									{
										type: "dropdown",
										key: "calendarView",
										displayName: t("layout.calendarView"),
										default: calendarSettings.defaultView,
										options: {
											"dayGridMonth": "Month",
											"timeGridWeek": "Week",
											"timeGridCustom": "Custom days",
											"timeGridDay": "Day",
											"listWeek": "List",
											"multiMonthYear": "Year",
										},
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
									{
										type: "slider",
										key: "customDayCount",
										displayName: t("layout.customDayCount"),
										default: calendarSettings.customDayCount || 3,
										min: 1,
										max: 14,
										step: 1,
									},
									{
										type: "slider",
										key: "listDayCount",
										displayName: t("layout.listDayCount"),
										default: 7,
										min: 1,
										max: 365,
										step: 1,
									},
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
										type: "dropdown",
										key: "firstDay",
										displayName: t("layout.weekStartsOn"),
										default: String(calendarSettings.firstDay),
										options: {
											"0": plugin.i18n.translate("common.weekdays.sunday"),
											"1": plugin.i18n.translate("common.weekdays.monday"),
											"2": plugin.i18n.translate("common.weekdays.tuesday"),
											"3": plugin.i18n.translate("common.weekdays.wednesday"),
											"4": plugin.i18n.translate("common.weekdays.thursday"),
											"5": plugin.i18n.translate("common.weekdays.friday"),
											"6": plugin.i18n.translate("common.weekdays.saturday"),
										},
									},
									{
										type: "toggle",
										key: "weekNumbers",
										displayName: t("layout.showWeekNumbers"),
										default: calendarSettings.weekNumbers,
									},
									{
										type: "toggle",
										key: "nowIndicator",
										displayName: t("layout.showNowIndicator"),
										default: calendarSettings.nowIndicator,
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
										key: "showTimeGrid",
										displayName: t("layout.showTimeGrid"),
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
									},
									{
										type: "toggle",
										key: "selectMirror",
										displayName: t("layout.showSelectionPreview"),
										default: calendarSettings.selectMirror,
									},
									{
										type: "toggle",
										key: "slotEventOverlap",
										displayName: t("layout.slotEventOverlap"),
										default: calendarSettings.slotEventOverlap,
									},
									{
										type: "toggle",
										key: "enableSearch",
										displayName: t("layout.enableSearch"),
										default: false,
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
										type: "text",
										key: "scrollTime",
										displayName: t("layout.initialScrollTime"),
										default: calendarSettings.scrollTime,
										placeholder: t("layout.initialScrollTimePlaceholder"),
									},
									{
										type: "slider",
										key: "eventMinHeight",
										displayName: t("layout.minimumEventHeight"),
										default: calendarSettings.eventMinHeight,
										min: 15,
										max: 100,
										step: 5,
									},
									{
										type: "slider",
										key: "eventMaxStack",
										displayName: t("layout.eventMaxStack"),
										default: calendarSettings.eventMaxStack ?? 0,
										min: 0,
										max: 10,
										step: 1,
									},
									{
										type: "slider",
										key: "dayMaxEvents",
										displayName: t("layout.dayMaxEvents"),
										default: typeof calendarSettings.dayMaxEvents === 'number' ? calendarSettings.dayMaxEvents : 0,
										min: 0,
										max: 20,
										step: 1,
									},
									{
										type: "slider",
										key: "dayMaxEventRows",
										displayName: t("layout.dayMaxEventRows"),
										default: typeof calendarSettings.dayMaxEventRows === 'number' ? calendarSettings.dayMaxEventRows : 0,
										min: 0,
										max: 10,
										step: 1,
									},
									{
										type: "toggle",
										key: "showScheduledToDueSpan",
										displayName: t("layout.spanScheduledToDue"),
										default: calendarSettings.defaultShowScheduledToDueSpan,
									},
								],
							},
							{
								type: "group",
								displayName: t("groups.propertyBasedEvents"),
								items: [
									{
										type: "property",
										key: "startDateProperty",
										displayName: t("propertyBasedEvents.startDateProperty"),
										placeholder: t("propertyBasedEvents.startDatePropertyPlaceholder"),
										filter: (prop: string) => {
											// Include formula outputs; Bases does not expose formula result types here.
											return isNoteFileOrFormulaProperty(prop);
										},
									},
									{
										type: "property",
										key: "endDateProperty",
										displayName: t("propertyBasedEvents.endDateProperty"),
										placeholder: t("propertyBasedEvents.endDatePropertyPlaceholder"),
										filter: (prop: string) => {
											// Include formula outputs; Bases does not expose formula result types here.
											return isNoteFileOrFormulaProperty(prop);
										},
									},
									{
										type: "property",
										key: "titleProperty",
										displayName: t("propertyBasedEvents.titleProperty"),
										placeholder: t("propertyBasedEvents.titlePropertyPlaceholder"),
										filter: (prop: string) => {
											// Show text properties (note, formula, file)
											return isNoteFileOrFormulaProperty(prop);
										},
									},
								],
							},
						];

						// Add individual toggle for each ICS calendar subscription
						if (plugin.icsSubscriptionService) {
							const subscriptions = plugin.icsSubscriptionService.getSubscriptions();
							if (subscriptions.length > 0) {
								// Create a group for ICS calendars
								const icsToggles: BasesOptions[] = subscriptions.map(sub => ({
									type: "toggle",
									key: `showICS_${sub.id}`,
									displayName: sub.name,
									default: true,
								}));

								// Add as a group
								options.push({
									type: "group",
									displayName: t("groups.calendarSubscriptions"),
									items: icsToggles,
								});
							}
						}

						// Add individual toggle for each Google Calendar
						if (plugin.googleCalendarService) {
							const availableCalendars = plugin.googleCalendarService.getAvailableCalendars();
							if (availableCalendars.length > 0) {
								// Create toggles for Google calendars
								const googleToggles: BasesOptions[] = availableCalendars.map(cal => ({
									type: "toggle",
									key: `showGoogleCalendar_${cal.id}`,
									displayName: cal.summary || cal.id,
									default: true,
								}));

								// Add as a group
								options.push({
									type: "group",
									displayName: t("groups.googleCalendars") || "Google Calendars",
									items: googleToggles,
								});
							}
						}

						// Add individual toggle for each Microsoft Calendar
						if (plugin.microsoftCalendarService) {
							const availableCalendars = plugin.microsoftCalendarService.getAvailableCalendars();
							if (availableCalendars.length > 0) {
								// Create toggles for Microsoft calendars
								const microsoftToggles: BasesOptions[] = availableCalendars.map(cal => ({
									type: "toggle",
									key: `showMicrosoftCalendar_${cal.id}`,
									displayName: cal.summary || cal.id,
									default: true,
								}));

								// Add as a group
								options.push({
									type: "group",
									displayName: t("groups.microsoftCalendars") || "Microsoft Calendars",
									items: microsoftToggles,
								});
							}
						}

						return options;
					},
				},
				logger
			);

			// Register Mini Calendar view using public API
			const miniCalendarSuccess = registerBasesView(
				plugin,
				"tasknotesMiniCalendar",
				{
					name: "TaskNotes Mini Calendar",
					icon: "tasknotes-simple",
					factory: buildMiniCalendarViewFactory(plugin),
					options: () => {
					const t = (key: string) =>
						plugin.i18n.translate(`views.basesCalendar.settings.${key}`);
					const options: BasesAllOptions[] = [
						{
							type: "property",
							key: "dateProperty",
							displayName: "Date Property",
							placeholder: "Select property to show on calendar",
							default: "file.ctime",
							filter: (prop: string) => {
								// Show date-type properties from all sources
								return prop.startsWith("note.") || prop.startsWith("file.") || prop.startsWith("task.");
							},
						},
						{
							type: "property",
							key: "titleProperty",
							displayName: "Title Property",
							placeholder: "Select property to use as title",
							default: "file.name",
							filter: (prop: string) => {
								// Show text properties (note, formula, file)
								return isNoteFileOrFormulaProperty(prop);
							},
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

					if (plugin.icsSubscriptionService) {
						const subscriptions = plugin.icsSubscriptionService.getSubscriptions();
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
					}

					if (plugin.googleCalendarService) {
						const availableCalendars = plugin.googleCalendarService.getAvailableCalendars();
						if (availableCalendars.length > 0) {
							options.push({
								type: "group",
								displayName: t("groups.googleCalendars") || "Google Calendars",
								items: availableCalendars.map((cal) => ({
									type: "toggle",
									key: `showGoogleCalendar_${cal.id}`,
									displayName: cal.summary || cal.id,
									default: true,
								})),
							});
						}
					}

					if (plugin.microsoftCalendarService) {
						const availableCalendars = plugin.microsoftCalendarService.getAvailableCalendars();
						if (availableCalendars.length > 0) {
							options.push({
								type: "group",
								displayName: t("groups.microsoftCalendars") || "Microsoft Calendars",
								items: availableCalendars.map((cal) => ({
									type: "toggle",
									key: `showMicrosoftCalendar_${cal.id}`,
									displayName: cal.summary || cal.id,
									default: true,
								})),
							});
						}
					}

					return options;
				},
				},
				logger
			);

			// Consider it successful if any view registered successfully
			if (!taskListSuccess && !kanbanSuccess && !calendarSuccess && !miniCalendarSuccess) {
				logger.debug("Bases plugin not available for registration", {
					category: "configuration",
					operation: "register-views",
				});
				return false;
			}

			// Refresh existing Bases views
			plugin.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view?.getViewType?.() === "bases") {
					const view = leaf.view as { refresh?: () => void };
					if (typeof view.refresh === "function") {
						try {
							view.refresh();
						} catch (refreshError) {
							logger.debug("Error refreshing Bases view after registration", {
								category: "provider",
								operation: "refresh-existing-view",
								error: refreshError,
							});
						}
					}
				}
			});

			return true;
		} catch (error) {
			logger.warn("Registration attempt failed", {
				category: "provider",
				operation: "register-views",
				error,
			});
			return false;
		}
	};

	// Try immediate registration
	if (await attemptRegistration()) {
		return;
	}

	// If that fails, try a few more times with short delays
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => window.setTimeout(r, 200));
		if (await attemptRegistration()) {
			return;
		}
	}

	logger.warn("Failed to register views after multiple attempts", {
		category: "configuration",
		operation: "register-views",
	});
}

/**
 * Unregister TaskNotes views from Bases plugin
 */
export function unregisterBasesViews(plugin: TaskNotesPlugin): void {
	const logger = createTaskNotesLogger({
		tag: "Bases/Registration",
		isDebugEnabled: () => plugin.settings.enableDebugLogging,
	});
	try {
		// Unregister views using wrapper (uses internal API as public API doesn't provide unregister)
		unregisterBasesView(plugin, "tasknotesTaskList", logger);
		unregisterBasesView(plugin, "tasknotesKanban", logger);
		unregisterBasesView(plugin, "tasknotesCalendar", logger);
		unregisterBasesView(plugin, "tasknotesMiniCalendar", logger);
	} catch (error) {
		logger.error("Error during view unregistration", {
			category: "provider",
			operation: "unregister-views",
			error,
		});
	}
}
