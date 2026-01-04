import {
	App,
	Modal,
	Notice,
	Setting,
	setIcon,
	TAbstractFile,
	TFile,
	AbstractInputSuggest,
	setTooltip,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { DateContextMenu } from "../components/DateContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { StatusContextMenu } from "../components/StatusContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { getDatePart, getTimePart, combineDateAndTime } from "../utils/dateUtils";
import { sanitizeTags, splitFrontmatterAndBody } from "../utils/helpers";
import { ProjectSelectModal } from "./ProjectSelectModal";
import { TaskDependency, TaskInfo, Reminder } from "../types";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	formatDependencyLink,
	normalizeDependencyEntry,
	resolveDependencyEntry,
} from "../utils/dependencyUtils";
import {
	appendInternalLink,
	renderProjectLinks,
	type LinkServices,
} from "../ui/renderers/linkRenderer";
import { openTaskSelector } from "./TaskSelectorWithCreateModal";
import { generateLink, generateLinkWithDisplay, parseLinkToPath } from "../utils/linkUtils";
import { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";

interface DependencyItem {
	dependency: TaskDependency;
	name: string;
	path?: string;
	unresolved?: boolean;
}

interface ProjectItem {
	file?: TFile;
	name: string;
	link: string;
	unresolved?: boolean;
}

export abstract class TaskModal extends Modal {
	plugin: TaskNotesPlugin;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	// Dependency item definition
	protected createDependencyItemFromFile(
		file: TFile,
		options: { sourcePath?: string } = {}
	): DependencyItem {
		const sourcePath = options.sourcePath ?? this.getDependencySourcePath();
		const uid = formatDependencyLink(
			this.plugin.app,
			sourcePath,
			file.path,
			this.plugin.settings.useFrontmatterMarkdownLinks
		);
		return {
			dependency: { uid, reltype: DEFAULT_DEPENDENCY_RELTYPE },
			path: file.path,
			name: file.basename,
		};
	}

	protected createDependencyItemFromDependency(
		dependency: TaskDependency,
		sourcePath?: string
	): DependencyItem {
		const normalized = normalizeDependencyEntry(dependency);
		if (!normalized) {
			const fallbackName =
				(typeof dependency === "object" && dependency && "uid" in dependency && typeof dependency.uid === "string"
					? dependency.uid
					: String(dependency));
			return {
				dependency: { uid: fallbackName, reltype: DEFAULT_DEPENDENCY_RELTYPE },
				name: fallbackName,
				unresolved: true,
			};
		}

		const resolution = resolveDependencyEntry(
			this.plugin.app,
			sourcePath ?? this.getDependencySourcePath(),
			normalized
		);
		if (resolution) {
			const name =
				resolution.file?.basename || resolution.path.split("/").pop() || normalized.uid;
			return {
				dependency: normalized,
				path: resolution.path,
				name,
			};
		}

		const cleaned = normalized.uid.replace(/^\[\[/, "").replace(/\]\]$/, "");
		return {
			dependency: normalized,
			name: cleaned || dependency.uid,
			unresolved: true,
		};
	}

	protected createDependencyItemFromPath(path: string): DependencyItem {
		const sourcePath = this.getDependencySourcePath();
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return {
				dependency: {
					uid: formatDependencyLink(
						this.plugin.app,
						sourcePath,
						file.path,
						this.plugin.settings.useFrontmatterMarkdownLinks
					),
					reltype: DEFAULT_DEPENDENCY_RELTYPE,
				},
				path: file.path,
				name: file.basename,
			};
		}

		// For unresolved dependencies, create a minimal file-like object to generate link
		const basename = path.split("/").pop() || path;
		const nameWithoutExt = basename.replace(/\.md$/i, "");

		// Use a simple wikilink format for unresolved dependencies
		// This will be resolved when the file is created
		return {
			dependency: {
				uid: `[[${nameWithoutExt}]]`,
				reltype: DEFAULT_DEPENDENCY_RELTYPE,
			},
			path,
			name: nameWithoutExt,
			unresolved: true,
		};
	}

	protected getDependencySourcePath(): string {
		return this.getCurrentTaskPath() || this.plugin.app.workspace.getActiveFile()?.path || "";
	}

	// Overridden by subclasses that manage an existing task
	protected getCurrentTaskPath(): string | undefined {
		return undefined;
	}

	protected renderDependencyLists(): void {
		this.renderBlockedByList();
		this.renderBlockingList();
	}

	protected getLinkServices(): LinkServices {
		return {
			metadataCache: this.plugin.app.metadataCache,
			workspace: this.plugin.app.workspace,
			sourcePath: this.getCurrentTaskPath() || this.plugin.app.workspace.getActiveFile()?.path || "",
		};
	}

	protected renderBlockedByList(): void {
		this.renderDependencyList(this.blockedByList, this.blockedByItems, (index) => {
			this.blockedByItems.splice(index, 1);
			this.renderBlockedByList();
		});
	}

	protected renderBlockingList(): void {
		this.renderDependencyList(this.blockingList, this.blockingItems, (index) => {
			this.blockingItems.splice(index, 1);
			this.renderBlockingList();
		});
	}

	private renderDependencyList(
		listEl: HTMLElement | undefined,
		items: DependencyItem[],
		onRemove: (index: number) => void
	): void {
		if (!listEl) {
			return;
		}

		listEl.empty();

		if (items.length === 0) {
			return;
		}

		const linkServices = this.getLinkServices();

		items.forEach((item, index) => {
			const itemEl = listEl.createDiv({ cls: "task-project-item" });
			if (item.unresolved) {
				itemEl.addClass("task-project-item--unresolved");
				setTooltip(
					itemEl,
					this.t("contextMenus.task.dependencies.notices.unresolved", {
						entries: item.dependency.uid,
					}),
					{ placement: "top" }
				);
			}

			const infoEl = itemEl.createDiv({ cls: "task-project-info" });
			const nameEl = infoEl.createSpan({ cls: "task-project-name" });

			if (item.path && !item.unresolved) {
				nameEl.addClass("clickable-dependency");
				appendInternalLink(
					nameEl,
					item.path,
					item.name,
					linkServices,
					{
						cssClass: "task-dependency-link internal-link",
						hoverSource: "tasknotes-dependency-link",
						showErrorNotices: true,
					}
				);
				if (item.path !== item.name) {
					infoEl.createDiv({ cls: "task-project-path", text: item.path });
				}
			} else {
				nameEl.textContent = item.name;
				const pathText = item.path ?? item.dependency.uid;
				infoEl.createDiv({ cls: "task-project-path", text: pathText });
			}

			const removeBtn = itemEl.createEl("button", {
				cls: "task-project-remove",
				text: "×",
			});
			setTooltip(removeBtn, this.t("modals.task.dependencies.removeTaskTooltip"), {
				placement: "top",
			});
			removeBtn.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				onRemove(index);
			});
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
		const exists = this.blockedByItems.some(
			(existing) =>
				existing.dependency.uid === item.dependency.uid ||
				(item.path && existing.path === item.path)
		);
		if (exists) {
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
		const exists = this.blockingItems.some(
			(existing) =>
				existing.path === item.path || existing.dependency.uid === item.dependency.uid
		);
		if (exists) {
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
				const candidateUid = formatDependencyLink(
					this.plugin.app,
					sourcePath,
					candidate.path,
					this.plugin.settings.useFrontmatterMarkdownLinks
				);
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
				const candidateUid = formatDependencyLink(
					this.plugin.app,
					sourcePath,
					candidate.path,
					this.plugin.settings.useFrontmatterMarkdownLinks
				);
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
	protected userFields: Record<string, any> = {};

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
	protected getFileByPath(path: string): TAbstractFile | null {
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
	protected getFileCache(file: TFile): any {
		return this.app.metadataCache.getFileCache(file);
	}

	/**
	 * Resolve a link to a file - useful for testing with mocked metadataCache
	 */
	protected resolveLink(linkPath: string, sourcePath: string): TFile | null {
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
				this.handleSave();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		this.initializeFormData().then(() => {
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
		this.splitRightColumn = this.splitContentWrapper.createDiv("modal-split-right");

		// Create primary input area (title or NLP) - subclasses can override
		this.createPrimaryInput(this.splitLeftColumn);

		// Create action bar with icons - goes in left column
		this.createActionBar(this.splitLeftColumn);

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
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = container.createDiv("action-bar");

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
		// The details container wraps the expandable fields (for hide/show animation)
		// It goes inside the left column for proper expand/collapse
		this.detailsContainer = this.splitLeftColumn
			? this.splitLeftColumn.createDiv("details-container")
			: container.createDiv("details-container");

		if (!this.isExpanded) {
			this.detailsContainer.style.display = "none";
			// Also hide the right column when collapsed
			if (this.splitRightColumn) {
				this.splitRightColumn.style.display = "none";
			}
		}

		// Check field configuration to determine which fields to show
		const config = this.plugin.settings.modalFieldsConfig;
		const shouldShowTitle = this.shouldShowField("title", config);
		const shouldShowDetails = this.shouldShowField("details", config);

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
			const detailsEditorContainer = rightColumn.createDiv("details-markdown-editor");

			// Create embeddable markdown editor for details using shared method
			this.detailsMarkdownEditor = this.createMarkdownEditor(detailsEditorContainer, {
				value: this.details,
				placeholder: this.t("modals.task.detailsPlaceholder"),
				cls: "details-editor",
				onChange: (value) => {
					this.details = value;
				},
				onSubmit: () => {
					// Ctrl/Cmd+Enter - save the task
					this.handleSave();
				},
				onEscape: () => {
					// ESC - close the modal
					this.close();
				},
				onTab: () => {
					// Tab - jump to next input field
					this.focusNextField();
					return true; // Prevent default tab behavior
				},
			});
		}

		// Additional form fields (contexts, tags, etc.) go in the details container (left side)
		this.createAdditionalFields(this.detailsContainer);
	}

	/**
	 * Check if a field should be shown based on field configuration
	 */
	protected shouldShowField(fieldId: string, config?: any): boolean {
		// If no config, show all fields (legacy behavior)
		if (!config || !config.fields) {
			return true;
		}

		// Find the field in config
		const field = config.fields.find((f: any) => f.id === fieldId);
		if (!field) {
			// Field not in config, show it by default
			return true;
		}

		// Check if field is enabled and visible for this modal type
		const isVisible = this.isCreationMode() ? field.visibleInCreation : field.visibleInEdit;
		return field.enabled && isVisible;
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

	protected createFieldsFromConfig(container: HTMLElement, config: any): void {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { getFieldsByGroup } = require("../utils/fieldConfigDefaults");
		const fieldGroups = getFieldsByGroup(config, this.isCreationMode());

		// Render fields by group
		const groupsToRender = [...config.groups].sort((a: any, b: any) => a.order - b.order);

		for (const groupConfig of groupsToRender) {
			const fields = fieldGroups.get(groupConfig.id);
			if (!fields || fields.length === 0) continue;

			// Skip basic group (title and details are handled separately)
			if (groupConfig.id === "basic") continue;

			// Create a section for this group if it has fields
			const groupContainer = container.createDiv({ cls: "task-modal__field-group" });

			// Add separator before non-metadata groups
			if (groupConfig.id !== "metadata") {
				container.createEl("hr", { cls: "task-modal__section-separator" });
			}

			// Render fields in this group
			for (const field of fields) {
				this.createField(groupContainer, field);
			}
		}
	}

	protected createField(container: HTMLElement, fieldConfig: any): void {
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
		new Setting(container)
			.setName(this.t("modals.task.organization.projects"))
			.addButton((button) => {
				button
					.setButtonText(this.t("modals.task.organization.addToProjectButton"))
					.setTooltip(this.t("modals.task.projectsTooltip"))
					.onClick(() => {
						const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
							this.addProject(file);
						});
						modal.open();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			});

		// Projects list container (create if it doesn't exist)
		if (!this.projectsList) {
			this.projectsList = container.createDiv({ cls: "task-projects-list" });
		}

		this.renderOrganizationLists();
	}

	protected createSubtasksField(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t("modals.task.organization.subtasks"))
			.addButton((button) => {
				button
					.setButtonText(this.t("modals.task.organization.addSubtasksButton"))
					.setTooltip(this.t("modals.task.organization.addSubtasksTooltip"))
					.onClick(() => {
						void this.openSubtaskSelector();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			});

		// Subtasks list container (create if it doesn't exist)
		if (!this.subtasksList) {
			this.subtasksList = container.createDiv({ cls: "task-projects-list" });
		}

		this.renderOrganizationLists();
	}

	protected createBlockedByField(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t("modals.task.dependencies.blockedBy"))
			.addButton((button) => {
				button
					.setButtonText(this.t("modals.task.dependencies.addTaskButton"))
					.setTooltip(this.t("modals.task.dependencies.selectTaskTooltip"))
					.onClick(() => {
						void this.openBlockedBySelector();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			});

		// Blocked by list container (create if it doesn't exist)
		if (!this.blockedByList) {
			this.blockedByList = container.createDiv({ cls: "task-projects-list" });
		}

		this.renderDependencyLists();
	}

	protected createBlockingField(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t("modals.task.dependencies.blocking"))
			.addButton((button) => {
				button
					.setButtonText(this.t("modals.task.dependencies.addTaskButton"))
					.setTooltip(this.t("modals.task.dependencies.selectTaskTooltip"))
					.onClick(() => {
						void this.openBlockingSelector();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			});

		// Blocking list container (create if it doesn't exist)
		if (!this.blockingList) {
			this.blockingList = container.createDiv({ cls: "task-projects-list" });
		}

		this.renderDependencyLists();
	}

	protected createUserFieldByConfig(container: HTMLElement, fieldConfig: any): void {
		// Find the user field definition
		const userField = this.plugin.settings.userFields?.find(
			(f: any) => f.id === fieldConfig.id
		);
		if (!userField) return;

		// Create the field based on its type (existing logic from createUserFields)
		const setting = new Setting(container).setName(userField.displayName);

		switch (userField.type) {
			case "text":
			case "list": {
				setting.addText((text) => {
					const currentValue = this.userFields[userField.key];
					const displayValue = Array.isArray(currentValue)
						? currentValue.join(", ")
						: currentValue || "";

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

					// Add autocomplete functionality
					new UserFieldSuggest(this.app, text.inputEl, this.plugin, userField);
				});
				break;
			}
			case "number": {
				setting.addText((text) => {
					const currentValue = this.userFields[userField.key];
					text.setValue(currentValue?.toString() || "").onChange((value) => {
						const numValue = parseFloat(value);
						this.userFields[userField.key] = isNaN(numValue) ? null : numValue;
					});
					text.inputEl.type = "number";
				});
				break;
			}
			case "date": {
				setting.addText((text) => {
					const currentValue = this.userFields[userField.key];
					text.setValue(currentValue || "").onChange((value) => {
						this.userFields[userField.key] = value;
					});
					text.inputEl.type = "date";
				});
				break;
			}
			case "boolean": {
				setting.addToggle((toggle) => {
					const currentValue = this.userFields[userField.key];
					toggle.setValue(currentValue === true).onChange((value) => {
						this.userFields[userField.key] = value;
					});
				});
				break;
			}
		}
	}

	protected createUserFields(container: HTMLElement): void {
		const userFieldConfigs = this.plugin.settings?.userFields || [];

		// Add a section separator if there are user fields
		if (userFieldConfigs.length > 0) {
			const separator = container.createDiv({ cls: "user-fields-separator" });
			separator.createDiv({
				text: this.t("modals.task.customFieldsLabel"),
				cls: "detail-label-section",
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
					});
					break;

				case "number":
					new Setting(container).setName(field.displayName).addText((text) => {
						text.setPlaceholder(this.t("modals.task.userFields.numberPlaceholder"))
							.setValue(currentValue ? String(currentValue) : "")
							.onChange((value) => {
								const numValue = parseFloat(value);
								this.userFields[field.key] = isNaN(numValue) ? null : numValue;
							});
					});
					break;

				case "date":
					new Setting(container).setName(field.displayName).addText((text) => {
						text.setPlaceholder(this.t("modals.task.userFields.datePlaceholder"))
							.setValue(currentValue ? String(currentValue) : "")
							.onChange((value) => {
								this.userFields[field.key] = value || null;
							});
						// Add date picker button/icon next to the input
						// Ensure the input and button layout as a single row with proper sizing
						const parent = text.inputEl.parentElement as HTMLElement | null;
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
								? String(currentValue)
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
							.setValue(currentValue ? String(currentValue) : "")
							.onChange((value) => {
								this.userFields[field.key] = value || null;
							});

						// Add autocomplete functionality
						new UserFieldSuggest(this.app, text.inputEl, this.plugin, field);
					});
					break;
			}
		}
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv("modal-button-container");

		// Add "Open note" button for edit modals only
		if (this.isEditMode()) {
			const openNoteButton = buttonContainer.createEl("button", {
				cls: "open-note-button",
				text: this.t("modals.task.buttons.openNote"),
			});

			openNoteButton.addEventListener("click", async () => {
				await (this as any).openTaskNote();
			});
		}

		// Save button (primary action)
		const saveButton = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: this.t("modals.task.buttons.save"),
		});

		saveButton.addEventListener("click", async () => {
			saveButton.disabled = true;
			try {
				await this.handleSave();
				this.close();
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

	protected expandModal(): void {
		if (this.isExpanded) return;

		this.isExpanded = true;
		this.detailsContainer.style.display = "block";
		this.containerEl.addClass("expanded");

		// Also show the right column (details editor) when expanding
		if (this.splitRightColumn) {
			this.splitRightColumn.style.display = "";
		}

		// Animate the expansion
		this.detailsContainer.style.opacity = "0";
		this.detailsContainer.style.transform = "translateY(-10px)";

		setTimeout(() => {
			this.detailsContainer.style.opacity = "1";
			this.detailsContainer.style.transform = "translateY(0)";
		}, 50);
	}

	protected showDateContextMenu(event: UIEvent, type: "due" | "scheduled"): void {
		const currentValue = type === "due" ? this.dueDate : this.scheduledDate;
		const title =
			type === "due"
				? this.t("modals.task.dateMenu.dueTitle")
				: this.t("modals.task.dateMenu.scheduledTitle");

		const menu = new DateContextMenu({
			currentValue: currentValue ? getDatePart(currentValue) : undefined,
			currentTime: currentValue ? getTimePart(currentValue) : undefined,
			title: title,
			plugin: this.plugin,
			app: this.app,
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

		menu.show(event);
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
				iconEl.style.color = ""; // Reset to default
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
				iconEl.style.color = ""; // Reset to default
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
		setTimeout(() => {
			this.titleInput.focus();
			this.titleInput.select();
		}, 100);
	}

	protected addProject(file: TAbstractFile): void {
		// Avoid duplicates
		if (this.selectedProjectItems.some((existing) => existing.file?.path === file.path)) {
			return;
		}

		if (file instanceof TFile) {
			this.selectedProjectItems.push({
				file,
				name: file.basename,
				link: this.buildProjectReference(file, this.getCurrentTaskPath() || ""),
			});
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
		// Convert project string to ProjectItem objects
		// This handles both old plain string projects and new [[link]] format
		this.selectedProjectItems = [];

		// Use the task's path as the source for resolving relative links
		const sourcePath = this.getCurrentTaskPath() || "";

		for (const projectString of projects) {
			// Skip null, undefined, or empty strings
			if (
				!projectString ||
				typeof projectString !== "string" ||
				projectString.trim() === ""
			) {
				continue;
			}

			// Check if it's a wiki link format
			const linkMatch = projectString.match(/^\[\[([^\]]+)\]\]$/);
			if (linkMatch) {
				const linkPath = linkMatch[1];
				const file = this.resolveLink(linkPath, sourcePath);
				if (file) {
					// Resolved link
					this.selectedProjectItems.push({
						file,
						name: file.basename,
						link: projectString,
					});
				} else {
					// Unresolved link - still add it!
					const displayName = linkPath.split("|")[0]; // Strip alias if present
					this.selectedProjectItems.push({
						name: displayName,
						link: projectString,
						unresolved: true,
					});
				}
			} else {
				// Check if it's a markdown link format [text](path)
				const markdownMatch = projectString.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
				if (markdownMatch) {
					const linkPath = parseLinkToPath(projectString);
					const file = this.resolveLink(linkPath, sourcePath);
					if (file) {
						// Resolved markdown link
						this.selectedProjectItems.push({
							file,
							name: file.basename,
							link: projectString,
						});
					} else {
						// Unresolved markdown link
						const displayName = markdownMatch[1] || linkPath;
						this.selectedProjectItems.push({
							name: displayName,
							link: projectString,
							unresolved: true,
						});
					}
				} else {
					// For backwards compatibility, try to find a file with this name
					const files = this.getMarkdownFiles();
					const matchingFile = files.find(
						(f) => f.basename === projectString || f.name === projectString + ".md"
					);
					if (matchingFile) {
						this.selectedProjectItems.push({
							file: matchingFile,
							name: matchingFile.basename,
							link: `[[${matchingFile.basename}]]`,
						});
					} else {
						// Plain text - preserve as-is
						this.selectedProjectItems.push({
							name: projectString,
							link: projectString,
							unresolved: true,
						});
					}
				}
			}
		}
		this.updateProjectsFromFiles();
		// Don't render immediately - let the caller decide when to render
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
			const cacheManager: any = this.plugin.cacheManager;
			const allTasks: TaskInfo[] = (await cacheManager?.getAllTasks?.()) ?? [];

			// Filter out tasks that are already subtasks and the current task (if editing)
			const currentTaskPath = this.isEditMode() ? (this as any).task?.path : undefined;
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

			openTaskSelector(this.plugin, candidates, async (subtask) => {
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
		this.renderSubtasksList();
	}

	protected removeSubtask(file: TAbstractFile): void {
		this.selectedSubtaskFiles = this.selectedSubtaskFiles.filter(
			(existing) => existing.path !== file.path
		);
		this.renderSubtasksList();
	}

	protected renderSubtasksList(): void {
		if (!this.subtasksList) return;

		this.subtasksList.empty();

		if (this.selectedSubtaskFiles.length === 0) {
			return;
		}

		this.selectedSubtaskFiles.forEach((file) => {
			if (!(file instanceof TFile)) return;

			const subtaskItem = this.subtasksList.createDiv({ cls: "task-project-item" });
			const infoEl = subtaskItem.createDiv({ cls: "task-project-info" });
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
		});
	}

	protected renderOrganizationLists(): void {
		this.renderProjectsList();
		this.renderSubtasksList();
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

	protected focusNextField(): void {
		// Try to focus the contexts input as the next field after details
		setTimeout(() => {
			if (this.contextsInput) {
				this.contextsInput.focus();
			} else if (this.tagsInput) {
				this.tagsInput.focus();
			} else if (this.timeEstimateInput) {
				this.timeEstimateInput.focus();
			}
		}, 50);
	}

	/**
	 * Creates an embeddable markdown editor with standard configuration and error handling
	 * @param container - The parent HTML element
	 * @param options - Editor configuration options
	 * @returns The created editor instance or null if creation fails
	 */
	protected createMarkdownEditor(
		container: HTMLElement,
		options: {
			value: string;
			placeholder: string;
			cls: string;
			onChange: (value: string) => void;
			onSubmit: () => void;
			onEscape: () => void;
			onTab: () => boolean;
			extensions?: any[];
		}
	): EmbeddableMarkdownEditor | null {
		try {
			return new EmbeddableMarkdownEditor(this.app, container, options);
		} catch (error) {
			console.error("Failed to create markdown editor:", error);

			// Create fallback textarea
			const fallbackTextarea = container.createEl("textarea", {
				cls: options.cls + "-fallback",
				placeholder: options.placeholder,
			});
			fallbackTextarea.value = options.value;
			fallbackTextarea.addEventListener("input", (e) => {
				options.onChange((e.target as HTMLTextAreaElement).value);
			});
			fallbackTextarea.addEventListener("keydown", (e) => {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					options.onSubmit();
				} else if (e.key === "Escape") {
					e.preventDefault();
					options.onEscape();
				} else if (e.key === "Tab") {
					const shouldPreventDefault = options.onTab();
					if (shouldPreventDefault) {
						e.preventDefault();
					}
				}
			});

			return null;
		}
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

/**
 * Context suggestion object for compatibility with other plugins
 */
interface ContextSuggestion {
	value: string;
	display: string;
	type: "context";
	toString(): string;
}

/**
 * Context suggestion provider using AbstractInputSuggest
 */
class ContextSuggest extends AbstractInputSuggest<ContextSuggestion> {
	private plugin: TaskNotesPlugin;
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, plugin: TaskNotesPlugin) {
		super(app, inputEl);
		this.plugin = plugin;
		this.input = inputEl;
	}

	protected async getSuggestions(_: string): Promise<ContextSuggestion[]> {
		// Handle comma-separated values
		const currentValues = this.input.value.split(",").map((v: string) => v.trim());
		const currentQuery = currentValues[currentValues.length - 1];

		if (!currentQuery) return [];

		const contexts = this.plugin.cacheManager.getAllContexts();
		return contexts
			.filter((context) => context && typeof context === "string")
			.filter(
				(context) =>
					context.toLowerCase().includes(currentQuery.toLowerCase()) &&
					!currentValues.slice(0, -1).includes(context)
			)
			.slice(0, 10)
			.map((context) => ({
				value: context,
				display: context,
				type: "context" as const,
				toString() {
					return this.value;
				},
			}));
	}

	public renderSuggestion(contextSuggestion: ContextSuggestion, el: HTMLElement): void {
		el.textContent = contextSuggestion.display;
	}

	public selectSuggestion(contextSuggestion: ContextSuggestion): void {
		const currentValues = this.input.value.split(",").map((v: string) => v.trim());
		currentValues[currentValues.length - 1] = contextSuggestion.value;
		this.input.value = currentValues.join(", ") + ", ";

		// Trigger input event to update internal state
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.focus();
	}
}

/**
 * Tag suggestion object for compatibility with other plugins
 */
interface TagSuggestion {
	value: string;
	display: string;
	type: "tag";
	toString(): string;
}

/**
 * Tag suggestion provider using AbstractInputSuggest
 */
class TagSuggest extends AbstractInputSuggest<TagSuggestion> {
	private plugin: TaskNotesPlugin;
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, plugin: TaskNotesPlugin) {
		super(app, inputEl);
		this.plugin = plugin;
		this.input = inputEl;
	}

	protected async getSuggestions(_: string): Promise<TagSuggestion[]> {
		// Handle comma-separated values
		const currentValues = this.input.value.split(",").map((v: string) => v.trim());
		const currentQuery = currentValues[currentValues.length - 1];

		if (!currentQuery) return [];

		const tags = this.plugin.cacheManager.getAllTags();
		return tags
			.filter((tag) => tag && typeof tag === "string")
			.filter(
				(tag) =>
					tag.toLowerCase().includes(currentQuery.toLowerCase()) &&
					!currentValues.slice(0, -1).includes(tag)
			)
			.slice(0, 10)
			.map((tag) => ({
				value: tag,
				display: tag,
				type: "tag" as const,
				toString() {
					return this.value;
				},
			}));
	}

	public renderSuggestion(tagSuggestion: TagSuggestion, el: HTMLElement): void {
		el.textContent = tagSuggestion.display;
	}

	public selectSuggestion(tagSuggestion: TagSuggestion): void {
		const currentValues = this.input.value.split(",").map((v: string) => v.trim());
		currentValues[currentValues.length - 1] = tagSuggestion.value;
		this.input.value = currentValues.join(", ") + ", ";

		// Trigger input event to update internal state
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.focus();
	}
}

/**
 * User field suggestion object
 */
interface UserFieldSuggestion {
	value: string;
	display: string;
	type: "user-field";
	fieldKey: string;
	toString(): string;
}

/**
 * User field suggestion provider using AbstractInputSuggest
 */
class UserFieldSuggest extends AbstractInputSuggest<UserFieldSuggestion> {
	private plugin: TaskNotesPlugin;
	private input: HTMLInputElement;
	private fieldConfig: any; // UserMappedField from settings

	constructor(app: App, inputEl: HTMLInputElement, plugin: TaskNotesPlugin, fieldConfig: any) {
		super(app, inputEl);
		this.plugin = plugin;
		this.input = inputEl;
		this.fieldConfig = fieldConfig;
	}

	protected async getSuggestions(_: string): Promise<UserFieldSuggestion[]> {
		const isListField = this.fieldConfig.type === "list";

		// Get current token or full value
		let currentQuery = "";
		let currentValues: string[] = [];
		if (isListField) {
			currentValues = this.input.value.split(",").map((v: string) => v.trim());
			currentQuery = currentValues[currentValues.length - 1] || "";
		} else {
			currentQuery = this.input.value.trim();
		}
		if (!currentQuery) return [];

		// Detect wikilink trigger [[... and delegate to file suggester
		const wikiMatch = currentQuery.match(/\[\[([^\]]*)$/);
		if (wikiMatch) {
			const partial = wikiMatch[1] || "";
			const { FileSuggestHelper } = await import("../suggest/FileSuggestHelper");
			// Apply custom field filter if configured, otherwise show all files
			const list = await FileSuggestHelper.suggest(
				this.plugin,
				partial,
				20,
				this.fieldConfig.autosuggestFilter
			);
			return list.map((item) => ({
				value: item.insertText,
				display: item.displayText,
				type: "user-field" as const,
				fieldKey: this.fieldConfig.key,
				toString() {
					return this.value;
				},
			}));
		}

		// Fallback to existing-values suggestion
		const existingValues = await this.getExistingUserFieldValues(this.fieldConfig.key);
		return existingValues
			.filter((value) => value && typeof value === "string")
			.filter(
				(value) =>
					value.toLowerCase().includes(currentQuery.toLowerCase()) &&
					(!isListField || !currentValues.slice(0, -1).includes(value))
			)
			.slice(0, 10)
			.map((value) => ({
				value: value,
				display: value,
				type: "user-field" as const,
				fieldKey: this.fieldConfig.key,
				toString() {
					return this.value;
				},
			}));
	}

	private async getExistingUserFieldValues(fieldKey: string): Promise<string[]> {
		const run = async (): Promise<string[]> => {
			try {
				// Get all files and extract unique values for this field
				const allFiles = this.plugin.app.vault.getMarkdownFiles();
				const values = new Set<string>();

				// Process all files, but with early termination for performance
				for (const file of allFiles) {
					try {
						const metadata = this.plugin.app.metadataCache.getFileCache(file);
						const frontmatter = metadata?.frontmatter;

						if (frontmatter && frontmatter[fieldKey] !== undefined) {
							const value = frontmatter[fieldKey];

							if (Array.isArray(value)) {
								// Handle list fields
								value.forEach((v) => {
									if (typeof v === "string" && v.trim()) {
										values.add(v.trim());
									}
								});
							} else if (typeof value === "string" && value.trim()) {
								values.add(value.trim());
							} else if (typeof value === "number") {
								values.add(value.toString());
							} else if (typeof value === "boolean") {
								values.add(value.toString());
							}
						}

						// Early termination: stop after finding many unique values for performance
						// This ensures we get comprehensive suggestions without processing every file
						if (values.size >= 200) {
							break;
						}
					} catch (error) {
						// Skip files with errors
						continue;
					}
				}

				return Array.from(values).sort();
			} catch (error) {
				console.error("Error getting user field values:", error);
				return [];
			}
		};

		// Use debouncing for performance in large vaults (same pattern as FileSuggestHelper)
		const debounceMs = this.plugin.settings?.suggestionDebounceMs ?? 0;
		if (!debounceMs) {
			return run();
		}

		return new Promise<string[]>((resolve) => {
			const anyPlugin = this.plugin as unknown as { __userFieldSuggestTimer?: number };
			if (anyPlugin.__userFieldSuggestTimer) {
				clearTimeout(anyPlugin.__userFieldSuggestTimer);
			}
			anyPlugin.__userFieldSuggestTimer = setTimeout(async () => {
				const results = await run();
				resolve(results);
			}, debounceMs) as unknown as number;
		});
	}

	public renderSuggestion(suggestion: UserFieldSuggestion, el: HTMLElement): void {
		el.textContent = suggestion.display;
	}

	public selectSuggestion(suggestion: UserFieldSuggestion): void {
		const isListField = this.fieldConfig.type === "list";

		if (isListField) {
			// Replace last token with the selected suggestion. If user is typing a
			// wikilink region ([[...), replace that partial region; otherwise
			// replace the token entirely with the suggestion value.
			const parts = this.input.value.split(",");
			const last = parts.pop() ?? "";
			const before = parts.join(",");
			const trimmed = last.trim();
			const replacement = /\[\[/.test(trimmed)
				? trimmed.replace(/\[\[[^\]]*$/, `[[${suggestion.value}]]`)
				: suggestion.value;
			const rebuilt = (before ? before + ", " : "") + replacement;
			this.input.value = rebuilt.endsWith(",") ? rebuilt + " " : rebuilt + ", ";
		} else {
			// Replace the active [[... region or entire value
			const val = this.input.value;
			const replaced = val.replace(/\[\[[^\]]*$/, `[[${suggestion.value}]]`);
			this.input.value = replaced === val ? suggestion.value : replaced;
		}

		// Trigger input event to update internal state
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.input.focus();
	}
}
