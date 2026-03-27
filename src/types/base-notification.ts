/**
 * Types for the Base Notification Sync Service.
 *
 * This system creates real TaskNote files for notification-enabled bases,
 * making them fully compatible with Bases filtering (the default mode).
 */

/**
 * Data model mode for base notifications.
 * - sync-to-files: Create real TaskNote files (default, Bases-compatible)
 * - synthetic: Virtual items only (experimental, not filterable)
 * - hybrid: Individual items as files + synthetic summary (experimental)
 */
export type BaseNotificationMode = 'sync-to-files' | 'synthetic' | 'hybrid';

/**
 * Behavior when a notification-enabled base has no matching items.
 * - complete: Mark the notification task as complete
 * - delete: Delete the notification task file
 * - keep: Leave as-is (manual cleanup required)
 */
export type EmptyBaseBehavior = 'complete' | 'delete' | 'keep';

/**
 * Settings for the Base Notification Sync Service.
 */
export interface BaseNotificationSyncSettings {
	/** Whether sync service is enabled */
	enabled: boolean;
	/** Data model mode */
	mode: BaseNotificationMode;
	/** Folder to store notification task files (relative to vault root) */
	notificationTaskFolder: string;
	/** What to do when base has no matching items */
	onEmptyBase: EmptyBaseBehavior;
	/** Frontmatter type value for notification tasks */
	notificationTaskType: string;
	/** Sync interval in minutes (0 = only on-demand) */
	syncIntervalMinutes: number;
}

/**
 * Default settings for Base Notification Sync.
 */
export const DEFAULT_BASE_NOTIFICATION_SYNC_SETTINGS: BaseNotificationSyncSettings = {
	enabled: true,
	mode: 'sync-to-files',
	notificationTaskFolder: 'TaskNotes/Base Notifications',
	onEmptyBase: 'complete',
	notificationTaskType: 'base-notification',
	syncIntervalMinutes: 5,
};

/**
 * Frontmatter structure for a base notification TaskNote.
 * These are real markdown files that represent notification-enabled bases.
 */
export interface BaseNotificationTaskFrontmatter {
	/** Must be true for TaskNotes to recognize it */
	isTask: true;
	/** Distinguishes from regular tasks */
	type: 'base-notification';
	/** Display name for the notification */
	title: string;
	/** Link to the source .base file */
	sourceBase: string;
	/** Number of items currently matching the base's filter */
	matchCount: number;
	/** When items first appeared in the base (ISO date string) */
	firstItemAppearedAt: string;
	/** Calculated due date based on base's notify configuration */
	due?: string;
	/** Scheduled date (typically same as firstItemAppearedAt) */
	scheduled?: string;
	/** Task status */
	status: 'pending' | 'complete' | 'archived';
	/** When the notification task was last synced (ISO timestamp) */
	lastSyncedAt: string;
	/** Optional: notification mode from the base */
	notifyMode?: 'simple' | 'item-based';
}

/**
 * Metadata about a monitored base for sync purposes.
 */
export interface SyncedBaseInfo {
	/** Path to the .base file */
	basePath: string;
	/** Display name */
	baseName: string;
	/** Path to the corresponding notification task file (if exists) */
	notificationTaskPath?: string;
	/** Current match count from last evaluation */
	matchCount: number;
	/** When items first appeared */
	firstItemAppearedAt?: string;
	/** Last sync timestamp */
	lastSyncedAt?: string;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
	/** Number of notification tasks created */
	created: number;
	/** Number of notification tasks updated */
	updated: number;
	/** Number of notification tasks completed (when bases became empty) */
	completed: number;
	/** Number of notification tasks deleted (based on settings) */
	deleted: number;
	/** Errors encountered during sync */
	errors: Array<{ basePath: string; error: string }>;
}

/**
 * Creates a wikilink to a file path.
 */
export function createWikilink(path: string): string {
	// Remove .md extension if present for cleaner links
	const linkPath = path.endsWith('.md') ? path.slice(0, -3) : path;
	return `[[${linkPath}]]`;
}

/**
 * Sanitizes a base name for use in a filename.
 * Replaces problematic characters with hyphens.
 */
export function sanitizeForFilename(name: string): string {
	return name
		.toLowerCase()
		.replace(/[<>:"/\\|?*#[\]]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.trim() || 'untitled';
}

/**
 * Generates the notification task filename from a base name.
 */
export function generateNotificationTaskFilename(baseName: string): string {
	return `${sanitizeForFilename(baseName)}-notification.md`;
}

/**
 * Generates the full path for a notification task file.
 */
export function generateNotificationTaskPath(folder: string, baseName: string): string {
	const filename = generateNotificationTaskFilename(baseName);
	return `${folder}/${filename}`;
}
