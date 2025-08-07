import { Notice, Plugin, WorkspaceLeaf, Editor, MarkdownView, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { format } from 'date-fns';
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
	TaskInfo,
	EVENT_DATE_SELECTED,
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
import { TaskCreationModal } from './modals/TaskCreationModal';
import { TaskEditModal } from './modals/TaskEditModal';
import { TaskSelectorModal } from './modals/TaskSelectorModal';
import { PomodoroService } from './services/PomodoroService';
import { 
	formatTime,
	getActiveTimeEntry
} from './utils/helpers';
import { MinimalNativeCache } from './utils/MinimalNativeCache';
import { RequestDeduplicator, PredictivePrefetcher } from './utils/RequestDeduplicator';
import { DOMReconciler, UIStateManager } from './utils/DOMReconciler';
import { perfMonitor } from './utils/PerformanceMonitor';
import { FieldMapper } from './services/FieldMapper';
import { StatusManager } from './services/StatusManager';
import { PriorityManager } from './services/PriorityManager';
import { TaskService } from './services/TaskService';
import { FilterService } from './services/FilterService';
import { ViewStateManager } from './services/ViewStateManager';
import { createTaskLinkOverlay, dispatchTaskUpdate } from './editor/TaskLinkOverlay';
import { createReadingModeTaskLinkProcessor } from './editor/ReadingModeTaskLinkProcessor';
import { createProjectNoteDecorations, dispatchProjectSubtasksUpdate } from './editor/ProjectNoteDecorations';
import { DragDropManager } from './utils/DragDropManager';
import { formatDateForStorage, getTodayLocal, createUTCDateFromLocalCalendarDate } from './utils/dateUtils';
import { ICSSubscriptionService } from './services/ICSSubscriptionService';
import { ICSNoteService } from './services/ICSNoteService';
import { MigrationService } from './services/MigrationService';
import { showMigrationPrompt } from './modals/MigrationModal';
import { StatusBarService } from './services/StatusBarService';
import { ProjectSubtasksService } from './services/ProjectSubtasksService';
import { ExpandedProjectsService } from './services/ExpandedProjectsService';
import { NotificationService } from './services/NotificationService';

// Type definitions for better type safety
interface TaskUpdateEventData {
	path?: string;
	originalTask?: TaskInfo;
	updatedTask?: TaskInfo;
}

export default class TaskNotesPlugin extends Plugin {
	settings: TaskNotesSettings;
	
	// Track cache-related settings to avoid unnecessary re-indexing
	private previousCacheSettings: {
		taskTag: string;
		excludedFolders: string;
		disableNoteIndexing: boolean;
		storeTitleInFilename: boolean;
		fieldMapping: any;
	} | null = null;
	
	// Track time tracking settings to avoid unnecessary listener updates
	private previousTimeTrackingSettings: {
		autoStopTimeTrackingOnComplete: boolean;
	} | null = null;
	
	// Ready promise to signal when initialization is complete
	private readyPromise: Promise<void>;
	private resolveReady: () => void;
	
	// Shared state between views
	// Initialize with UTC anchor for today's calendar date
	selectedDate: Date = createUTCDateFromLocalCalendarDate(getTodayLocal());
	
	// Minimal native cache manager (also handles events)
	cacheManager: MinimalNativeCache;
	emitter: MinimalNativeCache;
	
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
	projectSubtasksService: ProjectSubtasksService;
	expandedProjectsService: ExpandedProjectsService;
	
	// Editor services  
	taskLinkDetectionService?: import('./services/TaskLinkDetectionService').TaskLinkDetectionService;
	instantTaskConvertService?: import('./services/InstantTaskConvertService').InstantTaskConvertService;
	
	// Drag and drop manager
	dragDropManager: DragDropManager;
	
	// ICS subscription service
	icsSubscriptionService: ICSSubscriptionService;
	
	// ICS note service for creating notes/tasks from ICS events
	icsNoteService: ICSNoteService;
	
	// Migration service
	migrationService: MigrationService;
	
	// Status bar service
	statusBarService: StatusBarService;
	
	// Notification service
	notificationService: NotificationService;
	
	// Event listener cleanup  
	private taskUpdateListenerForEditor: import('obsidian').EventRef | null = null;
	
	// Initialization guard to prevent duplicate initialization
	private initializationComplete = false;
	
	// Migration state management
	private migrationComplete = false;
	private migrationPromise: Promise<void> | null = null;
	
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
		
		// Initialize minimal native cache manager
		this.cacheManager = new MinimalNativeCache(
			this.app,
			this.settings,
			this.fieldMapper
		);
		
		// Use same instance for event emitting
		this.emitter = this.cacheManager;
		
		// Initialize business logic services (lightweight constructors)
		this.taskService = new TaskService(this);
		this.filterService = new FilterService(
			this.cacheManager,
			this.statusManager,
			this.priorityManager,
			this
		);
		this.viewStateManager = new ViewStateManager(this.app, this);
		this.projectSubtasksService = new ProjectSubtasksService(this);
		this.expandedProjectsService = new ExpandedProjectsService(this);
		this.dragDropManager = new DragDropManager(this);
		this.migrationService = new MigrationService(this.app);
		this.statusBarService = new StatusBarService(this);
		this.notificationService = new NotificationService(this);
		
		// Note: View registration and heavy operations moved to onLayoutReady
		
		// Add ribbon icons
		this.addRibbonIcon('calendar-days', 'Open mini calendar', async () => {
			await this.activateCalendarView();
		});
		
		this.addRibbonIcon('calendar', 'Open advanced calendar', async () => {
			await this.activateAdvancedCalendarView();
		});
		
		this.addRibbonIcon('check-square', 'Open task list', async () => {
			await this.activateTasksView();
		});
		
		this.addRibbonIcon('sticky-note', 'Open notes', async () => {
			await this.activateNotesView();
		});
		
		this.addRibbonIcon('list', 'Open agenda', async () => {
			await this.activateAgendaView();
		});
		
		this.addRibbonIcon('columns-3', 'Open kanban board', async () => {
			await this.activateKanbanView();
		});
		
		this.addRibbonIcon('timer', 'Open pomodoro', async () => {
			await this.activatePomodoroView();
		});
		
		this.addRibbonIcon('bar-chart-3', 'Open pomodoro stats', async () => {
			await this.activatePomodoroStatsView();
		});
		
		this.addRibbonIcon('plus', 'Create new task', () => {
			this.openTaskCreationModal();
		});

		// Add commands
		this.addCommands();

		// Add settings tab
		this.addSettingTab(new TaskNotesSettingTab(this.app, this));


		// Start migration check early (before views can be opened)
		this.migrationPromise = this.performEarlyMigrationCheck();
		
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
			
			// Register project note decorations for live preview
			this.registerEditorExtension(createProjectNoteDecorations(this));
			
			// Register reading mode task link processor
			this.registerMarkdownPostProcessor(createReadingModeTaskLinkProcessor(this));
			
			// Initialize native cache system (lightweight - no index building)
			this.cacheManager.initialize();
			
			// Initialize FilterService and set up event listeners (lightweight)
			this.filterService.initialize();
			
			// Initialize status bar service
			this.statusBarService.initialize();
			
			// Initialize notification service
			await this.notificationService.initialize();
			
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
				
				// Initialize ICS note service
				this.icsNoteService = new ICSNoteService(this);
				
				// Initialize editor services (async imports)
				const { TaskLinkDetectionService } = await import('./services/TaskLinkDetectionService');
				this.taskLinkDetectionService = new TaskLinkDetectionService(this);
				
				const { InstantTaskConvertService } = await import('./services/InstantTaskConvertService');
				this.instantTaskConvertService = new InstantTaskConvertService(this, this.statusManager, this.priorityManager);
				
				// Register additional editor extensions
				const { createInstantConvertButtons } = await import('./editor/InstantConvertButtons');
				this.registerEditorExtension(createInstantConvertButtons(this));
				
				// Set up global event listener for task updates to refresh editor decorations
				this.taskUpdateListenerForEditor = this.emitter.on(EVENT_TASK_UPDATED, (data: { path?: string; updatedTask?: TaskInfo }) => {
					
					// Trigger decoration refresh in all active markdown views using proper state effects
					this.app.workspace.iterateRootLeaves((leaf) => {
						// Use instanceof check for deferred view compatibility
						if (leaf.view && leaf.view.getViewType() === 'markdown') {
							const editor = (leaf.view as MarkdownView).editor;
							if (editor && (editor as Editor & { cm?: EditorView }).cm) {
								// Use the proper CodeMirror state effect pattern
								// Pass the updated task path to ensure specific widget refreshing
								const taskPath = data?.path || data?.updatedTask?.path;
								dispatchTaskUpdate((editor as Editor & { cm: EditorView }).cm, taskPath);
								
								// Also update project subtasks widgets
								dispatchProjectSubtasksUpdate((editor as Editor & { cm: EditorView }).cm);
							}
						}
					});
				});
				
				// Set up workspace event listener for active leaf changes to refresh task overlays
				this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
					// Small delay to ensure editor is fully initialized
					setTimeout(() => {
						if (leaf && leaf.view && leaf.view.getViewType() === 'markdown') {
							const editor = (leaf.view as MarkdownView).editor;
							if (editor && (editor as Editor & { cm?: EditorView }).cm) {
								// Dispatch task update to refresh overlays when returning to a note
								dispatchTaskUpdate((editor as Editor & { cm: EditorView }).cm);
								
								// Also update project subtasks widgets
								dispatchProjectSubtasksUpdate((editor as Editor & { cm: EditorView }).cm);
							}
						}
					}, 50);
				}));
				
				// Set up workspace event listener for layout changes to detect mode switches
				this.registerEvent(this.app.workspace.on('layout-change', () => {
					// Small delay to ensure mode switch is complete
					setTimeout(() => {
						const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
						if (activeView) {
							const editor = activeView.editor;
							if (editor && (editor as Editor & { cm?: EditorView }).cm) {
								// Refresh overlays when switching to Live Preview mode
								dispatchTaskUpdate((editor as Editor & { cm: EditorView }).cm);
								
								// Also update project subtasks widgets
								dispatchProjectSubtasksUpdate((editor as Editor & { cm: EditorView }).cm);
							}
						}
					}, 100);
				}));
				
				// Set up status bar event listeners for real-time updates
				this.setupStatusBarEventListeners();
				
				// Set up time tracking event listeners
				this.setupTimeTrackingEventListeners();
				
				// Migration check was moved to early startup - just show prompts here if needed
				await this.showMigrationPromptsIfNeeded();
				
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
	
	/**
	 * Set up event listeners for status bar updates
	 */
	private setupStatusBarEventListeners(): void {
		if (!this.statusBarService) {
			return;
		}
		
		// Listen for task updates that might affect time tracking
		this.registerEvent(this.emitter.on(EVENT_TASK_UPDATED, () => {
			// Small delay to ensure task state changes are fully propagated
			setTimeout(() => {
				this.statusBarService.requestUpdate();
			}, 100);
		}));

		
		// Listen for general data changes
		this.registerEvent(this.emitter.on(EVENT_DATA_CHANGED, () => {
			// Small delay to ensure data changes are fully propagated
			setTimeout(() => {
				this.statusBarService.requestUpdate();
			}, 100);
		}));
		
		// Listen for Pomodoro events if Pomodoro service is available
		if (this.pomodoroService) {
			// Listen for Pomodoro start events
			this.registerEvent(this.emitter.on('pomodoro-start', () => {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			}));
			
			// Listen for Pomodoro stop events
			this.registerEvent(this.emitter.on('pomodoro-stop', () => {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			}));
			
			// Listen for Pomodoro state changes
			this.registerEvent(this.emitter.on('pomodoro-state-changed', () => {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			}));
		}
	}
	
	/**
	 * Set up time tracking event listeners based on settings
	 */
	private setupTimeTrackingEventListeners(): void {
		// Only set up listener if auto-stop is enabled
		if (this.settings.autoStopTimeTrackingOnComplete) {
			const eventRef = this.emitter.on(EVENT_TASK_UPDATED, async (data: TaskUpdateEventData) => {
				await this.handleAutoStopTimeTracking(data);
			});
			this.registerEvent(eventRef);
		}
		
		// Update tracking of time tracking settings
		this.updatePreviousTimeTrackingSettings();
	}
	
	
	/**
	 * Handle auto-stop time tracking logic
	 */
	private async handleAutoStopTimeTracking(data: TaskUpdateEventData): Promise<void> {
		const { originalTask, updatedTask } = data;
		if (!originalTask || !updatedTask) {
			return;
		}

		// Check if status changed from non-completed to completed
		const wasCompleted = this.statusManager.isCompletedStatus(originalTask.status);
		const isNowCompleted = this.statusManager.isCompletedStatus(updatedTask.status);

		if (!wasCompleted && isNowCompleted) {
			// Task was just marked as completed - check if it has active time tracking
			const activeSession = this.getActiveTimeSession(updatedTask);
			if (activeSession) {
				try {
					await this.stopTimeTracking(updatedTask);
					
					// Show notification if enabled
					if (this.settings.autoStopTimeTrackingNotification) {
						new Notice(`Auto-stopped time tracking for: ${updatedTask.title}`);
					}
					
					console.log(`Auto-stopped time tracking for completed task: ${updatedTask.title}`);
				} catch (error) {
					console.error('Error auto-stopping time tracking:', error);
					// Don't show error notice to user as this is an automatic action
				}
			}
		}
	}
	
	/**
	 * Check if time tracking settings have changed since last save
	 */
	private haveTimeTrackingSettingsChanged(): boolean {
		if (!this.previousTimeTrackingSettings) {
			return true; // First time, assume changed
		}

		return this.settings.autoStopTimeTrackingOnComplete !== this.previousTimeTrackingSettings.autoStopTimeTrackingOnComplete;
	}
	
	/**
	 * Update tracking of time tracking settings
	 */
	private updatePreviousTimeTrackingSettings(): void {
		this.previousTimeTrackingSettings = {
			autoStopTimeTrackingOnComplete: this.settings.autoStopTimeTrackingOnComplete
		};
	}
	
	/**
	 * Perform early migration check and state preparation
	 * This runs before any views can be opened to prevent race conditions
	 */
	private async performEarlyMigrationCheck(): Promise<void> {
		try {
			console.log('TaskNotes: Starting early migration check...');
			
			// Initialize saved views (handles migration if needed)
			await this.viewStateManager.initializeSavedViews();
			
			// Perform view state migration if needed (this is silent and fast)
			if (this.viewStateManager.needsMigration()) {
				console.log('TaskNotes: Performing view state migration...');
				await this.viewStateManager.performMigration();
			}
			
			// Check if recurrence migration has already been completed
			if (this.settings.recurrenceMigrated === true) {
				this.migrationComplete = true;
				return;
			}
			
			// Check if recurrence migration is needed
			const needsRecurrenceMigration = await this.migrationService.needsMigration();
			if (!needsRecurrenceMigration) {
				// No migration needed - mark as migrated to prevent future checks
				this.settings.recurrenceMigrated = true;
				await this.saveSettings();
				this.migrationComplete = true;
				return;
			}
			
			// Recurrence migration is needed but will be prompted later
			// For now, just mark that migration check is complete
			this.migrationComplete = true;
			console.log('TaskNotes: Early migration check complete. Will show prompts after UI initialization.');
			
		} catch (error) {
			console.error('Error during early migration check:', error);
			// Don't fail the entire plugin load due to migration check issues
			this.migrationComplete = true;
		}
	}
	
	/**
	 * Show migration prompts after UI is ready (only if needed)
	 */
	private async showMigrationPromptsIfNeeded(): Promise<void> {
		try {
			// Check if recurrence migration has already been completed or dismissed this session
			if (this.settings.recurrenceMigrated === true) {
				return;
			}
			
			// Check if migration is needed
			const needsMigration = await this.migrationService.needsMigration();
			if (needsMigration) {
				// Show migration prompt after a small delay to ensure UI is ready
				setTimeout(() => {
					showMigrationPrompt(this.app, this.migrationService);
				}, 1000);
			}
		} catch (error) {
			console.error('Error showing migration prompts:', error);
		}
	}
	
	/**
	 * Public method for views to wait for migration completion
	 */
	async waitForMigration(): Promise<void> {
		if (this.migrationPromise) {
			await this.migrationPromise;
		}
		
		// Additional safety check - wait until migration is marked complete
		while (!this.migrationComplete) {
			await new Promise(resolve => setTimeout(resolve, 50));
		}
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
	notifyDataChanged(filePath?: string, force = false, triggerRefresh = true): void {
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
		
		// Clean up status bar service
		if (this.statusBarService) {
			this.statusBarService.destroy();
		}
		
		// Clean up notification service
		if (this.notificationService) {
			this.notificationService.destroy();
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
			this.emitter.offref(this.taskUpdateListenerForEditor);
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
			// Deep merge task creation defaults to ensure new fields get default values
			taskCreationDefaults: {
				...DEFAULT_SETTINGS.taskCreationDefaults,
				...(loadedData?.taskCreationDefaults || {})
			},
			// Deep merge calendar view settings to ensure new fields get default values
			calendarViewSettings: {
				...DEFAULT_SETTINGS.calendarViewSettings,
				...(loadedData?.calendarViewSettings || {})
			},
			// Deep merge ICS integration settings to ensure new fields get default values
			icsIntegration: {
				...DEFAULT_SETTINGS.icsIntegration,
				...(loadedData?.icsIntegration || {})
			},
			// Array handling - maintain existing arrays or use defaults
			customStatuses: loadedData?.customStatuses || DEFAULT_SETTINGS.customStatuses,
			customPriorities: loadedData?.customPriorities || DEFAULT_SETTINGS.customPriorities,
			savedViews: loadedData?.savedViews || DEFAULT_SETTINGS.savedViews
		};
		
		// Check if we added any new field mappings or calendar settings and save if needed
		const hasNewFields = Object.keys(DEFAULT_SETTINGS.fieldMapping).some(key => 
			!(loadedData?.fieldMapping?.[key])
		);
		const hasNewCalendarSettings = Object.keys(DEFAULT_SETTINGS.calendarViewSettings).some(key => 
			!(loadedData?.calendarViewSettings?.[key as keyof typeof DEFAULT_SETTINGS.calendarViewSettings])
		);
		
		if (hasNewFields || hasNewCalendarSettings) {
			// Save the migrated settings to include new field mappings (non-blocking)
			setTimeout(async () => {
				try {
					const data = await this.loadData() || {};
					// Merge only settings properties, preserving non-settings data
					const settingsKeys = Object.keys(DEFAULT_SETTINGS) as (keyof TaskNotesSettings)[];
					for (const key of settingsKeys) {
						data[key] = this.settings[key];
					}
					await this.saveData(data);
				} catch (error) {
					console.error('Failed to save migrated settings:', error);
				}
			}, 100);
		}
		
		// Cache setting migration is no longer needed (native cache only)
		
		// Capture initial cache settings for change detection
		this.updatePreviousCacheSettings();
	}

	async saveSettings() {
		// Load existing plugin data to preserve non-settings data like pomodoroHistory
		const data = await this.loadData() || {};
		// Merge only settings properties, preserving non-settings data
		const settingsKeys = Object.keys(DEFAULT_SETTINGS) as (keyof TaskNotesSettings)[];
		for (const key of settingsKeys) {
			data[key] = this.settings[key];
		}
		await this.saveData(data);
		
		// Check if cache-related settings have changed
		const cacheSettingsChanged = this.haveCacheSettingsChanged();
		
		// Check if time tracking settings have changed
		const timeTrackingSettingsChanged = this.haveTimeTrackingSettingsChanged();
		
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
		
		// Only update cache manager if cache-related settings actually changed
		if (cacheSettingsChanged) {
			console.debug('Cache-related settings changed, updating cache configuration');
			this.cacheManager.updateConfig(
				this.settings.taskTag,
				this.settings.excludedFolders,
				this.fieldMapper,
				this.settings.disableNoteIndexing,
				this.settings.storeTitleInFilename
			);
			
			// Update our tracking of cache settings
			this.updatePreviousCacheSettings();
		}
		
		// Update custom styles
		this.injectCustomStyles();
		
		// Note: Event listeners are automatically cleaned up and re-registered by this.register()
		// when settings change, so we just need to set them up again
		if (timeTrackingSettingsChanged) {
			this.setupTimeTrackingEventListeners();
		}
		
		// Update status bar service visibility
		if (this.statusBarService) {
			this.statusBarService.updateVisibility();
		}
		
		// If settings have changed, notify views to refresh their data
		this.notifyDataChanged();
		
		// Emit settings-changed event for specific settings updates
		this.emitter.trigger('settings-changed', this.settings);
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
			editorCallback: async (editor: Editor) => {
				await this.convertTaskToTaskNote(editor);
			}
		});

		this.addCommand({
			id: 'batch-convert-all-tasks',
			name: 'Convert all tasks in note',
			editorCallback: async (editor: Editor) => {
				await this.batchConvertAllTasks(editor);
			}
		});

		this.addCommand({
			id: 'insert-tasknote-link',
			name: 'Insert tasknote link',
			editorCallback: (editor: Editor) => {
				this.insertTaskNoteLink(editor);
			}
		});

		this.addCommand({
			id: 'quick-actions-current-task',
			name: 'Quick actions for current task',
			callback: async () => {
				await this.openQuickActionsForCurrentTask();
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
			name: 'Refresh cache',
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
			const moment = (window as Window & { moment: (date: Date) => any }).moment(date);
			
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
					// Note: Cache rebuilding happens automatically on data change notification
					
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

	async updateTaskProperty(task: TaskInfo, property: keyof TaskInfo, value: TaskInfo[keyof TaskInfo], options: { silent?: boolean } = {}): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.updateProperty(task, property, value, options);
			
			// Provide user feedback unless silent
			if (!options.silent) {
				if (property === 'status') {
					const statusValue = typeof value === 'string' ? value : String(value);
					const statusConfig = this.statusManager.getStatusConfig(statusValue);
					new Notice(`Task marked as '${statusConfig?.label || statusValue}'`);
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
			const dateStr = formatDateForStorage(targetDate);
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
		new TaskCreationModal(this.app, this, { prePopulatedValues }).open();
	}

	/**
	 * Apply a filter to show subtasks of a project
	 */
	async applyProjectSubtaskFilter(projectTask: TaskInfo): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(projectTask.path);
			if (!file) {
				new Notice('Project file not found');
				return;
			}

			// Get the current active view that has a FilterBar
			const activeView = this.app.workspace.getActiveViewOfType(TaskListView) ||
				this.app.workspace.getActiveViewOfType(KanbanView) ||
				this.app.workspace.getActiveViewOfType(AgendaView);

			if (!activeView || !('filterBar' in activeView)) {
				new Notice('No compatible view active to apply filter');
				return;
			}

			const filterBar = (activeView as any).filterBar;
			if (!filterBar) {
				new Notice('Filter bar not available');
				return;
			}

			// Use the same pattern as the search box - add a condition to the current query
			this.addProjectCondition(filterBar, (file as TFile).basename);
			
			new Notice(`Filtered to show subtasks of: ${projectTask.title}`);
		} catch (error) {
			console.error('Error applying project subtask filter:', error);
			new Notice('Failed to apply project filter');
		}
	}

	/**
	 * Add a project filter condition to the FilterBar with proper grouping
	 * Uses the same pattern as search to ensure correct AND/OR logic
	 */
	private addProjectCondition(filterBar: any, projectName: string): void {
		// Remove existing project conditions first
		this.removeProjectConditions(filterBar);
		
		// Defensive check: ensure children array exists
		if (!Array.isArray(filterBar.currentQuery.children)) {
			filterBar.currentQuery.children = [];
		}
		
		// Create condition for wikilink format [[Project Name]]
		const projectCondition = {
			type: 'condition',
			id: `project_${this.generateFilterId()}`,
			property: 'projects',
			operator: 'contains',
			value: `[[${projectName}]]`
		};

		// Get existing non-project filters
		const existingFilters = filterBar.currentQuery.children.filter((child: any) => {
			return !(child.type === 'condition' && 
					child.property === 'projects' && 
					child.operator === 'contains' && 
					child.id.startsWith('project_'));
		});

		if (existingFilters.length === 0) {
			// No existing filters, just add the project condition
			filterBar.currentQuery.children = [projectCondition];
		} else {
			// Create a group containing all existing filters
			const existingFiltersGroup = {
				type: 'group',
				id: this.generateFilterId(),
				conjunction: filterBar.currentQuery.conjunction, // Preserve the current conjunction
				children: existingFilters
			};

			// Replace query children with the project condition AND the existing filters group
			filterBar.currentQuery.children = [projectCondition, existingFiltersGroup];
			filterBar.currentQuery.conjunction = 'and'; // Connect project with existing filters using AND
		}
		
		// Update the filter bar UI and emit changes
		filterBar.updateFilterBuilder();
		filterBar.emit('queryChange', filterBar.currentQuery);
	}

	/**
	 * Remove existing project filter conditions
	 */
	private removeProjectConditions(filterBar: any): void {
		if (!Array.isArray(filterBar.currentQuery.children)) {
			filterBar.currentQuery.children = [];
			return;
		}
		
		filterBar.currentQuery.children = filterBar.currentQuery.children.filter((child: any) => {
			if (child.type === 'condition') {
				return !(child.property === 'projects' && child.operator === 'contains' && 
						child.id.startsWith('project_'));
			}
			return true;
		});
	}

	/**
	 * Generate a unique filter ID
	 */
	private generateFilterId(): string {
		return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}



	
	/**
	 * Starts a time tracking session for a task
	 */
	async startTimeTracking(task: TaskInfo, description?: string): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.startTimeTracking(task);
			new Notice('Time tracking started');
			
			// Update status bar after a small delay to ensure task state is persisted
			if (this.statusBarService) {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 50);
			}
			
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
			
			// Update status bar after a small delay to ensure task state is persisted
			if (this.statusBarService) {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 50);
			}
			
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
		const dateStr = formatDateForStorage(date);
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
		// With native cache, task data is always current - no need to refetch
		new TaskEditModal(this.app, this, { task }).open();
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
	async convertTaskToTaskNote(editor: Editor): Promise<void> {
		try {
			const cursor = editor.getCursor();
			
			// Check if instant convert service is available
			if (!this.instantTaskConvertService) {
				new Notice('Task conversion service not available. Please try again.');
				return;
			}
			
			// Use the instant convert service for immediate conversion without modal
			await this.instantTaskConvertService.instantConvertTask(editor, cursor.line);
			
		} catch (error) {
			console.error('Error converting task:', error);
			new Notice('Failed to convert task. Please try again.');
		}
	}

	/**
	 * Batch convert all checkbox tasks in the current note to TaskNotes
	 */
	async batchConvertAllTasks(editor: Editor): Promise<void> {
		try {
			// Check if instant convert service is available
			if (!this.instantTaskConvertService) {
				new Notice('Task conversion service not available. Please try again.');
				return;
			}
			
			// Use the instant convert service for batch conversion
			await this.instantTaskConvertService.batchConvertAllTasks(editor);
			
		} catch (error) {
			console.error('Error batch converting tasks:', error);
			new Notice('Failed to batch convert tasks. Please try again.');
		}
	}

	/**
	 * Insert a wikilink to a selected tasknote at the current cursor position
	 */
	async insertTaskNoteLink(editor: Editor): Promise<void> {
		try {
			// Get all tasks
			const allTasks = await this.cacheManager.getAllTasks();
			const unarchivedTasks = allTasks.filter(task => !task.archived);
			
			// Open task selector modal
			const modal = new TaskSelectorModal(this.app, this, unarchivedTasks, (selectedTask) => {
				if (selectedTask) {
					// Create link using Obsidian's generateMarkdownLink (respects user's link format settings)
					const file = this.app.vault.getAbstractFileByPath(selectedTask.path);
					if (file) {
						const currentFile = this.app.workspace.getActiveFile();
						const sourcePath = currentFile?.path || '';
						const properLink = this.app.fileManager.generateMarkdownLink(
							file as TFile, 
							sourcePath, 
							'', 
							selectedTask.title  // Use task title as alias
						);
						
						// Insert at cursor position
						const cursor = editor.getCursor();
						editor.replaceRange(properLink, cursor);
						
						// Move cursor to end of inserted text
						const newCursor = {
							line: cursor.line,
							ch: cursor.ch + properLink.length
						};
						editor.setCursor(newCursor);
					} else {
						new Notice('Failed to create link - file not found');
					}
				}
			});
			
			modal.open();
		} catch (error) {
			console.error('Error inserting tasknote link:', error);
			new Notice('Failed to insert tasknote link');
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

	/**
	 * Open Quick Actions for the currently active TaskNote
	 */
	async openQuickActionsForCurrentTask(): Promise<void> {
		try {
			// Get currently active file
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('No file is currently open');
				return;
			}

			// Check if it's a TaskNote
			const taskInfo = await this.cacheManager.getTaskInfo(activeFile.path);
			if (!taskInfo) {
				new Notice('Current file is not a TaskNote');
				return;
			}

			// Open TaskActionPaletteModal with detected task
			const { TaskActionPaletteModal } = await import('./modals/TaskActionPaletteModal');
			const modal = new TaskActionPaletteModal(this.app, taskInfo, this, this.selectedDate);
			modal.open();

		} catch (error) {
			console.error('Error opening quick actions:', error);
			new Notice('Failed to open quick actions');
		}
	}

	/**
	 * Check if cache-related settings have changed since last save
	 */
	private haveCacheSettingsChanged(): boolean {
		if (!this.previousCacheSettings) {
			return true; // First time, assume changed
		}

		const current = {
			taskTag: this.settings.taskTag,
			excludedFolders: this.settings.excludedFolders,
			disableNoteIndexing: this.settings.disableNoteIndexing,
			storeTitleInFilename: this.settings.storeTitleInFilename,
			fieldMapping: this.settings.fieldMapping
		};

		return (
			current.taskTag !== this.previousCacheSettings.taskTag ||
			current.excludedFolders !== this.previousCacheSettings.excludedFolders ||
			current.disableNoteIndexing !== this.previousCacheSettings.disableNoteIndexing ||
			current.storeTitleInFilename !== this.previousCacheSettings.storeTitleInFilename ||
			JSON.stringify(current.fieldMapping) !== JSON.stringify(this.previousCacheSettings.fieldMapping)
		);
	}

	/**
	 * Update tracking of cache-related settings
	 */
	private updatePreviousCacheSettings(): void {
		this.previousCacheSettings = {
			taskTag: this.settings.taskTag,
			excludedFolders: this.settings.excludedFolders,
			disableNoteIndexing: this.settings.disableNoteIndexing,
			storeTitleInFilename: this.settings.storeTitleInFilename,
			fieldMapping: JSON.parse(JSON.stringify(this.settings.fieldMapping)) // Deep copy
		};
	}

}
