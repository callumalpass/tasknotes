/* eslint-disable @typescript-eslint/no-non-null-assertion -- Dependency graph traversal guards resolved task nodes before dereferencing. */
import { TFile, App, Events, EventRef } from "obsidian";
import { FieldMapper } from "../services/FieldMapper";
import { normalizeDependencyList, resolveDependencyEntry } from "./dependencyUtils";
import { TaskNotesSettings } from "../types/settings";
import { StatusManager } from "../services/StatusManager";
import { isPathInExcludedFolder, parseExcludedFolders } from "./pathExclusions";

export const EVENT_DEPENDENCY_CACHE_CHANGED = "dependency-cache-changed";

/**
 * Minimal cache for task dependencies and project references.
 * These require relationship tracking that can't be efficiently computed on-demand.
 *
 * Design Philosophy:
 * - Focused: Only tracks dependencies and project references
 * - Event-driven: Updates when files change
 * - Simple: No complex querying, just relationship lookups
 */
export class DependencyCache extends Events {
	private app: App;
	private settings: TaskNotesSettings;
	private excludedFolders: string[];
	private fieldMapper?: FieldMapper;
	private statusManager: StatusManager;

	// Dependency indexes
	private dependencySources: Map<string, Set<string>> = new Map(); // task path -> blocking task paths
	private dependencyTargets: Map<string, Set<string>> = new Map(); // task path -> tasks blocked by this task

	// Project references index
	private projectReferences: Map<string, Set<string>> = new Map(); // project path -> Set<task paths that reference it>

	// Initialization state
	private initialized = false;
	private indexesBuilt = false;

	// Event listeners for cleanup
	private eventListeners: EventRef[] = [];

	// Callback to check if a file is a task
	private isTaskFileCallback: (frontmatter: unknown) => boolean;

	constructor(
		app: App,
		settings: TaskNotesSettings,
		fieldMapper: FieldMapper | undefined,
		statusManager: StatusManager,
		isTaskFileCallback: (frontmatter: unknown) => boolean
	) {
		super();
		this.app = app;
		this.settings = settings;
		this.excludedFolders = parseExcludedFolders(settings.excludedFolders);
		this.fieldMapper = fieldMapper;
		this.statusManager = statusManager;
		this.isTaskFileCallback = isTaskFileCallback;
	}

	/**
	 * Initialize by setting up event listeners
	 */
	initialize(): void {
		if (this.initialized) {
			return;
		}

		this.setupEventListeners();
		this.initialized = true;
	}

	/**
	 * Build indexes on demand (lazy)
	 */
	async buildIndexes(): Promise<void> {
		if (this.indexesBuilt) return;

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!this.isValidFile(file.path)) {
				continue;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFileCallback(metadata.frontmatter)) {
				continue;
			}

			this.indexTaskFile(file.path, metadata.frontmatter);
		}

		this.indexesBuilt = true;
		this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Listen for metadata changes
		const changedRef = this.app.metadataCache.on("changed", (file, data, cache) => {
			if (file instanceof TFile && file.extension === "md") {
				this.handleFileChanged(file, cache);
			}
		});
		this.eventListeners.push(changedRef);

		// Listen for file deletion
		const deletedRef = this.app.metadataCache.on("deleted", (file, prevCache) => {
			if (file instanceof TFile && file.extension === "md") {
				this.handleFileDeleted(file.path);
			}
		});
		this.eventListeners.push(deletedRef);

		// Listen for file rename
		const renameRef = this.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && file.extension === "md") {
				this.handleFileRenamed(file, oldPath);
			}
		});
		this.eventListeners.push(renameRef);
	}

	/**
	 * Handle file changes
	 */
	private handleFileChanged(file: TFile, cache: unknown): void {
		if (!this.isValidFile(file.path)) {
			this.clearFileFromIndexes(file.path);
			this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
			return;
		}

		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter) {
			this.clearFileFromIndexes(file.path);
			this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
			return;
		}

		if (!this.isTaskFileCallback(metadata.frontmatter)) {
			this.clearFileFromIndexes(file.path);
			this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
			return;
		}

		// Re-index this task
		// Only clear the forward dependencies (tasks this task depends on)
		// Keep reverse dependencies intact - they'll be updated when other tasks change
		this.clearForwardDependencies(file.path);
		this.indexTaskFile(file.path, metadata.frontmatter);
		this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
	}

	/**
	 * Handle file deletion
	 */
	private handleFileDeleted(path: string): void {
		this.clearFileFromIndexes(path);
		this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
	}

	/**
	 * Handle file rename
	 */
	private handleFileRenamed(file: TFile, oldPath: string): void {
		// Get metadata for new path
		const metadata = this.app.metadataCache.getFileCache(file);

		// Clear old path
		this.clearFileFromIndexes(oldPath);

		// Index new path if it's a task
		if (
			this.isValidFile(file.path) &&
			metadata?.frontmatter &&
			this.isTaskFileCallback(metadata.frontmatter)
		) {
			this.indexTaskFile(file.path, metadata.frontmatter);
		}
		this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
	}

	/**
	 * Resolve a project reference string to a file path
	 */
	private resolveProjectReference(sourcePath: string, projectRef: string): string | null {
		if (!projectRef || typeof projectRef !== 'string') {
			return null;
		}

		const trimmed = projectRef.trim();
		if (!trimmed) {
			return null;
		}

		// Use resolveDependencyEntry to handle wikilinks, markdown links, and plain text
		const resolved = resolveDependencyEntry(this.app, sourcePath, trimmed);
		return resolved?.path || null;
	}

	/**
	 * Index a task file's dependencies and project references
	 */
	private indexTaskFile(path: string, frontmatter: Record<string, unknown>): void {
		if (!this.isValidFile(path)) {
			return;
		}

		const dependenciesField = this.fieldMapper?.toUserField("blockedBy") || "blockedBy";
		const projectField = this.fieldMapper?.toUserField("projects") || "project";

		// Index dependencies
		const dependencies = frontmatter[dependenciesField];
		if (dependencies) {
			const normalized = normalizeDependencyList(dependencies);
			if (normalized) {
				const blockingTasks = new Set<string>();

				for (const dep of normalized) {
					const resolved = resolveDependencyEntry(this.app, path, dep);
					if (resolved?.path && this.isValidFile(resolved.path)) {
						blockingTasks.add(resolved.path);

						// Add to targets (reverse mapping)
						if (!this.dependencyTargets.has(resolved.path)) {
							this.dependencyTargets.set(resolved.path, new Set());
						}
						this.dependencyTargets.get(resolved.path)!.add(path);
					}
				}

				if (blockingTasks.size > 0) {
					this.dependencySources.set(path, blockingTasks);
				}
			}
		}

		// Index project references
		const project = frontmatter[projectField];
		if (project) {
			const projects = Array.isArray(project) ? project : [project];

			for (const proj of projects) {
				if (typeof proj === 'string') {
					// Resolve the project reference to a full file path
					const resolvedPath = this.resolveProjectReference(path, proj);
					if (resolvedPath && this.isValidFile(resolvedPath)) {
						if (!this.projectReferences.has(resolvedPath)) {
							this.projectReferences.set(resolvedPath, new Set());
						}
						this.projectReferences.get(resolvedPath)!.add(path);
					}
				}
			}
		}
	}

	/**
	 * Clear only forward dependencies (tasks this task depends on)
	 * Used when a task is modified - we rebuild forward deps from frontmatter
	 * but keep reverse deps intact (they're stored in other tasks' frontmatter)
	 */
	private clearForwardDependencies(path: string): void {
		// Clear from dependency sources (tasks this task depends on)
		const blockingTasks = this.dependencySources.get(path);
		if (blockingTasks) {
			// Remove from targets (reverse mapping)
			for (const blockingTask of blockingTasks) {
				const targets = this.dependencyTargets.get(blockingTask);
				if (targets) {
					targets.delete(path);
					if (targets.size === 0) {
						this.dependencyTargets.delete(blockingTask);
					}
				}
			}
			this.dependencySources.delete(path);
		}

		// Also clear project references since those are stored in this task's frontmatter
		for (const [project, taskSet] of this.projectReferences.entries()) {
			taskSet.delete(path);
			if (taskSet.size === 0) {
				this.projectReferences.delete(project);
			}
		}
	}

	/**
	 * Clear a file from all indexes (both forward and reverse dependencies)
	 * Used when a file is deleted or becomes a non-task
	 */
	private clearFileFromIndexes(path: string): void {
		// Clear from dependency sources
		const blockingTasks = this.dependencySources.get(path);
		if (blockingTasks) {
			// Remove from targets
			for (const blockingTask of blockingTasks) {
				const targets = this.dependencyTargets.get(blockingTask);
				if (targets) {
					targets.delete(path);
					if (targets.size === 0) {
						this.dependencyTargets.delete(blockingTask);
					}
				}
			}
			this.dependencySources.delete(path);
		}

		// Clear from dependency targets
		const blockedTasks = this.dependencyTargets.get(path);
		if (blockedTasks) {
			// Remove from sources
			for (const blockedTask of blockedTasks) {
				const sources = this.dependencySources.get(blockedTask);
				if (sources) {
					sources.delete(path);
					if (sources.size === 0) {
						this.dependencySources.delete(blockedTask);
					}
				}
			}
			this.dependencyTargets.delete(path);
		}

		// Clear from project references
		for (const [project, taskSet] of this.projectReferences.entries()) {
			taskSet.delete(path);
			if (taskSet.size === 0) {
				this.projectReferences.delete(project);
			}
		}
	}

	/**
	 * Get blocking task paths (tasks this task depends on)
	 */
	getBlockingTaskPaths(taskPath: string): string[] {
		if (!this.indexesBuilt) {
			console.warn("DependencyCache: getBlockingTaskPaths called before indexes built, building now...");
			// Build synchronously by reading current state
			this.buildIndexesSync();
		}
		const blocking = this.dependencySources.get(taskPath);
		return blocking ? Array.from(blocking) : [];
	}

	/**
	 * Get blocked task paths (tasks that depend on this task)
	 */
	getBlockedTaskPaths(taskPath: string): string[] {
		if (!this.indexesBuilt) {
			console.warn("DependencyCache: getBlockedTaskPaths called before indexes built, building now...");
			this.buildIndexesSync();
		}

		if (this.isCompletedTask(taskPath)) {
			return [];
		}

		const blocked = this.dependencyTargets.get(taskPath);
		return blocked ? Array.from(blocked) : [];
	}

	/**
	 * Check if a task is blocked by dependencies (status-aware)
	 * Only returns true if the task has blocking dependencies that are NOT completed
	 */
	isTaskBlocked(taskPath: string): boolean {
		const blockingPaths = this.getBlockingTaskPaths(taskPath);
		if (blockingPaths.length === 0) {
			return false;
		}

		const statusField = this.fieldMapper?.toUserField("status") || "status";

		// Check if any blocking task is incomplete
		for (const blockingPath of blockingPaths) {
			const file = this.app.vault.getAbstractFileByPath(blockingPath);
			if (!(file instanceof TFile)) {
				// If we can't find the blocking task file, consider it as blocking
				// (conservative approach - better to show blocked than hide it)
				continue;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter) {
				// No metadata means we can't determine status, assume blocking
				continue;
			}

			const status = metadata.frontmatter[statusField];
			if (!status || !this.statusManager.isCompletedStatus(status)) {
				// Found at least one incomplete blocking task
				return true;
			}
		}

		// All blocking tasks are completed
		return false;
	}

	private isCompletedTask(taskPath: string): boolean {
		const file = this.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			return false;
		}

		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter) {
			return false;
		}

		const statusField = this.fieldMapper?.toUserField("status") || "status";
		const status = metadata.frontmatter[statusField];
		return Boolean(status && this.statusManager.isCompletedStatus(status));
	}

	/**
	 * Get tasks referencing a project
	 */
	getTasksReferencingProject(projectPath: string): string[] {
		if (!this.indexesBuilt) {
			console.warn("DependencyCache: getTasksReferencingProject called before indexes built, building now...");
			this.buildIndexesSync();
		}
		const tasks = this.projectReferences.get(projectPath);
		return tasks ? Array.from(tasks) : [];
	}

	/**
	 * Check if a file is used as a project
	 */
	isFileUsedAsProject(filePath: string): boolean {
		if (!this.indexesBuilt) {
			console.warn("DependencyCache: isFileUsedAsProject called before indexes built, building now...");
			this.buildIndexesSync();
		}
		return this.projectReferences.has(filePath);
	}

	/**
	 * Build indexes synchronously (for lazy initialization)
	 */
	private buildIndexesSync(): void {
		if (this.indexesBuilt) return;

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!this.isValidFile(file.path)) {
				continue;
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			if (!metadata?.frontmatter || !this.isTaskFileCallback(metadata.frontmatter)) {
				continue;
			}

			this.indexTaskFile(file.path, metadata.frontmatter);
		}

		this.indexesBuilt = true;
		this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
	}

	updateConfig(settings: TaskNotesSettings): void {
		this.settings = settings;
		this.excludedFolders = parseExcludedFolders(settings.excludedFolders);
		this.clearIndexes();
		this.indexesBuilt = false;
	}

	private isValidFile(path: string): boolean {
		return !isPathInExcludedFolder(path, this.excludedFolders);
	}

	private clearIndexes(): void {
		this.dependencySources.clear();
		this.dependencyTargets.clear();
		this.projectReferences.clear();
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		// Unregister all event listeners
		this.eventListeners.forEach((ref) => {
			this.app.metadataCache.offref(ref);
		});
		this.eventListeners = [];

		// Clear indexes
		this.clearIndexes();

		this.initialized = false;
		this.indexesBuilt = false;
	}
}
