import { displayError } from "../../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice, setTooltip } from "obsidian";
import TaskNotesPlugin from "../../main";
import { TaskInfo } from "../../types";
import { formatDateForStorage, getDatePart, parseDateToUTC } from "../../utils/dateUtils";
import {
	resolveCompletionDate,
	type CompletionDateContext,
	type CompletionMode,
} from "../../ui/completionDateResolver";
import { getRecurringTaskActionDate } from "../../services/task-service/taskRecurringPlanning";
import { DateTimePickerModal } from "../../modals/DateTimePickerModal";
import {
	openMaterializedOccurrenceParent,
	openOrCreateOccurrenceNote,
} from "../../ui/occurrenceNoteActions";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
import type { TaskContextMenuOptions } from "./types";
import { getSubmenu, getMenuItemElement } from "./helpers";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/TaskContextMenu" });
export class TaskCompletionMenu {
	constructor(
		private options: TaskContextMenuOptions,
		private menu: Menu
	) {}
	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}
	addCompleteOrSkipSection(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const isRecurring = !!task.recurrence;

		// Default to the submenu when the setting is unset (backward compatible).
		if (plugin.settings.completionMenuAsSubmenu === false) {
			this.menu.addSeparator();
			this.addCompletionMenuItems(task, plugin, this.menu);
			if (isRecurring) {
				this.addSkipMenuItem(task, plugin, this.menu);
			}
			this.menu.addSeparator();
			return;
		}

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					isRecurring
						? msg({
								message: "Mark complete or skip",
								context: "contextMenus.task.completion.submenu",
							})
						: msg({
								message: "Mark complete",
								context: "contextMenus.task.completion.submenuCompleteOnly",
							})
				)
			);
			item.setIcon("check-check");
			const submenu = getSubmenu(item);
			this.addCompletionMenuItems(task, plugin, submenu);
			if (isRecurring) {
				this.addSkipMenuItem(task, plugin, submenu);
			}
		});
	}

	addCompletionMenuItems(task: TaskInfo, plugin: TaskNotesPlugin, menu: Menu): void {
		const isRecurring = !!task.recurrence;

		if (!isRecurring && plugin.statusManager.isCompletedStatus(task.status)) {
			menu.addItem((item) => {
				item.setTitle(
					this.t(
						msg({
							message: "Mark incomplete",
							context: "contextMenus.task.completion.markIncomplete",
						})
					)
				);
				item.setIcon("x");
				item.onClick(async () => {
					await this.uncompleteNonRecurringTask(task, plugin);
				});
			});
			return;
		}

		this.addConcreteCompletionAction(
			task,
			plugin,
			"today",
			msg({
				message: "Completed today",
				context: "contextMenus.task.completion.completeToday",
			}),
			menu
		);
		this.addConcreteCompletionAction(
			task,
			plugin,
			"asScheduled",
			msg({
				message: "Completed on schedule",
				context: "contextMenus.task.completion.completeAsScheduled",
			}),
			menu
		);
		this.addConcreteCompletionAction(
			task,
			plugin,
			"onDue",
			msg({
				message: "Completed on due date",
				context: "contextMenus.task.completion.completeOnDue",
			}),
			menu
		);
		this.addPickCompletionDateAction(task, plugin, menu);
	}

	addConcreteCompletionAction(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		mode: CompletionMode,
		baseLabelKey: MessageDescriptor,
		menu: Menu
	): void {
		const isRecurring = !!task.recurrence;
		const ctx: CompletionDateContext = { occurrenceDate: this.options.occurrenceDate };
		const resolution = resolveCompletionDate(task, mode, ctx);

		menu.addItem((item) => {
			if (!resolution.available) {
				// Shown disabled (not hidden) with a reason tooltip.
				item.setTitle(this.t(baseLabelKey));
				item.setIcon("check");
				item.setDisabled(true);
				const el = getMenuItemElement(item);
				if (el) {
					setTooltip(el, this.t(resolution.reasonKey));
				}
				return;
			}

			const resolvedDate = resolution.date;
			const alreadyComplete =
				isRecurring &&
				(task.complete_instances?.includes(formatDateForStorage(resolvedDate)) ?? false);
			item.setTitle(
				alreadyComplete
					? this.t(
							msg({
								message: "Mark incomplete",
								context: "contextMenus.task.completion.markIncomplete",
							})
						)
					: this.t(baseLabelKey)
			);
			item.setIcon(alreadyComplete ? "x" : "check");
			item.onClick(async () => {
				await this.dispatchCompletion(task, plugin, resolvedDate);
			});
		});
	}

	addPickCompletionDateAction(task: TaskInfo, plugin: TaskNotesPlugin, menu: Menu): void {
		menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Completed on (pick date)",
						context: "contextMenus.task.completion.completeOnPicked",
					})
				)
			);
			item.setIcon("calendar-plus");
			item.onClick(() => {
				this.pickCompletionDate(task, plugin);
			});
		});
	}

	pickCompletionDate(task: TaskInfo, plugin: TaskNotesPlugin): void {
		this.menu.hide();
		const modal = new DateTimePickerModal(plugin.app, {
			currentDate: null,
			title: this.t(
				msg({
					message: "Complete on date",
					context: "contextMenus.task.completion.pickDateTitle",
				})
			),
			showTime: false,
			plugin,
			onSelect: (date) => {
				if (!date) {
					return;
				}
				const picked = parseDateToUTC(getDatePart(date));
				const resolution = resolveCompletionDate(task, "onPicked", { pickedDate: picked });
				if (!resolution.available) {
					return;
				}
				void this.dispatchCompletion(task, plugin, resolution.date);
			},
		});
		modal.open();
	}

	async dispatchCompletion(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		resolvedDate: Date
	): Promise<void> {
		try {
			if (task.recurrence) {
				// Completion-anchored recurrences re-anchor DTSTART from the recorded date.
				await plugin.toggleRecurringTaskComplete(task, resolvedDate);
			} else {
				const completedStatus = plugin.statusManager.getCompletedStatuses()[0];
				if (!completedStatus) {
					new Notice(
						this.t(
							msg({
								message: "No completed status configured",
								context: "contextMenus.task.completion.noCompletedStatus",
							})
						)
					);
					return;
				}
				await plugin.updateTaskProperty(task, "status", completedStatus, {
					completionDate: formatDateForStorage(resolvedDate),
				});
			}
			this.options.onUpdate?.();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error completing task:", {
				category: "persistence",
				operation: "completing-task",
				details: { taskPath: task.path },
				error: errorMessage,
			});
			new Notice(
				this.t(
					msg({
						message: "Failed to update task completion: {message}",
						context: "contextMenus.task.completion.completeFailure",
					}),
					{
						message: displayError(errorMessage),
					}
				)
			);
		}
	}

	async uncompleteNonRecurringTask(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		try {
			// Revert to the default open status; the status pipeline clears
			// completedDate for a non-completed status (mirrors uncompleteTask).
			const openStatus = plugin.settings.defaultTaskStatus ?? "open";
			await plugin.updateTaskProperty(task, "status", openStatus);
			this.options.onUpdate?.();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error marking task incomplete:", {
				category: "persistence",
				operation: "uncompleting-task",
				details: { taskPath: task.path },
				error: errorMessage,
			});
			new Notice(
				this.t(
					msg({
						message: "Failed to update task completion: {message}",
						context: "contextMenus.task.completion.completeFailure",
					}),
					{
						message: displayError(errorMessage),
					}
				)
			);
		}
	}

	addSkipMenuItem(task: TaskInfo, plugin: TaskNotesPlugin, menu: Menu): void {
		// Not routed through the four-mode resolver: that would drop the completion-anchor guard.
		const skipOccurrenceDate = this.options.occurrenceDate;
		const skipLabelDate = skipOccurrenceDate ?? getRecurringTaskActionDate(task);
		const skipDateStr = formatDateForStorage(skipLabelDate);
		const isSkippedForDate = task.skipped_instances?.includes(skipDateStr) || false;

		menu.addItem((item) => {
			item.setTitle(
				isSkippedForDate
					? this.t(
							msg({
								message: "Unskip instance",
								context: "contextMenus.task.unskipInstance",
							})
						)
					: this.t(
							msg({
								message: "Skip instance",
								context: "contextMenus.task.skipInstance",
							})
						)
			);
			item.setIcon(isSkippedForDate ? "undo" : "x-circle");
			item.onClick(async () => {
				try {
					await plugin.taskService.toggleRecurringTaskSkipped(task, skipOccurrenceDate);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					tasknotesLogger.error("Error toggling recurring task skip:", {
						category: "persistence",
						operation: "toggling-recurring-task-skip",
						details: { taskPath: task.path },
						error: errorMessage,
					});
					new Notice(
						this.t(
							msg({
								message: "Failed to toggle recurring task skip: {message}",
								context: "contextMenus.task.notices.toggleSkipFailure",
							}),
							{
								message: displayError(errorMessage),
							}
						)
					);
				}
			});
		});
	}

	addPromotedOccurrenceControls(task: TaskInfo, plugin: TaskNotesPlugin): boolean {
		if (!this.options.promoteOccurrenceControls) {
			return false;
		}

		let added = false;
		if (task.recurrence) {
			this.addOccurrenceNoteMenuItem(task, plugin);
			added = true;
		}
		if (task.recurrence_parent && task.occurrence_date) {
			this.addMaterializedOccurrenceMenuItems(task, plugin);
			added = true;
		}

		if (added) {
			this.menu.addSeparator();
		}
		return added;
	}

	addOccurrenceNoteMenuItem(task: TaskInfo, plugin: TaskNotesPlugin): void {
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Open or create occurrence note",
						context: "modals.actionPalette.openOccurrence",
					})
				)
			);
			item.setIcon("file-plus");
			item.onClick(async () => {
				await openOrCreateOccurrenceNote({
					plugin,
					parentTask: task,
					targetDate: this.getOccurrenceNoteTargetDate(task),
					onUpdate: this.options.onUpdate,
				});
			});
		});
	}

	getOccurrenceNoteTargetDate(task: TaskInfo): Date {
		if (this.options.promoteOccurrenceControls || task.recurrence_anchor !== "completion") {
			return this.options.targetDate;
		}

		try {
			const scheduledDate = getDatePart(task.scheduled || "");
			return scheduledDate ? parseDateToUTC(scheduledDate) : this.options.targetDate;
		} catch {
			return this.options.targetDate;
		}
	}

	addMaterializedOccurrenceMenuItems(task: TaskInfo, plugin: TaskNotesPlugin): void {
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Open recurring parent",
						context: "modals.actionPalette.openParent",
					})
				)
			);
			item.setIcon("refresh-ccw");
			item.onClick(async () => {
				await openMaterializedOccurrenceParent({
					plugin,
					occurrenceTask: task,
				});
			});
		});

		const skippedStatus = this.getSkippedStatusValue(plugin);
		const isSkipped = this.isSkippedMaterializedOccurrence(task, plugin);
		if (!skippedStatus && !isSkipped) {
			return;
		}

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					isSkipped
						? msg({
								message: "Unskip instance",
								context: "contextMenus.task.unskipInstance",
							})
						: msg({
								message: "Skip instance",
								context: "contextMenus.task.skipInstance",
							})
				)
			);
			item.setIcon(isSkipped ? "undo" : "x-circle");
			item.onClick(async () => {
				try {
					const updatedTask = isSkipped
						? await plugin.taskService.unskipMaterializedOccurrence(task)
						: await plugin.taskService.skipMaterializedOccurrence(task, skippedStatus);
					Object.assign(task, updatedTask);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					tasknotesLogger.error("Error updating materialized occurrence skip state:", {
						category: "persistence",
						operation: "updating-materialized-occurrence-skip-state",
						details: { taskPath: task.path, occurrenceDate: task.occurrence_date },
						error: errorMessage,
					});
					new Notice(
						this.t(
							msg({
								message: "Failed to update task: {message}",
								context: "modals.taskEdit.notices.updateFailure",
							}),
							{ message: displayError(errorMessage) }
						)
					);
				}
			});
		});
	}

	getSkippedStatusValue(plugin: TaskNotesPlugin): string | undefined {
		return plugin.settings.customStatuses?.find((status) => status.isSkipped)?.value;
	}

	isSkippedMaterializedOccurrence(task: TaskInfo, plugin: TaskNotesPlugin): boolean {
		return (
			plugin.settings.customStatuses?.some(
				(status) => status.isSkipped && status.value === task.status
			) === true
		);
	}
}
