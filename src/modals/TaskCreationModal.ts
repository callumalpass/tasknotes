import { App, Notice, setIcon, setTooltip, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskInfo } from "../types";
import { calculateDefaultDate, sanitizeTags } from "../utils/helpers";
import {
	NaturalLanguageParser,
	ParsedTaskData as NLParsedTaskData,
} from "../services/NaturalLanguageParser";
import { combineDateAndTime } from "../utils/dateUtils";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

import type {
	EmbeddableMarkdownEditor,
	MarkdownEditorProps,
} from "../editor/EmbeddableMarkdownEditor";
import { createNLPAutocomplete } from "../editor/NLPCodeMirrorAutocomplete";
import { buildCreationBlockingUpdates, buildTaskCreationData } from "./taskCreationData";
import { NLPSuggest } from "./taskCreationSuggest";
export type { StatusSuggestion } from "./taskCreationSuggest";

export type TaskCreationPrepopulatedValues = Partial<TaskInfo> & {
	customFrontmatter?: Record<string, unknown>;
};

export interface TaskCreationOptions {
	prePopulatedValues?: TaskCreationPrepopulatedValues;
	onTaskCreated?: (task: TaskInfo) => void;
	creationContext?: "manual-creation" | "modal-inline-creation"; // Folder behavior context
}

function createEmbeddableMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: Partial<MarkdownEditorProps>
): EmbeddableMarkdownEditor {
	// Lazy-load because the editor module resolves Obsidian internals during evaluation.
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Modal editor is lazy-loaded to avoid evaluating Obsidian internals during import.
	const editorModule = require("../editor/EmbeddableMarkdownEditor") as typeof import("../editor/EmbeddableMarkdownEditor");
	return new editorModule.EmbeddableMarkdownEditor(app, container, options);
}

export class TaskCreationModal extends TaskModal {
	private options: TaskCreationOptions;
	private nlParser: NaturalLanguageParser;
	private nlInput: HTMLTextAreaElement; // Legacy - keeping for compatibility
	private nlMarkdownEditor: EmbeddableMarkdownEditor | null = null;
	private nlPreviewContainer: HTMLElement;
	private nlButtonContainer: HTMLElement;
	private nlpSuggest: NLPSuggest | null = null; // Will be replaced with CodeMirror autocomplete

	// Track event listeners for cleanup
	private eventListeners: Array<{
		element: HTMLElement | HTMLTextAreaElement;
		event: string;
		handler: EventListener;
	}> = [];

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskCreationOptions = {}) {
		super(app, plugin);
		this.options = options;
		this.nlParser = NaturalLanguageParser.fromPlugin(plugin);
	}

	getModalTitle(): string {
		return this.t("modals.taskCreation.title");
	}

	protected isCreationMode(): boolean {
		return true;
	}

	/**
	 * Add an event listener and track it for cleanup
	 */
	private addTrackedEventListener(
		element: HTMLElement | HTMLTextAreaElement,
		event: string,
		handler: EventListener
	): void {
		element.addEventListener(event, handler);
		this.eventListeners.push({ element, event, handler });
	}

	/**
	 * Remove all tracked event listeners
	 */
	private removeAllEventListeners(): void {
		for (const { element, event, handler } of this.eventListeners) {
			element.removeEventListener(event, handler);
		}
		this.eventListeners = [];
	}

	/**
	 * Override to use NLP input when enabled, otherwise fall back to title input
	 */
	protected createPrimaryInput(container: HTMLElement): void {
		if (this.plugin.settings.enableNaturalLanguageInput) {
			this.createNaturalLanguageInput(container);
		} else {
			// Fall back to regular title input
			this.createTitleInput(container);
			// When NLP is disabled, start with the modal expanded
			this.isExpanded = true;
			this.containerEl.addClass("expanded");
		}
	}

	/**
	 * Override to re-render projects list after modal content is created
	 */
	protected createAdditionalSections(container: HTMLElement): void {
		// Re-render projects list if pre-populated values were applied or defaults are set
		if (
			(this.options.prePopulatedValues && this.options.prePopulatedValues.projects) ||
			this.selectedProjectItems.length > 0
		) {
			this.renderProjectsList();
		}
	}

	private createNaturalLanguageInput(container: HTMLElement): void {
		const nlContainer = container.createDiv("nl-input-container");

		// Create markdown editor container
		const editorContainer = nlContainer.createDiv(
			"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--nlp"
		);
		editorContainer.setAttribute("role", "textbox");
		editorContainer.setAttribute("aria-label", this.t("modals.taskCreation.nlPlaceholder"));
		editorContainer.setAttribute("aria-multiline", "true");

		// Preview container
		this.nlPreviewContainer = nlContainer.createDiv("nl-preview-container");
		this.nlPreviewContainer.setAttribute("role", "status");
		this.nlPreviewContainer.setAttribute("aria-live", "polite");
		this.nlPreviewContainer.setAttribute("aria-label", "Task preview");

		try {
			// Create NLP autocomplete extension for @, #, +, status triggers
			// Returns array: [autocomplete, keymap]
			const nlpAutocomplete = createNLPAutocomplete(this.plugin);

			// Create embeddable markdown editor with autocomplete
			this.nlMarkdownEditor = createEmbeddableMarkdownEditor(this.app, editorContainer, {
				value: "",
				placeholder: this.t("modals.taskCreation.nlPlaceholder"),
				cls: "nlp-editor",
				extensions: nlpAutocomplete, // Add autocomplete extensions (array)
				enterVimInsertMode: true, // Auto-enter insert mode when vim is enabled (#1410)
				onChange: (value) => {
					// Update preview as user types
					if (value.trim()) {
						this.updateNaturalLanguagePreview(value.trim());
					} else {
						this.clearNaturalLanguagePreview();
					}
				},
				onSubmit: (_editor, shift) => {
					// Ctrl+Enter - save the task
					void this.handleSubmitShortcut(shift);
				},
				onEscape: () => {
					// ESC - close the modal (only when not in vim insert mode)
					// Vim mode will handle its own ESC to exit insert mode
					this.close();
				},
				onTab: (shift) => {
					if (shift) {
						return false;
					}
					// Tab - jump to title input (expand form if needed)
					if (!this.isExpanded) {
						this.expandModal();
					}
					// Focus title input
					window.setTimeout(() => {
						const titleInput = this.modalEl.querySelector(
							".title-input-detailed"
						) as HTMLInputElement;
						if (titleInput) {
							titleInput.focus();
						}
					}, 50);
					return true; // Prevent default tab behavior
				},
				onEnter: (editor, mod, shift) => {
					if (mod) {
						// Ctrl/Cmd+Enter - save (already handled by onSubmit)
						return true;
					}
					if (shift) {
						// Shift+Enter - allow newline
						return false;
					}
					// Normal Enter - allow new line
					return false;
				},
			});

			// Focus the editor after a short delay and reset scroll position
			window.setTimeout(() => {
				if (this.nlMarkdownEditor) {
					const cm = this.nlMarkdownEditor.editor?.cm;
					if (cm) {
						cm.focus();
						// Reset scroll to top to prevent auto-scroll down
						cm.scrollDOM.scrollTop = 0;
					}
				}
			}, 100);
		} catch (error) {
			console.error("Failed to create NLP markdown editor:", error);
			// Fallback to textarea if editor creation fails
			this.nlInput = editorContainer.createEl("textarea", {
				cls: "nl-input",
				attr: {
					placeholder: this.t("modals.taskCreation.nlPlaceholder"),
					rows: "3",
				},
			});

			// Event listeners for fallback - track them for cleanup
			const inputHandler = () => {
				const input = this.nlInput.value.trim();
				if (input) {
					this.updateNaturalLanguagePreview(input);
				} else {
					this.clearNaturalLanguagePreview();
				}
			};
			this.addTrackedEventListener(this.nlInput, "input", inputHandler);

			const keydownHandler = (e: Event) => {
				const input = this.nlInput.value.trim();
				if (!input) return;

				const keyEvent = e as KeyboardEvent;
				if (keyEvent.key === "Enter" && (keyEvent.ctrlKey || keyEvent.metaKey)) {
					keyEvent.preventDefault();
					void this.handleSubmitShortcut(keyEvent.shiftKey);
				} else if (keyEvent.key === "Tab" && keyEvent.shiftKey) {
					keyEvent.preventDefault();
					this.parseAndFillForm(input);
				}
			};
			this.addTrackedEventListener(this.nlInput, "keydown", keydownHandler);

			// Initialize auto-suggestion for fallback
			this.nlpSuggest = new NLPSuggest(this.app, this.nlInput, this.plugin);

			window.setTimeout(() => {
				this.nlInput.focus();
			}, 100);
		}
	}

	private updateNaturalLanguagePreview(input: string): void {
		if (!this.nlPreviewContainer) return;

		const parsed = this.nlParser.parseInput(input);
		const previewData = this.nlParser.getPreviewData(parsed);

		if (previewData.length > 0 && parsed.title) {
			this.nlPreviewContainer.empty();
			this.nlPreviewContainer.classList.remove(
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.nlPreviewContainer.classList.add("tn-static-display-block-2a1b75c9");

			previewData.forEach((item) => {
				const previewItem = this.nlPreviewContainer.createDiv("nl-preview-item");
				previewItem.textContent = item.text;
			});
		} else {
			this.clearNaturalLanguagePreview();
		}
	}

	private clearNaturalLanguagePreview(): void {
		if (this.nlPreviewContainer) {
			this.nlPreviewContainer.empty();
			this.nlPreviewContainer.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.nlPreviewContainer.classList.add("tn-static-display-none-6b99de8b");
		}
	}

	/**
	 * Get the current NLP input value from either markdown editor or fallback textarea
	 */
	private getNLPInputValue(): string {
		if (this.nlMarkdownEditor) {
			return this.nlMarkdownEditor.value;
		} else if (this.nlInput) {
			return this.nlInput.value;
		}
		return "";
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = container.createDiv("tn-task-modal__action-bar");

		// NLP-specific icons (only if NLP is enabled)
		if (this.plugin.settings.enableNaturalLanguageInput) {
			// Fill form icon
			this.createActionIcon(
				this.actionBar,
				"wand",
				this.t("modals.taskCreation.actions.fillFromNaturalLanguage"),
				(icon, event) => {
					const input = this.getNLPInputValue().trim();
					if (input) {
						this.parseAndFillForm(input);
					}
				}
			);

			// Expand/collapse icon
			this.createActionIcon(
				this.actionBar,
				this.isExpanded ? "chevron-up" : "chevron-down",
				this.isExpanded
					? this.t("modals.taskCreation.actions.hideDetailedOptions")
					: this.t("modals.taskCreation.actions.showDetailedOptions"),
				(icon, event) => {
					this.toggleDetailedForm();
					// Update icon and tooltip
					const iconEl = icon.querySelector(".icon");
					if (iconEl) {
						setIcon(
							iconEl as HTMLElement,
							this.isExpanded ? "chevron-up" : "chevron-down"
						);
					}
					setTooltip(
						icon,
						this.isExpanded
							? this.t("modals.taskCreation.actions.hideDetailedOptions")
							: this.t("modals.taskCreation.actions.showDetailedOptions"),
						{ placement: "top" }
					);
				}
			);

			// Add separator
			const separator = this.actionBar.createDiv("action-separator");
			separator.classList.remove(
				"tn-static-width-100-0466783d",
				"tn-static-width-12px-fbf353fb",
				"tn-static-width-16px-7375d50b",
				"tn-static-width-200px-2acaf3b5",
				"tn-static-width-60px-bd09c419",
				"tn-static-width-80px-8573bae3"
			);
			separator.classList.add("tn-static-width-1px-aa77e27e");
			separator.classList.remove(
				"tn-static-display-flex-4d51fc62",
				"tn-static-height-0-7a31cef0",
				"tn-static-height-100-62264068",
				"tn-static-height-12px-06c0747e",
				"tn-static-height-16px-30de4aee",
				"tn-static-min-height-800px-997b4c8c"
			);
			separator.classList.add("tn-static-height-24px-29a11d37");
			separator.classList.remove(
				"tn-static-background-color-var-background-se-9087a23e",
				"tn-static-background-color-var-color-base-40-ef5f175e",
				"tn-static-background-color-var-color-red-134bc721",
				"tn-static-background-color-var-text-accent-a954c70f"
			);
			separator.classList.add("tn-static-background-color-var-background-mo-94b219f0");
			separator.classList.remove(
				"tn-static-margin-0-11696618",
				"tn-static-margin-0-auto-266e9b04",
				"tn-static-margin-0-db0d5f36",
				"tn-static-margin-2px-0-edce9b14",
				"tn-static-margin-8px-0-0-0-a2eb8382",
				"tn-static-padding-12px-43bef435",
				"tn-static-padding-20px-ebe8e48c"
			);
			separator.classList.add("tn-static-margin-0-var-size-4-2-77f7dc08");
		}

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

	private parseAndFillForm(input: string): void {
		const parsed = this.nlParser.parseInput(input);
		this.applyParsedData(parsed);

		// Expand the form to show filled fields
		if (!this.isExpanded) {
			this.expandModal();
		}
	}

	private applyParsedData(parsed: NLParsedTaskData): void {
		if (parsed.title) this.title = parsed.title;
		if (parsed.status) this.status = parsed.status;
		if (parsed.priority) this.priority = parsed.priority;

		// Handle due date with time
		if (parsed.dueDate) {
			this.dueDate = parsed.dueTime
				? combineDateAndTime(parsed.dueDate, parsed.dueTime)
				: parsed.dueDate;
		}

		// Handle scheduled date with time
		if (parsed.scheduledDate) {
			this.scheduledDate = parsed.scheduledTime
				? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime)
				: parsed.scheduledDate;
		}

		if (parsed.contexts && parsed.contexts.length > 0)
			this.contexts = parsed.contexts.join(", ");
		// Projects will be handled in the form input update section below
		if (parsed.tags && parsed.tags.length > 0) this.tags = sanitizeTags(parsed.tags.join(", "));
		if (parsed.details) this.details = parsed.details;
		if (parsed.recurrence) this.recurrenceRule = parsed.recurrence;
		if (parsed.estimate !== undefined) {
			this.timeEstimate = parsed.estimate > 0 ? parsed.estimate : 0;
			if (this.timeEstimateInput) {
				this.timeEstimateInput.value =
					this.timeEstimate > 0 ? this.timeEstimate.toString() : "";
			}
		}

		// Update form inputs if they exist
		if (this.titleInput) this.titleInput.value = this.title;
		if (this.detailsInput) this.detailsInput.value = this.details;
		if (this.detailsMarkdownEditor) this.detailsMarkdownEditor.setValue(this.details);
		if (this.contextsInput) this.contextsInput.value = this.contexts;
		if (this.tagsInput) this.tagsInput.value = this.tags;

		// Handle projects differently - they use file selection, not text input
		if (parsed.projects && parsed.projects.length > 0) {
			this.addProjectsFromStrings(parsed.projects);
			this.renderProjectsList();
		}

		// Handle user-defined fields
		if (parsed.userFields) {
			for (const [fieldId, value] of Object.entries(parsed.userFields)) {
				const userField = this.plugin.settings.userFields?.find((f) => f.id === fieldId);
				if (userField) {
					this.userFields[userField.key] = value;
				}
			}
			this.updateUserFieldControls();
		}

		// Update icon states
		this.updateIconStates();
	}

	private toggleDetailedForm(): void {
		if (this.isExpanded) {
			// Collapse
			this.isExpanded = false;
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
			this.containerEl.removeClass("expanded");
		} else {
			// Expand
			this.expandModal();
		}
	}

	async initializeFormData(): Promise<void> {
		// Initialize with default values from settings
		this.priority = this.plugin.settings.defaultTaskPriority;
		this.status = this.plugin.settings.defaultTaskStatus;

		// Apply task creation defaults
		const defaults = this.plugin.settings.taskCreationDefaults;

		// Apply default due date
		this.dueDate = calculateDefaultDate(defaults.defaultDueDate);

		// Apply default scheduled date based on user settings
		this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);

		// Apply default contexts, tags, and projects
		this.contexts = defaults.defaultContexts || "";
		this.tags = defaults.defaultTags || "";

		// Apply default projects
		if (defaults.defaultProjects) {
			const projectStrings = splitListPreservingLinksAndQuotes(defaults.defaultProjects);
			if (projectStrings.length > 0) {
				this.initializeProjectsFromStrings(projectStrings);
			}
		}

		// Apply default time estimate
		if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
			this.timeEstimate = defaults.defaultTimeEstimate;
		}

		// Apply default reminders
		if (defaults.defaultReminders && defaults.defaultReminders.length > 0) {
			// Import the conversion function
			const { convertDefaultRemindersToReminders } = await import("../utils/settingsUtils");
			this.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
		}

		// Apply default values for user-defined fields
		if (this.plugin.settings.userFields) {
			for (const field of this.plugin.settings.userFields) {
				if (field.defaultValue !== undefined) {
					// For date fields, convert preset values (today, tomorrow, next-week) to actual dates
					if (field.type === "date" && typeof field.defaultValue === "string") {
						const datePreset = field.defaultValue as
							| "none"
							| "today"
							| "tomorrow"
							| "next-week";
						const calculatedDate = calculateDefaultDate(datePreset);
						if (calculatedDate) {
							this.userFields[field.key] = calculatedDate;
						}
					} else {
						this.userFields[field.key] = field.defaultValue;
					}
				}
			}
		}

		// Apply pre-populated values if provided (overrides defaults)
		if (this.options.prePopulatedValues) {
			this.applyPrePopulatedValues(this.options.prePopulatedValues);
		}

		this.details = this.normalizeDetails(this.details);
		this.originalDetails = this.details;
	}

	private applyPrePopulatedValues(values: TaskCreationPrepopulatedValues): void {
		if (values.title !== undefined) this.title = values.title;
		if (values.due !== undefined) this.dueDate = values.due;
		if (values.scheduled !== undefined) this.scheduledDate = values.scheduled;
		if (values.priority !== undefined) this.priority = values.priority;
		if (values.status !== undefined) this.status = values.status;
		if (values.contexts !== undefined) {
			this.contexts = values.contexts.join(", ");
		}
		if (values.projects !== undefined) {
			// Filter out null, undefined, or empty strings before checking if we have valid projects
			const validProjects = values.projects.filter(
				(p) => p && typeof p === "string" && p.trim() !== ""
			);
			if (validProjects.length > 0) {
				this.initializeProjectsFromStrings(values.projects);
			}
			this.renderProjectsList();
		}
		if (values.tags !== undefined) {
			this.tags = sanitizeTags(
				values.tags.filter((tag) => tag !== this.plugin.settings.taskTag).join(", ")
			);
		}
		if (values.timeEstimate !== undefined) this.timeEstimate = values.timeEstimate;
		if (values.recurrence !== undefined && typeof values.recurrence === "string") {
			this.recurrenceRule = values.recurrence;
		}
		if (values.recurrence_anchor !== undefined) {
			this.recurrenceAnchor = values.recurrence_anchor;
		}
		if (values.customFrontmatter) {
			for (const [fieldKey, fieldValue] of Object.entries(values.customFrontmatter)) {
				this.userFields[fieldKey] = fieldValue;
			}
		}
	}

	protected async handleSubmitShortcut(shift: boolean): Promise<void> {
		await this.handleSave({ createAnother: shift });
	}

	async handleSave(options: { createAnother?: boolean } = {}): Promise<void> {
		// If NLP is enabled and there's content in the NL field, parse it first
		if (this.plugin.settings.enableNaturalLanguageInput) {
			const nlContent = this.getNLPInputValue().trim();
			if (nlContent && !this.title.trim()) {
				// Only auto-parse if no title has been manually entered
				const parsed = this.nlParser.parseInput(nlContent);
				this.applyParsedData(parsed);
			}
		}

		if (!this.validateForm()) {
			new Notice(this.t("modals.taskCreation.notices.titleRequired"));
			return;
		}

		try {
			const taskData = this.buildTaskData();
			// Disable defaults since they were already applied to form fields in initializeFormData()
			const result = await this.plugin.taskService.createTask(taskData, {
				applyDefaults: false,
			});
			let createdTask = result.taskInfo;

			// Check if filename was changed due to length constraints
			const expectedFilename = result.taskInfo.title.replace(/[<>:"/\\|?*]/g, "").trim();
			const actualFilename = result.file.basename;

			if (actualFilename.startsWith("task-") && actualFilename !== expectedFilename) {
				new Notice(
					this.t("modals.taskCreation.notices.successShortened", {
						title: createdTask.title,
					})
				);
			} else {
				new Notice(
					this.t("modals.taskCreation.notices.success", { title: createdTask.title })
				);
			}

			if (this.blockingItems.length > 0) {
				const blockingUpdates = buildCreationBlockingUpdates(this.blockingItems);

				if (blockingUpdates.added.length > 0) {
					await this.plugin.taskService.updateBlockingRelationships(
						createdTask,
						blockingUpdates.added,
						[],
						blockingUpdates.raw
					);
					const refreshed = await this.plugin.cacheManager.getTaskInfo(createdTask.path);
					if (refreshed) {
						createdTask = refreshed;
					}
				}

				if (blockingUpdates.unresolved.length > 0) {
					new Notice(
						this.t("modals.taskCreation.notices.blockingUnresolved", {
							entries: blockingUpdates.unresolved.join(", "),
						})
					);
				}

				this.blockingItems = [];
			}

			// Handle subtask assignments
			if (this.selectedSubtaskFiles.length > 0) {
				await this.applySubtaskAssignments(createdTask);
			}

			if (this.options.onTaskCreated) {
				this.options.onTaskCreated(createdTask);
			}

			this.close();

			if (options.createAnother) {
				window.setTimeout(() => {
					new TaskCreationModal(this.app, this.plugin, this.options).open();
				}, 0);
			}
		} catch (error) {
			console.error("Failed to create task:", error);
			const message = error instanceof Error && error.message ? error.message : String(error);
			new Notice(this.t("modals.taskCreation.notices.failure", { message }));
		}
	}

	private buildTaskData(): Partial<TaskInfo> {
		const taskData = buildTaskCreationData({
			title: this.title,
			dueDate: this.dueDate,
			scheduledDate: this.scheduledDate,
			priority: this.priority,
			status: this.status,
			contexts: this.contexts,
			projects: this.projects,
			tags: this.tags,
			timeEstimate: this.timeEstimate,
			recurrenceRule: this.recurrenceRule,
			recurrenceAnchor: this.recurrenceAnchor,
			reminders: this.reminders,
			blockedByItems: this.blockedByItems,
			details: this.details,
			userFields: this.userFields,
			creationContext: this.options.creationContext,
			taskIdentificationMethod: this.plugin.settings.taskIdentificationMethod,
			taskTag: this.plugin.settings.taskTag,
			normalizeDetails: (value) => this.normalizeDetails(value),
		});
		const prePopulatedCustomFrontmatter = this.options.prePopulatedValues?.customFrontmatter;
		if (prePopulatedCustomFrontmatter) {
			taskData.customFrontmatter = {
				...prePopulatedCustomFrontmatter,
				...taskData.customFrontmatter,
			};
		}

		return taskData;
	}

	// Override to prevent creating duplicate title input when NLP is enabled
	protected createTitleInput(container: HTMLElement): void {
		// Only create title input if NLP is disabled
		if (!this.plugin.settings.enableNaturalLanguageInput) {
			super.createTitleInput(container);
		}
	}

	protected async applySubtaskAssignments(createdTask: TaskInfo): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(createdTask.path);
		if (!(currentTaskFile instanceof TFile)) return;

		for (const subtaskFile of this.selectedSubtaskFiles) {
			try {
				const subtaskInfo = await this.plugin.cacheManager.getTaskInfo(subtaskFile.path);
				if (!subtaskInfo) continue;

				const projectReference = this.buildProjectReference(
					currentTaskFile,
					subtaskFile.path
				);
				const legacyReference = `[[${currentTaskFile.basename}]]`;
				const currentProjects = Array.isArray(subtaskInfo.projects)
					? subtaskInfo.projects
					: [];

				if (
					currentProjects.includes(projectReference) ||
					currentProjects.includes(legacyReference)
				) {
					continue;
				}

				const sanitizedProjects = currentProjects.filter(
					(entry) => entry !== legacyReference
				);
				const updatedProjects = [...sanitizedProjects, projectReference];
				await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);
			} catch (error) {
				console.error("Failed to assign subtask:", error);
			}
		}
	}

	onClose(): void {
		// Clean up markdown editor if it exists
		if (this.nlMarkdownEditor) {
			this.nlMarkdownEditor.destroy();
			this.nlMarkdownEditor = null;
		}

		// Clean up NLP suggest
		if (this.nlpSuggest) {
			// NLPSuggest extends AbstractInputSuggest which has a close method
			this.nlpSuggest.close();
			this.nlpSuggest = null;
		}

		// Remove all tracked event listeners
		this.removeAllEventListeners();

		super.onClose();
	}
}
