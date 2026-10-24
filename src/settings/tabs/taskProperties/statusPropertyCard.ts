import { uiData } from "../../../i18n/dataText";
import { uiText } from "../../../i18n/runtime";
import { configLabel } from "../../../i18n/configLabels";
import { msg } from "@lingui/core/macro";
/* eslint-disable @typescript-eslint/no-non-null-assertion -- Settings controls are created synchronously before handlers access them. */
import { setIcon } from "obsidian";
import TaskNotesPlugin from "../../../main";
import { showConfirmationModal } from "../../../modals/ConfirmationModal";
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
	createThemeColorInput,
	readThemeColorInput,
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
	const propertyKeyInput = createCardInput("text", uiData("status", "Editable frontmatter property identifier or filename-template syntax, not a display label"), plugin.settings.fieldMapping.status);

	// Validate defaultTaskStatus - if it doesn't exist in customStatuses, reset to first available
	const validStatusValues = plugin.settings.customStatuses.map((s) => s.value);
	if (
		!validStatusValues.includes(plugin.settings.defaultTaskStatus) &&
		validStatusValues.length > 0
	) {
		plugin.settings.defaultTaskStatus = validStatusValues[0];
		save();
	}

	const defaultSelect = createCardSelect(
		plugin.settings.customStatuses.map((status) => ({
			value: status.value,
			label: configLabel(status) || status.value,
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
	const nestedContainer = activeWindow.createDiv();
	nestedContainer.addClass("tasknotes-settings__nested-cards");

	// Create collapsible section for status values
	const statusValuesSection = nestedContainer.createDiv(
		"tasknotes-settings__collapsible-section"
	);

	const statusValuesHeader = statusValuesSection.createDiv(
		"tasknotes-settings__collapsible-section-header"
	);
	statusValuesHeader.createSpan({
		text: translate(msg({ message: "Status values", context: "settings.taskProperties.statusCard.valuesHeader" })),
		cls: "tasknotes-settings__collapsible-section-title",
	});
	const chevron = statusValuesHeader.createSpan(
		"tasknotes-settings__collapsible-section-chevron"
	);
	setIcon(chevron, "chevron-down");

	const statusValuesContent = statusValuesSection.createDiv(
		"tasknotes-settings__collapsible-section-content"
	);

	// Help text explaining how statuses work
	const statusHelpContainer = statusValuesContent.createDiv("tasknotes-settings__help-section");
	statusHelpContainer.createEl("h4", {
		text: translate(msg({ message: "How statuses work:", context: "settings.taskProperties.taskStatuses.howTheyWork.title" })),
	});
	const statusHelpList = statusHelpContainer.createEl("ul");
	statusHelpList.createEl("li", {
		text: translate(msg({ message: "Value: The internal identifier stored in your task files (e.g., \"in-progress\")", context: "settings.taskProperties.taskStatuses.howTheyWork.value" })),
	});
	statusHelpList.createEl("li", {
		text: translate(msg({ message: "Label: The display name shown in the interface (e.g., \"In Progress\")", context: "settings.taskProperties.taskStatuses.howTheyWork.label" })),
	});
	statusHelpList.createEl("li", {
		text: translate(msg({ message: "Color: Visual indicator color for the status dot and badges", context: "settings.taskProperties.taskStatuses.howTheyWork.color" })),
	});
	statusHelpList.createEl("li", {
		text: translate(msg({ message: "Icon: Optional Lucide icon name to display instead of colored dot (e.g., \"check\", \"circle\", \"clock\"). Browse icons at lucide.dev", context: "settings.taskProperties.taskStatuses.howTheyWork.icon" })),
	});
	statusHelpList.createEl("li", {
		text: translate(msg({ message: "Completed: When checked, tasks with this status are considered finished and may be filtered differently", context: "settings.taskProperties.taskStatuses.howTheyWork.completed" })),
	});
	statusHelpList.createEl("li", {
		text: translate(msg({ message: "Auto-archive: When enabled, tasks will be automatically archived after the specified delay (1-1440 minutes)", context: "settings.taskProperties.taskStatuses.howTheyWork.autoArchive" })),
	});
	statusHelpContainer.createEl("p", {
		text: translate(msg({ message: "The order below determines the sequence when cycling through statuses by clicking on task status badges.", context: "settings.taskProperties.taskStatuses.howTheyWork.orderNote" })),
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
				text: configLabel(status) || status.value,
			});
			if (status.value === plugin.settings.defaultTaskStatus) {
				option.selected = true;
			}
		});
	});

	// Add status button
	const addStatusButton = statusValuesContent.createEl("button", {
		text: translate(msg({ message: "Add status", context: "settings.taskProperties.taskStatuses.addNew.buttonText" })),
		cls: "tn-btn tn-btn--ghost",
	});
	addStatusButton.classList.remove(
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
	addStatusButton.classList.add("tn-static-margin-top-0-5rem-3dc98b5e");
	addStatusButton.onclick = () => {
		const newId = `status_${Date.now()}`;
		const newStatus = {
			id: newId,
			value: "",
			label: "",
			color: "#6366f1",
			completed: false,
			isCompleted: false,
			excludeFromCycle: false,
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
					text: configLabel(status) || status.value,
				});
				if (status.value === plugin.settings.defaultTaskStatus) {
					option.selected = true;
				}
			});
		});
	};

	// Toggle collapse
	statusValuesHeader.addEventListener("click", () => {
		statusValuesSection.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!statusValuesSection.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});

	const nlpRows = createNLPTriggerRows(plugin, "status", "*", save, translate);

	// Create description element
	const descriptionEl = createPropertyDescription(
		translate(msg({ message: "Tracks the current state of a task (e.g., todo, in-progress, done). Status determines whether a task appears as completed and can trigger auto-archiving.", context: "settings.taskProperties.properties.status.description" }))
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
		id: "property-status",
		collapsible: true,
		defaultCollapsed: true,
		header: {
			primaryText: translate(msg({ message: "Status", context: "settings.taskProperties.properties.status.name" })),
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
		showCardEmptyState(container, translate(msg({ message: "No custom statuses configured. Add a status to get started.", context: "settings.taskProperties.taskStatuses.emptyState" })));
		return;
	}

	const sortedStatuses = [...plugin.settings.customStatuses].sort((a, b) => a.order - b.order);

	sortedStatuses.forEach((status) => {
		let previousStatusValue = status.value;
		const valueInput = createCardInput(
			"text",
			uiData("in-progress", "Example persisted status identifier; translating it must not change YAML/NLP values"),
			status.value
		);
		const labelInput = createCardInput(
			"text",
			translate(msg({ message: "In progress", context: "settings.taskProperties.taskStatuses.placeholders.label" })),
			status.label
		);
		const colorInput = createThemeColorInput(status.color);
		const { container: iconInputContainer, input: iconInput } = createIconInput(
			plugin.app,
			uiData("check, circle, clock", "Literal Lucide icon identifiers, not translated display labels"),
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
							translate(msg({ message: "Completed", context: "settings.taskProperties.taskStatuses.badges.completed" })),
							"completed"
						)
					);
				}
			}
			save();
		});

		const excludeFromCycleToggle = createCardToggle(
			status.excludeFromCycle || false,
			(value) => {
				status.excludeFromCycle = value;
				save();
			}
		);

		const nextStatusSelect = createCardSelect(
			[
				{
					value: "",
					label: translate(
						msg({ message: "Use status order", context: "settings.taskProperties.taskStatuses.placeholders.nextStatusDefault" })
					),
				},
				...sortedStatuses
					.filter((statusOption) => statusOption.id !== status.id)
					.map((statusOption) => ({
						value: statusOption.value,
						label: configLabel(statusOption) || statusOption.value,
					})),
			],
			status.nextStatus === status.value ? "" : status.nextStatus || ""
		);

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
						translate(msg({ message: "Completed", context: "settings.taskProperties.taskStatuses.badges.completed" })),
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
			void (async () => {
				const message = translate(msg({ message: "Are you sure you want to delete the status \"{label}\"?", context: "settings.taskProperties.taskStatuses.deleteConfirm" }), {
					label: configLabel(status) || status.value,
				});
				const confirmDelete = await showConfirmationModal(plugin.app, {
					title: translate(msg({ message: "Confirm", context: "common.confirm" })),
					message,
					confirmText: translate(msg({ message: "Confirm", context: "common.confirm" })),
					cancelText: translate(msg({ message: "Cancel", context: "common.cancel" })),
					isDestructive: true,
				});
				if (!confirmDelete) {
					return;
				}

				const statusIndex = plugin.settings.customStatuses.findIndex(
					(s) => s.id === status.id
				);
				if (statusIndex !== -1) {
					// Check if we're deleting the default status
					const wasDefault = plugin.settings.defaultTaskStatus === status.value;
					const deletedValue = plugin.settings.customStatuses[statusIndex].value;

					plugin.settings.customStatuses.splice(statusIndex, 1);
					plugin.settings.customStatuses.forEach((s, i) => {
						s.order = i;
						if (s.nextStatus === deletedValue) {
							delete s.nextStatus;
						}
					});

					// If deleted status was the default, update to first available status
					if (wasDefault && plugin.settings.customStatuses.length > 0) {
						plugin.settings.defaultTaskStatus = plugin.settings.customStatuses[0].value;
					}

					save();
					renderStatusList(container, plugin, save, translate, onStatusesChanged);
					if (onStatusesChanged) onStatusesChanged();
				}
			})();
		};

		const cardConfig: CardConfig = {
			id: status.id,
			draggable: true,
			collapsible: true,
			defaultCollapsed: true,
			colorIndicator: { color: status.color, cssVar: "--status-color" },
			header: {
				primaryText: status.value || uiText(msg({ message: "Untitled", context: "untitled custom status or priority heading" })),
				secondaryText: configLabel(status) || uiText(msg({ message: "No label", context: "settings/tabs/taskProperties/statusPropertyCard: renderStatusList secondaryText" })),
				meta: metaElements,
				actions: [createDeleteHeaderButton(deleteStatus)],
			},
			content: {
				sections: [
					{
						rows: [
							{
								label: translate(
									msg({ message: "Value:", context: "settings.taskProperties.taskStatuses.fields.value" })
								),
								input: valueInput,
							},
							{
								label: translate(
									msg({ message: "Label:", context: "settings.taskProperties.taskStatuses.fields.label" })
								),
								input: labelInput,
							},
							{
								label: translate(
									msg({ message: "Color:", context: "settings.taskProperties.taskStatuses.fields.color" })
								),
								input: colorInput,
							},
							{
								label: translate(
									msg({ message: "Icon:", context: "settings.taskProperties.taskStatuses.fields.icon" })
								),
								input: iconInputContainer,
							},
							{
								label: translate(
									msg({ message: "Completed:", context: "settings.taskProperties.taskStatuses.fields.completed" })
								),
								input: completedToggle,
							},
							{
								label: translate(
									msg({ message: "Skip when cycling:", context: "settings.taskProperties.taskStatuses.fields.excludeFromCycle" })
								),
								input: excludeFromCycleToggle,
							},
							{
								label: translate(
									msg({ message: "Next status:", context: "settings.taskProperties.taskStatuses.fields.nextStatus" })
								),
								input: nextStatusSelect,
							},
							{
								label: translate(
									msg({ message: "Auto-archive:", context: "settings.taskProperties.taskStatuses.fields.autoArchive" })
								),
								input: autoArchiveToggle,
							},
							{
								label: translate(
									msg({ message: "Delay (minutes):", context: "settings.taskProperties.taskStatuses.fields.delayMinutes" })
								),
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
				status.value || uiText(msg({ message: "Untitled", context: "untitled custom status or priority heading" }));
			save();
			if (onStatusesChanged) onStatusesChanged();
		});

		valueInput.addEventListener("change", () => {
			if (previousStatusValue === status.value) {
				return;
			}

			plugin.settings.customStatuses.forEach((statusOption) => {
				if (statusOption.nextStatus === previousStatusValue) {
					statusOption.nextStatus =
						statusOption.id === status.id || !status.value ? undefined : status.value;
				}
			});
			previousStatusValue = status.value;
			save();
			renderStatusList(container, plugin, save, translate, onStatusesChanged);
		});

		labelInput.addEventListener("input", () => {
			status.label = labelInput.value;
			statusCard.querySelector(".tasknotes-settings__card-secondary-text")!.textContent =
				configLabel(status) || uiText(msg({ message: "No label", context: "settings/tabs/taskProperties/statusPropertyCard: renderStatusList display" }));
			save();
			if (onStatusesChanged) onStatusesChanged();
		});

		colorInput.addEventListener("change", () => {
			status.color = readThemeColorInput(colorInput, status.color || "#6366f1");
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

		nextStatusSelect.addEventListener("change", () => {
			status.nextStatus =
				nextStatusSelect.value && nextStatusSelect.value !== status.value
					? nextStatusSelect.value
					: undefined;
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

/* eslint-enable @typescript-eslint/no-non-null-assertion -- Re-enable after the status settings renderer. */
