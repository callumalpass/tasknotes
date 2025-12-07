/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import { App, Notice, TFile, TAbstractFile, setIcon, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskDependency, TaskInfo } from "../types";
import {
	getCurrentTimestamp,
	formatDateForStorage,
	generateUTCCalendarDates,
	getUTCStartOfWeek,
	getUTCEndOfWeek,
	getUTCStartOfMonth,
	getUTCEndOfMonth,
	getTodayLocal,
	parseDateAsLocal,
} from "../utils/dateUtils";
import { formatTimestampForDisplay } from "../utils/dateUtils";
import {
	generateRecurringInstances,
	extractTaskInfo,
	calculateTotalTimeSpent,
	formatTime,
	updateToNextScheduledOccurrence,
	sanitizeTags,
} from "../utils/helpers";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { generateLinkWithDisplay } from "../utils/linkUtils";
import { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { ConfirmationModal } from "./ConfirmationModal";

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
	private calendarWrapper: HTMLElement | null = null;
	private initialBlockedBy: TaskDependency[] = [];
	private initialBlockingPaths: string[] = [];
	private pendingBlockingUpdates: {
		added: string[];
		removed: string[];
		raw: Record<string, TaskDependency>;
	} = { added: [], removed: [], raw: {} };
	private unresolvedBlockingEntries: string[] = [];
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

		this.tags = this.task.tags
			? sanitizeTags(
					this.task.tags.filter((tag) => tag !== this.plugin.settings.taskTag).join(", ")
				)
			: "";
		this.timeEstimate = this.task.timeEstimate || 0;

		// Handle recurrence
		this.recurrenceRule = this.task.recurrence || "";

		// Initialize recurrence anchor
		this.recurrenceAnchor = this.task.recurrence_anchor || 'scheduled';

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

	private dependenciesEqual(a: TaskDependency[], b: TaskDependency[]): boolean {
		if (a.length !== b.length) {
			return false;
		}

		const sortDependencies = (deps: TaskDependency[]) =>
			[...deps].sort((left, right) => left.uid.localeCompare(right.uid));

		const sortedA = sortDependencies(a);
		const sortedB = sortDependencies(b);

		for (let i = 0; i < sortedA.length; i++) {
			const depA = sortedA[i];
			const depB = sortedB[i];
			if (
				depA.uid !== depB.uid ||
				depA.reltype !== depB.reltype ||
				(depA.gap || "") !== (depB.gap || "")
			) {
				return false;
			}
		}

		return true;
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

	async onOpen() {
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
		this.editModalKeyboardHandler = async (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				await this.handleSave();
				this.forceClose();
			}
		};
		this.containerEl.addEventListener("keydown", this.editModalKeyboardHandler);

		this.initializeFormData().then(() => {
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
					this.plugin.settings.storeTitleInFilename
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
		this.createCompletionsCalendarSection(container);
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
		this.showUnsavedChangesConfirmation();
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

			modal.show().then((confirmed) => {
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

	private createCompletionsCalendarSection(container: HTMLElement): void {
		// Only show calendar for recurring tasks
		if (this.task.recurrence) {
			const calendarContainer = container.createDiv("completions-calendar-container");

			const calendarLabel = calendarContainer.createDiv("detail-label");
			calendarLabel.textContent = this.t("modals.taskEdit.sections.completions");

			const calendarContent = calendarContainer.createDiv("completions-calendar-content");
			this.createRecurringCalendar(calendarContent);
		}
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

	private createRecurringCalendar(container: HTMLElement): void {
		// Calendar wrapper
		this.calendarWrapper = container.createDiv("recurring-calendar");

		// Show current month by default, or the month with most recent completions
		// Use local dates for calendar display
		const currentDate = getTodayLocal();
		let mostRecentCompletion = currentDate;

		if (this.task.complete_instances && this.task.complete_instances.length > 0) {
			const validCompletions = this.task.complete_instances
				.filter((d) => d && typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) // Only valid YYYY-MM-DD dates
				.map((d) => parseDateAsLocal(d).getTime())
				.filter((time) => !isNaN(time)); // Filter out invalid dates

			if (validCompletions.length > 0) {
				mostRecentCompletion = new Date(Math.max(...validCompletions));
			}
		}

		this.renderCalendarMonth(this.calendarWrapper, mostRecentCompletion);
	}

	private renderCalendarMonth(container: HTMLElement, displayDate: Date): void {
		container.empty();

		// Minimalist header
		const header = container.createDiv("recurring-calendar__header");
		const prevButton = header.createEl("button", {
			cls: "recurring-calendar__nav",
			text: "‹",
		});
		const monthLabel = header.createSpan("recurring-calendar__month");
		const locale = this.plugin.i18n.getCurrentLocale() || "en";
		const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
		monthLabel.textContent = monthFormatter.format(displayDate);
		const nextButton = header.createEl("button", {
			cls: "recurring-calendar__nav",
			text: "›",
		});

		// Minimalist grid
		const grid = container.createDiv("recurring-calendar__grid");

		// Get all dates to display (including padding from previous/next month)
		// Use UTC dates consistently to avoid timezone issues
		const monthStart = getUTCStartOfMonth(displayDate);
		const monthEnd = getUTCEndOfMonth(displayDate);

		// Respect the week start setting from calendar view settings
		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;

		const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
		const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
		const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);

		// Generate recurring instances for this month (with some buffer)
		const bufferStart = getUTCStartOfMonth(displayDate);
		bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
		const bufferEnd = getUTCEndOfMonth(displayDate);
		bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);

		const recurringDates = generateRecurringInstances(this.task, bufferStart, bufferEnd);
		const recurringDateStrings = new Set(recurringDates.map((d) => formatDateForStorage(d)));

		// Get current completed instances (original + changes)
		const completedInstances = new Set(this.task.complete_instances || []);
		for (const dateStr of this.completedInstancesChanges) {
			if (completedInstances.has(dateStr)) {
				completedInstances.delete(dateStr);
			} else {
				completedInstances.add(dateStr);
			}
		}

		// Get skipped instances (read-only display)
		const skippedInstances = new Set(this.task.skipped_instances || []);

		// Render each day (no headers, just numbers)
		allDays.forEach((day) => {
			const dayStr = formatDateForStorage(day);
			// FIX: Use UTC-to-UTC comparison instead of mixing local and UTC dates
			const isCurrentMonth = day.getUTCMonth() === displayDate.getUTCMonth();
			const isRecurring = recurringDateStrings.has(dayStr);
			const isCompleted = completedInstances.has(dayStr);
			const isSkipped = skippedInstances.has(dayStr);

			const dayElement = grid.createDiv("recurring-calendar__day");
			// FIX: Use UTC date method instead of timezone-sensitive format()
			dayElement.textContent = String(day.getUTCDate());

			// Apply BEM modifier classes
			if (!isCurrentMonth) {
				dayElement.addClass("recurring-calendar__day--faded");
			}

			// Make all dates clickable
			dayElement.addClass("recurring-calendar__day--clickable");

			if (isRecurring) {
				dayElement.addClass("recurring-calendar__day--recurring");
			}

			if (isCompleted) {
				dayElement.addClass("recurring-calendar__day--completed");
			}

			if (isSkipped) {
				dayElement.addClass("recurring-calendar__day--skipped");
			}

			// Make all dates clickable
			dayElement.addEventListener("click", () => {
				this.toggleCompletedInstance(dayStr);
				this.renderCalendarMonth(container, displayDate);
			});
		});

		// Navigation event handlers
		prevButton.addEventListener("click", () => {
			// FIX: Use UTC methods to prevent timezone drift
			const prevMonth = new Date(displayDate);
			prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
			this.renderCalendarMonth(container, prevMonth);
		});

		nextButton.addEventListener("click", () => {
			// FIX: Use UTC methods to prevent timezone drift
			const nextMonth = new Date(displayDate);
			nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
			this.renderCalendarMonth(container, nextMonth);
		});
	}

	private toggleCompletedInstance(dateStr: string): void {
		const index = this.completedInstancesChanges.indexOf(dateStr);
		if (index !== -1) {
			this.completedInstancesChanges.splice(index, 1);
		} else {
			this.completedInstancesChanges.push(dateStr);
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
				if (Object.prototype.hasOwnProperty.call(changes as any, "details")) {
					const updatedDetails = ((changes as any).details ?? "").toString();
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
		const changes: Partial<TaskInfo> = {};

		// Check for changes and only include modified fields
		if (this.title.trim() !== this.task.title) {
			changes.title = this.title.trim();
		}

		if (this.dueDate !== (this.task.due || "")) {
			changes.due = this.dueDate || undefined;
		}

		if (this.scheduledDate !== (this.task.scheduled || "")) {
			changes.scheduled = this.scheduledDate || undefined;
		}

		if (this.priority !== this.task.priority) {
			changes.priority = this.priority;
		}

		if (this.status !== this.task.status) {
			changes.status = this.status;
		}

		// Parse and compare contexts
		const newContexts = this.contexts
			.split(",")
			.map((c) => c.trim())
			.filter((c) => c.length > 0);
		const oldContexts = this.task.contexts || [];

		if (JSON.stringify(newContexts.sort()) !== JSON.stringify(oldContexts.sort())) {
			changes.contexts = newContexts.length > 0 ? newContexts : undefined;
		}

		// Parse and compare projects
		const newProjects = splitListPreservingLinksAndQuotes(this.projects);
		const oldProjects = this.task.projects || [];

		if (JSON.stringify(newProjects.sort()) !== JSON.stringify(oldProjects.sort())) {
			changes.projects = newProjects.length > 0 ? newProjects : undefined;
		}

		// Parse and compare tags
		const newTags = this.tags
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		// Add the task tag if using tag-based identification and it's not already present
		if (
			this.plugin.settings.taskIdentificationMethod === 'tag' &&
			this.plugin.settings.taskTag &&
			!newTags.includes(this.plugin.settings.taskTag)
		) {
			newTags.push(this.plugin.settings.taskTag);
		}

		const oldTags = this.task.tags || [];

		if (JSON.stringify(newTags.sort()) !== JSON.stringify(oldTags.sort())) {
			changes.tags = newTags.length > 0 ? newTags : undefined;
		}

		// Compare time estimate
		const newTimeEstimate = this.timeEstimate > 0 ? this.timeEstimate : undefined;
		const oldTimeEstimate = this.task.timeEstimate;

		if (newTimeEstimate !== oldTimeEstimate) {
			changes.timeEstimate = newTimeEstimate;
		}

		// Compare recurrence
		const oldRecurrence = typeof this.task.recurrence === "string" ? this.task.recurrence : "";

		if (this.recurrenceRule !== oldRecurrence) {
			changes.recurrence = this.recurrenceRule || undefined;
		}

		// Compare recurrence anchor
		const oldRecurrenceAnchor = this.task.recurrence_anchor || 'scheduled';

		if (this.recurrenceAnchor !== oldRecurrenceAnchor) {
			changes.recurrence_anchor = this.recurrenceAnchor;
		}

		// Compare reminders
		const oldReminders = this.task.reminders || [];
		const newReminders = this.reminders || [];

		if (JSON.stringify(newReminders) !== JSON.stringify(oldReminders)) {
			changes.reminders = newReminders.length > 0 ? newReminders : undefined;
		}

		const newBlockedDependencies = this.blockedByItems.map((item) => ({
			...item.dependency,
		}));
		if (!this.dependenciesEqual(newBlockedDependencies, this.initialBlockedBy)) {
			changes.blockedBy =
				newBlockedDependencies.length > 0 ? newBlockedDependencies : undefined;
		}

		const resolvedBlocking = new Map<string, TaskDependency>();
		const unresolvedEntries: string[] = [];

		this.blockingItems.forEach((item) => {
			if (item.path) {
				resolvedBlocking.set(item.path, { ...item.dependency });
			} else {
				unresolvedEntries.push(item.dependency.uid);
			}
		});

		const newBlockingPaths = Array.from(resolvedBlocking.keys());
		const originalPaths = new Set(this.initialBlockingPaths);
		const newPathSet = new Set(newBlockingPaths);

		const addedPaths = newBlockingPaths.filter((path) => !originalPaths.has(path));
		const removedPaths = this.initialBlockingPaths.filter((path) => !newPathSet.has(path));

		const rawAdditions: Record<string, TaskDependency> = {};
		for (const path of addedPaths) {
			const raw = resolvedBlocking.get(path);
			if (raw) {
				rawAdditions[path] = { ...raw };
			}
		}

		this.pendingBlockingUpdates = {
			added: addedPaths,
			removed: removedPaths,
			raw: rawAdditions,
		};
		this.unresolvedBlockingEntries = unresolvedEntries;

		const normalizedDetails = this.normalizeDetails(this.details);
		const normalizedOriginal = this.normalizeDetails(this.originalDetails);
		if (normalizedDetails !== normalizedOriginal) {
			changes.details = normalizedDetails.trimEnd();
		}

		// Apply completed instances changes
		if (this.completedInstancesChanges.length > 0) {
			const currentCompleted = new Set(this.task.complete_instances || []);
			let latestAddedCompletion: string | null = null;

			for (const dateStr of this.completedInstancesChanges) {
				if (currentCompleted.has(dateStr)) {
					currentCompleted.delete(dateStr);
				} else {
					currentCompleted.add(dateStr);
					// Track the latest date being added (for completion-based recurrence)
					if (!latestAddedCompletion || dateStr > latestAddedCompletion) {
						latestAddedCompletion = dateStr;
					}
				}
			}
			changes.complete_instances = Array.from(currentCompleted);

			// If task has recurrence, handle DTSTART update and scheduled date calculation
			if (this.task.recurrence && typeof this.task.recurrence === 'string') {
				const recurrenceAnchor = this.task.recurrence_anchor || 'scheduled';

				// For completion-based recurrence, update DTSTART when adding a completion
				if (recurrenceAnchor === 'completion' && latestAddedCompletion) {
					const { updateDTSTARTInRecurrenceRule } = require('../utils/helpers');
					const updatedRecurrence = updateDTSTARTInRecurrenceRule(
						this.task.recurrence,
						latestAddedCompletion
					);
					if (updatedRecurrence) {
						changes.recurrence = updatedRecurrence;
					}
				}

				// Calculate next scheduled date
				const tempTask: TaskInfo = {
					...this.task,
					...changes,
					// Use updated recurrence if it was changed
					recurrence: changes.recurrence || this.task.recurrence
				};
				const nextDates = updateToNextScheduledOccurrence(
					tempTask,
					this.plugin.settings.maintainDueDateOffsetInRecurring
				);
				if (nextDates.scheduled) {
					changes.scheduled = nextDates.scheduled;
				}
				if (nextDates.due) {
					changes.due = nextDates.due;
				}
			}
		}

		// Compare user fields and add to changes if modified
		const userFieldsChanges = this.getUserFieldChanges();
		if (Object.keys(userFieldsChanges).length > 0) {
			(changes as any).customFrontmatter = userFieldsChanges;
		}

		// Always update modified timestamp if there are changes
		if (Object.keys(changes).length > 0) {
			changes.dateModified = getCurrentTimestamp();
		}

		return changes;
	}

	private getUserFieldChanges(): Record<string, any> {
		const userFieldsChanges: Record<string, any> = {};

		try {
			// Get current frontmatter values
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				return userFieldsChanges;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			const frontmatter: Record<string, any> = metadata?.frontmatter || {};

			// Compare current values with original frontmatter
			const userFieldConfigs = this.plugin.settings?.userFields || [];
			for (const field of userFieldConfigs) {
				if (!field || !field.key) continue;

				const newValue = this.userFields[field.key];
				const oldValue = frontmatter[field.key];

				// Check if values are different
				if (this.isDifferent(newValue, oldValue)) {
					// Set to null if empty value, otherwise use the new value
					userFieldsChanges[field.key] =
						newValue === null || newValue === undefined || newValue === ""
							? null
							: newValue;
				}
			}
		} catch (error) {
			console.error("Error comparing user fields:", error);
		}

		return userFieldsChanges;
	}

	private isDifferent(newValue: any, oldValue: any): boolean {
		// Handle null/undefined/empty comparisons
		const normalizeEmpty = (value: any) => {
			if (value === null || value === undefined || value === "") {
				return null;
			}
			return value;
		};

		const normalizedNew = normalizeEmpty(newValue);
		const normalizedOld = normalizeEmpty(oldValue);

		// For arrays (list fields), compare as JSON strings
		if (Array.isArray(normalizedNew) || Array.isArray(normalizedOld)) {
			return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOld);
		}

		// For other values, direct comparison
		return normalizedNew !== normalizedOld;
	}

	private async openTaskNote(): Promise<void> {
		try {
			// Get the file from the task path
			const file = this.app.vault.getAbstractFileByPath(this.task.path);

			if (!file) {
				new Notice(this.t("modals.taskEdit.notices.fileMissing", { path: this.task.path }));
				return;
			}

			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file as TFile);

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
		const buttonContainer = container.createDiv("modal-button-container");

		// Add "Open note" button
		const openNoteButton = buttonContainer.createEl("button", {
			cls: "open-note-button",
			text: this.t("modals.task.buttons.openNote"),
		});

		openNoteButton.addEventListener("click", async () => {
			await this.openTaskNote();
		});

		// Add "Archive" button
		const archiveButton = buttonContainer.createEl("button", {
			cls: "mod-warning archive-button",
			text: this.task.archived
				? this.t("modals.taskEdit.buttons.unarchive")
				: this.t("modals.taskEdit.buttons.archive"),
		});

		archiveButton.addEventListener("click", async () => {
			await this.archiveTask();
		});

		// Save button (primary action)
		const saveButton = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: this.t("modals.task.buttons.save"),
		});

		saveButton.addEventListener("click", async () => {
			saveButton.disabled = true;
			try {
				await this.handleSave();
				this.forceClose();
			} finally {
				saveButton.disabled = false;
			}
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

			const subtasks = await this.plugin.projectSubtasksService.getTasksLinkedToProject(taskFile);
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
		const current = this.selectedSubtaskFiles.map(f => f.path).sort();
		const initial = this.initialSubtaskFiles.map(f => f.path).sort();

		return current.length !== initial.length ||
			   current.some((path, index) => path !== initial[index]);
	}

	protected async applySubtaskChanges(task: TaskInfo): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(task.path);
		if (!(currentTaskFile instanceof TFile)) return;

		const currentPaths = new Set(this.selectedSubtaskFiles.map(f => f.path));
		const initialPaths = new Set(this.initialSubtaskFiles.map(f => f.path));

		// Remove current task from tasks that should no longer be subtasks
		const toRemove = this.initialSubtaskFiles.filter(f => !currentPaths.has(f.path));
		for (const file of toRemove) {
			await this.removeSubtaskRelation(file, currentTaskFile);
		}

		// Add current task to tasks that should become subtasks
		const toAdd = this.selectedSubtaskFiles.filter(f => !initialPaths.has(f.path));
		for (const file of toAdd) {
			await this.addSubtaskRelation(file, currentTaskFile);
		}

		// Update the initial state to reflect changes
		this.initialSubtaskFiles = [...this.selectedSubtaskFiles];
	}

	protected async addSubtaskRelation(subtaskFile: TAbstractFile, parentTaskFile: TFile): Promise<void> {
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

	protected async removeSubtaskRelation(subtaskFile: TAbstractFile, parentTaskFile: TFile): Promise<void> {
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
