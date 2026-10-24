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
	parseYaml,
	stringifyYaml,
	setTooltip,
	moment as obsidianMoment,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { TimeBlock, DailyNoteFrontmatter, TaskInfo } from "../types";
import { generateTimeblockId } from "../utils/helpers";
import { openFileSelector } from "./FileSelectorModal";
import { openTaskSelector } from "./TaskSelectorWithCreateModal";
import { parseDateAsLocal } from "../utils/dateUtils";
import { colorValueToInputValue, normalizeThemeColor } from "../utils/themeColors";
import { configureThemeColorInput } from "../settings/components/CardComponent";
import { modifyVaultFile } from "../services/VaultMutationService";
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

		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Create timeblock", context: "modals.timeblockCreation.heading" })))
			.setHeading();

		// Date display (read-only)
		const dateDisplay = contentEl.createDiv({ cls: "timeblock-date-display" });
		dateDisplay.createEl("strong", {
			text: this.translate(msg({ message: "Date: ", context: "modals.timeblockCreation.dateLabel" })),
		});
		// Parse the date string to get a proper date object for display (using local for UI)
		const dateObj = parseDateAsLocal(this.options.date);
		dateDisplay.createSpan({ text: dateObj.toLocaleDateString(uiLocale()) });

		// Title field
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Title", context: "modals.timeblockCreation.titleLabel" })))
			.setDesc(this.translate(msg({ message: "Title for your timeblock", context: "modals.timeblockCreation.titleDesc" })))
			.addText((text) => {
				this.titleInput = text.inputEl;
				text.setPlaceholder(this.translate(msg({ message: "e.g., Deep work session", context: "modals.timeblockCreation.titlePlaceholder" })))
					.setValue(this.options.prefilledTitle || "")
					.onChange(() => this.validateForm());
				// Focus on title input
				window.setTimeout(() => this.titleInput.focus(), 100);
			});

		// Time range
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Start time", context: "modals.timeblockCreation.startTimeLabel" })))
			.setDesc(this.translate(msg({ message: "When the timeblock starts", context: "modals.timeblockCreation.startTimeDesc" })))
			.addText((text) => {
				this.startTimeInput = text.inputEl;
				text.setPlaceholder(this.translate(msg({ message: "09:00", context: "modals.timeblockCreation.startTimePlaceholder" })))
					.setValue(this.options.startTime || "")
					.onChange(() => this.validateForm());
				this.startTimeInput.type = "time";
			});

		new Setting(contentEl)
			.setName(this.translate(msg({ message: "End time", context: "modals.timeblockCreation.endTimeLabel" })))
			.setDesc(this.translate(msg({ message: "When the timeblock ends", context: "modals.timeblockCreation.endTimeDesc" })))
			.addText((text) => {
				this.endTimeInput = text.inputEl;
				text.setPlaceholder(this.translate(msg({ message: "11:00", context: "modals.timeblockCreation.endTimePlaceholder" })))
					.setValue(this.options.endTime || "")
					.onChange(() => {
						this.validateForm();
					});
				this.endTimeInput.type = "time";
			});

		// Description (optional)
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Description", context: "modals.timeblockCreation.descriptionLabel" })))
			.setDesc(this.translate(msg({ message: "Optional description for the timeblock", context: "modals.timeblockCreation.descriptionDesc" })))
			.addTextArea((text) => {
				this.descriptionInput = text.inputEl;
				text.setPlaceholder(
					this.translate(msg({ message: "Focus on new features, no interruptions", context: "modals.timeblockCreation.descriptionPlaceholder" }))
				).setValue("");
				this.descriptionInput.rows = 3;
			});

		// Color (optional)
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Color", context: "modals.timeblockCreation.colorLabel" })))
			.setDesc(this.translate(msg({ message: "Optional color for the timeblock", context: "modals.timeblockCreation.colorDesc" })))
			.addText((text) => {
				this.colorInput = text.inputEl;
				text.setPlaceholder(
					this.translate(msg({ message: "#3b82f6", context: "modals.timeblockCreation.colorPlaceholder" }))
				).setValue(
					colorValueToInputValue(
						this.plugin.settings.calendarViewSettings.defaultTimeblockColor
					)
				);
				configureThemeColorInput(this.colorInput);
			});

		// Attachments (optional)
		new Setting(contentEl)
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
		this.attachmentsList = contentEl.createDiv({ cls: "timeblock-attachments-list" });
		this.initializePrefilledAttachments();
		this.renderAttachmentsList(); // Initialize empty state

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "timeblock-modal-buttons" });

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
			const dailyNote = await this.saveTimeblockToDailyNote(timeblock);

			// Refresh calendar views
			this.plugin.emitter.trigger("data-changed");
			void this.options.onCreated?.({
				timeblock,
				date: this.options.date,
				dailyNote,
			});

			new Notice(this.translate(msg({ message: "Timeblock \"{title}\" created successfully", context: "modals.timeblockCreation.created" }), { title }));
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

	private async saveTimeblockToDailyNote(timeblock: TimeBlock): Promise<TFile> {
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

		// Read current content
		const content = await this.app.vault.read(dailyNote);

		// Parse existing frontmatter
		let frontmatter: DailyNoteFrontmatter = {};
		let bodyContent = content;

		if (content.startsWith("---")) {
			const endOfFrontmatter = content.indexOf("---", 3);
			if (endOfFrontmatter !== -1) {
				const frontmatterText = content.substring(3, endOfFrontmatter);
				bodyContent = content.substring(endOfFrontmatter + 3);

				try {
					frontmatter = parseYaml(frontmatterText) || {};
				} catch (error) {
					tasknotesLogger.error("Error parsing existing frontmatter:", {
						category: "validation",
						operation: "parsing-existing-frontmatter",
						error: error,
					});
					frontmatter = {};
				}
			}
		}

		// Add timeblock to frontmatter
		if (!frontmatter.timeblocks) {
			frontmatter.timeblocks = [];
		}
		frontmatter.timeblocks.push(timeblock);

		// Convert frontmatter back to YAML
		const frontmatterText = stringifyYaml(frontmatter);

		// Reconstruct file content
		const newContent = `---\n${frontmatterText}---${bodyContent}`;

		// Write back to file
		await modifyVaultFile(this.app, dailyNote, newContent);

		// The native metadata cache will automatically update
		return dailyNote;
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
				text: "×",
			});
			setTooltip(removeBtn, uiText(msg({ message: "Remove attachment", context: "modals/TimeblockCreationModal: TimeblockCreationModal.renderAttachmentsList display" })), { placement: "top" });
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
