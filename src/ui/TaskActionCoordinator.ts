import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { EVENT_DATA_CHANGED } from "../types";
import { TimeEntryEditorModal } from "../modals/TimeEntryEditorModal";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { getCurrentDateString } from "../core/date";
import { getActiveTimeEntry } from "../utils/helpers";
import { getOverdueScheduledRolloverCandidates } from "../utils/scheduledRollover";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { showNotice } from "../ui/notifications";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TaskActionCoordinator" });

export class TaskActionCoordinator {
	constructor(private plugin: TaskNotesPlugin) {}

	private async openTaskFile(task: TaskInfo): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) {
			await this.plugin.app.workspace.getLeaf(false).openFile(file);
		}
	}

	async openTaskSelectorWithCreate(): Promise<void> {
		const { openTaskSelectorWithCreate } = await import(
			"../modals/TaskSelectorWithCreateModal"
		);
		const result = await openTaskSelectorWithCreate(this.plugin);

		if (result.type === "selected" || result.type === "created") {
			await this.openTaskFile(result.task);
		}
	}

	async openTaskSelectorWithCreateAndStartTracking(): Promise<void> {
		const { openTaskSelectorWithCreate } = await import(
			"../modals/TaskSelectorWithCreateModal"
		);
		const targetDate = new Date();
		const result = await openTaskSelectorWithCreate(this.plugin, { targetDate });

		if (result.type === "selected" || result.type === "created") {
			let taskToOpen = result.task;
			try {
				taskToOpen = await this.startTimeTracking(result.task);
			} catch {
				// startTimeTracking shows the user-facing notice; keep create/open behavior intact.
			} finally {
				await this.openTaskFile(taskToOpen);
			}
		}
	}

	async startTimeTracking(task: TaskInfo, description?: string): Promise<TaskInfo> {
		try {
			let updatedTask = await this.plugin.taskService.startTimeTracking(task);

			const trimmedDescription = description?.trim();
			if (
				trimmedDescription &&
				updatedTask.timeEntries &&
				updatedTask.timeEntries.length > 0
			) {
				const latestEntry = updatedTask.timeEntries[updatedTask.timeEntries.length - 1];
				if (latestEntry && !latestEntry.endTime) {
					latestEntry.description = trimmedDescription;
					updatedTask = await this.plugin.taskService.updateTask(updatedTask, {
						timeEntries: updatedTask.timeEntries,
					});
				}
			}

			showNotice("Time tracking started");
			this.requestStatusBarUpdate();
			return updatedTask;
		} catch (error: unknown) {
			tasknotesLogger.error("Failed to start time tracking:", {
				category: "persistence",
				operation: "start-time-tracking",
				error: error,
			});
			if (
				error instanceof Error &&
				error.message === "Time tracking is already active for this task"
			) {
				showNotice("Time tracking is already active for this task");
			} else {
				showNotice("Failed to start time tracking");
			}
			throw error;
		}
	}

	async stopTimeTracking(task: TaskInfo): Promise<TaskInfo> {
		try {
			const updatedTask = await this.plugin.taskService.stopTimeTracking(task);
			showNotice("Time tracking stopped");
			this.requestStatusBarUpdate();
			return updatedTask;
		} catch (error: unknown) {
			tasknotesLogger.error("Failed to stop time tracking:", {
				category: "persistence",
				operation: "stop-time-tracking",
				error: error,
			});
			if (
				error instanceof Error &&
				error.message === "No active time tracking session for this task"
			) {
				showNotice("No active time tracking session for this task");
			} else {
				showNotice("Failed to stop time tracking");
			}
			throw error;
		}
	}

	async openTaskSelectorForTimeTracking(): Promise<void> {
		try {
			const targetDate = new Date();
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			const availableTasks = allTasks
				.filter((task) => !task.archived)
				.filter((task) => !getActiveTimeEntry(task.timeEntries || []));

			if (availableTasks.length === 0) {
				showNotice(this.plugin.i18n.translate("modals.timeTracking.noTasksAvailable"));
				return;
			}

			openTaskSelector(
				this.plugin,
				availableTasks,
				(selectedTask) => {
					void (async () => {
						if (!selectedTask) {
							return;
						}

						try {
							await this.startTimeTracking(selectedTask);
							showNotice(
								this.plugin.i18n.translate("modals.timeTracking.started", {
									taskTitle: selectedTask.title,
								})
							);
						} catch (error) {
							tasknotesLogger.error("Error starting time tracking:", {
								category: "persistence",
								operation: "starting-time-tracking",
								error: error,
							});
							showNotice(
								this.plugin.i18n.translate("modals.timeTracking.startFailed")
							);
						}
					})();
				},
				{ targetDate }
			);
		} catch (error) {
			tasknotesLogger.error("Error opening task selector for time tracking:", {
				category: "persistence",
				operation: "opening-task-selector-time-tracking",
				error: error,
			});
			showNotice(this.plugin.i18n.translate("modals.timeTracking.startFailed"));
		}
	}

	async openTaskSelectorForTimeEntryEditor(): Promise<void> {
		try {
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			const tasksWithEntries = allTasks
				.filter((task) => !task.archived)
				.filter((task) => task.timeEntries && task.timeEntries.length > 0);

			if (tasksWithEntries.length === 0) {
				showNotice(this.plugin.i18n.translate("modals.timeEntryEditor.noTasksWithEntries"));
				return;
			}

			openTaskSelector(this.plugin, tasksWithEntries, (selectedTask) => {
				if (selectedTask) {
					this.openTimeEntryEditor(selectedTask);
				}
			});
		} catch (error) {
			tasknotesLogger.error("Error opening task selector for time entry editor:", {
				category: "persistence",
				operation: "opening-task-selector-time-entry-editor",
				error: error,
			});
			showNotice(this.plugin.i18n.translate("modals.timeEntryEditor.openFailed"));
		}
	}

	async rolloverOverdueScheduledTasks(): Promise<void> {
		try {
			const today = getCurrentDateString();
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			const candidates = getOverdueScheduledRolloverCandidates(
				allTasks,
				(status) => this.plugin.statusManager.isCompletedStatus(status),
				today
			);

			if (candidates.length === 0) {
				showNotice("No overdue scheduled tasks to postpone");
				return;
			}

			const taskLabel = candidates.length === 1 ? "task" : "tasks";
			const confirmed = await showConfirmationModal(this.plugin.app, {
				title: "Postpone overdue scheduled tasks",
				message: `Move ${candidates.length} active overdue scheduled ${taskLabel} to today (${today})?`,
				confirmText: "Postpone",
				cancelText: this.plugin.i18n.translate("common.cancel"),
			});

			if (!confirmed) {
				return;
			}

			showNotice(`Postponing ${candidates.length} ${taskLabel}...`);

			let successCount = 0;
			let failCount = 0;
			for (const candidate of candidates) {
				try {
					await this.plugin.taskService.updateProperty(
						candidate.task,
						"scheduled",
						candidate.nextScheduled
					);
					successCount++;
				} catch (error) {
					tasknotesLogger.error(
						`[TaskActionCoordinator] Failed to postpone scheduled task ${candidate.task.path}:`,
						{
							category: "persistence",
							operation: "postpone-scheduled-task",
							error: error,
						}
					);
					failCount++;
				}
			}

			if (failCount === 0) {
				showNotice(`Postponed ${successCount} ${successCount === 1 ? "task" : "tasks"}`);
			} else {
				showNotice(`Postponed ${successCount} tasks, ${failCount} failed`);
			}

			this.plugin.emitter.trigger(EVENT_DATA_CHANGED);
		} catch (error) {
			tasknotesLogger.error("Failed to postpone overdue scheduled tasks:", {
				category: "persistence",
				operation: "postpone-overdue-scheduled-tasks",
				error: error,
			});
			showNotice("Failed to postpone overdue scheduled tasks");
		}
	}

	openTimeEntryEditor(task: TaskInfo, onSave?: () => void): void {
		const modal = new TimeEntryEditorModal(
			this.plugin.app,
			this.plugin,
			task,
			(updatedEntries) => {
				void (async () => {
					try {
						const sanitizedEntries = updatedEntries.map((entry) => {
							const sanitizedEntry = { ...entry };
							delete sanitizedEntry.duration;
							return sanitizedEntry;
						});

						await this.plugin.taskService.updateTask(task, {
							timeEntries: sanitizedEntries,
						});

						onSave?.();
						this.plugin.emitter.trigger(EVENT_DATA_CHANGED);
						showNotice(this.plugin.i18n.translate("modals.timeEntryEditor.saved"));
					} catch (error) {
						tasknotesLogger.error("Error saving time entries:", {
							category: "persistence",
							operation: "saving-time-entries",
							error: error,
						});
						showNotice(this.plugin.i18n.translate("modals.timeEntryEditor.saveFailed"));
					}
				})();
			}
		);

		modal.open();
	}

	private requestStatusBarUpdate(): void {
		if (this.plugin.statusBarService) {
			window.setTimeout(() => {
				this.plugin.statusBarService.requestUpdate();
			}, 50);
		}
	}
}
