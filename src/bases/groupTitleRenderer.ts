import { parseLinktext, TFile } from "obsidian";
import { appendInternalLink, type LinkServices } from "../ui/renderers/linkRenderer";
import { parseLinkToPath } from "../utils/linkUtils";

interface LinkTitleSegment {
	filePath: string;
	displayText: string;
}

type GroupTitlePart = LinkTitleSegment | string;

function resolveDisplayText(
	filePath: string,
	displayText: string,
	linkServices: LinkServices
): string {
	const sourcePath = linkServices.sourcePath ?? "";
	const normalizedPath = parseLinkToPath(filePath);
	const file =
		linkServices.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath) ||
		linkServices.metadataCache.getFirstLinkpathDest(normalizedPath, "");
	if (!(file instanceof TFile)) return displayText;
	const cache = linkServices.metadataCache.getCache(file.path);
	const frontmatterTitle = cache?.frontmatter?.title;
	const usesImplicitPathLabel = shouldUseResolvedFileLabel(displayText, file, normalizedPath);
	if (typeof frontmatterTitle === "string" && frontmatterTitle.trim().length > 0) {
		if (usesImplicitPathLabel) {
			return frontmatterTitle;
		}

		return displayText;
	}

	if (usesImplicitPathLabel) {
		const normalizedDisplay = displayText?.trim() || "";
		if (normalizedDisplay && !normalizedDisplay.includes("/")) {
			return normalizedDisplay;
		}

		return file.basename;
	}

	return displayText;
}

function shouldUseResolvedFileLabel(
	displayText: string | undefined,
	file: TFile,
	normalizedPath: string
): boolean {
	const normalizedDisplay = displayText?.trim() || "";
	const pathWithoutExtension = file.path.replace(/\.md$/i, "");
	const normalizedPathWithoutExtension = normalizedPath.replace(/\.md$/i, "");

	return new Set([
		"",
		file.name,
		file.basename,
		file.path,
		pathWithoutExtension,
		normalizedPath,
		normalizedPathWithoutExtension,
	]).has(normalizedDisplay);
}

function parseWikiLinkSegment(segment: string): LinkTitleSegment | null {
	const wikiLinkMatch = segment.match(/^\[\[([^\]]+)\]\]$/);
	if (!wikiLinkMatch) return null;

	const linkContent = wikiLinkMatch[1];
	if (linkContent.includes("|")) {
		const parts = linkContent.split("|");
		return {
			filePath: parts[0].trim(),
			displayText: parts[1].trim(),
		};
	}

	const parsedLink = parseLinktext(linkContent);
	return {
		filePath: parsedLink.path,
		displayText: parsedLink.path,
	};
}

function parseMarkdownLinkSegment(segment: string): LinkTitleSegment | null {
	const markdownLinkMatch = segment.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (!markdownLinkMatch) return null;

	return {
		displayText: markdownLinkMatch[1].trim(),
		filePath: parseLinkToPath(segment),
	};
}

function parseLinkSegment(segment: string): LinkTitleSegment | null {
	return parseWikiLinkSegment(segment) || parseMarkdownLinkSegment(segment);
}

function parseLinkAt(title: string, startIndex: number): { segment: LinkTitleSegment; endIndex: number } | null {
	const remaining = title.slice(startIndex);
	const wikiMatch = remaining.match(/^\[\[([^\]]+)\]\]/);
	if (wikiMatch) {
		const segment = parseWikiLinkSegment(wikiMatch[0]);
		if (!segment) return null;
		return {
			segment,
			endIndex: startIndex + wikiMatch[0].length,
		};
	}

	const markdownMatch = remaining.match(/^\[([^\]]*)\]\(([^)]+)\)/);
	if (markdownMatch) {
		const segment = parseMarkdownLinkSegment(markdownMatch[0]);
		if (!segment) return null;
		return {
			segment,
			endIndex: startIndex + markdownMatch[0].length,
		};
	}

	return null;
}

function parseDelimitedLinkTitle(title: string): GroupTitlePart[] | null {
	const parts: GroupTitlePart[] = [];
	let index = 0;
	let linkCount = 0;

	while (index < title.length) {
		const leadingWhitespace = title.slice(index).match(/^\s*/)?.[0] ?? "";
		index += leadingWhitespace.length;

		const parsed = parseLinkAt(title, index);
		if (!parsed) return null;

		parts.push(parsed.segment);
		linkCount += 1;
		index = parsed.endIndex;

		const trailingWhitespace = title.slice(index).match(/^\s*/)?.[0] ?? "";
		index += trailingWhitespace.length;

		if (index >= title.length) break;

		const delimiter = title.slice(index).match(/^,\s*/)?.[0];
		if (!delimiter) return null;

		parts.push(delimiter);
		index += delimiter.length;
	}

	return linkCount > 1 ? parts : null;
}

function renderLinkSegment(
	container: HTMLElement,
	segment: LinkTitleSegment,
	linkServices: LinkServices
): void {
	const resolvedText = resolveDisplayText(segment.filePath, segment.displayText, linkServices);
	appendInternalLink(container, segment.filePath, resolvedText, linkServices, {
		cssClass: "internal-link task-group-link",
		hoverSource: "tasknotes-bases-group",
		showErrorNotices: false,
	});
}

/**
 * Render a group title, converting wiki-links and file paths to clickable links with hover preview.
 * Handles:
 * - [[link]] and [[link|alias]] wiki-link formats
 * - Comma-delimited lists of wiki-links and Markdown links
 * - File paths (with or without .md extension)
 * - Regular text
 */
export function renderGroupTitle(
	container: HTMLElement,
	title: string,
	linkServices: LinkServices
): void {
	// Check if the title looks like a wiki-link
	const singleLinkSegment = parseLinkSegment(title);
	if (singleLinkSegment) {
		renderLinkSegment(container, singleLinkSegment, linkServices);
		return;
	}

	const delimitedLinkTitle = parseDelimitedLinkTitle(title);
	if (delimitedLinkTitle) {
		for (const part of delimitedLinkTitle) {
			if (typeof part === "string") {
				container.appendChild(activeDocument.createTextNode(part));
			} else {
				renderLinkSegment(container, part, linkServices);
			}
		}
		return;
	}

	// Check if title is a file path (with or without .md extension)
	// Try to resolve it as a file
	const filePathToTry = title.endsWith(".md") ? title.replace(/\.md$/, "") : title;
	const file = linkServices.metadataCache.getFirstLinkpathDest(filePathToTry, "");

	if (file instanceof TFile) {
		const displayText = file.basename;
		const resolvedText = resolveDisplayText(filePathToTry, displayText, linkServices);
		appendInternalLink(container, filePathToTry, resolvedText, linkServices, {
			cssClass: "internal-link task-group-link",
			hoverSource: "tasknotes-bases-group",
			showErrorNotices: false,
		});
		return;
	}

	// Not a link or file path - render as regular text
	container.textContent = title;
}
