import { TFile, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_TASK_UPDATED } from '../types';

export class ProjectSubtasksService {
    private plugin: TaskNotesPlugin;
    private projectStatusCache = new Map<string, boolean>();
    private cacheBuilt = false;
    private cacheVersion = 0;
    private metadataChangeListener: EventRef | null = null;
    private cacheRebuildInProgress = false;
    private lastCacheUnavailableLog = 0;

    // Cache health monitoring
    private cacheStats = {
        hits: 0,
        misses: 0,
        rebuilds: 0,
        lastRebuildTime: 0,
        buildDuration: 0
    };

    // Memory optimization
    private lastCleanupTime = 0;

    // Batched invalidation for multiple file changes
    private batchedInvalidations = new Set<string>();
    private batchedInvalidationTimeout: number | null = null;
    private readonly BATCH_INVALIDATION_DELAY = 100; // 100ms delay to batch multiple changes

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
        this.setupMetadataChangeListener();
    }

    /**
     * Get all tasks that reference this file as a project (uses optimized indexing)
     */
    async getTasksLinkedToProject(projectFile: TFile): Promise<TaskInfo[]> {
        try {
            // Use O(1) lookup from MinimalNativeCache first
            const taskPaths = this.plugin.cacheManager.getTasksReferencingProject(projectFile.path);

            if (taskPaths.length > 0) {
                // Convert paths to TaskInfo objects
                const linkedTasks: TaskInfo[] = [];
                for (const taskPath of taskPaths) {
                    const taskInfo = await this.plugin.cacheManager.getTaskInfo(taskPath);
                    if (taskInfo) {
                        linkedTasks.push(taskInfo);
                    }
                }
                return linkedTasks;
            }

            // Fallback: manually scan all tasks for edge cases (basename matches, etc.)
            const allTasks = await this.plugin.cacheManager.getAllTasks();

            const linkedTasks: TaskInfo[] = [];
            const projectBasename = projectFile.basename;
            const projectPath = projectFile.path;

            for (const task of allTasks) {
                if (!task.projects || task.projects.length === 0) continue;

                for (const projectRef of task.projects) {
                    if (!projectRef || typeof projectRef !== 'string') continue;

                    let matches = false;

                    // Check wikilink format [[Note Name]]
                    if (projectRef.startsWith('[[') && projectRef.endsWith(']]')) {
                        const linkedNoteName = projectRef.slice(2, -2).trim();
                        // Try to resolve the link
                        const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
                        if (resolvedFile && resolvedFile.path === projectFile.path) {
                            matches = true;
                        }
                        // Also check direct basename match
                        if (linkedNoteName === projectBasename) {
                            matches = true;
                        }
                    } else {
                        // Plain text reference
                        const trimmedRef = projectRef.trim();
                        if (trimmedRef === projectBasename || trimmedRef === projectPath) {
                            matches = true;
                        }
                    }

                    if (matches) {
                        linkedTasks.push(task);
                        break; // Don't add the same task multiple times
                    }
                }
            }

            return linkedTasks;
        } catch (error) {
            console.error('Error getting tasks linked to project:', error);
            return [];
        }
    }

    /**
     * Check if a task is used as a project (i.e., referenced by other tasks)
     */
    async isTaskUsedAsProject(taskPath: string): Promise<boolean> {
        try {
            // Use O(1) lookup from MinimalNativeCache
            return this.plugin.cacheManager.isFileUsedAsProject(taskPath);
        } catch (error) {
            console.error('Error checking if task is used as project:', error);
            return false;
        }
    }

    /**
     * Build project status cache using task scanning (reliable for frontmatter links)
     */
    async buildProjectStatusCache(): Promise<void> {
        const startTime = Date.now();
        try {
            this.projectStatusCache.clear();

            // Get all tasks and files
            const allTasks = await this.plugin.cacheManager.getAllTasks();
            const allFiles = this.plugin.app.vault.getMarkdownFiles();

            // Initialize all files as non-projects
            const projectPaths = new Set<string>();

            // Scan tasks to find which files are referenced as projects
            for (const task of allTasks) {
                if (!task.projects || task.projects.length === 0) continue;

                for (const projectRef of task.projects) {
                    if (!projectRef || typeof projectRef !== 'string') continue;

                    let projectPath: string | null = null;

                    // Check wikilink format [[Note Name]]
                    if (projectRef.startsWith('[[') && projectRef.endsWith(']]')) {
                        const linkedNoteName = projectRef.slice(2, -2).trim();
                        // Try to resolve the link
                        const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
                        if (resolvedFile) {
                            projectPath = resolvedFile.path;
                        }
                    } else {
                        // Plain text reference - find matching file
                        const trimmedRef = projectRef.trim();
                        const file = this.plugin.app.vault.getAbstractFileByPath(trimmedRef);
                        if (file instanceof TFile) {
                            projectPath = file.path;
                        } else {
                            // Try to find by basename
                            const matchingFile = allFiles.find(f => f.basename === trimmedRef);
                            if (matchingFile) {
                                projectPath = matchingFile.path;
                            }
                        }
                    }

                    if (projectPath) {
                        projectPaths.add(projectPath);
                    }
                }
            }

            // Set cache for all files
            for (const file of allFiles) {
                this.projectStatusCache.set(file.path, projectPaths.has(file.path));
            }

            this.cacheBuilt = true;
            this.cacheVersion = Date.now();
            this.cacheStats.rebuilds++;
            this.cacheStats.lastRebuildTime = Date.now();
            this.cacheStats.buildDuration = Date.now() - startTime;

        } catch (error) {
            console.error('Error building project status cache:', error);
            this.cacheBuilt = false;
            this.cacheStats.buildDuration = Date.now() - startTime;
        }
    }

    /**
     * Incremental update for when a single task's projects change
     * Much faster than full cache rebuild
     */
    private async updateProjectStatusForTask(taskPath: string, oldProjects: string[] | null, newProjects: string[] | null): Promise<void> {
        if (!this.cacheBuilt) {
            // If cache not built, fall back to full build
            await this.rebuildCacheWithFallback();
            return;
        }

        const startTime = Date.now();
        const allFiles = this.plugin.app.vault.getMarkdownFiles();

        try {
            // Get affected project paths
            const oldProjectPaths = new Set<string>();
            const newProjectPaths = new Set<string>();

            // Process old projects
            if (oldProjects) {
                for (const projectRef of oldProjects) {
                    const resolvedPath = await this.resolveProjectReference(projectRef, allFiles);
                    if (resolvedPath) oldProjectPaths.add(resolvedPath);
                }
            }

            // Process new projects
            if (newProjects) {
                for (const projectRef of newProjects) {
                    const resolvedPath = await this.resolveProjectReference(projectRef, allFiles);
                    if (resolvedPath) newProjectPaths.add(resolvedPath);
                }
            }

            // Find paths that need status updates
            const pathsToRemove = new Set([...oldProjectPaths].filter(path => !newProjectPaths.has(path)));
            const pathsToAdd = new Set([...newProjectPaths].filter(path => !oldProjectPaths.has(path)));

            // Update cache incrementally
            for (const path of pathsToRemove) {
                // Check if any other task still references this project
                if (!(await this.isProjectReferencedByOtherTasks(path, taskPath))) {
                    this.projectStatusCache.set(path, false);
                }
            }

            for (const path of pathsToAdd) {
                this.projectStatusCache.set(path, true);
            }

            const duration = Date.now() - startTime;
            console.log(`[ProjectSubtasksService] Incremental update completed in ${duration}ms for ${pathsToRemove.size + pathsToAdd.size} paths`);

        } catch (error) {
            console.error('Error during incremental project cache update:', error);
            // Fall back to full rebuild on error
            await this.rebuildCacheWithFallback();
        }
    }

    /**
     * Resolve a project reference to its file path
     */
    private async resolveProjectReference(projectRef: string, allFiles: TFile[]): Promise<string | null> {
        if (!projectRef || typeof projectRef !== 'string') return null;

        let projectPath: string | null = null;

        // Check wikilink format [[Note Name]]
        if (projectRef.startsWith('[[') && projectRef.endsWith(']]')) {
            const linkedNoteName = projectRef.slice(2, -2).trim();
            const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
            if (resolvedFile) {
                projectPath = resolvedFile.path;
            }
        } else {
            // Plain text reference - find matching file
            const trimmedRef = projectRef.trim();
            const file = this.plugin.app.vault.getAbstractFileByPath(trimmedRef);
            if (file instanceof TFile) {
                projectPath = file.path;
            } else {
                // Try to find by basename
                const matchingFile = allFiles.find(f => f.basename === trimmedRef);
                if (matchingFile) {
                    projectPath = matchingFile.path;
                }
            }
        }

        return projectPath;
    }

    /**
     * Check if a project is still referenced by other tasks (excluding specified task)
     */
    private async isProjectReferencedByOtherTasks(projectPath: string, excludeTaskPath: string): Promise<boolean> {
        // Use streaming to find match early and avoid loading all tasks
        let isReferenced = false;

        await this.plugin.cacheManager.streamTasks(async (task) => {
            if (task.path === excludeTaskPath) return true; // Skip the task we're updating
            if (!task.projects || task.projects.length === 0) return true;

            for (const projectRef of task.projects) {
                const resolvedPath = await this.resolveProjectReference(projectRef, this.plugin.app.vault.getMarkdownFiles());
                if (resolvedPath === projectPath) {
                    isReferenced = true;
                    return false; // Stop streaming - we found a match
                }
            }

            return true; // Continue streaming
        });

        return isReferenced;
    }

    /**
     * Check if a link from source to target comes from the projects field
     */
    private async isLinkFromProjectsField(sourceFilePath: string, targetFilePath: string): Promise<boolean> {
        try {
            const sourceFile = this.plugin.app.vault.getAbstractFileByPath(sourceFilePath);
            if (!(sourceFile instanceof TFile)) return false;

            const metadata = this.plugin.app.metadataCache.getFileCache(sourceFile);
            if (!metadata?.frontmatter?.projects) return false;

            const projects = metadata.frontmatter.projects;
            if (!Array.isArray(projects)) return false;

            // Check if any project reference resolves to our target
            for (const project of projects) {
                if (!project || typeof project !== 'string') continue;

                // Only check wikilink format [[Note Name]] since plain text doesn't create links
                if (project.startsWith('[[') && project.endsWith(']]')) {
                    const linkedNoteName = project.slice(2, -2).trim();
                    const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, sourceFilePath);
                    if (resolvedFile && resolvedFile.path === targetFilePath) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking if link is from projects field:', error);
            return false;
        }
    }

    /**
     * Get project status synchronously from cache (fast)
     * Uses MinimalNativeCache for O(1) lookups when available
     */
    isTaskUsedAsProjectSync(taskPath: string): boolean {
        try {
            // Try using MinimalNativeCache O(1) lookup first
            return this.plugin.cacheManager.isFileUsedAsProject(taskPath);
        } catch (error) {
            // Fall back to legacy cache if MinimalNativeCache isn't ready
            if (!this.cacheBuilt) {
                this.cacheStats.misses++;
                // Trigger async fallback and rebuild cache
                this.handleCacheUnavailable(taskPath);
                return false; // Conservative default until cache is ready
            }

            this.cacheStats.hits++;
            return this.projectStatusCache.get(taskPath) || false;
        }
    }

    /**
     * Handle cache unavailability with graceful degradation
     */
    private handleCacheUnavailable(taskPath: string): void {
        // Trigger cache rebuild if not already in progress
        if (!this.cacheRebuildInProgress) {
            this.rebuildCacheWithFallback();
        }

        // Log for debugging but don't spam
        if (Date.now() - this.lastCacheUnavailableLog > 10000) { // 10 second throttle
            console.warn('[ProjectSubtasksService] Cache unavailable, using fallback. Rebuilding...');
            this.lastCacheUnavailableLog = Date.now();
        }
    }

    /**
     * Rebuild cache with error handling and progress tracking
     */
    private async rebuildCacheWithFallback(): Promise<void> {
        if (this.cacheRebuildInProgress) return;

        this.cacheRebuildInProgress = true;
        try {
            await this.buildProjectStatusCache();
        } catch (error) {
            console.error('[ProjectSubtasksService] Failed to rebuild cache:', error);
            // Don't set cacheBuilt = true on failure
        } finally {
            this.cacheRebuildInProgress = false;
        }
    }

    /**
     * Invalidate project status cache
     */
    invalidateProjectStatusCache(): void {
        this.cacheBuilt = false;
        this.projectStatusCache.clear();
    }

    /**
     * Add a file to batched invalidation queue
     */
    private scheduleBatchedInvalidation(filePath: string): void {
        this.batchedInvalidations.add(filePath);

        // Clear existing timeout if any
        if (this.batchedInvalidationTimeout !== null) {
            clearTimeout(this.batchedInvalidationTimeout);
        }

        // Set new timeout to process batch
        this.batchedInvalidationTimeout = window.setTimeout(() => {
            this.processBatchedInvalidations().catch(error => {
                console.error('[ProjectSubtasksService] Error processing batched invalidations:', error);
            });
        }, this.BATCH_INVALIDATION_DELAY);
    }

    /**
     * Process all batched invalidations efficiently
     */
    private async processBatchedInvalidations(): Promise<void> {
        if (this.batchedInvalidations.size === 0) return;

        const filePaths = Array.from(this.batchedInvalidations);
        this.batchedInvalidations.clear();
        this.batchedInvalidationTimeout = null;

        console.log(`[ProjectSubtasksService] Processing batched invalidations for ${filePaths.length} files`);

        try {
            // Check if any of the files have project changes that require cache updates
            let hasProjectChanges = false;

            for (const filePath of filePaths) {
                const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
                if (!(file instanceof TFile)) continue;

                const cache = this.plugin.app.metadataCache.getFileCache(file);
                if (await this.hasProjectLinksChanged(file, cache)) {
                    hasProjectChanges = true;
                    break; // Early exit - we found at least one change
                }
            }

            if (hasProjectChanges) {
                // Use incremental updates where possible, or fall back to full rebuild
                if (filePaths.length === 1) {
                    // Single file change - try incremental update
                    const filePath = filePaths[0];
                    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
                    if (file instanceof TFile) {
                        const cache = this.plugin.app.metadataCache.getFileCache(file);
                        const newProjects = cache?.frontmatter?.projects;
                        const taskInfo = await this.plugin.cacheManager.getTaskInfo(filePath);
                        const oldProjects = taskInfo?.projects;

                        await this.updateProjectStatusForTask(filePath, oldProjects || null, newProjects || null);
                    }
                } else {
                    // Multiple file changes - use full rebuild for consistency
                    this.invalidateProjectStatusCache();
                    await this.rebuildCacheWithFallback();
                }

                this.scheduleCleanupIfNeeded();
            }

        } catch (error) {
            console.error('[ProjectSubtasksService] Error during batched invalidation processing:', error);
            // Fall back to full rebuild on error
            this.invalidateProjectStatusCache();
            await this.rebuildCacheWithFallback();
        }
    }

    /**
     * Setup metadata change listener to invalidate cache only when project links change
     */
    private setupMetadataChangeListener(): void {
        this.metadataChangeListener = this.plugin.app.metadataCache.on('changed', async (file, data, cache) => {
            if (!this.cacheBuilt || !(file instanceof TFile)) return;

            // Use batched invalidation to handle multiple rapid changes efficiently
            this.scheduleBatchedInvalidation(file.path);
        });

        // Also listen to our internal task update events as fallback for manual frontmatter edits
        this.plugin.emitter.on('task-updated', async ({ path, originalTask, updatedTask }) => {
            if (!this.cacheBuilt) return;

            // Check if project references changed
            const projectsChanged = JSON.stringify(originalTask?.projects) !== JSON.stringify(updatedTask?.projects);

            if (projectsChanged) {
                console.log(`[ProjectSubtasksService] Project references changed for ${path}, using incremental update`);

                try {
                    // Use incremental update instead of full rebuild
                    await this.updateProjectStatusForTask(path, originalTask?.projects || null, updatedTask?.projects || null);
                } catch (error) {
                    console.error('[ProjectSubtasksService] Error during incremental update, falling back to full rebuild:', error);
                    this.invalidateProjectStatusCache();
                    this.rebuildCacheWithFallback().catch(rebuildError => {
                        console.error('[ProjectSubtasksService] Error during fallback rebuild:', rebuildError);
                    });
                }

                this.scheduleCleanupIfNeeded();
            }
        });
    }

    /**
     * Check if a file's project links have changed
     */
    private async hasProjectLinksChanged(file: TFile, newCache: any): Promise<boolean> {
        try {
            const newProjects = newCache?.frontmatter?.projects;

            // Get the task info to compare old projects
            const taskInfo = await this.plugin.cacheManager.getTaskInfo(file.path);
            const oldProjects = taskInfo?.projects;

            // Normalize to handle empty arrays vs undefined/null
            const normalizedOld = oldProjects && oldProjects.length > 0 ? oldProjects : null;
            const normalizedNew = newProjects && newProjects.length > 0 ? newProjects : null;

            // Compare normalized values
            if (!normalizedOld && !normalizedNew) {
                return false;
            }
            if (!normalizedOld || !normalizedNew) {
                return true;
            }
            // At this point, both have projects, so compare the actual arrays
            if (!Array.isArray(normalizedOld) || !Array.isArray(normalizedNew)) {
                return true;
            }
            if (normalizedOld.length !== normalizedNew.length) {
                return true;
            }

            // Check if project references are the same
            for (let i = 0; i < normalizedOld.length; i++) {
                if (normalizedOld[i] !== normalizedNew[i]) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking if project links changed:', error);
            return true; // Conservative approach - assume changed if we can't determine
        }
    }

    /**
     * Schedule cleanup if enough time has passed
     */
    private scheduleCleanupIfNeeded(): void {
        const timeSinceLastCleanup = Date.now() - this.lastCleanupTime;

        // Cleanup every 6 hours
        const shouldCleanup = timeSinceLastCleanup > 6 * 60 * 60 * 1000;

        if (shouldCleanup) {
            this.lastCleanupTime = Date.now();

            // Schedule cleanup asynchronously to not block cache rebuild
            setTimeout(async () => {
                try {
                    const removedCount = await this.cleanupStaleEntries();
                    if (removedCount > 0) {
                        console.log(`[ProjectSubtasksService] Cleaned up ${removedCount} stale cache entries`);
                    }
                } catch (error) {
                    console.error('[ProjectSubtasksService] Error during scheduled cleanup:', error);
                }
            }, 1000); // Small delay to let cache rebuild complete
        }
    }

    /**
     * Get cache health statistics for monitoring
     */
    getCacheHealth(): {
        built: boolean;
        size: number;
        stats: typeof this.cacheStats;
        hitRatio: number;
        lastRebuildAge: number;
        status: 'healthy' | 'degraded' | 'unavailable';
    } {
        const hitRatio = this.cacheStats.hits + this.cacheStats.misses > 0
            ? this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)
            : 0;

        const lastRebuildAge = Date.now() - this.cacheStats.lastRebuildTime;

        let status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
        if (!this.cacheBuilt) {
            status = 'unavailable';
        } else if (hitRatio < 0.9 || lastRebuildAge > 60 * 60 * 1000) { // Over 1 hour old
            status = 'degraded';
        }

        return {
            built: this.cacheBuilt,
            size: this.projectStatusCache.size,
            stats: { ...this.cacheStats },
            hitRatio,
            lastRebuildAge,
            status
        };
    }

    /**
     * Clean up stale cache entries for deleted tasks
     */
    async cleanupStaleEntries(): Promise<number> {
        if (!this.cacheBuilt) return 0;

        try {
            const allTaskPaths = this.plugin.cacheManager.getAllTaskPaths();
            const existingPaths = new Set(allTaskPaths);

            let removedCount = 0;
            for (const taskPath of this.projectStatusCache.keys()) {
                if (!existingPaths.has(taskPath)) {
                    this.projectStatusCache.delete(taskPath);
                    removedCount++;
                }
            }

            return removedCount;
        } catch (error) {
            console.error('[ProjectSubtasksService] Error during cache cleanup:', error);
            return 0;
        }
    }

    /**
     * Cleanup when service is destroyed
     */
    destroy(): void {
        if (this.metadataChangeListener) {
            this.plugin.app.metadataCache.offref(this.metadataChangeListener);
            this.metadataChangeListener = null;
        }

        // Clear batched invalidation timeout
        if (this.batchedInvalidationTimeout !== null) {
            clearTimeout(this.batchedInvalidationTimeout);
            this.batchedInvalidationTimeout = null;
        }
        this.batchedInvalidations.clear();

        this.invalidateProjectStatusCache();

        // Reset all stats
        this.cacheStats = {
            hits: 0,
            misses: 0,
            rebuilds: 0,
            lastRebuildTime: 0,
            buildDuration: 0
        };
    }

    /**
     * Sort tasks by priority and status
     */
    sortTasks(tasks: TaskInfo[]): TaskInfo[] {
        return tasks.sort((a, b) => {
            // First sort by completion status (incomplete first)
            const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
            const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);
            
            if (aCompleted !== bCompleted) {
                return aCompleted ? 1 : -1;
            }
            
            // Then sort by priority
            const aPriorityWeight = this.plugin.priorityManager.getPriorityWeight(a.priority);
            const bPriorityWeight = this.plugin.priorityManager.getPriorityWeight(b.priority);
            
            if (aPriorityWeight !== bPriorityWeight) {
                return bPriorityWeight - aPriorityWeight; // Higher priority first
            }
            
            // Then sort by due date (earliest first)
            if (a.due && b.due) {
                return new Date(a.due).getTime() - new Date(b.due).getTime();
            } else if (a.due) {
                return -1; // Tasks with due dates come first
            } else if (b.due) {
                return 1;
            }
            
            // Finally sort by title
            return a.title.localeCompare(b.title);
        });
    }
}