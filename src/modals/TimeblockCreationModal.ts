import { applyModalShell, createModalComposer, createModalTimeField, createModalColorField, renderModalSubmitHint } from "../ui/kit/modal";
import { displayError } from "../i18n/runtime";
import { uiLocale } from "../i18n/runtime";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import {
	App,
	Modal,
	Setting,
	Notice,
	TAbstractFile,
	TFile,
	setTooltip,
	setIcon,
	moment as obsidianMoment,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { TimeBlock, TaskInfo } from "../types";
import { generateTimeblockId } from "../utils/helpers";
import { openFileSelector } from "./FileSelectorModal";
import { openTaskSelector } from "./TaskSelectorWithCreateModal";
import { parseDateAsLocal } from "../utils/dateUtils";
import { normalizeThemeColor } from "../utils/themeColors";
import { processVaultFrontMatter } from "../services/VaultMutationService";
import { collectFileUndo, createFileUndo, type FileUndoReceipt } from "../ui/taskMutationUndo";
import { showTaskUndo } from "../ui/taskPropertyPickers";
import {
	createDailyNote,
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import { MessageDescriptor } from "../i18n";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TimeblockCreationModal" });

type DailyNoteMoment = Parameters<typeof getDailyNote>[0];
type DailyNotesLookup = ReturnType<typeof getAllDailyNotes>;

const TIMEBLOCK_DAILY_NOTES_SETUP_GUIDANCE =
	"Check the Daily Notes core plugin settings and make sure the configured daily notes folder exists.";

function getUnknownErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "";
}

export function readDailyNotesForTimeblockCreation(
	readDailyNotes: () => DailyNotesLookup = getAllDailyNotes
): DailyNotesLookup {
	try {
		return readDailyNotes();
	} catch (error) {
		const errorMessage = getUnknownErrorMessage(error);
		const detail = errorMessage ? `: ${errorMessage}` : "";
		throw new Error(
			`Failed to read daily notes${detail}. ${TIMEBLOCK_DAILY_NOTES_SETUP_GUIDANCE}`
		);
	}
}

export function getTimeblockCreationErrorMessage(error: unknown): string {
	const errorMessage = getUnknownErrorMessage(error);
	if (!errorMessage) {
		return uiText(msg({ message: "Failed to create timeblock. Check console for details.", context: "modals/TimeblockCreationModal: getTimeblockCreationErrorMessage display" }));
	}

	return uiText(msg({ message: "Failed to create timeblock: {errorMessage}", context: "modals/TimeblockCreationModal: getTimeblockCreationErrorMessage display" }), { errorMessage: displayError(errorMessage) });
}

function getDailyNoteMoment(input: string): DailyNoteMoment {
	return (obsidianMoment as unknown as (input: string) => DailyNoteMoment)(input);
}

export interface TimeblockCreationOptions {
	date: string; // YYYY-MM-DD format
	startTime?: string; // HH:MM format
	endTime?: string; // HH:MM format
	prefilledTitle?: string;
	prefilledAttachmentPaths?: string[];
	onCreated?: (result: TimeblockCreationResult) => void | Promise<void>;
}

export interface TimeblockCreationResult {
	timeblock: TimeBlock;
	date: string;
	dailyNote: TFile;
}

export class TimeblockCreationModal extends Modal {
	plugin: TaskNotesPlugin;
	options: TimeblockCreationOptions;
	private translate: (key: MessageDescriptor, variables?: Record<string, unknown>) => string;

	// Form fields
	private titleInput: HTMLInputElement;
	private startTimeInput: HTMLInputElement;
	private endTimeInput: HTMLInputElement;
	private descriptionInput: HTMLTextAreaElement;
	private colorInput: HTMLInputElement;

	// Attachment management
	private selectedAttachments: TAbstractFile[] = [];
	private attachmentsList: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(app: App, plugin: TaskNotesPlugin, options: TimeblockCreationOptions) {
		super(app);
		applyModalShell(this);
		this.plugin = plugin;
		this.options = options;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("timeblock-creation-modal");

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void this.handleSubmit();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		const { body, properties, footer } = createModalComposer(this);
		this.titleInput = body.createEl("input", { cls: "tn-modal__title", type: "text", value: this.options.prefilledTitle || "", attr: {
			"aria-label": this.translate(msg({ message: "Title", context: "modals.timeblockCreation.titleLabel" })),
			placeholder: this.translate(msg({ message: "e.g., Deep work session", context: "modals.timeblockCreation.titlePlaceholder" })),
		} });
		body.prepend(this.titleInput);
		this.titleInput.addEventListener("input", () => this.validateForm());
		this.descriptionInput = body.createEl("textarea", { cls: "tn-modal__description", attr: {
			"aria-label": this.translate(msg({ message: "Description", context: "modals.timeblockCreation.descriptionLabel" })),
			placeholder: this.translate(msg({ message: "Optional description for the timeblock", context: "modals.timeblockCreation.descriptionDesc" })),
		} });
		this.descriptionInput.value = "";
		properties.before(this.descriptionInput);
		properties.createSpan({ cls: "tn-chip", text: parseDateAsLocal(this.options.date).toLocaleDateString(uiLocale(), { month: "short", day: "numeric", year: "numeric" }) });
		this.startTimeInput = createModalTimeField(properties, this.translate(msg({ message: "Start time", context: "modals.timeblockCreation.startTimeLabel" })), this.options.startTime || "", this.plugin.settings.calendarViewSettings.timeFormat, () => this.validateForm());
		this.endTimeInput = createModalTimeField(properties, this.translate(msg({ message: "End time", context: "modals.timeblockCreation.endTimeLabel" })), this.options.endTime || "", this.plugin.settings.calendarViewSettings.timeFormat, () => this.validateForm());
		this.colorInput = createModalColorField(properties, this.translate(msg({ message: "Color", context: "modals.timeblockCreation.colorLabel" })), this.plugin.settings.calendarViewSettings.defaultTimeblockColor);
		this.titleInput.focus();

		// Attachments (optional)
		new Setting(body)
			.setName(this.translate(msg({ message: "Attachments", context: "modals.timeblockCreation.attachmentsLabel" })))
			.setDesc(this.translate(msg({ message: "Files or notes to link to this timeblock", context: "modals.timeblockCreation.attachmentsDesc" })))
			.addButton((button) => {
				button
					.setButtonText(this.translate(msg({ message: "Add attachment", context: "modals.timeblockCreation.addAttachmentButton" })))
					.setTooltip(this.translate(msg({ message: "Select a file or note using fuzzy search", context: "modals.timeblockCreation.addAttachmentTooltip" })))
					.onClick(() => {
						openFileSelector(
							this.plugin,
							(file) => {
								if (file instanceof TAbstractFile) this.addAttachment(file);
							},
							{
								placeholder: this.translate(msg({ message: "Search files or type to create new...", context: "modals.fileSelector.placeholder" })),
								filter: "all",
								sortOrder:
									this.plugin.settings.calendarViewSettings
										.timeblockAttachmentSearchOrder,
							}
						);
					});
			})
			.addButton((button) => {
				button
					.setButtonText(this.translate(msg({ message: "Add task", context: "modals.task.dependencies.addTaskButton" })))
					.setTooltip(this.translate(msg({ message: "Select task", context: "modals.taskSelector.title" })))
					.onClick(() => {
						void this.openTaskSelectorForTitle();
					});
			});

		// Attachments list container
		this.attachmentsList = body.createDiv({ cls: "timeblock-attachments-list" });
		this.initializePrefilledAttachments();
		this.renderAttachmentsList(); // Initialize empty state

		// Buttons
		const buttonContainer = footer;
		buttonContainer.addClass("timeblock-modal-buttons");

		const cancelButton = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Cancel", context: "common.cancel" })),
		});
		cancelButton.addEventListener("click", () => this.close());

		const createButton = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Create timeblock", context: "modals.timeblockCreation.createButton" })),
			cls: "mod-cta timeblock-create-button",
		});
		createButton.addEventListener("click", () => {
			void this.handleSubmit();
		});

		renderModalSubmitHint(createButton);

		// Initial validation
		this.validateForm();
	}

	private validateForm(): void {
		const createButton = this.contentEl.querySelector(
			".timeblock-create-button"
		) as HTMLButtonElement;
		if (!createButton) return;

		const title = this.titleInput?.value.trim();
		const startTime = this.startTimeInput?.value;
		const endTime = this.endTimeInput?.value;

		// Check required fields
		let isValid = !!(title && startTime && endTime);

		// Validate time range
		if (isValid && startTime && endTime) {
			const [startHour, startMin] = startTime.split(":").map(Number);
			const [endHour, endMin] = endTime.split(":").map(Number);
			const startMinutes = startHour * 60 + startMin;
			let endMinutes = endHour * 60 + endMin;

			// Treat 00:00 as the end of the selected day when it follows a later start.
			if (endTime === "00:00" && startMinutes > 0) {
				endMinutes = 24 * 60;
			}

			if (endMinutes <= startMinutes) {
				isValid = false;
			}
		}

		createButton.disabled = !isValid;
		createButton.style.opacity = isValid ? "1" : "0.5";
	}

	private initializePrefilledAttachments(): void {
		const prefilledPaths = this.options.prefilledAttachmentPaths || [];
		if (prefilledPaths.length === 0) {
			return;
		}

		const uniquePaths = new Set(
			prefilledPaths.filter((path) => typeof path === "string" && path.trim().length > 0)
		);
		for (const path of uniquePaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file) {
				this.selectedAttachments.push(file);
			}
		}
	}

	private async handleSubmit(): Promise<void> {
		try {
			// Validate inputs
			const title = this.titleInput.value.trim();
			const startTime = this.startTimeInput.value;
			const endTime = this.endTimeInput.value;
			const description = this.descriptionInput.value.trim();
			const color = normalizeThemeColor(
				this.colorInput.value,
				this.plugin.settings.calendarViewSettings.defaultTimeblockColor
			);
			if (!title || !startTime || !endTime) {
				new Notice(this.translate(msg({ message: "Please fill in all required fields", context: "notices.timeblockRequiredFieldsMissing" })));
				return;
			}

			// Convert selected attachments to wikilinks
			const attachments: string[] = this.selectedAttachments.map(
				(file) => `[[${file.path}]]`
			);

			// Create timeblock object
			const timeblock: TimeBlock = {
				id: generateTimeblockId(),
				title,
				startTime,
				endTime,
			};

			// Add optional fields
			if (description) {
				timeblock.description = description;
			}
			if (color) {
				timeblock.color = color;
			}
			if (attachments.length > 0) {
				timeblock.attachments = attachments;
			}

			// Save to daily note
			const { dailyNote, undo } = await this.saveTimeblockToDailyNote(timeblock);

			// Refresh calendar views
			this.plugin.emitter.trigger("data-changed");
			void this.options.onCreated?.({
				timeblock,
				date: this.options.date,
				dailyNote,
			});

			showTaskUndo([undo], false, 1, this.app.vault, this.translate(msg({ message: "Timeblock \"{title}\" created successfully", context: "modals.timeblockCreation.created" }), { title }));
			this.close();
		} catch (error) {
			tasknotesLogger.error("Error creating timeblock:", {
				category: "internal",
				operation: "creating-timeblock",
				error: error,
			});
			new Notice(getTimeblockCreationErrorMessage(error));
		}
	}

	private async saveTimeblockToDailyNote(timeblock: TimeBlock): Promise<{ dailyNote: TFile; undo: () => Promise<void> }> {
		if (!appHasDailyNotesPluginLoaded()) {
			throw new Error(
				`Daily Notes core plugin is not enabled. ${TIMEBLOCK_DAILY_NOTES_SETUP_GUIDANCE}`
			);
		}

		// Get or create daily note for the date
		const dailyNoteMoment = getDailyNoteMoment(this.options.date);
		const allDailyNotes = readDailyNotesForTimeblockCreation();
		let dailyNote = getDailyNote(dailyNoteMoment, allDailyNotes);

		if (!dailyNote) {
			// Create daily note if it doesn't exist
			try {
				dailyNote = await createDailyNote(dailyNoteMoment);
			} catch (error) {
				const errorMessage = getUnknownErrorMessage(error);
				const detail = errorMessage ? `: ${errorMessage}` : "";
				throw new Error(
					`Failed to create daily note${detail}. ${TIMEBLOCK_DAILY_NOTES_SETUP_GUIDANCE}`
				);
			}

			// Validate that daily note was created successfully
			if (!dailyNote) {
				throw new Error(
					`Failed to create daily note. ${TIMEBLOCK_DAILY_NOTES_SETUP_GUIDANCE}`
				);
			}
		}

		const receipts: FileUndoReceipt[] = [];
		let before: Record<string, unknown> = {};
		let after: Record<string, unknown> = {};
		await processVaultFrontMatter(this.app, dailyNote, frontmatter => {
			before = structuredClone(frontmatter);
			const blocks = Array.isArray(frontmatter.timeblocks) ? frontmatter.timeblocks : [];
			frontmatter.timeblocks = [...blocks, timeblock];
			after = structuredClone(frontmatter);
		});
		collectFileUndo(this.plugin, receipts)(dailyNote, before, after);
		return { dailyNote, undo: createFileUndo(this.plugin, receipts) };
	}

	private addAttachment(file: TAbstractFile): void {
		// Avoid duplicates
		if (this.selectedAttachments.some((existing) => existing.path === file.path)) {
			new Notice(
				this.translate(msg({ message: "\"{fileName}\" is already attached", context: "notices.timeblockAttachmentExists" }), { fileName: file.name })
			);
			return;
		}

		// If title is empty, default it to the selected attachment name.
		if (this.titleInput && !this.titleInput.value.trim()) {
			const derivedTitle = file instanceof TFile ? file.basename : file.name;
			this.titleInput.value = derivedTitle;
			this.validateForm();
		}

		this.selectedAttachments.push(file);
		this.renderAttachmentsList();
		new Notice(this.translate(msg({ message: "Added \"{fileName}\" as attachment", context: "notices.timeblockAttachmentAdded" }), { fileName: file.name }));
	}

	private async openTaskSelectorForTitle(): Promise<void> {
		try {
			const allTasks: TaskInfo[] = (await this.plugin.cacheManager.getAllTasks?.()) ?? [];
			const candidates = allTasks.filter((task) => !task.archived);

			if (candidates.length === 0) {
				new Notice(this.translate(msg({ message: "No tasks available to select", context: "modals.timeblockInfo.noTasks" })));
				return;
			}

			openTaskSelector(
				this.plugin,
				candidates,
				(selectedTask) => {
					if (!selectedTask) return;

					if (!this.titleInput.value.trim()) {
						this.titleInput.value = selectedTask.title || "";
						this.validateForm();
					}

					const taskFile = this.app.vault.getAbstractFileByPath(selectedTask.path);
					if (taskFile) {
						this.addAttachment(taskFile);
					}
				},
				{
					title: this.translate(msg({ message: "Select task", context: "modals.taskSelector.title" })),
				}
			);
		} catch (error) {
			tasknotesLogger.error("Failed to open task selector for timeblock creation:", {
				category: "persistence",
				operation: "open-task-selector-timeblock-creation",
				error: error,
			});
			new Notice(this.translate(msg({ message: "Failed to open task selector", context: "modals.timeblockInfo.selectorFailed" })));
		}
	}

	private removeAttachment(file: TAbstractFile): void {
		this.selectedAttachments = this.selectedAttachments.filter(
			(existing) => existing.path !== file.path
		);
		this.renderAttachmentsList();
		new Notice(this.translate(msg({ message: "Removed \"{fileName}\" from attachments", context: "notices.timeblockAttachmentRemoved" }), { fileName: file.name }));
	}

	private renderAttachmentsList(): void {
		this.attachmentsList.empty();

		if (this.selectedAttachments.length === 0) {
			const emptyState = this.attachmentsList.createDiv({
				cls: "timeblock-attachments-empty",
			});
			emptyState.textContent = uiText(msg({ message: "No attachments added yet", context: "modals/TimeblockCreationModal: TimeblockCreationModal.renderAttachmentsList display" }));
			return;
		}

		this.selectedAttachments.forEach((file) => {
			const attachmentItem = this.attachmentsList.createDiv({
				cls: "timeblock-attachment-item",
			});

			// Info container
			const infoEl = attachmentItem.createDiv({ cls: "timeblock-attachment-info" });

			// File name
			const nameEl = infoEl.createSpan({ cls: "timeblock-attachment-name" });
			nameEl.textContent = file.name;

			// File path (if different from name)
			if (file.path !== file.name) {
				const pathEl = infoEl.createDiv({ cls: "timeblock-attachment-path" });
				pathEl.textContent = file.path;
			}

			// Remove button
			const removeBtn = attachmentItem.createEl("button", {
				cls: "timeblock-attachment-remove",
			});
			setTooltip(removeBtn, uiText(msg({ message: "Remove attachment", context: "modals/TimeblockCreationModal: TimeblockCreationModal.renderAttachmentsList display" })), { placement: "top" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				this.removeAttachment(file);
			});
		});
	}

	onClose() {
		// Clean up keyboard handler
		if (this.keyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}

		const { contentEl } = this;
		contentEl.empty();
	}
}
