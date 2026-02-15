/* eslint-disable @microsoft/sdl/no-inner-html */
import { App, Modal, Notice, Setting } from "obsidian";
import { TimeEntry, TaskInfo } from "../types";
import type TaskNotesPlugin from "../main";
import { TranslationKey } from "../i18n";

export class TimeEntryEditorModal extends Modal {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private timeEntries: TimeEntry[];
	private onSave: (timeEntries: TimeEntry[]) => void;
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;
	private entriesContainerEl: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		task: TaskInfo,
		onSave: (timeEntries: TimeEntry[]) => void
	) {
		super(app);
		this.plugin = plugin;
		this.task = task;
		// Create a working copy of time entries
		this.timeEntries = JSON.parse(JSON.stringify(task.timeEntries || []));
		this.onSave = onSave;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("time-entry-editor-modal");

		// Modal title
		this.titleEl.setText(
			this.translate("modals.timeEntryEditor.title", { taskTitle: this.task.title })
		);

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.save();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		// Create container for entries
		this.entriesContainerEl = contentEl.createDiv({ cls: "time-entry-editor-modal__entries" });

		this.renderEntries();

		// Add new entry button
		const addButtonContainer = contentEl.createDiv({
			cls: "time-entry-editor-modal__add-button-container"
		});
		const addButton = addButtonContainer.createEl("button", {
			text: this.translate("modals.timeEntryEditor.addEntry"),
			cls: "mod-cta",
		});
		addButton.addEventListener("click", () => this.addNewEntry());

		// Footer with total time and actions
		const footer = contentEl.createDiv({ cls: "time-entry-editor-modal__footer" });

		const totalMinutes = this.calculateTotalMinutes();
		const totalHours = Math.floor(totalMinutes / 60);
		const remainingMinutes = totalMinutes % 60;
		const totalText = totalHours > 0
			? this.translate("modals.timeEntryEditor.totalTime", {
				hours: totalHours.toString(),
				minutes: remainingMinutes.toString()
			})
			: this.translate("modals.timeEntryEditor.totalMinutes", {
				minutes: totalMinutes.toString()
			});

		footer.createDiv({
			cls: "time-entry-editor-modal__total",
			text: totalText
		});

		const buttonContainer = footer.createDiv({ cls: "time-entry-editor-modal__buttons" });

		const cancelButton = buttonContainer.createEl("button", {
			text: this.translate("common.cancel"),
		});
		cancelButton.addEventListener("click", () => this.close());

		const saveButton = buttonContainer.createEl("button", {
			text: this.translate("common.save"),
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", () => this.save());
	}

	private renderEntries() {
		this.entriesContainerEl.empty();

		if (this.timeEntries.length === 0) {
			this.entriesContainerEl.createDiv({
				cls: "time-entry-editor-modal__empty",
				text: this.translate("modals.timeEntryEditor.noEntries"),
			});
			return;
		}

		// Sort entries by start time (newest first)
		const sortedEntries = [...this.timeEntries].sort((a, b) => {
			return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
		});

		sortedEntries.forEach((entry, originalIndex) => {
			// Find original index in unsorted array
			const idx = this.timeEntries.indexOf(entry);
			this.renderEntry(entry, idx);
		});
	}

	private renderEntry(entry: TimeEntry, index: number) {
		const entryEl = this.entriesContainerEl.createDiv({ cls: "time-entry-editor-modal__entry" });

		// Entry header with delete button
		const headerEl = entryEl.createDiv({ cls: "time-entry-editor-modal__entry-header" });

		const dateStr = new Date(entry.startTime).toLocaleDateString();
		headerEl.createSpan({
			cls: "time-entry-editor-modal__entry-date",
			text: dateStr
		});

		const deleteButton = headerEl.createEl("button", {
			cls: "time-entry-editor-modal__delete-button",
			attr: { "aria-label": this.translate("modals.timeEntryEditor.deleteEntry") },
		});
		deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
		deleteButton.addEventListener("click", () => this.deleteEntry(index));

		// Time inputs
		const timeContainer = entryEl.createDiv({ cls: "time-entry-editor-modal__time-container" });

		// Start time input
		const startSetting = new Setting(timeContainer)
			.setName(this.translate("modals.timeEntryEditor.startTime"));

		const startInput = startSetting.controlEl.createEl("input", {
			type: "datetime-local",
			cls: "time-entry-editor-modal__datetime-input",
		});
		startInput.value = this.formatDateTimeForInput(new Date(entry.startTime));
		startInput.addEventListener("change", () => {
			const newDate = new Date(startInput.value);
			if (!isNaN(newDate.getTime())) {
				entry.startTime = newDate.toISOString();
			}
		});

		// End time input
		const endSetting = new Setting(timeContainer)
			.setName(this.translate("modals.timeEntryEditor.endTime"));

		const endInput = endSetting.controlEl.createEl("input", {
			type: "datetime-local",
			cls: "time-entry-editor-modal__datetime-input",
		});
		if (entry.endTime) {
			endInput.value = this.formatDateTimeForInput(new Date(entry.endTime));
		}
		endInput.addEventListener("change", () => {
			if (endInput.value) {
				const newDate = new Date(endInput.value);
				if (!isNaN(newDate.getTime())) {
					entry.endTime = newDate.toISOString();
				}
			} else {
				entry.endTime = undefined;
			}
		});

		// Description
		new Setting(timeContainer)
			.setName(this.translate("modals.timeEntryEditor.description"))
			.addTextArea((text) => {
				text.setValue(entry.description || "")
					.setPlaceholder(this.translate("modals.timeEntryEditor.descriptionPlaceholder"))
					.onChange((value) => {
						entry.description = value || undefined;
					});
				text.inputEl.rows = 2;
			});
	}

	private calculateDuration(entry: TimeEntry): number {
		if (!entry.endTime) {
			// Entry is still running, calculate from start to now
			const now = new Date();
			const start = new Date(entry.startTime);
			return Math.round((now.getTime() - start.getTime()) / 60000);
		}
		const start = new Date(entry.startTime);
		const end = new Date(entry.endTime);
		return Math.round((end.getTime() - start.getTime()) / 60000);
	}

	private calculateTotalMinutes(): number {
		return this.timeEntries.reduce((total, entry) => {
			const duration = this.calculateDuration(entry);
			return total + duration;
		}, 0);
	}

	private addNewEntry() {
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

		const newEntry: TimeEntry = {
			startTime: oneHourAgo.toISOString(),
			endTime: now.toISOString(),
			description: "",
		};

		this.timeEntries.push(newEntry);
		this.renderEntries();
	}

	private deleteEntry(index: number) {
		this.timeEntries.splice(index, 1);
		this.renderEntries();
		this.onOpen(); // Re-render to update total
	}

	private formatDateTimeForInput(date: Date): string {
		// Format for datetime-local input: YYYY-MM-DDTHH:mm
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	private save() {
		// Validate entries
		for (const entry of this.timeEntries) {
			if (!entry.startTime) {
				new Notice(this.translate("modals.timeEntryEditor.validation.missingStartTime"));
				return;
			}

			if (entry.endTime) {
				const start = new Date(entry.startTime);
				const end = new Date(entry.endTime);
				if (end <= start) {
					new Notice(this.translate("modals.timeEntryEditor.validation.endBeforeStart"));
					return;
				}
			}
		}

		const sanitizedEntries = this.timeEntries.map((entry) => {
			const sanitizedEntry = { ...entry };
			delete sanitizedEntry.duration;
			return sanitizedEntry;
		});
		this.onSave(sanitizedEntries);
		this.close();
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
