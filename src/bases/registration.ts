/* eslint-disable no-console */
import TaskNotesPlugin from "../main";
import { requireApiVersion } from "obsidian";
import { buildTaskListViewFactory } from "./TaskListView";
import { buildKanbanViewFactory } from "./KanbanView";
import { buildCalendarViewFactory } from "./CalendarView";
import { buildMiniCalendarViewFactory } from "./MiniCalendarView";
import { registerBasesView, unregisterBasesView } from "./api";

/**
 * Register TaskNotes views with Bases plugin
 * Requires Obsidian 1.10.1+ (public Bases API with groupBy support)
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<void> {
	if (!plugin.settings.enableBases) return;
	// All views now require Obsidian 1.10.1+ (public Bases API with groupBy support)
	if (!requireApiVersion("1.10.1")) return;

	const attemptRegistration = async (): Promise<boolean> => {
		try {
			// Register Task List view using public API
			const taskListSuccess = registerBasesView(plugin, "tasknotesTaskList", {
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
							// Show all note and task properties that could be used for sub-grouping
							return prop.startsWith("note.") || prop.startsWith("task.");
						},
					},
					{
						type: "toggle",
						key: "enableSearch",
						displayName: "Enable search box",
						default: false,
					},
				],
			});

			// Register Kanban view using public API
			const kanbanSuccess = registerBasesView(plugin, "tasknotesKanban", {
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
							// Show all note properties that could be used for swimlanes
							return prop.startsWith("note.") || prop.startsWith("task.");
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
						type: "toggle",
						key: "enableSearch",
						displayName: "Enable search box",
						default: false,
					},
					{
						type: "multitext",
						key: "columnOrder",
						displayName: "Column Order (Advanced)",
						placeholder: "Auto-managed when dragging columns",
						default: "{}",
					},
				],
			});

			// Register Calendar view using public API
			const calendarSuccess = registerBasesView(plugin, "tasknotesCalendar", {
				name: "TaskNotes Calendar",
				icon: "tasknotes-simple",
				factory: buildCalendarViewFactory(plugin),
				options: () => {
						const calendarSettings = plugin.settings.calendarViewSettings;
						const t = (key: string) => plugin.i18n.translate(`views.basesCalendar.settings.${key}`);

						const options: any[] = [
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
										max: 30,
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
										key: "showTodayHighlight",
										displayName: t("layout.showTodayHighlight"),
										default: calendarSettings.showTodayHighlight,
									},
									{
										type: "toggle",
										key: "selectMirror",
										displayName: t("layout.showSelectionPreview"),
										default: calendarSettings.selectMirror,
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
										type: "toggle",
										key: "enableSearch",
										displayName: "Enable search box",
										default: false,
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
											// Only show date-type properties
											return prop.startsWith("note.") || prop.startsWith("file.");
										},
									},
									{
										type: "property",
										key: "endDateProperty",
										displayName: t("propertyBasedEvents.endDateProperty"),
										placeholder: t("propertyBasedEvents.endDatePropertyPlaceholder"),
										filter: (prop: string) => {
											// Only show date-type properties
											return prop.startsWith("note.") || prop.startsWith("file.");
										},
									},
									{
										type: "property",
										key: "titleProperty",
										displayName: t("propertyBasedEvents.titleProperty"),
										placeholder: t("propertyBasedEvents.titlePropertyPlaceholder"),
										filter: (prop: string) => {
											// Show text properties (note, formula, file)
											return prop.startsWith("note.") || prop.startsWith("formula.") || prop.startsWith("file.");
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
								const icsToggles: any[] = subscriptions.map(sub => ({
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
								const googleToggles: any[] = availableCalendars.map(cal => ({
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
								const microsoftToggles: any[] = availableCalendars.map(cal => ({
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
				});

			// Register Mini Calendar view using public API
			const miniCalendarSuccess = registerBasesView(plugin, "tasknotesMiniCalendar", {
				name: "TaskNotes Mini Calendar",
				icon: "tasknotes-simple",
				factory: buildMiniCalendarViewFactory(plugin),
				options: () => [
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
							return prop.startsWith("note.") || prop.startsWith("formula.") || prop.startsWith("file.");
						},
					},
				],
			});

			// Consider it successful if any view registered successfully
			if (!taskListSuccess && !kanbanSuccess && !calendarSuccess && !miniCalendarSuccess) {
				console.debug("[TaskNotes][Bases] Bases plugin not available for registration");
				return false;
			}

			// Refresh existing Bases views
			plugin.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view?.getViewType?.() === "bases") {
					const view = leaf.view as any;
					if (typeof view.refresh === "function") {
						try {
							view.refresh();
						} catch (refreshError) {
							console.debug(
								"[TaskNotes][Bases] Error refreshing view:",
								refreshError
							);
						}
					}
				}
			});

			return true;
		} catch (error) {
			console.warn("[TaskNotes][Bases] Registration attempt failed:", error);
			return false;
		}
	};

	// Try immediate registration
	if (await attemptRegistration()) {
		return;
	}

	// If that fails, try a few more times with short delays
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => setTimeout(r, 200));
		if (await attemptRegistration()) {
			return;
		}
	}

	console.warn("[TaskNotes][Bases] Failed to register views after multiple attempts");
}

/**
 * Unregister TaskNotes views from Bases plugin
 */
export function unregisterBasesViews(plugin: TaskNotesPlugin): void {
	try {
		// Unregister views using wrapper (uses internal API as public API doesn't provide unregister)
		unregisterBasesView(plugin, "tasknotesTaskList");
		unregisterBasesView(plugin, "tasknotesKanban");
		unregisterBasesView(plugin, "tasknotesCalendar");
		unregisterBasesView(plugin, "tasknotesMiniCalendar");
	} catch (error) {
		console.error("[TaskNotes][Bases] Error during view unregistration:", error);
	}
}
