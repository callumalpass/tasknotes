import { reminderDescriptionLabel } from "../../../i18n/dataSeedLabels";
import { uiData } from "../../../i18n/dataText";
import { uiText } from "../../../i18n/runtime";
import { uiNumber } from "../../../i18n/formatters";
import { msg } from "@lingui/core/macro";
import { setIcon } from "obsidian";
import TaskNotesPlugin from "../../../main";
import { DefaultReminder } from "../../../types/settings";
import {
	createCard,
	createCardInput,
	createDeleteHeaderButton,
	showCardEmptyState,
	createCardNumberInput,
	createCardSelect,
	CardRow,
} from "../../components/CardComponent";
import { createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Reminders property card with nested default reminders
 */
export function renderRemindersPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	const propertyKeyInput = createCardInput(
		"text",
		uiData("reminders", "Editable frontmatter property identifier or filename-template syntax, not a display label"),
		plugin.settings.fieldMapping.reminders
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping.reminders = propertyKeyInput.value;
		save();
	});

	// Create nested content for default reminders
	const nestedContainer = activeWindow.createDiv();
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Create collapsible section for default reminders
	const remindersSection = nestedContainer.createDiv("tasknotes-settings__collapsible-section");

	const remindersHeader = remindersSection.createDiv(
		"tasknotes-settings__collapsible-section-header"
	);
	remindersHeader.createSpan({
		text: translate(
			msg({ message: "Default reminders", context: "settings.taskProperties.remindersCard.defaultReminders" })
		),
		cls: "tasknotes-settings__collapsible-section-title",
	});
	const chevron = remindersHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	setIcon(chevron, "chevron-down");

	const remindersContent = remindersSection.createDiv(
		"tasknotes-settings__collapsible-section-content"
	);

	// Render reminder cards
	const remindersListContainer = remindersContent.createDiv("tasknotes-reminders-container");
	renderRemindersList(remindersListContainer, plugin, save, translate);

	// Add reminder button
	const addReminderButton = remindersContent.createEl("button", {
		text: translate(
			msg({ message: "Add reminder", context: "settings.defaults.reminders.addReminder.buttonText" })
		),
		cls: "tn-btn tn-btn--ghost",
	});
	addReminderButton.classList.remove(
		"tn-static-font-size-12px-b0cc7e05",
		"tn-static-margin-top-0-d462248a",
		"tn-static-margin-top-12px-91e0f558",
		"tn-static-margin-top-16px-1b0f4999",
		"tn-static-margin-top-1rem-2239d6d5",
		"tn-static-margin-top-20px-a26bda7d",
		"tn-static-margin-top-30px-2fbbbcd4",
		"tn-static-margin-top-4px-96ad6099",
		"tn-static-margin-top-8px-8a77e5a3",
		"tn-static-margin-top-8px-f4f01e68"
	);
	addReminderButton.classList.add("tn-static-margin-top-0-5rem-3dc98b5e");
	addReminderButton.onclick = () => {
		const newId = `reminder_${Date.now()}`;
		const newReminder = {
			id: newId,
			type: "relative" as const,
			relatedTo: "due" as const,
			offset: 1,
			unit: "hours" as const,
			direction: "before" as const,
			description: uiData("Reminder", "Persisted default reminder seed; translate only in the editor/notification"),
		};
		plugin.settings.taskCreationDefaults.defaultReminders =
			plugin.settings.taskCreationDefaults.defaultReminders || [];
		plugin.settings.taskCreationDefaults.defaultReminders.push(newReminder);
		save();
		renderRemindersList(remindersListContainer, plugin, save, translate);
	};

	// Toggle collapse
	remindersHeader.addEventListener("click", () => {
		remindersSection.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!remindersSection.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate(
			msg({ message: "Notifications triggered before due or scheduled dates. Stored as a list of reminder objects with timing and optional description.", context: "settings.taskProperties.properties.reminders.description" })
		)
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
		{
			label: translate(
				msg({ message: "Property key:", context: "settings.taskProperties.propertyCard.propertyKey" })
			),
			input: propertyKeyInput,
		},
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-reminders",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate(
				msg({ message: "Reminders", context: "settings.taskProperties.properties.reminders.name" })
			),
			secondaryText: plugin.settings.fieldMapping.reminders,
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Renders the list of default reminder cards
 */
function renderRemindersList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	container.empty();

	if (
		!plugin.settings.taskCreationDefaults.defaultReminders ||
		plugin.settings.taskCreationDefaults.defaultReminders.length === 0
	) {
		showCardEmptyState(
			container,
			translate(
				msg({ message: "No default reminders configured. Add a reminder to automatically notify you about new tasks.", context: "settings.defaults.reminders.emptyState" })
			)
		);
		return;
	}

	plugin.settings.taskCreationDefaults.defaultReminders.forEach((reminder, index) => {
		const timingText = formatReminderTiming(reminder, translate);

		const descInput = createCardInput(
			"text",
			translate(
				msg({ message: "Reminder description", context: "settings.defaults.reminders.reminderDescription" })
			),
			reminderDescriptionLabel(reminder.description)
		);

		const typeSelect = createCardSelect(
			[
				{
					value: "relative",
					label: translate(
						msg({ message: "Relative (before/after task dates)", context: "settings.defaults.reminders.types.relative" })
					),
				},
				{
					value: "absolute",
					label: translate(
						msg({ message: "Absolute (specific date/time)", context: "settings.defaults.reminders.types.absolute" })
					),
				},
			],
			reminder.type
		);

		const updateCallback = (updates: Partial<DefaultReminder>) => {
			Object.assign(reminder, updates);
			save();
			const card = container.querySelector(`[data-card-id="${reminder.id}"]`);
			if (card) {
				const secondaryText = card.querySelector(
					".tasknotes-settings__card-secondary-text"
				);
				if (secondaryText) {
					secondaryText.textContent = formatReminderTiming(reminder, translate);
				}
			}
		};

		const configRows =
			reminder.type === "relative"
				? renderRelativeReminderConfig(reminder, updateCallback, translate)
				: renderAbsoluteReminderConfig(reminder, updateCallback, translate);

		const card = createCard(container, {
			id: reminder.id,
			collapsible: true,
			defaultCollapsed: true,
			header: {
				primaryText:
					reminder.description ||
					translate(
						msg({ message: "Unnamed reminder", context: "settings.defaults.reminders.unnamedReminder" })
					),
				secondaryText: timingText,
				actions: [
					createDeleteHeaderButton(
						() => {
							plugin.settings.taskCreationDefaults.defaultReminders.splice(index, 1);
							save();
							renderRemindersList(container, plugin, save, translate);
						},
						translate(
							msg({ message: "Delete reminder", context: "settings.defaults.reminders.deleteTooltip" })
						)
					),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									msg({ message: "Description:", context: "settings.defaults.reminders.fields.description" })
								),
								input: descInput,
							},
							{
								label: translate(
									msg({ message: "Type:", context: "settings.defaults.reminders.fields.type" })
								),
								input: typeSelect,
							},
						],
					},
					{
						rows: configRows,
					},
				],
			},
		});

		descInput.addEventListener("input", () => {
			reminder.description = descInput.value;
			save();
			const primaryText = card.querySelector(".tasknotes-settings__card-primary-text");
			if (primaryText) {
				primaryText.textContent =
					reminder.description ||
					translate(
						msg({ message: "Unnamed reminder", context: "settings.defaults.reminders.unnamedReminder" })
					);
			}
		});

		typeSelect.addEventListener("change", () => {
			reminder.type = typeSelect.value as "relative" | "absolute";
			save();
			renderRemindersList(container, plugin, save, translate);
		});
	});
}

function renderRelativeReminderConfig(
	reminder: DefaultReminder,
	updateItem: (updates: Partial<DefaultReminder>) => void,
	translate: TranslateFn
): CardRow[] {
	const offsetInput = createCardNumberInput(0, undefined, 1, reminder.offset);
	offsetInput.addEventListener("input", () => {
		const offset = parseInt(offsetInput.value);
		if (!isNaN(offset) && offset >= 0) {
			updateItem({ offset });
		}
	});

	const unitSelect = createCardSelect(
		[
			{
				value: "minutes",
				label: translate(
					msg({ message: "minutes", context: "settings.defaults.reminders.units.minutes" })
				),
			},
			{
				value: "hours",
				label: translate(
					msg({ message: "hours", context: "settings.defaults.reminders.units.hours" })
				),
			},
			{
				value: "days",
				label: translate(
					msg({ message: "days", context: "settings.defaults.reminders.units.days" })
				),
			},
		],
		reminder.unit
	);
	unitSelect.addEventListener("change", () => {
		updateItem({ unit: unitSelect.value as "minutes" | "hours" | "days" });
	});

	const directionSelect = createCardSelect(
		[
			{
				value: "before",
				label: translate(
					msg({ message: "before", context: "settings.defaults.reminders.directions.before" })
				),
			},
			{
				value: "after",
				label: translate(
					msg({ message: "after", context: "settings.defaults.reminders.directions.after" })
				),
			},
		],
		reminder.direction
	);
	directionSelect.addEventListener("change", () => {
		updateItem({ direction: directionSelect.value as "before" | "after" });
	});

	const relatedToSelect = createCardSelect(
		[
			{
				value: "due",
				label: translate(
					msg({ message: "due date", context: "settings.defaults.reminders.relatedTo.due" })
				),
			},
			{
				value: "scheduled",
				label: translate(
					msg({ message: "scheduled date", context: "settings.defaults.reminders.relatedTo.scheduled" })
				),
			},
		],
		reminder.relatedTo
	);
	relatedToSelect.addEventListener("change", () => {
		updateItem({ relatedTo: relatedToSelect.value as "due" | "scheduled" });
	});

	return [
		{
			label: translate(
				msg({ message: "Offset:", context: "settings.defaults.reminders.fields.offset" })
			),
			input: offsetInput,
		},
		{
			label: translate(
				msg({ message: "Unit:", context: "settings.defaults.reminders.fields.unit" })
			),
			input: unitSelect,
		},
		{
			label: translate(
				msg({ message: "Direction:", context: "settings.defaults.reminders.fields.direction" })
			),
			input: directionSelect,
		},
		{
			label: translate(
				msg({ message: "Related to:", context: "settings.defaults.reminders.fields.relatedTo" })
			),
			input: relatedToSelect,
		},
	];
}

function renderAbsoluteReminderConfig(
	reminder: DefaultReminder,
	updateItem: (updates: Partial<DefaultReminder>) => void,
	translate: TranslateFn
): CardRow[] {
	const dateInput = createCardInput(
		"date",
		reminder.absoluteDate || new Date().toISOString().split("T")[0]
	);
	dateInput.addEventListener("input", () => {
		updateItem({ absoluteDate: dateInput.value });
	});

	const timeInput = createCardInput("time", reminder.absoluteTime || "09:00");
	timeInput.addEventListener("input", () => {
		updateItem({ absoluteTime: timeInput.value });
	});

	return [
		{
			label: translate(
				msg({ message: "Date:", context: "settings.defaults.reminders.fields.date" })
			),
			input: dateInput,
		},
		{
			label: translate(
				msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })
			),
			input: timeInput,
		},
	];
}

function formatReminderTiming(reminder: DefaultReminder, translate: TranslateFn): string {
	if (reminder.type === "relative") {
		const unit =
			reminder.unit === "minutes" ? "minute" : reminder.unit === "days" ? "day" : "hour";
		const duration = uiNumber(reminder.offset ?? 1, {
			style: "unit",
			unit,
			unitDisplay: "long",
		});
		return translate(
			msg({
				message:
					"{relatedTo, select, due {{direction, select, before {{duration} before due date} after {{duration} after due date} other {{duration} before due date}}} scheduled {{direction, select, before {{duration} before scheduled date} after {{duration} after scheduled date} other {{duration} before scheduled date}}} other {{direction, select, before {{duration} before scheduled date} after {{duration} after scheduled date} other {{duration} before scheduled date}}}}",
				context: "default reminder timing summary",
			}),
			{
				duration,
				relatedTo: reminder.relatedTo ?? "scheduled",
				direction: reminder.direction ?? "before",
			}
		);
	} else {
		const date =
			reminder.absoluteDate ||
			translate(
				msg({ message: "Date:", context: "settings.defaults.reminders.fields.date" })
			);
		const time =
			reminder.absoluteTime ||
			translate(
				msg({ message: "Time:", context: "settings.defaults.reminders.fields.time" })
			);
		return uiText(
			msg({
				message: "{date} at {time}",
				context:
					"settings/tabs/taskProperties/remindersPropertyCard: formatReminderTiming display",
			}),
			{ date: date, time: time }
		);
	}
}
