import {
	Notice,
	Plugin,
	WorkspaceLeaf,
	Editor,
	Menu,
	TAbstractFile,
	TFile,
	getLanguage,
} from "obsidian";
import { format } from "date-fns";
import {
	createDailyNote,
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import { TaskNotesSettings } from "./types/settings";
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
import { convertUTCToLocalCalendarDate } from "./utils/dateUtils";
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
import type { ViewPerformanceService } from "./services/ViewPerformanceService";
import { AutoArchiveService } from "./services/AutoArchiveService";
import { ViewStateManager } from "./services/ViewStateManager";
import { DragDropManager } from "./utils/DragDropManager";
import { formatDateForStorage, parseDateToLocal, getTodayLocal } from "./utils/dateUtils";
import { ICSSubscriptionService } from "./services/ICSSubscriptionService";
import { ICSNoteService } from "./services/ICSNoteService";
import { StatusBarService } from "./ui/StatusBarService";
import { ProjectSubtasksService } from "./services/ProjectSubtasksService";
import { ExpandedProjectsService } from "./services/ExpandedProjectsService";
import { NotificationService } from "./ui/NotificationService";
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
import {
	ensureDefaultBasesViewFiles,
	type DefaultBasesFileResult,
} from "./bootstrap/defaultBasesFiles";
import {
	getAvailableTaskNotesReleaseVersion,
	shouldNotifyForRelease,
	TASKNOTES_COMMUNITY_PLUGIN_URL,
} from "./api/releaseCheck";
import { buildCurrentNoteConversionTaskInfo } from "./services/task-service/currentNoteConversion";
import { applyParentNoteProjectDefault } from "./utils/taskCreationPrepopulation";
import { applySearchQueryToView } from "./utils/obsidianSearchView";
import { TaskContextMenu } from "./components/TaskContextMenu";
import {
	LoadedSettingsData,
	buildSettingsDataForSave,
	buildSettingsFromLoadedData,
	loadPluginSettingsDataWithRetry,
	pluginDataFileExists,
} from "./settings/settingsPersistence";
import { startDateChangeDetection } from "./bootstrap/dateChangeDetection";
import { createTaskNotesLogger } from "./utils/tasknotesLogger";
import { TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS } from "./api/runtime-api";
import {
	createTaskNotesPerformanceProfiler,
	TaskNotesPerformanceProfiler,
} from "./utils/PerformanceProfiler";

const tasknotesLogger = createTaskNotesLogger({ tag: "Main" });

type DailyNoteMoment = Parameters<typeof getDailyNote>[0];
type TaskLinkDetectionServiceInstance =
	import("./services/TaskLinkDetectionService").TaskLinkDetectionService;
type TaskLinkMatch = ReturnType<TaskLinkDetectionServiceInstance["findWikilinks"]>[number];
type SubmenuMenuItem = {
	setSubmenu(): Menu;
};

function getSubmenu(item: unknown): Menu {
	return (item as SubmenuMenuItem).setSubmenu();
}

export default class TaskNotesPlugin extends Plugin {
	settings: TaskNotesSettings;
	i18n: I18nService;
	private settingsLoadCompromised = false;
	private settingsDataSavePromise: Promise<void> | null = null;
	private settingsDataSaveRequested = false;

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
	performanceProfiler: TaskNotesPerformanceProfiler;

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
	workspaceNavigationService: import("./ui/WorkspaceNavigationService").WorkspaceNavigationService;
	taskActionCoordinator: import("./ui/TaskActionCoordinator").TaskActionCoordinator;
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

	// Public JavaScript API for in-vault scripts
	api: import("./api/TaskNotesAPI").TaskNotesPublicAPI;

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
	taskFileLifecycleReconciliationService?: import("./services/TaskFileLifecycleReconciliationService").TaskFileLifecycleReconciliationService;

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
		this.performanceProfiler = createTaskNotesPerformanceProfiler({
			isEnabled: () => this.settings?.enableDebugLogging === true,
			logger: createTaskNotesLogger({
				tag: "PerformanceProfiler",
				isDebugEnabled: () => this.settings?.enableDebugLogging === true,
			}),
		});

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
		this.emitter.trigger(TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS.ready, {
			timestamp: new Date().toISOString(),
		});
	}

	private registerTaskNotesFileMenuActions(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source) => {
				this.addTaskNotesFileMenuActions(menu, file, source);
			})
		);
	}

	addTaskNotesFileMenuActions(menu: Menu, file: TAbstractFile, source?: string): void {
		if (source === "tasknotes-context-menu") {
			return;
		}

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

		const task = this.cacheManager.getCachedTaskInfoSync(file.path);
		if (!task) {
			return;
		}

		menu.addItem((item) => {
			item.setTitle(this.i18n.translate("common.appName"));
			item.setIcon("list-checks");
			item.setSection("tasknotes");
			const submenu = getSubmenu(item);
			TaskContextMenu.addToMenu(submenu, {
				task,
				plugin: this,
				targetDate: getTodayLocal(),
				onUpdate: () => {
					this.app.workspace.trigger("tasknotes:refresh-views");
				},
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
			tasknotesLogger.error("[TaskNotes] Error during project index warmup:", {
				category: "internal",
				operation: "project-index-warmup",
				error: error,
			});
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
			tasknotesLogger.error("Error during early migration check:", {
				category: "configuration",
				operation: "early-migration-check",
				error: error,
			});
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
			tasknotesLogger.error("Error checking for version update:", {
				category: "configuration",
				operation: "checking-version-update",
				error: error,
			});
		}
	}

	async checkForNewReleaseOnStartup(): Promise<void> {
		if (this.settings.checkForUpdatesOnStartup === false) {
			return;
		}

		try {
			const availableVersion = await getAvailableTaskNotesReleaseVersion();
			if (
				!shouldNotifyForRelease(
					this.manifest.version,
					availableVersion,
					this.settings.lastNotifiedReleaseVersion
				)
			) {
				return;
			}

			this.settings.lastNotifiedReleaseVersion = availableVersion;
			await this.saveSettingsDataOnly();
			new Notice(this.createReleaseAvailableNotice(availableVersion), 15000);
		} catch (error) {
			tasknotesLogger.debug("Release check failed", {
				category: "provider",
				operation: "check-release",
				error,
			});
		}
	}

	private createReleaseAvailableNotice(version: string): DocumentFragment {
		const fragment = activeDocument.createDocumentFragment();
		fragment.appendText(
			this.i18n.translate("notices.releaseAvailable.message", {
				version,
			})
		);
		fragment.appendText(" ");

		const link = activeDocument.createElement("a");
		link.textContent = this.i18n.translate("notices.releaseAvailable.action");
		link.href = TASKNOTES_COMMUNITY_PLUGIN_URL;
		link.addEventListener("click", (event) => {
			event.preventDefault();
			window.open(TASKNOTES_COMMUNITY_PLUGIN_URL, "_blank");
		});

		fragment.appendChild(link);
		return fragment;
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
				this.emitter.trigger(TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS["cache.changed"], {
					filePath,
					force,
					timestamp: new Date().toISOString(),
				});
			});
		}
	}

	/**
	 * Set up date change detection to refresh task states when the date rolls over
	 */
	setupDateChangeDetection(): void {
		startDateChangeDetection({
			registerTimer: (timerId) => this.registerInterval(timerId),
			emitDateChanged: () => this.emitter.trigger(EVENT_DATE_CHANGED),
		});
	}

	onunload() {
		this.emitter?.trigger(TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS.unloading, {
			timestamp: new Date().toISOString(),
		});
		void cleanupPluginRuntime(this);
	}

	private async pluginDataFileExists(): Promise<boolean> {
		return pluginDataFileExists(this);
	}

	private async loadSettingsData(): Promise<LoadedSettingsData | null> {
		this.settingsLoadCompromised = false;

		const result = await loadPluginSettingsDataWithRetry(this);
		this.settingsLoadCompromised = result.compromised;
		if (result.compromised) {
			tasknotesLogger.error("Settings data could not be read safely", {
				category: "internal",
				operation: "load-settings-data",
				details: {
					reason: "Settings data file exists, but Obsidian returned no settings data.",
					settingsSavesBlocked: true,
				},
			});
		}
		return result.data;
	}

	async loadSettings() {
		const loadedData = await this.loadSettingsData();
		const { settings, shouldPersistMigratedSettings } = buildSettingsFromLoadedData(loadedData);
		this.settings = settings;

		if (shouldPersistMigratedSettings) {
			// Save the migrated settings to include new field mappings (non-blocking)
			window.setTimeout(() => {
				void (async () => {
					try {
						await this.saveSettingsDataOnly();
					} catch (error) {
						tasknotesLogger.error("Failed to save migrated settings:", {
							category: "configuration",
							operation: "save-migrated-settings",
							error: error,
						});
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
		this.settingsDataSaveRequested = true;
		if (!this.settingsDataSavePromise) {
			this.settingsDataSavePromise = this.drainSettingsDataSaves();
		}

		await this.settingsDataSavePromise;
	}

	private async drainSettingsDataSaves(): Promise<void> {
		try {
			while (this.settingsDataSaveRequested) {
				this.settingsDataSaveRequested = false;
				await this.writeSettingsDataOnlyOnce();
			}
		} finally {
			this.settingsDataSavePromise = null;
			if (this.settingsDataSaveRequested) {
				await this.saveSettingsDataOnly();
			}
		}
	}

	private async writeSettingsDataOnlyOnce(): Promise<void> {
		if (this.settingsLoadCompromised) {
			tasknotesLogger.warn(
				"[TaskNotes] Skipping settings save because settings data could not be read safely during startup.",
				{
					category: "configuration",
					operation: "skipping-settings-save-because-settings-data-read-safely-startup",
				}
			);
			return;
		}

		// Load existing plugin data to preserve non-settings data like pomodoroHistory
		const loadedData = await this.loadData();
		if (loadedData === null && (await this.pluginDataFileExists())) {
			this.settingsLoadCompromised = true;
			tasknotesLogger.warn(
				"[TaskNotes] Skipping settings save because data.json exists but could not be read.",
				{
					category: "configuration",
					operation: "skipping-settings-save-because-data-json-exists-but-read",
				}
			);
			return;
		}

		const data = loadedData || {};
		await this.saveData(buildSettingsDataForSave(data, this.settings));
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
	async createDefaultBasesFiles(options: { overwriteExisting?: boolean } = {}): Promise<void> {
		const { created, updated, skipped } = await this.ensureBasesViewFiles(options);

		if (created.length > 0) {
			new Notice(
				`Created ${created.length} default Bases file(s):\n${created.join("\n")}`,
				8000
			);
		}

		if (updated.length > 0) {
			new Notice(
				`Updated ${updated.length} default Bases file(s):\n${updated.join("\n")}`,
				8000
			);
		}

		if (skipped.length > 0 && created.length === 0 && updated.length === 0) {
			new Notice(`Default Bases files already exist:\n${skipped.join("\n")}`, 8000);
		}
	}

	async updateDefaultBasesFiles(): Promise<DefaultBasesFileResult> {
		return this.ensureBasesViewFiles({ overwriteExisting: true });
	}

	async ensureBasesViewFiles(
		options: { overwriteExisting?: boolean } = {}
	): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
		return ensureDefaultBasesViewFiles(
			{
				app: this.app,
				settings: this.settings,
				generateTemplate: (commandId) => generateBasesFileTemplate(commandId, this),
				warn: (message, error) => {
					if (error === undefined) {
						tasknotesLogger.warn(message, {
							category: "configuration",
							operation: "ensure-bases-view-files",
						});
					} else {
						tasknotesLogger.warn(message, {
							category: "configuration",
							operation: "ensure-bases-view-files",
							error: error,
						});
					}
				},
			},
			options
		);
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
					tasknotesLogger.warn("Could not get left leaf for search pane", {
						category: "configuration",
						operation: "get-left-leaf-search-pane",
					});
					return false;
				}

				try {
					await leftLeaf.setViewState({
						type: "search",
						active: true,
					});
					searchLeaf = leftLeaf;
				} catch (error) {
					tasknotesLogger.warn("Failed to create search view:", {
						category: "persistence",
						operation: "create-search-view",
						error: error,
					});
					return false;
				}
			}

			if (!searchLeaf) {
				tasknotesLogger.warn("No search leaf available", {
					category: "configuration",
					operation: "no-search-leaf",
				});
				return false;
			}

			await this.revealLeafReady(searchLeaf);

			const searchQuery = `tag:${tag}`;
			if (!applySearchQueryToView(searchLeaf.view, searchQuery)) {
				tasknotesLogger.warn("[TaskNotes] Could not find method to set search query", {
					category: "stale-data",
					operation: "find-method-set-search-query",
				});
				new Notice("Search pane opened but could not set tag query");
				return false;
			}

			return true;
		} catch (error) {
			tasknotesLogger.error("[TaskNotes] Error opening search pane with tag:", {
				category: "internal",
				operation: "opening-search-pane-tag",
				error: error,
			});
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
			const moment = (window as Window & { moment: (date: Date) => DailyNoteMoment }).moment(
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
					tasknotesLogger.error("Failed to create daily note:", {
						category: "persistence",
						operation: "create-daily-note",
						error: error,
					});
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
			tasknotesLogger.error("Failed to navigate to daily note:", {
				category: "persistence",
				operation: "navigate-daily-note",
				error: error,
			});
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
			tasknotesLogger.error(`Failed to update task ${property}:`, {
				category: "validation",
				operation: "update-task",
				error: error,
			});
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
			tasknotesLogger.error("Failed to toggle recurring task completion:", {
				category: "persistence",
				operation: "toggle-recurring-task-completion",
				error: error,
			});
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
			tasknotesLogger.error("Failed to toggle task archive:", {
				category: "persistence",
				operation: "toggle-task-archive",
				error: error,
			});
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
			tasknotesLogger.error("Failed to toggle task status:", {
				category: "persistence",
				operation: "toggle-task-status",
				error: error,
			});
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

		const taskInfo = buildCurrentNoteConversionTaskInfo({
			path: activeFile.path,
			basename: activeFile.basename,
			content,
			frontmatter,
			settings: this.settings,
		});

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

	async openTaskSelectorWithCreateAndStartTracking(): Promise<void> {
		await this.taskActionCoordinator.openTaskSelectorWithCreateAndStartTracking();
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
			tasknotesLogger.error("Error applying project subtask filter:", {
				category: "persistence",
				operation: "applying-project-subtask-filter",
				error: error,
			});
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
				dateRole: field,
				plugin: this,
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
			tasknotesLogger.error("Error loading DateTimePickerModal:", {
				category: "validation",
				operation: "loading-datetimepickermodal",
				error: error,
			});
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
			this.emitter.trigger(TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS["cache.rebuilt"], {
				force: true,
				timestamp: new Date().toISOString(),
			});

			// Hide loading notice and show success
			loadingNotice.hide();
			new Notice("Tasknotes cache refreshed successfully");
		} catch (error) {
			tasknotesLogger.error("Error refreshing cache:", {
				category: "stale-data",
				operation: "refreshing-cache",
				error: error,
			});
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
			tasknotesLogger.error("Error converting task:", {
				category: "validation",
				operation: "converting-task",
				error: error,
			});
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
			tasknotesLogger.error("Error batch converting tasks:", {
				category: "validation",
				operation: "batch-converting-tasks",
				error: error,
			});
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
			tasknotesLogger.error("Error inserting tasknote link:", {
				category: "persistence",
				operation: "inserting-tasknote-link",
				error: error,
			});
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
			tasknotesLogger.error("Error opening quick actions:", {
				category: "internal",
				operation: "opening-quick-actions",
				error: error,
			});
			new Notice("Failed to open quick actions");
		}
	}

	async openQuickActionsForTaskUnderCursor(
		editor: Editor,
		sourceFile?: TFile | null
	): Promise<void> {
		try {
			const activeFile = sourceFile ?? this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice("No file is currently open");
				return;
			}

			const detectionService = await this.getTaskLinkDetectionService();
			const link = this.getTaskLinkAtCursor(editor, detectionService);
			if (!link) {
				new Notice("No task link found");
				return;
			}

			const detected = await detectionService.detectTaskLink(
				link.match,
				activeFile.path,
				link.type
			);
			if (!detected.isValidTaskLink || !detected.taskInfo) {
				new Notice("No task link found");
				return;
			}

			await this.openQuickActionsForTaskInfo(detected.taskInfo);
		} catch (error) {
			tasknotesLogger.error("Error opening quick actions for task under cursor:", {
				category: "persistence",
				operation: "opening-quick-actions-task-under-cursor",
				error: error,
			});
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

	async cycleCurrentTaskStatus(): Promise<void> {
		try {
			const taskInfo = await this.getCurrentTaskForCommand();
			if (!taskInfo) {
				return;
			}

			const nextStatus = this.statusManager.getNextStatus(taskInfo.status);
			await this.updateTaskProperty(taskInfo, "status", nextStatus);
		} catch (error) {
			tasknotesLogger.error("Failed to cycle current task status:", {
				category: "persistence",
				operation: "cycle-current-task-status",
				error: error,
			});
			new Notice("Failed to cycle task status");
		}
	}

	async cycleCurrentTaskPriority(): Promise<void> {
		try {
			const taskInfo = await this.getCurrentTaskForCommand();
			if (!taskInfo) {
				return;
			}

			const currentPriority = taskInfo.priority || this.settings.defaultTaskPriority;
			const nextPriority = this.priorityManager.getNextPriority(currentPriority);
			await this.updateTaskProperty(taskInfo, "priority", nextPriority);
		} catch (error) {
			tasknotesLogger.error("Failed to cycle current task priority:", {
				category: "persistence",
				operation: "cycle-current-task-priority",
				error: error,
			});
			new Notice("Failed to cycle task priority");
		}
	}

	private async getCurrentTaskForCommand(
		notTaskNotice = "Current file is not a task"
	): Promise<TaskInfo | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No file is currently open");
			return null;
		}

		const taskInfo = await this.cacheManager.getTaskInfo(activeFile.path);
		if (!taskInfo) {
			new Notice(notTaskNotice);
			return null;
		}

		return taskInfo;
	}

	private async getTaskLinkDetectionService(): Promise<TaskLinkDetectionServiceInstance> {
		if (!this.taskLinkDetectionService) {
			const { TaskLinkDetectionService } = await import(
				"./services/TaskLinkDetectionService"
			);
			this.taskLinkDetectionService = new TaskLinkDetectionService(this);
		}

		return this.taskLinkDetectionService;
	}

	private getTaskLinkAtCursor(
		editor: Editor,
		detectionService: TaskLinkDetectionServiceInstance
	): TaskLinkMatch | null {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const links = detectionService.findWikilinks(line);

		return (
			links.find(
				(link) =>
					cursor.ch >= link.start &&
					cursor.ch <= link.end &&
					(link.type === "wikilink" || link.type === "markdown")
			) ?? null
		);
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
			tasknotesLogger.error("Error opening task edit modal from file menu:", {
				category: "persistence",
				operation: "opening-task-edit-modal-file-menu",
				error: error,
			});
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

		await this.openQuickActionsForTaskInfo(taskInfo);
	}

	private async openQuickActionsForTaskInfo(taskInfo: TaskInfo): Promise<void> {
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
			tasknotesLogger.error("Failed to add project to current task:", {
				category: "persistence",
				operation: "add-project-current-task",
				error: error,
			});
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
					this.i18n.translate("contextMenus.task.organization.notices.noEligibleSubtasks")
				);
				return;
			}

			openTaskSelector(this, candidates, (subtask) => {
				if (!subtask) return;
				void this.assignSelectedSubtaskToCurrentNote(activeFile, subtask);
			});
		} catch (error) {
			tasknotesLogger.error("Failed to add subtask to current note:", {
				category: "persistence",
				operation: "add-subtask-current-note",
				error: error,
			});
			new Notice(
				this.i18n.translate("contextMenus.task.organization.notices.subtaskSelectFailed")
			);
		}
	}

	private async addSelectedProjectToTask(task: TaskInfo, projectFile: TFile): Promise<void> {
		try {
			await addTaskToProject(this, task, projectFile);
		} catch (error) {
			tasknotesLogger.error("Failed to add selected project to task:", {
				category: "persistence",
				operation: "add-selected-project-task",
				error: error,
			});
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
			tasknotesLogger.error("Failed to assign selected subtask to current note:", {
				category: "persistence",
				operation: "assign-selected-subtask-current-note",
				error: error,
			});
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
			tasknotesLogger.error("Error creating inline task:", {
				category: "persistence",
				operation: "creating-inline-task",
				error: error,
			});
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
			tasknotesLogger.error("Error handling inline task creation:", {
				category: "persistence",
				operation: "handling-inline-task-creation",
				error: error,
			});
			new Notice("Failed to insert task link");
		}
	}
}
