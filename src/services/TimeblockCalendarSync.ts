import { TAbstractFile, TFile } from "obsidian";
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

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TimeblockCalendarSync" });

/** Persistent plugin-data key linking timeblocks to the Google events created for them */
const TIMEBLOCK_EVENT_INDEX_KEY = "googleCalendarTimeblockEventIndex";

/** Persistent plugin-data key for timeblocks whose create/update must be retried */
const TIMEBLOCK_SYNC_QUEUE_KEY = "googleCalendarTimeblockSyncQueue";

/** Debounce delay for rapid daily-note edits (ms) */
const TIMEBLOCK_SYNC_DEBOUNCE_MS = 500;

export interface DailyNoteTimeblocks {
	/** The note's date (YYYY-MM-DD), or null when it has no timeblocks or is not a daily note */
	date: string | null;
	timeblocks: TimeBlock[];
	/** False while Obsidian has not parsed the note yet, so its timeblocks are unknown */
	indexed: boolean;
}

/** Read access to daily-note timeblocks; injectable for tests. */
export interface TimeblockNoteSource {
	/** Returns null only when no file exists at the path. */
	read(notePath: string): DailyNoteTimeblocks | null;
	listNotePaths(): string[];
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
			const rawTimeblocks: unknown = cache?.frontmatter?.timeblocks;
			const timeblocks = Array.isArray(rawTimeblocks)
				? rawTimeblocks.filter((timeblock): timeblock is TimeBlock =>
						validateTimeBlock(timeblock)
					)
				: [];
			// Only look up the date for notes that have timeblocks; this runs on
			// every metadata change in the vault.
			// A cache miss may be a daily note created moments ago, so refresh once.
			const date =
				timeblocks.length > 0
					? (getDailyNoteDates().get(notePath) ??
						getDailyNoteDates(true).get(notePath) ??
						null)
					: null;
			return { date, timeblocks, indexed: !!cache };
		},
		listNotePaths() {
			return Array.from(getDailyNoteDates().keys());
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
	private static indexWrite: Promise<unknown> = Promise.resolve();
	private static syncQueueWrite: Promise<unknown> = Promise.resolve();

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
		TimeblockCalendarSync.indexWrite = Promise.resolve();
		TimeblockCalendarSync.syncQueueWrite = Promise.resolve();
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
			if (!state.indexed) {
				this.unindexedNotes.add(notePath);
				continue;
			}
			if (state.timeblocks.length > 0) {
				this.snapshots.set(notePath, this.getContentFingerprints(state));
			}
		}
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
		if (!previous && state.timeblocks.length === 0) {
			this.unindexedNotes.delete(notePath);
			return;
		}
		const current = this.getContentFingerprints(state);
		this.snapshots.set(notePath, current);
		if (
			this.unindexedNotes.delete(notePath) ||
			!this.plugin.settings.googleCalendarExport?.syncTimeblocks
		) {
			return;
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
	 * for the note is cancelled and the reconcile runs straight away, so a
	 * queued update cannot recreate an event after its timeblock is gone.
	 */
	handleNoteDeleted(notePath: string): void {
		if (this.destroyed) return;
		this.cancelPendingReconcile(notePath);
		const hadTimeblocks = this.snapshots.delete(notePath);
		const wasUnindexed = this.unindexedNotes.delete(notePath);
		if (hadTimeblocks || wasUnindexed) {
			void this.enqueueReconcile(notePath, new Set());
		}
	}

	async handleNoteRenamed(oldPath: string, newPath: string): Promise<void> {
		if (this.destroyed) return;
		const pendingIds = this.pendingChangedIds.get(oldPath);
		this.cancelPendingReconcile(oldPath);
		const snapshot = this.snapshots.get(oldPath);
		const wasUnindexed = this.unindexedNotes.delete(oldPath);
		if (!snapshot && !wasUnindexed) {
			return;
		}
		this.snapshots.delete(oldPath);
		if (snapshot) this.snapshots.set(newPath, snapshot);

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
	 * while Obsidian was closed.
	 */
	async processRecovery(includeIndexedNotes: boolean): Promise<void> {
		if (!this.isEnabled()) {
			return;
		}

		const work = new Map<string, Set<string>>();
		for (const item of await this.getSyncQueue()) {
			const ids = work.get(item.notePath) ?? new Set<string>();
			ids.add(item.timeblockId);
			work.set(item.notePath, ids);
		}
		if (includeIndexedNotes) {
			for (const entry of await this.getIndex()) {
				if (!work.has(entry.notePath)) {
					work.set(entry.notePath, new Set());
				}
			}
		}

		for (const [notePath, ids] of work) {
			await this.enqueueReconcile(notePath, ids);
		}
	}

	/**
	 * Whether a queued deletion of a timeblock event should still run. It is
	 * skipped only when the timeblock exists and is still linked to that event.
	 */
	async isQueuedDeletionStillNeeded(item: PendingGoogleCalendarDeletion): Promise<boolean> {
		if (!item.timeblockId) return true;
		const state = this.source.read(item.taskPath);
		if (!state?.timeblocks.some((timeblock) => timeblock.id === item.timeblockId)) {
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

	private scheduleReconcile(notePath: string, changedIds: Set<string>): void {
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
		}, TIMEBLOCK_SYNC_DEBOUNCE_MS);
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

	private enqueueReconcile(notePath: string, changedIds: Set<string>): Promise<void> {
		const run = this.reconcileChain
			.catch(() => undefined)
			.then(() => this.reconcileNote(notePath, changedIds));
		this.reconcileChain = run.catch((error) => {
			tasknotesLogger.error("Failed to sync timeblocks to Google Calendar:", {
				category: "provider",
				operation: "reconcile-timeblock-note",
				details: { value: notePath },
				error,
			});
		});
		return run;
	}

	private async reconcileNote(notePath: string, changedIds: Set<string>): Promise<void> {
		if (this.destroyed) {
			return;
		}
		if (!this.isEnabled()) {
			// Sync is on but Google is not connected yet: keep the edits for retry.
			if (this.plugin.settings.googleCalendarExport?.syncTimeblocks) {
				const present = new Set(
					(this.source.read(notePath)?.timeblocks ?? []).map((timeblock) => timeblock.id)
				);
				const removedIds = (await this.getIndex())
					.filter((entry) => entry.notePath === notePath && !present.has(entry.timeblockId))
					.map((entry) => entry.timeblockId);
				for (const id of new Set([...changedIds, ...removedIds])) {
					await this.queueSyncRetry(
						notePath,
						id,
						new Error("Google Calendar sync is not ready")
					);
				}
			}
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
		const index = await this.getIndex();
		const entries = new Map(
			index
				.filter((entry) => entry.notePath === notePath)
				.map((entry) => [entry.timeblockId, entry])
		);

		for (const entry of entries.values()) {
			if (timeblocks.has(entry.timeblockId)) continue;

			const movedTo = this.findNoteHoldingMovedTimeblock(entry, index);
			if (movedTo) {
				// A timeblock moved to another day keeps its event.
				await this.rekeyIndexEntry(entry, movedTo);
				this.scheduleReconcile(movedTo, new Set([entry.timeblockId]));
				continue;
			}

			await this.deleteTimeblockEvent(entry, connectionGeneration);
		}

		for (const id of changedIds) {
			if (!timeblocks.has(id) && !entries.has(id)) {
				await this.removeFromSyncQueue(notePath, id);
			}
		}

		// Timeblocks in a note that is not (or no longer) a daily note have no
		// date; leave their events alone rather than guessing.
		const date = state?.date;
		if (!date) {
			return;
		}

		for (const [id, timeblock] of timeblocks) {
			let entry = entries.get(id);
			if (!entry) {
				const adoptable = this.findAdoptableEntry(notePath, id, index);
				if (adoptable) {
					entry = await this.rekeyIndexEntry(adoptable, notePath);
				}
			}
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

	private async syncTimeblock(
		notePath: string,
		date: string,
		timeblock: TimeBlock,
		entry: GoogleCalendarTimeblockEventIndexEntry | undefined,
		calendarId: string,
		connectionGeneration: number
	): Promise<void> {
		const payload = this.buildEventPayload(notePath, date, timeblock);
		const fingerprint = JSON.stringify({ calendarId, payload });

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

	/** An indexed timeblock missing from its note but present, unlinked, in another daily note. */
	private findNoteHoldingMovedTimeblock(
		entry: GoogleCalendarTimeblockEventIndexEntry,
		index: GoogleCalendarTimeblockEventIndexEntry[]
	): string | null {
		for (const notePath of this.source.listNotePaths()) {
			if (notePath === entry.notePath) continue;
			const hasOwnLink = index.some(
				(candidate) =>
					candidate.notePath === notePath && candidate.timeblockId === entry.timeblockId
			);
			if (hasOwnLink) continue;
			const state = this.source.read(notePath);
			if (state?.timeblocks.some((timeblock) => timeblock.id === entry.timeblockId)) {
				return notePath;
			}
		}
		return null;
	}

	/**
	 * An index entry for this timeblock ID whose note no longer contains it,
	 * i.e. the timeblock moved here. A copy that still exists in its original
	 * note is never adopted, so it gets its own event.
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
			return !origin?.timeblocks.some((timeblock) => timeblock.id === timeblockId);
		});
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
		const write = TimeblockCalendarSync.indexWrite
			.catch(() => undefined)
			.then(async () => {
				const data = await this.plugin.loadPluginDataForSafeWrite(
					"save-google-calendar-timeblock-event-index"
				);
				if (!data) return;
				const current = data[TIMEBLOCK_EVENT_INDEX_KEY];
				const next = mutation(
					Array.isArray(current) ? (current as GoogleCalendarTimeblockEventIndexEntry[]) : []
				);
				if (next === null) return;
				data[TIMEBLOCK_EVENT_INDEX_KEY] = next;
				await this.plugin.saveData(data);
			});
		TimeblockCalendarSync.indexWrite = write;
		await write;
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
		const write = TimeblockCalendarSync.syncQueueWrite
			.catch(() => undefined)
			.then(async () => {
				const data = await this.plugin.loadPluginDataForSafeWrite(
					"save-google-calendar-timeblock-sync-queue"
				);
				if (!data) return;
				const current = data[TIMEBLOCK_SYNC_QUEUE_KEY];
				const next = mutation(
					Array.isArray(current) ? (current as PendingGoogleCalendarTimeblockSync[]) : []
				);
				if (next === null) return;
				data[TIMEBLOCK_SYNC_QUEUE_KEY] = next;
				await this.plugin.saveData(data);
			});
		TimeblockCalendarSync.syncQueueWrite = write;
		await write;
	}
}
