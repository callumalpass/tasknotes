import {
	Notice,
	Plugin,
	WorkspaceLeaf,
	Editor,
	Menu,
	TAbstractFile,
	TFile,
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
import { DEFAULT_NLP_TRIGGERS, DEFAULT_SETTINGS } from "./settings/defaults";
import { hasMissingMigratedSettings } from "./settings/settingsMigration";
import { initializeFieldConfig } from "./utils/fieldConfigDefaults";
import { generateBasesFileTemplate } from "./templates/defaultBasesFiles";
import {
	MINI_CALENDAR_VIEW_TYPE,
	TaskInfo,
	EVENT_DATA_CHANGED,
	EVENT_TASK_UPDATED,
	EVENT_DATE_CHANGED,
} from "./types";

import { TaskCreationModal } from "./modals/TaskCreationModal";
import { TaskEditModal } from "./modals/TaskEditModal";
import { openTaskSelector } from "./modals/TaskSelectorWithCreateModal";
import { ProjectSelectModal } from "./modals/ProjectSelectModal";
import { PomodoroService } from "./services/PomodoroService";
import { formatTime, getActiveTimeEntry } from "./utils/helpers";
import { convertUTCToLocalCalendarDate, getCurrentTimestamp } from "./utils/dateUtils";
import { TaskManager } from "./utils/TaskManager";
import { DependencyCache } from "./utils/DependencyCache";
import { RequestDeduplicator, PredictivePrefetcher } from "./utils/RequestDeduplicator";
import { DOMReconciler, UIStateManager } from "./utils/DOMReconciler";
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
import { formatDateForStorage, parseDateToLocal, getTodayLocal } from "./utils/dateUtils";
import { stringifyUnknownArray } from "./utils/stringUtils";
import { ICSSubscriptionService } from "./services/ICSSubscriptionService";
import { ICSNoteService } from "./services/ICSNoteService";
import { StatusBarService } from "./services/StatusBarService";
import { ProjectSubtasksService } from "./services/ProjectSubtasksService";
import { ExpandedProjectsService } from "./services/ExpandedProjectsService";
import { NotificationService } from "./services/NotificationService";
import { AutoExportService } from "./services/AutoExportService";
// Type-only import for HTTPAPIService (actual import is dynamic on desktop only)
import type { HTTPAPIService } from "./services/HTTPAPIService";
import { createI18nService, I18nService } from "./i18n";
import { OAuthService } from "./services/OAuthService";
import { GoogleCalendarService } from "./services/GoogleCalendarService";
import { MicrosoftCalendarService } from "./services/MicrosoftCalendarService";
import { CalendarProviderRegistry } from "./services/CalendarProvider";
import { TaskCalendarSyncService } from "./services/TaskCalendarSyncService";
import { addTaskToProject, assignTaskAsSubtask } from "./services/taskRelationshipActions";
import {
	initializeAfterLayoutReady,
	initializeCalendarProviders,
	registerBasesIntegration,
} from "./bootstrap/pluginBootstrap";
import { cleanupPluginRuntime, initializePluginRuntime } from "./bootstrap/pluginRuntime";
import { applyParentNoteProjectDefault } from "./utils/taskCreationPrepopulation";
import { applySearchQueryToView } from "./utils/obsidianSearchView";

type LoadedSettingsData = Partial<TaskNotesSettings> &
	Record<string, unknown> & {
		statusSuggestionTrigger?: string;
	};

function frontmatterString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

function frontmatterStringArray(value: unknown): string[] | undefined {
	if (value === null || value === undefined) return undefined;
	return stringifyUnknownArray(value);
}

function frontmatterNumber(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

export default class TaskNotesPlugin extends Plugin {
	settings: TaskNotesSettings;
	i18n: I18nService;

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
	workspaceNavigationService: import("./services/WorkspaceNavigationService").WorkspaceNavigationService;
	taskActionCoordinator: import("./services/TaskActionCoordinator").TaskActionCoordinator;
	settingsLifecycleService: import("./services/SettingsLifecycleService").SettingsLifecycleService;
	commandRegistry: import("./commands/TranslatedCommandRegistry").TranslatedCommandRegistry;

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

	// Event listener cleanup
	taskUpdateListenerForEditor: unknown = null;
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
		} catch {
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
			this.commandRegistry?.refreshTranslations();
		});

		await initializePluginRuntime(this);
		this.registerTaskNotesFileMenuActions();

		// Start migration check early (before views can be opened)
		this.migrationPromise = this.performEarlyMigrationCheck();

		initializeCalendarProviders(this);
		await registerBasesIntegration(this);

		// Defer expensive initialization until layout is ready
		this.app.workspace.onLayoutReady(() => {
			void this.initializeAfterLayoutReady();
		});

		// At the very end of onload, resolve the promise to signal readiness
		this.resolveReady();
	}

	private registerTaskNotesFileMenuActions(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				this.addTaskNotesFileMenuActions(menu, file);
			})
		);
	}

	addTaskNotesFileMenuActions(menu: Menu, file: TAbstractFile): void {
		if (!(file instanceof TFile)) {
			return;
		}

		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata?.frontmatter || !this.cacheManager.isTaskFile(metadata.frontmatter)) {
			return;
		}

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle(this.i18n.translate("modals.taskEdit.title"));
			item.setIcon("pencil");
			item.setSection("tasknotes");
			item.onClick(() => {
				void this.openTaskEditModalForFile(file);
			});
		});
		menu.addItem((item) => {
			item.setTitle(this.i18n.translate("contextMenus.task.quickActions"));
			item.setIcon("list-checks");
			item.setSection("tasknotes");
			item.onClick(() => {
				void this.openQuickActionsForTaskFile(file);
			});
		});
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
		void import("./bootstrap/pluginBootstrap").then(({ initializeServicesLazily }) => {
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
			// Trigger index building with a single call - this will process all files internally
			this.cacheManager.getTasksForDate(new Date().toISOString().split("T")[0]);
		} catch (error) {
			console.error("[TaskNotes] Error during project index warmup:", error);
		}
	}

	/**
	 * Public method for views to wait for readiness
	 */
	async onReady(): Promise<void> {
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
				window.setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			})
		);

		// Listen for general data changes
		this.registerEvent(
			this.emitter.on(EVENT_DATA_CHANGED, () => {
				// Small delay to ensure data changes are fully propagated
				window.setTimeout(() => {
					this.statusBarService.requestUpdate();
				}, 100);
			})
		);

		// Listen for Pomodoro events if Pomodoro service is available
		if (this.pomodoroService) {
			// Listen for Pomodoro start events
			this.registerEvent(
				this.emitter.on("pomodoro-start", () => {
					window.setTimeout(() => {
						this.statusBarService.requestUpdate();
					}, 100);
				})
			);

			// Listen for Pomodoro stop events
			this.registerEvent(
				this.emitter.on("pomodoro-stop", () => {
					window.setTimeout(() => {
						this.statusBarService.requestUpdate();
					}, 100);
				})
			);

			// Listen for Pomodoro state changes
			this.registerEvent(
				this.emitter.on("pomodoro-state-changed", () => {
					window.setTimeout(() => {
						this.statusBarService.requestUpdate();
					}, 100);
				})
			);
		}
	}

	setupTimeTrackingEventListeners(): void {
		this.settingsLifecycleService.setupTimeTrackingEventListeners();
	}

	/**
	 * Perform early migration check and state preparation
	 * This runs before any views can be opened to prevent race conditions
	 */
	private async performEarlyMigrationCheck(): Promise<void> {
		try {
			// Initialize saved views (handles migration if needed)
			await this.viewStateManager.initializeSavedViews();

			// Perform view state migration if needed (this is silent and fast)
			if (this.viewStateManager.needsMigration()) {
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
					window.setTimeout(() => {
						void (async () => {
							await this.activateReleaseNotesView();
							// Update lastSeenVersion immediately after showing the release notes
							// This ensures they only show once per version
							this.settings.lastSeenVersion = currentVersion;
							await this.saveSettings();
						})();
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
			await new Promise((resolve) => window.setTimeout(resolve, 50));
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
			void this.cacheManager.clearAllCaches();

			// Clear task link detection cache completely
			if (this.taskLinkDetectionService) {
				this.taskLinkDetectionService.clearCache();
			}
		}

		// Only emit refresh event if triggerRefresh is true
		if (triggerRefresh) {
			// Use requestAnimationFrame for better UI timing instead of setTimeout
			window.requestAnimationFrame(() => {
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
		void cleanupPluginRuntime(this);
	}

	async loadSettings() {
		const loadedData = (await this.loadData()) as LoadedSettingsData | null;

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
		if (
			loadedData &&
			!loadedData.nlpTriggers &&
			loadedData.statusSuggestionTrigger !== undefined
		) {
			loadedData.nlpTriggers = {
				triggers: [...DEFAULT_NLP_TRIGGERS.triggers],
			};
			// Update status trigger if it was customized
			const statusTriggerIndex = loadedData.nlpTriggers.triggers.findIndex(
				(trigger) => trigger.propertyId === "status"
			);
			if (statusTriggerIndex !== -1 && loadedData.statusSuggestionTrigger) {
				loadedData.nlpTriggers.triggers[statusTriggerIndex].trigger =
					loadedData.statusSuggestionTrigger;
			}
		}

		// Migration: Initialize modal fields configuration if not present
		if (loadedData && !loadedData.modalFieldsConfig) {
			loadedData.modalFieldsConfig = initializeFieldConfig(undefined, loadedData.userFields);
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
				triggers:
					loadedData?.nlpTriggers?.triggers || DEFAULT_SETTINGS.nlpTriggers.triggers,
			},
			// Modal fields configuration (already migrated above if needed)
			modalFieldsConfig: loadedData?.modalFieldsConfig,
			// Array handling - maintain existing arrays or use defaults
			customStatuses: loadedData?.customStatuses || DEFAULT_SETTINGS.customStatuses,
			customPriorities: loadedData?.customPriorities || DEFAULT_SETTINGS.customPriorities,
			savedViews: loadedData?.savedViews || DEFAULT_SETTINGS.savedViews,
		};

		if (hasMissingMigratedSettings(loadedData)) {
			// Save the migrated settings to include new field mappings (non-blocking)
			window.setTimeout(() => {
				void (async () => {
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
				})();
			}, 100);
		}

		// Cache setting migration is no longer needed (native cache only)
	}

	async saveSettings() {
		await this.settingsLifecycleService.saveSettings();
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
		await this.settingsLifecycleService.onExternalSettingsChange();
	}

	// Helper method to create or activate a view of specific type
	private async revealLeafReady(leaf: WorkspaceLeaf): Promise<void> {
		await this.workspaceNavigationService.revealLeafReady(leaf);
	}

	// Helper method to create or activate a view of specific type
	async activateView(viewType: string) {
		return this.workspaceNavigationService.activateView(viewType);
	}

	async activateCalendarView() {
		return this.workspaceNavigationService.activateCalendarView();
	}

	async activateAgendaView() {
		return this.workspaceNavigationService.activateAgendaView();
	}

	async activatePomodoroView() {
		return this.workspaceNavigationService.activatePomodoroView();
	}

	async activatePomodoroStatsView() {
		return this.workspaceNavigationService.activatePomodoroStatsView();
	}

	async activateStatsView() {
		return this.workspaceNavigationService.activateStatsView();
	}

	async activateReleaseNotesView() {
		return this.workspaceNavigationService.activateReleaseNotesView();
	}

	async openBasesFileForCommand(commandId: string): Promise<void> {
		await this.workspaceNavigationService.openBasesFileForCommand(commandId);
	}

	/**
	 * Create default .base files in TaskNotes/Views/ directory
	 * Called from settings UI
	 */
	async createDefaultBasesFiles(): Promise<void> {
		const { created, skipped } = await this.ensureBasesViewFiles();

		if (created.length > 0) {
			new Notice(
				`Created ${created.length} default Bases file(s):\n${created.join("\n")}`,
				8000
			);
		}

		if (skipped.length > 0 && created.length === 0) {
			new Notice(`Default Bases files already exist:\n${skipped.join("\n")}`, 8000);
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

			if (await adapter.exists(currentPath)) {
				continue;
			}

			try {
				await this.app.vault.createFolder(currentPath);
			} catch (error) {
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
				const directory =
					lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex) : "";

				if (directory) {
					await this.ensureFolderHierarchy(directory);
				}

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

			const searchQuery = `tag:${tag}`;
			if (!applySearchQueryToView(searchLeaf.view, searchQuery)) {
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

	getLeafOfType(viewType: string): unknown {
		return this.workspaceNavigationService.getLeafOfType(viewType);
	}

	getCalendarLeaf(): unknown {
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
					"Daily notes core plugin is not enabled. Please enable it in settings > core plugins."
				);
				return;
			}

			// Convert date to moment for the API
			// Fix for issue #857: Convert UTC-anchored date to local calendar date
			// before passing to moment() to ensure correct day is used
			// Fix for issue #1223: Skip conversion if the date is already local (e.g., from getTodayLocal())
			const localDate = options?.isAlreadyLocal ? date : convertUTCToLocalCalendarDate(date);
			const moment = (window as Window & { moment: (date: Date) => unknown }).moment(
				localDate
			);

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
		const existingStyle = activeDocument.getElementById("tasknotes-custom-styles");
		if (existingStyle) {
			existingStyle.remove();
		}

		// Generate new styles
		const statusStyles = this.statusManager.getStatusStyles();
		const priorityStyles = this.priorityManager.getPriorityStyles();

		// Create style element
		const styleEl = activeDocument.createElement("style");
		styleEl.id = "tasknotes-custom-styles";
		styleEl.textContent = `
		${statusStyles}
		${priorityStyles}
	`;

		// Inject into document head
		activeDocument.head.appendChild(styleEl);
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
			const targetDate = await this.taskService.resolveRecurringTaskActionDate(task, date);
			const updatedTask = await this.taskService.toggleRecurringTaskComplete(
				task,
				targetDate
			);

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
		new TaskCreationModal(this.app, this, {
			prePopulatedValues: this.applyParentNoteProjectDefault(prePopulatedValues),
		}).open();
	}

	private applyParentNoteProjectDefault(
		prePopulatedValues?: Partial<TaskInfo>
	): Partial<TaskInfo> | undefined {
		if (!this.settings.taskCreationDefaults.useParentNoteAsProject) {
			return prePopulatedValues;
		}

		const currentFile = this.app.workspace.getActiveFile();
		const parentNote = currentFile
			? this.app.fileManager.generateMarkdownLink(currentFile, currentFile.path)
			: undefined;

		return applyParentNoteProjectDefault(prePopulatedValues, parentNote);
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
		const frontmatter: Record<string, unknown> = metadata?.frontmatter || {};
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
			title: frontmatterString(frontmatter.title) || activeFile.basename,
			status: frontmatterString(frontmatter.status) ?? this.settings.defaultTaskStatus,
			priority: frontmatterString(frontmatter.priority) ?? this.settings.defaultTaskPriority,
			archived: false,
			due: frontmatterString(frontmatter.due),
			scheduled: frontmatterString(frontmatter.scheduled),
			contexts: frontmatterStringArray(frontmatter.contexts),
			projects: frontmatterStringArray(frontmatter.projects),
			tags: frontmatterStringArray(frontmatter.tags) ?? [],
			timeEstimate: frontmatterNumber(frontmatter.timeEstimate),
			recurrence: frontmatterString(frontmatter.recurrence),
			dateCreated: frontmatterString(frontmatter.dateCreated) || now,
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
		await this.taskActionCoordinator.openTaskSelectorWithCreate();
	}

	async rolloverOverdueScheduledTasks(): Promise<void> {
		await this.taskActionCoordinator.rolloverOverdueScheduledTasks();
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
	 * Starts a time tracking session for a task
	 */
	async startTimeTracking(task: TaskInfo, description?: string): Promise<TaskInfo> {
		return this.taskActionCoordinator.startTimeTracking(task, description);
	}

	/**
	 * Stops the active time tracking session for a task
	 */
	async stopTimeTracking(task: TaskInfo): Promise<TaskInfo> {
		return this.taskActionCoordinator.stopTimeTracking(task);
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
		void this.openTaskDatePicker(task, "due");
	}

	async openScheduledDateModal(task: TaskInfo) {
		void this.openTaskDatePicker(task, "scheduled");
	}

	private async openTaskDatePicker(task: TaskInfo, field: "due" | "scheduled") {
		try {
			const { DateTimePickerModal } = await import("./modals/DateTimePickerModal");
			const { getDatePart, getTimePart, combineDateAndTime } = await import(
				"./utils/dateUtils"
			);
			const currentValue = (field === "due" ? task.due : task.scheduled) || "";
			const modal = new DateTimePickerModal(this.app, {
				currentDate: getDatePart(currentValue) || null,
				currentTime: getTimePart(currentValue) || null,
				onSelect: (date, time) => {
					void (async () => {
						const value =
							date && time ? combineDateAndTime(date, time) : date || undefined;
						await this.taskService.updateProperty(task, field, value);
					})();
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
			const loadingNotice = new Notice("Refreshing tasknotes cache...", 0);

			// Clear all caches
			await this.cacheManager.clearAllCaches();

			// Notify all views to refresh
			this.notifyDataChanged(undefined, true, true);

			// Hide loading notice and show success
			loadingNotice.hide();
			new Notice("Tasknotes cache refreshed successfully");
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
					if (file instanceof TFile) {
						const currentFile = this.app.workspace.getActiveFile();
						const sourcePath = currentFile?.path || "";
						const properLink = this.app.fileManager.generateMarkdownLink(
							file,
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
		await this.taskActionCoordinator.openTaskSelectorForTimeTracking();
	}

	/**
	 * Open task selector to edit time entries for a task
	 */
	async openTaskSelectorForTimeEntryEditor(): Promise<void> {
		await this.taskActionCoordinator.openTaskSelectorForTimeEntryEditor();
	}

	/**
	 * Open time entry editor modal for a specific task
	 */
	openTimeEntryEditor(task: TaskInfo, onSave?: () => void): void {
		this.taskActionCoordinator.openTimeEntryEditor(task, onSave);
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

			await this.openQuickActionsForTaskFile(activeFile, "Current file is not a tasknote");
		} catch (error) {
			console.error("Error opening quick actions:", error);
			new Notice("Failed to open quick actions");
		}
	}

	async openTaskEditModalForCurrentTask(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No file is currently open");
			return;
		}

		await this.openTaskEditModalForFile(activeFile, "Current file is not a tasknote");
	}

	private async openTaskEditModalForFile(file: TFile, notTaskNotice?: string): Promise<void> {
		try {
			const taskInfo = await this.cacheManager.getTaskInfo(file.path);
			if (!taskInfo) {
				new Notice(
					notTaskNotice ??
						this.i18n.translate("modals.taskEdit.notices.fileMissing", {
							path: file.path,
						})
				);
				return;
			}

			await this.openTaskEditModal(taskInfo);
		} catch (error) {
			console.error("Error opening task edit modal from file menu:", error);
			new Notice(this.i18n.translate("modals.taskEdit.notices.openNoteFailure"));
		}
	}

	private async openQuickActionsForTaskFile(
		file: TFile,
		notTaskNotice = "Selected file is not a tasknote"
	): Promise<void> {
		const taskInfo = await this.cacheManager.getTaskInfo(file.path);
		if (!taskInfo) {
			new Notice(notTaskNotice);
			return;
		}

		const { TaskActionPaletteModal } = await import("./modals/TaskActionPaletteModal");
		// Use fresh UTC-anchored "today" for recurring task handling
		const now = new Date();
		const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
		const modal = new TaskActionPaletteModal(this.app, taskInfo, this, today);
		modal.open();
	}

	async addProjectToCurrentTask(): Promise<void> {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice("No file is currently open");
				return;
			}

			const taskInfo = await this.cacheManager.getTaskInfo(activeFile.path);
			if (!taskInfo) {
				new Notice("Current file is not a task");
				return;
			}

			const selector = new ProjectSelectModal(this.app, this, (projectFile) => {
				if (!(projectFile instanceof TFile)) {
					new Notice(
						this.i18n.translate(
							"contextMenus.task.organization.notices.projectSelectFailed"
						)
					);
					return;
				}
				void this.addSelectedProjectToTask(taskInfo, projectFile);
			});
			selector.open();
		} catch (error) {
			console.error("Failed to add project to current task:", error);
			new Notice(
				this.i18n.translate("contextMenus.task.organization.notices.addToProjectFailed")
			);
		}
	}

	async addSubtaskToCurrentNote(): Promise<void> {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice("No file is currently open");
				return;
			}

			const allTasks = await this.cacheManager.getAllTasks();
			const candidates = allTasks.filter((candidate) => candidate.path !== activeFile.path);
			if (candidates.length === 0) {
				new Notice(
					this.i18n.translate(
						"contextMenus.task.organization.notices.noEligibleSubtasks"
					)
				);
				return;
			}

			openTaskSelector(this, candidates, (subtask) => {
				if (!subtask) return;
				void this.assignSelectedSubtaskToCurrentNote(activeFile, subtask);
			});
		} catch (error) {
			console.error("Failed to add subtask to current note:", error);
			new Notice(
				this.i18n.translate("contextMenus.task.organization.notices.subtaskSelectFailed")
			);
		}
	}

	private async addSelectedProjectToTask(task: TaskInfo, projectFile: TFile): Promise<void> {
		try {
			await addTaskToProject(this, task, projectFile);
		} catch (error) {
			console.error("Failed to add selected project to task:", error);
			new Notice(
				this.i18n.translate("contextMenus.task.organization.notices.addToProjectFailed")
			);
		}
	}

	private async assignSelectedSubtaskToCurrentNote(
		parentFile: TFile,
		subtask: TaskInfo
	): Promise<void> {
		try {
			await assignTaskAsSubtask(this, parentFile, subtask);
		} catch (error) {
			console.error("Failed to assign selected subtask to current note:", error);
			new Notice(
				this.i18n.translate("contextMenus.task.organization.notices.addAsSubtaskFailed")
			);
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

			const prePopulatedValues = this.applyParentNoteProjectDefault();

			// Open task creation modal with callback to insert link
			// Use modal-inline-creation context for inline folder behavior (Issue #1424)
			const modal = new TaskCreationModal(this.app, this, {
				prePopulatedValues,
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
			if (!(file instanceof TFile)) {
				new Notice("Failed to create link - file not found");
				return;
			}

			const currentFile = this.app.workspace.getActiveFile();
			const sourcePath = currentFile?.path || "";
			const properLink = this.app.fileManager.generateMarkdownLink(
				file,
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
}
