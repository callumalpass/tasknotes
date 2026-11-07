import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { createTaskCard } from "../ui/TaskCard";
import { convertInternalToUserProperties } from "../utils/propertyMapping";

/** Linked tasks in the modal read as one line: glyphs, a truncating title, then short dates. */
export function createTaskModalTaskRow(task: TaskInfo, plugin: TaskNotesPlugin): HTMLElement {
	const row = createTaskCard(
		task,
		plugin,
		convertInternalToUserProperties(["status", "priority", "due", "scheduled"], plugin),
		{
			layout: "default",
			showSecondaryBadges: false,
			enableHoverPreview: false,
		}
	);
	row.addClass("tn-task-modal__task-row");
	row.toggleClass("tn-task-modal__task-row--has-due", Boolean(task.due));
	return row;
}
