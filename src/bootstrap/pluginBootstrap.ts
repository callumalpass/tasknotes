import { Editor, MarkdownView, Notice, Platform, addIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
import type TaskNotesPlugin from "../main";
import { EVENT_DATA_CHANGED, EVENT_TASK_UPDATED, POMODORO_STATS_VIEW_TYPE, POMODORO_VIEW_TYPE, STATS_VIEW_TYPE, TaskInfo } from "../types";
import { RequestDeduplicator, PredictivePrefetcher } from "../utils/RequestDeduplicator";
import { DOMReconciler, UIStateManager } from "../utils/DOMReconciler";
import { FieldMapper } from "../services/FieldMapper";
import { StatusManager } from "../services/StatusManager";
import { PriorityManager } from "../services/PriorityManager";
import { TaskManager } from "../utils/TaskManager";
import { DependencyCache } from "../utils/DependencyCache";
import { TaskService } from "../services/TaskService";
import { FilterService } from "../services/FilterService";
import { TaskStatsService } from "../services/TaskStatsService";
import { ViewStateManager } from "../services/ViewStateManager";
import { ProjectSubtasksService } from "../services/ProjectSubtasksService";
import { ExpandedProjectsService } from "../services/ExpandedProjectsService";
import { AutoArchiveService } from "../services/AutoArchiveService";
import { DragDropManager } from "../utils/DragDropManager";
import { StatusBarService } from "../services/StatusBarService";
import { NotificationService } from "../services/NotificationService";
import { ViewPerformanceService } from "../services/ViewPerformanceService";
import { PomodoroView } from "../views/PomodoroView";
import { PomodoroStatsView } from "../views/PomodoroStatsView";
import { StatsView } from "../views/StatsView";
import { ReleaseNotesView, RELEASE_NOTES_VIEW_TYPE } from "../views/ReleaseNotesView";
import { RELEASE_NOTES_BUNDLE, CURRENT_VERSION } from "../releaseNotes";
import { createTaskLinkOverlay, dispatchTaskUpdate } from "../editor/TaskLinkOverlay";
import {
	createRelationshipsDecorations,
	setupReadingModeHandlers as setupRelationshipsReadingMode,
} from "../editor/RelationshipsDecorations";
import {
	createTaskCardNoteDecorations,
	setupReadingModeHandlers as setupTaskCardReadingMode,
} from "../editor/TaskCardNoteDecorations";
import { createReadingModeTaskLinkProcessor } from "../editor/ReadingModeTaskLinkProcessor";
import { ICSSubscriptionService } from "../services/ICSSubscriptionService";
import { ICSNoteService } from "../services/ICSNoteService";
import { OAuthService } from "../services/OAuthService";
import { GoogleCalendarService } from "../services/GoogleCalendarService";
import { MicrosoftCalendarService } from "../services/MicrosoftCalendarService";
import { CalendarProviderRegistry } from "../services/CalendarProvider";
import { PomodoroService } from "../services/PomodoroService";
import { AutoExportService } from "../services/AutoExportService";

type FileDeletedEventData = { path: string; prevCache?: unknown };

export function registerTaskNotesIcon(): void {
	addIcon(
		"tasknotes-simple",
		`<g>
		<defs>
			<mask id="tasknotes-mask">
				<rect width="100" height="100" fill="white"/>
				<path fill="black" d="m 5.9,52.4 -0.09,4.51 c 4.71,0.09 7.61,1.48 9.95,3.57 2.35,2.09 4.11,5.01 5.90,8.14 1.80,3.13 3.62,6.46 6.45,9.12 2.23,2.09 5.14,3.67 8.83,4.21 0.46,-1.51 1.05,-2.95 1.77,-4.33 -3.44,-0.21 -5.62,-1.39 -7.53,-3.17 -2.14,-2.01 -3.82,-4.92 -5.63,-8.08 -1.81,-3.16 -3.77,-6.56 -6.82,-9.27 -3.05,-2.71 -7.07,-4.59 -11.83,-4.70 z"/>
				<path fill="black" d="M 73.6,18.3 69.9,20.9 c 4.06,5.75 4.40,11.33 2.77,16.78 -1.63,5.45 -5.41,10.67 -9.65,14.78 -8.49,8.20 -16.59,14.11 -21.83,21.18 -5.24,7.07 -7.22,15.59 -3.13,27.21 l 4.25,-1.50 c -3.74,-10.62 -2.11,-16.80 2.50,-23.01 4.61,-6.21 12.63,-12.19 21.34,-20.64 4.65,-4.50 8.89,-10.23 10.84,-16.72 1.95,-6.49 1.42,-13.86 -3.40,-20.68 z"/>
			</mask>
		</defs>
		<path fill="currentColor" mask="url(#tasknotes-mask)" d="m 98.5,0.6 c -0.38,0 -0.83,0.09 -1.33,0.23 -2,0.59 -4.66,2.18 -5.78,3.22 -1.25,1.16 -4.16,4.93 -6.08,7.19 -2.67,3.12 -5.65,6.58 -9.32,11.13 2.58,5.61 2.61,11.38 1.05,16.60 -1.95,6.49 -6.19,12.22 -10.84,16.72 -8.71,8.43 -16.73,14.41 -21.34,20.64 -4.47,6.03 -6.13,12.03 -2.81,22.08 0.19,-0.23 0.37,-0.49 0.54,-0.80 10.57,-19.70 17.89,-27.30 41.9,-47.08 v 0 c 2.40,-1.97 3.71,-4.33 4.52,-7.14 0.81,-2.82 1.11,-6.10 1.52,-9.92 0.81,-7.64 2.02,-17.43 8.43,-29.95 0.37,-0.73 0.57,-1.30 0.62,-1.72 0.05,-0.43 -0.04,-0.71 -0.22,-0.90 -0.19,-0.18 -0.48,-0.27 -0.86,-0.26 z M 72.7,26.3 c -0.75,0.92 -1.51,1.84 -2.27,2.78 -9.09,11.05 -19.45,22.93 -28.54,29.97 -1.48,1.14 -2.98,1.54 -4.46,1.38 -1.49,-0.16 -2.97,-0.89 -4.43,-1.96 -2.91,-2.16 -5.74,-5.74 -8.35,-9.19 -2.62,-3.45 -5.04,-6.77 -7.12,-8.39 -1.04,-0.81 -1.99,-1.19 -2.83,-0.97 -0.84,0.22 -1.60,1.05 -2.26,2.70 -1.03,2.61 -1.60,6.22 -3.42,10.05 4.08,0.62 7.27,2.27 9.73,4.45 3.05,2.71 5.01,6.11 6.82,9.27 1.81,3.16 3.49,6.07 5.63,8.08 1.90,1.78 4.08,2.96 7.53,3.17 0.71,-1.37 1.55,-2.69 2.49,-3.95 5.24,-7.07 13.34,-12.98 21.83,-21.18 4.24,-4.11 8.02,-9.33 9.65,-14.78 1.12,-3.73 1.31,-7.53 0.01,-11.42 z M 10.3,49.1 c -0.09,0.29 -0.18,0.56 -0.28,0.85 0.10,-0.29 0.19,-0.56 0.28,-0.85 z m -4.02,7.84 c -0.01,0.01 -0.02,0.02 -0.03,0.03 0.01,-0.01 0.02,-0.02 0.03,-0.03 0,0 0,0 0,0 z m 0.12,0 c -1.08,1.40 -2.40,2.79 -4.05,4.12 -1.20,1.0 -1.85,1.86 -2.03,2.71 -0.18,0.85 0.10,1.67 0.76,2.53 1.32,1.71 4.16,3.54 7.81,5.91 7.28,4.73 17.75,11.63 25.63,24.16 0.64,1.02 1.74,2.04 2.95,2.65 -0.91,-5.36 -0.91,-8.78 -0.54,-11.88 -3.33,-0.55 -6.07,-2.12 -8.39,-4.72 -2.83,-3.17 -4.69,-6.59 -6.54,-9.85 -1.85,-3.26 -3.69,-6.37 -6.08,-8.47 -2.06,-1.81 -4.61,-3.0 -8.49,-3.17 z"/>
	</g>`
	);
}

export async function initializeCoreServices(plugin: TaskNotesPlugin): Promise<void> {
	plugin.fieldMapper = new FieldMapper(plugin.settings.fieldMapping);
	plugin.statusManager = new StatusManager(
		plugin.settings.customStatuses,
		plugin.settings.defaultTaskStatus
	);
	plugin.priorityManager = new PriorityManager(plugin.settings.customPriorities);

	plugin.requestDeduplicator = new RequestDeduplicator();
	plugin.predictivePrefetcher = new PredictivePrefetcher(plugin.requestDeduplicator);
	plugin.domReconciler = new DOMReconciler();
	plugin.uiStateManager = new UIStateManager();

	plugin.cacheManager = new TaskManager(plugin.app, plugin.settings, plugin.fieldMapper);
	plugin.emitter = plugin.cacheManager;

	plugin.dependencyCache = new DependencyCache(
		plugin.app,
		plugin.settings,
		plugin.fieldMapper,
		plugin.statusManager,
		(frontmatter: unknown) => plugin.cacheManager.isTaskFile(frontmatter)
	);
	plugin.cacheManager.setDependencyCache(plugin.dependencyCache);

	plugin.taskService = new TaskService(plugin);
	plugin.filterService = new FilterService(
		plugin.cacheManager,
		plugin.statusManager,
		plugin.priorityManager,
		plugin
	);
	plugin.taskStatsService = new TaskStatsService(plugin.cacheManager, plugin.statusManager);
	plugin.viewStateManager = new ViewStateManager(plugin.app, plugin);
	plugin.projectSubtasksService = new ProjectSubtasksService(plugin);
	plugin.expandedProjectsService = new ExpandedProjectsService(plugin);
	plugin.autoArchiveService = new AutoArchiveService(plugin);

	const { TaskSelectionService } = await import("../services/TaskSelectionService");
	plugin.taskSelectionService = new TaskSelectionService(plugin);
	plugin.dragDropManager = new DragDropManager(plugin);
	plugin.statusBarService = new StatusBarService(plugin);
	plugin.notificationService = new NotificationService(plugin);
	plugin.viewPerformanceService = new ViewPerformanceService(plugin);

	const { BasesFilterConverter } = await import("../services/BasesFilterConverter");
	plugin.basesFilterConverter = new BasesFilterConverter(plugin);

	const { MdbaseSpecService } = await import("../services/MdbaseSpecService");
	plugin.mdbaseSpecService = new MdbaseSpecService(plugin);

	plugin.icsSubscriptionService = new ICSSubscriptionService(plugin);
	plugin.icsNoteService = new ICSNoteService(plugin);
	plugin.taskService.setAutoArchiveService(plugin.autoArchiveService);
}

export function registerRibbonIcons(plugin: TaskNotesPlugin): void {
	plugin.addRibbonIcon("calendar-days", plugin.i18n.translate("commands.openCalendarView"), async () => {
		await plugin.activateCalendarView();
	});

	plugin.addRibbonIcon("calendar", plugin.i18n.translate("commands.openAdvancedCalendarView"), async () => {
		await plugin.openBasesFileForCommand("open-advanced-calendar-view");
	});

	plugin.addRibbonIcon("check-square", plugin.i18n.translate("commands.openTasksView"), async () => {
		await plugin.openBasesFileForCommand("open-tasks-view");
	});

	plugin.addRibbonIcon("list", plugin.i18n.translate("commands.openAgendaView"), async () => {
		await plugin.openBasesFileForCommand("open-agenda-view");
	});

	plugin.addRibbonIcon("columns-3", plugin.i18n.translate("commands.openKanbanView"), async () => {
		await plugin.openBasesFileForCommand("open-kanban-view");
	});

	plugin.addRibbonIcon("timer", plugin.i18n.translate("commands.openPomodoroView"), async () => {
		await plugin.activatePomodoroView();
	});

	plugin.addRibbonIcon(
		"bar-chart-3",
		plugin.i18n.translate("commands.openPomodoroStats"),
		async () => {
			await plugin.activatePomodoroStatsView();
		}
	);

	plugin.addRibbonIcon("tasknotes-simple", plugin.i18n.translate("commands.createNewTask"), () => {
		plugin.openTaskCreationModal();
	});
}

export function initializeCalendarProviders(plugin: TaskNotesPlugin): void {
	plugin.oauthService = new OAuthService(plugin);
	plugin.googleCalendarService = new GoogleCalendarService(plugin, plugin.oauthService);
	plugin.microsoftCalendarService = new MicrosoftCalendarService(plugin, plugin.oauthService);
	plugin.calendarProviderRegistry = new CalendarProviderRegistry();
	plugin.calendarProviderRegistry.register(plugin.googleCalendarService);
	plugin.calendarProviderRegistry.register(plugin.microsoftCalendarService);
}

export async function registerBasesIntegration(plugin: TaskNotesPlugin): Promise<void> {
	if (!plugin.settings?.enableBases || plugin.basesRegistered) {
		return;
	}

	try {
		const { registerBasesTaskList } = await import("../bases/registration");
		await registerBasesTaskList(plugin);
		plugin.basesRegistered = true;
	} catch (error) {
		console.debug("[TaskNotes][Bases] Registration failed:", error);
	}
}

export async function initializeHTTPAPI(plugin: TaskNotesPlugin): Promise<void> {
	if (Platform.isMobile || !plugin.settings.enableAPI) {
		return;
	}

	try {
		const { HTTPAPIService } = await import("../services/HTTPAPIService");

		plugin.apiService = new HTTPAPIService(
			plugin,
			plugin.taskService,
			plugin.filterService,
			plugin.cacheManager
		);

		plugin.taskService.setWebhookNotifier(plugin.apiService);
		plugin.pomodoroService.setWebhookNotifier(plugin.apiService);
		await plugin.apiService.start();
		new Notice(`TaskNotes API started on port ${plugin.apiService.getPort()}`);
	} catch (error) {
		console.error("Failed to initialize HTTP API:", error);
		new Notice("Failed to start TaskNotes API server. Check console for details.");
	}
}

export async function initializeAfterLayoutReady(plugin: TaskNotesPlugin): Promise<void> {
	if (plugin.initializationComplete) {
		return;
	}
	plugin.initializationComplete = true;

	try {
		if (plugin.settings.autoCreateDefaultBasesFiles) {
			await plugin.ensureBasesViewFiles();
		}

		plugin.injectCustomStyles();
		registerActiveViews(plugin);
		registerEditorIntegrations(plugin);

		plugin.cacheManager.initialize();
		plugin.dependencyCache.initialize();
		plugin.filterService.initialize();
		plugin.statusBarService.initialize();
		await plugin.notificationService.initialize();
		await plugin.warmupProjectIndexes();
		await plugin.autoArchiveService.start();
		plugin.setupDateChangeDetection();
		initializeServicesLazily(plugin);
		await registerBasesIntegration(plugin);
	} catch (error) {
		console.error("Error during post-layout initialization:", error);
	}
}

function registerActiveViews(plugin: TaskNotesPlugin): void {
	plugin.registerView(POMODORO_VIEW_TYPE, (leaf) => new PomodoroView(leaf, plugin));
	plugin.registerView(POMODORO_STATS_VIEW_TYPE, (leaf) => new PomodoroStatsView(leaf, plugin));
	plugin.registerView(STATS_VIEW_TYPE, (leaf) => new StatsView(leaf, plugin));
	plugin.registerView(
		RELEASE_NOTES_VIEW_TYPE,
		(leaf) => new ReleaseNotesView(leaf, plugin, RELEASE_NOTES_BUNDLE, CURRENT_VERSION)
	);
}

function registerEditorIntegrations(plugin: TaskNotesPlugin): void {
	plugin.registerEditorExtension(createTaskLinkOverlay(plugin));
	plugin.registerEditorExtension(createTaskCardNoteDecorations(plugin));
	plugin.taskCardReadingModeCleanup = setupTaskCardReadingMode(plugin);
	plugin.registerEditorExtension(createRelationshipsDecorations(plugin));
	plugin.relationshipsReadingModeCleanup = setupRelationshipsReadingMode(plugin);
	plugin.registerMarkdownPostProcessor(createReadingModeTaskLinkProcessor(plugin));
}

export function initializeServicesLazily(plugin: TaskNotesPlugin): void {
	setTimeout(async () => {
		try {
			plugin.pomodoroService = new PomodoroService(plugin);
			await plugin.pomodoroService.initialize();
			await plugin.icsSubscriptionService.initialize();

			plugin.autoExportService = new AutoExportService(plugin);
			plugin.autoExportService.start();

			plugin.googleCalendarService.on("data-changed", () => {
				plugin.notifyDataChanged(undefined, false, true);
			});
			await plugin.googleCalendarService.initialize();

			plugin.taskCalendarSyncService = new (await import("../services/TaskCalendarSyncService"))
				.TaskCalendarSyncService(plugin, plugin.googleCalendarService);

			plugin.registerEvent(
				plugin.emitter.on("file-deleted", (data: FileDeletedEventData) => {
					if (!plugin.taskCalendarSyncService?.isEnabled()) {
						return;
					}

					const eventIdKey = plugin.fieldMapper.toUserField("googleCalendarEventId");
					const prevCache = data.prevCache as { frontmatter?: Record<string, unknown> } | undefined;
					const eventId = prevCache?.frontmatter?.[eventIdKey];

					if (typeof eventId === "string" && eventId.length > 0) {
						plugin.taskCalendarSyncService
							.deleteTaskFromCalendarByPath(data.path, eventId)
							.catch((error) => {
								console.warn(
									"Failed to delete task from Google Calendar on file deletion:",
									error
								);
							});
					}
				})
			);

			plugin.microsoftCalendarService.on("data-changed", () => {
				plugin.notifyDataChanged(undefined, false, true);
			});
			await plugin.microsoftCalendarService.initialize();

			await initializeHTTPAPI(plugin);

			const { TaskLinkDetectionService } = await import("../services/TaskLinkDetectionService");
			plugin.taskLinkDetectionService = new TaskLinkDetectionService(plugin);

			const { InstantTaskConvertService } = await import(
				"../services/InstantTaskConvertService"
			);
			plugin.instantTaskConvertService = new InstantTaskConvertService(
				plugin,
				plugin.statusManager,
				plugin.priorityManager
			);

			const { createInstantConvertButtons } = await import("../editor/InstantConvertButtons");
			plugin.registerEditorExtension(createInstantConvertButtons(plugin));

			plugin.taskUpdateListenerForEditor = plugin.emitter.on(
				EVENT_TASK_UPDATED,
				(data: { path?: string; updatedTask?: TaskInfo }) => {
					plugin.app.workspace.iterateRootLeaves((leaf) => {
						if (leaf.view && leaf.view.getViewType() === "markdown") {
							const editor = (leaf.view as MarkdownView).editor;
							if (editor && (editor as Editor & { cm?: EditorView }).cm) {
								const taskPath = data?.path || data?.updatedTask?.path;
								dispatchTaskUpdate((editor as Editor & { cm: EditorView }).cm, taskPath);
							}
						}
					});
				}
			);

			plugin.registerEvent(
				plugin.app.workspace.on("active-leaf-change", (leaf) => {
					setTimeout(() => {
						if (leaf && leaf.view && leaf.view.getViewType() === "markdown") {
							const editor = (leaf.view as MarkdownView).editor;
							if (editor && (editor as Editor & { cm?: EditorView }).cm) {
								dispatchTaskUpdate((editor as Editor & { cm: EditorView }).cm);
							}
						}
					}, 50);
				})
			);

			plugin.registerEvent(
				plugin.app.workspace.on("layout-change", () => {
					setTimeout(() => {
						const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
						if (activeView) {
							const editor = activeView.editor;
							if (editor && (editor as Editor & { cm?: EditorView }).cm) {
								dispatchTaskUpdate((editor as Editor & { cm: EditorView }).cm);
							}
						}
					}, 100);
				})
			);

			plugin.setupStatusBarEventListeners();
			plugin.setupTimeTrackingEventListeners();
			await plugin.checkForVersionUpdate();
		} catch (error) {
			console.error("Error during lazy service initialization:", error);
		}
	}, 10);
}
