import { TFile, parseLinktext } from "obsidian";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";
import {
	formatTaskLinkSubpathDisplayText,
	resolveTaskLinkDisplayText,
} from "../editor/taskLinkDisplayText";

export interface TaskLinkInfo {
	isValidTaskLink: boolean;
	taskPath?: string;
	taskInfo?: TaskInfo;
	displayText?: string;
}

interface ParsedTaskLink {
	linkPath: string;
	displayText?: string;
	subpath?: string;
	hasExplicitAlias: boolean;
}

export class TaskLinkDetectionService {
	private plugin: TaskNotesPlugin;
	private linkCache = new Map<string, { result: TaskLinkInfo; lastModified: number }>();
	private logger: TaskNotesLogger;

	constructor(plugin: TaskNotesPlugin, logger?: TaskNotesLogger) {
		this.plugin = plugin;
		this.logger =
			logger ??
			createTaskNotesLogger({
				tag: "TaskLinkDetectionService",
				isDebugEnabled: () => plugin.settings.enableDebugLogging,
			});
	}

	/**
	 * Parse a link (wikilink or markdown) and determine if it points to a valid task
	 */
	async detectTaskLink(
		linkText: string,
		sourcePath: string,
		linkType: "wikilink" | "markdown" = "wikilink"
	): Promise<TaskLinkInfo> {
		const parsed =
			linkType === "wikilink"
				? this.parseWikilink(linkText)
				: this.parseMarkdownLink(linkText);

		if (!parsed) {
			return { isValidTaskLink: false };
		}

		const { linkPath, displayText: parsedDisplayText } = parsed;
		const cacheKey = `${sourcePath}:${linkPath}`;

		// Check cache first
		const cached = this.linkCache.get(cacheKey);
		if (cached) {
			const file = this.plugin.app.vault.getAbstractFileByPath(linkPath);
			if (file instanceof TFile && file.stat.mtime === cached.lastModified) {
				return cached.result;
			}
		}

		// Resolve the link path
		const resolvedPath = this.resolveLinkPath(linkPath, sourcePath);
		if (!resolvedPath) {
			const result = { isValidTaskLink: false };
			this.cacheResult(cacheKey, result, 0);
			return result;
		}

		// Check if file exists and is a valid task
		const file = this.plugin.app.vault.getAbstractFileByPath(resolvedPath);
		if (!(file instanceof TFile)) {
			const result = { isValidTaskLink: false };
			this.cacheResult(cacheKey, result, 0);
			return result;
		}

		// Check if file contains task metadata
		try {
			const taskInfo = await this.plugin.cacheManager.getTaskInfo(resolvedPath);
			if (taskInfo) {
				const displayText = this.resolveDisplayText(
					parsed,
					linkType,
					taskInfo,
					linkPath,
					parsedDisplayText
				);
				const result: TaskLinkInfo = {
					isValidTaskLink: true,
					taskPath: resolvedPath,
					taskInfo,
					displayText,
				};
				this.cacheResult(cacheKey, result, file.stat.mtime);
				return result;
			}
		} catch (error) {
			this.logger.debug("Error checking task info for link", {
				category: "stale-data",
				operation: "detect-task-link",
				details: { resolvedPath },
				error,
			});
		}

		const result = { isValidTaskLink: false };
		this.cacheResult(cacheKey, result, file.stat.mtime);
		return result;
	}

	private resolveDisplayText(
		parsed: ParsedTaskLink,
		linkType: "wikilink" | "markdown",
		taskInfo: TaskInfo,
		linkPath: string,
		parsedDisplayText?: string
	): string | undefined {
		if (linkType === "markdown") {
			if (parsedDisplayText) {
				return resolveTaskLinkDisplayText(parsedDisplayText, taskInfo.path, linkPath);
			}
			return formatTaskLinkSubpathDisplayText(taskInfo.title, parsed.subpath);
		}

		if (parsed.hasExplicitAlias) {
			return parsedDisplayText;
		}

		return formatTaskLinkSubpathDisplayText(taskInfo.title, parsed.subpath);
	}

	/**
	 * Parse wikilink syntax to extract link path and display text
	 */
	private parseWikilink(wikilinkText: string): ParsedTaskLink | null {
		// Remove the [[ and ]] brackets
		const content = wikilinkText.slice(2, -2).trim();
		if (!content) return null;

		// First check for alias syntax: [[path|alias]]
		const pipeIndex = content.indexOf("|");
		if (pipeIndex !== -1) {
			const pathPart = content.slice(0, pipeIndex).trim();
			const aliasPart = content.slice(pipeIndex + 1).trim();

			if (!pathPart || !aliasPart) return null;

			// Parse the path part for subpaths/headings
			const parsed = parseLinktext(pathPart);
			return {
				linkPath: parsed.path,
				displayText: aliasPart,
				subpath: parsed.subpath || undefined,
				hasExplicitAlias: true,
			};
		}

		// No alias, use parseLinktext for path and subpath
		const parsed = parseLinktext(content);
		return {
			linkPath: parsed.path,
			subpath: parsed.subpath || undefined,
			hasExplicitAlias: false,
		};
	}

	/**
	 * Parse markdown link syntax to extract link path and display text
	 */
	private parseMarkdownLink(
		markdownLinkText: string
	): ParsedTaskLink | null {
		// Parse markdown link: [text](path)
		const match = markdownLinkText.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
		if (!match) return null;

		const displayText = match[1].trim();
		let linkPath = match[2].trim();

		// Strip angle brackets used to escape spaces/special characters in markdown links
		if (linkPath.startsWith("<") && linkPath.endsWith(">")) {
			linkPath = linkPath.slice(1, -1).trim();
		}

		if (!linkPath) return null;

		// URL decode the link path - this is crucial for markdown links
		try {
			linkPath = decodeURIComponent(linkPath);
		} catch (error) {
			this.logger.debug("Failed to decode URI component", {
				category: "validation",
				operation: "parse-markdown-link",
				details: { linkPath },
				error,
			});
			// If decoding fails, use the original path
		}

		// Use Obsidian's parseLinktext to handle any subpaths/headings
		const parsed = parseLinktext(linkPath);

		return {
			linkPath: parsed.path,
			displayText: displayText || undefined,
			subpath: parsed.subpath || undefined,
			hasExplicitAlias: Boolean(displayText),
		};
	}

	/**
	 * Resolve a link path relative to the source file
	 */
	private resolveLinkPath(linkPath: string, sourcePath: string): string | null {
		try {
			// Use Obsidian's built-in link resolution
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
			return file?.path || null;
		} catch (error) {
			this.logger.debug("Error resolving link path", {
				category: "provider",
				operation: "resolve-link-path",
				details: { linkPath, sourcePath },
				error,
			});
			return null;
		}
	}

	/**
	 * Cache the result of a task link detection
	 */
	private cacheResult(cacheKey: string, result: TaskLinkInfo, lastModified: number): void {
		this.linkCache.set(cacheKey, { result, lastModified });

		// Prevent memory leaks by limiting cache size
		if (this.linkCache.size > 1000) {
			const firstKey = this.linkCache.keys().next().value;
			this.linkCache.delete(firstKey);
		}
	}

	/**
	 * Clear cache for a specific file path
	 */
	clearCacheForFile(filePath: string): void {
		for (const [key] of this.linkCache) {
			if (key.includes(filePath)) {
				this.linkCache.delete(key);
			}
		}
	}

	/**
	 * Clear entire cache
	 */
	clearCache(): void {
		this.linkCache.clear();
	}

	/**
	 * Find all wikilinks and markdown links in a text string
	 */
	findWikilinks(
		text: string
	): Array<{ match: string; start: number; end: number; type: "wikilink" | "markdown" }> {
		const links: Array<{
			match: string;
			start: number;
			end: number;
			type: "wikilink" | "markdown";
		}> = [];

		// Find wikilinks: [[link]] or [[link|alias]]
		const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
		let match;

		while ((match = wikilinkRegex.exec(text)) !== null) {
			links.push({
				match: match[0],
				start: match.index,
				end: match.index + match[0].length,
				type: "wikilink",
			});
		}

		// Find markdown links: [text](path)
		const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
		wikilinkRegex.lastIndex = 0; // Reset regex state

		while ((match = markdownLinkRegex.exec(text)) !== null) {
			links.push({
				match: match[0],
				start: match.index,
				end: match.index + match[0].length,
				type: "markdown",
			});
		}

		// Sort by start position to maintain order
		return links.sort((a, b) => a.start - b.start);
	}

	/**
	 * Clean up resources and clear caches
	 */
	cleanup(): void {
		// Clear the link cache to prevent memory leaks
		this.linkCache.clear();
	}
}
