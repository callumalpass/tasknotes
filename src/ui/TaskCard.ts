import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import { createTaskClickHandler, createTaskHoverHandler } from "../utils/clickHandlers";
import { type TaskCardPresentationOptions } from "./taskCardPresentation";
import { renderTaskCardMetadataLine } from "./taskCardMetadata";
import {
	cleanupTaskCardExpansions,
	toggleBlockedByTasksExpansion,
	toggleBlockingTasksExpansion,
	toggleSubtasksExpansion,
	refreshParentTaskSubtasksExpansion,
	type TaskCardRelationshipExpansionContext,
} from "./taskCardRelationshipExpansion";
import {
	createPriorityClickHandler,
	createStatusCycleHandler,
} from "./taskCardActions";
import {
	applyTaskCardPriorityColor,
	createPriorityIndicator,
	createStatusIndicator,
	updatePriorityIndicator,
	updateStatusIndicator,
} from "./taskCardPrimaryIndicators";
import {
	buildTaskCardRenderState,
} from "./taskCardState";
import {
	renderTaskCardSecondaryBadges,
	updateTaskCardSecondaryBadges,
	type TaskCardSecondaryBadgeHandlers,
} from "./taskCardSecondaryBadges";
import {
	createTaskCardContextMenuButton,
	showTaskContextMenu,
} from "./taskCardContextMenu";
import {
	createTaskCardTitle,
	updateTaskCardTitle,
} from "./taskCardTitle";
import { updateTaskCardStatusIndicatorVisuals } from "./taskCardCompletionState";
export { showDeleteConfirmationModal } from "./taskCardDeletion";
export { showTaskContextMenu } from "./taskCardContextMenu";

// Property labels are resolved in taskCardProperties via getTaskCardPropertyLabel.

export interface TaskCardOptions {
	targetDate?: Date;
	layout?: "default" | "compact" | "inline";
	/** When true, hide status indicator (e.g., when Kanban is grouped by status) */
	hideStatusIndicator?: boolean;
	/** When false, omit secondary badge controls such as reminders, project badges, and toggles. */
	showSecondaryBadges?: boolean;
	/** When false, disable hover preview wiring for the card. */
	enableHoverPreview?: boolean;
	/** Optional display labels for properties, typically sourced from Bases config. */
	propertyLabels?: TaskCardPresentationOptions["propertyLabels"];
	/** Optional title override for inline/embedded cards, such as wikilink aliases. */
	displayText?: string;
	/** How expanded subtasks/dependencies should interact with the current view filter. */
	expandedRelationshipFilterMode?: "inherit" | "show-all";
	/** Optional live resolver for the current expanded relationship filter mode. */
	resolveExpandedRelationshipFilterMode?: () => "inherit" | "show-all";
	/** Paths visible in the current view after Bases/search filtering. */
	expandedRelationshipTaskPaths?: ReadonlySet<string>;
	/** Sort order of paths in the current view after Bases/search sorting. */
	expandedRelationshipTaskOrder?: ReadonlyMap<string, number>;
}

export const DEFAULT_TASK_CARD_OPTIONS: TaskCardOptions = {
	layout: "default",
	showSecondaryBadges: true,
	enableHoverPreview: true,
};

type TaskCardElement = HTMLElement & {
	_taskPath?: string;
	_taskCardOptions?: Partial<TaskCardOptions>;
};

function getStoredTaskCardOptions(card: HTMLElement): Partial<TaskCardOptions> {
	return (card as TaskCardElement)._taskCardOptions ?? {};
}

function createRelationshipExpansionContext(
	plugin: TaskNotesPlugin
): TaskCardRelationshipExpansionContext {
	return {
		plugin,
		getRelationshipOptions: getStoredTaskCardOptions,
		renderTaskCard: (relatedTask, options) =>
			createTaskCard(relatedTask, plugin, undefined, options),
	};
}

function createSecondaryBadgeHandlers(plugin: TaskNotesPlugin): TaskCardSecondaryBadgeHandlers {
	return {
		toggleSubtasks: (card, task, expanded) => toggleSubtasks(card, task, plugin, expanded),
		toggleBlockingTasks: (card, task, expanded) =>
			toggleBlockingTasks(card, task, plugin, expanded),
		toggleBlockedByTasks: (card, task, expanded) =>
			toggleBlockedByTasks(card, task, plugin, expanded),
	};
}

/**
 * Create a minimalist, unified task card element
 *
 * @param task - The task to render
 * @param plugin - TaskNotes plugin instance
 * @param visibleProperties - IMPORTANT: Must be user-configured frontmatter property names
 *                            (e.g., "task-status", "complete_instances"), NOT internal FieldMapping keys.
 *                            If passing from settings.defaultVisibleProperties, convert using
 *                            convertInternalToUserProperties() first.
 * @param options - Optional rendering options (layout, targetDate, etc.)
 *
 * @example
 * // Correct: Convert internal names before passing
 * const props = plugin.settings.defaultVisibleProperties
 *   ? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
 *   : undefined;
 * createTaskCard(task, plugin, props);
 *
 * // Correct: Pass frontmatter names from Bases
 * createTaskCard(task, plugin, ["complete_instances", "task-status"]);
 *
 * // WRONG: Don't pass internal keys directly
 * createTaskCard(task, plugin, ["completeInstances", "status"]); // ❌
 */
export function createTaskCard(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleProperties?: string[],
	options: Partial<TaskCardOptions> = {}
): HTMLElement {
	const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
	const renderState = buildTaskCardRenderState(task, plugin, opts);
	const { targetDate, effectiveStatus, layout, isCompleted, hasDetails } = renderState;

	// Main container with BEM class structure
	// Use span for inline layout to ensure proper inline flow in CodeMirror
	const card = activeDocument.createElement(layout === "inline" ? "span" : "div");

	// Store task path for circular reference detection
	const taskCardElement = card as TaskCardElement;
	taskCardElement._taskPath = task.path;
	taskCardElement._taskCardOptions = opts;

	card.className = renderState.cardClasses.join(" ");
	card.dataset.taskPath = task.path;
	card.dataset.key = task.path; // For DOMReconciler compatibility
	card.dataset.status = effectiveStatus;
	card.dataset.hasDetails = hasDetails ? "true" : "false";

	// Create main row container for horizontal layout
	// Use span for inline layout to maintain inline flow
	const mainRow = card.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__main-row",
	});

	applyTaskCardPriorityColor(card, task, plugin);

	createStatusIndicator({
		mainRow,
		card,
		task,
		plugin,
		effectiveStatus,
		visibleProperties,
		hideStatusIndicator: opts.hideStatusIndicator,
		onClick: createStatusCycleHandler({
			task,
			plugin,
			targetDate,
			updateStatusVisuals: (updatedTask, effectiveStatus, isCompleted) => {
				const currentStatusDot = card.querySelector<HTMLElement>(".task-card__status-dot");
				if (currentStatusDot) {
					updateTaskCardStatusIndicatorVisuals({
						card,
						statusDot: currentStatusDot,
						plugin,
						updatedTask,
						effectiveStatus,
						isCompleted,
					});
				}
			},
		}),
	});

	createPriorityIndicator({
		mainRow,
		task,
		plugin,
		visibleProperties,
		onClick: createPriorityClickHandler(task, plugin),
	});

	// Content container
	const contentContainer = mainRow.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__content",
	});

	// Badge area for secondary indicators (only in non-inline mode)
	const badgesContainer =
		layout !== "inline" ? mainRow.createEl("div", { cls: "task-card__badges" }) : null;
	const secondaryBadgeHandlers = createSecondaryBadgeHandlers(plugin);

	renderTaskCardSecondaryBadges({
		card,
		badgesContainer,
		task,
		plugin,
		hasDetails,
		propertyOptions: opts,
		handlers: secondaryBadgeHandlers,
	});

	createTaskCardContextMenuButton({
		mainRow,
		taskPath: task.path,
		plugin,
		targetDate,
	});

	createTaskCardTitle({
		contentContainer,
		layout,
		task,
		plugin,
		displayText: opts.displayText,
		isCompleted,
	});

	// Second line: Metadata (dynamic based on visible properties)
	const metadataLine = contentContainer.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__metadata",
	});
	renderTaskCardMetadataLine({
		metadataLine,
		card,
		task,
		plugin,
		visibleProperties,
		propertyOptions: opts,
		handlers: secondaryBadgeHandlers,
	});

	// Add click handlers with single/double click distinction
	const { clickHandler, dblclickHandler, contextmenuHandler } = createTaskClickHandler({
		task,
		plugin,
		contextMenuHandler: (e) => {
			const path = card.dataset.taskPath;
			if (!path) return;
			void showTaskContextMenu(e, path, plugin, targetDate);
		},
	});

	card.addEventListener("click", clickHandler);
	card.addEventListener("dblclick", dblclickHandler);
	card.addEventListener("contextmenu", contextmenuHandler);

	if (opts.enableHoverPreview) {
		card.addEventListener("mouseover", createTaskHoverHandler(task, plugin));
	}

	return card;
}

/**
 * Update an existing task card with new data
 */
export function updateTaskCard(
	element: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	visibleProperties?: string[],
	options: Partial<TaskCardOptions> = {}
): void {
	const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
	const renderState = buildTaskCardRenderState(task, plugin, opts);
	const { targetDate, effectiveStatus, isCompleted, hasDetails } = renderState;

	element.className = renderState.cardClasses.join(" ");
	element.dataset.status = effectiveStatus;
	element.dataset.hasDetails = hasDetails ? "true" : "false";

	// Get the main row container
	const mainRow = element.querySelector(".task-card__main-row") as HTMLElement;

	applyTaskCardPriorityColor(element, task, plugin);

	// Update checkbox if present
	const checkbox = element.querySelector(".task-card__checkbox") as HTMLInputElement;
	if (checkbox) {
		checkbox.checked = plugin.statusManager.isCompletedStatus(effectiveStatus);
	}

	updateStatusIndicator({
		mainRow,
		card: element,
		task,
		plugin,
		effectiveStatus,
		visibleProperties,
		hideStatusIndicator: opts.hideStatusIndicator,
		onClick: createStatusCycleHandler({
			task,
			plugin,
			targetDate,
			updateStatusVisuals: (updatedTask, effectiveStatus, isCompleted) => {
				const currentStatusDot =
					element.querySelector<HTMLElement>(".task-card__status-dot");
				if (currentStatusDot) {
					updateTaskCardStatusIndicatorVisuals({
						card: element,
						statusDot: currentStatusDot,
						plugin,
						updatedTask,
						effectiveStatus,
						isCompleted,
					});
				}
			},
		}),
	});

	updatePriorityIndicator({
		mainRow,
		task,
		plugin,
		visibleProperties,
		onClick: createPriorityClickHandler(task, plugin),
	});

	const secondaryBadgeHandlers = createSecondaryBadgeHandlers(plugin);
	updateTaskCardSecondaryBadges({
		card: element,
		mainRow,
		task,
		plugin,
		hasDetails,
		propertyOptions: opts,
		handlers: secondaryBadgeHandlers,
	});

	updateTaskCardTitle({
		card: element,
		task,
		plugin,
		displayText: opts.displayText,
		isCompleted,
	});

	const legacyBlockedBadge = element.querySelector(".task-card__badge--blocked");
	if (legacyBlockedBadge) {
		legacyBlockedBadge.remove();
	}

	// Update metadata line
	const metadataLine = element.querySelector(".task-card__metadata") as HTMLElement;
	if (metadataLine) {
		renderTaskCardMetadataLine({
			metadataLine,
			card: element,
			task,
			plugin,
			visibleProperties,
			propertyOptions: opts,
			handlers: secondaryBadgeHandlers,
		});
	}

	// Animation is now handled separately - don't add it here during reconciler updates
}

/**
 * Clean up event listeners and resources for a task card
 */
export function cleanupTaskCard(card: HTMLElement): void {
	cleanupTaskCardExpansions(card);
}

/**
 * Toggle subtasks display for a project task card
 */
export async function toggleSubtasks(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	expanded: boolean
): Promise<void> {
	await toggleSubtasksExpansion(createRelationshipExpansionContext(plugin), card, task, expanded);
}

export async function toggleBlockingTasks(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	shouldExpand: boolean
): Promise<void> {
	await toggleBlockingTasksExpansion(
		createRelationshipExpansionContext(plugin),
		card,
		task,
		shouldExpand
	);
}

export async function toggleBlockedByTasks(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	shouldExpand: boolean
): Promise<void> {
	await toggleBlockedByTasksExpansion(
		createRelationshipExpansionContext(plugin),
		card,
		task,
		shouldExpand
	);
}

/**
 * Refresh expanded subtasks in parent task cards when a subtask is updated
 * This ensures that when a subtask is modified, any parent task cards that have
 * that subtask expanded will refresh their subtasks display
 */
export async function refreshParentTaskSubtasks(
	updatedTask: TaskInfo,
	plugin: TaskNotesPlugin,
	container: HTMLElement
): Promise<void> {
	await refreshParentTaskSubtasksExpansion(
		createRelationshipExpansionContext(plugin),
		updatedTask,
		container
	);
}
