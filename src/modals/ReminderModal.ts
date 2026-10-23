import { uiData } from "../i18n/dataText";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { App, Modal, Setting, setIcon, Notice, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo, Reminder } from "../types";
import { formatDateForDisplay } from "../utils/dateUtils";
import { attachDateInputBehavior } from "../ui/dateInputBehavior";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/ReminderModal" });
const REMINDER_FIELDS_HIDDEN_CLASS = "reminder-modal__fields--hidden";

export class ReminderModal extends Modal {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private reminders: Reminder[];
	private onSave: (reminders: Reminder[]) => void;
	private originalReminders: Reminder[];
	private saveBtn: HTMLButtonElement;

	// Form state
	private selectedType: "absolute" | "relative" = "relative";
	private relativeAnchor: "due" | "scheduled" = "due";
	private relativeOffset = 15;
	private relativeUnit: "minutes" | "hours" | "days" = "minutes";
	private relativeDirection: "before" | "after" = "before";
	private absoluteDate = "";
	private absoluteTime = "";
	private description = "";

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		task: TaskInfo,
		onSave: (reminders: Reminder[]) => void
	) {
		super(app);
		this.plugin = plugin;
		this.task = task;
		this.reminders = task.reminders ? [...task.reminders] : [];
		this.originalReminders = task.reminders ? [...task.reminders] : [];
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin");
		contentEl.addClass("tasknotes-reminder-modal");

		// Show loading state while we fetch fresh data
		const loadingContainer = contentEl.createDiv({ cls: "reminder-modal__loading" });
		loadingContainer.createDiv({ text: this.plugin.i18n.translate(msg({ message: "Loading reminders...", context: "modals.reminder.loading" })) });

		// Fetch fresh data and render the modal
		this.initializeWithFreshData().catch((error) => {
			tasknotesLogger.error("Failed to initialize reminder modal:", {
				category: "internal",
				operation: "initialize-reminder-modal",
				error: error,
			});
			contentEl.empty();
			contentEl.addClass("tasknotes-plugin");
			contentEl.addClass("tasknotes-reminder-modal");
			contentEl.createDiv({
				cls: "reminder-modal__error",
				text: this.plugin.i18n.translate(msg({ message: "Failed to load task data. Please try again.", context: "modals.reminder.loadFailed" })),
			});
		});
	}

	private async initializeWithFreshData(): Promise<void> {
		const { contentEl } = this;

		// Fetch fresh task data to avoid working with stale data
		if (this.task.path && this.task.path.trim() !== "") {
			const freshTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
			if (freshTask) {
				this.task = freshTask;
				this.reminders = freshTask.reminders ? [...freshTask.reminders] : [];
				this.originalReminders = freshTask.reminders ? [...freshTask.reminders] : [];
			} else {
				// Task path exists but not found in cache - use provided task data
				// This can happen during edit when changes haven't been saved yet
				this.reminders = this.task.reminders ? [...this.task.reminders] : [];
				this.originalReminders = this.task.reminders ? [...this.task.reminders] : [];
			}
		} else {
			// Task doesn't have a path yet (new task being created)
			// Use the provided task data
			this.reminders = this.task.reminders ? [...this.task.reminders] : [];
			this.originalReminders = this.task.reminders ? [...this.task.reminders] : [];
		}

		// Clear loading state and render the actual modal content
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin");
		contentEl.addClass("tasknotes-reminder-modal");

		// Compact header
		const headerContainer = contentEl.createDiv({ cls: "reminder-modal__header" });
		headerContainer.createEl("h2", {
			text: this.plugin.i18n.translate(msg({ message: "Task reminders", context: "modals.reminder.title" })),
		});

		headerContainer.createDiv({
			cls: "reminder-modal__task-title",
			text: this.task.title,
		});

		// Add task dates context if available
		const contextInfo = this.getTaskContextInfo();
		if (contextInfo) {
			const taskDates = headerContainer.createDiv({ cls: "reminder-modal__task-dates" });
			taskDates.textContent = contextInfo;
		}

		// Main content area - more compact
		const contentContainer = contentEl.createDiv({ cls: "reminder-modal__content" });

		// Existing reminders section
		this.renderExistingReminders(contentContainer);

		// Add new reminder section
		this.renderAddReminderForm(contentContainer);

		// Action buttons
		this.renderActionButtons(contentEl);

		// Set up keyboard handlers and update save button state
		this.setupKeyboardHandlers();
		this.updateSaveButtonState();
	}

	private renderActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: "reminder-modal__actions" });

		// Save button (initially disabled)
		this.saveBtn = buttonContainer.createEl("button", {
			text: this.plugin.i18n.translate(msg({ message: "Save changes", context: "modals.timeblockInfo.saveButton" })),
			cls: "mod-cta reminder-modal__save-btn",
		});
		this.saveBtn.disabled = true;
		this.saveBtn.onclick = async () => {
			await this.save();
		};

		const cancelBtn = buttonContainer.createEl("button", {
			text: this.plugin.i18n.translate(msg({ message: "Cancel", context: "common.cancel" })),
			cls: "reminder-modal__cancel-btn",
		});
		cancelBtn.onclick = () => {
			this.cancel();
		};
	}

	private getTaskContextInfo(): string | null {
		const parts: string[] = [];

		if (this.task.due) {
			parts.push(
				this.plugin.i18n.translate(msg({ message: "Due: {date}", context: "modals.reminder.dueContext" }), {
					date: formatDateForDisplay(this.task.due),
				})
			);
		}

		if (this.task.scheduled) {
			parts.push(
				this.plugin.i18n.translate(msg({ message: "Scheduled: {date}", context: "modals.reminder.scheduledContext" }), {
					date: formatDateForDisplay(this.task.scheduled),
				})
			);
		}

		return parts.length > 0 ? parts.join(" • ") : null;
	}

	private setupKeyboardHandlers(): void {
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !this.saveBtn.disabled) {
				e.preventDefault();
				void this.save();
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.cancel();
			}
		};

		this.contentEl.addEventListener("keydown", handleKeydown);
		this.onClose = () => {
			this.contentEl.removeEventListener("keydown", handleKeydown);
			const { contentEl } = this;
			contentEl.empty();
		};
	}

	private updateSaveButtonState(): void {
		if (!this.saveBtn) return;

		const hasChanges = this.remindersHaveChanged();
		this.saveBtn.disabled = !hasChanges;
		this.saveBtn.textContent = hasChanges
			? this.plugin.i18n.translate(msg({ message: "Save changes", context: "modals.timeblockInfo.saveButton" }))
			: this.plugin.i18n.translate(msg({ message: "No changes", context: "modals.reminder.noChanges" }));
	}

	private renderExistingReminders(container: HTMLElement): void {
		const section = container.createDiv({ cls: "reminder-modal__section" });

		const sectionHeader = section.createDiv({ cls: "reminder-modal__section-header" });
		sectionHeader.createEl("h3", {
			text: this.plugin.i18n.translate(msg({ message: "Current reminders", context: "modals.reminder.current" })),
		});

		if (this.reminders.length > 0) {
			sectionHeader.createSpan({
				cls: "reminder-modal__reminder-count",
				text: `(${this.reminders.length})`,
			});
		}

		if (this.reminders.length === 0) {
			const emptyState = section.createDiv({ cls: "reminder-modal__empty-state" });
			setIcon(emptyState.createDiv({ cls: "reminder-modal__empty-icon" }), "bell-off");
			emptyState.createDiv({
				cls: "reminder-modal__empty-text",
				text: this.plugin.i18n.translate(msg({ message: "No reminders set", context: "modals.reminder.empty" })),
			});
			return;
		}

		const reminderList = section.createDiv({ cls: "reminder-modal__reminder-list" });

		this.reminders.forEach((reminder, index) => {
			const reminderCard = reminderList.createDiv({ cls: "reminder-modal__reminder-card" });

			// Reminder type icon
			const iconContainer = reminderCard.createDiv({ cls: "reminder-modal__reminder-icon" });
			const iconName = reminder.type === "absolute" ? "calendar-clock" : "timer";
			setIcon(iconContainer, iconName);

			// Main content area
			const content = reminderCard.createDiv({ cls: "reminder-modal__reminder-content" });

			// Primary info (timing with time for absolute reminders)
			const primaryInfo = content.createDiv({ cls: "reminder-modal__reminder-primary" });
			primaryInfo.textContent = this.formatReminderDisplayText(reminder);

			// Custom description (if any)
			if (reminder.description) {
				const description = content.createDiv({
					cls: "reminder-modal__reminder-description",
				});
				description.textContent = `"${reminder.description}"`;
			}

			// Actions area - only remove button
			const actions = reminderCard.createDiv({ cls: "reminder-modal__reminder-actions" });

			// Remove button with Obsidian tooltip
			const removeBtn = actions.createEl("button", {
				cls: "reminder-modal__action-btn reminder-modal__remove-btn",
			});
			setIcon(removeBtn, "trash-2");
			setTooltip(
				removeBtn,
				this.plugin.i18n.translate(msg({ message: "Delete reminder", context: "settings.defaults.reminders.deleteTooltip" }))
			);
			removeBtn.onclick = async (e) => {
				e.stopPropagation();
				await this.removeReminder(index);
			};
		});
	}

	private formatReminderDisplayText(reminder: Reminder): string {
		if (reminder.type === "absolute") {
			if (!reminder.absoluteTime)
				return this.plugin.i18n.translate(msg({ message: "Absolute", context: "modals.reminder.absolute" }));
			const date = new Date(reminder.absoluteTime);
			return this.plugin.i18n.translate(msg({ message: "At {date}", context: "modals.reminder.at" }), {
				date: Number.isNaN(date.getTime())
					? reminder.absoluteTime
					: date.toLocaleString(this.plugin.i18n.getCurrentLocale(), {
							dateStyle: "medium",
							timeStyle: "short",
						}),
			});
		}
		return this.formatRelativeReminder(reminder.relatedTo ?? "due", reminder.offset ?? "");
	}

	private renderQuickActions(section: HTMLElement): void {
		// Only show quick actions if task has due/scheduled dates
		const hasDates = this.task.due || this.task.scheduled;
		if (!hasDates) return;

		const quickActions = section.createDiv({ cls: "reminder-modal__quick-actions" });

		const buttonsContainer = quickActions.createDiv({ cls: "reminder-modal__quick-buttons" });

		const commonReminders = [
			{ value: 5, unit: "minute", offset: "-PT5M", icon: "clock" },
			{ value: 15, unit: "minute", offset: "-PT15M", icon: "clock" },
			{ value: 1, unit: "hour", offset: "-PT1H", icon: "clock" },
			{ value: 1, unit: "day", offset: "-P1D", icon: "calendar" },
		];

		commonReminders.forEach(({ value, unit, offset, icon }) => {
			const anchor = this.task.due ? "due" : "scheduled";
			const fullLabel = this.formatRelativeReminder(anchor, offset);
			const label = new Intl.NumberFormat(this.plugin.i18n.getCurrentLocale(), {
				style: "unit",
				unit,
				unitDisplay: "narrow",
			}).format(value);

			const quickBtn = buttonsContainer.createEl("button", {
				cls: "reminder-modal__quick-btn",
			});

			const iconEl = quickBtn.createSpan({ cls: "reminder-modal__quick-btn-icon" });
			setIcon(iconEl, icon);

			quickBtn.createSpan({
				cls: "reminder-modal__quick-btn-label",
				text: label,
			});

			// Use Obsidian's native tooltip
			setTooltip(
				quickBtn,
				this.plugin.i18n.translate(msg({ message: "Add reminder: {timing}", context: "modals.reminder.quickTooltip" }), { timing: fullLabel })
			);

			quickBtn.onclick = async () => {
				await this.addQuickReminder(anchor, offset, fullLabel);
			};
		});
	}

	private async addQuickReminder(
		anchor: "due" | "scheduled",
		offset: string,
		description: string
	): Promise<void> {
		const reminder: Reminder = {
			id: `rem_${Date.now()}`,
			type: "relative",
			relatedTo: anchor,
			offset,
			description,
		};

		await this.addReminder(reminder);
		new Notice(this.plugin.i18n.translate(msg({ message: "Added reminder: {description}", context: "modals.reminder.added" }), { description }));
	}

	private renderAddReminderForm(container: HTMLElement): void {
		const section = container.createDiv({ cls: "reminder-modal__section" });

		const sectionHeader = section.createDiv({ cls: "reminder-modal__section-header" });
		sectionHeader.createEl("h3", {
			text: this.plugin.i18n.translate(msg({ message: "Add new reminder", context: "modals.reminder.addNew" })),
		});

		// Add quick actions for common reminders
		this.renderQuickActions(section);

		const form = section.createDiv({ cls: "reminder-modal__form" });

		// Compact type selector
		const typeSelector = form.createDiv({ cls: "reminder-modal__type-selector" });

		const relativeTab = typeSelector.createEl("button", {
			cls: "reminder-modal__type-tab reminder-modal__type-tab--active",
			text: this.plugin.i18n.translate(msg({ message: "Relative", context: "modals.reminder.relative" })),
			attr: { "data-type": "relative" },
		});

		const absoluteTab = typeSelector.createEl("button", {
			cls: "reminder-modal__type-tab",
			text: this.plugin.i18n.translate(msg({ message: "Absolute", context: "modals.reminder.absolute" })),
			attr: { "data-type": "absolute" },
		});

		// Set initial state based on instance variables
		relativeTab.classList.toggle(
			"reminder-modal__type-tab--active",
			this.selectedType === "relative"
		);
		absoluteTab.classList.toggle(
			"reminder-modal__type-tab--active",
			this.selectedType === "absolute"
		);

		// Tab switching logic
		const switchToType = (type: "relative" | "absolute") => {
			this.selectedType = type;

			// Update tab appearance
			relativeTab.classList.toggle("reminder-modal__type-tab--active", type === "relative");
			absoluteTab.classList.toggle("reminder-modal__type-tab--active", type === "absolute");

			// Update form visibility
			this.updateFormVisibility(form, this.selectedType);
		};

		relativeTab.onclick = () => switchToType("relative");
		absoluteTab.onclick = () => switchToType("absolute");

		// Relative reminder fields
		const relativeContainer = form.createDiv({ cls: "relative-fields" });

		new Setting(relativeContainer)
			.setName(this.plugin.i18n.translate(msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })))
			.addText((text) => {
				text.setPlaceholder("15")
					.setValue(String(this.relativeOffset))
					.onChange((value) => {
						this.relativeOffset = parseInt(value) || 0;
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption(
						"minutes",
						this.plugin.i18n.translate(msg({ message: "Minutes", context: "views.pomodoroStats.stats.minutes" }))
					)
					.addOption(
						"hours",
						this.plugin.i18n.translate(msg({ message: "hours", context: "settings.defaults.reminders.units.hours" }))
					)
					.addOption(
						"days",
						this.plugin.i18n.translate(msg({ message: "days", context: "settings.defaults.reminders.units.days" }))
					)
					.setValue(this.relativeUnit)
					.onChange((value) => {
						this.relativeUnit = value as "minutes" | "hours" | "days";
					});
			});

		new Setting(relativeContainer)
			.setName(this.plugin.i18n.translate(msg({ message: "Direction:", context: "settings.defaults.reminders.fields.direction" })))
			.addDropdown((dropdown) => {
				dropdown
					.addOption(
						"before",
						this.plugin.i18n.translate(msg({ message: "before", context: "settings.defaults.reminders.directions.before" }))
					)
					.addOption(
						"after",
						this.plugin.i18n.translate(msg({ message: "after", context: "settings.defaults.reminders.directions.after" }))
					)
					.setValue(this.relativeDirection)
					.onChange((value) => {
						this.relativeDirection = value as "before" | "after";
					});
			});

		new Setting(relativeContainer)
			.setName(this.plugin.i18n.translate(msg({ message: "Relative to", context: "modals.reminder.relativeTo" })))
			.addDropdown((dropdown) => {
				const options: Record<string, string> = {};
				if (this.task.due) {
					options.due = this.plugin.i18n.translate(msg({ message: "Due: {date}", context: "modals.reminder.dueContext" }), {
						date: formatDateForDisplay(this.task.due),
					});
				}
				if (this.task.scheduled) {
					options.scheduled = this.plugin.i18n.translate(
						msg({ message: "Scheduled: {date}", context: "modals.reminder.scheduledContext" }),
						{ date: formatDateForDisplay(this.task.scheduled) }
					);
				}

				if (Object.keys(options).length === 0) {
					options.none = uiText(msg({ message: "No dates available", context: "modals/ReminderModal: ReminderModal.renderAddReminderForm display" }));
					dropdown.setDisabled(true);
				} else {
					Object.entries(options).forEach(([key, label]) => {
						dropdown.addOption(key, label);
					});
					dropdown.setValue(this.relativeAnchor);
				}

				dropdown.onChange((value) => {
					this.relativeAnchor = value as "due" | "scheduled";
				});
			});

		// Absolute reminder fields
		const absoluteContainer = form.createDiv({
			cls: `absolute-fields ${REMINDER_FIELDS_HIDDEN_CLASS}`,
		});

		new Setting(absoluteContainer)
			.setName(this.plugin.i18n.translate(msg({ message: "Date:", context: "settings.defaults.reminders.fields.date" })))
			.addText((text) => {
				text.setPlaceholder("Yyyy-mm-dd")
					.setValue(this.absoluteDate)
					.onChange((value) => {
						this.absoluteDate = value;
					});
				text.inputEl.type = "date";
				attachDateInputBehavior(text.inputEl, {
					onCommit: (value) => {
						this.absoluteDate = value;
					},
				});
			});

		new Setting(absoluteContainer)
			.setName(this.plugin.i18n.translate(msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })))
			.addText((text) => {
				text.setPlaceholder("Hh:mm")
					.setValue(this.absoluteTime)
					.onChange((value) => {
						this.absoluteTime = value;
					});
				text.inputEl.type = "time";
			});

		// Description field (common)
		new Setting(form)
			.setName(this.plugin.i18n.translate(msg({ message: "Description (optional)", context: "modals.reminder.description" })))
			.addText((text) => {
				text.inputEl.addClass("reminder-modal__description-input");
				text.setPlaceholder(
					this.plugin.i18n.translate(msg({ message: "Custom reminder message", context: "modals.reminder.descriptionPlaceholder" }))
				)
					.setValue(this.description)
					.onChange((value) => {
						this.description = value;
					});
			});

		// Enhanced add button with icon
		const addBtn = form.createEl("button", {
			cls: "reminder-add-btn",
		});

		const addIcon = addBtn.createSpan({ cls: "reminder-add-btn-icon" });
		setIcon(addIcon, "plus");
		addBtn.createSpan({
			cls: "reminder-add-btn-text",
			text: this.plugin.i18n.translate(msg({ message: "Add reminder", context: "settings.defaults.reminders.addReminder.buttonText" })),
		});
		addBtn.onclick = async () => {
			// Add loading state
			addBtn.disabled = true;
			addBtn.classList.add("reminder-add-btn--loading");

			try {
				const newReminder = this.createReminder(
					this.selectedType,
					this.relativeAnchor,
					this.relativeOffset,
					this.relativeUnit,
					this.relativeDirection,
					this.absoluteDate,
					this.absoluteTime,
					this.description
				);

				if (newReminder) {
					await this.addReminder(newReminder);

					// Reset form values for next reminder
					if (this.selectedType === "relative") {
						this.relativeOffset = 15;
						this.relativeUnit = "minutes";
						this.description = "";
					} else {
						this.absoluteDate = "";
						this.absoluteTime = "";
						this.description = "";
					}

					// Reset the form inputs to match the instance variables
					this.resetFormInputs(form);
				}
			} catch (error) {
				tasknotesLogger.error("Error adding reminder:", {
					category: "internal",
					operation: "adding-reminder",
					error: error,
				});
				new Notice(this.plugin.i18n.translate(msg({ message: "Failed to add reminder. Please check your inputs.", context: "modals.reminder.addFailed" })));
			} finally {
				// Remove loading state
				addBtn.disabled = false;
				addBtn.classList.remove("reminder-add-btn--loading");
			}
		};

		// Set initial form visibility
		this.updateFormVisibility(form, this.selectedType);
	}

	private updateFormVisibility(form: HTMLElement, type: "absolute" | "relative"): void {
		const relativeFields = form.querySelector(".relative-fields") as HTMLElement;
		const absoluteFields = form.querySelector(".absolute-fields") as HTMLElement;

		relativeFields.classList.toggle(REMINDER_FIELDS_HIDDEN_CLASS, type !== "relative");
		absoluteFields.classList.toggle(REMINDER_FIELDS_HIDDEN_CLASS, type !== "absolute");
	}

	private createReminder(
		type: "absolute" | "relative",
		anchor: "due" | "scheduled",
		offset: number,
		unit: "minutes" | "hours" | "days",
		direction: "before" | "after",
		date: string,
		time: string,
		description: string
	): Reminder | null {
		const id = `rem_${Date.now()}`;

		if (type === "relative") {
			// Check if anchor date exists
			const anchorDate = anchor === "due" ? this.task.due : this.task.scheduled;
			if (!anchorDate) {
				new Notice(
					this.plugin.i18n.translate(
						anchor === "due"
							? msg({ message: "Cannot create reminder: Task has no due date", context: "modals.reminder.missingDue" })
							: msg({ message: "Cannot create reminder: Task has no scheduled date", context: "modals.reminder.missingScheduled" })
					)
				);
				return null;
			}

			// Convert offset to ISO 8601 duration
			let duration = "PT";
			if (unit === "days") {
				duration = `P${offset}D`;
			} else if (unit === "hours") {
				duration = `PT${offset}H`;
			} else {
				duration = `PT${offset}M`;
			}

			// Add negative sign for "before"
			if (direction === "before") {
				duration = "-" + duration;
			}

			return {
				id,
				type: "relative",
				relatedTo: anchor,
				offset: duration,
				description: description || undefined,
			};
		} else {
			// Absolute reminder
			if (!date || !time) {
				new Notice(this.plugin.i18n.translate(msg({ message: "Please specify both date and time for absolute reminder", context: "modals.reminder.missingDateTime" })));
				return null;
			}

			const absoluteTime = `${date}T${time}:00`;

			return {
				id,
				type: "absolute",
				absoluteTime,
				description: description || undefined,
			};
		}
	}

	private formatRelativeReminder(anchor: "due" | "scheduled", offset: string): string {
		const match = /^(-?)P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(offset);
		if (!match && offset) return uiData(offset, "Invalid/unsupported stored ISO duration; preserve user data for diagnosis");
		const [, negative, days, hours, minutes] = match ?? [];
		const locale = this.plugin.i18n.getCurrentLocale();
		const parts = (
			[
				[days, "day"],
				[hours, "hour"],
				[minutes, "minute"],
			] as const
		)
			.filter(([value]) => Number(value) > 0)
			.map(([value, unit]) =>
				new Intl.NumberFormat(locale, {
					style: "unit",
					unit,
					unitDisplay: "long",
				}).format(Number(value))
			);
		if (parts.length === 0) {
			return this.plugin.i18n.translate(
				anchor === "due" ? msg({ message: "At the due date", context: "modals.reminder.atDue" }) : msg({ message: "At the scheduled date", context: "modals.reminder.atScheduled" })
			);
		}
		const key =
			anchor === "due"
				? negative
					? msg({ message: "Before due date: {duration}", context: "modals.reminder.beforeDue" })
					: msg({ message: "After due date: {duration}", context: "modals.reminder.afterDue" })
				: negative
					? msg({ message: "Before scheduled date: {duration}", context: "modals.reminder.beforeScheduled" })
					: msg({ message: "After scheduled date: {duration}", context: "modals.reminder.afterScheduled" });
		return this.plugin.i18n.translate(key, {
			duration: new Intl.ListFormat(locale, { style: "long", type: "unit" }).format(parts),
		});
	}

	private async addReminder(reminder: Reminder): Promise<void> {
		this.reminders.push(reminder);
		this.refreshRemindersListOnly();

		// Emit immediate event for live UI updates (optional, for real-time feedback)
		if (this.task.path) {
			this.plugin.emitter.trigger("reminder-preview-changed", {
				taskPath: this.task.path,
				currentReminders: [...this.reminders],
				action: "added",
				reminder: reminder,
			});
		}
	}

	private async removeReminder(index: number): Promise<void> {
		const removedReminder = this.reminders[index];
		this.reminders.splice(index, 1);
		this.refreshRemindersListOnly();

		// Emit immediate event for live UI updates (optional, for real-time feedback)
		if (this.task.path && removedReminder) {
			this.plugin.emitter.trigger("reminder-preview-changed", {
				taskPath: this.task.path,
				currentReminders: [...this.reminders],
				action: "removed",
				reminder: removedReminder,
			});
		}
	}

	private async refresh(): Promise<void> {
		await this.initializeWithFreshData();
	}

	private refreshRemindersListOnly(): void {
		// Only refresh the existing reminders section, not the entire modal
		const contentContainer = this.contentEl.querySelector(".reminder-modal__content");
		if (contentContainer) {
			// Find and remove existing reminders section
			const existingRemindersSection = contentContainer.querySelector(
				".reminder-modal__section"
			);
			if (existingRemindersSection) {
				existingRemindersSection.remove();
			}

			// Re-render only the existing reminders section at the top
			const tempContainer = activeWindow.createDiv();
			this.renderExistingReminders(tempContainer);
			const newRemindersSection = tempContainer.firstChild as HTMLElement;
			if (newRemindersSection) {
				contentContainer.insertBefore(newRemindersSection, contentContainer.firstChild);
			}
		}

		this.updateSaveButtonState();
	}

	private resetFormInputs(form: HTMLElement): void {
		// Update text inputs to match instance variables
		const timeInput = form.querySelector('input[placeholder="15"]') as HTMLInputElement;
		if (timeInput) timeInput.value = String(this.relativeOffset);

		const descInput = form.querySelector(
			"input.reminder-modal__description-input"
		) as HTMLInputElement;
		if (descInput) descInput.value = this.description;

		const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
		if (dateInput) dateInput.value = this.absoluteDate;

		const timeAbsInput = form.querySelector('input[type="time"]') as HTMLInputElement;
		if (timeAbsInput) timeAbsInput.value = this.absoluteTime;

		// Update dropdowns to match instance variables
		const unitDropdown = form.querySelector(
			'.setting-item:has(input[placeholder="15"]) select'
		) as HTMLSelectElement;
		if (unitDropdown) unitDropdown.value = this.relativeUnit;

		const directionDropdown = form.querySelector(
			".setting-item:nth-child(2) select"
		) as HTMLSelectElement;
		if (directionDropdown) directionDropdown.value = this.relativeDirection;

		const anchorDropdown = form.querySelector(
			".setting-item:nth-child(3) select"
		) as HTMLSelectElement;
		if (anchorDropdown) anchorDropdown.value = this.relativeAnchor;
	}

	private async save(): Promise<void> {
		this.saveBtn.disabled = true;
		this.saveBtn.textContent = this.plugin.i18n.translate(msg({ message: "Saving...", context: "common.saving" }));

		try {
			// Clear processed reminders for this task so they can trigger again if needed
			if (this.task.path && this.task.path.trim() !== "") {
				this.plugin.notificationService?.clearProcessedRemindersForTask(this.task.path);
			}

			// Check if reminders have actually changed
			const hasChanges = this.remindersHaveChanged();

			// Always call onSave to maintain existing behavior, but indicate if changes occurred
			this.onSave(this.reminders);

			// Emit a custom event to notify about reminder changes for immediate UI updates
			if (hasChanges && this.task.path) {
				this.plugin.emitter.trigger("reminder-changed", {
					taskPath: this.task.path,
					oldReminders: this.originalReminders,
					newReminders: [...this.reminders],
				});
			}

			this.close();
		} catch (error) {
			tasknotesLogger.error("Failed to save reminders:", {
				category: "persistence",
				operation: "save-reminders",
				error: error,
			});
			new Notice(this.plugin.i18n.translate(msg({ message: "Failed to save reminders. Please try again.", context: "modals.reminder.saveFailed" })));
			this.saveBtn.disabled = false;
			this.saveBtn.textContent = this.plugin.i18n.translate(
				msg({ message: "Save changes", context: "modals.timeblockInfo.saveButton" })
			);
		}
	}

	private cancel(): void {
		// Emit cancellation event to reset any preview changes
		if (this.remindersHaveChanged() && this.task.path) {
			this.plugin.emitter.trigger("reminder-preview-changed", {
				taskPath: this.task.path,
				currentReminders: [...this.originalReminders],
				action: "cancelled",
			});
		}

		this.close();
	}

	private remindersHaveChanged(): boolean {
		// Quick reference check first
		if (this.reminders.length !== this.originalReminders.length) {
			return true;
		}

		// Deep comparison of reminder arrays
		return !this.reminders.every((reminder, index) => {
			const original = this.originalReminders[index];
			if (!original) return false;

			return (
				reminder.id === original.id &&
				reminder.type === original.type &&
				reminder.relatedTo === original.relatedTo &&
				reminder.offset === original.offset &&
				reminder.absoluteTime === original.absoluteTime &&
				reminder.description === original.description
			);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
