import { uiText } from "../../../i18n/runtime";
import { configLabel } from "../../../i18n/configLabels";
import { uiData } from "../../../i18n/dataText";
import { msg } from "@lingui/core/macro";
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Settings controls are created synchronously before handlers access them. */
import { Notice, setIcon } from "obsidian";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	setupCardDragAndDrop,
	createDeleteHeaderButton,
	showCardEmptyState,
	createCardSelect,
	createThemeColorInput,
	readThemeColorInput,
	CardRow,
} from "../../components/CardComponent";
import { createIconInput } from "../../components/IconSuggest";
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
		uiData("priority", "Editable frontmatter property identifier; must remain compatible with existing YAML"),
		plugin.settings.fieldMapping.priority
	);

	// Validate defaultTaskPriority - if it doesn't exist in customPriorities (and isn't empty), reset to empty
	const validPriorityValues = plugin.settings.customPriorities.map((p) => p.value);
	if (
		plugin.settings.defaultTaskPriority !== "" &&
		!validPriorityValues.includes(plugin.settings.defaultTaskPriority)
	) {
		plugin.settings.defaultTaskPriority =
			validPriorityValues.length > 0 ? validPriorityValues[0] : "";
		save();
	}

	const defaultSelect = createCardSelect(
		[
			{ value: "", label: translate(msg({ message: "No default", context: "settings.defaults.options.noDefault" })) },
			...plugin.settings.customPriorities.map((priority) => ({
				value: priority.value,
				label: configLabel(priority) || priority.value,
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
	const nestedContainer = activeWindow.createDiv();
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Create collapsible section for priority values
	const priorityValuesSection = nestedContainer.createDiv(
		"tasknotes-settings__collapsible-section"
	);

	const priorityValuesHeader = priorityValuesSection.createDiv(
		"tasknotes-settings__collapsible-section-header"
	);
	priorityValuesHeader.createSpan({
		text: translate(msg({ message: "Priority values", context: "settings.taskProperties.priorityCard.valuesHeader" })),
		cls: "tasknotes-settings__collapsible-section-title",
	});
	const chevron = priorityValuesHeader.createSpan(
		"tasknotes-settings__collapsible-section-chevron"
	);
	setIcon(chevron, "chevron-down");

	const priorityValuesContent = priorityValuesSection.createDiv(
		"tasknotes-settings__collapsible-section-content"
	);

	// Help text explaining how priorities work
	const priorityHelpContainer = priorityValuesContent.createDiv(
		"tasknotes-settings__help-section"
	);
	priorityHelpContainer.createEl("h4", {
		text: translate(msg({ message: "How priorities work:", context: "settings.taskProperties.taskPriorities.howTheyWork.title" })),
	});
	const priorityHelpList = priorityHelpContainer.createEl("ul");
	priorityHelpList.createEl("li", {
		text: translate(msg({ message: "Value: The internal identifier stored in your task files. Use prefixes like \"1-urgent\", \"2-high\" to control sort order in Bases views.", context: "settings.taskProperties.taskPriorities.howTheyWork.value" })),
	});
	priorityHelpList.createEl("li", {
		text: translate(msg({ message: "Display Label: The display name shown in the interface (e.g., \"High Priority\")", context: "settings.taskProperties.taskPriorities.howTheyWork.label" })),
	});
	priorityHelpList.createEl("li", {
		text: translate(msg({ message: "Color: Visual indicator color for the priority dot and badges", context: "settings.taskProperties.taskPriorities.howTheyWork.color" })),
	});
	priorityHelpList.createEl("li", {
		text: translate(msg({ message: "Icon: optional icon to show on task cards instead of the priority dot", context: "settings.taskProperties.taskPriorities.howTheyWork.icon" })),
	});

	// Render priority value cards
	const priorityListContainer = priorityValuesContent.createDiv("tasknotes-priorities-container");
	renderPriorityList(priorityListContainer, plugin, save, translate, () => {
		// Re-render the default select when priorities change
		defaultSelect.empty();
		const noDefaultOption = defaultSelect.createEl("option", {
			value: "",
			text: translate(msg({ message: "No default", context: "settings.defaults.options.noDefault" })),
		});
		if (plugin.settings.defaultTaskPriority === "") {
			noDefaultOption.selected = true;
		}
		plugin.settings.customPriorities.forEach((priority) => {
			const option = defaultSelect.createEl("option", {
				value: priority.value,
				text: configLabel(priority) || priority.value,
			});
			if (priority.value === plugin.settings.defaultTaskPriority) {
				option.selected = true;
			}
		});
	});

	// Add priority button
	const addPriorityButton = priorityValuesContent.createEl("button", {
		text: translate(msg({ message: "Add priority", context: "settings.taskProperties.taskPriorities.addNew.buttonText" })),
		cls: "tn-btn tn-btn--ghost",
	});
	addPriorityButton.classList.remove(
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
	addPriorityButton.classList.add("tn-static-margin-top-0-5rem-3dc98b5e");
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
				text: translate(msg({ message: "No default", context: "settings.defaults.options.noDefault" })),
			});
			if (plugin.settings.defaultTaskPriority === "") {
				noDefaultOption.selected = true;
			}
			plugin.settings.customPriorities.forEach((priority) => {
				const option = defaultSelect.createEl("option", {
					value: priority.value,
					text: configLabel(priority) || priority.value,
				});
				if (priority.value === plugin.settings.defaultTaskPriority) {
					option.selected = true;
				}
			});
		});
	};

	// Toggle collapse
	priorityValuesHeader.addEventListener("click", () => {
		priorityValuesSection.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!priorityValuesSection.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});

	const nlpRows = createNLPTriggerRows(plugin, "priority", "!", save, translate);

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate(msg({ message: "Indicates task importance. Used for sorting and filtering. Values are sorted alphabetically in Bases views, so use prefixes like 1-, 2- to control order.", context: "settings.taskProperties.properties.priority.description" }))
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
		{
			label: translate(msg({ message: "Property key:", context: "settings.taskProperties.propertyCard.propertyKey" })),
			input: propertyKeyInput,
		},
		{ label: translate(msg({ message: "Default:", context: "settings.taskProperties.propertyCard.default" })), input: defaultSelect },
		...nlpRows,
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-priority",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate(msg({ message: "Priority", context: "settings.taskProperties.properties.priority.name" })),
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
			translate(msg({ message: "No custom priorities configured. Add a priority to get started.", context: "settings.taskProperties.taskPriorities.emptyState" }))
		);
		return;
	}

	const sortedPriorities = [...plugin.settings.customPriorities].sort(
		(a, b) => a.weight - b.weight
	);

	sortedPriorities.forEach((priority) => {
		const valueInput = createCardInput(
			"text",
			uiData("high", "Example persisted priority identifier; translating it must not change YAML/NLP values"),
			priority.value
		);
		const labelInput = createCardInput(
			"text",
			translate(msg({ message: "High priority", context: "settings.taskProperties.taskPriorities.placeholders.label" })),
			configLabel(priority)
		);
		const colorInput = createThemeColorInput(priority.color);
		const { container: iconInputContainer, input: iconInput } = createIconInput(
			plugin.app,
			uiData("alert-circle", "Lucide icon identifier; must remain an exact icon lookup key in every locale"),
			priority.icon || ""
		);

		const card = createCard(container, {
			id: priority.id,
			draggable: true,
			collapsible: true,
			defaultCollapsed: true,
			colorIndicator: { color: priority.color },
			header: {
				primaryText: configLabel(priority) || priority.value || uiText(msg({ message: "Untitled", context: "untitled custom status or priority heading" })),
				actions: [
					createDeleteHeaderButton(() => {
						if (plugin.settings.customPriorities.length <= 1) {
							new Notice(
								translate(msg({ message: "You must have at least one priority", context: "settings.taskProperties.taskPriorities.deleteConfirm" }))
							);
							return;
						}
						const priorityIndex = plugin.settings.customPriorities.findIndex(
							(p) => p.id === priority.id
						);
						if (priorityIndex !== -1) {
							// Check if we're deleting the default priority
							const wasDefault =
								plugin.settings.defaultTaskPriority === priority.value;

							plugin.settings.customPriorities.splice(priorityIndex, 1);
							plugin.settings.customPriorities
								.sort((a, b) => a.weight - b.weight)
								.forEach((p, i) => {
									p.weight = i;
								});

							// If deleted priority was the default, update to first available or empty
							if (wasDefault) {
								plugin.settings.defaultTaskPriority =
									plugin.settings.customPriorities.length > 0
										? plugin.settings.customPriorities[0].value
										: "";
							}

							save();
							renderPriorityList(
								container,
								plugin,
								save,
								translate,
								onPrioritiesChanged
							);
							if (onPrioritiesChanged) onPrioritiesChanged();
						}
					}, translate(msg({ message: "Delete priority", context: "settings.taskProperties.taskPriorities.deleteTooltip" }))),
				],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									msg({ message: "Value:", context: "settings.taskProperties.taskPriorities.fields.value" })
								),
								input: valueInput,
							},
							{
								label: translate(
									msg({ message: "Label:", context: "settings.taskProperties.taskPriorities.fields.label" })
								),
								input: labelInput,
							},
							{
								label: translate(
									msg({ message: "Color:", context: "settings.taskProperties.taskPriorities.fields.color" })
								),
								input: colorInput,
							},
							{
								label: translate(
									msg({ message: "Icon:", context: "settings.taskProperties.taskPriorities.fields.icon" })
								),
								input: iconInputContainer,
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
				configLabel(priority) || priority.value || uiText(msg({ message: "Untitled", context: "untitled custom status or priority heading" }));
			save();
			if (onPrioritiesChanged) onPrioritiesChanged();
		});

		colorInput.addEventListener("change", () => {
			priority.color = readThemeColorInput(colorInput, priority.color || "#6366f1");
			const colorIndicator = card.querySelector(
				".tasknotes-settings__card-color-indicator"
			) as HTMLElement;
			if (colorIndicator) {
				colorIndicator.style.backgroundColor = priority.color;
			}
			save();
		});

		iconInput.addEventListener("change", () => {
			priority.icon = iconInput.value.trim() || undefined;
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
			const draggedPriorityIndex = reorderedPriorities.findIndex((p) => p.id === draggedId);
			const targetPriorityIndex = reorderedPriorities.findIndex((p) => p.id === targetId);

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

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the priority settings renderer. */
