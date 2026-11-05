import { uiText } from "../i18n/runtime";
import { displayError } from "../i18n/runtime";
import { openTaskPropertyPicker, tasksForPropertyAction } from "../ui/taskPropertyPickers";
import { createStatusCycleHandler } from "../ui/taskCardActions";
import { msg } from "@lingui/core/macro";
import { Notice, TFile, type App } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { showTaskContextMenu } from "../ui/TaskCard";
import { DateContextMenu } from "../components/DateContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderModal } from "../modals/ReminderModal";
import { getDatePart, getTimePart, parseDateToUTC } from "../utils/dateUtils";
import { getRecurringMoveOriginalDate } from "../services/task-service/recurringMoveIdentity";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/TaskListView" });

type TaskListCardActionContext = {
	plugin: TaskNotesPlugin;
	containerEl: HTMLElement;
	clickTimeouts: Map<string, number>;
	getTargetDate: () => Date;
	getApp: () => App;
	handleSelectionClick: (event: MouseEvent, path: string) => boolean;
};

export class TaskListCardActions {
	constructor(private readonly context: TaskListCardActionContext) {}
	async handleActionClick(
		action: string,
		task: TaskInfo,
		target: HTMLElement,
		event: MouseEvent
	): Promise<void> {
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
				plugin: this.context.plugin,
				targetDate: this.getTaskActionDate(task),
				updateStatusVisuals: () => {},
			})(event);
			return;
		}
		if (
			taskView &&
			(property === "priority" || property === "due" || property === "scheduled")
		) {
			await openTaskPropertyPicker(
				this.context.plugin,
				property,
				await tasksForPropertyAction(this.context.plugin, task),
				target
			);
			return;
		}
		switch (action) {
			case "toggle-status":
				await this.handleToggleStatus(task, event);
				return;
			case "priority-menu":
				this.showPriorityMenu(task, event);
				return;
			case "recurrence-menu":
				this.showRecurrenceMenu(task, event);
				return;
			case "reminder-menu":
				this.showReminderModal(task);
				return;
			case "task-context-menu":
				await showTaskContextMenu(
					event,
					task.path,
					this.context.plugin,
					this.getTaskActionDate(task)
				);
				return;
			case "edit-date":
				await this.openDateContextMenu(
					task,
					target.dataset.tnDateType as "due" | "scheduled" | undefined,
					event
				);
				return;
			case "toggle-subtasks":
				await this.toggleSubtasks(task, target);
				return;
			case "toggle-blocking-tasks":
				await this.toggleBlockingTasks(task, target);
				return;
			default:
				await this.handleCardClick(task, event);
		}
	}

	async handleToggleStatus(task: TaskInfo, event: MouseEvent): Promise<void> {
		try {
			if (task.recurrence) {
				const actionDate = this.getTaskActionDate(task);
				await this.context.plugin.toggleRecurringTaskComplete(task, actionDate);
			} else {
				await this.context.plugin.toggleTaskStatus(task);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("[TaskNotes][TaskListView] Failed to toggle status", {
				category: "persistence",
				operation: "toggle-status",
				details: { taskPath: task.path },
				error: message,
			});
			new Notice(
				this.context.plugin.i18n.translate(
					msg({
						message: "Failed to update task status: {message}",
						context: "notices.interface.statusFailed",
					}),
					{ message: displayError(message) }
				)
			);
		}
	}

	/**
	 * Determine the date to use when completing a recurring task from Bases.
	 * Prefers the task's scheduled (or due) date to avoid marking the wrong instance.
	 */
	getTaskActionDate(task: TaskInfo): Date {
		const dateStr =
			getRecurringMoveOriginalDate(task) || getDatePart(task.scheduled || task.due || "");
		if (dateStr) {
			return parseDateToUTC(dateStr);
		}

		return this.context.getTargetDate();
	}

	private showPriorityMenu(task: TaskInfo, event: MouseEvent): void {
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: (newPriority) => {
				void (async () => {
					try {
						await this.context.plugin.updateTaskProperty(task, "priority", newPriority);
					} catch (error) {
						tasknotesLogger.error(
							"[TaskNotes][TaskListView] Failed to update priority",
							{ category: "validation", operation: "update-priority", error: error }
						);
						new Notice(
							this.context.plugin.i18n.translate(
								msg({
									message: "Failed to update priority",
									context: "notices.interface.priorityFailed",
								})
							)
						);
					}
				})();
			},
			plugin: this.context.plugin,
		});
		menu.show(event);
	}

	private showRecurrenceMenu(task: TaskInfo, event: MouseEvent): void {
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || "scheduled",
			scheduledDate: task.scheduled,
			onSelect: (newRecurrence: string | null, anchor?: "scheduled" | "completion") => {
				void (async () => {
					try {
						await this.context.plugin.updateTaskProperty(
							task,
							"recurrence",
							newRecurrence || undefined
						);
						if (anchor !== undefined) {
							await this.context.plugin.updateTaskProperty(
								task,
								"recurrence_anchor",
								anchor
							);
						}
					} catch (error) {
						tasknotesLogger.error(
							"[TaskNotes][TaskListView] Failed to update recurrence",
							{ category: "validation", operation: "update-recurrence", error: error }
						);
						new Notice(
							this.context.plugin.i18n.translate(
								msg({
									message: "Failed to update recurrence",
									context: "notices.interface.recurrenceFailed",
								})
							)
						);
					}
				})();
			},
			app: this.context.plugin.app,
			plugin: this.context.plugin,
		});
		menu.show(event);
	}

	private showReminderModal(task: TaskInfo): void {
		const modal = new ReminderModal(
			this.context.plugin.app,
			this.context.plugin,
			task,
			(reminders) => {
				void (async () => {
					try {
						await this.context.plugin.updateTaskProperty(
							task,
							"reminders",
							reminders.length > 0 ? reminders : undefined
						);
					} catch (error) {
						tasknotesLogger.error(
							"[TaskNotes][TaskListView] Failed to update reminders",
							{
								category: "validation",
								operation: "update-reminders",
								error: error,
							}
						);
						new Notice(
							this.context.plugin.i18n.translate(
								msg({
									message: "Failed to update reminders",
									context: "contextMenus.task.notices.updateRemindersFailure",
								})
							)
						);
					}
				})();
			}
		);
		modal.open();
	}

	private async openDateContextMenu(
		task: TaskInfo,
		dateType: "due" | "scheduled" | undefined,
		event: MouseEvent
	): Promise<void> {
		if (!dateType) return;
		const currentValue = dateType === "due" ? task.due : task.scheduled;
		const menu = new DateContextMenu({
			currentValue: getDatePart(currentValue || ""),
			currentTime: getTimePart(currentValue || ""),
			onSelect: (dateValue, timeValue) => {
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
						await this.context.plugin.updateTaskProperty(task, dateType, finalValue);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						tasknotesLogger.error("[TaskNotes][TaskListView] Failed to update date", {
							category: "validation",
							operation: "update-date",
							details: { taskPath: task.path, dateType },
							error: message,
						});
						new Notice(
							this.context.plugin.i18n.translate(
								dateType === "due"
									? msg({
											message: "Failed to update task due date: {message}",
											context:
												"contextMenus.task.notices.updateDueDateFailure",
										})
									: msg({
											message:
												"Failed to update task scheduled date: {message}",
											context:
												"contextMenus.task.notices.updateScheduledFailure",
										}),
								{ message }
							)
						);
					}
				})();
			},
			dateRole: dateType,
			plugin: this.context.plugin,
			app: this.context.getApp() || this.context.plugin.app,
		});
		menu.show(event);
	}

	private async handleCardClick(task: TaskInfo, event: MouseEvent): Promise<void> {
		// Check if this is a selection click (shift/ctrl/cmd or in selection mode)
		if (this.context.handleSelectionClick(event, task.path)) {
			return;
		}

		if (this.context.plugin.settings.doubleClickAction === "none") {
			await this.executeSingleClickAction(task, event);
			return;
		}

		const existingTimeout = this.context.clickTimeouts.get(task.path);
		if (existingTimeout) {
			window.clearTimeout(existingTimeout);
			this.context.clickTimeouts.delete(task.path);
			await this.executeDoubleClickAction(task, event);
		} else {
			// Use correct window for pop-out window support
			const win = this.context.containerEl.ownerDocument.defaultView || window;
			const timeout = win.setTimeout(() => {
				void (async () => {
					this.context.clickTimeouts.delete(task.path);
					await this.executeSingleClickAction(task, event);
				})();
			}, 250);
			this.context.clickTimeouts.set(task.path, timeout);
		}
	}

	private async executeSingleClickAction(task: TaskInfo, event: MouseEvent): Promise<void> {
		if (event.ctrlKey || event.metaKey) {
			this.openTaskNote(task, true);
			return;
		}

		switch (this.context.plugin.settings.singleClickAction) {
			case "edit":
				await this.editTask(task);
				break;
			case "openNote":
				this.openTaskNote(task, false);
				break;
			default:
				break;
		}
	}

	private async executeDoubleClickAction(task: TaskInfo, event: MouseEvent): Promise<void> {
		switch (this.context.plugin.settings.doubleClickAction) {
			case "edit":
				await this.editTask(task);
				break;
			case "openNote":
				this.openTaskNote(task, false);
				break;
			default:
				break;
		}
	}

	private async editTask(task: TaskInfo): Promise<void> {
		await this.context.plugin.openTaskEditModal(task);
	}

	private openTaskNote(task: TaskInfo, newTab: boolean): void {
		const app = this.context.getApp() || this.context.plugin.app;
		const file = app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			if (newTab) {
				void app.workspace.openLinkText(task.path, "", true);
			} else {
				void app.workspace.getLeaf(false).openFile(file);
			}
		}
	}

	private async toggleSubtasks(task: TaskInfo, target: HTMLElement): Promise<void> {
		try {
			if (!this.context.plugin.expandedProjectsService) {
				tasknotesLogger.error(
					"[TaskNotes][TaskListView] ExpandedProjectsService not initialized",
					{ category: "stale-data", operation: "expandedprojectsservice-not-initialized" }
				);
				new Notice(
					this.context.plugin.i18n.translate(
						msg({
							message: "Service not available. Please try reloading the plugin.",
							context: "notices.interface.serviceUnavailable",
						})
					)
				);
				return;
			}

			const newExpanded = this.context.plugin.expandedProjectsService.toggle(
				task.path,
				this.context.plugin.settings?.expandSubtasksByDefault === true
			);
			target.classList.toggle("task-card__chevron--expanded", newExpanded);
			target.setAttribute(
				"aria-label",
				newExpanded
					? uiText(
							msg({
								message: "Collapse subtasks",
								context: "bases/TaskListView: TaskListView.toggleSubtasks display",
							})
						)
					: uiText(
							msg({
								message: "Expand subtasks",
								context: "bases/TaskListView: TaskListView.toggleSubtasks display",
							})
						)
			);

			// Find the card element and toggle subtasks display
			const card = target.closest<HTMLElement>(".task-card");
			if (card) {
				const { toggleSubtasks } = await import("../ui/TaskCard");
				await toggleSubtasks(card, task, this.context.plugin, newExpanded);
			}
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][TaskListView] Failed to toggle subtasks", {
				category: "persistence",
				operation: "toggle-subtasks",
				error: error,
			});
			new Notice(
				this.context.plugin.i18n.translate(
					msg({
						message: "Failed to toggle subtasks",
						context: "notices.interface.subtasksFailed",
					})
				)
			);
		}
	}

	private async toggleBlockingTasks(task: TaskInfo, target: HTMLElement): Promise<void> {
		try {
			const expanded = target.classList.toggle("task-card__blocking-toggle--expanded");

			// Find the card element and toggle blocking tasks display
			const card = target.closest<HTMLElement>(".task-card");
			if (card) {
				const { toggleBlockingTasks } = await import("../ui/TaskCard");
				await toggleBlockingTasks(card, task, this.context.plugin, expanded);
			}
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][TaskListView] Failed to toggle blocking tasks", {
				category: "persistence",
				operation: "toggle-blocking-tasks",
				error: error,
			});
			new Notice(
				this.context.plugin.i18n.translate(
					msg({
						message: "Failed to load dependencies",
						context: "ui.taskCard.blockingLoadError",
					})
				)
			);
		}
	}
}
