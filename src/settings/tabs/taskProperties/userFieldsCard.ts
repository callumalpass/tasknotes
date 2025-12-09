import { Setting } from "obsidian";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createStatusBadge,
	createCardInput,
	createDeleteHeaderButton,
	showCardEmptyState,
	createCardSelect,
	createCardToggle,
	CardRow,
} from "../../components/CardComponent";
import { createFilterSettingsInputs } from "../../components/FilterSettingsComponent";
import { initializeFieldConfig } from "../../../utils/fieldConfigDefaults";
import { createNLPTriggerRows, TranslateFn } from "./helpers";
import { UserMappedField } from "../../../types/settings";

/**
 * Creates the appropriate default value input based on field type
 */
function createDefaultValueInput(
	field: UserMappedField,
	translate: TranslateFn,
	onChange: (value: string | number | boolean | string[] | undefined) => void
): { element: HTMLElement; row: CardRow } {
	let inputElement: HTMLElement;
	let row: CardRow;

	if (field.type === "boolean") {
		// Boolean field uses a toggle
		const currentValue = typeof field.defaultValue === "boolean" ? field.defaultValue : false;
		inputElement = createCardToggle(currentValue, (value) => {
			onChange(value);
		});
		row = {
			label: translate("settings.taskProperties.customUserFields.fields.defaultValue"),
			input: inputElement,
		};
	} else if (field.type === "number") {
		// Number field uses number input
		const input = createCardInput(
			"number",
			translate("settings.taskProperties.customUserFields.placeholders.defaultValue"),
			field.defaultValue !== undefined ? String(field.defaultValue) : ""
		);
		input.addEventListener("change", () => {
			const value = input.value.trim();
			if (value === "") {
				onChange(undefined);
			} else {
				onChange(parseFloat(value));
			}
		});
		inputElement = input;
		row = {
			label: translate("settings.taskProperties.customUserFields.fields.defaultValue"),
			input: inputElement,
		};
	} else if (field.type === "date") {
		// Date field uses a dropdown with preset options (same as due/scheduled defaults)
		const currentValue = typeof field.defaultValue === "string" ? field.defaultValue : "none";
		const select = createCardSelect(
			[
				{ value: "none", label: translate("settings.defaults.options.none") },
				{ value: "today", label: translate("settings.defaults.options.today") },
				{ value: "tomorrow", label: translate("settings.defaults.options.tomorrow") },
				{ value: "next-week", label: translate("settings.defaults.options.nextWeek") },
			],
			currentValue
		);
		select.addEventListener("change", () => {
			const value = select.value;
			onChange(value === "none" ? undefined : value);
		});
		inputElement = select;
		row = {
			label: translate("settings.taskProperties.customUserFields.fields.defaultValue"),
			input: inputElement,
		};
	} else if (field.type === "list") {
		// List field uses text input with comma-separated values
		const currentValue = Array.isArray(field.defaultValue)
			? field.defaultValue.join(", ")
			: "";
		const input = createCardInput(
			"text",
			translate("settings.taskProperties.customUserFields.placeholders.defaultValueList"),
			currentValue
		);
		input.addEventListener("change", () => {
			const value = input.value.trim();
			if (value === "") {
				onChange(undefined);
			} else {
				onChange(value.split(",").map(v => v.trim()).filter(v => v));
			}
		});
		inputElement = input;
		row = {
			label: translate("settings.taskProperties.customUserFields.fields.defaultValue"),
			input: inputElement,
		};
	} else {
		// Text field uses text input
		const input = createCardInput(
			"text",
			translate("settings.taskProperties.customUserFields.placeholders.defaultValue"),
			typeof field.defaultValue === "string" ? field.defaultValue : ""
		);
		input.addEventListener("change", () => {
			const value = input.value.trim();
			onChange(value === "" ? undefined : value);
		});
		inputElement = input;
		row = {
			label: translate("settings.taskProperties.customUserFields.fields.defaultValue"),
			input: inputElement,
		};
	}

	return { element: inputElement, row };
}

/**
 * Renders the user fields section with add button
 */
export function renderUserFieldsSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	// Ensure user fields array exists
	if (!Array.isArray(plugin.settings.userFields)) {
		plugin.settings.userFields = [];
	}

	// Migrate legacy single field if present
	if (plugin.settings.userField && plugin.settings.userField.enabled) {
		const legacy = plugin.settings.userField;
		const id = (legacy.displayName || legacy.key || "field")
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "-");
		if (!plugin.settings.userFields.find((f) => f.id === id || f.key === legacy.key)) {
			plugin.settings.userFields.push({
				id,
				displayName: legacy.displayName || "",
				key: legacy.key || "",
				type: legacy.type || "text",
			});
			save();
		}
	}

	// User fields list - using card layout
	const userFieldsContainer = container.createDiv("tasknotes-user-fields-container");
	renderUserFieldsList(userFieldsContainer, plugin, save, translate);

	// Add user field button
	new Setting(container)
		.setName(translate("settings.taskProperties.customUserFields.addNew.name"))
		.setDesc(translate("settings.taskProperties.customUserFields.addNew.description"))
		.addButton((button) =>
			button
				.setButtonText(
					translate("settings.taskProperties.customUserFields.addNew.buttonText")
				)
				.onClick(async () => {
					if (!plugin.settings.userFields) {
						plugin.settings.userFields = [];
					}
					const newId = `field_${Date.now()}`;
					const newField = {
						id: newId,
						displayName: "",
						key: "",
						type: "text" as const,
					};
					plugin.settings.userFields.push(newField);

					// Also add to modal fields config so it appears in task modals by default
					if (!plugin.settings.modalFieldsConfig) {
						plugin.settings.modalFieldsConfig = initializeFieldConfig(
							undefined,
							plugin.settings.userFields
						);
					} else {
						// Add the new field to the custom group
						const customGroupFields = plugin.settings.modalFieldsConfig.fields.filter(
							(f) => f.group === "custom"
						);
						const maxOrder = customGroupFields.length > 0
							? Math.max(...customGroupFields.map((f) => f.order))
							: -1;

						plugin.settings.modalFieldsConfig.fields.push({
							id: newId,
							fieldType: "user",
							group: "custom",
							displayName: newField.displayName || "",
							visibleInCreation: true,
							visibleInEdit: true,
							order: maxOrder + 1,
							enabled: true,
						});
					}

					save();
					renderUserFieldsList(userFieldsContainer, plugin, save, translate);
				})
		);
}

/**
 * Renders the list of user field cards with NLP triggers
 * @param expandedFieldId - Optional field ID to keep expanded after re-render
 */
function renderUserFieldsList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
	expandedFieldId?: string
): void {
	container.empty();

	if (!plugin.settings.userFields) {
		plugin.settings.userFields = [];
	}

	if (plugin.settings.userFields.length === 0) {
		showCardEmptyState(
			container,
			translate("settings.taskProperties.customUserFields.emptyState"),
			translate("settings.taskProperties.customUserFields.emptyStateButton"),
			() => {
				const addUserFieldButton = document.querySelector(
					'[data-setting-name="Add new user field"] button'
				);
				if (addUserFieldButton) {
					(addUserFieldButton as HTMLElement).click();
				}
			}
		);
		return;
	}

	plugin.settings.userFields.forEach((field, index) => {
		const nameInput = createCardInput(
			"text",
			translate("settings.taskProperties.customUserFields.placeholders.displayName"),
			field.displayName
		);
		const keyInput = createCardInput(
			"text",
			translate("settings.taskProperties.customUserFields.placeholders.propertyKey"),
			field.key
		);
		const typeSelect = createCardSelect(
			[
				{
					value: "text",
					label: translate("settings.taskProperties.customUserFields.types.text"),
				},
				{
					value: "number",
					label: translate("settings.taskProperties.customUserFields.types.number"),
				},
				{
					value: "boolean",
					label: translate("settings.taskProperties.customUserFields.types.boolean"),
				},
				{
					value: "date",
					label: translate("settings.taskProperties.customUserFields.types.date"),
				},
				{
					value: "list",
					label: translate("settings.taskProperties.customUserFields.types.list"),
				},
			],
			field.type
		);

		nameInput.addEventListener("change", () => {
			field.displayName = nameInput.value;

			// Also update display name in modal fields config
			if (plugin.settings.modalFieldsConfig) {
				const modalField = plugin.settings.modalFieldsConfig.fields.find(
					(f) => f.id === field.id
				);
				if (modalField) {
					modalField.displayName = field.displayName;
				}
			}

			// Update the card header text directly without re-rendering
			const card = container.querySelector(`[data-card-id="${field.id}"]`);
			if (card) {
				const primaryText = card.querySelector(".tasknotes-settings__card-header-primary");
				if (primaryText) {
					primaryText.textContent = field.displayName ||
						translate("settings.taskProperties.customUserFields.defaultNames.unnamedField");
				}
			}

			save();
		});

		keyInput.addEventListener("change", () => {
			field.key = keyInput.value;

			// Update the card header secondary text directly without re-rendering
			const card = container.querySelector(`[data-card-id="${field.id}"]`);
			if (card) {
				const secondaryText = card.querySelector(".tasknotes-settings__card-header-secondary");
				if (secondaryText) {
					secondaryText.textContent = field.key ||
						translate("settings.taskProperties.customUserFields.defaultNames.noKey");
				}
			}

			save();
		});

		typeSelect.addEventListener("change", () => {
			field.type = typeSelect.value as "text" | "number" | "boolean" | "date" | "list";
			// Clear default value when type changes to avoid type mismatches
			field.defaultValue = undefined;
			save();
			// Need to re-render to update the default value input type
			renderUserFieldsList(container, plugin, save, translate, field.id);
		});

		// Default value input based on field type
		const { row: defaultValueRow } = createDefaultValueInput(
			field,
			translate,
			(value) => {
				field.defaultValue = value;
				save();
			}
		);

		// NLP Trigger for user field
		const nlpRows = createNLPTriggerRows(
			plugin,
			field.id,
			`${field.id}:`,
			save,
			translate,
			() => renderUserFieldsList(container, plugin, save, translate)
		);

		// Create collapsible filter settings section
		const filterSectionWrapper = document.createElement("div");
		filterSectionWrapper.addClass("tasknotes-settings__collapsible-section");
		filterSectionWrapper.addClass("tasknotes-settings__collapsible-section--collapsed");

		// Helper to check if any filters are active
		const hasActiveFilters = (config: typeof field.autosuggestFilter) => {
			if (!config) return false;
			return (
				(config.requiredTags && config.requiredTags.length > 0) ||
				(config.includeFolders && config.includeFolders.length > 0) ||
				(config.propertyKey && config.propertyKey.trim() !== "")
			);
		};

		// Create header for collapsible section
		const filterHeader = filterSectionWrapper.createDiv(
			"tasknotes-settings__collapsible-section-header"
		);

		const filterHeaderLeft = filterHeader.createDiv(
			"tasknotes-settings__collapsible-section-header-left"
		);

		const filterHeaderText = filterHeaderLeft.createSpan(
			"tasknotes-settings__collapsible-section-title"
		);
		filterHeaderText.textContent = translate(
			"settings.taskProperties.customUserFields.autosuggestFilters.header"
		);

		// Add "Filters On" badge if filters are active
		const filterBadge = filterHeaderLeft.createSpan(
			"tasknotes-settings__filter-badge"
		);
		const updateFilterBadge = () => {
			if (hasActiveFilters(field.autosuggestFilter)) {
				filterBadge.style.display = "inline-flex";
				filterBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg><span>Filters On</span>`;
			} else {
				filterBadge.style.display = "none";
			}
		};
		updateFilterBadge();

		const chevron = filterHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
		chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

		// Create content container
		const filterContent = filterSectionWrapper.createDiv(
			"tasknotes-settings__collapsible-section-content"
		);

		createFilterSettingsInputs(
			filterContent,
			field.autosuggestFilter,
			(updated) => {
				field.autosuggestFilter = updated;
				updateFilterBadge();
				save();
			},
			translate
		);

		// Add click handler to toggle collapse
		filterHeader.addEventListener("click", () => {
			const isCollapsed = filterSectionWrapper.hasClass(
				"tasknotes-settings__collapsible-section--collapsed"
			);
			if (isCollapsed) {
				filterSectionWrapper.removeClass("tasknotes-settings__collapsible-section--collapsed");
			} else {
				filterSectionWrapper.addClass("tasknotes-settings__collapsible-section--collapsed");
			}
		});

		createCard(container, {
			id: field.id,
			collapsible: true,
			defaultCollapsed: field.id !== expandedFieldId,
			header: {
				primaryText:
					field.displayName ||
					translate("settings.taskProperties.customUserFields.defaultNames.unnamedField"),
				secondaryText:
					field.key ||
					translate("settings.taskProperties.customUserFields.defaultNames.noKey"),
				meta: [
					createStatusBadge(
						field.type.charAt(0).toUpperCase() + field.type.slice(1),
						"default"
					),
				],
				actions: [
					createDeleteHeaderButton(() => {
						if (plugin.settings.userFields) {
							const fieldId = plugin.settings.userFields[index]?.id;
							plugin.settings.userFields.splice(index, 1);

							// Also remove from modal fields config
							if (plugin.settings.modalFieldsConfig && fieldId) {
								plugin.settings.modalFieldsConfig.fields =
									plugin.settings.modalFieldsConfig.fields.filter(
										(f) => f.id !== fieldId
									);
							}

							save();
							renderUserFieldsList(container, plugin, save, translate);
						}
					}, translate("settings.taskProperties.customUserFields.deleteTooltip")),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									"settings.taskProperties.customUserFields.fields.displayName"
								),
								input: nameInput,
							},
							{
								label: translate(
									"settings.taskProperties.customUserFields.fields.propertyKey"
								),
								input: keyInput,
							},
							{
								label: translate(
									"settings.taskProperties.customUserFields.fields.type"
								),
								input: typeSelect,
							},
							defaultValueRow,
							...nlpRows,
						],
					},
					{
						rows: [
							{
								label: "",
								input: filterSectionWrapper,
								fullWidth: true,
							},
						],
					},
				],
			},
		});
	});
}
