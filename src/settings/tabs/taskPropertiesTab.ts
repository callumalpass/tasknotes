/* eslint-disable @typescript-eslint/no-non-null-assertion, @microsoft/sdl/no-inner-html */
import { Notice, Setting, TAbstractFile } from "obsidian";
import TaskNotesPlugin from "../../main";
import { FieldMapping } from "../../types";
import { DefaultReminder } from "../../types/settings";
import { TranslationKey } from "../../i18n";
import {
	createSectionHeader,
	createHelpText,
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
	CardRow,
} from "../components/CardComponent";
import { createFilterSettingsInputs } from "../components/FilterSettingsComponent";
import { initializeFieldConfig } from "../../utils/fieldConfigDefaults";
import { createIconInput } from "../components/IconSuggest";
import { ProjectSelectModal } from "../../modals/ProjectSelectModal";
import { splitListPreservingLinksAndQuotes } from "../../utils/stringSplit";

// Helper type for NLP trigger configuration
interface NLPTriggerConfig {
	propertyId: string;
	enabled: boolean;
	trigger: string;
}

/**
 * Gets the NLP trigger configuration for a property
 */
function getNLPTrigger(plugin: TaskNotesPlugin, propertyId: string, defaultTrigger: string): NLPTriggerConfig {
	const triggerConfig = plugin.settings.nlpTriggers.triggers.find(
		(t) => t.propertyId === propertyId
	);
	return {
		propertyId,
		enabled: triggerConfig?.enabled ?? (propertyId !== "priority"), // priority disabled by default
		trigger: triggerConfig?.trigger || defaultTrigger,
	};
}

/**
 * Updates the NLP trigger configuration for a property
 */
function updateNLPTrigger(
	plugin: TaskNotesPlugin,
	propertyId: string,
	updates: Partial<{ enabled: boolean; trigger: string }>,
	defaultTrigger: string,
	save: () => void
): void {
	const index = plugin.settings.nlpTriggers.triggers.findIndex(
		(t) => t.propertyId === propertyId
	);
	if (index !== -1) {
		if (updates.enabled !== undefined) {
			plugin.settings.nlpTriggers.triggers[index].enabled = updates.enabled;
		}
		if (updates.trigger !== undefined) {
			plugin.settings.nlpTriggers.triggers[index].trigger = updates.trigger;
		}
	} else {
		plugin.settings.nlpTriggers.triggers.push({
			propertyId,
			trigger: updates.trigger ?? defaultTrigger,
			enabled: updates.enabled ?? true,
		});
	}
	save();
}

/**
 * Creates NLP trigger input rows for a property card
 */
function createNLPTriggerRows(
	plugin: TaskNotesPlugin,
	propertyId: string,
	defaultTrigger: string,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
	onRerender?: () => void
): CardRow[] {
	const config = getNLPTrigger(plugin, propertyId, defaultTrigger);

	const triggerToggle = createCardToggle(config.enabled, (enabled) => {
		updateNLPTrigger(plugin, propertyId, { enabled }, defaultTrigger, save);
		if (onRerender) onRerender();
	});

	const rows: CardRow[] = [
		{
			label: translate("settings.taskProperties.propertyCard.nlpTrigger"),
			input: triggerToggle,
		},
	];

	if (config.enabled) {
		const triggerInput = createCardInput("text", defaultTrigger, config.trigger);
		triggerInput.style.width = "80px";
		triggerInput.addEventListener("change", () => {
			const value = triggerInput.value;
			if (value.trim().length === 0) {
				new Notice(translate("settings.taskProperties.propertyCard.triggerEmpty"));
				return;
			}
			if (value.length > 10) {
				new Notice(translate("settings.taskProperties.propertyCard.triggerTooLong"));
				return;
			}
			updateNLPTrigger(plugin, propertyId, { trigger: value }, defaultTrigger, save);
		});
		rows.push({
			label: translate("settings.taskProperties.propertyCard.triggerChar"),
			input: triggerInput,
		});
	}

	return rows;
}

/**
 * Renders the Task Properties tab - unified property cards
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

	// ===== CORE PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.coreProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.corePropertiesDesc"));

	// Title Property Card (with filename settings)
	renderTitlePropertyCard(container, plugin, save, translate);

	// Status Property Card
	renderStatusPropertyCard(container, plugin, save, translate);

	// Priority Property Card
	renderPriorityPropertyCard(container, plugin, save, translate);

	// ===== DATE PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.dateProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.datePropertiesDesc"));

	// Due Date Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "due",
		displayName: translate("settings.taskProperties.properties.due.name"),
		description: translate("settings.taskProperties.properties.due.description"),
		hasDefault: true,
		defaultType: "date-preset",
		defaultOptions: [
			{ value: "none", label: translate("settings.defaults.options.none") },
			{ value: "today", label: translate("settings.defaults.options.today") },
			{ value: "tomorrow", label: translate("settings.defaults.options.tomorrow") },
			{ value: "next-week", label: translate("settings.defaults.options.nextWeek") },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultDueDate,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultDueDate = value as any;
			save();
		},
	});

	// Scheduled Date Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "scheduled",
		displayName: translate("settings.taskProperties.properties.scheduled.name"),
		description: translate("settings.taskProperties.properties.scheduled.description"),
		hasDefault: true,
		defaultType: "date-preset",
		defaultOptions: [
			{ value: "none", label: translate("settings.defaults.options.none") },
			{ value: "today", label: translate("settings.defaults.options.today") },
			{ value: "tomorrow", label: translate("settings.defaults.options.tomorrow") },
			{ value: "next-week", label: translate("settings.defaults.options.nextWeek") },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultScheduledDate,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultScheduledDate = value as any;
			save();
		},
	});

	// ===== ORGANIZATION PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.organizationProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.organizationPropertiesDesc"));

	// Contexts Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "contexts",
		displayName: translate("settings.taskProperties.properties.contexts.name"),
		description: translate("settings.taskProperties.properties.contexts.description"),
		hasDefault: true,
		defaultType: "text",
		defaultPlaceholder: translate("settings.defaults.basicDefaults.defaultContexts.placeholder"),
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultContexts,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultContexts = value;
			save();
		},
		hasNLPTrigger: true,
		nlpDefaultTrigger: "@",
	});

	// Projects Property Card
	renderProjectsPropertyCard(container, plugin, save, translate);

	// Tags Property Card (special - no property key, uses native Obsidian tags)
	renderTagsPropertyCard(container, plugin, save, translate);

	// ===== TASK DETAILS SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.taskDetails"));
	createHelpText(container, translate("settings.taskProperties.sections.taskDetailsDesc"));

	// Time Estimate Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "timeEstimate",
		displayName: translate("settings.taskProperties.properties.timeEstimate.name"),
		description: translate("settings.taskProperties.properties.timeEstimate.description"),
		hasDefault: true,
		defaultType: "number",
		defaultPlaceholder: translate("settings.defaults.basicDefaults.defaultTimeEstimate.placeholder"),
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultTimeEstimate?.toString() || "",
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultTimeEstimate = parseInt(value) || 0;
			save();
		},
	});

	// Recurrence Property Card
	renderSimplePropertyCard(container, plugin, save, translate, {
		propertyId: "recurrence",
		displayName: translate("settings.taskProperties.properties.recurrence.name"),
		description: translate("settings.taskProperties.properties.recurrence.description"),
		hasDefault: true,
		defaultType: "dropdown",
		defaultOptions: [
			{ value: "none", label: translate("settings.defaults.options.none") },
			{ value: "daily", label: translate("settings.defaults.options.daily") },
			{ value: "weekly", label: translate("settings.defaults.options.weekly") },
			{ value: "monthly", label: translate("settings.defaults.options.monthly") },
			{ value: "yearly", label: translate("settings.defaults.options.yearly") },
		],
		getDefaultValue: () => plugin.settings.taskCreationDefaults.defaultRecurrence,
		setDefaultValue: (value) => {
			plugin.settings.taskCreationDefaults.defaultRecurrence = value as any;
			save();
		},
	});

	// Reminders Property Card
	renderRemindersPropertyCard(container, plugin, save, translate);

	// ===== METADATA PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.metadataProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.metadataPropertiesDesc"));

	// Date Created Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "dateCreated",
		translate("settings.taskProperties.properties.dateCreated.name"),
		translate("settings.taskProperties.properties.dateCreated.description"));

	// Date Modified Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "dateModified",
		translate("settings.taskProperties.properties.dateModified.name"),
		translate("settings.taskProperties.properties.dateModified.description"));

	// Completed Date Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "completedDate",
		translate("settings.taskProperties.properties.completedDate.name"),
		translate("settings.taskProperties.properties.completedDate.description"));

	// Archive Tag Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "archiveTag",
		translate("settings.taskProperties.properties.archiveTag.name"),
		translate("settings.taskProperties.properties.archiveTag.description"));

	// Time Entries Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "timeEntries",
		translate("settings.taskProperties.properties.timeEntries.name"),
		translate("settings.taskProperties.properties.timeEntries.description"));

	// Complete Instances Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "completeInstances",
		translate("settings.taskProperties.properties.completeInstances.name"),
		translate("settings.taskProperties.properties.completeInstances.description"));

	// Blocked By Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "blockedBy",
		translate("settings.taskProperties.properties.blockedBy.name"),
		translate("settings.taskProperties.properties.blockedBy.description"));

	// ===== FEATURE PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.featureProperties"));
	createHelpText(container, translate("settings.taskProperties.sections.featurePropertiesDesc"));

	// Pomodoros Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "pomodoros",
		translate("settings.taskProperties.properties.pomodoros.name"),
		translate("settings.taskProperties.properties.pomodoros.description"));

	// ICS Event ID Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "icsEventId",
		translate("settings.taskProperties.properties.icsEventId.name"),
		translate("settings.taskProperties.properties.icsEventId.description"));

	// ICS Event Tag Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "icsEventTag",
		translate("settings.taskProperties.properties.icsEventTag.name"),
		translate("settings.taskProperties.properties.icsEventTag.description"));

	// ===== CUSTOM USER FIELDS SECTION =====
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
 * Renders the Title property card with filename settings
 */
function renderTitlePropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	// Create a wrapper for the card so we can re-render it
	const cardWrapper = container.createDiv();
	// Track collapse state across re-renders
	let isCollapsed = true;

	function renderCard(): void {
		cardWrapper.empty();

		const propertyKeyInput = createCardInput(
			"text",
			"title",
			plugin.settings.fieldMapping.title
		);

		propertyKeyInput.addEventListener("change", () => {
			plugin.settings.fieldMapping.title = propertyKeyInput.value;
			save();
		});

		// Store title in filename toggle
		const storeTitleToggle = createCardToggle(
			plugin.settings.storeTitleInFilename,
			(value) => {
				plugin.settings.storeTitleInFilename = value;
				save();
				// Re-render the entire card to show/hide property key
				renderCard();
			}
		);

		// Create nested content for filename settings
		const nestedContainer = document.createElement("div");
		nestedContainer.addClass("tasknotes-settings__nested-content");
		renderFilenameSettingsContent(nestedContainer, plugin, save, translate);

		const rows: CardRow[] = [];

		// Only show property key when NOT storing title in filename
		if (!plugin.settings.storeTitleInFilename) {
			rows.push({
				label: translate("settings.taskProperties.propertyCard.propertyKey"),
				input: propertyKeyInput,
			});
		}

		rows.push(
			{ label: translate("settings.taskProperties.titleCard.storeTitleInFilename"), input: storeTitleToggle },
			{ label: "", input: nestedContainer, fullWidth: true }
		);

		createCard(cardWrapper, {
			id: "property-title",
			collapsible: true,
			defaultCollapsed: isCollapsed,
			onCollapseChange: (collapsed) => {
				isCollapsed = collapsed;
			},
			header: {
				primaryText: translate("settings.taskProperties.properties.title.name"),
				secondaryText: plugin.settings.storeTitleInFilename
					? translate("settings.taskProperties.titleCard.storedInFilename")
					: plugin.settings.fieldMapping.title,
			},
			content: {
				sections: [{ rows }],
			},
		});
	}

	renderCard();
}

/**
 * Renders the filename settings content inside the title card
 */
function renderFilenameSettingsContent(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	container.empty();

	// Only show filename format settings when storeTitleInFilename is off
	if (plugin.settings.storeTitleInFilename) {
		container.createDiv({
			text: translate("settings.taskProperties.titleCard.filenameUpdatesWithTitle"),
			cls: "setting-item-description",
		});
		return;
	}

	// Filename format dropdown
	const formatContainer = container.createDiv("tasknotes-settings__card-config-row");
	formatContainer.createSpan({
		text: translate("settings.taskProperties.titleCard.filenameFormat"),
		cls: "tasknotes-settings__card-config-label",
	});

	const formatSelect = createCardSelect(
		[
			{ value: "title", label: translate("settings.appearance.taskFilenames.filenameFormat.options.title") },
			{ value: "zettel", label: translate("settings.appearance.taskFilenames.filenameFormat.options.zettel") },
			{ value: "timestamp", label: translate("settings.appearance.taskFilenames.filenameFormat.options.timestamp") },
			{ value: "custom", label: translate("settings.appearance.taskFilenames.filenameFormat.options.custom") },
		],
		plugin.settings.taskFilenameFormat
	);
	formatSelect.addEventListener("change", () => {
		plugin.settings.taskFilenameFormat = formatSelect.value as any;
		save();
		renderFilenameSettingsContent(container, plugin, save, translate);
	});
	formatContainer.appendChild(formatSelect);

	// Custom template input (shown only when format is custom)
	if (plugin.settings.taskFilenameFormat === "custom") {
		const templateContainer = container.createDiv("tasknotes-settings__card-config-row");
		templateContainer.createSpan({
			text: translate("settings.taskProperties.titleCard.customTemplate"),
			cls: "tasknotes-settings__card-config-label",
		});

		const templateInput = createCardInput(
			"text",
			translate("settings.appearance.taskFilenames.customTemplate.placeholder"),
			plugin.settings.customFilenameTemplate
		);
		templateInput.style.width = "100%";
		templateInput.addEventListener("change", () => {
			plugin.settings.customFilenameTemplate = templateInput.value;
			save();
		});
		templateContainer.appendChild(templateInput);

		// Help text for template variables
		container.createDiv({
			text: translate("settings.appearance.taskFilenames.customTemplate.helpText"),
			cls: "setting-item-description",
		});
	}
}

/**
 * Renders the Status property card with nested status value cards
 */
function renderStatusPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const propertyKeyInput = createCardInput(
		"text",
		"status",
		plugin.settings.fieldMapping.status
	);

	const defaultSelect = createCardSelect(
		plugin.settings.customStatuses.map((status) => ({
			value: status.value,
			label: status.label || status.value,
		})),
		plugin.settings.defaultTaskStatus
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping.status = propertyKeyInput.value;
		save();
	});

	defaultSelect.addEventListener("change", () => {
		plugin.settings.defaultTaskStatus = defaultSelect.value;
		save();
	});

	// Create nested content for status values
	const nestedContainer = document.createElement("div");
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Create collapsible section for status values
	const statusValuesSection = nestedContainer.createDiv("tasknotes-settings__collapsible-section");

	const statusValuesHeader = statusValuesSection.createDiv("tasknotes-settings__collapsible-section-header");
	statusValuesHeader.createSpan({ text: translate("settings.taskProperties.statusCard.valuesHeader"), cls: "tasknotes-settings__collapsible-section-title" });
	const chevron = statusValuesHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const statusValuesContent = statusValuesSection.createDiv("tasknotes-settings__collapsible-section-content");

	// Help text explaining how statuses work
	const statusHelpContainer = statusValuesContent.createDiv("tasknotes-settings__help-section");
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
		cls: "setting-item-description",
	});

	// Render status value cards
	const statusListContainer = statusValuesContent.createDiv("tasknotes-statuses-container");
	renderStatusList(statusListContainer, plugin, save, translate, () => {
		// Re-render the default select when statuses change
		defaultSelect.empty();
		plugin.settings.customStatuses.forEach((status) => {
			const option = defaultSelect.createEl("option", {
				value: status.value,
				text: status.label || status.value,
			});
			if (status.value === plugin.settings.defaultTaskStatus) {
				option.selected = true;
			}
		});
	});

	// Add status button
	const addStatusButton = statusValuesContent.createEl("button", {
		text: translate("settings.taskProperties.taskStatuses.addNew.buttonText"),
		cls: "tn-btn tn-btn--ghost",
	});
	addStatusButton.style.marginTop = "0.5rem";
	addStatusButton.onclick = () => {
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
		renderStatusList(statusListContainer, plugin, save, translate, () => {
			defaultSelect.empty();
			plugin.settings.customStatuses.forEach((status) => {
				const option = defaultSelect.createEl("option", {
					value: status.value,
					text: status.label || status.value,
				});
				if (status.value === plugin.settings.defaultTaskStatus) {
					option.selected = true;
				}
			});
		});
	};

	// Toggle collapse
	statusValuesHeader.addEventListener("click", () => {
		statusValuesSection.toggleClass("tasknotes-settings__collapsible-section--collapsed",
			!statusValuesSection.hasClass("tasknotes-settings__collapsible-section--collapsed"));
	});

	const nlpRows = createNLPTriggerRows(plugin, "status", "*", save, translate);

	const rows: CardRow[] = [
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
		{ label: translate("settings.taskProperties.propertyCard.default"), input: defaultSelect },
		...nlpRows,
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-status",
		collapsible: true,
		defaultCollapsed: false,
		header: {
			primaryText: translate("settings.taskProperties.properties.status.name"),
			secondaryText: plugin.settings.fieldMapping.status,
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Renders the Priority property card with nested priority value cards
 */
function renderPriorityPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const propertyKeyInput = createCardInput(
		"text",
		"priority",
		plugin.settings.fieldMapping.priority
	);

	const defaultSelect = createCardSelect(
		[
			{ value: "", label: translate("settings.defaults.options.noDefault") },
			...plugin.settings.customPriorities.map((priority) => ({
				value: priority.value,
				label: priority.label || priority.value,
			})),
		],
		plugin.settings.defaultTaskPriority
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping.priority = propertyKeyInput.value;
		save();
	});

	defaultSelect.addEventListener("change", () => {
		plugin.settings.defaultTaskPriority = defaultSelect.value;
		save();
	});

	// Create nested content for priority values
	const nestedContainer = document.createElement("div");
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Create collapsible section for priority values
	const priorityValuesSection = nestedContainer.createDiv("tasknotes-settings__collapsible-section");

	const priorityValuesHeader = priorityValuesSection.createDiv("tasknotes-settings__collapsible-section-header");
	priorityValuesHeader.createSpan({ text: translate("settings.taskProperties.priorityCard.valuesHeader"), cls: "tasknotes-settings__collapsible-section-title" });
	const chevron = priorityValuesHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const priorityValuesContent = priorityValuesSection.createDiv("tasknotes-settings__collapsible-section-content");

	// Help text explaining how priorities work
	const priorityHelpContainer = priorityValuesContent.createDiv("tasknotes-settings__help-section");
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

	// Render priority value cards
	const priorityListContainer = priorityValuesContent.createDiv("tasknotes-priorities-container");
	renderPriorityList(priorityListContainer, plugin, save, translate, () => {
		// Re-render the default select when priorities change
		defaultSelect.empty();
		const noDefaultOption = defaultSelect.createEl("option", {
			value: "",
			text: translate("settings.defaults.options.noDefault"),
		});
		if (plugin.settings.defaultTaskPriority === "") {
			noDefaultOption.selected = true;
		}
		plugin.settings.customPriorities.forEach((priority) => {
			const option = defaultSelect.createEl("option", {
				value: priority.value,
				text: priority.label || priority.value,
			});
			if (priority.value === plugin.settings.defaultTaskPriority) {
				option.selected = true;
			}
		});
	});

	// Add priority button
	const addPriorityButton = priorityValuesContent.createEl("button", {
		text: translate("settings.taskProperties.taskPriorities.addNew.buttonText"),
		cls: "tn-btn tn-btn--ghost",
	});
	addPriorityButton.style.marginTop = "0.5rem";
	addPriorityButton.onclick = () => {
		const newId = `priority_${Date.now()}`;
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
		renderPriorityList(priorityListContainer, plugin, save, translate, () => {
			defaultSelect.empty();
			const noDefaultOption = defaultSelect.createEl("option", {
				value: "",
				text: translate("settings.defaults.options.noDefault"),
			});
			if (plugin.settings.defaultTaskPriority === "") {
				noDefaultOption.selected = true;
			}
			plugin.settings.customPriorities.forEach((priority) => {
				const option = defaultSelect.createEl("option", {
					value: priority.value,
					text: priority.label || priority.value,
				});
				if (priority.value === plugin.settings.defaultTaskPriority) {
					option.selected = true;
				}
			});
		});
	};

	// Toggle collapse
	priorityValuesHeader.addEventListener("click", () => {
		priorityValuesSection.toggleClass("tasknotes-settings__collapsible-section--collapsed",
			!priorityValuesSection.hasClass("tasknotes-settings__collapsible-section--collapsed"));
	});

	const nlpRows = createNLPTriggerRows(plugin, "priority", "!", save, translate);

	const rows: CardRow[] = [
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
		{ label: translate("settings.taskProperties.propertyCard.default"), input: defaultSelect },
		...nlpRows,
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-priority",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate("settings.taskProperties.properties.priority.name"),
			secondaryText: plugin.settings.fieldMapping.priority,
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Renders the Projects property card with default projects, use parent note toggle, and autosuggest settings
 */
function renderProjectsPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	// Create a wrapper for the card so we can re-render it
	const cardWrapper = container.createDiv();
	let isCollapsed = true;

	function renderCard(): void {
		cardWrapper.empty();

		const propertyKeyInput = createCardInput(
			"text",
			"projects",
			plugin.settings.fieldMapping.projects
		);

		propertyKeyInput.addEventListener("change", () => {
			plugin.settings.fieldMapping.projects = propertyKeyInput.value;
			save();
		});

		// Create nested content for default projects
		const nestedContainer = document.createElement("div");
		nestedContainer.addClass("tasknotes-settings__nested-content");

		// Default projects container
		const selectedDefaultProjectFiles: TAbstractFile[] = [];
		const defaultProjectsContainer = nestedContainer.createDiv("default-projects-container");

		// Initialize selected projects from settings
		if (plugin.settings.taskCreationDefaults.defaultProjects) {
			const projectPaths = splitListPreservingLinksAndQuotes(
				plugin.settings.taskCreationDefaults.defaultProjects
			)
				.map((link) => link.replace(/\[\[|\]\]/g, "").trim())
				.filter((path) => path);

			projectPaths.forEach((path) => {
				const file =
					plugin.app.vault.getAbstractFileByPath(path + ".md") ||
					plugin.app.vault.getAbstractFileByPath(path);
				if (file) {
					selectedDefaultProjectFiles.push(file);
				}
			});
		}

		// Select projects button
		const selectButtonContainer = defaultProjectsContainer.createDiv();
		const selectButton = selectButtonContainer.createEl("button", {
			text: translate("settings.defaults.basicDefaults.defaultProjects.selectButton"),
			cls: "tn-btn tn-btn--ghost",
		});
		selectButton.onclick = () => {
			const modal = new ProjectSelectModal(
				plugin.app,
				plugin,
				(file: TAbstractFile) => {
					if (!selectedDefaultProjectFiles.includes(file)) {
						selectedDefaultProjectFiles.push(file);
						const projectLinks = selectedDefaultProjectFiles
							.map((f) => `[[${f.path.replace(/\.md$/, "")}]]`)
							.join(", ");
						plugin.settings.taskCreationDefaults.defaultProjects = projectLinks;
						save();
						renderDefaultProjectsList(
							projectsListContainer,
							plugin,
							save,
							selectedDefaultProjectFiles,
							translate
						);
					}
				}
			);
			modal.open();
		};

		// Projects list
		const projectsListContainer = defaultProjectsContainer.createDiv("default-projects-list-container");
		renderDefaultProjectsList(projectsListContainer, plugin, save, selectedDefaultProjectFiles, translate);

		// Use parent note as project toggle
		const useParentNoteToggle = createCardToggle(
			plugin.settings.taskCreationDefaults.useParentNoteAsProject,
			(value) => {
				plugin.settings.taskCreationDefaults.useParentNoteAsProject = value;
				save();
			}
		);

		const nlpRows = createNLPTriggerRows(plugin, "projects", "+", save, translate);

		// Create autosuggest settings section
		const autosuggestSection = document.createElement("div");
		autosuggestSection.addClass("tasknotes-settings__nested-content");
		renderProjectAutosuggestSettings(autosuggestSection, plugin, save, translate, renderCard);

		const rows: CardRow[] = [
			{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
			{ label: translate("settings.taskProperties.projectsCard.defaultProjects"), input: nestedContainer, fullWidth: true },
			{ label: translate("settings.taskProperties.projectsCard.useParentNote"), input: useParentNoteToggle },
			...nlpRows,
			{ label: "", input: autosuggestSection, fullWidth: true },
		];

		createCard(cardWrapper, {
			id: "property-projects",
			collapsible: true,
			defaultCollapsed: isCollapsed,
			onCollapseChange: (collapsed) => {
				isCollapsed = collapsed;
			},
			header: {
				primaryText: translate("settings.taskProperties.properties.projects.name"),
				secondaryText: plugin.settings.fieldMapping.projects,
			},
			content: {
				sections: [{ rows }],
			},
		});
	}

	renderCard();
}

/**
 * Renders the project autosuggest settings inside the projects card
 */
function renderProjectAutosuggestSettings(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
	onRerender?: () => void
): void {
	container.empty();

	// Ensure projectAutosuggest exists
	if (!plugin.settings.projectAutosuggest) {
		plugin.settings.projectAutosuggest = {
			enableFuzzy: false,
			rows: [],
			showAdvanced: false,
			requiredTags: [],
			includeFolders: [],
			propertyKey: "",
			propertyValue: "",
		};
	}

	// Helper to check if any filters are active
	const hasActiveFilters = () => {
		const config = plugin.settings.projectAutosuggest;
		if (!config) return false;
		return (
			(config.requiredTags && config.requiredTags.length > 0) ||
			(config.includeFolders && config.includeFolders.length > 0) ||
			(config.propertyKey && config.propertyKey.trim() !== "")
		);
	};

	// ===== AUTOSUGGEST FILTERS SECTION =====
	const filterSectionWrapper = container.createDiv("tasknotes-settings__collapsible-section");
	filterSectionWrapper.addClass("tasknotes-settings__collapsible-section--collapsed");

	const filterHeader = filterSectionWrapper.createDiv("tasknotes-settings__collapsible-section-header");
	const filterHeaderLeft = filterHeader.createDiv("tasknotes-settings__collapsible-section-header-left");

	filterHeaderLeft.createSpan({
		text: translate("settings.taskProperties.projectsCard.autosuggestFilters"),
		cls: "tasknotes-settings__collapsible-section-title",
	});

	// Add "Filters On" badge if filters are active
	const filterBadge = filterHeaderLeft.createSpan("tasknotes-settings__filter-badge");
	const updateFilterBadge = () => {
		if (hasActiveFilters()) {
			filterBadge.style.display = "inline-flex";
			filterBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg><span>${translate("settings.taskProperties.projectsCard.filtersOn")}</span>`;
		} else {
			filterBadge.style.display = "none";
		}
	};
	updateFilterBadge();

	const filterChevron = filterHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	filterChevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const filterContent = filterSectionWrapper.createDiv("tasknotes-settings__collapsible-section-content");

	createFilterSettingsInputs(
		filterContent,
		{
			requiredTags: plugin.settings.projectAutosuggest.requiredTags,
			includeFolders: plugin.settings.projectAutosuggest.includeFolders,
			propertyKey: plugin.settings.projectAutosuggest.propertyKey,
			propertyValue: plugin.settings.projectAutosuggest.propertyValue,
		},
		(updated) => {
			plugin.settings.projectAutosuggest!.requiredTags = updated.requiredTags;
			plugin.settings.projectAutosuggest!.includeFolders = updated.includeFolders;
			plugin.settings.projectAutosuggest!.propertyKey = updated.propertyKey;
			plugin.settings.projectAutosuggest!.propertyValue = updated.propertyValue;
			updateFilterBadge();
			save();
		},
		translate
	);

	filterHeader.addEventListener("click", () => {
		filterSectionWrapper.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!filterSectionWrapper.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});

	// ===== CUSTOMIZE DISPLAY SECTION =====
	const displaySectionWrapper = container.createDiv("tasknotes-settings__collapsible-section");
	displaySectionWrapper.addClass("tasknotes-settings__collapsible-section--collapsed");

	const displayHeader = displaySectionWrapper.createDiv("tasknotes-settings__collapsible-section-header");
	const displayHeaderLeft = displayHeader.createDiv("tasknotes-settings__collapsible-section-header-left");

	displayHeaderLeft.createSpan({
		text: translate("settings.taskProperties.projectsCard.customizeDisplay"),
		cls: "tasknotes-settings__collapsible-section-title",
	});

	const displayChevron = displayHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	displayChevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const displayContent = displaySectionWrapper.createDiv("tasknotes-settings__collapsible-section-content");

	// Fuzzy matching toggle
	const fuzzyRow = displayContent.createDiv("tasknotes-settings__card-config-row");
	fuzzyRow.createSpan({
		text: translate("settings.appearance.projectAutosuggest.enableFuzzyMatching.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const fuzzyToggle = createCardToggle(
		plugin.settings.projectAutosuggest.enableFuzzy,
		(value) => {
			plugin.settings.projectAutosuggest!.enableFuzzy = value;
			save();
		}
	);
	fuzzyRow.appendChild(fuzzyToggle);

	// Display rows help text
	displayContent.createDiv({
		text: translate("settings.appearance.projectAutosuggest.displayRowsHelp"),
		cls: "setting-item-description",
	});

	// Display row inputs
	const getRows = (): string[] => (plugin.settings.projectAutosuggest?.rows ?? []).slice(0, 3);

	const setRow = (idx: number, value: string) => {
		if (!plugin.settings.projectAutosuggest) return;
		const current = plugin.settings.projectAutosuggest.rows ?? [];
		const next = [...current];
		next[idx] = value;
		plugin.settings.projectAutosuggest.rows = next.slice(0, 3);
		save();
	};

	// Row 1
	const row1Container = displayContent.createDiv("tasknotes-settings__card-config-row");
	row1Container.createSpan({
		text: translate("settings.appearance.projectAutosuggest.displayRows.row1.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const row1Input = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.displayRows.row1.placeholder"),
		getRows()[0] || ""
	);
	row1Input.addEventListener("change", () => setRow(0, row1Input.value));
	row1Container.appendChild(row1Input);

	// Row 2
	const row2Container = displayContent.createDiv("tasknotes-settings__card-config-row");
	row2Container.createSpan({
		text: translate("settings.appearance.projectAutosuggest.displayRows.row2.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const row2Input = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.displayRows.row2.placeholder"),
		getRows()[1] || ""
	);
	row2Input.addEventListener("change", () => setRow(1, row2Input.value));
	row2Container.appendChild(row2Input);

	// Row 3
	const row3Container = displayContent.createDiv("tasknotes-settings__card-config-row");
	row3Container.createSpan({
		text: translate("settings.appearance.projectAutosuggest.displayRows.row3.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const row3Input = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.displayRows.row3.placeholder"),
		getRows()[2] || ""
	);
	row3Input.addEventListener("change", () => setRow(2, row3Input.value));
	row3Container.appendChild(row3Input);

	// Quick reference help section
	const helpContainer = displayContent.createDiv("tasknotes-settings__help-section");
	helpContainer.createEl("h4", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.header"),
	});
	const helpList = helpContainer.createEl("ul");
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.properties"),
	});
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.labels"),
	});
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.searchable"),
	});
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.staticText"),
	});
	helpContainer.createEl("p", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.alwaysSearchable"),
		cls: "settings-help-note",
	});

	displayHeader.addEventListener("click", () => {
		displaySectionWrapper.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!displaySectionWrapper.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});
}

/**
 * Renders the Tags property card (special - uses native Obsidian tags, no property key)
 */
function renderTagsPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const defaultInput = createCardInput(
		"text",
		translate("settings.defaults.basicDefaults.defaultTags.placeholder"),
		plugin.settings.taskCreationDefaults.defaultTags
	);

	defaultInput.addEventListener("change", () => {
		plugin.settings.taskCreationDefaults.defaultTags = defaultInput.value;
		save();
	});

	const nlpRows = createNLPTriggerRows(plugin, "tags", "#", save, translate);

	const rows: CardRow[] = [
		{ label: translate("settings.taskProperties.propertyCard.default"), input: defaultInput },
		...nlpRows,
	];

	createCard(container, {
		id: "property-tags",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate("settings.taskProperties.properties.tags.name"),
			secondaryText: translate("settings.taskProperties.tagsCard.nativeObsidianTags"),
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Renders the Reminders property card with nested default reminders
 */
function renderRemindersPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
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

	const rows: CardRow[] = [
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
 * Renders a simple property card (property key + optional default + optional NLP trigger)
 */
interface SimplePropertyCardConfig {
	propertyId: keyof FieldMapping;
	displayName: string;
	description?: string;
	hasDefault?: boolean;
	defaultType?: "text" | "number" | "dropdown" | "date-preset";
	defaultPlaceholder?: string;
	defaultOptions?: Array<{ value: string; label: string }>;
	getDefaultValue?: () => string;
	setDefaultValue?: (value: string) => void;
	hasNLPTrigger?: boolean;
	nlpDefaultTrigger?: string;
}

function renderSimplePropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
	config: SimplePropertyCardConfig
): void {
	const propertyKeyInput = createCardInput(
		"text",
		config.propertyId,
		plugin.settings.fieldMapping[config.propertyId]
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping[config.propertyId] = propertyKeyInput.value;
		save();
	});

	const rows: CardRow[] = [
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
	];

	// Add default value input if configured
	if (config.hasDefault && config.getDefaultValue && config.setDefaultValue) {
		let defaultInput: HTMLElement;

		if (config.defaultType === "dropdown" || config.defaultType === "date-preset") {
			defaultInput = createCardSelect(config.defaultOptions || [], config.getDefaultValue());
			(defaultInput as HTMLSelectElement).addEventListener("change", () => {
				config.setDefaultValue!((defaultInput as HTMLSelectElement).value);
			});
		} else if (config.defaultType === "number") {
			defaultInput = createCardNumberInput(0, undefined, 1, parseInt(config.getDefaultValue()) || 0);
			defaultInput.addEventListener("change", () => {
				config.setDefaultValue!((defaultInput as HTMLInputElement).value);
			});
		} else {
			defaultInput = createCardInput("text", config.defaultPlaceholder || "", config.getDefaultValue());
			defaultInput.addEventListener("change", () => {
				config.setDefaultValue!((defaultInput as HTMLInputElement).value);
			});
		}

		rows.push({
			label: translate("settings.taskProperties.propertyCard.default"),
			input: defaultInput,
		});
	}

	// Add NLP trigger if configured
	if (config.hasNLPTrigger && config.nlpDefaultTrigger) {
		const nlpRows = createNLPTriggerRows(
			plugin,
			config.propertyId,
			config.nlpDefaultTrigger,
			save,
			translate
		);
		rows.push(...nlpRows);
	}

	createCard(container, {
		id: `property-${config.propertyId}`,
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: config.displayName,
			secondaryText: plugin.settings.fieldMapping[config.propertyId],
		},
		content: {
			sections: [{ rows }],
		},
	});
}

/**
 * Renders a metadata-only property card (just property key)
 */
function renderMetadataPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
	propertyId: keyof FieldMapping,
	displayName: string,
	description?: string
): void {
	const propertyKeyInput = createCardInput(
		"text",
		propertyId,
		plugin.settings.fieldMapping[propertyId]
	);

	propertyKeyInput.addEventListener("change", () => {
		plugin.settings.fieldMapping[propertyId] = propertyKeyInput.value;
		save();
	});

	createCard(container, {
		id: `property-${propertyId}`,
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: displayName,
			secondaryText: plugin.settings.fieldMapping[propertyId],
		},
		content: {
			sections: [{
				rows: [
					{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
				],
			}],
		},
	});
}

/**
 * Renders the list of status value cards
 */
function renderStatusList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
	onStatusesChanged?: () => void
): void {
	container.empty();

	if (!plugin.settings.customStatuses || plugin.settings.customStatuses.length === 0) {
		showCardEmptyState(
			container,
			translate("settings.taskProperties.taskStatuses.emptyState")
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

		const updateDelayInputVisibility = () => {
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
					renderStatusList(container, plugin, save, translate, onStatusesChanged);
					if (onStatusesChanged) onStatusesChanged();
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
								label: translate("settings.taskProperties.taskStatuses.fields.value"),
								input: valueInput,
							},
							{
								label: translate("settings.taskProperties.taskStatuses.fields.label"),
								input: labelInput,
							},
							{
								label: translate("settings.taskProperties.taskStatuses.fields.color"),
								input: colorInput,
							},
							{
								label: translate("settings.taskProperties.taskStatuses.fields.icon"),
								input: iconInputContainer,
							},
							{
								label: translate("settings.taskProperties.taskStatuses.fields.completed"),
								input: completedToggle,
							},
							{
								label: translate("settings.taskProperties.taskStatuses.fields.autoArchive"),
								input: autoArchiveToggle,
							},
							{
								label: translate("settings.taskProperties.taskStatuses.fields.delayMinutes"),
								input: autoArchiveDelayInput,
							},
						],
					},
				],
			},
		};

		statusCard = createCard(container, cardConfig);
		updateDelayInputVisibility();

		valueInput.addEventListener("change", () => {
			status.value = valueInput.value;
			statusCard.querySelector(".tasknotes-settings__card-primary-text")!.textContent =
				status.value || "untitled";
			save();
			if (onStatusesChanged) onStatusesChanged();
		});

		labelInput.addEventListener("change", () => {
			status.label = labelInput.value;
			statusCard.querySelector(".tasknotes-settings__card-secondary-text")!.textContent =
				status.label || "No label";
			save();
			if (onStatusesChanged) onStatusesChanged();
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
			renderStatusList(container, plugin, save, translate, onStatusesChanged);
		});
	});
}

/**
 * Renders the list of priority value cards
 */
function renderPriorityList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
	onPrioritiesChanged?: () => void
): void {
	container.empty();

	if (!plugin.settings.customPriorities || plugin.settings.customPriorities.length === 0) {
		showCardEmptyState(
			container,
			translate("settings.taskProperties.taskPriorities.emptyState")
		);
		return;
	}

	const sortedPriorities = [...plugin.settings.customPriorities].sort(
		(a, b) => a.weight - b.weight
	);

	sortedPriorities.forEach((priority) => {
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
							plugin.settings.customPriorities
								.sort((a, b) => a.weight - b.weight)
								.forEach((p, i) => {
									p.weight = i;
								});
							save();
							renderPriorityList(container, plugin, save, translate, onPrioritiesChanged);
							if (onPrioritiesChanged) onPrioritiesChanged();
						}
					}, translate("settings.taskProperties.taskPriorities.deleteTooltip")),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate("settings.taskProperties.taskPriorities.fields.value"),
								input: valueInput,
							},
							{
								label: translate("settings.taskProperties.taskPriorities.fields.label"),
								input: labelInput,
							},
							{
								label: translate("settings.taskProperties.taskPriorities.fields.color"),
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
			if (onPrioritiesChanged) onPrioritiesChanged();
		});

		labelInput.addEventListener("change", () => {
			priority.label = labelInput.value;
			card.querySelector(".tasknotes-settings__card-primary-text")!.textContent =
				priority.label || priority.value || "untitled";
			save();
			if (onPrioritiesChanged) onPrioritiesChanged();
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

		setupCardDragAndDrop(card, container, (draggedId, targetId, insertBefore) => {
			const draggedIndex = plugin.settings.customPriorities.findIndex(
				(p) => p.id === draggedId
			);
			const targetIndex = plugin.settings.customPriorities.findIndex(
				(p) => p.id === targetId
			);

			if (draggedIndex === -1 || targetIndex === -1) return;

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

			reorderedPriorities.forEach((p, i) => {
				p.weight = i;
			});

			plugin.settings.customPriorities = reorderedPriorities;
			save();
			renderPriorityList(container, plugin, save, translate, onPrioritiesChanged);
		});
	});
}

/**
 * Renders default projects list
 */
function renderDefaultProjectsList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	selectedFiles: TAbstractFile[],
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	container.empty();

	if (selectedFiles.length === 0) {
		container.createDiv({
			text: translate("settings.taskProperties.projectsCard.noDefaultProjects"),
			cls: "setting-item-description",
		});
		return;
	}

	selectedFiles.forEach((file) => {
		const projectItem = container.createDiv("tasknotes-settings__project-item");
		projectItem.createSpan({ text: file.name.replace(/\.md$/, "") });

		const removeButton = projectItem.createEl("button", {
			cls: "tasknotes-settings__card-header-btn tasknotes-settings__card-header-btn--delete",
		});
		removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
		removeButton.title = translate("settings.defaults.basicDefaults.defaultProjects.removeTooltip", { name: file.name });
		removeButton.onclick = () => {
			const index = selectedFiles.indexOf(file);
			if (index > -1) {
				selectedFiles.splice(index, 1);
				const projectLinks = selectedFiles
					.map((f) => `[[${f.path.replace(/\.md$/, "")}]]`)
					.join(", ");
				plugin.settings.taskCreationDefaults.defaultProjects = projectLinks;
				save();
				renderDefaultProjectsList(container, plugin, save, selectedFiles, translate);
			}
		};
	});
}

/**
 * Renders the list of default reminder cards
 */
function renderRemindersList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
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
			reminder.type = typeSelect.value as any;
			save();
			renderRemindersList(container, plugin, save, translate);
		});
	});
}

function renderRelativeReminderConfig(
	reminder: DefaultReminder,
	updateItem: (updates: Partial<DefaultReminder>) => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
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
		updateItem({ unit: unitSelect.value as any });
	});

	const directionSelect = createCardSelect(
		[
			{ value: "before", label: translate("settings.defaults.reminders.directions.before") },
			{ value: "after", label: translate("settings.defaults.reminders.directions.after") },
		],
		reminder.direction
	);
	directionSelect.addEventListener("change", () => {
		updateItem({ direction: directionSelect.value as any });
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
		updateItem({ relatedTo: relatedToSelect.value as any });
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
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
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
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
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

/**
 * Renders the list of user field cards with NLP triggers
 */
function renderUserFieldsList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
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

			save();
			renderUserFieldsList(container, plugin, save, translate);
		});

		keyInput.addEventListener("change", () => {
			field.key = keyInput.value;
			save();
			renderUserFieldsList(container, plugin, save, translate);
		});

		typeSelect.addEventListener("change", () => {
			field.type = typeSelect.value as any;
			save();
			renderUserFieldsList(container, plugin, save, translate);
		});

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
