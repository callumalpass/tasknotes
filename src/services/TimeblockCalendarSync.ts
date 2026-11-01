import { type CachedMetadata, TAbstractFile, TFile } from "obsidian";
import { appHasDailyNotesPluginLoaded, getAllDailyNotes } from "obsidian-daily-notes-interface";
import { format } from "date-fns";
import { uiData } from "../i18n/dataText";
import type TaskNotesPlugin from "../main";
import type { GoogleCalendarService } from "./GoogleCalendarService";
import type {
	GoogleCalendarTimeblockEventIndexEntry,
	PendingGoogleCalendarDeletion,
	PendingGoogleCalendarTimeblockSync,
	TimeBlock,
} from "../types";
import { validateTimeBlock } from "../utils/helpers";
import { parseDateToLocal } from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { withPluginDataWriteLock } from "../utils/pluginDataWriteLock";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TimeblockCalendarSync" });

/** Persistent plugin-data key linking timeblocks to the Google events created for them */
const TIMEBLOCK_EVENT_INDEX_KEY = "googleCalendarTimeblockEventIndex";

/** Persistent plugin-data key for timeblocks whose create/update must be retried */
const TIMEBLOCK_SYNC_QUEUE_KEY = "googleCalendarTimeblockSyncQueue";

/** Debounce delay for rapid daily-note edits (ms) */
const TIMEBLOCK_SYNC_DEBOUNCE_MS = 500;

/**
 * How long a deleted note's events wait before being deleted (ms). File
 * managers, git and sync clients move files as a delete followed by a create;
 * the wait lets Obsidian index the new file so the move keeps its events.
 */
const NOTE_DELETE_GRACE_MS = 3000;

/** How long a newly added timeblock can be the destination of a move (ms) */
const MOVE_WINDOW_MS = 60_000;

/** Longest time startup deletions wait for Obsidian to finish indexing (ms) */
const STARTUP_DELETION_MAX_DEFER_MS = 5 * 60_000;

/** Snapshot fingerprint of a timeblock that is present but invalid, e.g. mid-edit */
const INVALID_TIMEBLOCK_FINGERPRINT = "invalid";

export interface DailyNoteTimeblocks {
	/** The note's date (YYYY-MM-DD), or null when it has no timeblocks or is not a daily note */
	date: string | null;
	timeblocks: TimeBlock[];
	/**
	 * IDs of timeblocks in the note that fail validation, such as one whose
	 * title is being typed. They still exist, so their events are left alone.
	 */
	invalidIds?: string[];
	/**
	 * False while Obsidian has not parsed the note, or its frontmatter does not
	 * parse (for example mid-edit), so its timeblocks are unknown
	 */
	indexed: boolean;
}

/** Read access to daily-note timeblocks; injectable for tests. */
export interface TimeblockNoteSource {
	/** Returns null only when no file exists at the path. */
	read(notePath: string): DailyNoteTimeblocks | null;
	listNotePaths(): string[];
	/** Every note, daily or not, whose frontmatter has a timeblock with this ID */
	findNotesWithTimeblock(timeblockId: string): string[];
	/** False while Obsidian is still indexing files, e.g. at startup */
	isMetadataSettled(): boolean;
}

/**
 * The parts of TaskCalendarSyncService that timeblock sync shares: the Google
 * rate limiter, the OAuth connection-generation guard and the persistent
 * deletion queue.
 */
export interface TimeblockCalendarSyncHost {
	withGoogleRateLimit<T>(fn: () => Promise<T>): Promise<T>;
	getConnectionGeneration(): number;
	assertConnectionGenerationCurrent(expectedConnectionGeneration: number): Promise<void>;
	deleteOrQueueEvent(
		notePath: string,
		timeblockId: string,
		calendarId: string,
		eventId: string,
		expectedConnectionGeneration: number
	): Promise<boolean>;
	queueEventDeletion(
		notePath: string,
		timeblockId: string,
		calendarId: string,
		eventId: string,
		error: unknown
	): Promise<void>;
	renameQueuedEventDeletions(oldPath: string, newPath: string): Promise<void>;
}

type TimeblockEventPayload = {
	summary: string;
	description?: string;
	start: { dateTime: string; timeZone: string };
	end: { dateTime: string; timeZone: string };
	colorId?: string;
};

function getErrorStatus(error: unknown): number | undefined {
	if (error === null || typeof error !== "object") {
		return undefined;
	}
	const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
	if (typeof status === "number") return status;
	if (typeof statusCode === "number") return statusCode;
	return undefined;
}

function isEventGoneError(error: unknown): boolean {
	const status = getErrorStatus(error);
	return status === 404 || status === 410;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Short, stable 53-bit hash (cyrb53), so index entries do not store whole event payloads */
function hashString(value: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function getRawTimeblockId(timeblock: unknown): string | null {
	if (timeblock === null || typeof timeblock !== "object") return null;
	const { id } = timeblock as { id?: unknown };
	return typeof id === "string" && id ? id : null;
}

/**
 * When frontmatter YAML does not parse, as happens mid-edit, Obsidian drops
 * `frontmatter` and `frontmatterPosition` but still lists a YAML section at
 * the top of the note. An empty block (`---` then `---`) spans only two lines.
 */
function hasUnparseableFrontmatter(cache: CachedMetadata): boolean {
	// Valid but empty or comment-only frontmatter keeps its position.
	if (cache.frontmatter || cache.frontmatterPosition) return false;
	const first = cache.sections?.[0];
	return (
		first?.type === "yaml" &&
		first.position.start.line === 0 &&
		first.position.end.line - first.position.start.line > 1
	);
}

function getBasename(notePath: string): string {
	return notePath.slice(notePath.lastIndexOf("/") + 1);
}

/** Matches calendar-core's daily-note cache lifetime */
const DAILY_NOTES_CACHE_TTL_MS = 5000;

/**
 * Reads timeblocks from daily notes through Obsidian's metadata cache.
 */
export function createDailyNoteTimeblockSource(plugin: TaskNotesPlugin): TimeblockNoteSource {
	let dailyNoteDates: Map<string, string> | null = null;
	let dailyNoteDatesAt = 0;
	const getDailyNoteDates = (refresh = false): Map<string, string> => {
		const now = Date.now();
		if (!refresh && dailyNoteDates && now - dailyNoteDatesAt < DAILY_NOTES_CACHE_TTL_MS) {
			return dailyNoteDates;
		}
		const byPath = new Map<string, string>();
		if (appHasDailyNotesPluginLoaded()) {
			// Keys are date UIDs such as "day-2026-11-01T00:00:00+10:00".
			const dailyNotes = getAllDailyNotes();
			for (const [key, file] of Object.entries(dailyNotes)) {
				const match = /^day-(\d{4}-\d{2}-\d{2})/.exec(key);
				if (match && file instanceof TFile) {
					byPath.set(file.path, match[1]);
				}
			}
		}
		dailyNoteDates = byPath;
		dailyNoteDatesAt = now;
		return byPath;
	};

	return {
		read(notePath) {
			const file = plugin.app.vault.getAbstractFileByPath(notePath);
			if (!(file instanceof TFile)) {
				return null;
			}
			const cache = plugin.app.metadataCache.getFileCache(file);
			if (!cache || hasUnparseableFrontmatter(cache)) {
				return { date: null, timeblocks: [], indexed: false };
			}
			const rawTimeblocks: unknown = cache.frontmatter?.timeblocks;
			const timeblocks: TimeBlock[] = [];
			const invalidIds: string[] = [];
			if (Array.isArray(rawTimeblocks)) {
				for (const timeblock of rawTimeblocks) {
					if (validateTimeBlock(timeblock)) {
						timeblocks.push(timeblock);
					} else {
						const id = getRawTimeblockId(timeblock);
						if (id) invalidIds.push(id);
					}
				}
			}
			// Only look up the date for notes that have timeblocks; this runs on
			// every metadata change in the vault.
			// A cache miss may be a daily note created moments ago, so refresh once.
			const date =
				timeblocks.length > 0
					? (getDailyNoteDates().get(notePath) ??
						getDailyNoteDates(true).get(notePath) ??
						null)
					: null;
			return { date, timeblocks, invalidIds, indexed: true };
		},
		listNotePaths() {
			return Array.from(getDailyNoteDates().keys());
		},
		findNotesWithTimeblock(timeblockId) {
			const { vault, metadataCache } = plugin.app;
			return vault
				.getMarkdownFiles()
				.filter((file) => {
					const rawTimeblocks: unknown =
						metadataCache.getFileCache(file)?.frontmatter?.timeblocks;
					return (
						Array.isArray(rawTimeblocks) &&
						rawTimeblocks.some((timeblock) => getRawTimeblockId(timeblock) === timeblockId)
					);
				})
				.map((file) => file.path);
		},
		isMetadataSettled() {
			const { vault, metadataCache } = plugin.app;
			return vault.getMarkdownFiles().every((file) => !!metadataCache.getFileCache(file));
		},
	};
}

/**
 * Syncs daily-note timeblocks to Google Calendar.
 *
 * Links between timeblocks and events are stored in plugin data, keyed by
 * daily-note path and timeblock ID, never in the note itself, so copying a
 * timeblock (which gives it a fresh ID) can never carry another timeblock's
 * event. Each daily note is reconciled against that index: new or edited
 * timeblocks are created or updated, and indexed timeblocks that disappeared
 * have their events deleted through the shared, persistent deletion queue.
 * All reconciles run one at a time so overlapping saves cannot race.
 */
export class TimeblockCalendarSync {
	/** In-flight creates keyed by calendar, note and timeblock, so overlapping saves create one event */
	private static pendingCreates: Map<string, Promise<string>> = new Map();

	private plugin: TaskNotesPlugin;
	private googleCalendarService: GoogleCalendarService;
	private host: TimeblockCalendarSyncHost;
	private source: TimeblockNoteSource;

	/** Serializes every reconcile so a delete cannot interleave with a create or update */
	private reconcileChain: Promise<unknown> = Promise.resolve();
	private debounceTimers: Map<string, number> = new Map();
	private pendingChangedIds: Map<string, Set<string>> = new Map();
	/** Last observed timeblock content per note, used to tell new or edited timeblocks from untouched ones */
	private snapshots: Map<string, Map<string, string>> = new Map();
	/** Notes Obsidian had not parsed when snapshots were taken; their first change only sets a baseline */
	private unindexedNotes: Set<string> = new Set();
	/** When each note's timeblocks first appeared this session; only these can be a move's destination */
	private recentlyAddedIds: Map<string, Map<string, number>> = new Map();
	/** Notes whose deletions waited at startup for Obsidian to finish indexing */
	private deferredDeletionNotes: Set<string> = new Set();
	/**
	 * Daily notes recorded by initialize() and files created afterwards. Only
	 * these can receive a moved timeblock on their first change; any other note
	 * seen for the first time may be an old note sharing a template's ID.
	 */
	private baselinePaths: Set<string> = new Set();
	private createdPaths: Set<string> = new Set();
	private initialized = false;
	private startupRecoveryStartedAt: number | null = null;
	private destroyed = false;

	constructor(
		plugin: TaskNotesPlugin,
		googleCalendarService: GoogleCalendarService,
		host: TimeblockCalendarSyncHost,
		source: TimeblockNoteSource = createDailyNoteTimeblockSource(plugin)
	) {
		this.plugin = plugin;
		this.googleCalendarService = googleCalendarService;
		this.host = host;
		this.source = source;
	}

	static clearSharedStateForTests(): void {
		TimeblockCalendarSync.pendingCreates.clear();
	}

	destroy(): void {
		this.destroyed = true;
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.pendingChangedIds.clear();
		this.snapshots.clear();
		this.unindexedNotes.clear();
		this.recentlyAddedIds.clear();
		this.deferredDeletionNotes.clear();
		this.baselinePaths.clear();
		this.createdPaths.clear();
	}

	isEnabled(): boolean {
		const settings = this.plugin.settings.googleCalendarExport;
		const isConnected = this.googleCalendarService.getAvailableCalendars().length > 0;
		return !!settings?.syncTimeblocks && !!this.getTargetCalendarId() && isConnected;
	}

	getTargetCalendarId(): string {
		const settings = this.plugin.settings.googleCalendarExport;
		return settings?.timeblockTargetCalendarId || settings?.targetCalendarId || "";
	}

	/**
	 * Record the current timeblocks of every daily note. Only timeblocks added
	 * or edited after this point are created in Google Calendar, so enabling
	 * sync does not flood the calendar with historical timeblocks.
	 */
	initialize(): void {
		for (const notePath of this.source.listNotePaths()) {
			const state = this.source.read(notePath);
			if (!state) continue;
			this.baselinePaths.add(notePath);
			if (!state.indexed) {
				this.unindexedNotes.add(notePath);
				continue;
			}
			const fingerprints = this.getContentFingerprints(state);
			if (fingerprints.size > 0) {
				this.snapshots.set(notePath, fingerprints);
			}
		}
		this.initialized = true;
	}

	/** Subscribe to vault and metadata events for daily notes. */
	registerVaultEvents(): void {
		const { app } = this.plugin;
		this.plugin.registerEvent(
			app.metadataCache.on("changed", (file: TFile) => {
				this.handleNoteChanged(file.path);
			})
		);
		this.plugin.registerEvent(
			app.vault.on("create", (file: TAbstractFile) => {
				this.handleNoteCreated(file.path);
			})
		);
		this.plugin.registerEvent(
			app.vault.on("delete", (file: TAbstractFile) => {
				if (file instanceof TFile) {
					this.handleNoteDeleted(file.path);
				}
			})
		);
		this.plugin.registerEvent(
			app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				if (file instanceof TFile) {
					void this.handleNoteRenamed(oldPath, file.path).catch((error) => {
						tasknotesLogger.warn("Failed to update timeblock event links after rename:", {
							category: "provider",
							operation: "rename-timeblock-event-links",
							error,
						});
					});
				}
			})
		);
	}

	/** Remember files created after startup; vault "create" also fires while the vault loads. */
	handleNoteCreated(notePath: string): void {
		if (this.destroyed || !this.initialized) return;
		this.createdPaths.add(notePath);
	}

	/**
	 * React to a daily note's metadata changing. Timeblocks that are new or whose
	 * content changed since the last snapshot are scheduled for sync; indexed
	 * timeblocks that disappeared are picked up by the reconcile.
	 */
	handleNoteChanged(notePath: string): void {
		if (this.destroyed) return;
		const state = this.source.read(notePath);
		if (!state || !state.indexed) {
			return;
		}

		const previous = this.snapshots.get(notePath);
		const current = this.getContentFingerprints(state);
		if (!previous && current.size === 0) {
			this.unindexedNotes.delete(notePath);
			return;
		}
		this.snapshots.set(notePath, current);
		if (
			this.unindexedNotes.delete(notePath) ||
			!this.plugin.settings.googleCalendarExport?.syncTimeblocks
		) {
			return;
		}

		// Any other note seen for the first time (e.g. an old project note sharing
		// a template's timeblock ID) only sets a baseline, like an unindexed one,
		// so it can't take over another note's event.
		if (!previous && !this.baselinePaths.has(notePath) && !this.createdPaths.has(notePath)) {
			return;
		}

		const now = Date.now();
		for (const id of current.keys()) {
			if (!previous?.has(id)) {
				this.markRecentlyAdded(notePath, id, now);
			}
		}

		const changedIds = new Set<string>();
		for (const [id, fingerprint] of current) {
			if (previous?.get(id) !== fingerprint) {
				changedIds.add(id);
			}
		}
		const removedAny = !!previous && Array.from(previous.keys()).some((id) => !current.has(id));
		if (changedIds.size === 0 && !removedAny) {
			return;
		}

		this.scheduleReconcile(notePath, changedIds);
	}

	/**
	 * A deleted daily note removes all of its timeblocks. Pending debounced work
	 * for the note is cancelled, so a queued update cannot recreate an event
	 * after its timeblock is gone. The deletion waits briefly: if the note
	 * reappears elsewhere (a move made outside Obsidian), its events follow it.
	 */
	handleNoteDeleted(notePath: string): void {
		if (this.destroyed) return;
		this.cancelPendingReconcile(notePath);
		this.recentlyAddedIds.delete(notePath);
		const hadTimeblocks = this.snapshots.delete(notePath);
		const wasUnindexed = this.unindexedNotes.delete(notePath);
		if (hadTimeblocks || wasUnindexed) {
			this.scheduleReconcile(notePath, new Set(), NOTE_DELETE_GRACE_MS);
		}
	}

	async handleNoteRenamed(oldPath: string, newPath: string): Promise<void> {
		if (this.destroyed) return;
		const pendingIds = this.pendingChangedIds.get(oldPath);
		this.cancelPendingReconcile(oldPath);
		const snapshot = this.snapshots.get(oldPath);
		const wasUnindexed = this.unindexedNotes.delete(oldPath);
		if (this.baselinePaths.delete(oldPath)) this.baselinePaths.add(newPath);
		if (this.createdPaths.delete(oldPath)) this.createdPaths.add(newPath);
		if (!snapshot && !wasUnindexed) {
			return;
		}
		this.snapshots.delete(oldPath);
		if (snapshot) this.snapshots.set(newPath, snapshot);
		const recentlyAdded = this.recentlyAddedIds.get(oldPath);
		this.recentlyAddedIds.delete(oldPath);
		if (recentlyAdded) this.recentlyAddedIds.set(newPath, recentlyAdded);

		await this.mutateIndex((index) => {
			let changed = false;
			for (const entry of index) {
				if (entry.notePath === oldPath) {
					entry.notePath = newPath;
					changed = true;
				}
			}
			return changed ? index : null;
		});
		await this.mutateSyncQueue((queue) => {
			let changed = false;
			for (const item of queue) {
				if (item.notePath === oldPath) {
					item.notePath = newPath;
					changed = true;
				}
			}
			return changed ? queue : null;
		});
		await this.host.renameQueuedEventDeletions(oldPath, newPath);

		// The renamed note may have stopped being a daily note; reconcile both.
		void this.enqueueReconcile(oldPath, new Set());
		this.scheduleReconcile(newPath, pendingIds ?? new Set());
	}

	/** Wait for scheduled and running reconciles; used by tests and shutdown paths. */
	async flush(): Promise<void> {
		for (const notePath of Array.from(this.debounceTimers.keys())) {
			const changedIds = this.pendingChangedIds.get(notePath) ?? new Set<string>();
			this.cancelPendingReconcile(notePath);
			void this.enqueueReconcile(notePath, changedIds);
		}
		await this.reconcileChain.catch(() => undefined);
	}

	/**
	 * Retry failed creates/updates. At startup, also reconcile every note with
	 * linked timeblocks to catch edits, deletions and settings changes made
	 * while Obsidian was closed. Until Obsidian has indexed every file, events
	 * of missing timeblocks are kept, since the timeblock may have moved to a
	 * file that is not indexed yet; a later pass deletes them.
	 */
	async processRecovery(includeIndexedNotes: boolean): Promise<void> {
		if (!this.isEnabled()) {
			return;
		}
		if (includeIndexedNotes) {
			this.startupRecoveryStartedAt = Date.now();
		}
		const settled =
			this.source.isMetadataSettled() ||
			(this.startupRecoveryStartedAt !== null &&
				Date.now() - this.startupRecoveryStartedAt >= STARTUP_DELETION_MAX_DEFER_MS);

		const work = new Map<string, Set<string>>();
		for (const item of await this.getSyncQueue()) {
			const ids = work.get(item.notePath) ?? new Set<string>();
			ids.add(item.timeblockId);
			work.set(item.notePath, ids);
		}
		const notesWithLinks = includeIndexedNotes
			? (await this.getIndex()).map((entry) => entry.notePath)
			: [];
		const deferred = settled ? Array.from(this.deferredDeletionNotes) : [];
		if (settled) this.deferredDeletionNotes.clear();
		for (const notePath of [...notesWithLinks, ...deferred]) {
			if (!work.has(notePath)) {
				work.set(notePath, new Set());
			}
		}

		for (const [notePath, ids] of work) {
			await this.enqueueReconcile(notePath, ids, { deferDeletions: !settled });
		}
	}

	/**
	 * Whether a queued timeblock deletion should wait for a later pass because
	 * the note's contents are unknown right now (for example YAML mid-edit).
	 */
	shouldDeferQueuedDeletion(item: PendingGoogleCalendarDeletion): boolean {
		if (!item.timeblockId) return false;
		const state = this.source.read(item.taskPath);
		return !!state && !state.indexed;
	}

	/**
	 * Whether a queued deletion of a timeblock event should still run. It is
	 * skipped only when the timeblock exists and is still linked to that event.
	 */
	async isQueuedDeletionStillNeeded(item: PendingGoogleCalendarDeletion): Promise<boolean> {
		if (!item.timeblockId) return true;
		const state = this.source.read(item.taskPath);
		if (!state || !this.holdsTimeblock(state, item.timeblockId)) {
			return true;
		}
		const entry = (await this.getIndex()).find(
			(candidate) =>
				candidate.notePath === item.taskPath && candidate.timeblockId === item.timeblockId
		);
		return !(entry?.calendarId === item.calendarId && entry.eventId === item.eventId);
	}

	async removeIndexEntriesForEvent(calendarId: string, eventId: string): Promise<void> {
		await this.mutateIndex((index) => {
			const next = index.filter(
				(entry) => !(entry.calendarId === calendarId && entry.eventId === eventId)
			);
			return next.length === index.length ? null : next;
		});
	}

	private scheduleReconcile(
		notePath: string,
		changedIds: Set<string>,
		delayMs = TIMEBLOCK_SYNC_DEBOUNCE_MS
	): void {
		const pending = this.pendingChangedIds.get(notePath) ?? new Set<string>();
		for (const id of changedIds) pending.add(id);
		this.pendingChangedIds.set(notePath, pending);

		const existingTimer = this.debounceTimers.get(notePath);
		if (existingTimer) {
			window.clearTimeout(existingTimer);
		}
		const timer = window.setTimeout(() => {
			const ids = this.pendingChangedIds.get(notePath) ?? new Set<string>();
			this.debounceTimers.delete(notePath);
			this.pendingChangedIds.delete(notePath);
			void this.enqueueReconcile(notePath, ids);
		}, delayMs);
		this.debounceTimers.set(notePath, timer);
	}

	private cancelPendingReconcile(notePath: string): void {
		const timer = this.debounceTimers.get(notePath);
		if (timer) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.delete(notePath);
		this.pendingChangedIds.delete(notePath);
	}

	private enqueueReconcile(
		notePath: string,
		changedIds: Set<string>,
		options: { deferDeletions?: boolean } = {}
	): Promise<void> {
		const run = this.reconcileChain
			.catch(() => undefined)
			.then(() => this.reconcileNote(notePath, changedIds, options));
		this.reconcileChain = run.catch(async (error) => {
			tasknotesLogger.error("Failed to sync timeblocks to Google Calendar:", {
				category: "provider",
				operation: "reconcile-timeblock-note",
				details: { value: notePath },
				error,
			});
			// The snapshot already holds these edits; queue them so they are retried.
			for (const id of changedIds) {
				await this.queueSyncRetry(notePath, id, error).catch(() => undefined);
			}
		});
		return run;
	}

	private async reconcileNote(
		notePath: string,
		changedIds: Set<string>,
		options: { deferDeletions?: boolean } = {}
	): Promise<void> {
		if (this.destroyed) {
			return;
		}
		if (!this.isEnabled()) {
			await this.queueUntilReady(notePath, changedIds);
			return;
		}

		const calendarId = this.getTargetCalendarId();
		const connectionGeneration = this.host.getConnectionGeneration();
		const state = this.source.read(notePath);
		if (state && !state.indexed) {
			// Unknown contents must never be read as "all timeblocks deleted".
			return;
		}
		const timeblocks = this.getUniqueTimeblocks(notePath, state?.timeblocks ?? []);
		const invalidIds = new Set(state?.invalidIds ?? []);
		const index = await this.getIndex();
		const entries = new Map(
			index
				.filter((entry) => entry.notePath === notePath)
				.map((entry) => [entry.timeblockId, entry])
		);

		for (const entry of Array.from(entries.values())) {
			// An invalid timeblock is still there, probably mid-edit; keep its event.
			if (timeblocks.has(entry.timeblockId) || invalidIds.has(entry.timeblockId)) continue;

			const movedTo = this.findMoveDestination(entry, index, !state);
			if (movedTo) {
				// A timeblock moved to another note keeps its event.
				await this.rekeyIndexEntry(entry, movedTo);
				entries.delete(entry.timeblockId);
				this.scheduleReconcile(movedTo, new Set([entry.timeblockId]));
				continue;
			}

			if (options.deferDeletions) {
				this.deferredDeletionNotes.add(notePath);
				continue;
			}
			await this.deleteTimeblockEvent(entry, connectionGeneration);
		}

		for (const id of changedIds) {
			if (!timeblocks.has(id) && !entries.has(id) && !invalidIds.has(id)) {
				await this.removeFromSyncQueue(notePath, id);
			}
		}

		// Adopt the events of timeblocks that just moved here, even into a
		// note that is not a daily note, so they are not deleted.
		for (const id of timeblocks.keys()) {
			if (entries.has(id) || !changedIds.has(id)) continue;
			const adoptable = this.findAdoptableEntry(notePath, id, index);
			if (adoptable) {
				entries.set(id, await this.rekeyIndexEntry(adoptable, notePath));
			}
		}

		// Timeblocks in a note that is not (or no longer) a daily note have no
		// date; leave their events alone rather than guessing.
		const date = state?.date;
		if (!date) {
			return;
		}

		for (const [id, timeblock] of timeblocks) {
			const entry = entries.get(id);
			if (!entry && !changedIds.has(id)) {
				continue;
			}

			try {
				await this.syncTimeblock(
					notePath,
					date,
					timeblock,
					entry,
					calendarId,
					connectionGeneration
				);
				await this.removeFromSyncQueue(notePath, id);
			} catch (error) {
				tasknotesLogger.warn("Failed to sync timeblock to Google Calendar; queued for retry", {
					category: "provider",
					operation: "sync-timeblock",
					details: { value: `${notePath}#${id}` },
					error,
				});
				await this.queueSyncRetry(notePath, id, error);
			}
		}
	}

	/**
	 * Sync is on but Google is not connected yet: keep the edits for retry.
	 * Nothing is queued without a target calendar, and new timeblocks outside
	 * daily notes are not queued, since they would never be synced.
	 */
	private async queueUntilReady(notePath: string, changedIds: Set<string>): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport?.syncTimeblocks || !this.getTargetCalendarId()) {
			return;
		}
		const state = this.source.read(notePath);
		if (state && !state.indexed) {
			// Unknown contents: keep only the edits already seen.
			for (const id of changedIds) {
				await this.queueSyncRetry(notePath, id, new Error("Google Calendar sync is not ready"));
			}
			return;
		}
		const removedIds = (await this.getIndex())
			.filter(
				(entry) =>
					entry.notePath === notePath && !(state && this.holdsTimeblock(state, entry.timeblockId))
			)
			.map((entry) => entry.timeblockId);
		const ids = new Set([...(state?.date ? changedIds : []), ...removedIds]);
		for (const id of ids) {
			await this.queueSyncRetry(notePath, id, new Error("Google Calendar sync is not ready"));
		}
	}

	private async syncTimeblock(
		notePath: string,
		date: string,
		timeblock: TimeBlock,
		entry: GoogleCalendarTimeblockEventIndexEntry | undefined,
		calendarId: string,
		connectionGeneration: number
	): Promise<void> {
		const payload = this.buildEventPayload(notePath, date, timeblock);
		const fingerprint = hashString(JSON.stringify({ calendarId, payload }));

		if (entry && entry.calendarId === calendarId) {
			if (entry.fingerprint === fingerprint) {
				return;
			}
			try {
				await this.host.withGoogleRateLimit(async () => {
					await this.host.assertConnectionGenerationCurrent(connectionGeneration);
					return this.googleCalendarService.updateEvent(
						calendarId,
						entry.eventId,
						payload,
						connectionGeneration
					);
				});
				await this.host.assertConnectionGenerationCurrent(connectionGeneration);
				await this.upsertIndexEntry({ ...entry, fingerprint, updatedAt: Date.now() });
				return;
			} catch (error) {
				if (!isEventGoneError(error)) {
					throw error;
				}
				// The event was deleted in Google. Recreate it only if the timeblock
				// still exists now, not just when this reconcile started.
				await this.removeIndexEntriesForEvent(entry.calendarId, entry.eventId);
				const current = this.source.read(notePath);
				if (!current?.timeblocks.some((candidate) => candidate.id === timeblock.id)) {
					return;
				}
			}
		}

		await this.createEvent(notePath, timeblock.id, calendarId, payload, fingerprint, connectionGeneration);

		if (entry && entry.calendarId !== calendarId) {
			// The target calendar changed; remove the event from the old calendar.
			await this.host.deleteOrQueueEvent(
				notePath,
				timeblock.id,
				entry.calendarId,
				entry.eventId,
				connectionGeneration
			);
		}
	}

	private async createEvent(
		notePath: string,
		timeblockId: string,
		calendarId: string,
		payload: TimeblockEventPayload,
		fingerprint: string,
		connectionGeneration: number
	): Promise<string> {
		const key = JSON.stringify([calendarId, notePath, timeblockId]);
		const pending = TimeblockCalendarSync.pendingCreates.get(key);
		if (pending) {
			const eventId = await pending;
			const entry = (await this.getIndex()).find(
				(candidate) => candidate.calendarId === calendarId && candidate.eventId === eventId
			);
			if (entry && entry.fingerprint !== fingerprint) {
				await this.syncTimeblockPayload(entry, payload, fingerprint, connectionGeneration);
			}
			return eventId;
		}

		const create = (async () => {
			const created = await this.host.withGoogleRateLimit(async () => {
				await this.host.assertConnectionGenerationCurrent(connectionGeneration);
				return this.googleCalendarService.createEvent(
					calendarId,
					{ ...payload, isAllDay: false },
					connectionGeneration
				);
			});
			// Created IDs look like "google-{calendarId}-{eventId}". Calendar IDs
			// can contain hyphens, so strip the exact known prefix.
			const prefix = `google-${calendarId}-`;
			const eventId = created.id.startsWith(prefix)
				? created.id.slice(prefix.length)
				: created.id;

			try {
				await this.host.assertConnectionGenerationCurrent(connectionGeneration);
				await this.upsertIndexEntry({
					notePath,
					timeblockId,
					calendarId,
					eventId,
					fingerprint,
					updatedAt: Date.now(),
				});
			} catch (error) {
				// Without a link the event would be orphaned; remove it later instead.
				await this.host.queueEventDeletion(notePath, timeblockId, calendarId, eventId, error);
				throw error;
			}
			return eventId;
		})();

		TimeblockCalendarSync.pendingCreates.set(key, create);
		try {
			return await create;
		} finally {
			if (TimeblockCalendarSync.pendingCreates.get(key) === create) {
				TimeblockCalendarSync.pendingCreates.delete(key);
			}
		}
	}

	private async syncTimeblockPayload(
		entry: GoogleCalendarTimeblockEventIndexEntry,
		payload: TimeblockEventPayload,
		fingerprint: string,
		connectionGeneration: number
	): Promise<void> {
		await this.host.withGoogleRateLimit(async () => {
			await this.host.assertConnectionGenerationCurrent(connectionGeneration);
			return this.googleCalendarService.updateEvent(
				entry.calendarId,
				entry.eventId,
				payload,
				connectionGeneration
			);
		});
		await this.host.assertConnectionGenerationCurrent(connectionGeneration);
		await this.upsertIndexEntry({ ...entry, fingerprint, updatedAt: Date.now() });
	}

	/**
	 * Delete a removed timeblock's event. The link is dropped only once Google
	 * confirms the delete; failures stay in the shared deletion queue for retry.
	 */
	private async deleteTimeblockEvent(
		entry: GoogleCalendarTimeblockEventIndexEntry,
		connectionGeneration: number
	): Promise<void> {
		await this.removeFromSyncQueue(entry.notePath, entry.timeblockId);
		const deleted = await this.host.deleteOrQueueEvent(
			entry.notePath,
			entry.timeblockId,
			entry.calendarId,
			entry.eventId,
			connectionGeneration
		);
		if (deleted) {
			await this.removeIndexEntriesForEvent(entry.calendarId, entry.eventId);
		}
	}

	/**
	 * The note an indexed timeblock moved to: another note, daily or not, that
	 * holds it without its own link. Only a copy that appeared this session
	 * counts, so an old note sharing the ID (for example from a template) does
	 * not take over the event. When the whole note is gone, a note with the
	 * same file name also counts: the note was moved while Obsidian was closed.
	 */
	private findMoveDestination(
		entry: GoogleCalendarTimeblockEventIndexEntry,
		index: GoogleCalendarTimeblockEventIndexEntry[],
		noteGone: boolean
	): string | null {
		const now = Date.now();
		for (const notePath of this.source.findNotesWithTimeblock(entry.timeblockId)) {
			if (notePath === entry.notePath) continue;
			const hasOwnLink = index.some(
				(candidate) =>
					candidate.notePath === notePath && candidate.timeblockId === entry.timeblockId
			);
			if (hasOwnLink) continue;
			const state = this.source.read(notePath);
			if (!state?.indexed || !state.timeblocks.some((tb) => tb.id === entry.timeblockId)) {
				continue;
			}
			const justAdded =
				this.pendingChangedIds.get(notePath)?.has(entry.timeblockId) ||
				this.isRecentlyAdded(notePath, entry.timeblockId, now);
			const sameFile = noteGone && getBasename(notePath) === getBasename(entry.notePath);
			if (justAdded || sameFile) {
				return notePath;
			}
		}
		return null;
	}

	/**
	 * An index entry for this timeblock ID whose note no longer contains it,
	 * i.e. the timeblock moved here. A copy that still exists in its original
	 * note is never adopted, so it gets its own event; neither is the entry of
	 * a note whose contents are unknown, such as one with unparseable YAML.
	 */
	private findAdoptableEntry(
		notePath: string,
		timeblockId: string,
		index: GoogleCalendarTimeblockEventIndexEntry[]
	): GoogleCalendarTimeblockEventIndexEntry | undefined {
		return index.find((entry) => {
			if (entry.timeblockId !== timeblockId || entry.notePath === notePath) {
				return false;
			}
			const origin = this.source.read(entry.notePath);
			if (!origin) return true;
			return origin.indexed && !this.holdsTimeblock(origin, timeblockId);
		});
	}

	/** Whether a note has this timeblock, valid or not. */
	private holdsTimeblock(state: DailyNoteTimeblocks, timeblockId: string): boolean {
		return (
			state.timeblocks.some((timeblock) => timeblock.id === timeblockId) ||
			!!state.invalidIds?.includes(timeblockId)
		);
	}

	private markRecentlyAdded(notePath: string, timeblockId: string, now: number): void {
		const added = this.recentlyAddedIds.get(notePath) ?? new Map<string, number>();
		for (const [id, addedAt] of added) {
			if (now - addedAt >= MOVE_WINDOW_MS) added.delete(id);
		}
		added.set(timeblockId, now);
		this.recentlyAddedIds.set(notePath, added);
	}

	private isRecentlyAdded(notePath: string, timeblockId: string, now: number): boolean {
		const addedAt = this.recentlyAddedIds.get(notePath)?.get(timeblockId);
		return addedAt !== undefined && now - addedAt < MOVE_WINDOW_MS;
	}

	private async rekeyIndexEntry(
		entry: GoogleCalendarTimeblockEventIndexEntry,
		notePath: string
	): Promise<GoogleCalendarTimeblockEventIndexEntry> {
		const rekeyed = { ...entry, notePath, updatedAt: Date.now() };
		await this.mutateIndex((index) => [
			...index.filter(
				(candidate) =>
					!(candidate.calendarId === entry.calendarId && candidate.eventId === entry.eventId)
			),
			rekeyed,
		]);
		return rekeyed;
	}

	/**
	 * Timeblocks by ID. A note with duplicated IDs (for example, a timeblock
	 * pasted twice in the YAML) only syncs the first; the others cannot be
	 * told apart and would otherwise share one event.
	 */
	private getUniqueTimeblocks(notePath: string, timeblocks: TimeBlock[]): Map<string, TimeBlock> {
		const byId = new Map<string, TimeBlock>();
		for (const timeblock of timeblocks) {
			if (byId.has(timeblock.id)) {
				tasknotesLogger.warn("Skipping timeblock with duplicate ID for Google Calendar sync", {
					category: "validation",
					operation: "duplicate-timeblock-id",
					details: { value: `${notePath}#${timeblock.id}` },
				});
				continue;
			}
			byId.set(timeblock.id, timeblock);
		}
		return byId;
	}

	private getContentFingerprints(state: DailyNoteTimeblocks): Map<string, string> {
		const fingerprints = new Map<string, string>();
		for (const id of state.invalidIds ?? []) {
			fingerprints.set(id, INVALID_TIMEBLOCK_FINGERPRINT);
		}
		for (const timeblock of state.timeblocks) {
			if (fingerprints.has(timeblock.id)) continue;
			fingerprints.set(
				timeblock.id,
				JSON.stringify([
					state.date,
					timeblock.title,
					timeblock.startTime,
					timeblock.endTime,
					timeblock.description ?? "",
					timeblock.attachments ?? [],
				])
			);
		}
		return fingerprints;
	}

	private buildEventPayload(
		notePath: string,
		date: string,
		timeblock: TimeBlock
	): TimeblockEventPayload {
		const settings = this.plugin.settings.googleCalendarExport;
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
		const startsAfterMidnight = timeblock.startTime !== "00:00";
		const endsAtNextMidnight =
			timeblock.endTime === "24:00" || (timeblock.endTime === "00:00" && startsAfterMidnight);
		const endDate = endsAtNextMidnight ? this.getNextDate(date) : date;
		const endTime = endsAtNextMidnight ? "00:00" : timeblock.endTime;

		const payload: TimeblockEventPayload = {
			summary: this.applyTitleTemplate(timeblock, date),
			start: { dateTime: `${date}T${timeblock.startTime}:00`, timeZone },
			end: { dateTime: `${endDate}T${endTime}:00`, timeZone },
		};

		const description = this.buildEventDescription(notePath, timeblock);
		if (description) {
			payload.description = description;
		}
		if (settings.eventColorId) {
			payload.colorId = settings.eventColorId;
		}
		return payload;
	}

	private applyTitleTemplate(timeblock: TimeBlock, date: string): string {
		const template =
			this.plugin.settings.googleCalendarExport.timeblockEventTitleTemplate || "{{title}}";
		const rendered = template
			.replace(/\{\{title\}\}/g, timeblock.title)
			.replace(/\{\{date\}\}/g, date)
			.replace(/\{\{startTime\}\}/g, timeblock.startTime)
			.replace(/\{\{endTime\}\}/g, timeblock.endTime)
			.trim();
		return rendered || timeblock.title;
	}

	private buildEventDescription(notePath: string, timeblock: TimeBlock): string {
		const parts: string[] = [];
		if (timeblock.description) {
			parts.push(timeblock.description);
		}
		if (timeblock.attachments && timeblock.attachments.length > 0) {
			if (parts.length > 0) parts.push("");
			parts.push(...timeblock.attachments.map((attachment) => `- ${attachment}`));
		}
		if (this.plugin.settings.googleCalendarExport.includeObsidianLink) {
			if (parts.length > 0) {
				parts.push("");
				parts.push("---");
			}
			const vaultName = this.plugin.app.vault.getName();
			const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(notePath)}`;
			parts.push(`Open in Obsidian: ${obsidianUri}`);
		}
		return uiData(
			parts.join("\n"),
			"Persisted Google Calendar description: user timeblock data and English link label, matching task events"
		);
	}

	private getNextDate(date: string): string {
		const next = parseDateToLocal(date);
		next.setDate(next.getDate() + 1);
		return format(next, "yyyy-MM-dd");
	}

	private async getIndex(): Promise<GoogleCalendarTimeblockEventIndexEntry[]> {
		const data = (await this.plugin.loadData()) as Record<string, unknown> | null;
		const index = data?.[TIMEBLOCK_EVENT_INDEX_KEY];
		return Array.isArray(index) ? (index as GoogleCalendarTimeblockEventIndexEntry[]) : [];
	}

	private async upsertIndexEntry(entry: GoogleCalendarTimeblockEventIndexEntry): Promise<void> {
		await this.mutateIndex((index) => [
			...index.filter(
				(candidate) =>
					!(
						candidate.notePath === entry.notePath &&
						candidate.timeblockId === entry.timeblockId
					) &&
					!(candidate.calendarId === entry.calendarId && candidate.eventId === entry.eventId)
			),
			entry,
		]);
	}

	private async mutateIndex(
		mutation: (
			index: GoogleCalendarTimeblockEventIndexEntry[]
		) => GoogleCalendarTimeblockEventIndexEntry[] | null
	): Promise<void> {
		await withPluginDataWriteLock(this.plugin, async () => {
			const data = await this.loadPluginDataOrThrow("save-google-calendar-timeblock-event-index");
			const current = data[TIMEBLOCK_EVENT_INDEX_KEY];
			const next = mutation(
				Array.isArray(current) ? (current as GoogleCalendarTimeblockEventIndexEntry[]) : []
			);
			if (next === null) return;
			data[TIMEBLOCK_EVENT_INDEX_KEY] = next;
			await this.plugin.saveData(data);
		});
	}

	/**
	 * Unlike other plugin-data writes, a skipped timeblock write must fail: a
	 * new event whose link was not saved would be orphaned and duplicated.
	 */
	private async loadPluginDataOrThrow(operation: string): Promise<Record<string, unknown>> {
		const data = await this.plugin.loadPluginDataForSafeWrite(operation);
		if (!data) {
			throw new Error("TaskNotes plugin data could not be read safely");
		}
		return data;
	}

	private async getSyncQueue(): Promise<PendingGoogleCalendarTimeblockSync[]> {
		const data = (await this.plugin.loadData()) as Record<string, unknown> | null;
		const queue = data?.[TIMEBLOCK_SYNC_QUEUE_KEY];
		return Array.isArray(queue) ? (queue as PendingGoogleCalendarTimeblockSync[]) : [];
	}

	private async queueSyncRetry(notePath: string, timeblockId: string, error: unknown): Promise<void> {
		const now = Date.now();
		await this.mutateSyncQueue((queue) => {
			const existing = queue.find(
				(item) => item.notePath === notePath && item.timeblockId === timeblockId
			);
			if (existing) {
				existing.attempts += 1;
				existing.requestedAt = now;
				existing.lastError = getErrorMessage(error);
				return queue;
			}
			return [
				...queue,
				{ notePath, timeblockId, requestedAt: now, attempts: 1, lastError: getErrorMessage(error) },
			];
		});
	}

	private async removeFromSyncQueue(notePath: string, timeblockId: string): Promise<void> {
		await this.mutateSyncQueue((queue) => {
			const next = queue.filter(
				(item) => !(item.notePath === notePath && item.timeblockId === timeblockId)
			);
			return next.length === queue.length ? null : next;
		});
	}

	private async mutateSyncQueue(
		mutation: (
			queue: PendingGoogleCalendarTimeblockSync[]
		) => PendingGoogleCalendarTimeblockSync[] | null
	): Promise<void> {
		await withPluginDataWriteLock(this.plugin, async () => {
			const data = await this.loadPluginDataOrThrow("save-google-calendar-timeblock-sync-queue");
			const current = data[TIMEBLOCK_SYNC_QUEUE_KEY];
			const next = mutation(
				Array.isArray(current) ? (current as PendingGoogleCalendarTimeblockSync[]) : []
			);
			if (next === null) return;
			data[TIMEBLOCK_SYNC_QUEUE_KEY] = next;
			await this.plugin.saveData(data);
		});
	}
}
