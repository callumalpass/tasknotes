import { TFile } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';

/**
 * Error types for task relationship operations
 */
export class TaskRelationshipError extends Error {
    constructor(message: string, public readonly taskPath?: string) {
        super(message);
        this.name = 'TaskRelationshipError';
    }
}

/**
 * Utility functions for determining task relationships and filtering subtasks
 * 
 * This class handles the identification of subtasks (tasks that reference other tasks as projects)
 * and provides filtering capabilities to hide subtasks from views when enabled.
 */
export class TaskRelationshipUtils {
    private plugin: TaskNotesPlugin;

    constructor(plugin: TaskNotesPlugin) {
        if (!plugin) {
            throw new TaskRelationshipError('Plugin instance is required');
        }
        this.plugin = plugin;
    }

    /**
     * Check if a task is a subtask (references other tasks as projects)
     * @param task - The task to check
     * @returns `true` if the task is a subtask, `false` otherwise
     * @throws {TaskRelationshipError} When task validation fails
     */
    isSubtask(task: TaskInfo): boolean {
        if (!task) {
            throw new TaskRelationshipError('Task parameter is required');
        }
        if (!task.projects || task.projects.length === 0) {
            return false;
        }

        // Check if any of the projects reference other task files
        return task.projects.some(project => {
            if (!project || typeof project !== 'string' || project.trim() === '') {
                return false;
            }

            // Check for wikilink format [[Note Name]]
            if (project.startsWith('[[') && project.endsWith(']]')) {
                const linkedNoteName = project.slice(2, -2).trim();
                if (!linkedNoteName) return false;

                // Try to resolve the link using Obsidian's metadata cache
                const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
                if (resolvedFile) {
                    // Check if the resolved file is a task file
                    return this.isTaskFile(resolvedFile.path);
                }

                // Fallback to string matching - check if it matches any task file
                return this.isTaskFile(linkedNoteName);
            }

            // Check for plain text match
            const trimmedProject = String(project).trim();
            return this.isTaskFile(trimmedProject);
        });
    }

    /**
     * Check if a file path corresponds to a task file
     * @param filePath - The file path to check
     * @returns `true` if the file is a task file, `false` otherwise
     * @throws {TaskRelationshipError} When file path validation fails
     */
    private isTaskFile(filePath: string): boolean {
        if (!filePath || typeof filePath !== 'string') {
            throw new TaskRelationshipError('Valid file path is required');
        }

        try {
            // Get the file from the vault
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                return false;
            }

            // Check if it's a markdown file
            if (!file.path.endsWith('.md')) {
                return false;
            }

            // Check if it's in the tasks folder
            const tasksFolder = this.plugin.settings.tasksFolder;
            if (tasksFolder && file.path.startsWith(tasksFolder)) {
                return true;
            }

            // Check if the file has the task tag in its frontmatter
            const cache = this.plugin.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter) {
                const taskTag = this.plugin.settings.taskTag;
                const tags = cache.frontmatter.tags;
                if (Array.isArray(tags) && taskTag && tags.includes(taskTag)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error checking if file is task file:', {
                error: errorMessage,
                filePath,
                stack: error instanceof Error ? error.stack : undefined
            });
            return false;
        }
    }

    /**
     * Filter tasks to hide subtasks if the setting is enabled
     * @param tasks - Array of tasks to filter
     * @returns Filtered array with subtasks removed if setting is enabled
     * @throws {TaskRelationshipError} When tasks array validation fails
     */
    filterSubtasks(tasks: TaskInfo[]): TaskInfo[] {
        if (!Array.isArray(tasks)) {
            throw new TaskRelationshipError('Tasks array is required');
        }

        if (!this.plugin.settings.hideSubtasks) {
            return tasks;
        }

        try {
            return tasks.filter(task => !this.isSubtask(task));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error filtering subtasks:', {
                error: errorMessage,
                taskCount: tasks.length,
                stack: error instanceof Error ? error.stack : undefined
            });
            // Return original array on error to prevent data loss
            return tasks;
        }
    }
}
