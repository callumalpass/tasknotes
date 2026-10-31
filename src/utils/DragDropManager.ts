import TaskNotesPlugin from "../main";

/**
 * Centralized drag and drop manager for task elements
 */
export class DragDropManager {
	private plugin: TaskNotesPlugin;
	private draggableElements = new Set<HTMLElement>();

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Make a task card draggable (HTML5 drag and drop, e.g. into editors)
	 */
	makeTaskCardDraggable(element: HTMLElement, taskPath: string): void {
		// Check if already draggable
		if (this.draggableElements.has(element)) {
			return;
		}

		// Store task path in a custom attribute for our drop handler
		element.dataset.taskPath = taskPath;

		element.draggable = true;
		this.draggableElements.add(element);

		// Add visual feedback
		element.classList.remove(
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-cursor-pointer-3b6a3a65"
		);
		element.classList.add("tn-static-cursor-grab-dad79857");

		// Override dragstart to set proper data transfer for editor drops
		element.addEventListener("dragstart", (e) => {
			element.classList.add("task-card--dragging");

			// Set data for HTML5 drag and drop (needed for editor drops)
			if (e.dataTransfer) {
				e.dataTransfer.setData("text/plain", taskPath);
				e.dataTransfer.setData("application/x-task-path", taskPath);
				e.dataTransfer.effectAllowed = "copy";
			}
		});

		element.addEventListener("dragend", () => {
			element.classList.remove("task-card--dragging");
		});
	}

	/**
	 * Remove draggable functionality from an element
	 */
	removeDraggable(element: HTMLElement): void {
		if (this.draggableElements.delete(element)) {
			element.draggable = false;
		}
	}

	/**
	 * Clean up all draggable instances
	 */
	destroy(): void {
		this.draggableElements.forEach((element) => {
			element.draggable = false;
		});
		this.draggableElements.clear();
	}
}
