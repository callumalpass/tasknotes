import { configLabel } from "../i18n/configLabels";
import { msg } from "@lingui/core/macro";
import { setIcon } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { PriorityConfig, TaskInfo } from "../types";
import { isPropertyForField } from "../utils/propertyMapping";
import { prepareInteractiveControl } from "./taskCardIndicators";
import {
	priorityGlyphState,
	renderPriorityGlyph,
	renderStatusGlyph,
	statusGlyphState,
	unconfiguredValueLabel,
	hasVisiblePriority,
} from "./kit/glyphs";

type StatusConfig = ReturnType<TaskNotesPlugin["statusManager"]["getStatusConfig"]>;

export interface StatusIndicatorConfig {
	mainRow: HTMLElement | null;
	card: HTMLElement;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	effectiveStatus: string;
	visibleProperties?: string[];
	hideStatusIndicator?: boolean;
	onClick: (event: MouseEvent) => void;
}

export interface PriorityIndicatorConfig {
	mainRow: HTMLElement | null;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	visibleProperties?: string[];
	onClick: (event: MouseEvent) => void;
}

export function shouldShowStatusIndicator(
	visibleProperties: string[] | undefined,
	plugin: TaskNotesPlugin,
	hideStatusIndicator = false
): boolean {
	return (
		!hideStatusIndicator &&
		(!visibleProperties ||
			visibleProperties.some((prop) => isPropertyForField(prop, "status", plugin)))
	);
}

export function shouldShowPriorityIndicator(
	visibleProperties: string[] | undefined,
	plugin: TaskNotesPlugin
): boolean {
	return (
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "priority", plugin))
	);
}

/**
 * When the view shows neither status nor priority, the card drops its first layout column so the
 * title starts at the edge. This follows the view's properties, not the task, so every card in a
 * view lines up.
 */
export function syncTaskCardLeadColumn(
	card: HTMLElement,
	visibleProperties: string[] | undefined,
	plugin: TaskNotesPlugin,
	hideStatusIndicator = false
): void {
	card.classList.toggle(
		"task-card--no-lead",
		!shouldShowStatusIndicator(visibleProperties, plugin, hideStatusIndicator) &&
			!shouldShowPriorityIndicator(visibleProperties, plugin)
	);
}

export function applyTaskCardStatusColors(
	card: HTMLElement,
	effectiveStatus: string,
	plugin: TaskNotesPlugin
): void {
	const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
	if (statusConfig?.color) {
		card.style.setProperty("--current-status-color", statusConfig.color);
	} else {
		card.style.removeProperty("--current-status-color");
	}

	const nextStatus = plugin.statusManager.getNextStatus(effectiveStatus);
	const nextStatusConfig = plugin.statusManager.getStatusConfig(nextStatus);
	if (nextStatusConfig?.color) {
		card.style.setProperty("--next-status-color", nextStatusConfig.color);
	} else {
		card.style.removeProperty("--next-status-color");
	}
}

export function applyTaskCardPriorityColor(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin
): PriorityConfig | null | undefined {
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	if (priorityConfig?.color) {
		card.style.setProperty("--priority-color", priorityConfig.color);
		card.style.setProperty("--current-priority-color", priorityConfig.color);
	} else {
		card.style.removeProperty("--priority-color");
		card.style.removeProperty("--current-priority-color");
	}
	return priorityConfig;
}

export function configureStatusIndicator(
	statusDot: HTMLElement,
	statusConfig: StatusConfig | null | undefined,
	plugin: TaskNotesPlugin,
	statusValue = statusConfig?.value ?? ""
): void {
	statusDot.addClass("task-card__status-dot--icon");
	const label = statusConfig ? configLabel(statusConfig) : unconfiguredValueLabel(statusValue);
	statusDot.setAttribute("aria-label", label);
	statusDot.setAttribute("aria-keyshortcuts", "S");
	statusDot.empty();
	if (statusConfig?.icon) {
		delete statusDot.dataset.tnGlyph;
		setIcon(statusDot, statusConfig.icon);
		return;
	}
	renderStatusGlyph(
		statusDot,
		statusGlyphState(statusValue, plugin.statusManager.getAllStatuses())
	);
}

export function createStatusIndicator(config: StatusIndicatorConfig): HTMLElement | null {
	const {
		mainRow,
		card,
		task,
		plugin,
		effectiveStatus,
		visibleProperties,
		hideStatusIndicator,
		onClick,
	} = config;

	if (!shouldShowStatusIndicator(visibleProperties, plugin, hideStatusIndicator)) {
		return null;
	}
	if (!mainRow) {
		return null;
	}

	const statusDot = mainRow.createSpan({ cls: "task-card__status-dot" });
	configureStatusIndicator(
		statusDot,
		plugin.statusManager.getStatusConfig(effectiveStatus),
		plugin,
		effectiveStatus
	);
	prepareInteractiveControl(statusDot);
	statusDot.addEventListener("click", onClick);
	statusDot.dataset.taskPath = task.path;
	applyTaskCardStatusColors(card, effectiveStatus, plugin);
	return statusDot;
}

function insertPrimaryIndicator(
	mainRow: HTMLElement,
	indicator: HTMLElement,
	afterSelector: string
): void {
	const previous = mainRow.querySelector(afterSelector);
	if (previous) {
		previous.insertAdjacentElement("afterend", indicator);
		return;
	}

	const checkbox = mainRow.querySelector(".task-card__checkbox");
	if (checkbox) {
		checkbox.insertAdjacentElement("afterend", indicator);
		return;
	}

	mainRow.insertBefore(indicator, mainRow.firstChild);
}

export function updateStatusIndicator(config: StatusIndicatorConfig): HTMLElement | null {
	const { mainRow, card, plugin, effectiveStatus, visibleProperties, hideStatusIndicator } =
		config;
	const statusDot = card.querySelector<HTMLElement>(".task-card__status-dot");

	applyTaskCardStatusColors(card, effectiveStatus, plugin);

	if (!shouldShowStatusIndicator(visibleProperties, plugin, hideStatusIndicator)) {
		statusDot?.remove();
		return null;
	}

	if (statusDot) {
		configureStatusIndicator(
			statusDot,
			plugin.statusManager.getStatusConfig(effectiveStatus),
			plugin,
			effectiveStatus
		);
		return statusDot;
	}
	if (!mainRow) {
		return null;
	}

	const newStatusDot = createStatusIndicator(config);
	if (newStatusDot) {
		insertPrimaryIndicator(mainRow, newStatusDot, ".task-card__checkbox");
	}
	return newStatusDot;
}

export function configurePriorityIndicator(
	priorityDot: HTMLElement,
	priorityConfig: PriorityConfig | undefined,
	plugin: TaskNotesPlugin,
	priorityValue = priorityConfig?.value
): void {
	const label = priorityConfig
		? configLabel(priorityConfig)
		: (priorityValue ? unconfiguredValueLabel(priorityValue) : "") ||
			plugin.i18n.translate(msg({ message: "None", context: "ui.taskCard.noPriority" }));
	const priorityLabel = plugin.i18n.translate(
		msg({ message: "Priority: {label}", context: "ui.taskCard.priorityAriaLabel" }),
		{ label }
	);
	priorityDot.replaceChildren();
	priorityDot.setAttribute("aria-label", priorityLabel);
	priorityDot.setAttribute("aria-keyshortcuts", "P");
	priorityDot.classList.add("task-card__priority-dot--icon");

	if (priorityConfig?.icon) {
		delete priorityDot.dataset.tnGlyph;
		setIcon(priorityDot, priorityConfig.icon);
		return;
	}
	renderPriorityGlyph(
		priorityDot,
		priorityGlyphState(priorityValue, plugin.priorityManager.getAllPriorities())
	);
}

/**
 * Cards in a view that shows priority get a bar in the priority's colour along their left edge,
 * so priority reads at a glance as it did with 4.x's larger dot. Tasks with no priority, or a
 * priority of weight zero such as "None", get no bar.
 */
export function syncTaskCardPriorityBar(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	priorityShown: boolean
): void {
	const ranked =
		priorityShown &&
		priorityGlyphState(task.priority, plugin.priorityManager.getAllPriorities()).kind === "dot";
	card.classList.toggle("task-card--has-priority-bar", ranked);
}

export function createPriorityIndicator(config: PriorityIndicatorConfig): HTMLElement | null {
	const { mainRow, task, plugin, visibleProperties, onClick } = config;
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);

	const shown = shouldShowPriorityIndicator(visibleProperties, plugin);
	const card = mainRow?.closest<HTMLElement>(".task-card");
	if (card) syncTaskCardPriorityBar(card, task, plugin, shown);
	if (
		!shown ||
		!mainRow ||
		!hasVisiblePriority(task.priority, plugin.priorityManager.getAllPriorities())
	) {
		return null;
	}

	const priorityDot = mainRow.createSpan({
		cls: "task-card__priority-dot",
	});
	configurePriorityIndicator(priorityDot, priorityConfig, plugin, task.priority);
	prepareInteractiveControl(priorityDot);
	priorityDot.addEventListener("click", onClick);
	return priorityDot;
}

export function updatePriorityIndicator(config: PriorityIndicatorConfig): HTMLElement | null {
	const { mainRow, card, task, plugin, visibleProperties } = {
		...config,
		card: config.mainRow?.closest<HTMLElement>(".task-card") ?? config.mainRow,
	};
	if (!card) {
		return null;
	}
	const existingPriorityDot = card.querySelector<HTMLElement>(".task-card__priority-dot");
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	const shown = shouldShowPriorityIndicator(visibleProperties, plugin);
	syncTaskCardPriorityBar(card, task, plugin, shown);

	if (
		!shown ||
		!hasVisiblePriority(task.priority, plugin.priorityManager.getAllPriorities())
	) {
		existingPriorityDot?.remove();
		return null;
	}

	if (!existingPriorityDot) {
		if (!mainRow) {
			return null;
		}
		const priorityDot = createPriorityIndicator(config);
		if (priorityDot) {
			insertPrimaryIndicator(mainRow, priorityDot, ".task-card__status-dot");
		}
		return priorityDot;
	}

	configurePriorityIndicator(existingPriorityDot, priorityConfig, plugin, task.priority);
	const newPriorityDot = existingPriorityDot.cloneNode(true) as HTMLElement;
	prepareInteractiveControl(newPriorityDot);
	newPriorityDot.addEventListener("click", config.onClick);
	existingPriorityDot.replaceWith(newPriorityDot);
	return newPriorityDot;
}
