import { Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";

/**
 * Service for managing task selection state across views.
 * Supports shift-to-select mode with standard multi-select behaviors.
 */
export class TaskSelectionService {
	private plugin: TaskNotesPlugin;
	private selectedTaskPaths: Set<string> = new Set();
	private lastSelectedPath: string | null = null;
	private primarySelectedPath: string | null = null;
	private selectionModeActive = false;
	private selectionModeListeners: Array<(active: boolean) => void> = [];
	private selectionChangeListeners: Array<(paths: string[]) => void> = [];

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Check if selection mode is currently active.
	 */
	isSelectionModeActive(): boolean {
		return this.selectionModeActive;
	}

	/**
	 * Enter selection mode (triggered by shift key).
	 */
	enterSelectionMode(): void {
		if (!this.selectionModeActive) {
			this.selectionModeActive = true;
			this.notifySelectionModeChange(true);
		}
	}

	/**
	 * Exit selection mode (triggered by escape or clicking outside).
	 * Optionally clear selection.
	 */
	exitSelectionMode(clearSelection = false): void {
		if (this.selectionModeActive) {
			this.selectionModeActive = false;
			if (clearSelection) {
				this.clearSelection();
			}
			this.notifySelectionModeChange(false);
		}
	}

	/**
	 * Toggle selection mode.
	 */
	toggleSelectionMode(): void {
		if (this.selectionModeActive) {
			this.exitSelectionMode();
		} else {
			this.enterSelectionMode();
		}
	}

	/**
	 * Check if a task is selected.
	 */
	isSelected(taskPath: string): boolean {
		return this.selectedTaskPaths.has(taskPath);
	}

	/**
	 * Toggle selection of a single task (ctrl/cmd+click behavior).
	 */
	toggleSelection(taskPath: string): void {
		if (this.selectedTaskPaths.has(taskPath)) {
			this.selectedTaskPaths.delete(taskPath);
			// If we removed the primary, pick a new one
			if (this.primarySelectedPath === taskPath) {
				this.primarySelectedPath = this.selectedTaskPaths.size > 0
					? Array.from(this.selectedTaskPaths)[0]
					: null;
			}
		} else {
			// First selected task becomes primary
			if (this.selectedTaskPaths.size === 0) {
				this.primarySelectedPath = taskPath;
			}
			this.selectedTaskPaths.add(taskPath);
		}
		this.lastSelectedPath = taskPath;

		// Auto-enter selection mode when first task is selected
		if (this.selectedTaskPaths.size > 0 && !this.selectionModeActive) {
			this.enterSelectionMode();
		}

		// Auto-exit selection mode when last task is deselected
		if (this.selectedTaskPaths.size === 0 && this.selectionModeActive) {
			this.exitSelectionMode();
		}

		this.notifySelectionChange();
	}

	/**
	 * Select a single task (replacing current selection).
	 */
	selectTask(taskPath: string): void {
		this.selectedTaskPaths.clear();
		this.selectedTaskPaths.add(taskPath);
		this.lastSelectedPath = taskPath;
		this.primarySelectedPath = taskPath;
		this.notifySelectionChange();
	}

	/**
	 * Add a task to selection without clearing existing selection.
	 */
	addToSelection(taskPath: string): void {
		// First selected task becomes primary
		if (this.selectedTaskPaths.size === 0) {
			this.primarySelectedPath = taskPath;
		}
		this.selectedTaskPaths.add(taskPath);
		this.lastSelectedPath = taskPath;
		this.notifySelectionChange();
	}

	/**
	 * Remove a task from selection.
	 */
	removeFromSelection(taskPath: string): void {
		this.selectedTaskPaths.delete(taskPath);
		this.notifySelectionChange();
	}

	/**
	 * Handle range selection (shift+click behavior).
	 * Selects all tasks between the last selected task and the clicked task.
	 */
	selectRange(taskPath: string, allVisiblePaths: string[]): void {
		if (!this.lastSelectedPath) {
			// No previous selection, just select this task
			this.selectTask(taskPath);
			return;
		}

		const lastIndex = allVisiblePaths.indexOf(this.lastSelectedPath);
		const currentIndex = allVisiblePaths.indexOf(taskPath);

		if (lastIndex === -1 || currentIndex === -1) {
			// One of the tasks is not visible, just toggle this task
			this.toggleSelection(taskPath);
			return;
		}

		// Select all tasks in the range
		const startIndex = Math.min(lastIndex, currentIndex);
		const endIndex = Math.max(lastIndex, currentIndex);

		for (let i = startIndex; i <= endIndex; i++) {
			this.selectedTaskPaths.add(allVisiblePaths[i]);
		}

		this.lastSelectedPath = taskPath;
		this.notifySelectionChange();
	}

	/**
	 * Select all visible tasks.
	 */
	selectAll(allVisiblePaths: string[]): void {
		// First task becomes primary if none selected yet
		if (this.selectedTaskPaths.size === 0 && allVisiblePaths.length > 0) {
			this.primarySelectedPath = allVisiblePaths[0];
		}
		for (const path of allVisiblePaths) {
			this.selectedTaskPaths.add(path);
		}
		if (allVisiblePaths.length > 0) {
			this.lastSelectedPath = allVisiblePaths[allVisiblePaths.length - 1];
		}
		this.notifySelectionChange();
	}

	/**
	 * Clear all selections.
	 */
	clearSelection(): void {
		this.selectedTaskPaths.clear();
		this.lastSelectedPath = null;
		this.primarySelectedPath = null;
		this.notifySelectionChange();
	}

	/**
	 * Get all selected task paths.
	 */
	getSelectedPaths(): string[] {
		return Array.from(this.selectedTaskPaths);
	}

	/**
	 * Get the primary (first) selected task path.
	 */
	getPrimarySelectedPath(): string | null {
		return this.primarySelectedPath;
	}

	/**
	 * Get the number of selected tasks.
	 */
	getSelectionCount(): number {
		return this.selectedTaskPaths.size;
	}

	/**
	 * Get TaskInfo objects for all selected tasks.
	 */
	async getSelectedTasks(): Promise<TaskInfo[]> {
		const tasks: TaskInfo[] = [];
		for (const path of this.selectedTaskPaths) {
			const task = await this.plugin.cacheManager.getTaskInfo(path);
			if (task) {
				tasks.push(task);
			}
		}
		return tasks;
	}

	/**
	 * Register a listener for selection mode changes.
	 */
	onSelectionModeChange(listener: (active: boolean) => void): () => void {
		this.selectionModeListeners.push(listener);
		return () => {
			const index = this.selectionModeListeners.indexOf(listener);
			if (index !== -1) {
				this.selectionModeListeners.splice(index, 1);
			}
		};
	}

	/**
	 * Register a listener for selection changes.
	 */
	onSelectionChange(listener: (paths: string[]) => void): () => void {
		this.selectionChangeListeners.push(listener);
		return () => {
			const index = this.selectionChangeListeners.indexOf(listener);
			if (index !== -1) {
				this.selectionChangeListeners.splice(index, 1);
			}
		};
	}

	private notifySelectionModeChange(active: boolean): void {
		for (const listener of this.selectionModeListeners) {
			try {
				listener(active);
			} catch (e) {
				console.error("[TaskSelectionService] Error in selection mode listener:", e);
			}
		}
	}

	private notifySelectionChange(): void {
		const paths = this.getSelectedPaths();
		for (const listener of this.selectionChangeListeners) {
			try {
				listener(paths);
			} catch (e) {
				console.error("[TaskSelectionService] Error in selection change listener:", e);
			}
		}
	}

	/**
	 * Cleanup on unload.
	 */
	destroy(): void {
		this.selectedTaskPaths.clear();
		this.selectionModeListeners = [];
		this.selectionChangeListeners = [];
	}
}
