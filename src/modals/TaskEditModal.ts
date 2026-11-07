import { fieldLabel } from "../ui/kit/modal";
import { captureTaskUndo } from "../ui/taskMutationUndo";
import { showTaskUndo } from "../ui/taskPropertyPickers";
import { displayError } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Modal lifecycle initializes required controls before event handlers run. */
import { App, Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import type { TaskModalLeadingButton, TaskModalOverflowAction } from "./taskModalActionButtons";
import type { TaskSaveOutcome } from "./taskModalSave";
import { TaskDependency, TaskInfo } from "../types";
import { formatTimestampForDisplay, getCurrentTimestamp } from "../utils/dateUtils";
import { extractTaskInfo, calculateTotalTimeSpent, formatTime } from "../utils/helpers";
import { stringifyUnknown } from "../utils/stringUtils";
import { showConfirmationModal } from "./ConfirmationModal";
import { createCompletionsCalendarSection } from "./taskEditCompletions";
import { BlockingUpdates } from "./taskEditChanges";
import { showTaskModalReminderContextMenu } from "./taskModalActionMenus";
import { buildTaskEditChangesFromModalState } from "./taskEditChangeState";
import { buildTaskEditFormStateFromTask } from "./taskEditFormState";
import {
	createLinkedAttachmentEntries,
	getLinkedAttachmentReferences,
	hasPendingAttachments,
	haveAttachmentsChanged,
} from "./taskModalAttachments";
import { applyTaskEditSubtaskChanges, hasTaskEditSubtaskChanges } from "./taskEditSubtasks";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TaskEditModal" });

export interface TaskEditOptions {
	task: TaskInfo;
	onTaskUpdated?: (task: TaskInfo) => void;
}

export class TaskEditModal extends TaskModal {
	protected readonly mode = "edit";
	private task: TaskInfo;
	private options: TaskEditOptions;
	// Changed from Set to array for consistency with other state management
	private completedInstancesChanges: string[] = [];
	private skippedInstancesChanges: string[] = [];
	private initialBlockedBy: TaskDependency[] = [];
	private initialBlockingPaths: string[] = [];
	private pendingBlockingUpdates: BlockingUpdates = { added: [], removed: [], raw: {} };
	private unresolvedBlockingEntries: string[] = [];
	private initialTags = "";
	private isConvertingNoteToTask = false;

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
		super(app, plugin);
		this.task = options.task;
		this.options = options;
	}

	protected getCurrentTaskPath(): string | undefined {
		return this.task.path;
	}

	getModalTitle(): string {
		return this.t(msg({ message: "Edit task", context: "modals.taskEdit.title" }));
	}

	protected focusTitleInput(): void {
		if (this.isMobileLikeEnvironment()) {
			return;
		}
		super.focusTitleInput();
	}

	async initializeFormData(): Promise<void> {
		this.completedInstancesChanges = [];
		this.skippedInstancesChanges = [];

		// Refresh task data from file before opening
		await this.refreshTaskData();

		const formState = buildTaskEditFormStateFromTask({
			app: this.app,
			task: this.task,
			details: this.form.values.details,
			settings: {
				taskIdentificationMethod: this.plugin.settings.taskIdentificationMethod,
				taskTag: this.plugin.settings.taskTag,
				hideIdentifyingTagsInCards: this.plugin.settings.hideIdentifyingTagsInCards,
				hideIdentifyingTagsMode: this.plugin.settings.hideIdentifyingTagsMode,
				userFields: this.plugin.settings?.userFields,
			},
			normalizeDetails: (value) => this.normalizeDetails(value),
		});

		this.form.values.title = formState.title;
		this.form.values.dueDate = formState.dueDate;
		this.form.values.scheduledDate = formState.scheduledDate;
		this.form.values.priority = formState.priority;
		this.form.values.status = formState.status;
		this.form.values.contexts = formState.contexts;

		// Initialize projects using the new method that handles both old and new formats
		if (formState.hasValidProjects) {
			this.initializeProjectsFromStrings(formState.projectValues);
		} else {
			this.form.values.projects = "";
			this.selectedProjectItems = [];
		}

		this.form.values.tags = formState.tags;
		this.initialTags = formState.initialTags;
		this.form.values.timeEstimate = formState.timeEstimate;
		this.form.values.recurrenceRule = formState.recurrenceRule;
		this.form.values.recurrenceAnchor = formState.recurrenceAnchor;
		this.form.values.reminders = formState.reminders;
		this.attachmentEntries = createLinkedAttachmentEntries(
			this.task.attachments,
			this.task.path
		);
		this.form.values.details = formState.details;
		this.originalDetails = formState.originalDetails;
		this.form.values.userFields = formState.userFields;

		// Initialize subtasks (tasks that have this task as a project)
		await this.initializeSubtasks();

		this.blockedByItems = (this.task.blockedBy ?? []).map((dependency) =>
			this.createDependencyItemFromDependency(dependency, this.task.path)
		);
		this.initialBlockedBy = this.blockedByItems.map((item) => ({ ...item.dependency }));

		this.blockingItems = (this.task.blocking ?? []).map((path) =>
			this.createDependencyItemFromPath(path)
		);
		this.initialBlockingPaths = this.blockingItems
			.filter((item) => item.path)
			.map((item) => item.path!);
		this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
		this.unresolvedBlockingEntries = [];

		// Values stay on show: fields start hidden only when there is nothing in them.
		this.isExpanded = this.hasDisclosedFieldValues();
	}

	private hasDisclosedFieldValues(): boolean {
		const { contexts, tags, timeEstimate, userFields } = this.form.values;
		// The identifying tag is on every tag-based task, so it says nothing about this one.
		const identifyingTag = this.plugin.settings.taskTag;
		const hasOwnTags = tags
			.split(",")
			.some((tag) => tag.trim() && tag.trim() !== identifyingTag);
		return (
			Boolean(contexts || hasOwnTags || timeEstimate) ||
			Object.values(userFields).some((value) => value !== undefined && value !== null && value !== "") ||
			this.selectedSubtaskFiles.length > 0 ||
			this.blockedByItems.length > 0 ||
			this.blockingItems.length > 0 ||
			this.attachmentEntries.length > 0
		);
	}

	protected showReminderContextMenu(event: MouseEvent): void {
		// Override parent method to use the actual task with its path
		// Update the task object with current form values before showing menu
		showTaskModalReminderContextMenu(this.getActionMenuContext(), event, this.task);
	}

	private async refreshTaskData(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				tasknotesLogger.warn("Could not find file for task:", {
					category: "stale-data",
					operation: "find-file-task",
					details: { value: this.task.path },
				});
				return;
			}

			const content = await this.app.vault.read(file);
			this.form.values.details = this.extractDetailsFromContent(content);
			this.originalDetails = this.form.values.details;

			// Check if this file is actually a task (has task tag/property)
			// If not, keep the original task data (e.g., for "convert note to task" flow)
			const metadata = this.app.metadataCache.getFileCache(file);
			const isRecognizedTask =
				metadata?.frontmatter && this.plugin.cacheManager.isTaskFile(metadata.frontmatter);

			if (!isRecognizedTask) {
				// File is not yet a task - keep the original task data passed to constructor
				// This preserves user's default settings for status/priority during conversion
				this.isConvertingNoteToTask = true;
				this.task.details = this.form.values.details;
				return;
			}

			this.isConvertingNoteToTask = false;

			const cachedTaskInfo = await this.plugin.cacheManager.getTaskInfo(this.task.path);

			if (cachedTaskInfo) {
				cachedTaskInfo.details = this.form.values.details;
				this.task = cachedTaskInfo;
				this.options.task = cachedTaskInfo;
			} else {
				const freshTaskInfo = extractTaskInfo(
					this.app,
					content,
					this.task.path,
					file,
					this.plugin.fieldMapper,
					this.plugin.settings.storeTitleInFilename,
					this.plugin.settings.defaultTaskStatus
				);

				if (freshTaskInfo) {
					freshTaskInfo.details = this.form.values.details;
					this.task = freshTaskInfo;
					this.options.task = freshTaskInfo;
				}
			}
		} catch (error) {
			tasknotesLogger.warn("Could not refresh task data:", {
				category: "stale-data",
				operation: "refresh-task-data",
				error: error,
			});
		}
	}

	/**
	 * Add completions calendar and metadata sections after details
	 */
	protected createAdditionalSections(container: HTMLElement): void {
		createCompletionsCalendarSection(container, {
			task: this.task,
			plugin: this.plugin,
			completedInstancesChanges: this.completedInstancesChanges,
			skippedInstancesChanges: this.skippedInstancesChanges,
			translate: (key, params) => this.t(key, params),
		});
		this.createMetadataSection(container);
	}

	protected hasUnsavedChanges(): boolean {
		return Object.keys(this.getChanges()).length > 0 || this.hasSubtaskChanges();
	}

	private createMetadataSection(container: HTMLElement): void {
		const metadataContainer = container.createEl("details", {
			cls: "metadata-container tn-modal__disclosure",
		});

		const metadataLabel = metadataContainer.createEl("summary", { cls: "detail-label" });
		metadataLabel.textContent = this.t(
			msg({ message: "Task information", context: "modals.taskEdit.sections.taskInfo" })
		);

		const metadataContent = metadataContainer.createDiv("metadata-content");

		// Total tracked time
		const totalTimeSpent = calculateTotalTimeSpent(this.task.timeEntries || []);
		if (totalTimeSpent > 0) {
			this.createMetadataItem(
				metadataContent,
				this.t(
					msg({
						message: "Total tracked time:",
						context: "modals.taskEdit.metadata.totalTrackedTime",
					})
				),
				formatTime(totalTimeSpent)
			);
		}

		// Created date
		if (this.task.dateCreated) {
			this.createMetadataItem(
				metadataContent,
				this.t(msg({ message: "Created:", context: "modals.taskEdit.metadata.created" })),
				formatTimestampForDisplay(this.task.dateCreated)
			);
		}

		// Modified date
		if (this.task.dateModified) {
			this.createMetadataItem(
				metadataContent,
				this.t(msg({ message: "Modified:", context: "modals.taskEdit.metadata.modified" })),
				formatTimestampForDisplay(this.task.dateModified)
			);
		}

		// File path (if available)
		if (this.task.path) {
			this.createMetadataItem(
				metadataContent,
				this.t(msg({ message: "File:", context: "modals.taskEdit.metadata.file" })),
				this.task.path
			);
		}
	}

	private createMetadataItem(container: HTMLElement, key: string, value: string): void {
		const item = container.createDiv("metadata-item");
		item.createSpan("metadata-key").textContent = fieldLabel(key);
		item.createSpan("metadata-value").textContent = value;
	}

	async handleSave(): Promise<TaskSaveOutcome> {
		if (!this.validateForm()) {
			return { status: "failed" };
		}

		const undo: Array<() => Promise<unknown>> = [];
		try {
			const changes = this.getChanges({ includeConversionWrite: true });
			const hasBlockingChanges =
				this.pendingBlockingUpdates.added.length > 0 ||
				this.pendingBlockingUpdates.removed.length > 0;
			const hasTaskChanges = Object.keys(changes).length > 0;
			const hasSubtaskChanges = this.hasSubtaskChanges();

			if (this.unresolvedBlockingEntries.length > 0 && !hasBlockingChanges) {
				new Notice(
					this.t(
						msg({
							message: "Could not resolve: {entries}",
							context: "modals.taskEdit.notices.blockingUnresolved",
						}),
						{
							entries: this.unresolvedBlockingEntries.join(", "),
						}
					)
				);
				this.unresolvedBlockingEntries = [];
			}

			if (!hasTaskChanges && !hasBlockingChanges && !hasSubtaskChanges) {
				new Notice(
					this.t(
						msg({
							message: "No changes to save",
							context: "modals.taskEdit.notices.noChanges",
						})
					)
				);
				return { status: "saved" };
			}

			let updatedTask = this.task;

			const imported = hasPendingAttachments(this.attachmentEntries)
				? await this.importPendingAttachments(this.task.path)
				: undefined;
			if (imported) {
				changes.attachments = imported.references;
			}

			if (hasTaskChanges) {
				try {
					const receipt = await captureTaskUndo(this.plugin, this.task, () => this.plugin.taskService.updateTask(this.task, changes));
					if (receipt.task) updatedTask = receipt.task;
					if (receipt.undo) undo.push(receipt.undo);
				} catch (error) {
					// Don't leave imported files behind if the task wasn't updated.
					await imported?.rollback();
					throw error;
				}
				this.task = updatedTask;
				if (Object.prototype.hasOwnProperty.call(changes, "details")) {
					const updatedDetails = stringifyUnknown(
						(changes as Record<string, unknown>).details
					);
					this.form.values.details = updatedDetails;
					this.originalDetails = updatedDetails;
				}
			}

			if (hasBlockingChanges) {
				await this.plugin.taskService.updateBlockingRelationships(
					updatedTask,
					this.pendingBlockingUpdates.added,
					this.pendingBlockingUpdates.removed,
					this.pendingBlockingUpdates.raw,
					async (task, updates) => {
						const receipt = await captureTaskUndo(this.plugin, task, () => this.plugin.taskService.updateTask(task, updates));
						if (receipt.undo) undo.push(receipt.undo);
						return receipt.task;
					}
				);

				const refreshed = await this.plugin.cacheManager.getTaskInfo(updatedTask.path);
				if (refreshed) {
					updatedTask = refreshed;
					this.task = refreshed;
				}
			}

			if (hasSubtaskChanges) {
				await this.applySubtaskChanges(updatedTask, undo);
			}

			if (this.unresolvedBlockingEntries.length > 0) {
				new Notice(
					this.t(
						msg({
							message: "Could not resolve: {entries}",
							context: "modals.taskEdit.notices.blockingUnresolved",
						}),
						{
							entries: this.unresolvedBlockingEntries.join(", "),
						}
					)
				);
			}

			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			if (hasTaskChanges || hasBlockingChanges || hasSubtaskChanges) {
				showTaskUndo(undo, false, 1, this.app.vault,
					this.t(
						msg({
							message: 'Task saved',
							context: "modals.taskEdit.notices.updateSuccess",
						})
					)
				);
			}

			this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
			this.unresolvedBlockingEntries = [];
			return { status: "saved" };
		} catch (error) {
			tasknotesLogger.error("Failed to update task:", {
				category: "validation",
				operation: "update-task",
				error: error,
			});
			const message = error instanceof Error && error.message ? error.message : String(error);
			showTaskUndo(undo, true, undo.length, this.app.vault,
				`${this.task.title} · ${this.t(
					msg({
						message: "Failed to update task: {message}",
						context: "modals.taskEdit.notices.updateFailure",
					}),
					{ message: displayError(message) }
				)}`
			);
			return { status: "failed" };
		}
	}

	private getChanges(options: { includeConversionWrite?: boolean } = {}): Partial<TaskInfo> {
		const result = buildTaskEditChangesFromModalState({
			app: this.app,
			task: this.task,
			title: this.form.values.title,
			dueDate: this.form.values.dueDate,
			scheduledDate: this.form.values.scheduledDate,
			priority: this.form.values.priority,
			status: this.form.values.status,
			contexts: this.form.values.contexts,
			projects: this.form.values.projects,
			tags: this.form.values.tags,
			initialTags: this.initialTags,
			timeEstimate: this.form.values.timeEstimate,
			recurrenceRule: this.form.values.recurrenceRule,
			recurrenceAnchor: this.form.values.recurrenceAnchor,
			reminders: this.form.values.reminders,
			blockedByItems: this.blockedByItems,
			initialBlockedBy: this.initialBlockedBy,
			blockingItems: this.blockingItems,
			initialBlockingPaths: this.initialBlockingPaths,
			details: this.form.values.details,
			originalDetails: this.originalDetails,
			completedInstancesChanges: this.completedInstancesChanges,
			skippedInstancesChanges: this.skippedInstancesChanges,
			userFields: this.form.values.userFields,
			settings: {
				userFields: this.plugin.settings?.userFields,
				taskIdentificationMethod: this.plugin.settings.taskIdentificationMethod,
				taskTag: this.plugin.settings.taskTag,
				hideIdentifyingTagsInCards: this.plugin.settings.hideIdentifyingTagsInCards,
				hideIdentifyingTagsMode: this.plugin.settings.hideIdentifyingTagsMode,
				maintainDueDateOffsetInRecurring:
					this.plugin.settings.maintainDueDateOffsetInRecurring,
			},
			normalizeDetails: (value) => this.normalizeDetails(value),
		});

		if (haveAttachmentsChanged(this.attachmentEntries, this.task.attachments)) {
			// Pending disk files are added to this list when the save imports them.
			result.changes.attachments = getLinkedAttachmentReferences(this.attachmentEntries);
		}

		this.pendingBlockingUpdates = result.blockingUpdates;
		this.unresolvedBlockingEntries = result.unresolvedBlockingEntries;

		if (
			options.includeConversionWrite &&
			this.isConvertingNoteToTask &&
			Object.keys(result.changes).length === 0
		) {
			result.changes.dateModified = getCurrentTimestamp();
		}

		return result.changes;
	}

	private async openTaskNote(): Promise<void> {
		try {
			// Get the file from the task path
			const file = this.app.vault.getAbstractFileByPath(this.task.path);

			if (!(file instanceof TFile)) {
				new Notice(
					this.t(
						msg({
							message: "Could not find task file: {path}",
							context: "modals.taskEdit.notices.fileMissing",
						}),
						{ path: this.task.path }
					)
				);
				return;
			}

			if (!(await this.resolveUnsavedChanges())) return;

			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file);

			this.forceClose();
		} catch (error) {
			tasknotesLogger.error("Failed to open task note:", {
				category: "persistence",
				operation: "open-task-note",
				error: error,
			});
			new Notice(
				this.t(
					msg({
						message: "Failed to open task note",
						context: "modals.taskEdit.notices.openNoteFailure",
					})
				)
			);
		}
	}

	private async archiveTask(): Promise<void> {
		if (!(await this.resolveUnsavedChanges())) return;

		try {
			const updatedTask = await this.plugin.toggleTaskArchive(this.task);

			// Update the task reference
			this.task = updatedTask;

			// Notify parent component if callback exists
			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			this.forceClose();
		} catch (error) {
			tasknotesLogger.error("Failed to archive task:", {
				category: "persistence",
				operation: "archive-task",
				error: error,
			});
		}
	}

	private async deleteTask(): Promise<void> {
		const confirmed = await showConfirmationModal(this.app, {
			title: this.t(
				msg({ message: "Delete task", context: "modals.taskEdit.deleteConfirmation.title" })
			),
			message: this.t(
				msg({
					message:
						'Are you sure you want to delete "{title}"? This moves the task note to Obsidian trash.',
					context: "modals.taskEdit.deleteConfirmation.message",
				}),
				{
					title: this.task.title,
				}
			),
			confirmText: this.t(
				msg({
					message: "Delete task",
					context: "modals.taskEdit.deleteConfirmation.confirm",
				})
			),
			cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
			isDestructive: true,
		});

		if (!confirmed) {
			return;
		}

		try {
			await this.plugin.taskService.deleteTask(this.task);
			new Notice(
				this.t(
					msg({
						message: 'Task deleted',
						context: "modals.taskEdit.notices.deleteSuccess",
					})
				)
			);
			this.forceClose();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Failed to delete task:", {
				category: "persistence",
				operation: "delete-task",
				error: error,
			});
			new Notice(
				this.t(
					msg({
						message: "Failed to delete task: {message}",
						context: "modals.taskEdit.notices.deleteFailure",
					}),
					{ message: displayError(message) }
				)
			);
		}
	}

	protected getLeadingButtons(): TaskModalLeadingButton[] {
		return [
			{
				className: "tn-btn tn-btn--ghost tn-task-modal__open-note-button",
				text: this.t(
					msg({ message: "Open note", context: "modals.task.buttons.openNote" })
				),
				onClick: () => {
					void this.openTaskNote();
				},
			},
		];
	}

	protected getOverflowActions(): TaskModalOverflowAction[] {
		return [
			{
				title: this.task.archived
					? this.t(
							msg({
								message: "Unarchive",
								context: "modals.taskEdit.buttons.unarchive",
							})
						)
					: this.t(
							msg({ message: "Archive", context: "modals.taskEdit.buttons.archive" })
						),
				icon: "archive",
				onClick: () => {
					void this.archiveTask();
				},
			},
			{
				title: this.t(msg({ message: "Delete", context: "contextMenus.task.delete" })),
				icon: "trash",
				warning: true,
				onClick: () => {
					void this.deleteTask();
				},
			},
		];
	}

	protected async initializeSubtasks(): Promise<void> {
		try {
			const taskFile = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!(taskFile instanceof TFile)) return;

			const subtasks =
				await this.plugin.projectSubtasksService.getTasksLinkedToProject(taskFile);
			const sortedSubtasks = this.plugin.projectSubtasksService.sortTasks([...subtasks]);
			this.selectedSubtaskFiles = [];
			this.initialSubtaskFiles = [];

			for (const subtask of sortedSubtasks) {
				const subtaskFile = this.app.vault.getAbstractFileByPath(subtask.path);
				if (subtaskFile) {
					this.selectedSubtaskFiles.push(subtaskFile);
					this.initialSubtaskFiles.push(subtaskFile);
				}
			}
		} catch (error) {
			tasknotesLogger.error("Error initializing subtasks:", {
				category: "persistence",
				operation: "initializing-subtasks",
				error: error,
			});
		}
	}

	protected hasSubtaskChanges(): boolean {
		return hasTaskEditSubtaskChanges(this.initialSubtaskFiles, this.selectedSubtaskFiles);
	}

	protected async applySubtaskChanges(task: TaskInfo, undo: Array<() => Promise<unknown>> = []): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(task.path);
		if (!(currentTaskFile instanceof TFile)) return;

		const failedPaths: string[] = [];
		const result = await applyTaskEditSubtaskChanges({
			parentTaskFile: currentTaskFile,
			selectedSubtaskFiles: this.selectedSubtaskFiles,
			initialSubtaskFiles: this.initialSubtaskFiles,
			getTaskInfo: (path) => this.plugin.cacheManager.getTaskInfo(path),
			buildProjectReference: (parentTaskFile, subtaskPath) =>
				this.buildProjectReference(parentTaskFile, subtaskPath),
			updateTaskProjects: async (subtaskInfo, updatedProjects) => {
				const receipt = await captureTaskUndo(this.plugin, subtaskInfo, () => this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects, { suppressNotice: true }));
				if (receipt.undo) undo.push(receipt.undo);
				return receipt.task;
			},
			onAddError: (error, file) => {
				failedPaths.push(file.path);
				tasknotesLogger.error("Failed to add subtask relation:", {
					category: "persistence",
					operation: "add-subtask-relation",
					error: error,
				});
			},
			onRemoveError: (error, file) => {
				failedPaths.push(file.path);
				tasknotesLogger.error("Failed to remove subtask relation:", {
					category: "persistence",
					operation: "remove-subtask-relation",
					error: error,
				});
			},
		});

		this.initialSubtaskFiles = result.nextInitialSubtaskFiles;
		if (failedPaths.length) throw new Error(failedPaths.join(", "));
	}
}

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the modal implementation. */
