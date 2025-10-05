/* eslint-disable no-console */
import TaskNotesPlugin from "../main";
import { requireApiVersion } from "obsidian";
import { buildTasknotesTaskListViewFactory } from "./view-factory";
import { buildTasknotesKanbanViewFactory } from "./kanban-view";
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

			// Consider it successful if either view registered successfully
			if (!taskListSuccess && !kanbanSuccess) {
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
	} catch (error) {
		console.error("[TaskNotes][Bases] Error during view unregistration:", error);
	}
}
