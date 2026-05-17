import TaskNotesPlugin from "../main";

export class ExpandedProjectsService {
	private plugin: TaskNotesPlugin;
	private expandedProjects: Set<string> = new Set();
	private collapsedDefaultExpandedProjects: Set<string> = new Set();

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Check if a project task is currently expanded
	 */
	isExpanded(taskPath: string, expandByDefault = false): boolean {
		if (expandByDefault) {
			return !this.collapsedDefaultExpandedProjects.has(taskPath);
		}

		return this.expandedProjects.has(taskPath);
	}

	/**
	 * Toggle the expanded state of a project task
	 */
	toggle(taskPath: string, expandByDefault = false): boolean {
		if (expandByDefault) {
			if (this.collapsedDefaultExpandedProjects.has(taskPath)) {
				this.collapsedDefaultExpandedProjects.delete(taskPath);
				return true;
			}

			this.collapsedDefaultExpandedProjects.add(taskPath);
			this.expandedProjects.delete(taskPath);
			return false;
		}

		this.collapsedDefaultExpandedProjects.delete(taskPath);

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
	setExpanded(taskPath: string, expanded: boolean, expandByDefault = false): void {
		if (expandByDefault) {
			if (expanded) {
				this.collapsedDefaultExpandedProjects.delete(taskPath);
			} else {
				this.collapsedDefaultExpandedProjects.add(taskPath);
				this.expandedProjects.delete(taskPath);
			}
			return;
		}

		this.collapsedDefaultExpandedProjects.delete(taskPath);

		if (expanded) {
			this.expandedProjects.add(taskPath);
		} else {
			this.expandedProjects.delete(taskPath);
		}
	}

	/**
	 * Preserve expansion when a task file is renamed.
	 */
	renamePath(oldPath: string, newPath: string): void {
		if (oldPath === newPath) return;
		if (this.expandedProjects.delete(oldPath)) {
			this.expandedProjects.add(newPath);
		}
		if (this.collapsedDefaultExpandedProjects.delete(oldPath)) {
			this.collapsedDefaultExpandedProjects.add(newPath);
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
		this.collapsedDefaultExpandedProjects.clear();
	}

	/**
	 * Collapse all expanded projects
	 */
	collapseAll(): void {
		this.clearAll();
	}
}
