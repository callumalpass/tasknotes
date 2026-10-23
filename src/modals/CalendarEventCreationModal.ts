import { formatUIDate } from "../i18n/formatters";
import { msg } from "@lingui/core/macro";
import { App, Modal, Setting, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import {
	CalendarProvider,
	ProviderCalendar,
	type CalendarEventData,
} from "../services/CalendarProvider";
import type { InterpolationValues, TranslationKey } from "../i18n";
import { format } from "date-fns";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/CalendarEventCreationModal" });

export interface CalendarEventCreationOptions {
	start: Date;
	end: Date;
	allDay: boolean;
	onEventCreated?: () => void;
}

interface WritableCalendarEntry {
	provider: CalendarProvider;
	calendar: ProviderCalendar;
}

export function getDefaultWritableCalendarIndex(
	writableCalendars: WritableCalendarEntry[],
	googleTargetCalendarId: string | undefined
): number {
	if (googleTargetCalendarId) {
		const targetCalendarIndex = writableCalendars.findIndex(
			(entry) =>
				entry.provider.providerId === "google" &&
				entry.calendar.id === googleTargetCalendarId
		);
		if (targetCalendarIndex >= 0) {
			return targetCalendarIndex;
		}
	}

	const primaryIndex = writableCalendars.findIndex((entry) => entry.calendar.primary);
	return primaryIndex >= 0 ? primaryIndex : 0;
}

export class CalendarEventCreationModal extends Modal {
	plugin: TaskNotesPlugin;
	options: CalendarEventCreationOptions;
	private translate: (key: TranslationKey, variables?: InterpolationValues) => string;

	private titleInput: HTMLInputElement;
	private descriptionInput: HTMLTextAreaElement;
	private locationInput: HTMLInputElement;
	private calendarDropdown: HTMLSelectElement;

	private writableCalendars: WritableCalendarEntry[] = [];
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(app: App, plugin: TaskNotesPlugin, options: CalendarEventCreationOptions) {
		super(app);
		this.plugin = plugin;
		this.options = options;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
		this.writableCalendars = this.getWritableCalendars();
	}

	private getWritableCalendars(): WritableCalendarEntry[] {
		const entries: WritableCalendarEntry[] = [];
		const registry = this.plugin.calendarProviderRegistry;
		if (!registry) return entries;

		for (const provider of registry.getAllProviders()) {
			for (const calendar of provider.getAvailableCalendars()) {
				entries.push({ provider, calendar });
			}
		}
		return entries;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin", "calendar-event-creation-modal");

		// Global Ctrl/Cmd+Enter shortcut
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void this.handleSubmit();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Create calendar event", context: "modals.calendarEventCreation.heading" })))
			.setHeading();

		// Date/time display (read-only)
		const dateDisplay = contentEl.createDiv({ cls: "calendar-event-date-display" });
		dateDisplay.createEl("strong", {
			text: this.translate(msg({ message: "Date & time: ", context: "modals.calendarEventCreation.dateTimeLabel" })),
		});
		const dateText = this.options.allDay
			? formatUIDate(this.options.start, "PPP")
			: `${format(this.options.start, "PPP p")} – ${formatUIDate(this.options.end, "p")}`;
		dateDisplay.createSpan({ text: dateText });

		// Title
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Title", context: "modals.calendarEventCreation.titleLabel" })))
			.setDesc(this.translate(msg({ message: "Title for the calendar event", context: "modals.calendarEventCreation.titleDesc" })))
			.addText((text) => {
				this.titleInput = text.inputEl;
				text.setPlaceholder(
					this.translate(msg({ message: "e.g., Team meeting", context: "modals.calendarEventCreation.titlePlaceholder" }))
				).onChange(() => this.validateForm());
				window.setTimeout(() => this.titleInput.focus(), 100);
			});

		// Calendar selector
		if (this.writableCalendars.length > 1) {
			new Setting(contentEl)
				.setName(this.translate(msg({ message: "Calendar", context: "modals.calendarEventCreation.calendarLabel" })))
				.setDesc(this.translate(msg({ message: "Which calendar to create the event on", context: "modals.calendarEventCreation.calendarDesc" })))
				.addDropdown((dropdown) => {
					this.calendarDropdown = dropdown.selectEl;
					for (let i = 0; i < this.writableCalendars.length; i++) {
						const entry = this.writableCalendars[i];
						const label = `${entry.calendar.summary} (${entry.provider.providerName})`;
						dropdown.addOption(String(i), label);
					}
					const defaultIndex = getDefaultWritableCalendarIndex(
						this.writableCalendars,
						this.plugin.settings.googleCalendarExport.targetCalendarId
					);
					dropdown.setValue(String(defaultIndex));
				});
		}

		// Description (optional)
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Description", context: "modals.calendarEventCreation.descriptionLabel" })))
			.setDesc(this.translate(msg({ message: "Optional description for the event", context: "modals.calendarEventCreation.descriptionDesc" })))
			.addTextArea((text) => {
				this.descriptionInput = text.inputEl;
				text.setPlaceholder(
					this.translate(msg({ message: "Add details about this event...", context: "modals.calendarEventCreation.descriptionPlaceholder" }))
				);
				this.descriptionInput.rows = 3;
			});

		// Location (optional)
		new Setting(contentEl)
			.setName(this.translate(msg({ message: "Location", context: "modals.calendarEventCreation.locationLabel" })))
			.setDesc(this.translate(msg({ message: "Optional location for the event", context: "modals.calendarEventCreation.locationDesc" })))
			.addText((text) => {
				this.locationInput = text.inputEl;
				text.setPlaceholder(
					this.translate(msg({ message: "e.g., Conference Room A", context: "modals.calendarEventCreation.locationPlaceholder" }))
				);
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "calendar-event-modal-buttons" });

		const cancelButton = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Cancel", context: "common.cancel" })),
		});
		cancelButton.addEventListener("click", () => this.close());

		const createButton = buttonContainer.createEl("button", {
			text: this.translate(msg({ message: "Create event", context: "modals.calendarEventCreation.createButton" })),
			cls: "mod-cta calendar-event-create-button",
		});
		createButton.addEventListener("click", () => {
			void this.handleSubmit();
		});

		this.validateForm();
	}

	private validateForm(): void {
		const createButton = this.contentEl.querySelector(
			".calendar-event-create-button"
		) as HTMLButtonElement;
		if (!createButton) return;

		const isValid = !!this.titleInput?.value.trim();
		createButton.disabled = !isValid;
		createButton.style.opacity = isValid ? "1" : "0.5";
	}

	private async handleSubmit(): Promise<void> {
		const title = this.titleInput.value.trim();
		if (!title) {
			new Notice(this.translate(msg({ message: "Event title is required", context: "modals.calendarEventCreation.titleRequired" })));
			return;
		}

		// Determine which calendar to use
		const selectedIdx = this.calendarDropdown ? parseInt(this.calendarDropdown.value) : 0;
		const entry = this.writableCalendars[selectedIdx];
		if (!entry) {
			new Notice(this.translate(msg({ message: "No calendar selected", context: "modals.calendarEventCreation.noCalendarSelected" })));
			return;
		}

		try {
			const { start, end, allDay } = this.options;
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

			const eventData: CalendarEventData = {
				summary: title,
				start: allDay
					? { date: format(start, "yyyy-MM-dd") }
					: { dateTime: format(start, "yyyy-MM-dd'T'HH:mm:ss"), timeZone },
				end: allDay
					? { date: format(end, "yyyy-MM-dd") }
					: { dateTime: format(end, "yyyy-MM-dd'T'HH:mm:ss"), timeZone },
			};

			const description = this.descriptionInput?.value.trim();
			if (description) eventData.description = description;

			const location = this.locationInput?.value.trim();
			if (location) eventData.location = location;

			await entry.provider.createEvent(entry.calendar.id, eventData);

			new Notice(this.translate(msg({ message: "Calendar event \"{title}\" created", context: "modals.calendarEventCreation.success" }), { title }));
			this.options.onEventCreated?.();
			this.close();
		} catch (error) {
			tasknotesLogger.error("[TaskNotes] Error creating calendar event:", {
				category: "provider",
				operation: "creating-calendar-event",
				error: error,
			});
			new Notice(
				this.translate(msg({ message: "Failed to create calendar event: {message}", context: "modals.calendarEventCreation.error" }), {
					message: error instanceof Error ? error.message : String(error),
				})
			);
		}
	}

	onClose() {
		if (this.keyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}
