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

export class DueDateModal extends Modal {
	private task: TaskInfo;
	private plugin: TaskNotesPlugin;
	private dueDateInput: HTMLInputElement;
	private dueTimeInput: HTMLInputElement;
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
		this.titleEl.setText(this.translate("modals.dueDate.title"));
		this.titleEl.setAttribute("id", "due-date-modal-title");
		this.containerEl.setAttribute("aria-labelledby", "due-date-modal-title");
		this.containerEl.setAttribute("role", "dialog");
		this.containerEl.setAttribute("aria-modal", "true");

		// Task title display
		contentEl.createEl("p", {
			text: this.translate("modals.dueDate.taskLabel", { title: this.task.title }),
			cls: "due-date-modal__task-title",
		});

		// Due date and time input
		const dateTimeSetting = new Setting(contentEl)
			.setName(this.translate("modals.dueDate.sections.dateTime"))
			.setDesc(this.translate("modals.dueDate.descriptions.dateTime"));

		// Create a container for the date and time inputs
		const dateTimeContainer = dateTimeSetting.controlEl.createDiv({
			cls: "modal-form__datetime-container",
		});

		// Date input
		this.dueDateInput = dateTimeContainer.createEl("input", {
			type: "date",
			cls: "modal-form__input modal-form__input--date",
			attr: {
				"aria-label": this.translate("modals.dueDate.inputs.date.ariaLabel"),
				placeholder: this.translate("modals.dueDate.inputs.date.placeholder"),
			},
		});
		this.dueDateInput.value = getDatePart(this.task.due || "");

		// Time input (always visible)
		this.dueTimeInput = dateTimeContainer.createEl("input", {
			type: "time",
			cls: "modal-form__input modal-form__input--time",
			attr: {
				"aria-label": this.translate("modals.dueDate.inputs.time.ariaLabel"),
				placeholder: this.translate("modals.dueDate.inputs.time.placeholder"),
			},
		});
		this.dueTimeInput.value = getTimePart(this.task.due || "") || "";

		// Event listeners
		this.dueDateInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.save();
			} else if (e.key === "Escape") {
				this.close();
			}
		});

		this.dueTimeInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.save();
			} else if (e.key === "Escape") {
				this.close();
			}
		});

		// Focus the date input
		setTimeout(() => this.dueDateInput.focus(), 100);

		// Quick date buttons
		const quickDatesContainer = contentEl.createDiv({ cls: "modal-form__group" });
		new Setting(quickDatesContainer)
			.setName(this.translate("modals.dueDate.sections.quickOptions"))
			.setHeading();

		const buttonsContainer = quickDatesContainer.createDiv({
			cls: "modal-form__quick-actions",
		});

		// Today button
		const todayBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.dueDate.quickOptions.today"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: { "aria-label": this.translate("modals.dueDate.quickOptions.todayAriaLabel") },
		});
		todayBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(new Date(), "yyyy-MM-dd");
		});

		// Tomorrow button
		const tomorrowBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.dueDate.quickOptions.tomorrow"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: { "aria-label": this.translate("modals.dueDate.quickOptions.tomorrowAriaLabel") },
		});
		tomorrowBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(add(new Date(), { days: 1 }), "yyyy-MM-dd");
		});

		// Next week button
		const nextWeekBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.dueDate.quickOptions.nextWeek"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: { "aria-label": this.translate("modals.dueDate.quickOptions.nextWeekAriaLabel") },
		});
		nextWeekBtn.addEventListener("click", () => {
			this.dueDateInput.value = format(add(new Date(), { weeks: 1 }), "yyyy-MM-dd");
		});

		// Now button (today with current time)
		const nowBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.dueDate.quickOptions.now"),
			cls: "modal-form__button modal-form__button--quick-date",
			attr: { "aria-label": this.translate("modals.dueDate.quickOptions.nowAriaLabel") },
		});
		nowBtn.addEventListener("click", () => {
			const now = new Date();
			this.dueDateInput.value = format(now, "yyyy-MM-dd");
			this.dueTimeInput.value = format(now, "HH:mm");
		});

		// Clear button
		const clearBtn = buttonsContainer.createEl("button", {
			text: this.translate("modals.dueDate.quickOptions.clear"),
			cls: "modal-form__button modal-form__button--quick-date modal-form__button--quick-date--clear",
			attr: { "aria-label": this.translate("modals.dueDate.quickOptions.clearAriaLabel") },
		});
		clearBtn.addEventListener("click", () => {
			this.dueDateInput.value = "";
			this.dueTimeInput.value = "";
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
		const dateValue = this.dueDateInput.value.trim();
		const timeValue = this.dueTimeInput.value.trim();

		// Build the final date/datetime value
		let finalValue: string | undefined;

		if (!dateValue) {
			finalValue = undefined; // Clear the due date
		} else if (timeValue) {
			finalValue = combineDateAndTime(dateValue, timeValue);
		} else {
			finalValue = dateValue; // Date only
		}

		// Validate the final value
		if (!validateDateTimeInput(dateValue, timeValue)) {
			// Show error message
			const errorEl = this.contentEl.createEl("div", {
				text: this.translate("modals.dueDate.errors.invalidDateTime"),
				cls: "modal-form__error",
				attr: {
					role: "alert",
					"aria-live": "assertive",
				},
			});
			this.dueDateInput.setAttribute("aria-invalid", "true");
			this.dueDateInput.setAttribute("aria-describedby", "due-date-error");
			errorEl.setAttribute("id", "due-date-error");
			setTimeout(() => {
				errorEl.remove();
				this.dueDateInput.removeAttribute("aria-invalid");
				this.dueDateInput.removeAttribute("aria-describedby");
			}, 3000);
			return;
		}

		try {
			// Use the TaskService to update the property with proper cache timing
			await this.plugin.taskService.updateProperty(this.task, "due", finalValue);
			this.close();
		} catch (error) {
			console.error("Failed to update due date:", error);
			const errorEl = this.contentEl.createEl("div", {
				text: this.translate("modals.dueDate.errors.updateFailed"),
				cls: "modal-form__error",
			});
			setTimeout(() => errorEl.remove(), 3000);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
