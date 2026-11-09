import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { createTaskCard, type TaskCardOptions } from "../ui/TaskCard";
import { createElementInDocument } from "../utils/documentDom";
import { VirtualScroller } from "../utils/VirtualScroller";

export function createKanbanCardScroller(options: {
	container: HTMLElement;
	tasks: TaskInfo[];
	visibleProperties: string[];
	cardOptions: TaskCardOptions;
	plugin: TaskNotesPlugin;
	document: Document;
	onRender: (wrapper: HTMLElement, task: TaskInfo) => void;
}): VirtualScroller<TaskInfo> {
	return new VirtualScroller<TaskInfo>({
		container: options.container,
		items: options.tasks,
		overscan: 3,
		renderItem: (task) => {
			const wrapper = createElementInDocument(options.document, "div");
			wrapper.className = "kanban-view__card-wrapper";
			wrapper.setAttribute("draggable", "true");
			wrapper.setAttribute("data-task-path", task.path);
			wrapper.appendChild(
				createTaskCard(task, options.plugin, options.visibleProperties, options.cardOptions)
			);
			options.onRender(wrapper, task);
			return wrapper;
		},
		getItemKey: (task) => task.path,
	});
}
