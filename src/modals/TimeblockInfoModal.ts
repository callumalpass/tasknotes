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
	moment as obsidianMoment,
} from "obsidian";
import TaskNotesPlugin from "../main";
import { openFileSelector } from "./FileSelectorModal";
import { openTaskSelector } from "./TaskSelectorWithCreateModal";
import {
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import { formatDateForStorage } from "../utils/dateUtils";
import type { InterpolationValues, TranslationKey } from "../i18n";
import { TaskInfo } from "../types";

type DailyNoteMoment = Parameters<typeof getDailyNote>[0];

function getDailyNoteMoment(input: string, format: string): DailyNoteMoment {
	return (obsidianMoment as unknown as (input: string, format: string) => DailyNoteMoment)(
		input,
		format
	);
}

function parseFrontmatterRecord(frontmatterText: string): Record<string, unknown> {
	const parsed = parseYaml(frontmatterText);
	return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: {};
}

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
	private translate: (key: TranslationKey, variables?: InterpolationValues) => string;

	// Form fields
	private titleInput: HTMLInputElement;
	private descriptionInput: HTMLTextAreaElement;
	private colorInput: HTMLInputElement;

	// Attachment management
	private selectedAttachments: TAbstractFile[] = [];
	private attachmentsList: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	// Callback for when timeblock is saved or deleted
	private onChange?: () => void;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		timeblock: TimeBlock,
		eventDate: Date,
		timeblockDate?: string,
		onChange?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.timeblock = { ...timeblock }; // Create a copy for editing
		this.originalTimeblock = timeblock; // Keep original for comparison
		this.eventDate = eventDate;
		this.timeblockDate = timeblockDate || formatDateForStorage(eventDate);
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
		this.onChange = onChange;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("timeblock-info-modal");

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void this.handleSave();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		new Setting(contentEl)
			.setName(this.translate("modals.timeblockInfo.editHeading"))
			.setHeading();

		// Date and time display (read-only)
		const dateDisplay = contentEl.createDiv({ cls: "timeblock-date-display" });
		dateDisplay.createEl("strong", {
			text: this.translate("modals.timeblockInfo.dateTimeLabel"),
		});
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
				text.setPlaceholder(
					this.translate("modals.timeblockInfo.descriptionPlaceholder")
				).setValue(this.timeblock.description || "");
				this.descriptionInput.rows = 3;
			});

		// Color (editable)
		new Setting(contentEl)
			.setName(this.translate("modals.timeblockInfo.colorLabel"))
			.setDesc(this.translate("modals.timeblockInfo.colorDesc"))
			.addText((text) => {
				this.colorInput = text.inputEl;
				text.setPlaceholder(
					this.translate("modals.timeblockInfo.colorPlaceholder")
				).setValue(
					this.timeblock.color ||
						this.plugin.settings.calendarViewSettings.defaultTimeblockColor
				);
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
						openFileSelector(
								this.plugin,
								(file) => {
									if (file instanceof TAbstractFile) this.addAttachment(file);
								},
							{
								placeholder: "Search files or type to create new...",
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
					.setButtonText("Add task")
					.setTooltip("Select task")
					.onClick(() => {
						void this.openTaskSelectorForTitle();
					});
			});

		// Attachments list container
		this.attachmentsList = contentEl.createDiv({ cls: "timeblock-attachments-list" });

		// Initialize attachments from timeblock
		await this.initializeAttachments();
		this.renderAttachmentsList();

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "timeblock-modal-buttons" });
		buttonContainer.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		buttonContainer.classList.add("tn-static-display-flex-75816cae");
		buttonContainer.classList.remove(
			"tn-static-justify-content-center-03c4bb6f",
			"tn-static-justify-content-flex-end-455f8cca"
		);
		buttonContainer.classList.add("tn-static-justify-content-space-between-a562f4fd");
		buttonContainer.classList.remove(
			"tn-static-align-items-baseline-4b95b5c7",
			"tn-static-align-items-flex-start-0486f781"
		);
		buttonContainer.classList.add("tn-static-align-items-center-7c619740");
		buttonContainer.classList.remove(
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-4px-96ad6099",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		buttonContainer.classList.add("tn-static-margin-top-20px-a26bda7d");

		// Delete button (left side)
		const deleteButton = buttonContainer.createEl("button", {
			text: this.translate("modals.timeblockInfo.deleteButton"),
			cls: "mod-warning timeblock-delete-button",
		});
		deleteButton.addEventListener("click", () => {
			void this.handleDelete();
		});

		// Right side buttons container
		const rightButtons = buttonContainer.createDiv({ cls: "timeblock-modal-buttons-right" });
		rightButtons.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		rightButtons.classList.add("tn-static-display-flex-75816cae");
		rightButtons.classList.remove(
			"tn-static-display-flex-8bb39979",
			"tn-static-gap-0-5rem-ce2fca4d",
			"tn-static-gap-10px-f3d7ce77",
			"tn-static-gap-12px-ed7b3d87",
			"tn-static-gap-6px-f0abc1db"
		);
		rightButtons.classList.add("tn-static-gap-8px-33fcd4c3");

		const cancelButton = rightButtons.createEl("button", {
			text: this.translate("common.cancel"),
		});
		cancelButton.addEventListener("click", () => this.close());

		const saveButton = rightButtons.createEl("button", {
			text: this.translate("modals.timeblockInfo.saveButton"),
			cls: "mod-cta timeblock-save-button",
		});
		saveButton.addEventListener("click", () => {
			void this.handleSave();
		});

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
			new Notice(
				this.translate("notices.timeblockAttachmentExists", { fileName: file.name })
			);
			return;
		}

		// If title is empty, default it to the first selected attachment name.
		if (this.titleInput && !this.titleInput.value.trim()) {
			const derivedTitle = file instanceof TFile ? file.basename : file.name;
			this.titleInput.value = derivedTitle;
			this.timeblock.title = derivedTitle;
			this.validateForm();
		}

		this.selectedAttachments.push(file);
		this.renderAttachmentsList();
		new Notice(this.translate("notices.timeblockAttachmentAdded", { fileName: file.name }));
	}

	private async openTaskSelectorForTitle(): Promise<void> {
		try {
			const allTasks: TaskInfo[] = (await this.plugin.cacheManager.getAllTasks?.()) ?? [];
			const candidates = allTasks.filter((task) => !task.archived);

			if (candidates.length === 0) {
				new Notice("No tasks available to select");
				return;
			}

			openTaskSelector(
				this.plugin,
				candidates,
				(selectedTask) => {
					if (!selectedTask) return;

					this.titleInput.value = selectedTask.title || "";
					this.timeblock.title = selectedTask.title || "";
					this.validateForm();

					const taskFile = this.app.vault.getAbstractFileByPath(selectedTask.path);
					if (taskFile) {
						this.addAttachment(taskFile);
					}
				},
				{
					title: "Select task",
				}
			);
		} catch (error) {
			console.error("Failed to open task selector for timeblock edit:", error);
			new Notice("Failed to open task selector");
		}
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
			void this.app.workspace.getLeaf(false).openFile(file);
		} else {
			new Notice(
				this.translate("notices.timeblockFileTypeNotSupported", { fileName: file.name })
			);
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
			infoEl.classList.remove(
				"tn-static-cursor-grab-dad79857",
				"tn-static-cursor-pointer-2723efcc"
			);
			infoEl.classList.add("tn-static-cursor-pointer-3b6a3a65");
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

			// Signal immediate update before triggering data change
			this.onChange?.();

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
		const dailyNoteMoment = getDailyNoteMoment(dateStr, "YYYY-MM-DD");
		const allDailyNotes = getAllDailyNotes();
		const dailyNote = getDailyNote(dailyNoteMoment, allDailyNotes);

		if (!dailyNote) {
			throw new Error("Daily note not found");
		}

		// Read current content
		const content = await this.app.vault.read(dailyNote);

		// Parse existing frontmatter
		let frontmatter: Record<string, unknown> = {};
		let bodyContent = content;

		if (content.startsWith("---")) {
			const endOfFrontmatter = content.indexOf("---", 3);
			if (endOfFrontmatter !== -1) {
				const frontmatterText = content.substring(3, endOfFrontmatter);
				bodyContent = content.substring(endOfFrontmatter + 3);

				try {
					frontmatter = parseFrontmatterRecord(frontmatterText);
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

			// Signal immediate update before triggering data change
			this.onChange?.();

			// Refresh calendar views
			this.plugin.emitter.trigger("data-changed");

			new Notice(
				this.translate("notices.timeblockDeletedSuccess", { title: this.timeblock.title })
			);
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
			buttonContainer.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-min-height-800px-997b4c8c"
			);
			buttonContainer.classList.add("tn-static-display-flex-75816cae");
			buttonContainer.classList.remove(
				"tn-static-justify-content-center-03c4bb6f",
				"tn-static-justify-content-space-between-a562f4fd"
			);
			buttonContainer.classList.add("tn-static-justify-content-flex-end-455f8cca");
			buttonContainer.classList.remove(
				"tn-static-display-flex-8bb39979",
				"tn-static-gap-0-5rem-ce2fca4d",
				"tn-static-gap-10px-f3d7ce77",
				"tn-static-gap-12px-ed7b3d87",
				"tn-static-gap-6px-f0abc1db"
			);
			buttonContainer.classList.add("tn-static-gap-8px-33fcd4c3");
			buttonContainer.classList.remove(
				"tn-static-font-size-12px-b0cc7e05",
				"tn-static-margin-top-0-5rem-3dc98b5e",
				"tn-static-margin-top-0-d462248a",
				"tn-static-margin-top-12px-91e0f558",
				"tn-static-margin-top-16px-1b0f4999",
				"tn-static-margin-top-1rem-2239d6d5",
				"tn-static-margin-top-30px-2fbbbcd4",
				"tn-static-margin-top-4px-96ad6099",
				"tn-static-margin-top-8px-8a77e5a3",
				"tn-static-margin-top-8px-f4f01e68"
			);
			buttonContainer.classList.add("tn-static-margin-top-20px-a26bda7d");

			const cancelBtn = buttonContainer.createEl("button", {
				text: this.translate("common.cancel"),
			});
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
			window.setTimeout(() => cancelBtn.focus(), 50);
		});
	}

	private async deleteTimeblockFromDailyNote(): Promise<void> {
		if (!appHasDailyNotesPluginLoaded()) {
			throw new Error("Daily Notes plugin is not enabled");
		}

		// Get daily note for the date
		const dateStr = this.timeblockDate;
		const dailyNoteMoment = getDailyNoteMoment(dateStr, "YYYY-MM-DD");
		const allDailyNotes = getAllDailyNotes();
		const dailyNote = getDailyNote(dailyNoteMoment, allDailyNotes);

		if (!dailyNote) {
			throw new Error("Daily note not found");
		}

		// Read current content
		const content = await this.app.vault.read(dailyNote);

		// Parse existing frontmatter
		let frontmatter: Record<string, unknown> = {};
		let bodyContent = content;

		if (content.startsWith("---")) {
			const endOfFrontmatter = content.indexOf("---", 3);
			if (endOfFrontmatter !== -1) {
				const frontmatterText = content.substring(3, endOfFrontmatter);
				bodyContent = content.substring(endOfFrontmatter + 3);

				try {
					frontmatter = parseFrontmatterRecord(frontmatterText);
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
