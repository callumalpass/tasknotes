import { TFile, EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_TASK_UPDATED } from '../types';

export class ProjectSubtasksService {
    private plugin: TaskNotesPlugin;
    private projectStatusCache = new Map<string, boolean>();
    private cacheBuilt = false;
    private cacheVersion = 0;
    private taskUpdateListener: EventRef | null = null;

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
        } catch (error) {
            console.error('Error building project status cache:', error);
            this.cacheBuilt = false;
        }
    }

    /**
     * Get project status synchronously from cache (fast)
     */
    isTaskUsedAsProjectSync(taskPath: string): boolean {
        // If cache not built, return false (fallback)
        if (!this.cacheBuilt) {
            return false;
        }

        return this.projectStatusCache.get(taskPath) || false;
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
                // Rebuild cache in background for better performance
                setTimeout(() => {
                    this.buildProjectStatusCache().catch(error => {
                        console.error('Error rebuilding project status cache:', error);
                    });
                }, 100);
            }
        });
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