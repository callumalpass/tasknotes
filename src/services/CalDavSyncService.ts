/**
 * Two-way CalDAV VTODO sync orchestration.
 *
 * Holds the moving parts that the pure modules under ./caldav/ cannot: vault
 * writes, timers, persisted state and the plugin's task services. The decisions
 * themselves — what a VTODO looks like, who wins a conflict, what to upload —
 * live in those pure modules and are tested there.
 *
 * Loop prevention is structural, copied from the Google integration: writing
 * `caldav_etag` back into frontmatter re-fires `file-updated`, and there is no
 * event-suppression flag anywhere in the plugin, so a content fingerprint that
 * excludes every `caldav_*` key is what stops the cycle. See caldavFingerprint.ts.
 */

import { TFile } from "obsidian";

import type TaskNotesPlugin from "../main";
import type { TaskDependency, TaskInfo } from "../types";
import type { CalDavAccountSettings } from "../types/settings";
import { publishUserNotice } from "../core/userNotices";
import { processVaultFrontMatter } from "../core/VaultMutationService";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { CalDavClient, CalDavError } from "./CalDavClient";
import { CalDavSecretStore } from "./CalDavSecretStore";
import {
	CALDAV_FRONTMATTER_KEYS,
	getCalDavRelevantFingerprint,
} from "./caldav/caldavFingerprint";
import {
	planFirstSync,
	planIncrementalSync,
	planRemoteDeletion,
	resolveConflict,
	summarizeFirstSyncPlan,
	type FirstSyncPlan,
	type LocalTaskSnapshot,
	type RemoteTodoSnapshot,
} from "./caldav/caldavReconciliation";
import {
	taskBelongsToCollection,
	type CalDavCollectionScope,
} from "./caldav/collectionMembership";
import {
	applyTaskToVTodo,
	readVTodoIntoTaskPatch,
	readVTodoRevision,
	readVTodoUid,
	type VTodoMappingContext,
} from "./caldav/vtodoMapping";
import {
	createVTodoDocument,
	parseVTodoDocument,
	serializeVTodoDocument,
	type VTodoDocument,
} from "./caldav/vtodoDocument";
import { applyReminders, readReminders } from "./caldav/vtodoAlarms";
import { applyRelations, readRelations, type VTodoRelations } from "./caldav/vtodoRelations";
import { generateLink, parseLinkToPath } from "../utils/linkUtils";
import { formatDependencyLink, resolveDependencyEntry } from "../utils/dependencyUtils";
import type { FilterPredicateEvaluationContext } from "./filter-service/filterPredicateEvaluation";

const DATA_KEY_FINGERPRINTS = "caldavTaskFingerprints";
const DATA_KEY_COLLECTION_STATE = "caldavCollectionState";
const DATA_KEY_RESOURCE_INDEX = "caldavResourceIndex";
const DATA_KEY_SYNC_QUEUE = "caldavSyncQueue";

/** How often the retry queue is drained. */
const RETRY_QUEUE_INTERVAL_MS = 60_000;
/**
 * Attempts before a queued push is abandoned. The Google queue retries forever;
 * that turns a permanently rejected task into an endless request loop, so this
 * one gives up and says so.
 */
const MAX_PUSH_ATTEMPTS = 5;

/** A push that failed and is waiting to be retried. */
interface PendingCalDavPush {
	taskPath: string;
	accountId: string;
	requestedAt: number;
	attempts: number;
	lastAttemptAt?: number;
	lastError?: string;
}

interface CalDavCollectionState {
	syncToken?: string;
	/** Last seen collection ctag; equal means nothing changed server-side. */
	ctag?: string;
	lastSyncedAt?: string;
}

interface CalDavResourceIndexEntry {
	accountId: string;
	uid: string;
	path: string;
	href: string;
}

export class CalDavSyncService {
	private readonly logger = createTaskNotesLogger({ tag: "Services/CalDavSync" });
	private readonly secretStore: CalDavSecretStore;

	private pollTimers = new Map<string, number>();
	private pushTimers = new Map<string, number>();
	/** Paths currently being written by an inbound sync; guards reentrancy. */
	private handlingPaths = new Set<string>();
	/** Tasks whose relations pointed at a target with no UID yet. */
	private pendingRelationPaths = new Set<string>();
	private relationFlushTimers = new Map<string, number>();
	/** Set while replaying deferred relations, to keep the retry to one pass. */
	private flushingRelations = false;
	/** Imported tasks whose relations must wait until every sibling exists. */
	private pendingInboundRelations: { path: string; doc: VTodoDocument }[] = [];
	private inFlightAccounts = new Set<string>();
	private fingerprints: Record<string, string> | null = null;
	private destroyed = false;
	private retryTimer: number | null = null;
	/** Serialises queue writes so concurrent failures cannot lose each other. */
	private queueWrite: Promise<unknown> = Promise.resolve();

	constructor(private readonly plugin: TaskNotesPlugin) {
		this.secretStore = new CalDavSecretStore(plugin.app.secretStorage);
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	async initialize(): Promise<void> {
		if (!this.isEnabled()) return;
		for (const account of this.enabledAccounts()) {
			this.startPollTimer(account.id);
		}
		this.scheduleRetryDrain();
	}

	destroy(): void {
		this.destroyed = true;
		for (const timer of this.pollTimers.values()) window.clearTimeout(timer);
		for (const timer of this.pushTimers.values()) window.clearTimeout(timer);
		if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
		this.retryTimer = null;
		for (const timer of this.relationFlushTimers.values()) window.clearTimeout(timer);
		this.relationFlushTimers.clear();
		this.pollTimers.clear();
		this.pushTimers.clear();
	}

	isEnabled(): boolean {
		return this.plugin.settings.caldav?.enabled === true;
	}

	private enabledAccounts(): CalDavAccountSettings[] {
		return (this.plugin.settings.caldav?.accounts ?? []).filter(
			(account) => account.enabled && account.collectionUrl
		);
	}

	private getAccount(accountId: string): CalDavAccountSettings | undefined {
		return this.plugin.settings.caldav?.accounts.find(
			(account) => account.id === accountId
		);
	}

	// -----------------------------------------------------------------------
	// Event hooks (wired in pluginBootstrap)
	// -----------------------------------------------------------------------

	/**
	 * Reacts to any change to a task file, whether TaskNotes or an external tool
	 * made it. The fingerprint comparison is what distinguishes a real edit from
	 * our own sync-metadata write.
	 */
	async handleTaskFileUpdated(path: string, updatedTask?: TaskInfo): Promise<void> {
		if (!this.isEnabled() || this.destroyed) return;
		if (this.handlingPaths.has(path)) return; // our own inbound write

		const task = updatedTask ?? (await this.plugin.cacheManager.getTaskInfo(path));
		if (!task) return;

		const fingerprints = await this.getFingerprints();
		const fingerprint = getCalDavRelevantFingerprint(task);
		if (fingerprints[path] === fingerprint) return; // nothing sync-relevant changed

		const account = await this.resolveAccountForTask(task);
		if (!account) {
			// Out of scope for every collection: remember the fingerprint so we do
			// not re-evaluate it on every keystroke.
			await this.recordFingerprint(path, fingerprint);
			return;
		}

		if (!this.plugin.settings.caldav.pushOnChange) {
			await this.recordFingerprint(path, fingerprint);
			return;
		}

		this.schedulePush(account, path);
	}

	/** Deletes the remote VTODO when its task file is removed from the vault. */
	async handleTaskFileDeleted(
		path: string,
		previousFrontmatter?: Record<string, unknown>
	): Promise<void> {
		if (!this.isEnabled() || this.destroyed) return;

		const accountId = asString(previousFrontmatter?.[CALDAV_FRONTMATTER_KEYS.account]);
		const href = asString(previousFrontmatter?.[CALDAV_FRONTMATTER_KEYS.href]);
		const etag = asString(previousFrontmatter?.[CALDAV_FRONTMATTER_KEYS.etag]);
		if (!accountId || !href) return;

		const account = this.getAccount(accountId);
		if (!account?.enabled) return;

		try {
			const client = this.createClient(account);
			await client.deleteResource(href, etag ? { ifMatch: etag } : {});
			await this.forgetTask(path);
		} catch (error) {
			this.logError("Failed to delete remote task", error, {
				operation: "delete-remote",
			});
		}
	}

	private schedulePush(account: CalDavAccountSettings, path: string): void {
		const existing = this.pushTimers.get(path);
		if (existing !== undefined) window.clearTimeout(existing);

		const delay = this.plugin.settings.caldav.pushDebounceMs ?? 1500;
		const timer = window.setTimeout(() => {
			this.pushTimers.delete(path);
			void this.pushTask(account.id, path).catch((error: unknown) => {
				this.logError("Failed to push task", error, { operation: "push" });
				// Without this the edit is simply lost until the task is touched
				// again: a transient network failure would silently desync a task.
				void this.enqueueRetry(account.id, path, error);
			});
		}, delay);
		this.pushTimers.set(path, timer);
	}

	// -----------------------------------------------------------------------
	// Push (local -> remote)
	// -----------------------------------------------------------------------

	async pushTask(accountId: string, path: string): Promise<void> {
		const account = this.getAccount(accountId);
		if (!account?.enabled || this.destroyed) return;

		const task = await this.plugin.cacheManager.getTaskInfo(path);
		const file = this.getFile(path);
		if (!task || !file) return;

		const client = this.createClient(account);
		const snapshot = await this.snapshotTask(task, file);
		const uid = snapshot.uid ?? generateUid();
		const href = snapshot.href ?? joinUrl(account.collectionUrl, `${uid}.ics`);

		// Fetch the current resource first so properties we do not model —
		// VALARM, X- properties, DESCRIPTION written on a phone — survive.
		const existing = snapshot.href ? await client.getResource(href) : null;
		const doc =
			(existing?.data ? parseVTodoDocument(existing.data) : null) ??
			createVTodoDocument();

		applyTaskToVTodo(doc, task, this.mappingContext(account), { uid });
		const relations = this.resolveOutboundRelations(task);
		applyRelations(doc, relations.relations);
		applyReminders(doc, task.reminders ?? []);
		const body = serializeVTodoDocument(doc);

		const result = await client.putResource(
			href,
			body,
			snapshot.etag ? { ifMatch: snapshot.etag } : { ifNoneMatch: "*" }
		);

		if (result.conflict) {
			await this.resolveConflictAt(account, path, href, task);
			return;
		}

		await this.stampSyncMetadata(path, {
			uid,
			href,
			etag: result.etag,
			accountId: account.id,
		});
		await this.indexResource({ accountId: account.id, uid, path, href });

		// A parent pushed moments earlier only gets its UID once its own write
		// lands, so revisit the link rather than leaving the hierarchy missing
		// on the server until the next poll.
		if (relations.unresolved && !this.flushingRelations) {
			this.pendingRelationPaths.add(path);
			this.scheduleRelationFlush(account.id);
		}
	}

	/**
	 * Runs after a 412. The ETag mismatch has already established that both
	 * sides changed; this only decides who wins and applies it.
	 */
	private async resolveConflictAt(
		account: CalDavAccountSettings,
		path: string,
		href: string,
		task: TaskInfo
	): Promise<void> {
		const client = this.createClient(account);
		const current = await client.getResource(href);

		if (!current?.data) {
			// Vanished between the PUT and the GET: treat as a remote deletion.
			await this.applyRemoteDeletion(account, path);
			return;
		}

		const remoteDoc = parseVTodoDocument(current.data);
		if (!remoteDoc) {
			this.logError("Remote resource is not a VTODO", undefined, {
				operation: "resolve-conflict",
			});
			return;
		}

		const file = this.getFile(path);
		if (!file) return;

		const localChangedAt = await this.localChangedAtMs(task, file);
		const winner = resolveConflict(localChangedAt, readVTodoRevision(remoteDoc));

		this.logger.info("Resolved CalDAV conflict", {
			category: "provider",
			operation: "resolve-conflict",
			details: { winner, path },
		});

		if (winner === "local") {
			applyTaskToVTodo(remoteDoc, task, this.mappingContext(account), {
				uid: readVTodoUid(remoteDoc) ?? generateUid(),
			});
			const retry = await client.putResource(href, serializeVTodoDocument(remoteDoc), {
				ifMatch: current.etag,
			});
			if (!retry.conflict) {
				await this.stampSyncMetadata(path, {
					uid: readVTodoUid(remoteDoc) ?? "",
					href,
					etag: retry.etag,
					accountId: account.id,
				});
			}
			return;
		}

		await this.applyRemotePatch(account, path, {
			uid: readVTodoUid(remoteDoc) ?? "",
			url: href,
			etag: current.etag,
			revisionMs: readVTodoRevision(remoteDoc),
			data: current.data,
		});
	}

	// -----------------------------------------------------------------------
	// Pull (remote -> local)
	// -----------------------------------------------------------------------

	/** One polling pass for a single account. */
	async syncAccount(accountId: string, options: { force?: boolean } = {}): Promise<void> {
		const force = options.force ?? false;
		const account = this.getAccount(accountId);
		if (!account?.enabled || this.destroyed) return;
		if (this.inFlightAccounts.has(accountId)) return;

		this.inFlightAccounts.add(accountId);
		try {
			const client = this.createClient(account);
			const state = await this.getCollectionState(accountId);

			// Collections routinely mix VTODOs with far more VEVENTs, so ask for
			// the change token first and skip everything else when it has not
			// moved. Walking the resource list instead would drag down every
			// event body just to discover none of them are tasks.
			const tag = await client.getCollectionTag(account.collectionUrl);
			const currentTag = tag.ctag ?? tag.syncToken;
			if (currentTag && state.ctag === currentTag && !force) {
				return;
			}

			// A VTODO-filtered calendar-query returns only tasks, and returns all
			// of them — completeness is what makes deletion detection safe.
			const remotes = (await client.fetchAllVTodos(account.collectionUrl))
				.map((resource) => this.toRemoteSnapshot(resource.url, resource.etag, resource.data))
				.filter((snapshot): snapshot is RemoteSnapshotWithData => snapshot !== null);

			const locals = await this.snapshotAccountTasks(account);
			const plan = planIncrementalSync(locals, remotes, {
				remotesAreComplete: true,
			});

			for (const remote of plan.toPull) {
				const withData = remotes.find((entry) => entry.uid === remote.uid);
				if (withData) await this.applyRemotePatch(account, undefined, withData);
			}

			for (const conflict of plan.conflicts) {
				if (conflict.winner === "local") {
					await this.pushTask(accountId, conflict.local.path);
				} else {
					const withData = remotes.find((entry) => entry.uid === conflict.remote.uid);
					if (withData) await this.applyRemotePatch(account, conflict.local.path, withData);
				}
			}

			for (const local of plan.remoteDeleted) {
				await this.applyRemoteDeletion(account, local.path);
			}

			for (const local of plan.toPush) {
				await this.pushTask(accountId, local.path);
			}

			await this.flushRelations(account);

			await this.setCollectionState(accountId, {
				syncToken: tag.syncToken ?? state.syncToken,
				ctag: currentTag,
				lastSyncedAt: new Date().toISOString(),
			});
		} catch (error) {
			this.reportSyncError(account, error);
		} finally {
			this.inFlightAccounts.delete(accountId);
		}
	}

	/**
	 * Writes a remote VTODO into the vault, either patching the matching task or
	 * creating one. `knownPath` short-circuits the index lookup when the caller
	 * already knows which task this is.
	 */
	private async applyRemotePatch(
		account: CalDavAccountSettings,
		knownPath: string | undefined,
		remote: RemoteSnapshotWithData
	): Promise<void> {
		const doc = parseVTodoDocument(remote.data);
		if (!doc) return;

		const uid = readVTodoUid(doc) ?? remote.uid;
		const patch = readVTodoIntoTaskPatch(doc, this.mappingContext(account));
		const path = knownPath ?? (await this.findPathForUid(account.id, uid));

		if (path) {
			const task = await this.plugin.cacheManager.getTaskInfo(path);
			if (!task) return;

			this.handlingPaths.add(path);
			try {
				await this.plugin.taskService.updateTask(task, {
					...(patch.title !== undefined && { title: patch.title }),
					...(patch.status !== undefined && { status: patch.status }),
					...(patch.priority !== undefined && { priority: patch.priority }),
					due: patch.due ?? undefined,
					scheduled: patch.scheduled ?? undefined,
					completedDate: patch.completedDate ?? undefined,
					...(patch.tags !== undefined && { tags: patch.tags }),
					recurrence: patch.recurrence ?? undefined,
				});
				await this.stampSyncMetadata(path, {
					uid,
					href: remote.url,
					etag: remote.etag,
					accountId: account.id,
				});
			} finally {
				this.handlingPaths.delete(path);
			}
			await this.indexResource({ accountId: account.id, uid, path, href: remote.url });
			await this.applyInboundRelations(account, path, doc);
			return;
		}

		// New on the server: create through the normal creation choke point so
		// folder rules, templates and defaults all apply.
		const created = await this.plugin.taskService.createTask({
			title: patch.title ?? "Untitled task",
			...(patch.status !== undefined && { status: patch.status }),
			...(patch.priority !== undefined && { priority: patch.priority }),
			// Empty string rather than an omitted key: leaving a date out lets the
			// vault's creation defaults invent one (scheduled defaults to today),
			// and the next push would write that invented date onto the user's
			// remote task. An empty value skips the default and is normalised
			// away again by the creation service.
			due: patch.due ?? "",
			scheduled: patch.scheduled ?? "",
			completedDate: patch.completedDate ?? "",
			recurrence: patch.recurrence ?? "",
			...(patch.tags?.length ? { tags: patch.tags } : {}),
			creationContext: "import",
			// completeTaskData drops unrecognised fields, so the CalDAV keys have
			// to travel as custom frontmatter.
			customFrontmatter: {
				[CALDAV_FRONTMATTER_KEYS.uid]: uid,
				[CALDAV_FRONTMATTER_KEYS.href]: remote.url,
				...(remote.etag ? { [CALDAV_FRONTMATTER_KEYS.etag]: remote.etag } : {}),
				[CALDAV_FRONTMATTER_KEYS.account]: account.id,
				[CALDAV_FRONTMATTER_KEYS.syncedAt]: new Date().toISOString(),
			},
		});

		await this.recordFingerprint(
			created.taskInfo.path,
			getCalDavRelevantFingerprint(created.taskInfo)
		);
		await this.indexResource({
			accountId: account.id,
			uid,
			path: created.taskInfo.path,
			href: remote.url,
		});
		// Deferred: a parent imported later in this same run has no path yet.
		this.pendingInboundRelations.push({ path: created.taskInfo.path, doc });
	}

	/**
	 * Syncs every enabled account now, ignoring the change gate.
	 *
	 * Forced because the point of asking is usually to check a suspicion that
	 * the tokens are lying.
	 */
	async syncAllAccounts(): Promise<void> {
		for (const account of this.enabledAccounts()) {
			await this.syncAccount(account.id, { force: true });
		}
	}

	/**
	 * Detaches every task from CalDAV, leaving the notes and the server alone.
	 *
	 * Only the local link is removed; nothing is deleted on either side. Note
	 * that the link is also what makes re-syncing idempotent, so syncing the
	 * same list again after this will duplicate every task — the confirmation
	 * text says so, and this is why the command asks before running.
	 *
	 * The set of tasks to clear is taken from the notes as well as the index,
	 * because the notes are the authority and an index can be stale.
	 */
	async unlinkAllTasks(): Promise<number> {
		const index = await this.getResourceIndex();
		const paths = new Set(index.map((entry) => entry.path));

		for (const task of await this.plugin.cacheManager.getAllTasks()) {
			if (this.readFrontmatterAt(task.path)?.[CALDAV_FRONTMATTER_KEYS.uid]) {
				paths.add(task.path);
			}
		}

		let unlinked = 0;
		for (const path of paths) {
			try {
				await this.clearSyncMetadata(path);

				// Keep the fingerprint rather than forgetting it. Dropping it would
				// make the task look freshly edited, and push-on-change would
				// immediately re-upload it under a new UID — unlinking would undo
				// itself and leave a duplicate behind.
				const task = await this.plugin.cacheManager.getTaskInfo(path);
				if (task) await this.recordFingerprint(path, getCalDavRelevantFingerprint(task));

				unlinked++;
			} catch (error) {
				this.logError("Failed to unlink a task from CalDAV", error, {
					operation: "caldav-unlink-all",
					path,
				});
			}
		}

		await this.writeData(DATA_KEY_RESOURCE_INDEX, []);
		await this.writeData(DATA_KEY_COLLECTION_STATE, {});
		await this.writeData(DATA_KEY_SYNC_QUEUE, []);
		return unlinked;
	}

	// -----------------------------------------------------------------------
	// Retry queue
	// -----------------------------------------------------------------------

	/**
	 * Records a failed push so it is retried later.
	 *
	 * Queue writes are serialised through a promise chain because several pushes
	 * can fail in the same tick, and a plain read-modify-write would let the last
	 * one overwrite the others.
	 */
	private async enqueueRetry(accountId: string, path: string, error: unknown): Promise<void> {
		await this.mutateQueue((queue) => {
			const existing = queue.find(
				(entry) => entry.taskPath === path && entry.accountId === accountId
			);
			if (existing) {
				existing.lastError = describeError(error);
				return queue;
			}
			queue.push({
				taskPath: path,
				accountId,
				requestedAt: Date.now(),
				attempts: 0,
				lastError: describeError(error),
			});
			return queue;
		});
	}

	private scheduleRetryDrain(): void {
		if (this.destroyed || this.retryTimer !== null) return;
		this.retryTimer = window.setTimeout(() => {
			this.retryTimer = null;
			void this.drainRetryQueue().finally(() => this.scheduleRetryDrain());
		}, RETRY_QUEUE_INTERVAL_MS);
	}

	/** Retries every queued push once, dropping entries that keep failing. */
	async drainRetryQueue(): Promise<void> {
		if (this.destroyed || !this.isEnabled()) return;

		const queue = await this.getQueue();
		if (queue.length === 0) return;

		const remaining: PendingCalDavPush[] = [];
		for (const entry of queue) {
			const account = this.getAccount(entry.accountId);
			if (!account?.enabled) {
				// Hold rather than drop: the account may simply be switched off
				// for now, and the edit is still worth sending when it returns.
				remaining.push(entry);
				continue;
			}

			try {
				await this.pushTask(entry.accountId, entry.taskPath);
			} catch (error) {
				const attempts = entry.attempts + 1;
				if (attempts >= MAX_PUSH_ATTEMPTS) {
					this.logError("Giving up on a queued CalDAV push", error, {
						operation: "caldav-retry-exhausted",
						path: entry.taskPath,
						attempts,
					});
					continue;
				}
				remaining.push({
					...entry,
					attempts,
					lastAttemptAt: Date.now(),
					lastError: describeError(error),
				});
			}
		}

		await this.mutateQueue((current) =>
			// Anything enqueued while this drain was running is not in `queue`, so
			// keep it rather than overwriting with the snapshot we started from.
			[
				...remaining,
				...current.filter(
					(entry) =>
						!queue.some(
							(seen) =>
								seen.taskPath === entry.taskPath && seen.accountId === entry.accountId
						)
				),
			]
		);
	}

	private async getQueue(): Promise<PendingCalDavPush[]> {
		const data = await this.plugin.loadData();
		return (data?.[DATA_KEY_SYNC_QUEUE] as PendingCalDavPush[] | undefined) ?? [];
	}

	private async mutateQueue(
		mutation: (queue: PendingCalDavPush[]) => PendingCalDavPush[]
	): Promise<void> {
		const next = this.queueWrite.catch(() => undefined).then(async () => {
			const queue = await this.getQueue();
			await this.writeData(DATA_KEY_SYNC_QUEUE, mutation(queue));
		});
		this.queueWrite = next;
		await next;
	}

	// -----------------------------------------------------------------------
	// Relations
	// -----------------------------------------------------------------------

	/**
	 * Turns a task's vault-link relations into UID relations.
	 *
	 * TaskNotes addresses relations by path while CalDAV addresses them by UID,
	 * so a link can only be expressed once its target has been synced. A target
	 * without a UID is dropped rather than guessed at, and reported back so the
	 * caller can retry after the rest of the run has assigned UIDs.
	 */
	private resolveOutboundRelations(task: TaskInfo): {
		relations: VTodoRelations;
		unresolved: boolean;
	} {
		const parents: string[] = [];
		const dependencies: TaskDependency[] = [];
		let unresolved = false;

		for (const project of task.projects ?? []) {
			const uid = this.uidForLink(project, task.path);
			if (uid) parents.push(uid);
			else unresolved = true;
		}

		for (const dependency of task.blockedBy ?? []) {
			const resolution = resolveDependencyEntry(this.plugin.app, task.path, dependency);
			const uid = resolution?.path ? this.uidForPath(resolution.path) : undefined;
			if (uid) dependencies.push({ ...dependency, uid });
			else unresolved = true;
		}

		if (unresolved) {
			// Expected whenever a parent is a plain note, archived, or filtered
			// into another account — not a failure, so not a warning.
			this.logger.debug("Some relations have no CalDAV counterpart yet", {
				category: "provider",
				operation: "caldav-resolve-relations",
				details: { path: task.path },
			});
		}

		return { relations: { parents, dependencies }, unresolved };
	}

	/**
	 * Writes a remote VTODO's relations and reminders back onto a task.
	 *
	 * Both are non-destructive: a relation whose target is not in this vault, or
	 * an alarm list a foreign client stripped, must not erase what the vault
	 * already holds. Only resolved values are written.
	 */
	private async applyInboundRelations(
		account: CalDavAccountSettings,
		path: string,
		doc: VTodoDocument
	): Promise<void> {
		const { parents, dependencies } = readRelations(doc);
		const reminders = readReminders(doc);
		const task = await this.plugin.cacheManager.getTaskInfo(path);
		if (!task) return;

		const projects: string[] = [];
		for (const uid of parents) {
			const parentPath = await this.findPathForUid(account.id, uid);
			const file = parentPath ? this.getFile(parentPath) : null;
			if (file) projects.push(generateLink(this.plugin.app, file, path));
		}

		const blockedBy: TaskDependency[] = [];
		for (const dependency of dependencies) {
			const targetPath = await this.findPathForUid(account.id, dependency.uid);
			if (!targetPath) continue;
			blockedBy.push({
				...dependency,
				uid: formatDependencyLink(this.plugin.app, path, targetPath),
			});
		}

		const updates: Partial<TaskInfo> = {};
		if (parents.length > 0 && projects.length > 0) updates.projects = projects;
		if (dependencies.length > 0 && blockedBy.length > 0) updates.blockedBy = blockedBy;
		if (reminders.length > 0) updates.reminders = reminders;
		if (Object.keys(updates).length === 0) return;

		this.handlingPaths.add(path);
		try {
			await this.plugin.taskService.updateTask(task, updates);
		} finally {
			this.handlingPaths.delete(path);
		}
	}

	/** Re-pushes tasks whose relations could not be addressed on the first pass. */
	/**
	 * Applies the relations of freshly imported tasks.
	 *
	 * Deferred to the end of a run because a relation can only be written once
	 * both ends exist in the vault, and imports arrive in server order.
	 */
	private async flushInboundRelations(account: CalDavAccountSettings): Promise<void> {
		const pending = this.pendingInboundRelations;
		this.pendingInboundRelations = [];

		for (const entry of pending) {
			try {
				await this.applyInboundRelations(account, entry.path, entry.doc);
			} catch (error) {
				this.logError("Failed to apply imported relations", error, {
					operation: "caldav-flush-inbound-relations",
					path: entry.path,
				});
			}
		}
	}

	private async flushRelations(account: CalDavAccountSettings): Promise<void> {
		await this.flushInboundRelations(account);
		await this.flushPendingRelations(account.id);
	}

	/**
	 * Queues the deferred relation pass shortly after a push.
	 *
	 * Without this a new subtask shows no parent on the server until the next
	 * poll, which can be a quarter of an hour away.
	 */
	private scheduleRelationFlush(accountId: string): void {
		if (this.destroyed || this.relationFlushTimers.has(accountId)) return;

		const delay = (this.plugin.settings.caldav.pushDebounceMs ?? 1500) * 2;
		const timer = window.setTimeout(() => {
			this.relationFlushTimers.delete(accountId);
			void this.flushPendingRelations(accountId).catch((error: unknown) => {
				this.logError("Failed to replay deferred relations", error, {
					operation: "caldav-flush-relations",
				});
			});
		}, delay);
		this.relationFlushTimers.set(accountId, timer);
	}

	/** Re-pushes tasks whose relations could not be addressed on the first pass. */
	private async flushPendingRelations(accountId: string): Promise<void> {
		const paths = [...this.pendingRelationPaths];
		this.pendingRelationPaths.clear();
		if (paths.length === 0) return;

		// Exactly one extra pass: a parent that is still unaddressable is a plain
		// note or lives in another account, and retrying would never change that.
		this.flushingRelations = true;
		try {
			for (const path of paths) {
				try {
					await this.pushTask(accountId, path);
				} catch (error) {
					this.logError("Failed to push deferred relations", error, {
						operation: "caldav-flush-relations",
						path,
					});
				}
			}
		} finally {
			this.flushingRelations = false;
		}
	}

	private uidForLink(link: string, sourcePath: string): string | undefined {
		const linkPath = parseLinkToPath(link);
		if (!linkPath) return undefined;
		const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
		return file ? this.uidForPath(file.path) : undefined;
	}

	private uidForPath(path: string): string | undefined {
		const uid = this.readFrontmatterAt(path)?.[CALDAV_FRONTMATTER_KEYS.uid];
		return typeof uid === "string" && uid ? uid : undefined;
	}

	/** Applies the configured policy when a VTODO disappears from the server. */
	private async applyRemoteDeletion(
		account: CalDavAccountSettings,
		path: string
	): Promise<void> {
		const outcome = planRemoteDeletion(account.remoteDeletionPolicy);
		const task = await this.plugin.cacheManager.getTaskInfo(path);
		if (!task) return;

		this.handlingPaths.add(path);
		try {
			if (outcome.action === "delete") {
				await this.plugin.taskService.deleteTask(task);
				await this.forgetTask(path);
				return;
			}

			if (outcome.action === "archive" && !task.archived) {
				await this.plugin.taskService.toggleArchive(task);
			}
			if (outcome.stripSyncMetadata) {
				await this.clearSyncMetadata(path);
			}
			await this.forgetTask(path);
		} finally {
			this.handlingPaths.delete(path);
		}
	}

	// -----------------------------------------------------------------------
	// First sync
	// -----------------------------------------------------------------------

	/** Computes the first-sync plan without writing anything — the dry run. */
	async previewFirstSync(accountId: string): Promise<FirstSyncPlan> {
		const account = this.getAccount(accountId);
		if (!account) throw new Error(`Unknown CalDAV account ${accountId}`);

		const client = this.createClient(account);
		const resources = await client.fetchAllVTodos(account.collectionUrl);
		const remotes = resources
			.map((resource) => this.toRemoteSnapshot(resource.url, resource.etag, resource.data))
			.filter((snapshot): snapshot is RemoteSnapshotWithData => snapshot !== null);

		const locals = await this.snapshotAccountTasks(account);
		return planFirstSync(locals, remotes);
	}

	/** Applies a plan the user has confirmed. */
	async applyFirstSync(accountId: string, plan: FirstSyncPlan): Promise<void> {
		const account = this.getAccount(accountId);
		if (!account) return;

		for (const local of plan.toUpload) {
			await this.pushTask(accountId, local.path);
		}

		for (const remote of plan.toImport) {
			const withData = remote as RemoteSnapshotWithData;
			if (withData.data) await this.applyRemotePatch(account, undefined, withData);
		}

		for (const pair of plan.toLink) {
			await this.stampSyncMetadata(pair.local.path, {
				uid: pair.remote.uid,
				href: pair.remote.url,
				etag: pair.remote.etag,
				accountId: account.id,
			});
			await this.indexResource({
				accountId: account.id,
				uid: pair.remote.uid,
				path: pair.local.path,
				href: pair.remote.url,
			});
		}

		for (const pair of plan.toResolve) {
			if (pair.winner === "local") {
				await this.pushTask(accountId, pair.local.path);
			} else {
				const withData = pair.remote as RemoteSnapshotWithData;
				if (withData.data) {
					await this.applyRemotePatch(account, pair.local.path, withData);
				}
			}
		}

		// Only now does every task on both sides have both a path and a UID, so
		// this is the first point at which relations can be written at all.
		await this.flushRelations(account);

		const summary = summarizeFirstSyncPlan(plan);
		this.logger.info("Completed first CalDAV sync", {
			category: "provider",
			operation: "first-sync",
			details: { accountId, ...summary },
		});
	}

	// -----------------------------------------------------------------------
	// Snapshots and scope
	// -----------------------------------------------------------------------

	private async snapshotAccountTasks(
		account: CalDavAccountSettings
	): Promise<LocalTaskSnapshot[]> {
		const all = await this.plugin.cacheManager.getAllTasks();
		const scope = this.scopeFor(account);
		const context = this.filterContext();
		const snapshots: LocalTaskSnapshot[] = [];

		for (const task of all) {
			const file = this.getFile(task.path);
			if (!file) continue;

			const frontmatter = this.readFrontmatter(file);
			const ownedByAccount =
				asString(frontmatter?.[CALDAV_FRONTMATTER_KEYS.account]) === account.id;

			// A task already linked to this account stays in scope even if it no
			// longer matches the filter, so it can be unlinked deliberately rather
			// than silently stranded on the server.
			if (!ownedByAccount && !taskBelongsToCollection(task, scope, context)) continue;

			snapshots.push(await this.snapshotTask(task, file));
		}

		return snapshots;
	}

	private async snapshotTask(task: TaskInfo, file: TFile): Promise<LocalTaskSnapshot> {
		const frontmatter = this.readFrontmatter(file);
		const fingerprints = await this.getFingerprints();

		return {
			path: task.path,
			uid: asString(frontmatter?.[CALDAV_FRONTMATTER_KEYS.uid]),
			href: asString(frontmatter?.[CALDAV_FRONTMATTER_KEYS.href]),
			etag: asString(frontmatter?.[CALDAV_FRONTMATTER_KEYS.etag]),
			changedAtMs: await this.localChangedAtMs(task, file),
			syncedFingerprint: fingerprints[task.path],
			fingerprint: getCalDavRelevantFingerprint(task),
		};
	}

	/**
	 * `dateModified` is optional and user-renameable, so the file's mtime is the
	 * fallback for deciding which side of a conflict is newer.
	 */
	private async localChangedAtMs(task: TaskInfo, file: TFile): Promise<number | null> {
		if (task.dateModified) {
			const parsed = Date.parse(task.dateModified);
			if (!Number.isNaN(parsed)) return parsed;
		}
		return file.stat?.mtime ?? null;
	}

	private async resolveAccountForTask(
		task: TaskInfo
	): Promise<CalDavAccountSettings | undefined> {
		const owner = asString(
			this.readFrontmatterAt(task.path)?.[CALDAV_FRONTMATTER_KEYS.account]
		);
		if (owner) {
			const account = this.getAccount(owner);
			if (account?.enabled) return account;
		}

		const context = this.filterContext();
		return this.enabledAccounts().find((account) =>
			taskBelongsToCollection(task, this.scopeFor(account), context)
		);
	}

	private scopeFor(account: CalDavAccountSettings): CalDavCollectionScope {
		return { accountId: account.id, filter: account.filter };
	}

	private filterContext(): FilterPredicateEvaluationContext {
		const statusManager = this.plugin.statusManager;
		return {
			app: this.plugin.app,
			userFields: this.plugin.settings.userFields,
			getUserFieldRawValue: (task, fieldKey) =>
				(task as unknown as Record<string, unknown>)[fieldKey],
			getCompletedStatuses: () => statusManager.getCompletedStatuses(),
			isCompletedStatus: (status: string) => statusManager.isCompletedStatus(status),
		};
	}

	private mappingContext(account: CalDavAccountSettings): VTodoMappingContext {
		return {
			statuses: this.plugin.settings.customStatuses,
			priorities: this.plugin.settings.customPriorities,
			statusOverrides: account.statusOverrides,
		};
	}

	// -----------------------------------------------------------------------
	// Frontmatter
	// -----------------------------------------------------------------------

	private async stampSyncMetadata(
		path: string,
		metadata: { uid: string; href: string; etag?: string; accountId: string }
	): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;

		// processVaultFrontMatter already serializes per file; wrapping it in
		// withVaultFileMutation would deadlock on the same file's queue.
		await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
			frontmatter[CALDAV_FRONTMATTER_KEYS.uid] = metadata.uid;
			frontmatter[CALDAV_FRONTMATTER_KEYS.href] = metadata.href;
			frontmatter[CALDAV_FRONTMATTER_KEYS.account] = metadata.accountId;
			frontmatter[CALDAV_FRONTMATTER_KEYS.syncedAt] = new Date().toISOString();
			if (metadata.etag) {
				frontmatter[CALDAV_FRONTMATTER_KEYS.etag] = metadata.etag;
			} else {
				delete frontmatter[CALDAV_FRONTMATTER_KEYS.etag];
			}
		});

		// Record the fingerprint straight after, so the file-updated event this
		// write triggers is recognised as a no-op.
		const task = await this.plugin.cacheManager.getTaskInfo(path);
		if (task) await this.recordFingerprint(path, getCalDavRelevantFingerprint(task));
	}

	private async clearSyncMetadata(path: string): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;

		await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
			for (const key of Object.values(CALDAV_FRONTMATTER_KEYS)) {
				delete frontmatter[key];
			}
		});
	}

	private readFrontmatter(file: TFile): Record<string, unknown> | undefined {
		return this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
	}

	private readFrontmatterAt(path: string): Record<string, unknown> | undefined {
		const file = this.getFile(path);
		return file ? this.readFrontmatter(file) : undefined;
	}

	// Return type is inferred rather than annotated: the review-types stub
	// declares TFile as a value, so a written `TFile | null` reads as an error type.
	private getFile(path: string) {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : null;
	}

	// -----------------------------------------------------------------------
	// Persisted state
	// -----------------------------------------------------------------------

	private async getFingerprints(): Promise<Record<string, string>> {
		if (this.fingerprints) return this.fingerprints;
		const data = await this.plugin.loadData();
		this.fingerprints = (data?.[DATA_KEY_FINGERPRINTS] as Record<string, string>) ?? {};
		return this.fingerprints;
	}

	private async recordFingerprint(path: string, fingerprint: string): Promise<void> {
		const fingerprints = await this.getFingerprints();
		if (fingerprints[path] === fingerprint) return;

		fingerprints[path] = fingerprint;
		await this.writeData(DATA_KEY_FINGERPRINTS, fingerprints);
	}

	private async forgetTask(path: string): Promise<void> {
		const fingerprints = await this.getFingerprints();
		delete fingerprints[path];
		await this.writeData(DATA_KEY_FINGERPRINTS, fingerprints);

		const index = await this.getResourceIndex();
		const next = index.filter((entry) => entry.path !== path);
		if (next.length !== index.length) {
			await this.writeData(DATA_KEY_RESOURCE_INDEX, next);
		}
	}

	private async getResourceIndex(): Promise<CalDavResourceIndexEntry[]> {
		const data = await this.plugin.loadData();
		return (data?.[DATA_KEY_RESOURCE_INDEX] as CalDavResourceIndexEntry[]) ?? [];
	}

	private async indexResource(entry: CalDavResourceIndexEntry): Promise<void> {
		const index = await this.getResourceIndex();
		const filtered = index.filter(
			(existing) =>
				!(existing.accountId === entry.accountId && existing.uid === entry.uid) &&
				existing.path !== entry.path
		);
		filtered.push(entry);
		await this.writeData(DATA_KEY_RESOURCE_INDEX, filtered);
	}

	private async findPathForUid(
		accountId: string,
		uid: string
	): Promise<string | undefined> {
		const index = await this.getResourceIndex();
		const entry = index.find(
			(candidate) => candidate.accountId === accountId && candidate.uid === uid
		);
		if (entry && this.getFile(entry.path)) return entry.path;

		// The index can go stale when a task is renamed outside the plugin; fall
		// back to a scan rather than creating a duplicate.
		const all = await this.plugin.cacheManager.getAllTasks();
		for (const task of all) {
			const frontmatter = this.readFrontmatterAt(task.path);
			if (asString(frontmatter?.[CALDAV_FRONTMATTER_KEYS.uid]) === uid) {
				return task.path;
			}
		}
		return undefined;
	}

	private async getCollectionState(accountId: string): Promise<CalDavCollectionState> {
		const data = await this.plugin.loadData();
		const all = (data?.[DATA_KEY_COLLECTION_STATE] as
			| Record<string, CalDavCollectionState>
			| undefined) ?? {};
		return all[accountId] ?? {};
	}

	private async setCollectionState(
		accountId: string,
		state: CalDavCollectionState
	): Promise<void> {
		const data = await this.plugin.loadData();
		const all = (data?.[DATA_KEY_COLLECTION_STATE] as
			| Record<string, CalDavCollectionState>
			| undefined) ?? {};
		all[accountId] = state;
		await this.writeData(DATA_KEY_COLLECTION_STATE, all);
	}

	private async writeData(key: string, value: unknown): Promise<void> {
		// A null return means data.json exists but could not be read. Writing
		// anyway would persist a document built from nothing and wipe every
		// setting in the vault, so the only safe move is to skip this write.
		const data = await this.plugin.loadPluginDataForSafeWrite(`caldav-${key}`);
		if (!data) return;
		data[key] = value;
		await this.plugin.saveData(data);
	}

	// -----------------------------------------------------------------------
	// Timers and plumbing
	// -----------------------------------------------------------------------

	private startPollTimer(accountId: string): void {
		const account = this.getAccount(accountId);
		if (!account?.enabled || this.destroyed) return;

		const intervalMs = Math.max(1, account.syncIntervalMinutes) * 60 * 1000;
		const timer = window.setTimeout(() => {
			void this.syncAccount(accountId).finally(() => {
				if (!this.destroyed) this.startPollTimer(accountId);
			});
		}, intervalMs);

		this.pollTimers.set(accountId, timer);
	}

	private createClient(account: CalDavAccountSettings): CalDavClient {
		const credentials = this.secretStore.getCredentials(account.id);
		if (!credentials) {
			throw new CalDavError(
				"auth",
				`No stored credentials for CalDAV account ${account.name || account.id}`
			);
		}
		return new CalDavClient({
			serverUrl: account.serverUrl || account.collectionUrl,
			credentials,
			logger: this.logger,
		});
	}

	private toRemoteSnapshot(
		url: string,
		etag: string | undefined,
		data: string | undefined
	): RemoteSnapshotWithData | null {
		if (!data) return null;
		const doc = parseVTodoDocument(data);
		if (!doc) return null;
		const uid = readVTodoUid(doc);
		if (!uid) return null;

		return { uid, url, etag, revisionMs: readVTodoRevision(doc), data };
	}

	private reportSyncError(account: CalDavAccountSettings, error: unknown): void {
		const label = account.name || account.id;
		if (error instanceof CalDavError && error.kind === "auth") {
			publishUserNotice(
				this.plugin.emitter,
				`TaskNotes could not sign in to the CalDAV account "${label}". Check its username and password.`
			);
		}
		this.logError("CalDAV sync failed", error, {
			operation: "sync-account",
			accountId: account.id,
		});
	}

	private logError(
		message: string,
		error: unknown,
		context: { operation: string; [key: string]: unknown }
	): void {
		this.logger.error(message, {
			category: "provider",
			operation: context.operation,
			details: context,
			error,
		});
	}
}

interface RemoteSnapshotWithData extends RemoteTodoSnapshot {
	data: string;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * A short, loggable description of a failure.
 *
 * Deliberately the message only: CalDAV errors can carry request context, and
 * none of it belongs in a file that syncs around with the vault.
 */
function describeError(error: unknown): string {
	if (error instanceof CalDavError) return `${error.kind}: ${error.message}`;
	if (error instanceof Error) return error.message;
	return "Unknown error";
}

function joinUrl(base: string, segment: string): string {
	return `${base.replace(/\/+$/u, "")}/${segment}`;
}

/**
 * UIDs must be globally unique and stable for the life of the task. A random
 * v4-shaped id avoids leaking the vault path, which would otherwise be visible
 * to everyone the collection is shared with.
 */
function generateUid(): string {
	const random = window.crypto?.randomUUID?.();
	if (random) return `${random}@tasknotes`;

	const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return `${fallback}@tasknotes`;
}
