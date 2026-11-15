import { App } from "obsidian";
import { openTaskPropertyPicker, tasksForPropertyAction } from "../ui/taskPropertyPickers";
import { createStatusCycleHandler } from "../ui/taskCardActions";
import { openTaskRecurrencePicker } from "../ui/taskRecurrencePicker";
import TaskNotesPlugin from "../main";
import { Reminder, TaskInfo } from "../types";
import {
	createUTCDateFromLocalCalendarDate,
	getDatePart,
	parseDateToUTC,
} from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { getRecurringMoveOriginalDate } from "../services/task-service/recurringMoveIdentity";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/KanbanCardActions" });

export interface KanbanCardActionContext {
	action: string;
	task: TaskInfo;
	target: HTMLElement;
	event: MouseEvent;
	plugin: TaskNotesPlugin;
	app: App;
}

type ReminderModalConstructor = typeof import("../modals/ReminderModal").ReminderModal;

export async function handleKanbanCardAction({
	action,
	task,
	target,
	event,
	plugin,
}: KanbanCardActionContext): Promise<void> {
	const property =
		action === "toggle-status"
			? "status"
			: action === "priority-menu"
				? "priority"
				: action === "edit-date"
					? target.dataset.tnDateType
					: undefined;
	const taskView = target.closest(".tn-tasknotesTaskList, .tn-tasknotesKanban");
	if (taskView && property === "status") {
		createStatusCycleHandler({
			task,
			plugin,
			targetDate: getKanbanTaskActionDate(task),
			updateStatusVisuals: () => {},
		})(event);
		return;
	}
	if (property === "priority" || property === "due" || property === "scheduled") {
		await openTaskPropertyPicker(
			plugin,
			property,
			await tasksForPropertyAction(plugin, task),
			target
		);
		return;
	}
	const [{ ReminderModal }, { showTaskContextMenu, toggleBlockingTasks, toggleSubtasks }] =
		await Promise.all([import("../modals/ReminderModal"), import("../ui/TaskCard")]);

	switch (action) {
		case "toggle-status":
			await handleToggleStatus(task, event, plugin);
			return;
		case "recurrence-menu":
			await openTaskRecurrencePicker(plugin, task, target);
			return;
		case "reminder-menu":
			showReminderModal(task, plugin, ReminderModal);
			return;
		case "task-context-menu":
			await showTaskContextMenu(event, task.path, plugin, getKanbanTaskActionDate(task));
			return;
		case "toggle-subtasks":
			await handleToggleSubtasks(task, target, plugin, toggleSubtasks);
			return;
		case "toggle-blocking-tasks":
			await handleToggleBlockingTasks(task, target, plugin, toggleBlockingTasks);
			return;
	}
}

async function handleToggleStatus(
	task: TaskInfo,
	event: MouseEvent,
	plugin: TaskNotesPlugin
): Promise<void> {
	try {
		if (task.recurrence) {
			await plugin.toggleRecurringTaskComplete(task, getKanbanTaskActionDate(task));
		} else {
			await plugin.toggleTaskStatus(task);
		}
	} catch (error) {
		tasknotesLogger.error("[TaskNotes][KanbanView] Failed to toggle status", {
			category: "internal",
			operation: "toggle-status",
			error: error,
		});
	}
}

export function getKanbanTaskActionDate(task: TaskInfo): Date {
	const dateStr =
		getRecurringMoveOriginalDate(task) || getDatePart(task.scheduled || task.due || "");
	if (dateStr) {
		return parseDateToUTC(dateStr);
	}

	return createUTCDateFromLocalCalendarDate(new Date());
}

function showReminderModal(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	ReminderModal: ReminderModalConstructor
): void {
	const modal = new ReminderModal(plugin.app, plugin, task, (reminders: Reminder[]) => {
		void (async () => {
			try {
				await plugin.updateTaskProperty(
					task,
					"reminders",
					reminders.length > 0 ? reminders : undefined
				);
			} catch (error) {
				tasknotesLogger.error("[TaskNotes][KanbanView] Failed to update reminders", {
					category: "validation",
					operation: "update-reminders",
					error: error,
				});
			}
		})();
	});
	modal.open();
}

async function handleToggleSubtasks(
	task: TaskInfo,
	chevronElement: HTMLElement,
	plugin: TaskNotesPlugin,
	toggleSubtasks: typeof import("../ui/TaskCard").toggleSubtasks
): Promise<void> {
	const card = chevronElement.closest<HTMLElement>(".task-card");
	if (!card) return;

	const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
	const newExpanded = !isExpanded;
	plugin.expandedProjectsService?.setExpanded(task.path, newExpanded);
	chevronElement.classList.toggle("is-rotated", newExpanded);

	await toggleSubtasks(card, task, plugin, newExpanded);
}

async function handleToggleBlockingTasks(
	task: TaskInfo,
	toggleElement: HTMLElement,
	plugin: TaskNotesPlugin,
	toggleBlockingTasks: typeof import("../ui/TaskCard").toggleBlockingTasks
): Promise<void> {
	const card = toggleElement.closest<HTMLElement>(".task-card");
	if (!card) return;

	const expanded = toggleElement.classList.toggle("task-card__blocking-toggle--expanded");
	await toggleBlockingTasks(card, task, plugin, expanded);
}
