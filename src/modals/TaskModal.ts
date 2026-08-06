import { App, Modal, TAbstractFile, TFile } from "obsidian";

type Nullable<T> = T | null;

import TaskNotesPlugin from "../main";
import { shouldShowFieldForModal } from "./taskModalFieldConfig";
import type { ModalFieldConfigLike, ModalFieldsConfigLike } from "./taskModalFieldConfig";
import {
	renderTaskModalField,
	renderTaskModalFieldGroups,
	type TaskModalFieldRendererMap,
} from "./taskModalFieldRenderer";
import {
	createTaskModalDetailsEditor,
	destroyTaskModalDetailsEditor,
} from "./taskModalDetailsEditor";
import { splitFrontmatterAndBody } from "../utils/helpers";
import { formatDateTimeForDisplay } from "../utils/dateUtils";
import { ProjectSelectModal } from "./ProjectSelectModal";
import { TaskDependency, Reminder } from "../types";
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
import { countTaskModalCompletion } from "./taskModalOrgCounts";
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
	type TaskModalMetadataFieldContext,
} from "./taskModalMetadataFields";
import {
	createTaskModalConfiguredUserField,
	createTaskModalUserFieldsSection,
	updateTaskModalUserFieldControls,
	type TaskModalUserFieldContext,
	type TaskModalUserFieldToggleControl,
} from "./taskModalUserFieldControls";
import {
	createTaskModalActionButtons,
	type TaskModalActionButtonContext,
	type TaskModalLeadingIconButton,
} from "./taskModalActionButtons";
import {
	createTaskModalChip,
	createTaskModalChipRow,
	createTaskModalChips,
	type TaskModalChipSpec,
} from "./taskModalChipRow";
import { updateTaskModalActionIconStates } from "./taskModalActionIconStates";
import {
	buildTaskModalChipState,
	createTaskModalActionMenuContext,
	createTaskModalActionMenuState,
} from "./taskModalActionState";
import { getTaskModalRecurrenceDisplayText } from "./taskModalActionValues";
import {
	showTaskModalContextsInput,
	showTaskModalTagsInput,
	showTaskModalTimeEstimateInput,
	type TaskModalPropertyMenuContext,
} from "./taskModalPropertyMenus";
import {
	attachTaskModalDescriptionClamp,
	type TaskModalDescriptionClampController,
} from "./taskModalDescriptionClamp";
import {
	attachTaskModalSheetGestures,
	createTaskModalSheetHandle,
	type TaskModalSheetGestureController,
} from "./taskModalSheetGestures";
import {
	createTaskModalSidebarOrgSection,
	createTaskModalSidebarRow,
	updateTaskModalSidebarRow,
	type TaskModalSidebarRowSpec,
} from "./taskModalSidebar";
import {
	showTaskModalDateContextMenu,
	showTaskModalPriorityContextMenu,
	showTaskModalRecurrenceContextMenu,
	showTaskModalReminderContextMenu,
	showTaskModalStatusContextMenu,
	type TaskModalActionMenuContext,
	type TaskModalActionMenuState,
} from "./taskModalActionMenus";
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
import {
	createTaskModalTitleTextarea,
	type TaskModalTitleInputElement,
} from "./taskModalTitleInput";
import {
	collapseTaskModalDetailsLayout,
	expandTaskModalDetailsLayout,
	shouldUseEditSidebarLayout,
	shouldUseSplitLayoutEnabledClass,
} from "./taskModalLayout";
import {
	TaskModalFocusGuards,
	type TaskModalMobileKeyboardScrollGuardOptions,
} from "./taskModalFocusGuards";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TaskModal" });

/**
 * Field ids for the core task properties shared between the desktop edit
 * sidebar and the mobile grouped property sections. Excludes
 * projects/subtasks/blocked-by/blocking, which have their own dedicated
 * organization-field cards with completion counts.
 */
const PRIMARY_PROPERTY_FIELD_IDS = [
	"status",
	"priority",
	"due-date",
	"scheduled-date",
	"recurrence",
	"reminders",
	"contexts",
	"tags",
	"time-estimate",
] as const;

/** Full mobile sheet row order, matching the desktop edit sidebar. */
const MOBILE_SHEET_FIELD_ORDER = [
	"projects",
	"subtasks",
	...PRIMARY_PROPERTY_FIELD_IDS,
	"blocked-by",
	"blocking",
] as const;

const MOBILE_ORG_FIELD_IDS = new Set([
	"projects",
	"subtasks",
	"blocked-by",
	"blocking",
]);

export abstract class TaskModal extends Modal {
	plugin: TaskNotesPlugin;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private focusGuards: TaskModalFocusGuards;

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

	protected async openTaskNote(): Promise<void> {
		// Creation modals do not have an existing task note to open.
	}

	protected renderDependencyLists(): void {
		this.renderBlockedByList();
		this.renderBlockingList();
		this.refreshOrganizationHeaders();
		this.updateSidebarStates();
	}

	protected getLinkServices(): LinkServices {
		return {
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

	protected addBlockedByTask(file: TFile): void {
		const dependency: TaskDependency = {
			uid: formatDependencyLink(
				this.plugin.app,
				this.getDependencySourcePath(),
				file.path,
				this.plugin.settings.useFrontmatterMarkdownLinks
			),
			reltype: DEFAULT_DEPENDENCY_RELTYPE,
		};
		this.addBlockedByDependency(dependency);
	}

	protected addBlockingTask(file: TFile): void {
		this.addBlockingTaskFromPath(file.path);
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
			noEligibleTasksMessageKey: "contextMenus.task.dependencies.notices.noEligibleTasks",
			openFailedMessageKey: "contextMenus.task.dependencies.notices.updateFailed",
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
			noEligibleTasksMessageKey: "contextMenus.task.dependencies.notices.noEligibleTasks",
			openFailedMessageKey: "contextMenus.task.dependencies.notices.updateFailed",
			logOperation: "open-blocking-selector",
		});
	}

	// Core task properties
	protected title = "";
	protected details = "";
	protected originalDetails = "";
	protected dueDate = "";
	protected scheduledDate = "";
	protected priority = "normal";
	protected status = "open";
	protected contexts = "";
	protected projects = "";
	protected tags = "";
	protected timeEstimate = 0;
	protected recurrenceRule = "";
	protected recurrenceAnchor: "scheduled" | "completion" = "scheduled";
	protected reminders: Reminder[] = [];

	// User-defined fields (dynamic based on settings)
	protected userFields: Record<string, unknown> = {};
	protected userFieldInputs = new Map<string, HTMLInputElement>();
	protected userFieldToggles = new Map<string, TaskModalUserFieldToggleControl>();

	// Dependency fields
	protected blockedByItems: DependencyItem[] = [];
	protected blockingItems: DependencyItem[] = [];
	protected blockedByList: HTMLElement | undefined = undefined;
	protected blockingList: HTMLElement | undefined = undefined;

	// Project link storage
	protected selectedProjectItems: TaskModalProjectItem[] = [];

	// Subtask storage - tracks tasks that should become subtasks of this task
	protected selectedSubtaskFiles: TAbstractFile[] = [];
	protected initialSubtaskFiles: TAbstractFile[] = [];

	// UI elements
	protected titleInput: TaskModalTitleInputElement =
		undefined as unknown as TaskModalTitleInputElement;
	protected detailsInput: HTMLTextAreaElement =
		undefined as unknown as HTMLTextAreaElement; // Legacy - kept for compatibility
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
	protected sidebarEl: HTMLElement | undefined = undefined;
	protected sheetGestureController: TaskModalSheetGestureController | undefined = undefined;
	protected descriptionClampController: TaskModalDescriptionClampController | undefined = undefined;
	private organizationHeaderUpdaters: Array<() => void> = [];

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app);
		this.plugin = plugin;
		this.focusGuards = new TaskModalFocusGuards({
			containerEl: this.containerEl,
			modalEl: this.modalEl,
			contentEl: this.contentEl,
		});
	}

	/**
	 * Get the Obsidian app instance - useful for dependency injection in tests
	 */
	protected getApp(): App {
		return this.app;
	}

	/**
	 * Get the plugin instance - useful for dependency injection in tests
	 */
	protected getPlugin(): TaskNotesPlugin {
		return this.plugin;
	}

	protected t(key: string, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
	}

	/**
	 * Get a file by path - useful for testing with mocked vault
	 */
	protected getFileByPath(path: string): unknown {
		return this.app.vault.getAbstractFileByPath(path);
	}

	/**
	 * Get all markdown files - useful for testing with mocked vault
	 */
	protected getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	/**
	 * Get file cache - useful for testing with mocked metadataCache
	 */
	protected getFileCache(file: TFile): unknown {
		return this.app.metadataCache.getFileCache(file);
	}

	/**
	 * Resolve a link to a file - useful for testing with mocked metadataCache
	 */
	protected resolveLink(linkPath: string, sourcePath: string): unknown {
		return this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
	}

	protected isEditMode(): boolean {
		return false;
	}

	protected isCreationMode(): boolean {
		return false;
	}

	abstract initializeFormData(): Promise<void>;
	abstract handleSave(): Promise<void>;
	abstract getModalTitle(): string;

	protected async handleSubmitShortcut(_shift: boolean): Promise<void> {
		await this.handleSave();
	}

	onOpen() {
		this.containerEl.addClass("tasknotes-plugin", "minimalist-task-modal");
		if (this.usesSheetLayout()) {
			this.containerEl.addClass("tn-task-modal--sheet");
			// Keep the sheet off-screen until its content has loaded and the
			// gesture controller has measured the real partial-snap offset.
			// Removed once `attachTaskModalSheetGestures` applies that offset,
			// so the sheet slides straight to its resting position instead of
			// flashing fully expanded first.
			this.modalEl.addClass("tn-task-modal__sheet--pending");
		}
		this.modalEl.addClass("mod-tasknotes");

		// Set the modal title using the standard Obsidian approach (preserves close button)
		this.titleEl.setText(this.getModalTitle());

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				// Skip if event comes from a markdown editor (which has its own handler)
				const target = e.target as HTMLElement;
				if (target.closest(".cm-editor")) {
					return;
				}
				e.preventDefault();
				void this.handleSubmitShortcut(e.shiftKey);
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		void this.initializeFormData().then(() => {
			this.applyModalLayoutClasses();
			this.createModalContent();
			this.setupSheetGestures();
			this.focusTitleInput();
		});
	}

	protected applyModalLayoutClasses(): void {
		const usesEditSidebar = this.usesEditSidebarLayout();
		this.containerEl.toggleClass(
			"split-layout-enabled",
			shouldUseSplitLayoutEnabledClass({
				enableModalSplitLayout: this.plugin.settings.enableModalSplitLayout,
				usesEditSidebarLayout: usesEditSidebar,
				usesSheetLayout: this.usesSheetLayout(),
			})
		);
		this.containerEl.toggleClass("tn-task-modal--edit-desktop", usesEditSidebar);
		this.containerEl.toggleClass("expanded", this.isExpanded);
	}

	protected usesSheetLayout(): boolean {
		return this.isMobileLikeEnvironment();
	}

	protected usesEditSidebarLayout(): boolean {
		return shouldUseEditSidebarLayout({
			isEditMode: this.isEditMode(),
			isCreationMode: this.isCreationMode(),
			isExpanded: this.isExpanded,
			isMobileLikeEnvironment: this.isMobileLikeEnvironment(),
		});
	}

	protected usesChipRow(): boolean {
		return !this.usesEditSidebarLayout() && !this.usesSheetLayout();
	}

	protected usesGroupedPropertyList(): boolean {
		return this.usesSheetLayout();
	}

	protected setupSheetGestures(): void {
		if (!this.usesSheetLayout()) return;

		this.sheetGestureController = attachTaskModalSheetGestures({
			containerEl: this.containerEl,
			modalEl: this.modalEl,
			onDismiss: () => {
				this.close();
			},
			onSnapChange: (snap) => {
				if (snap === "full") {
					this.containerEl.removeClass("tn-task-modal--sheet-partial");
				} else {
					this.containerEl.addClass("tn-task-modal--sheet-partial");
				}
			},
		});
	}

	// Store references to split layout containers for potential reuse
	protected splitContentWrapper: HTMLElement;
	protected splitLeftColumn: HTMLElement;
	protected splitRightColumn: HTMLElement = undefined as unknown as HTMLElement;

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.organizationHeaderUpdaters = [];

		if (this.usesSheetLayout()) {
			createTaskModalSheetHandle(contentEl);
		}

		const container = contentEl.createDiv("minimalist-modal-container");

		if (this.usesEditSidebarLayout()) {
			this.createEditDesktopLayout(container);
			this.createActionButtons(container);
			return;
		}

		this.splitContentWrapper = container.createDiv("modal-split-content");
		this.splitLeftColumn = this.splitContentWrapper.createDiv("modal-split-left");
		this.splitRightColumn = this.splitLeftColumn.createDiv("modal-split-right");

		this.createPrimaryInput(this.splitLeftColumn);
		this.createDetailsSection(container);

		if (this.usesChipRow()) {
			this.createActionBar(this.splitLeftColumn);
		} else if (this.usesGroupedPropertyList()) {
			this.createMobileSheetSections(this.splitLeftColumn);
		}

		this.createAdditionalSections(this.splitLeftColumn);
		this.createActionButtons(container);
	}

	protected createEditDesktopLayout(container: HTMLElement): void {
		const panes = container.createDiv("tn-task-modal__edit-panes");
		const mainColumn = panes.createDiv("tn-task-modal__edit-main");
		const sidebarColumn = panes.createDiv("tn-task-modal__edit-sidebar-wrap");

		if (this.shouldShowField("title", this.plugin.settings.modalFieldsConfig)) {
			const titleContainer = mainColumn.createDiv("title-input-container");
			this.titleInput = this.createTitleTextarea(
				titleContainer,
				"title-input",
				this.t("modals.task.titlePlaceholder")
			);
		}

		this.splitContentWrapper = mainColumn.createDiv("modal-split-content");
		this.splitLeftColumn = this.splitContentWrapper.createDiv("modal-split-left");
		this.splitRightColumn = this.splitLeftColumn.createDiv("modal-split-right");

		this.createDetailsSection(container, { mainColumn, sidebarColumn });
		this.createAdditionalSections(this.splitLeftColumn);
	}

	protected createEditSidebar(
		sidebarColumn: HTMLElement,
		config: ModalFieldsConfigLike | undefined
	): void {
		const sidebar = sidebarColumn.createDiv("tn-task-modal__sidebar");
		this.sidebarEl = sidebar;

		const addOrgSection = (
			fieldId: string,
			row: TaskModalSidebarRowSpec,
			assignList: (listEl: HTMLElement) => void
		): void => {
			if (!this.shouldShowField(fieldId, config)) {
				return;
			}

			const { listElement } = createTaskModalSidebarOrgSection(sidebar, row);
			assignList(listElement);
		};

		addOrgSection(
			"projects",
			{
				id: "projects",
				iconName: "folder",
				label: this.t("modals.task.organization.projects"),
				value: this.getSidebarProjectsValue(),
				hasValue: this.selectedProjectItems.length > 0,
				onClick: () => {
					const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
						this.addProject(file);
					});
					modal.open();
				},
			},
			(listEl) => {
				this.projectsList = listEl;
				this.renderProjectsList();
			}
		);
		addOrgSection(
			"subtasks",
			{
				id: "subtasks",
				iconName: "list-tree",
				label: this.t("modals.task.organization.subtasks"),
				value: this.getSidebarSubtasksValue(),
				hasValue: this.selectedSubtaskFiles.length > 0,
				onClick: () => {
					void this.openSubtaskSelector();
				},
			},
			(listEl) => {
				this.subtasksList = listEl;
				void this.renderSubtasksList();
			}
		);

		for (const row of this.buildPropertyRows(PRIMARY_PROPERTY_FIELD_IDS, config)) {
			createTaskModalSidebarRow(sidebar, row);
		}

		addOrgSection(
			"blocked-by",
			{
				id: "blocked-by",
				iconName: "git-pull-request",
				label: this.t("modals.task.dependencies.blockedBy"),
				value: this.getSidebarDependencyValue(this.blockedByItems),
				hasValue: this.blockedByItems.length > 0,
				onClick: () => {
					void this.openBlockedBySelector();
				},
			},
			(listEl) => {
				this.blockedByList = listEl;
				this.renderDependencyLists();
			}
		);
		addOrgSection(
			"blocking",
			{
				id: "blocking",
				iconName: "git-branch",
				label: this.t("modals.task.dependencies.blocking"),
				value: this.getSidebarDependencyValue(this.blockingItems),
				hasValue: this.blockingItems.length > 0,
				onClick: () => {
					void this.openBlockingSelector();
				},
			},
			(listEl) => {
				this.blockingList = listEl;
				this.renderDependencyLists();
			}
		);

		this.createSidebarUserFields(sidebarColumn, config);
	}

	protected createSidebarUserFields(
		sidebarColumn: HTMLElement,
		config: ModalFieldsConfigLike | undefined
	): void {
		const userFields = (config?.fields || []).filter(
			(field) =>
				field.fieldType === "user" &&
				field.enabled &&
				(this.isCreationMode() ? field.visibleInCreation : field.visibleInEdit)
		);

		if (!userFields.length) return;

		const container = sidebarColumn.createDiv("tn-task-modal__sidebar-user-fields");
		for (const fieldConfig of userFields) {
			this.createUserFieldByConfig(container, fieldConfig);
		}
	}

	/**
	 * Renders the mobile bottom sheet sidebar rows in a single grouped card,
	 * matching the desktop edit sidebar order.
	 */
	protected createMobileSheetSections(container: HTMLElement): void {
		const config = this.plugin.settings.modalFieldsConfig;
		const wrapper = container.createDiv("tn-task-modal__mobile-sections");
		const card = wrapper.createDiv("tn-task-modal__mobile-group");

		const createOrgFieldById: Record<string, (target: HTMLElement) => void> = {
			projects: (target) => this.createProjectsField(target),
			subtasks: (target) => this.createSubtasksField(target),
			"blocked-by": (target) => this.createBlockedByField(target),
			blocking: (target) => this.createBlockingField(target),
		};

		let hasRows = false;
		const appendDivider = (): void => {
			if (hasRows) {
				card.createDiv("tn-task-modal__sidebar-row-divider");
			}
		};

		for (const fieldId of MOBILE_SHEET_FIELD_ORDER) {
			if (!this.shouldShowField(fieldId, config)) {
				continue;
			}

			if (MOBILE_ORG_FIELD_IDS.has(fieldId)) {
				appendDivider();
				createOrgFieldById[fieldId]?.(card);
				hasRows = true;
				continue;
			}

			const row = this.buildPropertyRowSpec(fieldId);
			if (!row) {
				continue;
			}

			appendDivider();
			createTaskModalSidebarRow(card, row);
			hasRows = true;
		}

		if (!hasRows) {
			wrapper.remove();
			return;
		}

		this.sidebarEl = wrapper;
	}

	protected buildPropertyRows(
		fieldIds: readonly string[],
		config: ModalFieldsConfigLike | undefined
	): TaskModalSidebarRowSpec[] {
		const rows: TaskModalSidebarRowSpec[] = [];
		for (const fieldId of fieldIds) {
			if (!this.shouldShowField(fieldId, config)) continue;
			const row = this.buildPropertyRowSpec(fieldId);
			if (row) {
				rows.push(row);
			}
		}
		return rows;
	}

	protected buildPropertyRowSpec(fieldId: string): TaskModalSidebarRowSpec | null {
		switch (fieldId) {
			case "status":
				return {
					id: "status",
					iconName: "dot-square",
					label: this.t("modals.task.actions.status"),
					value: this.getSidebarStatusValue(),
					hasValue: true,
					onClick: (event) => this.showStatusContextMenu(event),
				};
			case "priority":
				return {
					id: "priority",
					iconName: "star",
					label: this.t("modals.task.actions.priority"),
					value: this.getSidebarPriorityValue(),
					hasValue: true,
					onClick: (event) => this.showPriorityContextMenu(event),
				};
			case "due-date":
				return {
					id: "due-date",
					iconName: "target",
					label: this.t("modals.task.actions.due"),
					value: this.getSidebarDateValue(this.dueDate),
					hasValue: Boolean(this.dueDate),
					onClick: () => this.showDateContextMenu({} as UIEvent, "due"),
				};
			case "scheduled-date":
				return {
					id: "scheduled-date",
					iconName: "calendar-clock",
					label: this.t("modals.task.scheduledRow.label"),
					value: this.getSidebarDateValue(this.scheduledDate),
					hasValue: Boolean(this.scheduledDate),
					onClick: () => this.showDateContextMenu({} as UIEvent, "scheduled"),
				};
			case "recurrence":
				return {
					id: "recurrence",
					iconName: "refresh-ccw",
					label: this.t("modals.task.actions.recurrence"),
					// No placeholder here: repeating the row's own label as its
					// value (e.g. "Set recurrence" / "Set recurrence") was
					// redundant, so leave the subtitle blank until a rule is set.
					value: this.recurrenceRule
						? getTaskModalRecurrenceDisplayText(this.recurrenceRule)
						: "",
					hasValue: Boolean(this.recurrenceRule.trim()),
					onClick: (event) => this.showRecurrenceContextMenu(event),
				};
			case "reminders":
				return {
					id: "reminders",
					iconName: "bell",
					label: this.t("modals.task.actions.reminders"),
					value: this.reminders.length > 0 ? String(this.reminders.length) : "",
					hasValue: this.reminders.length > 0,
					onClick: (event) => this.showReminderContextMenu(event),
				};
			case "contexts":
				return {
					id: "contexts",
					iconName: "at-sign",
					label: this.t("modals.task.contextsLabel"),
					value: this.contexts,
					hasValue: Boolean(this.contexts.trim()),
					onClick: () => {
						void this.showContextsInput();
					},
				};
			case "tags":
				return {
					id: "tags",
					iconName: "tags",
					label: this.t("modals.task.tagsLabel"),
					value: this.tags,
					hasValue: Boolean(this.tags.trim()),
					onClick: () => {
						void this.showTagsInput();
					},
				};
			case "time-estimate":
				return {
					id: "time-estimate",
					iconName: "clock",
					label: this.t("modals.task.chips.timeEstimate"),
					value:
						this.timeEstimate > 0
							? this.t("modals.task.chips.timeEstimateValue", {
									minutes: this.timeEstimate,
								})
							: "",
					hasValue: this.timeEstimate > 0,
					onClick: () => {
						void this.showTimeEstimateInput();
					},
				};
			default:
				return null;
		}
	}

	private getSidebarProjectsValue(): string {
		if (!this.selectedProjectItems.length) {
			return "";
		}
		return this.selectedProjectItems.map((item) => item.name).join(", ");
	}

	private getSidebarSubtasksValue(): string {
		if (!this.selectedSubtaskFiles.length) {
			return "";
		}
		return this.selectedSubtaskFiles
			.map((file) => this.getSidebarSubtaskDisplayName(file))
			.join(", ");
	}

	private getSidebarSubtaskDisplayName(file: TAbstractFile): string {
		const taskInfo = this.plugin.cacheManager.getCachedTaskInfoSync(file.path);
		if (taskInfo?.title) {
			return taskInfo.title;
		}
		if (file instanceof TFile) {
			return file.basename;
		}
		return file.name;
	}

	private getSidebarStatusValue(): string {
		const config = this.plugin.settings.customStatuses?.find((s) => s.value === this.status);
		return config?.label || this.status;
	}

	private getSidebarPriorityValue(): string {
		const config = this.plugin.settings.customPriorities?.find((p) => p.value === this.priority);
		return config?.label || this.priority;
	}

	private getSidebarDateValue(value: string): string {
		if (!value) return "";
		return formatDateTimeForDisplay(value, {
			showTime: value.includes("T") || value.includes(":"),
		});
	}

	private getSidebarDependencyValue(items: DependencyItem[]): string {
		if (!items.length) return "";
		const count = countTaskModalCompletion(
			this.plugin,
			items.map((item) => item.path)
		);
		return `${count.completed}/${count.total}`;
	}

	protected updateSidebarStates(): void {
		if (!this.sidebarEl) return;

		updateTaskModalSidebarRow(
			this.sidebarEl,
			"projects",
			this.getSidebarProjectsValue(),
			this.selectedProjectItems.length > 0
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"subtasks",
			this.getSidebarSubtasksValue(),
			this.selectedSubtaskFiles.length > 0
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"status",
			this.getSidebarStatusValue(),
			true
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"priority",
			this.getSidebarPriorityValue(),
			true
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"due-date",
			this.getSidebarDateValue(this.dueDate),
			Boolean(this.dueDate)
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"scheduled-date",
			this.getSidebarDateValue(this.scheduledDate),
			Boolean(this.scheduledDate)
		);
		updateTaskModalSidebarRow(this.sidebarEl, "contexts", this.contexts, Boolean(this.contexts.trim()));
		updateTaskModalSidebarRow(this.sidebarEl, "tags", this.tags, Boolean(this.tags.trim()));
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"time-estimate",
			this.timeEstimate > 0
				? this.t("modals.task.chips.timeEstimateValue", { minutes: this.timeEstimate })
				: "",
			this.timeEstimate > 0
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"recurrence",
			this.recurrenceRule ? getTaskModalRecurrenceDisplayText(this.recurrenceRule) : "",
			Boolean(this.recurrenceRule.trim())
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"reminders",
			this.reminders.length > 0 ? String(this.reminders.length) : "",
			this.reminders.length > 0
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"blocked-by",
			this.getSidebarDependencyValue(this.blockedByItems),
			this.blockedByItems.length > 0
		);
		updateTaskModalSidebarRow(
			this.sidebarEl,
			"blocking",
			this.getSidebarDependencyValue(this.blockingItems),
			this.blockingItems.length > 0
		);
	}

	/**
	 * Creates the primary input area. Override in subclasses for different behavior.
	 * Default: simple title input
	 */
	protected createPrimaryInput(container: HTMLElement): void {
		this.createTitleInput(container);
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
			this.t("modals.task.titlePlaceholder")
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
			value: this.title,
			onChange: (value) => {
				this.title = value;
			},
			attachFocusScrollGuard: (input) => {
				this.attachTitleFocusScrollGuard(input);
				this.attachMobileKeyboardScrollGuard(input, { scrollOnFocus: false });
			},
		});
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = createTaskModalChipRow(container);
		this.createCoreChips(this.actionBar);
		this.updateIconStates();
	}

	protected createCoreChips(container: HTMLElement): HTMLElement[] {
		return createTaskModalChips(container, this.getCoreChipSpecs());
	}

	protected createActionChip(
		container: HTMLElement,
		iconName: string,
		label: string,
		onClick: (icon: HTMLElement, event: UIEvent) => void,
		dataType?: string
	): HTMLElement {
		return createTaskModalChip(container, {
			iconName,
			label,
			onClick,
			dataType: dataType || iconName,
		});
	}

	protected getCoreChipSpecs(): TaskModalChipSpec[] {
		const config = this.plugin.settings.modalFieldsConfig;
		const specs: TaskModalChipSpec[] = [];

		const maybeAdd = (fieldId: string, spec: TaskModalChipSpec): void => {
			if (this.shouldShowField(fieldId, config)) {
				specs.push(spec);
			}
		};

		maybeAdd("status", {
			iconName: "dot-square",
			label: this.t("modals.task.actions.status"),
			onClick: (_, event) => this.showStatusContextMenu(event),
			dataType: "status",
		});
		maybeAdd("priority", {
			iconName: "star",
			label: this.t("modals.task.actions.priority"),
			onClick: (_, event) => this.showPriorityContextMenu(event),
			dataType: "priority",
		});
		maybeAdd("due-date", {
			iconName: "target",
			label: this.t("modals.task.actions.due"),
			onClick: (_, event) => this.showDateContextMenu(event, "due"),
			dataType: "due-date",
		});
		maybeAdd("scheduled-date", {
			iconName: "calendar-clock",
			label: this.t("modals.task.actions.scheduled"),
			onClick: (_, event) => this.showDateContextMenu(event, "scheduled"),
			dataType: "scheduled-date",
		});
		maybeAdd("recurrence", {
			iconName: "refresh-ccw",
			label: this.t("modals.task.actions.recurrence"),
			onClick: (_, event) => this.showRecurrenceContextMenu(event),
			dataType: "recurrence",
		});
		maybeAdd("reminders", {
			iconName: "bell",
			label: this.t("modals.task.actions.reminders"),
			onClick: (_, event) => this.showReminderContextMenu(event),
			dataType: "reminders",
		});
		maybeAdd("contexts", {
			iconName: "at-sign",
			label: this.t("modals.task.contextsLabel"),
			onClick: () => {
				void this.showContextsInput();
			},
			dataType: "contexts",
		});
		maybeAdd("tags", {
			iconName: "tags",
			label: this.t("modals.task.tagsLabel"),
			onClick: () => {
				void this.showTagsInput();
			},
			dataType: "tags",
		});
		maybeAdd("time-estimate", {
			iconName: "clock",
			label: this.t("modals.task.chips.timeEstimate"),
			onClick: () => {
				void this.showTimeEstimateInput();
			},
			dataType: "time-estimate",
		});

		return specs;
	}

	protected async showContextsInput(): Promise<void> {
		await showTaskModalContextsInput(this.getPropertyMenuContext());
	}

	protected async showTagsInput(): Promise<void> {
		await showTaskModalTagsInput(this.getPropertyMenuContext());
	}

	protected async showTimeEstimateInput(): Promise<void> {
		await showTaskModalTimeEstimateInput(this.getPropertyMenuContext());
	}

	protected getPropertyMenuContext(): TaskModalPropertyMenuContext {
		return {
			plugin: this.plugin,
			translate: (key, params) => this.t(key, params),
			getContexts: () => this.contexts,
			setContexts: (value) => {
				this.contexts = value;
			},
			getTags: () => this.tags,
			setTags: (value) => {
				this.tags = value;
			},
			getTimeEstimate: () => this.timeEstimate,
			setTimeEstimate: (value) => {
				this.timeEstimate = value;
			},
			onChange: () => this.updateIconStates(),
		};
	}

	protected createDetailsSection(
		container: HTMLElement,
		layout?: { mainColumn: HTMLElement; sidebarColumn: HTMLElement }
	): void {
		this.userFieldInputs.clear();
		this.userFieldToggles.clear();

		const parentForDetails = layout?.mainColumn ?? this.splitLeftColumn ?? container;
		this.detailsContainer = parentForDetails.createDiv("details-container");

		if (!this.isExpanded) {
			collapseTaskModalDetailsLayout({
				detailsContainer: this.detailsContainer,
				splitRightColumn: this.splitRightColumn,
			});
		}

		const config = this.plugin.settings.modalFieldsConfig;
		const shouldShowTitle = this.shouldShowField("title", config);
		const shouldShowDetails = this.shouldShowField("details", config);
		this.splitContentWrapper?.classList.toggle(
			"modal-split-content--right-empty",
			!shouldShowDetails
		);

		const isEditModal = this.isEditMode();

		const rightColumn = this.splitRightColumn || this.detailsContainer;

		// Only render the multi-line title field when no title input has been
		// created yet (e.g. the desktop edit sidebar already renders the
		// primary title at the top of the main column). Placing it directly
		// in the same column as the description keeps title and description
		// adjacent regardless of layout. Creation modals with natural-language
		// input already capture the title on the left, so skip the duplicate.
		if (shouldShowTitle && isEditModal && !this.titleInput) {
			this.titleInput = this.createTitleTextarea(
				rightColumn,
				"title-input-detailed",
				this.t("modals.task.titleDetailedPlaceholder")
			);
		}

		if (shouldShowDetails) {
			this.detailsMarkdownEditor = createTaskModalDetailsEditor({
				app: this.app,
				parent: rightColumn,
				value: this.details,
				placeholder: this.t("modals.task.detailsPlaceholder"),
				file: this.getModalEditorFile(),
				tabMovesFocus: this.plugin.settings.taskModalTabMovesFocus,
				onChange: (value) => {
					this.details = value;
				},
				onSubmit: (shift) => {
					void this.handleSubmitShortcut(shift);
				},
				onEscape: () => {
					this.close();
				},
				focusNextField: () => this.focusNextField(),
				focusPreviousField: () => this.focusPreviousField(),
			});

			if (this.usesSheetLayout()) {
				this.descriptionClampController?.destroy();
				this.descriptionClampController = attachTaskModalDescriptionClamp({
					editorContainer: rightColumn,
					translate: (key) => this.t(key),
				});
			}
		}

		if (this.usesEditSidebarLayout() && layout) {
			this.createEditSidebar(layout.sidebarColumn, config);
		}

		this.createAdditionalFields(this.detailsContainer);
	}

	/**
	 * Check if a field should be shown based on field configuration
	 */
	protected shouldShowField(fieldId: string, config?: ModalFieldsConfigLike): boolean {
		return shouldShowFieldForModal(fieldId, config, this.isCreationMode());
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
			isCreationMode: this.isCreationMode(),
			fieldRenderers: this.getFieldRenderers(),
			renderUserField: (fieldContainer, fieldConfig) => {
				this.createUserFieldByConfig(fieldContainer, fieldConfig);
			},
		});
	}

	protected createField(container: HTMLElement, fieldConfig: ModalFieldConfigLike): void {
		renderTaskModalField({
			container,
			fieldConfig,
			fieldRenderers: this.getFieldRenderers(),
			renderUserField: (fieldContainer, userFieldConfig) => {
				this.createUserFieldByConfig(fieldContainer, userFieldConfig);
			},
		});
	}

	private getFieldRenderers(): TaskModalFieldRendererMap {
		const wrapRenderer = (
			fieldId: string,
			render: (container: HTMLElement) => void
		): ((container: HTMLElement) => void) => {
			return (container: HTMLElement) => {
				if (!this.shouldRenderFieldInDetails(fieldId)) return;
				render(container);
			};
		};

		return {
			contexts: wrapRenderer("contexts", (container) => this.createContextsField(container)),
			tags: wrapRenderer("tags", (container) => this.createTagsField(container)),
			"time-estimate": wrapRenderer("time-estimate", (container) =>
				this.createTimeEstimateField(container)
			),
			projects: wrapRenderer("projects", (container) => this.createProjectsField(container)),
			subtasks: wrapRenderer("subtasks", (container) => this.createSubtasksField(container)),
			"blocked-by": wrapRenderer("blocked-by", (container) =>
				this.createBlockedByField(container)
			),
			blocking: wrapRenderer("blocking", (container) => this.createBlockingField(container)),
		};
	}

	protected shouldRenderFieldInDetails(fieldId: string): boolean {
		if (
			(this.usesChipRow() || this.usesGroupedPropertyList() || this.usesEditSidebarLayout()) &&
			["contexts", "tags", "time-estimate"].includes(fieldId)
		) {
			return false;
		}

		if (this.usesEditSidebarLayout()) {
			return !["projects", "subtasks", "blocked-by", "blocking"].includes(fieldId);
		}

		if (this.usesGroupedPropertyList()) {
			return !["projects", "subtasks", "blocked-by", "blocking"].includes(fieldId);
		}

		return true;
	}

	protected refreshOrganizationHeaders(): void {
		for (const update of this.organizationHeaderUpdaters) {
			update();
		}
	}

	protected createContextsField(container: HTMLElement): void {
		this.contextsInput = createTaskModalContextsField(this.getMetadataFieldContext(), {
			container,
			value: this.contexts,
			onChange: (value) => {
				this.contexts = value;
			},
		});
	}

	protected createTagsField(container: HTMLElement): void {
		this.tagsInput = createTaskModalTagsField(this.getMetadataFieldContext(), {
			container,
			value: this.tags,
			onChange: (value) => {
				this.tags = value;
			},
		});
	}

	protected createTimeEstimateField(container: HTMLElement): void {
		this.timeEstimateInput = createTaskModalTimeEstimateField(this.getMetadataFieldContext(), {
			container,
			value: this.timeEstimate,
			onChange: (value) => {
				this.timeEstimate = value;
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
		const row = createTaskModalProjectsField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
					this.addProject(file);
				});
				modal.open();
			},
			listElement: this.projectsList,
			getItemCount: () => this.selectedProjectItems.length,
			onHeaderUpdate: (update) => {
				this.organizationHeaderUpdaters.push(update);
			},
		});
		this.projectsList = row.listElement;

		this.renderOrganizationLists();
	}

	protected createSubtasksField(container: HTMLElement): void {
		const row = createTaskModalSubtasksField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				void this.openSubtaskSelector();
			},
			listElement: this.subtasksList,
			getItemCount: () => this.selectedSubtaskFiles.length,
			onHeaderUpdate: (update) => {
				this.organizationHeaderUpdaters.push(update);
			},
		});
		this.subtasksList = row.listElement;

		this.renderOrganizationLists();
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
		const row = createTaskModalBlockedByField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				void this.openBlockedBySelector();
			},
			listElement: this.blockedByList,
			getItemCount: () => this.blockedByItems.length,
			onHeaderUpdate: (update) => {
				this.organizationHeaderUpdaters.push(update);
			},
		});
		this.blockedByList = row.listElement;

		this.renderDependencyLists();
	}

	protected createBlockingField(container: HTMLElement): void {
		const row = createTaskModalBlockingField(this.getOrganizationFieldContext(), {
			container,
			onButtonClick: () => {
				void this.openBlockingSelector();
			},
			listElement: this.blockingList,
			getItemCount: () => this.blockingItems.length,
			onHeaderUpdate: (update) => {
				this.organizationHeaderUpdaters.push(update);
			},
		});
		this.blockingList = row.listElement;

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
			values: this.userFields,
			inputRefs: this.userFieldInputs,
			toggleRefs: this.userFieldToggles,
			onValueChange: (key, value) => {
				this.userFields[key] = value;
			},
		});
	}

	protected updateUserFieldControls(): void {
		updateTaskModalUserFieldControls({
			fields: this.plugin.settings?.userFields || [],
			values: this.userFields,
			inputRefs: this.userFieldInputs,
			toggleRefs: this.userFieldToggles,
		});
	}

	protected createUserFields(container: HTMLElement): void {
		createTaskModalUserFieldsSection(this.getUserFieldContext(), {
			container,
			fields: this.plugin.settings?.userFields || [],
			values: this.userFields,
			inputRefs: this.userFieldInputs,
			toggleRefs: this.userFieldToggles,
			onValueChange: (key, value) => {
				this.userFields[key] = value;
			},
		});
	}

	protected getLeadingActionButtons(): TaskModalLeadingIconButton[] {
		if (!this.isEditMode()) {
			return [];
		}

		return [
			{
				className: "tn-task-modal__open-note-button",
				iconName: "external-link",
				label: this.t("modals.task.buttons.openNote"),
				onClick: () => {
					void this.openTaskNote();
				},
			},
		];
	}

	protected createActionButtons(container: HTMLElement): void {
		createTaskModalActionButtons(this.getActionButtonContext(), {
			container,
			leadingButtons: this.getLeadingActionButtons(),
			onSave: () => this.handleSave(),
			onSaved: () => {
				this.close();
			},
			onCancel: () => {
				this.close();
			},
		});
	}

	protected getActionButtonContext(): TaskModalActionButtonContext {
		return {
			translate: (key: string) => this.t(key),
		};
	}

	protected expandModal(): void {
		if (this.isExpanded) return;

		this.isExpanded = true;
		expandTaskModalDetailsLayout({
			containerEl: this.containerEl,
			detailsContainer: this.detailsContainer,
			splitRightColumn: this.splitRightColumn,
		});
	}

	protected teardownModalContent(): void {
		destroyTaskModalDetailsEditor(this.detailsMarkdownEditor);
		this.detailsMarkdownEditor = null;
		this.descriptionClampController?.destroy();
		this.descriptionClampController = undefined;
		this.sidebarEl = undefined;
		this.actionBar = undefined as unknown as HTMLElement;
		this.detailsContainer = undefined as unknown as HTMLElement;
		this.titleInput = undefined as unknown as TaskModalTitleInputElement;
		this.contextsInput = undefined as unknown as HTMLInputElement;
		this.tagsInput = undefined as unknown as HTMLInputElement;
		this.timeEstimateInput = undefined as unknown as HTMLInputElement;
		this.projectsList = undefined as unknown as HTMLElement;
		this.subtasksList = undefined as unknown as HTMLElement;
		this.blockedByList = undefined;
		this.blockingList = undefined;
		this.userFieldInputs.clear();
		this.userFieldToggles.clear();
	}

	protected showDateContextMenu(_event: UIEvent, type: "due" | "scheduled"): void {
		showTaskModalDateContextMenu(this.getActionMenuContext(), type);
	}

	protected showStatusContextMenu(event: UIEvent): void {
		showTaskModalStatusContextMenu(this.getActionMenuContext(), event);
	}

	protected showPriorityContextMenu(event: UIEvent): void {
		showTaskModalPriorityContextMenu(this.getActionMenuContext(), event);
	}

	protected showRecurrenceContextMenu(event: UIEvent): void {
		showTaskModalRecurrenceContextMenu(this.getActionMenuContext(), event);
	}

	protected showReminderContextMenu(event: UIEvent): void {
		showTaskModalReminderContextMenu(this.getActionMenuContext(), event);
	}

	protected getActionMenuState(): TaskModalActionMenuState {
		return createTaskModalActionMenuState({
			title: this.title,
			status: this.status,
			priority: this.priority,
			dueDate: this.dueDate,
			scheduledDate: this.scheduledDate,
			recurrenceRule: this.recurrenceRule,
			recurrenceAnchor: this.recurrenceAnchor,
			reminders: this.reminders,
		});
	}

	protected getActionMenuContext(): TaskModalActionMenuContext {
		return createTaskModalActionMenuContext({
			app: this.app,
			plugin: this.plugin,
			translate: (key, params) => this.t(key, params),
			getState: () => this.getActionMenuState(),
			setDueDate: (value) => {
				this.dueDate = value;
			},
			setScheduledDate: (value) => {
				this.scheduledDate = value;
			},
			setStatus: (value) => {
				this.status = value;
			},
			setPriority: (value) => {
				this.priority = value;
			},
			setRecurrenceRule: (value) => {
				this.recurrenceRule = value;
			},
			setRecurrenceAnchor: (anchor) => {
				this.recurrenceAnchor = anchor;
			},
			setReminders: (reminders) => {
				this.reminders = reminders;
			},
			onChange: () => this.updateIconStates(),
		});
	}

	protected updateDateIconState(): void {
		this.updateIconStates();
	}

	protected updateStatusIconState(): void {
		this.updateIconStates();
	}

	protected updatePriorityIconState(): void {
		this.updateIconStates();
	}

	protected updateRecurrenceIconState(): void {
		this.updateIconStates();
	}

	protected updateReminderIconState(): void {
		this.updateIconStates();
	}

	protected updateIconStates(): void {
		const actionMenuState = this.getActionMenuState();

		updateTaskModalActionIconStates(
			this.actionBar,
			{ translate: (key, params) => this.t(key, params) },
			buildTaskModalChipState(
				{
					...actionMenuState,
					contexts: this.contexts,
					tags: this.tags,
					timeEstimate: this.timeEstimate,
				},
				{
					statusConfigs: this.plugin.settings.customStatuses || [],
					priorityConfigs: this.plugin.settings.customPriorities || [],
				}
			)
		);

		this.updateSidebarStates();
	}

	protected focusTitleInput(): void {
		this.focusGuards.focusTitleInput(this.titleInput);
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
		this.projects = getTaskModalProjectsValue(this.selectedProjectItems);
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
		this.refreshOrganizationHeaders();
		this.updateSidebarStates();
	}

	// Subtask management methods
	protected async openSubtaskSelector(): Promise<void> {
		await openTaskModalTaskSelector({
			plugin: this.plugin,
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
			noEligibleTasksMessageKey: "modals.task.organization.notices.noEligibleSubtasks",
			openFailedMessageKey: "modals.task.organization.notices.subtaskSelectFailed",
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
		this.refreshOrganizationHeaders();
		this.updateSidebarStates();
	}

	protected renderOrganizationLists(): void {
		this.renderProjectsList();
		void this.renderSubtasksList();
	}

	protected toggleProjectsList(): void {
		if (!this.projectsList) return;
		this.projectsList.toggleClass("collapsed", !this.projectsList.hasClass("collapsed"));
	}

	protected toggleSubtasksList(): void {
		if (!this.subtasksList) return;
		this.subtasksList.toggleClass("collapsed", !this.subtasksList.hasClass("collapsed"));
	}

	protected validateForm(): boolean {
		return this.title.trim().length > 0;
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
		if (this.keyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}
		this.sheetGestureController?.destroy();
		this.sheetGestureController = undefined;
		this.descriptionClampController?.destroy();
		this.descriptionClampController = undefined;
		this.focusGuards.destroy();

		destroyTaskModalDetailsEditor(this.detailsMarkdownEditor);
		this.detailsMarkdownEditor = null;
		super.onClose();
	}
}
