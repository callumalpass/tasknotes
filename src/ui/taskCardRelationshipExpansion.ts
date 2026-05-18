import { TFile, parseLinktext } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import {
	filterExpandedRelationshipTasks,
	getBlockedByTaskPaths,
	sortExpandedRelationshipTasks,
	type TaskCardRelationshipOptions,
} from "./taskCardRelationships";

export type TaskCardExpansionElement = HTMLElement & {
	_taskPath?: string;
	_clickHandler?: EventListener;
};

export type RenderRelatedTaskCard = (
	task: TaskInfo,
	options: TaskCardRelationshipOptions
) => HTMLElement;

export interface TaskCardRelationshipExpansionContext {
	plugin: TaskNotesPlugin;
	renderTaskCard: RenderRelatedTaskCard;
	getRelationshipOptions?: (card: HTMLElement) => TaskCardRelationshipOptions;
}

function getTaskCardExpansionLogger(plugin: TaskNotesPlugin) {
	return createTaskNotesLogger({
		tag: "TaskCard/Relationships",
		isDebugEnabled: () => plugin.settings?.enableDebugLogging === true,
	});
}

function getRelationshipOptions(
	context: TaskCardRelationshipExpansionContext,
	card: HTMLElement
): TaskCardRelationshipOptions {
	return context.getRelationshipOptions?.(card) ?? {};
}

export function bindNestedCardHoverState(container: HTMLElement, card: HTMLElement): void {
	const addNestedHover = () => card.classList.add("task-card--nested-interactive-hover");
	const removeNestedHover = () => card.classList.remove("task-card--nested-interactive-hover");

	container.addEventListener("mouseenter", addNestedHover);
	container.addEventListener("mouseleave", removeNestedHover);
}

export function cleanupRelationshipContainer(container: HTMLElement): void {
	const taskCardContainer = container as TaskCardExpansionElement;
	const clickHandler = taskCardContainer._clickHandler;
	if (clickHandler) {
		container.removeEventListener("click", clickHandler);
		delete taskCardContainer._clickHandler;
	}
}

export function removeRelationshipContainer(card: HTMLElement, selector: string): void {
	const container = card.querySelector<HTMLElement>(selector);
	if (!container) {
		return;
	}

	card.classList.remove("task-card--nested-interactive-hover");
	cleanupRelationshipContainer(container);
	container.remove();
}

export function cleanupTaskCardExpansions(card: HTMLElement): void {
	removeRelationshipContainer(card, ".task-card__subtasks");
	removeRelationshipContainer(card, ".task-card__blocking");
	removeRelationshipContainer(card, ".task-card__blocked-by");
}

function ensureRelationshipContainer(
	card: HTMLElement,
	selector: string,
	className: string,
	options: { stopExtraPointerEvents?: boolean } = {}
): HTMLElement {
	const existing = card.querySelector<HTMLElement>(selector);
	if (existing) {
		return existing;
	}

	const container = card.ownerDocument.createElement("div");
	container.className = className;

	const clickHandler = (event: Event) => {
		event.stopPropagation();
	};
	container.addEventListener("click", clickHandler);
	(container as TaskCardExpansionElement)._clickHandler = clickHandler;

	if (options.stopExtraPointerEvents) {
		container.addEventListener("dblclick", (event) => event.stopPropagation());
		container.addEventListener("contextmenu", (event) => event.stopPropagation());
	}

	bindNestedCardHoverState(container, card);
	card.appendChild(container);
	return container;
}

function buildParentTaskChain(card: HTMLElement): string[] {
	const chain: string[] = [];
	let current = card.closest(".task-card");

	while (current) {
		const taskPath = (current as TaskCardExpansionElement)._taskPath;
		if (typeof taskPath === "string") {
			chain.unshift(taskPath);
		}
		current = current.parentElement?.closest(".task-card") as HTMLElement | null;
	}

	return chain;
}

function clearContainer(container: HTMLElement): void {
	while (container.firstChild) {
		container.removeChild(container.firstChild);
	}
}

function renderRelatedTaskCards(
	container: HTMLElement,
	tasks: TaskInfo[],
	context: TaskCardRelationshipExpansionContext,
	options: TaskCardRelationshipOptions,
	modifierClass: string
): void {
	for (const relatedTask of tasks) {
		const relatedCard = context.renderTaskCard(relatedTask, options);
		relatedCard.classList.add(modifierClass);
		container.appendChild(relatedCard);
	}
}

export async function toggleSubtasksExpansion(
	context: TaskCardRelationshipExpansionContext,
	card: HTMLElement,
	task: TaskInfo,
	expanded: boolean
): Promise<void> {
	const { plugin } = context;
	const logger = getTaskCardExpansionLogger(plugin);

	try {
		if (!expanded) {
			removeRelationshipContainer(card, ".task-card__subtasks");
			return;
		}

		const container = ensureRelationshipContainer(
			card,
			".task-card__subtasks",
			"task-card__subtasks"
		);
		clearContainer(container);

		const loadingEl = container.createEl("div", {
			cls: "task-card__subtasks-loading",
			text: plugin.i18n.translate("contextMenus.task.subtasks.loading"),
		});

		try {
			const file = plugin.app.vault.getAbstractFileByPath(task.path);
			if (!(file instanceof TFile)) {
				throw new Error("Task file not found");
			}

			if (!plugin.projectSubtasksService) {
				throw new Error("projectSubtasksService not initialized");
			}

			const relationshipOptions = getRelationshipOptions(context, card);
			const subtasks = filterExpandedRelationshipTasks(
				await plugin.projectSubtasksService.getTasksLinkedToProject(file),
				relationshipOptions
			);

			loadingEl.remove();

			if (subtasks.length === 0) {
				container.createEl("div", {
					cls: "task-card__subtasks-loading",
					text: plugin.i18n.translate("contextMenus.task.subtasks.noSubtasks"),
				});
				return;
			}

			const sortedSubtasks = sortExpandedRelationshipTasks(
				subtasks,
				relationshipOptions,
				(tasks) => plugin.projectSubtasksService.sortTasks(tasks)
			);
			const parentChain = buildParentTaskChain(card);

			for (const subtask of sortedSubtasks) {
				if (parentChain.includes(subtask.path)) {
					logger.warn("Skipped circular task relationship", {
						category: "validation",
						operation: "render-subtasks",
						details: {
							taskPath: task.path,
							subtaskPath: subtask.path,
							parentChain,
						},
					});
					continue;
				}

				const subtaskCard = context.renderTaskCard(subtask, relationshipOptions);
				subtaskCard.classList.add("task-card--subtask");
				container.appendChild(subtaskCard);
			}
		} catch (error) {
			logger.error("Error loading subtasks", {
				category: "provider",
				operation: "load-subtasks",
				details: { taskPath: task.path },
				error,
			});
			loadingEl.textContent = plugin.i18n.translate("contextMenus.task.subtasks.loadFailed");
		}
	} catch (error) {
		logger.error("Error toggling subtasks", {
			category: "internal",
			operation: "toggle-subtasks",
			details: { taskPath: task.path, expanded },
			error,
		});
		throw error;
	}
}

export async function toggleBlockingTasksExpansion(
	context: TaskCardRelationshipExpansionContext,
	card: HTMLElement,
	task: TaskInfo,
	shouldExpand: boolean
): Promise<void> {
	const { plugin } = context;
	const logger = getTaskCardExpansionLogger(plugin);

	if (!shouldExpand) {
		removeRelationshipContainer(card, ".task-card__blocking");
		return;
	}

	const container = ensureRelationshipContainer(
		card,
		".task-card__blocking",
		"task-card__blocking",
		{ stopExtraPointerEvents: true }
	);
	clearContainer(container);

	const loadingEl = container.createDiv({
		cls: "task-card__blocking-loading",
		text: plugin.i18n.translate("ui.taskCard.loadingDependencies"),
	});

	try {
		const dependentInfos = task.blocking
			? await Promise.all(task.blocking.map((path) => plugin.cacheManager.getTaskInfo(path)))
			: [];
		const relationshipOptions = getRelationshipOptions(context, card);
		const dependents = filterExpandedRelationshipTasks(
			dependentInfos.filter((info): info is TaskInfo => Boolean(info)),
			relationshipOptions
		);

		loadingEl.remove();

		if (dependents.length === 0) {
			container.createDiv({
				cls: "task-card__blocking-empty",
				text: plugin.i18n.translate("ui.taskCard.blockingEmpty"),
			});
			return;
		}

		renderRelatedTaskCards(
			container,
			dependents,
			context,
			relationshipOptions,
			"task-card--dependency"
		);
	} catch (error) {
		logger.error("Error loading blocking tasks", {
			category: "provider",
			operation: "load-blocking-tasks",
			details: { taskPath: task.path },
			error,
		});
		loadingEl.textContent = plugin.i18n.translate("ui.taskCard.blockingLoadError");
	}
}

export async function toggleBlockedByTasksExpansion(
	context: TaskCardRelationshipExpansionContext,
	card: HTMLElement,
	task: TaskInfo,
	shouldExpand: boolean
): Promise<void> {
	const { plugin } = context;
	const logger = getTaskCardExpansionLogger(plugin);

	if (!shouldExpand) {
		removeRelationshipContainer(card, ".task-card__blocked-by");
		return;
	}

	const container = ensureRelationshipContainer(
		card,
		".task-card__blocked-by",
		"task-card__blocked-by",
		{ stopExtraPointerEvents: true }
	);
	clearContainer(container);

	const loadingEl = container.createDiv({
		cls: "task-card__blocked-by-loading",
		text: plugin.i18n.translate("ui.taskCard.loadingDependencies"),
	});

	try {
		const blockerPaths = getBlockedByTaskPaths(task, plugin.app);
		const blockerInfos = await Promise.all(
			blockerPaths.map((path) => plugin.cacheManager.getTaskInfo(path))
		);
		const relationshipOptions = getRelationshipOptions(context, card);
		const blockers = filterExpandedRelationshipTasks(
			blockerInfos.filter((info): info is TaskInfo => Boolean(info)),
			relationshipOptions
		);

		loadingEl.remove();

		if (blockers.length === 0) {
			container.createDiv({
				cls: "task-card__blocked-by-empty",
				text: plugin.i18n.translate("ui.taskCard.blockedBadge"),
			});
			return;
		}

		renderRelatedTaskCards(
			container,
			blockers,
			context,
			relationshipOptions,
			"task-card--dependency"
		);
	} catch (error) {
		logger.error("Error loading blocked-by tasks", {
			category: "provider",
			operation: "load-blocked-by-tasks",
			details: { taskPath: task.path },
			error,
		});
		loadingEl.textContent = plugin.i18n.translate("ui.taskCard.blockingLoadError");
	}
}

export async function refreshParentTaskSubtasksExpansion(
	context: TaskCardRelationshipExpansionContext,
	updatedTask: TaskInfo,
	container: HTMLElement
): Promise<void> {
	const { plugin } = context;
	const logger = getTaskCardExpansionLogger(plugin);

	if (!updatedTask.projects || updatedTask.projects.length === 0) {
		return;
	}

	let attempts = 0;
	const maxAttempts = 10;
	while (attempts < maxAttempts) {
		try {
			const cachedTask = await plugin.cacheManager.getTaskInfo(updatedTask.path);
			if (cachedTask && cachedTask.dateModified === updatedTask.dateModified) {
				break;
			}
		} catch {
			// Cache may not be ready yet.
		}
		await new Promise((resolve) => window.setTimeout(resolve, 10));
		attempts++;
	}

	const expandedChevrons = container.querySelectorAll(".task-card__chevron--expanded");

	for (const chevron of expandedChevrons) {
		const taskCard = chevron.closest<HTMLElement>(".task-card");
		if (!taskCard) continue;

		const projectTaskPath = taskCard.dataset.taskPath;
		if (!projectTaskPath) continue;

		const projectFile = plugin.app.vault.getAbstractFileByPath(projectTaskPath);
		if (!(projectFile instanceof TFile)) continue;

		const projectFileName = projectFile.basename;
		const isSubtaskOfThisProject = updatedTask.projects.flat(2).some((project) => {
			if (
				project &&
				typeof project === "string" &&
				project.startsWith("[[") &&
				project.endsWith("]]")
			) {
				const linkContent = project.slice(2, -2).trim();
				const linkedNoteName = parseLinktext(linkContent).path;
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

		if (!isSubtaskOfThisProject) {
			continue;
		}

		const subtasksContainer = taskCard.querySelector<HTMLElement>(".task-card__subtasks");
		if (!subtasksContainer) {
			continue;
		}

		try {
			const parentTask = await plugin.cacheManager.getTaskInfo(projectTaskPath);
			if (parentTask) {
				await toggleSubtasksExpansion(context, taskCard, parentTask, true);
			}
		} catch (error) {
			logger.error("Error refreshing parent task subtasks", {
				category: "provider",
				operation: "refresh-parent-subtasks",
				details: { taskPath: updatedTask.path, projectTaskPath },
				error,
			});
		}
	}
}
