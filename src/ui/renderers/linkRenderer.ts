/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Link and tag rendering utilities for UI components

import { App, TFile, Notice } from "obsidian";
import { parseLinkToPath } from "../../utils/linkUtils";

export type LinkNavigateHandler = (
	normalizedPath: string,
	event: MouseEvent
) => Promise<boolean | void> | boolean | void;

/** Minimal services required to render internal links (DI-friendly) */
export interface LinkServices {
	metadataCache: App["metadataCache"];
	workspace: App["workspace"];
	/**
	 * Optional source path to resolve relative links and support angle-bracket markdown links.
	 * Defaults to root resolution when not provided.
	 */
	sourcePath?: string;
}

/** Type for hover-link event payload */
interface HoverLinkEvent {
	event: MouseEvent;
	source: string;
	hoverParent: HTMLElement;
	targetEl: HTMLElement;
	linktext: string;
	sourcePath: string;
}

// Enhanced regex to handle more link types including autolinks and reference-style links
const LINK_REGEX =
	/\[\[([^[\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)|<(https?:\/\/[^\s>]+)>|\[([^\]]+)\]\s*\[([^\]]*)\]/g;

/** Enhanced internal link creation with better error handling and accessibility */
export function appendInternalLink(
	container: HTMLElement,
	filePath: string,
	displayText: string,
	deps: LinkServices,
	options: {
		cssClass?: string;
		hoverSource?: string;
		showErrorNotices?: boolean;
		onPrimaryNavigate?: LinkNavigateHandler;
	} = {}
): void {
	const {
		cssClass = "internal-link",
		hoverSource = "tasknotes-property-link",
		showErrorNotices = false,
		onPrimaryNavigate,
	} = options;

	const sourcePath = deps.sourcePath ?? "";
	const normalizedPath = parseLinkToPath(filePath);

	const linkEl = container.createEl("a", {
		cls: cssClass,
		text: displayText,
		attr: {
			"data-href": normalizedPath,
			role: "link",
			tabindex: "0",
		},
	});

	linkEl.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();
		try {
			if (e.ctrlKey || e.metaKey) {
				// Ctrl/Cmd+Click opens in new tab
				deps.workspace.openLinkText(normalizedPath, sourcePath, true);
				return;
			}

			if (onPrimaryNavigate) {
				const handled = await onPrimaryNavigate(normalizedPath, e);
				if (handled !== false) {
					return;
				}
			}

			const file =
				deps.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath) ||
				deps.metadataCache.getFirstLinkpathDest(normalizedPath, "");
			if (file instanceof TFile) {
				await deps.workspace.getLeaf(false).openFile(file);
			} else if (showErrorNotices) {
				new Notice(`Note "${displayText}" not found`);
			}
		} catch (error) {
			console.error("[TaskNotes] Error opening internal link:", { filePath, error });
			if (showErrorNotices) {
				new Notice(`Failed to open note "${displayText}"`);
			}
		}
	});

	// Middle-click opens in new tab
	linkEl.addEventListener("auxclick", async (e) => {
		if (e.button === 1) {
			e.preventDefault();
			e.stopPropagation();
			try {
				const file =
					deps.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath) ||
					deps.metadataCache.getFirstLinkpathDest(normalizedPath, "");
				if (file instanceof TFile) {
					deps.workspace.openLinkText(normalizedPath, sourcePath, true);
				}
			} catch (error) {
				console.error("[TaskNotes] Error opening internal link:", { filePath, error });
			}
		}
	});

	linkEl.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			(linkEl as HTMLElement).click();
		}
	});

	linkEl.addEventListener("mouseover", (event) => {
		const file =
			deps.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath) ||
			deps.metadataCache.getFirstLinkpathDest(normalizedPath, "");
		if (file instanceof TFile) {
			const hoverEvent: HoverLinkEvent = {
				event: event as MouseEvent,
				source: hoverSource,
				hoverParent: container,
				targetEl: linkEl,
				linktext: normalizedPath,
				sourcePath: sourcePath || file.path,
			};
			deps.workspace.trigger("hover-link", hoverEvent);
		}
	});
}

/** Render a text string, converting WikiLinks and Markdown links */
export interface RenderLinksOptions {
	renderPlain?: (container: HTMLElement, text: string, deps: LinkServices) => void;
	onTagClick?: (tag: string, event: MouseEvent) => void | Promise<void>;
}

export function renderTextWithLinks(
	container: HTMLElement,
	text: string,
	deps: LinkServices,
	options?: RenderLinksOptions
): void {
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	// First, handle wikilinks and markdown links
	while ((match = LINK_REGEX.exec(text)) !== null) {
		const [full, wikiInner, mdText, mdHref] = match as any;
		const start = match.index;

		if (start > lastIndex) {
			container.appendChild(document.createTextNode(text.slice(lastIndex, start)));
		}

		if (wikiInner) {
			const content = wikiInner;
			let filePath = content;
			let displayText = content;
			if (content.includes("|")) {
				const [fp, alias] = content.split("|");
				filePath = fp;
				displayText = alias;
			}
			appendInternalLink(container, filePath, displayText, deps);
		} else if (mdText && mdHref) {
			const href = String(mdHref).trim();
			const disp = String(mdText).trim();
			if (/^[a-z]+:\/\//i.test(href)) {
				const a = container.createEl("a", {
					text: disp,
					attr: { href, target: "_blank", rel: "noopener" },
				});
				a.classList.add("external-link");
			} else {
				appendInternalLink(container, href, disp, deps);
			}
		}

		lastIndex = start + full.length;
	}

	// Handle remaining text, checking for tags if onTagClick is provided
	const remainingText = text.slice(lastIndex);
	if (remainingText && options?.onTagClick) {
		// Look for tags in the remaining text
		const tagRegex = /(^|\s)(#[\p{L}\p{N}\p{M}_/-]+)/gu;
		let tagLastIndex = 0;
		let tagMatch: RegExpExecArray | null;

		while ((tagMatch = tagRegex.exec(remainingText)) !== null) {
			const [, prefix, tag] = tagMatch;
			const tagStart = tagMatch.index;

			// Add text before the tag
			if (tagStart > tagLastIndex) {
				container.appendChild(
					document.createTextNode(remainingText.slice(tagLastIndex, tagStart))
				);
			}

			// Add the prefix (space or start of string)
			if (prefix) {
				container.appendChild(document.createTextNode(prefix));
			}

			// Create clickable tag
			const tagEl = container.createEl("a", {
				cls: "tag",
				text: tag,
				attr: {
					href: tag,
					role: "button",
					tabindex: "0",
				},
			});

			tagEl.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				options.onTagClick!(tag, e as MouseEvent);
			});

			tagEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					options.onTagClick!(tag, e as any);
				}
			});

			tagLastIndex = tagStart + prefix.length + tag.length;
		}

		// Add any remaining text after the last tag
		if (tagLastIndex < remainingText.length) {
			container.appendChild(document.createTextNode(remainingText.slice(tagLastIndex)));
		}
	} else if (remainingText) {
		// No tag handling, just add the remaining text
		container.appendChild(document.createTextNode(remainingText));
	}
}

/** Render a value (string or string[]) with link support */
export function renderValueWithLinks(
	container: HTMLElement,
	value: unknown,
	deps: LinkServices
): void {
	if (typeof value === "string") {
		renderTextWithLinks(container, value, deps);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, idx) => {
			if (idx > 0) container.appendChild(document.createTextNode(", "));
			if (typeof item === "string") renderTextWithLinks(container, item, deps);
			else container.appendChild(document.createTextNode(String(item)));
		});
		return;
	}
	container.appendChild(document.createTextNode(String(value)));
}

/**
 * Check if a project string is in wikilink format [[Note Name]]
 * Enhanced to handle edge cases like escaped brackets
 */
function isWikilink(text: string): boolean {
	if (!text || typeof text !== "string") return false;

	// Check for basic format
	if (!text.startsWith("[[") || !text.endsWith("]]")) return false;

	// Check for escaped brackets (not a real wikilink)
	if (text.startsWith("\\[[") || text.endsWith("\\]]")) return false;

	// Ensure there's actual content between the brackets
	const content = text.slice(2, -2).trim();
	return content.length > 0;
}

/**
 * Check if a project string is in markdown link format [text](path)
 */
function isMarkdownLink(text: string): boolean {
	if (!text || typeof text !== "string") return false;
	return /^\[([^\]]*)\]\(([^)]+)\)$/.test(text);
}

/**
 * Parse a markdown link to extract display text and file path
 */
function parseMarkdownLink(text: string): { displayText: string; filePath: string } | null {
	const match = text.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (!match) return null;

	const displayText = match[1].trim();
	const rawPath = match[2].trim();
	const filePath = parseLinkToPath(rawPath);

	return { displayText, filePath };
}

function resolveProjectDisplayText(
	filePath: string,
	displayText: string,
	deps: LinkServices
): string {
	const sourcePath = deps.sourcePath ?? "";
	const normalizedPath = parseLinkToPath(filePath);
	const file =
		deps.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath) ||
		deps.metadataCache.getFirstLinkpathDest(normalizedPath, "");
	if (!(file instanceof TFile)) return displayText;
	const cache = deps.metadataCache.getCache(file.path);
	const frontmatterTitle = cache?.frontmatter?.title;
	if (typeof frontmatterTitle !== "string" || frontmatterTitle.trim().length === 0) {
		return displayText;
	}

	const normalizedDisplay = displayText?.trim() || "";
	const fileName = file.name;
	const fileBase = file.basename;
	if (
		normalizedDisplay === "" ||
		normalizedDisplay === fileName ||
		normalizedDisplay === fileBase ||
		normalizedDisplay === file.path ||
		normalizedDisplay === normalizedPath
	) {
		return frontmatterTitle;
	}

	return displayText;
}

/**
 * Render project links with custom formatting (enhanced from TaskCard)
 */
export function renderProjectLinks(
	container: HTMLElement,
	projects: string[],
	deps: LinkServices,
	options: { onPrimaryNavigate?: LinkNavigateHandler } = {}
): void {
	container.innerHTML = "";

	// Flatten nested arrays and filter out null/undefined values
	const validProjects = projects
		.flat(2)
		.filter(
			(project) => project !== null && project !== undefined && typeof project === "string"
		);

	validProjects.forEach((project, index) => {
		if (index > 0) {
			container.appendChild(document.createTextNode(", "));
		}

		// Add + prefix for projects
		container.appendChild(document.createTextNode("+"));

		if (isWikilink(project)) {
			// Parse the wikilink to separate path and display text
			const linkContent = project.slice(2, -2);
			let filePath = linkContent;
			let displayText = linkContent;

			// Handle alias syntax: [[path|alias]]
			// Note: parseLinktext() doesn't preserve alias info, so we parse manually
			if (linkContent.includes("|")) {
				const parts = linkContent.split("|");
				filePath = parts[0].trim();
				displayText = parts[1].trim();
			}

			const resolvedText = resolveProjectDisplayText(filePath, displayText, deps);
			appendInternalLink(container, filePath, resolvedText, deps, {
				cssClass: "task-card__project-link internal-link",
				hoverSource: "tasknotes-project-link",
				showErrorNotices: true,
				onPrimaryNavigate: options.onPrimaryNavigate,
			});
		} else if (isMarkdownLink(project)) {
			// Parse markdown link: [text](path)
			const parsed = parseMarkdownLink(project);
			if (parsed) {
				const resolvedText = resolveProjectDisplayText(
					parsed.filePath,
					parsed.displayText,
					deps
				);
				appendInternalLink(container, parsed.filePath, resolvedText, deps, {
					cssClass: "task-card__project-link internal-link",
					hoverSource: "tasknotes-project-link",
					showErrorNotices: true,
					onPrimaryNavigate: options.onPrimaryNavigate,
				});
			} else {
				// Fallback to plain text if parsing fails
				container.appendChild(document.createTextNode(project));
			}
		} else {
			// Plain text project
			container.appendChild(document.createTextNode(project));
		}
	});
}

/**
 * Render an array of strings with custom separator and formatting
 */
export function renderArrayWithLinks(
	container: HTMLElement,
	items: string[],
	deps: LinkServices,
	options: {
		separator?: string;
		prefix?: string;
		cssClass?: string;
	} = {}
): void {
	const { separator = ", ", prefix = "", cssClass = "internal-link" } = options;

	const validItems = items
		.flat(2)
		.filter((item) => item !== null && item !== undefined && typeof item === "string");

	validItems.forEach((item, index) => {
		if (index > 0) {
			container.appendChild(document.createTextNode(separator));
		}

		if (prefix) {
			container.appendChild(document.createTextNode(prefix));
		}

		renderTextWithLinks(container, item, deps, {
			renderPlain: (container, text) => {
				container.createEl("span", { text, cls: cssClass });
			},
		});
	});
}
