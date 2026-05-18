import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { sanitizeForCssClass } from "../utils/helpers";
import {
	getProjectClassNames,
	shouldStrikeThroughCompletedTasks,
	taskHasDetails,
} from "./taskCardState";
import {
	applyTaskCardStatusColors,
	configureStatusIndicator,
} from "./taskCardPrimaryIndicators";
import { syncTaskCardTitleCompletion } from "./taskCardTitle";

export interface UpdateTaskCardStatusIndicatorVisualsOptions {
	card: HTMLElement;
	statusDot: HTMLElement;
	plugin: TaskNotesPlugin;
	updatedTask: TaskInfo;
	effectiveStatus: string;
	isCompleted: boolean;
}

export function updateTaskCardCompletionState(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	isCompleted: boolean,
	effectiveStatus: string
): void {
	card.classList.toggle("task-card--completed", isCompleted);
	card.classList.toggle(
		"task-card--completed-strikethrough",
		isCompleted && shouldStrikeThroughCompletedTasks(plugin)
	);
	card.classList.toggle("task-card--archived", !!task.archived);
	card.classList.toggle(
		"task-card--actively-tracked",
		plugin.getActiveTimeSession(task) !== null
	);
	card.classList.toggle("task-card--recurring", !!task.recurrence);
	card.classList.toggle(
		"task-card--chevron-left",
		plugin.settings?.subtaskChevronPosition === "left"
	);
	const hasDetails = taskHasDetails(task, plugin);
	card.classList.toggle("task-card--has-details", hasDetails);
	card.dataset.hasDetails = hasDetails ? "true" : "false";

	removeClassesWithPrefix(card, "task-card--priority-");
	if (task.priority) {
		card.classList.add(`task-card--priority-${sanitizeForCssClass(task.priority)}`);
	}

	removeClassesWithPrefix(card, "task-card--status-");
	if (effectiveStatus) {
		card.classList.add(`task-card--status-${sanitizeForCssClass(effectiveStatus)}`);
	}

	removeClassesWithPrefix(card, "task-card--project-");
	const projectClassNames = getProjectClassNames(task);
	card.classList.toggle("task-card--has-projects", projectClassNames.length > 0);
	projectClassNames.forEach((className) => card.classList.add(className));

	card.dataset.status = effectiveStatus;

	syncTaskCardTitleCompletion(card, isCompleted);
}

export function updateTaskCardStatusIndicatorVisuals({
	card,
	statusDot,
	plugin,
	updatedTask,
	effectiveStatus,
	isCompleted,
}: UpdateTaskCardStatusIndicatorVisualsOptions): void {
	configureStatusIndicator(statusDot, plugin.statusManager.getStatusConfig(effectiveStatus));
	applyTaskCardStatusColors(card, effectiveStatus, plugin);

	const checkbox = card.querySelector<HTMLInputElement>(".task-card__checkbox");
	if (checkbox) {
		checkbox.checked = isCompleted;
	}

	updateTaskCardCompletionState(card, updatedTask, plugin, isCompleted, effectiveStatus);
}

function removeClassesWithPrefix(element: HTMLElement, prefix: string): void {
	for (const className of Array.from(element.classList)) {
		if (className.startsWith(prefix)) {
			element.classList.remove(className);
		}
	}
}
