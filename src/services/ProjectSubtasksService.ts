import { TFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo } from '../types';

export class ProjectSubtasksService {
    private plugin: TaskNotesPlugin;

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
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