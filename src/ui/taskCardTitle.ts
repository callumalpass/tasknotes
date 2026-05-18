import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { stringifyUnknown } from "../utils/stringUtils";
import { renderTextWithLinks, type LinkServices } from "./renderers/linkRenderer";

export interface TaskCardTitleOptions {
	displayText?: string;
	isCompleted?: boolean;
}

export interface CreateTaskCardTitleOptions extends TaskCardTitleOptions {
	contentContainer: HTMLElement;
	layout: "default" | "compact" | "inline";
	task: TaskInfo;
	plugin: TaskNotesPlugin;
}

export interface UpdateTaskCardTitleOptions extends TaskCardTitleOptions {
	card: HTMLElement;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
}

export function getTaskCardTitleText(task: TaskInfo, displayText?: string): string {
	return stringifyUnknown(displayText).trim() || stringifyUnknown(task.title);
}

export function renderTaskCardTitleText(
	container: HTMLElement,
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	displayText?: string
): void {
	container.empty();
	const linkServices: LinkServices = {
		metadataCache: plugin.app.metadataCache,
		workspace: plugin.app.workspace,
		sourcePath: task.path,
	};

	renderTextWithLinks(container, getTaskCardTitleText(task, displayText), linkServices);
}

export function syncTaskCardTitleCompletion(card: HTMLElement, isCompleted: boolean): void {
	const titleEl = card.querySelector<HTMLElement>(".task-card__title");
	const titleTextEl = card.querySelector<HTMLElement>(".task-card__title-text");
	titleEl?.classList.toggle("completed", isCompleted);
	titleTextEl?.classList.toggle("completed", isCompleted);
}

export function createTaskCardTitle(options: CreateTaskCardTitleOptions): {
	titleEl: HTMLElement;
	titleTextEl: HTMLElement;
} {
	const { contentContainer, layout, task, plugin, displayText, isCompleted = false } = options;
	const titleEl = contentContainer.createEl(layout === "inline" ? "span" : "div", {
		cls: "task-card__title",
	});
	const titleTextEl = titleEl.createSpan({ cls: "task-card__title-text" });

	renderTaskCardTitleText(titleTextEl, task, plugin, displayText);
	titleEl.classList.toggle("completed", isCompleted);
	titleTextEl.classList.toggle("completed", isCompleted);

	return { titleEl, titleTextEl };
}

export function updateTaskCardTitle(options: UpdateTaskCardTitleOptions): void {
	const { card, task, plugin, displayText, isCompleted = false } = options;
	const titleTextEl = card.querySelector<HTMLElement>(".task-card__title-text");
	if (titleTextEl) {
		renderTaskCardTitleText(titleTextEl, task, plugin, displayText);
	}
	syncTaskCardTitleCompletion(card, isCompleted);
}
