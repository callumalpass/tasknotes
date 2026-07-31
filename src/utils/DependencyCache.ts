/* eslint-disable @typescript-eslint/no-non-null-assertion -- Dependency graph traversal guards resolved task nodes before dereferencing. */
import { TFile, App, Events, EventRef } from "obsidian";
import { FieldMapper } from "../core/FieldMapper";
import { normalizeDependencyList, resolveDependencyEntry } from "./dependencyUtils";
import { TaskNotesSettings } from "../types/settings";
import { isPathInExcludedFolder, parseExcludedFolders } from "./pathExclusions";
import { createTaskNotesLogger } from "./tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Utils/DependencyCache" });

export const EVENT_DEPENDENCY_CACHE_CHANGED = "dependency-cache-changed";

interface DependencyStatusClassifier {
	isCompletedStatus(statusValue: string): boolean;
}

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
	private statusManager: DependencyStatusClassifier;

	// Dependency indexes
	private dependencySources: Map<string, Set<string>> = new Map(); // task path -> blocking task paths
	private dependencyTargets: Map<string, Set<string>> = new Map(); // task path -> tasks blocked by this task
	private activeDependencySources: Map<string, Set<string>> = new Map(); // task path -> incomplete blocking task paths
	private activeDependencyTargets: Map<string, Set<string>> = new Map(); // task path -> tasks actively blocked by this task

	// Project references index
	private projectReferences: Map<string, Set<string>> = new Map(); // project path -> Set<task paths that reference it>
	private projectReferenceSources: Map<string, Set<string>> = new Map(); // task path -> Set<project paths it references>
	private relationshipFingerprints: Map<string, string> = new Map(); // task path -> normalized dependency/project fields
	private completedStatusByPath: Map<string, boolean> = new Map(); // file path -> completion state for status-aware dependency lookups

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
		statusManager: DependencyStatusClassifier,
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
		const before = this.getFileRelationshipSignature(file.path);

		if (!this.isValidFile(file.path)) {
			this.clearFileFromIndexes(file.path);
			this.triggerIfFileRelationshipsChanged(file.path, before);
			return;
		}

		const frontmatter = this.getFrontmatterFromCache(cache) ?? this.getFrontmatterForFile(file);
		this.updateCompletionState(file.path, frontmatter);

		if (!frontmatter) {
			if (this.hasForwardRelationships(file.path)) {
				this.clearForwardDependencies(file.path);
			}
			this.triggerIfFileRelationshipsChanged(file.path, before);
			return;
		}

		if (!this.isTaskFileCallback(frontmatter)) {
			if (this.hasForwardRelationships(file.path)) {
				this.clearForwardDependencies(file.path);
			}
			this.triggerIfFileRelationshipsChanged(file.path, before);
			return;
		}

		const nextFingerprint = this.buildRelationshipFingerprint(frontmatter);
		if (this.relationshipFingerprints.get(file.path) === nextFingerprint) {
			this.triggerIfFileRelationshipsChanged(file.path, before);
			return;
		}

		// Re-index this task
		// Only clear the forward dependencies (tasks this task depends on)
		// Keep reverse dependencies intact - they'll be updated when other tasks change
		this.clearForwardDependencies(file.path);
		this.indexTaskFile(file.path, frontmatter);
		this.triggerIfFileRelationshipsChanged(file.path, before);
	}

	private triggerIfFileRelationshipsChanged(path: string, before: string): void {
		if (this.getFileRelationshipSignature(path) !== before) {
			this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
		}
	}

	private getFileRelationshipSignature(path: string): string {
		const blockingTasks = this.sortedSetValues(this.dependencySources.get(path));
		const blockedTasks = this.sortedSetValues(this.activeDependencyTargets.get(path));
		const referencedProjects = this.sortedSetValues(this.projectReferenceSources.get(path));
		const projectTasks = this.sortedSetValues(this.projectReferences.get(path));

		return JSON.stringify({
			blockedTasks,
			blockingTasks,
			projectTasks,
			referencedProjects,
		});
	}

	private sortedSetValues(values: Set<string> | undefined): string[] {
		return values ? Array.from(values).sort() : [];
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
		const frontmatter = this.getFrontmatterForFile(file);

		// Clear old path
		this.clearFileFromIndexes(oldPath);

		// Index new path if it's a task
		if (this.isValidFile(file.path) && frontmatter && this.isTaskFileCallback(frontmatter)) {
			this.indexTaskFile(file.path, frontmatter);
		}
		this.trigger(EVENT_DEPENDENCY_CACHE_CHANGED);
	}

	private getFrontmatterForFile(file: TFile): Record<string, unknown> | null {
		const metadata = this.app.metadataCache.getFileCache(file);
		return this.getFrontmatterFromCache(metadata);
	}

	private getFrontmatterFromCache(cache: unknown): Record<string, unknown> | null {
		if (!cache || typeof cache !== "object" || !("frontmatter" in cache)) {
			return null;
		}

		const frontmatter = (cache as { frontmatter?: unknown }).frontmatter;
		if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
			return null;
		}

		return frontmatter as Record<string, unknown>;
	}

	/**
	 * Resolve a project reference string to a file path
	 */
	private resolveProjectReference(sourcePath: string, projectRef: string): string | null {
		if (!projectRef || typeof projectRef !== "string") {
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

		this.relationshipFingerprints.set(path, this.buildRelationshipFingerprint(frontmatter));
		this.completedStatusByPath.set(path, this.isCompletedFrontmatter(frontmatter));

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
						this.addDependencyLink(path, resolved.path, blockingTasks);
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
				if (typeof proj === "string") {
					// Resolve the project reference to a full file path
					const resolvedPath = this.resolveProjectReference(path, proj);
					if (resolvedPath && this.isValidFile(resolvedPath)) {
						if (!this.projectReferences.has(resolvedPath)) {
							this.projectReferences.set(resolvedPath, new Set());
						}
						this.projectReferences.get(resolvedPath)!.add(path);

						if (!this.projectReferenceSources.has(path)) {
							this.projectReferenceSources.set(path, new Set());
						}
						this.projectReferenceSources.get(path)!.add(resolvedPath);
					}
				}
			}
		}
	}

	private addDependencyLink(
		dependentPath: string,
		blockingPath: string,
		blockingTasks: Set<string>
	): void {
		blockingTasks.add(blockingPath);

		if (!this.dependencyTargets.has(blockingPath)) {
			this.dependencyTargets.set(blockingPath, new Set());
		}
		this.dependencyTargets.get(blockingPath)!.add(dependentPath);

		if (!this.isCompletedPath(blockingPath)) {
			this.addActiveDependencyLink(dependentPath, blockingPath);
		}
	}

	private addActiveDependencyLink(dependentPath: string, blockingPath: string): void {
		if (!this.activeDependencySources.has(dependentPath)) {
			this.activeDependencySources.set(dependentPath, new Set());
		}
		this.activeDependencySources.get(dependentPath)!.add(blockingPath);

		if (!this.activeDependencyTargets.has(blockingPath)) {
			this.activeDependencyTargets.set(blockingPath, new Set());
		}
		this.activeDependencyTargets.get(blockingPath)!.add(dependentPath);
	}

	private removeActiveDependencyLink(dependentPath: string, blockingPath: string): void {
		const activeSources = this.activeDependencySources.get(dependentPath);
		if (activeSources) {
			activeSources.delete(blockingPath);
			if (activeSources.size === 0) {
				this.activeDependencySources.delete(dependentPath);
			}
		}

		const activeTargets = this.activeDependencyTargets.get(blockingPath);
		if (activeTargets) {
			activeTargets.delete(dependentPath);
			if (activeTargets.size === 0) {
				this.activeDependencyTargets.delete(blockingPath);
			}
		}
	}

	private rebuildActiveLinksForBlocker(blockingPath: string): void {
		const blockedTasks = this.dependencyTargets.get(blockingPath);
		this.activeDependencyTargets.delete(blockingPath);

		if (!blockedTasks) {
			return;
		}

		for (const dependentPath of blockedTasks) {
			const activeSources = this.activeDependencySources.get(dependentPath);
			if (activeSources) {
				activeSources.delete(blockingPath);
				if (activeSources.size === 0) {
					this.activeDependencySources.delete(dependentPath);
				}
			}
		}

		if (this.isCompletedPath(blockingPath)) {
			return;
		}

		for (const dependentPath of blockedTasks) {
			this.addActiveDependencyLink(dependentPath, blockingPath);
		}
	}

	private buildRelationshipFingerprint(frontmatter: Record<string, unknown>): string {
		const dependenciesField = this.fieldMapper?.toUserField("blockedBy") || "blockedBy";
		const projectField = this.fieldMapper?.toUserField("projects") || "project";

		const dependencies = (normalizeDependencyList(frontmatter[dependenciesField]) ?? [])
			.map((dependency) => dependency.uid)
			.filter((uid) => uid.length > 0)
			.sort();
		const projects = this.normalizeProjectFingerprintValues(frontmatter[projectField]);

		return JSON.stringify({ dependencies, projects });
	}

	private normalizeProjectFingerprintValues(value: unknown): string[] {
		const projects = Array.isArray(value) ? value : value ? [value] : [];
		const normalized = new Set<string>();

		for (const project of projects) {
			if (typeof project !== "string") {
				continue;
			}

			const trimmed = project.trim();
			if (trimmed) {
				normalized.add(trimmed);
			}
		}

		return Array.from(normalized).sort();
	}

	private hasForwardRelationships(path: string): boolean {
		return (
			this.relationshipFingerprints.has(path) ||
			this.dependencySources.has(path) ||
			this.projectReferenceSources.has(path)
		);
	}

	private updateCompletionState(path: string, frontmatter: Record<string, unknown> | null): void {
		const oldCompleted = this.completedStatusByPath.get(path) ?? false;
		const newCompleted = frontmatter ? this.isCompletedFrontmatter(frontmatter) : false;
		this.completedStatusByPath.set(path, newCompleted);

		if (oldCompleted !== newCompleted) {
			this.rebuildActiveLinksForBlocker(path);
		}
	}

	private isCompletedPath(path: string): boolean {
		const cached = this.completedStatusByPath.get(path);
		if (cached !== undefined) {
			return cached;
		}

		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			this.completedStatusByPath.set(path, false);
			return false;
		}

		const frontmatter = this.getFrontmatterForFile(file);
		const completed = frontmatter ? this.isCompletedFrontmatter(frontmatter) : false;
		this.completedStatusByPath.set(path, completed);
		return completed;
	}

	private isCompletedFrontmatter(frontmatter: Record<string, unknown>): boolean {
		const statusField = this.fieldMapper?.toUserField("status") || "status";
		const status = frontmatter[statusField];
		const statusText = this.stringifyStatusValue(status);
		return Boolean(statusText && this.statusManager.isCompletedStatus(statusText));
	}

	private stringifyStatusValue(status: unknown): string | null {
		if (
			typeof status === "string" ||
			typeof status === "number" ||
			typeof status === "boolean"
		) {
			return String(status);
		}

		return null;
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
				this.removeActiveDependencyLink(path, blockingTask);
			}
			this.dependencySources.delete(path);
		}
		this.activeDependencySources.delete(path);

		// Also clear project references since those are stored in this task's frontmatter
		const referencedProjects = this.projectReferenceSources.get(path);
		if (referencedProjects) {
			for (const project of referencedProjects) {
				const taskSet = this.projectReferences.get(project);
				if (taskSet) {
					taskSet.delete(path);
					if (taskSet.size === 0) {
						this.projectReferences.delete(project);
					}
				}
			}
			this.projectReferenceSources.delete(path);
		}
		this.relationshipFingerprints.delete(path);
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
				this.removeActiveDependencyLink(path, blockingTask);
			}
			this.dependencySources.delete(path);
		}
		this.activeDependencySources.delete(path);

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
				this.removeActiveDependencyLink(blockedTask, path);
			}
			this.dependencyTargets.delete(path);
		}
		this.activeDependencyTargets.delete(path);

		// Clear project references declared by this file
		const referencedProjects = this.projectReferenceSources.get(path);
		if (referencedProjects) {
			for (const project of referencedProjects) {
				const taskSet = this.projectReferences.get(project);
				if (taskSet) {
					taskSet.delete(path);
					if (taskSet.size === 0) {
						this.projectReferences.delete(project);
					}
				}
			}
			this.projectReferenceSources.delete(path);
		}

		// Clear this file as a project target
		const referencingTasks = this.projectReferences.get(path);
		if (referencingTasks) {
			for (const taskPath of referencingTasks) {
				const taskProjects = this.projectReferenceSources.get(taskPath);
				if (taskProjects) {
					taskProjects.delete(path);
					if (taskProjects.size === 0) {
						this.projectReferenceSources.delete(taskPath);
					}
				}
			}
			this.projectReferences.delete(path);
		}
		this.relationshipFingerprints.delete(path);
		this.completedStatusByPath.delete(path);
	}

	/**
	 * Get blocking task paths (tasks this task depends on)
	 */
	getBlockingTaskPaths(taskPath: string): string[] {
		if (!this.indexesBuilt) {
			tasknotesLogger.warn(
				"DependencyCache: getBlockingTaskPaths called before indexes built, building now...",
				{
					category: "stale-data",
					operation:
						"dependencycache-getblockingtaskpaths-called-indexes-built-building-now",
				}
			);
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
			tasknotesLogger.warn(
				"DependencyCache: getBlockedTaskPaths called before indexes built, building now...",
				{
					category: "stale-data",
					operation:
						"dependencycache-getblockedtaskpaths-called-indexes-built-building-now",
				}
			);
			this.buildIndexesSync();
		}

		const blocked = this.activeDependencyTargets.get(taskPath);
		return blocked ? Array.from(blocked) : [];
	}

	/**
	 * Check if a task is blocked by dependencies (status-aware)
	 * Only returns true if the task has blocking dependencies that are NOT completed
	 */
	isTaskBlocked(taskPath: string): boolean {
		if (!this.indexesBuilt) {
			this.buildIndexesSync();
		}
		return (this.activeDependencySources.get(taskPath)?.size ?? 0) > 0;
	}

	/**
	 * Get tasks referencing a project
	 */
	getTasksReferencingProject(projectPath: string): string[] {
		if (!this.indexesBuilt) {
			tasknotesLogger.warn(
				"DependencyCache: getTasksReferencingProject called before indexes built, building now...",
				{
					category: "stale-data",
					operation:
						"dependencycache-gettasksreferencingproject-called-indexes-built-building-now",
				}
			);
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
			tasknotesLogger.warn(
				"DependencyCache: isFileUsedAsProject called before indexes built, building now...",
				{
					category: "stale-data",
					operation:
						"dependencycache-isfileusedasproject-called-indexes-built-building-now",
				}
			);
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
		this.activeDependencySources.clear();
		this.activeDependencyTargets.clear();
		this.projectReferences.clear();
		this.projectReferenceSources.clear();
		this.relationshipFingerprints.clear();
		this.completedStatusByPath.clear();
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
