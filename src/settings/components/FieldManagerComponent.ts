import { App } from "obsidian";
import type TaskNotesPlugin from "../../main";
import type {
	ModalFieldConfig,
	FieldGroup,
	TaskModalFieldsConfig,
	UserMappedField,
} from "../../types/settings";
import {
	createCard,
	setupCardDragAndDrop,
	createCardSelect,
	createCardToggle,
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
	container.empty();
	container.addClass("field-manager");

	// Safety check
	if (!config || !config.groups || !config.fields) {
		container.createDiv({
			text: "Error: Invalid field configuration. Please reset to defaults.",
		});
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
	// Create type badge
	const typeBadge = activeWindow.createSpan();
	typeBadge.classList.add("field-card__type");
	typeBadge.classList.add(`field-card__type--${field.fieldType}`);
	typeBadge.textContent = field.fieldType;

	// Create toggle switches with callbacks
	const enabledToggle = createCardToggle(field.enabled, (value) => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].enabled = value;
			onUpdate(config);
			// Re-render to update visibility
			const activeTab = activeDocument.querySelector(
				".field-manager__tab--active"
			) as HTMLElement;
			if (activeTab) {
				const tabParent = activeTab.parentElement;
				const contentParent = container.parentElement;
				if (!tabParent || !contentParent) {
					return;
				}
				const tabIndex = Array.from(tabParent.children).indexOf(activeTab);
				const groups = [...config.groups].sort((a, b) => a.order - b.order);
				const groupToRender = groups[tabIndex];
				if (groupToRender) {
					renderFieldGroup(
						contentParent,
						groupToRender.id,
						config,
						plugin,
						onUpdate,
						app
					);
				}
			}
		}
	});

	const creationToggle = createCardToggle(field.visibleInCreation, (value) => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].visibleInCreation = value;
			onUpdate(config);
		}
	});

	const editToggle = createCardToggle(field.visibleInEdit, (value) => {
		const fieldIndex = config.fields.findIndex((f) => f.id === field.id);
		if (fieldIndex !== -1) {
			config.fields[fieldIndex].visibleInEdit = value;
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
			const activeTab = activeDocument.querySelector(
				".field-manager__tab--active"
			) as HTMLElement;
			if (activeTab) {
				activeTab.click();
			}
		}
	};

	// Determine if this field can be reordered
	// Title and details are in the basic group and cannot be reordered
	const canReorder = field.group !== "basic";

	// Create the card using CardComponent
	const card = createCard(container, {
		id: field.id,
		draggable: canReorder,
		header: {
			primaryText: field.displayName,
			secondaryText: getFieldSecondaryText(field, plugin.settings.userFields),
			meta: [typeBadge],
		},
		content: {
			sections: [
				{
					rows: [{ label: "Enabled:", input: enabledToggle }],
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
		setupCardDragAndDrop(
			card,
			container,
			(draggedId: string, targetId: string, insertBefore: boolean) => {
				const draggedIndex = config.fields.findIndex(
					(f) => f.id === draggedId && f.group === groupId
				);
				const targetIndex = config.fields.findIndex(
					(f) => f.id === targetId && f.group === groupId
				);

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
			}
		);
	}
}

function getFieldSecondaryText(
	field: ModalFieldConfig,
	userFields: UserMappedField[] | undefined
): string {
	if (field.fieldType !== "user") {
		return `ID: ${field.id}`;
	}

	const userField = userFields?.find((candidate) => candidate.id === field.id);
	return userField?.key ? `Key: ${userField.key}` : "No key set";
}
