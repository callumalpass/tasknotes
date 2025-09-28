/* eslint-disable no-console */
import { TFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo } from '../types';

export class ProjectSubtasksService {
    private plugin: TaskNotesPlugin;

    // Pre-computed reverse index: taskPath -> isUsedAsProject
    private projectIndex = new Map<string, boolean>();
    private indexLastBuilt = 0;
    private readonly INDEX_TTL = 30000; // Rebuild index every 30 seconds

    // Performance stats (kept for monitoring)
    private stats = {
        indexBuilds: 0,
        indexHits: 0,
        indexMisses: 0
    };

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
    }

    /**
     * Get all files that link to a specific project using native resolvedLinks API
     * resolvedLinks format: Record<sourcePath, Record<targetPath, linkCount>>
     */
    private getFilesLinkingToProject(projectPath: string): string[] {
        const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
        const linkingSources: string[] = [];

        // Iterate through all source files and their targets
        for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
            // Check if this source file links to our project
            if (targets && targets[projectPath] > 0) {
                linkingSources.push(sourcePath);
            }
        }

        return linkingSources;
    }

    /**
     * Check for unresolved project references (broken links)
     * Useful for debugging and maintenance
     */
    private getUnresolvedProjectReferences(taskPath: string): string[] {
        const unresolvedLinks = this.plugin.app.metadataCache.unresolvedLinks;
        const taskUnresolvedLinks = unresolvedLinks[taskPath];

        if (!taskUnresolvedLinks) return [];

        // Filter for potential project references
        return Object.keys(taskUnresolvedLinks).filter(linkText => {
            // Could be a project reference if it matches common patterns
            return !linkText.includes('#') && !linkText.includes('|');
        });
    }

    /**
     * Get all tasks that reference this file as a project (uses native resolvedLinks API)
     */
    async getTasksLinkedToProject(projectFile: TFile): Promise<TaskInfo[]> {
        try {
            const linkingSources = this.getFilesLinkingToProject(projectFile.path);
            const linkedTasks: TaskInfo[] = [];

            for (const sourcePath of linkingSources) {
                // Check if this source file is a task with project references
                const taskInfo = await this.plugin.cacheManager.getTaskInfo(sourcePath);
                if (taskInfo && await this.isLinkFromProjectsField(sourcePath, projectFile.path)) {
                    linkedTasks.push(taskInfo);
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
        // Use sync method for consistency and performance
        return this.isTaskUsedAsProjectSync(taskPath);
    }

    /**
     * Legacy method kept for compatibility - now just a no-op since we use native APIs
     */
    async buildProjectStatusCache(): Promise<void> {
        // No longer needed - using native resolvedLinks API directly
        console.log('[ProjectSubtasksService] Using native APIs, cache building skipped');
    }

    // Removed - no longer needed with native API approach

    // Removed - project resolution now handled by native resolvedLinks API

    // Removed - project reference tracking now handled by native resolvedLinks API

    /**
     * Check if a link from source to target comes from the projects field
     */
    private async isLinkFromProjectsField(sourceFilePath: string, targetFilePath: string): Promise<boolean> {
        try {
            const sourceFile = this.plugin.app.vault.getAbstractFileByPath(sourceFilePath);
            if (!(sourceFile instanceof TFile)) return false;

            const metadata = this.plugin.app.metadataCache.getFileCache(sourceFile);

            // Use the user's configured field mapping for projects
            const projectsFieldName = this.plugin.fieldMapper.toUserField('projects');
            if (!metadata?.frontmatter?.[projectsFieldName]) return false;

            const projects = metadata.frontmatter[projectsFieldName];
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
     * Get project status using pre-computed reverse index (much faster than scanning all files)
     */
    isTaskUsedAsProjectSync(taskPath: string): boolean {
        this.ensureIndexBuilt();

        if (this.projectIndex.has(taskPath)) {
            this.stats.indexHits++;
            return this.projectIndex.get(taskPath)!;
        }

        this.stats.indexMisses++;
        return false; // Not in index = not a project
    }


    /**
     * Build reverse index of all project files (one scan instead of per-task scans)
     */
    private buildProjectIndex(): void {
        const startTime = Date.now();
        this.projectIndex.clear();
        this.stats.indexBuilds++;

        try {
            const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
            const projectPaths = new Set<string>();

            // Single pass through all resolved links to find project targets
            for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
                if (!targets) continue;

                // Check if source has projects frontmatter
                const metadata = this.plugin.app.metadataCache.getCache(sourcePath);

                // Use the user's configured field mapping for projects
                const projectsFieldName = this.plugin.fieldMapper.toUserField('projects');
                const projects = metadata?.frontmatter?.[projectsFieldName];

                if (Array.isArray(projects) && projects.some((p: any) =>
                    typeof p === 'string' && p.startsWith('[[') && p.endsWith(']]')
                )) {
                    // This file has project references, add all its targets as projects
                    for (const targetPath of Object.keys(targets)) {
                        if (targets[targetPath] > 0) {
                            projectPaths.add(targetPath);
                        }
                    }
                }
            }

            // Build the reverse index
            for (const projectPath of projectPaths) {
                this.projectIndex.set(projectPath, true);
            }

            this.indexLastBuilt = Date.now();
            const duration = Date.now() - startTime;
            console.log(`[ProjectSubtasksService] Built project index: ${this.projectIndex.size} projects from ${Object.keys(resolvedLinks).length} files in ${duration}ms`);

        } catch (error) {
            console.error('Error building project index:', error);
        }
    }

    /**
     * Ensure index is fresh (rebuild if needed)
     */
    private ensureIndexBuilt(): void {
        const now = Date.now();
        if (now - this.indexLastBuilt > this.INDEX_TTL) {
            this.buildProjectIndex();
        }
    }

    // Removed - cache no longer used

    // Removed - cache no longer used

    // Removed - cache no longer used

    // Removed - cache no longer used

    // Removed - cache no longer used


    // Removed - no longer needed without cache management

    // Removed - no cache to clean up

    // Removed - no cache to monitor

    // Removed - no cache to clean up

    /**
     * Cleanup when service is destroyed
     */
    destroy(): void {
        // Clear index and reset stats
        this.projectIndex.clear();
        this.stats = {
            indexBuilds: 0,
            indexHits: 0,
            indexMisses: 0
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