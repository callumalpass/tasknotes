import { Notice, TFile, EventRef } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo, Reminder, EVENT_TASK_UPDATED } from "../types";
import { parseDateToLocal } from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/NotificationService" });

interface NotificationQueueItem {
	taskPath: string;
	reminder: Reminder;
	notifyAt: number;
}

export class NotificationService {
	private plugin: TaskNotesPlugin;
	private notificationQueue: NotificationQueueItem[] = [];
	private broadScanInterval?: number;
	private quickCheckInterval?: number;
	private processedReminders: Set<string> = new Set(); // Track processed reminders to avoid duplicates
	private taskUpdateListener?: EventRef;
	private fileUpdateListener?: EventRef;
	private activeAudioContexts: Set<AudioContext> = new Set();
	private audioCleanupTimeouts: Set<number> = new Set();
	private lastBroadScanTime: number = Date.now();
	private lastQuickCheckTime: number = Date.now();

	// Configuration constants
	private readonly BROAD_SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes
	private readonly QUICK_CHECK_INTERVAL = 30 * 1000; // 30 seconds
	private readonly QUEUE_WINDOW = 5 * 60 * 1000; // 5 minutes ahead

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	async initialize(): Promise<void> {
		if (!this.plugin.settings.enableNotifications) {
			return;
		}

		// Request notification permission if using system notifications
		if (
			this.plugin.settings.notificationType === "system" &&
			typeof Notification !== "undefined"
		) {
			if (Notification.permission === "default") {
				await Notification.requestPermission();
			}
		}

		// Set up task update listener to handle stale notifications
		this.setupTaskUpdateListener();
		this.setupFileUpdateListener();

		// Start the two-tier interval system
		this.startBroadScan();
		this.startQuickCheck();

		// Do an initial scan
		await this.scanTasksAndBuildQueue();
	}

	destroy(): void {
		if (this.broadScanInterval) {
			window.clearInterval(this.broadScanInterval);
		}
		if (this.quickCheckInterval) {
			window.clearInterval(this.quickCheckInterval);
		}
		if (this.taskUpdateListener) {
			this.plugin.emitter.offref(this.taskUpdateListener);
		}
		if (this.fileUpdateListener) {
			this.plugin.emitter.offref(this.fileUpdateListener);
		}
		for (const timeout of this.audioCleanupTimeouts) {
			window.clearTimeout(timeout);
		}
		this.audioCleanupTimeouts.clear();
		for (const audioContext of this.activeAudioContexts) {
			if (audioContext.state !== "closed") {
				audioContext.close().catch(() => {});
			}
		}
		this.activeAudioContexts.clear();
		this.notificationQueue = [];
		this.processedReminders.clear();
	}

	private startBroadScan(): void {
		this.broadScanInterval = window.setInterval(() => {
			void (async () => {
				const now = Date.now();
				const timeSinceLastScan = now - this.lastBroadScanTime;

				// Check for system sleep/wake - if gap is significantly larger than interval, handle catch-up
				if (timeSinceLastScan > this.BROAD_SCAN_INTERVAL + 60000) {
					// 1 minute tolerance
					await this.handleSystemWakeUp();
				}

				await this.scanTasksAndBuildQueue();
				this.lastBroadScanTime = now;
			})();
		}, this.BROAD_SCAN_INTERVAL);
	}

	private startQuickCheck(): void {
		this.quickCheckInterval = window.setInterval(() => {
			const now = Date.now();
			const timeSinceLastCheck = now - this.lastQuickCheckTime;

			// Check for system sleep/wake for quick checks too
			if (timeSinceLastCheck > this.QUICK_CHECK_INTERVAL + 60000) {
				// 1 minute tolerance
				// Don't spam with catch-up, just process current queue
			}

			this.checkNotificationQueue();
			this.lastQuickCheckTime = now;
		}, this.QUICK_CHECK_INTERVAL);
	}

	private async scanTasksAndBuildQueue(): Promise<void> {
		// Clear existing queue and rebuild
		this.notificationQueue = [];

		// Get all tasks from the cache
		const tasks = await this.plugin.cacheManager.getAllTasks();
		const now = Date.now();
		const windowEnd = now + this.QUEUE_WINDOW;

		for (const task of tasks) {
			if (!task.reminders || task.reminders.length === 0) {
				continue;
			}

			for (const reminder of task.reminders) {
				// Skip if already processed
				const reminderId = `${task.path}-${reminder.id}`;
				if (this.processedReminders.has(reminderId)) {
					continue;
				}

				const notifyAt = this.calculateNotificationTime(task, reminder);
				if (notifyAt === null) {
					continue;
				}

				// Add to queue if within the next scan window
				if (notifyAt > now && notifyAt <= windowEnd) {
					this.notificationQueue.push({
						taskPath: task.path,
						reminder,
						notifyAt,
					});
				}
			}
		}

		// Sort queue by notification time
		this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);
	}

	private calculateNotificationTime(task: TaskInfo, reminder: Reminder): number | null {
		try {
			if (reminder.type === "absolute") {
				// Absolute reminder - parse the timestamp directly
				if (!reminder.absoluteTime) {
					return null;
				}
				return parseDateToLocal(reminder.absoluteTime).getTime();
			} else if (reminder.type === "relative") {
				// Relative reminder - calculate based on anchor date
				if (!reminder.relatedTo || !reminder.offset) {
					return null;
				}

				const anchorDateStr = reminder.relatedTo === "due" ? task.due : task.scheduled;
				if (!anchorDateStr) {
					return null;
				}

				// Parse the anchor date
				const anchorDate = parseDateToLocal(anchorDateStr);

				// Parse the ISO 8601 duration and apply offset
				const offsetMs = this.parseISO8601Duration(reminder.offset);
				if (offsetMs === null) {
					return null;
				}

				return anchorDate.getTime() + offsetMs;
			}
		} catch (error) {
			tasknotesLogger.error("Error calculating notification time:", {
				category: "provider",
				operation: "calculating-notification-time",
				error: error,
			});
			return null;
		}

		return null;
	}

	private parseISO8601Duration(duration: string): number | null {
		// Parse ISO 8601 duration format (e.g., "-PT15M", "P2D", "-PT1H30M")
		const match = duration.match(
			/^(-?)P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
		);

		if (!match) {
			return null;
		}

		const [, sign, years, months, weeks, days, hours, minutes, seconds] = match;

		let totalMs = 0;

		// Note: For simplicity, we treat months as 30 days and years as 365 days
		if (years) totalMs += parseInt(years) * 365 * 24 * 60 * 60 * 1000;
		if (months) totalMs += parseInt(months) * 30 * 24 * 60 * 60 * 1000;
		if (weeks) totalMs += parseInt(weeks) * 7 * 24 * 60 * 60 * 1000;
		if (days) totalMs += parseInt(days) * 24 * 60 * 60 * 1000;
		if (hours) totalMs += parseInt(hours) * 60 * 60 * 1000;
		if (minutes) totalMs += parseInt(minutes) * 60 * 1000;
		if (seconds) totalMs += parseInt(seconds) * 1000;

		// Apply sign for negative durations (before the anchor date)
		return sign === "-" ? -totalMs : totalMs;
	}

	private checkNotificationQueue(): void {
		const now = Date.now();
		const toRemove: number[] = [];

		for (let i = 0; i < this.notificationQueue.length; i++) {
			const item = this.notificationQueue[i];

			if (item.notifyAt <= now) {
				// Trigger the notification
				void this.triggerNotification(item);
				toRemove.push(i);

				// Mark as processed to avoid duplicates
				const reminderId = `${item.taskPath}-${item.reminder.id}`;
				this.processedReminders.add(reminderId);
			} else {
				// Queue is sorted, so we can break early
				break;
			}
		}

		// Remove triggered items from queue
		for (let i = toRemove.length - 1; i >= 0; i--) {
			this.notificationQueue.splice(toRemove[i], 1);
		}
	}

	private async triggerNotification(item: NotificationQueueItem): Promise<void> {
		// Get the task info for the notification
		const file = this.plugin.app.vault.getAbstractFileByPath(item.taskPath);
		if (!(file instanceof TFile)) {
			return;
		}

		const metadata = this.plugin.app.metadataCache.getFileCache(file);
		if (!metadata || !metadata.frontmatter) {
			return;
		}

		const task = this.plugin.fieldMapper.mapFromFrontmatter(
			metadata.frontmatter,
			item.taskPath,
			this.plugin.settings.storeTitleInFilename
		) as TaskInfo;

		// Generate notification message
		const message =
			item.reminder.description || this.generateDefaultMessage(task, item.reminder);

		this.playNotificationSound();

		if (this.plugin.settings.notificationType === "system") {
			// System notification
			if ("Notification" in window && Notification.permission === "granted") {
				const notification = new Notification(task.title || "TaskNotes Reminder", {
					body: message,
					tag: `tasknotes-${item.taskPath}-${item.reminder.id}`,
				});

				// Open task note when notification is clicked
				notification.onclick = () => {
					void this.plugin.app.workspace.openLinkText(item.taskPath, "", false);
					notification.close();
				};
			} else {
				// Fallback to in-app notice if system notifications aren't available
				this.showInAppNotice(message, item.taskPath);
			}
		} else {
			// In-app notification
			this.showInAppNotice(message, item.taskPath);
		}

		// Trigger webhook for reminder
		if (this.plugin.apiService) {
			await this.plugin.apiService.triggerWebhook("reminder.triggered", {
				task,
				reminder: item.reminder,
				notificationTime: new Date(item.notifyAt).toISOString(),
				message,
				notificationType: this.plugin.settings.notificationType,
			});
		}
	}

	playNotificationSound(): void {
		if (!this.plugin.settings.notificationSoundEnabled) {
			return;
		}

		const AudioContextConstructor =
			window.AudioContext ||
			(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

		if (!AudioContextConstructor) {
			return;
		}

		try {
			const audioContext = new AudioContextConstructor();
			const gainNode = audioContext.createGain();
			const volume = Math.max(
				0,
				Math.min(1, this.plugin.settings.notificationSoundVolume / 100)
			);

			gainNode.gain.value = volume * 0.3;
			gainNode.connect(audioContext.destination);

			const playTone = (frequency: number, durationSeconds: number) => {
				const oscillator = audioContext.createOscillator();
				oscillator.connect(gainNode);
				oscillator.frequency.value = frequency;
				oscillator.type = "sine";
				oscillator.start();
				oscillator.stop(audioContext.currentTime + durationSeconds);
			};

			playTone(880, 0.12);

			this.activeAudioContexts.add(audioContext);

			const secondToneTimeout = window.setTimeout(() => {
				try {
					playTone(1175, 0.12);
				} catch (error) {
					tasknotesLogger.error("Failed to play notification sound tone:", {
						category: "provider",
						operation: "play-notification-sound-tone",
						error: error,
					});
				}
			}, 140);
			this.audioCleanupTimeouts.add(secondToneTimeout);

			const cleanupTimeout = window.setTimeout(() => {
				this.activeAudioContexts.delete(audioContext);
				this.audioCleanupTimeouts.delete(secondToneTimeout);
				this.audioCleanupTimeouts.delete(cleanupTimeout);
				audioContext.close().catch(() => {});
			}, 320);
			this.audioCleanupTimeouts.add(cleanupTimeout);
		} catch (error) {
			tasknotesLogger.error("Failed to play notification sound:", {
				category: "provider",
				operation: "play-notification-sound",
				error: error,
			});
		}
	}

	async sendTestReminderNotification(): Promise<void> {
		const title = "TaskNotes Reminder";
		const message = "This is a test reminder from TaskNotes.";

		this.playNotificationSound();

		if (
			this.plugin.settings.notificationType === "system" &&
			typeof Notification !== "undefined"
		) {
			if (Notification.permission === "default") {
				await Notification.requestPermission();
			}

			if (Notification.permission === "granted") {
				new Notification(title, {
					body: message,
					tag: "tasknotes-test-reminder",
				});
				return;
			}
		}

		new Notice(message, 5000);
	}

	private showInAppNotice(message: string, taskPath: string): void {
		const notice = new Notice(message, 0); // 0 = persistent until clicked
		const noticeEl = (notice as unknown as { noticeEl: HTMLElement }).noticeEl;

		// Add click handler to open the task
		noticeEl.addEventListener("click", () => {
			void this.plugin.app.workspace.openLinkText(taskPath, "", false);
			notice.hide();
		});

		// Add styling to make it clickable
		noticeEl.classList.remove(
			"tn-static-cursor-grab-dad79857",
			"tn-static-cursor-pointer-2723efcc"
		);
		noticeEl.classList.add("tn-static-cursor-pointer-3b6a3a65");
	}

	private generateDefaultMessage(task: TaskInfo, reminder: Reminder): string {
		if (reminder.type === "absolute") {
			return `Reminder: ${task.title}`;
		} else {
			const anchor = reminder.relatedTo === "due" ? "due" : "scheduled";
			const offset = this.formatDurationForDisplay(reminder.offset || "");

			if (offset.startsWith("-")) {
				return `${task.title} is ${anchor} in ${offset.substring(1)}`;
			} else if (offset === "PT0S" || offset === "PT0M") {
				return `${task.title} is ${anchor} now`;
			} else {
				return `${task.title} was ${anchor} ${offset} ago`;
			}
		}
	}

	private formatDurationForDisplay(duration: string): string {
		const ms = this.parseISO8601Duration(duration);
		if (ms === null) return duration;

		const absMs = Math.abs(ms);
		const minutes = Math.floor(absMs / (60 * 1000));
		const hours = Math.floor(absMs / (60 * 60 * 1000));
		const days = Math.floor(absMs / (24 * 60 * 60 * 1000));

		let result = "";
		if (days > 0) {
			result = `${days} day${days > 1 ? "s" : ""}`;
		} else if (hours > 0) {
			result = `${hours} hour${hours > 1 ? "s" : ""}`;
		} else if (minutes > 0) {
			result = `${minutes} minute${minutes > 1 ? "s" : ""}`;
		} else {
			result = "now";
		}

		return ms < 0 ? `-${result}` : result;
	}

	// Public method to manually refresh reminders (useful for testing)
	async refreshReminders(): Promise<void> {
		await this.scanTasksAndBuildQueue();
	}

	private queueRemindersForTask(taskPath: string, task: TaskInfo): void {
		const now = Date.now();
		const windowEnd = now + this.QUEUE_WINDOW;

		if (!task.reminders || task.reminders.length === 0) {
			return;
		}

		for (const reminder of task.reminders) {
			const reminderId = `${taskPath}-${reminder.id}`;
			if (this.processedReminders.has(reminderId)) {
				continue;
			}

			const notifyAt = this.calculateNotificationTime(task, reminder);
			if (notifyAt === null) {
				continue;
			}

			if (notifyAt > now && notifyAt <= windowEnd) {
				this.notificationQueue.push({
					taskPath,
					reminder,
					notifyAt,
				});
			}
		}

		this.notificationQueue.sort((a, b) => a.notifyAt - b.notifyAt);
	}

	private async refreshTaskReminders(
		taskPath: string,
		updatedTask?: TaskInfo | null
	): Promise<void> {
		this.removeNotificationsForTask(taskPath);
		this.clearProcessedRemindersForTask(taskPath);

		const task =
			updatedTask === undefined
				? await this.plugin.cacheManager.getTaskInfo(taskPath)
				: updatedTask;

		if (!task) {
			return;
		}

		this.queueRemindersForTask(taskPath, task);
	}

	// Public method to clear processed reminders (useful when task is edited)
	clearProcessedRemindersForTask(taskPath: string): void {
		const keysToRemove: string[] = [];
		for (const key of this.processedReminders) {
			if (key.startsWith(`${taskPath}-`)) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach((key) => this.processedReminders.delete(key));
	}

	private setupTaskUpdateListener(): void {
		this.taskUpdateListener = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			async ({ path, updatedTask }) => {
				if (!path || !updatedTask) {
					return;
				}

				await this.refreshTaskReminders(path, updatedTask);
			}
		);
	}

	private setupFileUpdateListener(): void {
		this.fileUpdateListener = this.plugin.emitter.on(
			"file-updated",
			async ({ path }: { path?: string }) => {
				if (!path) {
					return;
				}

				await this.refreshTaskReminders(path);
			}
		);
	}

	private removeNotificationsForTask(taskPath: string): void {
		this.notificationQueue = this.notificationQueue.filter(
			(item) => item.taskPath !== taskPath
		);
	}

	private async handleSystemWakeUp(): Promise<void> {
		// Clear processed reminders to allow missed notifications to trigger
		// But only for reminders that are now past their notification time
		const now = Date.now();
		const keysToRemove: string[] = [];

		// Check all processed reminders and remove ones that should have triggered
		for (const key of this.processedReminders) {
			const [taskPath, reminderId] = key.split("-", 2);
			if (!taskPath || !reminderId) continue;

			// Try to get the task and check if the reminder time has passed
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
				if (task && task.reminders) {
					const reminder = task.reminders.find((r) => r.id === reminderId);
					if (reminder) {
						const notifyAt = this.calculateNotificationTime(task, reminder);
						if (notifyAt && notifyAt <= now) {
							keysToRemove.push(key);
						}
					}
				}
			} catch {
				// If we can't get the task, remove the processed reminder anyway
				keysToRemove.push(key);
			}
		}

		keysToRemove.forEach((key) => this.processedReminders.delete(key));

		// Perform a full scan to rebuild the queue with current data
		await this.scanTasksAndBuildQueue();
	}
}
