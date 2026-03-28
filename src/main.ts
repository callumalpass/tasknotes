/* eslint-disable no-console */
import {
	Notice,
	Plugin,
	WorkspaceLeaf,
	Editor,
	MarkdownView,
	TFile,
	Platform,
	Command,
	Hotkey,
	getLanguage,
	normalizePath,
} from "obsidian";
import { format } from "date-fns";
import {
	createDailyNote,
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import { TaskNotesSettings } from "./types/settings";
import { DEFAULT_SETTINGS } from "./settings/defaults";
import { TaskNotesSettingTab } from "./settings/TaskNotesSettingTab";
import { generateBasesFileTemplate } from "./templates/defaultBasesFiles";
import {
	MINI_CALENDAR_VIEW_TYPE,
	AGENDA_VIEW_TYPE,
	POMODORO_VIEW_TYPE,
	POMODORO_STATS_VIEW_TYPE,
	STATS_VIEW_TYPE,
	TaskInfo,
	EVENT_DATA_CHANGED,
	EVENT_TASK_UPDATED,
	EVENT_DATE_CHANGED,
} from "./types";

import { TaskCreationModal } from "./modals/TaskCreationModal";
import { TaskEditModal } from "./modals/TaskEditModal";
import { openTaskSelector } from "./modals/TaskSelectorWithCreateModal";
import { TimeEntryEditorModal } from "./modals/TimeEntryEditorModal";
import { PomodoroService } from "./services/PomodoroService";
import { formatTime, getActiveTimeEntry } from "./utils/helpers";
import { convertUTCToLocalCalendarDate, getCurrentTimestamp } from "./utils/dateUtils";
import { TaskManager } from "./utils/TaskManager";
import { DependencyCache } from "./utils/DependencyCache";
import { RequestDeduplicator, PredictivePrefetcher } from "./utils/RequestDeduplicator";
import { DOMReconciler, UIStateManager } from "./utils/DOMReconciler";
import { perfMonitor } from "./utils/PerformanceMonitor";
import { FieldMapper } from "./services/FieldMapper";
import { StatusManager } from "./services/StatusManager";
import { PriorityManager } from "./services/PriorityManager";
import { TaskService } from "./services/TaskService";
import { FilterService } from "./services/FilterService";
import { TaskStatsService } from "./services/TaskStatsService";
import { ViewPerformanceService } from "./services/ViewPerformanceService";
import { AutoArchiveService } from "./services/AutoArchiveService";
import { ViewStateManager } from "./services/ViewStateManager";
import { DragDropManager } from "./utils/DragDropManager";
import {
	formatDateForStorage,
	createUTCDateFromLocalCalendarDate,
	parseDateToLocal,
	getTodayLocal,
} from "./utils/dateUtils";
import { ICSSubscriptionService } from "./services/ICSSubscriptionService";
import { ICSNoteService } from "./services/ICSNoteService";
import { StatusBarService } from "./services/StatusBarService";
import { ProjectSubtasksService } from "./services/ProjectSubtasksService";
import { ExpandedProjectsService } from "./services/ExpandedProjectsService";
import { NotificationService } from "./services/NotificationService";
import { AutoExportService } from "./services/AutoExportService";
// Type-only import for HTTPAPIService (actual import is dynamic on desktop only)
import type { HTTPAPIService } from "./services/HTTPAPIService";
import { createI18nService, I18nService, TranslationKey } from "./i18n";
import { RELEASE_NOTES_VIEW_TYPE } from "./views/ReleaseNotesView";
import { OAuthService } from "./services/OAuthService";
import { GoogleCalendarService } from "./services/GoogleCalendarService";
import { MicrosoftCalendarService } from "./services/MicrosoftCalendarService";
import { CalendarProviderRegistry } from "./services/CalendarProvider";
import { TaskCalendarSyncService } from "./services/TaskCalendarSyncService";
import {
	initializeAfterLayoutReady,
	initializeCalendarProviders,
	initializeCoreServices,
	registerBasesIntegration,
	registerRibbonIcons,
	registerTaskNotesIcon,
} from "./bootstrap/pluginBootstrap";
import { registerCliHandlers } from "./cli/registerCliHandlers";

interface TranslatedCommandDefinition {
	id: string;
	nameKey: TranslationKey;
	callback?: () => void | Promise<void>;
	editorCallback?: (editor: Editor, view: MarkdownView) => void | Promise<void>;
	checkCallback?: (checking: boolean) => boolean | void;
	hotkeys?: Hotkey[];
}

// Type definitions for better type safety
interface TaskUpdateEventData {
	path?: string;
	originalTask?: TaskInfo;
	updatedTask?: TaskInfo;
}

export default class TaskNotesPlugin extends Plugin {
	settings: TaskNotesSettings;
	i18n: I18nService;

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

	// Date change detection for refreshing task states at midnight
	private lastKnownDate: string = new Date().toDateString();
	private dateCheckInterval: number;
	private midnightTimeout: number;

	// Ready promise to signal when initialization is complete
	private readyPromise: Promise<void>;
	private resolveReady: () => void;

	// Task manager for just-in-time task lookups (also handles events)
	cacheManager: TaskManager;
	emitter: TaskManager;

	// Dependency cache for relationships that need indexing
	dependencyCache: DependencyCache;

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
	taskStatsService: TaskStatsService;
	viewStateManager: ViewStateManager;
	projectSubtasksService: ProjectSubtasksService;
	expandedProjectsService: ExpandedProjectsService;
	autoArchiveService: AutoArchiveService;
	viewPerformanceService: ViewPerformanceService;

	// Task selection service for batch operations
	taskSelectionService: import("./services/TaskSelectionService").TaskSelectionService;

	// Editor services
	taskLinkDetectionService?: import("./services/TaskLinkDetectionService").TaskLinkDetectionService;
	instantTaskConvertService?: import("./services/InstantTaskConvertService").InstantTaskConvertService;

	// Drag and drop manager
	dragDropManager: DragDropManager;

	// ICS subscription service
	icsSubscriptionService: ICSSubscriptionService;

	// ICS note service for creating notes/tasks from ICS events
	icsNoteService: ICSNoteService;

	// Auto export service for continuous ICS export
	autoExportService: AutoExportService;

	// Status bar service
	statusBarService: StatusBarService;

	// Notification service
	notificationService: NotificationService;

	// HTTP API service
	apiService?: HTTPAPIService;

	// OAuth service
	oauthService: OAuthService;

	// Google Calendar service
	googleCalendarService: GoogleCalendarService;

	// Microsoft Calendar service
	microsoftCalendarService: MicrosoftCalendarService;

	// Calendar provider registry for abstraction
	calendarProviderRegistry: CalendarProviderRegistry;

	// Task-to-Google Calendar sync service
	taskCalendarSyncService: TaskCalendarSyncService;

	// mdbase-spec generation service
	mdbaseSpecService: import("./services/MdbaseSpecService").MdbaseSpecService;

	// Bases filter converter for exporting saved views
	basesFilterConverter: import("./services/BasesFilterConverter").BasesFilterConverter;

	// Command localization support
	private commandDefinitions: TranslatedCommandDefinition[] = [];
	private registeredCommands = new Map<string, string>();

	// Event listener cleanup
	taskUpdateListenerForEditor: import("obsidian").EventRef | null = null;
	private autoStopTimeTrackingListener: import("obsidian").EventRef | null = null;
	relationshipsReadingModeCleanup: (() => void) | null = null;
	taskCardReadingModeCleanup: (() => void) | null = null;

	// Initialization guard to prevent duplicate initialization
	initializationComplete = false;

	// Migration state management
	private migrationComplete = false;
	private migrationPromise: Promise<void> | null = null;

	// Bases registration state management
	basesRegistered = false;

	/**
	 * Get the system UI locale with proper priority order for TaskNotes plugin.
	 *
	 * Priority order for "System default" language setting:
	 * 1. Obsidian's configured language (what users expect for plugin behavior)
	 * 2. Browser/system locale (fallback if Obsidian language unavailable)
	 * 3. English (ultimate fallback)
	 *
	 * This ensures that when users select "System default", TaskNotes respects
	 * their Obsidian language setting first, which is the most intuitive behavior
	 * for an Obsidian plugin.
	 */
	private getSystemUILocale(): string {
		// Priority 1: Get Obsidian's configured language (this is what users expect!)
		try {
			const obsidianLanguage = getLanguage();
			if (obsidianLanguage) {
				return obsidianLanguage;
			}
		} catch (error) {
			// Silently continue to next attempt if getLanguage() fails
		}

		// Priority 2: Fall back to browser/system locale
		if (typeof navigator !== "undefined" && navigator.language) {
			return navigator.language;
		}

		// Priority 3: Ultimate fallback
		return "en";
	}

	private refreshLocalizedViews(): void {
		// Views source their labels via getDisplayText; they'll pick up translations on next refresh.
		// For now we don't force-refresh to avoid disrupting the workspace layout.
	}

	async onload() {
		// Create the promise and store its resolver
		this.readyPromise = new Promise((resolve) => {
			this.resolveReady = resolve;
		});

		await this.loadSettings();

		this.i18n = createI18nService({
			initialLocale: this.settings.uiLanguage ?? "system",
			getSystemLocale: () => this.getSystemUILocale(),
		});

		this.i18n.on("locale-changed", ({ current }) => {
			if (!this.initializationComplete) {
				return;
			}
			const languageLabel = this.i18n.getNativeLanguageName(current);
			new Notice(this.i18n.translate("notices.languageChanged", { language: languageLabel }));
			this.refreshLocalizedViews();
			this.refreshCommandTranslations();
		});

		registerTaskNotesIcon();
		await initializeCoreServices(this);
		registerRibbonIcons(this);

		// Add commands
		this.addCommands();
		registerCliHandlers(this);

		// Add settings tab
		this.addSettingTab(new TaskNotesSettingTab(this.app, this));

		// Start migration check early (before views can be opened)
		this.migrationPromise = this.performEarlyMigrationCheck();

		initializeCalendarProviders(this);
		await registerBasesIntegration(this);

		// Defer expensive initialization until layout is ready
		this.app.workspace.onLayoutReady(() => {
			this.initializeAfterLayoutReady();
		});

		// At the very end of onload, resolve the promise to signal readiness
		this.resolveReady();
	}

	/**
	 * Initialize HTTP API service (desktop only)
	 */
	async initializeAfterLayoutReady(): Promise<void> {
		await initializeAfterLayoutReady(this);
	}

	/**
	 * Initialize heavy services lazily in the background
	 */
	initializeServicesLazily(): void {
		import("./bootstrap/pluginBootstrap").then(({ initializeServicesLazily }) => {
			initializeServicesLazily(this);
		});
	}

	/**
	 * Warm up TaskManager indexes for better performance
	 */
	async warmupProjectIndexes(): Promise<void> {
		try {
			// Simple approach: just trigger the lazy index building once
			// This is much more efficient than processing individual files
			const warmupStartTime = Date.now();

			// Trigger index building with a single call - this will process all files internally
			this.cacheManager.getTasksForDate(new Date().toISOString().split("T")[0]);

			const duration = Date.now() - warmupStartTime;
			// Only log slow warmup for debugging large vaults
			if (duration > 2000) {
				// eslint-disable-next-line no-console
				console.log(`[TaskNotes] Project indexes warmed up in ${duration}ms`);
			}
		} catch (error) {
			console.error("[TaskNotes] Error during project index warmup:", error);
		}
	}

	/**
	 * Public method for views to wait for readiness
	 */
	async onReady(): Promise<void> {
		// If readyPromise doesn't exist, plugin hasn't started onload yet
		if (!this.readyPromise) {
			throw new Error("Plugin not yet initialized");
		}

		await this.readyPromise;
	}

	/**
	 * Set up event listeners for status bar updates
	 */
	setupStatusBarEventListeners(): void {
		if (!this.statusBarService) {
			return;
		}

		// Listen for task updates that might affect time tracking
		this.registerEvent(
			this.emitter.on(EVENT_TASK_UPDATED, () => {
				// Small delay to ensure task state changes are fully propagated
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			})
		);

		// Listen for general data changes
		this.registerEvent(
			this.emitter.on(EVENT_DATA_CHANGED, () => {
				// Small delay to ensure data changes are fully propagated
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			})
		);

		// Listen for Pomodoro events if Pomodoro service is available
		if (this.pomodoroService) {
			// Listen for Pomodoro start events
			this.registerEvent(
				this.emitter.on("pomodoro-start", () => {
					setTimeout(() => {
						this.statusBarService.requestUpdate();
					}, 100);
				})
			);

			// Listen for Pomodoro stop events
			this.registerEvent(
				this.emitter.on("pomodoro-stop", () => {
					setTimeout(() => {
						this.statusBarService.requestUpdate();
					}, 100);
				})
			);

			// Listen for Pomodoro state changes
			this.registerEvent(
				this.emitter.on("pomodoro-state-changed", () => {
					setTimeout(() => {
						this.statusBarService.requestUpdate();
					}, 100);
				})
			);
		}
	}

	/**
	 * Set up time tracking event listeners based on settings
	 */
	setupTimeTrackingEventListeners(): void {
		// Clear existing listener to avoid duplicate handlers across settings reloads/changes
		if (this.autoStopTimeTrackingListener) {
			this.emitter.offref(this.autoStopTimeTrackingListener);
			this.autoStopTimeTrackingListener = null;
		}

		// Only set up listener if auto-stop is enabled
		if (this.settings.autoStopTimeTrackingOnComplete) {
			this.autoStopTimeTrackingListener = this.emitter.on(
				EVENT_TASK_UPDATED,
				async (data: TaskUpdateEventData) => {
					await this.handleAutoStopTimeTracking(data);
				}
			);
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

		// Check if task was just completed
		let wasJustCompleted = false;

		// For non-recurring tasks: check if status changed from non-completed to completed
		const wasCompleted = this.statusManager.isCompletedStatus(originalTask.status);
		const isNowCompleted = this.statusManager.isCompletedStatus(updatedTask.status);
		if (!wasCompleted && isNowCompleted) {
			wasJustCompleted = true;
		}

		// For recurring tasks: check if a new instance was completed (complete_instances grew)
		if (updatedTask.recurrence) {
			const originalInstances = originalTask.complete_instances || [];
			const updatedInstances = updatedTask.complete_instances || [];
			if (updatedInstances.length > originalInstances.length) {
				wasJustCompleted = true;
			}
		}

		if (wasJustCompleted) {
			// Task was just marked as completed - check if it has active time tracking
			const activeSession = this.getActiveTimeSession(updatedTask);
			if (activeSession) {
				try {
					await this.stopTimeTracking(updatedTask);

					// Show notification if enabled
					if (this.settings.autoStopTimeTrackingNotification) {
						new Notice(`Auto-stopped time tracking for: ${updatedTask.title}`);
					}

					console.log(
						`Auto-stopped time tracking for completed task: ${updatedTask.title}`
					);
				} catch (error) {
					console.error("Error auto-stopping time tracking:", error);
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

		return (
			this.settings.autoStopTimeTrackingOnComplete !==
			this.previousTimeTrackingSettings.autoStopTimeTrackingOnComplete
		);
	}

	/**
	 * Update tracking of time tracking settings
	 */
	private updatePreviousTimeTrackingSettings(): void {
		this.previousTimeTrackingSettings = {
			autoStopTimeTrackingOnComplete: this.settings.autoStopTimeTrackingOnComplete,
		};
	}

	/**
	 * Perform early migration check and state preparation
	 * This runs before any views can be opened to prevent race conditions
	 */
	private async performEarlyMigrationCheck(): Promise<void> {
		try {
			console.log("TaskNotes: Starting early migration check...");

			// Initialize saved views (handles migration if needed)
			await this.viewStateManager.initializeSavedViews();

			// Perform view state migration if needed (this is silent and fast)
			if (this.viewStateManager.needsMigration()) {
				console.log("TaskNotes: Performing view state migration...");
				await this.viewStateManager.performMigration();
			}

			// Migration check complete
			this.migrationComplete = true;
		} catch (error) {
			console.error("Error during early migration check:", error);
			// Don't fail the entire plugin load due to migration check issues
			this.migrationComplete = true;
		}
	}

	/**
	 * Check for version updates and show release notes if needed
	 */
	async checkForVersionUpdate(): Promise<void> {
		try {
			const currentVersion = this.manifest.version;
			const lastSeenVersion = this.settings.lastSeenVersion;

			// If this is a new install or version has changed, show release notes (if enabled)
			if (lastSeenVersion && lastSeenVersion !== currentVersion) {
				const showReleaseNotes = this.settings.showReleaseNotesOnUpdate ?? true;
				if (showReleaseNotes) {
					// Show release notes after a delay to ensure UI is ready
					setTimeout(async () => {
						await this.activateReleaseNotesView();
						// Update lastSeenVersion immediately after showing the release notes
						// This ensures they only show once per version
						this.settings.lastSeenVersion = currentVersion;
						await this.saveSettings();
					}, 1500); // Slightly longer delay than migration to avoid conflicts
				} else {
					// Still update lastSeenVersion even if not showing release notes
					this.settings.lastSeenVersion = currentVersion;
					await this.saveSettings();
				}
			}

			// Update lastSeenVersion if it hasn't been set yet (new install)
			if (!lastSeenVersion) {
				this.settings.lastSeenVersion = currentVersion;
				await this.saveSettings();
			}
		} catch (error) {
			console.error("Error checking for version update:", error);
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
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	// Methods for updating shared state and emitting events

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

	/**
	 * Set up date change detection to refresh task states when the date rolls over
	 */
	setupDateChangeDetection(): void {
		// Check for date changes every minute
		const checkDateChange = () => {
			const currentDate = new Date().toDateString();
			if (currentDate !== this.lastKnownDate) {
				this.lastKnownDate = currentDate;
				// Emit date change event to trigger UI refresh
				this.emitter.trigger(EVENT_DATE_CHANGED);
			}
		};

		// Set up regular interval to check for date changes
		this.dateCheckInterval = window.setInterval(checkDateChange, 60000); // Check every minute
		this.registerInterval(this.dateCheckInterval);

		// Schedule precise check at next midnight for better timing
		this.scheduleNextMidnightCheck();
	}

	/**
	 * Schedule a precise check at the next midnight
	 */
	private scheduleNextMidnightCheck(): void {
		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 0, 0); // Next midnight

		const msUntilMidnight = midnight.getTime() - now.getTime();

		// Clear any existing midnight timeout
		if (this.midnightTimeout) {
			window.clearTimeout(this.midnightTimeout);
		}

		this.midnightTimeout = window.setTimeout(() => {
			// Force immediate date change check at midnight
			const currentDate = new Date().toDateString();
			if (currentDate !== this.lastKnownDate) {
				this.lastKnownDate = currentDate;
				this.emitter.trigger(EVENT_DATE_CHANGED);
			}

			// Schedule the next midnight check
			this.scheduleNextMidnightCheck();
		}, msUntilMidnight);

		// Register the timeout for cleanup
		this.registerInterval(this.midnightTimeout);
	}

	onunload() {
		// Unregister Bases views
		if (this.settings?.enableBases) {
			import("./bases/registration").then(({ unregisterBasesViews }) => {
				unregisterBasesViews(this);
				this.basesRegistered = false;
			}).catch(e => {
				console.debug("[TaskNotes][Bases] Unregistration failed:", e);
			});
		}

		// Clean up performance monitoring
		const cacheStats = perfMonitor.getStats("cache-initialization");
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

		// Clean up ViewPerformanceService
		if (this.viewPerformanceService) {
			this.viewPerformanceService.destroy();
		}

		// Clean up task card reading mode handlers
		if (this.taskCardReadingModeCleanup) {
			this.taskCardReadingModeCleanup();
			this.taskCardReadingModeCleanup = null;
		}

		// Clean up relationships reading mode handlers
		if (this.relationshipsReadingModeCleanup) {
			this.relationshipsReadingModeCleanup();
			this.relationshipsReadingModeCleanup = null;
		}

		// Clean up AutoArchiveService
		if (this.autoArchiveService) {
			this.autoArchiveService.stop();
		}

		// Clean up ICS subscription service
		if (this.icsSubscriptionService) {
			this.icsSubscriptionService.destroy();
		}

		// Clean up auto export service
		if (this.autoExportService) {
			this.autoExportService.destroy();
		}

		// Clean up TaskLinkDetectionService
		if (this.taskLinkDetectionService) {
			this.taskLinkDetectionService.cleanup();
		}

		// Clean up drag and drop manager
		if (this.dragDropManager) {
			this.dragDropManager.destroy();
		}

		// Stop HTTP API server
		if (this.apiService) {
			this.apiService.stop();
		}

		// Clean up OAuth service
		if (this.oauthService) {
			this.oauthService.destroy();
		}

		// Clean up task calendar sync service (before calendar services it depends on)
		if (this.taskCalendarSyncService) {
			this.taskCalendarSyncService.destroy();
		}

		// Clean up calendar services
		if (this.googleCalendarService) {
			this.googleCalendarService.destroy();
		}

		if (this.microsoftCalendarService) {
			this.microsoftCalendarService.destroy();
		}

		// Clean up calendar provider registry
		if (this.calendarProviderRegistry) {
			this.calendarProviderRegistry.destroyAll();
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

		// Clean up task manager
		if (this.cacheManager) {
			this.cacheManager.destroy();
		}

		// Clean up dependency cache
		if (this.dependencyCache) {
			this.dependencyCache.destroy();
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
		if (typeof perfMonitor !== "undefined") {
			perfMonitor.destroy();
		}

		// Clean up task update listener for editor
		if (this.taskUpdateListenerForEditor) {
			this.emitter.offref(this.taskUpdateListenerForEditor);
		}

		// Clean up auto-stop time tracking listener
		if (this.autoStopTimeTrackingListener) {
			this.emitter.offref(this.autoStopTimeTrackingListener);
			this.autoStopTimeTrackingListener = null;
		}

		// Clean up the event emitter (native Events class)
		if (this.emitter && typeof this.emitter.off === "function") {
			// Native Events cleanup happens automatically
		}

		// Reset initialization flag for potential reload
		this.initializationComplete = false;
	}

	async loadSettings() {
		const loadedData = await this.loadData();

		// Migration: Remove old useNativeMetadataCache setting if it exists
		if (loadedData && "useNativeMetadataCache" in loadedData) {
			delete loadedData.useNativeMetadataCache;
		}

		// Migration: Add API settings defaults if they don't exist
		if (loadedData && typeof loadedData.enableAPI === "undefined") {
			loadedData.enableAPI = false;
		}
		if (loadedData && typeof loadedData.apiPort === "undefined") {
			loadedData.apiPort = 8080;
		}
		if (loadedData && typeof loadedData.apiAuthToken === "undefined") {
			loadedData.apiAuthToken = "";
		}
		if (loadedData && typeof loadedData.enableMCP === "undefined") {
			loadedData.enableMCP = false;
		}

		// Migration: Migrate statusSuggestionTrigger to nlpTriggers if needed
		if (loadedData && !loadedData.nlpTriggers && loadedData.statusSuggestionTrigger !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { DEFAULT_NLP_TRIGGERS } = require("./settings/defaults");
			loadedData.nlpTriggers = {
				triggers: [...DEFAULT_NLP_TRIGGERS.triggers],
			};
			// Update status trigger if it was customized
			const statusTriggerIndex = loadedData.nlpTriggers.triggers.findIndex(
				(t: any) => t.propertyId === "status"
			);
			if (statusTriggerIndex !== -1 && loadedData.statusSuggestionTrigger) {
				loadedData.nlpTriggers.triggers[statusTriggerIndex].trigger =
					loadedData.statusSuggestionTrigger;
			}
		}

		// Migration: Initialize modal fields configuration if not present
		if (loadedData && !loadedData.modalFieldsConfig) {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { initializeFieldConfig } = require("./utils/fieldConfigDefaults");
			loadedData.modalFieldsConfig = initializeFieldConfig(
				undefined,
				loadedData.userFields
			);
		}

		// Migration: Force enableBases to true (issue #1187)
		// The enableBases toggle was removed in V4 (bases is always-on), but users who
		// had disabled it in pre-V4 still have enableBases: false saved. This prevents
		// view registration and causes "Unknown view types" errors.
		if (loadedData && loadedData.enableBases === false) {
			loadedData.enableBases = true;
		}

		// Deep merge settings with proper migration for nested objects
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData,
			// Deep merge field mapping to ensure new fields get default values
			fieldMapping: {
				...DEFAULT_SETTINGS.fieldMapping,
				...(loadedData?.fieldMapping || {}),
			},
			// Deep merge task creation defaults to ensure new fields get default values
			taskCreationDefaults: {
				...DEFAULT_SETTINGS.taskCreationDefaults,
				...(loadedData?.taskCreationDefaults || {}),
			},
			// Deep merge calendar view settings to ensure new fields get default values
			calendarViewSettings: {
				...DEFAULT_SETTINGS.calendarViewSettings,
				...(loadedData?.calendarViewSettings || {}),
			},
			// Deep merge command file mapping to ensure new commands get defaults
			commandFileMapping: {
				...DEFAULT_SETTINGS.commandFileMapping,
				...(loadedData?.commandFileMapping || {}),
			},
			// Deep merge ICS integration settings to ensure new fields get default values
			icsIntegration: {
				...DEFAULT_SETTINGS.icsIntegration,
				...(loadedData?.icsIntegration || {}),
			},
			// Deep merge NLP triggers to ensure new triggers get defaults
			nlpTriggers: {
				...DEFAULT_SETTINGS.nlpTriggers,
				...(loadedData?.nlpTriggers || {}),
				triggers: loadedData?.nlpTriggers?.triggers || DEFAULT_SETTINGS.nlpTriggers.triggers,
			},
			// Modal fields configuration (already migrated above if needed)
			modalFieldsConfig: loadedData?.modalFieldsConfig,
			// Array handling - maintain existing arrays or use defaults
			customStatuses: loadedData?.customStatuses || DEFAULT_SETTINGS.customStatuses,
			customPriorities: loadedData?.customPriorities || DEFAULT_SETTINGS.customPriorities,
			savedViews: loadedData?.savedViews || DEFAULT_SETTINGS.savedViews,
		};

		// Check if we added any new field mappings or calendar settings and save if needed
		const hasNewFields = Object.keys(DEFAULT_SETTINGS.fieldMapping).some(
			(key) => !loadedData?.fieldMapping?.[key]
		);
		const hasNewCalendarSettings = Object.keys(DEFAULT_SETTINGS.calendarViewSettings).some(
			(key) =>
				!loadedData?.calendarViewSettings?.[
					key as keyof typeof DEFAULT_SETTINGS.calendarViewSettings
				]
		);
		const hasNewCommandMappings = Object.keys(DEFAULT_SETTINGS.commandFileMapping).some(
			(key) => !loadedData?.commandFileMapping?.[key]
		);

		if (hasNewFields || hasNewCalendarSettings || hasNewCommandMappings) {
			// Save the migrated settings to include new field mappings (non-blocking)
			setTimeout(async () => {
				try {
					const data = (await this.loadData()) || {};
					// Merge only settings properties, preserving non-settings data
					const settingsKeys = Object.keys(
						DEFAULT_SETTINGS
					) as (keyof TaskNotesSettings)[];
					for (const key of settingsKeys) {
						data[key] = this.settings[key];
					}
					await this.saveData(data);
				} catch (error) {
					console.error("Failed to save migrated settings:", error);
				}
			}, 100);
		}

		// Cache setting migration is no longer needed (native cache only)

		// Capture initial cache settings for change detection
		this.updatePreviousCacheSettings();
	}

	async saveSettings() {
		await this.saveSettingsDataOnly();

		// Keep runtime webhook state aligned with settings edits while API is running.
		this.apiService?.syncWebhookSettings?.();

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
			console.debug("Cache-related settings changed, updating cache configuration");
			this.cacheManager.updateConfig(this.settings);

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

		// Regenerate mdbase-spec files if the feature is enabled
		this.mdbaseSpecService?.onSettingsChanged();

		// Invalidate filter options cache so new settings (e.g., user fields) appear immediately
		this.filterService?.refreshFilterOptions();

		// If settings have changed, notify views to refresh their data
		this.notifyDataChanged();

		// Emit settings-changed event for specific settings updates
		this.emitter.trigger("settings-changed", this.settings);
	}

	/**
	 * Persist settings to disk without triggering runtime side-effects.
	 * Intended for background/internal updates (e.g., sync token writes).
	 */
	async saveSettingsDataOnly(): Promise<void> {
		// Load existing plugin data to preserve non-settings data like pomodoroHistory
		const data = (await this.loadData()) || {};
		// Merge only settings properties, preserving non-settings data
		const settingsKeys = Object.keys(DEFAULT_SETTINGS) as (keyof TaskNotesSettings)[];
		for (const key of settingsKeys) {
			data[key] = this.settings[key];
		}
		await this.saveData(data);
	}

	async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
		this.apiService?.syncWebhookSettings?.();

		// Update all services with new settings
		this.fieldMapper?.updateMapping(this.settings.fieldMapping);
		this.statusManager?.updateStatuses(this.settings.customStatuses);
		this.priorityManager?.updatePriorities(this.settings.customPriorities);

		// External changes may include cache settings - update unconditionally
		this.cacheManager.updateConfig(this.settings);
		this.updatePreviousCacheSettings();

		// Re-setup time tracking (may have changed)
		this.setupTimeTrackingEventListeners();

		// Update UI
		this.injectCustomStyles();
		this.statusBarService?.updateVisibility();
		this.filterService?.refreshFilterOptions();

		// Notify views
		this.notifyDataChanged();
		this.emitter.trigger("settings-changed", this.settings);
	}

	addCommands() {
		this.commandDefinitions = [
			{
				id: "open-calendar-view",
				nameKey: "commands.openCalendarView",
				callback: async () => {
					await this.activateCalendarView();
				},
			},
			{
				id: "open-advanced-calendar-view",
				nameKey: "commands.openAdvancedCalendarView",
				callback: async () => {
					await this.openBasesFileForCommand('open-advanced-calendar-view');
				},
			},
			{
				id: "open-tasks-view",
				nameKey: "commands.openTasksView",
				callback: async () => {
					await this.openBasesFileForCommand('open-tasks-view');
				},
			},
			{
				id: "open-agenda-view",
				nameKey: "commands.openAgendaView",
				callback: async () => {
					await this.openBasesFileForCommand('open-agenda-view');
				},
			},
			{
				id: "open-pomodoro-view",
				nameKey: "commands.openPomodoroView",
				callback: async () => {
					await this.activatePomodoroView();
				},
			},
			{
				id: "open-kanban-view",
				nameKey: "commands.openKanbanView",
				callback: async () => {
					await this.openBasesFileForCommand('open-kanban-view');
				},
			},
			{
				id: "open-pomodoro-stats",
				nameKey: "commands.openPomodoroStats",
				callback: async () => {
					await this.activatePomodoroStatsView();
				},
			},
			{
				id: "open-statistics",
				nameKey: "commands.openStatisticsView",
				callback: async () => {
					await this.activateStatsView();
				},
			},
			{
				id: "create-new-task",
				nameKey: "commands.createNewTask",
				callback: () => {
					this.openTaskCreationModal();
				},
			},
			{
				id: "convert-current-note-to-task",
				nameKey: "commands.convertCurrentNoteToTask.name",
				callback: async () => {
					await this.convertCurrentNoteToTask();
				},
			},
			{
				id: "convert-to-tasknote",
				nameKey: "commands.convertToTaskNote",
				editorCallback: async (editor: Editor) => {
					await this.convertTaskToTaskNote(editor);
				},
			},
			{
				id: "batch-convert-all-tasks",
				nameKey: "commands.convertAllTasksInNote",
				editorCallback: async (editor: Editor) => {
					await this.batchConvertAllTasks(editor);
				},
			},
			{
				id: "insert-tasknote-link",
				nameKey: "commands.insertTaskNoteLink",
				editorCallback: (editor: Editor) => {
					this.insertTaskNoteLink(editor);
				},
			},
			{
				id: "create-inline-task",
				nameKey: "commands.createInlineTask",
				editorCallback: async (editor: Editor) => {
					await this.createInlineTask(editor);
				},
			},
			{
				id: "quick-actions-current-task",
				nameKey: "commands.quickActionsCurrentTask",
				callback: async () => {
					await this.openQuickActionsForCurrentTask();
				},
			},
			{
				id: "go-to-today",
				nameKey: "commands.goToTodayNote",
				callback: async () => {
					await this.navigateToCurrentDailyNote();
				},
			},
			{
				id: "start-pomodoro",
				nameKey: "commands.startPomodoro",
				callback: async () => {
					const state = this.pomodoroService.getState();
					if (state.currentSession && !state.isRunning) {
						await this.pomodoroService.resumePomodoro();
					} else {
						// No active session - start the type indicated by nextSessionType
						if (state.nextSessionType === "short-break") {
							await this.pomodoroService.startBreak(false);
						} else if (state.nextSessionType === "long-break") {
							await this.pomodoroService.startBreak(true);
						} else {
							// Default to work session
							await this.pomodoroService.startPomodoro();
						}
					}
				},
			},
			{
				id: "stop-pomodoro",
				nameKey: "commands.stopPomodoro",
				callback: async () => {
					await this.pomodoroService.stopPomodoro();
				},
			},
			{
				id: "pause-pomodoro",
				nameKey: "commands.pauseResumePomodoro",
				callback: async () => {
					const state = this.pomodoroService.getState();
					if (state.isRunning) {
						await this.pomodoroService.pausePomodoro();
					} else if (state.currentSession) {
						await this.pomodoroService.resumePomodoro();
					}
				},
			},
			{
				id: "refresh-cache",
				nameKey: "commands.refreshCache",
				callback: async () => {
					await this.refreshCache();
				},
			},
			{
				id: "export-all-tasks-ics",
				nameKey: "commands.exportAllTasksIcs",
				callback: async () => {
					try {
						const allTasks = await this.cacheManager.getAllTasks();
						const { CalendarExportService } = await import(
							"./services/CalendarExportService"
						);
						CalendarExportService.downloadAllTasksICSFile(
							allTasks,
							this.i18n.translate.bind(this.i18n)
						);
					} catch (error) {
						console.error("Error exporting all tasks as ICS:", error);
						new Notice(this.i18n.translate("notices.exportTasksFailed"));
					}
				},
			},
			{
				id: "sync-all-tasks-google-calendar",
				nameKey: "commands.syncAllTasksGoogleCalendar",
				callback: async () => {
					if (!this.taskCalendarSyncService?.isEnabled()) {
						new Notice(this.i18n.translate("settings.integrations.googleCalendarExport.notices.notEnabled"));
						return;
					}
					await this.taskCalendarSyncService.syncAllTasks();
				},
			},
			{
				id: "sync-current-task-google-calendar",
				nameKey: "commands.syncCurrentTaskGoogleCalendar",
				callback: async () => {
					if (!this.taskCalendarSyncService?.isEnabled()) {
						new Notice(this.i18n.translate("settings.integrations.googleCalendarExport.notices.notEnabled"));
						return;
					}
					const activeFile = this.app.workspace.getActiveFile();
					if (!activeFile) {
						new Notice(this.i18n.translate("settings.integrations.googleCalendarExport.notices.noActiveFile"));
						return;
					}
					const task = await this.cacheManager.getTaskInfo(activeFile.path);
					if (!task) {
						new Notice(this.i18n.translate("settings.integrations.googleCalendarExport.notices.notATask"));
						return;
					}
					if (!this.taskCalendarSyncService.shouldSyncTask(task)) {
						new Notice(this.i18n.translate("settings.integrations.googleCalendarExport.notices.noDateToSync"));
						return;
					}
					await this.taskCalendarSyncService.syncTaskToCalendar(task);
					new Notice(this.i18n.translate("settings.integrations.googleCalendarExport.notices.taskSynced"));
				},
			},
			{
				id: "view-release-notes",
				nameKey: "commands.viewReleaseNotes",
				callback: async () => {
					await this.activateReleaseNotesView();
				},
			},
			{
				id: "start-time-tracking-with-selector",
				nameKey: "commands.startTimeTrackingWithSelector",
				callback: async () => {
					await this.openTaskSelectorForTimeTracking();
				},
			},
			{
				id: "edit-time-entries",
				nameKey: "commands.editTimeEntries",
				callback: async () => {
					await this.openTaskSelectorForTimeEntryEditor();
				},
			},
			{
				id: "create-or-open-task",
				nameKey: "commands.createOrOpenTask",
				callback: async () => {
					await this.openTaskSelectorWithCreate();
				},
			},
		];

		this.registerCommands();
	}

	private registerCommands(): void {
		this.registeredCommands.clear();
		for (const definition of this.commandDefinitions) {
			const commandConfig: Command = {
				id: definition.id,
				name: this.i18n.translate(definition.nameKey),
			};
			if (definition.callback) {
				commandConfig.callback = () => {
					void definition.callback?.();
				};
			}
			if (definition.editorCallback) {
				commandConfig.editorCallback = (editor: Editor, view: MarkdownView) => {
					void definition.editorCallback?.(editor, view);
				};
			}
			if (definition.checkCallback) {
				commandConfig.checkCallback = definition.checkCallback;
			}
			if (definition.hotkeys) {
				commandConfig.hotkeys = definition.hotkeys;
			}
			const registered = this.addCommand(commandConfig);
			this.registeredCommands.set(definition.id, registered.id);
		}
	}

	private refreshCommandTranslations(): void {
		if (!this.commandDefinitions.length) {
			return;
		}

		const commandsApi = this.app.commands;
		if (!commandsApi) {
			return;
		}

		const removeCommand = (commandsApi as any).removeCommand as
			| ((id: string) => void)
			| undefined;
		if (typeof removeCommand === "function") {
			for (const fullId of this.registeredCommands.values()) {
				removeCommand.call(commandsApi, fullId);
			}
			this.registerCommands();
			return;
		}

		// Fallback: update names in place if removal API not available
		for (const definition of this.commandDefinitions) {
			const fullId =
				this.registeredCommands.get(definition.id) ??
				`${this.manifest.id}:${definition.id}`;
			const command = (commandsApi as any).commands?.[fullId];
			if (command) {
				command.name = this.i18n.translate(definition.nameKey);
				if (typeof (commandsApi as any).updateCommand === "function") {
					(commandsApi as any).updateCommand(fullId, command);
				}
			}
		}
	}

	private async revealLeafReady(leaf: WorkspaceLeaf): Promise<void> {
		const { workspace } = this.app;
		workspace.setActiveLeaf(leaf, { focus: true });
		await workspace.revealLeaf(leaf);
		if (leaf.isDeferred) {
			await leaf.loadIfDeferred();
		}
	}

	// Helper method to create or activate a view of specific type
	async activateView(viewType: string) {
		const { workspace } = this.app;

		// Use existing view if it exists
		let leaf = this.getLeafOfType(viewType);

		if (!leaf) {
			// Simple approach - create a new tab
			// This is more reliable for tab behavior
			leaf = workspace.getLeaf("tab");

			// Set the view state for this leaf
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
		}

		await this.revealLeafReady(leaf);

		return leaf;
	}

	async activateCalendarView() {
		return this.openBasesFileForCommand('open-calendar-view');
	}

	async activateAgendaView() {
		return this.activateView(AGENDA_VIEW_TYPE);
	}

	async activatePomodoroView() {
		// On mobile, optionally open in sidebar based on user setting
		if (Platform.isMobile && this.settings.pomodoroMobileSidebar !== "tab") {
			const { workspace } = this.app;

			// Check if view already exists
			let leaf = this.getLeafOfType(POMODORO_VIEW_TYPE);

			if (!leaf) {
				// Create in the appropriate sidebar
				const sidebarLeaf =
					this.settings.pomodoroMobileSidebar === "left"
						? workspace.getLeftLeaf(false)
						: workspace.getRightLeaf(false);

				if (sidebarLeaf) {
					leaf = sidebarLeaf;
					await leaf.setViewState({
						type: POMODORO_VIEW_TYPE,
						active: true,
					});
				} else {
					// Fallback to tab if sidebar not available
					return this.activateView(POMODORO_VIEW_TYPE);
				}
			}

			await this.revealLeafReady(leaf);

			return leaf;
		}

		// Desktop or "tab" setting: use standard view activation
		return this.activateView(POMODORO_VIEW_TYPE);
	}

	async activatePomodoroStatsView() {
		return this.activateView(POMODORO_STATS_VIEW_TYPE);
	}

	async activateStatsView() {
		return this.activateView(STATS_VIEW_TYPE);
	}

	async activateReleaseNotesView() {
		return this.activateView(RELEASE_NOTES_VIEW_TYPE);
	}

	/**
	 * Open a .base file for a command, showing an error if the file doesn't exist
	 * v4: Commands now route to Bases files instead of native views
	 */
	async openBasesFileForCommand(commandId: string): Promise<void> {
		const filePath = this.settings.commandFileMapping[commandId];

		if (!filePath) {
			new Notice(`No file configured for command: ${commandId}`);
			return;
		}

		// Normalize the path for Obsidian
		const normalizedPath = normalizePath(filePath);

		// Check if file exists
		const fileExists = await this.app.vault.adapter.exists(normalizedPath);

		if (!fileExists) {
			// Show error - user needs to configure a valid file
			new Notice(
				`File not found: ${normalizedPath}\n\nPlease configure a valid file in Settings → TaskNotes → View Commands, or use the "Create Default Files" button.`,
				10000
			);
			return;
		}

		// Open the .base file
		const file = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (!file) {
			new Notice(`File not found in vault: ${normalizedPath}\n\nThe file exists but Obsidian cannot find it. Try reloading the vault.`);
			return;
		}
		if (!(file instanceof TFile)) {
			new Notice(`Path is not a file: ${normalizedPath}`);
			return;
		}

		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(file);
	}

	/**
	 * Create default .base files in TaskNotes/Views/ directory
	 * Called from settings UI
	 */
	async createDefaultBasesFiles(): Promise<void> {
		const { created, skipped } = await this.ensureBasesViewFiles();

		if (created.length > 0) {
			new Notice(
				`Created ${created.length} default Bases file(s):\n${created.join('\n')}`,
				8000
			);
		}

		if (skipped.length > 0 && created.length === 0) {
			new Notice(
				`Default Bases files already exist:\n${skipped.join('\n')}`,
				8000
			);
		}
	}

	private async ensureFolderHierarchy(folderPath: string): Promise<void> {
		if (!folderPath) {
			return;
		}

		const normalized = normalizePath(folderPath);
		const adapter = this.app.vault.adapter;
		const segments = normalized.split("/").filter((segment) => segment.length > 0);

		if (segments.length === 0) {
			return;
		}

		let currentPath = "";
		for (const segment of segments) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;

			// eslint-disable-next-line no-await-in-loop
			if (await adapter.exists(currentPath)) {
				continue;
			}

			try {
				// eslint-disable-next-line no-await-in-loop
				await this.app.vault.createFolder(currentPath);
			} catch (error) {
				// eslint-disable-next-line no-await-in-loop
				if (!(await adapter.exists(currentPath))) {
					throw error;
				}
			}
		}
	}

	async ensureBasesViewFiles(): Promise<{ created: string[]; skipped: string[] }> {
		const created: string[] = [];
		const skipped: string[] = [];

		try {
			const adapter = this.app.vault.adapter;
			const commandFileMapping = {
				...DEFAULT_SETTINGS.commandFileMapping,
				...(this.settings.commandFileMapping ?? {}),
			};
			this.settings.commandFileMapping = commandFileMapping;
			const entries = Object.entries(commandFileMapping);

			for (const [commandId, rawPath] of entries) {
				if (!rawPath) {
					continue;
				}

				const normalizedPath = normalizePath(rawPath);
				// eslint-disable-next-line no-await-in-loop
				if (await adapter.exists(normalizedPath)) {
					skipped.push(rawPath);
					continue;
				}

				// Generate template with user settings
				const template = generateBasesFileTemplate(commandId, this);
				if (!template) {
					skipped.push(rawPath);
					continue;
				}

				// Only create folder hierarchy if we're actually creating the file
				const lastSlashIndex = normalizedPath.lastIndexOf("/");
				const directory = lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex) : "";

				if (directory) {
					// eslint-disable-next-line no-await-in-loop
					await this.ensureFolderHierarchy(directory);
				}

				// eslint-disable-next-line no-await-in-loop
				await this.app.vault.create(normalizedPath, template);
				created.push(rawPath);
			}
		} catch (error) {
			console.warn("[TaskNotes][Bases] Failed to ensure Bases command files:", error);
		}

		return { created, skipped };
	}

	/**
	 * Open and activate the search pane with a tag query
	 * (Renamed from openSearchPaneWithTag for cleaner API)
	 */
	async openTagsPane(tag: string): Promise<boolean> {
		const { workspace } = this.app;

		try {
			// Try to find existing search view first
			let searchLeaf = workspace.getLeavesOfType("search").first();

			if (!searchLeaf) {
				// Try to create/activate the search view in left sidebar
				const leftLeaf = workspace.getLeftLeaf(false);

				if (!leftLeaf) {
					console.warn("Could not get left leaf for search pane");
					return false;
				}

				try {
					await leftLeaf.setViewState({
						type: "search",
						active: true,
					});
					searchLeaf = leftLeaf;
				} catch (error) {
					console.warn("Failed to create search view:", error);
					return false;
				}
			}

			if (!searchLeaf) {
				console.warn("No search leaf available");
				return false;
			}

			await this.revealLeafReady(searchLeaf);

			// Set the search query to "tag:#tagname"
			const searchQuery = `tag:${tag}`;
			const searchView = searchLeaf.view as any;

			// Try different methods to set the search query based on Obsidian version
			if (typeof searchView.setQuery === "function") {
				// Newer Obsidian versions
				searchView.setQuery(searchQuery);
			} else if (typeof searchView.searchComponent?.setValue === "function") {
				// Alternative method
				searchView.searchComponent.setValue(searchQuery);
			} else if (searchView.searchInputEl) {
				// Fallback: set the input value directly
				searchView.searchInputEl.value = searchQuery;
				// Trigger search if possible
				if (typeof searchView.startSearch === "function") {
					searchView.startSearch();
				}
			} else {
				console.warn("[TaskNotes] Could not find method to set search query");
				new Notice("Search pane opened but could not set tag query");
				return false;
			}

			return true;
		} catch (error) {
			console.error("[TaskNotes] Error opening search pane with tag:", error);
			new Notice(`Failed to open search pane for tag: ${tag}`);
			return false;
		}
	}

	getLeafOfType(viewType: string): WorkspaceLeaf | null {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(viewType);
		return leaves.length > 0 ? leaves[0] : null;
	}

	getCalendarLeaf(): WorkspaceLeaf | null {
		return this.getLeafOfType(MINI_CALENDAR_VIEW_TYPE);
	}

	async navigateToCurrentDailyNote() {
		// Fix for issue #1223: Use getTodayLocal() to get the correct local calendar date
		// instead of new Date() which would be incorrectly converted by convertUTCToLocalCalendarDate()
		const date = getTodayLocal();
		await this.navigateToDailyNote(date, { isAlreadyLocal: true });
	}

	async navigateToDailyNote(date: Date, options?: { isAlreadyLocal?: boolean }) {
		try {
			// Check if Daily Notes plugin is enabled
			if (!appHasDailyNotesPluginLoaded()) {
				new Notice(
					"Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins."
				);
				return;
			}

			// Convert date to moment for the API
			// Fix for issue #857: Convert UTC-anchored date to local calendar date
			// before passing to moment() to ensure correct day is used
			// Fix for issue #1223: Skip conversion if the date is already local (e.g., from getTodayLocal())
			const localDate = options?.isAlreadyLocal ? date : convertUTCToLocalCalendarDate(date);
			const moment = (window as Window & { moment: (date: Date) => any }).moment(localDate);

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
					console.error("Failed to create daily note:", error);
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
			console.error("Failed to navigate to daily note:", error);
			new Notice(`Failed to navigate to daily note: ${errorMessage}`);
		}
	}

	/**
	 * Inject dynamic CSS for custom statuses and priorities
	 */
	injectCustomStyles(): void {
		// Remove existing custom styles
		const existingStyle = document.getElementById("tasknotes-custom-styles");
		if (existingStyle) {
			existingStyle.remove();
		}

		// Generate new styles
		const statusStyles = this.statusManager.getStatusStyles();
		const priorityStyles = this.priorityManager.getPriorityStyles();

		// Create style element
		const styleEl = document.createElement("style");
		styleEl.id = "tasknotes-custom-styles";
		styleEl.textContent = `
		${statusStyles}
		${priorityStyles}
	`;

		// Inject into document head
		document.head.appendChild(styleEl);
	}

	async updateTaskProperty(
		task: TaskInfo,
		property: keyof TaskInfo,
		value: TaskInfo[keyof TaskInfo],
		options: { silent?: boolean } = {}
	): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.updateProperty(
				task,
				property,
				value,
				options
			);

			// Provide user feedback unless silent
			if (!options.silent) {
				if (property === "status") {
					const statusValue = typeof value === "string" ? value : String(value);
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
			// Let TaskService handle the date logic (defaults to local today, not selectedDate)
			const updatedTask = await this.taskService.toggleRecurringTaskComplete(task, date);

			// For notification, determine the actual completion date from the task
			// Use local today if no explicit date provided
			const targetDate =
				date ||
				(() => {
					const todayLocal = getTodayLocal();
					return createUTCDateFromLocalCalendarDate(todayLocal);
				})();

			const dateStr = formatDateForStorage(targetDate);
			const wasCompleted = updatedTask.complete_instances?.includes(dateStr);
			const action = wasCompleted ? "completed" : "marked incomplete";

			// Format date for display: convert UTC-anchored date back to local display
			const displayDate = parseDateToLocal(dateStr);
			new Notice(`Recurring task ${action} for ${format(displayDate, "MMM d")}`);
			return updatedTask;
		} catch (error) {
			console.error("Failed to toggle recurring task completion:", error);
			new Notice("Failed to update recurring task");
			throw error;
		}
	}

	async toggleTaskArchive(task: TaskInfo): Promise<TaskInfo> {
		try {
			const updatedTask = await this.taskService.toggleArchive(task);
			const action = updatedTask.archived ? "archived" : "unarchived";
			new Notice(`Task ${action}`);
			return updatedTask;
		} catch (error) {
			console.error("Failed to toggle task archive:", error);
			new Notice("Failed to update task archive status");
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
			console.error("Failed to toggle task status:", error);
			new Notice("Failed to update task status");
			throw error;
		}
	}

	openTaskCreationModal(prePopulatedValues?: Partial<TaskInfo>) {
		new TaskCreationModal(this.app, this, { prePopulatedValues }).open();
	}

	/**
	 * Convert the current note to a task by adding required task frontmatter.
	 * Opens the task edit modal pre-populated with the note's existing data.
	 */
	async convertCurrentNoteToTask(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice(this.i18n.translate("commands.convertCurrentNoteToTask.noActiveFile"));
			return;
		}

		// Check if this note is already a task
		const existingTask = await this.cacheManager.getTaskInfo(activeFile.path);
		if (existingTask) {
			new Notice(this.i18n.translate("commands.convertCurrentNoteToTask.alreadyTask"));
			return;
		}

		// Read existing frontmatter and body from the file
		const metadata = this.app.metadataCache.getFileCache(activeFile);
		const frontmatter: Record<string, any> = metadata?.frontmatter || {};
		const content = await this.app.vault.read(activeFile);

		// Extract body content (everything after frontmatter)
		let details = "";
		const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n*/);
		if (frontmatterMatch) {
			details = content.slice(frontmatterMatch[0].length).trim();
		} else {
			details = content.trim();
		}

		// Build a TaskInfo object from the note's existing data
		// Use defaults for required fields that don't exist
		// Use ?? (nullish coalescing) to properly handle empty string defaults
		const now = getCurrentTimestamp();
		const taskInfo: TaskInfo = {
			path: activeFile.path,
			title: frontmatter.title || activeFile.basename,
			status: frontmatter.status ?? this.settings.defaultTaskStatus,
			priority: frontmatter.priority ?? this.settings.defaultTaskPriority,
			archived: false,
			due: frontmatter.due || undefined,
			scheduled: frontmatter.scheduled || undefined,
			contexts: frontmatter.contexts
				? (Array.isArray(frontmatter.contexts) ? frontmatter.contexts : [frontmatter.contexts])
				: undefined,
			projects: frontmatter.projects
				? (Array.isArray(frontmatter.projects) ? frontmatter.projects : [frontmatter.projects])
				: undefined,
			tags: frontmatter.tags
				? (Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags])
				: [],
			timeEstimate: frontmatter.timeEstimate || undefined,
			recurrence: frontmatter.recurrence || undefined,
			dateCreated: frontmatter.dateCreated || now,
			dateModified: now,
			details: details,
		};

		// Open the task edit modal with the constructed TaskInfo
		new TaskEditModal(this.app, this, {
			task: taskInfo,
			onTaskUpdated: (updatedTask) => {
				new Notice(
					this.i18n.translate("commands.convertCurrentNoteToTask.success", {
						title: updatedTask.title,
					})
				);
			},
		}).open();
	}

	/**
	 * Open the task selector with create modal.
	 * This modal allows users to either select an existing task or create a new one via NLP.
	 */
	async openTaskSelectorWithCreate(): Promise<void> {
		const { openTaskSelectorWithCreate } = await import("./modals/TaskSelectorWithCreateModal");
		const result = await openTaskSelectorWithCreate(this);

		if (result.type === "selected" || result.type === "created") {
			// Open the selected/created task
			const file = this.app.vault.getAbstractFileByPath(result.task.path);
			if (file instanceof TFile) {
				await this.app.workspace.getLeaf(false).openFile(file);
			}
		}
	}

	/**
	 * Apply a filter to show subtasks of a project
	 */
	async applyProjectSubtaskFilter(projectTask: TaskInfo): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(projectTask.path);
			if (!file) {
				new Notice("Project file not found");
				return;
			}

			// Note: This feature was part of the old view system (deprecated in v4)
			// TODO: Re-implement for Bases views if needed
			new Notice("Project subtask filtering not available");
		} catch (error) {
			console.error("Error applying project subtask filter:", error);
			new Notice("Failed to apply project filter");
		}
	}

	/**
	 * Legacy method: Add a project filter condition (no longer used)
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
			type: "condition",
			id: `project_${this.generateFilterId()}`,
			property: "projects",
			operator: "contains",
			value: `[[${projectName}]]`,
		};

		// Get existing non-project filters
		const existingFilters = filterBar.currentQuery.children.filter((child: any) => {
			return !(
				child.type === "condition" &&
				child.property === "projects" &&
				child.operator === "contains" &&
				child.id.startsWith("project_")
			);
		});

		if (existingFilters.length === 0) {
			// No existing filters, just add the project condition
			filterBar.currentQuery.children = [projectCondition];
		} else {
			// Create a group containing all existing filters
			const existingFiltersGroup = {
				type: "group",
				id: this.generateFilterId(),
				conjunction: filterBar.currentQuery.conjunction, // Preserve the current conjunction
				children: existingFilters,
			};

			// Replace query children with the project condition AND the existing filters group
			filterBar.currentQuery.children = [projectCondition, existingFiltersGroup];
			filterBar.currentQuery.conjunction = "and"; // Connect project with existing filters using AND
		}

		// Update the filter bar UI and emit changes
		filterBar.updateFilterBuilder();
		filterBar.emit("queryChange", filterBar.currentQuery);
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
			if (child.type === "condition") {
				return !(
					child.property === "projects" &&
					child.operator === "contains" &&
					child.id.startsWith("project_")
				);
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
			new Notice("Time tracking started");

			// Update status bar after a small delay to ensure task state is persisted
			if (this.statusBarService) {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 50);
			}

			return updatedTask;
		} catch (error) {
			console.error("Failed to start time tracking:", error);
			if (error.message === "Time tracking is already active for this task") {
				new Notice("Time tracking is already active for this task");
			} else {
				new Notice("Failed to start time tracking");
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
			new Notice("Time tracking stopped");

			// Update status bar after a small delay to ensure task state is persisted
			if (this.statusBarService) {
				setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 50);
			}

			return updatedTask;
		} catch (error) {
			console.error("Failed to stop time tracking:", error);
			if (error.message === "No active time tracking session for this task") {
				new Notice("No active time tracking session for this task");
			} else {
				new Notice("Failed to stop time tracking");
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
		const completeInstances = Array.isArray(task.complete_instances)
			? task.complete_instances
			: [];
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
	async openTaskEditModal(task: TaskInfo, onTaskUpdated?: (task: TaskInfo) => void) {
		// With native cache, task data is always current - no need to refetch
		new TaskEditModal(this.app, this, { task, onTaskUpdated }).open();
	}

	/**
	 * Opens a date/time picker modal for the given task date field.
	 */
	async openDueDateModal(task: TaskInfo) {
		this.openTaskDatePicker(task, "due");
	}

	async openScheduledDateModal(task: TaskInfo) {
		this.openTaskDatePicker(task, "scheduled");
	}

	private async openTaskDatePicker(task: TaskInfo, field: "due" | "scheduled") {
		try {
			const { DateTimePickerModal } = await import("./modals/DateTimePickerModal");
			const { getDatePart, getTimePart, combineDateAndTime } = await import("./utils/dateUtils");
			const currentValue = (field === "due" ? task.due : task.scheduled) || "";
			const modal = new DateTimePickerModal(this.app, {
				currentDate: getDatePart(currentValue) || null,
				currentTime: getTimePart(currentValue) || null,
				onSelect: async (date, time) => {
					const value = date && time ? combineDateAndTime(date, time) : date || undefined;
					await this.taskService.updateProperty(task, field, value);
				},
			});
			modal.open();
		} catch (error) {
			console.error("Error loading DateTimePickerModal:", error);
		}
	}

	/**
	 * Refreshes the TaskNotes cache by clearing all cached data and re-initializing
	 */
	async refreshCache(): Promise<void> {
		try {
			// Show loading notice
			const loadingNotice = new Notice("Refreshing TaskNotes cache...", 0);

			// Clear all caches
			await this.cacheManager.clearAllCaches();

			// Notify all views to refresh
			this.notifyDataChanged(undefined, true, true);

			// Hide loading notice and show success
			loadingNotice.hide();
			new Notice("TaskNotes cache refreshed successfully");
		} catch (error) {
			console.error("Error refreshing cache:", error);
			new Notice("Failed to refresh cache. Please try again.");
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
				new Notice("Task conversion service not available. Please try again.");
				return;
			}

			// Use the instant convert service for immediate conversion without modal
			await this.instantTaskConvertService.instantConvertTask(editor, cursor.line);
		} catch (error) {
			console.error("Error converting task:", error);
			new Notice("Failed to convert task. Please try again.");
		}
	}

	/**
	 * Batch convert all checkbox tasks in the current note to TaskNotes
	 */
	async batchConvertAllTasks(editor: Editor): Promise<void> {
		try {
			// Check if instant convert service is available
			if (!this.instantTaskConvertService) {
				new Notice("Task conversion service not available. Please try again.");
				return;
			}

			// Use the instant convert service for batch conversion
			await this.instantTaskConvertService.batchConvertAllTasks(editor);
		} catch (error) {
			console.error("Error batch converting tasks:", error);
			new Notice("Failed to batch convert tasks. Please try again.");
		}
	}

	/**
	 * Insert a wikilink to a selected tasknote at the current cursor position
	 */
	async insertTaskNoteLink(editor: Editor): Promise<void> {
		try {
			// Get all tasks
			const allTasks = await this.cacheManager.getAllTasks();
			const unarchivedTasks = allTasks.filter((task) => !task.archived);

			// Open task selector modal
			openTaskSelector(this, unarchivedTasks, (selectedTask) => {
				if (selectedTask) {
					// Create link using Obsidian's generateMarkdownLink (respects user's link format settings)
					const file = this.app.vault.getAbstractFileByPath(selectedTask.path);
					if (file) {
						const currentFile = this.app.workspace.getActiveFile();
						const sourcePath = currentFile?.path || "";
						const properLink = this.app.fileManager.generateMarkdownLink(
							file as TFile,
							sourcePath,
							"",
							selectedTask.title // Use task title as alias
						);

						// Insert at cursor position
						const cursor = editor.getCursor();
						editor.replaceRange(properLink, cursor);

						// Move cursor to end of inserted text
						const newCursor = {
							line: cursor.line,
							ch: cursor.ch + properLink.length,
						};
						editor.setCursor(newCursor);
					} else {
						new Notice("Failed to create link - file not found");
					}
				}
			});
		} catch (error) {
			console.error("Error inserting tasknote link:", error);
			new Notice("Failed to insert tasknote link");
		}
	}

	/**
	 * Open task selector to start time tracking for a task
	 */
	async openTaskSelectorForTimeTracking(): Promise<void> {
		try {
			// Get all tasks
			const allTasks = await this.cacheManager.getAllTasks();
			const unarchivedTasks = allTasks.filter((task) => !task.archived);

			// Filter to only show tasks that are not currently being tracked
			const availableTasks = unarchivedTasks.filter((task) => {
				const activeEntry = getActiveTimeEntry(task.timeEntries || []);
				return !activeEntry;
			});

			if (availableTasks.length === 0) {
				new Notice(this.i18n.translate("modals.timeTracking.noTasksAvailable"));
				return;
			}

			// Open task selector modal
			openTaskSelector(this, availableTasks, async (selectedTask) => {
				if (selectedTask) {
					try {
						await this.startTimeTracking(selectedTask);
						new Notice(
							this.i18n.translate("modals.timeTracking.started", {
								taskTitle: selectedTask.title,
							})
						);
					} catch (error) {
						console.error("Error starting time tracking:", error);
						new Notice(this.i18n.translate("modals.timeTracking.startFailed"));
					}
				}
			});
		} catch (error) {
			console.error("Error opening task selector for time tracking:", error);
			new Notice(this.i18n.translate("modals.timeTracking.startFailed"));
		}
	}

	/**
	 * Open task selector to edit time entries for a task
	 */
	async openTaskSelectorForTimeEntryEditor(): Promise<void> {
		try {
			// Get all tasks
			const allTasks = await this.cacheManager.getAllTasks();
			const unarchivedTasks = allTasks.filter((task) => !task.archived);

			// Filter to only show tasks that have time entries
			const tasksWithEntries = unarchivedTasks.filter(
				(task) => task.timeEntries && task.timeEntries.length > 0
			);

			if (tasksWithEntries.length === 0) {
				new Notice(this.i18n.translate("modals.timeEntryEditor.noTasksWithEntries"));
				return;
			}

			// Open task selector modal
			openTaskSelector(this, tasksWithEntries, (selectedTask) => {
				if (selectedTask) {
					this.openTimeEntryEditor(selectedTask);
				}
			});
		} catch (error) {
			console.error("Error opening task selector for time entry editor:", error);
			new Notice(this.i18n.translate("modals.timeEntryEditor.openFailed"));
		}
	}

	/**
	 * Open time entry editor modal for a specific task
	 */
	openTimeEntryEditor(task: TaskInfo, onSave?: () => void): void {
		const modal = new TimeEntryEditorModal(this.app, this, task, async (updatedEntries) => {
			try {
				const sanitizedEntries = updatedEntries.map((entry) => {
					const sanitizedEntry = { ...entry };
					delete sanitizedEntry.duration;
					return sanitizedEntry;
				});

				// Save to file
				await this.taskService.updateTask(task, {
					timeEntries: sanitizedEntries,
				});

				// Signal immediate update before triggering data change
				onSave?.();

				// Note: updateTask in TaskService already triggers EVENT_TASK_UPDATED internally
				// We just need to trigger EVENT_DATA_CHANGED
				this.emitter.trigger(EVENT_DATA_CHANGED);

				new Notice(this.i18n.translate("modals.timeEntryEditor.saved"));
			} catch (error) {
				console.error("Error saving time entries:", error);
				new Notice(this.i18n.translate("modals.timeEntryEditor.saveFailed"));
			}
		});

		modal.open();
	}

	/**
	 * Extract selection information for command usage
	 */
	private extractSelectionInfoForCommand(
		editor: Editor,
		lineNumber: number
	): {
		taskLine: string;
		details: string;
		startLine: number;
		endLine: number;
		originalContent: string[];
	} {
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
			const details = detailLines.join("\n").trimEnd();

			return {
				taskLine,
				details,
				startLine,
				endLine,
				originalContent: selectedLines,
			};
		} else {
			// No selection, just use the current line
			const taskLine = editor.getLine(lineNumber);
			return {
				taskLine,
				details: "",
				startLine: lineNumber,
				endLine: lineNumber,
				originalContent: [taskLine],
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
				new Notice("No file is currently open");
				return;
			}

			// Check if it's a TaskNote
			const taskInfo = await this.cacheManager.getTaskInfo(activeFile.path);
			if (!taskInfo) {
				new Notice("Current file is not a TaskNote");
				return;
			}

			// Open TaskActionPaletteModal with detected task
			const { TaskActionPaletteModal } = await import("./modals/TaskActionPaletteModal");
			// Use fresh UTC-anchored "today" for recurring task handling
			const now = new Date();
			const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
			const modal = new TaskActionPaletteModal(this.app, taskInfo, this, today);
			modal.open();
		} catch (error) {
			console.error("Error opening quick actions:", error);
			new Notice("Failed to open quick actions");
		}
	}

	/**
	 * Create a new inline task at cursor position
	 * Opens the task creation modal, then inserts a link to the created task
	 * Handles two scenarios:
	 * 1. Cursor on blank line: add new inline task
	 * 2. Cursor anywhere else: start new line then create inline task
	 */
	async createInlineTask(editor: Editor): Promise<void> {
		try {
			const cursor = editor.getCursor();
			const currentLine = editor.getLine(cursor.line);
			const lineContent = currentLine.trim();

			// Determine insertion point
			let insertionPoint: { line: number; ch: number };

			// Scenario 1: Cursor on blank line
			if (lineContent === "") {
				insertionPoint = { line: cursor.line, ch: cursor.ch };
			}
			// Scenario 2: Cursor anywhere else - create new line
			else {
				// Insert a new line and position cursor there
				const endOfLine = { line: cursor.line, ch: currentLine.length };
				editor.replaceRange("\n", endOfLine);
				insertionPoint = { line: cursor.line + 1, ch: 0 };
			}

			// Store the insertion context for the callback
			const insertionContext = {
				editor,
				insertionPoint,
			};

			// Prepare pre-populated values
			const prePopulatedValues: Partial<TaskInfo> = {};

			// Include current note as project if enabled
			if (this.settings.taskCreationDefaults.useParentNoteAsProject) {
				const currentFile = this.app.workspace.getActiveFile();
				if (currentFile) {
					const parentNote = this.app.fileManager.generateMarkdownLink(
						currentFile,
						currentFile.path
					);
					prePopulatedValues.projects = [parentNote];
				}
			}

			// Open task creation modal with callback to insert link
			// Use modal-inline-creation context for inline folder behavior (Issue #1424)
			const modal = new TaskCreationModal(this.app, this, {
				prePopulatedValues: Object.keys(prePopulatedValues).length > 0 ? prePopulatedValues : undefined,
				onTaskCreated: (task: TaskInfo) => {
					this.handleInlineTaskCreated(task, insertionContext);
				},
				creationContext: "modal-inline-creation",
			});

			modal.open();
		} catch (error) {
			console.error("Error creating inline task:", error);
			new Notice("Failed to create inline task");
		}
	}

	/**
	 * Handle task creation completion - insert link at the determined position
	 */
	private handleInlineTaskCreated(
		task: TaskInfo,
		context: {
			editor: Editor;
			insertionPoint: { line: number; ch: number };
		}
	): void {
		try {
			const { editor, insertionPoint } = context;

			// Create link using Obsidian's generateMarkdownLink
			const file = this.app.vault.getAbstractFileByPath(task.path);
			if (!file) {
				new Notice("Failed to create link - file not found");
				return;
			}

			const currentFile = this.app.workspace.getActiveFile();
			const sourcePath = currentFile?.path || "";
			const properLink = this.app.fileManager.generateMarkdownLink(
				file as TFile,
				sourcePath,
				"",
				task.title // Use task title as alias
			);

			// Insert the link at the determined insertion point
			editor.replaceRange(properLink, insertionPoint);

			// Position cursor at end of inserted link
			const newCursor = {
				line: insertionPoint.line,
				ch: insertionPoint.ch + properLink.length,
			};
			editor.setCursor(newCursor);

			new Notice(`Inline task "${task.title}" created and linked successfully`);
		} catch (error) {
			console.error("Error handling inline task creation:", error);
			new Notice("Failed to insert task link");
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
			fieldMapping: this.settings.fieldMapping,
		};

		return (
			current.taskTag !== this.previousCacheSettings.taskTag ||
			current.excludedFolders !== this.previousCacheSettings.excludedFolders ||
			current.disableNoteIndexing !== this.previousCacheSettings.disableNoteIndexing ||
			current.storeTitleInFilename !== this.previousCacheSettings.storeTitleInFilename ||
			JSON.stringify(current.fieldMapping) !==
				JSON.stringify(this.previousCacheSettings.fieldMapping)
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
			fieldMapping: JSON.parse(JSON.stringify(this.settings.fieldMapping)), // Deep copy
		};
	}
}
