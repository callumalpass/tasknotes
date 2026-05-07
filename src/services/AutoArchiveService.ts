/* eslint-disable no-console */
import { PendingAutoArchive, TaskInfo, StatusConfig } from "../types";
import TaskNotesPlugin from "../main";

/**
 * Service for automatically archiving tasks based on status configuration.
 * Uses a persistent queue that survives plugin restarts.
 */
export class AutoArchiveService {
	private plugin: TaskNotesPlugin;
	private processorInterval: ReturnType<typeof setInterval> | null = null;
	private readonly PROCESSOR_INTERVAL_MS = 60000; // Check every 60 seconds

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	private hasGoogleCalendarLink(task: TaskInfo): boolean {
		return !!(task.googleCalendarEventId || task.googleCalendarExceptionEventId);
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
		// Reconcile completed tasks that may have been changed outside TaskNotes while offline.
		await this.reconcileAllTasks();

		// Process any missed archives from when plugin was offline.
		await this.processDueArchives();

		// Start periodic processor
		this.processorInterval = setInterval(() => {
			this.processDueArchives().catch((error) => {
				console.error("Error processing auto-archive queue:", error);
			});
		}, this.PROCESSOR_INTERVAL_MS);
	}

	/**
	 * Stop the auto-archive service
	 */
	stop(): void {
		if (this.processorInterval) {
			clearInterval(this.processorInterval);
			this.processorInterval = null;
		}
	}

	/**
	 * Schedule a task for auto-archiving based on its status
	 */
	async scheduleAutoArchive(
		task: TaskInfo,
		statusConfig: StatusConfig,
		statusChangeTimestamp = Date.now()
	): Promise<void> {
		if (!statusConfig.autoArchive) {
			return;
		}

		const archiveAfter =
			statusChangeTimestamp + statusConfig.autoArchiveDelay * 60 * 1000; // Convert minutes to ms

		const pendingArchive: PendingAutoArchive = {
			taskPath: task.path,
			statusChangeTimestamp,
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
	 * Reconcile a task whose file may have changed outside the TaskNotes write path.
	 */
	async reconcileTask(task: TaskInfo): Promise<void> {
		const queue = await this.getQueue();
		const { queue: reconciledQueue, changed } = this.reconcileTaskQueue(task, queue);

		if (changed) {
			await this.saveQueue(reconciledQueue);
		}
	}

	/**
	 * Reconcile one updated task file and process any newly due archive.
	 */
	async reconcileTaskByPath(taskPath: string): Promise<void> {
		const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
		if (!task) {
			await this.cancelAutoArchive(taskPath);
			return;
		}

		await this.reconcileTask(task);
		await this.processDueArchives();
	}

	/**
	 * Reconcile all current tasks against the persisted queue.
	 */
	async reconcileAllTasks(): Promise<void> {
		const tasks = await this.plugin.cacheManager.getAllTasks();
		if (!tasks || tasks.length === 0) {
			return;
		}

		let queue = await this.getQueue();
		let changed = false;

		for (const task of tasks) {
			const result = this.reconcileTaskQueue(task, queue);
			queue = result.queue;
			changed = changed || result.changed;
		}

		if (changed) {
			await this.saveQueue(queue);
		}
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
	async processDueArchives(): Promise<void> {
		await this.processQueue();
	}

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
				console.error(`Error processing auto-archive for ${item.taskPath}:`, error);
				// Keep item for retry on next cycle
				remainingItems.push(item);
			}
		}

		// Save updated queue (items not processed + items to keep)
		const updatedQueue = [...remainingItems, ...toKeep];
		await this.saveQueue(updatedQueue);
	}

	private reconcileTaskQueue(
		task: TaskInfo,
		queue: PendingAutoArchive[]
	): { queue: PendingAutoArchive[]; changed: boolean } {
		const statusConfig = this.plugin.statusManager.getStatusConfig(task.status);
		const existing = queue.find((item) => item.taskPath === task.path);

		if (task.archived) {
			if (existing && this.hasGoogleCalendarLink(task)) {
				return { queue, changed: false };
			}

			if (!existing) {
				return { queue, changed: false };
			}

			return {
				queue: queue.filter((item) => item.taskPath !== task.path),
				changed: true,
			};
		}

		if (!statusConfig?.autoArchive) {
			if (!existing) {
				return { queue, changed: false };
			}

			return {
				queue: queue.filter((item) => item.taskPath !== task.path),
				changed: true,
			};
		}

		if (existing?.statusValue === statusConfig.value) {
			return { queue, changed: false };
		}

		const statusChangeTimestamp = this.inferStatusChangeTimestamp(task);
		const pendingArchive: PendingAutoArchive = {
			taskPath: task.path,
			statusChangeTimestamp,
			archiveAfterTimestamp:
				statusChangeTimestamp + statusConfig.autoArchiveDelay * 60 * 1000,
			statusValue: statusConfig.value,
		};

		return {
			queue: [...queue.filter((item) => item.taskPath !== task.path), pendingArchive],
			changed: true,
		};
	}

	private inferStatusChangeTimestamp(task: TaskInfo): number {
		const completedDatePart = this.getDatePart(task.completedDate);
		const modifiedDatePart = this.getDatePart(task.dateModified);
		const modifiedTimestamp = this.parseTimestamp(task.dateModified);

		if (
			completedDatePart &&
			modifiedDatePart === completedDatePart &&
			task.dateModified &&
			this.hasTimeComponent(task.dateModified) &&
			modifiedTimestamp !== null
		) {
			return modifiedTimestamp;
		}

		if (task.completedDate && this.hasTimeComponent(task.completedDate)) {
			const completedTimestamp = this.parseTimestamp(task.completedDate);
			if (completedTimestamp !== null) {
				return completedTimestamp;
			}
		}

		if (completedDatePart) {
			const endOfCompletedDate = this.parseDateEndOfDay(completedDatePart);
			if (endOfCompletedDate !== null) {
				return endOfCompletedDate;
			}
		}

		return modifiedTimestamp ?? Date.now();
	}

	private parseTimestamp(value?: string): number | null {
		if (!value) {
			return null;
		}

		const normalized = value.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
		const timestamp = Date.parse(normalized);

		return Number.isFinite(timestamp) ? timestamp : null;
	}

	private getDatePart(value?: string): string | null {
		const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
		return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
	}

	private hasTimeComponent(value: string): boolean {
		return /[T\s]\d{2}:\d{2}/.test(value);
	}

	private parseDateEndOfDay(datePart: string): number | null {
		const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!match) {
			return null;
		}

		const [, year, month, day] = match;
		const date = new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			23,
			59,
			59,
			999
		);

		if (
			date.getFullYear() !== Number(year) ||
			date.getMonth() !== Number(month) - 1 ||
			date.getDate() !== Number(day)
		) {
			return null;
		}

		return date.getTime();
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
					console.warn(
						`Auto-archive Google cleanup deferred until calendar sync is ready for ${item.taskPath}`
					);
					return false;
				}

				const deleted =
					await this.plugin.taskCalendarSyncService.deleteTaskFromCalendar(currentTask);
				if (!deleted) {
					console.warn(
						`Auto-archive Google cleanup still pending for ${item.taskPath}`
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
					console.warn(
						`Auto-archive Google cleanup deferred until calendar sync is ready for ${item.taskPath}`
					);
				}
				return false;
			}
			return true;
		} catch (error) {
			console.error(`Failed to archive task ${item.taskPath}:`, error);
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
