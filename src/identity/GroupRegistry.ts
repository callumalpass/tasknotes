/**
 * GroupRegistry - Discovers and resolves group notes in the vault
 *
 * Groups are notes with `type: group` in frontmatter and a `members` array.
 * When a task is assigned to a group, it resolves to all member persons
 * for notification purposes.
 *
 * Features:
 * - Discovers groups in configured folder(s)
 * - Resolves nested groups recursively with cycle detection
 * - Caches group mappings for performance
 * - Distinguishes between person and group notes via `type` property
 */

import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { GroupNoteMapping } from "../types/settings";

// Re-export the type for convenience
export type { GroupNoteMapping } from "../types/settings";

/**
 * Maximum depth for nested group resolution.
 * Prevents infinite recursion even if cycle detection fails.
 */
const MAX_RESOLUTION_DEPTH = 10;

export class GroupRegistry {
	private plugin: TaskNotesPlugin;
	private groupCache: Map<string, GroupNoteMapping> = new Map();

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get the folder to search for group notes.
	 * Falls back to personNotesFolder if groupNotesFolder is empty.
	 */
	private getGroupFolder(): string {
		const settings = this.plugin.settings;
		return settings.groupNotesFolder || settings.personNotesFolder || "";
	}

	/**
	 * Get the optional tag filter for group notes.
	 */
	private getGroupTag(): string {
		return this.plugin.settings.groupNotesTag || "";
	}

	/**
	 * Discover all group notes in the vault.
	 * Looks for notes with `type: group` in frontmatter.
	 */
	async discoverGroups(): Promise<GroupNoteMapping[]> {
		const folder = this.getGroupFolder();
		if (!folder) {
			return [];
		}

		const groups: GroupNoteMapping[] = [];
		const files = this.plugin.app.vault.getMarkdownFiles();
		const tag = this.getGroupTag();

		for (const file of files) {
			// Check folder filter
			if (!file.path.startsWith(folder)) {
				continue;
			}

			// Check if it's a group note
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			// Check if it's a group note using configurable property name and value
			const typeProperty = this.plugin.settings.identityTypePropertyName || "type";
			const groupValue = this.plugin.settings.groupTypeValue || "group";
			if (!frontmatter || frontmatter[typeProperty] !== groupValue) {
				continue;
			}

			// Check optional tag filter
			if (tag && !this.hasTag(cache, tag)) {
				continue;
			}

			// Extract members
			const members = this.extractMembers(frontmatter.members);

			const mapping: GroupNoteMapping = {
				notePath: file.path,
				displayName: frontmatter.title || file.basename,
				memberPaths: members,
				lastUpdated: Date.now(),
			};

			groups.push(mapping);
			this.groupCache.set(file.path, mapping);
		}

		// Update settings with discovered groups (data-only save to avoid flushing
		// unrelated in-memory settings changes — see defaultBulkMode revert bug)
		this.plugin.settings.groupNoteMappings = groups;
		await this.plugin.saveSettingsDataOnly();

		return groups;
	}

	/**
	 * Check if a note is a group (has configured type property with group value in frontmatter).
	 */
	isGroup(notePath: string): boolean {
		const file = this.plugin.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) {
			return false;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const typeProperty = this.plugin.settings.identityTypePropertyName || "type";
		const groupValue = this.plugin.settings.groupTypeValue || "group";
		return cache?.frontmatter?.[typeProperty] === groupValue;
	}

	/**
	 * Check if a note is a person note (has configured type property with person value in frontmatter).
	 */
	isPersonNote(notePath: string): boolean {
		const file = this.plugin.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) {
			return false;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const typeProperty = this.plugin.settings.identityTypePropertyName || "type";
		const personValue = this.plugin.settings.personTypeValue || "person";
		return cache?.frontmatter?.[typeProperty] === personValue;
	}

	/**
	 * Resolve an assignee (person or group) to a list of person note paths.
	 * If the assignee is a group, recursively resolves all members.
	 * If the assignee is a person, returns a single-element array.
	 */
	resolveAssignee(assigneePath: string): string[] {
		// Normalize path (remove [[ ]] if present)
		const normalizedPath = this.normalizeWikiLink(assigneePath);

		if (this.isGroup(normalizedPath)) {
			return this.resolveGroupToPersons(normalizedPath, new Set(), 0);
		} else {
			// It's a person (or unknown type) - return as-is
			return [normalizedPath];
		}
	}

	/**
	 * Resolve a group to all its member persons (recursive with cycle detection).
	 */
	private resolveGroupToPersons(
		groupPath: string,
		visited: Set<string>,
		depth: number
	): string[] {
		// Cycle detection
		if (visited.has(groupPath)) {
			this.plugin.debugLog?.log(
				"GroupRegistry",
				`Cycle detected at ${groupPath}, skipping`
			);
			return [];
		}

		// Depth limit
		if (depth >= MAX_RESOLUTION_DEPTH) {
			this.plugin.debugLog?.log(
				"GroupRegistry",
				`Max depth reached at ${groupPath}, stopping`
			);
			return [];
		}

		visited.add(groupPath);

		// Get group members
		const groupMapping = this.groupCache.get(groupPath);
		let memberPaths: string[];

		if (groupMapping) {
			memberPaths = groupMapping.memberPaths;
		} else {
			// Not in cache, read from file
			const file = this.plugin.app.vault.getAbstractFileByPath(groupPath);
			if (!(file instanceof TFile)) {
				return [];
			}

			const cache = this.plugin.app.metadataCache.getFileCache(file);
			memberPaths = this.extractMembers(cache?.frontmatter?.members);
		}

		// Resolve each member
		const resolved: string[] = [];

		for (const memberPath of memberPaths) {
			const normalizedMember = this.normalizeWikiLink(memberPath);

			if (this.isGroup(normalizedMember)) {
				// Recursively resolve nested group
				const nestedPersons = this.resolveGroupToPersons(
					normalizedMember,
					visited,
					depth + 1
				);
				resolved.push(...nestedPersons);
			} else {
				// It's a person
				resolved.push(normalizedMember);
			}
		}

		// Deduplicate
		return [...new Set(resolved)];
	}

	/**
	 * Get direct members of a group (without recursive resolution).
	 */
	getGroupMembers(groupPath: string): string[] {
		const mapping = this.groupCache.get(groupPath);
		if (mapping) {
			return mapping.memberPaths;
		}

		// Read from file
		const file = this.plugin.app.vault.getAbstractFileByPath(groupPath);
		if (!(file instanceof TFile)) {
			return [];
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		return this.extractMembers(cache?.frontmatter?.members);
	}

	/**
	 * Get all cached group mappings.
	 */
	getAllGroups(): GroupNoteMapping[] {
		return Array.from(this.groupCache.values());
	}

	/**
	 * Clear the group cache.
	 */
	clearCache(): void {
		this.groupCache.clear();
	}

	/**
	 * Extract member paths from frontmatter members array.
	 * Handles wikilinks like [[Person Name]] or plain paths.
	 */
	private extractMembers(members: unknown): string[] {
		if (!Array.isArray(members)) {
			return [];
		}

		return members
			.filter((m): m is string => typeof m === "string")
			.map((m) => this.normalizeWikiLink(m));
	}

	/**
	 * Normalize a wikilink to a file path.
	 * [[Person Name]] -> Person Name.md (resolved)
	 * Person Name -> Person Name
	 */
	private normalizeWikiLink(link: string): string {
		// Remove [[ and ]]
		let normalized = link.replace(/^\[\[/, "").replace(/\]\]$/, "");

		// Handle display text: [[path|display]] -> path
		const pipeIndex = normalized.indexOf("|");
		if (pipeIndex !== -1) {
			normalized = normalized.substring(0, pipeIndex);
		}

		// Try to resolve to actual file path
		const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
			normalized,
			""
		);
		if (file) {
			return file.path;
		}

		return normalized;
	}

	/**
	 * Check if a file cache has a specific tag.
	 */
	private hasTag(cache: ReturnType<typeof this.plugin.app.metadataCache.getFileCache>, tag: string): boolean {
		if (!cache) return false;

		// Check frontmatter tags
		const fmTags = cache.frontmatter?.tags;
		if (Array.isArray(fmTags) && fmTags.includes(tag)) {
			return true;
		}

		// Check inline tags
		const inlineTags = cache.tags?.map((t) => t.tag.replace(/^#/, ""));
		if (inlineTags?.includes(tag)) {
			return true;
		}

		return false;
	}
}
