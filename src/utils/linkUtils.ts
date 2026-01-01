import { App, TFile, parseLinktext } from "obsidian";

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

	// Handle plain angle-bracket autolink style: <path/to/note.md>
	if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
		let inner = trimmed.slice(1, -1).trim();
		const hasMdExt = /\.md$/i.test(inner);
		try {
			inner = decodeURIComponent(inner);
		} catch (error) {
			console.debug("Failed to decode URI component:", inner, error);
		}

		const parsed = parseLinktext(inner);
		return hasMdExt ? inner : parsed.path || inner;
	}

	// Handle wikilinks: [[path]] or [[path|alias]]
	if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
		const inner = trimmed.slice(2, -2).trim();

		// Manually strip alias if present
		// parseLinktext doesn't always handle aliases correctly 
		const pipeIndex = inner.indexOf('|');
		const pathOnly = pipeIndex !== -1 ? inner.substring(0, pipeIndex) : inner;
		const parsed = parseLinktext(pathOnly);

		return parsed.path;
	}

	// Handle markdown links: [text](path)
	const markdownMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		let linkPath = markdownMatch[2].trim();

		// Strip angle brackets used to allow special characters/spaces in markdown links
		if (linkPath.startsWith("<") && linkPath.endsWith(">")) {
			linkPath = linkPath.slice(1, -1).trim();
		}

		const hasMdExt = /\.md$/i.test(linkPath);

		// URL decode the link path - crucial for paths with spaces like Car%20Maintenance.md
		try {
			linkPath = decodeURIComponent(linkPath);
		} catch (error) {
			// If decoding fails, use the original path
			console.debug("Failed to decode URI component:", linkPath, error);
		}

		// Use parseLinktext to handle subpaths/headings
		const parsed = parseLinktext(linkPath);
		return hasMdExt ? linkPath : parsed.path;
	}

	// Not a link format, return as-is
	return trimmed;
}

/**
 * Extract a human-friendly display name for project values.
 * Supports wikilinks, markdown links (including <...> paths), and plain text.
 *
 * @param projectValue - The raw project value
 * @param app - Optional Obsidian app for resolving to basename
 */
export function getProjectDisplayName(projectValue: string, app?: App): string {
	if (!projectValue) return "";

	const trimmed = projectValue.trim();

	// Handle markdown links: [text](path)
	const markdownMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		const displayText = markdownMatch[1].trim();
		const rawPath = markdownMatch[2].trim();
		if (displayText) {
			return displayText;
		}
		const linkPath = parseLinkToPath(rawPath);
		const resolved = app?.metadataCache.getFirstLinkpathDest(linkPath, "");
		if (resolved) return resolved.basename;
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
		const parsed = parseLinktext(linkContent.split("|")[0] || linkContent);
		const linkPath = parsed.path || parseLinkToPath(trimmed);
		const resolved = app?.metadataCache.getFirstLinkpathDest(linkPath, "");
		if (resolved) return resolved.basename;
		const cleanPath = linkPath.replace(/\.md$/i, "");
		const parts = cleanPath.split("/");
		return parts[parts.length - 1] || cleanPath;
	}

	// Plain text
	return trimmed;
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

	link += ']]';
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
