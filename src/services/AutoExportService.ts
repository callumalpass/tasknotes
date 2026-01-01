/* eslint-disable no-console */
import { Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { CalendarExportService } from "./CalendarExportService";
import { TranslationKey } from "../i18n";

export class AutoExportService {
	private plugin: TaskNotesPlugin;
	private intervalId: number | null = null;
	private lastExportTime: Date | null = null;
	private nextExportTime: Date | null = null;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	private translate(key: TranslationKey, variables?: Record<string, any>): string {
		return this.plugin.i18n.translate(key, variables);
	}

	/**
	 * Start the automatic export service
	 */
	start(): void {
		if (!this.plugin.settings.icsIntegration.enableAutoExport) {
			return;
		}

		this.stop(); // Stop any existing interval

		const intervalMinutes = this.plugin.settings.icsIntegration.autoExportInterval;
		const intervalMs = intervalMinutes * 60 * 1000;

		// Set next export time
		this.nextExportTime = new Date(Date.now() + intervalMs);

		this.intervalId = setInterval(async () => {
			await this.performExport();
			// Update next export time
			this.nextExportTime = new Date(Date.now() + intervalMs);
		}, intervalMs) as unknown as number;

		console.log(`TaskNotes: Auto export started (interval: ${intervalMinutes} minutes)`);
	}

	/**
	 * Stop the automatic export service
	 */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
			this.nextExportTime = null;
		}
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
				console.log("TaskNotes: Auto export skipped - no tasks found");
				return;
			}

			// Generate ICS content with export options from settings
			const exportOptions = {
				useDurationForExport: this.plugin.settings.icsIntegration.useDurationForExport,
			};
			const icsContent = CalendarExportService.generateMultipleTasksICSContent(allTasks, exportOptions);

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
			console.log(
				`TaskNotes: Auto export completed - ${allTasks.length} tasks exported to ${exportPath}`
			);
		} catch (error) {
			console.error("TaskNotes: Auto export failed:", error);

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
