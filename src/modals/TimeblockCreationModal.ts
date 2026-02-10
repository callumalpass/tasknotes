import {
	App,
	Modal,
	Setting,
	Notice,
	TAbstractFile,
	parseYaml,
	stringifyYaml,
	setTooltip,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { TimeBlock, DailyNoteFrontmatter } from "../types";
import { generateTimeblockId } from "../utils/helpers";
import { openFileSelector } from "./FileSelectorModal";
import { parseDateAsLocal } from "../utils/dateUtils";
import {
	createDailyNote,
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import { TranslationKey } from "../i18n";

export interface TimeblockCreationOptions {
	date: string; // YYYY-MM-DD format
	startTime?: string; // HH:MM format
	endTime?: string; // HH:MM format
	prefilledTitle?: string;
}

export class TimeblockCreationModal extends Modal {
	plugin: TaskNotesPlugin;
	options: TimeblockCreationOptions;
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

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
				this.handleSubmit();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		new Setting(contentEl).setName(this.translate("modals.timeblockCreation.heading")).setHeading();

		// Date display (read-only)
		const dateDisplay = contentEl.createDiv({ cls: "timeblock-date-display" });
		dateDisplay.createEl("strong", { text: this.translate("modals.timeblockCreation.dateLabel") });
		// Parse the date string to get a proper date object for display (using local for UI)
		const dateObj = parseDateAsLocal(this.options.date);
		dateDisplay.createSpan({ text: dateObj.toLocaleDateString() });

		// Title field
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockCreation.titleLabel"))
			.setDesc(this.translate("modals.timeblockCreation.titleDesc"))
			.addText((text) => {
				this.titleInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockCreation.titlePlaceholder"))
					.setValue(this.options.prefilledTitle || "")
					.onChange(() => this.validateForm());
				// Focus on title input
				window.setTimeout(() => this.titleInput.focus(), 100);
			});

		// Time range
		const timeContainer = contentEl.createDiv({ cls: "timeblock-time-container" });

		new Setting(timeContainer)
			.setName(this.translate("modals.timeblockCreation.startTimeLabel"))
			.setDesc(this.translate("modals.timeblockCreation.startTimeDesc"))
			.addText((text) => {
				this.startTimeInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockCreation.startTimePlaceholder"))
					.setValue(this.options.startTime || "")
					.onChange(() => this.validateForm());
				this.startTimeInput.type = "time";
			});

		new Setting(timeContainer)
			.setName(this.translate("modals.timeblockCreation.endTimeLabel"))
			.setDesc(this.translate("modals.timeblockCreation.endTimeDesc"))
			.addText((text) => {
				this.endTimeInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockCreation.endTimePlaceholder"))
					.setValue(this.options.endTime || "")
					.onChange(() => {
						// Convert 00:00 to 23:59 for end time
						if (this.endTimeInput.value === "00:00") {
							this.endTimeInput.value = "23:59";
						}
						this.validateForm();
					});
				this.endTimeInput.type = "time";
			});

		// Description (optional)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockCreation.descriptionLabel"))
			.setDesc(this.translate("modals.timeblockCreation.descriptionDesc"))
			.addTextArea((text) => {
				this.descriptionInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockCreation.descriptionPlaceholder")).setValue("");
				this.descriptionInput.rows = 3;
			});

		// Color (optional)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockCreation.colorLabel"))
			.setDesc(this.translate("modals.timeblockCreation.colorDesc"))
			.addText((text) => {
				this.colorInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockCreation.colorPlaceholder")).setValue(this.plugin.settings.calendarViewSettings.defaultTimeblockColor);
				this.colorInput.type = "color";
			});

		// Attachments (optional)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockCreation.attachmentsLabel"))
			.setDesc(this.translate("modals.timeblockCreation.attachmentsDesc"))
			.addButton((button) => {
				button
					.setButtonText(this.translate("modals.timeblockCreation.addAttachmentButton"))
					.setTooltip(this.translate("modals.timeblockCreation.addAttachmentTooltip"))
					.onClick(() => {
						openFileSelector(this.plugin, (file) => {
							if (file) this.addAttachment(file);
						}, {
							placeholder: "Search files or type to create new...",
							filter: "all",
						});
					});
			});

		// Attachments list container
		this.attachmentsList = contentEl.createDiv({ cls: "timeblock-attachments-list" });
		this.renderAttachmentsList(); // Initialize empty state

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "timeblock-modal-buttons" });

		const cancelButton = buttonContainer.createEl("button", { text: this.translate("common.cancel") });
		cancelButton.addEventListener("click", () => this.close());

		const createButton = buttonContainer.createEl("button", {
			text: this.translate("modals.timeblockCreation.createButton"),
			cls: "mod-cta timeblock-create-button",
		});
		createButton.addEventListener("click", () => this.handleSubmit());

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

			// Treat 00:00 as 23:59 (end of day) for validation purposes
			if (endMinutes === 0) {
				endMinutes = 23 * 60 + 59; // 1439 minutes
			}

			if (endMinutes <= startMinutes) {
				isValid = false;
			}
		}

		createButton.disabled = !isValid;
		createButton.style.opacity = isValid ? "1" : "0.5";
	}

	private async handleSubmit(): Promise<void> {
		try {
			// Validate inputs
			const title = this.titleInput.value.trim();
			const startTime = this.startTimeInput.value;
			let endTime = this.endTimeInput.value;
			const description = this.descriptionInput.value.trim();
			const color = this.colorInput.value;
			if (!title || !startTime || !endTime) {
				new Notice(this.translate("notices.timeblockRequiredFieldsMissing"));
				return;
			}

			// Convert 00:00 to 23:59 for end time before saving
			if (endTime === "00:00") {
				endTime = "23:59";
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
			await this.saveTimeblockToDailyNote(timeblock);

			// Refresh calendar views
			this.plugin.emitter.trigger("data-changed");

			new Notice(`Timeblock "${title}" created successfully`);
			this.close();
		} catch (error) {
			console.error("Error creating timeblock:", error);
			new Notice("Failed to create timeblock. Check console for details.");
		}
	}

	private async saveTimeblockToDailyNote(timeblock: TimeBlock): Promise<void> {
		if (!appHasDailyNotesPluginLoaded()) {
			throw new Error("Daily Notes plugin is not enabled");
		}

		// Get or create daily note for the date
		const moment = (window as any).moment(this.options.date);
		const allDailyNotes = getAllDailyNotes();
		let dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
			// Create daily note if it doesn't exist
			try {
				dailyNote = await createDailyNote(moment);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(
					`Failed to create daily note: ${errorMessage}. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.`
				);
			}

			// Validate that daily note was created successfully
			if (!dailyNote) {
				throw new Error(
					"Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists."
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
					console.error("Error parsing existing frontmatter:", error);
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
		await this.app.vault.modify(dailyNote, newContent);

		// The native metadata cache will automatically update
	}

	private addAttachment(file: TAbstractFile): void {
		// Avoid duplicates
		if (this.selectedAttachments.some((existing) => existing.path === file.path)) {
			new Notice(this.translate("notices.timeblockAttachmentExists", { fileName: file.name }));
			return;
		}

		this.selectedAttachments.push(file);
		this.renderAttachmentsList();
		new Notice(this.translate("notices.timeblockAttachmentAdded", { fileName: file.name }));
	}

	private removeAttachment(file: TAbstractFile): void {
		this.selectedAttachments = this.selectedAttachments.filter(
			(existing) => existing.path !== file.path
		);
		this.renderAttachmentsList();
		new Notice(this.translate("notices.timeblockAttachmentRemoved", { fileName: file.name }));
	}

	private renderAttachmentsList(): void {
		this.attachmentsList.empty();

		if (this.selectedAttachments.length === 0) {
			const emptyState = this.attachmentsList.createDiv({
				cls: "timeblock-attachments-empty",
			});
			emptyState.textContent = "No attachments added yet";
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
			setTooltip(removeBtn, "Remove attachment", { placement: "top" });
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
