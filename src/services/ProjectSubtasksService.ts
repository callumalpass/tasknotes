import { TFile, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_TASK_UPDATED } from '../types';

export class ProjectSubtasksService {
    private plugin: TaskNotesPlugin;
    private projectStatusCache = new Map<string, boolean>();
    private cacheBuilt = false;
    private cacheVersion = 0;
    private taskUpdateListener: EventRef | null = null;
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

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
        this.setupTaskUpdateListener();
    }

    /**
     * Get all tasks that reference this file as a project
     */
    async getTasksLinkedToProject(projectFile: TFile): Promise<TaskInfo[]> {
        try {
            const allTasks = await this.plugin.cacheManager.getAllTasks();
            const projectFileName = projectFile.basename;
            const projectPath = projectFile.path;
            
            return allTasks.filter(task => {
                if (!task.projects || task.projects.length === 0) return false;
                
                return task.projects.some(project => {
                    if (!project || typeof project !== 'string' || project.trim() === '') return false;
                    
                    // Check for wikilink format [[Note Name]]
                    if (project.startsWith('[[') && project.endsWith(']]')) {
                        const linkedNoteName = project.slice(2, -2).trim();
                        if (!linkedNoteName) return false;
                        
                        // Try to resolve the link using Obsidian's metadata cache
                        const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
                        if (resolvedFile && resolvedFile.path === projectFile.path) {
                            return true;
                        }
                        
                        // Fallback to string matching
                        return linkedNoteName === projectFileName || linkedNoteName === projectPath;
                    }
                    
                    // Check for plain text match
                    const trimmedProject = String(project).trim();
                    return trimmedProject === projectFileName || trimmedProject === projectPath;
                });
            });
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
            const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
            if (!(file instanceof TFile)) {
                return false;
            }

            const linkedTasks = await this.getTasksLinkedToProject(file);
            return linkedTasks.length > 0;
        } catch (error) {
            console.error('Error checking if task is used as project:', error);
            return false;
        }
    }

    /**
     * Build project status cache for all tasks (synchronous lookup)
     */
    async buildProjectStatusCache(): Promise<void> {
        const startTime = Date.now();
        try {
            const allTasks = await this.plugin.cacheManager.getAllTasks();
            this.projectStatusCache.clear();

            // Create a reverse index: which tasks are used as projects
            const projectReferences = new Map<string, Set<string>>();

            for (const task of allTasks) {
                if (!task.projects || task.projects.length === 0) continue;

                for (const project of task.projects) {
                    if (!project || typeof project !== 'string' || project.trim() === '') continue;

                    let projectPath: string | null = null;

                    // Check for wikilink format [[Note Name]]
                    if (project.startsWith('[[') && project.endsWith(']]')) {
                        const linkedNoteName = project.slice(2, -2).trim();
                        if (!linkedNoteName) continue;

                        // Try to resolve the link using Obsidian's metadata cache
                        const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
                        if (resolvedFile) {
                            projectPath = resolvedFile.path;
                        }
                    } else {
                        // Plain text - need to find the matching file
                        const trimmedProject = project.trim();
                        const file = this.plugin.app.vault.getAbstractFileByPath(trimmedProject);
                        if (file instanceof TFile) {
                            projectPath = file.path;
                        } else {
                            // Try to find by basename
                            const files = this.plugin.app.vault.getMarkdownFiles();
                            const matchingFile = files.find(f => f.basename === trimmedProject);
                            if (matchingFile) {
                                projectPath = matchingFile.path;
                            }
                        }
                    }

                    if (projectPath) {
                        if (!projectReferences.has(projectPath)) {
                            projectReferences.set(projectPath, new Set());
                        }
                        projectReferences.get(projectPath)!.add(task.path);
                    }
                }
            }

            // Build the cache based on the reverse index
            for (const task of allTasks) {
                const isProject = projectReferences.has(task.path) && projectReferences.get(task.path)!.size > 0;
                this.projectStatusCache.set(task.path, isProject);
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
     * Get project status synchronously from cache (fast)
     * Falls back to async lookup if cache unavailable
     */
    isTaskUsedAsProjectSync(taskPath: string): boolean {
        // If cache not built, fall back to async lookup
        if (!this.cacheBuilt) {
            this.cacheStats.misses++;
            // Trigger async fallback and rebuild cache
            this.handleCacheUnavailable(taskPath);
            return false; // Conservative default until cache is ready
        }

        this.cacheStats.hits++;
        return this.projectStatusCache.get(taskPath) || false;
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
     * Setup task update listener to invalidate cache when needed
     */
    private setupTaskUpdateListener(): void {
        this.taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async ({ path, originalTask, updatedTask }) => {
            if (!this.cacheBuilt) return;

            // Check if the update might affect project relationships
            let shouldInvalidateCache = false;

            // If the task has or had project references, invalidate cache
            if (originalTask?.projects?.length || updatedTask?.projects?.length) {
                shouldInvalidateCache = true;
            }

            // Also invalidate if the task might be referenced as a project by others
            if (this.projectStatusCache.has(path)) {
                shouldInvalidateCache = true;
            }

            if (shouldInvalidateCache) {
                // Invalidate and rebuild cache asynchronously
                this.invalidateProjectStatusCache();
                // Rebuild cache in background with proper error handling
                this.rebuildCacheWithFallback().catch(error => {
                    console.error('[ProjectSubtasksService] Error during background cache rebuild:', error);
                });

                // Periodic cleanup to optimize memory usage
                this.scheduleCleanupIfNeeded();
            }
        });
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
        if (this.taskUpdateListener) {
            this.plugin.emitter.offref(this.taskUpdateListener);
            this.taskUpdateListener = null;
        }
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