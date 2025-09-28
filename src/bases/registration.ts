import TaskNotesPlugin from "../main";
import { requireApiVersion } from "obsidian";
import { buildTasknotesTaskListViewFactory } from "./view-factory";
import { buildTasknotesKanbanViewFactory } from "./kanban-view";

/**
 * Register TaskNotes views with Bases plugin
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<void> {
	if (!plugin.settings.enableBases) return;
	if (!requireApiVersion("1.9.12")) return;

	const attemptRegistration = async (): Promise<boolean> => {
		try {
			// Direct access to Bases plugin
			const bases: any = ((plugin.app as any).internalPlugins as any).getEnabledPluginById?.(
				"bases"
			);
			if (!bases?.registrations) {
				console.debug("[TaskNotes][Bases] Bases plugin not available for registration");
				return false;
			}

			// Register Task List view directly
			if (!bases.registrations.tasknotesTaskList) {
				bases.registrations.tasknotesTaskList = {
					name: "TaskNotes Task List",
					icon: "tasknotes-simple",
					factory: buildTasknotesTaskListViewFactory(plugin),
				};
				console.log("[TaskNotes][Bases] Successfully registered tasknotesTaskList view");
			}

			// Register Kanban view directly
			if (!bases.registrations.tasknotesKanban) {
				bases.registrations.tasknotesKanban = {
					name: "TaskNotes Kanban",
					icon: "tasknotes-simple",
					factory: buildTasknotesKanbanViewFactory(plugin),
				};
				console.log("[TaskNotes][Bases] Successfully registered tasknotesKanban view");
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
		console.log("[TaskNotes][Bases] Successfully registered views");
		return;
	}

	// If that fails, try a few more times with short delays
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => setTimeout(r, 200));
		if (await attemptRegistration()) {
			console.log("[TaskNotes][Bases] Successfully registered views on retry");
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
		// Direct access to Bases plugin
		const bases: any = ((plugin.app as any).internalPlugins as any).getEnabledPluginById?.(
			"bases"
		);
		if (!bases?.registrations) {
			console.log("[TaskNotes][Bases] Bases plugin not available for unregistration");
			return;
		}

		// Unregister views directly
		if (bases.registrations.tasknotesTaskList) {
			delete bases.registrations.tasknotesTaskList;
			console.log("[TaskNotes][Bases] Successfully unregistered tasknotesTaskList view");
		}

		if (bases.registrations.tasknotesKanban) {
			delete bases.registrations.tasknotesKanban;
			console.log("[TaskNotes][Bases] Successfully unregistered tasknotesKanban view");
		}
	} catch (error) {
		console.error("[TaskNotes][Bases] Error during view unregistration:", error);
	}
}
