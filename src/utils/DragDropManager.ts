import { Draggable } from "@fullcalendar/interaction";
import TaskNotesPlugin from "../main";

/**
 * Centralized drag and drop manager for task elements
 */
export class DragDropManager {
	private plugin: TaskNotesPlugin;
	private draggableInstances: Map<HTMLElement, Draggable> = new Map();

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Make a task card draggable for FullCalendar external drop
	 */
	makeTaskCardDraggable(element: HTMLElement, taskPath: string): void {
		// Check if already draggable
		if (this.draggableInstances.has(element)) {
			return;
		}

		// Store task path in a custom attribute for our drop handler
		element.dataset.taskPath = taskPath;

		// Create FullCalendar Draggable instance
		// Don't provide eventData so it won't create events, just trigger drop handler
		const draggable = new Draggable(element);

		this.draggableInstances.set(element, draggable);

		// Add visual feedback
		element.style.cursor = "grab";

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
		const draggable = this.draggableInstances.get(element);
		if (draggable) {
			draggable.destroy();
			this.draggableInstances.delete(element);
		}
	}

	/**
	 * Clean up all draggable instances
	 */
	destroy(): void {
		this.draggableInstances.forEach((draggable) => {
			draggable.destroy();
		});
		this.draggableInstances.clear();
	}
}
