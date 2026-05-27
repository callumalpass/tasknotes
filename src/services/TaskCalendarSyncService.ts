import { TFile } from "obsidian";
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
import { stringifyUnknown } from "../utils/stringUtils";
import { getDatePart } from "../utils/dateUtils";
import { TokenRefreshError } from "./errors";
import { GOOGLE_CALENDAR_CONSTANTS } from "./constants";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { publishUserNotice } from "../core/userNotices";
import { processVaultFrontMatter } from "./VaultMutationService";
import type { PerformanceProfilerDetails } from "../utils/PerformanceProfiler";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TaskCalendarSyncService" });

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

/** Persistent plugin-data key for the last task state known to match Google Calendar */
const GOOGLE_CALENDAR_FINGERPRINTS_KEY = "googleCalendarTaskFingerprints";

/** Delay between queued Google Calendar recovery retry attempts */
const RECOVERY_QUEUE_RETRY_DELAY_MS = 60000;

/** Minimum delay between full event-index recovery scans after startup. */
const EVENT_INDEX_RECOVERY_INTERVAL_MS = 15 * 60 * 1000;

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

function getErrorStatus(error: unknown): number | undefined {
	if (error === null || typeof error !== "object") {
		return undefined;
	}

	const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
	if (typeof status === "number") {
		return status;
	}
	if (typeof statusCode === "number") {
		return statusCode;
	}
	return undefined;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (error !== null && typeof error === "object") {
		const message = (error as { message?: unknown }).message;
		if (message !== undefined) {
			return stringifyUnknown(message);
		}
	}
	return stringifyUnknown(error);
}

function isAlreadyDeletedError(error: unknown): boolean {
	const status = getErrorStatus(error);
	return status === 404 || status === 410;
}

/**
 * Service for syncing TaskNotes tasks to Google Calendar.
 * Handles creating, updating, and deleting calendar events when tasks change.
 */
export class TaskCalendarSyncService {
	/** In-flight create operations keyed by calendar and task path to avoid duplicate Google events */
	private static pendingEventCreates: Map<string, Promise<string>> = new Map();

	/** In-flight detached exception creates keyed by calendar and task path */
	private static pendingExceptionEventCreates: Map<string, Promise<string>> = new Map();

	/** Event IDs written during this session, used while Obsidian metadata catches up */
	private static taskEventIdCache: Map<string, string> = new Map();

	/** Detached exception event IDs written during this session */
	private static taskExceptionEventIdCache: Map<string, string> = new Map();

	private plugin: TaskNotesPlugin;
	private googleCalendarService: GoogleCalendarService;
	private rateLimitChain: Promise<unknown> = Promise.resolve();
	private lastApiCallAt = 0;
	private recoveryQueueProcessorStarted = false;
	private recoveryQueueProcessorTimeout: number | null = null;
	private lastEventIndexRecoveryAt = 0;

	/** Debounce timers for pending syncs, keyed by task path */
	private pendingSyncs: Map<string, number> = new Map();

	/** In-flight sync operations to prevent concurrent syncs for the same task */
	private inFlightSyncs: Map<string, Promise<unknown>> = new Map();

	/** Track previous task state for detecting recurrence removal */
	private previousTaskState: Map<string, TaskInfo> = new Map();

	/** Store the latest explicitly passed task object during debounce to avoid cache race conditions */
	private pendingTasks: Map<string, TaskInfo> = new Map();

	/** Last calendar-relevant task fingerprint persisted after successful syncs */
	private calendarFingerprints: Map<string, string> | null = null;

	constructor(plugin: TaskNotesPlugin, googleCalendarService: GoogleCalendarService) {
		this.plugin = plugin;
		this.googleCalendarService = googleCalendarService;
	}

	private static getTaskCalendarCacheKey(taskPath: string, calendarId?: string): string {
		return calendarId ? `${calendarId}::${taskPath}` : taskPath;
	}

	private static deleteTaskPathEntries(cache: Map<string, unknown>, taskPath: string): void {
		cache.delete(TaskCalendarSyncService.getTaskCalendarCacheKey(taskPath));
		for (const key of Array.from(cache.keys())) {
			if (key.endsWith(`::${taskPath}`)) {
				cache.delete(key);
			}
		}
	}

	private static clearTaskEventIdCache(taskPath: string, calendarId?: string): void {
		if (calendarId) {
			TaskCalendarSyncService.taskEventIdCache.delete(
				TaskCalendarSyncService.getTaskCalendarCacheKey(taskPath, calendarId)
			);
			return;
		}

		TaskCalendarSyncService.deleteTaskPathEntries(
			TaskCalendarSyncService.taskEventIdCache,
			taskPath
		);
	}

	private static clearTaskExceptionEventIdCache(
		taskPath: string,
		calendarId?: string
	): void {
		if (calendarId) {
			TaskCalendarSyncService.taskExceptionEventIdCache.delete(
				TaskCalendarSyncService.getTaskCalendarCacheKey(taskPath, calendarId)
			);
			return;
		}

		TaskCalendarSyncService.deleteTaskPathEntries(
			TaskCalendarSyncService.taskExceptionEventIdCache,
			taskPath
		);
	}

	static clearSharedGoogleCalendarSyncStateForTests(): void {
		TaskCalendarSyncService.pendingEventCreates.clear();
		TaskCalendarSyncService.pendingExceptionEventCreates.clear();
		TaskCalendarSyncService.taskEventIdCache.clear();
		TaskCalendarSyncService.taskExceptionEventIdCache.clear();
	}

	private getTaskEventIdCacheKey(taskPath: string, calendarId?: string): string {
		return TaskCalendarSyncService.getTaskCalendarCacheKey(
			taskPath,
			calendarId || this.plugin.settings.googleCalendarExport.targetCalendarId
		);
	}

	private profileAsync<T>(
		name: string,
		fn: () => Promise<T>,
		details?: PerformanceProfilerDetails
	): Promise<T> {
		return (
			this.plugin.performanceProfiler?.measureAsync(`calendarSync.${name}`, fn, details) ??
			fn()
		);
	}

	private profileIncrement(
		name: string,
		amount = 1,
		details?: PerformanceProfilerDetails
	): void {
		this.plugin.performanceProfiler?.increment(`calendarSync.${name}`, amount, details);
	}

	private profileGauge(
		name: string,
		value: number,
		details?: PerformanceProfilerDetails
	): void {
		this.plugin.performanceProfiler?.recordGauge(`calendarSync.${name}`, value, details);
	}

	/**
	 * Clean up pending timers (call on plugin unload)
	 */
	destroy(): void {
		for (const timer of this.pendingSyncs.values()) {
			window.clearTimeout(timer);
		}
		this.recoveryQueueProcessorStarted = false;
		if (this.recoveryQueueProcessorTimeout) {
			window.clearTimeout(this.recoveryQueueProcessorTimeout);
			this.recoveryQueueProcessorTimeout = null;
		}
		this.pendingSyncs.clear();
		this.previousTaskState.clear();
		this.pendingTasks.clear();
		this.calendarFingerprints = null;
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
				void executing.splice(executing.indexOf(promise), 1);
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
		const run = async (): Promise<T> => {
			const now = Date.now();
			const wait = Math.max(0, GOOGLE_API_CALL_SPACING_MS - (now - this.lastApiCallAt));
			if (wait > 0) {
				await new Promise((resolve) => window.setTimeout(resolve, wait));
			}

			try {
				return await fn();
			} finally {
				this.lastApiCallAt = Date.now();
			}
		};

		const operation = this.rateLimitChain.then(run, run);
		this.rateLimitChain = operation.catch(() => undefined);
		return operation;
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
	startRecoveryQueueProcessor(): void {
		if (this.recoveryQueueProcessorStarted) {
			return;
		}

		this.recoveryQueueProcessorStarted = true;
		this.runRecoveryQueueProcessor(true);
	}

	private runRecoveryQueueProcessor(includeStartupRecovery: boolean): void {
		const recovery = includeStartupRecovery
			? this.processStartupRecovery()
			: this.processRecoveryQueues();

		recovery
			.catch((error) => {
				tasknotesLogger.error("[TaskCalendarSync] Failed to process recovery queues:", {
					category: "provider",
					operation: "process-recovery-queues",
					error: error,
				});
			})
			.finally(() => {
				this.scheduleRecoveryQueueProcessor();
			});
	}

	private scheduleRecoveryQueueProcessor(): void {
		if (!this.recoveryQueueProcessorStarted || this.recoveryQueueProcessorTimeout) {
			return;
		}

		this.recoveryQueueProcessorTimeout = window.setTimeout(() => {
			this.recoveryQueueProcessorTimeout = null;
			this.runRecoveryQueueProcessor(false);
		}, RECOVERY_QUEUE_RETRY_DELAY_MS);
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

	private getDeletionQueueKey(
		item: Pick<PendingGoogleCalendarDeletion, "calendarId" | "eventId">
	): string {
		return `${item.calendarId}::${item.eventId}`;
	}

	private getEventIndexTaskCalendarKey(
		item: Pick<GoogleCalendarEventIndexEntry, "taskPath" | "calendarId">
	): string {
		return `${item.calendarId}::${item.taskPath}`;
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

	private async getCalendarFingerprints(): Promise<Map<string, string>> {
		if (this.calendarFingerprints) {
			return this.calendarFingerprints;
		}

		const data = await this.plugin.loadData();
		const rawFingerprints = data?.[GOOGLE_CALENDAR_FINGERPRINTS_KEY];
		const fingerprints = new Map<string, string>();

		if (rawFingerprints && typeof rawFingerprints === "object") {
			for (const [path, fingerprint] of Object.entries(rawFingerprints)) {
				if (typeof path === "string" && typeof fingerprint === "string") {
					fingerprints.set(path, fingerprint);
				}
			}
		}

		this.calendarFingerprints = fingerprints;
		return fingerprints;
	}

	private async saveCalendarFingerprints(fingerprints?: Map<string, string>): Promise<void> {
		const map = fingerprints || (await this.getCalendarFingerprints());
		const data = (await this.plugin.loadData()) || {};
		data[GOOGLE_CALENDAR_FINGERPRINTS_KEY] = Object.fromEntries(map.entries());
		await this.plugin.saveData(data);
	}

	private getCalendarRelevantFingerprint(task: TaskInfo): string {
		return JSON.stringify({
			title: task.title || "",
			status: task.status || "",
			priority: task.priority || "",
			archived: !!task.archived,
			scheduled: task.scheduled || null,
			due: task.due || null,
			timeEstimate: task.timeEstimate ?? null,
			recurrence: task.recurrence || null,
			recurrence_anchor: task.recurrence_anchor || null,
			complete_instances: task.complete_instances || [],
			skipped_instances: task.skipped_instances || [],
			reminders: task.reminders || [],
			tags: task.tags || [],
			contexts: task.contexts || [],
			projects: task.projects || [],
		});
	}

	private parseCalendarRelevantFingerprint(
		fingerprint: string | undefined
	): Record<string, unknown> | null {
		if (!fingerprint) {
			return null;
		}

		try {
			const parsed = JSON.parse(fingerprint);
			return parsed && typeof parsed === "object" && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}

	private getTaskStateFromFingerprint(
		task: TaskInfo,
		fingerprint: string | undefined
	): TaskInfo | undefined {
		const fingerprintData = this.parseCalendarRelevantFingerprint(fingerprint);
		if (!fingerprintData) {
			return undefined;
		}

		const stringValue = (key: string): string | undefined => {
			const value = fingerprintData[key];
			return typeof value === "string" ? value : undefined;
		};
		const stringArrayValue = (key: string): string[] | undefined => {
			const value = fingerprintData[key];
			return Array.isArray(value)
				? value.filter((entry): entry is string => typeof entry === "string")
				: undefined;
		};
		const recurrenceAnchor = fingerprintData.recurrence_anchor;

		return {
			...task,
			title: stringValue("title") || task.title,
			status: stringValue("status") || task.status,
			priority: stringValue("priority") || task.priority,
			archived:
				typeof fingerprintData.archived === "boolean"
					? fingerprintData.archived
					: task.archived,
			scheduled: stringValue("scheduled"),
			due: stringValue("due"),
			timeEstimate:
				typeof fingerprintData.timeEstimate === "number"
					? fingerprintData.timeEstimate
					: undefined,
			recurrence: stringValue("recurrence"),
			recurrence_anchor:
				recurrenceAnchor === "scheduled" || recurrenceAnchor === "completion"
					? recurrenceAnchor
					: undefined,
			complete_instances: stringArrayValue("complete_instances"),
			skipped_instances: stringArrayValue("skipped_instances"),
			tags: stringArrayValue("tags"),
			contexts: stringArrayValue("contexts"),
			projects: stringArrayValue("projects"),
		};
	}

	private hasTaskCalendarLink(task: TaskInfo): boolean {
		return !!this.getTaskEventId(task);
	}

	private normalizeStatusValue(value: unknown): string {
		return typeof value === "boolean" ? (value ? "true" : "false") : String(value);
	}

	private async reconcileExternalAutoArchive(
		task: TaskInfo,
		previousTask?: TaskInfo
	): Promise<void> {
		if (!previousTask || !this.plugin.autoArchiveService) {
			return;
		}

		const previousStatus = this.normalizeStatusValue(previousTask.status);
		const currentStatus = this.normalizeStatusValue(task.status);
		if (previousStatus === currentStatus) {
			return;
		}

		try {
			const statusConfig = this.plugin.statusManager.getStatusConfig(currentStatus);
			if (!statusConfig) {
				return;
			}

			if (statusConfig.autoArchive) {
				await this.plugin.autoArchiveService.scheduleAutoArchive(task, statusConfig);
			} else {
				await this.plugin.autoArchiveService.cancelAutoArchive(task.path);
			}
		} catch (error) {
			tasknotesLogger.warn("Failed to reconcile auto-archive for external task update:", {
				category: "persistence",
				operation: "reconcile-external-auto-archive",
				error: error,
			});
		}
	}

	private async recordCalendarSyncFingerprint(task: TaskInfo): Promise<void> {
		const fingerprints = await this.getCalendarFingerprints();
		const fingerprint = this.getCalendarRelevantFingerprint(task);

		if (fingerprints.get(task.path) === fingerprint) {
			return;
		}

		fingerprints.set(task.path, fingerprint);
		await this.saveCalendarFingerprints(fingerprints);
	}

	private async removeCalendarSyncFingerprint(taskPath: string): Promise<void> {
		const fingerprints = await this.getCalendarFingerprints();
		if (!fingerprints.delete(taskPath)) {
			return;
		}

		await this.saveCalendarFingerprints(fingerprints);
	}

	private async upsertEventIndex(
		taskPath: string,
		calendarId: string,
		eventId: string
	): Promise<void> {
		const index = await this.getEventIndex();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const matchingEntries = index.filter(
			(item) =>
				this.getDeletionQueueKey(item) === key &&
				item.taskPath === taskPath &&
				item.calendarId === calendarId &&
				item.eventId === eventId
		);
		const replacedEntries = index.filter(
			(item) =>
				item.taskPath === taskPath &&
				item.calendarId === calendarId &&
				item.eventId !== eventId
		);
		const filteredIndex = index.filter(
			(item) =>
				this.getDeletionQueueKey(item) !== key &&
				!(item.taskPath === taskPath && item.calendarId === calendarId)
		);

		if (
			matchingEntries.length === 1 &&
			replacedEntries.length === 0 &&
			filteredIndex.length === index.length - 1
		) {
			return;
		}

		filteredIndex.push({
			taskPath,
			calendarId,
			eventId,
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
				tasknotesLogger.warn(
					`[TaskCalendarSync] Replaced event cleanup queued for ${item.taskPath}`,
					{ category: "provider", operation: "replaced-event-cleanup-queued" }
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

	private async removeEventIndexForEvent(calendarId: string, eventId: string): Promise<void> {
		const index = await this.getEventIndex();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const filteredIndex = index.filter((item) => this.getDeletionQueueKey(item) !== key);

		if (filteredIndex.length !== index.length) {
			await this.saveEventIndex(filteredIndex);
		}
	}

	private async queueTaskSync(
		taskPath: string,
		error?: unknown,
		attempted = false
	): Promise<void> {
		const now = Date.now();
		const queue = await this.getSyncQueue();
		const existing = queue.find((item) => item.taskPath === taskPath);
		const lastError = error ? getErrorMessage(error) : undefined;

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
		error?: unknown,
		attempted = false
	): Promise<void> {
		const now = Date.now();
		const queue = await this.getDeletionQueue();
		const key = this.getDeletionQueueKey({ calendarId, eventId });
		const existing = queue.find((item) => this.getDeletionQueueKey(item) === key);
		const lastError = error ? getErrorMessage(error) : undefined;

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
		} catch (error: unknown) {
			if (isAlreadyDeletedError(error)) {
				await this.removeFromDeletionQueue(calendarId, eventId);
				return true;
			}

			tasknotesLogger.error("[TaskCalendarSync] Failed to delete event:", {
				category: "provider",
				operation: "delete-event",
				details: { value: taskPath },
				error: error,
			});
			await this.queueCalendarDeletion(taskPath, calendarId, eventId, error, true);
			return false;
		}
	}

	private async clearTaskEventIdIfMatching(item: PendingGoogleCalendarDeletion): Promise<void> {
		const task = await this.plugin.cacheManager.getTaskInfo(item.taskPath);
		if (task?.googleCalendarEventId === item.eventId) {
			await this.removeTaskEventId(item.taskPath);
		}
	}

	private async isQueuedDeletionStillNeeded(
		item: PendingGoogleCalendarDeletion
	): Promise<boolean> {
		const task = await this.plugin.cacheManager.getTaskInfo(item.taskPath);
		if (!task) {
			return true;
		}

		const currentEventId = this.getTaskEventId(task);
		if (currentEventId !== item.eventId) {
			return true;
		}

		return !this.isTaskCalendarEligible(task);
	}

	async processStartupRecovery(): Promise<void> {
		await this.profileAsync("processStartupRecovery", async () => {
			await this.recoverDeletedTaskEventsFromIndex();
			await this.processDeletionQueue();
			await this.processPendingSyncQueue();
		});
	}

	async processRecoveryQueues(): Promise<void> {
		await this.profileAsync("processRecoveryQueues", async () => {
			await this.recoverDeletedTaskEventsFromIndexIfDue();
			await this.processDeletionQueue();
			await this.processPendingSyncQueue();
		});
	}

	private async recoverDeletedTaskEventsFromIndexIfDue(): Promise<void> {
		const elapsed = Date.now() - this.lastEventIndexRecoveryAt;
		if (this.lastEventIndexRecoveryAt > 0 && elapsed < EVENT_INDEX_RECOVERY_INTERVAL_MS) {
			this.profileIncrement("recoverDeletedTaskEventsFromIndex.skipped", 1, {
				reason: "interval",
				nextDueInMs: EVENT_INDEX_RECOVERY_INTERVAL_MS - elapsed,
			});
			return;
		}

		await this.recoverDeletedTaskEventsFromIndex();
	}

	async initializeExternalFileReconciliation(): Promise<void> {
		await this.profileAsync("initializeExternalFileReconciliation", async () => {
			const settings = this.plugin.settings.googleCalendarExport;
			this.profileGauge("initializeExternalFileReconciliation.enabled", settings.enabled ? 1 : 0);
			if (!settings.enabled) {
				return;
			}

			const fingerprints = await this.getCalendarFingerprints();
			const tasks = await this.plugin.cacheManager.getAllTasks();
			const activeTaskPaths = new Set<string>();
			let changed = false;
			let changedTasks = 0;
			let linkedTasks = 0;
			let baselineTasks = 0;

			for (const task of tasks) {
				activeTaskPaths.add(task.path);
				const fingerprint = this.getCalendarRelevantFingerprint(task);
				const previousFingerprint = fingerprints.get(task.path);

				if (previousFingerprint === undefined) {
					fingerprints.set(task.path, fingerprint);
					changed = true;
					baselineTasks++;
					continue;
				}

				const previousTask = this.getTaskStateFromFingerprint(task, previousFingerprint);
				const hasCalendarLink = this.hasTaskCalendarLink(task);
				if (hasCalendarLink) {
					linkedTasks++;
				}

				if (previousFingerprint !== fingerprint) {
					changedTasks++;
					await this.reconcileExternalAutoArchive(task, previousTask);
				}

				if (hasCalendarLink && previousFingerprint !== fingerprint) {
					if (settings.syncOnTaskUpdate) {
						await this.executeTaskUpdate(task, previousTask);
					} else {
						fingerprints.set(task.path, fingerprint);
						changed = true;
					}
					continue;
				}

				if (previousFingerprint !== fingerprint) {
					fingerprints.set(task.path, fingerprint);
					changed = true;
				}
			}

			let removedFingerprints = 0;
			for (const path of Array.from(fingerprints.keys())) {
				if (!activeTaskPaths.has(path)) {
					fingerprints.delete(path);
					changed = true;
					removedFingerprints++;
				}
			}

			this.profileGauge("initializeExternalFileReconciliation.tasks", tasks.length);
			this.profileGauge("initializeExternalFileReconciliation.linkedTasks", linkedTasks);
			this.profileGauge("initializeExternalFileReconciliation.changedTasks", changedTasks);
			this.profileGauge("initializeExternalFileReconciliation.baselineTasks", baselineTasks);
			this.profileGauge(
				"initializeExternalFileReconciliation.removedFingerprints",
				removedFingerprints
			);

			if (changed) {
				await this.saveCalendarFingerprints(fingerprints);
			}
		});
	}

	async handleExternalTaskFileUpdated(taskPath: string, updatedTask?: TaskInfo): Promise<void> {
		await this.profileAsync(
			"handleExternalTaskFileUpdated",
			async () => {
				const settings = this.plugin.settings.googleCalendarExport;
				if (!settings.enabled) {
					return;
				}

				const task = updatedTask || (await this.plugin.cacheManager.getTaskInfo(taskPath));
				if (!task) {
					this.profileIncrement("handleExternalTaskFileUpdated.removedTask");
					await this.removeCalendarSyncFingerprint(taskPath);
					return;
				}

				const fingerprints = await this.getCalendarFingerprints();
				const fingerprint = this.getCalendarRelevantFingerprint(task);
				const previousFingerprint = fingerprints.get(task.path);

				if (previousFingerprint === fingerprint) {
					this.profileIncrement("handleExternalTaskFileUpdated.unchanged");
					return;
				}

				const previousTask = this.getTaskStateFromFingerprint(task, previousFingerprint);
				await this.reconcileExternalAutoArchive(task, previousTask);

				if (this.hasTaskCalendarLink(task)) {
					this.profileIncrement("handleExternalTaskFileUpdated.changedLinkedTask");
					if (settings.syncOnTaskUpdate) {
						await this.executeTaskUpdate(task, previousTask);
					} else {
						await this.recordCalendarSyncFingerprint(task);
					}
					return;
				}

				if (this.isTaskCalendarEligible(task)) {
					this.profileIncrement("handleExternalTaskFileUpdated.changedEligibleTask");
					if (settings.syncOnTaskCreate) {
						await this.syncTaskToCalendar(task);
					} else {
						await this.recordCalendarSyncFingerprint(task);
					}
					return;
				}

				this.profileIncrement("handleExternalTaskFileUpdated.changedIneligibleTask");
				await this.recordCalendarSyncFingerprint(task);
			},
			{ hadUpdatedTask: updatedTask !== undefined }
		);
	}

	async recoverDeletedTaskEventsFromIndex(): Promise<void> {
		await this.profileAsync("recoverDeletedTaskEventsFromIndex", async () => {
			if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
				this.profileGauge("recoverDeletedTaskEventsFromIndex.enabled", 0);
				return;
			}
			this.profileGauge("recoverDeletedTaskEventsFromIndex.enabled", 1);

			const targetCalendarId = this.plugin.settings.googleCalendarExport.targetCalendarId;
			if (!targetCalendarId) {
				this.profileGauge("recoverDeletedTaskEventsFromIndex.hasTargetCalendar", 0);
				return;
			}
			this.profileGauge("recoverDeletedTaskEventsFromIndex.hasTargetCalendar", 1);

			const tasks = await this.plugin.cacheManager.getAllTasks();
			const index = await this.getEventIndex();
			const activeTasksByEvent = new Map<string, TaskInfo>();
			const eventIndexByEvent = new Map<string, GoogleCalendarEventIndexEntry>();
			const nextIndexByTaskCalendar = new Map<string, GoogleCalendarEventIndexEntry>();
			const replacedEntries: GoogleCalendarEventIndexEntry[] = [];
			let linkedTasks = 0;
			let indexChanged = false;

			for (const item of index) {
				const eventKey = this.getDeletionQueueKey(item);
				const taskCalendarKey = this.getEventIndexTaskCalendarKey(item);

				if (eventIndexByEvent.has(eventKey) || nextIndexByTaskCalendar.has(taskCalendarKey)) {
					indexChanged = true;
					continue;
				}

				eventIndexByEvent.set(eventKey, item);
				nextIndexByTaskCalendar.set(taskCalendarKey, item);
			}

			for (const task of tasks) {
				const eventId = this.getTaskEventId(task);
				if (!eventId) {
					continue;
				}

				linkedTasks++;
				const key = this.getDeletionQueueKey({
					calendarId: targetCalendarId,
					eventId,
				});
				const taskCalendarKey = this.getEventIndexTaskCalendarKey({
					taskPath: task.path,
					calendarId: targetCalendarId,
				});
				activeTasksByEvent.set(key, task);

				const existingTaskEntry = nextIndexByTaskCalendar.get(taskCalendarKey);
				if (
					existingTaskEntry?.taskPath === task.path &&
					existingTaskEntry.calendarId === targetCalendarId &&
					existingTaskEntry.eventId === eventId
				) {
					continue;
				}

				const existingEventEntry = eventIndexByEvent.get(key);
				if (existingTaskEntry && existingTaskEntry.eventId !== eventId) {
					replacedEntries.push(existingTaskEntry);
				}
				if (existingEventEntry && existingEventEntry.taskPath !== task.path) {
					nextIndexByTaskCalendar.delete(
						this.getEventIndexTaskCalendarKey(existingEventEntry)
					);
				}

				const nextEntry = {
					taskPath: task.path,
					calendarId: targetCalendarId,
					eventId,
					updatedAt: existingEventEntry?.updatedAt || existingTaskEntry?.updatedAt || Date.now(),
				};
				nextIndexByTaskCalendar.set(taskCalendarKey, nextEntry);
				eventIndexByEvent.set(key, nextEntry);
				indexChanged = true;
			}

			if (indexChanged) {
				await this.saveEventIndex(Array.from(nextIndexByTaskCalendar.values()));
			}

			let queuedDeletions = 0;
			for (const item of nextIndexByTaskCalendar.values()) {
				const activeTask = activeTasksByEvent.get(this.getDeletionQueueKey(item));
				if (activeTask && this.isTaskCalendarEligible(activeTask)) {
					continue;
				}

				queuedDeletions++;
				await this.queueCalendarDeletion(
					activeTask?.path || item.taskPath,
					item.calendarId,
					item.eventId,
					activeTask
						? new Error("Indexed task no longer meets calendar sync criteria")
						: new Error("Indexed task file no longer exists")
				);
			}

			for (const item of replacedEntries) {
				const deleted = await this.deleteOrQueueCalendarEvent(
					item.taskPath,
					item.calendarId,
					item.eventId
				);
				if (!deleted) {
					tasknotesLogger.warn(
						`[TaskCalendarSync] Replaced event cleanup queued for ${item.taskPath}`,
						{ category: "provider", operation: "replaced-event-cleanup-queued" }
					);
				}
			}

			this.lastEventIndexRecoveryAt = Date.now();
			this.profileGauge("recoverDeletedTaskEventsFromIndex.tasks", tasks.length);
			this.profileGauge("recoverDeletedTaskEventsFromIndex.linkedTasks", linkedTasks);
			this.profileGauge(
				"recoverDeletedTaskEventsFromIndex.indexEntries",
				nextIndexByTaskCalendar.size
			);
			this.profileGauge("recoverDeletedTaskEventsFromIndex.queuedDeletions", queuedDeletions);
		});
	}

	async processPendingSyncQueue(): Promise<{
		synced: number;
		failed: number;
		deleted: number;
		dropped: number;
		remaining: number;
	}> {
		return this.profileAsync("processPendingSyncQueue", async () => {
			const results = { synced: 0, failed: 0, deleted: 0, dropped: 0, remaining: 0 };
			const queue = await this.getSyncQueue();
			this.profileGauge("processPendingSyncQueue.queueLength", queue.length);

			if (queue.length === 0) {
				return results;
			}

			if (!this.isSyncQueueReady()) {
				results.remaining = queue.length;
				this.profileGauge("processPendingSyncQueue.remaining", results.remaining);
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
							tasknotesLogger.warn(
								`[TaskCalendarSync] Calendar deletion queued while replaying sync for ${item.taskPath}`,
								{
									category: "provider",
									operation: "calendar-deletion-queued-replaying-sync",
								}
							);
						}
						results.deleted++;
					} else {
						results.dropped++;
					}
					continue;
				}

				const synced = await this.syncTaskToCalendar(task, undefined, {
					queueOnFailure: false,
				});
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
			this.profileGauge("processPendingSyncQueue.synced", results.synced);
			this.profileGauge("processPendingSyncQueue.failed", results.failed);
			this.profileGauge("processPendingSyncQueue.deleted", results.deleted);
			this.profileGauge("processPendingSyncQueue.dropped", results.dropped);
			this.profileGauge("processPendingSyncQueue.remaining", results.remaining);
			return results;
		});
	}

	async processDeletionQueue(): Promise<{ deleted: number; failed: number; remaining: number }> {
		return this.profileAsync("processDeletionQueue", async () => {
			const results = { deleted: 0, failed: 0, remaining: 0 };
			const queue = await this.getDeletionQueue();
			this.profileGauge("processDeletionQueue.queueLength", queue.length);

			if (queue.length === 0) {
				return results;
			}

			if (!this.isDeletionQueueReady()) {
				results.remaining = queue.length;
				this.profileGauge("processDeletionQueue.remaining", results.remaining);
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
				} catch (error: unknown) {
					if (isAlreadyDeletedError(error)) {
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
						lastError: getErrorMessage(error),
					});
					tasknotesLogger.error("[TaskCalendarSync] Failed to retry queued event deletion:", {
						category: "provider",
						operation: "retry-queued-event-deletion",
						details: { value: item },
						error: error,
					});
				}
			}

			results.remaining = remainingItems.length;
			await this.saveDeletionQueue(remainingItems);
			this.profileGauge("processDeletionQueue.deleted", results.deleted);
			this.profileGauge("processDeletionQueue.failed", results.failed);
			this.profileGauge("processDeletionQueue.remaining", results.remaining);
			return results;
		});
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
		return (
			task.googleCalendarEventId ||
			TaskCalendarSyncService.taskEventIdCache.get(
				this.getTaskEventIdCacheKey(task.path)
			)
		);
	}

	/**
	 * Get the detached recurring exception event ID from task frontmatter/cache.
	 */
	getTaskExceptionEventId(task: TaskInfo): string | undefined {
		return (
			task.googleCalendarExceptionEventId ||
			TaskCalendarSyncService.taskExceptionEventIdCache.get(
				this.getTaskEventIdCacheKey(task.path)
			)
		);
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

	private hasStoredRecurringExceptionMetadata(task: TaskInfo): boolean {
		return Boolean(
			this.getTaskExceptionEventId(task) ||
				task.googleCalendarExceptionOriginalScheduled ||
				(task.googleCalendarMovedOriginalDates &&
					task.googleCalendarMovedOriginalDates.length > 0)
		);
	}

	private getAdditionalRecurringExdates(task: TaskInfo): string[] {
		const excludedDates = new Set<string>();

		for (const date of task.googleCalendarMovedOriginalDates || []) {
			const normalized = getDatePart(date);
			if (normalized) {
				excludedDates.add(normalized);
			}
		}

		const pendingOriginal = getDatePart(
			task.googleCalendarExceptionOriginalScheduled || ""
		);
		if (pendingOriginal) {
			excludedDates.add(pendingOriginal);
		}

		return Array.from(excludedDates).sort();
	}

	/**
	 * Save the Google Calendar event ID to the task's frontmatter
	 */
	private async saveTaskEventId(
		taskPath: string,
		eventId: string,
		calendarId?: string
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			tasknotesLogger.warn(`Cannot save event ID: file not found at ${taskPath}`, {
				category: "provider",
				operation: "save-event-id-file-not-found",
			});
			return;
		}

		const fieldName = this.plugin.fieldMapper.toUserField("googleCalendarEventId");
		await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
			frontmatter[fieldName] = eventId;
		});
		TaskCalendarSyncService.taskEventIdCache.set(
			this.getTaskEventIdCacheKey(taskPath, calendarId),
			eventId
		);

		const targetCalendarId =
			calendarId || this.plugin.settings.googleCalendarExport.targetCalendarId;
		if (targetCalendarId) {
			await this.upsertEventIndex(taskPath, targetCalendarId, eventId);
		}
	}

	/**
	 * Remove the Google Calendar event ID from the task's frontmatter
	 */
	private async removeTaskEventId(taskPath: string): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			tasknotesLogger.warn(`Cannot remove event ID: file not found at ${taskPath}`, {
				category: "provider",
				operation: "remove-event-id-file-not-found",
			});
			TaskCalendarSyncService.clearTaskEventIdCache(taskPath);
			await this.removeEventIndexForTask(taskPath);
			return;
		}

		const fieldName = this.plugin.fieldMapper.toUserField("googleCalendarEventId");
		await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
			delete frontmatter[fieldName];
		});
		TaskCalendarSyncService.clearTaskEventIdCache(taskPath);
		await this.removeEventIndexForTask(taskPath);
	}

	private async saveTaskExceptionMetadata(
		taskPath: string,
		updates: Partial<
			Pick<
				TaskInfo,
				| "googleCalendarExceptionEventId"
				| "googleCalendarExceptionOriginalScheduled"
				| "googleCalendarMovedOriginalDates"
			>
		>,
		calendarId?: string
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(taskPath);
		if (!(file instanceof TFile)) {
			tasknotesLogger.warn(
				`Cannot save recurring exception metadata: file not found at ${taskPath}`,
				{ category: "provider", operation: "save-exception-metadata-file-not-found" }
			);
			return;
		}

		const exceptionEventIdField = this.plugin.fieldMapper.toUserField(
			"googleCalendarExceptionEventId"
		);
		const exceptionOriginalField = this.plugin.fieldMapper.toUserField(
			"googleCalendarExceptionOriginalScheduled"
		);
		const movedOriginalDatesField = this.plugin.fieldMapper.toUserField(
			"googleCalendarMovedOriginalDates"
		);

		await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
			this.writeOptionalFrontmatterField(
				frontmatter,
				exceptionEventIdField,
				updates.googleCalendarExceptionEventId,
				"googleCalendarExceptionEventId" in updates
			);
			this.writeOptionalFrontmatterField(
				frontmatter,
				exceptionOriginalField,
				updates.googleCalendarExceptionOriginalScheduled,
				"googleCalendarExceptionOriginalScheduled" in updates
			);
			this.writeOptionalFrontmatterField(
				frontmatter,
				movedOriginalDatesField,
				updates.googleCalendarMovedOriginalDates,
				"googleCalendarMovedOriginalDates" in updates
			);
		});

		if ("googleCalendarExceptionEventId" in updates) {
			if (updates.googleCalendarExceptionEventId) {
				TaskCalendarSyncService.taskExceptionEventIdCache.set(
					this.getTaskEventIdCacheKey(taskPath, calendarId),
					updates.googleCalendarExceptionEventId
				);
			} else {
				TaskCalendarSyncService.clearTaskExceptionEventIdCache(taskPath, calendarId);
			}
		}
	}

	private writeOptionalFrontmatterField(
		frontmatter: Record<string, unknown>,
		fieldName: string,
		value: unknown,
		shouldWrite: boolean
	): void {
		if (!shouldWrite) {
			return;
		}

		if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
			delete frontmatter[fieldName];
			return;
		}

		frontmatter[fieldName] = value;
	}

	private async clearTaskGoogleCalendarMetadata(taskPath: string): Promise<void> {
		await this.removeTaskEventId(taskPath);
		await this.saveTaskExceptionMetadata(taskPath, {
			googleCalendarExceptionEventId: undefined,
			googleCalendarExceptionOriginalScheduled: undefined,
			googleCalendarMovedOriginalDates: undefined,
		});
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

		const untitledTask = this.plugin.i18n.translate(
			"settings.integrations.googleCalendarExport.eventDescription.untitledTask"
		);
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
		return this.plugin.statusManager.isCompletedStatus(task.status) ? `✓ ${title}` : title;
	}

	/**
	 * Build the event description from task properties
	 */
	private buildEventDescription(task: TaskInfo): string {
		const settings = this.plugin.settings.googleCalendarExport;
		const t = (key: string, params?: Record<string, string | number>) =>
			this.plugin.i18n.translate(
				`settings.integrations.googleCalendarExport.eventDescription.${key}`,
				params
			);
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
			parts.push(
				t("contexts", {
					value: task.contexts
						.map((c) => `@${this.toCalendarDescriptionLabel(c)}`)
						.join(", "),
				})
			);
		}

		// Add projects
		if (task.projects && task.projects.length > 0) {
			parts.push(
				t("projects", {
					value: task.projects.map((p) => this.toCalendarDescriptionLabel(p)).join(", "),
				})
			);
		}

		// Add separator before link
		if (parts.length > 0 && settings.includeObsidianLink) {
			parts.push("");
			parts.push("---");
		}

		// Add Obsidian link (as HTML anchor for clickability in Google Calendar)
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
			.replace(/\[\[([^\]]+)\]\]/g, (_match, target: string) =>
				this.basenameForDisplay(target)
			)
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
			if (!startInfo.dateTime) {
				return {};
			}
			const startDate = new Date(startInfo.dateTime);
			const endDate = new Date(startDate);
			endDate.setDate(endDate.getDate() + 1);
			return { date: format(endDate, "yyyy-MM-dd") };
		} else {
			// Timed events: use duration
			const duration = task.timeEstimate || settings.defaultEventDuration;
			if (!startInfo.dateTime) {
				return {};
			}
			const startDate = new Date(startInfo.dateTime);
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
		eventDateSource: "due" | "scheduled"
	): Array<{ method: string; minutes: number }> | null {
		if (!task.reminders || !Array.isArray(task.reminders) || task.reminders.length === 0) {
			return null;
		}

		const googleReminders: Array<{ method: string; minutes: number }> = [];

		// Parse event start time to get a timestamp
		let eventStartMs: number;
		try {
			// Handle both ISO timestamps and date-only strings
			if (eventStartTime.includes("T")) {
				eventStartMs = new Date(eventStartTime).getTime();
			} else {
				// Date-only string - assume start of day in local timezone
				eventStartMs = new Date(eventStartTime + "T00:00:00").getTime();
			}

			if (isNaN(eventStartMs)) {
				tasknotesLogger.warn("[TaskCalendarSync] Invalid event start time:", {
					category: "provider",
					operation: "invalid-event-start-time",
					details: { value: eventStartTime },
				});
				return null;
			}
		} catch (error) {
			tasknotesLogger.warn("[TaskCalendarSync] Error parsing event start time:", {
				category: "provider",
				operation: "parsing-event-start-time",
				error: error,
			});
			return null;
		}

		for (const reminder of task.reminders) {
			if (!reminder.type) continue;

			if (reminder.type === "relative") {
				// Only include relative reminders that match the event's date source
				if (reminder.relatedTo !== eventDateSource) {
					continue;
				}

				// Parse the ISO 8601 duration
				if (!reminder.offset) continue;
				const durationMs = this.parseISO8601Duration(reminder.offset);
				if (durationMs === null) {
					tasknotesLogger.warn("[TaskCalendarSync] Invalid duration format:", {
						category: "provider",
						operation: "invalid-duration-format",
						details: { value: reminder.offset },
					});
					continue;
				}

				// Convert to minutes before the event
				// Negative duration means "before", which is what we want
				// Zero duration means "at event time"
				// Positive duration means "after", which Google Calendar doesn't support for reminders
				const minutesBefore = Math.abs(Math.round(durationMs / (60 * 1000)));

				// Skip if reminder is after the event (positive duration without negative sign)
				if (durationMs > 0) {
					tasknotesLogger.warn("[TaskCalendarSync] Skipping reminder after event:", {
						category: "provider",
						operation: "skipping-reminder-event",
						details: { value: reminder },
					});
					continue;
				}

				// Cap at Google Calendar's limit
				const cappedMinutes = Math.min(
					minutesBefore,
					GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES
				);

				// Include 0-minute reminders (at event time)
				if (cappedMinutes >= 0) {
					googleReminders.push({ method: "popup", minutes: cappedMinutes });
				}
			} else if (reminder.type === "absolute") {
				// Calculate minutes before event start
				if (!reminder.absoluteTime) continue;

				try {
					const reminderTimeMs = new Date(reminder.absoluteTime).getTime();
					if (isNaN(reminderTimeMs)) {
						tasknotesLogger.warn("[TaskCalendarSync] Invalid absolute time:", {
							category: "provider",
							operation: "invalid-absolute-time",
							details: { value: reminder.absoluteTime },
						});
						continue;
					}

					// Calculate difference in minutes
					const diffMs = eventStartMs - reminderTimeMs;
					const minutesBefore = Math.round(diffMs / (60 * 1000));

					// Skip if reminder is after the event start
					if (minutesBefore < 0) {
						tasknotesLogger.warn(
							"[TaskCalendarSync] Skipping absolute reminder after event:",
							{
								category: "provider",
								operation: "skipping-absolute-reminder-event",
								details: { value: reminder },
							}
						);
						continue;
					}

					// Cap at Google Calendar's limit
					const cappedMinutes = Math.min(
						minutesBefore,
						GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES
					);
					// Include 0-minute reminders (at event time)
					googleReminders.push({ method: "popup", minutes: cappedMinutes });
				} catch (error) {
					tasknotesLogger.warn(
						"[TaskCalendarSync] Error parsing absolute reminder time:",
						{
							category: "provider",
							operation: "parsing-absolute-reminder-time",
							error: error,
						}
					);
					continue;
				}
			}
		}

		return googleReminders.length > 0 ? googleReminders : null;
	}

	private getDefaultReminderOverrides(): Array<{ method: "popup"; minutes: number }> {
		const configuredMinutes = this.plugin.settings.googleCalendarExport.defaultReminderMinutes;
		const rawValues = Array.isArray(configuredMinutes)
			? configuredMinutes
			: configuredMinutes === null
				? []
				: [configuredMinutes];
		const seen = new Set<number>();
		const reminders: Array<{ method: "popup"; minutes: number }> = [];

		for (const rawValue of rawValues) {
			const minutes = Math.trunc(Number(rawValue));
			if (!Number.isFinite(minutes) || minutes <= 0) {
				continue;
			}

			const cappedMinutes = Math.min(minutes, GOOGLE_CALENDAR_CONSTANTS.MAX_REMINDER_MINUTES);
			if (seen.has(cappedMinutes)) {
				continue;
			}

			seen.add(cappedMinutes);
			reminders.push({ method: "popup", minutes: cappedMinutes });
		}

		return reminders;
	}

	/**
	 * Convert a task to a Google Calendar event payload
	 */
	private taskToCalendarEvent(
		task: TaskInfo,
		clearRecurrence?: boolean
	): CalendarEventPayload | null {
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
		let eventDateSource: "due" | "scheduled";
		if (
			settings.syncTrigger === "scheduled" ||
			(settings.syncTrigger === "both" && task.scheduled)
		) {
			eventDateSource = "scheduled";
		} else {
			eventDateSource = "due";
		}

		// Add reminders - prioritize task reminders, fall back to default
		const taskReminders = this.convertTaskRemindersToGoogleFormat(
			task,
			eventDate,
			eventDateSource
		);
		const defaultReminderOverrides = this.getDefaultReminderOverrides();

		if (taskReminders && taskReminders.length > 0) {
			// Use task-specific reminders
			event.reminders = {
				useDefault: false,
				overrides: taskReminders,
			};
		} else if (defaultReminderOverrides.length > 0) {
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
					overrides: defaultReminderOverrides,
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
			this.googleCalendarService.createEvent(calendarId, {
				...eventData,
				isAllDay: !!eventData.start.date,
			})
		);

		// Extract the actual event ID from the ICSEvent ID format.
		// Format is "google-{calendarId}-{eventId}". Calendar IDs can contain
		// hyphens, so strip the known prefix.
		const prefix = `google-${calendarId}-`;
		const eventId = createdEvent.id.startsWith(prefix)
			? createdEvent.id.slice(prefix.length)
			: createdEvent.id;

		await this.saveTaskEventId(task.path, eventId, calendarId);
		return eventId;
	}

	private shouldCreateDetachedRecurringException(task: TaskInfo): boolean {
		if (!this.shouldSyncAsRecurring(task)) {
			return false;
		}

		const movedScheduled = getDatePart(task.scheduled || "");
		const originalScheduled = getDatePart(
			task.googleCalendarExceptionOriginalScheduled || ""
		);

		return Boolean(movedScheduled && originalScheduled && movedScheduled !== originalScheduled);
	}

	private buildRecurringExceptionEvent(task: TaskInfo): CalendarEventPayload | null {
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

	private async syncRecurringExceptionEvent(
		task: TaskInfo,
		targetCalendarId: string
	): Promise<void> {
		const hasActiveException = this.shouldCreateDetachedRecurringException(task);
		const existingExceptionEventId = this.getTaskExceptionEventId(task);

		if (!hasActiveException) {
			if (existingExceptionEventId) {
				const deleted = await this.deleteOrQueueCalendarEvent(
					task.path,
					targetCalendarId,
					existingExceptionEventId
				);
				if (!deleted) {
					throw new Error(
						`Failed to delete detached recurring exception event: ${task.path}`
					);
				}
			}

			await this.saveTaskExceptionMetadata(
				task.path,
				{
					googleCalendarExceptionEventId: undefined,
					googleCalendarExceptionOriginalScheduled: undefined,
				},
				targetCalendarId
			);
			return;
		}

		const eventData = this.buildRecurringExceptionEvent(task);
		if (!eventData) {
			return;
		}

		if (existingExceptionEventId) {
			try {
				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(
						targetCalendarId,
						existingExceptionEventId,
						eventData
					)
				);
				return;
			} catch (error: unknown) {
				if (getErrorStatus(error) !== 404) {
					throw error;
				}
				await this.saveTaskExceptionMetadata(
					task.path,
					{
						googleCalendarExceptionEventId: undefined,
					},
					targetCalendarId
				);
			}
		}

		const createCacheKey = this.getTaskEventIdCacheKey(task.path, targetCalendarId);
		const pendingCreate =
			TaskCalendarSyncService.pendingExceptionEventCreates.get(createCacheKey);
		if (pendingCreate) {
			const eventId = await pendingCreate;
			await this.withGoogleRateLimit(() =>
				this.googleCalendarService.updateEvent(targetCalendarId, eventId, eventData)
			);
			return;
		}

		const createPromise = this.withGoogleRateLimit(() =>
			this.googleCalendarService.createEvent(targetCalendarId, {
				...eventData,
				isAllDay: !!eventData.start.date,
			})
		).then(async (createdEvent) => {
			const prefix = `google-${targetCalendarId}-`;
			const eventId = createdEvent.id.startsWith(prefix)
				? createdEvent.id.slice(prefix.length)
				: createdEvent.id;

			await this.saveTaskExceptionMetadata(
				task.path,
				{
					googleCalendarExceptionEventId: eventId,
					googleCalendarExceptionOriginalScheduled: getDatePart(
						task.googleCalendarExceptionOriginalScheduled || ""
					),
				},
				targetCalendarId
			);
			return eventId;
		});
		TaskCalendarSyncService.pendingExceptionEventCreates.set(
			createCacheKey,
			createPromise
		);
		try {
			await createPromise;
		} finally {
			if (
				TaskCalendarSyncService.pendingExceptionEventCreates.get(createCacheKey) ===
				createPromise
			) {
				TaskCalendarSyncService.pendingExceptionEventCreates.delete(createCacheKey);
			}
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
				tasknotesLogger.warn("[TaskCalendarSync] Could not convert task to event:", {
					category: "provider",
					operation: "convert-task-event",
					details: { value: task.path },
				});
				return false;
			}

			if (!targetCalendarId) {
				tasknotesLogger.warn(
					"[TaskCalendarSync] Cannot sync task without target calendar:",
					{
						category: "provider",
						operation: "sync-task-without-target-calendar",
						details: { value: task.path },
					}
				);
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
				const createCacheKey = this.getTaskEventIdCacheKey(
					task.path,
					targetCalendarId
				);
				const pendingCreate =
					TaskCalendarSyncService.pendingEventCreates.get(createCacheKey);
				if (pendingCreate) {
					const eventId = await pendingCreate;
					await this.withGoogleRateLimit(() =>
						this.googleCalendarService.updateEvent(targetCalendarId, eventId, eventData)
					);
				} else {
					const createPromise = this.createCalendarEventForTask(
						task,
						eventData,
						targetCalendarId
					);
					TaskCalendarSyncService.pendingEventCreates.set(
						createCacheKey,
						createPromise
					);
					try {
						await createPromise;
					} finally {
						if (
							TaskCalendarSyncService.pendingEventCreates.get(createCacheKey) ===
							createPromise
						) {
							TaskCalendarSyncService.pendingEventCreates.delete(createCacheKey);
						}
					}
				}
			}

			if (this.shouldSyncAsRecurring(task) || this.hasStoredRecurringExceptionMetadata(task)) {
				await this.syncRecurringExceptionEvent(task, targetCalendarId);
			}

			await this.recordCalendarSyncFingerprint(task);
			return true;
		} catch (error: unknown) {
			// Check if it's a 404 error (event was deleted externally)
			if (getErrorStatus(error) === 404 && existingEventId) {
				// Clear the stale link and retry as create
				await this.removeTaskEventId(task.path);
				// Retry without the link - refetch task to get updated version
				const updatedTask = await this.plugin.cacheManager.getTaskInfo(task.path);
				if (updatedTask) {
					return this.syncTaskToCalendar(updatedTask, previous, options);
				}
			}

			tasknotesLogger.error("[TaskCalendarSync] Failed to sync task:", {
				category: "provider",
				operation: "sync-task",
				details: { value: task.path },
				error: error,
			});
			if (queueOnFailure) {
				await this.queueTaskSync(task.path, error, true);
			}

			// Show user-friendly message for token refresh errors
			// TokenRefreshError indicates the OAuth connection expired and user needs to reconnect
			if (error instanceof TokenRefreshError) {
				publishUserNotice(this.plugin.emitter,
					this.plugin.i18n.translate(
						"settings.integrations.googleCalendarExport.notices.connectionExpired"
					)
				);
			} else {
				publishUserNotice(this.plugin.emitter,
					this.plugin.i18n.translate(
						"settings.integrations.googleCalendarExport.notices.syncFailed",
						{ message: getErrorMessage(error) }
					)
				);
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
			window.clearTimeout(existingTimer);
		}

		// Store the authoritative task state passed to us so we don't rely on the async metadata cache
		this.pendingTasks.set(taskPath, task);

		// Return a promise that resolves when the debounced sync completes
		return new Promise((resolve, reject) => {
			const timer = window.setTimeout(() => {
				void (async () => {
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
					const freshTask =
						latestTask || (await this.plugin.cacheManager.getTaskInfo(taskPath));

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
						reject(error instanceof Error ? error : new Error(String(error)));
					} finally {
						this.inFlightSyncs.delete(taskPath);
					}
				})();
			}, SYNC_DEBOUNCE_MS);

			this.pendingSyncs.set(taskPath, timer);
		});
	}

	private cancelPendingTaskUpdate(taskPath: string): void {
		const existingTimer = this.pendingSyncs.get(taskPath);
		if (existingTimer) {
			window.clearTimeout(existingTimer);
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
	private async executeTaskUpdate(task: TaskInfo, previousOverride?: TaskInfo): Promise<void> {
		const existingEventId = this.getTaskEventId(task);

		// If task no longer meets sync criteria, delete the event
		if (!this.isTaskCalendarEligible(task)) {
			if (existingEventId || this.hasStoredRecurringExceptionMetadata(task)) {
				const deleted = await this.deleteTaskFromCalendar(task);
				if (!deleted) {
					tasknotesLogger.warn(`Google Calendar deletion queued for ${task.path}`, {
						category: "provider",
						operation: "google-calendar-deletion-queued",
					});
				} else {
					await this.removeCalendarSyncFingerprint(task.path);
				}
			}
			// Clean up previous state
			this.previousTaskState.delete(task.path);
			return;
		}

		// Get previous state for recurrence change detection
		const previousState = previousOverride || this.previousTaskState.get(task.path);

		// Sync the updated task
		const synced = await this.syncTaskToCalendar(task, previousState);
		if (synced) {
			this.previousTaskState.set(task.path, task);
		}
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
			const completed = await completionPromise;
			if (completed) {
				await this.recordCalendarSyncFingerprint(task);
			}
		} finally {
			if (this.inFlightSyncs.get(task.path) === completionPromise) {
				this.inFlightSyncs.delete(task.path);
			}
		}
	}

	private async executeTaskCompletion(task: TaskInfo): Promise<boolean> {
		const settings = this.plugin.settings.googleCalendarExport;
		let existingEventId = this.getTaskEventId(task);
		if (!existingEventId) {
			const synced = await this.syncTaskToCalendar(task);
			if (!synced) {
				return false;
			}
			existingEventId = this.getTaskEventId(task);
			if (!existingEventId) {
				return false;
			}
		}

		// For recurring tasks, update EXDATE to exclude completed instance
		if (this.shouldSyncAsRecurring(task)) {
			await this.updateRecurringEventExdates(task);
			return true;
		}

		try {
			// Update the event title to indicate completion
			const description = settings.includeDescription
				? this.buildEventDescription(task)
				: undefined;

			await this.withGoogleRateLimit(() =>
				this.googleCalendarService.updateEvent(settings.targetCalendarId, existingEventId, {
					summary: this.getCalendarEventTitle(task),
					description,
				})
			);
			return true;
		} catch (error: unknown) {
			if (getErrorStatus(error) === 404) {
				// Event was deleted externally, clean up the link
				await this.removeTaskEventId(task.path);
				return false;
			}
			tasknotesLogger.error("[TaskCalendarSync] Failed to update completed task:", {
				category: "provider",
				operation: "update-completed-task",
				details: { value: task.path },
				error: error,
			});
			return false;
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
				const description = settings.includeDescription
					? this.buildEventDescription(task)
					: undefined;

				await this.withGoogleRateLimit(() =>
					this.googleCalendarService.updateEvent(settings.targetCalendarId, eventId, {
						summary: this.getCalendarEventTitle(task),
						description,
						recurrence: recurrenceData.recurrence,
					})
				);
				await this.syncRecurringExceptionEvent(task, settings.targetCalendarId);
			}
		} catch (error: unknown) {
			if (getErrorStatus(error) === 404) {
				// Event was deleted externally, clean up the link
				await this.removeTaskEventId(task.path);
				return;
			}
			tasknotesLogger.error("[TaskCalendarSync] Failed to update recurring event EXDATEs:", {
				category: "provider",
				operation: "update-recurring-event-exdates",
				details: { value: task.path },
				error: error,
			});
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
			tasknotesLogger.warn(
				"[TaskCalendarSync] Cannot delete task event without target calendar:",
				{
					category: "provider",
					operation: "delete-task-event-without-target-calendar",
					details: { value: task.path },
				}
			);
			return false;
		}

		for (const eventId of [existingEventId, exceptionEventId]) {
			if (!eventId) {
				continue;
			}

			const deleted = await this.deleteOrQueueCalendarEvent(
				task.path,
				targetCalendarId,
				eventId
			);
			if (!deleted) {
				return false;
			}
		}

		// Only remove metadata when deletion succeeded or events are already gone.
		await this.clearTaskGoogleCalendarMetadata(task.path);
		await this.removeCalendarSyncFingerprint(task.path);
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
			tasknotesLogger.warn(
				"[TaskCalendarSync] Cannot delete task events without target calendar:",
				{
					category: "provider",
					operation: "delete-task-events-without-target-calendar",
					details: { value: taskPath },
				}
			);
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
		await this.removeCalendarSyncFingerprint(taskPath);
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
			publishUserNotice(this.plugin.emitter,
				this.plugin.i18n.translate(
					"settings.integrations.googleCalendarExport.notices.notEnabledOrConfigured"
				)
			);
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
		publishUserNotice(this.plugin.emitter,
			this.plugin.i18n.translate(
				"settings.integrations.googleCalendarExport.notices.syncingTasks",
				{ total }
			)
		);

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
				tasknotesLogger.error(`[TaskCalendarSync] Failed to sync task ${task.path}:`, {
					category: "provider",
					operation: "sync-task",
					error: error,
				});
			}
		});

		publishUserNotice(this.plugin.emitter,
			this.plugin.i18n.translate(
				"settings.integrations.googleCalendarExport.notices.syncComplete",
				{
					synced: results.synced,
					failed: results.failed,
					skipped: results.skipped,
				}
			)
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
					tasknotesLogger.warn(
						`[TaskCalendarSync] Cannot delete event without target calendar for ${task.path}`,
						{ category: "provider", operation: "delete-event-without-target-calendar" }
					);
					continue;
				}

				let deletionComplete = true;
				for (const eventId of [
					task.googleCalendarEventId,
					this.getTaskExceptionEventId(task),
				]) {
					if (!eventId) {
						continue;
					}

					const deleted = await this.deleteOrQueueCalendarEvent(
						task.path,
						targetCalendarId,
						eventId
					);
					if (!deleted) {
						deletionComplete = false;
					}
				}

				if (!deletionComplete) {
					tasknotesLogger.warn(
						`[TaskCalendarSync] Event deletion queued; keeping links for ${task.path}`,
						{ category: "provider", operation: "event-deletion-queued-keeping-link" }
					);
					continue;
				}
			}

			// Remove Google Calendar metadata from task frontmatter.
			await this.clearTaskGoogleCalendarMetadata(task.path);
			await this.removeCalendarSyncFingerprint(task.path);
			unlinkedCount++;
		}

		publishUserNotice(this.plugin.emitter,
			deleteEvents
				? this.plugin.i18n.translate(
						"settings.integrations.googleCalendarExport.notices.eventsDeletedAndUnlinked",
						{ count: unlinkedCount }
					)
				: this.plugin.i18n.translate(
						"settings.integrations.googleCalendarExport.notices.tasksUnlinked",
						{ count: unlinkedCount }
					)
		);
	}
}
