import TaskNotesPlugin from "../main";
import { buildTasknotesBaseViewFactory } from "./base-view-factory";

export function buildTasknotesTaskListViewFactory(plugin: TaskNotesPlugin) {
	return buildTasknotesBaseViewFactory(plugin, {
		errorPrefix: "Task List",
	});
}
