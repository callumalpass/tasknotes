import { PendingAutoArchive, TaskInfo, StatusConfig } from "../types";
import TaskNotesPlugin from "../main";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/AutoArchiveService" });

/**
 * Service for automatically archiving tasks based on status configuration.
 * Uses a persistent queue that survives plugin restarts.
 */
export class AutoArchiveService {
	private plugin: TaskNotesPlugin;
	private processorTimer: number | null = null;
	private isRunning = false;
	private readonly PROCESSOR_INTERVAL_MS = 60000; // Check every 60 seconds

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	private hasGoogleCalendarLink(task: TaskInfo): boolean {
		return !!task.googleCalendarEventId;
	}

	private normalizeStatusValue(value: unknown): string {
		return typeof value === "boolean" ? (value ? "true" : "false") : String(value);
	}

	private getCalendarCleanupState(): "ready" | "retry" | "skip" {
		const googleCalendarExport = this.plugin.settings.googleCalendarExport;

		if (!googleCalendarExport?.enabled || !googleCalendarExport?.syncOnTaskDelete) {
			return "skip";
		}

		if (!this.plugin.taskCalendarSyncService) {
			return "retry";
		}

		return this.plugin.taskCalendarSyncService.isEnabled() ? "ready" : "retry";
	}

	/**
	 * Start the auto-archive service and begin periodic processing
	 */
	async start(): Promise<void> {
		this.stop();
		this.isRunning = true;

		// Process any missed archives from when plugin was offline
		await this.processQueue();

		this.scheduleNextProcess();
	}

	/**
	 * Stop the auto-archive service
	 */
	stop(): void {
		this.isRunning = false;
		if (this.processorTimer !== null) {
			window.clearTimeout(this.processorTimer);
			this.processorTimer = null;
		}
	}

	private scheduleNextProcess(): void {
		if (!this.isRunning) {
			return;
		}

		this.processorTimer = window.setTimeout(() => {
			this.processorTimer = null;
			this.processQueue()
				.catch((error) => {
					tasknotesLogger.error("Error processing auto-archive queue:", {
						category: "persistence",
						operation: "processing-auto-archive-queue",
						error: error,
					});
				})
				.finally(() => {
					if (this.isRunning) {
						this.scheduleNextProcess();
					}
				});
		}, this.PROCESSOR_INTERVAL_MS);
	}

	/**
	 * Schedule a task for auto-archiving based on its status
	 */
	async scheduleAutoArchive(task: TaskInfo, statusConfig: StatusConfig): Promise<void> {
		if (!statusConfig.autoArchive) {
			return;
		}

		if (task.recurrence) {
			await this.cancelAutoArchive(task.path);
			return;
		}

		const now = Date.now();
		const archiveAfter = now + statusConfig.autoArchiveDelay * 60 * 1000; // Convert minutes to ms

		const pendingArchive: PendingAutoArchive = {
			taskPath: task.path,
			statusChangeTimestamp: now,
			archiveAfterTimestamp: archiveAfter,
			statusValue: statusConfig.value,
		};

		// Remove any existing entry for this task first
		await this.cancelAutoArchive(task.path);

		// Add new entry to queue
		const queue = await this.getQueue();
		queue.push(pendingArchive);
		await this.saveQueue(queue);
	}

	/**
	 * Cancel auto-archiving for a specific task
	 */
	async cancelAutoArchive(taskPath: string): Promise<void> {
		const queue = await this.getQueue();
		const filteredQueue = queue.filter((item) => item.taskPath !== taskPath);

		if (filteredQueue.length !== queue.length) {
			await this.saveQueue(filteredQueue);
		}
	}

	/**
	 * Process the queue and archive tasks that are due
	 */
	private async processQueue(): Promise<void> {
		const queue = await this.getQueue();
		if (queue.length === 0) {
			return;
		}

		const now = Date.now();
		const toProcess: PendingAutoArchive[] = [];
		const toKeep: PendingAutoArchive[] = [];

		// Separate items that are due for processing
		for (const item of queue) {
			if (now >= item.archiveAfterTimestamp) {
				toProcess.push(item);
			} else {
				toKeep.push(item);
			}
		}

		if (toProcess.length === 0) {
			return;
		}

		// Process due items
		const remainingItems: PendingAutoArchive[] = [];

		for (const item of toProcess) {
			try {
				const processed = await this.processItem(item);
				if (!processed) {
					// Keep item if it couldn't be processed
					remainingItems.push(item);
				}
			} catch (error) {
				tasknotesLogger.error(`Error processing auto-archive for ${item.taskPath}:`, {
					category: "persistence",
					operation: "processing-auto-archive",
					error: error,
				});
				// Keep item for retry on next cycle
				remainingItems.push(item);
			}
		}

		// Save updated queue (items not processed + items to keep)
		const updatedQueue = [...remainingItems, ...toKeep];
		await this.saveQueue(updatedQueue);
	}

	/**
	 * Process a single auto-archive item
	 * @returns true if successfully processed, false if should be retried
	 */
	private async processItem(item: PendingAutoArchive): Promise<boolean> {
		// Get current task to verify it still exists and has the expected status
		const currentTask = await this.plugin.cacheManager.getTaskByPath(item.taskPath);

		if (!currentTask) {
			// Task no longer exists, consider processed
			return true;
		}

		if (
			this.normalizeStatusValue(currentTask.status) !==
			this.normalizeStatusValue(item.statusValue)
		) {
			// Task status changed since scheduling, consider processed
			return true;
		}

		if (currentTask.archived) {
			if (this.hasGoogleCalendarLink(currentTask)) {
				const calendarCleanupState = this.getCalendarCleanupState();
				if (calendarCleanupState === "skip") {
					return true;
				}

				if (calendarCleanupState === "retry") {
					tasknotesLogger.warn(
						`Auto-archive Google cleanup deferred until calendar sync is ready for ${item.taskPath}`,
						{
							category: "provider",
							operation:
								"auto-archive-google-cleanup-deferred-until-calendar-sync-ready",
						}
					);
					return false;
				}

				const deleted =
					await this.plugin.taskCalendarSyncService.deleteTaskFromCalendar(currentTask);
				if (!deleted) {
					tasknotesLogger.warn(
						`Auto-archive Google cleanup still pending for ${item.taskPath}`,
						{
							category: "provider",
							operation: "auto-archive-google-cleanup-still-pending",
						}
					);
				}
				return deleted;
			}

			// Task already archived, consider processed
			return true;
		}

		// Archive the task
		try {
			const archivedTask = await this.plugin.taskService.toggleArchive(currentTask);
			if (archivedTask.archived && this.hasGoogleCalendarLink(archivedTask)) {
				item.taskPath = archivedTask.path;
				const calendarCleanupState = this.getCalendarCleanupState();
				if (calendarCleanupState === "skip") {
					return true;
				}

				if (calendarCleanupState === "retry") {
					tasknotesLogger.warn(
						`Auto-archive Google cleanup deferred until calendar sync is ready for ${item.taskPath}`,
						{
							category: "provider",
							operation:
								"auto-archive-google-cleanup-deferred-until-calendar-sync-ready",
						}
					);
				}
				return false;
			}
			return true;
		} catch (error) {
			tasknotesLogger.error(`Failed to archive task ${item.taskPath}:`, {
				category: "persistence",
				operation: "archive-task",
				error: error,
			});
			return false; // Retry later
		}
	}

	/**
	 * Get the current auto-archive queue from plugin data
	 */
	private async getQueue(): Promise<PendingAutoArchive[]> {
		const data = await this.plugin.loadData();
		return data?.autoArchiveQueue || [];
	}

	/**
	 * Save the auto-archive queue to plugin data
	 */
	private async saveQueue(queue: PendingAutoArchive[]): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		data.autoArchiveQueue = queue;
		await this.plugin.saveData(data);
	}

	/**
	 * Clear all pending auto-archives (for testing or emergency reset)
	 */
	async clearQueue(): Promise<void> {
		await this.saveQueue([]);
	}

	/**
	 * Get current queue status for debugging
	 */
	async getQueueStatus(): Promise<{ count: number; items: PendingAutoArchive[] }> {
		const queue = await this.getQueue();
		return {
			count: queue.length,
			items: queue,
		};
	}
}
