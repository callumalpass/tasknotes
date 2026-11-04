import { displayError } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { App, Notice, setIcon, setTooltip, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal, type TaskSubmitOptions } from "./TaskModal";
import { TaskInfo } from "../types";
import { sanitizeTags } from "../utils/helpers";
import {
	NaturalLanguageParser,
	ParsedTaskData as NLParsedTaskData,
} from "../services/NaturalLanguageParser";
import { combineDateAndTime } from "../utils/dateUtils";

import type {
	EmbeddableMarkdownEditor,
	MarkdownEditorProps,
} from "../editor/EmbeddableMarkdownEditor";
import { createNLPAutocomplete } from "../editor/NLPCodeMirrorAutocomplete";
import { createNLPHighlight } from "../editor/NLPHighlight";
import { buildCreationBlockingUpdates, buildTaskCreationData } from "./taskCreationData";
import {
	buildTaskCreationFormState,
	type TaskCreationPrepopulatedValues,
} from "./taskCreationFormState";
import { applyTaskCreationSubtaskAssignments } from "./taskCreationSubtasks";
import { getTaskFilenameNotice } from "../utils/filenameGenerator";
import type { TaskFormNaturalLanguageLayer } from "./taskFormModel";
import { setTaskModalDetailsCollapsed } from "./taskModalLayout";
import type { TaskModalProjectItem } from "./taskModalProjects";
import { runTaskSaveFollowUps, type TaskSaveOutcome } from "./taskModalSave";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

import {
	createLinkedAttachmentEntries,
	getLinkedAttachmentReferences,
	hasPendingAttachments,
} from "./taskModalAttachments";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TaskCreationModal" });
export type { StatusSuggestion } from "./taskCreationSuggest";

const TASK_CREATION_FAILURE_PREFIX = "Failed to create task: ";
const NLP_TAB_ORDER_SELECTOR = [
	"button",
	"a[href]",
	"input",
	"select",
	"textarea",
	"[tabindex]:not([tabindex='-1'])",
	".tn-task-modal__markdown-editor--nlp",
].join(", ");
const NATIVE_FOCUSABLE_TAG_NAMES = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

type PotentiallyDisabledElement = HTMLElement & { disabled?: boolean };

function isFocusableModalElement(element: HTMLElement): boolean {
	if ((element as PotentiallyDisabledElement).disabled) {
		return false;
	}

	return element.tabIndex >= 0 || NATIVE_FOCUSABLE_TAG_NAMES.has(element.tagName);
}

export function getTaskCreationFailureNoticeMessage(error: unknown): string {
	const rawMessage = error instanceof Error && error.message ? error.message : String(error);
	return rawMessage.startsWith(TASK_CREATION_FAILURE_PREFIX)
		? rawMessage.slice(TASK_CREATION_FAILURE_PREFIX.length)
		: rawMessage;
}

export interface TaskCreationOptions {
	prePopulatedValues?: TaskCreationPrepopulatedValues;
	onTaskCreated?: (task: TaskInfo) => void;
	creationContext?: "manual-creation" | "modal-inline-creation"; // Folder behavior context
}

type OpenTaskAfterCreationMode = TaskNotesPlugin["settings"]["openTaskAfterCreation"];
type CreatedTaskOpenMode = Exclude<OpenTaskAfterCreationMode, "none">;

export function shouldOpenCreatedTaskAfterSave(
	mode: OpenTaskAfterCreationMode | undefined,
	options: { createAnother?: boolean },
	hasCreationCallback: boolean
): mode is CreatedTaskOpenMode {
	return (
		(mode === "same-tab" || mode === "new-tab") &&
		!options.createAnother &&
		!hasCreationCallback
	);
}

export async function openCreatedTaskFileAfterSave(
	app: App,
	file: TFile,
	mode: CreatedTaskOpenMode
): Promise<void> {
	const leaf = mode === "new-tab" ? app.workspace.getLeaf("tab") : app.workspace.getLeaf(false);
	await leaf.openFile(file);
}

function createEmbeddableMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: Partial<MarkdownEditorProps>
): EmbeddableMarkdownEditor {
	// Lazy-load because the editor module resolves Obsidian internals during evaluation.
	/* eslint-disable @typescript-eslint/no-require-imports -- Modal editor is lazy-loaded to avoid evaluating Obsidian internals during import. */
	const editorModule =
		require("../editor/EmbeddableMarkdownEditor") as typeof import("../editor/EmbeddableMarkdownEditor");
	/* eslint-enable @typescript-eslint/no-require-imports -- Re-enable after the isolated lazy import. */
	return new editorModule.EmbeddableMarkdownEditor(app, container, options);
}

export class TaskCreationModal extends TaskModal {
	protected readonly mode = "create";
	private options: TaskCreationOptions;
	private nlParser: NaturalLanguageParser;
	private nlContainer: HTMLElement | null = null;
	private nlMarkdownEditor: EmbeddableMarkdownEditor | null = null;
	private nlEditorFailed = false;
	private nlProjectInput = "";
	private nlProjectItems: TaskModalProjectItem[] = [];

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskCreationOptions = {}) {
		super(app, plugin);
		this.options = options;
		this.nlParser = NaturalLanguageParser.fromPlugin(plugin);
	}

	getModalTitle(): string {
		return this.t(msg({ message: "Create task", context: "modals.taskCreation.title" }));
	}

	private usesNaturalLanguage(): boolean {
		return this.plugin.settings.enableNaturalLanguageInput && !this.nlEditorFailed;
	}

	protected showsTitleInDetails(): boolean {
		return this.usesNaturalLanguage();
	}

	protected getTitleErrorAnchor(): HTMLElement | null {
		return this.nlContainer ?? super.getTitleErrorAnchor();
	}

	/** Without natural language the title input is the primary field, with everything visible. */
	protected createPrimaryInput(container: HTMLElement): void {
		if (this.usesNaturalLanguage()) {
			this.createNaturalLanguageInput(container);
		}
		if (!this.usesNaturalLanguage()) {
			super.createPrimaryInput(container);
			this.isExpanded = true;
			this.containerEl.addClass("expanded");
		}
	}

	private createNaturalLanguageInput(container: HTMLElement): void {
		const nlContainer = container.createDiv("nl-input-container");

		// Create markdown editor container
		const editorContainer = nlContainer.createDiv(
			"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--nlp"
		);
		editorContainer.setAttribute("role", "textbox");
		editorContainer.setAttribute("aria-label", this.t(msg({ message: "Buy groceries tomorrow at 3pm @home #errands", context: "modals.taskCreation.nlPlaceholder" })));
		editorContainer.setAttribute("aria-multiline", "true");

		try {
			// Create NLP autocomplete extension for @, #, +, status triggers
			// Returns array: [autocomplete, keymap]
			const nlpAutocomplete = createNLPAutocomplete(this.plugin);

			// Create embeddable markdown editor with autocomplete
			this.nlMarkdownEditor = createEmbeddableMarkdownEditor(this.app, editorContainer, {
				value: "",
				placeholder: this.t(msg({ message: "Buy groceries tomorrow at 3pm @home #errands", context: "modals.taskCreation.nlPlaceholder" })),
				cls: "nlp-editor",
				extensions: [
					...nlpAutocomplete,
					createNLPHighlight((text) => this.nlParser.parseInputWithSpans(text).spans),
				],
				enterVimInsertMode: true, // Auto-enter insert mode when vim is enabled (#1410)
				onChange: () => {
					this.syncNaturalLanguageInput();
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
				onTab: (_editor, shift) => {
					if (shift) {
						return this.focusPreviousNaturalLanguageField(editorContainer);
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
					if (!this.plugin.settings.nlpEnterToSubmit) {
						// Normal Enter - allow new line
						return false;
					}
					if (editor.hasSelectableCompletion) {
						// Enter belongs to the visible suggestion. If it opened too recently
						// to accept, swallow the key so it neither saves nor adds a newline.
						editor.acceptCompletion();
						return true;
					}
					// Enter saves when enabled; Shift+Enter (above) still inserts a newline
					void this.handleSubmitShortcut(false);
					return true;
				},
			});
			this.nlContainer = nlContainer;
		} catch (error) {
			tasknotesLogger.error("Failed to create NLP markdown editor:", {
				category: "persistence",
				operation: "create-nlp-markdown-editor",
				error: error,
			});
			nlContainer.remove();
			this.nlEditorFailed = true;
		}
	}

	private focusPreviousNaturalLanguageField(editorContainer: HTMLElement): boolean {
		const root = this.modalEl.contains(editorContainer) ? this.modalEl : this.contentEl;
		const orderedElements = Array.from(
			root.querySelectorAll<HTMLElement>(NLP_TAB_ORDER_SELECTOR)
		);
		const currentIndex = orderedElements.findIndex(
			(element) => element === editorContainer || editorContainer.contains(element)
		);

		if (currentIndex <= 0) {
			return true;
		}

		const previousElement = orderedElements
			.slice(0, currentIndex)
			.reverse()
			.find(isFocusableModalElement);

		if (previousElement) {
			window.setTimeout(() => {
				previousElement.focus();
			}, 50);
		}

		return true;
	}

	protected focusTitleInput(): void {
		if (!this.usesNaturalLanguage()) {
			super.focusTitleInput();
			return;
		}

		window.setTimeout(() => {
			if (this.containerEl.querySelector(".tn-popover")) return;
			const cm = this.nlMarkdownEditor?.editor?.cm;
			if (cm) {
				cm.focus();
				cm.scrollDOM.scrollTop = 0;
			}
		}, this.getInitialFocusDelay());
	}

	private getNLPInputValue(): string {
		return this.nlMarkdownEditor?.value ?? "";
	}

	protected createActionBar(container: HTMLElement): void {
		this.actionBar = container.createDiv("tn-task-modal__action-bar");
		this.createCoreActionIcons(this.actionBar);

		if (this.usesNaturalLanguage()) {
			const toggle = this.createActionIcon(
				this.actionBar,
				this.isExpanded ? "chevron-up" : "chevron-down",
				this.getDetailedFormToggleLabel(),
				(icon) => {
					this.toggleDetailedForm();
					const iconEl = icon.querySelector(".icon");
					if (iconEl) {
						setIcon(
							iconEl as HTMLElement,
							this.isExpanded ? "chevron-up" : "chevron-down"
						);
					}
					setTooltip(icon, this.getDetailedFormToggleLabel(), { placement: "top" });
				}
			);
			toggle.addClass("tn-task-modal__details-toggle");
		}

		this.updateIconStates();
	}

	private getDetailedFormToggleLabel(): string {
		return this.isExpanded
			? this.t(msg({ message: "Hide detailed options", context: "modals.taskCreation.actions.hideDetailedOptions" }))
			: this.t(msg({ message: "Show detailed options", context: "modals.taskCreation.actions.showDetailedOptions" }));
	}

	/** Keep the form in step with the text: each change replaces what the last parse set. */
	private syncNaturalLanguageInput(): void {
		const input = this.getNLPInputValue().trim();
		const parsed = input ? this.nlParser.parseInputForModal(input) : null;
		this.syncNaturalLanguageProjects(parsed?.projects ?? []);
		this.form.applyNaturalLanguage(parsed ? this.buildNaturalLanguageLayer(parsed) : {});
	}

	private buildNaturalLanguageLayer(parsed: NLParsedTaskData): TaskFormNaturalLanguageLayer {
		const layer: TaskFormNaturalLanguageLayer = {};

		if (parsed.title) layer.title = parsed.title;
		if (parsed.status) layer.status = parsed.status;
		if (parsed.priority) layer.priority = parsed.priority;
		if (parsed.dueDate) {
			layer.dueDate = parsed.dueTime
				? combineDateAndTime(parsed.dueDate, parsed.dueTime)
				: parsed.dueDate;
		}
		if (parsed.scheduledDate) {
			layer.scheduledDate = parsed.scheduledTime
				? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime)
				: parsed.scheduledDate;
		}
		if (parsed.contexts && parsed.contexts.length > 0) {
			layer.contexts = parsed.contexts.join(", ");
		}
		if (parsed.tags && parsed.tags.length > 0) {
			layer.tags = sanitizeTags(parsed.tags.join(", "));
		}
		if (parsed.details) layer.details = parsed.details;
		if (parsed.recurrence) layer.recurrenceRule = parsed.recurrence;
		if (parsed.estimate !== undefined) layer.timeEstimate = Math.max(parsed.estimate, 0);

		if (parsed.userFields) {
			layer.userFields = {};
			for (const [fieldId, value] of Object.entries(parsed.userFields)) {
				const userField = this.plugin.settings.userFields?.find((f) => f.id === fieldId);
				if (userField) layer.userFields[userField.key] = value;
			}
		}

		return layer;
	}

	/** Projects are chosen as files rather than held in a text field, so they sync separately. */
	private syncNaturalLanguageProjects(projects: string[]): void {
		const projectInput = projects.join("\n");
		if (projectInput === this.nlProjectInput) return;
		this.nlProjectInput = projectInput;

		const manualItems = this.selectedProjectItems.filter(
			(item) => !this.nlProjectItems.includes(item)
		);
		this.selectedProjectItems = manualItems;
		this.addProjectsFromStrings(projects);
		this.nlProjectItems = this.selectedProjectItems.filter(
			(item) => !manualItems.includes(item)
		);
		this.renderProjectsList();
	}

	private toggleDetailedForm(): void {
		if (!this.isExpanded) {
			this.expandModal();
			return;
		}

		this.isExpanded = false;
		setTaskModalDetailsCollapsed(
			{ detailsContainer: this.detailsContainer, splitRightColumn: this.splitRightColumn },
			true
		);
		this.containerEl.removeClass("expanded");
	}

	async initializeFormData(): Promise<void> {
		const formState = buildTaskCreationFormState({
			defaultPriority: this.plugin.settings.defaultTaskPriority,
			defaultStatus: this.plugin.settings.defaultTaskStatus,
			taskCreationDefaults: this.plugin.settings.taskCreationDefaults,
			taskTag: this.plugin.settings.taskTag,
			userFields: this.plugin.settings.userFields,
			prePopulatedValues: this.options.prePopulatedValues,
		});

		this.form.values.title = formState.title;
		this.form.values.dueDate = formState.dueDate;
		this.form.values.scheduledDate = formState.scheduledDate;
		this.form.values.priority = formState.priority;
		this.form.values.status = formState.status;
		this.form.values.contexts = formState.contexts;
		this.form.values.tags = formState.tags;
		this.form.values.timeEstimate = formState.timeEstimate;
		this.form.values.recurrenceRule = formState.recurrenceRule;
		this.form.values.recurrenceAnchor = formState.recurrenceAnchor;
		this.form.values.reminders = formState.reminders;
		this.form.values.userFields = formState.userFields;

		if (formState.projectStrings.length > 0) {
			this.initializeProjectsFromStrings(formState.projectStrings);
		}

		this.attachmentEntries = createLinkedAttachmentEntries(
			this.options.prePopulatedValues?.attachments,
			""
		);

		this.form.values.details = this.normalizeDetails(this.form.values.details);
		this.originalDetails = this.form.values.details;

		// A prefilled title has to be visible next to the empty natural language field.
		this.isExpanded = Boolean(this.form.values.title || this.form.values.details);
	}

	protected hasUnsavedChanges(): boolean {
		return (
			this.form.isDirty() ||
			this.getNLPInputValue().trim().length > 0 ||
			this.blockingItems.length > 0 ||
			this.blockedByItems.length > 0 ||
			this.selectedSubtaskFiles.length > 0 ||
			hasPendingAttachments(this.attachmentEntries)
		);
	}

	async handleSave(options: TaskSubmitOptions = {}): Promise<TaskSaveOutcome> {
		// A title cleared by hand falls back to the natural language text.
		if (!this.form.values.title.trim()) {
			this.form.releaseField("title");
			this.syncNaturalLanguageInput();
		}

		if (!this.validateForm()) {
			return { status: "failed" };
		}

		let result: Awaited<ReturnType<TaskNotesPlugin["taskService"]["createTask"]>>;
		try {
			// Disable defaults since they were already applied to form fields in initializeFormData()
			result = await this.plugin.taskService.createTask(this.buildTaskData(), {
				applyDefaults: false,
			});
		} catch (error) {
			tasknotesLogger.error("Failed to create task:", {
				category: "persistence",
				operation: "create-task",
				error: error,
			});
			const message = getTaskCreationFailureNoticeMessage(error);
			new Notice(this.t(msg({ message: "Failed to create task: {message}", context: "modals.taskCreation.notices.failure" }), { message: displayError(message) }));
			return { status: "failed" };
		}

		// The task exists from here on: a failed step is reported, never retried by saving again.
		let createdTask = result.taskInfo;
		this.showTaskCreatedNotice(createdTask, result.file);

		const reportFollowUpFailure = (error: unknown): void => {
			tasknotesLogger.error("Failed to finish creating task:", {
				category: "persistence",
				operation: "finish-task-creation",
				error: error,
			});
			new Notice(
				this.t(msg({ message: "Task created, but a follow-up step failed: {message}", context: "modals.taskCreation.notices.followUpFailure" }), {
					message: displayError(error instanceof Error ? error.message : String(error)),
				})
			);
		};

		const outcome = await runTaskSaveFollowUps([
			{
				// Disk files are copied only now that the task exists, next to its note.
				run: async () => {
					if (!hasPendingAttachments(this.attachmentEntries)) return;
					const imported = await this.importPendingAttachments(createdTask.path);
					try {
						createdTask = await this.plugin.taskService.updateTask(createdTask, {
							attachments: imported.references,
						});
					} catch (error) {
						await imported.rollback();
						throw error;
					}
				},
				onError: (error) => {
					tasknotesLogger.error("Failed to import task attachments:", {
						category: "persistence",
						operation: "import-task-attachments",
						error: error,
					});
					new Notice(
						this.t(msg({ message: "Task created, but some attachments could not be imported: {message}", context: "modals.taskCreation.notices.attachmentImportFailure" }), {
							message: displayError(error instanceof Error ? error.message : String(error)),
						})
					);
				},
			},
			{
				run: async () => {
					createdTask = await this.applyBlockingItems(createdTask);
				},
				onError: reportFollowUpFailure,
			},
			{
				run: async () => {
					if (this.selectedSubtaskFiles.length > 0) {
						await this.applySubtaskAssignments(createdTask);
					}
				},
				onError: reportFollowUpFailure,
			},
			{
				run: async () => {
					this.options.onTaskCreated?.(createdTask);
				},
				onError: reportFollowUpFailure,
			},
		]);

		await this.openCreatedTaskIfConfigured(result.file, options);
		return outcome;
	}

	protected afterSubmit(options: TaskSubmitOptions): void {
		if (options.createAnother) {
			window.setTimeout(() => {
				const nextModal = new TaskCreationModal(this.app, this.plugin, this.options);
				nextModal.createMore = this.createMore;
				nextModal.open();
			}, 0);
		}
	}

	private showTaskCreatedNotice(createdTask: TaskInfo, file: TFile): void {
		const filenameNotice = getTaskFilenameNotice(
			this.plugin.settings,
			createdTask.title,
			file.basename
		);
		if (filenameNotice === "shortened") {
			new Notice(
				this.t(msg({ message: "Task \"{title}\" created successfully (filename shortened due to length)", context: "modals.taskCreation.notices.successShortened" }), {
					title: createdTask.title,
				})
			);
		} else if (filenameNotice === "sanitized") {
			new Notice(
				this.t(msg({ message: "Task \"{title}\" created as file \"{filename}\". Filenames cannot contain some characters, so the full title is kept in the title property.", context: "modals.taskCreation.notices.successFilenameSanitized" }), {
					title: createdTask.title,
					filename: file.basename,
				})
			);
		} else {
			new Notice(
				this.t(msg({ message: "Task \"{title}\" created successfully", context: "modals.taskCreation.notices.success" }), { title: createdTask.title })
			);
		}
	}

	private async applyBlockingItems(createdTask: TaskInfo): Promise<TaskInfo> {
		if (this.blockingItems.length === 0) return createdTask;

		const blockingUpdates = buildCreationBlockingUpdates(this.blockingItems);
		if (blockingUpdates.unresolved.length > 0) {
			new Notice(
				this.t(msg({ message: "Could not resolve: {entries}", context: "modals.taskCreation.notices.blockingUnresolved" }), {
					entries: blockingUpdates.unresolved.join(", "),
				})
			);
		}
		if (blockingUpdates.added.length === 0) return createdTask;

		await this.plugin.taskService.updateBlockingRelationships(
			createdTask,
			blockingUpdates.added,
			[],
			blockingUpdates.raw
		);
		return (await this.plugin.cacheManager.getTaskInfo(createdTask.path)) ?? createdTask;
	}

	private async openCreatedTaskIfConfigured(
		file: TFile,
		options: { createAnother?: boolean }
	): Promise<void> {
		const mode = this.plugin.settings.openTaskAfterCreation ?? "none";
		if (!shouldOpenCreatedTaskAfterSave(mode, options, Boolean(this.options.onTaskCreated))) {
			return;
		}

		try {
			await openCreatedTaskFileAfterSave(this.app, file, mode);
		} catch (error) {
			tasknotesLogger.error("Failed to open created task note:", {
				category: "persistence",
				operation: "open-created-task-note",
				error: error,
			});
			new Notice(this.t(msg({ message: "Task created, but the task note could not be opened.", context: "modals.taskCreation.notices.openCreatedTaskFailure" })));
		}
	}

	private buildTaskData(): Partial<TaskInfo> {
		const taskData = buildTaskCreationData({
			title: this.form.values.title,
			dueDate: this.form.values.dueDate,
			scheduledDate: this.form.values.scheduledDate,
			priority: this.form.values.priority,
			status: this.form.values.status,
			contexts: this.form.values.contexts,
			projects: this.form.values.projects,
			tags: this.form.values.tags,
			timeEstimate: this.form.values.timeEstimate,
			recurrenceRule: this.form.values.recurrenceRule,
			recurrenceAnchor: this.form.values.recurrenceAnchor,
			reminders: this.form.values.reminders,
			blockedByItems: this.blockedByItems,
			details: this.form.values.details,
			userFields: this.form.values.userFields,
			creationContext: this.options.creationContext,
			taskIdentificationMethod: this.plugin.settings.taskIdentificationMethod,
			taskTag: this.plugin.settings.taskTag,
			normalizeDetails: (value) => this.normalizeDetails(value),
		});
		const attachments = getLinkedAttachmentReferences(this.attachmentEntries);
		if (attachments.length > 0) {
			taskData.attachments = attachments;
		}
		const prePopulatedCustomFrontmatter = this.options.prePopulatedValues?.customFrontmatter;
		if (prePopulatedCustomFrontmatter) {
			taskData.customFrontmatter = {
				...prePopulatedCustomFrontmatter,
				...taskData.customFrontmatter,
			};
		}

		return taskData;
	}

	protected async applySubtaskAssignments(createdTask: TaskInfo): Promise<void> {
		const currentTaskFile = this.app.vault.getAbstractFileByPath(createdTask.path);
		if (!(currentTaskFile instanceof TFile)) return;

		await applyTaskCreationSubtaskAssignments({
			currentTaskFile,
			subtaskFiles: this.selectedSubtaskFiles,
			getTaskInfo: (path) => this.plugin.cacheManager.getTaskInfo(path),
			buildProjectReference: (targetFile, sourcePath) =>
				this.buildProjectReference(targetFile, sourcePath),
			updateTaskProjects: (subtaskInfo, projects) =>
				this.plugin.updateTaskProperty(subtaskInfo, "projects", projects),
			onError: (error) => {
				tasknotesLogger.error("Failed to assign subtask:", {
					category: "persistence",
					operation: "assign-subtask",
					error: error,
				});
			},
		});
	}

	onClose(): void {
		// Clean up markdown editor if it exists
		if (this.nlMarkdownEditor) {
			this.nlMarkdownEditor.destroy();
			this.nlMarkdownEditor = null;
		}
		super.onClose();
	}
}
