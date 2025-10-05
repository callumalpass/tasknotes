/* eslint-disable no-console */
import TaskNotesPlugin from "../main";
import { requireApiVersion } from "obsidian";
import { buildTasknotesTaskListViewFactory } from "./view-factory";
import { buildTasknotesKanbanViewFactory } from "./kanban-view";
import { buildTasknotesCalendarViewFactory } from "./calendar-view";
import { registerBasesView, unregisterBasesView } from "./api";

/**
 * Register TaskNotes views with Bases plugin
 * Uses public API (1.10.0+) with fallback to internal API
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<void> {
	if (!plugin.settings.enableBases) return;
	if (!requireApiVersion("1.9.12")) return;

	const attemptRegistration = async (): Promise<boolean> => {
		try {
			// Register Task List view using wrapper
			const taskListSuccess = registerBasesView(plugin, "tasknotesTaskList", {
				name: "TaskNotes Task List",
				icon: "tasknotes-simple",
				factory: buildTasknotesTaskListViewFactory(plugin),
			});

			// Register Kanban view using wrapper
			const kanbanSuccess = registerBasesView(plugin, "tasknotesKanban", {
				name: "TaskNotes Kanban",
				icon: "tasknotes-simple",
				factory: buildTasknotesKanbanViewFactory(plugin),
			});

			// Register Calendar view (1.10.0+ only - requires public Bases API)
			let calendarSuccess = false;
			if (requireApiVersion("1.10.0")) {
				calendarSuccess = registerBasesView(plugin, "tasknotesCalendar", {
					name: "TaskNotes Calendar",
					icon: "tasknotes-simple",
					factory: buildTasknotesCalendarViewFactory(plugin),
					options: () => {
						const calendarSettings = plugin.settings.calendarViewSettings;

						const options: any[] = [
							{
								type: "group",
								displayName: "Events",
								items: [
									{
										type: "toggle",
										key: "showScheduled",
										displayName: "Show scheduled tasks",
										default: calendarSettings.defaultShowScheduled,
									},
									{
										type: "toggle",
										key: "showDue",
										displayName: "Show due tasks",
										default: calendarSettings.defaultShowDue,
									},
									{
										type: "toggle",
										key: "showRecurring",
										displayName: "Show recurring tasks",
										default: calendarSettings.defaultShowRecurring,
									},
									{
										type: "toggle",
										key: "showTimeEntries",
										displayName: "Show time entries",
										default: calendarSettings.defaultShowTimeEntries,
									},
									{
										type: "toggle",
										key: "showTimeblocks",
										displayName: "Show timeblocks",
										default: calendarSettings.defaultShowTimeblocks,
									},
								],
							},
							{
								type: "group",
								displayName: "Layout",
								items: [
									{
										type: "dropdown",
										key: "calendarView",
										displayName: "Calendar view",
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
										displayName: "Custom day count",
										default: calendarSettings.customDayCount || 3,
										min: 1,
										max: 14,
										step: 1,
									},
									{
										type: "text",
										key: "slotMinTime",
										displayName: "Day start time",
										default: calendarSettings.slotMinTime,
										placeholder: "HH:mm:ss (e.g., 08:00:00)",
									},
									{
										type: "text",
										key: "slotMaxTime",
										displayName: "Day end time",
										default: calendarSettings.slotMaxTime,
										placeholder: "HH:mm:ss (e.g., 20:00:00)",
									},
									{
										type: "text",
										key: "slotDuration",
										displayName: "Time slot duration",
										default: calendarSettings.slotDuration,
										placeholder: "HH:mm:ss (e.g., 00:30:00)",
									},
									{
										type: "dropdown",
										key: "firstDay",
										displayName: "Week starts on",
										default: String(calendarSettings.firstDay),
										options: {
											"0": "Sunday",
											"1": "Monday",
											"2": "Tuesday",
											"3": "Wednesday",
											"4": "Thursday",
											"5": "Friday",
											"6": "Saturday",
										},
									},
									{
										type: "toggle",
										key: "weekNumbers",
										displayName: "Show week numbers",
										default: calendarSettings.weekNumbers,
									},
									{
										type: "toggle",
										key: "nowIndicator",
										displayName: "Show now indicator",
										default: calendarSettings.nowIndicator,
									},
									{
										type: "toggle",
										key: "showWeekends",
										displayName: "Show weekends",
										default: calendarSettings.showWeekends,
									},
									{
										type: "toggle",
										key: "showAllDaySlot",
										displayName: "Show all-day slot",
										default: true,
									},
									{
										type: "toggle",
										key: "showTodayHighlight",
										displayName: "Show today highlight",
										default: calendarSettings.showTodayHighlight,
									},
									{
										type: "toggle",
										key: "selectMirror",
										displayName: "Show selection preview",
										default: calendarSettings.selectMirror,
									},
									{
										type: "dropdown",
										key: "timeFormat",
										displayName: "Time format",
										default: calendarSettings.timeFormat,
										options: {
											"12": "12-hour (AM/PM)",
											"24": "24-hour",
										},
									},
									{
										type: "text",
										key: "scrollTime",
										displayName: "Initial scroll time",
										default: calendarSettings.scrollTime,
										placeholder: "HH:mm:ss (e.g., 08:00:00)",
									},
									{
										type: "slider",
										key: "eventMinHeight",
										displayName: "Minimum event height (px)",
										default: calendarSettings.eventMinHeight,
										min: 15,
										max: 100,
										step: 5,
									},
								],
							},
							{
								type: "group",
								displayName: "Property-based events",
								items: [
									{
										type: "property",
										key: "startDateProperty",
										displayName: "Start date property",
										placeholder: "Select property for start date/time",
										filter: (prop: string) => {
											// Only show date-type properties
											return prop.startsWith("note.") || prop.startsWith("file.");
										},
									},
									{
										type: "property",
										key: "endDateProperty",
										displayName: "End date property (optional)",
										placeholder: "Select property for end date/time",
										filter: (prop: string) => {
											// Only show date-type properties
											return prop.startsWith("note.") || prop.startsWith("file.");
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
									displayName: "Calendar subscriptions",
									items: icsToggles,
								});
							}
						}

						return options;
					},
				});
			}

			// Consider it successful if any view registered successfully
			if (!taskListSuccess && !kanbanSuccess && !calendarSuccess) {
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
	} catch (error) {
		console.error("[TaskNotes][Bases] Error during view unregistration:", error);
	}
}
