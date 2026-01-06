import { parseLinktext, TFile } from "obsidian";
import { appendInternalLink, type LinkServices } from "../ui/renderers/linkRenderer";
import { parseLinkToPath } from "../utils/linkUtils";

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
	if (typeof frontmatterTitle !== "string" || frontmatterTitle.trim().length === 0) {
		return displayText;
	}

	const normalizedDisplay = displayText?.trim() || "";
	if (
		normalizedDisplay === "" ||
		normalizedDisplay === file.name ||
		normalizedDisplay === file.basename ||
		normalizedDisplay === file.path ||
		normalizedDisplay === normalizedPath
	) {
		return frontmatterTitle;
	}

	return displayText;
}

/**
 * Render a group title, converting wiki-links and file paths to clickable links with hover preview.
 * Handles:
 * - [[link]] and [[link|alias]] wiki-link formats
 * - File paths (with or without .md extension)
 * - Regular text
 */
export function renderGroupTitle(
	container: HTMLElement,
	title: string,
	linkServices: LinkServices
): void {
	// Check if the title looks like a wiki-link
	const wikiLinkMatch = title.match(/^\[\[([^\]]+)\]\]$/);
	const markdownLinkMatch = title.match(/^\[([^\]]*)\]\(([^)]+)\)$/);

	if (wikiLinkMatch) {
		// Parse wiki-link format: [[path|alias]] or [[path]]
		const linkContent = wikiLinkMatch[1];
		let filePath = linkContent;
		let displayText = linkContent;
		if (linkContent.includes("|")) {
			const parts = linkContent.split("|");
			filePath = parts[0].trim();
			displayText = parts[1].trim();
		} else {
			const parsedLink = parseLinktext(linkContent);
			filePath = parsedLink.path;
			displayText = parsedLink.path;
		}
		const resolvedText = resolveDisplayText(filePath, displayText, linkServices);

		appendInternalLink(container, filePath, resolvedText, linkServices, {
			cssClass: "internal-link task-group-link",
			hoverSource: "tasknotes-bases-group",
			showErrorNotices: false,
		});
		return;
	}

	if (markdownLinkMatch) {
		const displayText = markdownLinkMatch[1].trim();
		const filePath = markdownLinkMatch[2].trim();
		const resolvedText = resolveDisplayText(filePath, displayText, linkServices);
		appendInternalLink(container, filePath, resolvedText, linkServices, {
			cssClass: "internal-link task-group-link",
			hoverSource: "tasknotes-bases-group",
			showErrorNotices: false,
		});
		return;
	}

	// Check if title is a file path (with or without .md extension)
	// Try to resolve it as a file
	const filePathToTry = title.endsWith(".md") ? title.replace(/\.md$/, "") : title;
	const file = linkServices.metadataCache.getFirstLinkpathDest(filePathToTry, "");

	if (file instanceof TFile) {
		// Render as clickable link with the file's basename as display text
		const displayText = resolveDisplayText(filePathToTry, file.basename, linkServices);
		appendInternalLink(container, filePathToTry, displayText, linkServices, {
			cssClass: "internal-link task-group-link",
			hoverSource: "tasknotes-bases-group",
			showErrorNotices: false,
		});
		return;
	}

	// Not a link or file path - render as regular text
	container.textContent = title;
}
