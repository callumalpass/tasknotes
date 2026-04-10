import { Notice, type EventRef } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { EVENT_TASK_UPDATED } from "../types";
import type { TaskNotesSettings } from "../types/settings";

interface TaskUpdateEventData {
	path?: string;
	originalTask?: TaskInfo;
	updatedTask?: TaskInfo;
}

interface CacheSettingsSnapshot {
	taskTag: string;
	excludedFolders: string;
	disableNoteIndexing: boolean;
	storeTitleInFilename: boolean;
	fieldMapping: TaskNotesSettings["fieldMapping"];
}

interface TimeTrackingSettingsSnapshot {
	autoStopTimeTrackingOnComplete: boolean;
}

export class SettingsLifecycleService {
	private previousCacheSettings: CacheSettingsSnapshot | null = null;
	private previousTimeTrackingSettings: TimeTrackingSettingsSnapshot | null = null;
	private autoStopTimeTrackingListener: EventRef | null = null;

	constructor(private plugin: TaskNotesPlugin) {}

	captureCurrentSettings(): void {
		this.updatePreviousCacheSettings();
		this.updatePreviousTimeTrackingSettings();
	}

	setupTimeTrackingEventListeners(): void {
		if (this.autoStopTimeTrackingListener) {
			this.plugin.emitter.offref(this.autoStopTimeTrackingListener);
			this.autoStopTimeTrackingListener = null;
		}

		if (this.plugin.settings.autoStopTimeTrackingOnComplete) {
			this.autoStopTimeTrackingListener = this.plugin.emitter.on(
				EVENT_TASK_UPDATED,
				async (data: TaskUpdateEventData) => {
					await this.handleAutoStopTimeTracking(data);
				}
			);
		}

		this.updatePreviousTimeTrackingSettings();
	}

	async saveSettings(): Promise<void> {
		await this.plugin.saveSettingsDataOnly();
		this.plugin.apiService?.syncWebhookSettings?.();

		const cacheSettingsChanged = this.haveCacheSettingsChanged();
		const timeTrackingSettingsChanged = this.haveTimeTrackingSettingsChanged();

		this.plugin.fieldMapper?.updateMapping(this.plugin.settings.fieldMapping);
		this.plugin.statusManager?.updateStatuses(this.plugin.settings.customStatuses);
		this.plugin.priorityManager?.updatePriorities(this.plugin.settings.customPriorities);

		if (cacheSettingsChanged) {
			console.debug("Cache-related settings changed, updating cache configuration");
			this.plugin.cacheManager.updateConfig(this.plugin.settings);
			this.updatePreviousCacheSettings();
		}

		this.plugin.injectCustomStyles();

		if (timeTrackingSettingsChanged) {
			this.setupTimeTrackingEventListeners();
		}

		this.plugin.statusBarService?.updateVisibility();
		this.plugin.mdbaseSpecService?.onSettingsChanged();
		this.plugin.filterService?.refreshFilterOptions();
		this.plugin.notifyDataChanged();
		this.plugin.emitter.trigger("settings-changed", this.plugin.settings);
	}

	async onExternalSettingsChange(): Promise<void> {
		await this.plugin.loadSettings();
		this.plugin.apiService?.syncWebhookSettings?.();

		this.plugin.fieldMapper?.updateMapping(this.plugin.settings.fieldMapping);
		this.plugin.statusManager?.updateStatuses(this.plugin.settings.customStatuses);
		this.plugin.priorityManager?.updatePriorities(this.plugin.settings.customPriorities);

		this.plugin.cacheManager.updateConfig(this.plugin.settings);
		this.updatePreviousCacheSettings();
		this.setupTimeTrackingEventListeners();

		this.plugin.injectCustomStyles();
		this.plugin.statusBarService?.updateVisibility();
		this.plugin.filterService?.refreshFilterOptions();

		this.plugin.notifyDataChanged();
		this.plugin.emitter.trigger("settings-changed", this.plugin.settings);
	}

	destroy(): void {
		if (this.autoStopTimeTrackingListener) {
			this.plugin.emitter.offref(this.autoStopTimeTrackingListener);
			this.autoStopTimeTrackingListener = null;
		}
	}

	private async handleAutoStopTimeTracking(data: TaskUpdateEventData): Promise<void> {
		const { originalTask, updatedTask } = data;
		if (!originalTask || !updatedTask) {
			return;
		}

		let wasJustCompleted = false;
		const wasCompleted = this.plugin.statusManager.isCompletedStatus(originalTask.status);
		const isNowCompleted = this.plugin.statusManager.isCompletedStatus(updatedTask.status);
		if (!wasCompleted && isNowCompleted) {
			wasJustCompleted = true;
		}

		if (updatedTask.recurrence) {
			const originalInstances = originalTask.complete_instances || [];
			const updatedInstances = updatedTask.complete_instances || [];
			if (updatedInstances.length > originalInstances.length) {
				wasJustCompleted = true;
			}
		}

		if (!wasJustCompleted) {
			return;
		}

		const activeSession = this.plugin.getActiveTimeSession(updatedTask);
		if (!activeSession) {
			return;
		}

		try {
			await this.plugin.stopTimeTracking(updatedTask);
			if (this.plugin.settings.autoStopTimeTrackingNotification) {
				new Notice(`Auto-stopped time tracking for: ${updatedTask.title}`);
			}
			console.log(`Auto-stopped time tracking for completed task: ${updatedTask.title}`);
		} catch (error) {
			console.error("Error auto-stopping time tracking:", error);
		}
	}

	private haveCacheSettingsChanged(): boolean {
		if (!this.previousCacheSettings) {
			return true;
		}

		const current: CacheSettingsSnapshot = {
			taskTag: this.plugin.settings.taskTag,
			excludedFolders: this.plugin.settings.excludedFolders,
			disableNoteIndexing: this.plugin.settings.disableNoteIndexing,
			storeTitleInFilename: this.plugin.settings.storeTitleInFilename,
			fieldMapping: this.plugin.settings.fieldMapping,
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

	private haveTimeTrackingSettingsChanged(): boolean {
		if (!this.previousTimeTrackingSettings) {
			return true;
		}

		return (
			this.plugin.settings.autoStopTimeTrackingOnComplete !==
			this.previousTimeTrackingSettings.autoStopTimeTrackingOnComplete
		);
	}

	private updatePreviousCacheSettings(): void {
		this.previousCacheSettings = {
			taskTag: this.plugin.settings.taskTag,
			excludedFolders: this.plugin.settings.excludedFolders,
			disableNoteIndexing: this.plugin.settings.disableNoteIndexing,
			storeTitleInFilename: this.plugin.settings.storeTitleInFilename,
			fieldMapping: JSON.parse(JSON.stringify(this.plugin.settings.fieldMapping)),
		};
	}

	private updatePreviousTimeTrackingSettings(): void {
		this.previousTimeTrackingSettings = {
			autoStopTimeTrackingOnComplete: this.plugin.settings.autoStopTimeTrackingOnComplete,
		};
	}
}
