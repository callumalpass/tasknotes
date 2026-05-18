import { App, setTooltip, TFile, type TAbstractFile } from "obsidian";
import { renderProjectLinks, type LinkServices } from "../ui/renderers/linkRenderer";
import type { TaskInfo } from "../types";
import { generateLinkWithDisplay } from "../utils/linkUtils";

type PathLike = Pick<TAbstractFile, "path">;

export interface RenderTaskModalSubtasksListOptions {
	app: App;
	listEl: HTMLElement | undefined;
	files: readonly TAbstractFile[];
	sourcePath: string;
	getCachedTaskInfo: (path: string) => Promise<TaskInfo | null | undefined>;
	createTaskCard: (task: TaskInfo) => HTMLElement;
	translate: (key: string, params?: Record<string, string | number>) => string;
	onRemove: (file: TFile) => void;
}

export function getTaskModalSubtaskCandidates<T extends Pick<TaskInfo, "path">>(
	allTasks: readonly T[],
	selectedSubtaskFiles: readonly PathLike[],
	currentTaskPath?: string
): T[] {
	const selectedPaths = new Set(selectedSubtaskFiles.map((file) => file.path));
	return allTasks.filter((candidate) => {
		if (currentTaskPath && candidate.path === currentTaskPath) return false;
		return !selectedPaths.has(candidate.path);
	});
}

export function addTaskModalSubtaskFile<T extends PathLike>(
	selectedSubtaskFiles: readonly T[],
	file: T
): T[] {
	if (hasTaskModalSubtaskFile(selectedSubtaskFiles, file)) {
		return [...selectedSubtaskFiles];
	}

	return [...selectedSubtaskFiles, file];
}

export function removeTaskModalSubtaskFile<T extends PathLike>(
	selectedSubtaskFiles: readonly T[],
	file: PathLike
): T[] {
	return selectedSubtaskFiles.filter((existing) => existing.path !== file.path);
}

export function hasTaskModalSubtaskFile(
	selectedSubtaskFiles: readonly PathLike[],
	file: PathLike
): boolean {
	return selectedSubtaskFiles.some((existing) => existing.path === file.path);
}

export async function renderTaskModalSubtasksList({
	app,
	listEl,
	files,
	sourcePath,
	getCachedTaskInfo,
	createTaskCard,
	translate,
	onRemove,
}: RenderTaskModalSubtasksListOptions): Promise<void> {
	if (!listEl) {
		return;
	}

	listEl.empty();
	if (files.length === 0) {
		return;
	}

	const linkServices: LinkServices = {
		metadataCache: app.metadataCache,
		workspace: app.workspace,
	};

	for (const file of files) {
		if (!(file instanceof TFile)) {
			return;
		}

		const subtaskItem = listEl.createDiv({
			cls: "task-project-item task-project-item--task-card",
		});
		const cardHost = subtaskItem.createDiv({ cls: "task-project-card-host" });

		const taskInfo = await getCachedTaskInfo(file.path);
		if (taskInfo) {
			cardHost.appendChild(createTaskCard(taskInfo));
		} else {
			renderSubtaskFallback(app, cardHost, file, sourcePath, linkServices);
		}

		const removeBtn = subtaskItem.createEl("button", {
			cls: "task-project-remove",
			text: "×",
		});
		setTooltip(removeBtn, translate("modals.task.organization.removeSubtaskTooltip"), {
			placement: "top",
		});
		removeBtn.addEventListener("click", () => {
			onRemove(file);
		});
	}
}

function renderSubtaskFallback(
	app: App,
	cardHost: HTMLElement,
	file: TFile,
	sourcePath: string,
	linkServices: LinkServices
): void {
	const infoEl = cardHost.createDiv({ cls: "task-project-info" });
	const nameEl = infoEl.createDiv({ cls: "task-project-name clickable-project" });

	const taskLink = generateLinkWithDisplay(app, file, sourcePath, file.name);
	renderProjectLinksWithoutPrefix(nameEl, [taskLink], linkServices);

	if (file.path !== file.name) {
		infoEl.createDiv({ cls: "task-project-path", text: file.path });
	}
}

function renderProjectLinksWithoutPrefix(
	container: HTMLElement,
	links: string[],
	linkServices: LinkServices
): void {
	renderProjectLinks(container, links, linkServices);

	Array.from(container.childNodes).forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === "+") {
			node.remove();
		}
	});
}
