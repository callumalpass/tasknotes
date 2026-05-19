import { App } from "obsidian";
import TaskNotesPlugin from "../main";
import { Reminder, TaskInfo } from "../types";
import {
	createUTCDateFromLocalCalendarDate,
	getDatePart,
	parseDateToUTC,
} from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/KanbanCardActions" });

export interface KanbanCardActionContext {
	action: string;
	task: TaskInfo;
	target: HTMLElement;
	event: MouseEvent;
	plugin: TaskNotesPlugin;
	app: App;
}

type PriorityContextMenuConstructor =
	typeof import("../components/PriorityContextMenu").PriorityContextMenu;
type RecurrenceContextMenuConstructor =
	typeof import("../components/RecurrenceContextMenu").RecurrenceContextMenu;
type ReminderModalConstructor = typeof import("../modals/ReminderModal").ReminderModal;
type DateContextMenuConstructor = typeof import("../components/DateContextMenu").DateContextMenu;

export async function handleKanbanCardAction({
	action,
	task,
	target,
	event,
	plugin,
	app,
}: KanbanCardActionContext): Promise<void> {
	const [
		{ DateContextMenu },
		{ PriorityContextMenu },
		{ RecurrenceContextMenu },
		{ ReminderModal },
		{ showTaskContextMenu, toggleBlockingTasks, toggleSubtasks },
	] = await Promise.all([
		import("../components/DateContextMenu"),
		import("../components/PriorityContextMenu"),
		import("../components/RecurrenceContextMenu"),
		import("../modals/ReminderModal"),
		import("../ui/TaskCard"),
	]);

	switch (action) {
		case "toggle-status":
			await handleToggleStatus(task, event, plugin);
			return;
		case "priority-menu":
			showPriorityMenu(task, event, plugin, PriorityContextMenu);
			return;
		case "recurrence-menu":
			showRecurrenceMenu(task, event, plugin, RecurrenceContextMenu);
			return;
		case "reminder-menu":
			showReminderModal(task, plugin, ReminderModal);
			return;
		case "task-context-menu":
			await showTaskContextMenu(event, task.path, plugin, getKanbanTaskActionDate(task));
			return;
		case "edit-date":
			await openDateContextMenu(
				task,
				target.dataset.tnDateType as "due" | "scheduled" | undefined,
				event,
				plugin,
				app,
				DateContextMenu
			);
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
	const dateStr = getDatePart(task.scheduled || task.due || "");
	if (dateStr) {
		return parseDateToUTC(dateStr);
	}

	return createUTCDateFromLocalCalendarDate(new Date());
}

function showPriorityMenu(
	task: TaskInfo,
	event: MouseEvent,
	plugin: TaskNotesPlugin,
	PriorityContextMenu: PriorityContextMenuConstructor
): void {
	const menu = new PriorityContextMenu({
		currentValue: task.priority,
		onSelect: (newPriority: string) => {
			void (async () => {
				try {
					await plugin.updateTaskProperty(task, "priority", newPriority);
				} catch (error) {
					tasknotesLogger.error("[TaskNotes][KanbanView] Failed to update priority", {
						category: "validation",
						operation: "update-priority",
						error: error,
					});
				}
			})();
		},
		plugin,
	});
	menu.show(event);
}

function showRecurrenceMenu(
	task: TaskInfo,
	event: MouseEvent,
	plugin: TaskNotesPlugin,
	RecurrenceContextMenu: RecurrenceContextMenuConstructor
): void {
	const menu = new RecurrenceContextMenu({
		currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
		currentAnchor: task.recurrence_anchor || "scheduled",
		scheduledDate: task.scheduled,
		onSelect: (newRecurrence: string | null, anchor?: "scheduled" | "completion") => {
			void (async () => {
				try {
					await plugin.updateTaskProperty(task, "recurrence", newRecurrence || undefined);
					if (anchor !== undefined) {
						await plugin.updateTaskProperty(task, "recurrence_anchor", anchor);
					}
				} catch (error) {
					tasknotesLogger.error("[TaskNotes][KanbanView] Failed to update recurrence", {
						category: "validation",
						operation: "update-recurrence",
						error: error,
					});
				}
			})();
		},
		app: plugin.app,
		plugin,
	});
	menu.show(event);
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

async function openDateContextMenu(
	task: TaskInfo,
	dateType: "due" | "scheduled" | undefined,
	event: MouseEvent,
	plugin: TaskNotesPlugin,
	app: App,
	DateContextMenu: DateContextMenuConstructor
): Promise<void> {
	if (!dateType) return;

	const { getDatePart, getTimePart } = await import("../utils/dateUtils");
	const currentValue = dateType === "due" ? task.due : task.scheduled;

	const menu = new DateContextMenu({
		currentValue: getDatePart(currentValue || ""),
		currentTime: getTimePart(currentValue || ""),
		onSelect: (dateValue: string | null, timeValue?: string | null) => {
			void (async () => {
				try {
					let finalValue: string | undefined;
					if (!dateValue) {
						finalValue = undefined;
					} else if (timeValue) {
						finalValue = `${dateValue}T${timeValue}`;
					} else {
						finalValue = dateValue;
					}
					await plugin.updateTaskProperty(task, dateType, finalValue);
				} catch (error) {
					tasknotesLogger.error("[TaskNotes][KanbanView] Failed to update date", {
						category: "validation",
						operation: "update-date",
						error: error,
					});
				}
			})();
		},
		dateRole: dateType,
		plugin,
		app,
	});
	menu.show(event);
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
