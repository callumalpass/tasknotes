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

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
        this.setupMetadataChangeListener();
    }

    /**
     * Get all tasks that reference this file as a project (using backlinks for efficiency)
     */
    async getTasksLinkedToProject(projectFile: TFile): Promise<TaskInfo[]> {
        try {
            const backlinks = this.plugin.app.metadataCache.getBacklinksForFile(projectFile);
            const linkedTasks: TaskInfo[] = [];

            // Check each file that links to the project
            for (const sourceFilePath of Object.keys(backlinks.data)) {
                // Verify the link comes from the projects field
                if (await this.isLinkFromProjectsField(sourceFilePath, projectFile.path)) {
                    // Get the task info for this source file
                    try {
                        const taskInfo = await this.plugin.cacheManager.getTaskInfo(sourceFilePath);
                        if (taskInfo) {
                            linkedTasks.push(taskInfo);
                        }
                    } catch (error) {
                        console.error(`Error getting task info for ${sourceFilePath}:`, error);
                        // Continue processing other links
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
     * Build project status cache using Obsidian's link tracking (much more efficient)
     */
    async buildProjectStatusCache(): Promise<void> {
        const startTime = Date.now();
        try {
            this.projectStatusCache.clear();

            const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
            const allFiles = this.plugin.app.vault.getMarkdownFiles();

            let projectsFound = 0;

            // For each file, check if it has incoming links from project fields
            for (const file of allFiles) {
                let isProject = false;

                // Check if any other files link to this one
                for (const [sourceFilePath, links] of Object.entries(resolvedLinks)) {
                    if (links[file.path] && links[file.path] > 0) {
                        // This file is linked from sourceFilePath
                        // Now check if the link is from a projects field
                        if (await this.isLinkFromProjectsField(sourceFilePath, file.path)) {
                            isProject = true;
                            projectsFound++;
                            break;
                        }
                    }
                }

                this.projectStatusCache.set(file.path, isProject);
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
     * Setup metadata change listener to invalidate cache only when project links change
     */
    private setupMetadataChangeListener(): void {
        this.metadataChangeListener = this.plugin.app.metadataCache.on('changed', async (file, data, cache) => {
            if (!this.cacheBuilt || !(file instanceof TFile)) return;


            // Check if this file's project references changed
            if (await this.hasProjectLinksChanged(file, cache)) {
                console.log(`[ProjectSubtasksService] Project links changed for: ${file.path}, triggering rebuild`);
                // Only rebuild if project relationships actually changed
                this.invalidateProjectStatusCache();
                this.rebuildCacheWithFallback().catch(error => {
                    console.error('[ProjectSubtasksService] Error during background cache rebuild:', error);
                });

                // Periodic cleanup to optimize memory usage
                this.scheduleCleanupIfNeeded();
            }
        });

        // Also listen to our internal task update events as fallback for manual frontmatter edits
        this.plugin.emitter.on('task-updated', async ({ path, originalTask, updatedTask }) => {
            if (!this.cacheBuilt) return;

            // Check if project references changed
            const projectsChanged = JSON.stringify(originalTask?.projects) !== JSON.stringify(updatedTask?.projects);

            if (projectsChanged) {
                this.invalidateProjectStatusCache();
                this.rebuildCacheWithFallback().catch(error => {
                    console.error('[ProjectSubtasksService] Error during background cache rebuild:', error);
                });
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