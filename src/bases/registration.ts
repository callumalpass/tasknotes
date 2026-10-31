import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type TaskNotesPlugin from "../main";
import { requireApiVersion } from "obsidian";
import { buildTaskListViewFactory } from "./TaskListView";
import { buildKanbanViewFactory } from "./KanbanView";
import { buildCalendarViewFactory } from "./CalendarView";
import { buildMiniCalendarViewFactory } from "./MiniCalendarView";
import { registerBasesView, unregisterBasesView } from "./api";
import { buildCalendarViewOptions, buildMiniCalendarViewOptions } from "./calendarViewOptions";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const KANBAN_CARD_LAYOUT_OPTIONS: Record<string, string> = {
	get default() { return uiText(msg({ message: "Default", context: "bases/registration: defaults default" })); },
	get compact() { return uiText(msg({ message: "Compact", context: "bases/registration: defaults compact" })); },
};

const TASK_LIST_DEFAULT_COLLAPSED_STATE_OPTIONS: Record<string, string> = {
	get Expanded() { return uiText(msg({ message: "Expanded", context: "bases/registration: defaults Expanded" })); },
	get Collapsed() { return uiText(msg({ message: "Collapsed", context: "bases/registration: defaults Collapsed" })); },
};

const EXPANDED_RELATIONSHIP_FILTER_MODE_OPTIONS: Record<string, string> = {
	get inherit() { return uiText(msg({ message: "Inherit", context: "bases/registration: defaults inherit" })); },
	get "show-all"() { return uiText(msg({ message: "Show all", context: "bases/registration: defaults show-all" })); },
};

/**
 * Register TaskNotes views with Bases plugin
 * Requires Obsidian 1.10.1+ (public Bases API with groupBy support)
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<boolean> {
	if (!plugin.settings.enableBases) return false;
	// All views now require Obsidian 1.10.1+ (public Bases API with groupBy support)
	if (!requireApiVersion("1.10.1")) return false;
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
					name: uiText(msg({ message: "TaskNotes Task List", context: "bases/registration: registerBasesTaskList.attemptRegistration name" })),
					icon: "tasknotes-simple",
					factory: buildTaskListViewFactory(plugin),
					options: () => [
						{
							type: "property",
							key: "subGroup",
							displayName: uiText(msg({ message: "Sub-group by", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
							placeholder: uiText(msg({ message: "Select property for sub-grouping (optional)", context: "bases/registration: registerBasesTaskList.attemptRegistration.options placeholder" })),
							filter: (prop: string) => {
								// Show all note, task, and formula properties that could be used for sub-grouping
								return prop.startsWith("note.") || prop.startsWith("task.") || prop.startsWith("formula.");
							},
						},
						{
							type: "toggle",
							key: "enableSearch",
							displayName: uiText(msg({ message: "Enable search box", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
							default: false,
						},
						{
							type: "dropdown",
							key: "defaultCollapsedState",
							displayName: uiText(msg({ message: "Default collapsed state", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
							default: "Expanded",
							options: TASK_LIST_DEFAULT_COLLAPSED_STATE_OPTIONS,
						},
						{
							type: "dropdown",
							key: "expandedRelationshipFilterMode",
							displayName: uiText(msg({ message: "Expanded relationships", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
							default: "inherit",
							options: EXPANDED_RELATIONSHIP_FILTER_MODE_OPTIONS,
						},
						{
							type: "toggle",
							key: "hideTopLevelSubtasks",
							displayName: uiText(msg({ message: "Hide top-level subtasks", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
							default: false,
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
					name: uiText(msg({ message: "TaskNotes Kanban", context: "bases/registration: registerBasesTaskList.attemptRegistration name" })),
					icon: "tasknotes-simple",
					factory: buildKanbanViewFactory(plugin),
					options: () => [
					{
						type: "property",
						key: "swimLane",
						displayName: uiText(msg({ message: "Swim Lane", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						placeholder: uiText(msg({ message: "Select property for swim lanes (optional)", context: "bases/registration: registerBasesTaskList.attemptRegistration.options placeholder" })),
						filter: (prop: string) => {
							// Show all note, task, and formula properties that could be used for swimlanes
							return prop.startsWith("note.") || prop.startsWith("task.") || prop.startsWith("formula.");
						},
					},
					{
						type: "slider",
						key: "columnWidth",
						displayName: uiText(msg({ message: "Column Width", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: 280,
						min: 200,
						max: 500,
						step: 20,
					},
					{
						type: "slider",
						key: "maxSwimlaneHeight",
						displayName: uiText(msg({ message: "Max Swimlane Height", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: 600,
						min: 300,
						max: 1200,
						step: 50,
					},
					{
						type: "toggle",
						key: "hideEmptyColumns",
						displayName: uiText(msg({ message: "Hide Empty Columns", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: false,
					},
					{
						type: "text",
						key: "pinnedColumns",
						displayName: uiText(msg({ message: "Pinned Columns", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						placeholder: uiText(msg({ message: "Comma-separated column values to keep visible", context: "bases/registration: registerBasesTaskList.attemptRegistration.options placeholder" })),
						default: "",
					},
					{
						type: "toggle",
						key: "hideEmptySwimLanes",
						displayName: uiText(msg({ message: "Hide Empty Swimlanes", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: false,
					},
					{
						type: "toggle",
						key: "enableSearch",
						displayName: uiText(msg({ message: "Enable search box", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: false,
					},
					{
						type: "toggle",
						key: "explodeListColumns",
						displayName: uiText(msg({ message: "Show items in multiple columns", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: true,
					},
					{
						type: "toggle",
						key: "consolidateStatusIcon",
						displayName: uiText(msg({ message: "Show status icon in column header only", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: false,
					},
					{
						type: "dropdown",
						key: "cardLayout",
						displayName: uiText(msg({ message: "Card layout", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: "default",
						options: KANBAN_CARD_LAYOUT_OPTIONS,
					},
					{
						type: "text",
						key: "columnOrder",
						displayName: uiText(msg({ message: "Column Order (Advanced)", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						placeholder: uiText(msg({ message: "Auto-managed when dragging columns", context: "bases/registration: registerBasesTaskList.attemptRegistration.options placeholder" })),
						default: "{}",
					},
					{
						type: "text",
						key: "swimLaneOrder",
						displayName: uiText(msg({ message: "Swim Lane Order (Advanced)", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						placeholder: uiText(msg({ message: "JSON object keyed by swim lane property", context: "bases/registration: registerBasesTaskList.attemptRegistration.options placeholder" })),
						default: "{}",
					},
					{
						type: "dropdown",
						key: "expandedRelationshipFilterMode",
						displayName: uiText(msg({ message: "Expanded relationships", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: "inherit",
						options: EXPANDED_RELATIONSHIP_FILTER_MODE_OPTIONS,
					},
					{
						type: "toggle",
						key: "hideTopLevelSubtasks",
						displayName: uiText(msg({ message: "Hide top-level subtasks", context: "bases/registration: registerBasesTaskList.attemptRegistration.options displayName" })),
						default: false,
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
					name: uiText(msg({ message: "TaskNotes Calendar", context: "bases/registration: registerBasesTaskList.attemptRegistration name" })),
					icon: "tasknotes-simple",
					factory: buildCalendarViewFactory(plugin),
					options: (config) => buildCalendarViewOptions(plugin, config),
				},
				logger
			);

			// Register Mini Calendar view using public API
			const miniCalendarSuccess = registerBasesView(
				plugin,
				"tasknotesMiniCalendar",
				{
					name: uiText(msg({ message: "TaskNotes Mini Calendar", context: "bases/registration: registerBasesTaskList.attemptRegistration name" })),
					icon: "tasknotes-simple",
					factory: buildMiniCalendarViewFactory(plugin),
					options: () => buildMiniCalendarViewOptions(plugin),
				},
				logger
			);

			if (!taskListSuccess && !kanbanSuccess && !calendarSuccess && !miniCalendarSuccess) {
				logger.debug("Bases plugin not available for registration", {
					category: "configuration",
					operation: "register-views",
				});
				return false;
			}

			if (!taskListSuccess || !kanbanSuccess || !calendarSuccess || !miniCalendarSuccess) {
				logger.warn("Some TaskNotes Bases views failed to register", {
					category: "configuration",
					operation: "register-views",
					details: {
						taskListSuccess,
						kanbanSuccess,
						calendarSuccess,
						miniCalendarSuccess,
					},
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

	return attemptRegistration();
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
