import TaskNotesPlugin from '../main';

export class ExpandedProjectsService {
    private plugin: TaskNotesPlugin;
    private expandedProjects: Set<string> = new Set();

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
    }

    /**
     * Check if a project task is currently expanded
     */
    isExpanded(taskPath: string): boolean {
        return this.expandedProjects.has(taskPath);
    }

    /**
     * Toggle the expanded state of a project task
     */
    toggle(taskPath: string): boolean {
        if (this.expandedProjects.has(taskPath)) {
            this.expandedProjects.delete(taskPath);
            return false;
        } else {
            this.expandedProjects.add(taskPath);
            return true;
        }
    }

    /**
     * Set the expanded state of a project task
     */
    setExpanded(taskPath: string, expanded: boolean): void {
        if (expanded) {
            this.expandedProjects.add(taskPath);
        } else {
            this.expandedProjects.delete(taskPath);
        }
    }

    /**
     * Get all currently expanded project paths
     */
    getExpandedProjects(): string[] {
        return Array.from(this.expandedProjects);
    }

    /**
     * Clear all expanded states
     */
    clearAll(): void {
        this.expandedProjects.clear();
    }

    /**
     * Collapse all expanded projects
     */
    collapseAll(): void {
        this.clearAll();
    }
}