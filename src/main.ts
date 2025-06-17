import { Notice, Plugin, TFile, WorkspaceLeaf, normalizePath, Editor } from 'obsidian';
import format from 'date-fns/format';
import * as YAML from 'yaml';
import { 
	createDailyNote, 
	getDailyNote, 
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded
} from 'obsidian-daily-notes-interface';
import { 
	TaskNotesSettings, 
	DEFAULT_SETTINGS, 
	TaskNotesSettingTab 
} from './settings/settings';
import { 
	MINI_CALENDAR_VIEW_TYPE, 
	ADVANCED_CALENDAR_VIEW_TYPE,
	NOTES_VIEW_TYPE, 
	TASK_LIST_VIEW_TYPE,
	AGENDA_VIEW_TYPE,
	POMODORO_VIEW_TYPE,
	POMODORO_STATS_VIEW_TYPE,
	KANBAN_VIEW_TYPE,
	TimeInfo,
	TaskInfo,
	TimeEntry,
	EVENT_DATE_SELECTED,
	EVENT_TAB_CHANGED,
	EVENT_DATA_CHANGED,
	EVENT_TASK_UPDATED
} from './types';
import { MiniCalendarView } from './views/MiniCalendarView';
import { AdvancedCalendarView } from './views/AdvancedCalendarView';
import { TaskListView } from './views/TaskListView';
import { NotesView } from './views/NotesView';
import { AgendaView } from './views/AgendaView';
import { PomodoroView } from './views/PomodoroView';
import { PomodoroStatsView } from './views/PomodoroStatsView';
import { KanbanView } from './views/KanbanView';
import { TaskCreationModal, TaskConversionOptions } from './modals/TaskCreationModal';
import { TaskEditModal } from './modals/TaskEditModal';
import { PomodoroService } from './services/PomodoroService';
import { 
	ensureFolderExists, 
	extractTaskInfo,
	formatTime,
	calculateTotalTimeSpent,
	getActiveTimeEntry
} from './utils/helpers';
import { NativeMetadataCacheManager } from './utils/NativeMetadataCacheManager';
import { RequestDeduplicator, PredictivePrefetcher } from './utils/RequestDeduplicator';
import { DOMReconciler, UIStateManager } from './utils/DOMReconciler';
import { perfMonitor } from './utils/PerformanceMonitor';
import { FieldMapper } from './services/FieldMapper';
import { StatusManager } from './services/StatusManager';
import { PriorityManager } from './services/PriorityManager';
import { TaskService } from './services/TaskService';
import { FilterService } from './services/FilterService';
import { ViewStateManager } from './services/ViewStateManager';
import { TasksPluginParser } from './utils/TasksPluginParser';
import { createTaskLinkOverlay, dispatchTaskUpdate } from './editor/TaskLinkOverlay';
import { DragDropManager } from './utils/DragDropManager';
import { ICSSubscriptionService } from './services/ICSSubscriptionService';

export default class TaskNotesPlugin extends Plugin {
	settings: TaskNotesSettings;
	
	// Ready promise to signal when initialization is complete
	private readyPromise: Promise<void>;
	private resolveReady: () => void;
	
	// Shared state between views
	selectedDate: Date = new Date();
	
	// Native metadata cache manager (also handles events)
	cacheManager: NativeMetadataCacheManager;
	emitter: NativeMetadataCacheManager;
	
	// Performance optimization utilities
	requestDeduplicator: RequestDeduplicator;
	predictivePrefetcher: PredictivePrefetcher;
	domReconciler: DOMReconciler;
	uiStateManager: UIStateManager;
	
	// Pomodoro service
	pomodoroService: PomodoroService;
	
	// Customization services
	fieldMapper: FieldMapper;
	statusManager: StatusManager;
	priorityManager: PriorityManager;
	
	// Business logic services
	taskService: TaskService;
	filterService: FilterService;
	viewStateManager: ViewStateManager;
	
	// Editor services  
	taskLinkDetectionService?: import('./services/TaskLinkDetectionService').TaskLinkDetectionService;
	instantTaskConvertService?: import('./services/InstantTaskConvertService').InstantTaskConvertService;
	
	// Drag and drop manager
	dragDropManager: DragDropManager;
	
	// ICS subscription service
	icsSubscriptionService: ICSSubscriptionService;
	
	// Event listener cleanup  
	private taskUpdateListenerForEditor: any = null;
	
	// Initialization guard to prevent duplicate initialization
	private initializationComplete = false;
	
	async onload() {
		// Create the promise and store its resolver
		this.readyPromise = new Promise(resolve => {
			this.resolveReady = resolve;
		});

		await this.loadSettings();
		
		// Initialize only essential services that are needed for app registration
		this.fieldMapper = new FieldMapper(this.settings.fieldMapping);
		this.statusManager = new StatusManager(this.settings.customStatuses);
		this.priorityManager = new PriorityManager(this.settings.customPriorities);
		
		// Initialize performance optimization utilities (lightweight)
		this.requestDeduplicator = new RequestDeduplicator();
		this.predictivePrefetcher = new PredictivePrefetcher(this.requestDeduplicator);
		this.domReconciler = new DOMReconciler();
		this.uiStateManager = new UIStateManager();
		
		// Initialize native metadata cache manager
		this.cacheManager = new NativeMetadataCacheManager(
			this.app,
			this.settings.taskTag,
			this.settings.excludedFolders,
			this.fieldMapper,
			this.settings.disableNoteIndexing
		);
		
		// Use same instance for event emitting
		this.emitter = this.cacheManager;
		
		// Initialize business logic services (lightweight constructors)
		this.taskService = new TaskService(this);
		this.filterService = new FilterService(
			this.cacheManager,
			this.statusManager,
			this.priorityManager
		);
		this.viewStateManager = new ViewStateManager();
		this.dragDropManager = new DragDropManager(this);
		
		// Note: View registration and heavy operations moved to onLayoutReady
		
		// Add ribbon icon
		this.addRibbonIcon('calendar-days', 'Open calendar', async () => {
			await this.activateCalendarView();
		});

		// Add commands
		this.addCommands();

		// Add settings tab
		this.addSettingTab(new TaskNotesSettingTab(this.app, this));


		// Defer expensive initialization until layout is ready
		this.app.workspace.onLayoutReady(() => {
			this.initializeAfterLayoutReady();
		});
		
		// At the very end of onload, resolve the promise to signal readiness
		this.resolveReady();
	}

	/**
	 * Initialize expensive operations after layout is ready
	 */
	private async initializeAfterLayoutReady(): Promise<void> {
		// Guard against multiple initialization calls
		if (this.initializationComplete) {
			return;
		}
		this.initializationComplete = true;
		
		try {
			// Inject dynamic styles for custom statuses and priorities
			this.injectCustomStyles();

			// Register view types (now safe after layout ready)
			this.registerView(
				MINI_CALENDAR_VIEW_TYPE,
				(leaf) => new MiniCalendarView(leaf, this)
			);
			this.registerView(
				ADVANCED_CALENDAR_VIEW_TYPE,
				(leaf) => new AdvancedCalendarView(leaf, this)
			);
			this.registerView(
				TASK_LIST_VIEW_TYPE,
				(leaf) => new TaskListView(leaf, this)
			);
			this.registerView(
				NOTES_VIEW_TYPE,
				(leaf) => new NotesView(leaf, this)
			);
			this.registerView(
				AGENDA_VIEW_TYPE,
				(leaf) => new AgendaView(leaf, this)
			);
			this.registerView(
				POMODORO_VIEW_TYPE,
				(leaf) => new PomodoroView(leaf, this)
			);
			this.registerView(
				POMODORO_STATS_VIEW_TYPE,
				(leaf) => new PomodoroStatsView(leaf, this)
			);
			this.registerView(
				KANBAN_VIEW_TYPE,
				(leaf) => new KanbanView(leaf, this)
			);
			
			// Register essential editor extensions (now safe after layout ready)
			this.registerEditorExtension(createTaskLinkOverlay(this));
			
			// Initialize native cache system (lightweight - no index building)
			this.cacheManager.initialize();
			
			// Initialize FilterService and set up event listeners (lightweight)
			this.filterService.initialize();
			
			// Defer heavy service initialization until needed
			this.initializeServicesLazily();
			
		} catch (error) {
			console.error('Error during post-layout initialization:', error);
		}
	}

	/**
	 * Initialize heavy services lazily in the background
	 */
	private initializeServicesLazily(): void {
		// Use setTimeout to defer initialization to next tick
		setTimeout(async () => {
			try {
				// Initialize Pomodoro service
				this.pomodoroService = new PomodoroService(this);
				await this.pomodoroService.initialize();
				
				// Initialize ICS subscription service
				this.icsSubscriptionService = new ICSSubscriptionService(this);
				await this.icsSubscriptionService.initialize();
				
				// Initialize editor services (async imports)
				const { TaskLinkDetectionService } = await import('./services/TaskLinkDetectionService');
				this.taskLinkDetectionService = new TaskLinkDetectionService(this);
				
				const { InstantTaskConvertService } = await import('./services/InstantTaskConvertService');
				this.instantTaskConvertService = new InstantTaskConvertService(this);
				
				// Register additional editor extensions
				const { createInstantConvertButtons } = await import('./editor/InstantConvertButtons');
				this.registerEditorExtension(createInstantConvertButtons(this));
				
				// Set up global event listener for task updates to refresh editor decorations
				this.taskUpdateListenerForEditor = this.emitter.on(EVENT_TASK_UPDATED, (data: any) => {
					// Check if layout is ready before processing events
					if (!this.app.workspace.layoutReady) {
						return;
					}
					
					// Trigger decoration refresh in all active markdown views using proper state effects
					this.app.workspace.iterateRootLeaves((leaf) => {
						// Use instanceof check for deferred view compatibility
						if (leaf.view && leaf.view.getViewType() === 'markdown') {
							const editor = (leaf.view as any).editor;
							if (editor && editor.cm) {
								// Use the proper CodeMirror state effect pattern
								dispatchTaskUpdate(editor.cm, data?.path);
							}
						}
					});
				});
				
			} catch (error) {
				console.error('Error during lazy service initialization:', error);
			}
		}, 10); // Small delay to ensure startup completes first
	}

	/**
	 * Public method for views to wait for readiness
	 */
	async onReady(): Promise<void> {
		// If readyPromise doesn't exist, plugin hasn't started onload yet
		if (!this.readyPromise) {
			throw new Error('Plugin not yet initialized');
		}
		
		await this.readyPromise;
	}
	
	// Methods for updating shared state and emitting events
	
	/**
	 * Update the selected date and notify all views
	 */
	setSelectedDate(date: Date): void {
		this.selectedDate = date;
		this.emitter.trigger(EVENT_DATE_SELECTED, date);
	}
	
	/**
	 * Notify views that data has changed and views should refresh
	 * @param filePath Optional path of the file that changed (for targeted cache invalidation)
	 * @param force Whether to force a full cache rebuild
	 * @param triggerRefresh Whether to trigger a full UI refresh (default true)
	 */
	notifyDataChanged(filePath?: string, force: boolean = false, triggerRefresh: boolean = true): void {
		// Clear cache entries for native cache manager
		if (filePath) {
			this.cacheManager.clearCacheEntry(filePath);
			
			// Clear task link detection cache for this file
			if (this.taskLinkDetectionService) {
				this.taskLinkDetectionService.clearCacheForFile(filePath);
			}
		} else if (force) {
			// Full cache clear if forcing
			this.cacheManager.clearAllCaches();
			
			// Clear task link detection cache completely
			if (this.taskLinkDetectionService) {
				this.taskLinkDetectionService.clearCache();
			}
		}
		
		// Only emit refresh event if triggerRefresh is true
		if (triggerRefresh) {
			// Use requestAnimationFrame for better UI timing instead of setTimeout
			requestAnimationFrame(() => {
				this.emitter.trigger(EVENT_DATA_CHANGED);
			});
		}
	}

	onunload() {
		// Clean up performance monitoring
		const cacheStats = perfMonitor.getStats('cache-initialization');
		if (cacheStats && cacheStats.count > 0) {
			perfMonitor.logSummary();
		}
		
		// Clean up Pomodoro service
		if (this.pomodoroService) {
			this.pomodoroService.cleanup();
		}
		
		// Clean up FilterService
		if (this.filterService) {
			this.filterService.cleanup();
		}
		
		// Clean up ICS subscription service
		if (this.icsSubscriptionService) {
			this.icsSubscriptionService.destroy();
		}
		
		// Clean up TaskLinkDetectionService
		if (this.taskLinkDetectionService) {
			this.taskLinkDetectionService.cleanup();
		}
		
		// Clean up drag and drop manager
		if (this.dragDropManager) {
			this.dragDropManager.destroy();
		}
		
		// Clean up ViewStateManager
		if (this.viewStateManager) {
			this.viewStateManager.cleanup();
		}
		
		// Clean up native cache manager
		if (this.cacheManager) {
			this.cacheManager.destroy();
		}
		
		// Clean up request deduplicator
		if (this.requestDeduplicator) {
			this.requestDeduplicator.cancelAll();
		}
		
		// Clean up DOM reconciler
		if (this.domReconciler) {
			this.domReconciler.destroy();
		}

		// Clean up UI state manager
		if (this.uiStateManager) {
			this.uiStateManager.destroy();
		}
		
		// Clean up performance monitor
		if (typeof perfMonitor !== 'undefined') {
			perfMonitor.destroy();
		}
		
		// Clean up task update listener for editor
		if (this.taskUpdateListenerForEditor) {
			this.emitter.off(EVENT_TASK_UPDATED, this.taskUpdateListenerForEditor);
		}
		
		// Clean up the event emitter (native Events class)
		if (this.emitter && typeof this.emitter.off === 'function') {
			// Native Events cleanup happens automatically
		}
		
		// Reset initialization flag for potential reload
		this.initializationComplete = false;
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		
		// Migration: Remove old useNativeMetadataCache setting if it exists
		if (loadedData && 'useNativeMetadataCache' in loadedData) {
			delete loadedData.useNativeMetadataCache;
		}
		
		// Deep merge settings with proper migration for nested objects
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData,
			// Deep merge field mapping to ensure new fields get default values
			fieldMapping: {
				...DEFAULT_SETTINGS.fieldMapping,
				...(loadedData?.fieldMapping || {})
			},
			// Deep merge custom statuses array
			customStatuses: loadedData?.customStatuses || DEFAULT_SETTINGS.customStatuses,
			// Deep merge custom priorities array  
			customPriorities: loadedData?.customPriorities || DEFAULT_SETTINGS.customPriorities
		};
		
		// Check if we added any new field mappings and save if needed
		const hasNewFields = Object.keys(DEFAULT_SETTINGS.fieldMapping).some(key => 
			!(loadedData?.fieldMapping?.[key])
		);
		
		if (hasNewFields) {
			// Save the migrated settings to include new field mappings (non-blocking)
			setTimeout(() => {
				this.saveData(this.settings).catch(error => {
					console.error('Failed to save migrated settings:', error);
				});
			}, 100);
		}
		
		// Cache setting migration is no longer needed (native cache only)
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// Update customization services with new settings
		if (this.fieldMapper) {
			this.fieldMapper.updateMapping(this.settings.fieldMapping);
		}
		if (this.statusManager) {
			this.statusManager.updateStatuses(this.settings.customStatuses);
		}
		if (this.priorityManager) {
			this.priorityManager.updatePriorities(this.settings.customPriorities);
		}
		
		// Update the cache manager with new settings
		this.cacheManager.updateConfig(
			this.settings.taskTag,
			this.settings.excludedFolders,
			this.fieldMapper,
			this.settings.disableNoteIndexing
		);
		
		// Update custom styles
		this.injectCustomStyles();
		
		// If settings have changed, notify views to refresh their data
		this.notifyDataChanged();
	}

	addCommands() {
		// View commands
		this.addCommand({
			id: 'open-calendar-view',
			name: 'Open mini calendar view',
			callback: async () => {
				await this.activateCalendarView();
			}
		});
		
		this.addCommand({
			id: 'open-advanced-calendar-view',
			name: 'Open advanced calendar view',
			callback: async () => {
				await this.activateAdvancedCalendarView();
			}
		});
		
		this.addCommand({
			id: 'open-tasks-view',
			name: 'Open tasks view',
			callback: async () => {
				await this.activateTasksView();
			}
		});
		
		this.addCommand({
			id: 'open-notes-view',
			name: 'Open notes view',
			callback: async () => {
				await this.activateNotesView();
			}
		});
		
		this.addCommand({
			id: 'open-agenda-view',
			name: 'Open agenda view',
			callback: async () => {
				await this.activateAgendaView();
			}
		});
		
		this.addCommand({
			id: 'open-pomodoro-view',
			name: 'Open pomodoro timer',
			callback: async () => {
				await this.activatePomodoroView();
			}
		});
		
		this.addCommand({
			id: 'open-kanban-view',
			name: 'Open kanban board',
			callback: async () => {
				await this.activateKanbanView();
			}
		});
		
		this.addCommand({
			id: 'open-pomodoro-stats',
			name: 'Open pomodoro statistics',
			callback: async () => {
				await this.activatePomodoroStatsView();
			}
		});

		// Task commands
		this.addCommand({
			id: 'create-new-task',
			name: 'Create new task',
			callback: () => {
				this.openTaskCreationModal();
			}
		});

		this.addCommand({
			id: 'convert-to-tasknote',
			name: 'Convert task to TaskNote',
			editorCallback: (editor: Editor) => {
				this.convertTaskToTaskNote(editor);
			}
		});

		// Note commands
		this.addCommand({
			id: 'go-to-today',
			name: 'Go to today\'s note',
			callback: async () => {
				await this.navigateToCurrentDailyNote();
			}
		});
		
		// Pomodoro commands
		this.addCommand({
			id: 'start-pomodoro',
			name: 'Start pomodoro timer',
			callback: async () => {
				await this.pomodoroService.startPomodoro();
			}
		});
		
		this.addCommand({
			id: 'stop-pomodoro',
			name: 'Stop pomodoro timer',
			callback: async () => {
				await this.pomodoroService.stopPomodoro();
			}
		});
		
		this.addCommand({
			id: 'pause-pomodoro',
			name: 'Pause/resume pomodoro timer',
			callback: async () => {
				const state = this.pomodoroService.getState();
				if (state.isRunning) {
					await this.pomodoroService.pausePomodoro();
				} else if (state.currentSession) {
					await this.pomodoroService.resumePomodoro();
				}
			}
		});
		
		// Cache management commands
		this.addCommand({
			id: 'refresh-cache',
			name: 'Refresh TaskNotes cache',
			callback: async () => {
				await this.refreshCache();
			}
		});

	}

	// Helper method to create or activate a view of specific type
	async activateView(viewType: string) {
		const { workspace } = this.app;
		
		// Use existing view if it exists
		let leaf = this.getLeafOfType(viewType);
		
		if (!leaf) {
			// Simple approach - create a new tab
			// This is more reliable for tab behavior
			leaf = workspace.getLeaf('tab');
			
			// Set the view state for this leaf
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
		}
		
		// Make this leaf active and ensure it's visible
		workspace.setActiveLeaf(leaf, { focus: true });
		workspace.revealLeaf(leaf);
		
		return leaf;
	}
	
	async activateCalendarView() {
		return this.activateView(MINI_CALENDAR_VIEW_TYPE);
	}
	
	async activateAdvancedCalendarView() {
		return this.activateView(ADVANCED_CALENDAR_VIEW_TYPE);
	}
	
	async activateTasksView() {
		return this.activateView(TASK_LIST_VIEW_TYPE);
	}
	
	async activateNotesView() {
		return this.activateView(NOTES_VIEW_TYPE);
	}
	
	async activateAgendaView() {
		return this.activateView(AGENDA_VIEW_TYPE);
	}
	
	async activatePomodoroView() {
		return this.activateView(POMODORO_VIEW_TYPE);
	}
	
	async activatePomodoroStatsView() {
		return this.activateView(POMODORO_STATS_VIEW_TYPE);
	}
	
	async activateKanbanView() {
		return this.activateView(KANBAN_VIEW_TYPE);
	}
	

	getLeafOfType(viewType: string): WorkspaceLeaf | null {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(viewType);
		// Find the first leaf with an actually loaded view (not deferred)
		for (const leaf of leaves) {
			if (leaf.view && leaf.view.getViewType() === viewType) {
				return leaf;
			}
		}
		// If no loaded view found, return the first leaf (might be deferred)
		return leaves.length > 0 ? leaves[0] : null;
	}
	
	getCalendarLeaf(): WorkspaceLeaf | null {
		return this.getLeafOfType(MINI_CALENDAR_VIEW_TYPE);
	}

	async navigateToCurrentDailyNote() {
		const date = new Date();
		await this.navigateToDailyNote(date);
	}

	async navigateToDailyNote(date: Date) {
		try {
			// Check if Daily Notes plugin is enabled
			if (!appHasDailyNotesPluginLoaded()) {
				new Notice('Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins.');
				return;
			}

			// Convert date to moment for the API
			const moment = (window as any).moment(date);
			
			// Get all daily notes to check if one exists for this date
			const allDailyNotes = getAllDailyNotes();
			let dailyNote = getDailyNote(moment, allDailyNotes);
			let noteWasCreated = false;
			
			// If no daily note exists for this date, create one
			if (!dailyNote) {
				try {
					dailyNote = await createDailyNote(moment);
					noteWasCreated = true;
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error('Failed to create daily note:', error);
					new Notice(`Failed to create daily note: ${errorMessage}`);
					return;
				}
			}
			
			// Open the daily note
			if (dailyNote) {
				await this.app.workspace.getLeaf(false).openFile(dailyNote);
				
				// If we created a new daily note, refresh the cache to ensure it shows up in views
				if (noteWasCreated) {
					// Get the year and month from the date for cache rebuilding
					const year = date.getFullYear();
					const month = date.getMonth();
					
					// Notify views that data has changed to trigger a UI refresh
					this.notifyDataChanged(dailyNote.path, false, true);
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('Failed to navigate to daily note:', error);
			new Notice(`Failed to navigate to daily note: ${errorMessage}`);
		}
	}


/**
 * Inject dynamic CSS for custom statuses and priorities
 */
private injectCustomStyles(): void {
	// Remove existing custom styles
	const existingStyle = document.getElementById('tasknotes-custom-styles');
	if (existingStyle) {
		existingStyle.remove();
	}
	
	// Generate new styles
	const statusStyles = this.statusManager.getStatusStyles();
	const priorityStyles = this.priorityManager.getPriorityStyles();
	
	// Create style element
	const styleEl = document.createElement('style');
	styleEl.id = 'tasknotes-custom-styles';
	styleEl.textContent = `
		${statusStyles}
		${priorityStyles}
	`;
	
	// Inject into document head
	document.head.appendChild(styleEl);
}

	async updateTaskProperty(task: TaskInfo, property: keyof TaskInfo, value: any, options: { silent?: boolean } = {}): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.updateProperty(task, property, value, options);
			
			// Provide user feedback unless silent
			if (!options.silent) {
				if (property === 'status') {
					const statusConfig = this.statusManager.getStatusConfig(value);
					new Notice(`Task marked as '${statusConfig?.label || value}'`);
				} else {
					new Notice(`Task ${property} updated`);
				}
			}
			
			return updatedTask;
		} catch (error) {
			console.error(`Failed to update task ${property}:`, error);
			new Notice(`Failed to update task ${property}`);
			throw error;
		}
	}
	
	/**
	 * Toggles a recurring task's completion status for the selected date
	 */
	async toggleRecurringTaskComplete(task: TaskInfo, date?: Date): Promise<TaskInfo> {
		try {
			const targetDate = date || this.selectedDate;
			const updatedTask = await this.taskService.toggleRecurringTaskComplete(task, date);
			
			// Determine if task was completed or marked incomplete
			const dateStr = format(targetDate, 'yyyy-MM-dd');
			const wasCompleted = updatedTask.complete_instances?.includes(dateStr);
			const action = wasCompleted ? 'completed' : 'marked incomplete';
			
			new Notice(`Recurring task ${action} for ${format(targetDate, 'MMM d')}`);
			return updatedTask;
		} catch (error) {
			console.error('Failed to toggle recurring task completion:', error);
			new Notice('Failed to update recurring task');
			throw error;
		}
	}
	
	async toggleTaskArchive(task: TaskInfo): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.toggleArchive(task);
			const action = updatedTask.archived ? 'archived' : 'unarchived';
			new Notice(`Task ${action}`);
			return updatedTask;
		} catch (error) {
			console.error('Failed to toggle task archive:', error);
			new Notice('Failed to update task archive status');
			throw error;
		}
	}
	
	async toggleTaskStatus(task: TaskInfo): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.toggleStatus(task);
			const statusConfig = this.statusManager.getStatusConfig(updatedTask.status);
			new Notice(`Task marked as '${statusConfig?.label || updatedTask.status}'`);
			return updatedTask;
		} catch (error) {
			console.error('Failed to toggle task status:', error);
			new Notice('Failed to update task status');
			throw error;
		}
	}
	
	openTaskCreationModal(prePopulatedValues?: Partial<TaskInfo>) {
		new TaskCreationModal(this.app, this, prePopulatedValues).open();
	}



	
	/**
	 * Starts a time tracking session for a task
	 */
	async startTimeTracking(task: TaskInfo, description?: string): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.startTimeTracking(task);
			new Notice('Time tracking started');
			return updatedTask;
		} catch (error) {
			console.error('Failed to start time tracking:', error);
			if (error.message === 'Time tracking is already active for this task') {
				new Notice('Time tracking is already active for this task');
			} else {
				new Notice('Failed to start time tracking');
			}
			throw error;
		}
	}
	
	/**
	 * Stops the active time tracking session for a task
	 */
	async stopTimeTracking(task: TaskInfo): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.stopTimeTracking(task);
			new Notice('Time tracking stopped');
			return updatedTask;
		} catch (error) {
			console.error('Failed to stop time tracking:', error);
			if (error.message === 'No active time tracking session for this task') {
				new Notice('No active time tracking session for this task');
			} else {
				new Notice('Failed to stop time tracking');
			}
			throw error;
		}
	}
	
	/**
	 * Gets the active time tracking session for a task
	 */
	getActiveTimeSession(task: TaskInfo) {
		return getActiveTimeEntry(task.timeEntries || []);
	}
	
	/**
	 * Check if a recurring task is completed for a specific date
	 */
	isRecurringTaskCompleteForDate(task: TaskInfo, date: Date): boolean {
		if (!task.recurrence) return false;
		const dateStr = format(date, 'yyyy-MM-dd');
		const completeInstances = Array.isArray(task.complete_instances) ? task.complete_instances : [];
		return completeInstances.includes(dateStr);
	}
	
	/**
	 * Formats time in minutes to a readable string
	 */
	formatTime(minutes: number): string {
		return formatTime(minutes);
	}

	/**
	 * Opens the task edit modal for a specific task
	 */
	async openTaskEditModal(task: TaskInfo) {
		// Always fetch fresh task data from file system to ensure we have the latest values
		const freshTask = await this.cacheManager.getTaskInfo(task.path);
		const taskToEdit = freshTask || task; // Fallback to original if file read fails
		
		new TaskEditModal(this.app, this, taskToEdit).open();
	}

	/**
	 * Opens a simple due date modal (placeholder for now)
	 */
	async openDueDateModal(task: TaskInfo) {
		try {
			const { DueDateModal } = await import('./modals/DueDateModal');
			const modal = new DueDateModal(this.app, task, this);
			modal.open();
		} catch (error) {
			console.error('Error loading DueDateModal:', error);
		}
	}

	async openScheduledDateModal(task: TaskInfo) {
		try {
			const { ScheduledDateModal } = await import('./modals/ScheduledDateModal');
			const modal = new ScheduledDateModal(this.app, task, this);
			modal.open();
		} catch (error) {
			console.error('Error loading ScheduledDateModal:', error);
		}
	}
	
	/**
	 * Refreshes the TaskNotes cache by clearing all cached data and re-initializing
	 */
	async refreshCache(): Promise<void> {
		try {
			// Show loading notice
			const loadingNotice = new Notice('Refreshing TaskNotes cache...', 0);
			
			// Clear all caches
			await this.cacheManager.clearAllCaches();
			
			// Notify all views to refresh
			this.notifyDataChanged(undefined, true, true);
			
			// Hide loading notice and show success
			loadingNotice.hide();
			new Notice('TaskNotes cache refreshed successfully');
			
		} catch (error) {
			console.error('Error refreshing cache:', error);
			new Notice('Failed to refresh cache. Please try again.');
		}
	}

	/**
	 * Convert any checkbox task on current line to TaskNotes task
	 * Supports multi-line selection where additional lines become task details
	 */
	convertTaskToTaskNote(editor: Editor): void {
		try {
			const cursor = editor.getCursor();
			
			// Extract selection information (same logic as instant convert)
			const selectionInfo = this.extractSelectionInfoForCommand(editor, cursor.line);
			const currentLine = selectionInfo.taskLine;
			const details = selectionInfo.details;
			
			// Parse the current line for Tasks plugin format
			const taskLineInfo = TasksPluginParser.parseTaskLine(currentLine);
			
			if (!taskLineInfo.isTaskLine) {
				new Notice('Current line is not a task. Place cursor on a line with a checkbox task.');
				return;
			}
			
			if (taskLineInfo.error) {
				new Notice(`Error parsing task: ${taskLineInfo.error}`);
				return;
			}
			
			if (!taskLineInfo.parsedData) {
				new Notice('Failed to parse task data from current line.');
				return;
			}
			
			// Prepare conversion options with details
			const conversionOptions: TaskConversionOptions = {
				parsedData: taskLineInfo.parsedData,
				editor: editor,
				lineNumber: cursor.line,
				selectionInfo: selectionInfo,
				prefilledDetails: details
			};
			
			// Open TaskCreationModal with pre-populated data
			new TaskCreationModal(this.app, this, undefined, conversionOptions).open();
			
		} catch (error) {
			console.error('Error converting task:', error);
			new Notice('Failed to convert task. Please try again.');
		}
	}

	/**
	 * Extract selection information for command usage
	 */
	private extractSelectionInfoForCommand(editor: Editor, lineNumber: number): { taskLine: string; details: string; startLine: number; endLine: number; originalContent: string[] } {
		const selection = editor.getSelection();
		
		// If there's a selection, use it; otherwise just use the current line
		if (selection && selection.trim()) {
			const selectionRange = editor.listSelections()[0];
			const startLine = Math.min(selectionRange.anchor.line, selectionRange.head.line);
			const endLine = Math.max(selectionRange.anchor.line, selectionRange.head.line);
			
			// Extract all lines in the selection
			const selectedLines: string[] = [];
			for (let i = startLine; i <= endLine; i++) {
				selectedLines.push(editor.getLine(i));
			}
			
			// First line should be the task, rest become details
			const taskLine = selectedLines[0];
			const detailLines = selectedLines.slice(1);
			// Join without trimming to preserve indentation, but remove trailing whitespace only
			const details = detailLines.join('\n').trimEnd();
			
			return {
				taskLine,
				details,
				startLine,
				endLine,
				originalContent: selectedLines
			};
		} else {
			// No selection, just use the current line
			const taskLine = editor.getLine(lineNumber);
			return {
				taskLine,
				details: '',
				startLine: lineNumber,
				endLine: lineNumber,
				originalContent: [taskLine]
			};
		}
	}

}