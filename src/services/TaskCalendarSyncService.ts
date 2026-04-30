import { Notice, TFile } from "obsidian";
import { format } from "date-fns";
import TaskNotesPlugin from "../main";
import { GoogleCalendarService } from "./GoogleCalendarService";
import {
	GoogleCalendarEventIndexEntry,
	PendingGoogleCalendarDeletion,
	PendingGoogleCalendarSync,
	TaskInfo,
} from "../types";
import { convertToGoogleRecurrence } from "../utils/rruleConverter";
import { getDatePart } from "../utils/dateUtils";
import { TokenRefreshError } from "./errors";

/** Debounce delay for rapid task updates (ms) */
const SYNC_DEBOUNCE_MS = 500;

/** Max concurrent API calls during bulk sync to avoid rate limits */
const SYNC_CONCURRENCY_LIMIT = 5;

/** Minimum spacing between Google Calendar API calls (ms) to reduce 403 rate limits.
 *  Google Calendar enforces ~10 req/s per-user; 100ms keeps us comfortably under that. */
const GOOGLE_API_CALL_SPACING_MS = 100;

/** Persistent plugin-data key for Google Calendar deletion retries */
const GOOGLE_CALENDAR_DELETION_QUEUE_KEY = "googleCalendarDeletionQueue";

/** Persistent plugin-data key for task paths that currently own Google Calendar events */
const GOOGLE_CALENDAR_EVENT_INDEX_KEY = "googleCalendarEventIndex";

/** Persistent plugin-data key for task paths that need Google Calendar sync replay */
const GOOGLE_CALENDAR_SYNC_QUEUE_KEY = "googleCalendarSyncQueue";

/** How often to retry queued Google Calendar recovery work */
const RECOVERY_QUEUE_PROCESSOR_INTERVAL_MS = 60000;

type CalendarEventPayload = {
	summary: string;
	description?: string;
	start: { date?: string; dateTime?: string; timeZone?: string };
	end: { date?: string; dateTime?: string; timeZone?: string };
	colorId?: string;
	reminders?: {
		useDefault: boolean;
		overrides?: Array<{ method: string; minutes: number }>;
	};
	recurrence?: string[];
};

/**
 * Service for syncing TaskNotes tasks to Google Calendar.
 * Handles creating, updating, and deleting calendar events when tasks change.
 */
export class TaskCalendarSyncService {
	private plugin: TaskNotesPlugin;
	private googleCalendarService: GoogleCalendarService;
	private rateLimitChain: Promise<unknown> = Promise.resolve();
	private lastApiCallAt = 0;
	private recoveryQueueProcessorInterval: ReturnType<typeof setInterval> | null = null;

	/** Debounce timers for pending syncs, keyed by task path */
	private pendingSyncs: Map<string, ReturnType<typeof setTimeout>> = new Map();

	/** In-flight sync operations to prevent concurrent syncs for the same task */
	private inFlightSyncs: Map<string, Promise<void>> = new Map();

	/** Track previous task state for detecting recurrence removal */
	private previousTaskState: Map<string, TaskInfo> = new Map();

	/** Store the latest explicitly passed task object during debounce to avoid cache race conditions */
	private pendingTasks: Map<string, TaskInfo> = new Map();

	/** In-flight create operations keyed by task path to avoid duplicate Google events */
	private pendingEventCreates: Map<string, Promise<string>> = new Map();

	/** Event IDs written during this session, used while Obsidian metadata catches up */
	private taskEventIdCache: Map<string, string> = new Map();

	constructor(plugin: TaskNotesPlugin, googleCalendarService: GoogleCalendarService) {
		this.plugin = plugin;
		this.googleCalendarService = googleCalendarService;
	}

	/**
	 * Clean up pending timers (call on plugin unload)
	 */
	destroy(): void {
		for (const timer of this.pendingSyncs.values()) {
			clearTimeout(timer);
		}
		if (this.recoveryQueueProcessorInterval) {
			clearInterval(this.recoveryQueueProcessorInterval);
			this.recoveryQueueProcessorInterval = null;
		}
		this.pendingSyncs.clear();
		this.previousTaskState.clear();
		this.pendingTasks.clear();
		this.pendingEventCreates.clear();
		this.taskEventIdCache.clear();
	}

	/**
	 * Process items in parallel with a concurrency limit.
	 * Executes up to SYNC_CONCURRENCY_LIMIT operations simultaneously.
	 */
	private async processInParallel<T>(
		items: T[],
		processor: (item: T) => Promise<void>
	): Promise<void> {
		const executing: Promise<void>[] = [];

		for (const item of items) {
			const promise = processor(item).then(() => {
				executing.splice(executing.indexOf(promise), 1);
			});
			executing.push(promise);

			if (executing.length >= SYNC_CONCURRENCY_LIMIT) {
				await Promise.race(executing);
			}
		}

		await Promise.all(executing);
	}

	/**
	 * Ensure Google API calls are spaced out to avoid 403 rate limits.
	 * Calls are queued and executed with at least GOOGLE_API_CALL_SPACING_MS between them.
	 */
	private withGoogleRateLimit<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.rateLimitChain = this.rateLimitChain.then(async () => {
				const now = Date.now();
				const wait = Math.max(0, GOOGLE_API_CALL_SPACING_MS - (now - this.lastApiCallAt));
				if (wait > 0) {
					await new Promise((r) => setTimeout(r, wait));
				}
				try {
					const result = await fn();
					this.lastApiCallAt = Date.now();
					resolve(result);
				} catch (e) {
					this.lastApiCallAt = Date.now();
					reject(e);
				}
			}, () => {
				// Previous call in chain failed; continue the chain
				fn().then(resolve, reject);
			});
		});
	}

	/**
	 * Check if the sync service is enabled and properly configured
	 */
	isEnabled(): boolean {
		const settings = this.plugin.settings.googleCalendarExport;
		const enabled = settings.enabled;
		const hasTargetCalendar = !!settings.targetCalendarId;
		// Check if Google Calendar is connected by verifying calendars are available
		// (populated during GoogleCalendarService.initialize() when OAuth is connected)
		const isConnected = this.googleCalendarService.getAvailableCalendars().length > 0;

		return enabled && hasTargetCalendar && isConnected;
	}

	/**
	 * Start retrying persisted calendar recovery work.
	 */
	startDeletionQueueProcessor(): void {
		if (this.recoveryQueueProcessorInterval) {
			return;
		}

		this.processStartupDeletionRecovery().catch((error) => {
			console.error("[TaskCalendarSync] Failed to process recovery queues:", error);
		});

		this.recoveryQueueProcessorInterval = setInterval(() => {
			this.processRecoveryQueues().catch((error) => {
				console.error("[TaskCalendarSync] Failed to process recovery queues:", error);
			});
		}, RECOVERY_QUEUE_PROCESSOR_INTERVAL_MS);
	}

	private isDeletionQueueReady(): boolean {
		const settings = this.plugin.settings.googleCalendarExport;
		const isConnected = this.googleCalendarService.getAvailableCalendars().length > 0;
		return !!settings?.enabled && !!settings?.syncOnTaskDelete && isConnected;
	}

	private isSyncQueueReady(): boolean {
		const settings = this.plugin.settings.googleCalendarExport;
		const isConnected = this.googleCalendarService.getAvailableCalendars().length > 0;
		return !!settings?.enabled && !!settings?.targetCalendarId && isConnected;
	}

	private getDeletionQueueKey(item: Pick<PendingGoogleCalendarDeletion, "calendarId" | "eventId">): string {
		return `${item.calendarId}::${item.eventId}`;
	}

	private isTaskCalendarEligible(task: TaskInfo): boolean {
		if (task.archived) {
			return false;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		switch (settings.syncTrigger) {
			case "scheduled":
				return !!task.scheduled;
			case "due":
				return !!task.due;
			case "both":
				return !!task.scheduled || !!task.due;
			default:
				return false;
		}
	}

	private async getDeletionQueue(): Promise<PendingGoogleCalendarDeletion[]> {
		const data = await this.plugin.loadData();
		return data?.[GOOGLE_CALENDAR_DELETION_QUEUE_KEY] || [];
	}

	private async saveDeletionQueue(queue: PendingGoogleCalendarDeletion[]): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		data[GOOGLE_CALENDAR_DELETION_QUEUE_KEY] = queue;
		await this.plugin.saveData(data);
	}

	private async getEventIndex(): Promise<GoogleCalendarEventIndexEntry[]> {
		const data = await this.plugin.loadData();
		return data?.[GOOGLE_CALENDAR_EVENT_INDEX_KEY] || [];
	}

	private async saveEventIndex(index: GoogleCalendarEventIndexEntry[]): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		data[GOOGLE_CALENDAR_EVENT_INDEX_KEY] = index;
		await this.plugin.saveData(data);
	}

	private async getSyncQueue(): Promise<PendingGoogleCalendarSync[]> {
		const data = await this.plugin.loadData();
		return data?.[GOOGLE_CALENDAR_SYNC_QUEUE_KEY] || [];
	}

	private async saveSyncQueue(queue: PendingGoogleCalendarSync[]): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		data[GOOGLE_CALENDAR_SYNC_QUEUE_KEY] = queue;
		await this.plugin.saveData(data);
	}

	private async upsertEventIndex(
		taskPath: string,
		calendarId: string,
		eventId: string,
		eventRole: GoogleCalendarEventIndexEntry["eventRole"] = "primary"
	): Promise<void> {
		const index = await this.getEventIndex();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const role = eventRole || "primary";
		const replacedEntries = index.filter(
			(item) =>
				item.taskPath === taskPath &&
				item.calendarId === calendarId &&
				(item.eventRole || "primary") === role &&
				item.eventId !== eventId
		);
		const filteredIndex = index.filter(
			(item) =>
				this.getDeletionQueueKey(item) !== key &&
				!(
					item.taskPath === taskPath &&
					item.calendarId === calendarId &&
					(item.eventRole || "primary") === role
				)
		);

		filteredIndex.push({
			taskPath,
			calendarId,
			eventId,
			eventRole: role,
			updatedAt: Date.now(),
		});

		await this.saveEventIndex(filteredIndex);

		for (const item of replacedEntries) {
			const deleted = await this.deleteOrQueueCalendarEvent(
				item.taskPath,
				item.calendarId,
				item.eventId
			);
			if (!deleted) {
				console.warn(
					`[TaskCalendarSync] Replaced event cleanup queued for ${item.taskPath}`
				);
			}
		}
	}

	private async removeEventIndexForTask(taskPath: string): Promise<void> {
		const index = await this.getEventIndex();
		const filteredIndex = index.filter((item) => item.taskPath !== taskPath);

		if (filteredIndex.length !== index.length) {
			await this.saveEventIndex(filteredIndex);
		}
	}

	private async removeEventIndexForTaskRole(
		taskPath: string,
		eventRole: GoogleCalendarEventIndexEntry["eventRole"]
	): Promise<void> {
		const role = eventRole || "primary";
		const index = await this.getEventIndex();
		const filteredIndex = index.filter(
			(item) => !(item.taskPath === taskPath && (item.eventRole || "primary") === role)
		);

		if (filteredIndex.length !== index.length) {
			await this.saveEventIndex(filteredIndex);
		}
	}

	private async removeEventIndexForEvent(calendarId: string, eventId: string): Promise<void> {
		const index = await this.getEventIndex();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const filteredIndex = index.filter((item) => this.getDeletionQueueKey(item) !== key);

		if (filteredIndex.length !== index.length) {
			await this.saveEventIndex(filteredIndex);
		}
	}

	private getErrorStatus(error: any): number | undefined {
		return error?.status ?? error?.statusCode;
	}

	private isAlreadyDeletedError(error: any): boolean {
		const status = this.getErrorStatus(error);
		return status === 404 || status === 410;
	}

	private getErrorMessage(error: any): string {
		if (error instanceof Error) {
			return error.message;
		}
		if (error?.message) {
			return String(error.message);
		}
		return String(error);
	}

	private async queueTaskSync(taskPath: string, error?: any, attempted = false): Promise<void> {
		const now = Date.now();
		const queue = await this.getSyncQueue();
		const existing = queue.find((item) => item.taskPath === taskPath);
		const lastError = error ? this.getErrorMessage(error) : undefined;

		if (existing) {
			existing.requestedAt = now;
			if (attempted) {
				existing.attempts += 1;
				existing.lastAttemptAt = now;
			}
			if (lastError) {
				existing.lastError = lastError;
			}
		} else {
			queue.push({
				taskPath,
				requestedAt: now,
				attempts: attempted ? 1 : 0,
				lastAttemptAt: attempted ? now : undefined,
				lastError,
			});
		}

		await this.saveSyncQueue(queue);
	}

	private async removeFromDeletionQueue(calendarId: string, eventId: string): Promise<void> {
		const queue = await this.getDeletionQueue();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const filteredQueue = queue.filter((item) => this.getDeletionQueueKey(item) !== key);

		if (filteredQueue.length !== queue.length) {
			await this.saveDeletionQueue(filteredQueue);
		}
	}

	private async queueCalendarDeletion(
		taskPath: string,
		calendarId: string,
		eventId: string,
		error?: any,
		attempted = false
	): Promise<void> {
		const now = Date.now();
		const queue = await this.getDeletionQueue();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const existing = queue.find((item) => this.getDeletionQueueKey(item) === key);
		const lastError = error ? this.getErrorMessage(error) : undefined;

		if (existing) {
			existing.taskPath = taskPath;
			if (attempted) {
				existing.attempts += 1;
				existing.lastAttemptAt = now;
			}
			if (lastError) {
				existing.lastError = lastError;
			}
		} else {
			queue.push({
				taskPath,
				calendarId,
				eventId,
				createdAt: now,
				attempts: attempted ? 1 : 0,
				lastAttemptAt: attempted ? now : undefined,
				lastError,
			});
		}

		await this.saveDeletionQueue(queue);
	}

	private async deleteOrQueueCalendarEvent(
		taskPath: string,
		calendarId: string,
		eventId: string
	): Promise<boolean> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return true;
		}

		if (!this.isDeletionQueueReady()) {
			await this.queueCalendarDeletion(
				taskPath,
				calendarId,
				eventId,
				new Error("Google Calendar sync is not ready")
			);
			return false;
		}

		try {
			await this.withGoogleRateLimit(() =>
				this.googleCalendarService.deleteEvent(calendarId, eventId)
			);
			await this.removeFromDeletionQueue(calendarId, eventId);
			return true;
		} catch (error: any) {
			if (this.isAlreadyDeletedError(error)) {
				await this.removeFromDeletionQueue(calendarId, eventId);
				return true;
			}

			console.error("[TaskCalendarSync] Failed to delete event:", taskPath, error);
			await this.queueCalendarDeletion(taskPath, calendarId, eventId, error, true);
			return false;
		}
	}

	private async clearTaskEventIdIfMatching(item: PendingGoogleCalendarDeletion): Promise<void> {
		const task = await this.plugin.cacheManager.getTaskInfo(item.taskPath);
		if (task?.googleCalendarEventId === item.eventId) {
			await this.removeTaskEventId(item.taskPath);
		}
		if (task?.googleCalendarExceptionEventId === item.eventId) {
			await this.saveTaskGoogleCalendarMetadata(item.taskPath, {
				googleCalendarExceptionEventId: undefined,
			});
			await this.removeEventIndexForTaskRole(item.taskPath, "exception");
		}
	}

	private async isQueuedDeletionStillNeeded(
		item: PendingGoogleCalendarDeletion
	): Promise<boolean> {
		const task = await this.plugin.cacheManager.getTaskInfo(item.taskPath);
		if (!task) {
			return true;
		}

		const currentEventIds = [
			this.getTaskEventId(task),
			this.getTaskExceptionEventId(task),
		].filter((eventId): eventId is string => !!eventId);
		if (!currentEventIds.includes(item.eventId)) {
			return true;
		}

		return !this.isTaskCalendarEligible(task);
	}

	async processStartupDeletionRecovery(): Promise<void> {
		await this.recoverDeletedTaskEventsFromIndex();
		await this.processRecoveryQueues();
	}

	async processRecoveryQueues(): Promise<void> {
		await this.processDeletionQueue();
		await this.processPendingSyncQueue();
	}

	async recoverDeletedTaskEventsFromIndex(): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return;
		}

		const targetCalendarId = this.plugin.settings.googleCalendarExport.targetCalendarId;
		if (!targetCalendarId) {
			return;
		}

		const tasks = await this.plugin.cacheManager.getAllTasks();
		const activeTasksByEvent = new Map<string, TaskInfo>();

		for (const task of tasks) {
			const taskEvents = [
				{ eventId: this.getTaskEventId(task), eventRole: "primary" as const },
				{ eventId: this.getTaskExceptionEventId(task), eventRole: "exception" as const },
			].filter((event): event is { eventId: string; eventRole: "primary" | "exception" } =>
				!!event.eventId
			);

			for (const { eventId, eventRole } of taskEvents) {
				const key = this.getDeletionQueueKey({
					calendarId: targetCalendarId,
					eventId,
				});
				activeTasksByEvent.set(key, task);
				await this.upsertEventIndex(task.path, targetCalendarId, eventId, eventRole);
			}
		}

		const index = await this.getEventIndex();
		for (const item of index) {
			const activeTask = activeTasksByEvent.get(this.getDeletionQueueKey(item));
			if (activeTask && this.isTaskCalendarEligible(activeTask)) {
				continue;
			}

			await this.queueCalendarDeletion(
				activeTask?.path || item.taskPath,
				item.calendarId,
				item.eventId,
				activeTask
					? new Error("Indexed task no longer meets calendar sync criteria")
					: new Error("Indexed task file no longer exists")
			);
		}
	}

	async processPendingSyncQueue(): Promise<{ synced: number; failed: number; deleted: number; dropped: number; remaining: number }> {
		const results = { synced: 0, failed: 0, deleted: 0, dropped: 0, remaining: 0 };
		const queue = await this.getSyncQueue();

		if (queue.length === 0) {
			return results;
		}

		if (!this.isSyncQueueReady()) {
			results.remaining = queue.length;
			return results;
		}

		const dedupedQueue = new Map<string, PendingGoogleCalendarSync>();
		for (const item of queue) {
			dedupedQueue.set(item.taskPath, item);
		}

		const remainingItems: PendingGoogleCalendarSync[] = [];

		for (const item of dedupedQueue.values()) {
			const task = await this.plugin.cacheManager.getTaskInfo(item.taskPath);
			if (!task) {
				results.dropped++;
				continue;
			}

			if (!this.isTaskCalendarEligible(task)) {
				const eventId = this.getTaskEventId(task);
				if (eventId) {
					const deleted = await this.deleteTaskFromCalendar(task);
					if (!deleted) {
						console.warn(`[TaskCalendarSync] Calendar deletion queued while replaying sync for ${item.taskPath}`);
					}
					results.deleted++;
				} else {
					results.dropped++;
				}
				continue;
			}

			const synced = await this.syncTaskToCalendar(task, undefined, { queueOnFailure: false });
			if (synced) {
				results.synced++;
				continue;
			}

			results.failed++;
			remainingItems.push({
				...item,
				attempts: item.attempts + 1,
				lastAttemptAt: Date.now(),
				lastError: "Failed to replay queued Google Calendar sync",
			});
		}

		results.remaining = remainingItems.length;
		await this.saveSyncQueue(remainingItems);
		return results;
	}

	async processDeletionQueue(): Promise<{ deleted: number; failed: number; remaining: number }> {
		const results = { deleted: 0, failed: 0, remaining: 0 };
		const queue = await this.getDeletionQueue();

		if (queue.length === 0) {
			return results;
		}

		if (!this.isDeletionQueueReady()) {
			results.remaining = queue.length;
			return results;
		}

		const dedupedQueue = new Map<string, PendingGoogleCalendarDeletion>();
		for (const item of queue) {
			dedupedQueue.set(this.getDeletionQueueKey(item), item);
		}

		const remainingItems: PendingGoogleCalendarDeletion[] = [];

		for (const item of dedupedQueue.values()) {
			try {
				const deletionStillNeeded = await this.isQueuedDeletionStillNeeded(item);
				if (!deletionStillNeeded) {
					continue;
				}

				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.deleteEvent(item.calendarId, item.eventId)
				);
				await this.clearTaskEventIdIfMatching(item);
				await this.removeEventIndexForEvent(item.calendarId, item.eventId);
				results.deleted++;
			} catch (error: any) {
				if (this.isAlreadyDeletedError(error)) {
					await this.clearTaskEventIdIfMatching(item);
					await this.removeEventIndexForEvent(item.calendarId, item.eventId);
					results.deleted++;
					continue;
				}

				results.failed++;
				remainingItems.push({
					...item,
					attempts: item.attempts + 1,
					lastAttemptAt: Date.now(),
					lastError: this.getErrorMessage(error),
				});
				console.error("[TaskCalendarSync] Failed to retry queued event deletion:", item, error);
			}
		}

		results.remaining = remainingItems.length;
		await this.saveDeletionQueue(remainingItems);
		return results;
	}

	/**
	 * Determine if a task should be synced based on settings and task properties
	 */
	shouldSyncTask(task: TaskInfo): boolean {
		if (!this.isEnabled()) return false;

		const settings = this.plugin.settings.googleCalendarExport;

		// Don't sync archived tasks
		if (task.archived) return false;

		// Check if task has the required date(s) based on sync trigger setting
		switch (settings.syncTrigger) {
			case "scheduled":
				return !!task.scheduled;
			case "due":
				return !!task.due;
			case "both":
				return !!task.scheduled || !!task.due;
			default:
				return false;
		}
	}

	/**
	 * Get the Google Calendar event ID from the task's frontmatter
	 */
	getTaskEventId(task: TaskInfo): string | undefined {
		return task.googleCalendarEventId || this.taskEventIdCache.get(task.path);
	}

	/**
	 * Get the detached recurring exception event ID from the task's frontmatter.
	 */
	getTaskExceptionEventId(task: TaskInfo): string | undefined {
		return task.googleCalendarExceptionEventId;
	}

	/**
	 * Determines if a task should be synced as a Google Calendar recurring event.
	 * Only scheduled-based recurring tasks are synced as recurring events.
	 * Completion-based recurring tasks remain as single events (since their
	 * DTSTART shifts on each completion, which doesn't map well to Google Calendar).
	 */
	private shouldSyncAsRecurring(task: TaskInfo): boolean {
		// Must have a recurrence rule
		if (!task.recurrence) return false;

		// Only scheduled-based recurrence syncs as recurring events
		// Completion-based recurrence stays as single events (existing behavior)
		const anchor = task.recurrence_anchor || "scheduled";
		return anchor === "scheduled";
	}

	/**
	 * True when the task still has any Google recurring exception metadata.
	 */
	private hasStoredRecurringExceptionMetadata(task: TaskInfo): boolean {
		return Boolean(
			task.googleCalendarExceptionEventId ||
				task.googleCalendarExceptionOriginalScheduled ||
				(task.googleCalendarMovedOriginalDates &&
					task.googleCalendarMovedOriginalDates.length > 0)
		);
	}

	/**
	 * Additional recurrence exclusions beyond completed/skipped instances.
	 */
	private getAdditionalRecurringExdates(task: TaskInfo): string[] {
		const excluded = new Set<string>();

		if (Array.isArray(task.googleCalendarMovedOriginalDates)) {
			for (const date of task.googleCalendarMovedOriginalDates) {
				const normalized = getDatePart(date);
				if (normalized) {
					excluded.add(normalized);
				}
			}
		}

		const pendingOriginal = getDatePart(task.googleCalendarExceptionOriginalScheduled || "");
		if (pendingOriginal) {
			excluded.add(pendingOriginal);
		}

		return Array.from(excluded).sort();
	}

	/**
	 * Save the Google Calendar event ID to the task's frontmatter
	 */
	private async saveTaskEventId(taskPath: string, eventId: string): Promise<void> {
		await this.saveTaskGoogleCalendarMetadata(taskPath, {
			googleCalendarEventId: eventId,
		});
	}

	/**
	 * Save Google Calendar metadata fields to frontmatter.
	 */
	private async saveTaskGoogleCalendarMetadata(
		taskPath: string,
		updates: Partial<
			Pick<
				TaskInfo,
				| "googleCalendarEventId"
				| "googleCalendarExceptionEventId"
				| "googleCalendarExceptionOriginalScheduled"
				| "googleCalendarMovedOriginalDates"
			>
		>
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			console.warn(`Cannot save Google Calendar metadata: file not found at ${taskPath}`);
			return;
		}

		const eventIdField =
			this.plugin.fieldMapper.toUserField("googleCalendarEventId") ||
			"googleCalendarEventId";
		const exceptionEventIdField =
			this.plugin.fieldMapper.toUserField("googleCalendarExceptionEventId") ||
			"googleCalendarExceptionEventId";
		const exceptionOriginalField =
			this.plugin.fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled") ||
			"googleCalendarExceptionOriginalScheduled";
		const movedDatesField =
			this.plugin.fieldMapper.toUserField("googleCalendarMovedOriginalDates") ||
			"googleCalendarMovedOriginalDates";

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if ("googleCalendarEventId" in updates) {
				if (updates.googleCalendarEventId) {
					frontmatter[eventIdField] = updates.googleCalendarEventId;
				} else {
					delete frontmatter[eventIdField];
				}
			}

			if ("googleCalendarExceptionEventId" in updates) {
				if (updates.googleCalendarExceptionEventId) {
					frontmatter[exceptionEventIdField] =
						updates.googleCalendarExceptionEventId;
				} else {
					delete frontmatter[exceptionEventIdField];
				}
			}

			if ("googleCalendarExceptionOriginalScheduled" in updates) {
				if (updates.googleCalendarExceptionOriginalScheduled) {
					frontmatter[exceptionOriginalField] =
						updates.googleCalendarExceptionOriginalScheduled;
				} else {
					delete frontmatter[exceptionOriginalField];
				}
			}

			if ("googleCalendarMovedOriginalDates" in updates) {
				if (
					updates.googleCalendarMovedOriginalDates &&
					updates.googleCalendarMovedOriginalDates.length > 0
				) {
					frontmatter[movedDatesField] = updates.googleCalendarMovedOriginalDates;
				} else {
					delete frontmatter[movedDatesField];
				}
			}
		});

		const targetCalendarId = this.plugin.settings.googleCalendarExport.targetCalendarId;
		if ("googleCalendarEventId" in updates) {
			if (updates.googleCalendarEventId) {
				this.taskEventIdCache.set(taskPath, updates.googleCalendarEventId);
				if (targetCalendarId) {
					await this.upsertEventIndex(
						taskPath,
						targetCalendarId,
						updates.googleCalendarEventId,
						"primary"
					);
				}
			} else {
				this.taskEventIdCache.delete(taskPath);
				await this.removeEventIndexForTaskRole(taskPath, "primary");
			}
		}

		if (
			"googleCalendarExceptionEventId" in updates &&
			updates.googleCalendarExceptionEventId &&
			targetCalendarId
		) {
			await this.upsertEventIndex(
				taskPath,
				targetCalendarId,
				updates.googleCalendarExceptionEventId,
				"exception"
			);
		}
		if ("googleCalendarExceptionEventId" in updates && !updates.googleCalendarExceptionEventId) {
			await this.removeEventIndexForTaskRole(taskPath, "exception");
		}
	}

	/**
	 * Remove all Google Calendar metadata from frontmatter.
	 */
	private async clearTaskGoogleCalendarMetadata(taskPath: string): Promise<void> {
		await this.saveTaskGoogleCalendarMetadata(taskPath, {
			googleCalendarEventId: undefined,
			googleCalendarExceptionEventId: undefined,
			googleCalendarExceptionOriginalScheduled: undefined,
			googleCalendarMovedOriginalDates: undefined,
		});
		this.taskEventIdCache.delete(taskPath);
		await this.removeEventIndexForTask(taskPath);
	}

	/**
	 * Remove the Google Calendar event ID from the task's frontmatter
	 */
	private async removeTaskEventId(taskPath: string): Promise<void> {
		await this.saveTaskGoogleCalendarMetadata(taskPath, {
			googleCalendarEventId: undefined,
		});
		this.taskEventIdCache.delete(taskPath);
		await this.removeEventIndexForTaskRole(taskPath, "primary");
	}

	/**
	 * Apply the title template to generate the event title
	 */
	private applyTitleTemplate(task: TaskInfo): string {
		const template = this.plugin.settings.googleCalendarExport.eventTitleTemplate;

		// Get human-readable labels for status and priority
		const statusConfig = task.status
			? this.plugin.statusManager.getStatusConfig(task.status)
			: null;
		const priorityConfig = task.priority
			? this.plugin.priorityManager.getPriorityConfig(task.priority)
			: null;

		const untitledTask = this.plugin.i18n.translate("settings.integrations.googleCalendarExport.eventDescription.untitledTask");
		return template
			.replace(/\{\{title\}\}/g, task.title || untitledTask)
			.replace(/\{\{status\}\}/g, statusConfig?.label || task.status || "")
			.replace(/\{\{priority\}\}/g, priorityConfig?.label || task.priority || "")
			.replace(/\{\{due\}\}/g, task.due || "")
			.replace(/\{\{scheduled\}\}/g, task.scheduled || "")
			.trim();
	}

	private getCalendarEventTitle(task: TaskInfo): string {
		const title = this.applyTitleTemplate(task);
		return this.plugin.statusManager.isCompletedStatus(task.status)
			? `✓ ${title}`
			: title;
	}

	/**
	 * Build the event description from task properties
	 */
	private buildEventDescription(task: TaskInfo): string {
		const settings = this.plugin.settings.googleCalendarExport;
		const t = (key: string, params?: Record<string, string | number>) =>
			this.plugin.i18n.translate(`settings.integrations.googleCalendarExport.eventDescription.${key}` as any, params);
		const parts: string[] = [];

		// Add task metadata
		if (task.priority && task.priority !== "none") {
			const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
			parts.push(t("priority", { value: priorityConfig?.label || task.priority }));
		}

		if (task.status) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(task.status);
			parts.push(t("status", { value: statusConfig?.label || task.status }));
		}

		// Add dates
		if (task.due) {
			parts.push(t("due", { value: task.due }));
		}
		if (task.scheduled) {
			parts.push(t("scheduled", { value: task.scheduled }));
		}

		// Add time estimate
		if (task.timeEstimate) {
			const hours = Math.floor(task.timeEstimate / 60);
			const minutes = task.timeEstimate % 60;
			const estimateStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
			parts.push(t("timeEstimate", { value: estimateStr }));
		}

		// Add tags
		if (task.tags && task.tags.length > 0) {
			parts.push(t("tags", { value: task.tags.map((tag) => `#${tag}`).join(", ") }));
		}

		// Add contexts
		if (task.contexts && task.contexts.length > 0) {
			parts.push(t("contexts", { value: task.contexts.map((c) => `@${this.toCalendarDescriptionLabel(c)}`).join(", ") }));
		}

		// Add projects
		if (task.projects && task.projects.length > 0) {
			parts.push(t("projects", { value: task.projects.map((p) => this.toCalendarDescriptionLabel(p)).join(", ") }));
		}

		// Add separator before link
		if (parts.length > 0 && settings.includeObsidianLink) {
			parts.push("");
			parts.push("---");
		}

		// Add Obsidian link as a plain URI so external clients do not render raw HTML.
		if (settings.includeObsidianLink) {
			const vaultName = this.plugin.app.vault.getName();
			const encodedPath = encodeURIComponent(task.path);
			const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodedPath}`;
			const linkText = t("openInObsidian");
			parts.push(`${linkText}: ${obsidianUri}`);
		}

		return parts.join("\n");
	}

	private toCalendarDescriptionLabel(value: string): string {
		return value
			.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
			.replace(/\[\[([^\]]+)\]\]/g, (_match, target: string) => this.basenameForDisplay(target))
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
			.trim();
	}

	private basenameForDisplay(target: string): string {
		const withoutHeading = target.split("#")[0];
		const withoutExtension = withoutHeading.replace(/\.md$/i, "");
		const basename = withoutExtension.split("/").pop();
		return basename || withoutExtension || target;
	}

	/**
	 * Get the date to use for the calendar event based on settings
	 */
	private getEventDate(task: TaskInfo): string | undefined {
		const settings = this.plugin.settings.googleCalendarExport;

		switch (settings.syncTrigger) {
			case "scheduled":
				return task.scheduled;
			case "due":
				return task.due;
			case "both":
				// Prefer scheduled, fall back to due
				return task.scheduled || task.due;
			default:
				return undefined;
		}
	}

	/**
	 * Parse a task date string and determine if it's all-day or timed
	 */
	private parseDateForEvent(dateStr: string): {
		date?: string;
		dateTime?: string;
		timeZone?: string;
		isAllDay: boolean;
	} {
		// Check if the date includes a time component (has 'T')
		if (dateStr.includes("T")) {
			// Timed event - format with local timezone offset for Google Calendar.
			// Using date-fns format with 'xxx' to produce an offset-aware RFC 3339 string
			// (e.g. "2024-03-15T14:30:00+05:00") so the dateTime matches the timeZone.
			const date = new Date(dateStr);
			return {
				dateTime: format(date, "yyyy-MM-dd'T'HH:mm:ssxxx"),
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				isAllDay: false,
			};
		} else {
			// All-day event - just use the date string
			return {
				date: dateStr,
				isAllDay: true,
			};
		}
	}

	/**
	 * Calculate the end date/time for an event
	 */
	private getEventEnd(
		startInfo: { date?: string; dateTime?: string; timeZone?: string; isAllDay: boolean },
		task: TaskInfo
	): { date?: string; dateTime?: string; timeZone?: string } {
		const settings = this.plugin.settings.googleCalendarExport;

		if (startInfo.isAllDay || settings.createAsAllDay) {
			// All-day events: end is the same date (or next day for multi-day)
			// Google Calendar requires end date to be the day AFTER for all-day events
			if (startInfo.date) {
				const startDate = new Date(startInfo.date + "T00:00:00");
				const endDate = new Date(startDate);
				endDate.setDate(endDate.getDate() + 1);
				return { date: format(endDate, "yyyy-MM-dd") };
			}
			// Fallback for dateTime that should be all-day
			const startDate = new Date(startInfo.dateTime!);
			const endDate = new Date(startDate);
			endDate.setDate(endDate.getDate() + 1);
			return { date: format(endDate, "yyyy-MM-dd") };
		} else {
			// Timed events: use duration
			const duration = task.timeEstimate || settings.defaultEventDuration;
			const startDate = new Date(startInfo.dateTime!);
			const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
			return {
				dateTime: format(endDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
				timeZone: startInfo.timeZone,
			};
		}
	}

	/**
	 * Parse ISO 8601 duration format and return milliseconds.
	 * Based on the parser from NotificationService.
	 */
	private parseISO8601Duration(duration: string): number | null {
		// Parse ISO 8601 duration format (e.g., "-PT15M", "P2D", "-PT1H30M")
		const match = duration.match(
			/^(-?)P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
		);

		if (!match) {
			return null;
		}

		const [, sign, years, months, weeks, days, hours, minutes, seconds] = match;

		let totalMs = 0;

		// Note: For simplicity, we treat months as 30 days and years as 365 days
		if (years) totalMs += parseInt(years) * 365 * 24 * 60 * 60 * 1000;
		if (months) totalMs += parseInt(months) * 30 * 24 * 60 * 60 * 1000;
		if (weeks) totalMs += parseInt(weeks) * 7 * 24 * 60 * 60 * 1000;
		if (days) totalMs += parseInt(days) * 24 * 60 * 60 * 1000;
		if (hours) totalMs += parseInt(hours) * 60 * 60 * 1000;
		if (minutes) totalMs += parseInt(minutes) * 60 * 1000;
		if (seconds) totalMs += parseInt(seconds) * 1000;

		// Apply sign for negative durations (before the anchor date)
		return sign === "-" ? -totalMs : totalMs;
	}

	/**
	 * Convert task reminders to Google Calendar reminder format.
	 * Returns an array of reminder overrides in the format Google Calendar API expects.
	 * 
	 * @param task - The task with reminders
	 * @param eventStartTime - The event start time (ISO string or date string)
	 * @param eventDateSource - Which date field was used for the event ('due' or 'scheduled')
	 * @returns Array of { method: string; minutes: number } or null if no valid reminders
	 */
	private convertTaskRemindersToGoogleFormat(
		task: TaskInfo,
		eventStartTime: string,
		eventDateSource: 'due' | 'scheduled'
	): Array<{ method: string; minutes: number }> | null {
		if (!task.reminders || !Array.isArray(task.reminders) || task.reminders.length === 0) {
			return null;
		}

		const googleReminders: Array<{ method: string; minutes: number }> = [];
		const GOOGLE_MAX_REMINDER_MINUTES = 40320; // 4 weeks in minutes (Google Calendar API limit)

		// Parse event start time to get a timestamp
		let eventStartMs: number;
		try {
			// Handle both ISO timestamps and date-only strings
			if (eventStartTime.includes('T')) {
				eventStartMs = new Date(eventStartTime).getTime();
			} else {
				// Date-only string - assume start of day in local timezone
				eventStartMs = new Date(eventStartTime + 'T00:00:00').getTime();
			}

			if (isNaN(eventStartMs)) {
				console.warn('[TaskCalendarSync] Invalid event start time:', eventStartTime);
				return null;
			}
		} catch (error) {
			console.warn('[TaskCalendarSync] Error parsing event start time:', error);
			return null;
		}

		for (const reminder of task.reminders) {
			if (!reminder.type) continue;

			if (reminder.type === 'relative') {
				// Only include relative reminders that match the event's date source
				if (reminder.relatedTo !== eventDateSource) {
					continue;
				}

				// Parse the ISO 8601 duration
				if (!reminder.offset) continue;
				const durationMs = this.parseISO8601Duration(reminder.offset);
				if (durationMs === null) {
					console.warn('[TaskCalendarSync] Invalid duration format:', reminder.offset);
					continue;
				}

				// Convert to minutes before the event
				// Negative duration means "before", which is what we want
				// Zero duration means "at event time"
				// Positive duration means "after", which Google Calendar doesn't support for reminders
				const minutesBefore = Math.abs(Math.round(durationMs / (60 * 1000)));

				// Skip if reminder is after the event (positive duration without negative sign)
				if (durationMs > 0) {
					console.warn('[TaskCalendarSync] Skipping reminder after event:', reminder);
					continue;
				}

				// Cap at Google Calendar's limit
				const cappedMinutes = Math.min(minutesBefore, GOOGLE_MAX_REMINDER_MINUTES);

				// Include 0-minute reminders (at event time)
				if (cappedMinutes >= 0) {
					googleReminders.push({ method: 'popup', minutes: cappedMinutes });
				}
			} else if (reminder.type === 'absolute') {
				// Calculate minutes before event start
				if (!reminder.absoluteTime) continue;

				try {
					const reminderTimeMs = new Date(reminder.absoluteTime).getTime();
					if (isNaN(reminderTimeMs)) {
						console.warn('[TaskCalendarSync] Invalid absolute time:', reminder.absoluteTime);
						continue;
					}

					// Calculate difference in minutes
					const diffMs = eventStartMs - reminderTimeMs;
					const minutesBefore = Math.round(diffMs / (60 * 1000));

					// Skip if reminder is after the event start
					if (minutesBefore < 0) {
						console.warn('[TaskCalendarSync] Skipping absolute reminder after event:', reminder);
						continue;
					}

					// Cap at Google Calendar's limit
					const cappedMinutes = Math.min(minutesBefore, GOOGLE_MAX_REMINDER_MINUTES);
					// Include 0-minute reminders (at event time)
					googleReminders.push({ method: 'popup', minutes: cappedMinutes });
				} catch (error) {
					console.warn('[TaskCalendarSync] Error parsing absolute reminder time:', error);
					continue;
				}
			}
		}

		return googleReminders.length > 0 ? googleReminders : null;
	}

	/**
	 * Convert a task to a Google Calendar event payload
	 */
	private taskToCalendarEvent(task: TaskInfo, clearRecurrence?: boolean): CalendarEventPayload | null {
		const eventDate = this.getEventDate(task);
		if (!eventDate) return null;

		const settings = this.plugin.settings.googleCalendarExport;
		const startInfo = this.parseDateForEvent(eventDate);

		// If user prefers all-day events, convert timed to all-day
		let start: { date?: string; dateTime?: string; timeZone?: string };
		if (settings.createAsAllDay && !startInfo.isAllDay) {
			// Convert to all-day - use local date to handle timezone correctly
			// e.g., "2024-01-15T23:00:00" in UTC+5 should become "2024-01-16" not "2024-01-15"
			const localDate = new Date(eventDate);
			const dateOnly = format(localDate, "yyyy-MM-dd");
			start = { date: dateOnly };
		} else if (startInfo.isAllDay) {
			start = { date: startInfo.date };
		} else {
			start = { dateTime: startInfo.dateTime, timeZone: startInfo.timeZone };
		}

		// Calculate end based on start and duration
		const adjustedStartInfo = {
			...startInfo,
			isAllDay: settings.createAsAllDay || startInfo.isAllDay,
			date: start.date,
			dateTime: start.dateTime,
		};
		const end = this.getEventEnd(adjustedStartInfo, task);

		const event: CalendarEventPayload = {
			summary: this.getCalendarEventTitle(task),
			start,
			end,
		};

		if (settings.includeDescription) {
			event.description = this.buildEventDescription(task);
		}

		if (settings.eventColorId) {
			event.colorId = settings.eventColorId;
		}

		// Determine which date field was used for the event (for reminder conversion)
		let eventDateSource: 'due' | 'scheduled';
		if (settings.syncTrigger === 'scheduled' || (settings.syncTrigger === 'both' && task.scheduled)) {
			eventDateSource = 'scheduled';
		} else {
			eventDateSource = 'due';
		}

		// Add reminders - prioritize task reminders, fall back to default
		const taskReminders = this.convertTaskRemindersToGoogleFormat(
			task,
			eventDate,
			eventDateSource
		);

		if (taskReminders && taskReminders.length > 0) {
			// Use task-specific reminders
			event.reminders = {
				useDefault: false,
				overrides: taskReminders,
			};
		} else if (settings.defaultReminderMinutes !== null && settings.defaultReminderMinutes > 0) {
			// For all-day events, use Google Calendar's default all-day notifications
			// (configured by the user in their Google Calendar settings) rather than
			// overriding with minutes-based reminders which would fire at the wrong time
			// (e.g., 11:30 PM the night before instead of 9 AM day-of). See #1465.
			const isAllDay = settings.createAsAllDay || startInfo.isAllDay;
			if (isAllDay) {
				event.reminders = { useDefault: true };
			} else {
				event.reminders = {
					useDefault: false,
					overrides: [{ method: "popup", minutes: settings.defaultReminderMinutes }],
				};
			}
		}

		// Add recurrence rules for scheduled-based recurring tasks
		if (this.shouldSyncAsRecurring(task) && task.recurrence) {
			const recurrenceData = convertToGoogleRecurrence(task.recurrence, {
				completedInstances: task.complete_instances,
				skippedInstances: task.skipped_instances,
				additionalExcludedDates: this.getAdditionalRecurringExdates(task),
			});

			if (recurrenceData) {
				event.recurrence = recurrenceData.recurrence;

				// Override start date with DTSTART from recurrence rule
				// This ensures the recurring event starts from the correct date
				if (recurrenceData.dtstart) {
					if (settings.createAsAllDay || !recurrenceData.hasTime) {
						event.start = { date: recurrenceData.dtstart };
						// Recalculate end for all-day event
						const endDate = new Date(recurrenceData.dtstart + "T00:00:00");
						endDate.setDate(endDate.getDate() + 1);
						event.end = { date: format(endDate, "yyyy-MM-dd") };
					} else if (recurrenceData.time) {
						const dateTimeStr = `${recurrenceData.dtstart}T${recurrenceData.time}`;
						const startDate = new Date(dateTimeStr);
						event.start = {
							dateTime: format(startDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
							timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
						};
						// Recalculate end based on duration
						const duration = task.timeEstimate || settings.defaultEventDuration;
						const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
						event.end = {
							dateTime: format(endDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
							timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
						};
					}
				}
			}
		} else if (clearRecurrence) {
			// Explicitly clear recurrence when it was removed from the task
			// Google Calendar API requires an empty array to remove recurrence
			event.recurrence = [];
		}

		return event;
	}

	private async createCalendarEventForTask(
		task: TaskInfo,
		eventData: CalendarEventPayload,
		calendarId: string
	): Promise<string> {
		const createdEvent = await this.withGoogleRateLimit(() =>
			this.googleCalendarService.createEvent(
				calendarId,
				{
					...eventData,
					isAllDay: !!eventData.start.date,
				}
			)
		);

		// Extract the actual event ID from the ICSEvent ID format.
		// Format is "google-{calendarId}-{eventId}". Calendar IDs can contain
		// hyphens, so strip the known prefix.
		const prefix = `google-${calendarId}-`;
		const eventId = createdEvent.id.startsWith(prefix)
			? createdEvent.id.slice(prefix.length)
			: createdEvent.id;

		await this.saveTaskEventId(task.path, eventId);
		return eventId;
	}

	/**
	 * Whether a recurring task currently needs a detached Google exception event.
	 */
	private shouldCreateDetachedRecurringException(task: TaskInfo): boolean {
		if (!this.shouldSyncAsRecurring(task)) {
			return false;
		}

		const movedScheduled = getDatePart(task.scheduled || "");
		const originalScheduled = getDatePart(task.googleCalendarExceptionOriginalScheduled || "");

		return Boolean(movedScheduled && originalScheduled && movedScheduled !== originalScheduled);
	}

	/**
	 * Build payload for detached recurring exception event.
	 * This always tracks the concrete moved scheduled occurrence, not the RRULE.
	 */
	private buildRecurringExceptionEvent(task: TaskInfo): {
		summary: string;
		description?: string;
		start: { date?: string; dateTime?: string; timeZone?: string };
		end: { date?: string; dateTime?: string; timeZone?: string };
		colorId?: string;
		reminders?: {
			useDefault: boolean;
			overrides?: Array<{ method: string; minutes: number }>;
		};
	} | null {
		if (!task.scheduled) {
			return null;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const startInfo = this.parseDateForEvent(task.scheduled);

		let start: { date?: string; dateTime?: string; timeZone?: string };
		if (settings.createAsAllDay && !startInfo.isAllDay) {
			const localDate = new Date(task.scheduled);
			start = { date: format(localDate, "yyyy-MM-dd") };
		} else if (startInfo.isAllDay) {
			start = { date: startInfo.date };
		} else {
			start = { dateTime: startInfo.dateTime, timeZone: startInfo.timeZone };
		}

		const adjustedStartInfo = {
			...startInfo,
			isAllDay: settings.createAsAllDay || startInfo.isAllDay,
			date: start.date,
			dateTime: start.dateTime,
		};
		const end = this.getEventEnd(adjustedStartInfo, task);

		const event: {
			summary: string;
			description?: string;
			start: { date?: string; dateTime?: string; timeZone?: string };
			end: { date?: string; dateTime?: string; timeZone?: string };
			colorId?: string;
			reminders?: {
				useDefault: boolean;
				overrides?: Array<{ method: string; minutes: number }>;
			};
		} = {
			summary: this.applyTitleTemplate(task),
			start,
			end,
		};

		if (settings.includeDescription) {
			event.description = this.buildEventDescription(task);
		}

		if (settings.eventColorId) {
			event.colorId = settings.eventColorId;
		}

		const taskReminders = this.convertTaskRemindersToGoogleFormat(
			task,
			task.scheduled,
			"scheduled"
		);

		if (taskReminders && taskReminders.length > 0) {
			event.reminders = {
				useDefault: false,
				overrides: taskReminders,
			};
		}

		return event;
	}

	/**
	 * Create/update/delete the detached Google event for the current moved recurring occurrence.
	 */
	private async syncRecurringExceptionEvent(task: TaskInfo): Promise<void> {
		const settings = this.plugin.settings.googleCalendarExport;
		const hasActiveException = this.shouldCreateDetachedRecurringException(task);
		const existingExceptionEventId = this.getTaskExceptionEventId(task);

		if (!hasActiveException) {
			if (existingExceptionEventId) {
				try {
					await this.withGoogleRateLimit(() =>
						this.googleCalendarService.deleteEvent(
							settings.targetCalendarId,
							existingExceptionEventId
						)
					);
				} catch (error: any) {
					if (error.status !== 404 && error.status !== 410) {
						throw error;
					}
				}
			}

			await this.saveTaskGoogleCalendarMetadata(task.path, {
				googleCalendarExceptionEventId: undefined,
				googleCalendarExceptionOriginalScheduled: undefined,
			});
			return;
		}

		const eventData = this.buildRecurringExceptionEvent(task);
		if (!eventData) {
			return;
		}

		try {
			if (existingExceptionEventId) {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						settings.targetCalendarId,
						existingExceptionEventId,
						eventData
					)
				);
				return;
			}

			const createdEvent = await this.withGoogleRateLimit(() =>
				this.googleCalendarService.createEvent(settings.targetCalendarId, {
					...eventData,
					isAllDay: !!eventData.start.date,
				})
			);

			const prefix = `google-${settings.targetCalendarId}-`;
			const eventId = createdEvent.id.startsWith(prefix)
				? createdEvent.id.slice(prefix.length)
				: createdEvent.id;

			await this.saveTaskGoogleCalendarMetadata(task.path, {
				googleCalendarExceptionEventId: eventId,
				googleCalendarExceptionOriginalScheduled: getDatePart(
					task.googleCalendarExceptionOriginalScheduled || ""
				),
			});
		} catch (error: any) {
			if (error.status === 404 && existingExceptionEventId) {
				await this.saveTaskGoogleCalendarMetadata(task.path, {
					googleCalendarExceptionEventId: undefined,
				});
				const updatedTask = await this.plugin.cacheManager.getTaskInfo(task.path);
				if (updatedTask) {
					return this.syncRecurringExceptionEvent(updatedTask);
				}
			}
			throw error;
		}
	}

	/**
	 * Sync a task to Google Calendar (create or update)
	 */
	async syncTaskToCalendar(
		task: TaskInfo,
		previous?: TaskInfo,
		options: { queueOnFailure?: boolean } = {}
	): Promise<boolean> {
		const queueOnFailure = options.queueOnFailure ?? true;

		if (!this.isTaskCalendarEligible(task)) {
			return true;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);
		const targetCalendarId = settings.targetCalendarId;

		try {
			if (!this.isEnabled()) {
				if (queueOnFailure) {
					await this.queueTaskSync(
						task.path,
						new Error("Google Calendar sync is not ready")
					);
				}
				return false;
			}

			// Check if recurrence was removed (previous had recurrence, current doesn't)
			const clearRecurrence = !!(previous?.recurrence && !task.recurrence);
			
			const eventData = this.taskToCalendarEvent(task, clearRecurrence);
			if (!eventData) {
				console.warn("[TaskCalendarSync] Could not convert task to event:", task.path);
				return false;
			}

			if (!targetCalendarId) {
				console.warn("[TaskCalendarSync] Cannot sync task without target calendar:", task.path);
				if (queueOnFailure) {
					await this.queueTaskSync(
						task.path,
						new Error("Google Calendar target calendar is not configured")
					);
				}
				return false;
			}

			if (existingEventId) {
				// Update existing event
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						targetCalendarId,
						existingEventId,
						eventData
					)
				);
			} else {
				const pendingCreate = this.pendingEventCreates.get(task.path);
				if (pendingCreate) {
					const eventId = await pendingCreate;
					await this.withGoogleRateLimit(() =>
						this.googleCalendarService.updateEvent(targetCalendarId, eventId, eventData)
					);
					return true;
				}

				const createPromise = this.createCalendarEventForTask(task, eventData, targetCalendarId);
				this.pendingEventCreates.set(task.path, createPromise);
				try {
					await createPromise;
				} finally {
					if (this.pendingEventCreates.get(task.path) === createPromise) {
						this.pendingEventCreates.delete(task.path);
					}
				}
			}

			// Keep the detached recurring exception event aligned with the current moved occurrence.
			if (this.shouldSyncAsRecurring(task) || task.googleCalendarExceptionEventId) {
				await this.syncRecurringExceptionEvent(task);
			}

			return true;
		} catch (error: any) {
			// Check if it's a 404 error (event was deleted externally)
			if (error.status === 404 && existingEventId) {
				// Clear the stale link and retry as create
				await this.saveTaskGoogleCalendarMetadata(task.path, {
					googleCalendarEventId: undefined,
				});
				// Retry without the link - refetch task to get updated version
				const updatedTask = await this.plugin.cacheManager.getTaskInfo(task.path);
				if (updatedTask) {
					return this.syncTaskToCalendar(updatedTask, previous, options);
				}
			}

			console.error("[TaskCalendarSync] Failed to sync task:", task.path, error);
			if (queueOnFailure) {
				await this.queueTaskSync(task.path, error, true);
			}

			// Show user-friendly message for token refresh errors
			// TokenRefreshError indicates the OAuth connection expired and user needs to reconnect
			if (error instanceof TokenRefreshError) {
				new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.connectionExpired"));
			} else {
				new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncFailed", { message: error.message }));
			}

			return false;
		}
	}

	/**
	 * Update a task in Google Calendar when it changes.
	 * Debounced to prevent rapid-fire API calls during quick successive edits.
	 */
	async updateTaskInCalendar(task: TaskInfo, previous?: TaskInfo): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskUpdate) {
			return;
		}

		const taskPath = task.path;

		// Store previous state for recurrence change detection
		if (previous) {
			this.previousTaskState.set(taskPath, previous);
		}

		// Cancel any pending debounced sync for this task
		const existingTimer = this.pendingSyncs.get(taskPath);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Store the authoritative task state passed to us so we don't rely on the async metadata cache
		this.pendingTasks.set(taskPath, task);

		// Return a promise that resolves when the debounced sync completes
		return new Promise((resolve, reject) => {
			const timer = setTimeout(async () => {
				this.pendingSyncs.delete(taskPath);

				// Wait for any in-flight sync to complete before starting a new one
				const inFlight = this.inFlightSyncs.get(taskPath);
				if (inFlight) {
					await inFlight.catch(() => {}); // Ignore errors from previous sync
				}

				// Use the latest task data that was passed to us explicitly
				const latestTask = this.pendingTasks.get(taskPath);
				this.pendingTasks.delete(taskPath);

				// Fallback to cache only if the pending task is missing
				const freshTask = latestTask || await this.plugin.cacheManager.getTaskInfo(taskPath);

				if (!freshTask) {
					resolve();
					return;
				}

				const syncPromise = this.executeTaskUpdate(freshTask);
				this.inFlightSyncs.set(taskPath, syncPromise);

				try {
					await syncPromise;
					resolve();
				} catch (error) {
					reject(error);
				} finally {
					this.inFlightSyncs.delete(taskPath);
				}
			}, SYNC_DEBOUNCE_MS);

			this.pendingSyncs.set(taskPath, timer);
		});
	}

	private cancelPendingTaskUpdate(taskPath: string): void {
		const existingTimer = this.pendingSyncs.get(taskPath);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.pendingSyncs.delete(taskPath);
			this.pendingTasks.delete(taskPath);
		}
	}

	private async waitForInFlightTaskSync(taskPath: string): Promise<void> {
		const inFlight = this.inFlightSyncs.get(taskPath);
		if (inFlight) {
			await inFlight.catch(() => {});
		}
	}

	/**
	 * Internal method that performs the actual task update sync
	 */
	private async executeTaskUpdate(task: TaskInfo): Promise<void> {
		const existingEventId = this.getTaskEventId(task);

		// If task no longer meets sync criteria, delete the event
		if (!this.isTaskCalendarEligible(task)) {
			if (existingEventId || this.hasStoredRecurringExceptionMetadata(task)) {
				const deleted = await this.deleteTaskFromCalendar(task);
				if (!deleted) {
					console.warn(`Google Calendar deletion queued for ${task.path}`);
				}
			}
			// Clean up previous state
			this.previousTaskState.delete(task.path);
			return;
		}

		// Get previous state for recurrence change detection
		const previousState = this.previousTaskState.get(task.path);

		// Sync the updated task
		await this.syncTaskToCalendar(task, previousState);
		
		// Update previous state with current task
		this.previousTaskState.set(task.path, task);
	}

	/**
	 * Handle task completion - update the calendar event.
	 * For recurring tasks, updates the EXDATE list to exclude the completed instance.
	 * For non-recurring tasks, adds a checkmark to the event title.
	 */
	async completeTaskInCalendar(task: TaskInfo): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskComplete) {
			return;
		}

		this.cancelPendingTaskUpdate(task.path);
		await this.waitForInFlightTaskSync(task.path);

		const completionPromise = this.executeTaskCompletion(task);
		this.inFlightSyncs.set(task.path, completionPromise);

		try {
			await completionPromise;
		} finally {
			if (this.inFlightSyncs.get(task.path) === completionPromise) {
				this.inFlightSyncs.delete(task.path);
			}
		}
	}

	private async executeTaskCompletion(task: TaskInfo): Promise<void> {
		const settings = this.plugin.settings.googleCalendarExport;
		let existingEventId = this.getTaskEventId(task);
		if (!existingEventId) {
			const synced = await this.syncTaskToCalendar(task);
			if (!synced) {
				return;
			}
			existingEventId = this.getTaskEventId(task);
			if (!existingEventId) {
				return;
			}
		}

		// For recurring tasks, update EXDATE to exclude completed instance
		if (this.shouldSyncAsRecurring(task)) {
			await this.updateRecurringEventExdates(task);
			return;
		}

		try {
			// Update the event title to indicate completion
			const description = settings.includeDescription
				? this.buildEventDescription(task)
				: undefined;

			await this.withGoogleRateLimit(() =>
				this.googleCalendarService.updateEvent(
					settings.targetCalendarId,
					existingEventId,
					{
						summary: this.getCalendarEventTitle(task),
						description,
					}
				)
			);
		} catch (error: any) {
			if (error.status === 404) {
				// Event was deleted externally, clean up the link
				await this.removeTaskEventId(task.path);
				return;
			}
			console.error("[TaskCalendarSync] Failed to update completed task:", task.path, error);
		}
	}

	/**
	 * Updates a recurring event's EXDATE list when an instance is completed or skipped.
	 * This adds EXDATE entries for completed/skipped instances to hide them from the calendar.
	 */
	private async updateRecurringEventExdates(task: TaskInfo): Promise<void> {
		if (!this.shouldSyncAsRecurring(task) || !task.recurrence) return;

		const settings = this.plugin.settings.googleCalendarExport;
		const eventId = this.getTaskEventId(task);
		if (!eventId) return;

		try {
			const recurrenceData = convertToGoogleRecurrence(task.recurrence, {
				completedInstances: task.complete_instances,
				skippedInstances: task.skipped_instances,
				additionalExcludedDates: this.getAdditionalRecurringExdates(task),
			});

			if (recurrenceData) {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						settings.targetCalendarId,
						eventId,
						{ recurrence: recurrenceData.recurrence }
					)
				);
			}
		} catch (error: any) {
			if (error.status === 404) {
				// Event was deleted externally, clean up the link
				await this.removeTaskEventId(task.path);
				return;
			}
			console.error("[TaskCalendarSync] Failed to update recurring event EXDATEs:", task.path, error);
			// Fall back to full resync
			await this.syncTaskToCalendar(task);
		}
	}

	/**
	 * Delete a task's calendar event
	 */
	async deleteTaskFromCalendar(task: TaskInfo): Promise<boolean> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return true;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getTaskEventId(task);
		const exceptionEventId = this.getTaskExceptionEventId(task);
		if (!existingEventId && !this.hasStoredRecurringExceptionMetadata(task)) {
			return true;
		}

		const targetCalendarId = settings.targetCalendarId;
		if (!targetCalendarId) {
			console.warn("[TaskCalendarSync] Cannot delete task event without target calendar:", task.path);
			return false;
		}

		const eventIds = [existingEventId, exceptionEventId].filter(
			(id): id is string => typeof id === "string" && id.length > 0
		);
		let allDeleted = true;
		for (const eventId of eventIds) {
			const deleted = await this.deleteOrQueueCalendarEvent(
				task.path,
				targetCalendarId,
				eventId
			);
			if (deleted) {
				await this.removeEventIndexForEvent(targetCalendarId, eventId);
			} else {
				allDeleted = false;
			}
		}

		if (!allDeleted) {
			return false;
		}

		await this.clearTaskGoogleCalendarMetadata(task.path);
		return true;
	}

	/**
	 * Delete a task's calendar event by path (used when task is being deleted)
	 */
	async deleteTaskFromCalendarByPath(
		taskPath: string,
		eventId?: string,
		...additionalEventIds: Array<string | undefined>
	): Promise<boolean> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return true;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const eventIds = [eventId, ...additionalEventIds].filter(
			(id): id is string => typeof id === "string" && id.length > 0
		);

		if (eventIds.length === 0) {
			return true;
		}

		const targetCalendarId = settings.targetCalendarId;
		if (!targetCalendarId) {
			console.warn("[TaskCalendarSync] Cannot delete task events without target calendar:", taskPath);
			return false;
		}

		const results: boolean[] = [];
		for (const id of eventIds) {
			const deleted = await this.deleteOrQueueCalendarEvent(taskPath, targetCalendarId, id);
			if (deleted) {
				await this.removeEventIndexForEvent(targetCalendarId, id);
			}
			results.push(deleted);
		}

		// No need to remove from frontmatter since the task file is being deleted.
		return results.every(Boolean);
	}

	// handleTaskPathChange is no longer needed - event ID is stored in frontmatter
	// and moves with the file automatically when renamed/moved

	/**
	 * Sync all tasks to Google Calendar (initial sync or resync).
	 * Uses parallel execution with concurrency limits to improve performance.
	 */
	async syncAllTasks(): Promise<{ synced: number; failed: number; skipped: number }> {
		const results = { synced: 0, failed: 0, skipped: 0 };

		if (!this.isEnabled()) {
			new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured"));
			return results;
		}

		const allTasks = await this.plugin.cacheManager.getAllTasks();

		// Filter to only tasks that should be synced
		const tasksToSync = allTasks.filter((task) => {
			if (!this.shouldSyncTask(task)) {
				results.skipped++;
				return false;
			}
			return true;
		});

		const total = allTasks.length;
		new Notice(this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncingTasks", { total }));

		// Process tasks in parallel with concurrency limit
		await this.processInParallel(tasksToSync, async (task) => {
			try {
				const synced = await this.syncTaskToCalendar(task);
				if (synced) {
					results.synced++;
				} else {
					results.failed++;
				}
			} catch (error) {
				results.failed++;
				console.error(`[TaskCalendarSync] Failed to sync task ${task.path}:`, error);
			}
		});

		new Notice(
			this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.syncComplete", {
				synced: results.synced,
				failed: results.failed,
				skipped: results.skipped,
			})
		);

		return results;
	}

	/**
	 * Remove all task-event links and optionally delete events.
	 * Iterates over all tasks and removes the googleCalendarEventId from frontmatter.
	 */
	async unlinkAllTasks(deleteEvents = false): Promise<void> {
		const settings = this.plugin.settings.googleCalendarExport;
		const tasks = await this.plugin.cacheManager.getAllTasks();
		let unlinkedCount = 0;

		for (const task of tasks) {
			if (!task.googleCalendarEventId && !this.hasStoredRecurringExceptionMetadata(task)) {
				continue;
			}

			if (deleteEvents) {
				const targetCalendarId = settings.targetCalendarId;
				if (!targetCalendarId) {
					console.warn(`[TaskCalendarSync] Cannot delete event without target calendar for ${task.path}`);
					continue;
				}

				const eventIds = [
					task.googleCalendarEventId,
					task.googleCalendarExceptionEventId,
				].filter((eventId): eventId is string => !!eventId);
				let allDeleted = true;
				for (const eventId of eventIds) {
					const deleted = await this.deleteOrQueueCalendarEvent(
						task.path,
						targetCalendarId,
						eventId
					);
					if (deleted) {
						await this.removeEventIndexForEvent(targetCalendarId, eventId);
					} else {
						allDeleted = false;
					}
				}
				if (!allDeleted) {
					console.warn(`[TaskCalendarSync] Event deletion queued; keeping link for ${task.path}`);
					continue;
				}
			}

			await this.clearTaskGoogleCalendarMetadata(task.path);
			unlinkedCount++;
		}

		new Notice(
			deleteEvents
				? this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.eventsDeletedAndUnlinked", { count: unlinkedCount })
				: this.plugin.i18n.translate("settings.integrations.googleCalendarExport.notices.tasksUnlinked", { count: unlinkedCount })
		);
	}
}
