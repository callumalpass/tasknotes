/**
 * Conflict resolution and sync planning.
 *
 * The two mechanisms that decide what actually happens to a user's data live
 * here, deliberately separated from all I/O so they can be tested exhaustively:
 *
 *   - `resolveConflict` — ETag mismatch has already told us both sides changed;
 *     this decides which one wins.
 *   - `planFirstSync` / `planIncrementalSync` — what to upload, import, link or
 *     resolve. `planFirstSync` is also what the dry-run preview renders.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

import type { CalDavRemoteDeletionPolicy } from "../../types/settings";

export interface LocalTaskSnapshot {
	path: string;
	/** `caldav_uid`, absent until the task has been pushed once. */
	uid?: string;
	href?: string;
	etag?: string;
	/** Epoch ms of the last local edit (`dateModified`, or file mtime). */
	changedAtMs: number | null;
	/** Fingerprint recorded at the last successful sync. */
	syncedFingerprint?: string;
	/** Fingerprint of the task as it is now. */
	fingerprint: string;
}

export interface RemoteTodoSnapshot {
	uid: string;
	url: string;
	etag?: string;
	/** Epoch ms from LAST-MODIFIED or DTSTAMP. */
	revisionMs: number | null;
}

export type ConflictWinner = "local" | "remote";

export interface LinkedPair {
	local: LocalTaskSnapshot;
	remote: RemoteTodoSnapshot;
}

export interface ConflictPair extends LinkedPair {
	winner: ConflictWinner;
}

export interface FirstSyncPlan {
	/** Local tasks with no counterpart on the server. */
	toUpload: LocalTaskSnapshot[];
	/** Server VTODOs with no local task. */
	toImport: RemoteTodoSnapshot[];
	/** Matched by UID and already in agreement — just record href and ETag. */
	toLink: LinkedPair[];
	/** Matched by UID but differing; `winner` says which side is authoritative. */
	toResolve: ConflictPair[];
}

export interface IncrementalSyncPlan {
	/** Local edits to push. */
	toPush: LocalTaskSnapshot[];
	/** Remote changes to pull into tasks. */
	toPull: RemoteTodoSnapshot[];
	/** Both sides changed since the last sync. */
	conflicts: ConflictPair[];
	/** Tasks whose VTODO disappeared from the server. */
	remoteDeleted: LocalTaskSnapshot[];
}

/**
 * Decides which side wins once a conflict has been *detected* (by an ETag
 * mismatch — a timestamp alone can never tell you a conflict happened).
 *
 * Newest revision wins. Where a timestamp is missing the other side is
 * preferred, since a known edit time is better evidence than none. An exact tie
 * goes to the remote: every device sees the same server revision, so that
 * choice converges, whereas local clocks do not agree with each other.
 */
export function resolveConflict(
	localChangedAtMs: number | null,
	remoteRevisionMs: number | null
): ConflictWinner {
	if (localChangedAtMs === null && remoteRevisionMs === null) return "remote";
	if (localChangedAtMs === null) return "remote";
	if (remoteRevisionMs === null) return "local";
	return localChangedAtMs > remoteRevisionMs ? "local" : "remote";
}

/** True when the task has local edits that have not reached the server. */
export function hasUnsyncedLocalChange(local: LocalTaskSnapshot): boolean {
	return local.syncedFingerprint !== local.fingerprint;
}

/**
 * Reconciles a whole collection against the vault, keyed by UID.
 *
 * Matching is UID-only. Guessing at title or date similarity would silently
 * merge two unrelated tasks, and the cost of getting it wrong (a task
 * overwritten by another) is far higher than the cost of a duplicate.
 */
export function planFirstSync(
	locals: readonly LocalTaskSnapshot[],
	remotes: readonly RemoteTodoSnapshot[]
): FirstSyncPlan {
	const remotesByUid = new Map(remotes.map((remote) => [remote.uid, remote]));
	const matchedUids = new Set<string>();

	const plan: FirstSyncPlan = { toUpload: [], toImport: [], toLink: [], toResolve: [] };

	for (const local of locals) {
		const remote = local.uid ? remotesByUid.get(local.uid) : undefined;

		if (!remote) {
			plan.toUpload.push(local);
			continue;
		}

		matchedUids.add(remote.uid);

		// Already linked and unchanged since that link was made: nothing to do
		// beyond refreshing href and ETag.
		const linkedAndClean =
			local.etag !== undefined &&
			local.etag === remote.etag &&
			!hasUnsyncedLocalChange(local);

		if (linkedAndClean) {
			plan.toLink.push({ local, remote });
			continue;
		}

		plan.toResolve.push({
			local,
			remote,
			winner: resolveConflict(local.changedAtMs, remote.revisionMs),
		});
	}

	for (const remote of remotes) {
		if (!matchedUids.has(remote.uid)) plan.toImport.push(remote);
	}

	return plan;
}

/**
 * Plans one polling pass.
 *
 * `changedRemotes` are the resources the server reported as new or modified;
 * `removedUrls` are the ones it reported as gone. When the server has no
 * sync-collection support the caller supplies a full listing instead and sets
 * `remotesAreComplete`, which is what makes deletion detection possible — a
 * task whose href is absent from a complete listing has been deleted.
 */
export function planIncrementalSync(
	locals: readonly LocalTaskSnapshot[],
	changedRemotes: readonly RemoteTodoSnapshot[],
	options: {
		removedUrls?: readonly string[];
		remotesAreComplete?: boolean;
	} = {}
): IncrementalSyncPlan {
	const plan: IncrementalSyncPlan = {
		toPush: [],
		toPull: [],
		conflicts: [],
		remoteDeleted: [],
	};

	const remotesByUid = new Map(changedRemotes.map((remote) => [remote.uid, remote]));
	const removed = new Set(options.removedUrls ?? []);
	const presentUrls = new Set(changedRemotes.map((remote) => normalizeUrl(remote.url)));

	for (const local of locals) {
		const localChanged = hasUnsyncedLocalChange(local);

		// Never pushed: a straightforward upload.
		if (!local.uid) {
			if (localChanged) plan.toPush.push(local);
			continue;
		}

		const isRemoteDeleted =
			(local.href && removed.has(local.href)) ||
			(options.remotesAreComplete === true &&
				local.href !== undefined &&
				!presentUrls.has(normalizeUrl(local.href)));

		if (isRemoteDeleted) {
			plan.remoteDeleted.push(local);
			continue;
		}

		const remote = remotesByUid.get(local.uid);
		if (!remote) {
			// The server did not report this one as changed, so only a local edit
			// could be outstanding.
			if (localChanged) plan.toPush.push(local);
			continue;
		}

		// The server reported a change. If the ETag still matches what we stored,
		// the "change" is our own write echoing back.
		const remoteChanged = local.etag === undefined || local.etag !== remote.etag;

		if (remoteChanged && localChanged) {
			plan.conflicts.push({
				local,
				remote,
				winner: resolveConflict(local.changedAtMs, remote.revisionMs),
			});
			continue;
		}
		if (remoteChanged) {
			plan.toPull.push(remote);
			continue;
		}
		if (localChanged) plan.toPush.push(local);
	}

	// Remote resources with no local task at all are new arrivals to import.
	const knownUids = new Set(locals.map((local) => local.uid).filter(Boolean));
	for (const remote of changedRemotes) {
		if (!knownUids.has(remote.uid)) plan.toPull.push(remote);
	}

	return plan;
}

export interface RemoteDeletionOutcome {
	action: "archive" | "delete" | "unlink";
	/** Whether the CalDAV frontmatter keys should be stripped from the note. */
	stripSyncMetadata: boolean;
}

/**
 * Maps the configured policy onto what actually happens to the note.
 *
 * Archiving and unlinking both strip the sync metadata, so the task is not
 * re-uploaded on the next pass and resurrected on the server.
 */
export function planRemoteDeletion(
	policy: CalDavRemoteDeletionPolicy
): RemoteDeletionOutcome {
	switch (policy) {
		case "delete":
			return { action: "delete", stripSyncMetadata: false };
		case "unlink":
			return { action: "unlink", stripSyncMetadata: true };
		case "archive":
		default:
			return { action: "archive", stripSyncMetadata: true };
	}
}

/** Human-readable counts for the first-sync preview. */
export function summarizeFirstSyncPlan(plan: FirstSyncPlan): {
	upload: number;
	import: number;
	link: number;
	resolve: number;
	total: number;
} {
	const upload = plan.toUpload.length;
	const importCount = plan.toImport.length;
	const link = plan.toLink.length;
	const resolve = plan.toResolve.length;
	return {
		upload,
		import: importCount,
		link,
		resolve,
		total: upload + importCount + link + resolve,
	};
}

function normalizeUrl(url: string): string {
	return url.replace(/\/+$/u, "");
}
