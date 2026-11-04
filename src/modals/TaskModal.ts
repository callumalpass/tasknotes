import { applyModalShell } from "../ui/kit/modal";
import { uiData } from "../i18n/dataText";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { App, Modal, Notice, TAbstractFile, TFile } from "obsidian";

type Nullable<T> = T | null;

import TaskNotesPlugin from "../main";
import { shouldShowFieldForModal } from "./taskModalFieldConfig";
import type { ModalFieldConfigLike, ModalFieldsConfigLike } from "./taskModalFieldConfig";
import {
	renderTaskModalFieldGroups,
	type TaskModalFieldRendererMap,
} from "./taskModalFieldRenderer";
import {
	createTaskModalDetailsEditor,
	destroyTaskModalDetailsEditor,
	setTaskModalDetailsEditorValue,
} from "./taskModalDetailsEditor";
import { splitFrontmatterAndBody } from "../utils/helpers";
import { ProjectSelectModal } from "./ProjectSelectModal";
import { AttachmentFileSuggestModal } from "./AttachmentFileSuggestModal";
import {
	TaskModalAttachmentsField,
	materializeTaskModalAttachments,
	type MaterializedTaskModalAttachments,
	type TaskModalAttachmentEntry,
} from "./taskModalAttachments";
import { fieldLabelForId } from "../i18n/fieldLabels";
import { createVaultBinaryFile } from "../services/VaultMutationService";
import { TaskDependency } from "../types";
import { DEFAULT_DEPENDENCY_RELTYPE, formatDependencyLink } from "../utils/dependencyUtils";
import { type LinkServices } from "../ui/renderers/linkRenderer";
import { generateLink } from "../utils/linkUtils";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import {
	createTaskModalBlockedByField,
	createTaskModalBlockingField,
	createTaskModalProjectsField,
	createTaskModalSubtasksField,
	type TaskModalOrganizationFieldContext,
} from "./taskModalOrganizationFields";
import { createTaskCard } from "../ui/TaskCard";
import {
	addDependencyItem,
	createDependencyItemFromDependency as createDependencyItemFromDependencyHelper,
	createDependencyItemFromFile as createDependencyItemFromFileHelper,
	createDependencyItemFromPath as createDependencyItemFromPathHelper,
	DependencyItem,
	getBlockedByDependencyCandidates,
	getBlockingDependencyCandidates,
	removeDependencyItemAtIndex,
	renderDependencyList,
} from "./taskModalDependencies";
import {
	createTaskModalContextsField,
	createTaskModalTagsField,
	createTaskModalTimeEstimateField,
	formatTaskModalTimeEstimate,
	type TaskModalMetadataFieldContext,
} from "./taskModalMetadataFields";
import {
	createTaskModalConfiguredUserField,
	updateTaskModalUserFieldControls,
	type TaskModalUserFieldContext,
	type TaskModalUserFieldToggleControl,
} from "./taskModalUserFieldControls";
import {
	createTaskModalActionButtons,
	type TaskModalActionButtonContext,
	type TaskModalLeadingButton,
	type TaskModalOverflowAction,
} from "./taskModalActionButtons";
import {
	createTaskModalActionIcon,
	createTaskModalActionIcons,
	type TaskModalActionIconSpec,
} from "./taskModalActionBar";
import { updateTaskModalActionIconStates } from "./taskModalActionIconStates";
import {
	buildTaskModalActionIconState,
	createTaskModalActionMenuContext,
	createTaskModalActionMenuState,
} from "./taskModalActionState";
import {
	showTaskModalPropertyPicker,
	showTaskModalRecurrenceContextMenu,
	showTaskModalReminderContextMenu,
	type TaskModalActionMenuContext,
	type TaskModalActionMenuState,
} from "./taskModalActionMenus";
import type { PopoverHandle } from "../ui/kit/popover";
import {
	addTaskModalProjectItemsFromStrings,
	createTaskModalProjectItemFromFile,
	getTaskModalProjectsValue,
	hasTaskModalProjectItem,
	removeTaskModalProjectItem,
	renderTaskModalProjectsList,
	type TaskModalProjectItem,
	type TaskModalProjectStringContext,
} from "./taskModalProjects";
import {
	addTaskModalSubtaskFile,
	getTaskModalSubtaskCandidates,
	removeTaskModalSubtaskFile,
	renderTaskModalSubtasksList,
} from "./taskModalSubtasks";
import { openTaskModalTaskSelector } from "./taskModalTaskSelector";
import { buildSubtaskCreationPrePopulatedValues } from "../services/taskRelationshipActions";
import {
	createTaskModalTitleTextarea,
	type TaskModalTitleInputElement,
} from "./taskModalTitleInput";
import { setTaskModalDetailsCollapsed } from "./taskModalLayout";
import { resizeTaskModalTitleTextarea } from "./taskModalTitleInput";
import { TaskFormModel, type TaskFormErrorField } from "./taskFormModel";
import type { TaskSaveOutcome } from "./taskModalSave";
import { ConfirmationModal } from "./ConfirmationModal";
import {
	TaskModalFocusGuards,
	type TaskModalMobileKeyboardScrollGuardOptions,
} from "./taskModalFocusGuards";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TaskModal" });

export interface TaskSubmitOptions {
	createAnother?: boolean;
}

type UnsavedChangesChoice = "save" | "discard" | "cancel";

export abstract class TaskModal extends Modal {
	plugin: TaskNotesPlugin;
	protected abstract readonly mode: "create" | "edit";
	readonly form = new TaskFormModel({
		title: "",
		details: "",
		dueDate: "",
		scheduledDate: "",
		priority: uiData(
			"normal",
			"Persisted priority value; preserve user metadata and matching semantics"
		),
		status: uiData(
			"open",
			"Persisted status value; preserve user metadata and matching semantics"
		),
		contexts: "",
		projects: "",
		tags: "",
		timeEstimate: 0,
		recurrenceRule: "",
		recurrenceAnchor: "scheduled",
		reminders: [],
		userFields: {},
	});
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private propertyPicker: PopoverHandle | undefined = undefined;
	private focusGuards: TaskModalFocusGuards;
	private unsubscribeForm: (() => void) | null = null;
	private saveInFlight: Promise<boolean> | null = null;
	private submitInFlight: Promise<boolean> | null = null;
	private isShowingConfirmation = false;
	private pendingClose = false;
	private isModalOpen = false;
	private isSyncingControls = false;
	private saveButton: HTMLButtonElement | null = null;
	protected createMore = false;
	private readonly fieldErrorEls = new Map<TaskFormErrorField, HTMLElement>();

	// Dependency item definition
	protected createDependencyItemFromFile(
		file: TFile,
		options: { sourcePath?: string } = {}
	): DependencyItem {
		return createDependencyItemFromFileHelper(
			{
				plugin: this.plugin,
				sourcePath: options.sourcePath ?? this.getDependencySourcePath(),
			},
			file
		);
	}

	protected createDependencyItemFromDependency(
		dependency: TaskDependency,
		sourcePath?: string
	): DependencyItem {
		return createDependencyItemFromDependencyHelper(
			{ plugin: this.plugin, sourcePath: sourcePath ?? this.getDependencySourcePath() },
			dependency
		);
	}

	protected createDependencyItemFromPath(path: string): DependencyItem {
		return createDependencyItemFromPathHelper(
			{ plugin: this.plugin, sourcePath: this.getDependencySourcePath() },
			path
		);
	}

	protected getDependencySourcePath(): string {
		return this.getCurrentTaskPath() || this.plugin.app.workspace.getActiveFile()?.path || "";
	}

	// Overridden by subclasses that manage an existing task
	protected getCurrentTaskPath(): string | undefined {
		return undefined;
	}

	protected getModalEditorFile(): Nullable<TFile> {
		const currentTaskPath = this.getCurrentTaskPath();
		if (!currentTaskPath) {
			return this.app.workspace.getActiveFile();
		}

		const file = this.app.vault.getAbstractFileByPath(currentTaskPath);
		return file instanceof TFile ? file : this.app.workspace.getActiveFile();
	}

	protected renderDependencyLists(): void {
		this.renderBlockedByList();
		this.renderBlockingList();
	}

	protected getLinkServices(): LinkServices {
		return {
			translate: this.t.bind(this),
			metadataCache: this.plugin.app.metadataCache,
			workspace: this.plugin.app.workspace,
			sourcePath:
				this.getCurrentTaskPath() || this.plugin.app.workspace.getActiveFile()?.path || "",
		};
	}

	protected renderBlockedByList(): void {
		void this.renderDependencyList(this.blockedByList, this.blockedByItems, (index) => {
			this.blockedByItems = removeDependencyItemAtIndex(this.blockedByItems, index);
			this.renderBlockedByList();
		});
	}

	protected renderBlockingList(): void {
		void this.renderDependencyList(this.blockingList, this.blockingItems, (index) => {
			this.blockingItems = removeDependencyItemAtIndex(this.blockingItems, index);
			this.renderBlockingList();
		});
	}

	private async renderDependencyList(
		listEl: HTMLElement | undefined,
		items: DependencyItem[],
		onRemove: (index: number) => void
	): Promise<void> {
		if (!listEl) {
			return;
		}

		await renderDependencyList({
			plugin: this.plugin,
			listEl,
			items,
			linkServices: this.getLinkServices(),
			translate: (key, params) => this.t(key, params),
			onRemove,
		});
	}

	protected extractDetailsFromContent(content: string): string {
		const { body } = splitFrontmatterAndBody(content);
		return body.replace(/\r\n/g, "\n").trimEnd();
	}

	protected normalizeDetails(value: string): string {
		return value.replace(/\r\n/g, "\n").trimEnd();
	}

	protected addBlockedByDependency(dependency: TaskDependency): void {
		const sourcePath = this.getDependencySourcePath();
		const item = this.createDependencyItemFromDependency(dependency, sourcePath);
		const nextItems = addDependencyItem(this.blockedByItems, item);
		if (nextItems.length === this.blockedByItems.length) {
			return;
		}
		this.blockedByItems = nextItems;
		this.renderBlockedByList();
	}

	protected addBlockingTaskFromPath(path: string): void {
		const currentPath = this.getCurrentTaskPath();
		if (currentPath && path === currentPath) {
			return;
		}
		const item = this.createDependencyItemFromPath(path);
		const nextItems = addDependencyItem(this.blockingItems, item);
		if (nextItems.length === this.blockingItems.length) {
			return;
		}
		this.blockingItems = nextItems;
		this.renderBlockingList();
	}

	protected async openBlockedBySelector(): Promise<void> {
		const sourcePath = this.getDependencySourcePath();

		await openTaskModalTaskSelector({
			plugin: this.plugin,
			getCandidates: (allTasks) =>
				getBlockedByDependencyCandidates({
					plugin: this.plugin,
					sourcePath,
					allTasks,
					existingItems: this.blockedByItems,
					currentPath: this.getCurrentTaskPath(),
				}),
			onSelect: (selected) => {
				const dependency: TaskDependency = {
					uid: formatDependencyLink(this.plugin.app, sourcePath, selected.path),
					reltype: DEFAULT_DEPENDENCY_RELTYPE,
				};
				this.addBlockedByDependency(dependency);
			},
			translate: (key) => this.t(key),
			noEligibleTasksMessageKey: msg({
				message: "No matching tasks available",
				context: "contextMenus.task.dependencies.notices.noEligibleTasks",
			}),
			openFailedMessageKey: msg({
				message: "Failed to update dependencies",
				context: "contextMenus.task.dependencies.notices.updateFailed",
			}),
			logOperation: "open-blocked-by-selector",
		});
	}

	protected async openBlockingSelector(): Promise<void> {
		const sourcePath = this.getDependencySourcePath();

		await openTaskModalTaskSelector({
			plugin: this.plugin,
			getCandidates: (allTasks) =>
				getBlockingDependencyCandidates({
					plugin: this.plugin,
					sourcePath,
					allTasks,
					existingItems: this.blockingItems,
					currentPath: this.getCurrentTaskPath(),
				}),
			onSelect: (selected) => {
				this.addBlockingTaskFromPath(selected.path);
			},
			translate: (key) => this.t(key),
			noEligibleTasksMessageKey: msg({
				message: "No matching tasks available",
				context: "contextMenus.task.dependencies.notices.noEligibleTasks",
			}),
			openFailedMessageKey: msg({
				message: "Failed to update dependencies",
				context: "contextMenus.task.dependencies.notices.updateFailed",
			}),
			logOperation: "open-blocking-selector",
		});
	}

	protected originalDetails = "";

	// User-defined field controls (dynamic based on settings)
	protected userFieldInputs = new Map<string, HTMLInputElement>();
	protected userFieldToggles = new Map<string, TaskModalUserFieldToggleControl>();

	// Dependency fields
	protected blockedByItems: DependencyItem[] = [];
	protected blockingItems: DependencyItem[] = [];
	protected blockedByList: HTMLElement | undefined = undefined;
	protected blockingList: HTMLElement | undefined = undefined;

	// Project link storage
	protected selectedProjectItems: TaskModalProjectItem[] = [];

	// Attachments: linked vault files plus disk files imported on save
	protected attachmentEntries: TaskModalAttachmentEntry[] = [];
	protected attachmentsField: TaskModalAttachmentsField | null = null;

	// Subtask storage - tracks tasks that should become subtasks of this task
	protected selectedSubtaskFiles: TAbstractFile[] = [];
	protected initialSubtaskFiles: TAbstractFile[] = [];

	// UI elements
	protected titleInput: TaskModalTitleInputElement | undefined = undefined;
	protected detailsMarkdownEditor: EmbeddableMarkdownEditor | null = null;
	protected contextsInput: HTMLInputElement = undefined as unknown as HTMLInputElement;
	protected projectsInput: HTMLInputElement = undefined as unknown as HTMLInputElement;
	protected tagsInput: HTMLInputElement = undefined as unknown as HTMLInputElement;
	protected timeEstimateInput: HTMLInputElement = undefined as unknown as HTMLInputElement;
	protected projectsList: HTMLElement = undefined as unknown as HTMLElement;
	protected subtasksList: HTMLElement = undefined as unknown as HTMLElement;
	protected actionBar: HTMLElement = undefined as unknown as HTMLElement;
	protected detailsContainer: HTMLElement = undefined as unknown as HTMLElement;
	protected isExpanded = false;

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app);
		applyModalShell(this);
		this.plugin = plugin;
		this.focusGuards = new TaskModalFocusGuards({
			containerEl: this.containerEl,
			modalEl: this.modalEl,
			contentEl: this.contentEl,
		});
	}

	protected t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
	}

	/**
	 * Get all markdown files - useful for testing with mocked vault
	 */
	protected getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	/**
	 * Resolve a link to a file - useful for testing with mocked metadataCache
	 */
	protected resolveLink(linkPath: string, sourcePath: string): unknown {
		return this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
	}

	abstract initializeFormData(): Promise<void>;
	/** Writes the task. The modal stays open only when the outcome is `failed`. */
	abstract handleSave(options?: TaskSubmitOptions): Promise<TaskSaveOutcome>;
	abstract getModalTitle(): string;

	protected async handleSubmitShortcut(shift: boolean): Promise<void> {
		await this.submit({ createAnother: shift || (this.mode === "create" && this.createMore) });
	}

	/** Save and close. Save, the keyboard shortcuts and the close prompt all end up here. */
	protected submit(options: TaskSubmitOptions = {}): Promise<boolean> {
		this.submitInFlight ??= (async () => {
			const saved = await this.runSave(options);
			if (saved) {
				this.forceClose();
				this.afterSubmit(options);
			}
			return saved;
		})().finally(() => {
			this.submitInFlight = null;
		});
		return this.submitInFlight;
	}

	protected afterSubmit(_options: TaskSubmitOptions): void {
		// Overridden by modals that continue after closing.
	}

	/** Every save shares one in-flight run, so repeated shortcuts cannot write twice. */
	private runSave(options: TaskSubmitOptions = {}): Promise<boolean> {
		this.saveInFlight ??= this.executeSave(options).finally(() => {
			this.saveInFlight = null;
			if (this.saveButton) this.saveButton.disabled = false;
		});
		return this.saveInFlight;
	}

	private async executeSave(options: TaskSubmitOptions): Promise<boolean> {
		if (this.saveButton) this.saveButton.disabled = true;
		return (await this.handleSave(options)).status !== "failed";
	}

	protected hasUnsavedChanges(): boolean {
		return false;
	}

	/** Close without checking for unsaved changes. */
	forceClose(): void {
		this.propertyPicker?.close();
		this.propertyPicker = undefined;
		this.pendingClose = true;
		super.close();
	}

	/**
	 * Prompts before discarding unsaved work. Synchronous to match Obsidian's
	 * Modal.close() signature; the prompt runs separately.
	 */
	close(): void {
		if (this.pendingClose) {
			this.pendingClose = false;
			super.close();
			return;
		}

		if (this.isShowingConfirmation) {
			return;
		}

		if (!this.hasUnsavedChanges()) {
			super.close();
			return;
		}

		void this.showUnsavedChangesConfirmation();
	}

	private async showUnsavedChangesConfirmation(): Promise<void> {
		if (await this.resolveUnsavedChanges()) {
			this.forceClose();
		}
	}

	/** Returns true once it is safe to leave the form: saved, discarded or nothing to save. */
	protected async resolveUnsavedChanges(): Promise<boolean> {
		if (!this.hasUnsavedChanges()) {
			return true;
		}

		this.isShowingConfirmation = true;
		try {
			const choice = await this.showThreeButtonConfirmation();
			if (choice === "cancel") return false;
			if (choice === "discard") return true;
			return await this.runSave();
		} finally {
			this.isShowingConfirmation = false;
		}
	}

	private showThreeButtonConfirmation(): Promise<UnsavedChangesChoice> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app, {
				title: this.t(
					msg({ message: "Unsaved changes", context: "modals.task.unsavedChanges.title" })
				),
				message: this.t(
					msg({
						message: "You have unsaved changes. Do you want to save them?",
						context: "modals.task.unsavedChanges.message",
					})
				),
				confirmText: this.t(
					msg({ message: "Save changes", context: "modals.task.unsavedChanges.save" })
				),
				cancelText: this.t(
					msg({
						message: "Discard changes",
						context: "modals.task.unsavedChanges.discard",
					})
				),
				thirdButtonText: this.t(
					msg({ message: "Keep editing", context: "modals.task.unsavedChanges.cancel" })
				),
				defaultToConfirm: true,
				onThirdButton: () => resolve("cancel"),
			});

			void modal.show().then((confirmed) => {
				resolve(confirmed ? "save" : "discard");
			});
		});
	}

	onOpen() {
		this.isModalOpen = true;
		this.containerEl.addClass("tasknotes-plugin", "minimalist-task-modal");
		if (this.plugin.settings.enableModalSplitLayout) {
			this.containerEl.addClass("split-layout-enabled");
		}
		this.modalEl.addClass("mod-tasknotes");

		// Set the modal title using the standard Obsidian approach (preserves close button)
		this.titleEl.setText(this.getModalTitle());

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (
				e.key === "Enter" &&
				(e.ctrlKey || e.metaKey) &&
				!e.isComposing &&
				!this.isShowingConfirmation
			) {
				e.preventDefault();
				e.stopImmediatePropagation();
				void this.handleSubmitShortcut(e.shiftKey);
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler, true);

		this.unsubscribeForm = this.form.subscribe(() => this.syncFormControls());

		this.contentEl.createDiv("tn-task-modal__loading");
		void this.renderForm();
	}

	/** Loading can outlast the modal, which then has nothing to render into. */
	private async renderForm(): Promise<void> {
		await this.initializeFormData();
		if (!this.isModalOpen) return;

		this.form.markClean();
		this.createModalContent();
		this.renderProjectsList();
		this.updateIconStates();
		this.focusTitleInput();
	}

	// Store references to split layout containers for potential reuse
	protected splitContentWrapper: HTMLElement;
	protected splitLeftColumn: HTMLElement;
	protected splitRightColumn: HTMLElement = undefined as unknown as HTMLElement;

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.containerEl.classList.toggle("expanded", this.isExpanded);

		// Create main container
		const container = contentEl.createDiv("minimalist-modal-container");

		// Create split content wrapper at the top level for wide screen layout
		this.splitContentWrapper = container.createDiv("modal-split-content");
		this.splitLeftColumn = this.splitContentWrapper.createDiv("modal-split-left");

		// Create primary input area (title or NLP) - subclasses can override
		this.createPrimaryInput(this.splitLeftColumn);

		this.splitRightColumn = this.splitLeftColumn.createDiv("modal-split-right");

		// Create collapsible details section (fields in left, details editor in right)
		this.createDetailsSection(container);
		this.createActionBar(this.splitLeftColumn);
		this.detailsContainer.before(this.actionBar);

		// Hook for subclasses to add additional sections to left column
		this.createAdditionalSections(this.splitLeftColumn);

		// Create save/cancel buttons - outside the split, at bottom
		this.createActionButtons(container);
	}

	/**
	 * Creates the primary input area. Override in subclasses for different behavior.
	 * Default: simple title input
	 */
	protected createPrimaryInput(container: HTMLElement): void {
		if (
			this.mode === "create" ||
			this.shouldShowField("title", this.plugin.settings.modalFieldsConfig)
		) {
			this.createTitleInput(container);
		}
	}

	/**
	 * Hook for subclasses to add additional sections after the details section.
	 * Default: no-op
	 */
	protected createAdditionalSections(container: HTMLElement): void {
		// Override in subclasses (e.g., TaskEditModal adds completions calendar and metadata)
	}

	protected createTitleInput(container: HTMLElement): void {
		const titleContainer = container.createDiv("title-input-container");

		this.titleInput = this.createTitleTextarea(
			titleContainer,
			"title-input",
			this.t(
				msg({ message: "What needs to be done?", context: "modals.task.titlePlaceholder" })
			)
		);
	}

	private createTitleTextarea(
		container: HTMLElement,
		cls: string,
		placeholder: string
	): HTMLTextAreaElement {
		return createTaskModalTitleTextarea({
			container,
			className: cls,
			placeholder,
			value: this.form.values.title,
			onChange: (value) => {
				this.form.edit("title", value);
			},
			attachFocusScrollGuard: (input) => {
				this.attachTitleFocusScrollGuard(input);
				this.attachMobileKeyboardScrollGuard(input, { scrollOnFocus: false });
			},
		});
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = container.createDiv("tn-task-modal__action-bar");
		this.createCoreActionIcons(this.actionBar);
		this.updateIconStates();
	}

	protected createCoreActionIcons(container: HTMLElement): HTMLElement[] {
		return createTaskModalActionIcons(container, this.getCoreActionIconSpecs());
	}

	protected getCoreActionIconSpecs(): TaskModalActionIconSpec[] {
		return [
			{
				iconName: "circle",
				tooltip: this.t(
					msg({ message: "Set status", context: "modals.task.actions.status" })
				),
				onClick: (_, event) => {
					this.showStatusContextMenu(event);
				},
				dataType: "status",
				chip: true,
			},
			{
				iconName: "star",
				tooltip: this.t(
					msg({ message: "Set priority", context: "modals.task.actions.priority" })
				),
				onClick: (_, event) => {
					this.showPriorityContextMenu(event);
				},
				dataType: "priority",
				chip: true,
			},
			{
				iconName: "calendar",
				tooltip: this.t(
					msg({ message: "Set due date", context: "modals.task.actions.due" })
				),
				onClick: (_, event) => {
					this.showDateContextMenu(event, "due");
				},
				dataType: "due-date",
				chip: true,
			},
			{
				iconName: "calendar-clock",
				tooltip: this.t(
					msg({ message: "Set scheduled date", context: "modals.task.actions.scheduled" })
				),
				onClick: (_, event) => {
					this.showDateContextMenu(event, "scheduled");
				},
				dataType: "scheduled-date",
				chip: true,
			},
			{
				iconName: "refresh-ccw",
				tooltip: this.t(
					msg({ message: "Set recurrence", context: "modals.task.actions.recurrence" })
				),
				onClick: (_, event) => {
					this.showRecurrenceContextMenu(event);
				},
				dataType: "recurrence",
				chip: true,
			},
			{
				iconName: "bell",
				tooltip: this.t(
					msg({ message: "Set reminders", context: "modals.task.actions.reminders" })
				),
				onClick: (_, event) => {
					this.showReminderContextMenu(event);
				},
				dataType: "reminders",
				chip: true,
			},
		];
	}

	protected createActionIcon(
		container: HTMLElement,
		iconName: string,
		tooltip: string,
		onClick: (icon: HTMLElement, event: UIEvent) => void,
		dataType?: string
	): HTMLElement {
		return createTaskModalActionIcon(container, {
			iconName,
			tooltip,
			onClick,
			dataType,
		});
	}

	protected createDetailsSection(container: HTMLElement): void {
		this.userFieldInputs.clear();
		this.userFieldToggles.clear();

		// The details container wraps the expandable fields (for hide/show animation)
		// It goes inside the left column for proper expand/collapse
		this.detailsContainer = this.splitLeftColumn
			? this.splitLeftColumn.createDiv("details-container")
			: container.createDiv("details-container");

		setTaskModalDetailsCollapsed(
			{ detailsContainer: this.detailsContainer, splitRightColumn: this.splitRightColumn },
			!this.isExpanded
		);

		// Check field configuration to determine which fields to show
		const config = this.plugin.settings.modalFieldsConfig;
		const shouldShowTitle = this.shouldShowField("title", config);
		const shouldShowDetails = this.shouldShowField("details", config);
		this.splitContentWrapper.classList.toggle(
			"modal-split-content--right-empty",
			!shouldShowDetails
		);

		// With natural language input the primary field holds the raw text, so the
		// parsed title gets its own field here.
		if (shouldShowTitle && this.showsTitleInDetails()) {
			const titleLabel = this.detailsContainer.createDiv("detail-label");
			titleLabel.textContent = this.t(
				msg({ message: "Title", context: "modals.task.titleLabel" })
			);

			this.titleInput = this.createTitleTextarea(
				this.detailsContainer,
				"title-input-detailed",
				this.t(
					msg({
						message: "Task title...",
						context: "modals.task.titleDetailedPlaceholder",
					})
				)
			);
		}

		// Details editor goes in the right column
		if (shouldShowDetails) {
			const rightColumn = this.splitRightColumn || this.detailsContainer;

			this.detailsMarkdownEditor = createTaskModalDetailsEditor({
				app: this.app,
				parent: rightColumn,
				label: this.t(msg({ message: "Details", context: "modals.task.detailsLabel" })),
				value: this.form.values.details,
				placeholder: this.t(
					msg({
						message: "Add more details...",
						context: "modals.task.detailsPlaceholder",
					})
				),
				file: this.getModalEditorFile(),
				tabMovesFocus: this.plugin.settings.taskModalTabMovesFocus,
				onChange: (value) => {
					// Syncing the editor from the form is not an edit.
					if (!this.isSyncingControls) this.form.edit("details", value);
				},
				onSubmit: (shift) => {
					void this.handleSubmitShortcut(shift);
				},
				onEscape: () => {
					this.close();
				},
				focusNextField: () => this.focusNextField(),
				focusPreviousField: () => this.focusPreviousField(),
				attachMobileKeyboardScrollGuard: (container) => {
					this.attachMobileKeyboardScrollGuard(container);
				},
			});
		}

		// Additional form fields (contexts, tags, etc.) go in the details container (left side)
		this.createAdditionalFields(this.detailsContainer);
	}

	/**
	 * Check if a field should be shown based on field configuration
	 */
	protected shouldShowField(fieldId: string, config?: ModalFieldsConfigLike): boolean {
		return shouldShowFieldForModal(fieldId, config, this.mode === "create");
	}

	protected showsTitleInDetails(): boolean {
		return false;
	}

	protected createAdditionalFields(container: HTMLElement): void {
		// Use field configuration (always initialized via migration in main.ts)
		const config = this.plugin.settings.modalFieldsConfig;
		if (!config) {
			tasknotesLogger.error(
				"TaskModal: modalFieldsConfig is not initialized. This should never happen.",
				{
					category: "configuration",
					operation:
						"taskmodal-modalfieldsconfig-not-initialized-this-should-never-happen",
				}
			);
			return;
		}
		this.createFieldsFromConfig(container, config);
	}

	protected createFieldsFromConfig(container: HTMLElement, config: ModalFieldsConfigLike): void {
		renderTaskModalFieldGroups({
			container,
			config,
			isCreationMode: this.mode === "create",
			fieldRenderers: this.getFieldRenderers(),
			renderUserField: (fieldContainer, fieldConfig) => {
				this.createUserFieldByConfig(fieldContainer, fieldConfig);
			},
		});
	}

	private getFieldRenderers(): TaskModalFieldRendererMap {
		return {
			contexts: (container) => this.createContextsField(container),
			tags: (container) => this.createTagsField(container),
			"time-estimate": (container) => this.createTimeEstimateField(container),
			projects: (container) => this.createProjectsField(container),
			subtasks: (container) => this.createSubtasksField(container),
			attachments: (container) => this.createAttachmentsField(container),
			"blocked-by": (container) => this.createBlockedByField(container),
			blocking: (container) => this.createBlockingField(container),
		};
	}

	protected createContextsField(container: HTMLElement): void {
		this.contextsInput = createTaskModalContextsField(this.getMetadataFieldContext(), {
			container,
			value: this.form.values.contexts,
			onChange: (value) => {
				this.form.edit("contexts", value);
			},
		});
	}

	protected createTagsField(container: HTMLElement): void {
		this.tagsInput = createTaskModalTagsField(this.getMetadataFieldContext(), {
			container,
			value: this.form.values.tags,
			onChange: (value) => {
				this.form.edit("tags", value);
			},
		});
	}

	protected createTimeEstimateField(container: HTMLElement): void {
		this.timeEstimateInput = createTaskModalTimeEstimateField(this.getMetadataFieldContext(), {
			container,
			value: this.form.values.timeEstimate,
			onChange: (value) => {
				this.form.edit("timeEstimate", value ?? 0);
				this.form.setError(
					"timeEstimate",
					value === null
						? this.t(
								msg({
									message: "Enter a time such as 45 or 1h 30m",
									context: "modals.task.timeEstimateInvalid",
								})
							)
						: null
				);
			},
		});
	}

	private getMetadataFieldContext(): TaskModalMetadataFieldContext {
		return {
			app: this.app,
			plugin: this.plugin,
			translate: (key) => this.t(key),
			attachMobileKeyboardScrollGuard: (input) => {
				this.attachMobileKeyboardScrollGuard(input);
			},
		};
	}

	protected createProjectsField(container: HTMLElement): void {
		this.projectsList = createTaskModalProjectsField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
					this.addProject(file);
				});
				modal.open();
			},
			listElement: this.projectsList,
		});

		this.renderOrganizationLists();
	}

	protected createSubtasksField(container: HTMLElement): void {
		this.subtasksList = createTaskModalSubtasksField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				void this.openSubtaskSelector();
			},
			listElement: this.subtasksList,
		});

		this.renderOrganizationLists();
	}

	protected createAttachmentsField(container: HTMLElement): void {
		this.attachmentsField = new TaskModalAttachmentsField({
			container,
			label: fieldLabelForId("attachments"),
			translate: (key, params) => this.t(key, params),
			getEntries: () => this.attachmentEntries,
			setEntries: (entries) => {
				this.attachmentEntries = entries;
			},
			pickVaultFile: (onChoose) => {
				new AttachmentFileSuggestModal(
					this.app,
					this.plugin,
					onChoose,
					this.getCurrentTaskPath()
				).open();
			},
			openAttachment: (path) => {
				void this.app.workspace.openLinkText(path, "", "tab");
			},
			resolveExists: (path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
			onDuplicate: (name) => {
				new Notice(
					this.t(
						msg({
							message: '"{name}" is already attached',
							context: "modals.task.attachments.duplicateNotice",
						}),
						{ name }
					)
				);
			},
			onUnsupportedName: (name) => {
				new Notice(
					this.t(
						msg({
							message:
								'"{name}" can\'t be attached. Rename it so it has a file extension and no [ ] # or | characters.',
							context: "modals.task.attachments.unsupportedNameNotice",
						}),
						{ name }
					)
				);
			},
		});
	}

	/**
	 * Copy files picked from disk into the vault. Called only while saving so a
	 * discarded modal never writes attachment files.
	 */
	protected async importPendingAttachments(
		sourcePath: string
	): Promise<MaterializedTaskModalAttachments> {
		try {
			const imported = await materializeTaskModalAttachments(this.attachmentEntries, {
				sourcePath,
				getAvailablePath: (filename, source) =>
					this.app.fileManager.getAvailablePathForAttachment(filename, source),
				writeBinary: (path, data) => createVaultBinaryFile(this.app, path, data),
				trashFile: async (path) => {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (file instanceof TFile) await this.app.fileManager.trashFile(file);
				},
			});
			return {
				references: imported.references,
				rollback: async () => {
					await imported.rollback();
					this.attachmentsField?.render();
				},
			};
		} finally {
			this.attachmentsField?.render();
		}
	}

	private getOrganizationFieldContext(): TaskModalOrganizationFieldContext {
		return {
			translate: (key) => this.t(key),
		};
	}

	private getUserFieldContext(): TaskModalUserFieldContext {
		return {
			app: this.app,
			plugin: this.plugin,
			translate: (key, params) => this.t(key, params),
			attachMobileKeyboardScrollGuard: (input) => {
				this.attachMobileKeyboardScrollGuard(input);
			},
		};
	}

	protected createBlockedByField(container: HTMLElement): void {
		this.blockedByList = createTaskModalBlockedByField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				void this.openBlockedBySelector();
			},
			listElement: this.blockedByList,
		});

		this.renderDependencyLists();
	}

	protected createBlockingField(container: HTMLElement): void {
		this.blockingList = createTaskModalBlockingField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				void this.openBlockingSelector();
			},
			listElement: this.blockingList,
		});

		this.renderDependencyLists();
	}

	protected createUserFieldByConfig(
		container: HTMLElement,
		fieldConfig: ModalFieldConfigLike
	): void {
		const userField = this.plugin.settings.userFields?.find((f) => f.id === fieldConfig.id);
		if (!userField) return;

		createTaskModalConfiguredUserField(this.getUserFieldContext(), {
			container,
			field: userField,
			values: this.form.values.userFields,
			inputRefs: this.userFieldInputs,
			toggleRefs: this.userFieldToggles,
			onValueChange: (key, value) => {
				if (!this.isSyncingControls) this.form.editUserField(key, value);
			},
		});
	}

	protected updateUserFieldControls(): void {
		updateTaskModalUserFieldControls({
			fields: this.plugin.settings?.userFields || [],
			values: this.form.values.userFields,
			inputRefs: this.userFieldInputs,
			toggleRefs: this.userFieldToggles,
		});
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonBar = createTaskModalActionButtons(this.getActionButtonContext(), {
			container,
			leadingButtons: this.getLeadingButtons(),
			overflowActions: this.getOverflowActions(),
			saveLabel: this.mode === "create" ? this.getModalTitle() : undefined,
			onCreateMoreChange:
				this.mode === "create"
					? (checked) => {
							this.createMore = checked;
						}
					: undefined,
			createMore: this.createMore,
			onSave: () => {
				void this.submit({ createAnother: this.mode === "create" && this.createMore });
			},
			onCancel: () => {
				this.close();
			},
		});
		this.saveButton = buttonBar.querySelector("button.mod-cta");
	}

	protected getLeadingButtons(): TaskModalLeadingButton[] {
		return [];
	}

	protected getOverflowActions(): TaskModalOverflowAction[] {
		return [];
	}

	protected getActionButtonContext(): TaskModalActionButtonContext {
		return {
			translate: (key: MessageDescriptor) => this.t(key),
		};
	}

	protected expandModal(): void {
		if (this.isExpanded) return;

		this.isExpanded = true;
		this.containerEl.classList.add("expanded");
		setTaskModalDetailsCollapsed(
			{ detailsContainer: this.detailsContainer, splitRightColumn: this.splitRightColumn },
			false
		);
		// Measured while hidden, the title has no height.
		if (this.titleInput) resizeTaskModalTitleTextarea(this.titleInput);
	}

	private async showPropertyPicker(
		event: UIEvent,
		property: "status" | "priority" | "due" | "scheduled"
	): Promise<void> {
		const anchor = event.currentTarget as HTMLElement;
		this.propertyPicker?.close();
		const picker = await showTaskModalPropertyPicker(
			this.getActionMenuContext(),
			property,
			anchor
		);
		if (!this.isModalOpen) picker?.close();
		else this.propertyPicker = picker;
	}

	protected showDateContextMenu(event: UIEvent, type: "due" | "scheduled"): void {
		void this.showPropertyPicker(event, type);
	}

	protected showStatusContextMenu(event: UIEvent): void {
		void this.showPropertyPicker(event, "status");
	}

	protected showPriorityContextMenu(event: UIEvent): void {
		void this.showPropertyPicker(event, "priority");
	}

	protected showRecurrenceContextMenu(event: UIEvent): void {
		showTaskModalRecurrenceContextMenu(this.getActionMenuContext(), event);
	}

	protected showReminderContextMenu(event: UIEvent): void {
		showTaskModalReminderContextMenu(this.getActionMenuContext(), event);
	}

	protected getActionMenuState(): TaskModalActionMenuState {
		return createTaskModalActionMenuState({
			title: this.form.values.title,
			status: this.form.values.status,
			priority: this.form.values.priority,
			dueDate: this.form.values.dueDate,
			scheduledDate: this.form.values.scheduledDate,
			recurrenceRule: this.form.values.recurrenceRule,
			recurrenceAnchor: this.form.values.recurrenceAnchor,
			reminders: this.form.values.reminders,
		});
	}

	protected getActionMenuContext(): TaskModalActionMenuContext {
		return createTaskModalActionMenuContext({
			app: this.app,
			plugin: this.plugin,
			translate: (key, params) => this.t(key, params),
			getState: () => this.getActionMenuState(),
			setDueDate: (value) => {
				this.form.edit("dueDate", value);
			},
			setScheduledDate: (value) => {
				this.form.edit("scheduledDate", value);
			},
			setStatus: (value) => {
				this.form.edit("status", value);
			},
			setPriority: (value) => {
				this.form.edit("priority", value);
			},
			setRecurrenceRule: (value) => {
				this.form.edit("recurrenceRule", value);
			},
			setRecurrenceAnchor: (anchor) => {
				this.form.edit("recurrenceAnchor", anchor);
			},
			setReminders: (reminders) => {
				this.form.edit("reminders", reminders);
			},
			onChange: () => this.updateIconStates(),
		});
	}

	protected updateIconStates(): void {
		const actionMenuState = this.getActionMenuState();

		updateTaskModalActionIconStates(
			this.actionBar,
			{ translate: (key, params) => this.t(key, params) },
			buildTaskModalActionIconState(actionMenuState, {
				defaultStatus: this.plugin.settings.defaultTaskStatus,
				defaultPriority: this.plugin.settings.defaultTaskPriority,
				statusConfigs: this.plugin.settings.customStatuses || [],
				priorityConfigs: this.plugin.settings.customPriorities || [],
				timeFormat: this.plugin.settings.calendarViewSettings?.timeFormat,
			})
		);
	}

	/** Bring every control in line with the form. Runs after each form change. */
	protected syncFormControls(): void {
		const { values } = this.form;
		this.isSyncingControls = true;
		try {
			if (this.titleInput && this.titleInput.value !== values.title) {
				this.titleInput.value = values.title;
				resizeTaskModalTitleTextarea(this.titleInput);
			}
			if (this.detailsMarkdownEditor && this.detailsMarkdownEditor.value !== values.details) {
				setTaskModalDetailsEditorValue(this.detailsMarkdownEditor, values.details);
			}
			if (this.contextsInput && this.contextsInput.value !== values.contexts) {
				this.contextsInput.value = values.contexts;
			}
			if (this.tagsInput && this.tagsInput.value !== values.tags) {
				this.tagsInput.value = values.tags;
			}
			// The field may hold text being typed ("1h") or text that failed to parse.
			if (
				this.timeEstimateInput &&
				this.timeEstimateInput !== this.timeEstimateInput.ownerDocument.activeElement &&
				!this.form.getError("timeEstimate")
			) {
				this.timeEstimateInput.value = formatTaskModalTimeEstimate(values.timeEstimate);
			}
			this.updateUserFieldControls();
			this.updateIconStates();
			this.renderFieldError("title", this.getTitleErrorAnchor());
			this.renderFieldError("timeEstimate", this.getTimeEstimateErrorAnchor());
		} finally {
			this.isSyncingControls = false;
		}
	}

	protected getTitleErrorAnchor(): HTMLElement | null {
		return this.titleInput ?? null;
	}

	private getTimeEstimateErrorAnchor(): HTMLElement | null {
		return this.timeEstimateInput?.closest<HTMLElement>(".setting-item") ?? null;
	}

	private renderFieldError(field: TaskFormErrorField, anchor: HTMLElement | null): void {
		const message = this.form.getError(field);
		const existing = this.fieldErrorEls.get(field);
		if (!message || !anchor) {
			existing?.remove();
			this.fieldErrorEls.delete(field);
			return;
		}

		const errorEl =
			existing ??
			anchor.ownerDocument.win.createDiv({
				cls: "tn-task-modal__field-error",
				attr: { role: "alert" },
			});
		if (!existing) {
			anchor.insertAdjacentElement("afterend", errorEl);
			this.fieldErrorEls.set(field, errorEl);
		}
		errorEl.textContent = message;
	}

	protected focusTitleInput(): void {
		if (this.titleInput) this.focusGuards.focusTitleInput(this.titleInput);
	}

	protected getInitialFocusDelay(): number {
		return this.focusGuards.getInitialFocusDelay();
	}

	protected isMobileLikeEnvironment(): boolean {
		return this.focusGuards.isMobileLikeEnvironment();
	}

	private attachTitleFocusScrollGuard(input: TaskModalTitleInputElement): void {
		this.focusGuards.attachTitleFocusScrollGuard(input);
	}

	protected attachMobileKeyboardScrollGuard(
		input: HTMLElement,
		options?: TaskModalMobileKeyboardScrollGuardOptions
	): void {
		this.focusGuards.attachMobileKeyboardScrollGuard(input, options);
	}

	protected addProject(file: TAbstractFile): void {
		if (file instanceof TFile) {
			const projectItem = createTaskModalProjectItemFromFile(
				file,
				this.buildProjectReference(file, this.getCurrentTaskPath() || "")
			);

			if (hasTaskModalProjectItem(this.selectedProjectItems, projectItem)) {
				return;
			}

			this.selectedProjectItems.push(projectItem);
		}
		this.updateProjectsFromFiles();
		this.renderProjectsList();
	}

	protected removeProject(item: TaskModalProjectItem): void {
		this.selectedProjectItems = removeTaskModalProjectItem(this.selectedProjectItems, item);
		this.updateProjectsFromFiles();
		this.renderProjectsList();
	}

	protected updateProjectsFromFiles(): void {
		this.form.values.projects = getTaskModalProjectsValue(this.selectedProjectItems);
	}

	protected buildProjectReference(targetFile: TFile, sourcePath: string): string {
		return generateLink(
			this.app,
			targetFile,
			sourcePath,
			"",
			"",
			this.plugin.settings.useFrontmatterMarkdownLinks
		);
	}

	protected initializeProjectsFromStrings(projects: string[]): void {
		this.selectedProjectItems = [];
		this.addProjectsFromStrings(projects);
		// Don't render immediately - let the caller decide when to render
	}

	protected addProjectsFromStrings(projects: string[]): void {
		this.selectedProjectItems = addTaskModalProjectItemsFromStrings(
			this.selectedProjectItems,
			projects,
			this.getProjectStringContext()
		);
		this.updateProjectsFromFiles();
		// Don't render immediately - let the caller decide when to render
	}

	private getProjectStringContext(): TaskModalProjectStringContext {
		return {
			sourcePath: this.getCurrentTaskPath() || "",
			getMarkdownFiles: () => this.getMarkdownFiles(),
			resolveLink: (linkPath, sourcePath) => this.resolveLink(linkPath, sourcePath),
		};
	}

	protected renderProjectsList(): void {
		renderTaskModalProjectsList({
			app: this.app,
			listEl: this.projectsList,
			items: this.selectedProjectItems,
			sourcePath: this.getCurrentTaskPath() || "",
			translate: (key, params) => this.t(key, params),
			onRemove: (item) => this.removeProject(item),
		});
	}

	// Subtask management methods
	protected async openSubtaskSelector(): Promise<void> {
		const parentPath = this.getCurrentTaskPath();
		const parentFile = parentPath ? this.app.vault.getAbstractFileByPath(parentPath) : null;
		const parentTask = parentPath
			? await this.plugin.cacheManager.getTaskInfo(parentPath)
			: null;
		const creationDefaults =
			parentFile instanceof TFile && parentTask
				? buildSubtaskCreationPrePopulatedValues(this.plugin, parentTask, parentFile)
				: undefined;

		await openTaskModalTaskSelector({
			plugin: this.plugin,
			selectorOptions: creationDefaults ? { creationDefaults } : undefined,
			getCandidates: (allTasks) =>
				getTaskModalSubtaskCandidates(
					allTasks,
					this.selectedSubtaskFiles,
					this.getCurrentTaskPath()
				),
			onSelect: (subtask) => {
				const file = this.app.vault.getAbstractFileByPath(subtask.path);
				if (file) {
					this.addSubtask(file);
				}
			},
			translate: (key) => this.t(key),
			noEligibleTasksMessageKey: msg({
				message: "No eligible tasks available to assign as subtasks",
				context: "modals.task.organization.notices.noEligibleSubtasks",
			}),
			openFailedMessageKey: msg({
				message: "Failed to open subtask selector",
				context: "modals.task.organization.notices.subtaskSelectFailed",
			}),
			logOperation: "open-subtask-selector",
		});
	}

	protected addSubtask(file: TAbstractFile): void {
		const nextSubtaskFiles = addTaskModalSubtaskFile(this.selectedSubtaskFiles, file);
		if (nextSubtaskFiles.length === this.selectedSubtaskFiles.length) {
			return;
		}

		this.selectedSubtaskFiles = nextSubtaskFiles;
		void this.renderSubtasksList();
	}

	protected removeSubtask(file: TAbstractFile): void {
		this.selectedSubtaskFiles = removeTaskModalSubtaskFile(this.selectedSubtaskFiles, file);
		void this.renderSubtasksList();
	}

	protected async renderSubtasksList(): Promise<void> {
		await renderTaskModalSubtasksList({
			app: this.app,
			listEl: this.subtasksList,
			files: this.selectedSubtaskFiles,
			sourcePath: this.getCurrentTaskPath() || "",
			getCachedTaskInfo: (path) => this.plugin.cacheManager.getCachedTaskInfo(path),
			createTaskCard: (taskInfo) =>
				createTaskCard(taskInfo, this.plugin, undefined, {
					layout: "default",
					showSecondaryBadges: false,
					enableHoverPreview: false,
				}),
			translate: (key, params) => this.t(key, params),
			onRemove: (file) => this.removeSubtask(file),
		});
	}

	protected renderOrganizationLists(): void {
		this.renderProjectsList();
		void this.renderSubtasksList();
	}

	/** Shows problems on their fields. A field the modal hides reports through a notice. */
	protected validateForm(): boolean {
		const titleError = this.form.values.title.trim()
			? null
			: this.t(
					msg({
						message: "Please enter a task title",
						context: "modals.taskCreation.notices.titleRequired",
					})
				);
		this.form.setError("title", titleError);
		if (titleError && !this.getTitleErrorAnchor()) {
			new Notice(titleError);
		}
		if (this.form.getError("timeEstimate")) {
			this.expandModal();
		}
		return !this.form.hasErrors();
	}

	protected focusNextField(): boolean {
		// Try to focus the contexts input as the next field after details
		const nextField = this.contextsInput || this.tagsInput || this.timeEstimateInput;
		if (!nextField) {
			return false;
		}

		window.setTimeout(() => {
			nextField.focus();
		}, 50);
		return true;
	}

	protected focusPreviousField(): boolean {
		if (!this.titleInput) {
			return false;
		}

		window.setTimeout(() => {
			this.titleInput?.focus();
		}, 50);
		return true;
	}

	onClose(): void {
		this.propertyPicker?.close();
		this.propertyPicker = undefined;
		this.isModalOpen = false;
		this.unsubscribeForm?.();
		this.unsubscribeForm = null;

		// Clean up keyboard handler
		if (this.keyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.keyboardHandler, true);
			this.keyboardHandler = null;
		}
		this.focusGuards.destroy();

		destroyTaskModalDetailsEditor(this.detailsMarkdownEditor);
		this.detailsMarkdownEditor = null;
		super.onClose();
	}
}
