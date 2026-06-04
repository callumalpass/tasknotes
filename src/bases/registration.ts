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
						{
							type: "toggle",
							key: "hideTopLevelSubtasks",
							displayName: "Hide top-level subtasks",
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
					{
						type: "toggle",
						key: "hideTopLevelSubtasks",
						displayName: "Hide top-level subtasks",
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
					name: "TaskNotes Calendar",
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
					name: "TaskNotes Mini Calendar",
					icon: "tasknotes-simple",
					factory: buildMiniCalendarViewFactory(plugin),
					options: () => buildMiniCalendarViewOptions(plugin),
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
