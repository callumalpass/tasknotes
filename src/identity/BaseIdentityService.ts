/**
 * Base Identity Service
 *
 * Provides persistent unique identifiers for .base files and their views.
 * IDs are stored in the .base YAML and used for per-view field mapping,
 * task provenance tracking, and migration tools.
 *
 * IDs are generated LAZILY — only when a TaskNotes feature (field mapping,
 * defaults) requires stable identity. This keeps .base files clean for
 * simple use cases.
 *
 * Usage:
 *   const baseIdentity = new BaseIdentityService(plugin);
 *
 *   // Get or create a base-level ID (writes to .base file)
 *   const baseId = await baseIdentity.getOrCreateBaseId(baseFile);
 *
 *   // Get or create a view-level ID (writes to .base file)
 *   const viewId = await baseIdentity.getOrCreateViewId(baseFile, viewIndex);
 *
 *   // Read without creating
 *   const existing = baseIdentity.getBaseId(baseFile);
 *
 *   // Read per-view field mapping
 *   const mapping = await baseIdentity.getViewFieldMapping(baseFile, viewIndex);
 */

import { TFile, parseYaml, stringifyYaml } from "obsidian";
import type TaskNotesPlugin from "../main";

/** Per-view field mapping: maps internal field keys to custom property names */
export interface ViewFieldMapping {
	due?: string;
	scheduled?: string;
	completedDate?: string;
	dateCreated?: string;
	assignee?: string;
}

/** Per-view default values for new task properties */
export interface ViewDefaults {
	[key: string]: string | number | boolean | string[];
}

/** Parsed view configuration with TaskNotes extensions */
export interface ParsedViewConfig {
	type?: string;
	name?: string;
	tnViewId?: string;
	tnFieldMapping?: ViewFieldMapping;
	tnDefaults?: ViewDefaults;
	notify?: boolean;
	[key: string]: any;
}

/** Parsed .base file with TaskNotes extensions */
export interface ParsedBaseFile {
	tnBaseId?: string;
	filters?: any;
	formulas?: any;
	properties?: any;
	views?: ParsedViewConfig[];
	[key: string]: any;
}

export class BaseIdentityService {
	constructor(private plugin: TaskNotesPlugin) {}

	/**
	 * Generate a new UUID (v4)
	 */
	generateId(): string {
		return crypto.randomUUID();
	}

	// ── Read operations (no file writes) ────────────────────────────

	/**
	 * Read tnBaseId from a .base file without creating one.
	 * Returns undefined if not present or file can't be read.
	 */
	async getBaseId(file: TFile): Promise<string | undefined> {
		const parsed = await this.readBaseFile(file);
		return parsed?.tnBaseId;
	}

	/**
	 * Read tnViewId for a specific view index without creating one.
	 */
	async getViewId(file: TFile, viewIndex: number): Promise<string | undefined> {
		const parsed = await this.readBaseFile(file);
		return parsed?.views?.[viewIndex]?.tnViewId;
	}

	/**
	 * Read tnFieldMapping for a specific view index.
	 * Returns undefined if no mapping is configured.
	 */
	async getViewFieldMapping(file: TFile, viewIndex: number): Promise<ViewFieldMapping | undefined> {
		const parsed = await this.readBaseFile(file);
		return parsed?.views?.[viewIndex]?.tnFieldMapping;
	}

	/**
	 * Read tnDefaults for a specific view index.
	 * Returns undefined if no defaults are configured.
	 */
	async getViewDefaults(file: TFile, viewIndex: number): Promise<ViewDefaults | undefined> {
		const parsed = await this.readBaseFile(file);
		return parsed?.views?.[viewIndex]?.tnDefaults;
	}

	/**
	 * Get the full parsed view configuration for a view index.
	 */
	async getViewConfig(file: TFile, viewIndex: number): Promise<ParsedViewConfig | undefined> {
		const parsed = await this.readBaseFile(file);
		return parsed?.views?.[viewIndex];
	}

	/**
	 * Get all view configs from a .base file.
	 */
	async getAllViewConfigs(file: TFile): Promise<ParsedViewConfig[]> {
		const parsed = await this.readBaseFile(file);
		return parsed?.views || [];
	}

	// ── Write operations (lazy ID generation) ───────────────────────

	/**
	 * Get or create tnBaseId for a .base file.
	 * Only writes if the ID doesn't already exist.
	 */
	async getOrCreateBaseId(file: TFile): Promise<string> {
		const parsed = await this.readBaseFile(file);
		if (!parsed) {
			throw new Error(`Failed to parse .base file: ${file.path}`);
		}

		if (parsed.tnBaseId) {
			return parsed.tnBaseId;
		}

		const id = this.generateId();
		parsed.tnBaseId = id;
		await this.writeBaseFile(file, parsed);

		this.plugin.debugLog.log(
			"BaseIdentityService",
			`Generated tnBaseId for ${file.path}: ${id}`
		);

		return id;
	}

	/**
	 * Get or create tnViewId for a specific view in a .base file.
	 * Also ensures tnBaseId exists (prerequisite).
	 */
	async getOrCreateViewId(file: TFile, viewIndex: number): Promise<string> {
		const parsed = await this.readBaseFile(file);
		if (!parsed) {
			throw new Error(`Failed to parse .base file: ${file.path}`);
		}

		if (!parsed.views?.[viewIndex]) {
			throw new Error(
				`View index ${viewIndex} not found in ${file.path} (${parsed.views?.length || 0} views)`
			);
		}

		// Ensure base ID exists
		if (!parsed.tnBaseId) {
			parsed.tnBaseId = this.generateId();
		}

		const view = parsed.views[viewIndex];
		if (view.tnViewId) {
			return view.tnViewId;
		}

		const id = this.generateId();
		view.tnViewId = id;
		await this.writeBaseFile(file, parsed);

		this.plugin.debugLog.log(
			"BaseIdentityService",
			`Generated tnViewId for ${file.path} view[${viewIndex}]: ${id}`
		);

		return id;
	}

	/**
	 * Set tnFieldMapping for a specific view.
	 * Ensures tnBaseId and tnViewId exist (prerequisites).
	 */
	async setViewFieldMapping(
		file: TFile,
		viewIndex: number,
		mapping: ViewFieldMapping
	): Promise<void> {
		const parsed = await this.readBaseFile(file);
		if (!parsed) {
			throw new Error(`Failed to parse .base file: ${file.path}`);
		}

		if (!parsed.views?.[viewIndex]) {
			throw new Error(
				`View index ${viewIndex} not found in ${file.path}`
			);
		}

		// Ensure IDs exist
		if (!parsed.tnBaseId) {
			parsed.tnBaseId = this.generateId();
		}
		if (!parsed.views[viewIndex].tnViewId) {
			parsed.views[viewIndex].tnViewId = this.generateId();
		}

		// Set or remove mapping (remove if empty)
		const hasMapping = Object.values(mapping).some(v => v?.trim());
		if (hasMapping) {
			parsed.views[viewIndex].tnFieldMapping = mapping;
		} else {
			delete parsed.views[viewIndex].tnFieldMapping;
		}

		await this.writeBaseFile(file, parsed);

		this.plugin.debugLog.log(
			"BaseIdentityService",
			`Updated tnFieldMapping for ${file.path} view[${viewIndex}]:`,
			mapping
		);
	}

	/**
	 * Set tnDefaults for a specific view.
	 * Ensures tnBaseId and tnViewId exist (prerequisites).
	 */
	async setViewDefaults(
		file: TFile,
		viewIndex: number,
		defaults: ViewDefaults
	): Promise<void> {
		const parsed = await this.readBaseFile(file);
		if (!parsed) {
			throw new Error(`Failed to parse .base file: ${file.path}`);
		}

		if (!parsed.views?.[viewIndex]) {
			throw new Error(
				`View index ${viewIndex} not found in ${file.path}`
			);
		}

		// Ensure IDs exist
		if (!parsed.tnBaseId) {
			parsed.tnBaseId = this.generateId();
		}
		if (!parsed.views[viewIndex].tnViewId) {
			parsed.views[viewIndex].tnViewId = this.generateId();
		}

		// Set or remove defaults (remove if empty)
		const hasDefaults = Object.keys(defaults).length > 0;
		if (hasDefaults) {
			parsed.views[viewIndex].tnDefaults = defaults;
		} else {
			delete parsed.views[viewIndex].tnDefaults;
		}

		await this.writeBaseFile(file, parsed);
	}

	// ── Notification config operations ──────────────────────────────

	/**
	 * Read notification config for a specific view index.
	 * Returns current notify/notifyOn/notifyThreshold values.
	 */
	async getViewNotificationConfig(
		file: TFile,
		viewIndex: number
	): Promise<{ notify: boolean; notifyOn: string; notifyThreshold: number }> {
		const parsed = await this.readBaseFile(file);
		const view = parsed?.views?.[viewIndex];
		return {
			notify: view?.notify === true,
			notifyOn: view?.notifyOn || "any",
			notifyThreshold: view?.notifyThreshold ?? 1,
		};
	}

	/**
	 * Set notification config for a specific view.
	 * Writes notify, notifyOn, and notifyThreshold to the view's YAML.
	 */
	async setViewNotificationConfig(
		file: TFile,
		viewIndex: number,
		config: { notify?: boolean; notifyOn?: string; notifyThreshold?: number }
	): Promise<void> {
		const parsed = await this.readBaseFile(file);
		if (!parsed) {
			throw new Error(`Failed to parse .base file: ${file.path}`);
		}

		if (!parsed.views?.[viewIndex]) {
			throw new Error(
				`View index ${viewIndex} not found in ${file.path}`
			);
		}

		const view = parsed.views[viewIndex];
		if (config.notify !== undefined) view.notify = config.notify;
		if (config.notifyOn !== undefined) view.notifyOn = config.notifyOn;
		if (config.notifyThreshold !== undefined) view.notifyThreshold = config.notifyThreshold;

		// Clean up: remove notifyOn/notifyThreshold if notify is false
		if (view.notify === false) {
			delete view.notifyOn;
			delete view.notifyThreshold;
		}

		await this.writeBaseFile(file, parsed);

		this.plugin.debugLog.log(
			"BaseIdentityService",
			`Updated notification config for ${file.path} view[${viewIndex}]:`,
			config
		);
	}

	// ── Lookup operations ───────────────────────────────────────────

	/**
	 * Find a .base file by its tnBaseId.
	 * Scans all .base files in the vault.
	 */
	async findBaseById(baseId: string): Promise<TFile | undefined> {
		if (!baseId) return undefined;

		const files = this.plugin.app.vault.getFiles().filter(f => f.extension === "base");

		for (const file of files) {
			const id = await this.getBaseId(file);
			if (id === baseId) return file;
		}

		return undefined;
	}

	/**
	 * Find a .base file and view index by tnViewId.
	 * Scans all .base files in the vault.
	 */
	async findViewById(viewId: string): Promise<{ file: TFile; viewIndex: number } | undefined> {
		if (!viewId) return undefined;

		const files = this.plugin.app.vault.getFiles().filter(f => f.extension === "base");

		for (const file of files) {
			const views = await this.getAllViewConfigs(file);
			for (let i = 0; i < views.length; i++) {
				if (views[i].tnViewId === viewId) {
					return { file, viewIndex: i };
				}
			}
		}

		return undefined;
	}

	/**
	 * Build a cache mapping tnBaseId → file path for fast lookups.
	 */
	async buildBaseIdCache(): Promise<Map<string, string>> {
		const cache = new Map<string, string>();
		const files = this.plugin.app.vault.getFiles().filter(f => f.extension === "base");

		for (const file of files) {
			const id = await this.getBaseId(file);
			if (id) {
				cache.set(id, file.path);
			}
		}

		return cache;
	}

	// ── Internal helpers ────────────────────────────────────────────

	/**
	 * Read and parse a .base file (pure YAML, no frontmatter delimiters).
	 */
	private async readBaseFile(file: TFile): Promise<ParsedBaseFile | null> {
		try {
			const content = await this.plugin.app.vault.read(file);
			const parsed = parseYaml(content);
			return parsed || null;
		} catch (error) {
			this.plugin.debugLog.error(
				"BaseIdentityService",
				`Failed to read .base file ${file.path}:`,
				error
			);
			return null;
		}
	}

	/**
	 * Write a parsed object back to a .base file as YAML.
	 *
	 * Note: stringifyYaml may reformat the file. This is acceptable because
	 * all tn-prefixed keys are namespaced and won't conflict with Obsidian's
	 * own keys. The YAML content remains semantically equivalent.
	 */
	private async writeBaseFile(file: TFile, parsed: ParsedBaseFile): Promise<void> {
		try {
			const content = stringifyYaml(parsed);
			await this.plugin.app.vault.modify(file, content);
		} catch (error) {
			this.plugin.debugLog.error(
				"BaseIdentityService",
				`Failed to write .base file ${file.path}:`,
				error
			);
			throw error;
		}
	}
}
