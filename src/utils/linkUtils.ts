import type { App, TFile } from "obsidian";
import { createTaskNotesLogger } from "./tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Utils/LinkUtils" });

/** A link split into the path used for file lookup and its heading/block subpath. */
export interface LinkTarget {
	path: string;
	/** Heading or block subpath including the leading "#" (e.g. "#Heading", "#^block"), or "". */
	subpath: string;
}

function splitLinkSubpath(linkText: string): LinkTarget {
	const subpathIndex = linkText.search(/[#^]/);
	if (subpathIndex === -1) {
		return { path: linkText.trim(), subpath: "" };
	}
	const rest = linkText.slice(subpathIndex).trim();
	const subpath = rest.startsWith("#") ? rest : `#${rest}`;
	return {
		path: linkText.slice(0, subpathIndex).trim(),
		subpath: subpath === "#" ? "" : subpath,
	};
}

function isAngleBracketed(value: string): boolean {
	return value.startsWith("<") && value.endsWith(">");
}

function decodeLinkPath(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch (error) {
		tasknotesLogger.debug("Failed to decode URI component:", {
			category: "internal",
			operation: "decode-uri-component",
			details: { value },
			error: error,
		});
		return value;
	}
}

/**
 * Parse a URL-style link destination (markdown link href or <...> path).
 * The destination is decoded before the subpath is split off, so
 * "Folder/My%20Note.md#Heading" resolves to "Folder/My Note.md" + "#Heading".
 * Destinations ending in ".md" are kept whole so filenames containing "#" or "^" still resolve.
 */
function parseEncodedLinkTarget(rawPath: string): LinkTarget {
	let linkPath = rawPath.trim();
	if (isAngleBracketed(linkPath)) {
		linkPath = linkPath.slice(1, -1).trim();
	}

	const hasMdExt = /\.md$/i.test(linkPath);
	const decoded = decodeLinkPath(linkPath);
	return hasMdExt ? { path: decoded, subpath: "" } : splitLinkSubpath(decoded);
}

/**
 * Parse the inner text of a wikilink ("path#Heading|alias") into path and subpath.
 * An angle-bracketed path ("<Folder/My%20Note.md#Heading>") is decoded like a markdown destination.
 */
export function parseWikilinkTarget(inner: string): LinkTarget {
	const trimmed = inner.trim();
	const pipeIndex = trimmed.indexOf("|");
	const pathOnly = (pipeIndex !== -1 ? trimmed.substring(0, pipeIndex) : trimmed).trim();
	return isAngleBracketed(pathOnly)
		? parseEncodedLinkTarget(pathOnly)
		: splitLinkSubpath(pathOnly);
}

/** Parse a markdown link destination ("Folder/My%20Note.md#Heading" or "<...>") into path and subpath. */
export function parseMarkdownLinkTarget(href: string): LinkTarget {
	return parseEncodedLinkTarget(href);
}

/**
 * Parse a link string (wikilink, markdown link or <...> path) into the path used for
 * file lookup and its heading/block subpath. Non-link strings are returned as the path.
 */
export function parseLinkTarget(linkText: string): LinkTarget {
	if (!linkText) return { path: linkText, subpath: "" };

	const trimmed = linkText.trim();

	// Handle plain angle-bracket autolink style: <path/to/note.md>
	if (isAngleBracketed(trimmed)) {
		return parseEncodedLinkTarget(trimmed);
	}

	// Handle wikilinks: [[path]] or [[path|alias]]
	if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
		return parseWikilinkTarget(trimmed.slice(2, -2));
	}

	// Handle markdown links: [text](path)
	const markdownMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		return parseMarkdownLinkTarget(markdownMatch[2]);
	}

	// Not a link format, return as-is
	return { path: trimmed, subpath: "" };
}

/**
 * Parse a link string (wikilink or markdown) to extract the path.
 * Handles both [[wikilink]] and [text](path) formats.
 *
 * @param linkText - The link text to parse
 * @returns The extracted path, or the original string if it's not a recognized link format
 */
export function parseLinkToPath(linkText: string): string {
	if (!linkText) return linkText;

	const trimmed = linkText.trim();
	const { path } = parseLinkTarget(trimmed);
	if (!path && isAngleBracketed(trimmed)) {
		return decodeLinkPath(trimmed.slice(1, -1).trim());
	}
	return path;
}

/**
 * Extract a human-friendly display name for project values.
 * Supports wikilinks, markdown links (including <...> paths), and plain text.
 *
 * @param projectValue - The raw project value
 * @param app - Optional Obsidian app for resolving to basename
 * @param sourcePath - Path of the note containing the link, used to resolve relative links
 */
export function getProjectDisplayName(
	projectValue: string,
	app?: App,
	sourcePath = ""
): string {
	if (!projectValue) return "";

	const trimmed = projectValue.trim();

	// Handle markdown links: [text](path)
	const markdownMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		const displayText = markdownMatch[1].trim();
		const rawPath = markdownMatch[2].trim();
		const linkPath = parseLinkToPath(rawPath);
		const resolvedDisplayName = getResolvedProjectDisplayName(
			linkPath,
			sourcePath,
			app,
			displayText
		);
		if (resolvedDisplayName) {
			return resolvedDisplayName;
		}
		if (displayText) {
			return displayText;
		}
		const cleanPath = linkPath.replace(/\.md$/i, "");
		const parts = cleanPath.split("/");
		return parts[parts.length - 1] || cleanPath;
	}

	// Handle wikilinks: [[path]] or [[path|alias]]
	if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
		const linkContent = trimmed.slice(2, -2).trim();
		const pipeIndex = linkContent.indexOf("|");
		if (pipeIndex !== -1) {
			const alias = linkContent.slice(pipeIndex + 1).trim();
			if (alias) return alias;
		}
		const linkPath = parseWikilinkTarget(linkContent).path || parseLinkToPath(trimmed);
		const resolvedDisplayName = getResolvedProjectDisplayName(linkPath, sourcePath, app);
		if (resolvedDisplayName) return resolvedDisplayName;
		const cleanPath = linkPath.replace(/\.md$/i, "");
		const parts = cleanPath.split("/");
		return parts[parts.length - 1] || cleanPath;
	}

	// Plain text
	return trimmed;
}

function getResolvedProjectDisplayName(
	linkPath: string,
	sourcePath: string,
	app?: App,
	displayText?: string
): string | null {
	const resolved = app?.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
	if (!resolved) return null;

	const frontmatterTitle = getResolvedFileTitle(resolved, app);
	if (frontmatterTitle && shouldUseResolvedTitle(displayText, resolved, linkPath)) {
		return frontmatterTitle;
	}

	return displayText?.trim() || resolved.basename;
}

function getResolvedFileTitle(file: TFile, app?: App): string | null {
	const cache =
		app?.metadataCache.getFileCache(file) ??
		(
			app?.metadataCache
		)?.getCache?.(file.path);
	const title = cache?.frontmatter?.title;
	return typeof title === "string" && title.trim().length > 0 ? title.trim() : null;
}

function shouldUseResolvedTitle(
	displayText: string | undefined,
	file: TFile,
	linkPath: string
): boolean {
	const normalizedDisplay = displayText?.trim() || "";
	if (!normalizedDisplay) return true;

	const pathWithoutExtension = file.path.replace(/\.md$/i, "");
	const linkPathWithoutExtension = linkPath.replace(/\.md$/i, "");
	return new Set([
		file.name,
		file.basename,
		file.path,
		pathWithoutExtension,
		linkPath,
		linkPathWithoutExtension,
	]).has(normalizedDisplay);
}

/**
 * Generate a link for use in frontmatter properties.
 * By default generates wikilink format because Obsidian does not support markdown links
 * in frontmatter properties. Can be configured to use markdown links if the user has
 * the obsidian-frontmatter-markdown-links plugin installed.
 *
 * @param app - Obsidian app instance
 * @param targetFile - The file to link to
 * @param sourcePath - The path of the file containing the link (for relative paths)
 * @param subpath - Optional subpath (e.g., heading anchor)
 * @param alias - Optional display alias
 * @param useMarkdownLinks - If true, use Obsidian API which respects user's link format preference (requires third-party plugin for frontmatter)
 * @returns A link string in wikilink or markdown format
 */
export function generateLink(
	app: App,
	targetFile: TFile,
	sourcePath: string,
	subpath?: string,
	alias?: string,
	useMarkdownLinks?: boolean
): string {
	// If markdown links are explicitly requested, use Obsidian API
	if (useMarkdownLinks) {
		return app.fileManager.generateMarkdownLink(
			targetFile,
			sourcePath,
			subpath || "",
			alias || ""
		);
	}

	// Default: generate wikilink format for frontmatter compatibility (issue #827)
	// Obsidian does not support markdown links in frontmatter properties without a plugin
	const linktext = app.metadataCache.fileToLinktext(targetFile, sourcePath, true);
	let link = `[[${linktext}`;

	if (subpath) {
		link += subpath;
	}

	if (alias) {
		link += `|${alias}`;
	}

	link += "]]";
	return link;
}

/**
 * Generate a link with the file's basename as the alias.
 * Useful for creating links that display the file name.
 *
 * @param app - Obsidian app instance
 * @param targetFile - The file to link to
 * @param sourcePath - The path of the file containing the link
 * @param useMarkdownLinks - If true, use Obsidian API which respects user's link format preference
 * @returns A link with basename as alias
 */
export function generateLinkWithBasename(
	app: App,
	targetFile: TFile,
	sourcePath: string,
	useMarkdownLinks?: boolean
): string {
	return generateLink(app, targetFile, sourcePath, "", targetFile.basename, useMarkdownLinks);
}

/**
 * Generate a link with a custom path display as the alias.
 * Useful for showing full paths in UI.
 *
 * @param app - Obsidian app instance
 * @param targetFile - The file to link to
 * @param sourcePath - The path of the file containing the link
 * @param displayName - Custom display name
 * @param useMarkdownLinks - If true, use Obsidian API which respects user's link format preference
 * @returns A link with custom display name as alias
 */
export function generateLinkWithDisplay(
	app: App,
	targetFile: TFile,
	sourcePath: string,
	displayName: string,
	useMarkdownLinks?: boolean
): string {
	return generateLink(app, targetFile, sourcePath, "", displayName, useMarkdownLinks);
}
