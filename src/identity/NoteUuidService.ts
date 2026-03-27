/**
 * Note UUID Service
 *
 * Provides persistent unique identifiers for notes that survive renames and moves.
 * UUIDs are stored in frontmatter and used for state tracking (snooze, view-entry,
 * duplicate detection, etc.).
 *
 * Usage:
 *   const uuidService = new NoteUuidService(plugin);
 *
 *   // Check if feature is enabled
 *   if (uuidService.isEnabled()) {
 *     // Get UUID for a file (or create if auto-generate enabled)
 *     const uuid = await uuidService.getOrCreateUuid(file);
 *
 *     // Get UUID without creating
 *     const existing = uuidService.getUuid(file);
 *
 *     // Generate UUID for new file creation
 *     const newUuid = uuidService.generateUuid();
 *   }
 */

import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";

export class NoteUuidService {
	constructor(private plugin: TaskNotesPlugin) {}

	/**
	 * Get the configured UUID property name
	 */
	getPropertyName(): string {
		return this.plugin.settings.noteUuidPropertyName || "tnId";
	}

	/**
	 * Check if UUID feature is enabled (property name is set)
	 */
	isEnabled(): boolean {
		return !!this.plugin.settings.noteUuidPropertyName?.trim();
	}

	/**
	 * Check if auto-generate is enabled
	 */
	shouldAutoGenerate(): boolean {
		return this.isEnabled() && this.plugin.settings.noteUuidAutoGenerate !== false;
	}

	/**
	 * Get UUID from file's frontmatter (without creating)
	 */
	getUuid(file: TFile): string | undefined {
		if (!this.isEnabled()) return undefined;

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const propName = this.getPropertyName();
		return cache?.frontmatter?.[propName];
	}

	/**
	 * Get or create UUID for a file (lazy initialization)
	 * Returns undefined if feature is disabled or auto-generate is off
	 */
	async getOrCreateUuid(file: TFile): Promise<string | undefined> {
		if (!this.isEnabled()) return undefined;

		const existing = this.getUuid(file);
		if (existing) return existing;

		// Only create if auto-generate is enabled
		if (!this.shouldAutoGenerate()) return undefined;

		const propName = this.getPropertyName();
		const uuid = this.generateUuid();

		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			if (!fm[propName]) {
				fm[propName] = uuid;
			}
		});

		return uuid;
	}

	/**
	 * Generate a new UUID (v4) for use in new note creation
	 */
	generateUuid(): string {
		return crypto.randomUUID();
	}

	/**
	 * Build a cache mapping UUIDs to file paths
	 * Useful for reverse lookups (finding file by UUID)
	 */
	buildUuidCache(): Map<string, string> {
		const cache = new Map<string, string>();
		if (!this.isEnabled()) return cache;

		const propName = this.getPropertyName();
		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			const fileCache = this.plugin.app.metadataCache.getFileCache(file);
			const uuid = fileCache?.frontmatter?.[propName];
			if (uuid && typeof uuid === "string") {
				cache.set(uuid, file.path);
			}
		}

		return cache;
	}

	/**
	 * Find a file by its UUID
	 * Returns undefined if not found or feature is disabled
	 */
	findFileByUuid(uuid: string): TFile | undefined {
		if (!this.isEnabled() || !uuid) return undefined;

		const propName = this.getPropertyName();
		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			const fileCache = this.plugin.app.metadataCache.getFileCache(file);
			if (fileCache?.frontmatter?.[propName] === uuid) {
				return file;
			}
		}

		return undefined;
	}
}
