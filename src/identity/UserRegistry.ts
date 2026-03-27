/**
 * UserRegistry - Maps devices to user notes in the vault
 *
 * Enables automatic attribution of tasks to users in shared vaults.
 * Each device can be registered to a person note, and when tasks are created,
 * the creator field is automatically populated.
 *
 * Storage:
 * - Device→User mappings are stored in plugin settings (synced with vault)
 * - Device IDs are stored in localStorage (not synced, device-specific)
 */

import type TaskNotesPlugin from "../main";
import type { DeviceIdentityManager } from "./DeviceIdentityManager";
import type { DeviceUserMapping } from "../types/settings";

// Re-export the type for convenience
export type { DeviceUserMapping } from "../types/settings";

/**
 * Settings interface for device-user mappings.
 * These fields are included in TaskNotesSettings.
 */
export interface DeviceUserSettings {
	/** All known device→user mappings */
	deviceUserMappings: DeviceUserMapping[];
	/** Whether to auto-set creator when creating tasks */
	autoSetCreator: boolean;
	/** Field to use for creator (e.g., "creator", "assignee", "owner") */
	creatorFieldName: string;
}

/**
 * Default settings for device-user functionality.
 */
export const DEFAULT_DEVICE_USER_SETTINGS: DeviceUserSettings = {
	deviceUserMappings: [],
	autoSetCreator: true,
	creatorFieldName: "creator",
};

export class UserRegistry {
	private plugin: TaskNotesPlugin;
	private deviceManager: DeviceIdentityManager;

	constructor(plugin: TaskNotesPlugin, deviceManager: DeviceIdentityManager) {
		this.plugin = plugin;
		this.deviceManager = deviceManager;
	}

	/**
	 * Get the user note path for the current device.
	 * Returns null if this device is not registered to a user.
	 */
	getCurrentUser(): string | null {
		const deviceId = this.deviceManager.getOrCreateDeviceId();
		const mapping = this.findMappingByDeviceId(deviceId);
		return mapping?.userNotePath || null;
	}

	/**
	 * Get the user display name for the current device.
	 * Returns null if this device is not registered to a user.
	 */
	getCurrentUserDisplayName(): string | null {
		const deviceId = this.deviceManager.getOrCreateDeviceId();
		const mapping = this.findMappingByDeviceId(deviceId);
		if (!mapping) return null;

		// Prefer display name if set, otherwise derive from path
		if (mapping.userDisplayName) {
			return mapping.userDisplayName;
		}

		// Derive from file path (remove .md and folder)
		const filename = mapping.userNotePath.split("/").pop() || "";
		return filename.replace(/\.md$/, "");
	}

	/**
	 * Get the full mapping for the current device.
	 */
	getCurrentMapping(): DeviceUserMapping | null {
		const deviceId = this.deviceManager.getOrCreateDeviceId();
		return this.findMappingByDeviceId(deviceId) || null;
	}

	/**
	 * Register the current device to a user note.
	 * Creates or updates the mapping in settings.
	 */
	async registerDevice(userNotePath: string, userDisplayName?: string): Promise<void> {
		const deviceId = this.deviceManager.getOrCreateDeviceId();
		const deviceName = this.deviceManager.getDeviceName();

		const settings = this.getSettings();
		const existingIndex = settings.deviceUserMappings.findIndex(
			(m) => m.deviceId === deviceId
		);

		const mapping: DeviceUserMapping = {
			deviceId,
			userNotePath,
			deviceName,
			lastSeen: Date.now(),
			userDisplayName,
		};

		if (existingIndex >= 0) {
			// Update existing mapping
			settings.deviceUserMappings[existingIndex] = mapping;
		} else {
			// Add new mapping
			settings.deviceUserMappings.push(mapping);
		}

		await this.saveSettings(settings);
	}

	/**
	 * Unregister the current device.
	 * Removes the device→user mapping.
	 */
	async unregisterDevice(): Promise<void> {
		const deviceId = this.deviceManager.getOrCreateDeviceId();
		const settings = this.getSettings();

		settings.deviceUserMappings = settings.deviceUserMappings.filter(
			(m) => m.deviceId !== deviceId
		);

		await this.saveSettings(settings);
	}

	/**
	 * Update the last seen timestamp for the current device.
	 * Called when the user is active.
	 */
	async updateLastSeen(): Promise<void> {
		const deviceId = this.deviceManager.getOrCreateDeviceId();
		const settings = this.getSettings();

		const mapping = settings.deviceUserMappings.find((m) => m.deviceId === deviceId);
		if (mapping) {
			mapping.lastSeen = Date.now();
			mapping.deviceName = this.deviceManager.getDeviceName(); // Update device name too
			await this.saveSettings(settings);
		}
	}

	/**
	 * Update a device mapping with partial data.
	 * Used for updating display name, avatar color, etc.
	 */
	async updateMapping(
		deviceId: string,
		updates: Partial<Pick<DeviceUserMapping, "userDisplayName" | "avatarColor">>
	): Promise<void> {
		const settings = this.getSettings();
		const mapping = settings.deviceUserMappings.find((m) => m.deviceId === deviceId);

		if (mapping) {
			if (updates.userDisplayName !== undefined) {
				mapping.userDisplayName = updates.userDisplayName || undefined;
			}
			if (updates.avatarColor !== undefined) {
				mapping.avatarColor = updates.avatarColor || undefined;
			}
			mapping.lastSeen = Date.now();
			await this.saveSettings(settings);
		}
	}

	/**
	 * Get all registered device→user mappings.
	 */
	getAllMappings(): DeviceUserMapping[] {
		return [...this.getSettings().deviceUserMappings];
	}

	/**
	 * Remove a specific device mapping by device ID.
	 */
	async removeMappingByDeviceId(deviceId: string): Promise<void> {
		const settings = this.getSettings();
		settings.deviceUserMappings = settings.deviceUserMappings.filter(
			(m) => m.deviceId !== deviceId
		);
		await this.saveSettings(settings);
	}

	/**
	 * Check if the current device is registered to a user.
	 */
	isDeviceRegistered(): boolean {
		return this.getCurrentUser() !== null;
	}

	/**
	 * Check if auto-set creator is enabled.
	 */
	shouldAutoSetCreator(): boolean {
		return this.getSettings().autoSetCreator;
	}

	/**
	 * Get the field name to use for creator.
	 */
	getCreatorFieldName(): string {
		return this.getSettings().creatorFieldName || "creator";
	}

	/**
	 * Format a user note path as a wikilink.
	 */
	formatUserAsWikilink(userNotePath: string): string {
		// Remove .md extension and folder path for the link text
		const filename = userNotePath.split("/").pop() || userNotePath;
		const linkText = filename.replace(/\.md$/, "");
		return `[[${linkText}]]`;
	}

	/**
	 * Get the creator value to use for new tasks.
	 * Returns null if auto-set is disabled or device is not registered.
	 */
	getCreatorValueForNewTask(): string | null {
		if (!this.shouldAutoSetCreator()) {
			return null;
		}

		const userPath = this.getCurrentUser();
		if (!userPath) {
			return null;
		}

		return this.formatUserAsWikilink(userPath);
	}

	// Private helper methods

	private findMappingByDeviceId(deviceId: string): DeviceUserMapping | undefined {
		return this.getSettings().deviceUserMappings.find((m) => m.deviceId === deviceId);
	}

	private getSettings(): DeviceUserSettings {
		// Access settings from plugin
		// This assumes deviceUserSettings is added to the main settings
		const pluginSettings = this.plugin.settings as any;
		return {
			deviceUserMappings: pluginSettings.deviceUserMappings || [],
			autoSetCreator:
				pluginSettings.autoSetCreator ?? DEFAULT_DEVICE_USER_SETTINGS.autoSetCreator,
			creatorFieldName:
				pluginSettings.creatorFieldName || DEFAULT_DEVICE_USER_SETTINGS.creatorFieldName,
		};
	}

	private async saveSettings(settings: DeviceUserSettings): Promise<void> {
		// Merge into plugin settings and save
		const pluginSettings = this.plugin.settings as any;
		pluginSettings.deviceUserMappings = settings.deviceUserMappings;
		pluginSettings.autoSetCreator = settings.autoSetCreator;
		pluginSettings.creatorFieldName = settings.creatorFieldName;
		await this.plugin.saveSettings();
	}
}
