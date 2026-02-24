import { App, TFile } from "obsidian";

/**
 * Debug logging utility that writes to a file in the vault root.
 * This allows Claude to read debug output when developing at the local machine.
 *
 * Usage:
 *   plugin.debugLog.enable();
 *   plugin.debugLog.log("TagName", "Something happened", { data: "here" });
 *
 * The log file (debug.log) can be read by Claude to diagnose issues.
 */
/**
 * Known log categories grouped by subsystem.
 * Used by the settings UI to render grouped checkboxes.
 */
export const LOG_CATEGORY_GROUPS: Record<string, string[]> = {
	"Notifications": [
		"NotificationService", "BasesQueryWatcher", "NotificationCache",
		"BaseNotificationSyncService", "VaultWideNotificationService", "ToastNotification",
	],
	"Views": [
		"BasesViewBase", "UpcomingView", "BasesToolbarInjector", "TaskCard",
	],
	"Bulk operations": [
		"BulkConvertEngine", "BulkUpdateEngine", "BulkEditEngine", "BulkRescheduleModal",
	],
	"Services": [
		"TaskService", "CalendarSync", "Pomodoro", "ViewState",
		"InstantConvert", "BaseIdentityService", "ICSSubscription", "ICSNote",
	],
	"Other": [
		"DateUtils", "BasesHelpers", "DependencyCache", "PerformanceMonitor",
		"BasesDataAdapter", "BasesFilterConverter", "AutoExport",
	],
};

export class DebugLog {
	private app: App;
	private logPath = "debug.log";
	public enabled = false;
	public consoleOutput = false;
	private categories: Record<string, boolean> = {};
	private writeQueue: Promise<void> = Promise.resolve();
	private onEnabledChange?: (enabled: boolean) => void;

	constructor(app: App, initialEnabled = false, onEnabledChange?: (enabled: boolean) => void) {
		this.app = app;
		this.enabled = initialEnabled;
		this.onEnabledChange = onEnabledChange;
		if (initialEnabled) {
			console.log("[DebugLog] File logging enabled from settings - writing to debug.log");
		}
	}

	/**
	 * Set per-category filters. Categories set to `false` are suppressed.
	 * An empty object (default) means all categories are allowed.
	 */
	setCategories(cats: Record<string, boolean>): void {
		this.categories = cats;
	}

	/**
	 * Check if a given category tag is allowed to log.
	 * If no categories are configured, all are allowed (backwards compatible).
	 * If categories are configured, only those set to `true` (or not present) pass.
	 */
	private isCategoryEnabled(tag: string): boolean {
		// If no categories configured, allow all
		if (Object.keys(this.categories).length === 0) return true;
		// Explicitly disabled → suppress
		return this.categories[tag] !== false;
	}

	enable(): void {
		this.enabled = true;
		console.log("[DebugLog] File logging enabled - writing to debug.log");
		this.onEnabledChange?.(true);
	}

	disable(): void {
		this.enabled = false;
		console.log("[DebugLog] File logging disabled");
		this.onEnabledChange?.(false);
	}

	toggle(): boolean {
		if (this.enabled) {
			this.disable();
		} else {
			this.enable();
		}
		return this.enabled;
	}

	/**
	 * Set enabled state without triggering callback (for sync from settings)
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		console.log(`[DebugLog] File logging ${enabled ? "enabled" : "disabled"}`);
	}

	/**
	 * Log a debug message. Only outputs when debug mode is enabled.
	 * Per Obsidian plugin guidelines: debug messages should not be shown by default.
	 *
	 * @param tag - Category tag (e.g., "BasesQueryWatcher", "BulkConvert")
	 * @param message - Human-readable message
	 * @param data - Optional structured data to include
	 */
	async log(tag: string, message: string, data?: unknown): Promise<void> {
		// Bail early if neither output is on
		if (!this.enabled && !this.consoleOutput) return;
		// Per-category filter applies to both outputs
		if (!this.isCategoryEnabled(tag)) return;

		const timestamp = new Date().toISOString();
		if (this.consoleOutput) {
			if (data !== undefined) {
				console.log(`[${timestamp}] [${tag}] ${message}`, data);
			} else {
				console.log(`[${timestamp}] [${tag}] ${message}`);
			}
		}

		if (this.enabled) {
			this.writeQueue = this.writeQueue.then(() => this.writeToFile(tag, message, data));
			await this.writeQueue;
		}
	}

	/**
	 * Log a warning. Only outputs when enabled.
	 * Per Obsidian plugin guidelines: debug messages should not be shown by default.
	 */
	async warn(tag: string, message: string, data?: unknown): Promise<void> {
		if (!this.enabled && !this.consoleOutput) return;
		if (!this.isCategoryEnabled(tag)) return;

		const timestamp = new Date().toISOString();
		if (this.consoleOutput) {
			console.warn(`[${timestamp}] [${tag}] ${message}`, data);
		}

		if (this.enabled) {
			this.writeQueue = this.writeQueue.then(() =>
				this.writeToFile(tag, `⚠️ WARN: ${message}`, data)
			);
			await this.writeQueue;
		}
	}

	/**
	 * Log an error. ALWAYS outputs to console (errors are allowed per Obsidian guidelines).
	 * Also writes to file when debug mode is enabled.
	 */
	async error(tag: string, message: string, error?: unknown): Promise<void> {
		// Errors ALWAYS go to console (allowed per Obsidian guidelines)
		const timestamp = new Date().toISOString();
		console.error(`[${timestamp}] [${tag}] ${message}`, error);

		// Only write to file if enabled
		if (!this.enabled) return;

		const errorData =
			error instanceof Error
				? { message: error.message, stack: error.stack }
				: error;

		this.writeQueue = this.writeQueue.then(() =>
			this.writeToFile(tag, `❌ ERROR: ${message}`, errorData)
		);
		await this.writeQueue;
	}

	private async writeToFile(tag: string, message: string, data?: unknown): Promise<void> {
		try {
			const timestamp = new Date().toISOString();
			let logLine = `[${timestamp}] [${tag}] ${message}`;

			if (data !== undefined) {
				try {
					logLine += "\n" + JSON.stringify(data, null, 2);
				} catch {
					logLine += "\n[Unable to serialize data]";
				}
			}

			logLine += "\n---\n";

			const file = this.app.vault.getAbstractFileByPath(this.logPath);
			if (file instanceof TFile) {
				try {
					const existing = await this.app.vault.read(file);
					await this.app.vault.modify(file, existing + logLine);
				} catch {
					// File reference is stale (deleted on disk but cache not yet updated).
					// Recreate it.
					try { await this.app.vault.create(this.logPath, `# TaskNotes Debug Log\nCreated: ${timestamp}\n\n` + logLine); } catch { /* already recreated by a concurrent call */ }
				}
			} else {
				// Create file with header
				const header = `# TaskNotes Debug Log\nCreated: ${timestamp}\n\n`;
				try { await this.app.vault.create(this.logPath, header + logLine); } catch { /* already exists */ }
			}
		} catch (err) {
			// Don't let logging errors break the plugin
			console.error("[DebugLog] Failed to write to log file:", err);
		}
	}

	/**
	 * Clear the debug log file
	 */
	async clear(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.logPath);
			if (file instanceof TFile) {
				const header = `# TaskNotes Debug Log\nCleared: ${new Date().toISOString()}\n\n`;
				await this.app.vault.modify(file, header);
				console.log("[DebugLog] Log file cleared");
			}
		} catch (err) {
			console.error("[DebugLog] Failed to clear log file:", err);
		}
	}

	/**
	 * Delete the debug log file
	 */
	async delete(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.logPath);
			if (file instanceof TFile) {
				await this.app.vault.delete(file);
				console.log("[DebugLog] Log file deleted");
			}
		} catch (err) {
			console.error("[DebugLog] Failed to delete log file:", err);
		}
	}
}
