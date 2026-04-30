import { TFile } from "obsidian";
import { AutoArchiveService } from "../AutoArchiveService";
import type TaskNotesPlugin from "../../main";
import { EVENT_TASK_UPDATED, IWebhookNotifier, TaskInfo } from "../../types";
import {
	addDTSTARTToRecurrenceRule,
	updateToNextScheduledOccurrence,
} from "../../core/recurrence";
import {
	splitFrontmatterAndBody,
} from "../../utils/helpers";
import { generateUniqueFilename } from "../../utils/filenameGenerator";
import {
	getCurrentDateString,
	getCurrentTimestamp,
	getDatePart,
} from "../../utils/dateUtils";

export interface TaskUpdateServiceDependencies {
	plugin: TaskNotesPlugin;
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
		const { plugin } = this.deps;

		try {
			const file = plugin.app.vault.getAbstractFileByPath(originalTask.path);
			if (!(file instanceof TFile)) {
				throw new Error(`Cannot find task file: ${originalTask.path}`);
			}

			if (Array.isArray(updates.timeEntries)) {
				updates.timeEntries = updates.timeEntries.map((entry) => {
					const sanitizedEntry = { ...entry };
					delete sanitizedEntry.duration;
					return sanitizedEntry;
				});
			}

			const isRenameNeeded =
				plugin.settings.storeTitleInFilename &&
				updates.title &&
				updates.title !== originalTask.title;
			let newPath = originalTask.path;

			if (isRenameNeeded) {
				const parentPath = file.parent ? file.parent.path : "";
				const newFilename = await generateUniqueFilename(
					updates.title!,
					parentPath,
					plugin.app.vault
				);
				newPath = parentPath ? `${parentPath}/${newFilename}.md` : `${newFilename}.md`;
			}

			const recurrenceUpdates = this.getRecurrenceUpdates(originalTask, updates);
			const effectiveUpdates: Partial<TaskInfo> = { ...updates, ...recurrenceUpdates };
			let normalizedDetails: string | null = null;
			if (Object.prototype.hasOwnProperty.call(updates, "details")) {
				normalizedDetails =
					typeof updates.details === "string" ? updates.details.replace(/\r\n/g, "\n") : "";
			}

			await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const completeTaskData: Partial<TaskInfo> = {
					...originalTask,
					...updates,
					...recurrenceUpdates,
					dateModified: getCurrentTimestamp(),
				};

				const mappedFrontmatter = plugin.fieldMapper.mapToFrontmatter(
					completeTaskData,
					plugin.settings.taskIdentificationMethod === "tag"
						? plugin.settings.taskTag
						: undefined,
					plugin.settings.storeTitleInFilename
				);

				Object.entries(mappedFrontmatter).forEach(([key, value]) => {
					if (value !== undefined) {
						frontmatter[key] = value;
					}
				});

				if (updates.status !== undefined) {
					this.deps.updateCompletedDateInFrontmatter(
						frontmatter,
						updates.status,
						!!originalTask.recurrence
					);
				}

				if (plugin.settings.taskIdentificationMethod === "property") {
					const propName = plugin.settings.taskPropertyName;
					const propValue = plugin.settings.taskPropertyValue;
					if (propName && propValue) {
						const lower = propValue.toLowerCase();
						const coercedValue =
							lower === "true" || lower === "false" ? lower === "true" : propValue;
						frontmatter[propName] = coercedValue;
					}
				}

				const customFrontmatter = (updates as { customFrontmatter?: Record<string, unknown> })
					.customFrontmatter;
				if (customFrontmatter) {
					Object.entries(customFrontmatter).forEach(([key, value]) => {
						if (value === null) {
							delete frontmatter[key];
						} else {
							frontmatter[key] = value;
						}
					});
				}

				this.removeUnsetMappedFields(frontmatter, effectiveUpdates);

				if (isRenameNeeded) {
					delete frontmatter[plugin.fieldMapper.toUserField("title")];
				}

				if (Object.prototype.hasOwnProperty.call(updates, "tags")) {
					const tagsToSet = Array.isArray(updates.tags) ? [...updates.tags] : [];
					if (tagsToSet.length > 0) {
						frontmatter.tags = tagsToSet;
					} else {
						delete frontmatter.tags;
					}
				}
			});

			if (isRenameNeeded) {
				await plugin.app.fileManager.renameFile(file, newPath);
			}

			if (normalizedDetails !== null) {
				const targetFile = plugin.app.vault.getAbstractFileByPath(newPath);
				if (targetFile instanceof TFile) {
					const currentContent = await plugin.app.vault.read(targetFile);
					const { frontmatter: frontmatterText } = splitFrontmatterAndBody(currentContent);
					const frontmatterBlock =
						frontmatterText !== null ? `---\n${frontmatterText}\n---\n\n` : "";
					const bodyContent = normalizedDetails.trimEnd();
					const finalBody = bodyContent.length > 0 ? `${bodyContent}\n` : "";
					await plugin.app.vault.modify(targetFile, `${frontmatterBlock}${finalBody}`);
				}
			}

			const updatedTask: TaskInfo = {
				...originalTask,
				...updates,
				...recurrenceUpdates,
				path: newPath,
				dateModified: getCurrentTimestamp(),
			};

			if (normalizedDetails !== null) {
				updatedTask.details = normalizedDetails;
			}

			if (updates.status !== undefined && !originalTask.recurrence) {
				if (plugin.statusManager.isCompletedStatus(updates.status)) {
					if (!originalTask.completedDate) {
						updatedTask.completedDate = getCurrentDateString();
					}
				} else {
					updatedTask.completedDate = undefined;
				}
			}

			if (isRenameNeeded) {
				plugin.cacheManager.clearCacheEntry(originalTask.path);
			}
			try {
				const finalFile = plugin.app.vault.getAbstractFileByPath(newPath);
				if (finalFile instanceof TFile && plugin.cacheManager.waitForFreshTaskData) {
					const keyChanges: Partial<TaskInfo> = {};
					if (updates.title !== undefined) keyChanges.title = updates.title;
					if (updates.status !== undefined) keyChanges.status = updates.status;
					if (updates.priority !== undefined) keyChanges.priority = updates.priority;
					if (Object.keys(keyChanges).length > 0) {
						await plugin.cacheManager.waitForFreshTaskData(finalFile);
					}
				}
				plugin.cacheManager.updateTaskInfoInCache(newPath, updatedTask);
			} catch (cacheError) {
				console.error("Error updating task cache:", {
					error: cacheError instanceof Error ? cacheError.message : String(cacheError),
					taskPath: newPath,
				});
			}

			try {
				plugin.emitter.trigger(EVENT_TASK_UPDATED, {
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
					const wasCompleted = plugin.statusManager.isCompletedStatus(originalTask.status);
					const isCompleted = plugin.statusManager.isCompletedStatus(updatedTask.status);

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

			if (plugin.taskCalendarSyncService?.isEnabled()) {
				const wasCompleted = plugin.statusManager.isCompletedStatus(originalTask.status);
				const isCompleted = plugin.statusManager.isCompletedStatus(updatedTask.status);

				const syncPromise =
					!wasCompleted && isCompleted
						? plugin.taskCalendarSyncService.completeTaskInCalendar(updatedTask)
						: plugin.taskCalendarSyncService.updateTaskInCalendar(updatedTask, originalTask);

				syncPromise.catch((error) => {
					console.warn("Failed to sync task update to Google Calendar:", error);
				});
			}

			await this.handleAutoArchive(originalTask, updatedTask, updates.status);
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

	private getRecurrenceUpdates(
		originalTask: TaskInfo,
		updates: Partial<TaskInfo>
	): Partial<TaskInfo> {
		const { plugin } = this.deps;
		const recurrenceUpdates: Partial<TaskInfo> = {};

		if (updates.recurrence !== undefined && updates.recurrence !== originalTask.recurrence) {
			const tempTask: TaskInfo = { ...originalTask, ...updates };
			const nextDates = updateToNextScheduledOccurrence(
				tempTask,
				plugin.settings.maintainDueDateOffsetInRecurring
			);
			if (nextDates.scheduled) {
				recurrenceUpdates.scheduled = nextDates.scheduled;
			}
			if (nextDates.due) {
				recurrenceUpdates.due = nextDates.due;
			}
			if (
				typeof updates.recurrence === "string" &&
				updates.recurrence &&
				!updates.recurrence.includes("DTSTART:")
			) {
				const tempTaskWithRecurrence: TaskInfo = {
					...originalTask,
					...updates,
					...recurrenceUpdates,
				};
				const updatedRecurrence = addDTSTARTToRecurrenceRule(tempTaskWithRecurrence);
				if (updatedRecurrence) {
					recurrenceUpdates.recurrence = updatedRecurrence;
				}
			}
		} else if (updates.recurrence !== undefined && !originalTask.recurrence && updates.recurrence) {
			if (
				typeof updates.recurrence === "string" &&
				!updates.recurrence.includes("DTSTART:")
			) {
				const tempTask: TaskInfo = { ...originalTask, ...updates };
				const updatedRecurrence = addDTSTARTToRecurrenceRule(tempTask);
				if (updatedRecurrence) {
					recurrenceUpdates.recurrence = updatedRecurrence;
				}
			}
		}

		if (
			updates.scheduled !== undefined &&
			updates.scheduled !== originalTask.scheduled &&
			originalTask.recurrence &&
			typeof originalTask.recurrence === "string" &&
			!originalTask.recurrence.includes("DTSTART:")
		) {
			const tempTask: TaskInfo = { ...originalTask, ...updates };
			const updatedRecurrence = addDTSTARTToRecurrenceRule(tempTask);
			if (updatedRecurrence) {
				recurrenceUpdates.recurrence = updatedRecurrence;
			}
		}

		if (
			Object.prototype.hasOwnProperty.call(updates, "scheduled") &&
			updates.scheduled !== originalTask.scheduled &&
			this.shouldTrackGoogleCalendarRecurringException(
				originalTask.recurrence,
				originalTask.recurrence_anchor
			)
		) {
			const priorOccurrence = this.getRecurringExceptionOriginalDate(originalTask);
			if (priorOccurrence) {
				const nextScheduled = getDatePart(updates.scheduled || "");
				recurrenceUpdates.googleCalendarExceptionOriginalScheduled =
					nextScheduled && nextScheduled !== priorOccurrence ? priorOccurrence : undefined;
			}
		}

		const nextRecurrence =
			updates.recurrence !== undefined ? updates.recurrence : originalTask.recurrence;
		const nextAnchor =
			updates.recurrence_anchor !== undefined
				? updates.recurrence_anchor
				: originalTask.recurrence_anchor;
		if (!this.shouldTrackGoogleCalendarRecurringException(nextRecurrence, nextAnchor)) {
			recurrenceUpdates.googleCalendarExceptionOriginalScheduled = undefined;
			recurrenceUpdates.googleCalendarMovedOriginalDates = undefined;
		}

		return recurrenceUpdates;
	}

	private shouldTrackGoogleCalendarRecurringException(
		recurrence?: string,
		recurrenceAnchor?: "scheduled" | "completion"
	): boolean {
		return Boolean(recurrence) && (recurrenceAnchor || "scheduled") === "scheduled";
	}

	private getRecurringExceptionOriginalDate(task: TaskInfo): string | undefined {
		const original = task.googleCalendarExceptionOriginalScheduled || task.scheduled || task.due;
		return getDatePart(original || "");
	}

	private removeUnsetMappedFields(
		frontmatter: Record<string, unknown>,
		updates: Partial<TaskInfo>
	): void {
		const { plugin } = this.deps;
		if (Object.prototype.hasOwnProperty.call(updates, "due") && updates.due === undefined) {
			delete frontmatter[plugin.fieldMapper.toUserField("due")];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "scheduled") &&
			updates.scheduled === undefined
		) {
			delete frontmatter[plugin.fieldMapper.toUserField("scheduled")];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "contexts") &&
			updates.contexts === undefined
		) {
			delete frontmatter[plugin.fieldMapper.toUserField("contexts")];
		}
		if (Object.prototype.hasOwnProperty.call(updates, "projects")) {
			const projectsField = plugin.fieldMapper.toUserField("projects");
			const projectsToSet = Array.isArray(updates.projects) ? updates.projects : [];
			if (projectsToSet.length > 0) {
				frontmatter[projectsField] = projectsToSet;
			} else {
				delete frontmatter[projectsField];
			}
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "timeEstimate") &&
			updates.timeEstimate === undefined
		) {
			delete frontmatter[plugin.fieldMapper.toUserField("timeEstimate")];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "completedDate") &&
			updates.completedDate === undefined
		) {
			delete frontmatter[plugin.fieldMapper.toUserField("completedDate")];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "recurrence") &&
			updates.recurrence === undefined
		) {
			delete frontmatter[plugin.fieldMapper.toUserField("recurrence")];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "blockedBy") &&
			updates.blockedBy === undefined
		) {
			delete frontmatter[plugin.fieldMapper.toUserField("blockedBy")];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "googleCalendarExceptionOriginalScheduled") &&
			updates.googleCalendarExceptionOriginalScheduled === undefined
		) {
			delete frontmatter[
				plugin.fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled")
			];
		}
		if (
			Object.prototype.hasOwnProperty.call(updates, "googleCalendarMovedOriginalDates") &&
			(!Array.isArray(updates.googleCalendarMovedOriginalDates) ||
				updates.googleCalendarMovedOriginalDates.length === 0)
		) {
			delete frontmatter[
				plugin.fieldMapper.toUserField("googleCalendarMovedOriginalDates")
			];
		}
	}

	private async handleAutoArchive(
		originalTask: TaskInfo,
		updatedTask: TaskInfo,
		newStatus: string | undefined
	): Promise<void> {
		if (!this.deps.autoArchiveService || newStatus === undefined || newStatus === originalTask.status) {
			return;
		}

		try {
			const statusConfig = this.deps.plugin.statusManager.getStatusConfig(updatedTask.status);
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
