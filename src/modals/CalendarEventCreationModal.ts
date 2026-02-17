import { App, Modal, Setting, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { CalendarProvider, ProviderCalendar } from "../services/CalendarProvider";
import { TranslationKey } from "../i18n";
import { format } from "date-fns";

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

export class CalendarEventCreationModal extends Modal {
	plugin: TaskNotesPlugin;
	options: CalendarEventCreationOptions;
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

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
		contentEl.addClass("calendar-event-creation-modal");

		// Global Ctrl/Cmd+Enter shortcut
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.handleSubmit();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		new Setting(contentEl)
			.setName(this.translate("modals.calendarEventCreation.heading"))
			.setHeading();

		// Date/time display (read-only)
		const dateDisplay = contentEl.createDiv({ cls: "calendar-event-date-display" });
		dateDisplay.createEl("strong", {
			text: this.translate("modals.calendarEventCreation.dateTimeLabel"),
		});
		const dateText = this.options.allDay
			? format(this.options.start, "PPP")
			: `${format(this.options.start, "PPP p")} – ${format(this.options.end, "p")}`;
		dateDisplay.createSpan({ text: dateText });

		// Title
		new Setting(contentEl)
			.setName(this.translate("modals.calendarEventCreation.titleLabel"))
			.setDesc(this.translate("modals.calendarEventCreation.titleDesc"))
			.addText((text) => {
				this.titleInput = text.inputEl;
				text.setPlaceholder(
					this.translate("modals.calendarEventCreation.titlePlaceholder")
				).onChange(() => this.validateForm());
				window.setTimeout(() => this.titleInput.focus(), 100);
			});

		// Calendar selector
		if (this.writableCalendars.length > 1) {
			new Setting(contentEl)
				.setName(this.translate("modals.calendarEventCreation.calendarLabel"))
				.setDesc(this.translate("modals.calendarEventCreation.calendarDesc"))
				.addDropdown((dropdown) => {
					this.calendarDropdown = dropdown.selectEl;
					for (let i = 0; i < this.writableCalendars.length; i++) {
						const entry = this.writableCalendars[i];
						const label = `${entry.calendar.summary} (${entry.provider.providerName})`;
						dropdown.addOption(String(i), label);
					}
					// Default to primary calendar if available
					const primaryIdx = this.writableCalendars.findIndex(
						(e) => e.calendar.primary
					);
					if (primaryIdx >= 0) {
						dropdown.setValue(String(primaryIdx));
					}
				});
		}

		// Description (optional)
		new Setting(contentEl)
			.setName(this.translate("modals.calendarEventCreation.descriptionLabel"))
			.setDesc(this.translate("modals.calendarEventCreation.descriptionDesc"))
			.addTextArea((text) => {
				this.descriptionInput = text.inputEl;
				text.setPlaceholder(
					this.translate("modals.calendarEventCreation.descriptionPlaceholder")
				);
				this.descriptionInput.rows = 3;
			});

		// Location (optional)
		new Setting(contentEl)
			.setName(this.translate("modals.calendarEventCreation.locationLabel"))
			.setDesc(this.translate("modals.calendarEventCreation.locationDesc"))
			.addText((text) => {
				this.locationInput = text.inputEl;
				text.setPlaceholder(
					this.translate("modals.calendarEventCreation.locationPlaceholder")
				);
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "calendar-event-modal-buttons" });

		const cancelButton = buttonContainer.createEl("button", {
			text: this.translate("common.cancel"),
		});
		cancelButton.addEventListener("click", () => this.close());

		const createButton = buttonContainer.createEl("button", {
			text: this.translate("modals.calendarEventCreation.createButton"),
			cls: "mod-cta calendar-event-create-button",
		});
		createButton.addEventListener("click", () => this.handleSubmit());

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
			new Notice(this.translate("modals.calendarEventCreation.titleRequired"));
			return;
		}

		// Determine which calendar to use
		const selectedIdx = this.calendarDropdown
			? parseInt(this.calendarDropdown.value)
			: 0;
		const entry = this.writableCalendars[selectedIdx];
		if (!entry) {
			new Notice(this.translate("modals.calendarEventCreation.noCalendarSelected"));
			return;
		}

		try {
			const { start, end, allDay } = this.options;
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

			const eventData: any = {
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

			new Notice(
				this.translate("modals.calendarEventCreation.success", { title })
			);
			this.options.onEventCreated?.();
			this.close();
		} catch (error) {
			console.error("[TaskNotes] Error creating calendar event:", error);
			new Notice(
				this.translate("modals.calendarEventCreation.error", {
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
