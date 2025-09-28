import { TaskInfo } from '../types';
import { RequestDeduplicator } from '../utils/RequestDeduplicator';
import { setTooltip } from 'obsidian';

export class StatusBarService {
	private plugin: import('../main').default;
	private statusBarElement: HTMLElement | null = null;
	private requestDeduplicator: RequestDeduplicator;
	private updateTimeout: number | null = null;
	
	constructor(plugin: import('../main').default) {
		this.plugin = plugin;
		this.requestDeduplicator = new RequestDeduplicator();
	}
	
	/**
	 * Initialize the status bar service
	 */
	initialize(): void {
		if (!this.plugin.settings.showTrackedTasksInStatusBar) {
			return;
		}
		
		// Create status bar element
		this.statusBarElement = this.plugin.addStatusBarItem();
		this.statusBarElement.addClass('tasknotes-status-bar');
		this.statusBarElement.style.cursor = 'pointer';
		
		// Add click handler to open tasks view filtered to tracked tasks
		this.statusBarElement.addEventListener('click', () => {
			this.handleStatusBarClick();
		});
		
		// Initial update
		this.updateStatusBar();
	}
	
	/**
	 * Update the status bar display
	 */
	private async updateStatusBar(): Promise<void> {
		if (!this.statusBarElement || !this.plugin.settings.showTrackedTasksInStatusBar) {
			return;
		}
		
		try {
			// Use request deduplicator to prevent excessive updates
			const trackedTasks = await this.requestDeduplicator.execute(
				'update-status-bar',
				() => this.getTrackedTasks()
			);
			
			this.renderStatusBar(trackedTasks);
		} catch (error) {
			console.error('Error updating status bar:', error);
		}
	}
	
	/**
	 * Get all currently tracked tasks (tasks with active time sessions)
	 */
	private async getTrackedTasks(): Promise<TaskInfo[]> {
		// Force a fresh lookup of all tasks to avoid stale data
		const allTasks = await this.plugin.cacheManager.getAllTasks();
		
		return allTasks.filter(task => {
			// Skip archived tasks
			if (task.archived) return false;
			
			// Check if task has an active time session
			const activeSession = this.plugin.getActiveTimeSession(task);
			return activeSession !== null;
		});
	}
	
	/**
	 * Render the status bar with tracked tasks information
	 */
	private renderStatusBar(trackedTasks: TaskInfo[]): void {
		if (!this.statusBarElement) return;
		
		const count = trackedTasks.length;
		
		if (count === 0) {
			// Hide status bar when no tasks are being tracked
			this.statusBarElement.style.display = 'none';
			return;
		}
		
		// Show status bar
		this.statusBarElement.style.display = '';
		
		// Clear previous content
		this.statusBarElement.empty();
		
		// Create icon
		this.statusBarElement.createEl('span', {
			cls: 'tasknotes-status-icon',
			text: '⏱️'
		});
		
		// Create text content
		const textEl = this.statusBarElement.createEl('span', {
			cls: 'tasknotes-status-text'
		});
		
		if (count === 1) {
			const task = trackedTasks[0];
			const truncatedTitle = task.title.length > 30 
				? task.title.substring(0, 30) + '...' 
				: task.title;
			textEl.setText(`Tracking: ${truncatedTitle}`);
			
			// Add tooltip with full title
			setTooltip(this.statusBarElement, `Currently tracking: ${task.title}`, { placement: 'top' });
		} else {
			textEl.setText(`Tracking ${count} tasks`);
			
			// Add tooltip with task titles
			const taskTitles = trackedTasks
				.slice(0, 5) // Show max 5 in tooltip
				.map(task => task.title)
				.join('\n');
			const tooltipText = count > 5 
				? `${taskTitles}\n... and ${count - 5} more`
				: taskTitles;
			setTooltip(this.statusBarElement, `Currently tracking:\n${tooltipText}`, { placement: 'top' });
		}
	}
	
	/**
	 * Handle click on status bar - open tasks view with tracked tasks
	 */
	private async handleStatusBarClick(): Promise<void> {
		try {
			// Get tracked tasks
			const trackedTasks = await this.getTrackedTasks();
			
			if (trackedTasks.length === 0) {
				return;
			}
			
			// Open task list view
			await this.plugin.activateTasksView();
			
			// Set filter to show only tracked tasks
			// Note: This would require extending the FilterService to support time-tracking filter
			// For now, just open the tasks view - the user can see which tasks have active time tracking
			
		} catch (error) {
			console.error('Error handling status bar click:', error);
		}
	}
	
	/**
	 * Request an update to the status bar (debounced)
	 */
	requestUpdate(): void {
		// Clear existing timeout
		if (this.updateTimeout) {
			window.clearTimeout(this.updateTimeout);
		}
		
		// Debounce updates to prevent excessive re-renders
		this.updateTimeout = window.setTimeout(() => {
			this.updateStatusBar();
		}, 100);
	}
	
	/**
	 * Show or hide the status bar based on settings
	 */
	updateVisibility(): void {
		if (this.plugin.settings.showTrackedTasksInStatusBar) {
			if (!this.statusBarElement) {
				this.initialize();
			} else {
				this.updateStatusBar();
			}
		} else {
			this.hide();
		}
	}
	
	/**
	 * Hide the status bar
	 */
	private hide(): void {
		if (this.statusBarElement) {
			this.statusBarElement.style.display = 'none';
		}
	}
	
	/**
	 * Cleanup when service is destroyed
	 */
	destroy(): void {
		if (this.updateTimeout) {
			window.clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}
		
		if (this.requestDeduplicator) {
			this.requestDeduplicator.cancelAll();
		}
		
		// Status bar element is automatically cleaned up by Obsidian when plugin unloads
		this.statusBarElement = null;
	}
}