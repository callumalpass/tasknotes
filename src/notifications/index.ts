/**
 * Bases Query Notifications Module
 *
 * Provides event-driven background monitoring for Bases queries,
 * with rich notification modals for user interaction.
 */

export { BasesQueryWatcher } from "./BasesQueryWatcher";
export { VaultWideNotificationService } from "./VaultWideNotificationService";
export { NotificationCache } from "./NotificationCache";
export {
	BasesNotificationModal,
	type NotificationItem,
	type BasesNotificationModalOptions,
} from "../modals/BasesNotificationModal";
export { ToastNotification, type ToastConfig } from "./ToastNotification";
export { BaseNotificationSyncService } from "./BaseNotificationSyncService";
export {
	type BaseNotificationSyncSettings,
	type BaseNotificationTaskFrontmatter,
	type SyncedBaseInfo,
	type SyncResult,
	type BaseNotificationMode,
	type EmptyBaseBehavior,
	DEFAULT_BASE_NOTIFICATION_SYNC_SETTINGS,
} from "../types/base-notification";
