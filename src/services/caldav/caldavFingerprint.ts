/**
 * Content fingerprints for CalDAV sync.
 *
 * These are what break the write-back loop. Stamping `caldav_etag` into a
 * task's frontmatter re-fires the same `file-updated` event that triggers a
 * sync, and there is no event-suppression flag anywhere in the plugin. The
 * Google integration solves this structurally — its fingerprint covers only
 * user-visible content, so a sync-metadata write produces an identical
 * fingerprint and the handler returns early (see
 * `getCalendarRelevantFingerprint` in TaskCalendarSyncService.ts:517).
 *
 * The same rule applies here: every `caldav_*` key is excluded by construction.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

import type { TaskInfo } from "../../types";

/**
 * Frontmatter keys owned by the CalDAV integration.
 *
 * Fixed names rather than `FieldMapper` entries: `DEFAULT_FIELD_MAPPING` and
 * the frontmatter mappers ship from the external `@tasknotes/model` package,
 * which this repo cannot extend, so these are read and written directly.
 */
export const CALDAV_FRONTMATTER_KEYS = {
	uid: "caldav_uid",
	href: "caldav_href",
	etag: "caldav_etag",
	syncedAt: "caldav_synced_at",
	account: "caldav_account",
} as const;

export const CALDAV_FRONTMATTER_KEY_LIST: readonly string[] = Object.values(
	CALDAV_FRONTMATTER_KEYS
);

/** The task fields a VTODO can carry — and therefore the ones worth syncing on. */
export interface CalDavFingerprintState {
	title?: string;
	status?: string;
	priority?: string;
	due?: string;
	scheduled?: string;
	completedDate?: string;
	recurrence?: string;
	archived?: boolean;
	tags?: string[];
	/** Parent links, as RELATED-TO;RELTYPE=PARENT. */
	projects?: string[];
	/** Dependencies, as RELATED-TO with an RFC 9253 temporal reltype. */
	blockedBy?: string[];
	/** Reminders, as VALARM. */
	reminders?: string[];
}

/**
 * A stable JSON fingerprint of the sync-relevant content of a task.
 *
 * Deliberately excluded: every `caldav_*` key, `dateModified`, the note body,
 * time entries, and anything else a VTODO cannot represent — so that writing
 * sync metadata, or tracking time, never triggers a redundant remote write.
 *
 * `blocking` and `hasSubtasks` are excluded too: both are derived from other
 * tasks' frontmatter, so including them would make an edit to one task look
 * like an edit to all its neighbours.
 */
export function getCalDavRelevantFingerprint(task: TaskInfo): string {
	const state: CalDavFingerprintState = {
		title: task.title,
		status: task.status,
		priority: task.priority,
		due: task.due,
		scheduled: task.scheduled,
		completedDate: task.completedDate,
		recurrence: task.recurrence,
		archived: task.archived,
		// Sorted so that a reordered tag list is not mistaken for an edit.
		tags: task.tags ? [...task.tags].sort() : undefined,
		projects: task.projects ? [...task.projects].sort() : undefined,
		// Flattened rather than kept as objects so the fingerprint stays a stable
		// string regardless of key order, and so an added GAP still registers.
		blockedBy: task.blockedBy
			? task.blockedBy
					.map((dependency) =>
						[dependency.uid, dependency.reltype, dependency.gap ?? ""].join("|")
					)
					.sort()
			: undefined,
		reminders: task.reminders
			? task.reminders
					.map((reminder) =>
						[
							reminder.id,
							reminder.type,
							reminder.relatedTo ?? "",
							reminder.offset ?? "",
							reminder.absoluteTime ?? "",
							reminder.description ?? "",
						].join("|")
					)
					.sort()
			: undefined,
	};
	return JSON.stringify(state);
}

/**
 * Rehydrates the previous state of a task from a stored fingerprint, so an
 * edit made while Obsidian was closed can be diffed at startup. Mirrors
 * `getTaskStateFromFingerprint` in the Google sync service.
 */
export function parseCalDavFingerprint(
	fingerprint: string | undefined
): CalDavFingerprintState | null {
	if (!fingerprint) return null;
	try {
		const parsed: unknown = JSON.parse(fingerprint);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
		return parsed;
	} catch {
		// A corrupt fingerprint is treated as "no previous state", which makes the
		// task look new and re-syncs it — safe, if slightly wasteful.
		return null;
	}
}

/** True when the sync-relevant content of a task differs from a stored fingerprint. */
export function hasCalDavRelevantChange(
	task: TaskInfo,
	previousFingerprint: string | undefined
): boolean {
	if (!previousFingerprint) return true;
	return getCalDavRelevantFingerprint(task) !== previousFingerprint;
}
