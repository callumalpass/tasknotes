import type TaskNotesPlugin from "../main";
import type { EventRef } from "obsidian";
import { TaskNotesSettingTab } from "../settings/TaskNotesSettingTab";
import { perfMonitor } from "../utils/PerformanceMonitor";
import { registerCliHandlers } from "../cli/registerCliHandlers";
import { TranslatedCommandRegistry } from "../commands/TranslatedCommandRegistry";
import { WorkspaceNavigationService } from "../ui/WorkspaceNavigationService";
import { TaskActionCoordinator } from "../ui/TaskActionCoordinator";
import { SettingsLifecycleService } from "../services/SettingsLifecycleService";
import { unregisterBasesViews } from "../bases/registration";
import {
	initializeCoreServices,
	registerRibbonIcons,
	registerTaskNotesIcon,
} from "./pluginBootstrap";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bootstrap/PluginRuntime" });

export async function initializePluginRuntime(plugin: TaskNotesPlugin): Promise<void> {
	registerTaskNotesIcon();
	await initializeCoreServices(plugin);

	plugin.workspaceNavigationService = new WorkspaceNavigationService(plugin);
	plugin.taskActionCoordinator = new TaskActionCoordinator(plugin);
	plugin.settingsLifecycleService = new SettingsLifecycleService(plugin);
	plugin.commandRegistry = new TranslatedCommandRegistry(plugin);
	plugin.settingsLifecycleService.captureCurrentSettings();

	registerRibbonIcons(plugin);
	plugin.commandRegistry.register();
	registerCliHandlers(plugin);
	plugin.addSettingTab(new TaskNotesSettingTab(plugin.app, plugin));
}

export async function cleanupPluginRuntime(plugin: TaskNotesPlugin): Promise<void> {
	if (plugin.settings?.enableBases) {
		try {
			unregisterBasesViews(plugin);
			plugin.basesRegistered = false;
		} catch (error) {
			tasknotesLogger.debug("[TaskNotes][Bases] Unregistration failed:", {
				category: "internal",
				operation: "unregistration",
				error: error,
			});
		}
	}

	const cacheStats = perfMonitor.getStats("cache-initialization");
	if (cacheStats && cacheStats.count > 0) {
		perfMonitor.logSummary();
	}

	plugin.pomodoroService?.cleanup();
	plugin.filterService?.cleanup();
	plugin.viewPerformanceService?.destroy();

	if (plugin.taskCardReadingModeCleanup) {
		plugin.taskCardReadingModeCleanup();
		plugin.taskCardReadingModeCleanup = null;
	}

	if (plugin.relationshipsReadingModeCleanup) {
		plugin.relationshipsReadingModeCleanup();
		plugin.relationshipsReadingModeCleanup = null;
	}

	plugin.autoArchiveService?.stop();
	plugin.icsSubscriptionService?.destroy();
	plugin.autoExportService?.destroy();
	plugin.taskLinkDetectionService?.cleanup();
	plugin.dragDropManager?.destroy();
	void plugin.apiService?.stop();
	void plugin.oauthService?.destroy();
	plugin.taskFileLifecycleReconciliationService?.destroy();
	plugin.taskCalendarSyncService?.destroy();
	plugin.timeblockCalendarSyncService?.destroy();
	plugin.googleCalendarService?.destroy();
	plugin.microsoftCalendarService?.destroy();
	plugin.calendarProviderRegistry?.destroyAll();
	plugin.viewStateManager?.cleanup();
	plugin.statusBarService?.destroy();
	plugin.notificationService?.destroy();
	plugin.projectSubtasksService?.destroy();
	plugin.cacheManager?.destroy();
	plugin.dependencyCache?.destroy();
	plugin.requestDeduplicator?.cancelAll();
	plugin.domReconciler?.destroy();
	plugin.uiStateManager?.destroy();
	plugin.settingsLifecycleService?.destroy();
	plugin.performanceProfiler?.destroy();

	if (typeof perfMonitor !== "undefined") {
		perfMonitor.destroy();
	}

	if (plugin.taskUpdateListenerForEditor) {
		plugin.emitter.offref(plugin.taskUpdateListenerForEditor as EventRef);
	}

	plugin.initializationComplete = false;
}
