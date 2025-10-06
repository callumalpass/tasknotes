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

	// Handle wikilinks: [[path]] or [[path|alias]]
	if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
		const inner = trimmed.slice(2, -2).trim();
		const parsed = parseLinktext(inner);
		return parsed.path;
	}

	// Handle markdown links: [text](path)
	const markdownMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		let linkPath = markdownMatch[2].trim();

		// URL decode the link path - crucial for paths with spaces like Car%20Maintenance.md
		try {
			linkPath = decodeURIComponent(linkPath);
		} catch (error) {
			// If decoding fails, use the original path
			console.debug("Failed to decode URI component:", linkPath, error);
		}

		// Use parseLinktext to handle subpaths/headings
		const parsed = parseLinktext(linkPath);
		return parsed.path;
	}

	// Not a link format, return as-is
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