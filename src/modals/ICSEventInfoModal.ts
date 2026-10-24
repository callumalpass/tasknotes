import { uiLocale } from "../i18n/runtime";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { App, Modal, Setting, Notice, TAbstractFile, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { ICSEvent, TaskInfo, NoteInfo } from "../types";
import { ICSNoteCreationModal } from "./ICSNoteCreationModal";
import { openFileSelector } from "./FileSelectorModal";
import { SafeAsync } from "../utils/safeAsync";
import { TranslationKey } from "../i18n";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { showNotice } from "../ui/notifications";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/ICSEventInfoModal" });

/**
 * Modal for displaying ICS event information with note/task creation capabilities
 */
export class ICSEventInfoModal extends Modal {
	private plugin: TaskNotesPlugin;
	private icsEvent: ICSEvent;
	private subscriptionName?: string;
	private relatedNotes: (TaskInfo | NoteInfo)[] = [];
	private translate: (key: TranslationKey, variables?: Record<string, unknown>) => string;

	constructor(app: App, plugin: TaskNotesPlugin, icsEvent: ICSEvent, subscriptionName?: string) {
		super(app);
		this.plugin = plugin;
		this.icsEvent = icsEvent;
		this.subscriptionName = subscriptionName;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
	}

	async onOpen() {
		await this.renderContent();
	}

	private async renderContent() {
		const { contentEl } = this;
		contentEl.empty();

		// Load related notes first
		await this.loadRelatedNotes();

		// Header
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Calendar event", context: "modals.icsEventInfo.calendarEventHeading" })))
			.setHeading();

		// Event title
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Title", context: "modals.icsEventInfo.titleLabel" })))
			.setDesc(this.icsEvent.title || this.translate(msg({ message: "Untitled event", context: "ui.icsCard.untitledEvent" })));

		// Calendar source
		if (this.subscriptionName) {
			new Setting(contentEl)
				.setName(this.translate(msg({ message: "Calendar", context: "modals.icsEventInfo.calendarLabel" })))
				.setDesc(this.subscriptionName);
		}

		// Date/time
		// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
		const startDateStr =
			this.icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(this.icsEvent.start)
				? this.icsEvent.start + "T00:00:00"
				: this.icsEvent.start;
		const startDate = new Date(startDateStr);
		const dateFormatter = new Intl.DateTimeFormat(uiLocale(), {
			dateStyle: "full",
			...(this.icsEvent.allDay ? {} : { timeStyle: "short" as const, hour12: this.plugin.settings.calendarViewSettings.timeFormat === "12" }),
		});
		let dateText = dateFormatter.format(startDate);
		if (!this.icsEvent.allDay && this.icsEvent.end) {
			const endDateStr = /^\d{4}-\d{2}-\d{2}$/.test(this.icsEvent.end) ? this.icsEvent.end + "T00:00:00" : this.icsEvent.end;
			const endDate = new Date(endDateStr);
			if (Number.isFinite(endDate.getTime()) && endDate >= startDate) dateText = dateFormatter.formatRange(startDate, endDate);
		}

		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Date & time", context: "modals.icsEventInfo.dateTimeLabel" })))
			.setDesc(dateText);

		// Location
		if (this.icsEvent.location) {
			new Setting(contentEl)
				.setName(this.translate(msg({ message: "Location", context: "modals.icsEventInfo.locationLabel" })))
				.setDesc(this.icsEvent.location);
		}

		// Description
		if (this.icsEvent.description) {
			new Setting(contentEl)
				.setName(this.translate(msg({ message: "Description", context: "modals.icsEventInfo.descriptionLabel" })))
				.setDesc(this.icsEvent.description);
		}

		// URL
		if (this.icsEvent.url) {
			const urlSetting = new Setting(contentEl).setName(
				this.translate(msg({ message: "URL", context: "modals.icsEventInfo.urlLabel" }))
			);
			const link = urlSetting.descEl.createEl("a", {
				cls: "external-link",
				href: this.icsEvent.url,
				text: this.icsEvent.url,
			});
			link.setAttribute("target", "_blank");
		}

		// Related notes section
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Related notes & tasks", context: "modals.icsEventInfo.relatedNotesHeading" })))
			.setHeading();

		if (this.relatedNotes.length === 0) {
			new Setting(contentEl).setDesc(this.translate(msg({ message: "No related notes or tasks found for this event.", context: "modals.icsEventInfo.noRelatedItems" })));
		} else {
			this.relatedNotes.forEach((note) => {
				const isTask = this.isTaskNote(note);
				const typeLabel = isTask
					? this.translate(msg({ message: "Task", context: "modals.icsEventInfo.typeTask" }))
					: this.translate(msg({ message: "Note", context: "modals.icsEventInfo.typeNote" }));
				new Setting(contentEl)
					.setName(note.title)
					.setDesc(this.translate(msg({ message: "Type: {type}", context: "modals.icsEventInfo.typeValue" }), { type: typeLabel }))
					.addButton((button) => {
						button
							.setButtonText(this.translate(msg({ message: "Open", context: "modals.deviceCode.steps.open" })))
							.onClick(async () => {
								await this.safeOpenFile(note.path);
								this.close();
							});
					});
			});
		}

		// Actions section
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Actions", context: "modals.icsEventInfo.actionsHeading" })))
			.setHeading();

		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Create from event", context: "modals.icsEventInfo.createFromEventLabel" })))
			.setDesc(this.translate(msg({ message: "Create a new note or task from this calendar event", context: "modals.icsEventInfo.createFromEventDesc" })))
			.addButton((button) => {
				button.setButtonText(uiText(msg({ message: "Create note", context: "modals/ICSEventInfoModal: ICSEventInfoModal.renderContent display" }))).onClick(() => {
					this.openCreationModal();
				});
			})
			.addButton((button) => {
				button
					.setButtonText(this.translate(msg({ message: "Create task", context: "modals.taskCreation.title" })))
					.onClick(async () => {
						await this.createTaskDirectly();
					});
			});

		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Link existing", context: "modals.icsEventInfo.linkExistingLabel" })))
			.setDesc(this.translate(msg({ message: "Link an existing note to this calendar event", context: "modals.icsEventInfo.linkExistingDesc" })))
			.addButton((button) => {
				button.setButtonText(uiText(msg({ message: "Link note", context: "modals/ICSEventInfoModal: ICSEventInfoModal.renderContent display" }))).onClick(() => {
					void this.linkExistingNote();
				});
			})
			.addButton((button) => {
				button.setButtonText(this.translate(msg({ message: "Refresh", context: "views.notes.refreshButton" }))).onClick(() => {
					void this.refreshRelatedNotes();
				});
			});
	}

	private async loadRelatedNotes(): Promise<void> {
		const result = await SafeAsync.execute(
			() => this.plugin.icsNoteService.findRelatedNotes(this.icsEvent),
			{
				fallback: [],
				errorMessage: uiText(msg({ message: "Failed to load related notes", context: "modals/ICSEventInfoModal: ICSEventInfoModal.loadRelatedNotes errorMessage" })),
				showNotice: false, // Don't show notice for background operations
			}
		);
		this.relatedNotes = result || [];
	}

	private openCreationModal(): void {
		try {
			const modal = new ICSNoteCreationModal(this.app, this.plugin, {
				icsEvent: this.icsEvent,
				subscriptionName: this.subscriptionName || uiText(msg({ message: "Unknown Calendar", context: "modals/ICSEventInfoModal: ICSEventInfoModal.openCreationModal subscriptionName" })),
				onContentCreated: (file: TFile, _info: NoteInfo) => {
					void (async () => {
						new Notice(this.translate(msg({ message: "Note created successfully", context: "notices.icsNoteCreatedSuccess" })));
						void this.refreshRelatedNotes();
						await this.safeOpenFile(file.path);
					})();
				},
			});

			modal.open();
		} catch (error) {
			tasknotesLogger.error("Error opening creation modal:", {
				category: "provider",
				operation: "opening-creation-modal",
				error: error,
			});
			new Notice(this.translate(msg({ message: "Failed to open creation modal", context: "notices.icsCreationModalOpenFailed" })));
		}
	}

	private async linkExistingNote(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				openFileSelector(
					this.plugin,
					(file) => {
						if (!(file instanceof TAbstractFile)) return;

						void SafeAsync.execute(
							async () => {
								await this.plugin.icsNoteService.linkNoteToICS(
									file.path,
									this.icsEvent
								);
								new Notice(
									this.translate(msg({ message: "Linked note \"{fileName}\" to ICS event", context: "notices.icsNoteLinkSuccess" }), {
										fileName: file.name,
									})
								);
								void this.refreshRelatedNotes();
							},
							{
								errorMessage: this.translate(
									msg({ message: "Failed to link note", context: "contextMenus.ics.notices.linkFailure" })
								),
								noticeHandler: showNotice,
							}
						);
					},
					{
						placeholder: this.translate(msg({ message: "Search notes to link...", context: "modals.icsEventInfo.searchNotes" })),
						filter: "markdown",
					}
				);
			},
			{
				errorMessage: this.translate(msg({ message: "Failed to open note selection", context: "contextMenus.ics.notices.linkSelectionFailure" })),
				noticeHandler: showNotice,
			}
		);
	}

	private async createTaskDirectly(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				const result = await this.plugin.icsNoteService.createTaskFromICS(this.icsEvent);
				new Notice(
					this.translate(msg({ message: "Task created: {title}", context: "notices.icsTaskCreatedSuccess" }), {
						title: result.taskInfo.title,
					})
				);

				// Open the created task file
				await this.safeOpenFile(result.file.path);

				// Refresh the modal to show the new related task
				void this.refreshRelatedNotes();
			},
			{
				errorMessage: uiText(msg({ message: "Failed to create task from ICS event", context: "modals/ICSEventInfoModal: ICSEventInfoModal.createTaskDirectly errorMessage" })),
				noticeHandler: showNotice,
			}
		);
	}

	private async refreshRelatedNotes(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				await this.loadRelatedNotes();
				await this.renderContent();
				new Notice(this.translate(msg({ message: "Related notes refreshed", context: "notices.icsRelatedItemsRefreshed" })));
			},
			{
				errorMessage: uiText(msg({ message: "Failed to refresh related notes", context: "modals/ICSEventInfoModal: ICSEventInfoModal.refreshRelatedNotes errorMessage" })),
				noticeHandler: showNotice,
			}
		);
	}

	/**
	 * Check if a note is a task based on the user-configured task tag
	 */
	private isTaskNote(note: TaskInfo | NoteInfo): boolean {
		// Tasks are identified exclusively by their tag
		const taskTag = this.plugin.settings.taskTag;
		return note.tags?.includes(taskTag) || false;
	}

	/**
	 * Type-safe file opening with proper error handling
	 */
	private async safeOpenFile(filePath: string): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				await this.app.workspace.getLeaf().openFile(file);
			} else {
				new Notice(this.translate(msg({ message: "File not found or invalid", context: "notices.icsFileNotFound" })));
				tasknotesLogger.error("Invalid file path or file not found:", {
					category: "provider",
					operation: "invalid-file-path-or-file-not-found",
					details: { value: filePath },
				});
			}
		} catch (error) {
			tasknotesLogger.error("Error opening file:", {
				category: "provider",
				operation: "opening-file",
				error: error,
			});
			new Notice(this.translate(msg({ message: "Failed to open file", context: "notices.icsFileOpenFailed" })));
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
