import { App, Modal, Notice, Setting, TAbstractFile, TFile, setIcon, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { getOrderedModalGroups, shouldShowFieldForModal } from "./taskModalFieldConfig";
import type { ModalFieldConfigLike, ModalFieldsConfigLike } from "./taskModalFieldConfig";
import { createTaskModalMarkdownEditor } from "./taskModalEditorAdapter";
import { DateContextMenu } from "../components/DateContextMenu";
import { DateTimePickerModal } from "./DateTimePickerModal";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { StatusContextMenu } from "../components/StatusContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { getDatePart, getTimePart, combineDateAndTime } from "../utils/dateUtils";
import { stringifyUnknown } from "../utils/stringUtils";
import { sanitizeTags, splitFrontmatterAndBody } from "../utils/helpers";
import { ProjectSelectModal } from "./ProjectSelectModal";
import { TaskDependency, TaskInfo, Reminder } from "../types";
import { DEFAULT_DEPENDENCY_RELTYPE, formatDependencyLink } from "../utils/dependencyUtils";
import { renderProjectLinks, type LinkServices } from "../ui/renderers/linkRenderer";
import { openTaskSelector } from "./TaskSelectorWithCreateModal";
import { generateLink, generateLinkWithDisplay, parseLinkToPath } from "../utils/linkUtils";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { createTaskModalListField } from "./taskModalOrganizationFields";
import { createTaskCard } from "../ui/TaskCard";
import {
	candidateDependencyUid,
	createDependencyItemFromDependency as createDependencyItemFromDependencyHelper,
	createDependencyItemFromFile as createDependencyItemFromFileHelper,
	createDependencyItemFromPath as createDependencyItemFromPathHelper,
	dependencyItemExists,
	DependencyItem,
	renderDependencyList,
} from "./taskModalDependencies";
import { ContextSuggest, TagSuggest, UserFieldSuggest } from "./taskModalSuggests";

interface ProjectItem {
	file?: TFile;
	name: string;
	link: string;
	unresolved?: boolean;
}

function userFieldValueToString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.map(userFieldValueToString).join(", ");
	return "";
}

function userFieldValueToInputString(value: unknown): string {
	return Array.isArray(value)
		? value.map(userFieldValueToString).join(", ")
		: userFieldValueToString(value);
}

interface UserFieldToggleControl {
	setValue(value: boolean): unknown;
}

export abstract class TaskModal extends Modal {
	plugin: TaskNotesPlugin;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private guardedTitleInputs = new WeakSet<HTMLInputElement>();
	private pendingTitleFocusScrollPositions: Array<{
		element: HTMLElement;
		scrollTop: number;
		scrollLeft: number;
	}> | null = null;

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

	protected async openTaskNote(): Promise<void> {
		// Creation modals do not have an existing task note to open.
	}

	protected renderDependencyLists(): void {
		this.renderBlockedByList();
		this.renderBlockingList();
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
			this.blockedByItems.splice(index, 1);
			this.renderBlockedByList();
		});
	}

	protected renderBlockingList(): void {
		void this.renderDependencyList(this.blockingList, this.blockingItems, (index) => {
			this.blockingItems.splice(index, 1);
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
		if (dependencyItemExists(this.blockedByItems, item)) {
			return;
		}
		this.blockedByItems.push(item);
		this.renderBlockedByList();
	}

	protected addBlockingTaskFromPath(path: string): void {
		const currentPath = this.getCurrentTaskPath();
		if (currentPath && path === currentPath) {
			return;
		}
		const item = this.createDependencyItemFromPath(path);
		if (dependencyItemExists(this.blockingItems, item)) {
			return;
		}
		this.blockingItems.push(item);
		this.renderBlockingList();
	}

	protected async openBlockedBySelector(): Promise<void> {
		const sourcePath = this.getDependencySourcePath();
		const currentPath = this.getCurrentTaskPath();
		const existingUids = new Set(this.blockedByItems.map((item) => item.dependency.uid));

		await this.openTaskDependencySelector(
			(candidate) => {
				if (currentPath && candidate.path === currentPath) {
					return false;
				}
				const candidateUid = candidateDependencyUid(this.plugin, sourcePath, candidate);
				return !existingUids.has(candidateUid);
			},
			(selected) => {
				const dependency: TaskDependency = {
					uid: formatDependencyLink(this.plugin.app, sourcePath, selected.path),
					reltype: DEFAULT_DEPENDENCY_RELTYPE,
				};
				this.addBlockedByDependency(dependency);
			}
		);
	}

	protected async openBlockingSelector(): Promise<void> {
		const sourcePath = this.getDependencySourcePath();
		const currentPath = this.getCurrentTaskPath();
		const existingPaths = new Set(
			this.blockingItems
				.map((item) => item.path)
				.filter((path): path is string => typeof path === "string")
		);
		const existingUids = new Set(this.blockingItems.map((item) => item.dependency.uid));

		await this.openTaskDependencySelector(
			(candidate) => {
				if (currentPath && candidate.path === currentPath) {
					return false;
				}
				if (existingPaths.has(candidate.path)) {
					return false;
				}
				const candidateUid = candidateDependencyUid(this.plugin, sourcePath, candidate);
				return !existingUids.has(candidateUid);
			},
			(selected) => {
				this.addBlockingTaskFromPath(selected.path);
			}
		);
	}

	private async openTaskDependencySelector(
		filter: (candidate: TaskInfo) => boolean,
		onSelect: (selected: TaskInfo) => void
	): Promise<void> {
		try {
			const allTasks: TaskInfo[] = (await this.plugin.cacheManager.getAllTasks?.()) ?? [];
			const candidates = allTasks.filter(filter);

			if (candidates.length === 0) {
				new Notice(this.t("contextMenus.task.dependencies.notices.noEligibleTasks"));
				return;
			}

			openTaskSelector(this.plugin, candidates, (task) => {
				if (!task) return;
				onSelect(task);
			});
		} catch (error) {
			console.error("Failed to open task selector for dependencies:", error);
			new Notice(this.t("contextMenus.task.dependencies.notices.updateFailed"));
		}
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
	protected userFieldToggles = new Map<string, UserFieldToggleControl>();

	// Dependency fields
	protected blockedByItems: DependencyItem[] = [];
	protected blockingItems: DependencyItem[] = [];
	protected blockedByList?: HTMLElement;
	protected blockingList?: HTMLElement;

	// Project link storage
	protected selectedProjectItems: ProjectItem[] = [];

	// Subtask storage - tracks tasks that should become subtasks of this task
	protected selectedSubtaskFiles: TAbstractFile[] = [];
	protected initialSubtaskFiles: TAbstractFile[] = [];

	// UI elements
	protected titleInput: HTMLInputElement;
	protected detailsInput: HTMLTextAreaElement; // Legacy - kept for compatibility
	protected detailsMarkdownEditor: EmbeddableMarkdownEditor | null = null;
	protected contextsInput: HTMLInputElement;
	protected projectsInput: HTMLInputElement;
	protected tagsInput: HTMLInputElement;
	protected timeEstimateInput: HTMLInputElement;
	protected projectsList: HTMLElement;
	protected subtasksList: HTMLElement;
	protected actionBar: HTMLElement;
	protected detailsContainer: HTMLElement;
	protected isExpanded = false;

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app);
		this.plugin = plugin;
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
		if (this.plugin.settings.enableModalSplitLayout) {
			this.containerEl.addClass("split-layout-enabled");
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
			this.createModalContent();
			this.focusTitleInput();
		});
	}

	// Store references to split layout containers for potential reuse
	protected splitContentWrapper: HTMLElement;
	protected splitLeftColumn: HTMLElement;
	protected splitRightColumn: HTMLElement;

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Create main container
		const container = contentEl.createDiv("minimalist-modal-container");

		// Create split content wrapper at the top level for wide screen layout
		this.splitContentWrapper = container.createDiv("modal-split-content");
		this.splitLeftColumn = this.splitContentWrapper.createDiv("modal-split-left");

		// Create primary input area (title or NLP) - subclasses can override
		this.createPrimaryInput(this.splitLeftColumn);

		// Create action bar with icons - goes in left column
		this.createActionBar(this.splitLeftColumn);

		this.splitRightColumn = this.splitLeftColumn.createDiv("modal-split-right");

		// Create collapsible details section (fields in left, details editor in right)
		this.createDetailsSection(container);

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

		this.titleInput = titleContainer.createEl("input", {
			type: "text",
			cls: "title-input",
			placeholder: this.t("modals.task.titlePlaceholder"),
		});

		this.titleInput.value = this.title;
		this.titleInput.addEventListener("input", (e) => {
			this.title = (e.target as HTMLInputElement).value;
		});
		this.attachTitleFocusScrollGuard(this.titleInput);
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = container.createDiv("tn-task-modal__action-bar");

		// Due date icon
		this.createActionIcon(
			this.actionBar,
			"calendar",
			this.t("modals.task.actions.due"),
			(_, event) => {
				this.showDateContextMenu(event, "due");
			},
			"due-date"
		);

		// Scheduled date icon
		this.createActionIcon(
			this.actionBar,
			"calendar-clock",
			this.t("modals.task.actions.scheduled"),
			(_, event) => {
				this.showDateContextMenu(event, "scheduled");
			},
			"scheduled-date"
		);

		// Status icon
		this.createActionIcon(
			this.actionBar,
			"dot-square",
			this.t("modals.task.actions.status"),
			(_, event) => {
				this.showStatusContextMenu(event);
			},
			"status"
		);

		// Priority icon
		this.createActionIcon(
			this.actionBar,
			"star",
			this.t("modals.task.actions.priority"),
			(_, event) => {
				this.showPriorityContextMenu(event);
			},
			"priority"
		);

		// Recurrence icon
		this.createActionIcon(
			this.actionBar,
			"refresh-ccw",
			this.t("modals.task.actions.recurrence"),
			(_, event) => {
				this.showRecurrenceContextMenu(event);
			},
			"recurrence"
		);

		// Reminder icon
		this.createActionIcon(
			this.actionBar,
			"bell",
			this.t("modals.task.actions.reminders"),
			(_, event) => {
				this.showReminderContextMenu(event);
			},
			"reminders"
		);

		// Update icon states based on current values
		this.updateIconStates();
	}

	protected createActionIcon(
		container: HTMLElement,
		iconName: string,
		tooltip: string,
		onClick: (icon: HTMLElement, event: UIEvent) => void,
		dataType?: string
	): HTMLElement {
		const iconContainer = container.createDiv("action-icon");
		iconContainer.setAttribute("aria-label", tooltip);
		// Store initial tooltip for later updates but don't set title attribute
		iconContainer.setAttribute("data-initial-tooltip", tooltip);
		iconContainer.setAttribute("tabindex", "0");
		iconContainer.setAttribute("role", "button");
		// Add data attribute for easier identification
		if (dataType) {
			iconContainer.setAttribute("data-type", dataType);
		}

		// Add visual tooltip using Obsidian's setTooltip API
		setTooltip(iconContainer, tooltip, { placement: "top" });

		const icon = iconContainer.createSpan("icon");
		setIcon(icon, iconName);

		iconContainer.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick(iconContainer, event);
		});

		iconContainer.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				event.stopPropagation();
				onClick(iconContainer, event);
			}
		});

		return iconContainer;
	}

	protected createDetailsSection(container: HTMLElement): void {
		this.userFieldInputs.clear();
		this.userFieldToggles.clear();

		// The details container wraps the expandable fields (for hide/show animation)
		// It goes inside the left column for proper expand/collapse
		this.detailsContainer = this.splitLeftColumn
			? this.splitLeftColumn.createDiv("details-container")
			: container.createDiv("details-container");

		if (!this.isExpanded) {
			this.detailsContainer.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.detailsContainer.classList.add("tn-static-display-none-6b99de8b");
			// Also hide the right column when collapsed
			if (this.splitRightColumn) {
				this.splitRightColumn.classList.remove(
					"tn-static-display-block-2a1b75c9",
					"tn-static-display-flex-4d51fc62",
					"tn-static-display-flex-75816cae",
					"tn-static-display-flex-8bb39979",
					"tn-static-display-inline-block-60e32dcb",
					"tn-static-display-inline-cccfa456",
					"tn-static-display-inline-flex-f984c520",
					"tn-static-min-height-800px-997b4c8c"
				);
				this.splitRightColumn.classList.add("tn-static-display-none-6b99de8b");
			}
		}

		// Check field configuration to determine which fields to show
		const config = this.plugin.settings.modalFieldsConfig;
		const shouldShowTitle = this.shouldShowField("title", config);
		const shouldShowDetails = this.shouldShowField("details", config);
		this.splitContentWrapper.classList.toggle(
			"modal-split-content--right-empty",
			!shouldShowDetails
		);

		// Title field appears in details section for:
		// 1. Edit modals (always, if enabled in config)
		// 2. Creation modals when NLP is enabled (since the main title input is replaced by NLP textarea)
		const isEditModal = this.isEditMode();
		const isCreationWithNLP =
			this.isCreationMode() && this.plugin.settings.enableNaturalLanguageInput;

		if (shouldShowTitle && (isEditModal || isCreationWithNLP)) {
			const titleLabel = this.detailsContainer.createDiv("detail-label");
			titleLabel.textContent = this.t("modals.task.titleLabel");

			const titleInputDetailed = this.detailsContainer.createEl("input", {
				type: "text",
				cls: "title-input-detailed",
				placeholder: this.t("modals.task.titleDetailedPlaceholder"),
			});

			titleInputDetailed.value = this.title;
			titleInputDetailed.addEventListener("input", (e) => {
				this.title = (e.target as HTMLInputElement).value;
			});
			this.attachTitleFocusScrollGuard(titleInputDetailed);

			// Store reference for modals that use this as their title input
			if ((isEditModal || isCreationWithNLP) && !this.titleInput) {
				this.titleInput = titleInputDetailed;
			}
		}

		// Details editor goes in the right column
		if (shouldShowDetails) {
			const rightColumn = this.splitRightColumn || this.detailsContainer;

			const detailsLabel = rightColumn.createDiv("detail-label");
			detailsLabel.textContent = this.t("modals.task.detailsLabel");

			// Create container for the markdown editor
			const detailsEditorContainer = rightColumn.createDiv(
				"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--details"
			);

			// Create embeddable markdown editor for details using shared method
			this.detailsMarkdownEditor = createTaskModalMarkdownEditor(
				this.app,
				detailsEditorContainer,
				{
					value: this.details,
					placeholder: this.t("modals.task.detailsPlaceholder"),
					cls: "details-editor",
					onChange: (value) => {
						this.details = value;
					},
					onSubmit: (shift) => {
						// Ctrl/Cmd+Enter - save the task
						void this.handleSubmitShortcut(shift);
					},
					onEscape: () => {
						// ESC - close the modal
						this.close();
					},
					onTab: (shift) => {
						if (!this.plugin.settings.taskModalTabMovesFocus) {
							return false;
						}

						return shift ? this.focusPreviousField() : this.focusNextField();
					},
				}
			);
		}

		// Additional form fields (contexts, tags, etc.) go in the details container (left side)
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
			console.error(
				"TaskModal: modalFieldsConfig is not initialized. This should never happen."
			);
			return;
		}
		this.createFieldsFromConfig(container, config);
	}

	protected createFieldsFromConfig(container: HTMLElement, config: ModalFieldsConfigLike): void {
		const groupsToRender = getOrderedModalGroups(config, this.isCreationMode());

		for (const groupConfig of groupsToRender) {
			if (groupConfig.id === "basic") continue;

			// Create a section for this group if it has fields
			const groupContainer = container.createDiv({ cls: "task-modal__field-group" });

			// Render fields in this group
			for (const field of groupConfig.fields) {
				this.createField(groupContainer, field);
			}
		}
	}

	protected createField(container: HTMLElement, fieldConfig: ModalFieldConfigLike): void {
		switch (fieldConfig.id) {
			case "contexts":
				this.createContextsField(container);
				break;
			case "tags":
				this.createTagsField(container);
				break;
			case "time-estimate":
				this.createTimeEstimateField(container);
				break;
			case "projects":
				this.createProjectsField(container);
				break;
			case "subtasks":
				this.createSubtasksField(container);
				break;
			case "blocked-by":
				this.createBlockedByField(container);
				break;
			case "blocking":
				this.createBlockingField(container);
				break;
			default:
				// Check if it's a user field
				if (fieldConfig.fieldType === "user") {
					this.createUserFieldByConfig(container, fieldConfig);
				}
				break;
		}
	}

	protected createContextsField(container: HTMLElement): void {
		new Setting(container).setName(this.t("modals.task.contextsLabel")).addText((text) => {
			text.setPlaceholder(this.t("modals.task.contextsPlaceholder"))
				.setValue(this.contexts)
				.onChange((value) => {
					this.contexts = value;
				});

			// Store reference to input element
			this.contextsInput = text.inputEl;

			// Add autocomplete functionality
			new ContextSuggest(this.app, text.inputEl, this.plugin);
		});
	}

	protected createTagsField(container: HTMLElement): void {
		new Setting(container).setName(this.t("modals.task.tagsLabel")).addText((text) => {
			text.setPlaceholder(this.t("modals.task.tagsPlaceholder"))
				.setValue(this.tags)
				.onChange((value) => {
					this.tags = sanitizeTags(value);
				});

			// Store reference to input element
			this.tagsInput = text.inputEl;

			// Add autocomplete functionality
			new TagSuggest(this.app, text.inputEl, this.plugin);
		});
	}

	protected createTimeEstimateField(container: HTMLElement): void {
		new Setting(container).setName(this.t("modals.task.timeEstimateLabel")).addText((text) => {
			text.setPlaceholder(this.t("modals.task.timeEstimatePlaceholder"))
				.setValue(this.timeEstimate.toString())
				.onChange((value) => {
					this.timeEstimate = parseInt(value) || 0;
				});

			this.timeEstimateInput = text.inputEl;
		});
	}

	protected createProjectsField(container: HTMLElement): void {
		this.projectsList = createTaskModalListField(container, {
			label: this.t("modals.task.organization.projects"),
			buttonText: this.t("modals.task.organization.addToProjectButton"),
			buttonTooltip: this.t("modals.task.projectsTooltip"),
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
		this.subtasksList = createTaskModalListField(container, {
			label: this.t("modals.task.organization.subtasks"),
			buttonText: this.t("modals.task.organization.addSubtasksButton"),
			buttonTooltip: this.t("modals.task.organization.addSubtasksTooltip"),
			onButtonClick: () => {
				void this.openSubtaskSelector();
			},
			listElement: this.subtasksList,
		});

		this.renderOrganizationLists();
	}

	protected createBlockedByField(container: HTMLElement): void {
		this.blockedByList = createTaskModalListField(container, {
			label: this.t("modals.task.dependencies.blockedBy"),
			buttonText: this.t("modals.task.dependencies.addTaskButton"),
			buttonTooltip: this.t("modals.task.dependencies.selectTaskTooltip"),
			onButtonClick: () => {
				void this.openBlockedBySelector();
			},
			listElement: this.blockedByList,
		});

		this.renderDependencyLists();
	}

	protected createBlockingField(container: HTMLElement): void {
		this.blockingList = createTaskModalListField(container, {
			label: this.t("modals.task.dependencies.blocking"),
			buttonText: this.t("modals.task.dependencies.addTaskButton"),
			buttonTooltip: this.t("modals.task.dependencies.selectTaskTooltip"),
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
		// Find the user field definition
		const userField = this.plugin.settings.userFields?.find((f) => f.id === fieldConfig.id);
		if (!userField) return;

		// Create the field based on its type (existing logic from createUserFields)
		const setting = new Setting(container).setName(userField.displayName);

		switch (userField.type) {
			case "text":
			case "list": {
				setting.addText((text) => {
					const currentValue = this.userFields[userField.key];
					const displayValue = Array.isArray(currentValue)
						? currentValue.map(userFieldValueToString).join(", ")
						: userFieldValueToString(currentValue);

					text.setValue(displayValue).onChange((value) => {
						if (userField.type === "list") {
							this.userFields[userField.key] = value
								.split(",")
								.map((v) => v.trim())
								.filter((v) => v.length > 0);
						} else {
							this.userFields[userField.key] = value;
						}
					});
					this.userFieldInputs.set(userField.key, text.inputEl);

					// Add autocomplete functionality
					new UserFieldSuggest(this.app, text.inputEl, this.plugin, userField);
				});
				break;
			}
			case "number": {
				setting.addText((text) => {
					const currentValue = this.userFields[userField.key];
					text.setValue(userFieldValueToString(currentValue)).onChange((value) => {
						const numValue = parseFloat(value);
						this.userFields[userField.key] = isNaN(numValue) ? null : numValue;
					});
					text.inputEl.type = "number";
					this.userFieldInputs.set(userField.key, text.inputEl);
				});
				break;
			}
			case "date": {
				setting.addText((text) => {
					const currentValue = this.userFields[userField.key];
					text.setValue(userFieldValueToString(currentValue)).onChange((value) => {
						this.userFields[userField.key] = value;
					});
					text.inputEl.type = "date";
					this.userFieldInputs.set(userField.key, text.inputEl);
				});
				break;
			}
			case "boolean": {
				setting.addToggle((toggle) => {
					const currentValue = this.userFields[userField.key];
					toggle.setValue(currentValue === true).onChange((value) => {
						this.userFields[userField.key] = value;
					});
					this.userFieldToggles.set(userField.key, toggle);
				});
				break;
			}
		}
	}

	protected updateUserFieldControls(): void {
		const userFieldConfigs = this.plugin.settings?.userFields || [];

		for (const field of userFieldConfigs) {
			const currentValue = this.userFields[field.key];
			const input = this.userFieldInputs.get(field.key);
			if (input) {
				input.value = userFieldValueToInputString(currentValue);
			}

			const toggle = this.userFieldToggles.get(field.key);
			if (toggle) {
				toggle.setValue(currentValue === true || currentValue === "true");
			}
		}
	}

	protected createUserFields(container: HTMLElement): void {
		const userFieldConfigs = this.plugin.settings?.userFields || [];

		// Add a section separator if there are user fields
		if (userFieldConfigs.length > 0) {
			const separator = container.createDiv({ cls: "tn-task-modal__user-fields" });
			separator.createDiv({
				text: this.t("modals.task.customFieldsLabel"),
				cls: "tn-task-modal__section-label",
			});
		}

		for (const field of userFieldConfigs) {
			if (!field || !field.key || !field.displayName) continue;

			const currentValue = this.userFields[field.key] || "";

			switch (field.type) {
				case "boolean":
					new Setting(container).setName(field.displayName).addToggle((toggle) => {
						toggle
							.setValue(currentValue === true || currentValue === "true")
							.onChange((value) => {
								this.userFields[field.key] = value;
							});
						this.userFieldToggles.set(field.key, toggle);
					});
					break;

				case "number":
					new Setting(container).setName(field.displayName).addText((text) => {
						text.setPlaceholder(this.t("modals.task.userFields.numberPlaceholder"))
							.setValue(currentValue ? stringifyUnknown(currentValue) : "")
							.onChange((value) => {
								const numValue = parseFloat(value);
								this.userFields[field.key] = isNaN(numValue) ? null : numValue;
							});
						this.userFieldInputs.set(field.key, text.inputEl);
					});
					break;

				case "date":
					new Setting(container).setName(field.displayName).addText((text) => {
						text.setPlaceholder(this.t("modals.task.userFields.datePlaceholder"))
							.setValue(currentValue ? stringifyUnknown(currentValue) : "")
							.onChange((value) => {
								this.userFields[field.key] = value || null;
							});
						this.userFieldInputs.set(field.key, text.inputEl);
						// Add date picker button/icon next to the input
						// Ensure the input and button layout as a single row with proper sizing
						const parent = text.inputEl.parentElement;
						if (parent) parent.addClass("tn-date-control");
						const btn = parent?.createEl("button", {
							cls: "user-field-date-picker-btn",
						});
						if (btn) {
							btn.setAttribute(
								"aria-label",
								this.t("modals.task.userFields.pickDate", {
									field: field.displayName,
								})
							);
							setIcon(btn, "calendar");
							btn.addEventListener("click", (e) => {
								e.preventDefault();
								const menu = new DateContextMenu({
									currentValue: text.getValue() || undefined,
									onSelect: (value) => {
										text.setValue(value || "");
										this.userFields[field.key] = value || null;
									},
									plugin: this.plugin,
									app: this.app,
								});
								menu.showAtElement(btn);
							});
						}
					});
					break;

				case "list":
					new Setting(container).setName(field.displayName).addText((text) => {
						const displayValue = Array.isArray(currentValue)
							? currentValue.join(", ")
							: currentValue
								? stringifyUnknown(currentValue)
								: "";

						text.setPlaceholder(this.t("modals.task.userFields.listPlaceholder"))
							.setValue(displayValue)
							.onChange((value) => {
								if (!value.trim()) {
									this.userFields[field.key] = null;
								} else {
									this.userFields[field.key] = value
										.split(",")
										.map((v) => v.trim())
										.filter((v) => v);
								}
							});
						this.userFieldInputs.set(field.key, text.inputEl);

						// Add autocomplete functionality
						new UserFieldSuggest(this.app, text.inputEl, this.plugin, field);
						// Remove link preview area: we only want the input value
						const oldPreview = container.querySelector(".user-field-link-preview");
						if (oldPreview) oldPreview.detach?.();
					});
					break;

				case "text":
				default:
					new Setting(container).setName(field.displayName).addText((text) => {
						text.setPlaceholder(
							this.t("modals.task.userFields.textPlaceholder", {
								field: field.displayName,
							})
						)
							.setValue(currentValue ? stringifyUnknown(currentValue) : "")
							.onChange((value) => {
								this.userFields[field.key] = value || null;
							});
						this.userFieldInputs.set(field.key, text.inputEl);

						// Add autocomplete functionality
						new UserFieldSuggest(this.app, text.inputEl, this.plugin, field);
					});
					break;
			}
		}
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv(
			"modal-button-container tn-task-modal__button-bar"
		);

		// Add "Open note" button for edit modals only
		if (this.isEditMode()) {
			const openNoteButton = buttonContainer.createEl("button", {
				cls: "tn-task-modal__open-note-button",
				text: this.t("modals.task.buttons.openNote"),
			});

			openNoteButton.addEventListener("click", () => {
				void this.openTaskNote();
			});
		}

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
					this.close();
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

	protected expandModal(): void {
		if (this.isExpanded) return;

		this.isExpanded = true;
		this.detailsContainer.classList.remove(
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		this.detailsContainer.classList.add("tn-static-display-block-2a1b75c9");
		this.containerEl.addClass("expanded");

		// Also show the right column (details editor) when expanding
		if (this.splitRightColumn) {
			this.splitRightColumn.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.splitRightColumn.style.removeProperty("display");
		}

		// Animate the expansion
		this.detailsContainer.classList.remove(
			"tn-static-opacity-0-6-d95b59ac",
			"tn-static-opacity-1-c6e7979d"
		);
		this.detailsContainer.classList.add("tn-static-opacity-0-8d919cb5");
		this.detailsContainer.classList.remove("tn-static-transform-translatey-0-1b976432");
		this.detailsContainer.classList.add("tn-static-transform-translatey-10px-5b91bf02");

		window.setTimeout(() => {
			this.detailsContainer.classList.remove(
				"tn-static-opacity-0-6-d95b59ac",
				"tn-static-opacity-0-8d919cb5"
			);
			this.detailsContainer.classList.add("tn-static-opacity-1-c6e7979d");
			this.detailsContainer.classList.remove("tn-static-transform-translatey-10px-5b91bf02");
			this.detailsContainer.classList.add("tn-static-transform-translatey-0-1b976432");
		}, 50);
	}

	protected showDateContextMenu(_event: UIEvent, type: "due" | "scheduled"): void {
		const currentValue = type === "due" ? this.dueDate : this.scheduledDate;
		const title =
			type === "due"
				? this.t("modals.task.dateMenu.dueTitle")
				: this.t("modals.task.dateMenu.scheduledTitle");

		const modal = new DateTimePickerModal(this.app, {
			currentDate: currentValue ? getDatePart(currentValue) : undefined,
			currentTime: currentValue ? getTimePart(currentValue) : undefined,
			title: title,
			dateRole: type,
			plugin: this.plugin,
			onSelect: (value: string | null, time: string | null) => {
				if (value) {
					// Combine date and time if both are provided
					const finalValue = time ? combineDateAndTime(value, time) : value;

					if (type === "due") {
						this.dueDate = finalValue;
					} else {
						this.scheduledDate = finalValue;
					}
				} else {
					// Clear the date
					if (type === "due") {
						this.dueDate = "";
					} else {
						this.scheduledDate = "";
					}
				}
				this.updateDateIconState();
			},
		});

		modal.open();
	}

	protected showStatusContextMenu(event: UIEvent): void {
		const menu = new StatusContextMenu({
			currentValue: this.status,
			onSelect: (value) => {
				this.status = value;
				this.updateStatusIconState();
			},
			plugin: this.plugin,
		});

		menu.show(event);
	}

	protected showPriorityContextMenu(event: UIEvent): void {
		const menu = new PriorityContextMenu({
			currentValue: this.priority,
			onSelect: (value) => {
				this.priority = value;
				this.updatePriorityIconState();
			},
			plugin: this.plugin,
		});

		menu.show(event);
	}

	protected showRecurrenceContextMenu(event: UIEvent): void {
		const menu = new RecurrenceContextMenu({
			currentValue: this.recurrenceRule,
			currentAnchor: this.recurrenceAnchor,
			scheduledDate: this.scheduledDate,
			onSelect: (value, anchor) => {
				this.recurrenceRule = value || "";
				if (anchor !== undefined) {
					this.recurrenceAnchor = anchor;
				}
				this.updateRecurrenceIconState();
			},
			app: this.app,
			plugin: this.plugin,
		});

		menu.show(event);
	}

	protected showReminderContextMenu(event: UIEvent): void {
		// Create a temporary task info object for the context menu
		const tempTask: TaskInfo = {
			title: this.title,
			status: this.status,
			priority: this.priority,
			due: this.dueDate,
			scheduled: this.scheduledDate,
			path: "", // Will be set when saving
			archived: false,
			reminders: this.reminders,
		};

		const menu = new ReminderContextMenu(
			this.plugin,
			tempTask,
			event.target as HTMLElement,
			(updatedTask: TaskInfo) => {
				this.reminders = updatedTask.reminders || [];
				this.updateReminderIconState();
			}
		);

		menu.show(event);
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

	protected getDefaultStatus(): string {
		// Get the first status (lowest order) as default
		const statusConfigs = this.plugin.settings.customStatuses;
		if (statusConfigs && statusConfigs.length > 0) {
			const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);
			return sortedStatuses[0].value;
		}
		return "open"; // fallback
	}

	protected getDefaultPriority(): string {
		// Get the priority with lowest weight as default
		const priorityConfigs = this.plugin.settings.customPriorities;
		if (priorityConfigs && priorityConfigs.length > 0) {
			const sortedPriorities = [...priorityConfigs].sort((a, b) => a.weight - b.weight);
			return sortedPriorities[0].value;
		}
		return "normal"; // fallback
	}

	protected getRecurrenceDisplayText(): string {
		if (!this.recurrenceRule) return "";

		// Parse RRULE patterns into human-readable text
		const rule = this.recurrenceRule;

		if (rule.includes("FREQ=DAILY")) {
			return "Daily";
		} else if (rule.includes("FREQ=WEEKLY")) {
			if (rule.includes("INTERVAL=2")) {
				return "Every 2 weeks";
			} else if (rule.includes("BYDAY=MO,TU,WE,TH,FR")) {
				return "Weekdays";
			} else if (rule.includes("BYDAY=")) {
				// Extract day for display
				const dayMatch = rule.match(/BYDAY=([A-Z]{2})/);
				if (dayMatch) {
					const dayMap: Record<string, string> = {
						SU: "Sunday",
						MO: "Monday",
						TU: "Tuesday",
						WE: "Wednesday",
						TH: "Thursday",
						FR: "Friday",
						SA: "Saturday",
					};
					return `Weekly on ${dayMap[dayMatch[1]] || dayMatch[1]}`;
				}
				return "Weekly";
			} else {
				return "Weekly";
			}
		} else if (rule.includes("FREQ=MONTHLY")) {
			if (rule.includes("INTERVAL=3")) {
				return "Every 3 months";
			} else if (rule.includes("BYMONTHDAY=")) {
				const dayMatch = rule.match(/BYMONTHDAY=(\d+)/);
				if (dayMatch) {
					return `Monthly on the ${this.getOrdinal(parseInt(dayMatch[1]))}`;
				}
				return "Monthly";
			} else if (rule.includes("BYDAY=")) {
				return "Monthly (by weekday)";
			} else {
				return "Monthly";
			}
		} else if (rule.includes("FREQ=YEARLY")) {
			if (rule.includes("BYMONTH=") && rule.includes("BYMONTHDAY=")) {
				const monthMatch = rule.match(/BYMONTH=(\d+)/);
				const dayMatch = rule.match(/BYMONTHDAY=(\d+)/);
				if (monthMatch && dayMatch) {
					const monthNames = [
						"",
						"January",
						"February",
						"March",
						"April",
						"May",
						"June",
						"July",
						"August",
						"September",
						"October",
						"November",
						"December",
					];
					const month = monthNames[parseInt(monthMatch[1])];
					const day = this.getOrdinal(parseInt(dayMatch[1]));
					return `Yearly on ${month} ${day}`;
				}
			}
			return "Yearly";
		}

		// Check for end conditions
		let endText = "";
		if (rule.includes("COUNT=")) {
			const countMatch = rule.match(/COUNT=(\d+)/);
			if (countMatch) {
				endText = ` (${countMatch[1]} times)`;
			}
		} else if (rule.includes("UNTIL=")) {
			const untilMatch = rule.match(/UNTIL=(\d{8})/);
			if (untilMatch) {
				const date = untilMatch[1];
				const formatted = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
				endText = ` (until ${formatted})`;
			}
		}

		// Fallback for custom patterns
		return "Custom" + endText;
	}

	private getOrdinal(n: number): string {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	}

	protected updateIconStates(): void {
		if (!this.actionBar) return;

		// Update due date icon
		const dueDateIcon = this.actionBar.querySelector('[data-type="due-date"]') as HTMLElement;
		if (dueDateIcon) {
			if (this.dueDate) {
				dueDateIcon.classList.add("has-value");
				setTooltip(
					dueDateIcon,
					this.t("modals.task.tooltips.dueValue", { value: this.dueDate }),
					{ placement: "top" }
				);
			} else {
				dueDateIcon.classList.remove("has-value");
				setTooltip(dueDateIcon, this.t("modals.task.actions.due"), { placement: "top" });
			}
		}

		// Update scheduled date icon
		const scheduledDateIcon = this.actionBar.querySelector(
			'[data-type="scheduled-date"]'
		) as HTMLElement;
		if (scheduledDateIcon) {
			if (this.scheduledDate) {
				scheduledDateIcon.classList.add("has-value");
				setTooltip(
					scheduledDateIcon,
					this.t("modals.task.tooltips.scheduledValue", { value: this.scheduledDate }),
					{ placement: "top" }
				);
			} else {
				scheduledDateIcon.classList.remove("has-value");
				setTooltip(scheduledDateIcon, this.t("modals.task.actions.scheduled"), {
					placement: "top",
				});
			}
		}

		// Update status icon
		const statusIcon = this.actionBar.querySelector('[data-type="status"]') as HTMLElement;
		if (statusIcon) {
			// Find the status config to get the label and color
			const statusConfig = this.plugin.settings.customStatuses.find(
				(s) => s.value === this.status
			);
			const statusLabel = statusConfig ? statusConfig.label : this.status;

			if (this.status && statusConfig && statusConfig.value !== this.getDefaultStatus()) {
				statusIcon.classList.add("has-value");
				setTooltip(
					statusIcon,
					this.t("modals.task.tooltips.statusValue", { value: statusLabel }),
					{ placement: "top" }
				);
			} else {
				statusIcon.classList.remove("has-value");
				setTooltip(statusIcon, this.t("modals.task.actions.status"), { placement: "top" });
			}

			// Apply status color to the icon
			const iconEl = statusIcon.querySelector(".icon") as HTMLElement;
			if (iconEl && statusConfig && statusConfig.color) {
				iconEl.style.color = statusConfig.color;
			} else if (iconEl) {
				iconEl.classList.remove(
					"tn-static-color-var-color-accent-d2cad743",
					"tn-static-color-var-text-accent-65b47ee3",
					"tn-static-color-var-text-muted-5872de20",
					"tn-static-color-var-text-on-accent-f3e1679d",
					"tn-static-color-var-text-warning-783d5f03",
					"tn-static-color-var-tn-text-muted-a90fb6f3",
					"tn-static-color-white-0a43e56a",
					"tn-static-cursor-pointer-2723efcc",
					"tn-static-font-size-12px-65574819",
					"tn-static-font-weight-bold-0fe8c30d",
					"tn-static-font-weight-bold-e0b452bd",
					"tn-static-margin-2px-0-edce9b14",
					"tn-static-padding-20px-7a035d95",
					"tn-static-padding-20px-ebe8e48c"
				);
				iconEl.style.removeProperty("color");
				// Reset to default
			}
		}

		// Update priority icon
		const priorityIcon = this.actionBar.querySelector('[data-type="priority"]') as HTMLElement;
		if (priorityIcon) {
			// Find the priority config to get the label and color
			const priorityConfig = this.plugin.settings.customPriorities.find(
				(p) => p.value === this.priority
			);
			const priorityLabel = priorityConfig ? priorityConfig.label : this.priority;

			if (
				this.priority &&
				priorityConfig &&
				priorityConfig.value !== this.getDefaultPriority()
			) {
				priorityIcon.classList.add("has-value");
				setTooltip(
					priorityIcon,
					this.t("modals.task.tooltips.priorityValue", { value: priorityLabel }),
					{ placement: "top" }
				);
			} else {
				priorityIcon.classList.remove("has-value");
				setTooltip(priorityIcon, this.t("modals.task.actions.priority"), {
					placement: "top",
				});
			}

			// Apply priority color to the icon
			const iconEl = priorityIcon.querySelector(".icon") as HTMLElement;
			if (iconEl && priorityConfig && priorityConfig.color) {
				iconEl.style.color = priorityConfig.color;
			} else if (iconEl) {
				iconEl.classList.remove(
					"tn-static-color-var-color-accent-d2cad743",
					"tn-static-color-var-text-accent-65b47ee3",
					"tn-static-color-var-text-muted-5872de20",
					"tn-static-color-var-text-on-accent-f3e1679d",
					"tn-static-color-var-text-warning-783d5f03",
					"tn-static-color-var-tn-text-muted-a90fb6f3",
					"tn-static-color-white-0a43e56a",
					"tn-static-cursor-pointer-2723efcc",
					"tn-static-font-size-12px-65574819",
					"tn-static-font-weight-bold-0fe8c30d",
					"tn-static-font-weight-bold-e0b452bd",
					"tn-static-margin-2px-0-edce9b14",
					"tn-static-padding-20px-7a035d95",
					"tn-static-padding-20px-ebe8e48c"
				);
				iconEl.style.removeProperty("color");
				// Reset to default
			}
		}

		// Update recurrence icon
		const recurrenceIcon = this.actionBar.querySelector(
			'[data-type="recurrence"]'
		) as HTMLElement;
		if (recurrenceIcon) {
			if (this.recurrenceRule && this.recurrenceRule.trim()) {
				recurrenceIcon.classList.add("has-value");
				setTooltip(
					recurrenceIcon,
					this.t("modals.task.tooltips.recurrenceValue", {
						value: this.getRecurrenceDisplayText(),
					}),
					{ placement: "top" }
				);
			} else {
				recurrenceIcon.classList.remove("has-value");
				setTooltip(recurrenceIcon, this.t("modals.task.actions.recurrence"), {
					placement: "top",
				});
			}
		}

		// Update reminder icon
		const reminderIcon = this.actionBar.querySelector('[data-type="reminders"]') as HTMLElement;
		if (reminderIcon) {
			if (this.reminders && this.reminders.length > 0) {
				reminderIcon.classList.add("has-value");
				const count = this.reminders.length;
				const tooltip =
					count === 1
						? this.t("modals.task.tooltips.remindersSingle")
						: this.t("modals.task.tooltips.remindersPlural", { count });
				setTooltip(reminderIcon, tooltip, { placement: "top" });
			} else {
				reminderIcon.classList.remove("has-value");
				setTooltip(reminderIcon, this.t("modals.task.actions.reminders"), {
					placement: "top",
				});
			}
		}
	}

	protected focusTitleInput(): void {
		window.setTimeout(() => {
			this.pendingTitleFocusScrollPositions = this.captureTitleFocusScrollPositions(
				this.titleInput
			);
			this.titleInput.focus({ preventScroll: true });
			this.titleInput.select();
			this.restoreTitleFocusScrollPositions(this.pendingTitleFocusScrollPositions);
		}, 100);
	}

	private shouldPreserveTitleFocusScroll(): boolean {
		const doc = this.containerEl.ownerDocument;
		const win = doc.defaultView || window;
		return (
			doc.body.classList.contains("is-mobile") ||
			win.matchMedia?.("(pointer: coarse)")?.matches === true
		);
	}

	private attachTitleFocusScrollGuard(input: HTMLInputElement): void {
		if (this.guardedTitleInputs.has(input)) return;
		this.guardedTitleInputs.add(input);

		const capture = () => {
			this.pendingTitleFocusScrollPositions = this.captureTitleFocusScrollPositions(input);
		};

		input.addEventListener("pointerdown", capture, { capture: true });
		input.addEventListener("touchstart", capture, { capture: true });
		input.addEventListener("focus", () => {
			if (!this.pendingTitleFocusScrollPositions) return;
			this.scheduleTitleFocusScrollRestore(this.pendingTitleFocusScrollPositions);
		});
	}

	private captureTitleFocusScrollPositions(input: HTMLInputElement): Array<{
		element: HTMLElement;
		scrollTop: number;
		scrollLeft: number;
	}> | null {
		if (!this.shouldPreserveTitleFocusScroll()) {
			return null;
		}

		const elements = new Set<HTMLElement>();
		const addElement = (element: Element | null | undefined) => {
			const elementWindow = element?.ownerDocument.defaultView;
			const HTMLElementConstructor = elementWindow?.HTMLElement ?? HTMLElement;
			if (element instanceof HTMLElementConstructor) {
				elements.add(element);
			}
		};

		addElement(this.containerEl);
		addElement(this.modalEl);
		addElement(this.contentEl);
		this.modalEl
			.querySelectorAll<HTMLElement>(
				".modal-content, .minimalist-modal-container, .modal-split-content, .modal-split-left, .modal-split-right, .details-container"
			)
			.forEach(addElement);

		let parent = input.parentElement;
		while (parent && parent !== this.containerEl.parentElement) {
			addElement(parent);
			parent = parent.parentElement;
		}

		return Array.from(elements).map((element) => ({
			element,
			scrollTop: element.scrollTop,
			scrollLeft: element.scrollLeft,
		}));
	}

	private restoreTitleFocusScrollPositions(
		positions: Array<{ element: HTMLElement; scrollTop: number; scrollLeft: number }> | null
	): void {
		if (!positions) return;
		for (const { element, scrollTop, scrollLeft } of positions) {
			element.scrollTop = scrollTop;
			element.scrollLeft = scrollLeft;
		}
	}

	private scheduleTitleFocusScrollRestore(
		positions: Array<{ element: HTMLElement; scrollTop: number; scrollLeft: number }>
	): void {
		this.restoreTitleFocusScrollPositions(positions);

		const win = this.containerEl.ownerDocument.defaultView || window;
		const requestAnimationFrame =
			win.requestAnimationFrame ??
			((callback: FrameRequestCallback) => win.setTimeout(callback, 16));
		requestAnimationFrame(() => this.restoreTitleFocusScrollPositions(positions));
		win.setTimeout(() => this.restoreTitleFocusScrollPositions(positions), 50);
		win.setTimeout(() => {
			this.restoreTitleFocusScrollPositions(positions);
			if (this.pendingTitleFocusScrollPositions === positions) {
				this.pendingTitleFocusScrollPositions = null;
			}
		}, 250);
	}

	protected addProject(file: TAbstractFile): void {
		if (file instanceof TFile) {
			const projectItem = {
				file,
				name: file.basename,
				link: this.buildProjectReference(file, this.getCurrentTaskPath() || ""),
			};

			if (this.hasProjectItem(projectItem)) {
				return;
			}

			this.selectedProjectItems.push(projectItem);
		}
		this.updateProjectsFromFiles();
		this.renderProjectsList();
	}

	protected removeProject(item: ProjectItem): void {
		this.selectedProjectItems = this.selectedProjectItems.filter(
			(existing) => existing !== item
		);
		this.updateProjectsFromFiles();
		this.renderProjectsList();
	}

	protected updateProjectsFromFiles(): void {
		// Update the projects string from selected items
		this.projects = this.selectedProjectItems.map((item) => item.link).join(", ");
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
		// Convert project strings to ProjectItem objects.
		// This handles both old plain string projects and new [[link]] format.

		// Use the task's path as the source for resolving relative links
		const sourcePath = this.getCurrentTaskPath() || "";

		for (const projectString of projects) {
			const projectItem = this.createProjectItemFromString(projectString, sourcePath);
			if (!projectItem || this.hasProjectItem(projectItem)) continue;
			this.selectedProjectItems.push(projectItem);
		}
		this.updateProjectsFromFiles();
		// Don't render immediately - let the caller decide when to render
	}

	private createProjectItemFromString(
		projectString: string,
		sourcePath: string
	): ProjectItem | null {
		// Skip null, undefined, or empty strings
		if (!projectString || typeof projectString !== "string" || projectString.trim() === "") {
			return null;
		}

		// Check if it's a wiki link format
		const linkMatch = projectString.match(/^\[\[([^\]]+)\]\]$/);
		if (linkMatch) {
				const linkPath = linkMatch[1];
				const file = this.resolveLink(linkPath, sourcePath);
				if (file instanceof TFile) {
				// Resolved link
				return {
					file,
					name: file.basename,
					link: projectString,
				};
			} else {
				// Unresolved link - still add it!
				const displayName = linkPath.split("|")[0]; // Strip alias if present
				return {
					name: displayName,
					link: projectString,
					unresolved: true,
				};
			}
		} else {
			// Check if it's a markdown link format [text](path)
			const markdownMatch = projectString.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
			if (markdownMatch) {
				const linkPath = parseLinkToPath(projectString);
				const file = this.resolveLink(linkPath, sourcePath);
				if (file instanceof TFile) {
					// Resolved markdown link
					return {
						file,
						name: file.basename,
						link: projectString,
					};
				} else {
					// Unresolved markdown link
					const displayName = markdownMatch[1] || linkPath;
					return {
						name: displayName,
						link: projectString,
						unresolved: true,
					};
				}
			} else {
				// For backwards compatibility, try to find a file with this name
				const files = this.getMarkdownFiles();
				const matchingFile = files.find(
					(f) => f.basename === projectString || f.name === projectString + ".md"
				);
				if (matchingFile) {
					return {
						file: matchingFile,
						name: matchingFile.basename,
						link: `[[${matchingFile.basename}]]`,
					};
				} else {
					// Plain text - preserve as-is
					return {
						name: projectString,
						link: projectString,
						unresolved: true,
					};
				}
			}
		}
	}

	private hasProjectItem(candidate: ProjectItem): boolean {
		const candidateKeys = this.getProjectDedupKeys(candidate);
		return this.selectedProjectItems.some((existing) => {
			const existingKeys = this.getProjectDedupKeys(existing);
			return candidateKeys.some((key) => existingKeys.includes(key));
		});
	}

	private getProjectDedupKeys(item: ProjectItem): string[] {
		const keys = new Set<string>();

		if (item.file?.path) {
			keys.add(`path:${this.normalizeProjectPath(item.file.path)}`);
		}

		const parsedPath = parseLinkToPath(item.link);
		if (parsedPath) {
			keys.add(`path:${this.normalizeProjectPath(parsedPath)}`);
		}

		if (item.link) {
			keys.add(`link:${item.link.trim().toLowerCase()}`);
		}

		return Array.from(keys);
	}

	private normalizeProjectPath(path: string): string {
		return path.trim().replace(/\.md$/i, "").toLowerCase();
	}

	protected renderProjectsList(): void {
		if (!this.projectsList) return;

		this.projectsList.empty();

		if (this.selectedProjectItems.length === 0) {
			return;
		}

		this.selectedProjectItems.forEach((item) => {
			const projectItem = this.projectsList.createDiv({ cls: "task-project-item" });

			// Add unresolved class if needed (same as dependencies)
			if (item.unresolved) {
				projectItem.addClass("task-project-item--unresolved");
			}

			const infoEl = projectItem.createDiv({ cls: "task-project-info" });
			const nameEl = infoEl.createDiv({ cls: "task-project-name clickable-project" });

			if (item.file) {
				// Resolved project -- render as link
				const projectAsWikilink = generateLinkWithDisplay(
					this.app,
					item.file,
					this.getCurrentTaskPath() || "",
					item.file.name
				);
				this.renderProjectLinksWithoutPrefix(nameEl, [projectAsWikilink]);

				if (item.file.path !== item.file.name) {
					const pathEl = infoEl.createDiv({ cls: "task-project-path" });
					pathEl.textContent = item.file.path;
				}
			} else {
				// Unresolved project - render as plain text
				nameEl.textContent = item.name;
				setTooltip(
					nameEl,
					this.t("contextMenus.task.dependencies.notices.unresolved", {
						name: item.name,
					}),
					{ placement: "top" }
				);
			}
			const removeBtn = projectItem.createEl("button", {
				cls: "task-project-remove",
				text: "×",
			});
			setTooltip(removeBtn, this.t("modals.task.projectsRemoveTooltip"), {
				placement: "top",
			});
			removeBtn.addEventListener("click", () => {
				this.removeProject(item);
			});
		});
	}

	// Subtask management methods
	protected async openSubtaskSelector(): Promise<void> {
		try {
			const allTasks = await this.plugin.cacheManager.getAllTasks();

			// Filter out tasks that are already subtasks and the current task (if editing)
			const currentTaskPath = this.getCurrentTaskPath();
			const candidates = allTasks.filter((candidate) => {
				if (currentTaskPath && candidate.path === currentTaskPath) return false;
				return !this.selectedSubtaskFiles.some(
					(existing) => existing.path === candidate.path
				);
			});

			if (candidates.length === 0) {
				new Notice(this.t("modals.task.organization.notices.noEligibleSubtasks"));
				return;
			}

			openTaskSelector(this.plugin, candidates, (subtask) => {
				if (!subtask) return;
				const file = this.app.vault.getAbstractFileByPath(subtask.path);
				if (file) {
					this.addSubtask(file);
				}
			});
		} catch (error) {
			console.error("Failed to open subtask selector:", error);
			new Notice(this.t("modals.task.organization.notices.subtaskSelectFailed"));
		}
	}

	protected addSubtask(file: TAbstractFile): void {
		// Avoid duplicates
		if (this.selectedSubtaskFiles.some((existing) => existing.path === file.path)) {
			return;
		}

		this.selectedSubtaskFiles.push(file);
		void this.renderSubtasksList();
	}

	protected removeSubtask(file: TAbstractFile): void {
		this.selectedSubtaskFiles = this.selectedSubtaskFiles.filter(
			(existing) => existing.path !== file.path
		);
		void this.renderSubtasksList();
	}

	protected async renderSubtasksList(): Promise<void> {
		if (!this.subtasksList) return;

		this.subtasksList.empty();

		if (this.selectedSubtaskFiles.length === 0) {
			return;
		}

		for (const file of this.selectedSubtaskFiles) {
			if (!(file instanceof TFile)) return;

			const subtaskItem = this.subtasksList.createDiv({
				cls: "task-project-item task-project-item--task-card",
			});
			const cardHost = subtaskItem.createDiv({ cls: "task-project-card-host" });

			const taskInfo = await this.plugin.cacheManager.getCachedTaskInfo(file.path);
			if (taskInfo) {
				const taskCard = createTaskCard(taskInfo, this.plugin, undefined, {
					layout: "default",
					showSecondaryBadges: false,
					enableHoverPreview: false,
				});
				cardHost.appendChild(taskCard);
			} else {
				const infoEl = cardHost.createDiv({ cls: "task-project-info" });
				const nameEl = infoEl.createDiv({ cls: "task-project-name clickable-project" });

				const taskLink = generateLinkWithDisplay(
					this.app,
					file,
					this.getCurrentTaskPath() || "",
					file.name
				);
				this.renderProjectLinksWithoutPrefix(nameEl, [taskLink]);

				if (file.path !== file.name) {
					const pathEl = infoEl.createDiv({ cls: "task-project-path" });
					pathEl.textContent = file.path;
				}
			}

			const removeBtn = subtaskItem.createEl("button", {
				cls: "task-project-remove",
				text: "×",
			});
			setTooltip(removeBtn, this.t("modals.task.organization.removeSubtaskTooltip"), {
				placement: "top",
			});
			removeBtn.addEventListener("click", () => {
				this.removeSubtask(file);
			});
		}
	}

	protected renderOrganizationLists(): void {
		this.renderProjectsList();
		void this.renderSubtasksList();
	}

	protected renderProjectLinksWithoutPrefix(container: HTMLElement, links: string[]): void {
		const linkServices: LinkServices = {
			metadataCache: this.app.metadataCache,
			workspace: this.app.workspace,
		};

		renderProjectLinks(container, links, linkServices);

		Array.from(container.childNodes).forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === "+") {
				node.remove();
			}
		});
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
		// Clean up keyboard handler
		if (this.keyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}

		// Clean up markdown editor if it exists
		if (this.detailsMarkdownEditor) {
			this.detailsMarkdownEditor.destroy();
			this.detailsMarkdownEditor = null;
		}
		super.onClose();
	}
}
