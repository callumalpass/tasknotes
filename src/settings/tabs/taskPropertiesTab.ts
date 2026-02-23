import { Notice, Setting } from "obsidian";
import TaskNotesPlugin from "../../main";
import type { TranslationKey } from "../../i18n";
import type { UserMappedField } from "../../types/settings";
import {
	createSectionHeader,
	createHelpText,
	configureToggleSetting,
} from "../components/settingHelpers";
import {
	createCard,
	createCardInput,
	createCardToggle,
	createCardSelect,
	createStatusBadge,
	createDeleteHeaderButton,
	CardRow,
} from "../components/CardComponent";
import { initializeFieldConfig } from "../../utils/fieldConfigDefaults";
import { migratePropertyName } from "../../utils/settingsMigration";

// Import property card modules
import {
	renderTitlePropertyCard,
	renderStatusPropertyCard,
	renderPriorityPropertyCard,
	renderProjectsPropertyCard,
	renderTagsPropertyCard,
	renderRemindersPropertyCard,
	renderDatePropertiesReference,
	renderUserFieldsSection,
	renderSimplePropertyCard,
	renderMetadataPropertyCard,
} from "./taskProperties";

/**
 * Check if the creator User Field exists in settings
 */
function getCreatorUserField(plugin: TaskNotesPlugin): UserMappedField | undefined {
	const fieldKey = plugin.settings.creatorFieldName || "creator";
	return plugin.settings.userFields?.find((f) => f.key === fieldKey);
}

/**
 * Check if the assignee User Field exists in settings
 */
function getAssigneeUserField(plugin: TaskNotesPlugin): UserMappedField | undefined {
	const fieldKey = plugin.settings.assigneeFieldName || "assignee";
	return plugin.settings.userFields?.find((f) => f.key === fieldKey);
}

/**
 * Auto-create the creator User Field with person notes filter pre-configured
 */
function createCreatorUserField(
	plugin: TaskNotesPlugin,
	save: () => void,
	rerender: () => void
): void {
	const fieldKey = plugin.settings.creatorFieldName || "creator";

	if (getCreatorUserField(plugin)) {
		new Notice("Creator field already exists");
		return;
	}

	const newField: UserMappedField = {
		id: `creator-${Date.now()}`,
		displayName: "Creator",
		key: fieldKey,
		type: "text",
		autosuggestFilter: {
			includeFolders: plugin.settings.personNotesFolder
				? [plugin.settings.personNotesFolder.replace(/\/$/, "")]
				: [],
			requiredTags: plugin.settings.personNotesTag
				? [plugin.settings.personNotesTag]
				: [],
		},
	};

	plugin.settings.userFields = [...(plugin.settings.userFields || []), newField];

	// Also add to modal fields config so it appears in task modals
	addFieldToModalConfig(plugin, newField.id);

	save();
	new Notice("Creator field created");
	rerender();
}

/**
 * Auto-create the assignee User Field with person notes filter pre-configured
 */
function createAssigneeUserField(
	plugin: TaskNotesPlugin,
	save: () => void,
	rerender: () => void
): void {
	const fieldKey = plugin.settings.assigneeFieldName || "assignee";

	if (getAssigneeUserField(plugin)) {
		new Notice("Assignees field already exists");
		return;
	}

	const newField: UserMappedField = {
		id: `assignees-${Date.now()}`,
		displayName: "Assignees",
		key: fieldKey,
		type: "list",
		autosuggestFilter: {
			includeFolders: plugin.settings.personNotesFolder
				? [plugin.settings.personNotesFolder.replace(/\/$/, "")]
				: [],
			requiredTags: plugin.settings.personNotesTag
				? [plugin.settings.personNotesTag]
				: [],
		},
	};

	plugin.settings.userFields = [...(plugin.settings.userFields || []), newField];

	// Also add to modal fields config so it appears in task modals
	addFieldToModalConfig(plugin, newField.id);

	save();
	new Notice("Assignees field created");
	rerender();
}

/**
 * Add a new user field to modal fields config
 */
function addFieldToModalConfig(plugin: TaskNotesPlugin, fieldId: string): void {
	if (!plugin.settings.modalFieldsConfig) {
		plugin.settings.modalFieldsConfig = initializeFieldConfig(
			undefined,
			plugin.settings.userFields
		);
	} else {
		const customGroupFields = plugin.settings.modalFieldsConfig.fields.filter(
			(f) => f.group === "custom"
		);
		const maxOrder = customGroupFields.length > 0
			? Math.max(...customGroupFields.map((f) => f.order))
			: -1;

		plugin.settings.modalFieldsConfig.fields.push({
			id: fieldId,
			fieldType: "user",
			group: "custom",
			displayName: "",
			visibleInCreation: true,
			visibleInEdit: true,
			order: maxOrder + 1,
			enabled: true,
		});
	}
}

/**
 * Check modal visibility state for a user field by its ID.
 */
function getFieldModalVisibility(
	plugin: TaskNotesPlugin,
	fieldId: string
): { inConfig: boolean; enabled: boolean; visibleInCreation: boolean; visibleInEdit: boolean } {
	const config = plugin.settings.modalFieldsConfig;
	if (!config) return { inConfig: false, enabled: false, visibleInCreation: false, visibleInEdit: false };

	const fieldConfig = config.fields.find((f) => f.id === fieldId);
	if (!fieldConfig) return { inConfig: false, enabled: false, visibleInCreation: false, visibleInEdit: false };

	return {
		inConfig: true,
		enabled: fieldConfig.enabled,
		visibleInCreation: fieldConfig.visibleInCreation,
		visibleInEdit: fieldConfig.visibleInEdit,
	};
}

/**
 * Fix modal visibility for a field — enable + make visible, or add if missing.
 */
function fixFieldVisibility(
	plugin: TaskNotesPlugin,
	fieldId: string
): void {
	if (!plugin.settings.modalFieldsConfig) return;

	const fieldConfig = plugin.settings.modalFieldsConfig.fields.find((f) => f.id === fieldId);
	if (fieldConfig) {
		fieldConfig.enabled = true;
		fieldConfig.visibleInCreation = true;
		fieldConfig.visibleInEdit = true;
	} else {
		addFieldToModalConfig(plugin, fieldId);
	}
}

/**
 * Render a visibility callout below a Creator/Assignee card when the field
 * exists but is disabled or hidden in the modal fields configuration.
 */
function renderModalVisibilityCallout(
	card: HTMLElement,
	plugin: TaskNotesPlugin,
	fieldId: string,
	fieldLabel: string,
	save: () => void,
	rerender: () => void
): void {
	const vis = getFieldModalVisibility(plugin, fieldId);

	// All good — nothing to show
	if (vis.inConfig && vis.enabled && vis.visibleInCreation && vis.visibleInEdit) return;

	const callout = card.createDiv();

	let message: string;
	let variant: "warning" | "info";
	let buttonText: string;

	if (!vis.inConfig) {
		variant = "warning";
		message = `${fieldLabel} is not in the modal configuration and won't appear in task modals.`;
		buttonText = "Fix";
	} else if (!vis.enabled) {
		variant = "warning";
		message = `${fieldLabel} is disabled in Modal Fields and won't appear in task modals.`;
		buttonText = "Enable";
	} else {
		variant = "info";
		const hidden: string[] = [];
		if (!vis.visibleInCreation) hidden.push("creation");
		if (!vis.visibleInEdit) hidden.push("edit");
		message = `${fieldLabel} is hidden in ${hidden.join(" and ")} modal${hidden.length > 1 ? "s" : ""}.`;
		buttonText = "Show in all modals";
	}

	callout.className = `tn-field-visibility-callout tn-field-visibility-callout--${variant}`;

	const textEl = callout.createSpan();
	textEl.textContent = message;

	const fixBtn = callout.createEl("button", { cls: "tn-field-visibility-callout__btn" });
	fixBtn.textContent = buttonText;
	fixBtn.addEventListener("click", () => {
		fixFieldVisibility(plugin, fieldId);
		save();
		rerender();
	});
}

/**
 * Delete the creator User Field
 */
function deleteCreatorField(
	plugin: TaskNotesPlugin,
	save: () => void,
	rerender: () => void
): void {
	const fieldKey = plugin.settings.creatorFieldName || "creator";
	const fieldIndex = plugin.settings.userFields?.findIndex((f) => f.key === fieldKey) ?? -1;

	if (fieldIndex >= 0) {
		const fieldId = plugin.settings.userFields![fieldIndex].id;

		// Remove from userFields
		plugin.settings.userFields!.splice(fieldIndex, 1);

		// Remove from modalFieldsConfig
		if (plugin.settings.modalFieldsConfig) {
			plugin.settings.modalFieldsConfig.fields =
				plugin.settings.modalFieldsConfig.fields.filter((f) => f.id !== fieldId);
		}

		save();
		new Notice("Creator field removed");
		rerender();
	}
}

/**
 * Delete the assignee User Field
 */
function deleteAssigneeField(
	plugin: TaskNotesPlugin,
	save: () => void,
	rerender: () => void
): void {
	const fieldKey = plugin.settings.assigneeFieldName || "assignee";
	const fieldIndex = plugin.settings.userFields?.findIndex((f) => f.key === fieldKey) ?? -1;

	if (fieldIndex >= 0) {
		const fieldId = plugin.settings.userFields![fieldIndex].id;

		// Remove from userFields
		plugin.settings.userFields!.splice(fieldIndex, 1);

		// Remove from modalFieldsConfig
		if (plugin.settings.modalFieldsConfig) {
			plugin.settings.modalFieldsConfig.fields =
				plugin.settings.modalFieldsConfig.fields.filter((f) => f.id !== fieldId);
		}

		save();
		new Notice("Assignees field removed");
		rerender();
	}
}

/**
 * Navigate to Team & Attribution tab
 */
function navigateToTeamAttribution(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		// Force re-render by clearing target tab
		const tabContent = settingsTab.containerEl.querySelector(
			"#settings-tab-team-attribution"
		) as HTMLElement;
		if (tabContent) {
			tabContent.empty();
		}
		// Click the tab button
		const tabButton = settingsTab.containerEl.querySelector(
			"#tab-button-team-attribution"
		) as HTMLElement;
		if (tabButton) {
			tabButton.click();
			// After tab switch, scroll to the Person notes section (where type values are)
			setTimeout(() => {
				const headings = settingsTab.containerEl.querySelectorAll(".setting-item-heading .setting-item-name");
				for (const heading of headings) {
					if (heading.textContent?.toLowerCase().includes("person notes")) {
						const settingItem = (heading as HTMLElement).closest(".setting-item") as HTMLElement;
						if (settingItem) {
							settingItem.scrollIntoView({ behavior: "smooth", block: "start" });
							settingItem.style.outline = "2px solid var(--text-accent)";
							settingItem.style.borderRadius = "var(--radius-m)";
							setTimeout(() => { settingItem.style.outline = ""; settingItem.style.borderRadius = ""; }, 2000);
						}
						break;
					}
				}
			}, 200);
		}
	}
}

/**
 * Helper to create a description element for card content
 */
function createCardDescription(text: string): HTMLElement {
	const desc = document.createElement("div");
	desc.addClass("tasknotes-settings__card-description");
	desc.textContent = text;
	return desc;
}

/**
 * Render the Note UUID property card - for persistent note identity across renames
 */
function renderNoteUuidPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const propName = plugin.settings.noteUuidPropertyName || "";
	const isEnabled = !!propName.trim();

	// Create description element
	const descriptionEl = createCardDescription(
		"Unique identifier that persists across renames and moves. Used for state tracking."
	);

	// Property key input
	const propertyKeyInput = createCardInput("text", "tnId", propName);
	propertyKeyInput.addEventListener("change", () => {
		const cleaned = propertyKeyInput.value.trim().replace(/\s+/g, "");
		plugin.settings.noteUuidPropertyName = cleaned;

		// Update header badge and secondary text
		const card = container.querySelector('[data-card-id="property-noteUuid"]');
		if (card) {
			const secondaryText = card.querySelector(".tasknotes-settings__card-secondary-text");
			if (secondaryText) {
				secondaryText.textContent = cleaned || "(disabled)";
			}
		}

		save();
	});

	// Auto-generate toggle
	const autoGenToggle = createCardToggle(
		plugin.settings.noteUuidAutoGenerate,
		(value) => {
			plugin.settings.noteUuidAutoGenerate = value;
			save();
		}
	);

	createCard(container, {
		id: "property-noteUuid",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: "Note UUID",
			secondaryText: propName || "(disabled)",
			meta: [createStatusBadge(isEnabled ? "Enabled" : "Disabled", isEnabled ? "default" : "inactive")],
		},
		content: {
			sections: [{
				rows: [
					{ label: "", input: descriptionEl, fullWidth: true },
					{ label: translate("settings.taskProperties.propertyCard.propertyKey" as TranslationKey), input: propertyKeyInput },
					{ label: "Auto-generate for new tasks", input: autoGenToggle },
				],
			}],
		},
	});
}

/**
 * Render the Type property card - for task/person/group identification
 * Controls the frontmatter property name and task type value.
 * Person/group type values are configured in Team & Attribution tab.
 */
function renderTypePropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const propName = plugin.settings.identityTypePropertyName || "type";

	// Create description element
	const descriptionEl = createCardDescription(
		"Frontmatter property used to classify notes as person or group. Person/group type values are configured in Team & Attribution. Task identification uses a separate setting in General."
	);

	// Property name input
	const propertyNameInput = createCardInput("text", "tnType", propName);
	propertyNameInput.addEventListener("change", async () => {
		const cleaned = propertyNameInput.value.trim() || "tnType";
		const oldPropName = plugin.settings.identityTypePropertyName || "tnType";

		if (cleaned !== oldPropName) {
			const result = await migratePropertyName({
				app: plugin.app,
				plugin,
				oldPropertyName: oldPropName,
				newPropertyName: cleaned,
				description: "person and group notes",
			});

			if (result === "cancelled") {
				propertyNameInput.value = oldPropName;
				return;
			}
		}

		plugin.settings.identityTypePropertyName = cleaned;

		// Update header secondary text
		const card = container.querySelector('[data-card-id="property-type"]');
		if (card) {
			const secondaryText = card.querySelector(".tasknotes-settings__card-secondary-text");
			if (secondaryText) {
				secondaryText.textContent = cleaned;
			}
		}

		save();
	});

	// Link to Team & Attribution for person/group values
	const linkEl = document.createElement("div");
	linkEl.style.cssText = "font-size: var(--font-ui-small); color: var(--text-muted); margin-top: var(--size-4-1);";
	const linkText = document.createTextNode("Person and group type values \u2192 ");
	const linkAnchor = document.createElement("a");
	linkAnchor.textContent = "Team & Attribution";
	linkAnchor.style.cssText = "cursor: pointer; color: var(--text-accent);";
	linkAnchor.addEventListener("click", () => navigateToTeamAttribution(plugin));
	linkEl.append(linkText, linkAnchor);

	createCard(container, {
		id: "property-type",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: "Type property",
			secondaryText: propName,
			meta: [createStatusBadge("Enabled", "default")],
		},
		content: {
			sections: [{
				rows: [
					{ label: "", input: descriptionEl, fullWidth: true },
					{ label: "Property name", input: propertyNameInput },
					{ label: "", input: linkEl, fullWidth: true },
				],
			}],
		},
	});
}

/**
 * Convert property values between text and list types across all task files
 */
async function convertPropertyType(
	plugin: TaskNotesPlugin,
	propertyKey: string,
	newType: "text" | "list"
): Promise<void> {
	const taskFolder = plugin.settings.tasksFolder || "";
	const taskFiles = plugin.app.vault.getMarkdownFiles().filter((f) =>
		taskFolder ? f.path.startsWith(taskFolder) : true
	);

	let convertedCount = 0;
	let multiValueWarnings = 0;

	for (const file of taskFiles) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		const currentValue = cache?.frontmatter?.[propertyKey];

		if (currentValue === undefined) continue;

		let newValue: string | string[] | undefined;
		let needsUpdate = false;

		if (newType === "list") {
			// text → list: wrap string in array
			if (typeof currentValue === "string" && currentValue.trim()) {
				newValue = [currentValue];
				needsUpdate = true;
			}
		} else {
			// list → text: take first element
			if (Array.isArray(currentValue)) {
				if (currentValue.length > 1) {
					multiValueWarnings++;
				}
				newValue = currentValue[0] || "";
				needsUpdate = true;
			}
		}

		if (needsUpdate && newValue !== undefined) {
			await plugin.app.fileManager.processFrontMatter(file, (fm) => {
				fm[propertyKey] = newValue;
			});
			convertedCount++;
		}
	}

	// Show summary notice
	if (convertedCount > 0) {
		let message = `Converted ${convertedCount} task${convertedCount === 1 ? "" : "s"} to ${newType} format.`;
		if (multiValueWarnings > 0) {
			message += ` ${multiValueWarnings} had multiple values (kept first only).`;
		}
		new Notice(message);
	} else {
		new Notice(`No tasks needed conversion.`);
	}
}

/**
 * Render the Creator field card - a collapsible property card for team attribution
 */
function renderCreatorFieldCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const fieldKey = plugin.settings.creatorFieldName || "creator";
	const creatorField = getCreatorUserField(plugin);

	// Create description element
	const descriptionEl = createCardDescription(
		translate("settings.teamAttribution.attributionFields.creator.cardDescription" as TranslationKey)
	);

	// Create property key input
	const propertyKeyInput = createCardInput(
		"text",
		"creator",
		fieldKey
	);

	propertyKeyInput.addEventListener("change", async () => {
		const newKey = propertyKeyInput.value.trim() || "creator";
		const oldKey = plugin.settings.creatorFieldName || "creator";

		if (newKey !== oldKey) {
			const taskFolder = plugin.settings.tasksFolder || "";
			const result = await migratePropertyName({
				app: plugin.app,
				plugin,
				oldPropertyName: oldKey,
				newPropertyName: newKey,
				fileFilter: taskFolder ? (f) => f.path.startsWith(taskFolder) : undefined,
				description: "task notes",
			});

			if (result === "cancelled") {
				propertyKeyInput.value = oldKey;
				return;
			}
		}

		plugin.settings.creatorFieldName = newKey;

		// Also update the UserMappedField key if it exists
		if (creatorField) {
			creatorField.key = newKey;
		}

		// Update header secondary text
		const card = container.querySelector('[data-card-id="property-creator"]');
		if (card) {
			const secondaryText = card.querySelector(".tasknotes-settings__card-secondary-text");
			if (secondaryText) {
				secondaryText.textContent = newKey;
			}
		}

		save();
	});

	// Create type dropdown (only shown when field is configured)
	const typeSelect = createCardSelect(
		[
			{ value: "text", label: translate("settings.taskProperties.customUserFields.types.text" as TranslationKey) },
			{ value: "list", label: translate("settings.taskProperties.customUserFields.types.list" as TranslationKey) },
		],
		creatorField?.type || "text"
	);

	typeSelect.addEventListener("change", async () => {
		if (creatorField) {
			const newType = typeSelect.value as "text" | "list";
			const oldType = creatorField.type;

			if (newType !== oldType) {
				// Update the field type
				creatorField.type = newType;
				save();

				// Auto-convert existing task data
				await convertPropertyType(plugin, fieldKey, newType);
			}
		}
	});

	// Create auto-set toggle
	const autoSetToggle = createCardToggle(
		plugin.settings.autoSetCreator,
		(value) => {
			plugin.settings.autoSetCreator = value;
			save();
		}
	);

	// Build rows - show type dropdown only when field is configured
	const rows: CardRow[] = [
		{
			label: "",
			input: descriptionEl,
			fullWidth: true,
		},
		{
			label: translate("settings.taskProperties.propertyCard.propertyKey" as TranslationKey),
			input: propertyKeyInput,
		},
	];

	// Add type dropdown only if field is configured
	if (creatorField) {
		rows.push({
			label: translate("settings.taskProperties.customUserFields.fields.type" as TranslationKey),
			input: typeSelect,
		});
	}

	rows.push({
		label: translate("settings.teamAttribution.autoAttribution.enabled.name" as TranslationKey),
		input: autoSetToggle,
	});

	const creatorCard = createCard(container, {
		id: "property-creator",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: "Creator",
			secondaryText: fieldKey,
			meta: creatorField
				? [createStatusBadge(creatorField.type === "list" ? "List" : "Text", "default")]
				: [createStatusBadge("not configured", "inactive")],
			actions: creatorField
				? [
					createDeleteHeaderButton(
						() => {
							deleteCreatorField(plugin, save, () =>
								renderTaskPropertiesTab(container.parentElement!, plugin, save)
							);
						},
						translate("settings.teamAttribution.deleteField.tooltip" as TranslationKey)
					),
				]
				: [],
		},
		content: {
			sections: [{ rows }],
		},
		actions: !creatorField ? {
			buttons: [{
				text: translate("settings.teamAttribution.autoAttribution.notConfigured.createButton" as TranslationKey),
				variant: "primary",
				onClick: () => {
					createCreatorUserField(plugin, save, () =>
						renderTaskPropertiesTab(container.parentElement!, plugin, save)
					);
				},
			}],
		} : undefined,
	});

	// Show visibility callout if field is configured but hidden in modal fields
	if (creatorField) {
		renderModalVisibilityCallout(
			creatorCard, plugin, creatorField.id, "Creator", save,
			() => renderTaskPropertiesTab(container.parentElement!, plugin, save)
		);
	}
}

/**
 * Render the Assignee field card - a collapsible property card for task assignment
 */
function renderAssigneeFieldCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
	const fieldKey = plugin.settings.assigneeFieldName || "assignee";
	const assigneeField = getAssigneeUserField(plugin);

	// Create description element
	const descriptionEl = createCardDescription(
		translate("settings.teamAttribution.attributionFields.assignee.cardDescription" as TranslationKey)
	);

	// Create property key input
	const propertyKeyInput = createCardInput(
		"text",
		"assignee",
		fieldKey
	);

	propertyKeyInput.addEventListener("change", async () => {
		const newKey = propertyKeyInput.value.trim() || "assignee";
		const oldKey = plugin.settings.assigneeFieldName || "assignee";

		if (newKey !== oldKey) {
			const taskFolder = plugin.settings.tasksFolder || "";
			const result = await migratePropertyName({
				app: plugin.app,
				plugin,
				oldPropertyName: oldKey,
				newPropertyName: newKey,
				fileFilter: taskFolder ? (f) => f.path.startsWith(taskFolder) : undefined,
				description: "task notes",
			});

			if (result === "cancelled") {
				propertyKeyInput.value = oldKey;
				return;
			}
		}

		plugin.settings.assigneeFieldName = newKey;

		// Also update the UserMappedField key if it exists
		if (assigneeField) {
			assigneeField.key = newKey;
		}

		// Update header secondary text
		const card = container.querySelector('[data-card-id="property-assignees"]');
		if (card) {
			const secondaryText = card.querySelector(".tasknotes-settings__card-secondary-text");
			if (secondaryText) {
				secondaryText.textContent = newKey;
			}
		}

		save();
	});

	// Create type dropdown (only shown when field is configured)
	const typeSelect = createCardSelect(
		[
			{ value: "text", label: translate("settings.taskProperties.customUserFields.types.text" as TranslationKey) },
			{ value: "list", label: translate("settings.taskProperties.customUserFields.types.list" as TranslationKey) },
		],
		assigneeField?.type || "list"
	);

	typeSelect.addEventListener("change", async () => {
		if (assigneeField) {
			const newType = typeSelect.value as "text" | "list";
			const oldType = assigneeField.type;

			if (newType !== oldType) {
				// Update the field type
				assigneeField.type = newType;
				save();

				// Auto-convert existing task data
				await convertPropertyType(plugin, fieldKey, newType);
			}
		}
	});

	// Build rows - NO auto-set toggle for assignee (manually assigned)
	const rows: CardRow[] = [
		{
			label: "",
			input: descriptionEl,
			fullWidth: true,
		},
		{
			label: translate("settings.taskProperties.propertyCard.propertyKey" as TranslationKey),
			input: propertyKeyInput,
		},
	];

	// Add type dropdown only if field is configured
	if (assigneeField) {
		rows.push({
			label: translate("settings.taskProperties.customUserFields.fields.type" as TranslationKey),
			input: typeSelect,
		});
	}

	const assigneeCard = createCard(container, {
		id: "property-assignees",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: "Assignees",
			secondaryText: fieldKey,
			meta: assigneeField
				? [createStatusBadge(assigneeField.type === "list" ? "List" : "Text", "default")]
				: [createStatusBadge("not configured", "inactive")],
			actions: assigneeField
				? [
					createDeleteHeaderButton(
						() => {
							deleteAssigneeField(plugin, save, () =>
								renderTaskPropertiesTab(container.parentElement!, plugin, save)
							);
						},
						translate("settings.teamAttribution.deleteField.tooltip" as TranslationKey)
					),
				]
				: [],
		},
		content: {
			sections: [{ rows }],
		},
		actions: !assigneeField ? {
			buttons: [{
				text: "Create field",
				variant: "primary",
				onClick: () => {
					createAssigneeUserField(plugin, save, () =>
						renderTaskPropertiesTab(container.parentElement!, plugin, save)
					);
				},
			}],
		} : undefined,
	});

	// Show visibility callout if field is configured but hidden in modal fields
	if (assigneeField) {
		renderModalVisibilityCallout(
			assigneeCard, plugin, assigneeField.id, "Assignees", save,
			() => renderTaskPropertiesTab(container.parentElement!, plugin, save)
		);
	}
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

	// ===== OVERVIEW CALLOUT =====
	const overviewCallout = container.createDiv({ cls: "tn-task-props-overview" });
	overviewCallout.createEl("p", {
		text: "Tasks store data as frontmatter properties. These settings define the defaults \u2014 which property names TaskNotes uses and what values new tasks start with.",
	});
	const overviewList = overviewCallout.createEl("ul");
	const perTaskItem = overviewList.createEl("li");
	perTaskItem.createEl("strong", { text: "Per-task overrides" });
	perTaskItem.appendText(" \u2014 the \"Properties & anchors\" section in the Edit Task and Bulk Task modals lets you search for any property in your vault and add it to a task. The \"Use as\" menu lets you tell TaskNotes to treat that property as a built-in field (e.g., use \"review_date\" as the due date for this task).");
	const anchorsItem = overviewList.createEl("li");
	anchorsItem.createEl("strong", { text: "Reminder anchors" });
	anchorsItem.appendText(" \u2014 reminders can be timed relative to any date property. The property search bar in the Reminder modal and the Properties & anchors section (under Reminders below) let you find, convert, and manage which date properties are available as anchors.");

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
			plugin.settings.taskCreationDefaults.defaultDueDate = value as "none" | "today" | "tomorrow" | "next-week";
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
			plugin.settings.taskCreationDefaults.defaultScheduledDate = value as "none" | "today" | "tomorrow" | "next-week";
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
			plugin.settings.taskCreationDefaults.defaultRecurrence = value as "none" | "daily" | "weekly" | "monthly" | "yearly";
			save();
		},
	});

	// Recurrence Anchor Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "recurrenceAnchor",
		translate("settings.taskProperties.properties.recurrenceAnchor.name"),
		translate("settings.taskProperties.properties.recurrenceAnchor.description"));

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

	// Skipped Instances Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "skippedInstances",
		translate("settings.taskProperties.properties.skippedInstances.name"),
		translate("settings.taskProperties.properties.skippedInstances.description"));

	// Blocked By Property Card
	renderMetadataPropertyCard(container, plugin, save, translate, "blockedBy",
		translate("settings.taskProperties.properties.blockedBy.name"),
		translate("settings.taskProperties.properties.blockedBy.description"));

	// Note UUID Property Card (special - not in fieldMapping, uses separate settings)
	renderNoteUuidPropertyCard(container, plugin, save, translate);

	// Type Property Card (for task/person/group identification)
	renderTypePropertyCard(container, plugin, save, translate);

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

	// ===== TEAM & ATTRIBUTION PROPERTIES SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.sections.teamAttributionProperties" as TranslationKey));
	createHelpText(container, translate("settings.taskProperties.sections.teamAttributionPropertiesDesc" as TranslationKey));

	// Render Creator field card (special - pulled out of User Fields)
	renderCreatorFieldCard(container, plugin, save, translate);

	// Render Assignee field card
	renderAssigneeFieldCard(container, plugin, save, translate);

	// Link to Team & Attribution tab
	new Setting(container)
		.setName(translate("settings.teamAttribution.teamSettings.name" as TranslationKey))
		.setDesc(translate("settings.teamAttribution.teamSettings.description" as TranslationKey))
		.addButton((btn) => btn
			.setButtonText(translate("settings.teamAttribution.teamSettings.button" as TranslationKey))
			.onClick(() => navigateToTeamAttribution(plugin))
		);

	// ===== CUSTOM USER FIELDS SECTION =====
	createSectionHeader(container, translate("settings.taskProperties.customUserFields.header"));
	createHelpText(container, translate("settings.taskProperties.customUserFields.description"));

	// Render user fields section (includes list + add button)
	renderUserFieldsSection(container, plugin, save, translate);
}
