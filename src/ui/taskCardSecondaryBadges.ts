import { Notice, setTooltip } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import {
	createRecurrenceClickHandler,
	createReminderClickHandler,
} from "./taskCardActions";
import { getChevronTooltip, getRecurrenceTooltip, getReminderTooltip } from "./taskCardHelpers";
import {
	createBadgeIndicator,
	updateBadgeIndicator,
} from "./taskCardIndicators";
import { removeRelationshipContainer } from "./taskCardRelationshipExpansion";
import { getBlockedByTaskPaths } from "./taskCardRelationships";
import { type TaskCardPresentationOptions } from "./taskCardPresentation";

export interface TaskCardSecondaryBadgeOptions {
	propertyLabels?: TaskCardPresentationOptions["propertyLabels"];
	showSecondaryBadges?: boolean;
}

export interface TaskCardSecondaryBadgeHandlers {
	toggleSubtasks(card: HTMLElement, task: TaskInfo, expanded: boolean): Promise<void>;
	toggleBlockingTasks(card: HTMLElement, task: TaskInfo, expanded: boolean): Promise<void>;
	toggleBlockedByTasks(card: HTMLElement, task: TaskInfo, expanded: boolean): Promise<void>;
}

export interface RenderTaskCardSecondaryBadgesOptions {
	card: HTMLElement;
	badgesContainer: HTMLElement | null;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	hasDetails: boolean;
	propertyOptions: TaskCardSecondaryBadgeOptions;
	handlers: TaskCardSecondaryBadgeHandlers;
}

export interface UpdateTaskCardSecondaryBadgesOptions {
	card: HTMLElement;
	mainRow: HTMLElement | null;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	hasDetails: boolean;
	propertyOptions: TaskCardSecondaryBadgeOptions;
	handlers: TaskCardSecondaryBadgeHandlers;
}

export interface ToggleBlockedByExpansionOptions {
	card: HTMLElement;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	handlers: Pick<TaskCardSecondaryBadgeHandlers, "toggleBlockedByTasks">;
}

const SECONDARY_BADGE_SELECTORS = [
	".task-card__recurring-indicator",
	".task-card__reminder-indicator",
	".task-card__details-indicator",
	".task-card__project-indicator",
	".task-card__chevron",
	".task-card__blocking-toggle",
	".task-card__blocked-toggle",
];

function getTaskCardBadgeLogger(plugin: TaskNotesPlugin) {
	return createTaskNotesLogger({
		tag: "TaskCard/Badges",
		isDebugEnabled: () => plugin.settings.enableDebugLogging,
	});
}

function tTaskCard(
	plugin: TaskNotesPlugin,
	key: string,
	vars?: Record<string, string | number>
): string {
	return plugin.i18n.translate(`ui.taskCard.${key}`, vars);
}

function shouldExpandSubtasksByDefault(plugin: TaskNotesPlugin): boolean {
	return plugin.settings?.expandSubtasksByDefault === true;
}

export function isTaskCardSubtasksExpanded(task: TaskInfo, plugin: TaskNotesPlugin): boolean {
	return (
		plugin.expandedProjectsService?.isExpanded(
			task.path,
			shouldExpandSubtasksByDefault(plugin)
		) || false
	);
}

function removeSecondaryBadges(card: HTMLElement): void {
	for (const selector of SECONDARY_BADGE_SELECTORS) {
		for (const badge of card.querySelectorAll(selector)) {
			badge.remove();
		}
	}
	removeRelationshipContainer(card, ".task-card__subtasks");
	removeRelationshipContainer(card, ".task-card__blocking");
	removeRelationshipContainer(card, ".task-card__blocked-by");
}

function updateChevronElement(
	chevron: HTMLElement,
	plugin: TaskNotesPlugin,
	expanded: boolean
): void {
	chevron.classList.toggle("task-card__chevron--expanded", expanded);
	const tooltip = getChevronTooltip(plugin, expanded);
	chevron.setAttribute("aria-label", tooltip);
	setTooltip(chevron, tooltip, { placement: "top" });
}

function createChevronClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	handlers: TaskCardSecondaryBadgeHandlers
): () => void {
	return () => {
		void (async () => {
			const logger = getTaskCardBadgeLogger(plugin);
			try {
				if (!plugin.expandedProjectsService) {
					new Notice("Service not available. Please try reloading the plugin.");
					return;
				}

				const chevron = card.querySelector<HTMLElement>(".task-card__chevron");
				if (!chevron) {
					return;
				}

				const newExpanded = plugin.expandedProjectsService.toggle(
					task.path,
					shouldExpandSubtasksByDefault(plugin)
				);
				updateChevronElement(chevron, plugin, newExpanded);
				await handlers.toggleSubtasks(card, task, newExpanded);
			} catch (error) {
				logger.error("Error toggling subtasks", {
					category: "internal",
					operation: "toggle-subtasks",
					details: { taskPath: task.path },
					error,
				});
				new Notice("Failed to toggle subtasks");
			}
		})();
	};
}

/**
 * Toggles the inline subtask list for a project task card. Used by the folder
 * (project) badge so it works whether or not the expand chevron is rendered,
 * keeping the chevron visual in sync when it is present. Shares expansion state
 * with the chevron via expandedProjectsService, so the two never diverge.
 */
function createProjectSubtasksToggleHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	handlers: TaskCardSecondaryBadgeHandlers
): () => void {
	return () => {
		void (async () => {
			const logger = getTaskCardBadgeLogger(plugin);
			try {
				if (!plugin.expandedProjectsService) {
					new Notice("Service not available. Please try reloading the plugin.");
					return;
				}

				const newExpanded = plugin.expandedProjectsService.toggle(
					task.path,
					shouldExpandSubtasksByDefault(plugin)
				);

				const chevron = card.querySelector<HTMLElement>(".task-card__chevron");
				if (chevron) {
					updateChevronElement(chevron, plugin, newExpanded);
				}

				await handlers.toggleSubtasks(card, task, newExpanded);
			} catch (error) {
				logger.error("Error toggling project subtasks", {
					category: "internal",
					operation: "toggle-project-subtasks",
					details: { taskPath: task.path },
					error,
				});
				new Notice("Failed to toggle subtasks");
			}
		})();
	};
}

function createBlockingToggleClickHandler(
	task: TaskInfo,
	card: HTMLElement,
	handlers: TaskCardSecondaryBadgeHandlers
): () => void {
	return () => {
		void (async () => {
			const toggle = card.querySelector<HTMLElement>(".task-card__blocking-toggle");
			if (!toggle) {
				return;
			}
			const expanded = toggle.classList.toggle("task-card__blocking-toggle--expanded");
			await handlers.toggleBlockingTasks(card, task, expanded);
		})();
	};
}

function createBlockedByToggleClickHandler(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	card: HTMLElement,
	handlers: TaskCardSecondaryBadgeHandlers
): () => void {
	return () => {
		void toggleTaskCardBlockedByExpansion({ card, task, plugin, handlers });
	};
}

export function syncTaskCardBlockedByExpansionControls(
	card: HTMLElement,
	expanded: boolean
): void {
	const toggle = card.querySelector<HTMLElement>(".task-card__blocked-toggle");
	if (toggle) {
		toggle.classList.toggle("task-card__blocked-toggle--expanded", expanded);
		toggle.setAttribute("aria-expanded", String(expanded));
	}

	for (const pill of card.querySelectorAll<HTMLElement>(".task-card__metadata-pill--blocked")) {
		if (pill.getAttribute("role") === "button") {
			pill.setAttribute("aria-expanded", String(expanded));
		}
	}
}

export async function toggleTaskCardBlockedByExpansion(
	options: ToggleBlockedByExpansionOptions
): Promise<void> {
	const { card, task, handlers } = options;
	const expanded = !card.querySelector(".task-card__blocked-by");
	syncTaskCardBlockedByExpansionControls(card, expanded);
	await handlers.toggleBlockedByTasks(card, task, expanded);
}

function renderProjectBadges(
	options: RenderTaskCardSecondaryBadgesOptions,
	badgesContainer: HTMLElement
): void {
	const { card, task, plugin, handlers } = options;
	const isProject = plugin.projectSubtasksService.isTaskUsedAsProjectSync(task.path);
	if (!isProject) {
		return;
	}

	const isExpanded = isTaskCardSubtasksExpanded(task, plugin);

	// The folder badge toggles the inline subtask list. It is always rendered for
	// a project and works on its own, so subtasks remain reachable from the card
	// even when the expand chevron is disabled.
	createBadgeIndicator({
		container: badgesContainer,
		className: "task-card__project-indicator",
		icon: "folder",
		tooltip: tTaskCard(plugin, "projectTooltip"),
		onClick: createProjectSubtasksToggleHandler(task, plugin, card, handlers),
	});

	if (plugin.settings?.showExpandableSubtasks) {
		createBadgeIndicator({
			container: badgesContainer,
			className: `task-card__chevron${isExpanded ? " task-card__chevron--expanded" : ""}`,
			icon: "chevron-right",
			tooltip: getChevronTooltip(plugin, isExpanded),
			onClick: createChevronClickHandler(task, plugin, card, handlers),
		});
	}

	// Render the subtask list immediately when expanded, regardless of whether the
	// chevron is shown — otherwise a folder-driven expansion would not re-render.
	if (isExpanded) {
		handlers.toggleSubtasks(card, task, true).catch((error: unknown) => {
			getTaskCardBadgeLogger(plugin).error("Error showing initial subtasks", {
				category: "internal",
				operation: "show-initial-subtasks",
				details: { taskPath: task.path },
				error,
			});
		});
	}
}

function renderDependencyToggles(
	options: RenderTaskCardSecondaryBadgesOptions,
	badgesContainer: HTMLElement
): void {
	const { card, task, plugin, handlers } = options;

	if (task.blocking && task.blocking.length > 0) {
		const blockingCount = task.blocking.length;
		const toggleLabel = plugin.i18n.translate("ui.taskCard.blockingToggle", {
			count: blockingCount,
		});
		const toggle = createBadgeIndicator({
			container: badgesContainer,
			className: "task-card__blocking-toggle is-visible",
			icon: "git-branch",
			tooltip: toggleLabel,
			onClick: createBlockingToggleClickHandler(task, card, handlers),
		});
		if (toggle) {
			toggle.dataset.count = String(blockingCount);
		}
	}

	const blockedByPaths = getBlockedByTaskPaths(task, plugin.app);
	if (blockedByPaths.length > 0) {
		const toggleLabel = `${tTaskCard(plugin, "blockedBadge")} (${blockedByPaths.length})`;
		const toggle = createBadgeIndicator({
			container: badgesContainer,
			className: "task-card__blocked-toggle is-visible",
			icon: "git-merge",
			tooltip: toggleLabel,
			onClick: createBlockedByToggleClickHandler(task, plugin, card, handlers),
		});
		if (toggle) {
			toggle.dataset.count = String(blockedByPaths.length);
		}
	}
}

export function renderTaskCardSecondaryBadges(
	options: RenderTaskCardSecondaryBadgesOptions
): void {
	const { badgesContainer, task, plugin, hasDetails, propertyOptions } = options;
	if (!badgesContainer || propertyOptions.showSecondaryBadges === false) {
		return;
	}

	if (task.recurrence) {
		createBadgeIndicator({
			container: badgesContainer,
			className: "task-card__recurring-indicator",
			icon: "rotate-ccw",
			tooltip: getRecurrenceTooltip(plugin, task.recurrence, propertyOptions.propertyLabels),
			onClick: createRecurrenceClickHandler(task, plugin),
		});
	}

	if (task.reminders && task.reminders.length > 0) {
		const count = task.reminders.length;
		createBadgeIndicator({
			container: badgesContainer,
			className: "task-card__reminder-indicator",
			icon: "bell",
			tooltip: getReminderTooltip(plugin, count),
			onClick: createReminderClickHandler(task, plugin),
		});
	}

	if (hasDetails) {
		createBadgeIndicator({
			container: badgesContainer,
			className: "task-card__details-indicator",
			icon: "file-text",
			tooltip: tTaskCard(plugin, "detailsTooltip"),
		});
	}

	renderProjectBadges(options, badgesContainer);
	renderDependencyToggles(options, badgesContainer);
}

function updateProjectBadges(options: UpdateTaskCardSecondaryBadgesOptions): void {
	const { card, mainRow, task, plugin, handlers } = options;
	const logger = getTaskCardBadgeLogger(plugin);

	plugin.projectSubtasksService
		.isTaskUsedAsProject(task.path)
		.then((isProject: boolean) => {
			card.querySelector(".task-card__project-indicator-placeholder")?.remove();
			card.querySelector(".task-card__chevron-placeholder")?.remove();

			updateBadgeIndicator(card, ".task-card__project-indicator", {
				shouldExist: isProject,
				className: "task-card__project-indicator",
				icon: "folder",
				tooltip: tTaskCard(plugin, "projectTooltip"),
				onClick: createProjectSubtasksToggleHandler(task, plugin, card, handlers),
			});

			const showChevron = isProject && plugin.settings?.showExpandableSubtasks;
			const existingChevron = card.querySelector<HTMLElement>(".task-card__chevron");
			const isExpanded = isProject && isTaskCardSubtasksExpanded(task, plugin);

			// Keep the chevron in sync with the setting (create / update / remove).
			if (showChevron && !existingChevron) {
				createBadgeIndicator({
					container:
						card.querySelector<HTMLElement>(".task-card__badges") ?? mainRow ?? card,
					className: `task-card__chevron${isExpanded ? " task-card__chevron--expanded" : ""}`,
					icon: "chevron-right",
					tooltip: getChevronTooltip(plugin, isExpanded),
					onClick: createChevronClickHandler(task, plugin, card, handlers),
				});
			} else if (showChevron && existingChevron) {
				updateChevronElement(existingChevron, plugin, isExpanded);
			} else if (!showChevron && existingChevron) {
				existingChevron.remove();
			}

			// Sync the inline subtask list independently of the chevron, so the
			// folder badge can drive expansion even when the chevron is disabled.
			if (isExpanded) {
				handlers.toggleSubtasks(card, task, true).catch((error: unknown) => {
					logger.error("Error showing subtasks in update", {
						category: "internal",
						operation: "show-subtasks-update",
						details: { taskPath: task.path },
						error,
					});
				});
			} else {
				removeRelationshipContainer(card, ".task-card__subtasks");
			}
		})
		.catch((error: unknown) => {
			logger.error("Error checking if task is used as project in update", {
				category: "internal",
				operation: "check-project-task",
				details: { taskPath: task.path },
				error,
			});
		});
}

function updateBlockingToggle(options: UpdateTaskCardSecondaryBadgesOptions): void {
	const { card, task, plugin, handlers } = options;
	const blockingCount = task.blocking?.length ?? 0;
	const shouldExist = blockingCount > 0;
	const toggleLabel = plugin.i18n.translate("ui.taskCard.blockingToggle", {
		count: blockingCount,
	});

	const toggle = updateBadgeIndicator(card, ".task-card__blocking-toggle", {
		shouldExist,
		className: "task-card__blocking-toggle is-visible",
		icon: "git-branch",
		tooltip: toggleLabel,
		onClick: createBlockingToggleClickHandler(task, card, handlers),
	});

	if (!shouldExist) {
		removeRelationshipContainer(card, ".task-card__blocking");
		return;
	}

	if (!toggle) {
		return;
	}

	toggle.classList.add("is-visible");
	toggle.classList.remove("is-hidden");
	toggle.dataset.count = String(blockingCount);

	if (toggle.classList.contains("task-card__blocking-toggle--expanded")) {
		handlers.toggleBlockingTasks(card, task, true).catch((error: unknown) => {
			getTaskCardBadgeLogger(plugin).error("Error refreshing blocking tasks", {
				category: "internal",
				operation: "refresh-blocking-tasks",
				details: { taskPath: task.path, blockingCount },
				error,
			});
		});
	}
}

function updateBlockedByToggle(options: UpdateTaskCardSecondaryBadgesOptions): void {
	const { card, task, plugin, handlers } = options;
	const blockedByPaths = getBlockedByTaskPaths(task, plugin.app);
	const shouldExist = blockedByPaths.length > 0;
	const toggleLabel = `${tTaskCard(plugin, "blockedBadge")} (${blockedByPaths.length})`;

	const toggle = updateBadgeIndicator(card, ".task-card__blocked-toggle", {
		shouldExist,
		className: "task-card__blocked-toggle is-visible",
		icon: "git-merge",
		tooltip: toggleLabel,
		onClick: createBlockedByToggleClickHandler(task, plugin, card, handlers),
	});

	if (!shouldExist) {
		removeRelationshipContainer(card, ".task-card__blocked-by");
		return;
	}

	if (!toggle) {
		return;
	}

	toggle.classList.add("is-visible");
	toggle.classList.remove("is-hidden");
	toggle.dataset.count = String(blockedByPaths.length);

	if (toggle.classList.contains("task-card__blocked-toggle--expanded")) {
		handlers.toggleBlockedByTasks(card, task, true).catch((error: unknown) => {
			getTaskCardBadgeLogger(plugin).error("Error refreshing blocked-by tasks", {
				category: "internal",
				operation: "refresh-blocked-by-tasks",
				details: { taskPath: task.path, blockedByCount: blockedByPaths.length },
				error,
			});
		});
	}
}

export function updateTaskCardSecondaryBadges(
	options: UpdateTaskCardSecondaryBadgesOptions
): void {
	const { card, mainRow, task, plugin, hasDetails, propertyOptions } = options;
	const badgesContainer = card.querySelector<HTMLElement>(".task-card__badges");

	if (!badgesContainer || propertyOptions.showSecondaryBadges === false) {
		removeSecondaryBadges(card);
		return;
	}

	updateBadgeIndicator(card, ".task-card__recurring-indicator", {
		shouldExist: !!task.recurrence,
		className: "task-card__recurring-indicator",
		icon: "rotate-ccw",
		tooltip: task.recurrence
			? getRecurrenceTooltip(plugin, task.recurrence, propertyOptions.propertyLabels)
			: "",
		onClick: createRecurrenceClickHandler(task, plugin),
	});

	const reminderCount = task.reminders?.length ?? 0;
	updateBadgeIndicator(card, ".task-card__reminder-indicator", {
		shouldExist: reminderCount > 0,
		className: "task-card__reminder-indicator",
		icon: "bell",
		tooltip: getReminderTooltip(plugin, reminderCount),
		onClick: createReminderClickHandler(task, plugin),
	});

	updateBadgeIndicator(card, ".task-card__details-indicator", {
		shouldExist: hasDetails,
		className: "task-card__details-indicator",
		icon: "file-text",
		tooltip: tTaskCard(plugin, "detailsTooltip"),
	});

	updateProjectBadges({ ...options, mainRow: mainRow ?? badgesContainer });
	updateBlockingToggle(options);
	updateBlockedByToggle(options);
}
