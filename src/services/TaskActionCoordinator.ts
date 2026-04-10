import { Notice, TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { EVENT_DATA_CHANGED } from "../types";
import { TimeEntryEditorModal } from "../modals/TimeEntryEditorModal";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { getActiveTimeEntry } from "../utils/helpers";

export class TaskActionCoordinator {
	constructor(private plugin: TaskNotesPlugin) {}

	async openTaskSelectorWithCreate(): Promise<void> {
		const { openTaskSelectorWithCreate } = await import(
			"../modals/TaskSelectorWithCreateModal"
		);
		const result = await openTaskSelectorWithCreate(this.plugin);

		if (result.type === "selected" || result.type === "created") {
			const file = this.plugin.app.vault.getAbstractFileByPath(result.task.path);
			if (file instanceof TFile) {
				await this.plugin.app.workspace.getLeaf(false).openFile(file);
			}
		}
	}

	async startTimeTracking(task: TaskInfo, description?: string): Promise<TaskInfo> {
		try {
			let updatedTask = await this.plugin.taskService.startTimeTracking(task);

			const trimmedDescription = description?.trim();
			if (trimmedDescription && updatedTask.timeEntries && updatedTask.timeEntries.length > 0) {
				const latestEntry = updatedTask.timeEntries[updatedTask.timeEntries.length - 1];
				if (latestEntry && !latestEntry.endTime) {
					latestEntry.description = trimmedDescription;
					updatedTask = await this.plugin.taskService.updateTask(updatedTask, {
						timeEntries: updatedTask.timeEntries,
					});
				}
			}

			new Notice("Time tracking started");
			this.requestStatusBarUpdate();
			return updatedTask;
		} catch (error: any) {
			console.error("Failed to start time tracking:", error);
			if (error.message === "Time tracking is already active for this task") {
				new Notice("Time tracking is already active for this task");
			} else {
				new Notice("Failed to start time tracking");
			}
			throw error;
		}
	}

	async stopTimeTracking(task: TaskInfo): Promise<TaskInfo> {
		try {
			const updatedTask = await this.plugin.taskService.stopTimeTracking(task);
			new Notice("Time tracking stopped");
			this.requestStatusBarUpdate();
			return updatedTask;
		} catch (error: any) {
			console.error("Failed to stop time tracking:", error);
			if (error.message === "No active time tracking session for this task") {
				new Notice("No active time tracking session for this task");
			} else {
				new Notice("Failed to stop time tracking");
			}
			throw error;
		}
	}

	async openTaskSelectorForTimeTracking(): Promise<void> {
		try {
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			const availableTasks = allTasks
				.filter((task) => !task.archived)
				.filter((task) => !getActiveTimeEntry(task.timeEntries || []));

			if (availableTasks.length === 0) {
				new Notice(this.plugin.i18n.translate("modals.timeTracking.noTasksAvailable"));
				return;
			}

			openTaskSelector(this.plugin, availableTasks, async (selectedTask) => {
				if (!selectedTask) {
					return;
				}

				try {
					await this.startTimeTracking(selectedTask);
					new Notice(
						this.plugin.i18n.translate("modals.timeTracking.started", {
							taskTitle: selectedTask.title,
						})
					);
				} catch (error) {
					console.error("Error starting time tracking:", error);
					new Notice(this.plugin.i18n.translate("modals.timeTracking.startFailed"));
				}
			});
		} catch (error) {
			console.error("Error opening task selector for time tracking:", error);
			new Notice(this.plugin.i18n.translate("modals.timeTracking.startFailed"));
		}
	}

	async openTaskSelectorForTimeEntryEditor(): Promise<void> {
		try {
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			const tasksWithEntries = allTasks
				.filter((task) => !task.archived)
				.filter((task) => task.timeEntries && task.timeEntries.length > 0);

			if (tasksWithEntries.length === 0) {
				new Notice(this.plugin.i18n.translate("modals.timeEntryEditor.noTasksWithEntries"));
				return;
			}

			openTaskSelector(this.plugin, tasksWithEntries, (selectedTask) => {
				if (selectedTask) {
					this.openTimeEntryEditor(selectedTask);
				}
			});
		} catch (error) {
			console.error("Error opening task selector for time entry editor:", error);
			new Notice(this.plugin.i18n.translate("modals.timeEntryEditor.openFailed"));
		}
	}

	openTimeEntryEditor(task: TaskInfo, onSave?: () => void): void {
		const modal = new TimeEntryEditorModal(
			this.plugin.app,
			this.plugin,
			task,
			async (updatedEntries) => {
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
					new Notice(this.plugin.i18n.translate("modals.timeEntryEditor.saved"));
				} catch (error) {
					console.error("Error saving time entries:", error);
					new Notice(this.plugin.i18n.translate("modals.timeEntryEditor.saveFailed"));
				}
			}
		);

		modal.open();
	}

	private requestStatusBarUpdate(): void {
		if (this.plugin.statusBarService) {
			setTimeout(() => {
				this.plugin.statusBarService.requestUpdate();
			}, 50);
		}
	}
}
