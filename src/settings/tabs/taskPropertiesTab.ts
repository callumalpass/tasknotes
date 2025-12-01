/* eslint-disable @typescript-eslint/no-non-null-assertion, @microsoft/sdl/no-inner-html */
import { Notice, Setting } from "obsidian";
import TaskNotesPlugin from "../../main";
import { FieldMapping } from "../../types";
import { TranslationKey } from "../../i18n";
import {
	createSectionHeader,
	createHelpText,
	createValidationNote,
	createButtonSetting,
} from "../components/settingHelpers";
import {
	createCard,
	createStatusBadge,
	createCardInput,
	setupCardDragAndDrop,
	createDeleteHeaderButton,
	CardConfig,
	showCardEmptyState,
	createCardNumberInput,
	createCardSelect,
	createCardToggle,
} from "../components/CardComponent";
import { createFilterSettingsInputs } from "../components/FilterSettingsComponent";
import { initializeFieldConfig } from "../../utils/fieldConfigDefaults";
import { createIconInput } from "../components/IconSuggest";

/**
 * Renders the Task Properties tab - custom statuses, priorities, and user fields
 */
export function renderTaskPropertiesTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Ensure user fields array exists
	if (!Array.isArray(plugin.settings.userFields)) {
		plugin.settings.userFields = [];
	}

	// Custom Statuses Section
	createSectionHeader(container, translate("settings.taskProperties.taskStatuses.header"));
	createHelpText(container, translate("settings.taskProperties.taskStatuses.description"));

	// Status help section
	const statusHelpContainer = container.createDiv("tasknotes-settings__help-section");
	statusHelpContainer.createEl("h4", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.title"),
	});
	const statusHelpList = statusHelpContainer.createEl("ul");
	statusHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.value"),
	});
	statusHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.label"),
	});
	statusHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.color"),
	});
	statusHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.icon"),
	});
	statusHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.completed"),
	});
	statusHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.autoArchive"),
	});
	statusHelpContainer.createEl("p", {
		text: translate("settings.taskProperties.taskStatuses.howTheyWork.orderNote"),
		cls: "settings-help-note",
	});

	// Status list container - using card layout like webhooks
	const statusList = container.createDiv("tasknotes-statuses-container");
	renderStatusList(statusList, plugin, save);

	// Add status button
	new Setting(container)
		.setName(translate("settings.taskProperties.taskStatuses.addNew.name"))
		.setDesc(translate("settings.taskProperties.taskStatuses.addNew.description"))
		.addButton((button) =>
			button
				.setButtonText(translate("settings.taskProperties.taskStatuses.addNew.buttonText"))
				.onClick(async () => {
					const newId = `status_${Date.now()}`;
					const newStatus = {
						id: newId,
						value: "",
						label: "",
						color: "#6366f1",
						completed: false,
						isCompleted: false,
						order: plugin.settings.customStatuses.length,
						autoArchive: false,
						autoArchiveDelay: 5,
					};
					plugin.settings.customStatuses.push(newStatus);
					save();
					renderStatusList(statusList, plugin, save);
				})
		);

	createValidationNote(
		container,
		translate("settings.taskProperties.taskStatuses.validationNote")
	);

	// Custom Priorities Section
	createSectionHeader(container, translate("settings.taskProperties.taskPriorities.header"));
	createHelpText(container, translate("settings.taskProperties.taskPriorities.description"));

	// Priority help section
	const priorityHelpContainer = container.createDiv("tasknotes-settings__help-section");
	priorityHelpContainer.createEl("h4", {
		text: translate("settings.taskProperties.taskPriorities.howTheyWork.title"),
	});
	const priorityHelpList = priorityHelpContainer.createEl("ul");
	priorityHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskPriorities.howTheyWork.value"),
	});
	priorityHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskPriorities.howTheyWork.label"),
	});
	priorityHelpList.createEl("li", {
		text: translate("settings.taskProperties.taskPriorities.howTheyWork.color"),
	});

	// Priority list container - using card layout
	const priorityList = container.createDiv("tasknotes-priorities-container");
	renderPriorityList(priorityList, plugin, save);

	// Add priority button
	new Setting(container)
		.setName(translate("settings.taskProperties.taskPriorities.addNew.name"))
		.setDesc(translate("settings.taskProperties.taskPriorities.addNew.description"))
		.addButton((button) =>
			button
				.setButtonText(
					translate("settings.taskProperties.taskPriorities.addNew.buttonText")
				)
				.onClick(async () => {
					const newId = `priority_${Date.now()}`;
					// Set weight to max + 1 so new priority appears at the end (highest priority)
					const maxWeight = plugin.settings.customPriorities.reduce(
						(max, p) => Math.max(max, p.weight),
						-1
					);
					const newPriority = {
						id: newId,
						value: "",
						label: "",
						color: "#6366f1",
						weight: maxWeight + 1,
					};
					plugin.settings.customPriorities.push(newPriority);
					save();
					renderPriorityList(priorityList, plugin, save);
				})
		);

	createValidationNote(
		container,
		translate("settings.taskProperties.taskPriorities.validationNote")
	);

	// Field Mapping Section
	createSectionHeader(container, translate("settings.taskProperties.fieldMapping.header"));

	// Warning message
	const warning = container.createDiv("tasknotes-settings__warning");
	warning.appendText(translate("settings.taskProperties.fieldMapping.warning"));

	createHelpText(container, translate("settings.taskProperties.fieldMapping.description"));

	renderFieldMappingTable(container, plugin, save);

	createButtonSetting(container, {
		name: translate("settings.taskProperties.fieldMapping.resetButton.name"),
		desc: translate("settings.taskProperties.fieldMapping.resetButton.description"),
		buttonText: translate("settings.taskProperties.fieldMapping.resetButton.buttonText"),
		onClick: async () => {
			// Import the DEFAULT_FIELD_MAPPING - we'll need to check if this is accessible
			try {
				const { DEFAULT_FIELD_MAPPING } = await import("../../settings/defaults");
				plugin.settings.fieldMapping = { ...DEFAULT_FIELD_MAPPING };
				save();
				renderTaskPropertiesTab(container.parentElement!, plugin, save);
				new Notice(translate("settings.taskProperties.fieldMapping.notices.resetSuccess"));
			} catch (error) {
				console.error("Error resetting field mappings:", error);
				new Notice(translate("settings.taskProperties.fieldMapping.notices.resetFailure"));
			}
		},
	});

	// Custom User Fields Section
	createSectionHeader(container, translate("settings.taskProperties.customUserFields.header"));
	createHelpText(container, translate("settings.taskProperties.customUserFields.description"));

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
	renderUserFieldsList(userFieldsContainer, plugin, save);

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
					renderUserFieldsList(userFieldsContainer, plugin, save);
				})
		);
}

function renderStatusList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	if (!plugin.settings.customStatuses || plugin.settings.customStatuses.length === 0) {
		showCardEmptyState(
			container,
			translate("settings.taskProperties.taskStatuses.emptyState"),
			translate("settings.taskProperties.taskStatuses.emptyStateButton"),
			() => {
				const addStatusButton = document.querySelector(
					'[data-setting-name="Add new status"] button'
				);
				if (addStatusButton) {
					(addStatusButton as HTMLElement).click();
				}
			}
		);
		return;
	}

	const sortedStatuses = [...plugin.settings.customStatuses].sort((a, b) => a.order - b.order);

	sortedStatuses.forEach((status) => {
		const valueInput = createCardInput(
			"text",
			translate("settings.taskProperties.taskStatuses.placeholders.value"),
			status.value
		);
		const labelInput = createCardInput(
			"text",
			translate("settings.taskProperties.taskStatuses.placeholders.label"),
			status.label
		);
		const colorInput = createCardInput("color", "", status.color);
		const { container: iconInputContainer, input: iconInput } = createIconInput(
			plugin.app,
			translate("settings.taskProperties.taskStatuses.placeholders.icon"),
			status.icon || ""
		);

		const completedToggle = createCardToggle(status.isCompleted || false, (value) => {
			status.isCompleted = value;
			const metaContainer = statusCard?.querySelector(".tasknotes-settings__card-meta");
			if (metaContainer) {
				metaContainer.empty();
				if (status.isCompleted) {
					metaContainer.appendChild(
						createStatusBadge(
							translate("settings.taskProperties.taskStatuses.badges.completed"),
							"completed"
						)
					);
				}
			}
			save();
		});

		const autoArchiveToggle = createCardToggle(status.autoArchive || false, (value) => {
			status.autoArchive = value;
			save();
			// Update delay input visibility without re-rendering
			updateDelayInputVisibility();
		});

		const autoArchiveDelayInput = createCardNumberInput(
			1,
			1440,
			1,
			status.autoArchiveDelay || 5
		);

		const metaElements = status.isCompleted
			? [
					createStatusBadge(
						translate("settings.taskProperties.taskStatuses.badges.completed"),
						"completed"
					),
				]
			: [];

		let statusCard: HTMLElement;

		// Function to show/hide the delay input based on auto-archive setting
		const updateDelayInputVisibility = () => {
			// Find the delay input row by looking for the input element's parent row
			const delayRow = autoArchiveDelayInput.closest(
				".tasknotes-settings__card-config-row"
			) as HTMLElement;
			if (delayRow) {
				delayRow.style.display = status.autoArchive ? "flex" : "none";
			}
		};

		const deleteStatus = () => {
			// eslint-disable-next-line no-alert
			const confirmDelete = confirm(
				translate("settings.taskProperties.taskStatuses.deleteConfirm", {
					label: status.label || status.value,
				})
			);
			if (confirmDelete) {
				const statusIndex = plugin.settings.customStatuses.findIndex(
					(s) => s.id === status.id
				);
				if (statusIndex !== -1) {
					plugin.settings.customStatuses.splice(statusIndex, 1);
					plugin.settings.customStatuses.forEach((s, i) => {
						s.order = i;
					});
					save();
					renderStatusList(container, plugin, save);
				}
			}
		};

		const cardConfig: CardConfig = {
			id: status.id,
			draggable: true,
			collapsible: true,
			defaultCollapsed: true,
			colorIndicator: { color: status.color, cssVar: "--status-color" },
			header: {
				primaryText: status.value || "untitled",
				secondaryText: status.label || "No label",
				meta: metaElements,
				actions: [createDeleteHeaderButton(deleteStatus)],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.value"
								),
								input: valueInput,
							},
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.label"
								),
								input: labelInput,
							},
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.color"
								),
								input: colorInput,
							},
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.icon"
								),
								input: iconInputContainer,
							},
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.completed"
								),
								input: completedToggle,
							},
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.autoArchive"
								),
								input: autoArchiveToggle,
							},
							{
								label: translate(
									"settings.taskProperties.taskStatuses.fields.delayMinutes"
								),
								input: autoArchiveDelayInput,
							},
						],
					},
				],
			},
		};

		statusCard = createCard(container, cardConfig);

		// Set initial visibility
		updateDelayInputVisibility();

		valueInput.addEventListener("change", () => {
			status.value = valueInput.value;
			statusCard.querySelector(".tasknotes-settings__card-primary-text")!.textContent =
				status.value || "untitled";
			save();
		});

		labelInput.addEventListener("change", () => {
			status.label = labelInput.value;
			statusCard.querySelector(".tasknotes-settings__card-secondary-text")!.textContent =
				status.label || "No label";
			save();
		});

		colorInput.addEventListener("change", () => {
			status.color = colorInput.value;
			const colorIndicator = statusCard.querySelector(
				".tasknotes-settings__card-color-indicator"
			) as HTMLElement;
			if (colorIndicator) {
				colorIndicator.style.backgroundColor = status.color;
			}
			save();
		});

		iconInput.addEventListener("change", () => {
			status.icon = iconInput.value.trim() || undefined;
			save();
		});

		autoArchiveDelayInput.addEventListener("change", () => {
			const value = parseInt(autoArchiveDelayInput.value);
			if (!isNaN(value) && value >= 1 && value <= 1440) {
				status.autoArchiveDelay = value;
				save();
			}
		});

		setupCardDragAndDrop(statusCard, container, (draggedId, targetId, insertBefore) => {
			const draggedIndex = plugin.settings.customStatuses.findIndex(
				(s) => s.id === draggedId
			);
			const targetIndex = plugin.settings.customStatuses.findIndex((s) => s.id === targetId);

			if (draggedIndex === -1 || targetIndex === -1) return;

			const reorderedStatuses = [...plugin.settings.customStatuses];
			const [draggedStatus] = reorderedStatuses.splice(draggedIndex, 1);

			let newIndex = targetIndex;
			if (draggedIndex < targetIndex) newIndex = targetIndex - 1;
			if (!insertBefore) newIndex++;

			reorderedStatuses.splice(newIndex, 0, draggedStatus);
			reorderedStatuses.forEach((s, i) => {
				s.order = i;
			});

			plugin.settings.customStatuses = reorderedStatuses;
			save();
			renderStatusList(container, plugin, save);
		});
	});
}

function renderPriorityList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	if (!plugin.settings.customPriorities || plugin.settings.customPriorities.length === 0) {
		showCardEmptyState(
			container,
			translate("settings.taskProperties.taskPriorities.emptyState"),
			translate("settings.taskProperties.taskPriorities.emptyStateButton"),
			() => {
				const addPriorityButton = document.querySelector(
					'[data-setting-name="Add new priority"] button'
				);
				if (addPriorityButton) {
					(addPriorityButton as HTMLElement).click();
				}
			}
		);
		return;
	}

	// Sort by weight (lowest first = lowest priority at top, highest at bottom)
	const sortedPriorities = [...plugin.settings.customPriorities].sort(
		(a, b) => a.weight - b.weight
	);

	sortedPriorities.forEach((priority, index) => {
		const valueInput = createCardInput(
			"text",
			translate("settings.taskProperties.taskPriorities.placeholders.value"),
			priority.value
		);
		const labelInput = createCardInput(
			"text",
			translate("settings.taskProperties.taskPriorities.placeholders.label"),
			priority.label
		);
		const colorInput = createCardInput("color", "", priority.color);

		const card = createCard(container, {
			id: priority.id,
			draggable: true,
			collapsible: true,
			defaultCollapsed: true,
			colorIndicator: { color: priority.color },
			header: {
				primaryText: priority.label || priority.value || "untitled",
				actions: [
					createDeleteHeaderButton(() => {
						if (plugin.settings.customPriorities.length <= 1) {
							new Notice(
								translate("settings.taskProperties.taskPriorities.deleteConfirm")
							);
							return;
						}
						const priorityIndex = plugin.settings.customPriorities.findIndex(
							(p) => p.id === priority.id
						);
						if (priorityIndex !== -1) {
							plugin.settings.customPriorities.splice(priorityIndex, 1);
							// Recalculate weights to keep them sequential
							plugin.settings.customPriorities
								.sort((a, b) => a.weight - b.weight)
								.forEach((p, i) => {
									p.weight = i;
								});
							save();
							renderPriorityList(container, plugin, save);
						}
					}, translate("settings.taskProperties.taskPriorities.deleteTooltip")),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									"settings.taskProperties.taskPriorities.fields.value"
								),
								input: valueInput,
							},
							{
								label: translate(
									"settings.taskProperties.taskPriorities.fields.label"
								),
								input: labelInput,
							},
							{
								label: translate(
									"settings.taskProperties.taskPriorities.fields.color"
								),
								input: colorInput,
							},
						],
					},
				],
			},
		});

		valueInput.addEventListener("change", () => {
			priority.value = valueInput.value;
			save();
		});

		labelInput.addEventListener("change", () => {
			priority.label = labelInput.value;
			card.querySelector(".tasknotes-settings__card-primary-text")!.textContent =
				priority.label || priority.value || "untitled";
			save();
		});

		colorInput.addEventListener("change", () => {
			priority.color = colorInput.value;
			const colorIndicator = card.querySelector(
				".tasknotes-settings__card-color-indicator"
			) as HTMLElement;
			if (colorIndicator) {
				colorIndicator.style.backgroundColor = priority.color;
			}
			save();
		});

		// Setup drag and drop for reordering
		setupCardDragAndDrop(card, container, (draggedId, targetId, insertBefore) => {
			const draggedIndex = plugin.settings.customPriorities.findIndex(
				(p) => p.id === draggedId
			);
			const targetIndex = plugin.settings.customPriorities.findIndex(
				(p) => p.id === targetId
			);

			if (draggedIndex === -1 || targetIndex === -1) return;

			// Sort by weight first to work with the visual order
			const reorderedPriorities = [...plugin.settings.customPriorities].sort(
				(a, b) => a.weight - b.weight
			);
			const draggedPriorityIndex = reorderedPriorities.findIndex(
				(p) => p.id === draggedId
			);
			const targetPriorityIndex = reorderedPriorities.findIndex(
				(p) => p.id === targetId
			);

			const [draggedPriority] = reorderedPriorities.splice(draggedPriorityIndex, 1);

			let newIndex = targetPriorityIndex;
			if (draggedPriorityIndex < targetPriorityIndex) newIndex = targetPriorityIndex - 1;
			if (!insertBefore) newIndex++;

			reorderedPriorities.splice(newIndex, 0, draggedPriority);

			// Update weights based on new order
			reorderedPriorities.forEach((p, i) => {
				p.weight = i;
			});

			plugin.settings.customPriorities = reorderedPriorities;
			save();
			renderPriorityList(container, plugin, save);
		});
	});
}


function renderFieldMappingTable(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Create mapping table
	const table = container.createEl("table", { cls: "tasknotes-settings__table" });
	const header = table.createEl("tr");
	header.createEl("th", {
		cls: "tasknotes-settings__table-header",
		text: translate("settings.taskProperties.fieldMapping.table.fieldHeader"),
	});
	header.createEl("th", {
		cls: "tasknotes-settings__table-header",
		text: translate("settings.taskProperties.fieldMapping.table.propertyHeader"),
	});

	const fieldMappings: Array<[keyof FieldMapping, string]> = [
		["title", translate("settings.taskProperties.fieldMapping.fields.title")],
		["status", translate("settings.taskProperties.fieldMapping.fields.status")],
		["priority", translate("settings.taskProperties.fieldMapping.fields.priority")],
		["due", translate("settings.taskProperties.fieldMapping.fields.due")],
		["scheduled", translate("settings.taskProperties.fieldMapping.fields.scheduled")],
		["contexts", translate("settings.taskProperties.fieldMapping.fields.contexts")],
		["projects", translate("settings.taskProperties.fieldMapping.fields.projects")],
		["timeEstimate", translate("settings.taskProperties.fieldMapping.fields.timeEstimate")],
		["recurrence", translate("settings.taskProperties.fieldMapping.fields.recurrence")],
		["dateCreated", translate("settings.taskProperties.fieldMapping.fields.dateCreated")],
		["completedDate", translate("settings.taskProperties.fieldMapping.fields.completedDate")],
		["dateModified", translate("settings.taskProperties.fieldMapping.fields.dateModified")],
		["archiveTag", translate("settings.taskProperties.fieldMapping.fields.archiveTag")],
		["timeEntries", translate("settings.taskProperties.fieldMapping.fields.timeEntries")],
		[
			"completeInstances",
			translate("settings.taskProperties.fieldMapping.fields.completeInstances"),
		],
		["blockedBy", translate("settings.taskProperties.fieldMapping.fields.blockedBy")],
		["pomodoros", translate("settings.taskProperties.fieldMapping.fields.pomodoros")],
		["icsEventId", translate("settings.taskProperties.fieldMapping.fields.icsEventId")],
		["icsEventTag", translate("settings.taskProperties.fieldMapping.fields.icsEventTag")],
		["reminders", translate("settings.taskProperties.fieldMapping.fields.reminders")],
	];

	fieldMappings.forEach(([field, label]) => {
		const row = table.createEl("tr", { cls: "tasknotes-settings__table-row" });
		const labelCell = row.createEl("td", { cls: "tasknotes-settings__table-cell" });
		labelCell.textContent = label;
		const inputCell = row.createEl("td", { cls: "tasknotes-settings__table-cell" });

		const input = inputCell.createEl("input", {
			type: "text",
			cls: "settings-input field-mapping-input",
			value: plugin.settings.fieldMapping[field] || "",
			attr: {
				placeholder: field,
				"aria-label": `Property name for ${label}`,
			},
		});

		input.addEventListener("change", async () => {
			try {
				plugin.settings.fieldMapping[field] = input.value;
				save();
			} catch (error) {
				console.error(`Error updating field mapping for ${field}:`, error);
				new Notice(
					translate("settings.taskProperties.fieldMapping.notices.updateFailure", {
						label,
					})
				);
			}
		});
	});
}

function renderUserFieldsList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

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

			save();
			renderUserFieldsList(container, plugin, save);
		});

		keyInput.addEventListener("change", () => {
			field.key = keyInput.value;
			save();
			renderUserFieldsList(container, plugin, save);
		});

		typeSelect.addEventListener("change", () => {
			field.type = typeSelect.value as any;
			save();
			renderUserFieldsList(container, plugin, save);
		});

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
			defaultCollapsed: true,
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
							renderUserFieldsList(container, plugin, save);
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
