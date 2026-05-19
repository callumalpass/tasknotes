import { Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { CalendarExportService } from "./CalendarExportService";
import type { InterpolationValues, TranslationKey } from "../i18n";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/AutoExportService" });

export class AutoExportService {
	private plugin: TaskNotesPlugin;
	private scheduledExportId: number | null = null;
	private lastExportTime: Date | null = null;
	private nextExportTime: Date | null = null;
	private isRunning = false;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	private translate(key: TranslationKey, variables?: InterpolationValues): string {
		return this.plugin.i18n.translate(key, variables);
	}

	/**
	 * Start the automatic export service
	 */
	start(): void {
		if (!this.plugin.settings.icsIntegration.enableAutoExport) {
			return;
		}

		this.stop();
		this.isRunning = true;

		this.scheduleNextExport();
	}

	/**
	 * Stop the automatic export service
	 */
	stop(): void {
		this.isRunning = false;
		if (this.scheduledExportId !== null) {
			window.clearTimeout(this.scheduledExportId);
			this.scheduledExportId = null;
		}
		this.nextExportTime = null;
	}

	/**
	 * Update the export interval and restart the service
	 */
	updateInterval(newIntervalMinutes: number): void {
		if (this.plugin.settings.icsIntegration.enableAutoExport) {
			this.start(); // This will stop and restart with new interval
		}
	}

	/**
	 * Manually trigger an export
	 */
	async exportNow(): Promise<void> {
		await this.performExport();
	}

	/**
	 * Get the last export time
	 */
	getLastExportTime(): Date | null {
		return this.lastExportTime;
	}

	/**
	 * Get the next scheduled export time
	 */
	getNextExportTime(): Date | null {
		return this.nextExportTime;
	}

	private scheduleNextExport(): void {
		if (!this.isRunning || !this.plugin.settings.icsIntegration.enableAutoExport) {
			this.nextExportTime = null;
			return;
		}

		const intervalMinutes = this.plugin.settings.icsIntegration.autoExportInterval;
		const intervalMs = intervalMinutes * 60 * 1000;
		this.nextExportTime = new Date(Date.now() + intervalMs);

		this.scheduledExportId = window.setTimeout(() => {
			this.scheduledExportId = null;
			void this.performExport().finally(() => {
				if (this.isRunning) {
					this.scheduleNextExport();
				}
			});
		}, intervalMs);
	}

	/**
	 * Perform the actual export
	 */
	private async performExport(): Promise<void> {
		try {
			const exportPath =
				this.plugin.settings.icsIntegration.autoExportPath || "tasknotes-calendar.ics";

			// Get all tasks
			const allTasks = await this.plugin.cacheManager.getAllTasks();

			if (allTasks.length === 0) {
				return;
			}

			// Generate ICS content with export options from settings
			const exportOptions = {
				useDurationForExport: this.plugin.settings.icsIntegration.useDurationForExport,
				excludeArchived:
					this.plugin.settings.icsIntegration.excludeArchivedFromExport ?? false,
				excludeCompleted:
					this.plugin.settings.icsIntegration.excludeCompletedFromExport ?? false,
				completedStatuses: this.plugin.statusManager.getCompletedStatuses(),
				requireDueDate:
					this.plugin.settings.icsIntegration.requireDueDateForExport ?? false,
				requireScheduledDate:
					this.plugin.settings.icsIntegration.requireScheduledDateForExport ?? false,
				includeObsidianLink: true,
				vaultName: this.plugin.app.vault.getName(),
			};
			const icsContent = CalendarExportService.generateMultipleTasksICSContent(
				allTasks,
				exportOptions
			);

			// Write to file - use path as-is since Obsidian handles normalization
			const normalizedPath = exportPath;

			// Check if file exists
			const fileExists = await this.plugin.app.vault.adapter.exists(normalizedPath);

			if (fileExists) {
				// Update existing file
				await this.plugin.app.vault.adapter.write(normalizedPath, icsContent);
			} else {
				// Create new file
				await this.plugin.app.vault.create(normalizedPath, icsContent);
			}

			this.lastExportTime = new Date();
		} catch (error) {
			tasknotesLogger.error("TaskNotes: Auto export failed:", {
				category: "provider",
				operation: "auto-export",
				error: error,
			});

			// Only show notice for manual exports or first few failures
			if (
				!this.lastExportTime ||
				Date.now() - this.lastExportTime.getTime() > 6 * 60 * 60 * 1000
			) {
				new Notice(
					this.translate("services.autoExport.notices.exportFailed", {
						error: error instanceof Error ? error.message : String(error),
					})
				);
			}
		}
	}

	/**
	 * Clean up when the service is destroyed
	 */
	destroy(): void {
		this.stop();
	}
}
