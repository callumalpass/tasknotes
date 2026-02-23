import { App, Notice } from "obsidian";
import type TaskNotesPlugin from "../../main";
import type { ModalFieldConfig, FieldGroup, TaskModalFieldsConfig } from "../../types/settings";

/**
 * Check if a modal field config entry corresponds to a person field (creator/assignee).
 * Returns the display name if it is, or null if not.
 */
function getPersonFieldLabel(field: ModalFieldConfig, plugin: TaskNotesPlugin): string | null {
	if (field.fieldType !== "user") return null;
	const userField = plugin.settings.userFields?.find((f: any) => f.id === field.id);
	if (!userField?.key) return null;
	const key = userField.key.toLowerCase().trim().replace(/s$/, "");
	const creatorKey = (plugin.settings.creatorFieldName || "creator").toLowerCase().replace(/s$/, "");
	const assigneeKey = (plugin.settings.assigneeFieldName || "assignee").toLowerCase().replace(/s$/, "");
	if (key === creatorKey) return userField.displayName || "Creator";
	if (key === assigneeKey) return userField.displayName || "Assignees";
	return null;
}
import {
	createCard,
	setupCardDragAndDrop,
	createCardInput,
	createCardSelect,
	createCardToggle
} from "./CardComponent";

/**
 * Creates the field manager UI component for configuring modal fields
 */
export function createFieldManager(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	config: TaskModalFieldsConfig,
	onUpdate: (config: TaskModalFieldsConfig) => void,
	app: App
): void {
	const translate = (key: string, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key as any, params);

	container.empty();
	container.addClass("field-manager");

	// Safety check
	if (!config || !config.groups || !config.fields) {
		container.createDiv({ text: "Error: Invalid field configuration. Please reset to defaults." });
		return;
	}

	// Create tabs for different field groups
	const tabsContainer = container.createDiv({ cls: "field-manager__tabs" });
	const contentContainer = container.createDiv({ cls: "field-manager__content" });

	// Sort groups by order
	const sortedGroups = [...config.groups].sort((a, b) => a.order - b.order);

	// Create tabs
	sortedGroups.forEach((group, index) => {
		const tab = tabsContainer.createDiv({ cls: "field-manager__tab" });
		if (index === 0) {
			tab.addClass("field-manager__tab--active");
		}
		tab.setText(group.displayName);
		tab.onclick = () => {
			// Update active tab
			tabsContainer.querySelectorAll(".field-manager__tab").forEach((t) => {
				t.removeClass("field-manager__tab--active");
			});
			tab.addClass("field-manager__tab--active");

			// Render fields for this group
			renderFieldGroup(contentContainer, group.id, config, plugin, onUpdate, app);
		};
	});

	// Render first group by default
	if (sortedGroups.length > 0) {
		renderFieldGroup(contentContainer, sortedGroups[0].id, config, plugin, onUpdate, app);
	}
}

/**
 * Renders fields for a specific group
 */
function renderFieldGroup(
	container: HTMLElement,
	groupId: FieldGroup,
	config: TaskModalFieldsConfig,
	plugin: TaskNotesPlugin,
	onUpdate: (config: TaskModalFieldsConfig) => void,
	app: App
): void {
	container.empty();

	const translate = (key: string, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key as any, params);

	// Get fields for this group
	const groupFields = config.fields
		.filter((f) => f.group === groupId)
		.sort((a, b) => a.order - b.order);

	if (groupFields.length === 0) {
		const emptyState = container.createDiv({ cls: "field-manager__empty" });
		emptyState.setText("No fields in this group");
		return;
	}

	// Create container for field cards
	const cardsContainer = container.createDiv({ cls: "field-manager__cards" });

	// Render each field as a card
	groupFields.forEach((field, index) => {
		createFieldCard(cardsContainer, field, index, config, plugin, onUpdate, app, groupId);
	});
}

/**
 * Creates a card for a single field using the CardComponent system
 */
function createFieldCard(
	container: HTMLElement,
	field: ModalFieldConfig,
	index: number,
	config: TaskModalFieldsConfig,
	plugin: TaskNotesPlugin,
	onUpdate: (config: TaskModalFieldsConfig) => void,
	app: App,
	groupId: FieldGroup
): void {
	const translate = (key: string, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key as any, params);

	// Create type badge
	const typeBadge = document.createElement("span");
	typeBadge.classList.add("field-card__type");
	typeBadge.classList.add(`field-card__type--${field.fieldType}`);
	typeBadge.textContent = field.fieldType;

	// Create toggle switches with callbacks
	const enabledToggle = createCardToggle(field.enabled, (value) => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].enabled = value;
			if (!value) {
				const label = getPersonFieldLabel(field, plugin);
				if (label) {
					new Notice(`${label} picker will be hidden from task modals. Re-enable here or in Task Properties.`, 8000);
				}
			}
			onUpdate(config);
			// Re-render to update visibility
			const activeTab = document.querySelector(".field-manager__tab--active") as HTMLElement;
			if (activeTab) {
				const tabIndex = Array.from(activeTab.parentElement!.children).indexOf(activeTab);
				const groups = [...config.groups].sort((a, b) => a.order - b.order);
				const groupToRender = groups[tabIndex];
				if (groupToRender) {
					renderFieldGroup(container.parentElement!, groupToRender.id, config, plugin, onUpdate, app);
				}
			}
		}
	});

	const creationToggle = createCardToggle(field.visibleInCreation, (value) => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].visibleInCreation = value;
			if (!value) {
				const label = getPersonFieldLabel(field, plugin);
				if (label) {
					new Notice(`${label} picker will be hidden from the task creation modal.`, 6000);
				}
			}
			onUpdate(config);
		}
	});

	const editToggle = createCardToggle(field.visibleInEdit, (value) => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].visibleInEdit = value;
			if (!value) {
				const label = getPersonFieldLabel(field, plugin);
				if (label) {
					new Notice(`${label} picker will be hidden from the task edit modal.`, 6000);
				}
			}
			onUpdate(config);
		}
	});

	// Create group selector
	const groupSelect = createCardSelect(
		config.groups.map((g) => ({ value: g.id, label: g.displayName })),
		field.group
	);
	groupSelect.onchange = () => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].group = groupSelect.value as FieldGroup;
			onUpdate(config);
			// Re-render to show field in new group
			const activeTab = document.querySelector(".field-manager__tab--active") as HTMLElement;
			if (activeTab) {
				activeTab.click();
			}
		}
	};

	// Determine if this field can be reordered
	// Title and details are in the basic group and cannot be reordered
	const canReorder = field.group !== "basic";

	// Resolve display text for the card header
	let secondaryText = field.id;
	if (field.fieldType === "user") {
		const matchingUserField = plugin.settings.userFields?.find((f: any) => f.id === field.id);
		if (matchingUserField?.key) {
			secondaryText = matchingUserField.key;
		}
	}
	const displayName = field.displayName || (field.fieldType === "user"
		? plugin.settings.userFields?.find((f: any) => f.id === field.id)?.displayName
		: undefined) || field.id;

	// Create the card using CardComponent
	const card = createCard(container, {
		id: field.id,
		draggable: canReorder,
		header: {
			primaryText: displayName,
			secondaryText,
			meta: [typeBadge],
		},
		content: {
			sections: [
				{
					rows: [
						{ label: "Enabled:", input: enabledToggle },
					],
				},
				...(field.enabled
					? [
							{
								rows: [
									{ label: "Show in Creation:", input: creationToggle },
									{ label: "Show in Edit:", input: editToggle },
									{ label: "Group:", input: groupSelect, fullWidth: true },
								],
							},
					  ]
					: []),
			],
		},
	});

	// Setup drag and drop for reordering (only for fields that can be reordered)
	if (canReorder) {
		setupCardDragAndDrop(card, container, (draggedId: string, targetId: string, insertBefore: boolean) => {
			const draggedIndex = config.fields.findIndex((f) => f.id === draggedId && f.group === groupId);
			const targetIndex = config.fields.findIndex((f) => f.id === targetId && f.group === groupId);

			if (draggedIndex === -1 || targetIndex === -1) return;

			// Get only fields in this group
			const groupFields = config.fields.filter((f) => f.group === groupId);

			// Find positions within the group
			const draggedGroupIndex = groupFields.findIndex((f) => f.id === draggedId);
			const targetGroupIndex = groupFields.findIndex((f) => f.id === targetId);

			// Reorder within group
			const [movedField] = groupFields.splice(draggedGroupIndex, 1);
			const insertIndex = targetGroupIndex + (insertBefore ? 0 : 1);
			groupFields.splice(insertIndex, 0, movedField);

			// Update order values
			groupFields.forEach((f, i) => {
				const fieldIndex = config.fields.findIndex((cf) => cf.id === f.id);
				if (fieldIndex !== -1) {
					config.fields[fieldIndex].order = i;
				}
			});

			onUpdate(config);
			// Re-render the group
			renderFieldGroup(container, groupId, config, plugin, onUpdate, app);
		});
	}
}

/**
 * Add styles for field manager
 */
export function addFieldManagerStyles(): void {
	const styleId = "field-manager-styles";
	if (document.getElementById(styleId)) return;

	const style = document.createElement("style");
	style.id = styleId;
	style.textContent = `
		.field-manager {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		.field-manager__tabs {
			display: flex;
			gap: 0.5rem;
			border-bottom: 2px solid var(--background-modifier-border);
			padding-bottom: 0.5rem;
		}

		.field-manager__tab {
			padding: 0.5rem 1rem;
			cursor: pointer;
			border-radius: 4px;
			transition: background-color 0.2s;
		}

		.field-manager__tab:hover {
			background-color: var(--background-modifier-hover);
		}

		.field-manager__tab--active {
			background-color: var(--interactive-accent);
			color: var(--text-on-accent);
		}

		.field-manager__content {
			padding: 1rem 0;
		}

		.field-manager__cards {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		.field-manager__empty {
			text-align: center;
			padding: 2rem;
			color: var(--text-muted);
		}

		.field-card__type {
			font-size: 0.75rem;
			padding: 0.125rem 0.5rem;
			border-radius: 3px;
			background: var(--background-modifier-border);
		}

		.field-card__type--core {
			background: var(--interactive-accent);
			color: var(--text-on-accent);
		}

		.field-card__type--user {
			background: var(--color-purple);
			color: white;
		}

		.field-card__type--dependency {
			background: var(--color-orange);
			color: white;
		}

		.field-card__type--organization {
			background: var(--color-green);
			color: white;
		}
	`;

	document.head.appendChild(style);
}
