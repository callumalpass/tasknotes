import { App, setTooltip, TFile } from "obsidian";
import { renderProjectLinks, type LinkServices } from "../ui/renderers/linkRenderer";
import { generateLinkWithDisplay, parseLinkToPath } from "../utils/linkUtils";

export interface TaskModalProjectItem {
	file?: TFile;
	name: string;
	link: string;
	unresolved?: boolean;
}

export interface TaskModalProjectStringContext {
	sourcePath: string;
	getMarkdownFiles: () => readonly TFile[];
	resolveLink: (linkPath: string, sourcePath: string) => unknown;
}

export interface RenderTaskModalProjectsListOptions {
	app: App;
	listEl: HTMLElement | undefined;
	items: readonly TaskModalProjectItem[];
	sourcePath: string;
	translate: (key: string, params?: Record<string, string | number>) => string;
	onRemove: (item: TaskModalProjectItem) => void;
}

export function createTaskModalProjectItemFromFile(
	file: TFile,
	link: string
): TaskModalProjectItem {
	return {
		file,
		name: file.basename,
		link,
	};
}

export function addTaskModalProjectItemsFromStrings(
	existingItems: readonly TaskModalProjectItem[],
	projectStrings: readonly string[],
	context: TaskModalProjectStringContext
): TaskModalProjectItem[] {
	const nextItems = [...existingItems];

	for (const projectString of projectStrings) {
		const projectItem = createTaskModalProjectItemFromString(projectString, context);
		if (!projectItem || hasTaskModalProjectItem(nextItems, projectItem)) continue;
		nextItems.push(projectItem);
	}

	return nextItems;
}

export function removeTaskModalProjectItem(
	items: readonly TaskModalProjectItem[],
	itemToRemove: TaskModalProjectItem
): TaskModalProjectItem[] {
	return items.filter((item) => item !== itemToRemove);
}

export function getTaskModalProjectsValue(items: readonly TaskModalProjectItem[]): string {
	return items.map((item) => item.link).join(", ");
}

export function createTaskModalProjectItemFromString(
	projectString: string,
	context: TaskModalProjectStringContext
): TaskModalProjectItem | null {
	if (!projectString || typeof projectString !== "string" || projectString.trim() === "") {
		return null;
	}

	const wikiMatch = projectString.match(/^\[\[([^\]]+)\]\]$/);
	if (wikiMatch) {
		return createTaskModalProjectItemFromWikiLink(projectString, wikiMatch[1], context);
	}

	const markdownMatch = projectString.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		return createTaskModalProjectItemFromMarkdownLink(projectString, markdownMatch, context);
	}

	return createTaskModalProjectItemFromPlainText(projectString, context);
}

export function hasTaskModalProjectItem(
	items: readonly TaskModalProjectItem[],
	candidate: TaskModalProjectItem
): boolean {
	const candidateKeys = getTaskModalProjectDedupKeys(candidate);
	return items.some((existing) => {
		const existingKeys = getTaskModalProjectDedupKeys(existing);
		return candidateKeys.some((key) => existingKeys.includes(key));
	});
}

export function getTaskModalProjectDedupKeys(item: TaskModalProjectItem): string[] {
	const keys = new Set<string>();

	if (item.file?.path) {
		keys.add(`path:${normalizeTaskModalProjectPath(item.file.path)}`);
	}

	const parsedPath = parseLinkToPath(item.link);
	if (parsedPath) {
		keys.add(`path:${normalizeTaskModalProjectPath(parsedPath)}`);
	}

	if (item.link) {
		keys.add(`link:${item.link.trim().toLowerCase()}`);
	}

	return Array.from(keys);
}

export function normalizeTaskModalProjectPath(path: string): string {
	return path.trim().replace(/\.md$/i, "").toLowerCase();
}

export function renderTaskModalProjectsList({
	app,
	listEl,
	items,
	sourcePath,
	translate,
	onRemove,
}: RenderTaskModalProjectsListOptions): void {
	if (!listEl) {
		return;
	}

	listEl.empty();
	if (items.length === 0) {
		return;
	}

	const linkServices: LinkServices = {
		metadataCache: app.metadataCache,
		workspace: app.workspace,
	};

	for (const item of items) {
		const projectItem = listEl.createDiv({ cls: "task-project-item" });

		if (item.unresolved) {
			projectItem.addClass("task-project-item--unresolved");
		}

		const infoEl = projectItem.createDiv({ cls: "task-project-info" });
		const nameEl = infoEl.createDiv({ cls: "task-project-name clickable-project" });

		if (item.file) {
			const projectAsWikilink = generateLinkWithDisplay(
				app,
				item.file,
				sourcePath,
				item.file.name
			);
			renderProjectLinksWithoutPrefix(nameEl, [projectAsWikilink], linkServices);

			if (item.file.path !== item.file.name) {
				infoEl.createDiv({ cls: "task-project-path", text: item.file.path });
			}
		} else {
			nameEl.textContent = item.name;
			setTooltip(
				nameEl,
				translate("contextMenus.task.dependencies.notices.unresolved", {
					name: item.name,
				}),
				{ placement: "top" }
			);
		}

		const removeBtn = projectItem.createEl("button", {
			cls: "task-project-remove",
			text: "×",
		});
		setTooltip(removeBtn, translate("modals.task.projectsRemoveTooltip"), {
			placement: "top",
		});
		removeBtn.addEventListener("click", () => {
			onRemove(item);
		});
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

function createTaskModalProjectItemFromWikiLink(
	projectString: string,
	linkPath: string,
	context: TaskModalProjectStringContext
): TaskModalProjectItem {
	const file = context.resolveLink(linkPath, context.sourcePath);
	if (file instanceof TFile) {
		return createTaskModalProjectItemFromFile(file, projectString);
	}

	return {
		name: linkPath.split("|")[0],
		link: projectString,
		unresolved: true,
	};
}

function createTaskModalProjectItemFromMarkdownLink(
	projectString: string,
	markdownMatch: RegExpMatchArray,
	context: TaskModalProjectStringContext
): TaskModalProjectItem {
	const linkPath = parseLinkToPath(projectString);
	const file = context.resolveLink(linkPath, context.sourcePath);
	if (file instanceof TFile) {
		return createTaskModalProjectItemFromFile(file, projectString);
	}

	return {
		name: markdownMatch[1] || linkPath,
		link: projectString,
		unresolved: true,
	};
}

function createTaskModalProjectItemFromPlainText(
	projectString: string,
	context: TaskModalProjectStringContext
): TaskModalProjectItem {
	const matchingFile = context
		.getMarkdownFiles()
		.find((file) => file.basename === projectString || file.name === `${projectString}.md`);

	if (matchingFile) {
		return {
			file: matchingFile,
			name: matchingFile.basename,
			link: `[[${matchingFile.basename}]]`,
		};
	}

	return {
		name: projectString,
		link: projectString,
		unresolved: true,
	};
}
