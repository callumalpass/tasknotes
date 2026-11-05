import { displayError } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderModal } from "../modals/ReminderModal";
import { getEffectiveTaskStatus } from "../utils/helpers";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import {
	openTaskPropertyPicker,
	tasksForPropertyAction,
	showTaskUndo,
	changeTaskProperty,
} from "./taskPropertyPickers";
import { completeRecurringTaskWithUndo } from "../services/task-service/recurringCompletionUndo";

const statusWriteStates = new WeakMap<TaskNotesPlugin, Map<string, "pending" | "failed">>();

export function syncTaskCardWriteState(card: HTMLElement, plugin: TaskNotesPlugin, path: string): void {
	const state = statusWriteStates.get(plugin)?.get(path);
	if (!state && !card.dataset.tnStatusWriteState) return;
	if (state) card.dataset.tnStatusWriteState = state;
	else delete card.dataset.tnStatusWriteState;
	card.classList.toggle("task-card--pending", state === "pending");
	card.classList.toggle("task-card--write-failed", state === "failed");
	const status = card.querySelector<HTMLElement>(":scope > .task-card__main-row .task-card__status-dot");
	if (state === "pending") {
		status?.setAttribute("aria-busy", "true");
		status?.setAttribute("aria-disabled", "true");
	} else {
		status?.removeAttribute("aria-busy");
		status?.removeAttribute("aria-disabled");
	}
}

export type TaskCardStatusVisualUpdater = (
	updatedTask: TaskInfo,
	effectiveStatus: string,
	isCompleted: boolean
) => void;

export interface StatusCycleHandlerOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	targetDate: Date;
	updateStatusVisuals: TaskCardStatusVisualUpdater;
}
function getTaskCardActionLogger(plugin: TaskNotesPlugin) {
	return createTaskNotesLogger({
		tag: "TaskCard/Actions",
		isDebugEnabled: () => plugin.settings.enableDebugLogging,
	});
}

/**
 * The status a click moves a recurring series to, or undefined when the click
 * completes or reopens the occurrence shown instead.
 *
 * A recurring card follows the status cycle once a finished series has a status
 * to start its next occurrence in. Without one, the series would carry the
 * status reached during this occurrence into the next, so the click completes
 * the occurrence directly.
 */
function getRecurringCycleStatus(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	targetDate: Date,
	reverse: boolean
): string | undefined {
	const { statusManager } = plugin;
	if (!statusManager.getConfiguredStatusAfterCompletion()) return undefined;
	const completedStatus = statusManager.getCompletedStatuses()[0];
	if (
		statusManager.isCompletedStatus(getEffectiveTaskStatus(task, targetDate, completedStatus))
	) {
		return undefined;
	}
	const currentStatus = task.status || plugin.settings.defaultTaskStatus;
	const nextStatus = reverse
		? statusManager.getPreviousStatus(currentStatus)
		: statusManager.getNextStatus(currentStatus);
	return statusManager.isCompletedStatus(nextStatus) ? undefined : nextStatus;
}

/**
 * Creates a click handler for cycling task status.
 */
export function createStatusCycleHandler(
	options: StatusCycleHandlerOptions
): (e: MouseEvent) => void {
	const { task, plugin, targetDate, updateStatusVisuals } = options;
	return (e: MouseEvent) => {
		e.stopPropagation();
		const anchor = (e.target as Element | null)?.closest<HTMLElement>(".task-card__status-dot") ?? e.currentTarget as HTMLElement;
		const card = anchor?.closest<HTMLElement>(".task-card");
		const states = statusWriteStates.get(plugin) ?? new Map<string, "pending" | "failed">();
		statusWriteStates.set(plugin, states);
		if (states.get(task.path) === "pending") return;
		const setState = (state?: "pending" | "failed") => {
			if (state) states.set(task.path, state);
			else states.delete(task.path);
			const cards = new Set([card, ...Array.from(card?.ownerDocument.querySelectorAll<HTMLElement>(".task-card[data-task-path]") ?? []).filter(element => element.dataset.taskPath === task.path)]);
			for (const current of cards) if (current) syncTaskCardWriteState(current, plugin, task.path);
		};
		setState("pending");
		card?.classList.remove("task-card--write-failed");
		card?.classList.add("task-card--pending");
		anchor?.setAttribute("aria-busy", "true");
		anchor?.setAttribute("aria-disabled", "true");
		void (async () => {
			const logger = getTaskCardActionLogger(plugin);
			try {
				{
					const fresh = await plugin.cacheManager.getTaskInfo(task.path);
					if (!fresh) {
						new Notice(plugin.i18n.translate(msg({ message: "Task not found", context: "modals.actionPalette.taskNotFound" })));
						return;
					}
					let updated: TaskInfo | null;
					const cycle = fresh.recurrence
						? getRecurringCycleStatus(fresh, plugin, targetDate, e.shiftKey)
						: e.shiftKey
							? plugin.statusManager.getPreviousStatus(
									fresh.status || plugin.settings.defaultTaskStatus
								)
							: plugin.statusManager.getNextStatus(
									fresh.status || plugin.settings.defaultTaskStatus
								);
					if (cycle) {
						updated = (await changeTaskProperty(
							plugin,
							anchor?.closest(".tn-tasknotesTaskList, .tn-tasknotesKanban")
								? await tasksForPropertyAction(plugin, fresh)
								: [fresh],
							"status",
							cycle
						)).find(updatedTask => updatedTask.path === fresh.path) ?? null;
						if (!updated) setState("failed");
					} else {
						const date = await plugin.taskService.resolveRecurringTaskActionDate(
							fresh,
							targetDate
						);
						const result = await completeRecurringTaskWithUndo(plugin, fresh, date);
						if (result.changed)
							showTaskUndo([
								async () => {
									if (!(await result.undo()))
										throw new Error("Task changed since completion");
								},
							], false, 1, plugin.app.vault);
						updated = await plugin.cacheManager.getTaskInfo(fresh.path);
					}
					if (updated) {
						const effective = getEffectiveTaskStatus(
							updated,
							targetDate,
							plugin.statusManager.getCompletedStatuses()[0]
						);
						updateStatusVisuals(
							updated,
							effective,
							plugin.statusManager.isCompletedStatus(effective)
						);
					}
					return;
				}
			} catch (error) {
				setState("failed");
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error("Error cycling task status", {
					category: "persistence",
					operation: "cycle-status",
					details: { taskPath: task.path, errorMessage },
					error,
				});
				new Notice(
					plugin.i18n.translate(
						msg({
							message: "Failed to update task status: {message}",
							context: "notices.interface.statusFailed",
						}),
						{
							message: displayError(errorMessage),
						}
					)
				);
			} finally {
				setState(states.get(task.path) === "failed" ? "failed" : undefined);
				card?.classList.remove("task-card--pending");
				anchor?.removeAttribute("aria-busy");
				anchor?.removeAttribute("aria-disabled");
			}
		})();
	};
}

/**
 * Creates a click handler for priority indicators.
 */
export function createPriorityClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		const anchor = e.currentTarget as HTMLElement;
		if (anchor?.closest(".tn-tasknotesTaskList, .tn-tasknotesKanban")) {
			void tasksForPropertyAction(plugin, task).then((tasks) =>
				openTaskPropertyPicker(plugin, "priority", tasks, anchor)
			);
			return;
		}
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: (newPriority) => {
				void (async () => {
					const logger = getTaskCardActionLogger(plugin);
					try {
						await changeTaskProperty(plugin, [task], "priority", newPriority);
					} catch (error) {
						logger.error("Error updating priority", {
							category: "persistence",
							operation: "update-priority",
							details: { taskPath: task.path, newPriority },
							error,
						});
						new Notice(
							plugin.i18n.translate(
								msg({
									message: "Failed to update priority",
									context: "notices.interface.priorityFailed",
								})
							)
						);
					}
				})();
			},
			plugin,
		});
		menu.show(e);
	};
}

/**
 * Creates a click handler for recurrence indicators.
 */
export function createRecurrenceClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || "scheduled",
			scheduledDate: task.scheduled,
			onSelect: (newRecurrence, anchor) => {
				void (async () => {
					const logger = getTaskCardActionLogger(plugin);
					try {
						await plugin.updateTaskProperty(
							task,
							"recurrence",
							newRecurrence || undefined
						);
						if (anchor !== undefined) {
							await plugin.updateTaskProperty(task, "recurrence_anchor", anchor);
						}
					} catch (error) {
						logger.error("Error updating recurrence", {
							category: "persistence",
							operation: "update-recurrence",
							details: { taskPath: task.path, newRecurrence, anchor },
							error,
						});
						new Notice(
							plugin.i18n.translate(
								msg({
									message: "Failed to update recurrence",
									context: "notices.interface.recurrenceFailed",
								})
							)
						);
					}
				})();
			},
			app: plugin.app,
			plugin,
		});
		menu.show(e);
	};
}

/**
 * Creates a click handler for reminder indicators.
 */
export function createReminderClickHandler(task: TaskInfo, plugin: TaskNotesPlugin): () => void {
	return () => {
		const modal = new ReminderModal(plugin.app, plugin, task, (reminders) => {
			void (async () => {
				const logger = getTaskCardActionLogger(plugin);
				try {
					await plugin.updateTaskProperty(
						task,
						"reminders",
						reminders.length > 0 ? reminders : undefined
					);
				} catch (error) {
					logger.error("Error updating reminders", {
						category: "persistence",
						operation: "update-reminders",
						details: { taskPath: task.path, reminderCount: reminders.length },
						error,
					});
					new Notice(
						plugin.i18n.translate(
							msg({
								message: "Failed to update reminders",
								context: "contextMenus.task.notices.updateRemindersFailure",
							})
						)
					);
				}
			})();
		});
		modal.open();
	};
}
