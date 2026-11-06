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
	if (statusManager.isCompletedStatus(getEffectiveTaskStatus(task, targetDate, completedStatus))) {
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
		void (async () => {
			const logger = getTaskCardActionLogger(plugin);
			try {
				if (task.recurrence) {
					const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
					const cycleStatus =
						freshTask && getRecurringCycleStatus(freshTask, plugin, targetDate, e.shiftKey);
					if (freshTask && cycleStatus) {
						const updatedTask = await plugin.updateTaskProperty(freshTask, "status", cycleStatus);
						updateStatusVisuals(updatedTask, cycleStatus, false);
						return;
					}
					const updatedTask = await plugin.toggleRecurringTaskComplete(task, targetDate);
					const newEffectiveStatus = getEffectiveTaskStatus(
						updatedTask,
						targetDate,
						plugin.statusManager.getCompletedStatuses()[0]
					);
					const isNowCompleted =
						plugin.statusManager.isCompletedStatus(newEffectiveStatus);
					updateStatusVisuals(updatedTask, newEffectiveStatus, isNowCompleted);
					return;
				}

				const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
				if (!freshTask) {
					new Notice(plugin.i18n.translate(msg({ message: "Task not found", context: "modals.actionPalette.taskNotFound" })));
					return;
				}

				const currentStatus = freshTask.status || plugin.settings.defaultTaskStatus;
				const nextStatus = e.shiftKey
					? plugin.statusManager.getPreviousStatus(currentStatus)
					: plugin.statusManager.getNextStatus(currentStatus);
				const updatedTask = await plugin.updateTaskProperty(
					freshTask,
					"status",
					nextStatus
				);
				const isNowCompleted = plugin.statusManager.isCompletedStatus(nextStatus);
				updateStatusVisuals(updatedTask, nextStatus, isNowCompleted);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error("Error cycling task status", {
					category: "persistence",
					operation: "cycle-status",
					details: { taskPath: task.path, errorMessage },
					error,
				});
				new Notice(
					plugin.i18n.translate(msg({ message: "Failed to update task status: {message}", context: "notices.interface.statusFailed" }), {
						message: displayError(errorMessage),
					})
				);
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
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: (newPriority) => {
				void (async () => {
					const logger = getTaskCardActionLogger(plugin);
					try {
						await plugin.updateTaskProperty(task, "priority", newPriority);
					} catch (error) {
						logger.error("Error updating priority", {
							category: "persistence",
							operation: "update-priority",
							details: { taskPath: task.path, newPriority },
							error,
						});
						new Notice(plugin.i18n.translate(msg({ message: "Failed to update priority", context: "notices.interface.priorityFailed" })));
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
						new Notice(plugin.i18n.translate(msg({ message: "Failed to update recurrence", context: "notices.interface.recurrenceFailed" })));
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
						plugin.i18n.translate(msg({ message: "Failed to update reminders", context: "contextMenus.task.notices.updateRemindersFailure" }))
					);
				}
			})();
		});
		modal.open();
	};
}
