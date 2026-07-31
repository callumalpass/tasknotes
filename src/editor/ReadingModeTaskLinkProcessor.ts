import { MarkdownPostProcessor } from "obsidian";
import { EditorView } from "@codemirror/view";
import TaskNotesPlugin from "../main";
import {
	EVENT_DATA_CHANGED,
	EVENT_DATE_CHANGED,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	TaskInfo,
} from "../types";
import { TaskLinkWidget } from "./TaskLinkWidget";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import {
	extractTaskLinkSubpath,
	formatTaskLinkSubpathDisplayText,
	isImplicitTaskLinkDisplayText,
	resolveTaskLinkDisplayText,
} from "./taskLinkDisplayText";

const tasknotesLogger = createTaskNotesLogger({ tag: "Editor/ReadingModeTaskLinkProcessor" });

export interface ReadingModeSourceLink {
	target: string;
	hasAlias: boolean;
	subpath?: string;
}

export interface ReadingModeSourceLinkCursor {
	index: number;
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function normalizeReadingModeLinkTarget(value: string): string {
	let target = safeDecodeURIComponent(value).trim();
	if (!target) return "";

	if (target.startsWith("app://")) {
		try {
			target = new URL(target).pathname;
		} catch {
			// Keep the original target if URL parsing fails.
		}
	}

	target = target.replace(/^\/+/, "");
	target = target.split("#")[0].trim();
	if (target.endsWith(".md")) {
		target = target.slice(0, -3);
	}
	return target;
}

function getReadingModeTargetBasename(target: string): string {
	const normalizedTarget = normalizeReadingModeLinkTarget(target);
	const parts = normalizedTarget.split("/");
	return parts[parts.length - 1] ?? normalizedTarget;
}

function readingModeLinkTargetsMatch(sourceTarget: string, linkTarget: string): boolean {
	const normalizedSourceTarget = normalizeReadingModeLinkTarget(sourceTarget);
	const normalizedLinkTarget = normalizeReadingModeLinkTarget(linkTarget);
	if (!normalizedSourceTarget || !normalizedLinkTarget) return false;
	if (normalizedSourceTarget === normalizedLinkTarget) return true;

	return (
		getReadingModeTargetBasename(normalizedSourceTarget) ===
		getReadingModeTargetBasename(normalizedLinkTarget)
	);
}

export function parseReadingModeSourceLinks(sourceText: string): ReadingModeSourceLink[] {
	const links: ReadingModeSourceLink[] = [];
	const wikilinkPattern = /!?\[\[([^\]]+)\]\]/g;
	let match: RegExpExecArray | null;

	while ((match = wikilinkPattern.exec(sourceText)) !== null) {
		if (match[0].startsWith("!")) continue;

		const content = match[1].trim();
		if (!content) continue;

		const pipeIndex = content.indexOf("|");
		const rawTarget = pipeIndex === -1 ? content : content.slice(0, pipeIndex);
		const target = normalizeReadingModeLinkTarget(rawTarget);
		if (!target) continue;

		links.push({
			target,
			hasAlias: pipeIndex !== -1,
			subpath: extractTaskLinkSubpath(rawTarget),
		});
	}

	return links;
}

export function consumeReadingModeSourceLink(
	sourceLinks: ReadingModeSourceLink[],
	cursor: ReadingModeSourceLinkCursor,
	linkTarget: string
): ReadingModeSourceLink | null {
	const normalizedTarget = normalizeReadingModeLinkTarget(linkTarget);
	if (!normalizedTarget) return null;

	const findFromCursor = (): ReadingModeSourceLink | null => {
		for (let i = cursor.index; i < sourceLinks.length; i++) {
			const sourceLink = sourceLinks[i];
			if (readingModeLinkTargetsMatch(sourceLink.target, normalizedTarget)) {
				cursor.index = i + 1;
				return sourceLink;
			}
		}

		return null;
	};

	const match = findFromCursor();
	if (match) return match;

	if (cursor.index > 0) {
		cursor.index = 0;
		return findFromCursor();
	}

	return null;
}

function sourceLinkCursorKey(sourcePath: string, sectionText: string): string {
	return `${sourcePath}\0${sectionText}`;
}

function createSourceLinkCursor(): ReadingModeSourceLinkCursor {
	return { index: 0 };
}

const READING_MODE_TASK_LINK_SELECTOR = ".task-inline-preview--reading-mode[data-task-path]";

interface ReadingModeTaskUpdatePayload {
	path?: string;
	task?: TaskInfo;
	updatedTask?: TaskInfo;
}

export function shouldSkipReadingModeTaskLinkOverlay(options: {
	disableOverlayOnAlias: boolean;
	hasExplicitAlias: boolean;
	linkText: string;
	originalLinkPath: string;
	taskSubpath?: string;
	taskPath?: string;
	taskTitle: string;
}): boolean {
	if (!options.disableOverlayOnAlias) return false;
	if (options.hasExplicitAlias) return true;

	const currentText = options.linkText.trim();
	const subpathDisplayText = formatTaskLinkSubpathDisplayText(
		options.taskTitle,
		options.taskSubpath ?? extractTaskLinkSubpath(options.originalLinkPath)
	);
	if (subpathDisplayText && currentText === subpathDisplayText) {
		return false;
	}
	if (
		isImplicitTaskLinkDisplayText(
			currentText,
			options.taskPath,
			options.originalLinkPath,
			options.taskTitle
		)
	) {
		return false;
	}
	return currentText !== options.originalLinkPath && currentText !== options.taskTitle;
}

function getMarkdownSectionText(
	ctx: Parameters<MarkdownPostProcessor>[1],
	el: HTMLElement
): string {
	try {
		return ctx.getSectionInfo?.(el)?.text ?? "";
	} catch {
		return "";
	}
}

/**
 * Markdown post processor that adds task previews to wikilinks in reading mode
 */
export class ReadingModeTaskLinkProcessor {
	private plugin: TaskNotesPlugin;
	private sourceLinkCursors = new Map<string, ReadingModeSourceLinkCursor>();
	private refreshTimer: number | null = null;
	private pendingRefreshAll = false;
	private pendingRefreshTaskPaths = new Set<string>();

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
		this.setupEventListeners();
	}

	/**
	 * Create the markdown post processor function
	 */
	createPostProcessor(): MarkdownPostProcessor {
		return (el: HTMLElement, ctx) => {
			// Only process if task link overlay is enabled
			if (!this.plugin.settings.enableTaskLinkOverlay) {
				return;
			}

			// Find all links in the rendered content
			const allLinks = el.querySelectorAll("a");
			const sectionText = getMarkdownSectionText(ctx, el);
			const sourceLinks = parseReadingModeSourceLinks(sectionText);
			const cursorKey = sourceLinkCursorKey(ctx.sourcePath, sectionText);
			const sourceLinkCursor =
				this.sourceLinkCursors.get(cursorKey) ?? createSourceLinkCursor();
			this.sourceLinkCursors.set(cursorKey, sourceLinkCursor);

			for (const link of Array.from(allLinks)) {
				const linkEl = link;
				const href = linkEl.getAttribute("href");
				const linkTarget = linkEl.getAttribute("data-href") || href || "";
				const sourceLink =
					sourceLinks.length > 0
						? consumeReadingModeSourceLink(sourceLinks, sourceLinkCursor, linkTarget)
						: null;

				// Process internal links (wikilinks) - these have .internal-link class
				if (linkEl.classList.contains("internal-link")) {
					void this.processLink(
						linkEl,
						ctx.sourcePath,
						"internal",
						sourceLink?.hasAlias ?? false,
						sourceLink?.subpath
					);
				}
				// Process other links that might be markdown links to internal files
				else if (
					href &&
					!href.startsWith("http://") &&
					!href.startsWith("https://") &&
					!href.includes("://")
				) {
					void this.processLink(
						linkEl,
						ctx.sourcePath,
						"external",
						sourceLink?.hasAlias ?? false,
						sourceLink?.subpath
					);
				}
			}
		};
	}

	/**
	 * Process a single link to check if it should be replaced with a task preview
	 */
	private async processLink(
		linkEl: HTMLAnchorElement,
		sourcePath: string,
		linkType: "internal" | "external",
		hasExplicitAlias: boolean,
		implicitSubpath?: string
	): Promise<void> {
		try {
			// Get the link path from the href attribute
			const href = linkEl.getAttribute("href");
			if (!href) return;

			let linkPath = href;

			if (linkType === "internal") {
				// Parse internal links - Obsidian internal links use format like "app://obsidian.md/path"
				// or just the file path directly
				if (href.startsWith("app://")) {
					// Extract path from app:// URL
					const url = new URL(href);
					linkPath = decodeURIComponent(url.pathname);
					// Remove leading slash if present
					if (linkPath.startsWith("/")) {
						linkPath = linkPath.substring(1);
					}
				}
			} else {
				// For external links, check if they might be markdown links to internal files
				// Skip if it's clearly an external URL
				if (
					href.startsWith("http://") ||
					href.startsWith("https://") ||
					href.includes("://")
				) {
					return;
				}
				// Otherwise treat as a potential internal path
				linkPath = href;
			}

			// Resolve the link path to get the actual file
			const resolvedPath = this.resolveLinkPath(linkPath, sourcePath);
			if (!resolvedPath) return;

			// Check if this file is a task
			const taskInfo = this.getTaskInfo(resolvedPath);
			if (!taskInfo) return;

			// Create a task widget and replace the link
			await this.replaceWithTaskWidget(
				linkEl,
				taskInfo,
				linkPath,
				hasExplicitAlias,
				implicitSubpath
			);
		} catch (error) {
			tasknotesLogger.debug("Error processing link in reading mode:", {
				category: "persistence",
				operation: "processing-link-reading-mode",
				error: error,
			});
		}
	}

	private setupEventListeners(): void {
		this.plugin.registerEvent(
			this.plugin.emitter.on(EVENT_TASK_UPDATED, (data?: ReadingModeTaskUpdatePayload) => {
				this.scheduleReadingModeWidgetRefresh(
					data?.path ?? data?.updatedTask?.path ?? data?.task?.path
				);
			})
		);

		this.plugin.registerEvent(
			this.plugin.emitter.on(EVENT_TASK_DELETED, (data?: ReadingModeTaskUpdatePayload) => {
				this.scheduleReadingModeWidgetRefresh(data?.path);
			})
		);

		this.plugin.registerEvent(
			this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
				this.scheduleReadingModeWidgetRefresh();
			})
		);

		this.plugin.registerEvent(
			this.plugin.emitter.on(EVENT_DATE_CHANGED, () => {
				this.scheduleReadingModeWidgetRefresh();
			})
		);

		this.plugin.registerEvent(
			this.plugin.emitter.on("settings-changed", () => {
				this.scheduleReadingModeWidgetRefresh();
			})
		);

		this.plugin.register(() => {
			if (this.refreshTimer !== null) {
				window.clearTimeout(this.refreshTimer);
				this.refreshTimer = null;
			}
		});
	}

	private scheduleReadingModeWidgetRefresh(taskPath?: string): void {
		if (taskPath) {
			if (!this.pendingRefreshAll) {
				this.pendingRefreshTaskPaths.add(taskPath);
			}
		} else {
			this.pendingRefreshAll = true;
			this.pendingRefreshTaskPaths.clear();
		}

		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			const taskPaths = this.pendingRefreshAll
				? undefined
				: new Set(this.pendingRefreshTaskPaths);
			this.pendingRefreshAll = false;
			this.pendingRefreshTaskPaths.clear();
			this.refreshReadingModeWidgets(taskPaths);
		}, 100);
	}

	refreshReadingModeWidgets(taskPaths?: Set<string>): void {
		const containers = this.getReadingModeContainers();
		if (containers.length === 0) return;

		for (const container of containers) {
			const widgets = Array.from(
				container.querySelectorAll<HTMLElement>(READING_MODE_TASK_LINK_SELECTOR)
			);

			for (const widgetEl of widgets) {
				const taskPath = widgetEl.dataset.taskPath;
				if (!taskPath) continue;
				if (taskPaths && !taskPaths.has(taskPath)) continue;

				if (!this.plugin.settings.enableTaskLinkOverlay) {
					this.replaceWidgetWithOriginalLink(widgetEl);
					continue;
				}

				const taskInfo = this.getTaskInfo(taskPath);
				if (!taskInfo) {
					this.replaceWidgetWithOriginalLink(widgetEl);
					continue;
				}

				const originalLinkPath = widgetEl.dataset.originalLinkPath || taskInfo.path;
				const originalText = widgetEl.dataset.originalText || taskInfo.title;
				const displayText = widgetEl.dataset.displayText || undefined;
				const widget = new TaskLinkWidget(taskInfo, this.plugin, originalText, displayText);
				const refreshedElement = this.createReadingModeWidget(
					widget,
					taskInfo,
					originalLinkPath,
					originalText,
					displayText
				);
				widgetEl.replaceWith(refreshedElement);
			}
		}
	}

	private getReadingModeContainers(): HTMLElement[] {
		const leaves = this.plugin.app.workspace.getLeavesOfType?.("markdown") ?? [];
		const containers: HTMLElement[] = [];

		for (const leaf of leaves) {
			const view = leaf.view as {
				getMode?: () => string;
				previewMode?: { containerEl?: HTMLElement };
				containerEl?: HTMLElement;
			};

			if (typeof view.getMode === "function" && view.getMode() !== "preview") {
				continue;
			}

			const containerEl = view.previewMode?.containerEl ?? view.containerEl;
			if (containerEl) {
				containers.push(containerEl);
			}
		}

		return containers;
	}

	private replaceWidgetWithOriginalLink(widgetEl: HTMLElement): void {
		const originalLinkPath = widgetEl.dataset.originalLinkPath;
		if (!originalLinkPath) {
			widgetEl.remove();
			return;
		}

		const linkEl = activeDocument.createElement("a");
		linkEl.className = "internal-link";
		linkEl.setAttribute("href", originalLinkPath);
		linkEl.setAttribute("data-href", originalLinkPath);
		linkEl.textContent = widgetEl.dataset.originalText || originalLinkPath;
		widgetEl.replaceWith(linkEl);
	}

	/**
	 * Resolve a link path to an actual file path
	 */
	private resolveLinkPath(linkPath: string, sourcePath: string): string | null {
		try {
			// Use Obsidian's metadata cache to resolve the link - it handles relative paths safely
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
			return file?.path || null;
		} catch (error) {
			tasknotesLogger.debug("Error resolving link path:", {
				category: "persistence",
				operation: "resolving-link-path",
				details: { value: linkPath },
				error: error,
			});
			return null;
		}
	}

	/**
	 * Get task info for a file path
	 */
	private getTaskInfo(filePath: string): TaskInfo | null {
		try {
			// Validate file path
			if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
				return null;
			}

			// Use the cache manager to get task info
			const cacheManager = this.plugin.cacheManager;
			if (!cacheManager || !cacheManager.getCachedTaskInfoSync) {
				return null;
			}

			const taskInfo = cacheManager.getCachedTaskInfoSync(filePath);

			// Basic validation of task info structure
			if (taskInfo && typeof taskInfo === "object" && taskInfo.title) {
				return taskInfo;
			}

			return null;
		} catch (error) {
			tasknotesLogger.debug("Error getting task info for:", {
				category: "persistence",
				operation: "getting-task-info",
				details: { value: filePath },
				error: error,
			});
			return null;
		}
	}

	/**
	 * Replace a wikilink with a task widget
	 */
	private async replaceWithTaskWidget(
		linkEl: HTMLAnchorElement,
		taskInfo: TaskInfo,
		originalLinkPath: string,
		hasExplicitAlias: boolean,
		implicitSubpath?: string
	): Promise<void> {
		try {
			// Get the original link text for display
			const originalText = linkEl.textContent || `[[${originalLinkPath}]]`;
			const implicitSubpathDisplayText = formatTaskLinkSubpathDisplayText(
				taskInfo.title,
				implicitSubpath ?? extractTaskLinkSubpath(originalLinkPath)
			);

			// Check for alias exclusion
			if (
				shouldSkipReadingModeTaskLinkOverlay({
					disableOverlayOnAlias: this.plugin.settings.disableOverlayOnAlias,
					hasExplicitAlias,
					linkText: linkEl.textContent || "",
					originalLinkPath,
					taskSubpath: implicitSubpath,
					taskPath: taskInfo.path,
					taskTitle: taskInfo.title,
				})
			) {
				return;
			}

			// Parse display text if it's a piped link
			let displayText: string | undefined;
			const linkContent = linkEl.textContent || "";
			if (hasExplicitAlias) {
				displayText = linkContent.trim() || undefined;
			} else if (implicitSubpathDisplayText) {
				displayText = implicitSubpathDisplayText;
			} else if (linkContent !== originalLinkPath && linkContent !== taskInfo.title) {
				displayText = resolveTaskLinkDisplayText(
					linkContent,
					taskInfo.path,
					originalLinkPath
				);
			}

			// Create a task widget instance
			const widget = new TaskLinkWidget(taskInfo, this.plugin, originalText, displayText);

			// Create the DOM element for reading mode
			const widgetElement = this.createReadingModeWidget(
				widget,
				taskInfo,
				originalLinkPath,
				originalText,
				displayText
			);

			// Replace the original link with the widget
			linkEl.parentNode?.replaceChild(widgetElement, linkEl);
		} catch (error) {
			tasknotesLogger.error("Error replacing wikilink with task widget:", {
				category: "persistence",
				operation: "replacing-wikilink-task-widget",
				error: error,
			});
		}
	}

	/**
	 * Create a DOM element for the task widget in reading mode
	 * This reuses the TaskLinkWidget's toDOM method but adapts it for reading mode context
	 */
	private createReadingModeWidget(
		widget: TaskLinkWidget,
		taskInfo: TaskInfo,
		originalLinkPath: string,
		originalText: string,
		displayText?: string
	): HTMLElement {
		// Create a mock EditorView object with minimal required properties
		// This allows us to reuse the existing TaskLinkWidget.toDOM method
		const mockEditorView = {
			// Add any minimal properties needed by toDOM if required
			// The current implementation doesn't seem to use the view parameter extensively
		} as EditorView;

		// Use the existing toDOM method to create the widget element
		const element = widget.toDOM(mockEditorView);

		// Add reading mode specific class
		element.classList.add("task-inline-preview--reading-mode");
		element.dataset.taskPath = taskInfo.path;
		element.dataset.originalLinkPath = originalLinkPath;
		element.dataset.originalText = originalText;
		if (displayText) {
			element.dataset.displayText = displayText;
		}

		return element;
	}
}

/**
 * Factory function to create the post processor
 */
export function createReadingModeTaskLinkProcessor(plugin: TaskNotesPlugin): MarkdownPostProcessor {
	const processor = new ReadingModeTaskLinkProcessor(plugin);
	return processor.createPostProcessor();
}
