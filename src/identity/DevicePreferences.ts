/**
 * DevicePreferencesManager - Per-device settings stored in localStorage
 *
 * In shared vaults, `data.json` syncs across devices. Settings that should
 * differ per device (notification type, scope, check interval) are stored
 * here in localStorage instead, using a resolution pattern:
 *
 *   effective value = device override ?? vault-wide setting ?? hardcoded default
 *
 * This means vault-wide settings act as team defaults that any device can override.
 */

import type TaskNotesPlugin from "../main";

/**
 * Notification scope preferences — controls what notifications this device receives.
 */
export interface NotificationScopePrefs {
	/** Filter notifications to only tasks assigned to current user (Phase 1) */
	filterByAssignment?: boolean;
	/** When filtering, also include tasks with no assignee */
	includeUnassignedTasks?: boolean;
}

/**
 * Per-device preferences stored in localStorage.
 * All fields are optional — undefined means "use vault-wide default".
 *
 * Pattern: device override → vault-wide setting → hardcoded default
 *
 * Future: This could expand to include many more view-specific and
 * user-preference settings. See roadmap for "Per-Device Settings Architecture".
 */
export interface DevicePreferences {
	/** Override vault-wide notification type */
	notificationType?: "in-app" | "system" | "both";
	/** Override vault-wide enable/disable notifications */
	enableNotifications?: boolean;
	/** Override vault-wide check interval (minutes) */
	checkInterval?: number;
	/** Notification scope (per-device) */
	notificationScope?: NotificationScopePrefs;

	// ── View Preferences ──────────────────────────────────
	/** Upcoming View default period (Y/M/W/3D/D/L) */
	upcomingViewPeriod?: "year" | "month" | "week" | "3day" | "day" | "list";
	/** Toast display mode for base notifications */
	baseNotificationDisplay?: "individual" | "rollup";

	/** Toast click behavior: "view" = click opens Upcoming, "expand" = click expands items */
	toastClickBehavior?: "view" | "expand";

	/** Status bar click behavior: "view" = opens Upcoming, "toast" = shows/toggles toast */
	statusBarClickBehavior?: "view" | "toast";
}

export class DevicePreferencesManager {
	private static readonly STORAGE_KEY = "tasknotes-device-prefs";

	private plugin: TaskNotesPlugin;
	private prefs: DevicePreferences;

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
		this.prefs = this.load();
	}

	// ── Persistence ────────────────────────────────────

	private load(): DevicePreferences {
		try {
			const raw = localStorage.getItem(DevicePreferencesManager.STORAGE_KEY);
			if (raw) {
				return JSON.parse(raw) as DevicePreferences;
			}
		} catch {
			// Corrupted data — start fresh
		}
		return {};
	}

	private save(): void {
		try {
			localStorage.setItem(
				DevicePreferencesManager.STORAGE_KEY,
				JSON.stringify(this.prefs)
			);
		} catch {
			// localStorage full or unavailable — silent fail
		}
	}

	// ── Raw access ─────────────────────────────────────

	/** Get the raw device preferences (for settings UI) */
	getRaw(): DevicePreferences {
		return { ...this.prefs };
	}

	/** Update one or more device preferences */
	update(partial: Partial<DevicePreferences>): void {
		this.prefs = { ...this.prefs, ...partial };
		this.save();
	}

	/** Update notification scope preferences */
	updateScope(partial: Partial<NotificationScopePrefs>): void {
		this.prefs.notificationScope = {
			...this.prefs.notificationScope,
			...partial,
		};
		this.save();
	}

	/** Clear a specific device override (reverts to vault default) */
	clearOverride(key: keyof DevicePreferences): void {
		delete this.prefs[key];
		this.save();
	}

	/** Clear all device preferences (revert everything to vault defaults) */
	clearAll(): void {
		this.prefs = {};
		this.save();
	}

	// ── Resolved getters (device override → vault default → hardcoded) ──

	/** Get effective notification type for this device */
	getNotificationType(): "in-app" | "system" | "both" {
		return this.prefs.notificationType
			?? this.plugin.settings.notificationType
			?? "in-app";
	}

	/** Whether this device override is active for notification type */
	hasNotificationTypeOverride(): boolean {
		return this.prefs.notificationType !== undefined;
	}

	/** Get effective enable/disable notifications for this device */
	getEnableNotifications(): boolean {
		return this.prefs.enableNotifications
			?? this.plugin.settings.enableNotifications
			?? true;
	}

	/** Whether this device override is active for enable notifications */
	hasEnableNotificationsOverride(): boolean {
		return this.prefs.enableNotifications !== undefined;
	}

	/** Get effective check interval for this device (minutes) */
	getCheckInterval(): number {
		return this.prefs.checkInterval
			?? this.plugin.settings.vaultWideNotifications?.checkInterval
			?? 5;
	}

	/** Whether this device override is active for check interval */
	hasCheckIntervalOverride(): boolean {
		return this.prefs.checkInterval !== undefined;
	}

	/** Get effective "filter by assignment" for this device */
	getFilterByAssignment(): boolean {
		return this.prefs.notificationScope?.filterByAssignment
			?? this.plugin.settings.vaultWideNotifications?.onlyNotifyIfAssignedToMe
			?? false;
	}

	/** Whether this device has a scope override */
	hasFilterByAssignmentOverride(): boolean {
		return this.prefs.notificationScope?.filterByAssignment !== undefined;
	}

	/** Get effective "include unassigned tasks" for this device */
	getIncludeUnassignedTasks(): boolean {
		return this.prefs.notificationScope?.includeUnassignedTasks
			?? this.plugin.settings.vaultWideNotifications?.notifyForUnassignedTasks
			?? true;
	}

	/** Whether this device has an unassigned override */
	hasIncludeUnassignedTasksOverride(): boolean {
		return this.prefs.notificationScope?.includeUnassignedTasks !== undefined;
	}

	// ── View Preferences ─────────────────────────────────

	/** Get effective Upcoming View period for this device */
	getUpcomingViewPeriod(): "year" | "month" | "week" | "3day" | "day" | "list" {
		return this.prefs.upcomingViewPeriod ?? "list"; // Hardcoded default
	}

	/** Whether this device has an Upcoming View period override */
	hasUpcomingViewPeriodOverride(): boolean {
		return this.prefs.upcomingViewPeriod !== undefined;
	}

	/** Set Upcoming View period for this device */
	setUpcomingViewPeriod(period: "year" | "month" | "week" | "3day" | "day" | "list"): void {
		this.prefs.upcomingViewPeriod = period;
		this.save();
	}

	/** Get effective base notification display mode for this device */
	getBaseNotificationDisplay(): "individual" | "rollup" {
		return this.prefs.baseNotificationDisplay
			?? this.plugin.settings.vaultWideNotifications?.baseNotificationDisplay
			?? "individual";
	}

	/** Whether this device has a base notification display override */
	hasBaseNotificationDisplayOverride(): boolean {
		return this.prefs.baseNotificationDisplay !== undefined;
	}

	/** Set base notification display mode for this device */
	setBaseNotificationDisplay(mode: "individual" | "rollup"): void {
		this.prefs.baseNotificationDisplay = mode;
		this.save();
	}

	// ── Toast Preferences ─────────────────────────────────

	/** Get effective toast click behavior for this device */
	getToastClickBehavior(): "view" | "expand" {
		return this.prefs.toastClickBehavior ?? "view"; // Default: click opens Upcoming View
	}

	/** Whether this device has a toast click behavior override */
	hasToastClickBehaviorOverride(): boolean {
		return this.prefs.toastClickBehavior !== undefined;
	}

	/** Set toast click behavior for this device */
	setToastClickBehavior(behavior: "view" | "expand"): void {
		this.prefs.toastClickBehavior = behavior;
		this.save();
	}

	/** Get effective status bar click behavior for this device */
	getStatusBarClickBehavior(): "view" | "toast" {
		return this.prefs.statusBarClickBehavior ?? "view"; // Default: click opens Upcoming View
	}

	/** Whether this device has a status bar click behavior override */
	hasStatusBarClickBehaviorOverride(): boolean {
		return this.prefs.statusBarClickBehavior !== undefined;
	}

	/** Set status bar click behavior for this device */
	setStatusBarClickBehavior(behavior: "view" | "toast"): void {
		this.prefs.statusBarClickBehavior = behavior;
		this.save();
	}
}
