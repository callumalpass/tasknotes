import { MarkdownPostProcessor } from "obsidian";
import { EditorView } from "@codemirror/view";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { TaskLinkWidget } from "./TaskLinkWidget";

/**
 * Markdown post processor that adds task previews to wikilinks in reading mode
 */
export class ReadingModeTaskLinkProcessor {
	private plugin: TaskNotesPlugin;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
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

			for (const link of Array.from(allLinks)) {
				const linkEl = link as HTMLAnchorElement;
				const href = linkEl.getAttribute("href");

				// Process internal links (wikilinks) - these have .internal-link class
				if (linkEl.classList.contains("internal-link")) {
					this.processLink(linkEl, ctx.sourcePath, "internal");
				}
				// Process other links that might be markdown links to internal files
				else if (
					href &&
					!href.startsWith("http://") &&
					!href.startsWith("https://") &&
					!href.includes("://")
				) {
					this.processLink(linkEl, ctx.sourcePath, "external");
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
		linkType: "internal" | "external"
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
			await this.replaceWithTaskWidget(linkEl, taskInfo, linkPath);
		} catch (error) {
			console.debug("Error processing link in reading mode:", error);
		}
	}

	/**
	 * Resolve a link path to an actual file path
	 */
	private resolveLinkPath(linkPath: string, sourcePath: string): string | null {
		try {
			// Use Obsidian's metadata cache to resolve the link - it handles relative paths safely
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
				linkPath,
				sourcePath
			);
			return file?.path || null;
		} catch (error) {
			console.debug("Error resolving link path:", linkPath, error);
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
			console.debug("Error getting task info for:", filePath, error);
			return null;
		}
	}

	/**
	 * Replace a wikilink with a task widget
	 */
	private async replaceWithTaskWidget(
		linkEl: HTMLAnchorElement,
		taskInfo: TaskInfo,
		originalLinkPath: string
	): Promise<void> {
		try {
			// Get the original link text for display
			const originalText = linkEl.textContent || `[[${originalLinkPath}]]`;

			// Check for alias exclusion
			if (this.plugin.settings.disableOverlayOnAlias) {
				// In reading mode, we check if the displayed text differs from the path or title
				// If it does, it's likely an alias/custom text
				const currentText = linkEl.textContent || "";
				
				// If text doesn't match path AND doesn't match task title, it's an alias
				if (currentText !== originalLinkPath && currentText !== taskInfo.title) {
					return;
				}
			}

			// Parse display text if it's a piped link
			let displayText: string | undefined;
			const linkContent = linkEl.textContent || "";
			if (linkContent !== originalLinkPath && linkContent !== taskInfo.title) {
				displayText = linkContent;
			}

			// Create a task widget instance
			const widget = new TaskLinkWidget(taskInfo, this.plugin, originalText, displayText);

			// Create the DOM element for reading mode
			const widgetElement = this.createReadingModeWidget(
				widget,
				taskInfo,
				originalText,
				displayText
			);

			// Replace the original link with the widget
			linkEl.parentNode?.replaceChild(widgetElement, linkEl);
		} catch (error) {
			console.error("Error replacing wikilink with task widget:", error);
		}
	}

	/**
	 * Create a DOM element for the task widget in reading mode
	 * This reuses the TaskLinkWidget's toDOM method but adapts it for reading mode context
	 */
	private createReadingModeWidget(
		widget: TaskLinkWidget,
		taskInfo: TaskInfo,
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
