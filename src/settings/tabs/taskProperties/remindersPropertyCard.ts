import TaskNotesPlugin from "../../../main";
import { DefaultReminder } from "../../../types/settings";
import type { TranslationKey } from "../../../i18n";
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
		"reminders",
		plugin.settings.fieldMapping.reminders
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping.reminders = propertyKeyInput.value;
		save();
	});

	// Create nested content for default reminders
	const nestedContainer = document.createElement("div");
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Create collapsible section for default reminders
	const remindersSection = nestedContainer.createDiv("tasknotes-settings__collapsible-section");

	const remindersHeader = remindersSection.createDiv("tasknotes-settings__collapsible-section-header");
	remindersHeader.createSpan({ text: translate("settings.taskProperties.remindersCard.defaultReminders"), cls: "tasknotes-settings__collapsible-section-title" });
	const chevron = remindersHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const remindersContent = remindersSection.createDiv("tasknotes-settings__collapsible-section-content");

	// Render reminder cards
	const remindersListContainer = remindersContent.createDiv("tasknotes-reminders-container");
	renderRemindersList(remindersListContainer, plugin, save, translate);

	// Add reminder button
	const addReminderButton = remindersContent.createEl("button", {
		text: translate("settings.defaults.reminders.addReminder.buttonText"),
		cls: "tn-btn tn-btn--ghost",
	});
	addReminderButton.style.marginTop = "0.5rem";
	addReminderButton.onclick = () => {
		const newId = `reminder_${Date.now()}`;
		const newReminder = {
			id: newId,
			type: "relative" as const,
			relatedTo: "due" as const,
			offset: 1,
			unit: "hours" as const,
			direction: "before" as const,
			description: "Reminder",
		};
		plugin.settings.taskCreationDefaults.defaultReminders =
			plugin.settings.taskCreationDefaults.defaultReminders || [];
		plugin.settings.taskCreationDefaults.defaultReminders.push(newReminder);
		save();
		renderRemindersList(remindersListContainer, plugin, save, translate);
	};

	// Toggle collapse
	remindersHeader.addEventListener("click", () => {
		remindersSection.toggleClass("tasknotes-settings__collapsible-section--collapsed",
			!remindersSection.hasClass("tasknotes-settings__collapsible-section--collapsed"));
	});

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate("settings.taskProperties.properties.reminders.description")
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-reminders",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate("settings.taskProperties.properties.reminders.name"),
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
			translate("settings.defaults.reminders.emptyState")
		);
		return;
	}

	plugin.settings.taskCreationDefaults.defaultReminders.forEach((reminder, index) => {
		const timingText = formatReminderTiming(reminder, translate);

		const descInput = createCardInput(
			"text",
			translate("settings.defaults.reminders.reminderDescription"),
			reminder.description
		);

		const typeSelect = createCardSelect(
			[
				{
					value: "relative",
					label: translate("settings.defaults.reminders.types.relative"),
				},
				{
					value: "absolute",
					label: translate("settings.defaults.reminders.types.absolute"),
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
					translate("settings.defaults.reminders.unnamedReminder"),
				secondaryText: timingText,
				actions: [
					createDeleteHeaderButton(() => {
						plugin.settings.taskCreationDefaults.defaultReminders.splice(index, 1);
						save();
						renderRemindersList(container, plugin, save, translate);
					}, translate("settings.defaults.reminders.deleteTooltip")),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate("settings.defaults.reminders.fields.description"),
								input: descInput,
							},
							{
								label: translate("settings.defaults.reminders.fields.type"),
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
					translate("settings.defaults.reminders.unnamedReminder");
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
			{ value: "minutes", label: translate("settings.defaults.reminders.units.minutes") },
			{ value: "hours", label: translate("settings.defaults.reminders.units.hours") },
			{ value: "days", label: translate("settings.defaults.reminders.units.days") },
		],
		reminder.unit
	);
	unitSelect.addEventListener("change", () => {
		updateItem({ unit: unitSelect.value as "minutes" | "hours" | "days" });
	});

	const directionSelect = createCardSelect(
		[
			{ value: "before", label: translate("settings.defaults.reminders.directions.before") },
			{ value: "after", label: translate("settings.defaults.reminders.directions.after") },
		],
		reminder.direction
	);
	directionSelect.addEventListener("change", () => {
		updateItem({ direction: directionSelect.value as "before" | "after" });
	});

	const relatedToSelect = createCardSelect(
		[
			{ value: "due", label: translate("settings.defaults.reminders.relatedTo.due") },
			{
				value: "scheduled",
				label: translate("settings.defaults.reminders.relatedTo.scheduled"),
			},
		],
		reminder.relatedTo
	);
	relatedToSelect.addEventListener("change", () => {
		updateItem({ relatedTo: relatedToSelect.value as "due" | "scheduled" });
	});

	return [
		{ label: translate("settings.defaults.reminders.fields.offset"), input: offsetInput },
		{ label: translate("settings.defaults.reminders.fields.unit"), input: unitSelect },
		{
			label: translate("settings.defaults.reminders.fields.direction"),
			input: directionSelect,
		},
		{
			label: translate("settings.defaults.reminders.fields.relatedTo"),
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
		{ label: translate("settings.defaults.reminders.fields.date"), input: dateInput },
		{ label: translate("settings.defaults.reminders.fields.time"), input: timeInput },
	];
}

function formatReminderTiming(
	reminder: DefaultReminder,
	translate: TranslateFn
): string {
	if (reminder.type === "relative") {
		const direction =
			reminder.direction === "before"
				? translate("settings.defaults.reminders.directions.before")
				: translate("settings.defaults.reminders.directions.after");
		const unit = translate(
			`settings.defaults.reminders.units.${reminder.unit || "hours"}` as TranslationKey
		);
		const offset = reminder.offset ?? 1;
		const relatedTo =
			reminder.relatedTo === "due"
				? translate("settings.defaults.reminders.relatedTo.due")
				: translate("settings.defaults.reminders.relatedTo.scheduled");
		return `${offset} ${unit} ${direction} ${relatedTo}`;
	} else {
		const date = reminder.absoluteDate || translate("settings.defaults.reminders.fields.date");
		const time = reminder.absoluteTime || translate("settings.defaults.reminders.fields.time");
		return `${date} at ${time}`;
	}
}
