import { TFile, type Vault } from "obsidian";
import { AutoArchiveService } from "../AutoArchiveService";
import {
	EVENT_TASK_UPDATED,
	IWebhookNotifier,
	StatusConfig,
	TaskInfo,
} from "../../types";
import type { TaskNotesSettings } from "../../types/settings";
import { splitFrontmatterAndBody } from "../../utils/helpers";
import { generateUniqueFilename } from "../../utils/filenameGenerator";
import { getCurrentDateString, getCurrentTimestamp } from "../../utils/dateUtils";
import {
	applyTaskUpdateFrontmatterChange,
	buildTaskUpdateRecurrenceUpdates,
	buildUpdatedTaskFromPlan,
	normalizeTaskUpdateDetails,
	normalizeTaskUpdateInput,
	type TaskUpdateFieldMapper,
} from "./taskUpdatePlanning";

interface TaskUpdateFileManager {
	processFrontMatter(file: TFile, fn: (frontmatter: Record<string, unknown>) => void): Promise<void>;
	renameFile(file: TFile, newPath: string): Promise<void>;
}

interface TaskUpdateStatusManager {
	isCompletedStatus(status: string): boolean;
	getStatusConfig(status: string): StatusConfig | undefined;
}

interface TaskUpdateCacheManager {
	waitForFreshTaskData?: (file: TFile) => Promise<void>;
	updateTaskInfoInCache(path: string, task: TaskInfo): void;
	clearCacheEntry(path: string): void;
}

interface TaskUpdateEmitter {
	trigger(event: typeof EVENT_TASK_UPDATED, payload: unknown): void;
}

interface TaskUpdateCalendarSyncService {
	isEnabled(): boolean;
	completeTaskInCalendar(task: TaskInfo): Promise<void>;
	updateTaskInCalendar(updatedTask: TaskInfo, originalTask: TaskInfo): Promise<void>;
}

interface TaskUpdateRenameIndexes {
	expandedProjectsService: {
		renamePath(oldPath: string, newPath: string): void;
	};
	projectSubtasksService: {
		invalidateIndex(): void;
	};
}

type TaskUpdateSettings = Pick<
	TaskNotesSettings,
	| "storeTitleInFilename"
	| "maintainDueDateOffsetInRecurring"
	| "taskIdentificationMethod"
	| "taskTag"
	| "taskPropertyName"
	| "taskPropertyValue"
>;

export interface TaskUpdateRuntime extends TaskUpdateRenameIndexes {
	app: {
		vault: Vault;
		fileManager: TaskUpdateFileManager;
	};
	settings: TaskUpdateSettings;
	fieldMapper: TaskUpdateFieldMapper;
	statusManager: TaskUpdateStatusManager;
	cacheManager: TaskUpdateCacheManager;
	emitter: TaskUpdateEmitter;
	taskCalendarSyncService?: TaskUpdateCalendarSyncService;
}

export interface TaskUpdateServiceDependencies {
	runtime: TaskUpdateRuntime;
	webhookNotifier?: IWebhookNotifier;
	autoArchiveService?: AutoArchiveService;
	updateCompletedDateInFrontmatter(
		frontmatter: Record<string, unknown>,
		newStatus: string,
		isRecurring: boolean
	): void;
}

export class TaskUpdateService {
	constructor(private deps: TaskUpdateServiceDependencies) {}

	setWebhookNotifier(webhookNotifier?: IWebhookNotifier): void {
		this.deps.webhookNotifier = webhookNotifier;
	}

	setAutoArchiveService(autoArchiveService?: AutoArchiveService): void {
		this.deps.autoArchiveService = autoArchiveService;
	}

	async updateTask(
		originalTask: TaskInfo,
		updates: Partial<TaskInfo> & { details?: string }
	): Promise<TaskInfo> {
		const { runtime } = this.deps;

		try {
			const taskUpdates = normalizeTaskUpdateInput(updates);
			const file = runtime.app.vault.getAbstractFileByPath(originalTask.path);
			if (!(file instanceof TFile)) {
				throw new Error(`Cannot find task file: ${originalTask.path}`);
			}

			const isRenameNeeded =
				runtime.settings.storeTitleInFilename &&
				taskUpdates.title &&
				taskUpdates.title !== originalTask.title;
			let newPath = originalTask.path;

			if (isRenameNeeded && taskUpdates.title) {
				const parentPath = file.parent ? file.parent.path : "";
				const newFilename = await generateUniqueFilename(
					taskUpdates.title,
					parentPath,
					runtime.app.vault
				);
				newPath = parentPath ? `${parentPath}/${newFilename}.md` : `${newFilename}.md`;
			}

			const recurrenceUpdates = buildTaskUpdateRecurrenceUpdates({
				originalTask,
				updates: taskUpdates,
				maintainDueDateOffsetInRecurring:
					runtime.settings.maintainDueDateOffsetInRecurring,
			});
			const normalizedDetails = normalizeTaskUpdateDetails(taskUpdates);
			let finalTags: string[] | undefined;
			const dateModified = getCurrentTimestamp();
			const currentDateString =
				taskUpdates.status !== undefined && !originalTask.recurrence
					? getCurrentDateString()
					: "";

			await runtime.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const frontmatterResult = applyTaskUpdateFrontmatterChange({
					frontmatter,
					originalTask,
					updates: taskUpdates,
					recurrenceUpdates,
					dateModified,
					fieldMapper: runtime.fieldMapper,
					taskIdentification: {
						method: runtime.settings.taskIdentificationMethod,
						tag: runtime.settings.taskTag,
						propertyName: runtime.settings.taskPropertyName,
						propertyValue: runtime.settings.taskPropertyValue,
					},
					storeTitleInFilename: runtime.settings.storeTitleInFilename,
					updateCompletedDateInFrontmatter: (targetFrontmatter, newStatus, isRecurring) =>
						this.deps.updateCompletedDateInFrontmatter(
							targetFrontmatter,
							newStatus,
							isRecurring
						),
				});
				finalTags = frontmatterResult.finalTags;
			});

			if (isRenameNeeded) {
				await runtime.app.fileManager.renameFile(file, newPath);
			}

			if (normalizedDetails !== null) {
				const targetFile = runtime.app.vault.getAbstractFileByPath(newPath);
				if (targetFile instanceof TFile) {
					const currentContent = await runtime.app.vault.read(targetFile);
					const { frontmatter: frontmatterText } =
						splitFrontmatterAndBody(currentContent);
					const frontmatterBlock =
						frontmatterText !== null ? `---\n${frontmatterText}\n---\n\n` : "";
					const bodyContent = normalizedDetails.trimEnd();
					const finalBody = bodyContent.length > 0 ? `${bodyContent}\n` : "";
					await runtime.app.vault.modify(targetFile, `${frontmatterBlock}${finalBody}`);
				}
			}

			const updatedTask = buildUpdatedTaskFromPlan({
				originalTask,
				updates: taskUpdates,
				recurrenceUpdates,
				newPath,
				dateModified,
				currentDateString,
				normalizedDetails,
				finalTags,
				isCompletedStatus: (status) => runtime.statusManager.isCompletedStatus(status),
			});

			if (isRenameNeeded) {
				runtime.cacheManager.clearCacheEntry(originalTask.path);
				runtime.expandedProjectsService.renamePath(originalTask.path, newPath);
				runtime.projectSubtasksService.invalidateIndex();
			}
			try {
				const finalFile = runtime.app.vault.getAbstractFileByPath(newPath);
				if (finalFile instanceof TFile && runtime.cacheManager.waitForFreshTaskData) {
					const keyChanges: Partial<TaskInfo> = {};
					if (taskUpdates.title !== undefined) keyChanges.title = taskUpdates.title;
					if (taskUpdates.status !== undefined) keyChanges.status = taskUpdates.status;
					if (taskUpdates.priority !== undefined) keyChanges.priority = taskUpdates.priority;
					if (Object.keys(keyChanges).length > 0) {
						await runtime.cacheManager.waitForFreshTaskData(finalFile);
					}
				}
				runtime.cacheManager.updateTaskInfoInCache(newPath, updatedTask);
			} catch (cacheError) {
				console.error("Error updating task cache:", {
					error: cacheError instanceof Error ? cacheError.message : String(cacheError),
					taskPath: newPath,
				});
			}

			try {
				runtime.emitter.trigger(EVENT_TASK_UPDATED, {
					path: newPath,
					originalTask,
					updatedTask,
				});
			} catch (eventError) {
				console.error("Error emitting task update event:", {
					error: eventError instanceof Error ? eventError.message : String(eventError),
					taskPath: newPath,
				});
			}

			if (this.deps.webhookNotifier) {
				try {
					const wasCompleted = runtime.statusManager.isCompletedStatus(
						originalTask.status
					);
					const isCompleted = runtime.statusManager.isCompletedStatus(updatedTask.status);

					if (!wasCompleted && isCompleted) {
						await this.deps.webhookNotifier.triggerWebhook("task.completed", {
							task: updatedTask,
						});
					} else {
						await this.deps.webhookNotifier.triggerWebhook("task.updated", {
							task: updatedTask,
							previous: originalTask,
						});
					}
				} catch (error) {
					console.warn("Failed to trigger webhook for task update:", error);
				}
			}

			if (runtime.taskCalendarSyncService?.isEnabled()) {
				const wasCompleted = runtime.statusManager.isCompletedStatus(originalTask.status);
				const isCompleted = runtime.statusManager.isCompletedStatus(updatedTask.status);

				const syncPromise =
					!wasCompleted && isCompleted
						? runtime.taskCalendarSyncService.completeTaskInCalendar(updatedTask)
						: runtime.taskCalendarSyncService.updateTaskInCalendar(
								updatedTask,
								originalTask
							);

				syncPromise.catch((error) => {
					console.warn("Failed to sync task update to Google Calendar:", error);
				});
			}

			await this.handleAutoArchive(originalTask, updatedTask, taskUpdates.status);
			return updatedTask;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error updating task:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskPath: originalTask.path,
				updates,
			});
			throw new Error(`Failed to update task: ${errorMessage}`);
		}
	}

	private async handleAutoArchive(
		originalTask: TaskInfo,
		updatedTask: TaskInfo,
		newStatus: string | undefined
	): Promise<void> {
		if (
			!this.deps.autoArchiveService ||
			newStatus === undefined ||
			newStatus === originalTask.status
		) {
			return;
		}

		try {
			const statusConfig = this.deps.runtime.statusManager.getStatusConfig(updatedTask.status);
			if (!statusConfig) {
				return;
			}

			if (statusConfig.autoArchive) {
				await this.deps.autoArchiveService.scheduleAutoArchive(updatedTask, statusConfig);
			} else {
				await this.deps.autoArchiveService.cancelAutoArchive(updatedTask.path);
			}
		} catch (error) {
			console.warn("Failed to handle auto-archive for status change:", error);
		}
	}
}
