import { TFile, setIcon, Notice, setTooltip, parseLinktext, Menu } from "obsidian";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import { TaskContextMenu } from "../components/TaskContextMenu";
import { getEffectiveTaskStatus, filterEmptyProjects, sanitizeForCssClass } from "../utils/helpers";
import { formatDateForStorage } from "../utils/dateUtils";
import { stringifyUnknown } from "../utils/stringUtils";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { createTaskClickHandler, createTaskHoverHandler } from "../utils/clickHandlers";
import { ReminderModal } from "../modals/ReminderModal";
import { convertInternalToUserProperties, isPropertyForField } from "../utils/propertyMapping";
import { type TaskCardPresentationOptions } from "./taskCardPresentation";
import { getChevronTooltip, getRecurrenceTooltip, getReminderTooltip } from "./taskCardHelpers";
import {
	getDefaultVisibleProperties,
	renderPropertyMetadata,
	updateMetadataVisibility,
} from "./taskCardProperties";
export { showDeleteConfirmationModal } from "./taskCardDeletion";

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
	/** How expanded subtasks/dependencies should interact with the current view filter. */
	expandedRelationshipFilterMode?: "inherit" | "show-all";
	/** Optional live resolver for the current expanded relationship filter mode. */
	resolveExpandedRelationshipFilterMode?: () => "inherit" | "show-all";
	/** Paths visible in the current view after Bases/search filtering. */
	expandedRelationshipTaskPaths?: ReadonlySet<string>;
}

export const DEFAULT_TASK_CARD_OPTIONS: TaskCardOptions = {
	layout: "default",
	showSecondaryBadges: true,
	enableHoverPreview: true,
};

type TaskCardElement = HTMLElement & {
	_taskPath?: string;
	_taskCardOptions?: Partial<TaskCardOptions>;
	_clickHandler?: EventListener;
};

type MenuWithItems = {
	items?: unknown[];
};

function bindNestedCardHoverState(container: HTMLElement, card: HTMLElement): void {
	const addNestedHover = () => card.classList.add("task-card--nested-interactive-hover");
	const removeNestedHover = () => card.classList.remove("task-card--nested-interactive-hover");

	container.addEventListener("mouseenter", addNestedHover);
	container.addEventListener("mouseleave", removeNestedHover);
}

function getStoredTaskCardOptions(card: HTMLElement): Partial<TaskCardOptions> {
	return (card as TaskCardElement)._taskCardOptions ?? {};
}

function parseExpandedRelationshipFilterMode(value: unknown): "inherit" | "show-all" {
	if (typeof value === "number") {
		return value === 1 ? "show-all" : "inherit";
	}

	const normalized = stringifyUnknown(value)
		.trim()
		.toLowerCase()
		.replace(/^['"]|['"]$/g, "")
		.replace(/[_\s]+/g, "-");

	if (normalized === "show-all" || normalized === "1") {
		return "show-all";
	}

	if (normalized === "inherit" || normalized === "0") {
		return "inherit";
	}

	return "inherit";
}

function filterExpandedRelationshipTasks(card: HTMLElement, tasks: TaskInfo[]): TaskInfo[] {
	const options = getStoredTaskCardOptions(card);
	const filterMode = parseExpandedRelationshipFilterMode(
		options.resolveExpandedRelationshipFilterMode?.() ?? options.expandedRelationshipFilterMode
	);
	if (filterMode !== "inherit") {
		return tasks;
	}

	const allowedTaskPaths = options.expandedRelationshipTaskPaths;
	if (!allowedTaskPaths) {
		return tasks;
	}

	return tasks.filter((relatedTask) => allowedTaskPaths.has(relatedTask.path));
}

function tTaskCard(
	plugin: TaskNotesPlugin,
	key: string,
	vars?: Record<string, string | number>
): string {
	return plugin.i18n.translate(`ui.taskCard.${key}`, vars);
}

function taskHasDetails(task: TaskInfo): boolean {
	return typeof task.details === "string" && task.details.trim().length > 0;
}

/* =================================================================
   BADGE INDICATOR HELPERS
   ================================================================= */

interface BadgeIndicatorConfig {
	container: HTMLElement;
	className: string;
	icon: string;
	tooltip: string;
	ariaLabel?: string;
	onClick?: (e: MouseEvent) => void;
	visible?: boolean;
}

/**
 * Creates a badge indicator element with icon, tooltip, and optional click handler.
 * Returns the element, or null if visible is false.
 */
function createBadgeIndicator(config: BadgeIndicatorConfig): HTMLElement | null {
	const { container, className, icon, tooltip, ariaLabel, onClick, visible = true } = config;

	if (!visible) return null;

	const indicator = container.createEl("div", {
		cls: className,
		attr: { "aria-label": ariaLabel || tooltip },
	});

	setIcon(indicator, icon);
	setTooltip(indicator, tooltip, { placement: "top" });

	if (onClick) {
		prepareInteractiveControl(indicator);
		indicator.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick(e);
		});
	}

	return indicator;
}

/**
 * Updates or creates a badge indicator, returning the element.
 * If the indicator should not exist, removes any existing one and returns null.
 */
function updateBadgeIndicator(
	container: HTMLElement,
	selector: string,
	config: Omit<BadgeIndicatorConfig, "container"> & { shouldExist: boolean }
): HTMLElement | null {
	const existing = container.querySelector<HTMLElement>(selector);

	if (!config.shouldExist) {
		existing?.remove();
		return null;
	}

	if (existing) {
		// Update existing indicator
		existing.setAttribute("aria-label", config.ariaLabel || config.tooltip);
		setTooltip(existing, config.tooltip, { placement: "top" });
		if (config.onClick) {
			prepareInteractiveControl(existing);
		}
		return existing;
	}

	// Create new indicator
	const badgesContainer = container.querySelector(".task-card__badges") as HTMLElement;
	const targetContainer =
		badgesContainer || (container.querySelector(".task-card__main-row") as HTMLElement);

	if (!targetContainer) return null;

	return createBadgeIndicator({
		container: targetContainer,
		...config,
	});
}

/**
 * Mark interactive task-card controls so draggable parent cards do not swallow clicks.
 */
function prepareInteractiveControl(element: HTMLElement): void {
	if (element.dataset.tnNoDrag === "true") {
		element.setAttribute("draggable", "false");
		return;
	}

	element.dataset.tnNoDrag = "true";
	element.setAttribute("draggable", "false");
	element.addEventListener("mousedown", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});
}

/* =================================================================
   CLICK HANDLER FACTORIES
   ================================================================= */

/**
 * Creates a click handler for cycling task status
 */
function createStatusCycleHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	statusDot: HTMLElement,
	targetDate: Date
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		void (async () => {
			try {
				const updateStatusVisuals = (
					updatedTask: TaskInfo,
					effectiveStatus: string,
					isCompleted: boolean
				) => {
					const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
					if (statusConfig?.color) {
						statusDot.style.borderColor = statusConfig.color;
					} else {
						statusDot.style.removeProperty("border-color");
					}

					if (statusConfig?.icon) {
						statusDot.addClass("task-card__status-dot--icon");
						statusDot.empty();
						setIcon(statusDot, statusConfig.icon);
					} else {
						statusDot.removeClass("task-card__status-dot--icon");
						statusDot.empty();
					}

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

					const checkbox = card.querySelector<HTMLInputElement>(".task-card__checkbox");
					if (checkbox) {
						checkbox.checked = isCompleted;
					}

					updateCardCompletionState(
						card,
						updatedTask,
						plugin,
						isCompleted,
						effectiveStatus
					);
				};

				if (task.recurrence) {
					// For recurring tasks, toggle completion for the target date
					const updatedTask = await plugin.toggleRecurringTaskComplete(task, targetDate);
					const newEffectiveStatus = getEffectiveTaskStatus(
						updatedTask,
						targetDate,
						plugin.statusManager.getCompletedStatuses()[0]
					);
					const isNowCompleted =
						plugin.statusManager.isCompletedStatus(newEffectiveStatus);
					updateStatusVisuals(updatedTask, newEffectiveStatus, isNowCompleted);
				} else {
					// For regular tasks, cycle to next/previous status based on shift key
					const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
					if (!freshTask) {
						new Notice("Task not found");
						return;
					}
					const currentStatus = freshTask.status || plugin.settings.defaultTaskStatus;
					const nextStatus = e.shiftKey
						? plugin.statusManager.getPreviousStatus(currentStatus)
						: plugin.statusManager.getNextStatus(currentStatus);
					const updatedTask = await plugin.updateTaskProperty(
						freshTask,
						"status",
						nextStatus
					);
					const isNowCompleted = plugin.statusManager.isCompletedStatus(nextStatus);
					updateStatusVisuals(updatedTask, nextStatus, isNowCompleted);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error("Error cycling task status:", {
					error: errorMessage,
					taskPath: task.path,
				});
				new Notice(`Failed to update task status: ${errorMessage}`);
			}
		})();
	};
}

/**
 * Updates card classes based on completion state
 */
function updateCardCompletionState(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	isCompleted: boolean,
	effectiveStatus: string
): void {
	card.classList.toggle("task-card--completed", isCompleted);
	card.classList.toggle("task-card--archived", !!task.archived);
	card.classList.toggle(
		"task-card--actively-tracked",
		plugin.getActiveTimeSession(task) !== null
	);
	card.classList.toggle("task-card--recurring", !!task.recurrence);
	card.classList.toggle(
		"task-card--chevron-left",
		plugin.settings?.subtaskChevronPosition === "left"
	);
	const hasDetails = taskHasDetails(task);
	card.classList.toggle("task-card--has-details", hasDetails);
	card.dataset.hasDetails = hasDetails ? "true" : "false";

	for (const className of Array.from(card.classList)) {
		if (className.startsWith("task-card--priority-")) {
			card.classList.remove(className);
		}
	}
	if (task.priority) {
		card.classList.add(`task-card--priority-${sanitizeForCssClass(task.priority)}`);
	}

	for (const className of Array.from(card.classList)) {
		if (className.startsWith("task-card--status-")) {
			card.classList.remove(className);
		}
	}
	if (effectiveStatus) {
		card.classList.add(`task-card--status-${sanitizeForCssClass(effectiveStatus)}`);
	}

	card.dataset.status = effectiveStatus;

	// Update title styling
	const titleEl = card.querySelector(".task-card__title") as HTMLElement;
	const titleTextEl = card.querySelector(".task-card__title-text") as HTMLElement;
	if (titleEl) titleEl.classList.toggle("completed", isCompleted);
	if (titleTextEl) titleTextEl.classList.toggle("completed", isCompleted);
}

/**
 * Creates a click handler for priority dot
 */
function createPriorityClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		const menu = new PriorityContextMenu({
			currentValue: task.priority,
			onSelect: (newPriority) => {
				void (async () => {
					try {
						await plugin.updateTaskProperty(task, "priority", newPriority);
					} catch (error) {
						console.error("Error updating priority:", error);
						new Notice("Failed to update priority");
					}
				})();
			},
			plugin: plugin,
		});
		menu.show(e);
	};
}

/**
 * Creates a click handler for recurrence indicator
 */
function createRecurrenceClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin
): (e: MouseEvent) => void {
	return (e: MouseEvent) => {
		e.stopPropagation();
		const menu = new RecurrenceContextMenu({
			currentValue: typeof task.recurrence === "string" ? task.recurrence : undefined,
			currentAnchor: task.recurrence_anchor || "scheduled",
			scheduledDate: task.scheduled,
			onSelect: (newRecurrence, anchor) => {
				void (async () => {
					try {
						await plugin.updateTaskProperty(
							task,
							"recurrence",
							newRecurrence || undefined
						);
						if (anchor !== undefined) {
							await plugin.updateTaskProperty(task, "recurrence_anchor", anchor);
						}
					} catch (error) {
						console.error("Error updating recurrence:", error);
						new Notice("Failed to update recurrence");
					}
				})();
			},
			app: plugin.app,
			plugin: plugin,
		});
		menu.show(e);
	};
}

/**
 * Creates a click handler for reminder indicator
 */
function createReminderClickHandler(task: TaskInfo, plugin: TaskNotesPlugin): () => void {
	return () => {
		const modal = new ReminderModal(plugin.app, plugin, task, (reminders) => {
			void (async () => {
				try {
					await plugin.updateTaskProperty(
						task,
						"reminders",
						reminders.length > 0 ? reminders : undefined
					);
				} catch (error) {
					console.error("Error updating reminders:", error);
					new Notice("Failed to update reminders");
				}
			})();
		});
		modal.open();
	};
}

/**
 * Creates a click handler for project indicator
 */
function createProjectClickHandler(task: TaskInfo, plugin: TaskNotesPlugin): () => void {
	return () => {
		void (async () => {
			try {
				await plugin.applyProjectSubtaskFilter(task);
			} catch (error) {
				console.error("Error filtering project subtasks:", error);
				new Notice("Failed to filter project subtasks");
			}
		})();
	};
}

/**
 * Creates a click handler for chevron (expand/collapse subtasks)
 */
function createChevronClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	chevron: HTMLElement
): () => void {
	return () => {
		void (async () => {
			try {
				if (!plugin.expandedProjectsService) {
					new Notice("Service not available. Please try reloading the plugin.");
					return;
				}
				const newExpanded = plugin.expandedProjectsService.toggle(task.path);
				chevron.classList.toggle("task-card__chevron--expanded", newExpanded);
				const newTooltip = getChevronTooltip(plugin, newExpanded);
				chevron.setAttribute("aria-label", newTooltip);
				setTooltip(chevron, newTooltip, { placement: "top" });
				await toggleSubtasks(card, task, plugin, newExpanded);
			} catch (error) {
				console.error("Error toggling subtasks:", error);
				new Notice("Failed to toggle subtasks");
			}
		})();
	};
}

/**
 * Creates a click handler for blocking toggle
 */
function createBlockingToggleClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	toggle: HTMLElement
): () => void {
	return () => {
		void (async () => {
			const expanded = toggle.classList.toggle("task-card__blocking-toggle--expanded");
			await toggleBlockingTasks(card, task, plugin, expanded);
		})();
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
	// Use fresh UTC-anchored "today" if no targetDate provided
	// This ensures recurring tasks show correct completion status for the current day
	const targetDate =
		opts.targetDate ||
		(() => {
			const todayLocal = new Date();
			return new Date(
				Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
			);
		})();

	// Determine effective status for recurring tasks
	const effectiveStatus = task.recurrence
		? getEffectiveTaskStatus(task, targetDate, plugin.statusManager.getCompletedStatuses()[0])
		: task.status;

	// Determine layout mode first
	const layout = opts.layout || "default";

	// Main container with BEM class structure
	// Use span for inline layout to ensure proper inline flow in CodeMirror
	const card = activeDocument.createElement(layout === "inline" ? "span" : "div");

	// Store task path for circular reference detection
	const taskCardElement = card as TaskCardElement;
	taskCardElement._taskPath = task.path;
	taskCardElement._taskCardOptions = opts;

	const isActivelyTracked = plugin.getActiveTimeSession(task) !== null;
	const isCompleted = task.recurrence
		? task.complete_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of complete_instances
		: plugin.statusManager.isCompletedStatus(effectiveStatus); // Regular tasks use status config
	const isSkipped = task.recurrence
		? task.skipped_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of skipped_instances
		: false; // Only recurring tasks can have skipped instances
	const isRecurring = !!task.recurrence;
	const hasDetails = taskHasDetails(task);

	// Build BEM class names
	const cardClasses = ["task-card"];

	// Add layout modifier
	if (layout !== "default") {
		cardClasses.push(`task-card--layout-${layout}`);
	}

	// Add modifiers
	if (isCompleted) cardClasses.push("task-card--completed");
	if (isSkipped) cardClasses.push("task-card--skipped");
	if (task.archived) cardClasses.push("task-card--archived");
	if (isActivelyTracked) cardClasses.push("task-card--actively-tracked");
	if (isRecurring) cardClasses.push("task-card--recurring");
	if (hasDetails) cardClasses.push("task-card--has-details");

	// Add priority modifier
	if (task.priority) {
		cardClasses.push(`task-card--priority-${task.priority}`);
	}

	// Add status modifier
	if (effectiveStatus) {
		cardClasses.push(`task-card--status-${effectiveStatus}`);
	}

	// Chevron position preference
	if (plugin.settings?.subtaskChevronPosition === "left") {
		cardClasses.push("task-card--chevron-left");
	}

	// Add project modifier (for issue #355)
	const hasProjects = filterEmptyProjects(task.projects || []).length > 0;
	if (hasProjects) {
		cardClasses.push("task-card--has-projects");
	}

	card.className = cardClasses.join(" ");
	card.dataset.taskPath = task.path;
	card.dataset.key = task.path; // For DOMReconciler compatibility
	card.dataset.status = effectiveStatus;
	card.dataset.hasDetails = hasDetails ? "true" : "false";

	// Create main row container for horizontal layout
	// Use span for inline layout to maintain inline flow
	const mainRow = card.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__main-row",
	});

	// Apply priority and status colors as CSS custom properties
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	if (priorityConfig) {
		card.style.setProperty("--priority-color", priorityConfig.color);
	}

	const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
	if (statusConfig) {
		card.style.setProperty("--current-status-color", statusConfig.color);
	}

	// Set next status color for hover preview
	const nextStatus = plugin.statusManager.getNextStatus(effectiveStatus);
	const nextStatusConfig = plugin.statusManager.getStatusConfig(nextStatus);
	if (nextStatusConfig) {
		card.style.setProperty("--next-status-color", nextStatusConfig.color);
	}

	// Status indicator dot (conditional based on visible properties and options)
	let statusDot: HTMLElement | null = null;
	const shouldShowStatus =
		!opts.hideStatusIndicator &&
		(!visibleProperties ||
			visibleProperties.some((prop) => isPropertyForField(prop, "status", plugin)));
	if (shouldShowStatus) {
		statusDot = mainRow.createEl("span", { cls: "task-card__status-dot" });
		if (statusConfig) {
			statusDot.style.borderColor = statusConfig.color;
			// If status has an icon configured, render it instead of colored dot
			if (statusConfig.icon) {
				statusDot.addClass("task-card__status-dot--icon");
				setIcon(statusDot, statusConfig.icon);
			}
		}
	}

	// Add click handler to cycle through statuses
	if (statusDot) {
		prepareInteractiveControl(statusDot);
		statusDot.addEventListener(
			"click",
			createStatusCycleHandler(task, plugin, card, statusDot, targetDate)
		);
	}

	// Priority indicator dot (conditional based on visible properties)
	const shouldShowPriority =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "priority", plugin));
	if (task.priority && priorityConfig && shouldShowPriority) {
		const priorityDot = mainRow.createEl("span", {
			cls: "task-card__priority-dot",
			attr: {
				"aria-label": tTaskCard(plugin, "priorityAriaLabel", {
					label: priorityConfig.label,
				}),
			},
		});
		priorityDot.style.borderColor = priorityConfig.color;
		prepareInteractiveControl(priorityDot);
		priorityDot.addEventListener("click", createPriorityClickHandler(task, plugin));
	}

	// Content container
	const contentContainer = mainRow.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__content",
	});

	// Badge area for secondary indicators (only in non-inline mode)
	const badgesContainer =
		layout !== "inline" ? mainRow.createEl("div", { cls: "task-card__badges" }) : null;

	if (badgesContainer && opts.showSecondaryBadges) {
		// Recurring indicator
		if (task.recurrence) {
			const recurrenceTooltip = getRecurrenceTooltip(
				plugin,
				task.recurrence,
				opts.propertyLabels
			);
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__recurring-indicator",
				icon: "rotate-ccw",
				tooltip: recurrenceTooltip,
				onClick: createRecurrenceClickHandler(task, plugin),
			});
		}

		// Reminder indicator
		if (task.reminders && task.reminders.length > 0) {
			const count = task.reminders.length;
			const reminderTooltip = getReminderTooltip(plugin, count);
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__reminder-indicator",
				icon: "bell",
				tooltip: reminderTooltip,
				onClick: createReminderClickHandler(task, plugin),
			});
		}

		// Details indicator
		if (hasDetails) {
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__details-indicator",
				icon: "file-text",
				tooltip: tTaskCard(plugin, "detailsTooltip"),
			});
		}

		// Project indicator
		const isProject = plugin.projectSubtasksService.isTaskUsedAsProjectSync(task.path);
		if (isProject) {
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__project-indicator",
				icon: "folder",
				tooltip: tTaskCard(plugin, "projectTooltip"),
				onClick: createProjectClickHandler(task, plugin),
			});

			// Chevron for expandable subtasks
			if (plugin.settings?.showExpandableSubtasks) {
				const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
				createBadgeIndicator({
					container: badgesContainer,
					className: `task-card__chevron${isExpanded ? " task-card__chevron--expanded" : ""}`,
					icon: "chevron-right",
					tooltip: getChevronTooltip(plugin, isExpanded),
					onClick: () => {
						const chevron = card.querySelector<HTMLElement>(".task-card__chevron");
						if (chevron) {
							void createChevronClickHandler(task, plugin, card, chevron)();
						}
					},
				});

				// Show subtasks if already expanded
				if (isExpanded) {
					toggleSubtasks(card, task, plugin, true).catch((error) => {
						console.error("Error showing initial subtasks:", error);
					});
				}
			}
		}

		// Blocking toggle
		const hasBlocking = task.blocking && task.blocking.length > 0;
		if (hasBlocking) {
			const blockingCount = task.blocking?.length ?? 0;
			const toggleLabel = plugin.i18n.translate("ui.taskCard.blockingToggle", {
				count: blockingCount,
			});
			createBadgeIndicator({
				container: badgesContainer,
				className: "task-card__blocking-toggle is-visible",
				icon: "git-branch",
				tooltip: toggleLabel,
				onClick: () => {
					const toggle = card.querySelector<HTMLElement>(".task-card__blocking-toggle");
					if (toggle) {
						void createBlockingToggleClickHandler(task, plugin, card, toggle)();
					}
				},
			});
		}
	}

	// Context menu icon (appears on hover)
	const contextIcon = mainRow.createEl("div", {
		cls: "task-card__context-menu",
		attr: {
			"aria-label": tTaskCard(plugin, "taskOptions"),
		},
	});

	// Use Obsidian's built-in ellipsis-vertical icon
	setIcon(contextIcon, "ellipsis-vertical");
	setTooltip(contextIcon, tTaskCard(plugin, "taskOptions"), { placement: "top" });
	prepareInteractiveControl(contextIcon);

	contextIcon.addEventListener("click", (e) => {
		e.stopPropagation();
		e.preventDefault();
		void showTaskContextMenu(e, task.path, plugin, targetDate);
	});

	// First line: Task title
	const titleEl = contentContainer.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__title",
	});
	const titleTextEl = titleEl.createSpan({ cls: "task-card__title-text", text: task.title });

	if (isCompleted) {
		titleEl.classList.add("completed");
		titleTextEl.classList.add("completed");
	}

	// Second line: Metadata (dynamic based on visible properties)
	const metadataLine = contentContainer.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__metadata",
	});
	const metadataElements: HTMLElement[] = [];

	// Get properties to display
	const propertiesToShow =
		visibleProperties ||
		(plugin.settings.defaultVisibleProperties
			? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
			: getDefaultVisibleProperties(plugin));

	// Render each visible property
	for (const propertyId of propertiesToShow) {
		// Skip status and priority as they're rendered separately
		if (
			isPropertyForField(propertyId, "status", plugin) ||
			isPropertyForField(propertyId, "priority", plugin)
		) {
			continue;
		}

		if (propertyId === "blocked") {
			if (task.isBlocked) {
				const blockedLabel = plugin.i18n.translate("ui.taskCard.blockedBadge");
				const blockedCount = task.blockedBy?.length ?? 0;
				const pillText =
					blockedCount > 0 ? `${blockedLabel} (${blockedCount})` : blockedLabel;
				const blockedPill = metadataLine.createSpan({
					cls: "task-card__metadata-pill task-card__metadata-pill--blocked",
					text: pillText,
				});
				setTooltip(blockedPill, plugin.i18n.translate("ui.taskCard.blockedBadgeTooltip"), {
					placement: "top",
				});
				metadataElements.push(blockedPill);
			}
			continue;
		}

		if (propertyId === "blocking") {
			if (task.isBlocking) {
				const blockingLabel = plugin.i18n.translate("ui.taskCard.blockingBadge");
				const blockingCount = task.blocking?.length ?? 0;
				const pillText =
					blockingCount > 0 ? `${blockingLabel} (${blockingCount})` : blockingLabel;
				const blockingPill = metadataLine.createSpan({
					cls: "task-card__metadata-pill task-card__metadata-pill--blocking",
					text: pillText,
				});
				setTooltip(
					blockingPill,
					plugin.i18n.translate("ui.taskCard.blockingBadgeTooltip"),
					{ placement: "top" }
				);
				metadataElements.push(blockingPill);
			}
			continue;
		}

		// Google Calendar sync indicator
		if (propertyId === "googleCalendarSync") {
			// Check if task has a Google Calendar event ID in frontmatter
			if (task.googleCalendarEventId) {
				const syncPill = metadataLine.createSpan({
					cls: "task-card__metadata-pill task-card__metadata-pill--google-calendar",
				});
				// Add calendar icon
				setIcon(syncPill, "calendar");
				setTooltip(
					syncPill,
					plugin.i18n.translate("ui.taskCard.googleCalendarSyncTooltip"),
					{ placement: "top" }
				);
				metadataElements.push(syncPill);
			}
			continue;
		}

		const element = renderPropertyMetadata(metadataLine, propertyId, task, plugin, opts);
		if (element) {
			metadataElements.push(element);
		}
	}

	// Show/hide metadata line based on content
	updateMetadataVisibility(metadataLine, metadataElements);

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
 * Show context menu for task card
 */
export async function showTaskContextMenu(
	event: MouseEvent,
	taskPath: string,
	plugin: TaskNotesPlugin,
	targetDate: Date
) {
	const file = plugin.app.vault.getAbstractFileByPath(taskPath);
	const showFileMenuFallback = () => {
		if (file instanceof TFile) {
			showFileContextMenu(event, file, plugin);
		}
	};

	try {
		// Always fetch fresh task data - ignore any stale captured data
		const task = await plugin.cacheManager.getTaskInfo(taskPath);
		if (!task) {
			showFileMenuFallback();
			return;
		}

		const contextMenu = new TaskContextMenu({
			task: task,
			plugin: plugin,
			targetDate: targetDate,
			onUpdate: () => {
				// Trigger refresh of views
				plugin.app.workspace.trigger("tasknotes:refresh-views");
			},
		});

		contextMenu.show(event);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Error creating context menu:", {
			error: errorMessage,
			taskPath,
		});
		new Notice(`Failed to create context menu: ${errorMessage}`);
		showFileMenuFallback();
	}
}

function showFileContextMenu(event: MouseEvent, file: TFile, plugin: TaskNotesPlugin) {
	const menu = new Menu();

	let populated = false;
	try {
		plugin.app.workspace.trigger("file-menu", menu, file, "tasknotes-bases-view");
		populated = ((menu as MenuWithItems).items?.length ?? 0) > 0;
	} catch {
		populated = false;
	}

	if (!populated) {
		menu.addItem((item) => {
			item.setTitle("Open");
			item.setIcon("file-text");
			item.onClick(() => {
				void plugin.app.workspace.getLeaf(false).openFile(file);
			});
		});
		menu.addItem((item) => {
			item.setTitle("Open in new tab");
			item.setIcon("external-link");
			item.onClick(() => {
				void plugin.app.workspace.openLinkText(file.path, "", true);
			});
		});
	}

	menu.showAtMouseEvent(event);
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
	// Use fresh UTC-anchored "today" if no targetDate provided
	// This ensures recurring tasks show correct completion status for the current day
	const targetDate =
		opts.targetDate ||
		(() => {
			const todayLocal = new Date();
			return new Date(
				Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
			);
		})();

	// Update effective status
	const effectiveStatus = task.recurrence
		? getEffectiveTaskStatus(task, targetDate, plugin.statusManager.getCompletedStatuses()[0])
		: task.status;

	// Update main element classes using BEM structure
	const isActivelyTracked = plugin.getActiveTimeSession(task) !== null;
	const isCompleted = task.recurrence
		? task.complete_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of complete_instances
		: plugin.statusManager.isCompletedStatus(effectiveStatus); // Regular tasks use status config
	const isSkipped = task.recurrence
		? task.skipped_instances?.includes(formatDateForStorage(targetDate)) || false // Direct check of skipped_instances
		: false; // Only recurring tasks can have skipped instances
	const isRecurring = !!task.recurrence;
	const hasDetails = taskHasDetails(task);

	// Build BEM class names for update
	const cardClasses = ["task-card"];

	// Add modifiers
	if (isCompleted) cardClasses.push("task-card--completed");
	if (isSkipped) cardClasses.push("task-card--skipped");
	if (task.archived) cardClasses.push("task-card--archived");
	if (isActivelyTracked) cardClasses.push("task-card--actively-tracked");
	if (isRecurring) cardClasses.push("task-card--recurring");
	if (hasDetails) cardClasses.push("task-card--has-details");

	// Add priority modifier
	if (task.priority) {
		cardClasses.push(`task-card--priority-${task.priority}`);
	}

	// Add status modifier
	if (effectiveStatus) {
		cardClasses.push(`task-card--status-${effectiveStatus}`);
	}

	// Chevron position preference
	if (plugin.settings?.subtaskChevronPosition === "left") {
		cardClasses.push("task-card--chevron-left");
	}

	element.className = cardClasses.join(" ");
	element.dataset.status = effectiveStatus;
	element.dataset.hasDetails = hasDetails ? "true" : "false";

	// Get the main row container
	const mainRow = element.querySelector(".task-card__main-row") as HTMLElement;

	// Update priority and status colors
	const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
	if (priorityConfig) {
		element.style.setProperty("--priority-color", priorityConfig.color);
	}

	const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
	if (statusConfig) {
		element.style.setProperty("--current-status-color", statusConfig.color);
	}

	// Update next status color for hover preview
	const nextStatus = plugin.statusManager.getNextStatus(effectiveStatus);
	const nextStatusConfig = plugin.statusManager.getStatusConfig(nextStatus);
	if (nextStatusConfig) {
		element.style.setProperty("--next-status-color", nextStatusConfig.color);
	}

	// Update checkbox if present
	const checkbox = element.querySelector(".task-card__checkbox") as HTMLInputElement;
	if (checkbox) {
		checkbox.checked = plugin.statusManager.isCompletedStatus(effectiveStatus);
	}

	// Update status dot (conditional based on visible properties)
	const shouldShowStatus =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "status", plugin));
	const statusDot = element.querySelector(".task-card__status-dot") as HTMLElement;

	if (shouldShowStatus) {
		if (statusDot) {
			// Update existing dot
			if (statusConfig) {
				statusDot.style.borderColor = statusConfig.color;
			}
		} else if (mainRow) {
			// Add missing dot
			const newStatusDot = mainRow.createEl("span", { cls: "task-card__status-dot" });
			if (statusConfig) {
				newStatusDot.style.borderColor = statusConfig.color;
			}
			prepareInteractiveControl(newStatusDot);
			newStatusDot.addEventListener(
				"click",
				createStatusCycleHandler(task, plugin, element, newStatusDot, targetDate)
			);

			// Insert at the beginning after checkbox
			const checkbox = element.querySelector(".task-card__checkbox");
			if (checkbox) {
				checkbox.insertAdjacentElement("afterend", newStatusDot);
			} else {
				mainRow.insertBefore(newStatusDot, mainRow.firstChild);
			}
		}
	} else if (statusDot) {
		// Remove dot if it shouldn't be visible
		statusDot.remove();
	}

	// Update priority indicator (conditional based on visible properties)
	const shouldShowPriority =
		!visibleProperties ||
		visibleProperties.some((prop) => isPropertyForField(prop, "priority", plugin));
	const existingPriorityDot = element.querySelector(".task-card__priority-dot") as HTMLElement;

	if (shouldShowPriority && task.priority && priorityConfig) {
		if (!existingPriorityDot && mainRow) {
			// Add priority dot if task has priority but no dot exists
			const priorityDot = mainRow.createEl("span", {
				cls: "task-card__priority-dot",
				attr: { "aria-label": `Priority: ${priorityConfig.label}` },
			});
			priorityDot.style.borderColor = priorityConfig.color;
			prepareInteractiveControl(priorityDot);

			// Add click context menu for priority
			priorityDot.addEventListener("click", (e) => {
				e.stopPropagation(); // Don't trigger card click
				const menu = new PriorityContextMenu({
					currentValue: task.priority,
					onSelect: (newPriority) => {
						void (async () => {
							try {
								await plugin.updateTaskProperty(task, "priority", newPriority);
							} catch (error) {
								console.error("Error updating priority:", error);
								new Notice("Failed to update priority");
							}
						})();
					},
					plugin: plugin,
				});
				menu.show(e);
			});

			// Insert after status dot if it exists, otherwise after checkbox
			const statusDotForInsert = element.querySelector(".task-card__status-dot");
			const checkbox = element.querySelector(".task-card__checkbox");
			if (statusDotForInsert) {
				statusDotForInsert.insertAdjacentElement("afterend", priorityDot);
			} else if (checkbox) {
				checkbox.insertAdjacentElement("afterend", priorityDot);
			} else {
				mainRow.insertBefore(priorityDot, mainRow.firstChild);
			}
		} else if (existingPriorityDot) {
			// Update existing priority dot
			existingPriorityDot.style.borderColor = priorityConfig.color;
			existingPriorityDot.setAttribute("aria-label", `Priority: ${priorityConfig.label}`);

			// Remove old event listener and add new one with updated task data
			const newPriorityDot = existingPriorityDot.cloneNode(true) as HTMLElement;
			prepareInteractiveControl(newPriorityDot);
			newPriorityDot.addEventListener("click", (e) => {
				e.stopPropagation(); // Don't trigger card click
				const menu = new PriorityContextMenu({
					currentValue: task.priority,
					onSelect: (newPriority) => {
						void (async () => {
							try {
								await plugin.updateTaskProperty(task, "priority", newPriority);
							} catch (error) {
								console.error("Error updating priority:", error);
								new Notice("Failed to update priority");
							}
						})();
					},
					plugin: plugin,
				});
				menu.show(e);
			});
			existingPriorityDot.replaceWith(newPriorityDot);
		}
	} else if (existingPriorityDot) {
		// Remove priority dot if it shouldn't be visible or task no longer has priority
		existingPriorityDot.remove();
	}

	// Update badge indicators using helper
	const badgesContainer = element.querySelector(".task-card__badges") as HTMLElement;

	// Update recurring indicator
	const recurrenceTooltip = task.recurrence
		? getRecurrenceTooltip(plugin, task.recurrence, opts.propertyLabels)
		: "";
	updateBadgeIndicator(element, ".task-card__recurring-indicator", {
		shouldExist: !!task.recurrence,
		className: "task-card__recurring-indicator",
		icon: "rotate-ccw",
		tooltip: recurrenceTooltip,
		onClick: createRecurrenceClickHandler(task, plugin),
	});

	// Update reminder indicator
	const hasReminders = !!(task.reminders && task.reminders.length > 0);
	const reminderCount = task.reminders?.length || 0;
	const reminderTooltip = getReminderTooltip(plugin, reminderCount);
	updateBadgeIndicator(element, ".task-card__reminder-indicator", {
		shouldExist: hasReminders,
		className: "task-card__reminder-indicator",
		icon: "bell",
		tooltip: reminderTooltip,
		onClick: createReminderClickHandler(task, plugin),
	});

	// Update details indicator
	updateBadgeIndicator(element, ".task-card__details-indicator", {
		shouldExist: hasDetails,
		className: "task-card__details-indicator",
		icon: "file-text",
		tooltip: tTaskCard(plugin, "detailsTooltip"),
	});

	// Update project indicator and chevron (async)
	plugin.projectSubtasksService
		.isTaskUsedAsProject(task.path)
		.then((isProject: boolean) => {
			// Remove old placeholders if they exist
			element.querySelector(".task-card__project-indicator-placeholder")?.remove();
			element.querySelector(".task-card__chevron-placeholder")?.remove();

			// Update project indicator
			updateBadgeIndicator(element, ".task-card__project-indicator", {
				shouldExist: isProject,
				className: "task-card__project-indicator",
				icon: "folder",
				tooltip: tTaskCard(plugin, "projectTooltip"),
				onClick: createProjectClickHandler(task, plugin),
			});

			// Update chevron
			const showChevron = isProject && plugin.settings?.showExpandableSubtasks;
			const existingChevron = element.querySelector(".task-card__chevron") as HTMLElement;

			if (showChevron && !existingChevron) {
				const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
				createBadgeIndicator({
					container: badgesContainer || mainRow,
					className: `task-card__chevron${isExpanded ? " task-card__chevron--expanded" : ""}`,
					icon: "chevron-right",
					tooltip: getChevronTooltip(plugin, isExpanded),
					onClick: () => {
						const chevron = element.querySelector<HTMLElement>(".task-card__chevron");
						if (chevron) {
							void createChevronClickHandler(task, plugin, element, chevron)();
						}
					},
				});

				if (isExpanded) {
					toggleSubtasks(element, task, plugin, true).catch((error) => {
						console.error("Error showing initial subtasks in update:", error);
					});
				}
			} else if (!showChevron && existingChevron) {
				existingChevron.remove();
				// Clean up subtasks container
				const subtasksContainer =
					element.querySelector<HTMLElement>(".task-card__subtasks");
				if (subtasksContainer) {
					const taskCardSubtasks = subtasksContainer as TaskCardElement;
					const clickHandler = taskCardSubtasks._clickHandler;
					if (clickHandler) {
						subtasksContainer.removeEventListener("click", clickHandler);
						delete taskCardSubtasks._clickHandler;
					}
					subtasksContainer.remove();
				}
			}
		})
		.catch((error: unknown) => {
			console.error("Error checking if task is used as project in update:", error);
		});

	const blockingToggleEl = element.querySelector(".task-card__blocking-toggle") as HTMLElement;
	if (blockingToggleEl) {
		if (task.blocking && task.blocking.length > 0) {
			blockingToggleEl.classList.add("is-visible");
			blockingToggleEl.classList.remove("is-hidden");
			const toggleLabel = plugin.i18n.translate("ui.taskCard.blockingToggle", {
				count: task.blocking.length,
			});
			blockingToggleEl.setAttribute("aria-label", toggleLabel);
			setTooltip(blockingToggleEl, toggleLabel, { placement: "top" });
			blockingToggleEl.dataset.count = String(task.blocking.length);
			if (blockingToggleEl.classList.contains("task-card__blocking-toggle--expanded")) {
				toggleBlockingTasks(element, task, plugin, true).catch((error) => {
					console.error("Error refreshing blocking tasks:", error);
				});
			}
		} else {
			blockingToggleEl.classList.remove("is-visible", "task-card__blocking-toggle--expanded");
			blockingToggleEl.classList.add("is-hidden");
			const existingBlockingContainer = element.querySelector(".task-card__blocking");
			if (existingBlockingContainer) {
				existingBlockingContainer.remove();
			}
		}
	}

	// Update title
	const titleText = element.querySelector(".task-card__title-text") as HTMLElement;
	const titleContainer = element.querySelector(".task-card__title") as HTMLElement;
	const titleIsCompleted = isCompleted;
	if (titleText) {
		titleText.textContent = task.title;
		titleText.classList.toggle("completed", titleIsCompleted);
	}
	if (titleContainer) {
		titleContainer.classList.toggle("completed", titleIsCompleted);
	}

	const legacyBlockedBadge = element.querySelector(".task-card__badge--blocked");
	if (legacyBlockedBadge) {
		legacyBlockedBadge.remove();
	}

	// Update metadata line
	const metadataLine = element.querySelector(".task-card__metadata") as HTMLElement;
	if (metadataLine) {
		// Clear the metadata line and rebuild with DOM elements to support project links
		metadataLine.innerHTML = "";
		const metadataElements: HTMLElement[] = [];

		// Get properties to display
		const propertiesToShow =
			visibleProperties ||
			(plugin.settings.defaultVisibleProperties
				? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
				: getDefaultVisibleProperties(plugin));

		for (const propertyId of propertiesToShow) {
			// Skip status and priority as they're rendered separately
			if (
				isPropertyForField(propertyId, "status", plugin) ||
				isPropertyForField(propertyId, "priority", plugin)
			) {
				continue;
			}

			if (propertyId === "blocked") {
				if (task.isBlocked) {
					const blockedLabel = plugin.i18n.translate("ui.taskCard.blockedBadge");
					const blockedCount = task.blockedBy?.length ?? 0;
					const pillText =
						blockedCount > 0 ? `${blockedLabel} (${blockedCount})` : blockedLabel;
					const blockedPill = metadataLine.createSpan({
						cls: "task-card__metadata-pill task-card__metadata-pill--blocked",
						text: pillText,
					});
					setTooltip(
						blockedPill,
						plugin.i18n.translate("ui.taskCard.blockedBadgeTooltip"),
						{ placement: "top" }
					);
					metadataElements.push(blockedPill);
				}
				continue;
			}

			if (propertyId === "blocking") {
				if (task.isBlocking) {
					const blockingLabel = plugin.i18n.translate("ui.taskCard.blockingBadge");
					const blockingCount = task.blocking?.length ?? 0;
					const pillText =
						blockingCount > 0 ? `${blockingLabel} (${blockingCount})` : blockingLabel;
					const blockingPill = metadataLine.createSpan({
						cls: "task-card__metadata-pill task-card__metadata-pill--blocking",
						text: pillText,
					});
					setTooltip(
						blockingPill,
						plugin.i18n.translate("ui.taskCard.blockingBadgeTooltip"),
						{ placement: "top" }
					);
					metadataElements.push(blockingPill);
				}
				continue;
			}

			const element = renderPropertyMetadata(metadataLine, propertyId, task, plugin, opts);
			if (element) {
				metadataElements.push(element);
			}
		}

		// Hide metadata line if empty
		updateMetadataVisibility(metadataLine, metadataElements);
	}

	// Animation is now handled separately - don't add it here during reconciler updates
}

/**
 * Clean up event listeners and resources for a task card
 */
export function cleanupTaskCard(card: HTMLElement): void {
	// Clean up subtasks container if it exists
	const subtasksContainer = card.querySelector<HTMLElement>(".task-card__subtasks");
	if (subtasksContainer) {
		// Clean up the click handler
		const taskCardSubtasks = subtasksContainer as TaskCardElement;
		const clickHandler = taskCardSubtasks._clickHandler;
		if (clickHandler) {
			subtasksContainer.removeEventListener("click", clickHandler);
			delete taskCardSubtasks._clickHandler;
		}
	}

	// Note: Other event listeners on the card itself are automatically cleaned up
	// when the card is removed from the DOM. We only need to manually clean up
	// listeners that we store references to.
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
	try {
		let subtasksContainer = card.querySelector(".task-card__subtasks") as HTMLElement;

		if (expanded) {
			// Show subtasks
			if (!subtasksContainer) {
				// Create subtasks container after the main content
				// Use card.ownerDocument for pop-out window support
				subtasksContainer = card.ownerDocument.createElement("div");
				subtasksContainer.className = "task-card__subtasks";

				// Prevent clicks inside subtasks container from bubbling to parent card
				const clickHandler = (e: Event) => {
					e.stopPropagation();
				};
				subtasksContainer.addEventListener("click", clickHandler);

				// Store handler reference for cleanup
				(subtasksContainer as TaskCardElement)._clickHandler = clickHandler;
				bindNestedCardHoverState(subtasksContainer, card);

				card.appendChild(subtasksContainer);
			}

			// Clear existing content properly (this will clean up subtask event listeners)
			while (subtasksContainer.firstChild) {
				subtasksContainer.removeChild(subtasksContainer.firstChild);
			}

			// Show loading state
			const loadingEl = subtasksContainer.createEl("div", {
				cls: "task-card__subtasks-loading",
				text: plugin.i18n.translate("contextMenus.task.subtasks.loading"),
			});

			try {
				// Get the file for this task
				const file = plugin.app.vault.getAbstractFileByPath(task.path);
				if (!(file instanceof TFile)) {
					throw new Error("Task file not found");
				}

				// Get subtasks
				if (!plugin.projectSubtasksService) {
					throw new Error("projectSubtasksService not initialized");
				}

				const subtasks = filterExpandedRelationshipTasks(
					card,
					await plugin.projectSubtasksService.getTasksLinkedToProject(file)
				);

				// Remove loading indicator
				loadingEl.remove();

				if (subtasks.length === 0) {
					subtasksContainer.createEl("div", {
						cls: "task-card__subtasks-loading",
						text: plugin.i18n.translate("contextMenus.task.subtasks.noSubtasks"),
					});
					return;
				}

				// Sort subtasks
				const sortedSubtasks = plugin.projectSubtasksService.sortTasks(subtasks);

				// Build parent chain by traversing up the DOM hierarchy
				const buildParentChain = (element: HTMLElement): string[] => {
					const chain: string[] = [];
					let current = element.closest(".task-card");

					while (current) {
						const taskPath = (current as TaskCardElement)._taskPath;
						if (typeof taskPath === "string") {
							chain.unshift(taskPath); // Add to beginning
						}
						// Find next parent task card (skip current)
						current = current.parentElement?.closest(".task-card") as HTMLElement;
					}
					return chain;
				};

				const parentChain = buildParentChain(card);

				// Render each subtask (but prevent circular references)
				for (const subtask of sortedSubtasks) {
					// Check for circular reference in the parent chain
					if (parentChain.includes(subtask.path)) {
						console.warn("Circular reference detected in task chain:", {
							subtask: subtask.path,
							parentChain,
							cycle: [...parentChain, subtask.path],
						});
						continue;
					}

					const subtaskCard = createTaskCard(
						subtask,
						plugin,
						undefined,
						getStoredTaskCardOptions(card)
					);

					// Add subtask modifier class
					subtaskCard.classList.add("task-card--subtask");

					subtasksContainer.appendChild(subtaskCard);
				}
			} catch (error) {
				console.error("Error loading subtasks:", error);
				loadingEl.textContent = plugin.i18n.translate(
					"contextMenus.task.subtasks.loadFailed"
				);
			}
		} else {
			// Hide subtasks
			if (subtasksContainer) {
				// Clean up the click handler
				const taskCardSubtasks = subtasksContainer as TaskCardElement;
				const clickHandler = taskCardSubtasks._clickHandler;
				if (clickHandler) {
					subtasksContainer.removeEventListener("click", clickHandler);
					delete taskCardSubtasks._clickHandler;
				}

				// Remove the container (this will also clean up child elements and their listeners)
				subtasksContainer.remove();
			}
		}
	} catch (error) {
		console.error("Error in toggleSubtasks:", error);
		throw error;
	}
}

export async function toggleBlockingTasks(
	card: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	shouldExpand: boolean
): Promise<void> {
	let container = card.querySelector<HTMLElement>(".task-card__blocking");

	if (!shouldExpand) {
		if (container) {
			card.classList.remove("task-card--nested-interactive-hover");
			container.remove();
		}
		return;
	}

	if (!container) {
		container = card.createDiv({ cls: "task-card__blocking" });
		bindNestedCardHoverState(container, card);
		// Prevent clicks within the dependency list from bubbling up to the parent card.
		// Otherwise both the blocking task and the dependent task modals would open.
		container.addEventListener("click", (event) => event.stopPropagation());
		container.addEventListener("dblclick", (event) => event.stopPropagation());
		container.addEventListener("contextmenu", (event) => event.stopPropagation());
	}

	container.empty();
	const loadingEl = container.createDiv({
		cls: "task-card__blocking-loading",
		text: plugin.i18n.translate("ui.taskCard.loadingDependencies"),
	});

	try {
		const dependentInfos = task.blocking
			? await Promise.all(task.blocking.map((path) => plugin.cacheManager.getTaskInfo(path)))
			: [];
		const dependents = filterExpandedRelationshipTasks(
			card,
			dependentInfos.filter((info): info is TaskInfo => Boolean(info))
		);

		loadingEl.remove();

		if (dependents.length === 0) {
			container.createDiv({
				cls: "task-card__blocking-empty",
				text: plugin.i18n.translate("ui.taskCard.blockingEmpty"),
			});
			return;
		}

		dependents.forEach((dependentTask) => {
			const dependentCard = createTaskCard(
				dependentTask,
				plugin,
				undefined,
				getStoredTaskCardOptions(card)
			);
			dependentCard.classList.add("task-card--dependency");
			if (container) {
				container.appendChild(dependentCard);
			}
		});
	} catch (error) {
		console.error("Error loading blocking tasks:", error);
		loadingEl.textContent = plugin.i18n.translate("ui.taskCard.blockingLoadError");
	}
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
	// Only process if the updated task has projects (i.e., is a subtask)
	if (!updatedTask || !updatedTask.projects || updatedTask.projects.length === 0) {
		return;
	}

	// Wait for cache to contain the updated task data to prevent race condition
	// Try to get the updated task from cache, with a short retry loop
	let attempts = 0;
	const maxAttempts = 10; // Max 100ms wait
	while (attempts < maxAttempts) {
		try {
			const cachedTask = await plugin.cacheManager.getTaskInfo(updatedTask.path);
			if (cachedTask && cachedTask.dateModified === updatedTask.dateModified) {
				// Cache has been updated
				break;
			}
		} catch {
			// Cache not ready yet
		}
		await new Promise((resolve) => window.setTimeout(resolve, 10));
		attempts++;
	}

	// Find all expanded project task cards in the container
	const expandedChevrons = container.querySelectorAll(".task-card__chevron--expanded");

	for (const chevron of expandedChevrons) {
		const taskCard = chevron.closest(".task-card") as HTMLElement;
		if (!taskCard) continue;

		const projectTaskPath = taskCard.dataset.taskPath;
		if (!projectTaskPath) continue;

		// Check if this project task is referenced by the updated subtask
		const projectFile = plugin.app.vault.getAbstractFileByPath(projectTaskPath);
		if (!(projectFile instanceof TFile)) continue;

		const projectFileName = projectFile.basename;

		// Check if the updated task references this project
		const isSubtaskOfThisProject = updatedTask.projects.flat(2).some((project) => {
			if (
				project &&
				typeof project === "string" &&
				project.startsWith("[[") &&
				project.endsWith("]]")
			) {
				const linkContent = project.slice(2, -2).trim();
				const linkedNoteName = parseLinktext(linkContent).path;
				// Check both exact match and resolved file match
				const resolvedFile = plugin.app.metadataCache.getFirstLinkpathDest(
					linkedNoteName,
					""
				);
				return (
					linkedNoteName === projectFileName ||
					(resolvedFile && resolvedFile.path === projectTaskPath)
				);
			}
			return project === projectFileName || project === projectTaskPath;
		});

		if (isSubtaskOfThisProject) {
			// Find the subtasks container
			const subtasksContainer = taskCard.querySelector(".task-card__subtasks") as HTMLElement;
			if (subtasksContainer) {
				// Re-render the subtasks by calling toggleSubtasks
				try {
					// Get the parent task info
					const parentTask = await plugin.cacheManager.getTaskInfo(projectTaskPath);
					if (parentTask) {
						// Clear and re-render subtasks
						await toggleSubtasks(taskCard, parentTask, plugin, true);
					}
				} catch (error) {
					console.error("Error refreshing parent task subtasks:", error);
				}
			}
		}
	}
}
