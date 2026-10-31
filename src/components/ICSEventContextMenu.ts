import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Notice, TAbstractFile, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { ICSEvent } from "../types";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { ICSNoteCreationModal } from "../modals/ICSNoteCreationModal";
import { openFileSelector } from "../modals/FileSelectorModal";
import { SafeAsync } from "../utils/safeAsync";
import { ContextMenu } from "./ContextMenu";
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { showNotice } from "../ui/notifications";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/ICSEventContextMenu" });

export interface ICSEventContextMenuOptions {
	icsEvent: ICSEvent;
	plugin: TaskNotesPlugin;
	subscriptionName?: string;
	onUpdate?: () => void;
}

export class ICSEventContextMenu {
	private menu: ContextMenu;
	private options: ICSEventContextMenuOptions;

	constructor(options: ICSEventContextMenuOptions) {
		this.menu = new ContextMenu();
		this.options = options;
		this.buildMenu();
	}

	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}

	private getLocale(): string {
		return this.options.plugin.i18n.getCurrentLocale() || "en";
	}

	private buildMenu(): void {
		const { icsEvent, plugin, subscriptionName } = this.options;

		// Show details option
		this.menu.addItem((item) =>
			item
				.setTitle(this.t(msg({ message: "Show details", context: "contextMenus.ics.showDetails" })))
				.setIcon("info")
				.onClick(() => {
					const modal = new ICSEventInfoModal(
						plugin.app,
						plugin,
						icsEvent,
						subscriptionName
					);
					modal.open();
				})
		);

		this.menu.addSeparator();

		// Create task from event
		this.menu.addItem((item) =>
			item
				.setTitle(this.t(msg({ message: "Create task from event", context: "contextMenus.ics.createTask" })))
				.setIcon("check-circle")
				.onClick(async () => {
					await this.createTaskFromEvent();
				})
		);

		// Create note from event
		this.menu.addItem((item) =>
			item
				.setTitle(this.t(msg({ message: "Create note from event", context: "contextMenus.ics.createNote" })))
				.setIcon("file-plus")
				.onClick(() => {
					this.createNoteFromEvent();
				})
		);

		// Link existing note
		this.menu.addItem((item) =>
			item
				.setTitle(this.t(msg({ message: "Link existing note", context: "contextMenus.ics.linkNote" })))
				.setIcon("link")
				.onClick(() => {
					void this.linkExistingNote();
				})
		);

		this.menu.addSeparator();

		// Copy title option
		this.menu.addItem((item) =>
			item
				.setTitle(this.t(msg({ message: "Copy title", context: "contextMenus.ics.copyTitle" })))
				.setIcon("copy")
				.onClick(async () => {
					try {
						await navigator.clipboard.writeText(icsEvent.title);
						new Notice(this.t(msg({ message: "Event title copied to clipboard", context: "contextMenus.ics.notices.copyTitleSuccess" })));
					} catch {
						new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.ics.notices.copyFailure" })));
					}
				})
		);

		// Copy location (if available)
		if (icsEvent.location) {
			this.menu.addItem((item) =>
				item
					.setTitle(this.t(msg({ message: "Copy location", context: "contextMenus.ics.copyLocation" })))
					.setIcon("map-pin")
					.onClick(async () => {
						try {
							await navigator.clipboard.writeText(icsEvent.location || "");
							new Notice(this.t(msg({ message: "Location copied to clipboard", context: "contextMenus.ics.notices.copyLocationSuccess" })));
						} catch {
							new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.ics.notices.copyFailure" })));
						}
					})
			);
		}

		// Copy URL option (if available)
		if (icsEvent.url) {
			this.menu.addItem((item) =>
				item
					.setTitle(this.t(msg({ message: "Copy URL", context: "contextMenus.ics.copyUrl" })))
					.setIcon("external-link")
					.onClick(async () => {
						try {
							await navigator.clipboard.writeText(icsEvent.url || "");
							new Notice(this.t(msg({ message: "Event URL copied to clipboard", context: "contextMenus.ics.notices.copyUrlSuccess" })));
						} catch {
							new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.ics.notices.copyFailure" })));
						}
					})
			);
		}

		// Copy event details as markdown
		this.menu.addItem((item) =>
			item
				.setTitle(this.t(msg({ message: "Copy as Markdown", context: "contextMenus.ics.copyMarkdown" })))
				.setIcon("file-text")
				.onClick(async () => {
					const markdown = this.formatEventAsMarkdown();
					try {
						await navigator.clipboard.writeText(markdown);
						new Notice(this.t(msg({ message: "Event details copied as Markdown", context: "contextMenus.ics.notices.copyMarkdownSuccess" })));
					} catch {
						new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.ics.notices.copyFailure" })));
					}
				})
		);
	}

	private async createTaskFromEvent(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				const result = await this.options.plugin.icsNoteService.createTaskFromICS(
					this.options.icsEvent
				);
				new Notice(
					this.t(msg({ message: "Task created: {title}", context: "contextMenus.ics.notices.taskCreated" }), { title: result.taskInfo.title })
				);

				// Open the created task file
				const file = this.options.plugin.app.vault.getAbstractFileByPath(result.file.path);
				if (file instanceof TFile) {
					await this.options.plugin.app.workspace.getLeaf().openFile(file);
				}

				// Trigger update callback if provided
				if (this.options.onUpdate) {
					this.options.onUpdate();
				}
			},
			{
				errorMessage: this.t(msg({ message: "Failed to create task from event", context: "contextMenus.ics.notices.taskCreateFailure" })),
				noticeHandler: showNotice,
			}
		);
	}

	private createNoteFromEvent(): void {
		try {
			const modal = new ICSNoteCreationModal(this.options.plugin.app, this.options.plugin, {
				icsEvent: this.options.icsEvent,
				subscriptionName:
					this.options.subscriptionName || this.t(msg({ message: "Unknown calendar", context: "contextMenus.ics.subscriptionUnknown" })),
				onContentCreated: (file: TFile) => {
					void (async () => {
						new Notice(this.t(msg({ message: "Note created successfully", context: "contextMenus.ics.notices.noteCreated" })));
						await this.options.plugin.app.workspace.getLeaf().openFile(file);

						// Trigger update callback if provided
						if (this.options.onUpdate) {
							this.options.onUpdate();
						}
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
			new Notice(this.t(msg({ message: "Failed to open creation modal", context: "contextMenus.ics.notices.creationFailure" })));
		}
	}

	private async linkExistingNote(): Promise<void> {
		await SafeAsync.execute(
			async () => {
				openFileSelector(
					this.options.plugin,
					(file) => {
						if (!(file instanceof TAbstractFile)) return;

						void SafeAsync.execute(
							async () => {
								await this.options.plugin.icsNoteService.linkNoteToICS(
									file.path,
									this.options.icsEvent
								);
								new Notice(
									this.t(msg({ message: "Linked note \"{name}\" to event", context: "contextMenus.ics.notices.linkSuccess" }), {
										name: file.name,
									})
								);

								// Trigger update callback if provided
								if (this.options.onUpdate) {
									this.options.onUpdate();
								}
							},
							{
								errorMessage: this.t(msg({ message: "Failed to link note", context: "contextMenus.ics.notices.linkFailure" })),
								noticeHandler: showNotice,
							}
						);
					},
					{
						placeholder: this.t(msg({ message: "Search notes to link...", context: "modals.icsEventInfo.searchNotes" })),
						filter: "markdown",
					}
				);
			},
			{
				errorMessage: this.t(msg({ message: "Failed to open note selection", context: "contextMenus.ics.notices.linkSelectionFailure" })),
				noticeHandler: showNotice,
			}
		);
	}

	private formatEventAsMarkdown(): string {
		const { icsEvent, subscriptionName } = this.options;
		const lines: string[] = [];

		const title = icsEvent.title || this.t(msg({ message: "Untitled event", context: "contextMenus.ics.markdown.titleFallback" }));
		lines.push(`## ${title}`);
		lines.push("");

		if (subscriptionName) {
			lines.push(this.t(msg({ message: "**Calendar:** {value}", context: "contextMenus.ics.markdown.calendar" }), { value: subscriptionName }));
		}

		const locale = this.getLocale();
		// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
		const startDateStr =
			icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
				? icsEvent.start + "T00:00:00"
				: icsEvent.start;
		const startDate = new Date(startDateStr);
		const dateFormatter = new Intl.DateTimeFormat(locale, {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
		const timeFormatter = new Intl.DateTimeFormat(locale, {
			hour: "numeric",
			minute: "2-digit",
		});

		let dateText = dateFormatter.format(startDate);
		if (!icsEvent.allDay) {
			dateText += this.t(msg({ message: " at {time}", context: "contextMenus.ics.markdown.at" }), {
				time: timeFormatter.format(startDate),
			});
			if (icsEvent.end) {
				const endDateStr = /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.end)
					? icsEvent.end + "T00:00:00"
					: icsEvent.end;
				const endDate = new Date(endDateStr);
				dateText += ` - ${timeFormatter.format(endDate)}`;
			}
		}

		lines.push(this.t(msg({ message: "**Date & Time:** {value}", context: "contextMenus.ics.markdown.date" }), { value: dateText }));

		if (icsEvent.location) {
			lines.push(this.t(msg({ message: "**Location:** {value}", context: "contextMenus.ics.markdown.location" }), { value: icsEvent.location }));
		}

		if (icsEvent.description) {
			lines.push("");
			lines.push(this.t(msg({ message: "### Description", context: "contextMenus.ics.markdown.descriptionHeading" })));
			lines.push(icsEvent.description);
		}

		if (icsEvent.url) {
			lines.push("");
			lines.push(this.t(msg({ message: "**URL:** {value}", context: "contextMenus.ics.markdown.url" }), { value: icsEvent.url }));
		}

		return lines.join("\n");
	}

	public show(event: MouseEvent): void {
		showCoordinatedMenu(this.menu, event);
	}

	public showAtElement(element: HTMLElement): void {
		showCoordinatedMenuAtElement(this.menu, element);
	}
}
