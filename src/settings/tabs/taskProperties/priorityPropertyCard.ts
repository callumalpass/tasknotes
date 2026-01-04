/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Notice } from "obsidian";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	setupCardDragAndDrop,
	createDeleteHeaderButton,
	showCardEmptyState,
	createCardSelect,
	CardRow,
} from "../../components/CardComponent";
import { createNLPTriggerRows, createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Priority property card with nested priority value cards
 */
export function renderPriorityPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
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

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate("settings.taskProperties.properties.priority.description")
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
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
 * Renders the list of priority value cards
 */
function renderPriorityList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
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

		valueInput.addEventListener("input", () => {
			priority.value = valueInput.value;
			save();
			if (onPrioritiesChanged) onPrioritiesChanged();
		});

		labelInput.addEventListener("input", () => {
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
