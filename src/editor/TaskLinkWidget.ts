import { EditorView, WidgetType } from "@codemirror/view";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import { dispatchTaskUpdate } from "./TaskLinkOverlay";
import { createTaskCard } from "../ui/TaskCard";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { createUTCDateFromLocalCalendarDate, formatDateForStorage } from "../utils/dateUtils";

export class TaskLinkWidget extends WidgetType {
	private taskInfo: TaskInfo;
	private plugin: TaskNotesPlugin;
	private originalText: string;
	private displayText?: string;
	private targetDate: Date;
	private targetDateKey: string;

	constructor(
		taskInfo: TaskInfo,
		plugin: TaskNotesPlugin,
		originalText: string,
		displayText?: string,
		targetDate: Date = createUTCDateFromLocalCalendarDate(new Date())
	) {
		super();
		this.taskInfo = taskInfo;
		this.plugin = plugin;
		this.originalText = originalText;
		this.displayText = displayText;
		this.targetDate = targetDate;
		this.targetDateKey = formatDateForStorage(targetDate);
	}

	toDOM(view: EditorView): HTMLElement {
		// Get visible properties from settings (stores internal FieldMapping keys)
		// Convert to user-configured frontmatter property names before passing to TaskCard
		const internalProperties = this.plugin.settings.inlineVisibleProperties || [
			"status",
			"priority",
			"due",
			"scheduled",
			"recurrence",
		];
		const visibleProperties = convertInternalToUserProperties(internalProperties, this.plugin);

		// Create a wrapper span with the tasknotes-plugin class for CSS scoping
		const wrapper = activeDocument.createElement("span");
		wrapper.className = "tasknotes-plugin tasknotes-inline-widget";
		// Ensure wrapper displays inline to prevent line breaks
		wrapper.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		wrapper.classList.add("tn-static-display-inline-cccfa456");
		wrapper.classList.add("tn-static-vertical-align-baseline-657d9c46");

		// Use createTaskCard with inline layout
		const card = createTaskCard(this.taskInfo, this.plugin, visibleProperties, {
			layout: "inline",
			targetDate: this.targetDate,
		});

		// Add card to wrapper
		wrapper.appendChild(card);

		// Store original text for reference
		card.dataset.originalText = this.originalText;

		this.plugin.dragDropManager?.makeTaskCardDraggable(wrapper, this.taskInfo.path);

		// Trigger update after status changes (for editor sync)
		// Listen for task updates within the card
		card.addEventListener("tasknotes:task-updated", () => {
			window.setTimeout(() => {
				if (view && typeof view.dispatch === "function") {
					dispatchTaskUpdate(view, this.taskInfo.path);
				}
			}, 50);
		});

		return wrapper;
	}

	/**
	 * Check if this widget should be updated when task data changes
	 */
	eq(other: WidgetType): boolean {
		if (!(other instanceof TaskLinkWidget)) {
			return false;
		}
		return (
			this.taskInfo.path === other.taskInfo.path &&
			this.taskInfo.status === other.taskInfo.status &&
			this.taskInfo.title === other.taskInfo.title &&
			this.taskInfo.priority === other.taskInfo.priority &&
			this.taskInfo.archived === other.taskInfo.archived &&
			this.taskInfo.due === other.taskInfo.due &&
			this.taskInfo.scheduled === other.taskInfo.scheduled &&
			this.taskInfo.recurrence === other.taskInfo.recurrence &&
			this.targetDateKey === other.targetDateKey &&
			JSON.stringify(this.taskInfo.complete_instances) ===
				JSON.stringify(other.taskInfo.complete_instances) &&
			JSON.stringify(this.taskInfo.skipped_instances) ===
				JSON.stringify(other.taskInfo.skipped_instances) &&
			this.taskInfo.dateModified === other.taskInfo.dateModified
		);
	}

	/**
	 * Ignore mouse events on the widget to prevent cursor movement
	 * when clicking interactive elements like status dot
	 */
	ignoreEvent(event: Event): boolean {
		// Ignore mouse events to prevent cursor from moving into widget
		// This keeps the widget rendered while interacting with it
		if (
			event.type === "mousedown" ||
			event.type === "click" ||
			event.type === "dragstart" ||
			event.type === "dragend"
		) {
			return true;
		}
		return false;
	}

	/**
	 * This widget should be inline, not block
	 */
	get estimatedHeight(): number {
		return -1; // Indicates inline widget
	}

	/**
	 * Ensure this is treated as an inline widget
	 */
	get block(): boolean {
		return false;
	}
}
