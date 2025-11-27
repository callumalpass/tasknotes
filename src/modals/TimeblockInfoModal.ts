import {
	App,
	Modal,
	Setting,
	Notice,
	TAbstractFile,
	parseYaml,
	stringifyYaml,
	TFile,
	setTooltip,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { openFileSelector } from "./FileSelectorModal";
import {
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import { formatDateForStorage } from "../utils/dateUtils";
import { TranslationKey } from "../i18n";

export interface TimeBlock {
	title: string;
	startTime: string;
	endTime: string;
	description?: string;
	attachments?: string[];
	color?: string;
	id?: string;
}

/**
 * Modal for displaying timeblock information
 */
export class TimeblockInfoModal extends Modal {
	private timeblock: TimeBlock;
	private eventDate: Date;
	private timeblockDate: string;
	private plugin: TaskNotesPlugin;
	private originalTimeblock: TimeBlock;
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

	// Form fields
	private titleInput: HTMLInputElement;
	private descriptionInput: HTMLTextAreaElement;
	private colorInput: HTMLInputElement;

	// Attachment management
	private selectedAttachments: TAbstractFile[] = [];
	private attachmentsList: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		timeblock: TimeBlock,
		eventDate: Date,
		timeblockDate?: string
	) {
		super(app);
		this.plugin = plugin;
		this.timeblock = { ...timeblock }; // Create a copy for editing
		this.originalTimeblock = timeblock; // Keep original for comparison
		this.eventDate = eventDate;
		this.timeblockDate = timeblockDate || formatDateForStorage(eventDate);
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("timeblock-info-modal");

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.handleSave();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		new Setting(contentEl).setName(this.translate("modals.timeblockInfo.editHeading")).setHeading();

		// Date and time display (read-only)
		const dateDisplay = contentEl.createDiv({ cls: "timeblock-date-display" });
		dateDisplay.createEl("strong", { text: this.translate("modals.timeblockInfo.dateTimeLabel") });
		const dateText = `${this.eventDate.toLocaleDateString()} from ${this.timeblock.startTime} to ${this.timeblock.endTime}`;
		dateDisplay.createSpan({ text: dateText });

		// Title field (editable)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockInfo.titleLabel"))
			.setDesc(this.translate("modals.timeblockInfo.titleDesc"))
			.addText((text) => {
				this.titleInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockInfo.titlePlaceholder"))
					.setValue(this.timeblock.title || "")
					.onChange(() => this.validateForm());
			});

		// Description (editable)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockInfo.descriptionLabel"))
			.setDesc(this.translate("modals.timeblockInfo.descriptionDesc"))
			.addTextArea((text) => {
				this.descriptionInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockInfo.descriptionPlaceholder")).setValue(
					this.timeblock.description || ""
				);
				this.descriptionInput.rows = 3;
			});

		// Color (editable)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockInfo.colorLabel"))
			.setDesc(this.translate("modals.timeblockInfo.colorDesc"))
			.addText((text) => {
				this.colorInput = text.inputEl;
				text.setPlaceholder(this.translate("modals.timeblockInfo.colorPlaceholder")).setValue(this.timeblock.color || "#6366f1");
				this.colorInput.type = "color";
			});

		// Attachments (editable)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockInfo.attachmentsLabel"))
			.setDesc(this.translate("modals.timeblockInfo.attachmentsDesc"))
			.addButton((button) => {
				button
					.setButtonText(this.translate("modals.timeblockInfo.addAttachmentButton"))
					.setTooltip(this.translate("modals.timeblockInfo.addAttachmentTooltip"))
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

		// Initialize attachments from timeblock
		await this.initializeAttachments();
		this.renderAttachmentsList();

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "timeblock-modal-buttons" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "space-between";
		buttonContainer.style.alignItems = "center";
		buttonContainer.style.marginTop = "20px";

		// Delete button (left side)
		const deleteButton = buttonContainer.createEl("button", {
			text: this.translate("modals.timeblockInfo.deleteButton"),
			cls: "mod-warning timeblock-delete-button",
		});
		deleteButton.addEventListener("click", () => this.handleDelete());

		// Right side buttons container
		const rightButtons = buttonContainer.createDiv({ cls: "timeblock-modal-buttons-right" });
		rightButtons.style.display = "flex";
		rightButtons.style.gap = "8px";

		const cancelButton = rightButtons.createEl("button", { text: this.translate("common.cancel") });
		cancelButton.addEventListener("click", () => this.close());

		const saveButton = rightButtons.createEl("button", {
			text: this.translate("modals.timeblockInfo.saveButton"),
			cls: "mod-cta timeblock-save-button",
		});
		saveButton.addEventListener("click", () => this.handleSave());

		// Initial validation
		this.validateForm();

		// Focus the title input
		window.setTimeout(() => this.titleInput.focus(), 50);
	}

	private validateForm(): void {
		const saveButton = this.contentEl.querySelector(
			".timeblock-save-button"
		) as HTMLButtonElement;
		if (!saveButton) return;

		const title = this.titleInput?.value.trim();
		const isValid = !!title;

		saveButton.disabled = !isValid;
		saveButton.style.opacity = isValid ? "1" : "0.5";
	}

	private async initializeAttachments(): Promise<void> {
		if (!this.timeblock.attachments) return;

		// Convert attachment strings back to TAbstractFile objects
		for (const attachmentPath of this.timeblock.attachments) {
			// Remove wikilink brackets if present
			const cleanPath = attachmentPath.replace(/^\[\[|\]\]$/g, "");
			const file = this.app.vault.getAbstractFileByPath(cleanPath);
			if (file) {
				this.selectedAttachments.push(file);
			}
		}
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

	private openAttachment(file: TAbstractFile): void {
		if (file instanceof TFile) {
			this.app.workspace.getLeaf(false).openFile(file);
		} else {
			new Notice(this.translate("notices.timeblockFileTypeNotSupported", { fileName: file.name }));
		}
	}

	private renderAttachmentsList(): void {
		this.attachmentsList.empty();

		if (this.selectedAttachments.length === 0) {
			const emptyState = this.attachmentsList.createDiv({
				cls: "timeblock-attachments-empty",
			});
			emptyState.textContent = "No attachments";
			return;
		}

		this.selectedAttachments.forEach((file) => {
			const attachmentItem = this.attachmentsList.createDiv({
				cls: "timeblock-attachment-item",
			});

			// Info container (clickable to open)
			const infoEl = attachmentItem.createDiv({ cls: "timeblock-attachment-info" });
			infoEl.style.cursor = "pointer";
			setTooltip(infoEl, "Click to open", { placement: "top" });
			infoEl.addEventListener("click", () => this.openAttachment(file));

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
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.removeAttachment(file);
			});
		});
	}

	private async handleSave(): Promise<void> {
		try {
			// Validate inputs
			const title = this.titleInput.value.trim();
			if (!title) {
				new Notice(this.translate("notices.timeblockTitleRequired"));
				return;
			}

			// Update timeblock with new values
			this.timeblock.title = title;
			this.timeblock.description = this.descriptionInput.value.trim() || undefined;
			this.timeblock.color = this.colorInput.value || undefined;

			// Convert selected attachments to wikilinks
			const attachments: string[] = this.selectedAttachments.map(
				(file) => `[[${file.path}]]`
			);
			this.timeblock.attachments = attachments.length > 0 ? attachments : undefined;

			// Save to daily note
			await this.updateTimeblockInDailyNote();

			// Refresh calendar views
			this.plugin.emitter.trigger("data-changed");

			new Notice(this.translate("notices.timeblockUpdatedSuccess", { title }));
			this.close();
		} catch (error) {
			console.error("Error updating timeblock:", error);
			new Notice(this.translate("notices.timeblockUpdateFailed"));
		}
	}

	private async updateTimeblockInDailyNote(): Promise<void> {
		if (!appHasDailyNotesPluginLoaded()) {
			throw new Error("Daily Notes plugin is not enabled");
		}

		// Get daily note for the date
		const dateStr = this.timeblockDate;
		const moment = (window as any).moment(dateStr, "YYYY-MM-DD");
		const allDailyNotes = getAllDailyNotes();
		const dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
			throw new Error("Daily note not found");
		}

		// Read current content
		const content = await this.app.vault.read(dailyNote);

		// Parse existing frontmatter
		let frontmatter: any = {};
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

		// Update the specific timeblock in the array
		if (frontmatter.timeblocks && Array.isArray(frontmatter.timeblocks)) {
			const index = frontmatter.timeblocks.findIndex(
				(tb: TimeBlock) =>
					tb.id === this.originalTimeblock.id ||
					(tb.title === this.originalTimeblock.title &&
						tb.startTime === this.originalTimeblock.startTime &&
						tb.endTime === this.originalTimeblock.endTime)
			);

			if (index >= 0) {
				frontmatter.timeblocks[index] = this.timeblock;
			} else {
				throw new Error("Timeblock not found in daily note");
			}
		} else {
			throw new Error("No timeblocks found in daily note");
		}

		// Convert frontmatter back to YAML
		const frontmatterText = stringifyYaml(frontmatter);

		// Reconstruct file content
		const newContent = `---\n${frontmatterText}---${bodyContent}`;

		// Write back to file
		await this.app.vault.modify(dailyNote, newContent);
	}

	private async handleDelete(): Promise<void> {
		// Show confirmation dialog
		const confirmed = await this.showDeleteConfirmation();
		if (!confirmed) return;

		try {
			await this.deleteTimeblockFromDailyNote();

			// Refresh calendar views
			this.plugin.emitter.trigger("data-changed");

			new Notice(this.translate("notices.timeblockDeletedSuccess", { title: this.timeblock.title }));
			this.close();
		} catch (error) {
			console.error("Error deleting timeblock:", error);
			new Notice(this.translate("notices.timeblockDeleteFailed"));
		}
	}

	private async showDeleteConfirmation(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText(this.translate("modals.timeblockInfo.deleteConfirmationTitle"));

			const content = modal.contentEl;
			content.createEl("p", {
				text: `Are you sure you want to delete the timeblock "${this.timeblock.title}"?`,
			});
			content.createEl("p", {
				text: "This action cannot be undone.",
				cls: "mod-warning",
			});

			const buttonContainer = content.createDiv({ cls: "modal-button-container" });
			buttonContainer.style.display = "flex";
			buttonContainer.style.justifyContent = "flex-end";
			buttonContainer.style.gap = "8px";
			buttonContainer.style.marginTop = "20px";

			const cancelBtn = buttonContainer.createEl("button", { text: this.translate("common.cancel") });
			cancelBtn.addEventListener("click", () => {
				modal.close();
				resolve(false);
			});

			const deleteBtn = buttonContainer.createEl("button", {
				text: "Delete",
				cls: "mod-warning",
			});
			deleteBtn.addEventListener("click", () => {
				modal.close();
				resolve(true);
			});

			modal.open();

			// Focus the cancel button by default for safety
			setTimeout(() => cancelBtn.focus(), 50);
		});
	}

	private async deleteTimeblockFromDailyNote(): Promise<void> {
		if (!appHasDailyNotesPluginLoaded()) {
			throw new Error("Daily Notes plugin is not enabled");
		}

		// Get daily note for the date
		const dateStr = this.timeblockDate;
		const moment = (window as any).moment(dateStr, "YYYY-MM-DD");
		const allDailyNotes = getAllDailyNotes();
		const dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
			throw new Error("Daily note not found");
		}

		// Read current content
		const content = await this.app.vault.read(dailyNote);

		// Parse existing frontmatter
		let frontmatter: any = {};
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

		// Remove the specific timeblock from the array
		if (frontmatter.timeblocks && Array.isArray(frontmatter.timeblocks)) {
			const index = frontmatter.timeblocks.findIndex(
				(tb: TimeBlock) =>
					tb.id === this.originalTimeblock.id ||
					(tb.title === this.originalTimeblock.title &&
						tb.startTime === this.originalTimeblock.startTime &&
						tb.endTime === this.originalTimeblock.endTime)
			);

			if (index >= 0) {
				frontmatter.timeblocks.splice(index, 1);

				// If no timeblocks left, remove the property entirely
				if (frontmatter.timeblocks.length === 0) {
					delete frontmatter.timeblocks;
				}
			} else {
				throw new Error("Timeblock not found in daily note");
			}
		} else {
			throw new Error("No timeblocks found in daily note");
		}

		// Convert frontmatter back to YAML
		const frontmatterText =
			Object.keys(frontmatter).length > 0 ? stringifyYaml(frontmatter) : "";

		// Reconstruct file content
		const newContent = frontmatterText
			? `---\n${frontmatterText}---${bodyContent}`
			: bodyContent.trim();

		// Write back to file
		await this.app.vault.modify(dailyNote, newContent);
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
