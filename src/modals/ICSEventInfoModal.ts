/* eslint-disable no-console */
import { App, Modal, Setting, Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { ICSEvent, TaskInfo, NoteInfo } from "../types";
import { ICSNoteCreationModal } from "./ICSNoteCreationModal";
import { openFileSelector } from "./FileSelectorModal";
import { SafeAsync } from "../utils/safeAsync";
import { TranslationKey } from "../i18n";

/**
 * Modal for displaying ICS event information with note/task creation capabilities
 */
export class ICSEventInfoModal extends Modal {
	private plugin: TaskNotesPlugin;
	private icsEvent: ICSEvent;
	private subscriptionName?: string;
	private relatedNotes: (TaskInfo | NoteInfo)[] = [];
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

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
		new Setting(contentEl).setName(this.translate("modals.icsEventInfo.calendarEventHeading")).setHeading();

		// Event title
		new Setting(contentEl).setName(this.translate("modals.icsEventInfo.titleLabel")).setDesc(this.icsEvent.title || this.translate("ui.icsCard.untitledEvent"));

		// Calendar source
		if (this.subscriptionName) {
			new Setting(contentEl).setName(this.translate("modals.icsEventInfo.calendarLabel")).setDesc(this.subscriptionName);
		}

		// Date/time
		// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
		const startDateStr = this.icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(this.icsEvent.start)
			? this.icsEvent.start + 'T00:00:00'
			: this.icsEvent.start;
		const startDate = new Date(startDateStr);
		let dateText = startDate.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		if (!this.icsEvent.allDay) {
			dateText += ` at ${startDate.toLocaleTimeString()}`;

			if (this.icsEvent.end) {
				const endDateStr = /^\d{4}-\d{2}-\d{2}$/.test(this.icsEvent.end)
					? this.icsEvent.end + 'T00:00:00'
					: this.icsEvent.end;
				const endDate = new Date(endDateStr);
				dateText += ` - ${endDate.toLocaleTimeString()}`;
			}
		}

		new Setting(contentEl).setName(this.translate("modals.icsEventInfo.dateTimeLabel")).setDesc(dateText);

		// Location
		if (this.icsEvent.location) {
			new Setting(contentEl).setName(this.translate("modals.icsEventInfo.locationLabel")).setDesc(this.icsEvent.location);
		}

		// Description
		if (this.icsEvent.description) {
			new Setting(contentEl).setName(this.translate("modals.icsEventInfo.descriptionLabel")).setDesc(this.icsEvent.description);
		}

		// URL
		if (this.icsEvent.url) {
			const urlSetting = new Setting(contentEl).setName(this.translate("modals.icsEventInfo.urlLabel"));
			const link = urlSetting.descEl.createEl("a", {
				cls: "external-link",
				href: this.icsEvent.url,
				text: this.icsEvent.url,
			});
			link.setAttribute("target", "_blank");
		}

		// Related notes section
		new Setting(contentEl).setName(this.translate("modals.icsEventInfo.relatedNotesHeading")).setHeading();

		if (this.relatedNotes.length === 0) {
			new Setting(contentEl).setDesc(this.translate("modals.icsEventInfo.noRelatedItems"));
		} else {
			this.relatedNotes.forEach((note) => {
				const isTask = this.isTaskNote(note);
				const typeLabel = isTask ? this.translate("modals.icsEventInfo.typeTask") : this.translate("modals.icsEventInfo.typeNote");
				new Setting(contentEl)
					.setName(note.title)
					.setDesc(`Type: ${typeLabel}`)
					.addButton((button) => {
						button.setButtonText("Open").onClick(async () => {
							await this.safeOpenFile(note.path);
							this.close();
						});
					});
			});
		}

		// Actions section
		new Setting(contentEl).setName(this.translate("modals.icsEventInfo.actionsHeading")).setHeading();

		new Setting(contentEl)
			.setName(this.translate("modals.icsEventInfo.createFromEventLabel"))
			.setDesc(this.translate("modals.icsEventInfo.createFromEventDesc"))
			.addButton((button) => {
				button.setButtonText("Create Note").onClick(() => {
					console.log("Create Note clicked");
					this.openCreationModal();
				});
			})
			.addButton((button) => {
				button.setButtonText("Create Task").onClick(async () => {
					console.log("Create Task clicked");
					await this.createTaskDirectly();
				});
			});

		new Setting(contentEl)
			.setName(this.translate("modals.icsEventInfo.linkExistingLabel"))
			.setDesc(this.translate("modals.icsEventInfo.linkExistingDesc"))
			.addButton((button) => {
				button.setButtonText("Link Note").onClick(() => {
					console.log("Link Note clicked");
					this.linkExistingNote();
				});
			})
			.addButton((button) => {
				button.setButtonText("Refresh").onClick(() => {
					console.log("Refresh clicked");
					this.refreshRelatedNotes();
				});
			});
	}

	private async loadRelatedNotes(): Promise<void> {
		const result = await SafeAsync.execute(
			() => this.plugin.icsNoteService.findRelatedNotes(this.icsEvent),
			{
				fallback: [],
				errorMessage: "Failed to load related notes",
				showNotice: false, // Don't show notice for background operations
			}
		);
		this.relatedNotes = result || [];
	}

	private openCreationModal(): void {
		console.log("Opening note creation modal");
		try {
			const modal = new ICSNoteCreationModal(this.app, this.plugin, {
				icsEvent: this.icsEvent,
				subscriptionName: this.subscriptionName || "Unknown Calendar",
				onContentCreated: async (file: TFile, info: NoteInfo) => {
					new Notice(this.translate("notices.icsNoteCreatedSuccess"));
					this.refreshRelatedNotes();
					await this.safeOpenFile(file.path);
				},
			});

			modal.open();
		} catch (error) {
			console.error("Error opening creation modal:", error);
			new Notice(this.translate("notices.icsCreationModalOpenFailed"));
		}
	}

	private async linkExistingNote(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				openFileSelector(this.plugin, async (file) => {
					if (!file) return;

					await SafeAsync.execute(
						async () => {
							await this.plugin.icsNoteService.linkNoteToICS(
								file.path,
								this.icsEvent
							);
							new Notice(this.translate("notices.icsNoteLinkSuccess", { fileName: file.name }));
							this.refreshRelatedNotes();
						},
						{
							errorMessage: "Failed to link note",
						}
					);
				}, {
					placeholder: "Search notes to link...",
					filter: "markdown",
				});
			},
			{
				errorMessage: "Failed to open note selection",
			}
		);
	}

	private async createTaskDirectly(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				const result = await this.plugin.icsNoteService.createTaskFromICS(this.icsEvent);
				new Notice(this.translate("notices.icsTaskCreatedSuccess", { taskTitle: result.taskInfo.title }));

				// Open the created task file
				await this.safeOpenFile(result.file.path);

				// Refresh the modal to show the new related task
				this.refreshRelatedNotes();
			},
			{
				errorMessage: "Failed to create task from ICS event",
			}
		);
	}

	private async refreshRelatedNotes(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				await this.loadRelatedNotes();
				await this.renderContent();
				new Notice(this.translate("notices.icsRelatedItemsRefreshed"));
			},
			{
				errorMessage: "Failed to refresh related notes",
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
				new Notice(this.translate("notices.icsFileNotFound"));
				console.error("Invalid file path or file not found:", filePath);
			}
		} catch (error) {
			console.error("Error opening file:", error);
			new Notice(this.translate("notices.icsFileOpenFailed"));
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
