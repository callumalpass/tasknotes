import type TaskNotesPlugin from "../main";
import { parseFrontMatterAliases, type TFile } from "obsidian";
import { scoreMultiword } from "../utils/fuzzyMatch";
import { parseDisplayFieldsRow } from "../utils/projectAutosuggestDisplayFieldsParser";
import { getProjectPropertyFilter, matchesProjectProperty } from "../utils/projectFilterUtils";
import { FilterUtils } from "../utils/FilterUtils";
import { isPathInExcludedFolder, parseExcludedFolders } from "../utils/pathExclusions";
import { collectCacheTags } from "../utils/tagExtraction";

export interface FileSuggestionItem {
	insertText: string; // link text to insert inside [[...]]
	displayText: string; // "basename [title: ... | aliases: ...]"
	path: string;
	score: number;
}

/**
 * Generic file filter configuration.
 * Can be used for project filters, custom field filters, or any other filtering needs.
 * If undefined, no filtering is applied (all files are considered).
 */
export interface FileFilterConfig {
	requiredTags?: string[];
	includeFolders?: string[];
	propertyKey?: string;
	propertyValue?: string;
}

function getSuggestableFiles(plugin: TaskNotesPlugin): TFile[] {
	const vault = plugin?.app?.vault;
	if (typeof vault?.getFiles === "function") {
		return vault.getFiles();
	}
	if (typeof vault?.getMarkdownFiles === "function") {
		return vault.getMarkdownFiles();
	}
	return [];
}

function getFileInsertText(plugin: TaskNotesPlugin, file: TFile): string {
	if (file.extension === "md") {
		const linktext = plugin.app.metadataCache.fileToLinktext?.(file, "", true);
		if (typeof linktext === "string" && linktext.trim()) {
			return linktext;
		}
		return file.basename;
	}
	return file.name || file.path.split("/").pop() || file.basename;
}

function normalizeFolderPath(folder: string): string {
	return folder.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function resolveRelativeFolderPath(folder: string, activeFolder = ""): string {
	const segments = normalizeFolderPath(activeFolder).split("/").filter(Boolean);
	for (const part of folder.replace(/\\/g, "/").split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") {
			segments.pop();
		} else {
			segments.push(part);
		}
	}
	return segments.join("/");
}

function resolveIncludeFolder(folder: string, activeFolder?: string): string {
	const normalized = normalizeFolderPath(folder);
	if (
		normalized === "." ||
		normalized === ".." ||
		normalized.startsWith("./") ||
		normalized.startsWith("../")
	) {
		return resolveRelativeFolderPath(normalized, activeFolder);
	}
	return normalized;
}

export function getActiveFolderPath(plugin: TaskNotesPlugin): string | undefined {
	const activeFile = plugin?.app?.workspace?.getActiveFile?.();
	if (activeFile?.parent?.path !== undefined) {
		return activeFile.parent.path;
	}
	if (typeof activeFile?.path === "string") {
		return activeFile.path.split("/").slice(0, -1).join("/");
	}
	return undefined;
}

export function resolveIncludeFolders(
	includeFolders: readonly string[],
	activeFolder?: string
): string[] {
	return includeFolders
		.filter((folder) => folder.trim().length > 0)
		.map((folder) => resolveIncludeFolder(folder, activeFolder));
}

export function isPathInIncludedFolders(
	path: string,
	includeFolders: readonly string[],
	activeFolder?: string
): boolean {
	const resolvedFolders = resolveIncludeFolders(includeFolders, activeFolder);
	return resolvedFolders.some(
		(folder) => folder === "" || path === folder || path.startsWith(`${folder}/`)
	);
}

export const FileSuggestHelper = {
	async suggest(
		plugin: TaskNotesPlugin,
		query: string,
		limit = 20,
		filterConfig?: FileFilterConfig,
		activeFolder = getActiveFolderPath(plugin)
	): Promise<FileSuggestionItem[]> {
		const run = async () => {
			const files = getSuggestableFiles(plugin);
			const items: FileSuggestionItem[] = [];
			const excludedFolders = parseExcludedFolders(plugin.settings?.excludedFolders);

			// Collect additional searchable properties from settings rows (|s flag)
			const rows: string[] = (plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);
			const extraProps = new Set<string>();
			for (const row of rows) {
				try {
					const tokens = parseDisplayFieldsRow(row);
					for (const t of tokens) {
						if (t.searchable && !t.property.startsWith("literal:")) {
							extraProps.add(t.property);
						}
					}
				} catch {
					/* ignore parse errors */
				}
			}
			const qLower = (query || "").toLowerCase();

			// Get filtering settings - only apply if filterConfig is provided
			const requiredTags = filterConfig?.requiredTags ?? [];
			const includeFolders = filterConfig?.includeFolders ?? [];
			const propertyFilter = getProjectPropertyFilter(filterConfig);

			for (const file of files) {
				if (isPathInExcludedFolder(file.path, excludedFolders)) {
					continue;
				}

				const cache = plugin.app.metadataCache.getFileCache(file);

				// Apply tag filtering if configured
				if (requiredTags.length > 0) {
					// Check if file has ANY of the required tags using hierarchical matching with proper exclusion handling
					const hasRequiredTag = FilterUtils.matchesTagConditions(
						collectCacheTags(cache),
						requiredTags
					);
					if (!hasRequiredTag) {
						continue; // Skip this file
					}
				}

				// Apply folder filtering if configured
				if (includeFolders.length > 0) {
					if (!isPathInIncludedFolders(file.path, includeFolders, activeFolder)) {
						continue; // Skip this file
					}
				}

				// Apply property filtering if configured
				if (propertyFilter.enabled) {
					const frontmatter = cache?.frontmatter;
					if (!matchesProjectProperty(frontmatter, propertyFilter)) {
						continue;
					}
				}

				// Gather fields
				const basename = file.basename;
				let title = "";
				if (cache?.frontmatter) {
					const mapped = plugin.fieldMapper.mapFromFrontmatter(
						cache.frontmatter,
						file.path,
						plugin.settings.storeTitleInFilename
					);
					title = typeof mapped.title === "string" ? mapped.title : "";
				}
				const aliases = cache?.frontmatter
					? parseFrontMatterAliases(cache.frontmatter) || []
					: [];

				// Compute score: keep best among fields to rank the file
				let bestScore = 0;
				const hasQuery = qLower.length > 0;
				const basenameScore = hasQuery ? scoreMultiword(query, basename) : 1;
				if (basenameScore > 0) {
					bestScore = Math.max(bestScore, basenameScore + 15); // basename weight
				}
				if (title) {
					const titleScore = scoreMultiword(query, title);
					if (titleScore > 0) {
						bestScore = Math.max(bestScore, titleScore + 5);
					}
				}
				if (Array.isArray(aliases)) {
					for (const a of aliases) {
						if (typeof a === "string") {
							const aliasScore = scoreMultiword(query, a);
							if (aliasScore > 0) {
								bestScore = Math.max(bestScore, aliasScore);
							}
						}
					}
				}

				// Additional searchable properties (IN ADDITION TO defaults)
				if (extraProps.size > 0) {
					const fm = cache?.frontmatter || {};
					for (const prop of extraProps) {
						let val = "";
						if (prop === "file.path") {
							val = file.path;
						} else if (prop === "file.parent") {
							val = file.parent?.path || "";
						} else if (prop === "file.basename") {
							val = basename; // already default, but harmless
						} else if (prop === "title") {
							val = title; // already default
						} else if (prop === "aliases") {
							const aList = Array.isArray(aliases)
								? aliases.filter((a) => typeof a === "string")
								: [];
							val = aList.join(" ");
						} else {
							const raw = (fm as Record<string, unknown>)[prop];
							if (raw != null) {
								if (Array.isArray(raw))
									val = raw.filter((x) => typeof x === "string").join(" ");
								else if (typeof raw === "object") val = JSON.stringify(raw);
								else if (
									typeof raw === "string" ||
									typeof raw === "number" ||
									typeof raw === "boolean"
								)
									val = String(raw);
							}
						}
						if (val) {
							const s = scoreMultiword(query, val);
							const inc = s > 0 ? s : val.toLowerCase().includes(qLower) ? 30 : 0;
							if (inc > 0) bestScore = Math.max(bestScore, inc);
						}
					}
				}

				if (bestScore > 0) {
					// Build display
					const extras: string[] = [];
					if (title && title !== basename) extras.push(`title: ${title}`);
					const aliasList = Array.isArray(aliases)
						? aliases.filter((a) => typeof a === "string")
						: [];
					if (aliasList.length) extras.push(`aliases: ${aliasList.join(", ")}`);
					const display = extras.length
						? `${basename} [${extras.join(" | ")}]`
						: basename;

					items.push({
						insertText: getFileInsertText(plugin, file),
						displayText: display,
						path: file.path,
						score: bestScore,
					});
				}
			}

			// Sort and cap
			items.sort((a, b) => b.score - a.score);
			// Deduplicate by resolved link text so ambiguous basenames remain selectable.
			const out: FileSuggestionItem[] = [];
			const seen = new Set<string>();
			for (const it of items) {
				if (seen.has(it.insertText)) continue;
				out.push(it);
				seen.add(it.insertText);
				if (out.length >= limit) break;
			}
			return out;
		};

		const debounceMs = plugin.settings?.suggestionDebounceMs ?? 0;
		if (!debounceMs) {
			return run();
		}

		return new Promise<FileSuggestionItem[]>((resolve) => {
			const anyPlugin = plugin as unknown as { __fileSuggestTimer?: number };
			if (anyPlugin.__fileSuggestTimer) {
				window.clearTimeout(anyPlugin.__fileSuggestTimer);
			}
			anyPlugin.__fileSuggestTimer = window.setTimeout(() => {
				void (async () => {
					const results = await run();
					resolve(results);
				})();
			}, debounceMs);
		});
	},
};
