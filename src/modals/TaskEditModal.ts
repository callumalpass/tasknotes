/* eslint-disable @typescript-eslint/no-non-null-assertion -- Modal lifecycle initializes required controls before event handlers run. */
import { App, Notice, TFile, TAbstractFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskDependency, TaskInfo } from "../types";
import { formatTimestampForDisplay } from "../utils/dateUtils";
import {
	extractTaskInfo,
	calculateTotalTimeSpent,
	formatTime,
	sanitizeTags,
} from "../utils/helpers";
import { stringifyUnknown } from "../utils/stringUtils";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { ConfirmationModal } from "./ConfirmationModal";
import { createCompletionsCalendarSection } from "./taskEditCompletions";
import { BlockingUpdates, buildTaskEditChanges } from "./taskEditChanges";

export interface TaskEditOptions {
	task: TaskInfo;
	onTaskUpdated?: (task: TaskInfo) => void;
}

export class TaskEditModal extends TaskModal {
	private task: TaskInfo;
	private options: TaskEditOptions;
	private metadataContainer: HTMLElement;
	private editModalKeyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	// Changed from Set to array for consistency with other state management
	private completedInstancesChanges: string[] = [];
	private initialBlockedBy: TaskDependency[] = [];
	private initialBlockingPaths: string[] = [];
	private pendingBlockingUpdates: BlockingUpdates = { added: [], removed: [], raw: {} };
	private unresolvedBlockingEntries: string[] = [];
	private initialTags = "";
	private isShowingConfirmation = false;
	private pendingClose = false;

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
		super(app, plugin);
		this.task = options.task;
		this.options = options;
	}

	protected getCurrentTaskPath(): string | undefined {
		return this.task.path;
	}

	getModalTitle(): string {
		return this.t("modals.taskEdit.title");
	}

	protected isEditMode(): boolean {
		return true;
	}

	async initializeFormData(): Promise<void> {
		// Initialize form fields with current task data
		this.title = this.task.title;
		this.dueDate = this.task.due || "";
		this.scheduledDate = this.task.scheduled || "";
		this.priority = this.task.priority;
		this.status = this.task.status;
		this.contexts = this.task.contexts ? this.task.contexts.join(", ") : "";

		// Initialize projects using the new method that handles both old and new formats
		if (this.task.projects && this.task.projects.length > 0) {
			// Filter out null, undefined, or empty strings before checking if we have valid projects
			const validProjects = this.task.projects.filter(
				(p) => p && typeof p === "string" && p.trim() !== ""
			);
			if (validProjects.length > 0) {
				this.initializeProjectsFromStrings(this.task.projects);
			} else {
				this.projects = "";
				this.selectedProjectItems = [];
			}
		} else {
			this.projects = "";
			this.selectedProjectItems = [];
		}

		const shouldFilterTaskTag = this.plugin.settings.taskIdentificationMethod === "tag";
		const rawTags = this.task.tags || [];
		const visibleTags = shouldFilterTaskTag
			? rawTags.filter((tag) => tag !== this.plugin.settings.taskTag)
			: rawTags;
		this.tags = rawTags.length > 0 ? sanitizeTags(visibleTags.join(", ")) : "";
		this.initialTags = this.tags;
		this.timeEstimate = this.task.timeEstimate || 0;

		// Handle recurrence
		this.recurrenceRule = this.task.recurrence || "";

		// Initialize recurrence anchor
		this.recurrenceAnchor = this.task.recurrence_anchor || "scheduled";

		// Initialize reminders
		this.reminders = this.task.reminders ? [...this.task.reminders] : [];

		this.details = this.normalizeDetails(this.details);
		this.originalDetails = this.details;

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

		// Initialize user fields from frontmatter
		await this.initializeUserFields();
	}

	private async initializeUserFields(): Promise<void> {
		try {
			// Get the file and read its frontmatter
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				return;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			const frontmatter = metadata?.frontmatter;

			if (!frontmatter) {
				return;
			}

			// Load user field values from frontmatter
			const userFieldConfigs = this.plugin.settings?.userFields || [];
			for (const field of userFieldConfigs) {
				if (!field || !field.key) continue;

				const value = frontmatter[field.key];
				if (value !== undefined) {
					this.userFields[field.key] = value;
				}
			}
		} catch (error) {
			console.error("Error initializing user fields:", error);
		}
	}

	protected showReminderContextMenu(event: MouseEvent): void {
		// Override parent method to use the actual task with its path
		// Update the task object with current form values before showing menu
		const currentTask: TaskInfo = {
			...this.task,
			title: this.title,
			due: this.dueDate,
			scheduled: this.scheduledDate,
			reminders: this.reminders,
		};

		const menu = new ReminderContextMenu(
			this.plugin,
			currentTask, // Use task with current form values and correct path
			event.target as HTMLElement,
			(updatedTask: TaskInfo) => {
				this.reminders = updatedTask.reminders || [];
				this.updateReminderIconState();
			}
		);

		menu.show(event);
	}

	onOpen(): void {
		void this.openEditModal();
	}

	private async openEditModal(): Promise<void> {
		// Clear any previous completion changes
		this.completedInstancesChanges = [];

		// Refresh task data from file before opening
		await this.refreshTaskData();

		this.containerEl.addClass("tasknotes-plugin", "minimalist-task-modal", "expanded");
		if (this.plugin.settings.enableModalSplitLayout) {
			this.containerEl.addClass("split-layout-enabled");
		}
		this.modalEl.addClass("mod-tasknotes");

		// Set the modal title using the standard Obsidian approach (preserves close button)
		this.titleEl.setText(this.getModalTitle());

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.editModalKeyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void (async () => {
					await this.handleSave();
					this.forceClose();
				})();
			}
		};
		this.containerEl.addEventListener("keydown", this.editModalKeyboardHandler);

		void this.initializeFormData().then(() => {
			this.createModalContent();
			// Render projects list after modal content is created
			this.renderProjectsList();
			// Update icon states after creating the action bar
			this.updateIconStates();
			this.focusTitleInput();
		});
	}

	private async refreshTaskData(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				console.warn("Could not find file for task:", this.task.path);
				return;
			}

			const content = await this.app.vault.read(file);
			this.details = this.extractDetailsFromContent(content);
			this.originalDetails = this.details;

			// Check if this file is actually a task (has task tag/property)
			// If not, keep the original task data (e.g., for "convert note to task" flow)
			const metadata = this.app.metadataCache.getFileCache(file);
			const isRecognizedTask =
				metadata?.frontmatter && this.plugin.cacheManager.isTaskFile(metadata.frontmatter);

			if (!isRecognizedTask) {
				// File is not yet a task - keep the original task data passed to constructor
				// This preserves user's default settings for status/priority during conversion
				this.task.details = this.details;
				return;
			}

			const cachedTaskInfo = await this.plugin.cacheManager.getTaskInfo(this.task.path);

			if (cachedTaskInfo) {
				cachedTaskInfo.details = this.details;
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
					freshTaskInfo.details = this.details;
					this.task = freshTaskInfo;
					this.options.task = freshTaskInfo;
				}
			}
		} catch (error) {
			console.warn("Could not refresh task data:", error);
		}
	}

	/**
	 * Edit modal has no primary input at top - title is in the details section
	 */
	protected createPrimaryInput(container: HTMLElement): void {
		// No-op: Edit modal shows title in the details section, not at top
	}

	/**
	 * Add completions calendar and metadata sections after details
	 */
	protected createAdditionalSections(container: HTMLElement): void {
		createCompletionsCalendarSection(container, {
			task: this.task,
			plugin: this.plugin,
			completedInstancesChanges: this.completedInstancesChanges,
			translate: (key, params) => this.t(key, params),
		});
		this.createMetadataSection(container);
	}

	/**
	 * Force close the modal without checking for unsaved changes.
	 * Use this after a successful save or when discarding is intentional.
	 */
	forceClose(): void {
		this.pendingClose = true;
		super.close();
	}

	/**
	 * Override close() to detect unsaved changes and prompt user.
	 * This method is synchronous to match Obsidian's Modal.close() signature.
	 */
	close(): void {
		// If we're already forcing close or showing confirmation, proceed
		if (this.pendingClose) {
			this.pendingClose = false;
			super.close();
			return;
		}

		// Prevent re-entrancy if confirmation is already showing
		if (this.isShowingConfirmation) {
			return;
		}

		// Check for unsaved changes
		const changes = this.getChanges();
		const hasChanges = Object.keys(changes).length > 0;

		if (!hasChanges) {
			// No changes, close immediately
			super.close();
			return;
		}

		// Show confirmation modal asynchronously
		void this.showUnsavedChangesConfirmation();
	}

	/**
	 * Show confirmation modal for unsaved changes.
	 * Handles the async flow separately from the synchronous close() method.
	 */
	private async showUnsavedChangesConfirmation(): Promise<void> {
		this.isShowingConfirmation = true;

		try {
			const result = await this.showThreeButtonConfirmation();

			if (result === "save") {
				// User wants to save - attempt save and close on success
				try {
					await this.handleSave();
					this.forceClose();
				} catch (error) {
					// Save failed - stay open so user can fix issues
					// handleSave() already shows a notice with the error
					console.error("Save failed during close confirmation:", error);
				}
			} else if (result === "discard") {
				// User wants to discard changes
				this.forceClose();
			}
			// result === "cancel" - do nothing, user wants to keep editing
		} finally {
			this.isShowingConfirmation = false;
		}
	}

	/**
	 * Show a three-button confirmation dialog for unsaved changes.
	 * Returns: "save" | "discard" | "cancel"
	 */
	private showThreeButtonConfirmation(): Promise<"save" | "discard" | "cancel"> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app, {
				title: this.t("modals.task.unsavedChanges.title"),
				message: this.t("modals.task.unsavedChanges.message"),
				confirmText: this.t("modals.task.unsavedChanges.save"),
				cancelText: this.t("modals.task.unsavedChanges.discard"),
				thirdButtonText: this.t("modals.task.unsavedChanges.cancel"),
				defaultToConfirm: true,
				onThirdButton: () => resolve("cancel"),
			});

			void modal.show().then((confirmed) => {
				if (confirmed) {
					resolve("save");
				} else {
					resolve("discard");
				}
			});
		});
	}

	onClose(): void {
		// Clean up keyboard handler
		if (this.editModalKeyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.editModalKeyboardHandler);
			this.editModalKeyboardHandler = null;
		}

		// Base class handles detailsMarkdownEditor cleanup
		super.onClose();
	}

	private createMetadataSection(container: HTMLElement): void {
		this.metadataContainer = container.createDiv("metadata-container");

		const metadataLabel = this.metadataContainer.createDiv("detail-label");
		metadataLabel.textContent = this.t("modals.taskEdit.sections.taskInfo");

		const metadataContent = this.metadataContainer.createDiv("metadata-content");

		// Total tracked time
		const totalTimeSpent = calculateTotalTimeSpent(this.task.timeEntries || []);
		if (totalTimeSpent > 0) {
			const timeDiv = metadataContent.createDiv("metadata-item");
			timeDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.totalTrackedTime") + " ";
			timeDiv.createSpan("metadata-value").textContent = formatTime(totalTimeSpent);
		}

		// Created date
		if (this.task.dateCreated) {
			const createdDiv = metadataContent.createDiv("metadata-item");
			createdDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.created") + " ";
			createdDiv.createSpan("metadata-value").textContent = formatTimestampForDisplay(
				this.task.dateCreated
			);
		}

		// Modified date
		if (this.task.dateModified) {
			const modifiedDiv = metadataContent.createDiv("metadata-item");
			modifiedDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.modified") + " ";
			modifiedDiv.createSpan("metadata-value").textContent = formatTimestampForDisplay(
				this.task.dateModified
			);
		}

		// File path (if available)
		if (this.task.path) {
			const pathDiv = metadataContent.createDiv("metadata-item");
			pathDiv.createSpan("metadata-key").textContent =
				this.t("modals.taskEdit.metadata.file") + " ";
			pathDiv.createSpan("metadata-value").textContent = this.task.path;
		}
	}

	async handleSave(): Promise<void> {
		if (!this.validateForm()) {
			new Notice(this.t("modals.taskEdit.notices.titleRequired"));
			return;
		}

		try {
			const changes = this.getChanges();
			const hasBlockingChanges =
				this.pendingBlockingUpdates.added.length > 0 ||
				this.pendingBlockingUpdates.removed.length > 0;
			const hasTaskChanges = Object.keys(changes).length > 0;
			const hasSubtaskChanges = this.hasSubtaskChanges();

			if (this.unresolvedBlockingEntries.length > 0 && !hasBlockingChanges) {
				new Notice(
					this.t("modals.taskEdit.notices.blockingUnresolved", {
						entries: this.unresolvedBlockingEntries.join(", "),
					})
				);
				this.unresolvedBlockingEntries = [];
			}

			if (!hasTaskChanges && !hasBlockingChanges && !hasSubtaskChanges) {
				new Notice(this.t("modals.taskEdit.notices.noChanges"));
				this.close();
				return;
			}

			let updatedTask = this.task;

			if (hasTaskChanges) {
				updatedTask = await this.plugin.taskService.updateTask(this.task, changes);
				this.task = updatedTask;
				if (Object.prototype.hasOwnProperty.call(changes, "details")) {
					const updatedDetails = stringifyUnknown(
						(changes as Record<string, unknown>).details
					);
					this.details = updatedDetails;
					this.originalDetails = updatedDetails;
				}
			}

			if (hasBlockingChanges) {
				await this.plugin.taskService.updateBlockingRelationships(
					updatedTask,
					this.pendingBlockingUpdates.added,
					this.pendingBlockingUpdates.removed,
					this.pendingBlockingUpdates.raw
				);

				const refreshed = await this.plugin.cacheManager.getTaskInfo(updatedTask.path);
				if (refreshed) {
					updatedTask = refreshed;
					this.task = refreshed;
				}
			}

			if (hasSubtaskChanges) {
				await this.applySubtaskChanges(updatedTask);
			}

			if (this.unresolvedBlockingEntries.length > 0) {
				new Notice(
					this.t("modals.taskEdit.notices.blockingUnresolved", {
						entries: this.unresolvedBlockingEntries.join(", "),
					})
				);
			}

			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			if (hasTaskChanges) {
				new Notice(
					this.t("modals.taskEdit.notices.updateSuccess", { title: updatedTask.title })
				);
			} else if (hasBlockingChanges) {
				new Notice(this.t("modals.taskEdit.notices.dependenciesUpdateSuccess"));
			}

			this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
			this.unresolvedBlockingEntries = [];
		} catch (error) {
			console.error("Failed to update task:", error);
			const message = error instanceof Error && error.message ? error.message : String(error);
			new Notice(this.t("modals.taskEdit.notices.updateFailure", { message }));
		}
	}

	private getChanges(): Partial<TaskInfo> {
		let frontmatter: Record<string, unknown> = {};
		try {
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (file instanceof TFile) {
				frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
			}
		} catch (error) {
			console.error("Error reading user field frontmatter:", error);
		}

		const result = buildTaskEditChanges({
			task: this.task,
			title: this.title,
			dueDate: this.dueDate,
			scheduledDate: this.scheduledDate,
			priority: this.priority,
			status: this.status,
			contexts: this.contexts,
			projects: this.projects,
			tags: this.tags,
			initialTags: this.initialTags,
			timeEstimate: this.timeEstimate,
			recurrenceRule: this.recurrenceRule,
			recurrenceAnchor: this.recurrenceAnchor,
			reminders: this.reminders,
			blockedByItems: this.blockedByItems,
			initialBlockedBy: this.initialBlockedBy,
			blockingItems: this.blockingItems,
			initialBlockingPaths: this.initialBlockingPaths,
			details: this.details,
			originalDetails: this.originalDetails,
			completedInstancesChanges: this.completedInstancesChanges,
			userFields: this.userFields,
			frontmatter,
			userFieldConfigs: this.plugin.settings?.userFields || [],
			taskIdentificationMethod: this.plugin.settings.taskIdentificationMethod,
			taskTag: this.plugin.settings.taskTag,
			maintainDueDateOffsetInRecurring: this.plugin.settings.maintainDueDateOffsetInRecurring,
			normalizeDetails: (value) => this.normalizeDetails(value),
		});

		this.pendingBlockingUpdates = result.blockingUpdates;
		this.unresolvedBlockingEntries = result.unresolvedBlockingEntries;

		return result.changes;
	}

	protected async openTaskNote(): Promise<void> {
		try {
			// Get the file from the task path
			const file = this.app.vault.getAbstractFileByPath(this.task.path);

			if (!(file instanceof TFile)) {
				new Notice(this.t("modals.taskEdit.notices.fileMissing", { path: this.task.path }));
				return;
			}

			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file);

			// Close the modal
			this.close();
		} catch (error) {
			console.error("Failed to open task note:", error);
			new Notice(this.t("modals.taskEdit.notices.openNoteFailure"));
		}
	}

	private async archiveTask(): Promise<void> {
		try {
			const updatedTask = await this.plugin.taskService.toggleArchive(this.task);

			// Update the task reference
			this.task = updatedTask;

			// Notify parent component if callback exists
			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			// Show success message
			const actionKey = updatedTask.archived
				? "modals.taskEdit.archiveAction.archived"
				: "modals.taskEdit.archiveAction.unarchived";
			const actionText = this.t(actionKey);
			new Notice(this.t("modals.taskEdit.notices.archiveSuccess", { action: actionText }));

			// Close the modal
			this.close();
		} catch (error) {
			console.error("Failed to archive task:", error);
			new Notice(this.t("modals.taskEdit.notices.archiveFailure"));
		}
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv(
			"modal-button-container tn-task-modal__button-bar"
		);

		// Add "Open note" button
		const openNoteButton = buttonContainer.createEl("button", {
			cls: "tn-task-modal__open-note-button",
			text: this.t("modals.task.buttons.openNote"),
		});

		openNoteButton.addEventListener("click", () => {
			void this.openTaskNote();
		});

		// Add "Archive" button
		const archiveButton = buttonContainer.createEl("button", {
			cls: "mod-warning tn-task-modal__archive-button",
			text: this.task.archived
				? this.t("modals.taskEdit.buttons.unarchive")
				: this.t("modals.taskEdit.buttons.archive"),
		});

		archiveButton.addEventListener("click", () => {
			void this.archiveTask();
		});

		// Save button (primary action)
		const saveButton = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: this.t("modals.task.buttons.save"),
		});

		saveButton.addEventListener("click", () => {
			void (async () => {
				saveButton.disabled = true;
				try {
					await this.handleSave();
					this.forceClose();
				} finally {
					saveButton.disabled = false;
				}
			})();
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", {
			text: this.t("common.cancel"),
		});

		cancelButton.addEventListener("click", () => {
			this.close();
		});
	}

	protected async initializeSubtasks(): Promise<void> {
		try {
			const taskFile = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!(taskFile instanceof TFile)) return;

			const subtasks =
				await this.plugin.projectSubtasksService.getTasksLinkedToProject(taskFile);
			this.selectedSubtaskFiles = [];
			this.initialSubtaskFiles = [];

			for (const subtask of subtasks) {
				const subtaskFile = this.app.vault.getAbstractFileByPath(subtask.path);
				if (subtaskFile) {
					this.selectedSubtaskFiles.push(subtaskFile);
					this.initialSubtaskFiles.push(subtaskFile);
				}
			}
		} catch (error) {
			console.error("Error initializing subtasks:", error);
		}
	}

	protected hasSubtaskChanges(): boolean {
		// Check if subtasks have changed
		const current = this.selectedSubtaskFiles.map((f) => f.path).sort();
		const initial = this.initialSubtaskFiles.map((f) => f.path).sort();

		return (
			current.length !== initial.length ||
			current.some((path, index) => path !== initial[index])
		);
	}

	protected async applySubtaskChanges(task: TaskInfo): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(task.path);
		if (!(currentTaskFile instanceof TFile)) return;

		const currentPaths = new Set(this.selectedSubtaskFiles.map((f) => f.path));
		const initialPaths = new Set(this.initialSubtaskFiles.map((f) => f.path));

		// Remove current task from tasks that should no longer be subtasks
		const toRemove = this.initialSubtaskFiles.filter((f) => !currentPaths.has(f.path));
		for (const file of toRemove) {
			await this.removeSubtaskRelation(file, currentTaskFile);
		}

		// Add current task to tasks that should become subtasks
		const toAdd = this.selectedSubtaskFiles.filter((f) => !initialPaths.has(f.path));
		for (const file of toAdd) {
			await this.addSubtaskRelation(file, currentTaskFile);
		}

		// Update the initial state to reflect changes
		this.initialSubtaskFiles = [...this.selectedSubtaskFiles];
	}

	protected async addSubtaskRelation(
		subtaskFile: TAbstractFile,
		parentTaskFile: TFile
	): Promise<void> {
		try {
			const subtaskInfo = await this.plugin.cacheManager.getTaskInfo(subtaskFile.path);
			if (!subtaskInfo) return;

			const projectReference = this.buildProjectReference(parentTaskFile, subtaskFile.path);
			const legacyReference = `[[${parentTaskFile.basename}]]`;
			const currentProjects = Array.isArray(subtaskInfo.projects) ? subtaskInfo.projects : [];

			if (
				currentProjects.includes(projectReference) ||
				currentProjects.includes(legacyReference)
			) {
				return;
			}

			const sanitizedProjects = currentProjects.filter((entry) => entry !== legacyReference);
			const updatedProjects = [...sanitizedProjects, projectReference];
			await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);
		} catch (error) {
			console.error("Failed to add subtask relation:", error);
		}
	}

	protected async removeSubtaskRelation(
		subtaskFile: TAbstractFile,
		parentTaskFile: TFile
	): Promise<void> {
		try {
			const subtaskInfo = await this.plugin.cacheManager.getTaskInfo(subtaskFile.path);
			if (!subtaskInfo) return;

			const projectReference = this.buildProjectReference(parentTaskFile, subtaskFile.path);
			const legacyReference = `[[${parentTaskFile.basename}]]`;
			const currentProjects = Array.isArray(subtaskInfo.projects) ? subtaskInfo.projects : [];

			const updatedProjects = currentProjects.filter(
				(project) => project !== projectReference && project !== legacyReference
			);
			await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);
		} catch (error) {
			console.error("Failed to remove subtask relation:", error);
		}
	}

	// Start expanded for edit modal - override parent property
	protected isExpanded = true;
}
