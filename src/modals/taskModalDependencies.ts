import { setTooltip, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskDependency, TaskInfo } from "../types";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	formatDependencyLink,
	normalizeDependencyEntry,
	resolveDependencyEntry,
} from "../utils/dependencyUtils";
import { appendInternalLink, type LinkServices } from "../ui/renderers/linkRenderer";
import { createTaskCard } from "../ui/TaskCard";

export interface DependencyItem {
	dependency: TaskDependency;
	name: string;
	path?: string;
	unresolved?: boolean;
}

export interface CreateDependencyContext {
	plugin: TaskNotesPlugin;
	sourcePath: string;
}

export interface RenderDependencyListOptions {
	plugin: TaskNotesPlugin;
	listEl: HTMLElement | undefined;
	items: DependencyItem[];
	linkServices: LinkServices;
	translate: (key: string, params?: Record<string, string | number>) => string;
	onRemove: (index: number) => void;
}

export function createDependencyItemFromFile(
	{ plugin, sourcePath }: CreateDependencyContext,
	file: TFile
): DependencyItem {
	const uid = formatDependencyLink(
		plugin.app,
		sourcePath,
		file.path,
		plugin.settings.useFrontmatterMarkdownLinks
	);
	return {
		dependency: { uid, reltype: DEFAULT_DEPENDENCY_RELTYPE },
		path: file.path,
		name: file.basename,
	};
}

export function createDependencyItemFromDependency(
	{ plugin, sourcePath }: CreateDependencyContext,
	dependency: TaskDependency
): DependencyItem {
	const normalized = normalizeDependencyEntry(dependency);
	if (!normalized) {
		const fallbackName =
			typeof dependency === "object" &&
			dependency &&
			"uid" in dependency &&
			typeof dependency.uid === "string"
				? dependency.uid
				: String(dependency);
		return {
			dependency: { uid: fallbackName, reltype: DEFAULT_DEPENDENCY_RELTYPE },
			name: fallbackName,
			unresolved: true,
		};
	}

	const resolution = resolveDependencyEntry(plugin.app, sourcePath, normalized);
	if (resolution) {
		const name = resolution.file?.basename || resolution.path.split("/").pop() || normalized.uid;
		return {
			dependency: normalized,
			path: resolution.path,
			name,
		};
	}

	const cleaned = normalized.uid.replace(/^\[\[/, "").replace(/\]\]$/, "");
	return {
		dependency: normalized,
		name: cleaned || dependency.uid,
		unresolved: true,
	};
}

export function createDependencyItemFromPath(
	{ plugin, sourcePath }: CreateDependencyContext,
	path: string
): DependencyItem {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) {
		return createDependencyItemFromFile({ plugin, sourcePath }, file);
	}

	const basename = path.split("/").pop() || path;
	const nameWithoutExt = basename.replace(/\.md$/i, "");
	return {
		dependency: {
			uid: `[[${nameWithoutExt}]]`,
			reltype: DEFAULT_DEPENDENCY_RELTYPE,
		},
		path,
		name: nameWithoutExt,
		unresolved: true,
	};
}

export function dependencyItemExists(items: DependencyItem[], item: DependencyItem): boolean {
	return items.some(
		(existing) =>
			existing.dependency.uid === item.dependency.uid ||
			(Boolean(item.path) && existing.path === item.path)
	);
}

export async function renderDependencyList({
	plugin,
	listEl,
	items,
	linkServices,
	translate,
	onRemove,
}: RenderDependencyListOptions): Promise<void> {
	if (!listEl) {
		return;
	}

	listEl.empty();
	if (items.length === 0) {
		return;
	}

	for (const [index, item] of items.entries()) {
		const hasResolvedTaskPath = Boolean(item.path && !item.unresolved);
		const itemEl = listEl.createDiv({
			cls: hasResolvedTaskPath
				? "task-project-item task-project-item--task-card"
				: "task-project-item",
		});
		if (item.unresolved) {
			itemEl.addClass("task-project-item--unresolved");
			setTooltip(
				itemEl,
				translate("contextMenus.task.dependencies.notices.unresolved", {
					entries: item.dependency.uid,
				}),
				{ placement: "top" }
			);
		}

		const contentEl = itemEl.createDiv({
			cls: hasResolvedTaskPath ? "task-project-card-host" : "task-project-info",
		});

		if (item.path && !item.unresolved) {
			await renderResolvedDependency(plugin, contentEl, item, linkServices);
		} else {
			renderUnresolvedDependency(contentEl, item);
		}

		const removeBtn = itemEl.createEl("button", {
			cls: "task-project-remove",
			text: "×",
		});
		setTooltip(removeBtn, translate("modals.task.dependencies.removeTaskTooltip"), {
			placement: "top",
		});
		removeBtn.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onRemove(index);
		});
	}
}

async function renderResolvedDependency(
	plugin: TaskNotesPlugin,
	contentEl: HTMLElement,
	item: DependencyItem,
	linkServices: LinkServices
): Promise<void> {
	if (!item.path) {
		return;
	}

	const taskInfo = await plugin.cacheManager.getCachedTaskInfo(item.path);
	if (taskInfo) {
		const taskCard = createTaskCard(taskInfo, plugin, undefined, {
			layout: "default",
			showSecondaryBadges: false,
			enableHoverPreview: false,
		});
		contentEl.appendChild(taskCard);
		return;
	}

	const nameEl = contentEl.createSpan({ cls: "task-project-name clickable-dependency" });
	appendInternalLink(nameEl, item.path, item.name, linkServices, {
		cssClass: "task-dependency-link internal-link",
		hoverSource: "tasknotes-dependency-link",
		showErrorNotices: true,
	});
	if (item.path !== item.name) {
		contentEl.createDiv({ cls: "task-project-path", text: item.path });
	}
}

function renderUnresolvedDependency(contentEl: HTMLElement, item: DependencyItem): void {
	const nameEl = contentEl.createSpan({ cls: "task-project-name" });
	nameEl.textContent = item.name;
	const pathText = item.path ?? item.dependency.uid;
	contentEl.createDiv({ cls: "task-project-path", text: pathText });
}

export function candidateDependencyUid(
	plugin: TaskNotesPlugin,
	sourcePath: string,
	task: TaskInfo
): string {
	return formatDependencyLink(
		plugin.app,
		sourcePath,
		task.path,
		plugin.settings.useFrontmatterMarkdownLinks
	);
}
