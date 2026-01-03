/* eslint-disable @typescript-eslint/no-non-null-assertion */
import TaskNotesPlugin from "../../../main";
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
} from "../../components/CardComponent";
import { createIconInput } from "../../components/IconSuggest";
import { createNLPTriggerRows, createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Status property card with nested status value cards
 */
export function renderStatusPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
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

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate("settings.taskProperties.properties.status.description")
	);

	const rows: CardRow[] = [
		{ label: "", input: descriptionEl, fullWidth: true },
		{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
		{ label: translate("settings.taskProperties.propertyCard.default"), input: defaultSelect },
		...nlpRows,
		{ label: "", input: nestedContainer, fullWidth: true },
	];

	createCard(container, {
		id: "property-status",
		collapsible: true,
		defaultCollapsed: true,
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
 * Renders the list of status value cards
 */
function renderStatusList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
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

		valueInput.addEventListener("input", () => {
			status.value = valueInput.value;
			statusCard.querySelector(".tasknotes-settings__card-primary-text")!.textContent =
				status.value || "untitled";
			save();
			if (onStatusesChanged) onStatusesChanged();
		});

		labelInput.addEventListener("input", () => {
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
