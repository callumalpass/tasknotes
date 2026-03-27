/**
 * DeviceIdentityManager - Manages unique device identification
 *
 * Generates and persists a unique UUID for this device using localStorage.
 * This ID is used to map devices to users in shared vaults.
 *
 * IMPORTANT: The device ID is stored in localStorage, which:
 * - Does NOT sync across devices (each device has its own)
 * - Persists across Obsidian restarts
 * - Is specific to the Obsidian app (not shared with browsers)
 */
export class DeviceIdentityManager {
	private static readonly STORAGE_KEY = "tasknotes-device-id";
	private static readonly DEVICE_NAME_KEY = "tasknotes-device-name";

	private cachedDeviceId: string | null = null;

	/**
	 * Get or create a unique device ID.
	 * Uses localStorage for persistence across sessions.
	 */
	getOrCreateDeviceId(): string {
		// Return cached value if available
		if (this.cachedDeviceId) {
			return this.cachedDeviceId;
		}

		// Try to get existing ID from localStorage
		let deviceId = localStorage.getItem(DeviceIdentityManager.STORAGE_KEY);

		if (!deviceId) {
			// Generate new UUID
			deviceId = this.generateUUID();
			localStorage.setItem(DeviceIdentityManager.STORAGE_KEY, deviceId);
		}

		this.cachedDeviceId = deviceId;
		return deviceId;
	}

	/**
	 * Get the current device ID without creating one if it doesn't exist.
	 */
	getDeviceId(): string | null {
		if (this.cachedDeviceId) {
			return this.cachedDeviceId;
		}
		return localStorage.getItem(DeviceIdentityManager.STORAGE_KEY);
	}

	/**
	 * Get a human-readable device name.
	 * Returns custom name if set, otherwise derives from platform info.
	 */
	getDeviceName(): string {
		// Check for custom device name first
		const customName = localStorage.getItem(DeviceIdentityManager.DEVICE_NAME_KEY);
		if (customName) {
			return customName;
		}

		// Derive from platform information
		return this.detectPlatformName();
	}

	/**
	 * Set a custom human-readable device name.
	 */
	setDeviceName(name: string): void {
		localStorage.setItem(DeviceIdentityManager.DEVICE_NAME_KEY, name);
	}

	/**
	 * Clear the custom device name (will fall back to platform detection).
	 */
	clearDeviceName(): void {
		localStorage.removeItem(DeviceIdentityManager.DEVICE_NAME_KEY);
	}

	/**
	 * Reset the device ID (generates a new one).
	 * Use with caution - this breaks existing device→user mappings.
	 */
	resetDeviceId(): string {
		const newId = this.generateUUID();
		localStorage.setItem(DeviceIdentityManager.STORAGE_KEY, newId);
		this.cachedDeviceId = newId;
		return newId;
	}

	/**
	 * Generate a UUID v4.
	 * Uses crypto.randomUUID if available, otherwise falls back to manual generation.
	 */
	private generateUUID(): string {
		// Use native crypto.randomUUID if available (modern browsers/Electron)
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
			return crypto.randomUUID();
		}

		// Fallback: manual UUID v4 generation
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * Detect platform name from navigator information.
	 */
	private detectPlatformName(): string {
		if (typeof navigator === "undefined") {
			return "Unknown Device";
		}

		const platform = navigator.platform || "";
		const userAgent = navigator.userAgent || "";

		// Detect specific platforms
		if (platform.includes("Win")) {
			return "Windows PC";
		} else if (platform.includes("Mac")) {
			if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
				return userAgent.includes("iPad") ? "iPad" : "iPhone";
			}
			return "Mac";
		} else if (platform.includes("Linux")) {
			if (userAgent.includes("Android")) {
				return "Android Device";
			}
			return "Linux PC";
		} else if (/iPhone|iPad|iPod/.test(userAgent)) {
			return "iOS Device";
		} else if (/Android/.test(userAgent)) {
			return "Android Device";
		}

		return platform || "Unknown Device";
	}

	/**
	 * Get a short device identifier for display.
	 * Returns last 8 characters of the device ID.
	 */
	getShortDeviceId(): string {
		const fullId = this.getOrCreateDeviceId();
		return fullId.slice(-8);
	}
}
