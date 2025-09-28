import {
	App,
	Modal,
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
import { TaskInfo, Reminder } from "../types";
import { formatDependencyLink, resolveDependencyEntry } from "../utils/dependencyUtils";
import { appendInternalLink, type LinkServices } from "../ui/renderers/linkRenderer";

interface DependencyItem {
	raw: string;
	name: string;
	path?: string;
	unresolved?: boolean;
}

export abstract class TaskModal extends Modal {
	plugin: TaskNotesPlugin;

	// Dependency item definition
	protected createDependencyItemFromFile(
		file: TFile,
		options: { sourcePath?: string } = {}
	): DependencyItem {
		const sourcePath = options.sourcePath ?? this.getDependencySourcePath();
		const raw = formatDependencyLink(this.plugin.app, sourcePath, file.path);
		return {
			raw,
			path: file.path,
			name: file.basename,
		};
	}

	protected createDependencyItemFromRaw(raw: string, sourcePath?: string): DependencyItem {
		const resolution = resolveDependencyEntry(
			this.plugin.app,
			sourcePath ?? this.getDependencySourcePath(),
			raw
		);
		if (resolution) {
			const name = resolution.file?.basename || resolution.path.split("/").pop() || raw;
			return {
				raw,
				path: resolution.path,
				name,
			};
		}

		const cleaned = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
		return {
			raw,
			name: cleaned || raw,
			unresolved: true,
		};
	}

	protected createDependencyItemFromPath(path: string): DependencyItem {
		const sourcePath = this.getDependencySourcePath();
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return {
				raw: formatDependencyLink(this.plugin.app, sourcePath, file.path),
				path: file.path,
				name: file.basename,
			};
		}

		const basename = path.split("/").pop() || path;
		const raw = `[[${basename.replace(/\.md$/i, "")}]]`;
		return {
			raw,
			path,
			name: basename.replace(/\.md$/i, ""),
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
						entries: item.raw,
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
					item.path.replace(/\.md$/i, ""),
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
				const pathText = item.path ?? item.raw;
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
		return value.replace(/\r\n/g, "\n");
	}

	protected addBlockedByTask(file: TFile): void {
		const currentPath = this.getCurrentTaskPath();
		if (currentPath && file.path === currentPath) {
			return;
		}
		const item = this.createDependencyItemFromFile(file);
		const exists = this.blockedByItems.some(
			(existing) => existing.path === item.path || existing.raw === item.raw
		);
		if (exists) {
			return;
		}
		this.blockedByItems.push(item);
		this.renderBlockedByList();
	}

	protected addBlockingTask(file: TFile): void {
		const currentPath = this.getCurrentTaskPath();
		if (currentPath && file.path === currentPath) {
			return;
		}
		const item = this.createDependencyItemFromFile(file);
		const exists = this.blockingItems.some((existing) => existing.path === item.path);
		if (exists) {
			return;
		}
		this.blockingItems.push(item);
		this.renderBlockingList();
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
	protected reminders: Reminder[] = [];

	// User-defined fields (dynamic based on settings)
	protected userFields: Record<string, any> = {};

	// Dependency fields
	protected blockedByItems: DependencyItem[] = [];
	protected blockingItems: DependencyItem[] = [];
	protected blockedByList?: HTMLElement;
	protected blockingList?: HTMLElement;

	// Project link storage
	protected selectedProjectFiles: TAbstractFile[] = [];

	// UI elements
	protected titleInput: HTMLInputElement;
	protected detailsInput: HTMLTextAreaElement;
	protected contextsInput: HTMLInputElement;
	protected projectsInput: HTMLInputElement;
	protected tagsInput: HTMLInputElement;
	protected timeEstimateInput: HTMLInputElement;
	protected projectsList: HTMLElement;
	protected actionBar: HTMLElement;
	protected detailsContainer: HTMLElement;
	protected isExpanded = false;

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app);
		this.plugin = plugin;
	}

	protected t(key: string, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
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

		// Set the modal title using the standard Obsidian approach (preserves close button)
		this.titleEl.setText(this.getModalTitle());

		// Add TaskNotes icon at the beginning of the title
		const iconContainer = this.titleEl.createSpan("modal-header-icon");
		setIcon(iconContainer, "tasknotes-simple");
		this.titleEl.insertBefore(iconContainer, this.titleEl.firstChild);

		this.initializeFormData().then(() => {
			this.createModalContent();
			this.focusTitleInput();
		});
	}

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Create main container
		const container = contentEl.createDiv("minimalist-modal-container");

		// Create title input (prominent)
		this.createTitleInput(container);

		// Create action bar with icons
		this.createActionBar(container);

		// Create collapsible details section
		this.createDetailsSection(container);

		// Create save/cancel buttons
		this.createActionButtons(container);
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
			(icon, event) => {
				this.showDateContextMenu(event, "due");
			},
			"due-date"
		);

		// Scheduled date icon
		this.createActionIcon(
			this.actionBar,
			"calendar-clock",
			this.t("modals.task.actions.scheduled"),
			(icon, event) => {
				this.showDateContextMenu(event, "scheduled");
			},
			"scheduled-date"
		);

		// Status icon
		this.createActionIcon(
			this.actionBar,
			"dot-square",
			this.t("modals.task.actions.status"),
			(icon, event) => {
				this.showStatusContextMenu(event);
			},
			"status"
		);

		// Priority icon
		this.createActionIcon(
			this.actionBar,
			"star",
			this.t("modals.task.actions.priority"),
			(icon, event) => {
				this.showPriorityContextMenu(event);
			},
			"priority"
		);

		// Recurrence icon
		this.createActionIcon(
			this.actionBar,
			"refresh-ccw",
			this.t("modals.task.actions.recurrence"),
			(icon, event) => {
				this.showRecurrenceContextMenu(event);
			},
			"recurrence"
		);

		// Reminder icon
		this.createActionIcon(
			this.actionBar,
			"bell",
			this.t("modals.task.actions.reminders"),
			(icon, event) => {
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
		onClick: (icon: HTMLElement, event: MouseEvent) => void,
		dataType?: string
	): HTMLElement {
		const iconContainer = container.createDiv("action-icon");
		iconContainer.setAttribute("aria-label", tooltip);
		// Store initial tooltip for later updates but don't set title attribute
		iconContainer.setAttribute("data-initial-tooltip", tooltip);

		// Add data attribute for easier identification
		if (dataType) {
			iconContainer.setAttribute("data-type", dataType);
		}

		const icon = iconContainer.createSpan("icon");
		setIcon(icon, iconName);

		iconContainer.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick(iconContainer, event);
		});

		return iconContainer;
	}

	protected createDetailsSection(container: HTMLElement): void {
		this.detailsContainer = container.createDiv("details-container");
		if (!this.isExpanded) {
			this.detailsContainer.style.display = "none";
		}

		// Title field appears in details section for:
		// 1. Edit modals (always)
		// 2. Creation modals when NLP is enabled (since the main title input is replaced by NLP textarea)
		const isEditModal = this.isEditMode();
		const isCreationWithNLP =
			this.isCreationMode() && this.plugin.settings.enableNaturalLanguageInput;

		if (isEditModal || isCreationWithNLP) {
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

			// Store reference for creation modals with NLP
			if (isCreationWithNLP && !this.titleInput) {
				this.titleInput = titleInputDetailed;
			}
		}

		// Details textarea (only for creation modals, not edit modals)
		if (!this.isEditMode()) {
			const detailsLabel = this.detailsContainer.createDiv("detail-label");
			detailsLabel.textContent = this.t("modals.task.detailsLabel");

			this.detailsInput = this.detailsContainer.createEl("textarea", {
				cls: "details-input",
				placeholder: this.t("modals.task.detailsPlaceholder"),
			});

			this.detailsInput.value = this.details;
			this.detailsInput.addEventListener("input", (e) => {
				this.details = (e.target as HTMLTextAreaElement).value;
			});
		}

		// Additional form fields (contexts, tags, etc.) can be added here
		this.createAdditionalFields(this.detailsContainer);
	}

	protected createAdditionalFields(container: HTMLElement): void {
		// Projects - now using note selection instead of text input
		new Setting(container).setName(this.t("modals.task.projectsLabel")).addButton((button) => {
			button
				.setButtonText(this.t("modals.task.projectsAdd"))
				.setTooltip(this.t("modals.task.projectsTooltip"))
				.onClick(() => {
					const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
						this.addProject(file);
					});
					modal.open();
				});
			// Add consistent button classes for transparent styling
			button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
		});

		// Projects list container
		this.projectsList = container.createDiv({ cls: "task-projects-list" });
		// Don't render immediately - will be rendered after form data is initialized

		// Contexts input with autocomplete
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

		// Tags input with autocomplete
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

		// Time estimate
		new Setting(container).setName(this.t("modals.task.timeEstimateLabel")).addText((text) => {
			text.setPlaceholder(this.t("modals.task.timeEstimatePlaceholder"))
				.setValue(this.timeEstimate.toString())
				.onChange((value) => {
					this.timeEstimate = parseInt(value) || 0;
				});

			this.timeEstimateInput = text.inputEl;
		});

		this.createDependencyFields(container);

		// Dynamic user fields
		this.createUserFields(container);
	}

	protected createDependencyFields(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t("modals.task.dependencies.blockedBy"))
			.addButton((button) => {
				button
					.setButtonText(this.t("modals.task.dependencies.addTaskButton"))
					.setTooltip(this.t("modals.task.dependencies.selectTaskTooltip"))
					.onClick(() => {
						const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
							if (file instanceof TFile) {
								this.addBlockedByTask(file);
							}
						});
						modal.open();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			});

		this.blockedByList = container.createDiv({ cls: "task-projects-list" });

		new Setting(container)
			.setName(this.t("modals.task.dependencies.blocking"))
			.addButton((button) => {
				button
					.setButtonText(this.t("modals.task.dependencies.addTaskButton"))
					.setTooltip(this.t("modals.task.dependencies.selectTaskTooltip"))
					.onClick(() => {
						const modal = new ProjectSelectModal(this.app, this.plugin, (file) => {
							if (file instanceof TFile) {
								this.addBlockingTask(file);
							}
						});
						modal.open();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			});

		this.blockingList = container.createDiv({ cls: "task-projects-list" });

		this.renderDependencyLists();
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
		const buttonContainer = container.createDiv("button-container");

		// Add "Open note" button for edit modals only
		if (this.isEditMode()) {
			const openNoteButton = buttonContainer.createEl("button", {
				cls: "open-note-button",
				text: this.t("modals.task.buttons.openNote"),
			});

			openNoteButton.addEventListener("click", async () => {
				await (this as any).openTaskNote();
			});

			// Spacer to push Save/Cancel to the right
			buttonContainer.createDiv("button-spacer");
		}

		// Save button
		const saveButton = buttonContainer.createEl("button", {
			cls: "save-button",
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
			cls: "cancel-button",
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

		// Animate the expansion
		this.detailsContainer.style.opacity = "0";
		this.detailsContainer.style.transform = "translateY(-10px)";

		setTimeout(() => {
			this.detailsContainer.style.opacity = "1";
			this.detailsContainer.style.transform = "translateY(0)";
		}, 50);
	}

	protected showDateContextMenu(event: MouseEvent, type: "due" | "scheduled"): void {
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

	protected showStatusContextMenu(event: MouseEvent): void {
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

	protected showPriorityContextMenu(event: MouseEvent): void {
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

	protected showRecurrenceContextMenu(event: MouseEvent): void {
		const menu = new RecurrenceContextMenu({
			currentValue: this.recurrenceRule,
			onSelect: (value) => {
				this.recurrenceRule = value || "";
				this.updateRecurrenceIconState();
			},
			app: this.app,
			plugin: this.plugin,
		});

		menu.show(event);
	}

	protected showReminderContextMenu(event: MouseEvent): void {
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
		if (this.selectedProjectFiles.some((existing) => existing.path === file.path)) {
			return;
		}

		this.selectedProjectFiles.push(file);
		this.updateProjectsFromFiles();
		this.renderProjectsList();
	}

	protected removeProject(file: TAbstractFile): void {
		this.selectedProjectFiles = this.selectedProjectFiles.filter(
			(existing) => existing.path !== file.path
		);
		this.updateProjectsFromFiles();
		this.renderProjectsList();
	}

	protected updateProjectsFromFiles(): void {
		// Convert selected files to markdown links using generateMarkdownLink
		const currentFile = this.app.workspace.getActiveFile();
		const sourcePath = currentFile?.path || "";

		this.projects = this.selectedProjectFiles
			.map((file) => {
				// fileToLinktext expects TFile, so cast safely since we know these are markdown files
				const linkText = this.app.metadataCache.fileToLinktext(
					file as TFile,
					sourcePath,
					true
				);
				return `[[${linkText}]]`;
			})
			.join(", ");
	}

	protected initializeProjectsFromStrings(projects: string[]): void {
		// Convert project strings to files
		// This handles both old plain string projects and new [[link]] format
		this.selectedProjectFiles = [];

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
				const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, "");
				if (file) {
					this.selectedProjectFiles.push(file);
				}
			} else {
				// For backwards compatibility, try to find a file with this name
				const files = this.app.vault.getMarkdownFiles();
				const matchingFile = files.find(
					(f) => f.basename === projectString || f.name === projectString + ".md"
				);
				if (matchingFile) {
					this.selectedProjectFiles.push(matchingFile);
				}
			}
		}

		this.updateProjectsFromFiles();
		// Don't render immediately - let the caller decide when to render
	}

	protected renderProjectsList(): void {
		if (!this.projectsList) return;

		this.projectsList.empty();

		if (this.selectedProjectFiles.length === 0) {
			return;
		}

		this.selectedProjectFiles.forEach((file) => {
			const projectItem = this.projectsList.createDiv({ cls: "task-project-item" });

			// Info container
			const infoEl = projectItem.createDiv({ cls: "task-project-info" });

			// File name
			const nameEl = infoEl.createSpan({ cls: "task-project-name" });
			nameEl.textContent = file.name;

			// File path (if different from name)
			if (file.path !== file.name) {
				const pathEl = infoEl.createDiv({ cls: "task-project-path" });
				pathEl.textContent = file.path;
			}

			// Remove button
			const removeBtn = projectItem.createEl("button", {
				cls: "task-project-remove",
				text: "×",
			});
			setTooltip(removeBtn, this.t("modals.task.projectsRemoveTooltip"), {
				placement: "top",
			});
			removeBtn.addEventListener("click", () => {
				this.removeProject(file);
			});
		});
	}

	protected validateForm(): boolean {
		return this.title.trim().length > 0;
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

	protected async getSuggestions(query: string): Promise<ContextSuggestion[]> {
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

	protected async getSuggestions(query: string): Promise<TagSuggestion[]> {
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

	protected async getSuggestions(query: string): Promise<UserFieldSuggestion[]> {
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
			const list = await FileSuggestHelper.suggest(this.plugin, partial);
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
