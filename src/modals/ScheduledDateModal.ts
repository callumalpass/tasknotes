import { App, Modal, Setting } from "obsidian";
import { format, add } from "date-fns";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import {
	validateDateTimeInput,
	getDatePart,
	getTimePart,
	combineDateAndTime,
} from "../utils/dateUtils";
import { TranslationKey } from "../i18n";

export class ScheduledDateModal extends Modal {
	private task: TaskInfo;
	private plugin: TaskNotesPlugin;
	private scheduledDateInput: HTMLInputElement;
	private scheduledTimeInput: HTMLInputElement;
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;

	constructor(app: App, task: TaskInfo, plugin: TaskNotesPlugin) {
		super(app);
		this.task = task;
		this.plugin = plugin;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin");

		// Set up modal accessibility
		this.titleEl.setText(this.translate("modals.scheduledDate.title"));
		this.titleEl.setAttribute("id", "scheduled-date-modal-title");
		this.containerEl.setAttribute("aria-labelledby", "scheduled-date-modal-title");
		this.containerEl.setAttribute("role", "dialog");
		this.containerEl.setAttribute("aria-modal", "true");

		// Task title display
		contentEl.createEl("p", {
			text: this.translate("modals.scheduledDate.taskLabel", { title: this.task.title }),
			cls: "scheduled-date-modal__task-title",
		});

		// Scheduled date and time inputs
		const dateTimeSetting = new Setting(contentEl)
			.setName(this.translate("modals.scheduledDate.sections.dateTime"))
			.setDesc(this.translate("modals.scheduledDate.descriptions.dateTime"));

		// Create a container for the date and time inputs
		const dateTimeContainer = dateTimeSetting.controlEl.createDiv({
			cls: "modal-form__datetime-container",
		});

		// Date input
		this.scheduledDateInput = dateTimeContainer.createEl("input", {
			type: "date",
			cls: "modal-form__input modal-form__input--date",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.inputs.date.ariaLabel"),
				placeholder: this.translate("modals.scheduledDate.inputs.date.placeholder"),
			},
		});
		this.scheduledDateInput.value = getDatePart(this.task.scheduled || "");

		// Time input (always visible but optional)
		this.scheduledTimeInput = dateTimeContainer.createEl("input", {
			type: "time",
			cls: "modal-form__input modal-form__input--time",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.inputs.time.ariaLabel"),
				placeholder: this.translate("modals.scheduledDate.inputs.time.placeholder"),
			},
		});
		this.scheduledTimeInput.value = getTimePart(this.task.scheduled || "") || "";

		// Event listeners for keyboard navigation
		this.scheduledDateInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.save();
			} else if (e.key === "Escape") {
				this.close();
			}
		});

		this.scheduledTimeInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.save();
			} else if (e.key === "Escape") {
				this.close();
			}
		});

		// Focus the date input
		window.setTimeout(() => this.scheduledDateInput.focus(), 100);

		// Quick date buttons
		const quickDatesContainer = contentEl.createDiv({ cls: "modal-form__group" });
		new Setting(quickDatesContainer)
			.setName(this.translate("modals.scheduledDate.sections.quickOptions"))
			.setHeading();

		const buttonsContainer = quickDatesContainer.createDiv({
			cls: "modal-form__quick-actions",
		});

		// Today button
		const todayBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.scheduledDate.quickOptions.today"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.quickOptions.todayAriaLabel"),
			},
		});
		todayBtn.addEventListener("click", () => {
			this.scheduledDateInput.value = format(new Date(), "yyyy-MM-dd");
		});

		// Tomorrow button
		const tomorrowBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.scheduledDate.quickOptions.tomorrow"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.quickOptions.tomorrowAriaLabel"),
			},
		});
		tomorrowBtn.addEventListener("click", () => {
			this.scheduledDateInput.value = format(add(new Date(), { days: 1 }), "yyyy-MM-dd");
		});

		// Next week button
		const nextWeekBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.scheduledDate.quickOptions.nextWeek"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.quickOptions.nextWeekAriaLabel"),
			},
		});
		nextWeekBtn.addEventListener("click", () => {
			this.scheduledDateInput.value = format(add(new Date(), { weeks: 1 }), "yyyy-MM-dd");
		});

		// Now button (today with current time)
		const nowBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.scheduledDate.quickOptions.now"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.quickOptions.nowAriaLabel"),
			},
		});
		nowBtn.addEventListener("click", () => {
			const now = new Date();
			this.scheduledDateInput.value = format(now, "yyyy-MM-dd");
			this.scheduledTimeInput.value = format(now, "HH:mm");
		});

		// Clear button
		const clearBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.scheduledDate.quickOptions.clear"),
			cls: "modal-form__button modal-form__button--quick-date modal-form__button--quick-date--clear",
			attr: {
				"aria-label": this.translate("modals.scheduledDate.quickOptions.clearAriaLabel"),
			},
		});
		clearBtn.addEventListener("click", () => {
			this.scheduledDateInput.value = "";
			this.scheduledTimeInput.value = "";
		});

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: "modal-form__buttons" });

		const saveButton = buttonContainer.createEl("button", {
			text: this.translate("common.save"),
			cls: "modal-form__button modal-form__button--primary",
		});
		saveButton.addEventListener("click", () => this.save());

		const cancelButton = buttonContainer.createEl("button", {
			text: this.translate("common.cancel"),
			cls: "modal-form__button modal-form__button--secondary",
		});
		cancelButton.addEventListener("click", () => this.close());
	}

	private async save() {
		const dateValue = this.scheduledDateInput.value.trim();
		const timeValue = this.scheduledTimeInput.value.trim();

		// Build the final date/datetime value
		let finalValue: string | undefined;

		if (!dateValue) {
			finalValue = undefined; // Clear the scheduled date
		} else if (timeValue) {
			finalValue = combineDateAndTime(dateValue, timeValue);
		} else {
			finalValue = dateValue; // Date only
		}

		// Validate the final value
		if (!validateDateTimeInput(dateValue, timeValue)) {
			// Show error message
			const errorEl = this.contentEl.createEl("div", {
				text: this.translate("modals.scheduledDate.errors.invalidDateTime"),
				cls: "modal-form__error",
				attr: {
					role: "alert",
					"aria-live": "assertive",
				},
			});
			this.scheduledDateInput.setAttribute("aria-invalid", "true");
			this.scheduledDateInput.setAttribute("aria-describedby", "scheduled-date-error");
			errorEl.setAttribute("id", "scheduled-date-error");
			window.setTimeout(() => {
				errorEl.remove();
				this.scheduledDateInput.removeAttribute("aria-invalid");
				this.scheduledDateInput.removeAttribute("aria-describedby");
			}, 3000);
			return;
		}

		try {
			// Use the TaskService to update the property with proper cache timing
			await this.plugin.taskService.updateProperty(this.task, "scheduled", finalValue);
			this.close();
		} catch (error) {
			console.error("Failed to update scheduled date:", error);
			const errorEl = this.contentEl.createEl("div", {
				text: this.translate("modals.scheduledDate.errors.updateFailed"),
				cls: "modal-form__error",
			});
			window.setTimeout(() => errorEl.remove(), 3000);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
